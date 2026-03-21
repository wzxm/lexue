import { cloud } from './cloud';
import type { UserInfo } from '../types/index';

export async function login(): Promise<UserInfo> {
  return cloud.call<UserInfo>('auth', { action: 'login', payload: {} });
}

export async function getProfile(): Promise<UserInfo> {
  return cloud.call<UserInfo>('auth', { action: 'getProfile', payload: {} });
}

// 更新用户资料（昵称、头像）
// 注意：后端字段用 snake_case，此处做映射
export async function updateProfile(data: { nickname?: string; avatarUrl?: string }): Promise<UserInfo> {
  return cloud.call<UserInfo>('auth', {
    action: 'updateProfile',
    payload: {
      nickname: data.nickname,
      avatar_url: data.avatarUrl,
    },
  });
}
