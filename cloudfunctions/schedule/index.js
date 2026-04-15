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
const INVITE_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const INVITE_CODE_LENGTH = 8;
const MAX_INVITE_CODE_ATTEMPTS = 20;

function validatePeriods(periods) {
  if (periods === undefined) return;
  if (!Array.isArray(periods) || periods.length === 0) {
    throw fail(ERRORS.PARAM_ERROR, '课节配置不能为空');
  }
  if (periods.length > 16) {
    throw fail(ERRORS.PARAM_ERROR, '课节数量不能超过16节');
  }
  for (let i = 0; i < periods.length; i++) {
    const p = periods[i] || {};
    if (!Number.isInteger(p.index) || p.index < 1 || p.index > 16) {
      throw fail(ERRORS.PARAM_ERROR, `第${i + 1}节课 index 不合法`);
    }
    if (typeof p.startTime !== 'string' || typeof p.endTime !== 'string') {
      throw fail(ERRORS.PARAM_ERROR, `第${i + 1}节课时间格式不合法`);
    }
    if (typeof p.label !== 'string' || !p.label.trim()) {
      throw fail(ERRORS.PARAM_ERROR, `第${i + 1}节课标签不能为空`);
    }
  }
}

function validatePeriodConfig(periodConfig) {
  if (!periodConfig || typeof periodConfig !== 'object') {
    throw fail(ERRORS.PARAM_ERROR, '课节分组配置不能为空');
  }

  const morningCount = Number(periodConfig.morning_count);
  const afternoonCount = Number(periodConfig.afternoon_count);
  const eveningCount = Number(periodConfig.evening_count);

  if (!Number.isInteger(morningCount) || morningCount < 1 || morningCount > 6) {
    throw fail(ERRORS.PARAM_ERROR, '上午课节数范围应为1-6');
  }
  if (!Number.isInteger(afternoonCount) || afternoonCount < 1 || afternoonCount > 6) {
    throw fail(ERRORS.PARAM_ERROR, '下午课节数范围应为1-6');
  }
  if (!Number.isInteger(eveningCount) || eveningCount < 0 || eveningCount > 4) {
    throw fail(ERRORS.PARAM_ERROR, '晚上课节数范围应为0-4');
  }
}

function validatePeriodShape(periods, periodConfig) {
  if (!Array.isArray(periods) || periods.length === 0) {
    throw fail(ERRORS.PARAM_ERROR, '课节配置不能为空');
  }
  validatePeriods(periods);
  validatePeriodConfig(periodConfig);

  const expectedCount = periodConfig.morning_count + periodConfig.afternoon_count + periodConfig.evening_count;
  if (periods.length !== expectedCount) {
    throw fail(ERRORS.PARAM_ERROR, '课节配置与分组节数不一致');
  }
}

function validateStartDate(startDate) {
  if (!startDate || typeof startDate !== 'string') {
    throw fail(ERRORS.PARAM_ERROR, '开学日期不能为空');
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
    throw fail(ERRORS.PARAM_ERROR, '开学日期格式不合法（YYYY-MM-DD）');
  }
  const d = new Date(startDate);
  if (isNaN(d.getTime())) {
    throw fail(ERRORS.PARAM_ERROR, '开学日期不是有效日期');
  }
}

function generateInviteCode() {
  let code = '';
  for (let i = 0; i < INVITE_CODE_LENGTH; i++) {
    code += INVITE_CODE_CHARS[Math.floor(Math.random() * INVITE_CODE_CHARS.length)];
  }
  return code;
}

async function generateUniqueInviteCode() {
  let attempts = 0;
  while (attempts < MAX_INVITE_CODE_ATTEMPTS) {
    const inviteCode = generateInviteCode();
    const existing = await db.findOne('schedules', { invite_code: inviteCode });
    if (!existing) return inviteCode;
    attempts += 1;
  }
  return null;
}

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
  validator.requireFields(payload, ['student_id', 'name', 'semester', 'periods', 'period_config', 'start_date']);
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

  const inviteCode = await generateUniqueInviteCode();
  if (!inviteCode) {
    logger.error(FN, 'create:inviteCodeFailed', { openid, studentId: payload.student_id });
    return fail(ERRORS.INTERNAL_ERROR, '生成邀请码失败，请重试');
  }

  validatePeriodShape(payload.periods, payload.period_config);
  validateStartDate(payload.start_date);

  const { _id } = await db.create('schedules', {
    owner_openid: openid,
    student_id: payload.student_id,
    name: payload.name,
    semester: payload.semester,
    total_weeks: Number(payload.total_weeks) || 20,
    periods: payload.periods,
    period_config: payload.period_config,
    invite_code: inviteCode,
    is_default: true,
    shared_with: [], // 初始无共享成员
    remark: payload.remark || '',
    view_mode: payload.view_mode || 'week',
    start_date: payload.start_date,
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
  // 与 course.list 一致：文档仅有 _id，前端统一使用 id
  const coursesNormalized = courses.map((c) => ({ ...c, id: c._id }));

  return success({ ...schedule, id: schedule._id, courses: coursesNormalized });
}

/**
 * 修改课表（需要有编辑权限）
 */
async function update(openid, payload) {
  validator.requireFields(payload, ['scheduleId']);

  const schedule = await requireEdit(openid, payload.scheduleId);

  logger.info(FN, 'update', { openid, scheduleId: payload.scheduleId });

  const allowed = ['name', 'semester', 'remark', 'total_weeks', 'periods', 'period_config', 'view_mode', 'start_date'];
  const updateData = {};
  for (const key of allowed) {
    if (payload[key] !== undefined) updateData[key] = payload[key];
  }

  if (payload.name) validator.maxLength(payload.name, 50, '课表名称');
  if (payload.total_weeks !== undefined) {
    const weeks = Number(payload.total_weeks);
    if (!Number.isInteger(weeks) || weeks < 1 || weeks > 30) {
      return fail(ERRORS.PARAM_ERROR, '本学期周数范围应为1-30');
    }
    updateData.total_weeks = weeks;
  }

  if (payload.start_date !== undefined) {
    validateStartDate(payload.start_date);
  }

  if (updateData.view_mode && !['week', 'day'].includes(updateData.view_mode)) {
    return fail(ERRORS.PARAM_ERROR, 'view_mode 必须为 week 或 day');
  }

  if (payload.periods !== undefined || payload.period_config !== undefined) {
    if (payload.periods === undefined || payload.period_config === undefined) {
      return fail(ERRORS.PARAM_ERROR, '更新课节配置时必须同时提交 periods 和 period_config');
    }
    validatePeriodShape(payload.periods, payload.period_config);
    updateData.periods = payload.periods;
    updateData.period_config = payload.period_config;
  }

  if (payload.student_id !== undefined) {
    if (schedule.owner_openid !== openid) {
      return fail(ERRORS.FORBIDDEN, '仅创建者可修改归属学生');
    }
    const student = await db.getOne('students', payload.student_id);
    if (!student) return fail(ERRORS.NOT_FOUND, '学生不存在');
    if (student.owner_openid !== openid) return fail(ERRORS.FORBIDDEN, '无权关联到该学生');
    updateData.student_id = payload.student_id;

    if (schedule.is_default && schedule.student_id !== payload.student_id) {
      await db.updateWhere('schedules', {
        owner_openid: openid,
        student_id: payload.student_id,
      }, { is_default: false });
      updateData.is_default = true;
    }
  }

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

/**
 * 刷新邀请码（仅 owner 可操作）
 */
async function refreshInviteCode(openid, payload) {
  validator.requireFields(payload, ['scheduleId']);
  await requireOwner(openid, payload.scheduleId);
  logger.info(FN, 'refreshInviteCode', { openid, scheduleId: payload.scheduleId });

  const inviteCode = await generateUniqueInviteCode();
  if (!inviteCode) {
    return fail(ERRORS.INTERNAL_ERROR, '生成邀请码失败，请重试');
  }

  await db.update('schedules', payload.scheduleId, { invite_code: inviteCode });
  return success({ invite_code: inviteCode });
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
      case 'refreshInviteCode': return await refreshInviteCode(openid, payload);
      default:           return fail(ERRORS.PARAM_ERROR, `未知的 action: ${action}`);
    }
  } catch (e) {
    if (e && typeof e.code === 'number') return e;
    logger.error(FN, event.action, e);
    return fail(ERRORS.INTERNAL_ERROR);
  }
};
