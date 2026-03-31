/**
 * schedule 云函数 - 课表管理
 * 负责课表的增删改查，支持共享课表查看
 */

const cloud = require('wx-server-sdk');
cloud.init({ env: 'cloud1-1g0kf2p8b07af20f' });

const db = require('../../shared/db');
const { ERRORS, success, fail } = require('../../shared/errors');
const { getOpenId, requireOwner, requireMember, requireEdit } = require('../../shared/auth');
const validator = require('../../shared/validator');
const logger = require('../../shared/logger');

const FN = 'schedule';

/**
 * 获取当前用户可见的所有课表
 * 包括：自己创建的 + 别人共享给自己的
 */
async function list(openid) {
  logger.info(FN, 'list', { openid });

  // 自己创建的课表
  const ownSchedules = await db.getList('schedules', { owner_openid: openid }, {
    orderBy: { field: 'createTime', direction: 'desc' },
  });

  // 共享给自己的课表（在 shared_with 数组中有自己的 openid）
  const _ = db.getCommand();
  const sharedSchedules = await db.getList('schedules', {
    'shared_with': _.elemMatch({ openid }),
    owner_openid: _.neq(openid), // 排除自己创建的（避免重复）
  });

  const mapId = (schedule) => schedule ? { ...schedule, id: schedule._id } : schedule;

  return success({
    own: ownSchedules.map(mapId),
    shared: sharedSchedules.map(mapId),
  });
}

/**
 * 创建课表
 */
async function create(openid, payload) {
  validator.requireFields(payload, ['student_id', 'name', 'semester']);
  validator.maxLength(payload.name, 50, '课表名称');
  validator.maxLength(payload.semester, 20, '学期');

  // 检查学生存在且属于自己
  const student = await db.getOne('students', payload.student_id);
  if (!student) return fail(ERRORS.NOT_FOUND, '学生不存在');
  if (student.owner_openid !== openid) return fail(ERRORS.FORBIDDEN, '没有权限为此学生创建课表');

  logger.info(FN, 'create', { openid, studentId: payload.student_id });

  // 新课表创建后自动成为默认课表，先把该学生其他课表取消默认
  await db.updateWhere('schedules', {
    owner_openid: openid,
    student_id: payload.student_id,
  }, { is_default: false });

  const { _id } = await db.create('schedules', {
    owner_openid: openid,
    student_id: payload.student_id,
    name: payload.name,
    semester: payload.semester,
    is_default: true,
    shared_with: [], // 初始无共享成员
    remark: payload.remark || '',
  });

  const schedule = await db.getOne('schedules', _id);
  return success({ ...schedule, id: schedule._id });
}

/**
 * 获取课表详情（含课程列表）
 */
async function get(openid, payload) {
  validator.requireFields(payload, ['scheduleId']);

  // 需要是成员（owner 或 shared_with）才能查看
  const schedule = await requireMember(openid, payload.scheduleId);

  // 拉取该课表下的所有课程
  const courses = await db.getList('courses', { schedule_id: payload.scheduleId }, {
    orderBy: { field: 'day_of_week', direction: 'asc' },
  });

  return success({ ...schedule, id: schedule._id, courses });
}

/**
 * 修改课表（需要有编辑权限）
 */
async function update(openid, payload) {
  validator.requireFields(payload, ['scheduleId']);

  await requireEdit(openid, payload.scheduleId);

  logger.info(FN, 'update', { openid, scheduleId: payload.scheduleId });

  const allowed = ['name', 'semester', 'remark'];
  const updateData = {};
  for (const key of allowed) {
    if (payload[key] !== undefined) updateData[key] = payload[key];
  }

  if (payload.name) validator.maxLength(payload.name, 50, '课表名称');

  await db.update('schedules', payload.scheduleId, updateData);
  return success(null);
}

/**
 * 删除课表（只有 owner 可以删）
 * 级联删除课程和提醒记录
 */
async function remove(openid, payload) {
  validator.requireFields(payload, ['scheduleId']);

  await requireOwner(openid, payload.scheduleId);

  logger.info(FN, 'delete', { openid, scheduleId: payload.scheduleId });

  // 删除课程
  await db.removeWhere('courses', { schedule_id: payload.scheduleId });
  // 删除提醒
  await db.removeWhere('reminders', { schedule_id: payload.scheduleId });
  // 删除分享码
  await db.removeWhere('share_codes', { schedule_id: payload.scheduleId });
  // 删课表
  await db.remove('schedules', payload.scheduleId);

  return success(null);
}

/**
 * 设置默认课表（只有 owner 可以设置）
 * 同一用户同一学生只能有一个默认课表
 */
async function setDefault(openid, payload) {
  validator.requireFields(payload, ['scheduleId']);

  const schedule = await requireOwner(openid, payload.scheduleId);

  logger.info(FN, 'setDefault', { openid, scheduleId: payload.scheduleId });

  // 先把该学生的所有课表取消默认
  await db.updateWhere('schedules', {
    owner_openid: openid,
    student_id: schedule.student_id,
  }, { is_default: false });

  // 设置当前课表为默认
  await db.update('schedules', payload.scheduleId, { is_default: true });
  return success(null);
}

// ——— 入口 ———
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();

  try {
    const openid = getOpenId(wxContext);
    const { action, payload = {} } = event;

    switch (action) {
      case 'list':       return await list(openid);
      case 'create':     return await create(openid, payload);
      case 'get':        return await get(openid, payload);
      case 'update':     return await update(openid, payload);
      case 'delete':     return await remove(openid, payload);
      case 'setDefault': return await setDefault(openid, payload);
      default:           return fail(ERRORS.PARAM_ERROR, `未知的 action: ${action}`);
    }
  } catch (e) {
    if (e && typeof e.code === 'number') return e;
    logger.error(FN, event.action, e);
    return fail(ERRORS.INTERNAL_ERROR);
  }
};
