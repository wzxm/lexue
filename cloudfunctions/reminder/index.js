/**
 * reminder 云函数 - 提醒管理
 *
 * 功能1：生成提醒记录（每日 00:05 触发）
 *   event.action = 'generate'
 *   每日扫描今天有课的用户，生成提醒记录
 *
 * 功能2：发送提醒消息（每分钟触发）
 *   event.action = 'send' 或不传 action
 *   每分钟扫描到期的提醒并发送微信订阅消息
 *
 * 触发器配置（在云开发控制台设置）：
 * 1. 生成提醒：Cron 表达式 5 0 * * *（每天 00:05）
 *    触发参数：{ "action": "generate" }
 * 2. 发送提醒：Cron 表达式 * * * * *（每分钟）
 *    触发参数：{ "action": "send" } 或 {}
 */

const cloud = require('wx-server-sdk');
cloud.init({ env: 'cloud1-1g0kf2p8b07af20f' });

const db = require('../../shared/db');
const logger = require('../../shared/logger');
const { generateReminders } = require('./generate');

const FN = 'reminder';

// 订阅消息模板ID
// 已在微信公众平台申请：上课提醒模板
// 模板ID: I1lkvTBguxU146JHrpdlNn9vZA60GBuMPlpW2dSsnK8
//
// 模板字段（需要根据实际申请的模板调整）：
// - 课程名称（thing）
// - 上课时间（time）
// - 上课地点（thing）
// - 温馨提示（thing）
const TEMPLATE_ID = 'I1lkvTBguxU146JHrpdlNn9vZA60GBuMPlpW2dSsnK8';

// 最大重试次数
const MAX_RETRY = 3;

/**
 * 发送微信订阅消息
 * @param {string} touser 接收者 openid
 * @param {object} data 模板消息数据
 * @returns {Promise<boolean>} 是否发送成功
 */
async function sendSubscribeMessage(touser, data) {
  try {
    await cloud.openapi.subscribeMessage.send({
      touser,
      templateId: TEMPLATE_ID,
      data,
    });
    return true;
  } catch (e) {
    logger.error(FN, 'sendSubscribeMessage', e);
    return false;
  }
}

/**
 * 主入口：根据 action 或 TriggerName 路由到不同功能
 */
exports.main = async (event, context) => {
  let action;

  // 如果是定时触发器调用，通过 TriggerName 判断
  if (event.TriggerName) {
    if (event.TriggerName === 'reminder_generate') {
      action = 'generate';
    } else if (event.TriggerName === 'reminder_send') {
      action = 'send';
    } else {
      action = 'send'; // 默认发送
    }
  } else {
    // 手动调用，通过 action 参数判断
    action = event.action || 'send';
  }

  try {
    if (action === 'generate') {
      // 生成今天的提醒记录
      return await generateReminders();
    } else if (action === 'send') {
      // 发送到期的提醒消息
      return await sendReminders();
    } else {
      return { error: `未知的 action: ${action}` };
    }
  } catch (e) {
    logger.error(FN, action, e);
    return { error: e.message };
  }
};

/**
 * 发送到期的提醒消息
 */
async function sendReminders() {
  const now = new Date();
  logger.info(FN, 'scan:start', { time: now.toISOString() });

  try {
    const _ = db.getCommand();

    // 查询所有 pending 且 trigger_time <= now 的提醒
    // 每次最多处理 50 条，避免超时
    const reminders = await db.getList('reminders', {
      status: 'pending',
      trigger_time: _.lte(now),
      retry_count: _.lt(MAX_RETRY),
    }, { limit: 50 });

    if (reminders.length === 0) {
      logger.info(FN, 'scan:empty', { time: now.toISOString() });
      return { processed: 0 };
    }

    logger.info(FN, 'scan:found', { count: reminders.length });

    let successCount = 0;
    let failCount = 0;

    for (const reminder of reminders) {
      try {
        // 查询对应用户是否开启了通知，以及是否有订阅授权
        const user = await db.findOne('users', { openid: reminder.openid });
        if (!user || !user.settings?.notify_enabled) {
          // 用户关闭了通知，直接标记跳过
          await db.update('reminders', reminder._id, { status: 'skipped' });
          continue;
        }

        // 检查是否有该模板的订阅授权
        const subscribeToken = (user.subscribe_tokens || []).find(
          t => t.template_id === TEMPLATE_ID && t.result === 'accept'
        );
        if (!subscribeToken) {
          // 没有授权，跳过
          await db.update('reminders', reminder._id, { status: 'skipped', skip_reason: 'no_subscribe' });
          continue;
        }

        // 构造消息内容
        // 字段名必须与微信公众平台模板一致
        // 模板字段：thing3(日程描述) / time2(日程时间) / thing6(备注)
        const messageData = {
          thing3: { value: reminder.course_name },                    // 日程描述：课程名称
          time2: { value: reminder.course_time },                     // 日程时间：上课时间
          thing6: { value: `${reminder.dismiss_type}提前${reminder.advance_minutes}分钟` }, // 备注：提醒信息
        };

        const sent = await sendSubscribeMessage(reminder.openid, messageData);

        if (sent) {
          await db.update('reminders', reminder._id, {
            status: 'sent',
            sent_at: new Date(),
          });

          // 一次性订阅消息发送后，授权失效，需要清除用户的订阅授权记录
          // 这样前端可以检测到授权已失效，提示用户重新授权
          const userToUpdate = await db.findOne('users', { openid: reminder.openid });
          if (userToUpdate && userToUpdate.subscribe_tokens) {
            const updatedTokens = userToUpdate.subscribe_tokens.map(t => {
              if (t.template_id === TEMPLATE_ID && t.result === 'accept') {
                return { ...t, result: 'used', used_at: new Date() };
              }
              return t;
            });
            await db.update('users', userToUpdate._id, { subscribe_tokens: updatedTokens });
          }

          successCount++;
        } else {
          // 发送失败，重试次数+1
          const newRetryCount = (reminder.retry_count || 0) + 1;
          const newStatus = newRetryCount >= MAX_RETRY ? 'failed' : 'pending';
          await db.update('reminders', reminder._id, {
            status: newStatus,
            retry_count: newRetryCount,
            last_error: '发送失败',
          });
          failCount++;
        }
      } catch (e) {
        logger.error(FN, `process:${reminder._id}`, e);
        const newRetryCount = (reminder.retry_count || 0) + 1;
        const newStatus = newRetryCount >= MAX_RETRY ? 'failed' : 'pending';
        await db.update('reminders', reminder._id, {
          status: newStatus,
          retry_count: newRetryCount,
          last_error: e.message,
        }).catch(() => {}); // 更新失败也不影响其他提醒
        failCount++;
      }
    }

    logger.info(FN, 'scan:done', { total: reminders.length, success: successCount, fail: failCount });
    return { processed: reminders.length, success: successCount, fail: failCount };

  } catch (e) {
    logger.error(FN, 'scan:error', e);
    return { processed: 0, error: e.message };
  }
}
