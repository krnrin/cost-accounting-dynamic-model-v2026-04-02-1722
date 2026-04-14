/**
 * BOM Snapshot Manager (C14 — Issue #67)
 * 
 * BOM快照化 + 变更影响链路
 * - 关键节点（报价前/设变前/年度复核）自动保留BOM快照
 * - BOM变更后通知下游模块标记为stale
 * - BOM导入基础校验
 */

import type { BomItem } from '@/types/harness';

// ─── Types ───

export interface BomSnapshot {
  id: string;
  scenarioId: string;
  harnessId: string;
  version: number;
  reason: BomSnapshotReason;
  createdAt: string;
  createdBy: string;
  items: BomItem[];
  metadata: {
    itemCount: number;
    totalWeight: number;
    uniquePartCount: number;
    endGroupCount: number;
    checksum: string;
  };
}

export type BomSnapshotReason =
  | 'pre_quote'        // 报价前
  | 'pre_change'       // 设变前
  | 'annual_review'    // 年度复核
  | 'manual'           // 手动
  | 'import'           // 导入后
  | 'baseline';        // 基线锁定

export interface BomDiffResult {
  added: BomItem[];
  removed: BomItem[];
  modified: Array<{
    partNo: string;
    field: string;
    oldValue: unknown;
    newValue: unknown;
    item: BomItem;
  }>;
  unchanged: number;
  summary: {
    addedCount: number;
    removedCount: number;
    modifiedCount: number;
    totalChanges: number;
    estimatedCostImpact: number | null;
  };
}

export interface BomValidationResult {
  valid: boolean;
  errors: BomValidationError[];
  warnings: BomValidationWarning[];
}

export interface BomValidationError {
  type: 'missing_field' | 'duplicate_row' | 'invalid_value' | 'empty_partno';
  row: number;
  field?: string;
  message: string;
}

export interface BomValidationWarning {
  type: 'unusual_qty' | 'missing_supplier' | 'unknown_unit';
  row: number;
  field?: string;
  message: string;
}

export type DownstreamModule = 'quote' | 'alloc' | 'tracking' | 'alert';

export interface StaleNotification {
  module: DownstreamModule;
  harnessId: string;
  scenarioId: string;
  reason: string;
  bomSnapshotId: string;
  timestamp: string;
}

// ─── Core Functions ───

/** Generate a simple checksum for BOM items */
function computeChecksum(items: BomItem[]): string {
  const str = items
    .map(i => `${i.partNo || ''}:${i.quantity || 0}:${i.unitPrice || 0}`)
    .sort()
    .join('|');
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const chr = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + chr;
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

/** Create a BOM snapshot from current items */
export function createBomSnapshot(
  scenarioId: string,
  harnessId: string,
  items: BomItem[],
  reason: BomSnapshotReason,
  createdBy: string = 'system',
  existingSnapshots: BomSnapshot[] = [],
): BomSnapshot {
  const version = existingSnapshots
    .filter(s => s.scenarioId === scenarioId && s.harnessId === harnessId)
    .length + 1;

  const uniqueParts = new Set(items.map(i => i.partNo).filter(Boolean));
  const endGroups = new Set(items.map(i => (i as any).endGroup).filter(Boolean));
  const totalWeight = items.reduce((sum, i) => {
    const w = (i as any).weight;
    return sum + (typeof w === 'number' ? w : 0);
  }, 0);

  return {
    id: `bom-snap-${scenarioId}-${harnessId}-v${version}`,
    scenarioId,
    harnessId,
    version,
    reason,
    createdAt: new Date().toISOString(),
    createdBy,
    items: JSON.parse(JSON.stringify(items)),
    metadata: {
      itemCount: items.length,
      totalWeight: Math.round(totalWeight * 100) / 100,
      uniquePartCount: uniqueParts.size,
      endGroupCount: endGroups.size,
      checksum: computeChecksum(items),
    },
  };
}

/** Compare two BOM snapshots to produce a diff */
export function diffBomSnapshots(
  baseline: BomSnapshot,
  current: BomSnapshot,
): BomDiffResult {
  const baseMap = new Map<string, BomItem>();
  baseline.items.forEach(item => {
    if (item.partNo) baseMap.set(item.partNo, item);
  });

  const currMap = new Map<string, BomItem>();
  current.items.forEach(item => {
    if (item.partNo) currMap.set(item.partNo, item);
  });

  const added: BomItem[] = [];
  const removed: BomItem[] = [];
  const modified: BomDiffResult['modified'] = [];
  let unchanged = 0;

  // Check current against baseline
  for (const [partNo, currItem] of currMap) {
    const baseItem = baseMap.get(partNo);
    if (!baseItem) {
      added.push(currItem);
      continue;
    }

    // Compare key fields
    const fields = ['quantity', 'unitPrice', 'supplier', 'unit', 'partName'] as const;
    let hasChange = false;
    for (const field of fields) {
      const oldVal = (baseItem as any)[field];
      const newVal = (currItem as any)[field];
      if (oldVal !== newVal && !(oldVal == null && newVal == null)) {
        modified.push({
          partNo,
          field,
          oldValue: oldVal,
          newValue: newVal,
          item: currItem,
        });
        hasChange = true;
      }
    }
    if (!hasChange) unchanged++;
  }

  // Find removed items
  for (const [partNo, baseItem] of baseMap) {
    if (!currMap.has(partNo)) {
      removed.push(baseItem);
    }
  }

  // Estimate cost impact
  let estimatedCostImpact: number | null = null;
  try {
    const addedCost = added.reduce((s, i) => s + ((i.quantity || 0) * (i.unitPrice || 0)), 0);
    const removedCost = removed.reduce((s, i) => s + ((i.quantity || 0) * (i.unitPrice || 0)), 0);
    const modifiedCost = modified
      .filter(m => m.field === 'unitPrice' || m.field === 'quantity')
      .reduce((s, m) => {
        const item = m.item;
        const oldVal = typeof m.oldValue === 'number' ? m.oldValue : 0;
        const newVal = typeof m.newValue === 'number' ? m.newValue : 0;
        if (m.field === 'unitPrice') return s + ((item.quantity || 0) * (newVal - oldVal));
        if (m.field === 'quantity') return s + ((newVal - oldVal) * (item.unitPrice || 0));
        return s;
      }, 0);
    estimatedCostImpact = Math.round((addedCost - removedCost + modifiedCost) * 100) / 100;
  } catch {
    estimatedCostImpact = null;
  }

  return {
    added,
    removed,
    modified,
    unchanged,
    summary: {
      addedCount: added.length,
      removedCount: removed.length,
      modifiedCount: modified.length,
      totalChanges: added.length + removed.length + modified.length,
      estimatedCostImpact,
    },
  };
}

/** Validate BOM items before import/save */
export function validateBomItems(items: BomItem[]): BomValidationResult {
  const errors: BomValidationError[] = [];
  const warnings: BomValidationWarning[] = [];
  const seenPartNos = new Map<string, number>();

  items.forEach((item, index) => {
    const row = index + 1;

    // Required field checks
    if (!item.partNo || item.partNo.trim() === '') {
      errors.push({ type: 'empty_partno', row, field: 'partNo', message: `第${row}行: 零件号为空` });
    } else {
      // Duplicate check
      const key = `${item.partNo}:${(item as any).endGroup || ''}`;
      if (seenPartNos.has(key)) {
        errors.push({
          type: 'duplicate_row', row, field: 'partNo',
          message: `第${row}行: 零件号 ${item.partNo} 与第${seenPartNos.get(key)}行重复`,
        });
      } else {
        seenPartNos.set(key, row);
      }
    }

    // Value range checks
    if (typeof item.quantity === 'number' && item.quantity < 0) {
      errors.push({ type: 'invalid_value', row, field: 'quantity', message: `第${row}行: 数量为负数` });
    }
    if (typeof item.unitPrice === 'number' && item.unitPrice < 0) {
      errors.push({ type: 'invalid_value', row, field: 'unitPrice', message: `第${row}行: 单价为负数` });
    }

    // Warnings
    if (typeof item.quantity === 'number' && item.quantity > 10000) {
      warnings.push({ type: 'unusual_qty', row, field: 'quantity', message: `第${row}行: 数量异常大 (${item.quantity})` });
    }
    if (!(item as any).supplier) {
      warnings.push({ type: 'missing_supplier', row, field: 'supplier', message: `第${row}行: 缺少供应商信息` });
    }
  });

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/** Notify downstream modules that BOM has changed */
export function notifyDownstreamStale(
  scenarioId: string,
  harnessId: string,
  bomSnapshotId: string,
  modules: DownstreamModule[] = ['quote', 'alloc', 'tracking', 'alert'],
): StaleNotification[] {
  const timestamp = new Date().toISOString();
  return modules.map(module => ({
    module,
    harnessId,
    scenarioId,
    reason: `BOM updated — downstream ${module} data may be stale`,
    bomSnapshotId,
    timestamp,
  }));
}

/** Determine if auto-snapshot should trigger */
export function shouldAutoSnapshot(
  reason: BomSnapshotReason,
  existingSnapshots: BomSnapshot[],
  scenarioId: string,
  harnessId: string,
): boolean {
  const relevant = existingSnapshots.filter(
    s => s.scenarioId === scenarioId && s.harnessId === harnessId
  );

  // Always snapshot for pre_quote, pre_change, baseline
  if (['pre_quote', 'pre_change', 'baseline'].includes(reason)) return true;

  // For import: only if no existing import snapshot within 5 minutes
  if (reason === 'import') {
    const recentImport = relevant.find(
      s => s.reason === 'import' &&
        Date.now() - new Date(s.createdAt).getTime() < 5 * 60 * 1000
    );
    return !recentImport;
  }

  return true;
}
