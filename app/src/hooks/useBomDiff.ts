/**
 * C10: BOM 版本差异比较 React Hook
 *
 * 封装 bom_diff.ts 引擎，提供：
 * - 版本/快照选择
 * - 差异计算
 * - 筛选（按变更类型、按成本影响排序）
 * - 导出摘要
 *
 * 对应 Issue #64 [F03] BomDiffPage
 */

import { useState, useCallback, useMemo } from 'react';
import { diffBom, type BomDiffResult, type BomDiffRow } from '@/engine/bom_diff';
import type { BomItem, WireItem } from '@/types/harness';

export type DiffFilterType = 'all' | 'added' | 'removed' | 'modified' | 'unchanged';
export type DiffSortField = 'changeType' | 'costImpact' | 'partNo' | 'partName';
export type DiffSortDir = 'asc' | 'desc';

export interface BomVersion {
  id: string;
  label: string;
  timestamp?: string;
  source: 'snapshot' | 'current' | 'import';
  items: Array<BomItem | WireItem>;
}

export interface UseBomDiffReturn {
  /** 差异结果 */
  diffResult: BomDiffResult | null;
  /** 过滤后的行 */
  filteredRows: BomDiffRow[];
  /** 当前筛选类型 */
  filter: DiffFilterType;
  /** 当前排序 */
  sort: { field: DiffSortField; dir: DiffSortDir };
  /** 左侧版本 */
  leftVersion: BomVersion | null;
  /** 右侧版本 */
  rightVersion: BomVersion | null;
  /** 是否在计算中 */
  computing: boolean;
  /** 错误 */
  error: string | null;

  /** 设置版本并计算 */
  compare: (left: BomVersion, right: BomVersion) => void;
  /** 更新筛选 */
  setFilter: (filter: DiffFilterType) => void;
  /** 更新排序 */
  setSort: (field: DiffSortField, dir?: DiffSortDir) => void;
  /** 导出差异摘要文本 */
  exportSummary: () => string;
  /** 重置 */
  reset: () => void;
}

const CHANGE_ORDER: Record<string, number> = { added: 0, removed: 1, modified: 2, unchanged: 3 };

export function useBomDiff(): UseBomDiffReturn {
  const [diffResult, setDiffResult] = useState<BomDiffResult | null>(null);
  const [filter, setFilter] = useState<DiffFilterType>('all');
  const [sort, setSortState] = useState<{ field: DiffSortField; dir: DiffSortDir }>({
    field: 'changeType',
    dir: 'asc',
  });
  const [leftVersion, setLeftVersion] = useState<BomVersion | null>(null);
  const [rightVersion, setRightVersion] = useState<BomVersion | null>(null);
  const [computing, setComputing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const compare = useCallback((left: BomVersion, right: BomVersion) => {
    setComputing(true);
    setError(null);
    try {
      const result = diffBom(left.items, right.items);
      setDiffResult(result);
      setLeftVersion(left);
      setRightVersion(right);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'BOM 差异计算失败');
    } finally {
      setComputing(false);
    }
  }, []);

  const filteredRows = useMemo(() => {
    if (!diffResult) return [];
    let rows = filter === 'all'
      ? diffResult.rows
      : diffResult.rows.filter(r => r.changeType === filter);

    rows = [...rows].sort((a, b) => {
      const dir = sort.dir === 'asc' ? 1 : -1;
      switch (sort.field) {
        case 'changeType':
          return dir * ((CHANGE_ORDER[a.changeType] || 0) - (CHANGE_ORDER[b.changeType] || 0));
        case 'costImpact':
          return dir * (Math.abs(b.costImpact) - Math.abs(a.costImpact));
        case 'partNo':
          return dir * a.partNo.localeCompare(b.partNo);
        case 'partName':
          return dir * a.partName.localeCompare(b.partName);
        default:
          return 0;
      }
    });

    return rows;
  }, [diffResult, filter, sort]);

  const setSort = useCallback((field: DiffSortField, dir?: DiffSortDir) => {
    setSortState(prev => ({
      field,
      dir: dir || (prev.field === field && prev.dir === 'asc' ? 'desc' : 'asc'),
    }));
  }, []);

  const exportSummary = useCallback(() => {
    if (!diffResult || !leftVersion || !rightVersion) return '';
    const s = diffResult.summary;
    const lines: string[] = [
      `BOM 版本对比摘要`,
      `左侧：${leftVersion.label}${leftVersion.timestamp ? ` (${leftVersion.timestamp})` : ''}`,
      `右侧：${rightVersion.label}${rightVersion.timestamp ? ` (${rightVersion.timestamp})` : ''}`,
      ``,
      `新增: ${s.added} 项`,
      `删除: ${s.removed} 项`,
      `变更: ${s.modified} 项`,
      `未变: ${s.unchanged} 项`,
      `总成本影响: ${s.totalCostImpact >= 0 ? '+' : ''}${s.totalCostImpact.toFixed(2)} 元/车`,
      ``,
      `--- 变更明细 ---`,
    ];

    for (const row of diffResult.rows.filter(r => r.changeType !== 'unchanged')) {
      const typeLabel = { added: '新增', removed: '删除', modified: '变更', unchanged: '-' }[row.changeType];
      lines.push(`[${typeLabel}] ${row.partNo} ${row.partName} | 成本影响: ${row.costImpact >= 0 ? '+' : ''}${row.costImpact.toFixed(2)}`);
      for (const fc of row.fieldChanges) {
        lines.push(`  ${fc.label}: ${String(fc.oldValue ?? '-')} → ${String(fc.newValue ?? '-')}`);
      }
    }

    return lines.join('\n');
  }, [diffResult, leftVersion, rightVersion]);

  const reset = useCallback(() => {
    setDiffResult(null);
    setFilter('all');
    setSortState({ field: 'changeType', dir: 'asc' });
    setLeftVersion(null);
    setRightVersion(null);
    setError(null);
  }, []);

  return {
    diffResult, filteredRows, filter, sort, leftVersion, rightVersion,
    computing, error, compare, setFilter, setSort, exportSummary, reset,
  };
}
