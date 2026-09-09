/**
 * share 云函数 - 分享功能
 * 支持口令分享（加入课表查看）和家庭邀请两种方式
 * 家庭成员上限 10 人，不够用自己找别人撕逼
 */

const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = require('../../shared/db');
const { ERRORS, success, fail } = require('../../shared/errors');
const { resolveCurrentUser, requireOwner, requireMember } = require('../../shared/auth');
const {
  listFamilyRelations,
  syncOwnerSchedulesForMember,
  upsertFamilyRelation,
} = require('../../shared/family');
const validator = require('../../shared/validator');
const logger = require('../../shared/logger');
const { resolveCourseColor } = require('../../shared/courseColors');

const FN = 'share';

// 家庭成员上限（含 owner）
const MAX_FAMILY_MEMBERS = 10;

// 口令字符集（排除容易混淆的 0/O/I/1）
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
// 口令长度
const CODE_LENGTH = 6;

// invite_code 字符集和长度（与 schedule 云函数保持一致）
const INVITE_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const INVITE_CODE_LENGTH = 8;

function generateInviteCode() {
  let code = '';
  for (let i = 0; i < INVITE_CODE_LENGTH; i++) {
    code += INVITE_CODE_CHARS[Math.floor(Math.random() * INVITE_CODE_CHARS.length)];
  }
  return code;
}

async function generateUniqueInviteCode() {
  let attempts = 0;
  while (attempts < 10) {
    const code = generateInviteCode();
    const existing = await db.findOne('schedules', { invite_code: code });
    if (!existing) return code;
    attempts++;
  }
  return null;
}

/**
 * 生成随机口令
 * @returns {string} 6位大写字母数字口令
 */
function generateCode() {
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  }
  return code;
}

/**
 * 生成口令（课表 owner 才能生成）
 */
async function generateShareCode(userId, payload) {
  validator.requireFields(payload, ['scheduleId']);

  const schedule = await requireOwner(userId, payload.scheduleId);

  logger.info(FN, 'generateCode', { user_id: userId, scheduleId: payload.scheduleId });

  // 先删除该课表的旧口令，一个课表同时只保留一个有效口令
  await db.removeWhere('share_codes', { schedule_id: payload.scheduleId, type: 'code' });

  // 生成唯一口令（万一碰撞了就重新生成，概率极低但要处理）
  let code;
  let attempts = 0;
  while (attempts < 10) {
    code = generateCode();
    const existing = await db.findOne('share_codes', { code, type: 'code' });
    if (!existing) break;
    attempts++;
    if (attempts >= 10) {
      logger.error(FN, 'generateCode:collision', { scheduleId: payload.scheduleId, attempts });
      return fail(ERRORS.INTERNAL_ERROR, '生成口令失败，请重试');
    }
  }

  await db.create('share_codes', {
    code,
    type: 'code',
    schedule_id: payload.scheduleId,
    creator_user_id: userId,
    used_count: 0,
  });

  return success({ code });
}

/**
 * 验证口令，返回课表预览信息（不需要已登录状态，但微信云开发实际上已经有 openid）
 */
async function verifyCode(userId, payload) {
  validator.requireFields(payload, ['code']);

  const shareCode = await db.findOne('share_codes', {
    code: payload.code.toUpperCase(),
    type: 'code',
  });

  if (!shareCode) return fail(ERRORS.NOT_FOUND, '口令不存在或已失效');

  // 本人口令不能自己用
  if (shareCode.creator_user_id === userId) {
    return fail(ERRORS.PARAM_ERROR, '这是你自己的口令，分享给好友使用吧');
  }

  // 返回课表基本信息预览
  const schedule = await db.getOne('schedules', shareCode.schedule_id);
  if (!schedule) return fail(ERRORS.NOT_FOUND, '课表不存在');

  return success({
    schedule_id: schedule._id,
    schedule_name: schedule.name,
    semester: schedule.semester || '',
    member_count: (schedule.shared_with || []).length + 1,
  });
}

/**
 * 接受口令，将当前用户加入课表的 shared_with
 */
async function acceptCode(userId, payload) {
  validator.requireFields(payload, ['code']);

  const shareCode = await db.findOne('share_codes', {
    code: payload.code.toUpperCase(),
    type: 'code',
  });

  if (!shareCode) return fail(ERRORS.NOT_FOUND, '口令不存在或已失效');

  const schedule = await db.getOne('schedules', shareCode.schedule_id);
  if (!schedule) return fail(ERRORS.NOT_FOUND, '课表不存在');

  // 不能加入自己的课表（owner）
  if (schedule.owner_user_id === userId) {
    return fail(ERRORS.PARAM_ERROR, '这是你自己的课表，不用加入了');
  }

  // 检查是否已经是成员
  const sharedWith = Array.isArray(schedule.shared_with)
    ? schedule.shared_with.filter((member) => member && typeof member.user_id === 'string' && member.user_id.trim())
    : [];
  if (sharedWith.some(m => m.user_id === userId)) {
    return fail(ERRORS.PARAM_ERROR, '你已经是该课表的成员了');
  }

  // 家庭成员上限校验（owner + shared_with 总数不超过 MAX_FAMILY_MEMBERS）
  if (sharedWith.length + 1 > MAX_FAMILY_MEMBERS) {
    return fail(ERRORS.LIMIT_EXCEEDED, `课表成员已达上限 ${MAX_FAMILY_MEMBERS} 人`);
  }

  logger.info(FN, 'acceptCode', { user_id: userId, scheduleId: schedule._id });

  // 加入 shared_with（默认只读权限）
  const _ = db.getCommand();
  await db.col('schedules').doc(schedule._id).update({
    data: {
      shared_with: _.push({
        each: [{
          user_id: userId,
          permission: 'view', // 默认只读
          join_time: new Date(),
        }],
      }),
      updateTime: new Date(),
    },
  });

  // 更新口令使用次数
  await db.update('share_codes', shareCode._id, { used_count: shareCode.used_count + 1 });

  return success({ schedule_id: schedule._id, permission: 'view' });
}

/**
 * 通过 invite_code 验证课表口令，返回预览信息
 */
async function verifyInviteCode(userId, payload) {
  validator.requireFields(payload, ['code']);

  const code = payload.code.toUpperCase().trim();
  const schedule = await db.findOne('schedules', { invite_code: code });
  if (!schedule) return fail(ERRORS.NOT_FOUND, '口令不存在，请检查后重试');

  if (schedule.owner_user_id === userId) {
    return fail(ERRORS.PARAM_ERROR, '这是你自己的口令，分享给好友使用吧');
  }

  return success({
    schedule_id: schedule._id,
    schedule_name: schedule.name,
    semester: schedule.semester || ''
  });
}

/**
 * 通过 invite_code 复制课表数据到当前用户名下
 * 课程的 teacher 和 contact 字段留空
 * 课表和课程的 owner/student 改为当前用户
 */
async function copyByInviteCode(userId, payload) {
  validator.requireFields(payload, ['code']);

  const code = payload.code.toUpperCase().trim();
  const sourceSchedule = await db.findOne('schedules', { invite_code: code });
  if (!sourceSchedule) return fail(ERRORS.NOT_FOUND, '口令不存在，请检查后重试');

  if (sourceSchedule.owner_user_id === userId) {
    return fail(ERRORS.PARAM_ERROR, '这是你自己的口令，分享给好友使用吧');
  }

  // 查当前用户的默认学生（source='init' 优先，否则取第一条）
  let defaultStudent = await db.findOne('students', { owner_user_id: userId, source: 'init' });
  if (!defaultStudent) {
    const studentList = await db.getList('students', { owner_user_id: userId }, { limit: 1 });
    defaultStudent = studentList[0] || null;
  }
  if (!defaultStudent) {
    return fail(ERRORS.NOT_FOUND, '请先创建学生信息');
  }

  // 生成新课表的 invite_code
  const newInviteCode = await generateUniqueInviteCode();
  if (!newInviteCode) {
    return fail(ERRORS.INTERNAL_ERROR, '生成邀请码失败，请重试');
  }

  // 判断是否为当前用户第一个课表
  const existingSchedules = await db.getList('schedules', { owner_user_id: userId }, { limit: 1 });
  const isDefault = existingSchedules.length === 0;
  const familyRelations = await listFamilyRelations(userId);

  logger.info(FN, 'copyByInviteCode', { user_id: userId, sourceScheduleId: sourceSchedule._id });

  // 复制课表
  const { _id: newScheduleId } = await db.create('schedules', {
    owner_user_id: userId,
    student_id: defaultStudent._id,
    name: sourceSchedule.name,
    semester: sourceSchedule.semester || '',
    total_weeks: sourceSchedule.total_weeks || 20,
    periods: sourceSchedule.periods,
    period_config: sourceSchedule.period_config,
    invite_code: newInviteCode,
    is_default: isDefault,
    shared_with: familyRelations.map((relation) => ({
      user_id: relation.member_user_id,
      permission: 'edit',
      join_time: relation.createTime || new Date(),
    })),
    remark: '',
    view_mode: sourceSchedule.view_mode || 'week',
    start_date: sourceSchedule.start_date,
  });

  // 复制课程（teacher 和 contact 留空）
  const sourceCourses = await db.getList('courses', { schedule_id: sourceSchedule._id });
  for (const course of sourceCourses) {
    const slot = Number(course.slot ?? course.period);
    await db.create('courses', {
      schedule_id: newScheduleId,
      student_id: defaultStudent._id,
      owner_user_id: userId,
      name: course.name,
      day_of_week: course.day_of_week,
      slot: Number.isFinite(slot) && slot > 0 ? slot : 1,
      teacher: '',
      room: course.room || '',
      contact: '',
      color: resolveCourseColor(course.color),
      weeks: Array.isArray(course.weeks) ? [...course.weeks] : [],
    });
  }

  // 返回新课表完整信息
  const newSchedule = await db.getOne('schedules', newScheduleId);
  return success({ ...newSchedule, id: newSchedule._id });
}

/**
 * 验证邀请人，返回账户级共享摘要
 */
async function verifyInvite(userId, payload) {
  validator.requireFields(payload, ['inviterUserId']);

  const inviterUserId = String(payload.inviterUserId).trim();
  if (!inviterUserId) return fail(ERRORS.PARAM_ERROR, '邀请参数无效');
  if (inviterUserId === userId) return fail(ERRORS.PARAM_ERROR, '不能邀请自己');

  const inviter = await db.getOne('users', inviterUserId);
  if (!inviter) return fail(ERRORS.NOT_FOUND, '邀请人不存在');

  const students = await db.getList('students', { owner_user_id: inviterUserId });
  const schedules = await db.getList('schedules', { owner_user_id: inviterUserId });

  return success({
    inviter_user_id: inviterUserId,
    inviter_nickname: inviter.nickname || '',
    inviter_avatar_url: inviter.avatar_url || '',
    student_count: students.length,
    schedule_count: schedules.length,
    students: students.map((student) => ({
      student_id: student._id,
      student_name: student.name,
      schedule_count: schedules.filter((schedule) => schedule.student_id === student._id).length,
    })),
  });
}

/**
 * 接受账户级邀请：建立家庭关系并同步全部课表权限
 */
async function acceptInvite(userId, payload) {
  validator.requireFields(payload, ['inviterUserId']);

  const inviterUserId = String(payload.inviterUserId).trim();
  if (!inviterUserId) return fail(ERRORS.PARAM_ERROR, '邀请参数无效');
  if (inviterUserId === userId) return fail(ERRORS.PARAM_ERROR, '不能邀请自己');

  const inviter = await db.getOne('users', inviterUserId);
  if (!inviter) return fail(ERRORS.NOT_FOUND, '邀请人不存在');

  const schedules = await db.getList('schedules', { owner_user_id: inviterUserId });
  for (const schedule of schedules) {
    const sharedWith = Array.isArray(schedule.shared_with)
      ? schedule.shared_with.filter((member) => member && typeof member.user_id === 'string' && member.user_id.trim())
      : [];
    const alreadyJoined = sharedWith.some((member) => member.user_id === userId);
    if (!alreadyJoined && sharedWith.length + 1 > MAX_FAMILY_MEMBERS) {
      return fail(ERRORS.LIMIT_EXCEEDED, `课表《${schedule.name}》成员已达上限 ${MAX_FAMILY_MEMBERS} 人`);
    }
  }

  await upsertFamilyRelation(inviterUserId, userId, {
    member_nickname: '',
    member_avatar: '',
  });
  await syncOwnerSchedulesForMember(inviterUserId, userId);

  logger.info(FN, 'acceptInvite', {
    userId,
    inviterUserId,
    scheduleCount: schedules.length,
  });

  return success({
    inviter_user_id: inviterUserId,
    schedule_ids: schedules.map((schedule) => schedule._id),
    joined_count: schedules.length,
    permission: 'edit',
  });
}

// ——— 入口 ———
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();

  try {
    const { userId } = await resolveCurrentUser(wxContext);
    const { action, payload = {} } = event;

    switch (action) {
      case 'generateCode':   return await generateShareCode(userId, payload);
      case 'verifyCode':     return await verifyCode(userId, payload);
      case 'acceptCode':     return await acceptCode(userId, payload);
      case 'verifyInviteCode': return await verifyInviteCode(userId, payload);
      case 'copyByInviteCode': return await copyByInviteCode(userId, payload);
      case 'verifyInvite':   return await verifyInvite(userId, payload);
      case 'acceptInvite':   return await acceptInvite(userId, payload);
      default:               return fail(ERRORS.PARAM_ERROR, `未知的 action: ${action}`);
    }
  } catch (e) {
    if (e && typeof e.code === 'number') return e;
    logger.error(FN, event.action, e);
    const message = e && e.message ? String(e.message) : '';
    if (message.includes('Db or Table not exist: families')) {
      return fail(ERRORS.INTERNAL_ERROR, '数据库未初始化，请先创建 families 集合');
    }
    return fail(ERRORS.INTERNAL_ERROR);
  }
};
