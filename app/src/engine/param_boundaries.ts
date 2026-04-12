/**
 * C7: 参数权限边界
 * 参数值范围校验 + 角色权限检查
 */

import type { CostRates, MetalPrices } from '@/types/project';
import { hasPermission, type Role } from './rbac';

export interface ParamBoundary {
  field: string;
  label: string;
  min: number;
  max: number;
  onViolation: 'reject' | 'warn' | 'clamp';
  requiredRole: Role;
}

export const PARAM_BOUNDARIES: ParamBoundary[] = [
  { field: 'laborRate', label: '人工费率', min: 10, max: 200, onViolation: 'warn', requiredRole: 'cost_engineer' },
  { field: 'mfgRate', label: '制造费率', min: 10, max: 300, onViolation: 'warn', requiredRole: 'cost_engineer' },
  { field: 'wasteRate', label: '废品率', min: 0, max: 0.15, onViolation: 'reject', requiredRole: 'cost_engineer' },
  { field: 'mgmtRate', label: '管理费率', min: 0, max: 0.25, onViolation: 'warn', requiredRole: 'cost_engineer' },
  { field: 'profitRate', label: '利润率', min: 0, max: 0.10, onViolation: 'reject', requiredRole: 'admin' },
  { field: 'copper', label: '铜价', min: 30000, max: 120000, onViolation: 'warn', requiredRole: 'cost_engineer' },
  { field: 'aluminum', label: '铝价', min: 10000, max: 50000, onViolation: 'warn', requiredRole: 'cost_engineer' },
  { field: 'annualDropRate', label: '年降率', min: 0, max: 0.10, onViolation: 'reject', requiredRole: 'admin' },
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

export function checkParamBoundaries(
  params: Record<string, number>,
  role: Role
): BoundaryCheckResult {
  const violations: BoundaryCheckResult['violations'] = [];

  for (const boundary of PARAM_BOUNDARIES) {
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

    if (!hasPermission(role, 'settings', 'write')) {
      violations.push({
        field: boundary.field,
        label: boundary.label,
        value,
        min: boundary.min,
        max: boundary.max,
        action: 'rejected',
      });
    }
  }

  return {
    valid: !violations.some(v => v.action === 'rejected'),
    violations,
  };
}
