/**
 * BOM 状态快照引擎 (Issue #67)
 *
 * 在场景冻结或手动触发时，对当前 BOM 状态做全量快照，
 * 支持快照间 diff 对比，用于版本追溯和变更审计。
 */
import { db } from '@/data/db';
import type { HarnessRecord } from '@/data/db';
import type { HarnessInput, HarnessResult } from '@/types/harness';

/** BOM 快照条目 */
export interface BomSnapshotItem {
  harnessId: string;
  harnessName: string;
  input: HarnessInput;
  result?: HarnessResult;
  eopYear: number | null;
  locked?: boolean;
}

/** BOM 快照记录 */
export interface BomSnapshot {
  id: string;
  scenarioId: string;
  projectId: string;
  timestamp: string;
  reason: 'freeze' | 'manual' | 'pre_ecn' | 'pre_import';
  items: BomSnapshotItem[];
  totalHarnesses: number;
  totalMaterialCost: number;
  userId?: string;
  note?: string;
}

/** BOM diff 结果 */
export interface BomDiffResult {
  added: BomSnapshotItem[];
  removed: BomSnapshotItem[];
  modified: BomModification[];
  unchanged: number;
}

/** 单条修改详情 */
export interface BomModification {
  harnessId: string;
  harnessName: string;
  changes: Array<{
    field: string;
    label: string;
    oldValue: unknown;
    newValue: unknown;
  }>;
}

/**
 * 创建 BOM 快照
 */
export async function createBomSnapshot(
  scenarioId: string,
  reason: BomSnapshot['reason'],
  options?: { userId?: string; note?: string }
): Promise<BomSnapshot> {
  const harnesses = await db.harnesses
    .where('scenarioId').equals(scenarioId)
    .toArray();

  const scenario = await db.scenarios.get(scenarioId);
  if (!scenario) {
    throw new Error(`场景 ${scenarioId} 不存在`);
  }

  const items: BomSnapshotItem[] = harnesses.map((h) => ({
    harnessId: h.harnessId,
    harnessName: h.harnessName,
    input: h.input,
    result: h.result,
    eopYear: h.eopYear,
    locked: h.locked,
  }));

  const totalMaterialCost = items.reduce(
    (sum, item) => sum + (item.result?.materialCost ?? 0), 0
  );

  const snapshot: BomSnapshot = {
    id: `bom-snap-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    scenarioId,
    projectId: scenario.projectId,
    timestamp: new Date().toISOString(),
    reason,
    items,
    totalHarnesses: items.length,
    totalMaterialCost,
    userId: options?.userId,
    note: options?.note,
  };

  return snapshot;
}

/**
 * 对比两个 BOM 快照
 */
export function diffBomSnapshots(snapA: BomSnapshot, snapB: BomSnapshot): BomDiffResult {
  const mapA = new Map(snapA.items.map((i) => [i.harnessId, i]));
  const mapB = new Map(snapB.items.map((i) => [i.harnessId, i]));

  const added: BomSnapshotItem[] = [];
  const removed: BomSnapshotItem[] = [];
  const modified: BomModification[] = [];
  let unchanged = 0;

  // 查找 B 中新增的
  for (const [id, item] of mapB) {
    if (!mapA.has(id)) {
      added.push(item);
    }
  }

  // 查找 A 中删除的 + 修改的
  for (const [id, itemA] of mapA) {
    const itemB = mapB.get(id);
    if (!itemB) {
      removed.push(itemA);
      continue;
    }

    const changes = diffBomItems(itemA, itemB);
    if (changes.length > 0) {
      modified.push({
        harnessId: id,
        harnessName: itemA.harnessName,
        changes,
      });
    } else {
      unchanged++;
    }
  }

  return { added, removed, modified, unchanged };
}

/**
 * 对比单个 BOM 条目
 */
function diffBomItems(
  a: BomSnapshotItem,
  b: BomSnapshotItem
): Array<{ field: string; label: string; oldValue: unknown; newValue: unknown }> {
  const diffs: Array<{ field: string; label: string; oldValue: unknown; newValue: unknown }> = [];

  // 对比关键结果字段
  const resultFields: Array<[string, string]> = [
    ['materialCost', '材料成本'],
    ['processCost', '加工成本'],
    ['exFactoryPrice', '出厂价'],
    ['deliveredPrice', '到厂价'],
    ['copperWeight', '铜重(kg)'],
    ['aluminumWeight', '铝重(kg)'],
    ['totalWeight', '总重(kg)'],
  ];

  for (const [field, label] of resultFields) {
    const va = (a.result as any)?.[field];
    const vb = (b.result as any)?.[field];
    if (va !== vb && (va != null || vb != null)) {
      diffs.push({ field: `result.${field}`, label, oldValue: va, newValue: vb });
    }
  }

  // 对比 EOP
  if (a.eopYear !== b.eopYear) {
    diffs.push({ field: 'eopYear', label: 'EOP年份', oldValue: a.eopYear, newValue: b.eopYear });
  }

  // 对比锁定状态
  if (a.locked !== b.locked) {
    diffs.push({ field: 'locked', label: '锁定状态', oldValue: a.locked, newValue: b.locked });
  }

  // 对比 BOM 行数
  const aRows = a.input?.bomRows?.length ?? 0;
  const bRows = b.input?.bomRows?.length ?? 0;
  if (aRows !== bRows) {
    diffs.push({ field: 'input.bomRows.length', label: 'BOM行数', oldValue: aRows, newValue: bRows });
  }

  return diffs;
}
