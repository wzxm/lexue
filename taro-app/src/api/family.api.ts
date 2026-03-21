import { cloud } from './cloud';

export type FamilyPermission = 'view' | 'edit';

export interface MemberInfo {
  openid: string;
  permission: 'owner' | FamilyPermission;
  is_owner: boolean;
  nickname: string;
  avatar_url: string;
  join_time?: number;
}

export async function listMembers(scheduleId: string): Promise<MemberInfo[]> {
  return cloud.call<MemberInfo[]>('family', { action: 'listMembers', payload: { scheduleId } });
}

export async function updatePermission(scheduleId: string, targetOpenid: string, permission: FamilyPermission): Promise<void> {
  return cloud.call<void>('family', { action: 'updatePermission', payload: { scheduleId, targetOpenid, permission } });
}

export async function removeMember(scheduleId: string, targetOpenid: string): Promise<void> {
  return cloud.call<void>('family', { action: 'removeMember', payload: { scheduleId, targetOpenid } });
}

export async function leave(scheduleId: string): Promise<void> {
  return cloud.call<void>('family', { action: 'leave', payload: { scheduleId } });
}
