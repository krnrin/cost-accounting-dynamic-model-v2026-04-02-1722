/**
 * [PR-010] 路由级角色守卫
 *
 * 在路由表层按角色矩阵集中卡控，替代分散在各个页面的权限检查。
 * 使用方式：
 * <Route path="/manager" element={<RoleRouteGuard minRole="MANAGER"><ManagerDashboardPage /></RoleRouteGuard>} />
 */

import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import type { UserRole } from '@/hooks/usePermission';

// Role hierarchy: higher number = more privilege
const ROLE_LEVEL: Record<UserRole, number> = {
  VIEWER: 0,
  ENGINEER: 1,
  MANAGER: 2,
  ADMIN: 3,
};

interface RoleRouteGuardProps {
  /** Minimum required role to access this route */
  minRole?: UserRole;
  /** Specific roles allowed (overrides minRole if provided) */
  allowedRoles?: UserRole[];
  /** Element to render when access denied (default: redirect to home) */
  fallback?: React.ReactNode;
  /** Children to render if authorized */
  children: React.ReactNode;
}

/**
 * RoleRouteGuard Component
 *
 * Wraps route elements to enforce role-based access control at the routing layer.
 * If the user doesn't have sufficient permissions, they are redirected to home
 * or shown a custom fallback element.
 *
 * Usage examples:
 * // Require MANAGER or above
 * <Route path="/manager" element={<RoleRouteGuard minRole="MANAGER"><ManagerPage /></RoleRouteGuard>} />
 *
 * // Require specific roles
 * <Route path="/admin" element={<RoleRouteGuard allowedRoles={['ADMIN']}><AdminPage /></RoleRouteGuard>} />
 *
 * // Custom fallback for unauthorized users
 * <Route path="/settings" element={<RoleRouteGuard minRole="ENGINEER" fallback={<NoPermissionPage />}><SettingsPage /></RoleRouteGuard>} />
 */
export const RoleRouteGuard: React.FC<RoleRouteGuardProps> = ({
  minRole,
  allowedRoles,
  fallback,
  children,
}) => {
  const { user, isAuthenticated } = useAuthStore();
  const location = useLocation();

  // Offline mode (no auth) = full access
  if (!isAuthenticated || !user) {
    return <>{children}</>;
  }

  const userRole = user.role as UserRole;
  const userLevel = ROLE_LEVEL[userRole] ?? 0;

  // Check allowed roles first (if specified)
  if (allowedRoles && allowedRoles.length > 0) {
    if (!allowedRoles.includes(userRole)) {
      if (fallback) return <>{fallback}</>;
      return <Navigate to="/" state={{ from: location }} replace />;
    }
    return <>{children}</>;
  }

  // Check minimum role level
  if (minRole) {
    const requiredLevel = ROLE_LEVEL[minRole];
    if (userLevel < requiredLevel) {
      if (fallback) return <>{fallback}</>;
      return <Navigate to="/" state={{ from: location }} replace />;
    }
  }

  return <>{children}</>;
};

export default RoleRouteGuard;
