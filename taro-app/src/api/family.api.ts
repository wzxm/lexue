import { cloud } from './cloud';

export type FamilyPermission = 'edit';

export interface MemberInfo {
  userId: string;
  permission: 'owner' | FamilyPermission;
  is_owner: boolean;
  relation_type?: 'outgoing' | 'incoming';
  nickname: string;
  avatar_url: string;
  join_time?: number;
}

export async function listMembers(): Promise<MemberInfo[]> {
  return cloud.call<MemberInfo[]>('family', { action: 'listMembers', payload: {} });
}

export async function removeMember(targetUserId: string): Promise<void> {
  return cloud.call<void>('family', { action: 'removeMember', payload: { targetUserId } });
}

export async function leave(ownerUserId: string): Promise<void> {
  return cloud.call<void>('family', { action: 'leave', payload: { ownerUserId } });
}
