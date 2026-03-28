/**
 * notify 云函数 - 提醒设置管理
 * 管理用户的通知偏好设置和订阅消息授权状态
 */

const cloud = require('wx-server-sdk');
cloud.init({ env: 'cloud1-1g0kf2p8b07af20f' });

const db = require('../../shared/db');
const { ERRORS, success, fail } = require('../../shared/errors');
const { getOpenId } = require('../../shared/auth');
const validator = require('../../shared/validator');
const logger = require('../../shared/logger');

const FN = 'notify';

/**
 * 获取当前用户的提醒设置
 * 从 users.settings 读取
 */
async function getSettings(openid) {
  logger.info(FN, 'getSettings', { openid });

  const user = await db.findOne('users', { openid });
  if (!user) return fail(ERRORS.NOT_FOUND, '用户不存在');

  // 返回 settings，如果没有设置过则返回默认值
  const settings = user.settings || {
    notify_enabled: true,
    notify_advance_minutes: 30,
    notify_time_slots: [], // 指定哪些节次需要提醒，空数组表示全部提醒
  };

  return success(settings);
}

/**
 * 更新提醒设置
 */
async function updateSettings(openid, payload) {
  logger.info(FN, 'updateSettings', { openid });

  const user = await db.findOne('users', { openid });
  if (!user) return fail(ERRORS.NOT_FOUND, '用户不存在');

  const updateData = {};

  // 校验并更新各字段
  if (payload.notify_enabled !== undefined) {
    if (typeof payload.notify_enabled !== 'boolean') {
      return fail(ERRORS.PARAM_ERROR, 'notify_enabled 必须是布尔值');
    }
    updateData['settings.notify_enabled'] = payload.notify_enabled;
  }

  if (payload.notify_advance_minutes !== undefined) {
    validator.range(payload.notify_advance_minutes, 5, 120, 'notify_advance_minutes');
    updateData['settings.notify_advance_minutes'] = payload.notify_advance_minutes;
  }

  if (payload.notify_time_slots !== undefined) {
    if (!Array.isArray(payload.notify_time_slots)) {
      return fail(ERRORS.PARAM_ERROR, 'notify_time_slots 必须是数组');
    }
    updateData['settings.notify_time_slots'] = payload.notify_time_slots;
  }

  if (payload.student_settings !== undefined) {
    updateData['settings.student_settings'] = payload.student_settings;
  }

  if (Object.keys(updateData).length === 0) {
    return fail(ERRORS.PARAM_ERROR, '没有可更新的字段');
  }

  await db.update('users', user._id, updateData);
  return success(null);
}

/**
 * 记录订阅消息授权状态
 * 用户同意订阅消息后，前端调用此接口记录 token
 * subscribeRes 是微信 wx.requestSubscribeMessage 返回的结果
 */
async function recordSubscribe(openid, payload) {
  validator.requireFields(payload, ['templateId', 'result']);

  logger.info(FN, 'recordSubscribe', { openid, templateId: payload.templateId });

  const user = await db.findOne('users', { openid });
  if (!user) return fail(ERRORS.NOT_FOUND, '用户不存在');

  // result: 'accept' | 'reject' | 'ban'
  const subscribeTokens = user.subscribe_tokens || [];
  const existingIndex = subscribeTokens.findIndex(t => t.template_id === payload.templateId);

  const tokenRecord = {
    template_id: payload.templateId,
    result: payload.result, // accept/reject/ban
    update_time: new Date(),
  };

  if (existingIndex >= 0) {
    subscribeTokens[existingIndex] = tokenRecord;
  } else {
    subscribeTokens.push(tokenRecord);
  }

  await db.update('users', user._id, { subscribe_tokens: subscribeTokens });
  return success(null);
}

// ——— 入口 ———
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();

  try {
    const openid = getOpenId(wxContext);
    const { action, payload = {} } = event;

    switch (action) {
      case 'getSettings':      return await getSettings(openid);
      case 'updateSettings':   return await updateSettings(openid, payload);
      case 'recordSubscribe':  return await recordSubscribe(openid, payload);
      default:                 return fail(ERRORS.PARAM_ERROR, `未知的 action: ${action}`);
    }
  } catch (e) {
    if (e && typeof e.code === 'number') return e;
    logger.error(FN, event.action, e);
    return fail(ERRORS.INTERNAL_ERROR);
  }
};
