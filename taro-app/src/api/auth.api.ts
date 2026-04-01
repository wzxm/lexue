import { cloud } from './cloud';
import type { UserInfo } from '../types/index';

export async function login(): Promise<UserInfo> {
  return cloud.call<UserInfo>('auth', { action: 'login', payload: {} });
}

export async function getProfile(): Promise<UserInfo> {
  return cloud.call<UserInfo>('auth', { action: 'getProfile', payload: {} });
}

/** 设置页专用：课表数、家人数、通知是否有开启项（单次请求） */
export interface SettingsSummary {
  scheduleCount: number;
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
