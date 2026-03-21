import { cloud } from './cloud';

export interface ShareCodeResult {
  code: string;
  expiresAt: number;
}

export interface InviteResult {
  inviteUrl: string;
  expiresAt: number;
}

export interface ShareCodePreview {
  scheduleId: string;
  scheduleName: string;
  studentName: string;
}

export interface InvitePreview {
  scheduleId: string;
  scheduleName: string;
  studentName: string;
}

// 生成课表口令（6位，7天有效）
export async function generateCode(scheduleId: string): Promise<ShareCodeResult> {
  return cloud.call<ShareCodeResult>('share', { action: 'generateCode', payload: { scheduleId } });
}

export async function verifyCode(code: string): Promise<ShareCodePreview> {
  return cloud.call<ShareCodePreview>('share', { action: 'verifyCode', payload: { code } });
}

export async function acceptCode(code: string): Promise<void> {
  return cloud.call<void>('share', { action: 'acceptCode', payload: { code } });
}

// 家人邀请链接
export async function generateInvite(scheduleId: string): Promise<InviteResult> {
  return cloud.call<InviteResult>('share', { action: 'generateInvite', payload: { scheduleId } });
}

export async function verifyInvite(token: string): Promise<InvitePreview> {
  return cloud.call<InvitePreview>('share', { action: 'verifyInvite', payload: { token } });
}

export async function acceptInvite(token: string): Promise<void> {
  return cloud.call<void>('share', { action: 'acceptInvite', payload: { token } });
}
