import React from 'react';
import { usePermission, type PermissionField } from '@/hooks/usePermission';

interface RoleGuardProps {
  /** Permission field to check */
  field: PermissionField;
  /** What to render when denied */
  fallback?: React.ReactNode;   // default: null (hide element)
  /** Render in read-only mode instead of hiding (wrap children in a div with pointer-events:none + opacity:0.5) */
  readOnlyFallback?: boolean;
  children: React.ReactNode;
}

/**
 * RoleGuard Component
 * 
 * Usage examples:
 * <RoleGuard field="profit">¥{result.profit.toFixed(2)}</RoleGuard>
 * <RoleGuard field="bomEdit" readOnlyFallback>...editable BOM...</RoleGuard>
 * <RoleGuard field="costRates" fallback={<Text type="tertiary">无权限</Text>}>...admin panel...</RoleGuard>
 */
export const RoleGuard: React.FC<RoleGuardProps> = ({
  field,
  fallback = null,
  readOnlyFallback = false,
  children,
}) => {
  const { can } = usePermission();

  if (can(field)) {
    return <>{children}</>;
  }

  if (readOnlyFallback) {
    return (
      <div style={{ pointerEvents: 'none', opacity: 0.5 }} aria-disabled="true">
        {children}
      </div>
    );
  }

  return <>{fallback}</>;
};

export default RoleGuard;
