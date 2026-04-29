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

// 订阅消息模板ID（需要在微信公众平台申请）
// 申请步骤：
// 1. 登录微信公众平台 mp.weixin.qq.com
// 2. 功能 → 订阅消息 → 公共模板库
// 3. 搜索"上课提醒"或类似模板，选择合适的模板
// 4. 添加后，在"我的模板"中查看模板ID
// 5. 将模板ID填入下方常量
//
// 推荐模板字段：
// - 课程名称（thing）
// - 上课时间（time）
// - 上课地点（thing）
// - 温馨提示（thing）
const TEMPLATE_ID = process.env.SUBSCRIBE_TEMPLATE_ID || 'YOUR_SUBSCRIBE_TEMPLATE_ID'; // 替换成真实的模板ID

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
 * 主入口：根据 action 路由到不同功能
 */
exports.main = async (event, context) => {
  const action = event.action || 'send';

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
        // 注意：实际字段名要和申请的模板保持一致，这里是示例
        const messageData = {
          thing1: { value: reminder.course_name },          // 课程名称
          time2: { value: reminder.course_time },           // 上课时间
          thing3: { value: reminder.room || '待确定' },      // 上课地点
          thing4: { value: `提前${reminder.advance_minutes}分钟` }, // 提醒时间
        };

        const sent = await sendSubscribeMessage(reminder.openid, messageData);

        if (sent) {
          await db.update('reminders', reminder._id, {
            status: 'sent',
            sent_at: new Date(),
          });
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
