/**
 * auth 云函数 - 用户认证
 * 负责微信登录、获取用户信息、更新用户信息
 * 身份来源：100% 从 WXContext 获取，前端传的 openid 一概不信
 */

const cloud = require('wx-server-sdk');
cloud.init({ env: 'cloud1-1g0kf2p8b07af20f' });

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

function isUserBlocked(user) {
  const status = user && user.status ? user.status : USER_STATUS.ACTIVE;
  return status === USER_STATUS.DISABLED || status === USER_STATUS.DELETED;
}

function toUserPayload(user) {
  return {
    openId: user.openid,
    nickname: user.nickname || '',
    avatarUrl: user.avatar_url || '',
    settings: user.settings || {
      notify_enabled: true,
      notify_advance_minutes: 30,
    },
  };
}

function generateDefaultNickname() {
  const suffix = Math.floor(Math.random() * 900000) + 100000;
  return `家长${suffix}`;
}

/**
 * 微信登录
 * 从 WXContext 获取 OPENID/UNIONID，查找或创建用户记录
 */
async function login(openid, unionid, payload = {}) {
  logger.info(FN, 'login', { openid });

  // 查找已有用户
  let user = await db.findOne('users', { openid });

  const nickname = payload.nickname !== undefined ? String(payload.nickname).trim() : undefined;
  const avatarUrl = payload.avatar_url !== undefined ? String(payload.avatar_url).trim() : undefined;
  if (nickname !== undefined) {
    validator.maxLength(nickname, 20, 'nickname');
  }
  if (avatarUrl !== undefined) {
    validator.maxLength(avatarUrl, 500, 'avatar_url');
  }

  if (!user) {
    const defaultNickname = generateDefaultNickname();
    // 首次登录，创建新用户
    const { _id } = await db.create('users', {
      openid,
      unionid: unionid || '',
      status: USER_STATUS.ACTIVE,
      nickname: nickname || defaultNickname,
      avatar_url: avatarUrl || '',
      settings: {
        notify_enabled: true,
        notify_advance_minutes: 30,
      },
      subscribe_tokens: [],
    });
    user = await db.getOne('users', _id);
    logger.info(FN, 'login:created', { openid, _id });
  }

  if (isUserBlocked(user)) {
    return fail(ERRORS.FORBIDDEN, '账号状态异常，无法登录');
  }

  if (user && (nickname !== undefined || avatarUrl !== undefined)) {
    const nextNickname = nickname !== undefined ? nickname : user.nickname || '';
    const nextAvatarUrl = avatarUrl !== undefined ? avatarUrl : user.avatar_url || '';
    if (nextNickname !== (user.nickname || '') || nextAvatarUrl !== (user.avatar_url || '')) {
      await db.update('users', user._id, {
        nickname: nextNickname,
        avatar_url: nextAvatarUrl,
      });
      user = await db.getOne('users', user._id);
    }
  }

  // 新老用户统一：没有学生记录就补一条默认学生
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
    logger.info(FN, 'login:default_student_created', { openid });
  }

  return success(toUserPayload(user));
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

  const familyRelations = await db.getList('families', { owner_openid: openid });
  let familyMemberCount = familyRelations.length;
  if (familyMemberCount === 0) {
    const invited = new Set();
    for (const sch of allSchedules) {
      for (const m of sch.shared_with || []) {
        if (m && m.openid) {
          invited.add(m.openid);
        }
      }
    }
    familyMemberCount = invited.size;
  }

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

    // login 不需要提前验证，让它自己处理
    if (action === 'login') {
      return await login(wxContext.OPENID, wxContext.UNIONID, payload);
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
