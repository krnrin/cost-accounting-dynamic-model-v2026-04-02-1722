/**
 * Parameter Permission (C25 — Issue #71)
 * 
 * 参数权限边界 + 导出模板
 * - 角色权限矩阵: admin/cost_engineer/sales/viewer
 * - 字段级权限检查
 * - 导出时自动脱敏(利润率/管理费率等)
 */

// ─── Types ───

export type UserRole = 'admin' | 'cost_engineer' | 'sales' | 'viewer';

export type PermissionAction = 'view' | 'edit' | 'export' | 'approve';

export interface FieldPermission {
  fieldId: string;
  fieldName: string;
  category: 'rate' | 'metal' | 'bom' | 'quote' | 'nre' | 'settings';
  permissions: Record<UserRole, PermissionAction[]>;
  sensitive: boolean;  // 导出时需脱敏
}

export interface PermissionCheckResult {
  allowed: boolean;
  reason?: string;
  field: string;
  action: PermissionAction;
  role: UserRole;
}

export interface ExportTemplate {
  name: string;
  format: 'xlsx' | 'csv' | 'pdf';
  targetRole: UserRole;
  fields: ExportFieldConfig[];
  generatedAt: string;
}

export interface ExportFieldConfig {
  fieldId: string;
  fieldName: string;
  included: boolean;
  masked: boolean;
  maskRule?: 'hide' | 'round' | 'range';
}

// ─── Default Permission Matrix ───

const DEFAULT_PERMISSIONS: FieldPermission[] = [
  // Rate fields
  { fieldId: 'managementFeeRate', fieldName: '管理费率', category: 'rate', sensitive: true, permissions: { admin: ['view', 'edit', 'export', 'approve'], cost_engineer: ['view', 'edit'], sales: ['view'], viewer: [] } },
  { fieldId: 'profitRate', fieldName: '利润率', category: 'rate', sensitive: true, permissions: { admin: ['view', 'edit', 'export', 'approve'], cost_engineer: ['view', 'edit'], sales: [], viewer: [] } },
  { fieldId: 'scrapRate', fieldName: '废品率', category: 'rate', sensitive: false, permissions: { admin: ['view', 'edit', 'export'], cost_engineer: ['view', 'edit', 'export'], sales: ['view'], viewer: ['view'] } },
  { fieldId: 'packagingRate', fieldName: '包装费率', category: 'rate', sensitive: false, permissions: { admin: ['view', 'edit', 'export'], cost_engineer: ['view', 'edit', 'export'], sales: ['view', 'export'], viewer: ['view'] } },
  { fieldId: 'laborRate', fieldName: '工时费率', category: 'rate', sensitive: true, permissions: { admin: ['view', 'edit', 'export'], cost_engineer: ['view', 'edit'], sales: [], viewer: [] } },

  // Metal fields
  { fieldId: 'copperPrice', fieldName: '铜价', category: 'metal', sensitive: false, permissions: { admin: ['view', 'edit', 'export'], cost_engineer: ['view', 'edit', 'export'], sales: ['view', 'export'], viewer: ['view'] } },
  { fieldId: 'aluminumPrice', fieldName: '铝价', category: 'metal', sensitive: false, permissions: { admin: ['view', 'edit', 'export'], cost_engineer: ['view', 'edit', 'export'], sales: ['view', 'export'], viewer: ['view'] } },

  // Quote fields
  { fieldId: 'totalCost', fieldName: '总成本', category: 'quote', sensitive: true, permissions: { admin: ['view', 'edit', 'export'], cost_engineer: ['view', 'export'], sales: ['view'], viewer: [] } },
  { fieldId: 'sellingPrice', fieldName: '售价', category: 'quote', sensitive: false, permissions: { admin: ['view', 'edit', 'export'], cost_engineer: ['view', 'export'], sales: ['view', 'edit', 'export'], viewer: ['view'] } },
  { fieldId: 'marginRate', fieldName: '毛利率', category: 'quote', sensitive: true, permissions: { admin: ['view', 'edit', 'export'], cost_engineer: ['view'], sales: [], viewer: [] } },

  // NRE fields
  { fieldId: 'nreCost', fieldName: '一次性费用', category: 'nre', sensitive: false, permissions: { admin: ['view', 'edit', 'export'], cost_engineer: ['view', 'edit', 'export'], sales: ['view', 'export'], viewer: ['view'] } },

  // Settings
  { fieldId: 'allocMethod', fieldName: '分摊方式', category: 'settings', sensitive: false, permissions: { admin: ['view', 'edit', 'export', 'approve'], cost_engineer: ['view', 'edit'], sales: ['view'], viewer: ['view'] } },
];

// ─── Core Functions ───

/** Check if a role has permission for an action on a field */
export function checkPermission(
  fieldId: string,
  action: PermissionAction,
  role: UserRole,
  permissionMatrix: FieldPermission[] = DEFAULT_PERMISSIONS,
): PermissionCheckResult {
  const field = permissionMatrix.find(f => f.fieldId === fieldId);
  if (!field) {
    return { allowed: false, reason: `未知字段: ${fieldId}`, field: fieldId, action, role };
  }

  const allowed = field.permissions[role]?.includes(action) ?? false;
  return {
    allowed,
    reason: allowed ? undefined : `角色 ${role} 无权对 ${field.fieldName} 执行 ${action}`,
    field: fieldId,
    action,
    role,
  };
}

/** Batch check permissions for multiple fields */
export function batchCheckPermissions(
  fieldIds: string[],
  action: PermissionAction,
  role: UserRole,
): { allAllowed: boolean; results: PermissionCheckResult[]; deniedFields: string[] } {
  const results = fieldIds.map(id => checkPermission(id, action, role));
  const deniedFields = results.filter(r => !r.allowed).map(r => r.field);
  return {
    allAllowed: deniedFields.length === 0,
    results,
    deniedFields,
  };
}

/** Generate export template with auto-masking for sensitive fields */
export function generateExportTemplate(
  targetRole: UserRole,
  format: ExportTemplate['format'] = 'xlsx',
  templateName: string = '',
  permissionMatrix: FieldPermission[] = DEFAULT_PERMISSIONS,
): ExportTemplate {
  const fields: ExportFieldConfig[] = permissionMatrix.map(field => {
    const canExport = field.permissions[targetRole]?.includes('export') ?? false;
    const canView = field.permissions[targetRole]?.includes('view') ?? false;

    return {
      fieldId: field.fieldId,
      fieldName: field.fieldName,
      included: canExport || canView,
      masked: field.sensitive && !canExport,
      maskRule: field.sensitive && !canExport
        ? (canView ? 'range' : 'hide')
        : undefined,
    };
  });

  return {
    name: templateName || `导出模板_${targetRole}_${format}`,
    format,
    targetRole,
    fields,
    generatedAt: new Date().toISOString(),
  };
}

/** Apply masking rules to export data */
export function applyExportMasking(
  data: Record<string, number | string>,
  template: ExportTemplate,
): Record<string, number | string | null> {
  const result: Record<string, number | string | null> = {};

  for (const fieldConfig of template.fields) {
    if (!fieldConfig.included) continue;

    const value = data[fieldConfig.fieldId];
    if (value === undefined) {
      result[fieldConfig.fieldId] = null;
      continue;
    }

    if (!fieldConfig.masked) {
      result[fieldConfig.fieldId] = value;
      continue;
    }

    // Apply mask rules
    switch (fieldConfig.maskRule) {
      case 'hide':
        result[fieldConfig.fieldId] = '***';
        break;
      case 'round':
        result[fieldConfig.fieldId] = typeof value === 'number'
          ? Math.round(value * 10) / 10
          : value;
        break;
      case 'range':
        if (typeof value === 'number') {
          const lower = Math.floor(value * 0.9 * 100) / 100;
          const upper = Math.ceil(value * 1.1 * 100) / 100;
          result[fieldConfig.fieldId] = `${lower}~${upper}`;
        } else {
          result[fieldConfig.fieldId] = '***';
        }
        break;
      default:
        result[fieldConfig.fieldId] = value;
    }
  }

  return result;
}

/** Get all fields accessible by a role */
export function getAccessibleFields(
  role: UserRole,
  action: PermissionAction = 'view',
  permissionMatrix: FieldPermission[] = DEFAULT_PERMISSIONS,
): FieldPermission[] {
  return permissionMatrix.filter(f => f.permissions[role]?.includes(action));
}
