/**
 * reminder 云函数 - 提醒发送（定时触发）
 * 每分钟触发一次，扫描到期的提醒并发送微信订阅消息
 *
 * 触发器配置（在云开发控制台设置）：
 * Cron 表达式：* * * * *（每分钟）
 */

const cloud = require('wx-server-sdk');
cloud.init({ env: 'cloud1-1g0kf2p8b07af20f' });

const db = require('../../shared/db');
const logger = require('../../shared/logger');

const FN = 'reminder';

// 订阅消息模板ID（需要在微信公众平台申请）
// 上课提醒模板，字段根据实际申请的模板填写
const TEMPLATE_ID = 'YOUR_SUBSCRIBE_TEMPLATE_ID'; // 替换成真实的模板ID

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
 * 主入口：扫描并发送到期提醒
 */
exports.main = async (event, context) => {
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
};
