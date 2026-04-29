/**
 * student 云函数 - 学生管理
 * 负责学生的增删改查，一个用户可以有多个学生（孩子）
 */

const cloud = require('wx-server-sdk');
cloud.init({ env: 'cloud1-1g0kf2p8b07af20f' });

const db = require('../../shared/db');
const { ERRORS, success, fail } = require('../../shared/errors');
const { getOpenId } = require('../../shared/auth');
const { isFamilyMember } = require('../../shared/family');
const validator = require('../../shared/validator');
const logger = require('../../shared/logger');

const FN = 'student';

async function cleanupAvatarFile(fileId) {
  if (!fileId || typeof fileId !== 'string') return;
  if (!/^cloud:\/\//.test(fileId)) return;
  try {
    await cloud.deleteFile({ fileList: [fileId] });
  } catch (err) {
    logger.warn(FN, 'cleanupAvatarFile:failed', { fileId, err: err && err.message ? err.message : err });
  }
}

function attachSharedOwnerInfo(student, ownerUserMap) {
  const ownerOpenid = student.owner_openid || '';
  const owner = ownerUserMap[ownerOpenid] || {};
  return {
    ...student,
    is_shared: true,
    shared_from_openid: ownerOpenid,
    shared_from_nickname: owner.nickname || '',
    shared_from_avatar_url: owner.avatar_url || '',
  };
}

/**
 * 获取当前用户可见的学生列表
 * 返回：自己创建的学生 + 通过共享课表可见的他人学生（标记 is_shared）
 */
async function list(openid) {
  logger.info(FN, 'list', { openid });

  // 1. 自己创建的学生
  const ownStudents = await db.getList('students', { owner_openid: openid }, {
    orderBy: { field: 'createTime', direction: 'desc' },
  });

  // 2. 共享课表里涉及到的他人学生（去重）
  const _ = db.getCommand();
  const familyRelations = await db.getList('families', { member_openid: openid });
  const familyOwnerOpenids = Array.from(new Set(familyRelations.map((item) => item.owner_openid).filter(Boolean)));
  const sharedSchedules = await db.getList('schedules', {
    shared_with: _.elemMatch({ openid }),
    owner_openid: _.neq(openid),
  });

  const sharedStudentIdSet = new Set();
  const sharedStudentOwnerMap = new Map();
  if (familyOwnerOpenids.length > 0) {
    const familyStudents = await db.getList('students', { owner_openid: _.in(familyOwnerOpenids) });
    for (const student of familyStudents) {
      sharedStudentIdSet.add(student._id);
      if (student._id && student.owner_openid) {
        sharedStudentOwnerMap.set(student._id, student.owner_openid);
      }
    }
  }
  for (const sch of sharedSchedules) {
    if (sch.student_id) {
      sharedStudentIdSet.add(sch.student_id);
      if (sch.owner_openid && !sharedStudentOwnerMap.has(sch.student_id)) {
        sharedStudentOwnerMap.set(sch.student_id, sch.owner_openid);
      }
    }
  }

  const sharedStudents = [];
  for (const sid of sharedStudentIdSet) {
    const st = await db.getOne('students', sid);
    if (st) {
      const fallbackOwnerOpenid = sharedStudentOwnerMap.get(sid) || '';
      sharedStudents.push({
        ...st,
        owner_openid: st.owner_openid || fallbackOwnerOpenid,
        is_shared: true,
      });
    }
  }
  const sharedOwnerOpenids = Array.from(new Set(sharedStudents.map((s) => s.owner_openid).filter(Boolean)));
  const ownerUsers = sharedOwnerOpenids.length > 0
    ? await db.getList('users', { openid: _.in(sharedOwnerOpenids) })
    : [];
  const ownerUserMap = {};
  ownerUsers.forEach((user) => { ownerUserMap[user.openid] = user; });

  const result = [
    ...ownStudents.map(s => ({ ...s, id: s._id, is_shared: false })),
    ...sharedStudents.map(s => attachSharedOwnerInfo({ ...s, id: s._id }, ownerUserMap)),
  ];

  return success(result);
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
    source: 'user',
  });

  const student = await db.getOne('students', _id);
  return success({ ...student, id: student._id });
}

/**
 * 获取学生详情
 * owner 可直接查看；共享成员（在该学生任一课表的 shared_with 中）也可只读查看
 */
async function get(openid, payload) {
  validator.requireFields(payload, ['studentId']);

  const student = await db.getOne('students', payload.studentId);
  if (!student) return fail(ERRORS.NOT_FOUND, '学生不存在');

  const isOwner = student.owner_openid === openid;
  if (isOwner) {
    return success({ ...student, id: student._id, is_shared: false });
  }

  if (await isFamilyMember(student.owner_openid, openid)) {
    return success({ ...student, id: student._id, is_shared: true });
  }

  // 非 owner：检查当前用户是否通过该学生的任一课表以共享身份加入
  const _ = db.getCommand();
  const sharedSchedule = await db.findOne('schedules', {
    student_id: payload.studentId,
    shared_with: _.elemMatch({ openid }),
  });
  if (!sharedSchedule) return fail(ERRORS.FORBIDDEN);

  return success({ ...student, id: student._id, is_shared: true });
}

/**
 * 修改学生信息（owner 或家庭成员）
 */
async function update(openid, payload) {
  validator.requireFields(payload, ['studentId']);

  const student = await db.getOne('students', payload.studentId);
  if (!student) return fail(ERRORS.NOT_FOUND, '学生不存在');
  const canManageStudent = student.owner_openid === openid || await isFamilyMember(student.owner_openid, openid);
  if (!canManageStudent) return fail(ERRORS.FORBIDDEN);

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

  const hasAvatarUpdate = Object.prototype.hasOwnProperty.call(updateData, 'avatar_url');
  const oldAvatar = student.avatar_url || '';
  const nextAvatar = hasAvatarUpdate ? (updateData.avatar_url || '') : oldAvatar;

  await db.update('students', payload.studentId, updateData);
  if (hasAvatarUpdate && oldAvatar && oldAvatar !== nextAvatar) {
    await cleanupAvatarFile(oldAvatar);
  }
  return success(null);
}

/**
 * 删除学生（owner 或家庭成员）
 * 同时级联删除该学生下的所有课表和课程，不删干净不行
 */
async function remove(openid, payload) {
  validator.requireFields(payload, ['studentId']);

  const student = await db.getOne('students', payload.studentId);
  if (!student) return fail(ERRORS.NOT_FOUND, '学生不存在');
  const canManageStudent = student.owner_openid === openid || await isFamilyMember(student.owner_openid, openid);
  if (!canManageStudent) return fail(ERRORS.FORBIDDEN);

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
  await cleanupAvatarFile(student.avatar_url);

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
