/**
 * student 云函数 - 学生管理
 * 负责学生的增删改查，一个用户可以有多个学生（孩子）
 */

const cloud = require('wx-server-sdk');
cloud.init({ env: 'cloud1-1g0kf2p8b07af20f' });

const db = require('../../shared/db');
const { ERRORS, success, fail } = require('../../shared/errors');
const { getOpenId } = require('../../shared/auth');
const validator = require('../../shared/validator');
const logger = require('../../shared/logger');

const FN = 'student';

/**
 * 获取当前用户的学生列表
 */
async function list(openid) {
  logger.info(FN, 'list', { openid });
  const students = await db.getList('students', { owner_openid: openid }, {
    orderBy: { field: 'createTime', direction: 'desc' },
  });
  return success(students);
}

/**
 * 创建学生
 */
async function create(openid, payload) {
  validator.requireFields(payload, ['name']);
  validator.maxLength(payload.name, 20, '学生姓名');
  if (payload.school_name) validator.maxLength(payload.school_name, 50, '学校名称');
  if (payload.grade) validator.maxLength(payload.grade, 20, '年级');

  logger.info(FN, 'create', { openid, name: payload.name });

  const { _id } = await db.create('students', {
    owner_openid: openid,
    name: payload.name,
    school_name: payload.school_name || '',
    grade: payload.grade || '',
    gender: payload.gender || 0,
    avatar_url: payload.avatar_url || '',
  });

  const student = await db.getOne('students', _id);
  return success(student);
}

/**
 * 获取学生详情（需要是 owner）
 */
async function get(openid, payload) {
  validator.requireFields(payload, ['studentId']);

  const student = await db.getOne('students', payload.studentId);
  if (!student) return fail(ERRORS.NOT_FOUND, '学生不存在');
  if (student.owner_openid !== openid) return fail(ERRORS.FORBIDDEN);

  return success(student);
}

/**
 * 修改学生信息（需要是 owner）
 */
async function update(openid, payload) {
  validator.requireFields(payload, ['studentId']);

  const student = await db.getOne('students', payload.studentId);
  if (!student) return fail(ERRORS.NOT_FOUND, '学生不存在');
  if (student.owner_openid !== openid) return fail(ERRORS.FORBIDDEN);

  logger.info(FN, 'update', { openid, studentId: payload.studentId });

  // 只允许更新这些字段
  const allowed = ['name', 'school_name', 'grade', 'gender', 'avatar_url'];
  const updateData = {};
  for (const key of allowed) {
    if (payload[key] !== undefined) {
      updateData[key] = payload[key];
    }
  }

  if (payload.name) validator.maxLength(payload.name, 20, '学生姓名');
  if (payload.school_name) validator.maxLength(payload.school_name, 50, '学校名称');
  if (payload.grade) validator.maxLength(payload.grade, 20, '年级');

  await db.update('students', payload.studentId, updateData);
  return success(null);
}

/**
 * 删除学生（需要是 owner）
 * 同时级联删除该学生下的所有课表和课程，不删干净不行
 */
async function remove(openid, payload) {
  validator.requireFields(payload, ['studentId']);

  const student = await db.getOne('students', payload.studentId);
  if (!student) return fail(ERRORS.NOT_FOUND, '学生不存在');
  if (student.owner_openid !== openid) return fail(ERRORS.FORBIDDEN);

  logger.info(FN, 'delete', { openid, studentId: payload.studentId });

  // 查找该学生的所有课表
  const schedules = await db.getList('schedules', { student_id: payload.studentId });

  // 逐个删除课表下的课程、提醒、分享码
  for (const schedule of schedules) {
    await db.removeWhere('courses', { schedule_id: schedule._id });
    await db.removeWhere('reminders', { schedule_id: schedule._id });
    await db.removeWhere('share_codes', { schedule_id: schedule._id });
  }

  // 删除所有课表
  await db.removeWhere('schedules', { student_id: payload.studentId });

  // 最后删学生本体
  await db.remove('students', payload.studentId);

  return success(null);
}

// ——— 入口 ———
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();

  try {
    const openid = getOpenId(wxContext);
    const { action, payload = {} } = event;

    switch (action) {
      case 'list':   return await list(openid);
      case 'create': return await create(openid, payload);
      case 'get':    return await get(openid, payload);
      case 'update': return await update(openid, payload);
      case 'delete': return await remove(openid, payload);
      default:       return fail(ERRORS.PARAM_ERROR, `未知的 action: ${action}`);
    }
  } catch (e) {
    if (e && typeof e.code === 'number') return e;
    logger.error(FN, event.action, e);
    return fail(ERRORS.INTERNAL_ERROR);
  }
};
