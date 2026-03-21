import type { FamilyRole } from '../types/index';

// 权限工具
// owner > editor > viewer，别搞复杂，就这三级

const ROLE_LEVEL: Record<FamilyRole, number> = {
  owner: 3,
  editor: 2,
  viewer: 1,
};

/** 是否有编辑权限（owner 或 editor） */
export function canEdit(role: FamilyRole): boolean {
  return ROLE_LEVEL[role] >= ROLE_LEVEL.editor;
}

/** 是否是 owner */
export function isOwner(role: FamilyRole): boolean {
  return role === 'owner';
}

/** 权限名称显示 */
export function getRoleLabel(role: FamilyRole): string {
  const labels: Record<FamilyRole, string> = {
    owner: '创建者',
    editor: '可编辑',
    viewer: '仅查看',
  };
  return labels[role];
}
