/**
 * B4: 报价参数快照 — 报价生成时全量快照关联参数
 * 
 * 与 B13 settingsSnapshotStore 的区别:
 * - B13 跟踪参数每次变更
 * - B4 在报价生成时绑定快照到报价单
 */
import type { CostRates, MetalPrices, CostStructureSchema, FactoryConfig, AllocationConfig } from '@/types/project';
import type { HarnessResult } from '@/types/harness';
import { db } from '@/data/db';

/** 报价快照 */
export interface QuoteSnapshot {
  id: string;
  /** 关联报价单ID */
  quoteId: string;
  /** 场景ID */
  scenarioId: string;
  /** 项目ID */
  projectId: string;
  /** 快照时间 */
  createdAt: string;

  /** 报价版本号 */
  version: number;
  /** 报价标签 */
  label?: string;

  /** --- 参数快照 --- */
  params: {
    costRates: CostRates;
    metalPrices: MetalPrices;
    costStructure?: CostStructureSchema;
    factories?: FactoryConfig[];
    allocationConfig?: AllocationConfig;
    annualDropRate: number;
    lifecycleYears: number;
    /** 自定义参数 */
    custom?: Record<string, unknown>;
  };

  /** --- 结果快照 --- */
  results: {
    /** 各线束计算结果 */
    harnessResults: Array<{
      harnessId: string;
      harnessName: string;
      result: HarnessResult;
    }>;
    /** 场景汇总 */
    totalMaterialCost: number;
    totalExFactoryPrice: number;
    totalDeliveredPrice: number;
    /** 铜总重 */
    totalCopperWeight: number;
    /** 铝总重 */
    totalAluminumWeight: number;
  };

  /** 备注 */
  notes?: string;
}

/**
 * 创建报价快照
 */
export async function createQuoteSnapshot(
  params: Omit<QuoteSnapshot, 'id' | 'createdAt'>
): Promise<QuoteSnapshot> {
  const snapshot: QuoteSnapshot = {
    ...params,
    id: `qs-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    createdAt: new Date().toISOString(),
  };

  try {
    await db.table('quoteSnapshots').add(snapshot);
  } catch {
    console.warn('quoteSnapshots table not found, storing in memory only');
  }

  return snapshot;
}

/**
 * 加载报价快照历史
 */
export async function loadQuoteSnapshots(
  opts: { scenarioId?: string; projectId?: string; limit?: number } = {}
): Promise<QuoteSnapshot[]> {
  try {
    let collection;
    if (opts.scenarioId) {
      collection = db.table('quoteSnapshots')
        .where('scenarioId').equals(opts.scenarioId);
    } else if (opts.projectId) {
      collection = db.table('quoteSnapshots')
        .where('projectId').equals(opts.projectId);
    } else {
      collection = db.table('quoteSnapshots').toCollection();
    }
    return await collection
      .reverse()
      .limit(opts.limit || 50)
      .toArray();
  } catch {
    return [];
  }
}

/**
 * 对比两个报价快照
 */
export function compareQuoteSnapshots(
  snapA: QuoteSnapshot,
  snapB: QuoteSnapshot
): {
  paramDiffs: Array<{ field: string; label: string; valueA: unknown; valueB: unknown }>;
  resultDiffs: Array<{ harnessId: string; field: string; label: string; valueA: number; valueB: number; change: number; changeRate: number }>;
} {
  const paramDiffs: Array<{ field: string; label: string; valueA: unknown; valueB: unknown }> = [];

  // 对比费率
  const rateKeys: Array<keyof CostRates> = ['laborRate', 'mfgRate', 'wasteRate', 'mgmtRate', 'profitRate'];
  const rateLabels: Record<string, string> = { laborRate: '人工费率', mfgRate: '制造费率', wasteRate: '废品率', mgmtRate: '管理费率', profitRate: '利润率' };
  for (const key of rateKeys) {
    if (snapA.params.costRates[key] !== snapB.params.costRates[key]) {
      paramDiffs.push({ field: key, label: rateLabels[key] ?? key, valueA: snapA.params.costRates[key], valueB: snapB.params.costRates[key] });
    }
  }

  // 对比金属价格
  if (snapA.params.metalPrices.copper !== snapB.params.metalPrices.copper) {
    paramDiffs.push({ field: 'copper', label: '铜价', valueA: snapA.params.metalPrices.copper, valueB: snapB.params.metalPrices.copper });
  }
  if (snapA.params.metalPrices.aluminum !== snapB.params.metalPrices.aluminum) {
    paramDiffs.push({ field: 'aluminum', label: '铝价', valueA: snapA.params.metalPrices.aluminum, valueB: snapB.params.metalPrices.aluminum });
  }

  // 对比结果
  const resultDiffs: Array<{ harnessId: string; field: string; label: string; valueA: number; valueB: number; change: number; changeRate: number }> = [];
  const aMap = new Map(snapA.results.harnessResults.map((h) => [h.harnessId, h]));
  const bMap = new Map(snapB.results.harnessResults.map((h) => [h.harnessId, h]));

  for (const [hId, aItem] of aMap) {
    const bItem = bMap.get(hId);
    if (!bItem) continue;

    const fields: Array<[keyof HarnessResult, string]> = [
      ['materialCost', '材料成本'],
      ['exFactoryPrice', '出厂价'],
      ['deliveredPrice', '到厂价'],
    ];

    for (const [field, label] of fields) {
      const va = (aItem.result as any)[field] as number;
      const vb = (bItem.result as any)[field] as number;
      if (va !== vb) {
        const change = vb - va;
        const changeRate = va !== 0 ? change / va : 0;
        resultDiffs.push({ harnessId: hId, field, label, valueA: va, valueB: vb, change, changeRate });
      }
    }
  }

  return { paramDiffs, resultDiffs };
}
