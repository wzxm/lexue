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

/**
 * 微信登录
 * 从 WXContext 获取 OPENID/UNIONID，查找或创建用户记录
 */
async function login(openid, unionid) {
  logger.info(FN, 'login', { openid });

  // 查找已有用户
  let user = await db.findOne('users', { openid });

  if (!user) {
    // 首次登录，创建新用户
    const { _id } = await db.create('users', {
      openid,
      unionid: unionid || '',
      nickname: '',
      avatar_url: '',
      settings: {
        notify_enabled: true,
        notify_advance_minutes: 30,
      },
      subscribe_tokens: [],
    });
    user = await db.getOne('users', _id);
    logger.info(FN, 'login:created', { openid, _id });
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

  const invited = new Set();
  for (const sch of allSchedules) {
    for (const m of sch.shared_with || []) {
      if (m && m.openid) {
        invited.add(m.openid);
      }
    }
  }
  const familyMemberCount = invited.size;

  const settings = user.settings || {};
  const studentSettings = settings.student_settings || {};
  const students = await db.getList('students', { owner_openid: openid });

  let notifyAnyEnabled = false;
  if (settings.notify_enabled === false) {
    notifyAnyEnabled = false;
  } else if (students.length === 0) {
    notifyAnyEnabled = false;
  } else {
    for (const st of students) {
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
  return success(null);
}

// ——— 入口 ———
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();

  try {
    const { action, payload = {} } = event;

    // login 不需要提前验证，让它自己处理
    if (action === 'login') {
      return await login(wxContext.OPENID, wxContext.UNIONID);
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
