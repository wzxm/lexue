/**
 * auth 云函数 - 用户认证
 * 手机号 + 短信验证码登录；身份解析从 WXContext OPENID 绑定到 users._id
 */

const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = require('../../shared/db');
const { ERRORS, success, fail } = require('../../shared/errors');
const { getOpenId, resolveCurrentUser } = require('../../shared/auth');
const validator = require('../../shared/validator');
const logger = require('../../shared/logger');

const FN = 'auth';
const USER_STATUS = {
  ACTIVE: 'active',
  DISABLED: 'disabled',
  DELETED: 'deleted',
};

const DEFAULT_USER_SETTINGS = {
  notify_enabled: true,
  notify_advance_minutes: 30,
  hide_weekend: true,
};

function isUserBlocked(user) {
  const status = user && user.status ? user.status : USER_STATUS.ACTIVE;
  return status === USER_STATUS.DISABLED || status === USER_STATUS.DELETED;
}

function toUserPayload(user) {
  return {
    userId: user._id,
    openId: user.openid || '',
    phone: user.phone || '',
    nickname: user.nickname || '',
    avatarUrl: user.avatar_url || '',
    settings: {
      ...DEFAULT_USER_SETTINGS,
      ...(user.settings || {}),
    },
  };
}

function generateDefaultNickname() {
  const suffix = Math.floor(Math.random() * 900000) + 100000;
  return `家长${suffix}`;
}

function parseOptionalProfile(payload = {}) {
  const nickname = payload.nickname !== undefined ? String(payload.nickname).trim() : undefined;
  const avatarUrl = payload.avatar_url !== undefined ? String(payload.avatar_url).trim() : undefined;
  if (nickname !== undefined) {
    validator.maxLength(nickname, 20, 'nickname');
  }
  if (avatarUrl !== undefined) {
    validator.maxLength(avatarUrl, 500, 'avatar_url');
  }
  return { nickname, avatarUrl };
}

async function ensureDefaultStudent(userId) {
  const students = await db.getList('students', { owner_user_id: userId });
  if (!students || students.length === 0) {
    await db.create('students', {
      owner_user_id: userId,
      name: '默认学生',
      school_name: '',
      grade: '',
      class_name: '',
      avatar_url: '',
      remark: '',
      source: 'init',
    });
    logger.info(FN, 'default_student_created', { userId });
  }
}

async function finishLogin(user) {
  if (isUserBlocked(user)) {
    return fail(ERRORS.FORBIDDEN, '账号状态异常，无法登录');
  }
  await ensureDefaultStudent(user._id);
  return success(toUserPayload(user));
}

async function applyOptionalProfileUpdate(user, payload = {}) {
  const { nickname, avatarUrl } = parseOptionalProfile(payload);
  if (nickname === undefined && avatarUrl === undefined) {
    return user;
  }

  const nextNickname = nickname !== undefined ? nickname : user.nickname || '';
  const nextAvatarUrl = avatarUrl !== undefined ? avatarUrl : user.avatar_url || '';
  if (nextNickname === (user.nickname || '') && nextAvatarUrl === (user.avatar_url || '')) {
    return user;
  }

  await db.update('users', user._id, {
    nickname: nextNickname,
    avatar_url: nextAvatarUrl,
  });
  return db.getOne('users', user._id);
}

async function bindWechatToUser(user, openid, unionid) {
  const userByOpenid = await db.findOne('users', { openid });
  if (userByOpenid && userByOpenid._id !== user._id) {
    throw fail(ERRORS.FORBIDDEN, '当前微信已绑定其他账号');
  }

  const updateData = {};
  if (user.openid !== openid) updateData.openid = openid;
  if (unionid && user.unionid !== unionid) updateData.unionid = unionid;

  if (Object.keys(updateData).length > 0) {
    await db.update('users', user._id, updateData);
    return db.getOne('users', user._id);
  }
  return user;
}

async function resolvePhoneAccount(openid, unionid, phone, payload = {}) {
  const userByPhone = await db.findOne('users', { phone });
  const userByOpenid = await db.findOne('users', { openid });
  const { nickname, avatarUrl } = parseOptionalProfile(payload);

  if (userByPhone && userByOpenid && userByPhone._id !== userByOpenid._id) {
    throw fail(ERRORS.FORBIDDEN, '该手机号已绑定其他微信账号');
  }
  if (userByOpenid && userByOpenid.phone && userByOpenid.phone !== phone) {
    throw fail(ERRORS.FORBIDDEN, '当前微信已绑定其他手机号');
  }

  let user = userByPhone || userByOpenid;

  if (!user) {
    const { _id } = await db.create('users', {
      openid,
      unionid: unionid || '',
      phone,
      status: USER_STATUS.ACTIVE,
      nickname: nickname || generateDefaultNickname(),
      avatar_url: avatarUrl || '',
      settings: DEFAULT_USER_SETTINGS,
      subscribe_tokens: [],
    });
    user = await db.getOne('users', _id);
    logger.info(FN, 'loginByPhone:created', { userId: _id, phone });
    return user;
  }

  const updateData = {};
  if (!user.phone) updateData.phone = phone;
  if (!user.openid) updateData.openid = openid;
  if (unionid && user.unionid !== unionid) updateData.unionid = unionid;

  if (Object.keys(updateData).length > 0) {
    await db.update('users', user._id, updateData);
    user = await db.getOne('users', user._id);
  }

  user = await bindWechatToUser(user, openid, unionid);
  return applyOptionalProfileUpdate(user, payload);
}

async function handleSendSmsCode(wxContext, payload = {}) {
  validator.requireFields(payload, ['phone']);
  const phone = String(payload.phone).trim();
  const requestOpenid = wxContext.OPENID || '';
  return success({ phone: phone.slice(0, 3) + '****' + phone.slice(-4), expiresIn: 300 });
}

async function loginByPhone(openid, unionid, payload = {}) {
  validator.requireFields(payload, ['phone', 'sms_code']);
  const phone = String(payload.phone).trim();
  const smsCode = String(payload.sms_code).trim();

  const user = await resolvePhoneAccount(openid, unionid, phone, payload);
  return finishLogin(user);
}

async function getProfile(userId) {
  const user = await db.getOne('users', userId);
  if (!user) {
    return fail(ERRORS.NOT_FOUND, '用户不存在');
  }
  if (isUserBlocked(user)) {
    return fail(ERRORS.FORBIDDEN, '账号状态异常，无法访问');
  }
  return success(toUserPayload(user));
}

async function getSettingsSummary(userId) {
  const user = await db.getOne('users', userId);
  if (!user) {
    return fail(ERRORS.NOT_FOUND, '用户不存在');
  }
  if (isUserBlocked(user)) {
    return fail(ERRORS.FORBIDDEN, '账号状态异常，无法访问');
  }

  const ownSchedules = await db.getList('schedules', { owner_user_id: userId }, {
    orderBy: { field: 'createTime', direction: 'desc' },
  });
  const _ = db.getCommand();
  const sharedSchedules = await db.getList('schedules', {
    shared_with: _.elemMatch({ user_id: userId }),
    owner_user_id: _.neq(userId),
  });
  const allSchedules = [...ownSchedules, ...sharedSchedules];
  const scheduleCount = allSchedules.length;

  const incomingFamilyRelations = await db.getList('families', { member_user_id: userId });
  const incomingOwnerUserIds = Array.from(new Set(
    incomingFamilyRelations.map((item) => item.owner_user_id).filter(Boolean),
  ));

  const visibleStudentIds = new Set();
  const ownStudents = await db.getList('students', { owner_user_id: userId });
  ownStudents.forEach((student) => {
    if (student && student._id) visibleStudentIds.add(student._id);
  });

  if (incomingOwnerUserIds.length > 0) {
    const familyStudents = await db.getList('students', { owner_user_id: _.in(incomingOwnerUserIds) });
    familyStudents.forEach((student) => {
      if (student && student._id) visibleStudentIds.add(student._id);
    });
  }

  sharedSchedules.forEach((schedule) => {
    if (schedule && schedule.student_id) visibleStudentIds.add(schedule.student_id);
  });
  const studentCount = visibleStudentIds.size;

  const outgoingFamilyRelations = await db.getList('families', { owner_user_id: userId });
  const relatedFamilyUserIds = new Set();
  outgoingFamilyRelations.forEach((relation) => {
    if (relation.member_user_id) relatedFamilyUserIds.add(relation.member_user_id);
  });
  incomingFamilyRelations.forEach((relation) => {
    if (relation.owner_user_id) relatedFamilyUserIds.add(relation.owner_user_id);
  });
  sharedSchedules.forEach((schedule) => {
    if (schedule.owner_user_id) relatedFamilyUserIds.add(schedule.owner_user_id);
  });
  ownSchedules.forEach((schedule) => {
    for (const member of schedule.shared_with || []) {
      if (member && member.user_id) relatedFamilyUserIds.add(member.user_id);
    }
  });
  const familyMemberCount = relatedFamilyUserIds.size;

  const settings = user.settings || {};
  const studentSettings = settings.student_settings || {};

  let notifyAnyEnabled = false;
  if (settings.notify_enabled === false) {
    notifyAnyEnabled = false;
  } else if (ownStudents.length === 0) {
    notifyAnyEnabled = false;
  } else {
    for (const st of ownStudents) {
      const sid = st._id;
      const s = studentSettings[sid] || {};
      const noon = s.noon_enabled !== undefined ? !!s.noon_enabled : true;
      const afternoon = s.afternoon_enabled !== undefined ? !!s.afternoon_enabled : true;
      if (noon || afternoon) {
        notifyAnyEnabled = true;
        break;
      }
    }
  }

  return success({
    scheduleCount,
    studentCount,
    familyMemberCount,
    notifyAnyEnabled,
  });
}

async function updateProfile(userId, payload) {
  const user = await db.getOne('users', userId);
  if (!user) {
    return fail(ERRORS.NOT_FOUND, '用户不存在');
  }
  if (isUserBlocked(user)) {
    return fail(ERRORS.FORBIDDEN, '账号状态异常，无法访问');
  }

  const updateData = {};
  if (payload.nickname !== undefined) {
    validator.maxLength(payload.nickname, 20, 'nickname');
    updateData.nickname = payload.nickname;
  }
  if (payload.avatar_url !== undefined) {
    validator.maxLength(payload.avatar_url, 500, 'avatar_url');
    updateData.avatar_url = payload.avatar_url;
  }

  await db.update('users', user._id, updateData);
  const nextUser = await db.getOne('users', user._id);
  return success(toUserPayload(nextUser));
}

async function updateDisplaySettings(userId, payload) {
  const user = await db.getOne('users', userId);
  if (!user) return fail(ERRORS.NOT_FOUND, '用户不存在');
  if (isUserBlocked(user)) {
    return fail(ERRORS.FORBIDDEN, '账号状态异常，无法访问');
  }
  const settings = user.settings || {};
  if (payload.hide_weekend !== undefined) {
    settings.hide_weekend = !!payload.hide_weekend;
  }
  await db.update('users', user._id, { settings });
  return success(null);
}

async function saveSubscribeAuth(userId, payload) {
  validator.requireFields(payload, ['templateId', 'result']);

  const user = await db.getOne('users', userId);
  if (!user) {
    return fail(ERRORS.NOT_FOUND, '用户不存在');
  }

  const subscribeTokens = user.subscribe_tokens || [];
  const existingIndex = subscribeTokens.findIndex(t => t.template_id === payload.templateId);

  const newToken = {
    template_id: payload.templateId,
    result: payload.result,
    updated_at: new Date(),
  };

  if (existingIndex >= 0) {
    subscribeTokens[existingIndex] = newToken;
  } else {
    subscribeTokens.push(newToken);
  }

  await db.update('users', user._id, { subscribe_tokens: subscribeTokens });
  return success(null);
}

exports.main = async (event) => {
  const wxContext = cloud.getWXContext();

  try {
    const { action, payload = {} } = event;

    if (action === 'sendSmsCode') {
      return await handleSendSmsCode(wxContext, payload);
    }

    if (action === 'loginByPhone') {
      const openid = getOpenId(wxContext);
      return await loginByPhone(openid, wxContext.UNIONID, payload);
    }

    const { userId } = await resolveCurrentUser(wxContext);

    switch (action) {
      case 'getProfile':
        return await getProfile(userId);
      case 'getSettingsSummary':
        return await getSettingsSummary(userId);
      case 'updateProfile':
        return await updateProfile(userId, payload);
      case 'updateDisplaySettings':
        return await updateDisplaySettings(userId, payload);
      case 'saveSubscribeAuth':
        return await saveSubscribeAuth(userId, payload);
      default:
        return fail(ERRORS.PARAM_ERROR, `未知的 action: ${action}`);
    }
  } catch (e) {
    if (e && typeof e.code === 'number') return e;
    logger.error(FN, event.action, e);
    const detail = e instanceof Error ? e.message : JSON.stringify(e);
    return { ...fail(ERRORS.INTERNAL_ERROR), _debug: detail };
  }
};
