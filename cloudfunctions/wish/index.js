/**
 * wish 云函数 - 小星愿（星愿币管理）
 * 账户级功能，每个学生一个星愿账户，家庭成员共同管理
 */

const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = require('../../shared/db');
const { ERRORS, success, fail } = require('../../shared/errors');
const { resolveCurrentUser } = require('../../shared/auth');
const { isFamilyMember } = require('../../shared/family');
const { listVisibleStudents } = require('../../shared/students');
const validator = require('../../shared/validator');
const logger = require('../../shared/logger');

const FN = 'wish';

// 默认快捷项（仅在首次 ensureAccount 时创建）
const DEFAULT_EARN_ITEMS = [
  { name: '洗碗筷', amount: 5 },
  { name: '拖地', amount: 5 },
  { name: '叠衣服', amount: 3 },
  { name: '收拾书本玩具', amount: 2 },
  { name: '吃饭认真', amount: 1 },
  { name: '认真刷牙', amount: 1 },
  { name: '检查书包文具', amount: 1 },
];

const DEFAULT_SPEND_ITEMS = [
  { name: '吃零食', amount: 3 },
  { name: '看电视', amount: 5 },
  { name: '游乐场', amount: 5 },
  { name: '出外旅游', amount: 20 },
];

// ========== 权限辅助 ==========

async function checkStudentWritable(userId, studentId) {
  const student = await db.getOne('students', studentId);
  if (!student) return { ok: false, error: fail(ERRORS.NOT_FOUND, '学生不存在') };

  const canWrite = student.owner_user_id === userId || await isFamilyMember(student.owner_user_id, userId);
  if (!canWrite) return { ok: false, error: fail(ERRORS.FORBIDDEN, '没有操作权限') };

  return { ok: true, student };
}

async function checkStudentReadable(userId, studentId) {
  const visibleStudents = await listVisibleStudents(userId);
  const student = visibleStudents.find(s => s._id === studentId || s.id === studentId);
  if (!student) return { ok: false, error: fail(ERRORS.NOT_FOUND, '学生不存在或无权访问') };

  return { ok: true, student };
}

// ========== 账户初始化 ==========

async function ensureAccount(userId, payload) {
  validator.requireFields(payload, ['studentId']);
  const { studentId } = payload;

  const check = await checkStudentWritable(userId, studentId);
  if (!check.ok) return check.error;

  logger.info(FN, 'ensureAccount', { userId, studentId });

  const existing = await db.findOne('wish_accounts', { student_id: studentId });
  if (existing) {
    return success({
      account_id: existing._id,
      balance: existing.balance || 0,
      version: existing.version || 1,
    });
  }

  // 创建账户
  const now = new Date();
  const { _id: accountId } = await db.create('wish_accounts', {
    student_id: studentId,
    balance: 0,
    version: 1,
    created_at: now,
    updated_at: now,
  });

  // 创建默认快捷项
  const quickItems = [];
  let sortOrder = 0;
  for (const item of DEFAULT_EARN_ITEMS) {
    quickItems.push({
      student_id: studentId,
      type: 'earn',
      name: item.name,
      amount: item.amount,
      sort_order: sortOrder++,
      created_at: now,
      updated_at: now,
    });
  }
  for (const item of DEFAULT_SPEND_ITEMS) {
    quickItems.push({
      student_id: studentId,
      type: 'spend',
      name: item.name,
      amount: item.amount,
      sort_order: sortOrder++,
      created_at: now,
      updated_at: now,
    });
  }

  await Promise.all(quickItems.map(item => db.create('wish_quick_items', item)));

  return success({ account_id: accountId, balance: 0, version: 1 });
}

// ========== 引导提示 ==========

async function getIntroState(userId) {
  const user = await db.getOne('users', userId);
  if (!user) return fail(ERRORS.UNAUTHORIZED, '请先登录');

  const settings = user.settings || {};
  const seen = !!settings.wish_intro_seen;

  return success({ seen });
}

async function markIntroSeen(userId) {
  const user = await db.getOne('users', userId);
  if (!user) return fail(ERRORS.UNAUTHORIZED, '请先登录');

  const settings = user.settings || {};
  settings.wish_intro_seen = true;

  await db.update('users', userId, { settings });
  logger.info(FN, 'markIntroSeen', { userId });

  return success(null);
}

// ========== 主页数据 ==========

async function getHome(userId, payload) {
  validator.requireFields(payload, ['studentId']);
  const { studentId, date, yearMonth } = payload;

  const check = await checkStudentReadable(userId, studentId);
  if (!check.ok) return check.error;

  logger.info(FN, 'getHome', { userId, studentId, date, yearMonth });

  const account = await db.findOne('wish_accounts', { student_id: studentId });
  if (!account) {
    return success({
      balance: 0,
      version: 1,
      month_earn: 0,
      month_spend: 0,
      day_items: [],
    });
  }

  const targetDate = date || new Date().toISOString().split('T')[0];
  const ym = yearMonth || targetDate.substring(0, 7);

  // 本月收支汇总
  const monthStart = new Date(`${ym}-01T00:00:00.000Z`);
  const monthEnd = new Date(monthStart);
  monthEnd.setMonth(monthEnd.getMonth() + 1);

  const _ = db.getCommand();
  const monthTxs = await db.getList('wish_transactions', {
    student_id: studentId,
    created_at: _.gte(monthStart).and(_.lt(monthEnd)),
  }, { orderBy: { field: 'created_at', direction: 'desc' } });

  let monthEarn = 0;
  let monthSpend = 0;
  for (const tx of monthTxs) {
    if (tx.type === 'earn') monthEarn += tx.amount || 0;
    if (tx.type === 'spend') monthSpend += tx.amount || 0;
  }

  // 指定日期的交易明细
  const dayStart = new Date(`${targetDate}T00:00:00.000Z`);
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);

  const dayTxs = await db.getList('wish_transactions', {
    student_id: studentId,
    created_at: _.gte(dayStart).and(_.lt(dayEnd)),
  }, { orderBy: { field: 'created_at', direction: 'desc' } });

  // 查询操作人昵称 & 家庭角色
  const operatorIds = Array.from(new Set(dayTxs.map(tx => tx.operator_user_id).filter(Boolean)));
  const operators = operatorIds.length > 0 ? await db.getList('users', { _id: _.in(operatorIds) }) : [];
  const operatorMap = {};
  operators.forEach(u => { operatorMap[u._id] = u; });

  const student = check.student;
  const ownerId = student.owner_user_id || '';
  const familyRelations = ownerId && operatorIds.length > 0
    ? await db.getList('families', { owner_user_id: ownerId, member_user_id: _.in(operatorIds) })
    : [];
  const familyRoleMap = {};
  familyRelations.forEach(rel => {
    if (rel.member_user_id) familyRoleMap[rel.member_user_id] = rel.role || '';
  });

  const dayItems = dayTxs.map(tx => {
    const opUser = operatorMap[tx.operator_user_id] || {};
    let operatorName = '家庭成员';
    if (tx.operator_user_id === ownerId) {
      operatorName = familyRoleMap[tx.operator_user_id] || opUser.nickname || '家庭成员';
    } else if (familyRoleMap[tx.operator_user_id]) {
      operatorName = familyRoleMap[tx.operator_user_id];
    } else if (opUser.nickname) {
      operatorName = opUser.nickname;
    }

    return {
      transaction_id: tx._id,
      type: tx.type,
      amount: tx.amount,
      reason: tx.reason || '',
      operator_name: operatorName,
      created_at: tx.created_at,
    };
  });

  return success({
    balance: account.balance || 0,
    version: account.version || 1,
    month_earn: monthEarn,
    month_spend: monthSpend,
    day_items: dayItems,
  });
}

// ========== 添加交易 ==========

async function addTransaction(userId, payload) {
  validator.requireFields(payload, ['studentId', 'type', 'amount', 'reason', 'requestId']);
  const { studentId, type, amount, reason, requestId } = payload;

  if (!['earn', 'spend'].includes(type)) {
    return fail(ERRORS.PARAM_ERROR, 'type 必须为 earn 或 spend');
  }
  if (!Number.isInteger(amount) || amount <= 0 || amount > 999) {
    return fail(ERRORS.PARAM_ERROR, '金额必须为 1-999 的正整数');
  }
  validator.maxLength(reason, 50, '原因');
  validator.maxLength(requestId, 64, 'requestId');

  const check = await checkStudentWritable(userId, studentId);
  if (!check.ok) return check.error;

  logger.info(FN, 'addTransaction', { userId, studentId, type, amount, reason, requestId });

  // 幂等检查
  const existing = await db.findOne('wish_transactions', { request_id: requestId });
  if (existing) {
    logger.info(FN, 'addTransaction:idempotent', { requestId });
    return success({ transaction_id: existing._id, balance: null });
  }

  // 查账户
  let account = await db.findOne('wish_accounts', { student_id: studentId });
  if (!account) {
    return fail(ERRORS.NOT_FOUND, '星愿账户不存在，请先初始化');
  }

  const currentBalance = account.balance || 0;
  let newBalance = currentBalance;

  if (type === 'earn') {
    newBalance = currentBalance + amount;
  } else {
    if (currentBalance < amount) {
      return fail(ERRORS.PARAM_ERROR, `星愿币不够啦，当前还剩 ${currentBalance} 个`, { balance: currentBalance });
    }
    newBalance = currentBalance - amount;
  }

  // 乐观锁版本号
  const currentVersion = account.version || 1;
  const newVersion = currentVersion + 1;

  // 写交易记录
  const now = new Date();
  const { _id: txId } = await db.create('wish_transactions', {
    student_id: studentId,
    type,
    amount,
    reason,
    operator_user_id: userId,
    request_id: requestId,
    created_at: now,
  });

  // 更新余额（使用 where 条件做简单版本校验）
  const updateResult = await db.updateWhere('wish_accounts', {
    _id: account._id,
    version: currentVersion,
  }, {
    balance: newBalance,
    version: newVersion,
    updated_at: now,
  });

  if (updateResult.updated === 0) {
    // 版本冲突，删除刚才的交易记录后返回最新余额
    await db.remove('wish_transactions', txId);
    const latest = await db.getOne('wish_accounts', account._id);
    return fail(ERRORS.PARAM_ERROR, '余额已变动，请重试', { balance: latest ? latest.balance : 0 });
  }

  return success({ transaction_id: txId, balance: newBalance });
}

// ========== 交易明细 ==========

async function listTransactions(userId, payload) {
  validator.requireFields(payload, ['studentId']);
  const { studentId, type, pageSize = 50, cursor } = payload;

  if (pageSize > 100) return fail(ERRORS.PARAM_ERROR, 'pageSize 不能超过 100');

  const check = await checkStudentReadable(userId, studentId);
  if (!check.ok) return check.error;

  logger.info(FN, 'listTransactions', { userId, studentId, type, pageSize, cursor });

  const _ = db.getCommand();
  let where = { student_id: studentId };
  if (type && ['earn', 'spend'].includes(type)) {
    where.type = type;
  }
  if (cursor) {
    where.created_at = _.lt(new Date(cursor));
  }

  const items = await db.getList('wish_transactions', where, {
    orderBy: { field: 'created_at', direction: 'desc' },
    limit: pageSize + 1,
  });

  const hasMore = items.length > pageSize;
  const list = hasMore ? items.slice(0, pageSize) : items;

  const nextCursor = hasMore && list.length > 0
    ? list[list.length - 1].created_at.toISOString()
    : null;

  // 查询操作人昵称 & 家庭角色 & 头像（与 getHome 口径一致）
  const operatorIds = Array.from(new Set(list.map(tx => tx.operator_user_id).filter(Boolean)));
  const operators = operatorIds.length > 0 ? await db.getList('users', { _id: _.in(operatorIds) }) : [];
  const operatorMap = {};
  operators.forEach(u => { operatorMap[u._id] = u; });

  const student = check.student;
  const ownerId = student.owner_user_id || '';
  const familyRelations = ownerId && operatorIds.length > 0
    ? await db.getList('families', { owner_user_id: ownerId, member_user_id: _.in(operatorIds) })
    : [];
  const familyRoleMap = {};
  familyRelations.forEach(rel => {
    if (rel.member_user_id) familyRoleMap[rel.member_user_id] = rel.role || '';
  });

  const result = list.map(tx => {
    const opUser = operatorMap[tx.operator_user_id] || {};
    let operatorName = '家庭成员';
    if (tx.operator_user_id === ownerId) {
      operatorName = familyRoleMap[tx.operator_user_id] || opUser.nickname || '家庭成员';
    } else if (familyRoleMap[tx.operator_user_id]) {
      operatorName = familyRoleMap[tx.operator_user_id];
    } else if (opUser.nickname) {
      operatorName = opUser.nickname;
    }

    return {
      transaction_id: tx._id,
      type: tx.type,
      amount: tx.amount,
      reason: tx.reason || '',
      operator_name: operatorName,
      operator_avatar: opUser.avatar_url || '',
      created_at: tx.created_at,
    };
  });

  return success({ items: result, next_cursor: nextCursor, has_more: hasMore });
}

// ========== 月历视图 ==========

async function getMonthCalendar(userId, payload) {
  validator.requireFields(payload, ['studentId', 'yearMonth']);
  const { studentId, yearMonth } = payload;

  if (!/^\d{4}-\d{2}$/.test(yearMonth)) {
    return fail(ERRORS.PARAM_ERROR, 'yearMonth 格式必须为 YYYY-MM');
  }

  const check = await checkStudentReadable(userId, studentId);
  if (!check.ok) return check.error;

  logger.info(FN, 'getMonthCalendar', { userId, studentId, yearMonth });

  const monthStart = new Date(`${yearMonth}-01T00:00:00.000Z`);
  const monthEnd = new Date(monthStart);
  monthEnd.setMonth(monthEnd.getMonth() + 1);

  const _ = db.getCommand();
  const txs = await db.getList('wish_transactions', {
    student_id: studentId,
    created_at: _.gte(monthStart).and(_.lt(monthEnd)),
  }, { orderBy: { field: 'created_at', direction: 'desc' } });

  const dayMap = {};
  let monthEarn = 0;
  let monthSpend = 0;

  for (const tx of txs) {
    const day = tx.created_at.toISOString().split('T')[0];
    if (!dayMap[day]) dayMap[day] = { has_earn: false, has_spend: false };
    if (tx.type === 'earn') {
      dayMap[day].has_earn = true;
      monthEarn += tx.amount || 0;
    }
    if (tx.type === 'spend') {
      dayMap[day].has_spend = true;
      monthSpend += tx.amount || 0;
    }
  }

  return success({
    month_earn: monthEarn,
    month_spend: monthSpend,
    days: dayMap,
  });
}

// ========== 快捷项管理 ==========

async function listQuickItems(userId, payload) {
  validator.requireFields(payload, ['studentId']);
  const { studentId } = payload;

  const check = await checkStudentReadable(userId, studentId);
  if (!check.ok) return check.error;

  logger.info(FN, 'listQuickItems', { userId, studentId });

  const items = await db.getList('wish_quick_items', { student_id: studentId }, {
    orderBy: { field: 'sort_order', direction: 'asc' },
  });

  const result = items.map(item => ({
    id: item._id,
    type: item.type,
    name: item.name || '',
    amount: item.amount || 0,
    sort_order: item.sort_order || 0,
  }));

  return success({ items: result });
}

async function saveQuickItems(userId, payload) {
  validator.requireFields(payload, ['studentId', 'items']);
  const { studentId, items } = payload;

  if (!Array.isArray(items)) return fail(ERRORS.PARAM_ERROR, 'items 必须为数组');
  if (items.length > 50) return fail(ERRORS.PARAM_ERROR, '快捷项不能超过 50 个');

  for (const item of items) {
    if (!item.type || !['earn', 'spend'].includes(item.type)) {
      return fail(ERRORS.PARAM_ERROR, '快捷项 type 必须为 earn 或 spend');
    }
    validator.maxLength(item.name, 20, '快捷项名称');
    if (!Number.isInteger(item.amount) || item.amount <= 0 || item.amount > 999) {
      return fail(ERRORS.PARAM_ERROR, '快捷项金额必须为 1-999 的正整数');
    }
  }

  const check = await checkStudentWritable(userId, studentId);
  if (!check.ok) return check.error;

  logger.info(FN, 'saveQuickItems', { userId, studentId, count: items.length });

  // 删除旧的
  await db.removeWhere('wish_quick_items', { student_id: studentId });

  // 写入新的
  const now = new Date();
  const newItems = items.map((item, index) => ({
    student_id: studentId,
    type: item.type,
    name: item.name,
    amount: item.amount,
    sort_order: index,
    created_at: now,
    updated_at: now,
  }));

  await Promise.all(newItems.map(item => db.create('wish_quick_items', item)));

  return success(null);
}

// ========== 入口 ==========

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();

  try {
    const { userId } = await resolveCurrentUser(wxContext);
    const { action, payload = {} } = event;

    switch (action) {
      case 'getIntroState':     return await getIntroState(userId);
      case 'markIntroSeen':     return await markIntroSeen(userId);
      case 'ensureAccount':     return await ensureAccount(userId, payload);
      case 'getHome':           return await getHome(userId, payload);
      case 'addTransaction':    return await addTransaction(userId, payload);
      case 'listTransactions':  return await listTransactions(userId, payload);
      case 'getMonthCalendar':  return await getMonthCalendar(userId, payload);
      case 'listQuickItems':    return await listQuickItems(userId, payload);
      case 'saveQuickItems':    return await saveQuickItems(userId, payload);
      default:                  return fail(ERRORS.PARAM_ERROR, `未知的 action: ${action}`);
    }
  } catch (e) {
    if (e && typeof e.code === 'number') return e;
    const detail = (e && (e.message || e.errMsg || e.errmsg)) || String(e);
    logger.error(FN, event && event.action, e);
    return fail(ERRORS.INTERNAL_ERROR, detail);
  }
};
