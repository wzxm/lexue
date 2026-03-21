import { cloud } from './cloud';
import type { UserInfo } from '../types/index';

export async function login(): Promise<UserInfo> {
  return cloud.call<UserInfo>('auth', { action: 'login', payload: {} });
}

export async function getProfile(): Promise<UserInfo> {
  return cloud.call<UserInfo>('auth', { action: 'getProfile', payload: {} });
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
