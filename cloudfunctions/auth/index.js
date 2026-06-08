/**
 * auth 云函数 - 用户认证
 * 负责微信登录、获取用户信息、更新用户信息
 * 身份来源：100% 从 WXContext 获取，前端传的 openid 一概不信
 */

const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = require('../../shared/db');
const { ERRORS, success, fail } = require('../../shared/errors');
const { getOpenId } = require('../../shared/auth');
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
    openId: user.openid,
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

function getOpenApiErrorInfo(err) {
  if (!err || typeof err !== 'object') {
    return { message: String(err || '') };
  }

  return {
    errCode: err.errCode !== undefined ? err.errCode : err.errcode,
    errMsg: err.errMsg || err.errmsg,
    code: err.code,
    message: err.message,
    stack: err.stack,
  };
}

function buildPhoneAuthErrorMessage(info = {}) {
  const rawMessage = info.errMsg || info.message || '';
  const errCode = info.errCode !== undefined ? info.errCode : info.code;
  const suffix = errCode !== undefined ? `（${errCode}）` : '';

  if (!rawMessage) {
    return `手机号授权失败${suffix}，请重新点击登录`;
  }

  return `手机号授权失败${suffix}: ${rawMessage}`;
}

async function ensureDefaultStudent(openid) {
  const students = await db.getList('students', { owner_openid: openid });
  if (!students || students.length === 0) {
    await db.create('students', {
      owner_openid: openid,
      name: '默认学生',
      school_name: '',
      grade: '',
      class_name: '',
      avatar_url: '',
      remark: '',
      source: 'init',
    });
    logger.info(FN, 'default_student_created', { openid });
  }
}

async function finishLogin(openid, user) {
  if (isUserBlocked(user)) {
    return fail(ERRORS.FORBIDDEN, '账号状态异常，无法登录');
  }
  await ensureDefaultStudent(openid);
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

async function decryptPhoneNumber(phoneCode) {
  validator.requireFields({ phoneCode }, ['phoneCode']);
  const code = String(phoneCode).trim();
  validator.maxLength(code, 128, 'phoneCode');

  let result;
  try {
    result = await cloud.openapi.phonenumber.getPhoneNumber({ code });
  } catch (e) {
    const errorInfo = getOpenApiErrorInfo(e);
    logger.error(FN, 'decryptPhoneNumber', errorInfo);
    throw fail(ERRORS.PARAM_ERROR, buildPhoneAuthErrorMessage(errorInfo));
  }

  const errCode = result.errCode !== undefined ? result.errCode : result.errcode;
  if (errCode !== 0) {
    logger.warn(FN, 'decryptPhoneNumber:openapi_failed', {
      errCode,
      errMsg: result.errMsg || result.errmsg,
    });
    throw fail(
      ERRORS.PARAM_ERROR,
      buildPhoneAuthErrorMessage({
        errCode,
        errMsg: result.errMsg || result.errmsg,
      }),
    );
  }

  const phoneInfo = result.phoneInfo || result.phone_info || {};
  const purePhone = phoneInfo.purePhoneNumber || phoneInfo.pure_phone_number || '';
  validator.phoneNumber(purePhone);
  return purePhone;
}

async function resolvePhoneLoginUser(openid, unionid, phone, payload = {}) {
  const userByOpenid = await db.findOne('users', { openid });
  const userByPhone = await db.findOne('users', { phone });

  if (userByPhone && userByPhone.openid !== openid) {
    throw fail(ERRORS.FORBIDDEN, '该手机号已绑定其他微信账号');
  }
  if (userByOpenid && userByOpenid.phone && userByOpenid.phone !== phone) {
    throw fail(ERRORS.FORBIDDEN, '当前微信账号已绑定其他手机号');
  }

  const { nickname, avatarUrl } = parseOptionalProfile(payload);
  let user = userByOpenid || userByPhone;

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
    logger.info(FN, 'loginWithPhone:created', { openid, phone, _id });
    return user;
  }

  const updateData = {};
  if (!user.phone) updateData.phone = phone;
  if (unionid && user.unionid !== unionid) updateData.unionid = unionid;

  if (Object.keys(updateData).length > 0) {
    await db.update('users', user._id, updateData);
    user = await db.getOne('users', user._id);
  }

  return applyOptionalProfileUpdate(user, payload);
}

/**
 * 微信登录（openid 模式，不强制绑定手机号）
 * 从 WXContext 获取 OPENID/UNIONID，查找或创建用户记录
 */
async function login(openid, unionid, payload = {}) {
  logger.info(FN, 'login', { openid });

  let user = await db.findOne('users', { openid });

  if (!user) {
    const { nickname, avatarUrl } = parseOptionalProfile(payload);
    const { _id } = await db.create('users', {
      openid,
      unionid: unionid || '',
      status: USER_STATUS.ACTIVE,
      nickname: nickname || generateDefaultNickname(),
      avatar_url: avatarUrl || '',
      settings: DEFAULT_USER_SETTINGS,
      subscribe_tokens: [],
    });
    user = await db.getOne('users', _id);
    logger.info(FN, 'login:created', { openid, _id });
  } else {
    user = await applyOptionalProfileUpdate(user, payload);
  }

  return finishLogin(openid, user);
}

/**
 * 微信授权手机号登录
 * 解密手机号后绑定/校验 users.phone，账号仍以当前 openid 为准
 */
async function loginWithPhone(openid, unionid, payload = {}) {
  logger.info(FN, 'loginWithPhone', { openid });

  const phone = await decryptPhoneNumber(payload.phoneCode);
  const user = await resolvePhoneLoginUser(openid, unionid, phone, payload);
  return finishLogin(openid, user);
}

/**
 * 获取当前用户信息
 */
async function getProfile(openid) {
  logger.info(FN, 'getProfile', { openid });

  const user = await db.findOne('users', { openid });
  if (!user) {
    return fail(ERRORS.NOT_FOUND, '用户不存在');
  }
  if (isUserBlocked(user)) {
    return fail(ERRORS.FORBIDDEN, '账号状态异常，无法访问');
  }
  return success(toUserPayload(user));
}

/**
 * 更新用户信息（只允许改 nickname 和 avatar_url）
 */
/**
 * 设置页汇总：课表数、家人数、通知是否至少有一处开启（一次查询）
 */
async function getSettingsSummary(openid) {
  logger.info(FN, 'getSettingsSummary', { openid });

  const user = await db.findOne('users', { openid });
  if (!user) {
    return fail(ERRORS.NOT_FOUND, '用户不存在');
  }
  if (isUserBlocked(user)) {
    return fail(ERRORS.FORBIDDEN, '账号状态异常，无法访问');
  }

  const ownSchedules = await db.getList('schedules', { owner_openid: openid }, {
    orderBy: { field: 'createTime', direction: 'desc' },
  });
  const _ = db.getCommand();
  const sharedSchedules = await db.getList('schedules', {
    shared_with: _.elemMatch({ openid }),
    owner_openid: _.neq(openid),
  });
  const allSchedules = [...ownSchedules, ...sharedSchedules];
  const scheduleCount = allSchedules.length;

  const incomingFamilyRelations = await db.getList('families', { member_openid: openid });
  const incomingOwnerOpenids = Array.from(new Set(
    incomingFamilyRelations.map((item) => item.owner_openid).filter(Boolean),
  ));

  const visibleStudentIds = new Set();
  const ownStudents = await db.getList('students', { owner_openid: openid });
  ownStudents.forEach((student) => {
    if (student && student._id) visibleStudentIds.add(student._id);
  });

  if (incomingOwnerOpenids.length > 0) {
    const familyStudents = await db.getList('students', { owner_openid: _.in(incomingOwnerOpenids) });
    familyStudents.forEach((student) => {
      if (student && student._id) visibleStudentIds.add(student._id);
    });
  }

  sharedSchedules.forEach((schedule) => {
    if (schedule && schedule.student_id) visibleStudentIds.add(schedule.student_id);
  });
  const studentCount = visibleStudentIds.size;

  const outgoingFamilyRelations = await db.getList('families', { owner_openid: openid });
  const relatedFamilyOpenids = new Set();
  outgoingFamilyRelations.forEach((relation) => {
    if (relation.member_openid) relatedFamilyOpenids.add(relation.member_openid);
  });
  incomingFamilyRelations.forEach((relation) => {
    if (relation.owner_openid) relatedFamilyOpenids.add(relation.owner_openid);
  });
  sharedSchedules.forEach((schedule) => {
    if (schedule.owner_openid) relatedFamilyOpenids.add(schedule.owner_openid);
  });
  ownSchedules.forEach((schedule) => {
    for (const member of schedule.shared_with || []) {
      if (member && member.openid) relatedFamilyOpenids.add(member.openid);
    }
  });
  const familyMemberCount = relatedFamilyOpenids.size;

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

async function updateProfile(openid, payload) {
  logger.info(FN, 'updateProfile', { openid });

  const user = await db.findOne('users', { openid });
  if (!user) {
    return fail(ERRORS.NOT_FOUND, '用户不存在');
  }
  if (isUserBlocked(user)) {
    return fail(ERRORS.FORBIDDEN, '账号状态异常，无法访问');
  }

  // 只允许更新这两个字段，其他的别想动
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

async function updateDisplaySettings(openid, payload) {
  const user = await db.findOne('users', { openid });
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

// ——— 入口 ———
/**
 * 保存用户订阅授权记录
 * 前端调用 wx.requestSubscribeMessage 后，将授权结果保存到数据库
 */
async function saveSubscribeAuth(openid, payload) {
  validator.requireFields(payload, ['templateId', 'result']);

  logger.info(FN, 'saveSubscribeAuth', { openid, templateId: payload.templateId, result: payload.result });

  const user = await db.findOne('users', { openid });
  if (!user) {
    return fail(ERRORS.NOT_FOUND, '用户不存在');
  }

  // 更新或添加订阅授权记录
  const subscribeTokens = user.subscribe_tokens || [];
  const existingIndex = subscribeTokens.findIndex(t => t.template_id === payload.templateId);

  const newToken = {
    template_id: payload.templateId,
    result: payload.result, // 'accept' | 'reject' | 'ban'
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

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();

  try {
    const { action, payload = {} } = event;

    // 登录类 action 不需要提前验证 openid，由 WXContext 提供身份
    if (action === 'login') {
      return await login(wxContext.OPENID, wxContext.UNIONID, payload);
    }
    if (action === 'loginWithPhone') {
      return await loginWithPhone(wxContext.OPENID, wxContext.UNIONID, payload);
    }

    // 其他 action 必须先拿到 openid
    const openid = getOpenId(wxContext);

    switch (action) {
      case 'getProfile':
        return await getProfile(openid);
      case 'getSettingsSummary':
        return await getSettingsSummary(openid);
      case 'updateProfile':
        return await updateProfile(openid, payload);
      case 'updateDisplaySettings':
        return await updateDisplaySettings(openid, payload);
      case 'saveSubscribeAuth':
        return await saveSubscribeAuth(openid, payload);
      default:
        return fail(ERRORS.PARAM_ERROR, `未知的 action: ${action}`);
    }
  } catch (e) {
    // 如果是我们自己 throw 的错误响应，直接返回
    if (e && typeof e.code === 'number') return e;
    logger.error(FN, event.action, e);
    // DEBUG: 临时暴露错误信息方便排查，上线前删掉
    const detail = e instanceof Error ? e.message : JSON.stringify(e);
    return { ...fail(ERRORS.INTERNAL_ERROR), _debug: detail };
  }
};
