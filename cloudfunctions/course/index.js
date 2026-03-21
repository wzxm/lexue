/**
 * course 云函数 - 课程管理
 * 负责课程的增删改查，支持批量添加
 * 所有写操作需要校验课表编辑权限
 */

const cloud = require('wx-server-sdk');
cloud.init({ env: 'cloud1-1g0kf2p8b07af20f' });

const db = require('../../shared/db');
const { ERRORS, success, fail } = require('../../shared/errors');
const { getOpenId, requireMember, requireEdit } = require('../../shared/auth');
const validator = require('../../shared/validator');
const logger = require('../../shared/logger');

const FN = 'course';

// 每周7天，0=周日，1=周一，...，6=周六
const VALID_DAYS = [0, 1, 2, 3, 4, 5, 6];
// 每天最多12节课
const VALID_SLOTS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

/**
 * 获取课表下所有课程
 */
async function list(openid, payload) {
  validator.require(payload, ['scheduleId']);

  // 需要是课表成员才能查看
  await requireMember(openid, payload.scheduleId);

  const courses = await db.getList('courses', { schedule_id: payload.scheduleId }, {
    orderBy: { field: 'day_of_week', direction: 'asc' },
  });

  return success(courses);
}

/**
 * 添加单个课程
 */
async function create(openid, payload) {
  validator.require(payload, ['schedule_id', 'name', 'day_of_week', 'slot', 'color']);
  validator.maxLength(payload.name, 30, '课程名称');
  validator.enumValue(payload.day_of_week, VALID_DAYS, 'day_of_week');
  validator.enumValue(payload.slot, VALID_SLOTS, 'slot');
  validator.maxLength(payload.color, 20, 'color');

  // 需要编辑权限
  await requireEdit(openid, payload.schedule_id);

  logger.info(FN, 'create', { openid, scheduleId: payload.schedule_id, name: payload.name });

  const { _id } = await db.create('courses', {
    schedule_id: payload.schedule_id,
    name: payload.name,
    teacher: payload.teacher || '',
    room: payload.room || '',
    day_of_week: payload.day_of_week,
    slot: payload.slot,
    color: payload.color,
    weeks: payload.weeks || [], // 可选：指定哪几周上课，空数组表示每周都上
    remark: payload.remark || '',
  });

  const course = await db.getOne('courses', _id);
  return success(course);
}

/**
 * 修改课程（需要编辑权限）
 */
async function update(openid, payload) {
  validator.require(payload, ['courseId']);

  const course = await db.getOne('courses', payload.courseId);
  if (!course) return fail(ERRORS.NOT_FOUND, '课程不存在');

  // 通过课程的 schedule_id 校验编辑权限
  await requireEdit(openid, course.schedule_id);

  logger.info(FN, 'update', { openid, courseId: payload.courseId });

  if (payload.day_of_week !== undefined) validator.enumValue(payload.day_of_week, VALID_DAYS, 'day_of_week');
  if (payload.slot !== undefined) validator.enumValue(payload.slot, VALID_SLOTS, 'slot');
  if (payload.name) validator.maxLength(payload.name, 30, '课程名称');

  const allowed = ['name', 'teacher', 'room', 'day_of_week', 'slot', 'color', 'weeks', 'remark'];
  const updateData = {};
  for (const key of allowed) {
    if (payload[key] !== undefined) updateData[key] = payload[key];
  }

  await db.update('courses', payload.courseId, updateData);
  return success(null);
}

/**
 * 删除课程（需要编辑权限）
 */
async function remove(openid, payload) {
  validator.require(payload, ['courseId']);

  const course = await db.getOne('courses', payload.courseId);
  if (!course) return fail(ERRORS.NOT_FOUND, '课程不存在');

  await requireEdit(openid, course.schedule_id);

  logger.info(FN, 'delete', { openid, courseId: payload.courseId });

  // 删除课程相关的提醒
  await db.removeWhere('reminders', { course_id: payload.courseId });
  await db.remove('courses', payload.courseId);

  return success(null);
}

/**
 * 批量添加课程
 * 用于一次性导入整个课表，比逐个添加人性化多了
 */
async function batchCreate(openid, payload) {
  validator.require(payload, ['schedule_id', 'courses']);

  if (!Array.isArray(payload.courses) || payload.courses.length === 0) {
    return fail(ERRORS.PARAM_ERROR, '课程列表不能为空');
  }
  if (payload.courses.length > 100) {
    return fail(ERRORS.PARAM_ERROR, '单次批量添加不能超过100个课程');
  }

  await requireEdit(openid, payload.schedule_id);

  logger.info(FN, 'batchCreate', { openid, scheduleId: payload.schedule_id, count: payload.courses.length });

  // 逐个校验课程数据
  for (let i = 0; i < payload.courses.length; i++) {
    const c = payload.courses[i];
    if (!c.name || !c.color || c.day_of_week === undefined || c.slot === undefined) {
      return fail(ERRORS.PARAM_ERROR, `第 ${i + 1} 个课程缺少必填字段`);
    }
    validator.enumValue(c.day_of_week, VALID_DAYS, `第${i + 1}个课程的 day_of_week`);
    validator.enumValue(c.slot, VALID_SLOTS, `第${i + 1}个课程的 slot`);
  }

  // 批量创建，云开发没有批量 add，用循环（50条以内影响不大）
  const now = new Date();
  const results = [];
  for (const c of payload.courses) {
    const { _id } = await db.create('courses', {
      schedule_id: payload.schedule_id,
      name: c.name,
      teacher: c.teacher || '',
      room: c.room || '',
      day_of_week: c.day_of_week,
      slot: c.slot,
      color: c.color,
      weeks: c.weeks || [],
      remark: c.remark || '',
    });
    results.push(_id);
  }

  return success({ created: results.length, ids: results });
}

// ——— 入口 ———
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();

  try {
    const openid = getOpenId(wxContext);
    const { action, payload = {} } = event;

    switch (action) {
      case 'list':        return await list(openid, payload);
      case 'create':      return await create(openid, payload);
      case 'update':      return await update(openid, payload);
      case 'delete':      return await remove(openid, payload);
      case 'batchCreate': return await batchCreate(openid, payload);
      default:            return fail(ERRORS.PARAM_ERROR, `未知的 action: ${action}`);
    }
  } catch (e) {
    if (e && typeof e.code === 'number') return e;
    logger.error(FN, event.action, e);
    return fail(ERRORS.INTERNAL_ERROR);
  }
};
