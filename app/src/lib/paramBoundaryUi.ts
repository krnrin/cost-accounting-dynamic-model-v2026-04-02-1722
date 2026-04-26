import { checkParamBoundaries } from '@/engine/param_boundaries';
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

/**
 * [PR-037] 角色映射已移至 param_permission.ts
 * 此处保留空函数以维持向后兼容
 */
export function mapUserRoleToBoundaryRole(_role?: UserRole | string | null): void {
  // 角色权限检查已移至 param_permission.ts
  return;
}

export function applyParamBoundaryRules(
  params: Record<string, number>,
  _role?: UserRole | string | null,
): BoundaryUiResult {
  const sanitized = { ...params };
  // [PR-037] 角色权限检查已移至 param_permission.ts，此处仅做数值边界检查
  const result = checkParamBoundaries(params);
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
