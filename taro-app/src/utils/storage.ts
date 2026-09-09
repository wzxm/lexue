import Taro from '@tarojs/taro'
import type { Schedule, Student, UserInfo } from '../types/index';

// 本地缓存封装 — wx.* 全部换成 Taro.*
const PREFIX = 'lexue_';

function setItem(key: string, value: unknown): void {
  try {
    Taro.setStorageSync(PREFIX + key, value);
  } catch (e) {
    console.error('[storage] setItem error', e);
  }
}

function getItem<T>(key: string): T | null {
  try {
    return Taro.getStorageSync(PREFIX + key) || null;
  } catch (e) {
    console.error('[storage] getItem error', e);
    return null;
  }
}

function removeItem(key: string): void {
  try {
    Taro.removeStorageSync(PREFIX + key);
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

// 登录态缓存（以稳定 userId 为准）
export function saveUserId(userId: string): void {
  setItem('userId', userId);
}

export function loadUserId(): string | null {
  return getItem<string>('userId');
}

export function clearUserId(): void {
  removeItem('userId');
}

/** @deprecated 仅保留微信 OPENID 缓存，不作为登录判据 */
export function saveOpenId(openId: string): void {
  setItem('openId', openId);
}

/** @deprecated */
export function loadOpenId(): string | null {
  return getItem<string>('openId');
}

/** @deprecated */
export function clearOpenId(): void {
  removeItem('openId');
}

export function saveUserInfo(info: UserInfo): void {
  setItem('userInfo', info);
}

export function loadUserInfo(): UserInfo | null {
  return getItem<UserInfo>('userInfo');
}

export function clearUserInfo(): void {
  removeItem('userInfo');
}

export function saveLoginFlag(loggedIn: boolean): void {
  setItem('isLoggedIn', loggedIn);
}

export function loadLoginFlag(): boolean {
  return !!getItem<boolean>('isLoggedIn');
}

export function clearLoginFlag(): void {
  removeItem('isLoggedIn');
}

// 短信验证码倒计时恢复
export function saveSmsCooldownUntil(untilMs: number): void {
  setItem('smsCooldownUntil', untilMs);
}

export function loadSmsCooldownUntil(): number | null {
  return getItem<number>('smsCooldownUntil');
}

export function clearSmsCooldownUntil(): void {
  removeItem('smsCooldownUntil');
}

// 当前学生 ID
export function saveCurrentStudentId(id: string): void {
  setItem('currentStudentId', id);
}

export function loadCurrentStudentId(): string | null {
  return getItem<string>('currentStudentId');
}
