import { cloud } from './cloud';

export interface ShareCodeResult {
  code: string;
  expiresAt: number;
}

export interface InviteResult {
  token: string;
  expireAt?: number;
  scheduleCount?: number;
}

export interface ShareCodePreview {
  scheduleId: string;
  scheduleName: string;
  semester: string;
  studentName: string;
  studentSchool: string;
  studentGrade: string;
}

export interface InviteScheduleSummary {
  scheduleId: string;
  scheduleName: string;
  semester?: string;
}

export interface InvitePreview {
  studentId: string;
  studentName: string;
  schedules: InviteScheduleSummary[];
  inviterNickname?: string;
  inviterAvatarUrl?: string;
}

export interface AcceptInviteResult {
  studentId: string;
  scheduleIds: string[];
  joinedCount: number;
  permission: string;
}

interface BackendInvitePreview {
  student_id?: string;
  student_name?: string;
  schedules?: Array<{ schedule_id: string; schedule_name: string; semester?: string }>;
  inviter_nickname?: string;
  inviter_avatar_url?: string;
}

interface BackendAcceptInviteResult {
  student_id?: string;
  schedule_ids?: string[];
  joined_count?: number;
  permission?: string;
}

interface BackendInviteResult {
  token: string;
  expire_at?: number | string;
  schedule_count?: number;
}

export async function generateCode(scheduleId: string): Promise<ShareCodeResult> {
  return cloud.call<ShareCodeResult>('share', { action: 'generateCode', payload: { scheduleId } });
}

export async function verifyCode(code: string): Promise<ShareCodePreview> {
  const data = await cloud.call<any>('share', { action: 'verifyCode', payload: { code } });
  return {
    scheduleId: data.schedule_id,
    scheduleName: data.schedule_name,
    semester: data.semester || '',
    studentName: data.student_name,
    studentSchool: data.student_school || '',
    studentGrade: data.student_grade || '',
  };
}

export async function acceptCode(code: string): Promise<void> {
  return cloud.call<void>('share', { action: 'acceptCode', payload: { code } });
}

/**
 * 按学生维度生成邀请 token
 * 后端会自动聚合该学生名下当前用户创建的所有课表
 */
export async function generateInvite(studentId: string): Promise<InviteResult> {
  const data = await cloud.call<BackendInviteResult>('share', {
    action: 'generateInvite',
    payload: { studentId },
  });
  return {
    token: data.token,
    expireAt: data.expire_at ? new Date(data.expire_at).getTime() : undefined,
    scheduleCount: data.schedule_count,
  };
}

export async function verifyInvite(token: string): Promise<InvitePreview> {
  const data = await cloud.call<BackendInvitePreview>('share', {
    action: 'verifyInvite',
    payload: { token },
  });
  return {
    studentId: data.student_id || '',
    studentName: data.student_name || '',
    schedules: (data.schedules || []).map(s => ({
      scheduleId: s.schedule_id,
      scheduleName: s.schedule_name,
      semester: s.semester,
    })),
    inviterNickname: data.inviter_nickname || '',
    inviterAvatarUrl: data.inviter_avatar_url || '',
  };
}

export async function acceptInvite(token: string): Promise<AcceptInviteResult> {
  const data = await cloud.call<BackendAcceptInviteResult>('share', {
    action: 'acceptInvite',
    payload: { token },
  });
  return {
    studentId: data.student_id || '',
    scheduleIds: data.schedule_ids || [],
    joinedCount: data.joined_count || 0,
    permission: data.permission || 'view',
  };
}

export interface InviteCodePreview {
  scheduleId: string;
  scheduleName: string;
  semester: string;
  studentName: string;
  studentSchool: string;
  studentGrade: string;
}

export async function verifyInviteCode(code: string): Promise<InviteCodePreview> {
  const data = await cloud.call<any>('share', { action: 'verifyInviteCode', payload: { code } });
  return {
    scheduleId: data.schedule_id,
    scheduleName: data.schedule_name,
    semester: data.semester || '',
    studentName: data.student_name,
    studentSchool: data.student_school || '',
    studentGrade: data.student_grade || '',
  };
}

export async function copyByInviteCode(code: string): Promise<any> {
  return cloud.call<any>('share', { action: 'copyByInviteCode', payload: { code } });
}
