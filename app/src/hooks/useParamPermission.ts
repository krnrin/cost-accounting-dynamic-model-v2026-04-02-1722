/**
 * useParamPermission Hook (C25 — Issue #71)
 * 
 * React Hook for parameter permission checking + export template
 */

import { useState, useCallback, useMemo } from 'react';
import {
  checkPermission,
  batchCheckPermissions,
  generateExportTemplate,
  applyExportMasking,
  getAccessibleFields,
  type UserRole,
  type PermissionAction,
  type PermissionCheckResult,
  type ExportTemplate,
  type FieldPermission,
} from '@/engine/param_permission';

export interface UseParamPermissionReturn {
  currentRole: UserRole;
  setRole: (role: UserRole) => void;

  // Permission checking
  can: (fieldId: string, action: PermissionAction) => boolean;
  canBatch: (fieldIds: string[], action: PermissionAction) => { allAllowed: boolean; deniedFields: string[] };
  accessibleFields: FieldPermission[];

  // Export
  exportTemplate: ExportTemplate | null;
  generateTemplate: (format?: ExportTemplate['format'], name?: string) => ExportTemplate;
  maskData: (data: Record<string, number | string>) => Record<string, number | string | null>;
}

export function useParamPermission(
  initialRole: UserRole = 'viewer',
): UseParamPermissionReturn {
  const [currentRole, setRole] = useState<UserRole>(initialRole);
  const [exportTemplate, setExportTemplate] = useState<ExportTemplate | null>(null);

  const can = useCallback((fieldId: string, action: PermissionAction): boolean => {
    return checkPermission(fieldId, action, currentRole).allowed;
  }, [currentRole]);

  const canBatch = useCallback((fieldIds: string[], action: PermissionAction) => {
    const result = batchCheckPermissions(fieldIds, action, currentRole);
    return { allAllowed: result.allAllowed, deniedFields: result.deniedFields };
  }, [currentRole]);

  const accessibleFields = useMemo(
    () => getAccessibleFields(currentRole),
    [currentRole],
  );

  const generateTemplate = useCallback((format: ExportTemplate['format'] = 'xlsx', name: string = ''): ExportTemplate => {
    const template = generateExportTemplate(currentRole, format, name);
    setExportTemplate(template);
    return template;
  }, [currentRole]);

  const maskData = useCallback((data: Record<string, number | string>): Record<string, number | string | null> => {
    if (!exportTemplate) {
      const template = generateExportTemplate(currentRole);
      return applyExportMasking(data, template);
    }
    return applyExportMasking(data, exportTemplate);
  }, [currentRole, exportTemplate]);

  return { currentRole, setRole, can, canBatch, accessibleFields, exportTemplate, generateTemplate, maskData };
}

export default useParamPermission;
