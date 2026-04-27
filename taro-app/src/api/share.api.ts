import { cloud } from './cloud';

export interface ShareCodeResult {
  code: string;
}

export interface InvitePreview {
  inviterOpenId: string;
  inviterNickname?: string;
  inviterAvatarUrl?: string;
  studentCount: number;
  scheduleCount: number;
  students: Array<{
    studentId: string;
    studentName: string;
    scheduleCount: number;
  }>;
}

export interface AcceptInviteResult {
  inviterOpenId: string;
  scheduleIds: string[];
  joinedCount: number;
  permission: string;
}

interface BackendInvitePreview {
  inviter_openid?: string;
  inviter_nickname?: string;
  inviter_avatar_url?: string;
  student_count?: number;
  schedule_count?: number;
  students?: Array<{ student_id: string; student_name: string; schedule_count?: number }>;
}

interface BackendAcceptInviteResult {
  inviter_openid?: string;
  schedule_ids?: string[];
  joined_count?: number;
  permission?: string;
}

export async function generateCode(scheduleId: string): Promise<ShareCodeResult> {
  return cloud.call<ShareCodeResult>('share', { action: 'generateCode', payload: { scheduleId } });
}

export async function verifyCode(code: string): Promise<InviteCodePreview> {
  const data = await cloud.call<any>('share', { action: 'verifyCode', payload: { code } });
  return {
    scheduleId: data.schedule_id,
    scheduleName: data.schedule_name,
    semester: data.semester || '',
  };
}

export async function acceptCode(code: string): Promise<void> {
  return cloud.call<void>('share', { action: 'acceptCode', payload: { code } });
}

export async function verifyInvite(inviterOpenId: string): Promise<InvitePreview> {
  const data = await cloud.call<BackendInvitePreview>('share', {
    action: 'verifyInvite',
    payload: { inviterOpenId },
  });
  return {
    inviterOpenId: data.inviter_openid || '',
    inviterNickname: data.inviter_nickname || '',
    inviterAvatarUrl: data.inviter_avatar_url || '',
    studentCount: data.student_count || 0,
    scheduleCount: data.schedule_count || 0,
    students: (data.students || []).map((student) => ({
      studentId: student.student_id,
      studentName: student.student_name,
      scheduleCount: student.schedule_count || 0,
    })),
  };
}

export async function acceptInvite(inviterOpenId: string): Promise<AcceptInviteResult> {
  const data = await cloud.call<BackendAcceptInviteResult>('share', {
    action: 'acceptInvite',
    payload: { inviterOpenId },
  });
  return {
    inviterOpenId: data.inviter_openid || '',
    scheduleIds: data.schedule_ids || [],
    joinedCount: data.joined_count || 0,
    permission: data.permission || 'edit',
  };
}

export interface InviteCodePreview {
  scheduleId: string;
  scheduleName: string;
  semester: string;
}

export async function verifyInviteCode(code: string): Promise<InviteCodePreview> {
  const data = await cloud.call<any>('share', { action: 'verifyInviteCode', payload: { code } });
  return {
    scheduleId: data.schedule_id,
    scheduleName: data.schedule_name,
    semester: data.semester || '',
  };
}

export async function copyByInviteCode(code: string): Promise<any> {
  return cloud.call<any>('share', { action: 'copyByInviteCode', payload: { code } });
}
