/**
 * family 云函数 - 家庭成员管理
 * 账户级家庭关系以 families 集合作为事实来源。
 */

const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = require('../../shared/db');
const { ERRORS, success, fail } = require('../../shared/errors');
const { resolveCurrentUser } = require('../../shared/auth');
const {
  listFamilyRelations,
  removeFamilyRelation,
  removeMemberFromOwnerSchedules,
} = require('../../shared/family');
const validator = require('../../shared/validator');
const logger = require('../../shared/logger');

const FN = 'family';

async function listMembers(userId) {
  logger.info(FN, 'listMembers', { userId });

  const _ = db.getCommand();
  const outgoingRelations = await listFamilyRelations(userId);
  const incomingRelations = await db.getList('families', { member_user_id: userId });
  const incomingSharedSchedules = await db.getList('schedules', {
    shared_with: _.elemMatch({ user_id: userId }),
    owner_user_id: _.neq(userId),
  });

  const outgoingMemberUserIds = outgoingRelations.map((item) => item.member_user_id).filter(Boolean);
  const incomingOwnerUserIds = Array.from(new Set([
    ...incomingRelations.map((item) => item.owner_user_id).filter(Boolean),
    ...incomingSharedSchedules.map((schedule) => schedule.owner_user_id).filter(Boolean),
  ]));
  const allUserIds = Array.from(new Set([...outgoingMemberUserIds, ...incomingOwnerUserIds]));
  const users = allUserIds.length > 0
    ? await db.getList('users', { _id: _.in(allUserIds) })
    : [];
  const userMap = {};
  users.forEach((user) => { userMap[user._id] = user; });

  const members = outgoingRelations.map((item) => ({
    userId: item.member_user_id,
    permission: 'edit',
    is_owner: false,
    relation_type: 'outgoing',
    join_time: item.createTime,
    nickname: userMap[item.member_user_id]?.nickname || item.member_nickname || '',
    avatar_url: userMap[item.member_user_id]?.avatar_url || item.member_avatar || '',
  }));

  const outgoingSet = new Set(outgoingMemberUserIds);
  const incomingMembers = incomingOwnerUserIds
    .filter((ownerUserId) => !outgoingSet.has(ownerUserId))
    .map((ownerUserId) => {
      const relation = incomingRelations.find((item) => item.owner_user_id === ownerUserId);
      const schedule = incomingSharedSchedules.find((item) => item.owner_user_id === ownerUserId);
      return {
        userId: ownerUserId,
        permission: 'owner',
        is_owner: true,
        relation_type: 'incoming',
        join_time: relation?.createTime || schedule?.createTime,
        nickname: userMap[ownerUserId]?.nickname || '',
        avatar_url: userMap[ownerUserId]?.avatar_url || '',
      };
    });

  members.push(...incomingMembers);
  return success(members);
}

async function removeMember(userId, payload) {
  validator.requireFields(payload, ['targetUserId']);
  if (payload.targetUserId === userId) {
    return fail(ERRORS.PARAM_ERROR, '不能移除自己');
  }

  const removed = await removeFamilyRelation(userId, payload.targetUserId);
  if (!removed) {
    return fail(ERRORS.NOT_FOUND, '该成员不在家人列表中');
  }

  await removeMemberFromOwnerSchedules(userId, payload.targetUserId);

  logger.info(FN, 'removeMember', {
    userId,
    target: payload.targetUserId,
  });

  return success(null);
}

async function leave(userId, payload) {
  if (!payload.ownerUserId) {
    return fail(ERRORS.PARAM_ERROR, '缺少 ownerUserId');
  }
  if (payload.ownerUserId === userId) {
    return fail(ERRORS.PARAM_ERROR, '不能退出自己的家庭关系');
  }

  const _ = db.getCommand();
  const sharedSchedule = await db.findOne('schedules', {
    owner_user_id: payload.ownerUserId,
    shared_with: _.elemMatch({ user_id: userId }),
  });
  const removed = await removeFamilyRelation(payload.ownerUserId, userId);
  if (!removed && !sharedSchedule) {
    return fail(ERRORS.NOT_FOUND, '未找到对应的家庭关系');
  }

  await removeMemberFromOwnerSchedules(payload.ownerUserId, userId);
  return success(null);
}

exports.main = async (event) => {
  const wxContext = cloud.getWXContext();

  try {
    const { userId } = await resolveCurrentUser(wxContext);
    const { action, payload = {} } = event;

    switch (action) {
      case 'listMembers': return await listMembers(userId);
      case 'removeMember': return await removeMember(userId, payload);
      case 'leave': return await leave(userId, payload);
      default: return fail(ERRORS.PARAM_ERROR, `未知的 action: ${action}`);
    }
  } catch (e) {
    if (e && typeof e.code === 'number') return e;
    logger.error(FN, event.action, e);
    return fail(ERRORS.INTERNAL_ERROR);
  }
};
