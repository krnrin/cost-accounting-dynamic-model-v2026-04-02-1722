/**
 * B9: 设变闭环验证
 * 验证设变单是否正确应用，检测未预期的变更
 */

import type { BomItem, WireItem } from '@/types/harness';
import { diffBom } from './bom_diff';

/**
 * 深度比较两个值是否相等
 * 处理对象、数组、原始类型，忽略键序
 */
function deepEqual(a: unknown, b: unknown): boolean {
  // 快速路径：严格相等
  if (a === b) return true;

  // null/undefined 检查
  if (a == null || b == null) return a === b;

  // 类型检查
  if (typeof a !== typeof b) return false;

  // 数组比较
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((item, idx) => deepEqual(item, b[idx]));
  }

  // 对象比较
  if (typeof a === 'object' && typeof b === 'object') {
    const aObj = a as Record<string, unknown>;
    const bObj = b as Record<string, unknown>;
    const aKeys = Object.keys(aObj).sort();
    const bKeys = Object.keys(bObj).sort();
    if (aKeys.length !== bKeys.length) return false;
    if (aKeys.join(',') !== bKeys.join(',')) return false;
    return aKeys.every(key => deepEqual(aObj[key], bObj[key]));
  }

  // 原始类型
  return a === b;
}

export interface ChangeOrder {
  id: string;
  changeNo: string;
  reason: string;
  type: 'add_part' | 'remove_part' | 'modify_part' | 'replace_part' | 'qty_change' | 'other';
  affectedParts: string[];
  expectedChanges: Array<{
    partNo: string;
    field: string;
    oldValue: unknown;
    newValue: unknown;
  }>;
  status: 'pending' | 'applied' | 'verified' | 'rejected';
  createdAt: string;
  verification?: ChangeVerificationResult;
}

export interface ChangeVerificationResult {
  allMatched: boolean;
  matches: Array<{
    partNo: string;
    field: string;
    expected: unknown;
    actual: unknown;
    matched: boolean;
    message: string;
  }>;
  unexpectedChanges: Array<{
    partNo: string;
    field: string;
    oldValue: unknown;
    newValue: unknown;
  }>;
  costImpact: number;
  verifiedAt: string;
}

export function verifyChangeOrder(
  changeOrder: ChangeOrder,
  oldBom: Array<BomItem | WireItem>,
  newBom: Array<BomItem | WireItem>
): ChangeVerificationResult {
  const diff = diffBom(oldBom, newBom);
  const matches: ChangeVerificationResult['matches'] = [];
  const unexpectedChanges: ChangeVerificationResult['unexpectedChanges'] = [];

  for (const expected of changeOrder.expectedChanges) {
    const diffRow = diff.rows.find(r => r.partNo === expected.partNo);
    if (!diffRow) {
      matches.push({
        partNo: expected.partNo, field: expected.field,
        expected: expected.newValue, actual: '(未找到变更)',
        matched: false, message: `零件 ${expected.partNo} 未发现任何变更`,
      });
      continue;
    }

    if (diffRow.changeType === 'added' && changeOrder.type === 'add_part') {
      matches.push({ partNo: expected.partNo, field: 'existence', expected: '新增', actual: '新增', matched: true, message: '新增零件已确认' });
      continue;
    }

    if (diffRow.changeType === 'removed' && changeOrder.type === 'remove_part') {
      matches.push({ partNo: expected.partNo, field: 'existence', expected: '删除', actual: '删除', matched: true, message: '删除零件已确认' });
      continue;
    }

    const fieldChange = diffRow.fieldChanges.find(fc => fc.field === expected.field);
    if (fieldChange) {
      const actualMatches = deepEqual(fieldChange.newValue, expected.newValue);
      matches.push({
        partNo: expected.partNo, field: expected.field,
        expected: expected.newValue, actual: fieldChange.newValue,
        matched: actualMatches,
        message: actualMatches ? '变更值匹配' : `期望 ${expected.newValue}, 实际 ${fieldChange.newValue}`,
      });
    } else {
      matches.push({
        partNo: expected.partNo, field: expected.field,
        expected: expected.newValue, actual: '(未变更)',
        matched: false, message: `字段 ${expected.field} 未发生变更`,
      });
    }
  }

  for (const row of diff.rows) {
    if (row.changeType === 'unchanged') continue;
    const isExpected = changeOrder.affectedParts.includes(row.partNo);
    if (!isExpected) {
      for (const fc of row.fieldChanges) {
        unexpectedChanges.push({ partNo: row.partNo, field: fc.field, oldValue: fc.oldValue, newValue: fc.newValue });
      }
    }
  }

  return {
    allMatched: matches.every(m => m.matched) && unexpectedChanges.length === 0,
    matches, unexpectedChanges,
    costImpact: diff.summary.totalCostImpact,
    verifiedAt: new Date().toISOString(),
  };
}
