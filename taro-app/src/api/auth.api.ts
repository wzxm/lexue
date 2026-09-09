import { cloud } from './cloud';
import type { UserInfo } from '../types/index';
import cloudbase from '@cloudbase/js-sdk';
import { cloudEnv } from './cloud';

const authApp = cloudbase.init({ env: cloudEnv, region: 'ap-shanghai' });
const auth = authApp.auth();
let verificationInfo: any = null;

export interface SendSmsCodeResult {
  phone: string;
  expiresIn: number;
}

export interface LoginByPhonePayload {
  phone: string;
  smsCode: string;
  nickname?: string;
  avatarUrl?: string;
}

export async function sendSmsCode(phone: string): Promise<SendSmsCodeResult> {
  verificationInfo = await auth.getVerification({ phone_number: `+86 ${phone}` });
  return { phone: phone.slice(0, 3) + '****' + phone.slice(-4), expiresIn: 300 };
}

export async function loginByPhone(payload: LoginByPhonePayload): Promise<UserInfo> {
  if (!verificationInfo) throw new Error('请先获取短信验证码');
  await auth.signInWithSms({ verificationInfo, verificationCode: payload.smsCode, phoneNum: `+86 ${payload.phone}` });
  verificationInfo = null;
  const result = await cloud.call<UserInfo>('auth', {
    action: 'loginByPhone',
    payload: {
      phone: payload.phone,
      sms_code: payload.smsCode,
      nickname: payload.nickname,
      avatar_url: payload.avatarUrl,
    },
  });
  // 业务登录态由本地缓存维护，不依赖 CloudBase Auth 会话续期。
  await auth.signOut().catch(() => undefined);
  return result;
}

export async function logoutAuth(): Promise<void> {
  verificationInfo = null;
  await auth.signOut();
}

/** @deprecated 使用 loginByPhone */
export const loginWithPhone = loginByPhone;

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

/**
 * 保存订阅消息授权记录
 * @param templateId 订阅消息模板ID
 * @param result 授权结果（'accept' | 'reject' | 'ban'）
 */
export async function saveSubscribeAuth(templateId: string, result: 'accept' | 'reject' | 'ban'): Promise<void> {
  return cloud.call<void>('auth', {
    action: 'saveSubscribeAuth',
    payload: { templateId, result },
  });
}
