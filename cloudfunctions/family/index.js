/**
 * family 云函数 - 家庭成员管理
 * 账户级家庭关系以 families 集合作为事实来源。
 */

const cloud = require('wx-server-sdk');
cloud.init({ env: 'cloud1-1g0kf2p8b07af20f' });

const db = require('../../shared/db');
const { ERRORS, success, fail } = require('../../shared/errors');
const { getOpenId } = require('../../shared/auth');
const {
  listFamilyRelations,
  removeFamilyRelation,
  removeMemberFromOwnerSchedules,
} = require('../../shared/family');
const validator = require('../../shared/validator');
const logger = require('../../shared/logger');

const FN = 'family';

async function listMembers(openid) {
  logger.info(FN, 'listMembers', { openid });

  const relations = await listFamilyRelations(openid);
  const memberOpenids = relations.map((item) => item.member_openid);
  const _ = db.getCommand();
  const users = memberOpenids.length > 0
    ? await db.getList('users', { openid: _.in(memberOpenids) })
    : [];
  const userMap = {};
  users.forEach((user) => { userMap[user.openid] = user; });

  const members = relations.map((item) => ({
    openid: item.member_openid,
    permission: 'edit',
    is_owner: false,
    join_time: item.createTime,
    nickname: userMap[item.member_openid]?.nickname || item.member_nickname || '',
    avatar_url: userMap[item.member_openid]?.avatar_url || item.member_avatar || '',
  }));

  return success(members);
}

async function removeMember(openid, payload) {
  validator.requireFields(payload, ['targetOpenid']);
  if (payload.targetOpenid === openid) {
    return fail(ERRORS.PARAM_ERROR, '不能移除自己');
  }

  const removed = await removeFamilyRelation(openid, payload.targetOpenid);
  if (!removed) {
    return fail(ERRORS.NOT_FOUND, '该成员不在家人列表中');
  }

  await removeMemberFromOwnerSchedules(openid, payload.targetOpenid);

  logger.info(FN, 'removeMember', {
    openid,
    target: payload.targetOpenid,
  });

  return success(null);
}

async function leave(openid, payload) {
  if (!payload.ownerOpenid) {
    return fail(ERRORS.PARAM_ERROR, '缺少 ownerOpenid');
  }
  if (payload.ownerOpenid === openid) {
    return fail(ERRORS.PARAM_ERROR, '不能退出自己的家庭关系');
  }

  const removed = await removeFamilyRelation(payload.ownerOpenid, openid);
  if (!removed) {
    return fail(ERRORS.NOT_FOUND, '未找到对应的家庭关系');
  }

  await removeMemberFromOwnerSchedules(payload.ownerOpenid, openid);
  return success(null);
}

exports.main = async (event) => {
  const wxContext = cloud.getWXContext();

  try {
    const openid = getOpenId(wxContext);
    const { action, payload = {} } = event;

    switch (action) {
      case 'listMembers': return await listMembers(openid);
      case 'removeMember': return await removeMember(openid, payload);
      case 'leave': return await leave(openid, payload);
      default: return fail(ERRORS.PARAM_ERROR, `未知的 action: ${action}`);
    }
  } catch (e) {
    if (e && typeof e.code === 'number') return e;
    logger.error(FN, event.action, e);
    return fail(ERRORS.INTERNAL_ERROR);
  }
};
