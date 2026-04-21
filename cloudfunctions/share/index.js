/**
 * share 云函数 - 分享功能
 * 支持口令分享（加入课表查看）和家庭邀请两种方式
 * 家庭成员上限 10 人，不够用自己找别人撕逼
 */

const cloud = require('wx-server-sdk');
cloud.init({ env: 'cloud1-1g0kf2p8b07af20f' });

const db = require('../../shared/db');
const { ERRORS, success, fail } = require('../../shared/errors');
const { getOpenId, requireOwner, requireMember } = require('../../shared/auth');
const validator = require('../../shared/validator');
const logger = require('../../shared/logger');

const FN = 'share';

// 家庭成员上限（含 owner）
const MAX_FAMILY_MEMBERS = 10;

// 口令字符集（排除容易混淆的 0/O/I/1）
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
// 口令长度
const CODE_LENGTH = 6;
// 有效期（毫秒）：7天
const CODE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

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
 * 生成 UUID（用于邀请 token）
 * 云开发没有 uuid 包，手撸一个简单的
 */
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

/**
 * 生成口令（课表 owner 才能生成）
 */
async function generateShareCode(openid, payload) {
  validator.requireFields(payload, ['scheduleId']);

  const schedule = await requireOwner(openid, payload.scheduleId);

  logger.info(FN, 'generateCode', { openid, scheduleId: payload.scheduleId });

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

  const expireAt = new Date(Date.now() + CODE_TTL_MS);

  await db.create('share_codes', {
    code,
    type: 'code',
    schedule_id: payload.scheduleId,
    creator_openid: openid,
    expire_at: expireAt,
    used_count: 0,
  });

  return success({ code, expire_at: expireAt });
}

/**
 * 验证口令，返回课表预览信息（不需要已登录状态，但微信云开发实际上已经有 openid）
 */
async function verifyCode(openid, payload) {
  validator.requireFields(payload, ['code']);

  const shareCode = await db.findOne('share_codes', {
    code: payload.code.toUpperCase(),
    type: 'code',
  });

  if (!shareCode) return fail(ERRORS.NOT_FOUND, '口令不存在或已失效');
  if (new Date() > new Date(shareCode.expire_at)) {
    return fail(ERRORS.PARAM_ERROR, '口令已过期');
  }

  // 返回课表基本信息预览
  const schedule = await db.getOne('schedules', shareCode.schedule_id);
  if (!schedule) return fail(ERRORS.NOT_FOUND, '课表不存在');

  // 获取学生信息
  const student = await db.getOne('students', schedule.student_id);

  return success({
    schedule_id: schedule._id,
    schedule_name: schedule.name,
    semester: schedule.semester,
    student_name: student ? student.name : '未知',
    member_count: (schedule.shared_with || []).length + 1, // +1 是 owner
  });
}

/**
 * 接受口令，将当前用户加入课表的 shared_with
 */
async function acceptCode(openid, payload) {
  validator.requireFields(payload, ['code']);

  const shareCode = await db.findOne('share_codes', {
    code: payload.code.toUpperCase(),
    type: 'code',
  });

  if (!shareCode) return fail(ERRORS.NOT_FOUND, '口令不存在或已失效');
  if (new Date() > new Date(shareCode.expire_at)) {
    return fail(ERRORS.PARAM_ERROR, '口令已过期');
  }

  const schedule = await db.getOne('schedules', shareCode.schedule_id);
  if (!schedule) return fail(ERRORS.NOT_FOUND, '课表不存在');

  // 不能加入自己的课表（owner）
  if (schedule.owner_openid === openid) {
    return fail(ERRORS.PARAM_ERROR, '这是你自己的课表，不用加入了');
  }

  // 检查是否已经是成员
  const sharedWith = schedule.shared_with || [];
  if (sharedWith.some(m => m.openid === openid)) {
    return fail(ERRORS.PARAM_ERROR, '你已经是该课表的成员了');
  }

  // 家庭成员上限校验（owner + shared_with 总数不超过 MAX_FAMILY_MEMBERS）
  if (sharedWith.length + 1 >= MAX_FAMILY_MEMBERS) {
    return fail(ERRORS.LIMIT_EXCEEDED, `课表成员已达上限 ${MAX_FAMILY_MEMBERS} 人`);
  }

  logger.info(FN, 'acceptCode', { openid, scheduleId: schedule._id });

  // 加入 shared_with（默认只读权限）
  const _ = db.getCommand();
  await db.col('schedules').doc(schedule._id).update({
    data: {
      shared_with: _.push({
        each: [{
          openid,
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
 * 生成家庭邀请 token
 * 按「学生维度」发起邀请：token 绑定 student_id 及该学生名下全部课表
 * 入参优先使用 studentId；为兼容旧逻辑，也保留 scheduleId（单课表邀请）
 */
async function generateInvite(openid, payload) {
  if (!payload.studentId && !payload.scheduleId) {
    return fail(ERRORS.PARAM_ERROR, '缺少必填字段: studentId 或 scheduleId');
  }

  let studentId = payload.studentId || '';
  let scheduleIds = [];

  if (studentId) {
    // 校验学生归属
    const student = await db.getOne('students', studentId);
    if (!student) return fail(ERRORS.NOT_FOUND, '学生不存在');
    if (student.owner_openid !== openid) {
      return fail(ERRORS.FORBIDDEN, '没有权限分享此学生');
    }

    // 聚合该学生名下当前用户创建的所有课表
    const schedules = await db.getList('schedules', {
      owner_openid: openid,
      student_id: studentId,
    });
    scheduleIds = schedules.map(s => s._id);

    if (scheduleIds.length === 0) {
      return fail(ERRORS.PARAM_ERROR, '该学生下暂无可分享的课表');
    }
  } else {
    // 兼容旧入参：单课表邀请
    const schedule = await requireOwner(openid, payload.scheduleId);
    scheduleIds = [schedule._id];
    studentId = schedule.student_id;
  }

  logger.info(FN, 'generateInvite', { openid, studentId, scheduleCount: scheduleIds.length });

  const token = generateUUID();
  const expireAt = new Date(Date.now() + CODE_TTL_MS);

  await db.create('share_codes', {
    code: token,
    type: 'invite',
    student_id: studentId,
    schedule_ids: scheduleIds,
    // 兼容字段：保留第一个 schedule_id，便于旧代码/日志定位
    schedule_id: scheduleIds[0],
    creator_openid: openid,
    expire_at: expireAt,
    used_count: 0,
  });

  return success({ token, expire_at: expireAt, schedule_count: scheduleIds.length });
}

/**
 * 验证邀请 token，返回学生 + 课表摘要供邀请页展示
 */
async function verifyInvite(openid, payload) {
  validator.requireFields(payload, ['token']);

  const invite = await db.findOne('share_codes', {
    code: payload.token,
    type: 'invite',
  });

  if (!invite) return fail(ERRORS.NOT_FOUND, '邀请链接不存在或已失效');
  if (new Date() > new Date(invite.expire_at)) {
    return fail(ERRORS.PARAM_ERROR, '邀请链接已过期');
  }

  // 优先使用新字段 schedule_ids；兼容旧记录只有 schedule_id
  const scheduleIds = Array.isArray(invite.schedule_ids) && invite.schedule_ids.length > 0
    ? invite.schedule_ids
    : (invite.schedule_id ? [invite.schedule_id] : []);

  if (scheduleIds.length === 0) {
    return fail(ERRORS.NOT_FOUND, '邀请数据异常');
  }

  const schedules = [];
  for (const sid of scheduleIds) {
    const s = await db.getOne('schedules', sid);
    if (s) schedules.push(s);
  }
  if (schedules.length === 0) return fail(ERRORS.NOT_FOUND, '课表不存在');

  // 学生信息：优先 invite.student_id，回退到第一个课表的 student_id
  const studentId = invite.student_id || schedules[0].student_id;
  const student = studentId ? await db.getOne('students', studentId) : null;

  // 邀请人昵称（用于邀请页头部展示）
  const inviter = await db.findOne('users', { openid: invite.creator_openid });

  return success({
    student_id: studentId || '',
    student_name: student ? student.name : '未知',
    schedules: schedules.map(s => ({
      schedule_id: s._id,
      schedule_name: s.name,
      semester: s.semester,
    })),
    inviter_nickname: inviter ? (inviter.nickname || '') : '',
    inviter_avatar_url: inviter ? (inviter.avatar_url || '') : '',
  });
}

/**
 * 接受邀请：将当前用户加入 token 关联的全部课表的 shared_with
 * 幂等：已是成员的课表会跳过；失败课表会被记录但不终止全流程
 */
async function acceptInvite(openid, payload) {
  validator.requireFields(payload, ['token']);

  const invite = await db.findOne('share_codes', {
    code: payload.token,
    type: 'invite',
  });

  if (!invite) return fail(ERRORS.NOT_FOUND, '邀请链接不存在或已失效');
  if (new Date() > new Date(invite.expire_at)) {
    return fail(ERRORS.PARAM_ERROR, '邀请链接已过期');
  }

  const scheduleIds = Array.isArray(invite.schedule_ids) && invite.schedule_ids.length > 0
    ? invite.schedule_ids
    : (invite.schedule_id ? [invite.schedule_id] : []);

  if (scheduleIds.length === 0) return fail(ERRORS.NOT_FOUND, '邀请数据异常');

  const _ = db.getCommand();

  // 先通盘校验：若是自己邀请自己、或任一课表已达上限，直接失败
  const schedulesInfo = [];
  for (const sid of scheduleIds) {
    const s = await db.getOne('schedules', sid);
    if (!s) continue;
    schedulesInfo.push(s);

    if (s.owner_openid === openid) {
      return fail(ERRORS.PARAM_ERROR, '这是你自己的课表');
    }

    const sharedWith = s.shared_with || [];
    const already = sharedWith.some(m => m.openid === openid);
    if (!already && sharedWith.length + 1 >= MAX_FAMILY_MEMBERS) {
      return fail(ERRORS.LIMIT_EXCEEDED, `课表《${s.name}》成员已达上限 ${MAX_FAMILY_MEMBERS} 人`);
    }
  }

  if (schedulesInfo.length === 0) return fail(ERRORS.NOT_FOUND, '课表不存在');

  // 执行加入（跳过已是成员的课表）
  let joinedCount = 0;
  for (const s of schedulesInfo) {
    const sharedWith = s.shared_with || [];
    if (sharedWith.some(m => m.openid === openid)) continue;

    await db.col('schedules').doc(s._id).update({
      data: {
        shared_with: _.push({
          each: [{
            openid,
            permission: 'view',
            join_time: new Date(),
          }],
        }),
        updateTime: new Date(),
      },
    });
    joinedCount += 1;
  }

  logger.info(FN, 'acceptInvite', { openid, studentId: invite.student_id, joinedCount, totalCount: schedulesInfo.length });

  // 邀请是「家庭关系绑定」，一旦完成就作废
  await db.remove('share_codes', invite._id);

  return success({
    student_id: invite.student_id || '',
    schedule_ids: schedulesInfo.map(s => s._id),
    joined_count: joinedCount,
    permission: 'view',
  });
}

// ——— 入口 ———
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();

  try {
    const openid = getOpenId(wxContext);
    const { action, payload = {} } = event;

    switch (action) {
      case 'generateCode':   return await generateShareCode(openid, payload);
      case 'verifyCode':     return await verifyCode(openid, payload);
      case 'acceptCode':     return await acceptCode(openid, payload);
      case 'generateInvite': return await generateInvite(openid, payload);
      case 'verifyInvite':   return await verifyInvite(openid, payload);
      case 'acceptInvite':   return await acceptInvite(openid, payload);
      default:               return fail(ERRORS.PARAM_ERROR, `未知的 action: ${action}`);
    }
  } catch (e) {
    if (e && typeof e.code === 'number') return e;
    logger.error(FN, event.action, e);
    return fail(ERRORS.INTERNAL_ERROR);
  }
};
