const db = require('./db');

function uniqueOpenids(openids) {
  return Array.from(
    new Set(
      (openids || [])
        .map((item) => String(item || '').trim())
        .filter(Boolean),
    ),
  );
}

function toFamilyMember(openid, existingMember) {
  return {
    openid,
    permission: 'edit',
    join_time: existingMember?.join_time || new Date(),
  };
}

async function listFamilyRelations(ownerOpenid) {
  return db.getList('families', { owner_openid: ownerOpenid });
}

async function isFamilyMember(ownerOpenid, memberOpenid) {
  if (!ownerOpenid || !memberOpenid) return false;
  const relation = await db.findOne('families', {
    owner_openid: ownerOpenid,
    member_openid: memberOpenid,
  });
  return !!relation;
}

async function upsertFamilyRelation(ownerOpenid, memberOpenid, extra = {}) {
  if (!ownerOpenid || !memberOpenid || ownerOpenid === memberOpenid) {
    return null;
  }

  const existing = await db.findOne('families', {
    owner_openid: ownerOpenid,
    member_openid: memberOpenid,
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
    owner_openid: ownerOpenid,
    member_openid: memberOpenid,
  };
  if (extra.member_nickname !== undefined) payload.member_nickname = extra.member_nickname;
  if (extra.member_avatar !== undefined) payload.member_avatar = extra.member_avatar;
  if (extra.role !== undefined) payload.role = extra.role;

  const created = await db.create('families', payload);
  return db.getOne('families', created._id);
}

async function removeFamilyRelation(ownerOpenid, memberOpenid) {
  const relation = await db.findOne('families', {
    owner_openid: ownerOpenid,
    member_openid: memberOpenid,
  });
  if (!relation) return false;
  await db.remove('families', relation._id);
  return true;
}

async function syncOwnerSchedulesForMembers(ownerOpenid, memberOpenids) {
  const normalizedMembers = uniqueOpenids(memberOpenids);
  const schedules = await db.getList('schedules', { owner_openid: ownerOpenid });

  await Promise.all(schedules.map(async (schedule) => {
    const sharedWith = Array.isArray(schedule.shared_with)
      ? schedule.shared_with.filter((member) => member && typeof member.openid === 'string' && member.openid.trim())
      : [];
    const preserved = sharedWith.filter((member) => !normalizedMembers.includes(member.openid));
    const existingMap = new Map(sharedWith.map((member) => [member.openid, member]));
    const syncedMembers = normalizedMembers.map((openid) => toFamilyMember(openid, existingMap.get(openid)));
    await db.update('schedules', schedule._id, { shared_with: [...preserved, ...syncedMembers] });
  }));

  return schedules.length;
}

async function syncOwnerSchedules(ownerOpenid) {
  const relations = await listFamilyRelations(ownerOpenid);
  return syncOwnerSchedulesForMembers(ownerOpenid, relations.map((item) => item.member_openid));
}

async function syncOwnerSchedulesForMember(ownerOpenid, memberOpenid) {
  return syncOwnerSchedulesForMembers(ownerOpenid, [memberOpenid]);
}

async function removeMemberFromOwnerSchedules(ownerOpenid, memberOpenid) {
  const schedules = await db.getList('schedules', { owner_openid: ownerOpenid });
  await Promise.all(schedules.map(async (schedule) => {
    const sharedWith = Array.isArray(schedule.shared_with) ? schedule.shared_with : [];
    const nextSharedWith = sharedWith.filter((member) => member.openid !== memberOpenid);
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
