const db = require('./db');

function uniqueUserIds(userIds) {
  return Array.from(
    new Set(
      (userIds || [])
        .map((item) => String(item || '').trim())
        .filter(Boolean),
    ),
  );
}

function toFamilyMember(userId, existingMember) {
  return {
    user_id: userId,
    permission: 'edit',
    join_time: existingMember?.join_time || new Date(),
  };
}

async function listFamilyRelations(ownerUserId) {
  return db.getList('families', { owner_user_id: ownerUserId });
}

async function isFamilyMember(ownerUserId, memberUserId) {
  if (!ownerUserId || !memberUserId) return false;
  const relation = await db.findOne('families', {
    owner_user_id: ownerUserId,
    member_user_id: memberUserId,
  });
  return !!relation;
}

async function upsertFamilyRelation(ownerUserId, memberUserId, extra = {}) {
  if (!ownerUserId || !memberUserId || ownerUserId === memberUserId) {
    return null;
  }

  const existing = await db.findOne('families', {
    owner_user_id: ownerUserId,
    member_user_id: memberUserId,
  });

  if (existing) {
    const updateData = {};
    if (extra.member_nickname !== undefined) updateData.member_nickname = extra.member_nickname;
    if (extra.member_avatar !== undefined) updateData.member_avatar = extra.member_avatar;
    if (extra.role !== undefined) updateData.role = extra.role;
    if (Object.keys(updateData).length > 0) {
      await db.update('families', existing._id, updateData);
    }
    return existing;
  }

  const payload = {
    owner_user_id: ownerUserId,
    member_user_id: memberUserId,
  };
  if (extra.member_nickname !== undefined) payload.member_nickname = extra.member_nickname;
  if (extra.member_avatar !== undefined) payload.member_avatar = extra.member_avatar;
  if (extra.role !== undefined) payload.role = extra.role;

  const created = await db.create('families', payload);
  return db.getOne('families', created._id);
}

async function removeFamilyRelation(ownerUserId, memberUserId) {
  const relation = await db.findOne('families', {
    owner_user_id: ownerUserId,
    member_user_id: memberUserId,
  });
  if (!relation) return false;
  await db.remove('families', relation._id);
  return true;
}

async function syncOwnerSchedulesForMembers(ownerUserId, memberUserIds) {
  const normalizedMembers = uniqueUserIds(memberUserIds);
  const schedules = await db.getList('schedules', { owner_user_id: ownerUserId });

  await Promise.all(schedules.map(async (schedule) => {
    const sharedWith = Array.isArray(schedule.shared_with)
      ? schedule.shared_with.filter((member) => member && typeof member.user_id === 'string' && member.user_id.trim())
      : [];
    const preserved = sharedWith.filter((member) => !normalizedMembers.includes(member.user_id));
    const existingMap = new Map(sharedWith.map((member) => [member.user_id, member]));
    const syncedMembers = normalizedMembers.map((userId) => toFamilyMember(userId, existingMap.get(userId)));
    await db.update('schedules', schedule._id, { shared_with: [...preserved, ...syncedMembers] });
  }));

  return schedules.length;
}

async function syncOwnerSchedules(ownerUserId) {
  const relations = await listFamilyRelations(ownerUserId);
  return syncOwnerSchedulesForMembers(ownerUserId, relations.map((item) => item.member_user_id));
}

async function syncOwnerSchedulesForMember(ownerUserId, memberUserId) {
  return syncOwnerSchedulesForMembers(ownerUserId, [memberUserId]);
}

async function removeMemberFromOwnerSchedules(ownerUserId, memberUserId) {
  const schedules = await db.getList('schedules', { owner_user_id: ownerUserId });
  await Promise.all(schedules.map(async (schedule) => {
    const sharedWith = Array.isArray(schedule.shared_with) ? schedule.shared_with : [];
    const nextSharedWith = sharedWith.filter((member) => member.user_id !== memberUserId);
    if (nextSharedWith.length === sharedWith.length) return;
    await db.update('schedules', schedule._id, { shared_with: nextSharedWith });
  }));
  return schedules.length;
}

module.exports = {
  isFamilyMember,
  listFamilyRelations,
  removeFamilyRelation,
  removeMemberFromOwnerSchedules,
  syncOwnerSchedules,
  syncOwnerSchedulesForMember,
  syncOwnerSchedulesForMembers,
  toFamilyMember,
  upsertFamilyRelation,
};
