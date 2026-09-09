/**
 * 权限校验工具
 * 身份：resolveCurrentUser 从 WXContext OPENID 解析稳定 userId
 */

const { getOne, findOne } = require('./db');
const { ERRORS, fail } = require('./errors');

function getOpenId(wxContext) {
  const openid = wxContext && wxContext.OPENID;
  if (!openid) {
    throw fail(ERRORS.UNAUTHORIZED, '无法获取用户身份');
  }
  return openid;
}

async function resolveCurrentUser(wxContext) {
  const openid = getOpenId(wxContext);
  const unionid = (wxContext && wxContext.UNIONID) || '';
  const user = await findOne('users', { openid });
  if (!user) {
    throw fail(ERRORS.UNAUTHORIZED, '请先登录');
  }
  const status = user.status || 'active';
  if (status === 'disabled' || status === 'deleted') {
    throw fail(ERRORS.FORBIDDEN, '账号状态异常，无法访问');
  }
  return {
    userId: user._id,
    openid,
    unionid,
    user,
  };
}

async function requireOwner(userId, scheduleId) {
  const schedule = await getOne('schedules', scheduleId);
  if (!schedule) {
    throw fail(ERRORS.NOT_FOUND, '课表不存在');
  }
  if (schedule.owner_user_id !== userId) {
    throw fail(ERRORS.FORBIDDEN, '只有课表创建者才能执行此操作');
  }
  return schedule;
}

async function requireMember(userId, scheduleId) {
  const schedule = await getOne('schedules', scheduleId);
  if (!schedule) {
    throw fail(ERRORS.NOT_FOUND, '课表不存在');
  }
  const isOwner = schedule.owner_user_id === userId;
  const isMember = Array.isArray(schedule.shared_with)
    && schedule.shared_with.some(m => m && m.user_id === userId);
  if (!isOwner && !isMember) {
    throw fail(ERRORS.FORBIDDEN, '没有访问此课表的权限');
  }
  return schedule;
}

async function requireEdit(userId, scheduleId) {
  const schedule = await getOne('schedules', scheduleId);
  if (!schedule) {
    throw fail(ERRORS.NOT_FOUND, '课表不存在');
  }
  const isOwner = schedule.owner_user_id === userId;
  if (isOwner) return schedule;

  const member = Array.isArray(schedule.shared_with)
    && schedule.shared_with.find(m => m && m.user_id === userId);
  if (!member || member.permission !== 'edit') {
    throw fail(ERRORS.FORBIDDEN, '没有编辑此课表的权限');
  }
  return schedule;
}

module.exports = {
  getOpenId,
  resolveCurrentUser,
  requireOwner,
  requireMember,
  requireEdit,
};
