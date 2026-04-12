/**
 * B9: 设变闭环验证
 * 验证设变单是否正确应用，检测未预期的变更
 */

import type { BomItem, WireItem } from '@/types/harness';
import { diffBom } from './bom_diff';

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
      const actualMatches = JSON.stringify(fieldChange.newValue) === JSON.stringify(expected.newValue);
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
