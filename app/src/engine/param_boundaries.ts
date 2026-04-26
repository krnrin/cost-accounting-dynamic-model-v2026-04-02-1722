/**
 * C7: 参数数值边界校验
 * [PR-037] 角色权限检查已移至 param_permission.ts，此文件仅保留数值边界校验
 */

export interface NumericBoundary {
  field: string;
  label: string;
  min: number;
  max: number;
  onViolation: 'reject' | 'warn' | 'clamp';
}

// [PR-037] 移除 requiredRole 字段，角色权限由 param_permission.ts 统一管理
export const NUMERIC_BOUNDARIES: NumericBoundary[] = [
  { field: 'laborRate', label: '人工费率', min: 10, max: 200, onViolation: 'warn' },
  { field: 'mfgRate', label: '制造费率', min: 10, max: 300, onViolation: 'warn' },
  { field: 'wasteRate', label: '废品率', min: 0, max: 0.15, onViolation: 'reject' },
  { field: 'mgmtRate', label: '管理费率', min: 0, max: 0.25, onViolation: 'warn' },
  { field: 'profitRate', label: '利润率', min: 0, max: 0.10, onViolation: 'reject' },
  { field: 'copper', label: '铜价', min: 30000, max: 120000, onViolation: 'warn' },
  { field: 'aluminum', label: '铝价', min: 10000, max: 50000, onViolation: 'warn' },
  { field: 'annualDropRate', label: '年降率', min: 0, max: 0.10, onViolation: 'reject' },
];

export interface BoundaryCheckResult {
  valid: boolean;
  violations: Array<{
    field: string;
    label: string;
    value: number;
    min: number;
    max: number;
    action: 'rejected' | 'warned' | 'clamped';
    clampedValue?: number;
  }>;
}

/**
 * [PR-037] 纯数值边界校验（不含角色权限检查）
 * 角色权限检查请使用 param_permission.ts 的 checkPermission()
 */
export function checkNumericBoundaries(
  params: Record<string, number>
): BoundaryCheckResult {
  const violations: BoundaryCheckResult['violations'] = [];

  for (const boundary of NUMERIC_BOUNDARIES) {
    const value = params[boundary.field];
    if (value === undefined) continue;

    if (value < boundary.min || value > boundary.max) {
      const violation: (typeof violations)[0] = {
        field: boundary.field,
        label: boundary.label,
        value,
        min: boundary.min,
        max: boundary.max,
        action: boundary.onViolation === 'reject' ? 'rejected' :
                boundary.onViolation === 'clamp' ? 'clamped' : 'warned',
      };

      if (boundary.onViolation === 'clamp') {
        violation.clampedValue = Math.max(boundary.min, Math.min(boundary.max, value));
      }

      violations.push(violation);
    }
  }

  return {
    valid: !violations.some(v => v.action === 'rejected'),
    violations,
  };
}

// [PR-037] 保留旧函数名作为别名，向后兼容
export const checkParamBoundaries = checkNumericBoundaries;
// [PR-037] 保留旧常量名作为别名，向后兼容
export const PARAM_BOUNDARIES = NUMERIC_BOUNDARIES;
