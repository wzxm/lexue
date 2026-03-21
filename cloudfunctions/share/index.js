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
  validator.require(payload, ['scheduleId']);

  const schedule = await requireOwner(openid, payload.scheduleId);

  logger.info(FN, 'generateCode', { openid, scheduleId: payload.scheduleId });

  // 先删除该课表的旧口令，一个课表同时只保留一个有效口令
  await db.removeWhere('share_codes', { schedule_id: payload.scheduleId, type: 'code' });

  // 生成唯一口令（万一碰撞了就重新生成，概率极低但要处理）
  let code;
  let attempts = 0;
  do {
    code = generateCode();
    const existing = await db.findOne('share_codes', { code, type: 'code' });
    if (!existing) break;
    attempts++;
  } while (attempts < 10);

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
  validator.require(payload, ['code']);

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
  validator.require(payload, ['code']);

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
 * 生成家庭邀请 token（用于更紧密的家庭关系绑定）
 */
async function generateInvite(openid, payload) {
  validator.require(payload, ['scheduleId']);

  const schedule = await requireOwner(openid, payload.scheduleId);

  logger.info(FN, 'generateInvite', { openid, scheduleId: payload.scheduleId });

  const token = generateUUID();
  const expireAt = new Date(Date.now() + CODE_TTL_MS);

  await db.create('share_codes', {
    code: token,
    type: 'invite',
    schedule_id: payload.scheduleId,
    creator_openid: openid,
    expire_at: expireAt,
    used_count: 0,
  });

  return success({ token, expire_at: expireAt });
}

/**
 * 验证邀请 token
 */
async function verifyInvite(openid, payload) {
  validator.require(payload, ['token']);

  const invite = await db.findOne('share_codes', {
    code: payload.token,
    type: 'invite',
  });

  if (!invite) return fail(ERRORS.NOT_FOUND, '邀请链接不存在或已失效');
  if (new Date() > new Date(invite.expire_at)) {
    return fail(ERRORS.PARAM_ERROR, '邀请链接已过期');
  }

  const schedule = await db.getOne('schedules', invite.schedule_id);
  if (!schedule) return fail(ERRORS.NOT_FOUND, '课表不存在');

  const student = await db.getOne('students', schedule.student_id);

  return success({
    schedule_id: schedule._id,
    schedule_name: schedule.name,
    student_name: student ? student.name : '未知',
  });
}

/**
 * 接受邀请（逻辑和接受口令类似）
 */
async function acceptInvite(openid, payload) {
  validator.require(payload, ['token']);

  const invite = await db.findOne('share_codes', {
    code: payload.token,
    type: 'invite',
  });

  if (!invite) return fail(ERRORS.NOT_FOUND, '邀请链接不存在或已失效');
  if (new Date() > new Date(invite.expire_at)) {
    return fail(ERRORS.PARAM_ERROR, '邀请链接已过期');
  }

  const schedule = await db.getOne('schedules', invite.schedule_id);
  if (!schedule) return fail(ERRORS.NOT_FOUND, '课表不存在');

  if (schedule.owner_openid === openid) {
    return fail(ERRORS.PARAM_ERROR, '这是你自己的课表');
  }

  const sharedWith = schedule.shared_with || [];
  if (sharedWith.some(m => m.openid === openid)) {
    return fail(ERRORS.PARAM_ERROR, '你已经是该课表的成员了');
  }

  if (sharedWith.length + 1 >= MAX_FAMILY_MEMBERS) {
    return fail(ERRORS.LIMIT_EXCEEDED, `课表成员已达上限 ${MAX_FAMILY_MEMBERS} 人`);
  }

  logger.info(FN, 'acceptInvite', { openid, scheduleId: schedule._id });

  const _ = db.getCommand();
  await db.col('schedules').doc(schedule._id).update({
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

  // 邀请用一次就作废
  await db.remove('share_codes', invite._id);

  return success({ schedule_id: schedule._id, permission: 'view' });
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
