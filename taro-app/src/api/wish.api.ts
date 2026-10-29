import { cloud } from './cloud';
import type {
  WishAccount,
  WishQuickItem,
  WishTransaction,
  WishHomeData,
  WishMonthCalendar,
  WishTransactionType,
} from '../types/index';

// ========== 引导提示 ==========

export async function getIntroState(): Promise<{ seen: boolean }> {
  return cloud.call('wish', { action: 'getIntroState' });
}

export async function markIntroSeen(): Promise<void> {
  return cloud.call('wish', { action: 'markIntroSeen' });
}

// ========== 账户初始化 ==========

export async function ensureAccount(studentId: string): Promise<WishAccount> {
  const result = await cloud.call<{ account_id: string; balance: number; version: number }>(
    'wish',
    { action: 'ensureAccount', payload: { studentId } }
  );
  return {
    accountId: result.account_id,
    balance: result.balance,
    version: result.version,
  };
}

// ========== 主页数据 ==========

export async function getHome(
  studentId: string,
  date?: string,
  yearMonth?: string
): Promise<WishHomeData> {
  const result = await cloud.call<{
    balance: number;
    version: number;
    month_earn: number;
    month_spend: number;
    day_items: Array<{
      transaction_id: string;
      type: WishTransactionType;
      amount: number;
      reason: string;
      operator_name?: string;
      created_at: string | Date;
    }>;
  }>('wish', { action: 'getHome', payload: { studentId, date, yearMonth } });

  return {
    balance: result.balance,
    version: result.version,
    monthEarn: result.month_earn,
    monthSpend: result.month_spend,
    dayItems: result.day_items.map(item => ({
      transactionId: item.transaction_id,
      type: item.type,
      amount: item.amount,
      reason: item.reason,
      operatorName: item.operator_name,
      createdAt: typeof item.created_at === 'string' ? new Date(item.created_at) : item.created_at,
    })),
  };
}

// ========== 添加交易 ==========

export async function addTransaction(
  studentId: string,
  type: WishTransactionType,
  amount: number,
  reason: string,
  requestId: string
): Promise<{ transactionId: string; balance: number | null }> {
  const result = await cloud.call<{ transaction_id: string; balance: number | null }>(
    'wish',
    { action: 'addTransaction', payload: { studentId, type, amount, reason, requestId } }
  );
  return {
    transactionId: result.transaction_id,
    balance: result.balance,
  };
}

// ========== 交易明细 ==========

export async function listTransactions(
  studentId: string,
  type?: WishTransactionType,
  pageSize = 50,
  cursor?: string
): Promise<{ items: WishTransaction[]; nextCursor: string | null; hasMore: boolean }> {
  const result = await cloud.call<{
    items: Array<{
      transaction_id: string;
      type: WishTransactionType;
      amount: number;
      reason: string;
      operator_name?: string;
      operator_avatar?: string;
      created_at: string | Date;
    }>;
    next_cursor: string | null;
    has_more: boolean;
  }>('wish', { action: 'listTransactions', payload: { studentId, type, pageSize, cursor } });

  return {
    items: result.items.map(item => ({
      transactionId: item.transaction_id,
      type: item.type,
      amount: item.amount,
      reason: item.reason,
      operatorName: item.operator_name,
      operatorAvatar: item.operator_avatar,
      createdAt: typeof item.created_at === 'string' ? new Date(item.created_at) : item.created_at,
    })),
    nextCursor: result.next_cursor,
    hasMore: result.has_more,
  };
}

// ========== 月历视图 ==========

export async function getMonthCalendar(
  studentId: string,
  yearMonth: string
): Promise<WishMonthCalendar> {
  return cloud.call('wish', { action: 'getMonthCalendar', payload: { studentId, yearMonth } });
}

// ========== 快捷项管理 ==========

export async function listQuickItems(studentId: string): Promise<WishQuickItem[]> {
  const result = await cloud.call<{
    items: Array<{
      id: string;
      type: WishTransactionType;
      name: string;
      amount: number;
      sort_order: number;
    }>;
  }>('wish', { action: 'listQuickItems', payload: { studentId } });

  return result.items.map(item => ({
    id: item.id,
    type: item.type,
    name: item.name,
    amount: item.amount,
    sortOrder: item.sort_order,
  }));
}

export async function saveQuickItems(studentId: string, items: WishQuickItem[]): Promise<void> {
  const payload = {
    studentId,
    items: items.map(item => ({
      type: item.type,
      name: item.name,
      amount: item.amount,
    })),
  };
  return cloud.call('wish', { action: 'saveQuickItems', payload });
}
