/**
 * 权限校验工具
 * 所有身份验证从云函数上下文获取，前端传的 openid 一概不信
 */

const { getOne, findOne } = require('./db');
const { ERRORS, fail } = require('./errors');

/**
 * 从云函数上下文获取 OPENID
 * 这是身份的唯一来源，别从 payload 里取，那是傻逼做法
 * @param {object} wxContext cloud.getWXContext() 返回的上下文
 * @returns {string} openid
 * @throws 如果没有 openid 则抛出错误响应
 */
function getOpenId(wxContext) {
  const openid = wxContext.OPENID;
  if (!openid) {
    throw fail(ERRORS.UNAUTHORIZED, '无法获取用户身份');
  }
  return openid;
}

/**
 * 校验是否是课表 owner
 * @param {string} openid 当前用户 openid
 * @param {string} scheduleId 课表ID
 * @returns {Promise<object>} 课表数据
 * @throws 如果无权限则抛出错误响应
 */
async function requireOwner(openid, scheduleId) {
  const schedule = await getOne('schedules', scheduleId);
  if (!schedule) {
    throw fail(ERRORS.NOT_FOUND, '课表不存在');
  }
  if (schedule.owner_openid !== openid) {
    throw fail(ERRORS.FORBIDDEN, '只有课表创建者才能执行此操作');
  }
  return schedule;
}

/**
 * 校验是否是课表成员（含 owner）
 * owner 或 shared_with 中的成员均可访问
 * @param {string} openid 当前用户 openid
 * @param {string} scheduleId 课表ID
 * @returns {Promise<object>} 课表数据
 * @throws 如果无权限则抛出错误响应
 */
async function requireMember(openid, scheduleId) {
  const schedule = await getOne('schedules', scheduleId);
  if (!schedule) {
    throw fail(ERRORS.NOT_FOUND, '课表不存在');
  }
  const isOwner = schedule.owner_openid === openid;
  const isMember = Array.isArray(schedule.shared_with) &&
    schedule.shared_with.some(m => m.openid === openid);
  if (!isOwner && !isMember) {
    throw fail(ERRORS.FORBIDDEN, '没有访问此课表的权限');
  }
  return schedule;
}

/**
 * 校验是否有编辑权限
 * owner 有全部编辑权限；shared_with 成员需要 permission = 'edit'
 * @param {string} openid 当前用户 openid
 * @param {string} scheduleId 课表ID
 * @returns {Promise<object>} 课表数据
 * @throws 如果无权限则抛出错误响应
 */
async function requireEdit(openid, scheduleId) {
  const schedule = await getOne('schedules', scheduleId);
  if (!schedule) {
    throw fail(ERRORS.NOT_FOUND, '课表不存在');
  }
  const isOwner = schedule.owner_openid === openid;
  if (isOwner) return schedule;

  const member = Array.isArray(schedule.shared_with) &&
    schedule.shared_with.find(m => m.openid === openid);
  if (!member || member.permission !== 'edit') {
    throw fail(ERRORS.FORBIDDEN, '没有编辑此课表的权限');
  }
  return schedule;
}

module.exports = { getOpenId, requireOwner, requireMember, requireEdit };
