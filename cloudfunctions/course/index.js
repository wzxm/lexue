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

// 每周7天，1=周一，2=周二，...，7=周日（与前端 WeekDay 类型保持一致）
const VALID_DAYS = [1, 2, 3, 4, 5, 6, 7];
// 每天最多12节课
const VALID_SLOTS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
const GRADE_LEVELS = ['elementary', 'middle', 'high', 'college'];

function buildAllWeeks(totalWeeks) {
  const count = Number(totalWeeks);
  const safeCount = Number.isFinite(count) && count > 0 ? count : 20;
  return Array.from({ length: safeCount }, (_, i) => i + 1);
}

/**
 * 获取课表下所有课程
 */
async function list(openid, payload) {
  validator.requireFields(payload, ['scheduleId']);

  // 需要是课表成员才能查看
  await requireMember(openid, payload.scheduleId);

  const courses = await db.getList('courses', { schedule_id: payload.scheduleId }, {
    orderBy: { field: 'day_of_week', direction: 'asc' },
  });

  return success(courses.map(c => ({ ...c, id: c._id })));
}

/**
 * 检查课程冲突
 * @param {string} scheduleId 课表ID
 * @param {number} dayOfWeek 星期几（1-7）
 * @param {number} slot 节次（1-12）
 * @param {number[]} weeks 周次数组（空数组表示全部周）
 * @param {string} excludeCourseId 排除的课程ID（更新时用）
 * @returns {Promise<object|null>} 冲突的课程，无冲突返回 null
 */
async function checkConflict(scheduleId, dayOfWeek, slot, weeks, excludeCourseId = null) {
  // 查询同一课表、同一时间段的所有课程
  const existingCourses = await db.getList('courses', {
    schedule_id: scheduleId,
    day_of_week: dayOfWeek,
    slot: slot,
  });

  for (const existing of existingCourses) {
    // 排除自己（更新时）
    if (excludeCourseId && existing._id === excludeCourseId) continue;

    // 检查周次是否有交集
    const existingWeeks = existing.weeks || [];
    const newWeeks = weeks || [];

    // 如果任一课程的 weeks 为空，表示全部周，必然冲突
    if (existingWeeks.length === 0 || newWeeks.length === 0) {
      return existing;
    }

    // 检查两个数组是否有交集
    const hasIntersection = existingWeeks.some(w => newWeeks.includes(w));
    if (hasIntersection) {
      return existing;
    }
  }

  return null;
}

/**
 * 添加单个课程
 */
async function create(openid, payload) {
  validator.requireFields(payload, ['schedule_id', 'name', 'day_of_week', 'slot', 'color']);
  validator.maxLength(payload.name, 30, '课程名称');
  validator.enumValue(payload.day_of_week, VALID_DAYS, 'day_of_week');
  validator.enumValue(payload.slot, VALID_SLOTS, 'slot');
  validator.maxLength(payload.color, 20, 'color');

  // 需要编辑权限，同时拿到所属课表用于补齐归属字段
  const schedule = await requireEdit(openid, payload.schedule_id);
  const normalizedWeeks = Array.isArray(payload.weeks) && payload.weeks.length > 0
    ? payload.weeks
    : buildAllWeeks(schedule.total_weeks);

  // 检查课程冲突
  const conflict = await checkConflict(
    payload.schedule_id,
    payload.day_of_week,
    payload.slot,
    normalizedWeeks
  );
  if (conflict) {
    const weekInfo = conflict.weeks && conflict.weeks.length > 0
      ? `第 ${conflict.weeks.join('、')} 周`
      : '全部周';
    return fail(ERRORS.PARAM_ERROR, `课程冲突：${conflict.name}（${weekInfo}）已占用此时间段`);
  }

  logger.info(FN, 'create', { openid, scheduleId: payload.schedule_id, name: payload.name });

  const { _id } = await db.create('courses', {
    schedule_id: payload.schedule_id,
    student_id: schedule.student_id,
    owner_openid: schedule.owner_openid,
    name: payload.name,
    teacher: payload.teacher || '',
    room: payload.room || '',
    day_of_week: payload.day_of_week,
    slot: payload.slot,
    color: payload.color,
    weeks: normalizedWeeks,
    remark: payload.remark || '',
    contact: payload.contact !== undefined && payload.contact !== null ? String(payload.contact) : '',
  });

  const course = await db.getOne('courses', _id);
  return success({ ...course, id: course._id });
}

/**
 * 修改课程（需要编辑权限）
 */
async function update(openid, payload) {
  validator.requireFields(payload, ['courseId']);

  const course = await db.getOne('courses', payload.courseId);
  if (!course) return fail(ERRORS.NOT_FOUND, '课程不存在');

  // 通过课程的 schedule_id 校验编辑权限
  await requireEdit(openid, course.schedule_id);

  logger.info(FN, 'update', { openid, courseId: payload.courseId });

  if (payload.day_of_week !== undefined) validator.enumValue(payload.day_of_week, VALID_DAYS, 'day_of_week');
  if (payload.slot !== undefined) validator.enumValue(payload.slot, VALID_SLOTS, 'slot');
  if (payload.name) validator.maxLength(payload.name, 30, '课程名称');

  const allowed = ['name', 'teacher', 'room', 'day_of_week', 'slot', 'color', 'weeks', 'remark', 'contact'];
  const updateData = {};
  for (const key of allowed) {
    if (payload[key] !== undefined) updateData[key] = payload[key];
  }

  // 如果修改了时间或周次，需要检查冲突
  const needCheckConflict = payload.day_of_week !== undefined || payload.slot !== undefined || payload.weeks !== undefined;
  if (needCheckConflict) {
    const newDayOfWeek = payload.day_of_week !== undefined ? payload.day_of_week : course.day_of_week;
    const newSlot = payload.slot !== undefined ? payload.slot : course.slot;
    const newWeeks = payload.weeks !== undefined ? payload.weeks : course.weeks;

    const conflict = await checkConflict(
      course.schedule_id,
      newDayOfWeek,
      newSlot,
      newWeeks,
      payload.courseId // 排除自己
    );
    if (conflict) {
      const weekInfo = conflict.weeks && conflict.weeks.length > 0
        ? `第 ${conflict.weeks.join('、')} 周`
        : '全部周';
      return fail(ERRORS.PARAM_ERROR, `课程冲突：${conflict.name}（${weekInfo}）已占用此时间段`);
    }
  }

  await db.update('courses', payload.courseId, updateData);
  return success(null);
}

/**
 * 删除课程（需要编辑权限）
 */
async function remove(openid, payload) {
  validator.requireFields(payload, ['courseId']);

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
  validator.requireFields(payload, ['schedule_id', 'courses']);

  if (!Array.isArray(payload.courses) || payload.courses.length === 0) {
    return fail(ERRORS.PARAM_ERROR, '课程列表不能为空');
  }
  if (payload.courses.length > 100) {
    return fail(ERRORS.PARAM_ERROR, '单次批量添加不能超过100个课程');
  }

  const schedule = await requireEdit(openid, payload.schedule_id);

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
  const results = [];
  const createdCourses = []; // 记录已创建的课程，用于检测批量内部冲突

  for (let i = 0; i < payload.courses.length; i++) {
    const c = payload.courses[i];
    const normalizedWeeks = Array.isArray(c.weeks) && c.weeks.length > 0
      ? c.weeks
      : buildAllWeeks(schedule.total_weeks);

    // 检查与数据库中已有课程的冲突
    const dbConflict = await checkConflict(
      payload.schedule_id,
      c.day_of_week,
      c.slot,
      normalizedWeeks
    );
    if (dbConflict) {
      const weekInfo = dbConflict.weeks && dbConflict.weeks.length > 0
        ? `第 ${dbConflict.weeks.join('、')} 周`
        : '全部周';
      return fail(ERRORS.PARAM_ERROR, `第 ${i + 1} 个课程冲突：${dbConflict.name}（${weekInfo}）已占用此时间段`);
    }

    // 检查与本批次已创建课程的冲突
    for (let j = 0; j < createdCourses.length; j++) {
      const prev = createdCourses[j];
      if (prev.day_of_week !== c.day_of_week || prev.slot !== c.slot) continue;

      const prevWeeks = prev.weeks || [];
      const currWeeks = normalizedWeeks || [];
      if (prevWeeks.length === 0 || currWeeks.length === 0) {
        return fail(ERRORS.PARAM_ERROR, `第 ${i + 1} 个课程与第 ${j + 1} 个课程冲突（同一时间段）`);
      }
      const hasIntersection = prevWeeks.some(w => currWeeks.includes(w));
      if (hasIntersection) {
        const weekInfo = prevWeeks.filter(w => currWeeks.includes(w)).join('、');
        return fail(ERRORS.PARAM_ERROR, `第 ${i + 1} 个课程与第 ${j + 1} 个课程冲突（第 ${weekInfo} 周）`);
      }
    }

    const { _id } = await db.create('courses', {
      schedule_id: payload.schedule_id,
      student_id: schedule.student_id,
      owner_openid: schedule.owner_openid,
      name: c.name,
      teacher: c.teacher || '',
      room: c.room || '',
      day_of_week: c.day_of_week,
      slot: c.slot,
      color: c.color,
      weeks: normalizedWeeks,
      remark: c.remark || '',
      contact: c.contact !== undefined && c.contact !== null ? String(c.contact) : '',
    });
    results.push(_id);
    createdCourses.push({ day_of_week: c.day_of_week, slot: c.slot, weeks: normalizedWeeks });
  }

  return success({ created: results.length, ids: results });
}

/**
 * 当前用户的自定义课程名称预设列表
 */
async function listPresets(openid) {
  const rows = await db.getList('course_name_presets', { openid }, {
    orderBy: { field: 'created_at', direction: 'desc' },
  });
  const presets = rows.map(r => ({
    id: r._id,
    name: r.name,
    grade_level: r.grade_level,
  }));
  return success({ presets });
}

/**
 * 添加自定义课程名称预设（同用户同学龄段去重）
 */
async function addPreset(openid, payload) {
  validator.requireFields(payload, ['name', 'grade_level']);
  const name = String(payload.name).trim();
  if (!name) {
    return fail(ERRORS.PARAM_ERROR, '名称不能为空');
  }
  validator.maxLength(name, 20, '课程名称');
  validator.enumValue(payload.grade_level, GRADE_LEVELS, 'grade_level');

  const dup = await db.findOne('course_name_presets', {
    openid,
    grade_level: payload.grade_level,
    name,
  });
  if (dup) {
    return fail(ERRORS.PARAM_ERROR, '该学龄段下已有同名课程');
  }

  logger.info(FN, 'addPreset', { openid, name, grade_level: payload.grade_level });

  const { _id } = await db.create('course_name_presets', {
    openid,
    name,
    grade_level: payload.grade_level,
    created_at: new Date(),
  });

  return success({
    id: _id,
    name,
    grade_level: payload.grade_level,
  });
}

/**
 * 删除自定义课程名称预设
 */
async function deletePreset(openid, payload) {
  validator.requireFields(payload, ['presetId']);
  const doc = await db.getOne('course_name_presets', payload.presetId);
  if (!doc) {
    // 删除接口设计为幂等：目标不存在也视为删除成功，避免前端重试/双击产生业务报错
    return success(null);
  }
  if (doc.openid !== openid) {
    return fail(ERRORS.FORBIDDEN, '无权删除此预设');
  }
  logger.info(FN, 'deletePreset', { openid, presetId: payload.presetId });
  await db.remove('course_name_presets', payload.presetId);
  return success(null);
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
      case 'listPresets': return await listPresets(openid);
      case 'addPreset':   return await addPreset(openid, payload);
      case 'deletePreset': return await deletePreset(openid, payload);
      default:            return fail(ERRORS.PARAM_ERROR, `未知的 action: ${action}`);
    }
  } catch (e) {
    if (e && typeof e.code === 'number') return e;
    logger.error(FN, event.action, e);
    return fail(ERRORS.INTERNAL_ERROR);
  }
};
