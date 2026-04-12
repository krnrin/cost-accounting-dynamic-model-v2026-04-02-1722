/**
 * C1: RBAC 权限控制
 * 前端角色权限矩阵，用于 UI 层权限控制
 */

export type Role = 'admin' | 'cost_engineer' | 'viewer' | 'customer';

export interface Permission {
  resource: string;
  actions: Array<'read' | 'write' | 'delete' | 'export' | 'approve'>;
}

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  admin: [
    { resource: '*', actions: ['read', 'write', 'delete', 'export', 'approve'] },
  ],
  cost_engineer: [
    { resource: 'project', actions: ['read', 'write'] },
    { resource: 'scenario', actions: ['read', 'write'] },
    { resource: 'bom', actions: ['read', 'write'] },
    { resource: 'pricing', actions: ['read', 'write', 'export'] },
    { resource: 'settings', actions: ['read'] },
    { resource: 'report', actions: ['read', 'export'] },
  ],
  viewer: [
    { resource: 'project', actions: ['read'] },
    { resource: 'scenario', actions: ['read'] },
    { resource: 'bom', actions: ['read'] },
    { resource: 'pricing', actions: ['read'] },
    { resource: 'report', actions: ['read'] },
  ],
  customer: [
    { resource: 'pricing', actions: ['read'] },
    { resource: 'report', actions: ['read'] },
  ],
};

export function hasPermission(role: Role, resource: string, action: string): boolean {
  const perms = ROLE_PERMISSIONS[role];
  return perms.some(p =>
    (p.resource === '*' || p.resource === resource) &&
    p.actions.includes(action as any)
  );
}

export function checkAccess(role: Role, resource: string, action: string): void {
  if (!hasPermission(role, resource, action)) {
    throw new Error(`权限不足: 角色 ${role} 无法对 ${resource} 执行 ${action}`);
  }
}
