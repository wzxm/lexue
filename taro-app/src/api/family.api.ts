import { cloud } from './cloud';

export type FamilyPermission = 'edit';

export interface MemberInfo {
  openid: string;
  permission: 'owner' | FamilyPermission;
  is_owner: boolean;
  nickname: string;
  avatar_url: string;
  join_time?: number;
}

export async function listMembers(): Promise<MemberInfo[]> {
  return cloud.call<MemberInfo[]>('family', { action: 'listMembers', payload: {} });
}

export async function removeMember(targetOpenid: string): Promise<void> {
  return cloud.call<void>('family', { action: 'removeMember', payload: { targetOpenid } });
}

export async function leave(ownerOpenid: string): Promise<void> {
  return cloud.call<void>('family', { action: 'leave', payload: { ownerOpenid } });
}
