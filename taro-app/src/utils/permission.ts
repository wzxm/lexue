import type { FamilyRole } from '../types/index';

// 权限工具
// owner > edit > view，FamilyRole 类型已修正对齐
const ROLE_LEVEL: Record<FamilyRole, number> = {
  owner: 3,
  edit: 2,
  view: 1,
};

/** 是否有编辑权限（owner 或 edit） */
export function canEdit(role: FamilyRole): boolean {
  return ROLE_LEVEL[role] >= ROLE_LEVEL.edit;
}

/** 是否是 owner */
export function isOwner(role: FamilyRole): boolean {
  return role === 'owner';
}

/** 权限名称显示 */
export function getRoleLabel(role: FamilyRole): string {
  const labels: Record<FamilyRole, string> = {
    owner: '创建者',
    edit: '可编辑',
    view: '仅查看',
  };
  return labels[role];
}
