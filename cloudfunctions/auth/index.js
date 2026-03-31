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

  return success(user);
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
  return success(user);
}

/**
 * 更新用户信息（只允许改 nickname 和 avatar_url）
 */
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
