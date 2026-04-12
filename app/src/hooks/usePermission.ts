import { useAuthStore } from '@/store/authStore';

export type UserRole = 'ADMIN' | 'MANAGER' | 'ENGINEER' | 'VIEWER';

// Role hierarchy: higher number = more privilege
const ROLE_LEVEL: Record<UserRole, number> = {
  VIEWER: 0,
  ENGINEER: 1,
  MANAGER: 2,
  ADMIN: 3,
};

// Permission fields mapped to minimum required role
export type PermissionField = 
  | 'profit'           // 利润 — MANAGER+
  | 'profitRate'       // 利润率 — MANAGER+  
  | 'mgmtFee'         // 管理费 — MANAGER+
  | 'mgmtRate'         // 管理费率 — MANAGER+
  | 'costRates'        // 成本费率配置 — ADMIN only
  | 'metalPrice'       // 金属价格 — ENGINEER+
  | 'internalCost'     // 内部核算 — MANAGER+
  | 'bomEdit'          // BOM编辑 — ENGINEER+
  | 'quoteExport'      // 报价导出 — ENGINEER+
  | 'simulation'       // 模拟参数 — ENGINEER+
  | 'changeExport'     // 设变导出 — ENGINEER+
  | 'versionLock'      // 版本锁定 — MANAGER+
  | 'auditLog'         // 审计日志 — MANAGER+
  | 'auditPublish'     // 审计发布 — ADMIN only (张滔滔专用)
  | 'deleteProject'    // 删除项目 — ADMIN only
  | 'deleteHarness'    // 删除线束 — MANAGER+
  ;

const FIELD_MIN_ROLE: Record<PermissionField, UserRole> = {
  profit: 'MANAGER',
  profitRate: 'MANAGER',
  mgmtFee: 'MANAGER',
  mgmtRate: 'MANAGER',
  costRates: 'ADMIN',
  metalPrice: 'ENGINEER',
  internalCost: 'MANAGER',
  bomEdit: 'ENGINEER',
  quoteExport: 'ENGINEER',
  simulation: 'ENGINEER',
  changeExport: 'ENGINEER',
  versionLock: 'MANAGER',
  auditLog: 'MANAGER',
  auditPublish: 'ADMIN',
  deleteProject: 'ADMIN',
  deleteHarness: 'MANAGER',
};

export function hasPermission(userRole: UserRole | string | undefined | null, field: PermissionField): boolean {
  // Offline mode (no auth) = full access
  if (!userRole) return true;
  const level = ROLE_LEVEL[userRole as UserRole];
  if (level === undefined) return true; // unknown role = full access (safe default for offline)
  const required = ROLE_LEVEL[FIELD_MIN_ROLE[field]];
  return level >= required;
}

// React hook
export function usePermission(): {
  can: (field: PermissionField) => boolean;
  role: UserRole | null;
  isOffline: boolean;
} {
  const { user, isAuthenticated } = useAuthStore();
  const role = user?.role as UserRole | null;
  const isOffline = !isAuthenticated;

  const can = (field: PermissionField) => hasPermission(role, field);

  return { can, role, isOffline };
}
