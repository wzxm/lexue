import type { Schedule, Student } from '../types/index';

// 本地缓存封装
// 老王注：key 要加前缀，别污染全局缓存，这个SB问题我见过太多次了
const PREFIX = 'lexue_';

function setItem(key: string, value: unknown): void {
  try {
    wx.setStorageSync(PREFIX + key, value);
  } catch (e) {
    console.error('[storage] setItem error', e);
  }
}

function getItem<T>(key: string): T | null {
  try {
    return wx.getStorageSync(PREFIX + key) || null;
  } catch (e) {
    console.error('[storage] getItem error', e);
    return null;
  }
}

function removeItem(key: string): void {
  try {
    wx.removeStorageSync(PREFIX + key);
  } catch (e) {
    console.error('[storage] removeItem error', e);
  }
}

// 课表缓存
export function saveSchedule(id: string, data: Schedule): void {
  setItem(`schedule_${id}`, data);
}

export function loadSchedule(id: string): Schedule | null {
  return getItem<Schedule>(`schedule_${id}`);
}

export function removeSchedule(id: string): void {
  removeItem(`schedule_${id}`);
}

// 学生列表缓存
export function saveStudents(data: Student[]): void {
  setItem('students', data);
}

export function loadStudents(): Student[] {
  return getItem<Student[]>('students') || [];
}

// 登录态缓存
export function saveOpenId(openId: string): void {
  setItem('openId', openId);
}

export function loadOpenId(): string | null {
  return getItem<string>('openId');
}

export function clearOpenId(): void {
  removeItem('openId');
}

// 当前学生 ID
export function saveCurrentStudentId(id: string): void {
  setItem('currentStudentId', id);
}

export function loadCurrentStudentId(): string | null {
  return getItem<string>('currentStudentId');
}
