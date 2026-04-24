import { checkParamBoundaries } from '@/engine/param_boundaries';
import type { Role } from '@/engine/rbac';
import type { UserRole } from '@/hooks/usePermission';

export interface BoundaryUiMessage {
  field: string;
  level: 'error' | 'warning' | 'info';
  text: string;
}

export interface BoundaryUiResult {
  valid: boolean;
  sanitized: Record<string, number>;
  messages: BoundaryUiMessage[];
}

export function mapUserRoleToBoundaryRole(role?: UserRole | string | null): Role {
  if (!role) return 'admin';
  if (role === 'ADMIN') return 'admin';
  if (role === 'MANAGER' || role === 'ENGINEER') return 'cost_engineer';
  if (role === 'VIEWER') return 'viewer';
  return 'customer';
}

export function applyParamBoundaryRules(
  params: Record<string, number>,
  role?: UserRole | string | null,
): BoundaryUiResult {
  const sanitized = { ...params };
  const result = checkParamBoundaries(params, mapUserRoleToBoundaryRole(role));
  const messages: BoundaryUiMessage[] = [];

  for (const violation of result.violations) {
    if (violation.action === 'clamped' && typeof violation.clampedValue === 'number') {
      sanitized[violation.field] = violation.clampedValue;
      messages.push({
        field: violation.field,
        level: 'info',
        text: `${violation.label} 超出范围，已自动修正为 ${violation.clampedValue}`,
      });
      continue;
    }

    if (violation.action === 'warned') {
      messages.push({
        field: violation.field,
        level: 'warning',
        text: `${violation.label} 超出建议范围 [${violation.min}, ${violation.max}]，当前值 ${violation.value}`,
      });
      continue;
    }

    messages.push({
      field: violation.field,
      level: 'error',
      text: `${violation.label} 不允许保存，当前值 ${violation.value} 超出范围 [${violation.min}, ${violation.max}]`,
    });
  }

  return {
    valid: result.valid,
    sanitized,
    messages,
  };
}
