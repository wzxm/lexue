/**
 * family 云函数 - 家庭成员管理
 * 管理课表的共享成员：查看、修改权限、踢人、退出
 */

const cloud = require('wx-server-sdk');
cloud.init({ env: 'cloud1-1g0kf2p8b07af20f' });

const db = require('../../shared/db');
const { ERRORS, success, fail } = require('../../shared/errors');
const { getOpenId, requireOwner, requireMember } = require('../../shared/auth');
const validator = require('../../shared/validator');
const logger = require('../../shared/logger');

const FN = 'family';

/**
 * 获取课表的家庭成员列表
 * 需要是成员才能查看
 */
async function listMembers(openid, payload) {
  validator.require(payload, ['scheduleId']);

  const schedule = await requireMember(openid, payload.scheduleId);

  logger.info(FN, 'listMembers', { openid, scheduleId: payload.scheduleId });

  // 收集所有成员的 openid，批量拉用户信息
  const sharedWith = schedule.shared_with || [];
  const allOpenids = [schedule.owner_openid, ...sharedWith.map(m => m.openid)];

  // 批量查询用户信息（昵称、头像）
  const _ = db.getCommand();
  const users = await db.getList('users', { openid: _.in(allOpenids) });
  const userMap = {};
  users.forEach(u => { userMap[u.openid] = u; });

  // 构建成员列表
  const members = [
    {
      openid: schedule.owner_openid,
      permission: 'owner',
      is_owner: true,
      nickname: userMap[schedule.owner_openid]?.nickname || '',
      avatar_url: userMap[schedule.owner_openid]?.avatar_url || '',
    },
    ...sharedWith.map(m => ({
      openid: m.openid,
      permission: m.permission,
      is_owner: false,
      join_time: m.join_time,
      nickname: userMap[m.openid]?.nickname || '',
      avatar_url: userMap[m.openid]?.avatar_url || '',
    })),
  ];

  return success(members);
}

/**
 * 修改成员权限（只有 owner 可以操作）
 * permission: 'view' | 'edit'
 */
async function updatePermission(openid, payload) {
  validator.require(payload, ['scheduleId', 'targetOpenid', 'permission']);
  validator.enumValue(payload.permission, ['view', 'edit'], 'permission');

  const schedule = await requireOwner(openid, payload.scheduleId);

  // 不能改自己（owner）的权限
  if (payload.targetOpenid === openid) {
    return fail(ERRORS.PARAM_ERROR, '不能修改自己的权限');
  }

  const sharedWith = schedule.shared_with || [];
  const memberIndex = sharedWith.findIndex(m => m.openid === payload.targetOpenid);
  if (memberIndex === -1) {
    return fail(ERRORS.NOT_FOUND, '该成员不在课表中');
  }

  logger.info(FN, 'updatePermission', {
    openid,
    scheduleId: payload.scheduleId,
    target: payload.targetOpenid,
    permission: payload.permission,
  });

  // 更新 shared_with 数组中该成员的权限
  sharedWith[memberIndex].permission = payload.permission;

  await db.update('schedules', payload.scheduleId, { shared_with: sharedWith });
  return success(null);
}

/**
 * 移除成员（只有 owner 可以操作）
 */
async function removeMember(openid, payload) {
  validator.require(payload, ['scheduleId', 'targetOpenid']);

  const schedule = await requireOwner(openid, payload.scheduleId);

  if (payload.targetOpenid === openid) {
    return fail(ERRORS.PARAM_ERROR, 'owner 不能移除自己，如要转让请联系开发者（其实还没做这功能）');
  }

  const sharedWith = schedule.shared_with || [];
  const newSharedWith = sharedWith.filter(m => m.openid !== payload.targetOpenid);

  if (newSharedWith.length === sharedWith.length) {
    return fail(ERRORS.NOT_FOUND, '该成员不在课表中');
  }

  logger.info(FN, 'removeMember', {
    openid,
    scheduleId: payload.scheduleId,
    target: payload.targetOpenid,
  });

  await db.update('schedules', payload.scheduleId, { shared_with: newSharedWith });
  return success(null);
}

/**
 * 自己退出共享（只能退出别人的课表，不能退出自己创建的）
 */
async function leave(openid, payload) {
  validator.require(payload, ['scheduleId']);

  const schedule = await db.getOne('schedules', payload.scheduleId);
  if (!schedule) return fail(ERRORS.NOT_FOUND, '课表不存在');

  // owner 不能退出自己的课表
  if (schedule.owner_openid === openid) {
    return fail(ERRORS.PARAM_ERROR, '你是课表创建者，不能退出。要删除课表请使用删除功能');
  }

  const sharedWith = schedule.shared_with || [];
  const isMember = sharedWith.some(m => m.openid === openid);
  if (!isMember) {
    return fail(ERRORS.NOT_FOUND, '你不在该课表的成员列表中');
  }

  logger.info(FN, 'leave', { openid, scheduleId: payload.scheduleId });

  const newSharedWith = sharedWith.filter(m => m.openid !== openid);
  await db.update('schedules', payload.scheduleId, { shared_with: newSharedWith });

  return success(null);
}

// ——— 入口 ———
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();

  try {
    const openid = getOpenId(wxContext);
    const { action, payload = {} } = event;

    switch (action) {
      case 'listMembers':       return await listMembers(openid, payload);
      case 'updatePermission':  return await updatePermission(openid, payload);
      case 'removeMember':      return await removeMember(openid, payload);
      case 'leave':             return await leave(openid, payload);
      default:                  return fail(ERRORS.PARAM_ERROR, `未知的 action: ${action}`);
    }
  } catch (e) {
    if (e && typeof e.code === 'number') return e;
    logger.error(FN, event.action, e);
    return fail(ERRORS.INTERNAL_ERROR);
  }
};
