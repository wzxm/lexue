/**
 * family 云函数 - 家庭成员管理
 * 账户级家庭关系以 families 集合作为事实来源。
 */

const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

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

  const _ = db.getCommand();
  const outgoingRelations = await listFamilyRelations(openid);
  const incomingRelations = await db.getList('families', { member_openid: openid });
  const incomingSharedSchedules = await db.getList('schedules', {
    shared_with: _.elemMatch({ openid }),
    owner_openid: _.neq(openid),
  });

  const outgoingMemberOpenids = outgoingRelations.map((item) => item.member_openid).filter(Boolean);
  const incomingOwnerOpenids = Array.from(new Set([
    ...incomingRelations.map((item) => item.owner_openid).filter(Boolean),
    ...incomingSharedSchedules.map((schedule) => schedule.owner_openid).filter(Boolean),
  ]));
  const allOpenids = Array.from(new Set([...outgoingMemberOpenids, ...incomingOwnerOpenids]));
  const users = allOpenids.length > 0
    ? await db.getList('users', { openid: _.in(allOpenids) })
    : [];
  const userMap = {};
  users.forEach((user) => { userMap[user.openid] = user; });

  const members = outgoingRelations.map((item) => ({
    openid: item.member_openid,
    permission: 'edit',
    is_owner: false,
    relation_type: 'outgoing',
    join_time: item.createTime,
    nickname: userMap[item.member_openid]?.nickname || item.member_nickname || '',
    avatar_url: userMap[item.member_openid]?.avatar_url || item.member_avatar || '',
  }));

  const outgoingSet = new Set(outgoingMemberOpenids);
  const incomingMembers = incomingOwnerOpenids
    .filter((ownerOpenid) => !outgoingSet.has(ownerOpenid))
    .map((ownerOpenid) => {
      const relation = incomingRelations.find((item) => item.owner_openid === ownerOpenid);
      const schedule = incomingSharedSchedules.find((item) => item.owner_openid === ownerOpenid);
      return {
        openid: ownerOpenid,
        permission: 'owner',
        is_owner: true,
        relation_type: 'incoming',
        join_time: relation?.createTime || schedule?.createTime,
        nickname: userMap[ownerOpenid]?.nickname || '',
        avatar_url: userMap[ownerOpenid]?.avatar_url || '',
      };
    });

  members.push(...incomingMembers);
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

  const _ = db.getCommand();
  const sharedSchedule = await db.findOne('schedules', {
    owner_openid: payload.ownerOpenid,
    shared_with: _.elemMatch({ openid }),
  });
  const removed = await removeFamilyRelation(payload.ownerOpenid, openid);
  if (!removed && !sharedSchedule) {
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
