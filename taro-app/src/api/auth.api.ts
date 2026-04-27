import { cloud } from './cloud';
import type { UserInfo } from '../types/index';

export interface LoginPayload {
  nickname?: string;
  avatarUrl?: string;
}

export async function login(payload: LoginPayload = {}): Promise<UserInfo> {
  return cloud.call<UserInfo>('auth', {
    action: 'login',
    payload: {
      nickname: payload.nickname,
      avatar_url: payload.avatarUrl,
    },
  });
}

export async function getProfile(): Promise<UserInfo> {
  return cloud.call<UserInfo>('auth', { action: 'getProfile', payload: {} });
}

/** 设置页专用：课表数、家人数、通知是否有开启项（单次请求） */
export interface SettingsSummary {
  scheduleCount: number;
  studentCount: number;
  familyMemberCount: number;
  notifyAnyEnabled: boolean;
}

export async function getSettingsSummary(): Promise<SettingsSummary> {
  return cloud.call<SettingsSummary>('auth', { action: 'getSettingsSummary', payload: {} });
}

export async function updateProfile(data: { nickname?: string; avatarUrl?: string }): Promise<UserInfo> {
  return cloud.call<UserInfo>('auth', {
    action: 'updateProfile',
    payload: {
      nickname: data.nickname,
      avatar_url: data.avatarUrl,
    },
  });
}

export async function updateDisplaySettings(data: { hideWeekend: boolean }): Promise<void> {
  return cloud.call<void>('auth', {
    action: 'updateDisplaySettings',
    payload: { hide_weekend: data.hideWeekend },
  });
}
