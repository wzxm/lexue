/**
 * 当前用户可见的学生列表（自有 + 家庭/共享课表）
 */

const db = require('./db');

const IN_BATCH_SIZE = 100;

function attachSharedOwnerInfo(student, ownerUserMap) {
  const ownerUserId = student.owner_user_id || '';
  const owner = ownerUserMap[ownerUserId] || {};
  return {
    ...student,
    is_shared: true,
    shared_from_user_id: ownerUserId,
    shared_from_nickname: owner.nickname || '',
    shared_from_avatar_url: owner.avatar_url || '',
  };
}

async function getStudentsByIds(ids) {
  if (!ids.length) return [];
  const _ = db.getCommand();
  const results = [];
  for (let i = 0; i < ids.length; i += IN_BATCH_SIZE) {
    const batch = ids.slice(i, i + IN_BATCH_SIZE);
    const chunk = await db.getList('students', { _id: _.in(batch) });
    results.push(...chunk);
  }
  return results;
}

/**
 * @returns {Promise<Array>} 学生文档（含 id、is_shared 等字段，不含 success 包装）
 */
async function listVisibleStudents(userId) {
  const _ = db.getCommand();

  const [ownStudents, familyRelations, sharedSchedules] = await Promise.all([
    db.getList('students', { owner_user_id: userId }, {
      orderBy: { field: 'createTime', direction: 'desc' },
    }),
    db.getList('families', { member_user_id: userId }),
    db.getList('schedules', {
      shared_with: _.elemMatch({ user_id: userId }),
      owner_user_id: _.neq(userId),
    }),
  ]);

  const familyOwnerUserIds = Array.from(
    new Set(familyRelations.map((item) => item.owner_user_id).filter(Boolean)),
  );

  const sharedStudentIdSet = new Set();
  const sharedStudentOwnerMap = new Map();

  if (familyOwnerUserIds.length > 0) {
    const familyStudents = await db.getList('students', { owner_user_id: _.in(familyOwnerUserIds) });
    for (const student of familyStudents) {
      sharedStudentIdSet.add(student._id);
      if (student._id && student.owner_user_id) {
        sharedStudentOwnerMap.set(student._id, student.owner_user_id);
      }
    }
  }

  for (const sch of sharedSchedules) {
    if (sch.student_id) {
      sharedStudentIdSet.add(sch.student_id);
      if (sch.owner_user_id && !sharedStudentOwnerMap.has(sch.student_id)) {
        sharedStudentOwnerMap.set(sch.student_id, sch.owner_user_id);
      }
    }
  }

  const sharedIds = Array.from(sharedStudentIdSet);
  const sharedRaw = await getStudentsByIds(sharedIds);

  const sharedStudents = sharedRaw.map((st) => {
    const sid = st._id;
    const fallbackOwner = sharedStudentOwnerMap.get(sid) || '';
    return {
      ...st,
      owner_user_id: st.owner_user_id || fallbackOwner,
      is_shared: true,
    };
  });

  const sharedOwnerUserIds = Array.from(
    new Set(sharedStudents.map((s) => s.owner_user_id).filter(Boolean)),
  );
  const ownerUsers = sharedOwnerUserIds.length > 0
    ? await db.getList('users', { _id: _.in(sharedOwnerUserIds) })
    : [];
  const ownerUserMap = {};
  ownerUsers.forEach((user) => { ownerUserMap[user._id] = user; });

  return [
    ...ownStudents.map((s) => ({ ...s, id: s._id, is_shared: false })),
    ...sharedStudents.map((s) => attachSharedOwnerInfo({ ...s, id: s._id }, ownerUserMap)),
  ];
}

module.exports = {
  listVisibleStudents,
};
