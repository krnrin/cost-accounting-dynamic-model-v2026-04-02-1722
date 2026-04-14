/**
 * C6: 参数快照化完整闭环 — 快照编排层
 *
 * 将 settingsSnapshotStore (B13) 和 quote_snapshot (B4) 串联起来，
 * 在场景冻结时自动创建全量快照，在解冻/回滚时支持恢复。
 *
 * 闭环流程:
 *   场景冻结 → 自动创建 settingsSnapshot + quoteSnapshot
 *            → 快照ID写入场景元数据
 *            → 解冻时可对比/回滚
 *
 * @see Issue #102
 */
import { db } from '@/data/db';
import type { ScenarioRecord, HarnessRecord } from '@/data/db';
import { createQuoteSnapshot, loadQuoteSnapshots, type QuoteSnapshot } from './quote_snapshot';
import type { SettingsSnapshot } from '@/store/settingsSnapshotStore';
import type { CostRates, MetalPrices } from '@/types/project';
import type { HarnessResult } from '@/types/harness';

/** 快照链条：一个冻结动作产生的所有快照 */
export interface SnapshotChain {
  scenarioId: string;
  frozenAt: string;
  settingsSnapshotId: string;
  quoteSnapshotId: string | null;
  settingsSnapshot?: SettingsSnapshot;
  quoteSnapshot?: QuoteSnapshot | null;
}

/** 场景元数据中的快照引用 */
export interface ScenarioSnapshotMeta {
  settingsSnapshotId?: string;
  quoteSnapshotId?: string;
  snapshotChainId?: string;
}

/**
 * 在场景冻结时创建全量快照
 *
 * @param scenarioId - 被冻结的场景ID
 * @param settingsData - 当前全局参数
 * @param options - 可选的用户ID和备注
 * @returns 快照链条
 */
export async function createFreezeSnapshot(
  scenarioId: string,
  settingsData: {
    costRates: CostRates;
    metalPrices: MetalPrices;
    annualDropRate?: number;
    [key: string]: unknown;
  },
  options?: { userId?: string; note?: string }
): Promise<SnapshotChain> {
  const scenario = await db.scenarios.get(scenarioId);
  if (!scenario) {
    throw new Error(`场景 ${scenarioId} 不存在`);
  }

  const now = new Date().toISOString();
  const chainId = `chain-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

  // 1. 创建参数快照 (B13)
  const settingsSnapshotId = `snap-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const settingsSnapshot: SettingsSnapshot = {
    id: settingsSnapshotId,
    timestamp: now,
    reason: 'pre_quote',
    userId: options?.userId,
    data: {
      costRates: settingsData.costRates,
      metalPrices: settingsData.metalPrices,
      annualDropRate: settingsData.annualDropRate as number | undefined,
    },
    summary: `场景冻结快照: ${scenario.scenarioName} (${scenario.scenarioCode})`,
    projectId: scenario.projectId,
    scenarioId,
  };

  try {
    await db.table('settingsSnapshots').add(settingsSnapshot);
  } catch {
    console.warn('settingsSnapshots table not available');
  }

  // 2. 创建报价快照 (B4) — 如果有线束结果
  let quoteSnapshotId: string | null = null;
  let quoteSnapshot: QuoteSnapshot | null = null;

  const harnesses: HarnessRecord[] = await db.harnesses
    .where('scenarioId').equals(scenarioId)
    .toArray();

  const harnessesWithResults = harnesses.filter((h) => h.result);

  if (harnessesWithResults.length > 0) {
    const harnessResults = harnessesWithResults.map((h) => ({
      harnessId: h.harnessId,
      harnessName: h.harnessName,
      result: h.result as HarnessResult,
    }));

    const totalMaterialCost = harnessResults.reduce(
      (sum, h) => sum + (h.result.materialCost ?? 0), 0
    );
    const totalExFactoryPrice = harnessResults.reduce(
      (sum, h) => sum + (h.result.exFactoryPrice ?? 0), 0
    );
    const totalDeliveredPrice = harnessResults.reduce(
      (sum, h) => sum + (h.result.deliveredPrice ?? 0), 0
    );
    const totalCopperWeight = harnessResults.reduce(
      (sum, h) => sum + (h.result.copperWeight ?? 0), 0
    );
    const totalAluminumWeight = harnessResults.reduce(
      (sum, h) => sum + (h.result.aluminumWeight ?? 0), 0
    );

    // 获取最新版本号
    const existingSnapshots = await loadQuoteSnapshots({ scenarioId, limit: 1 });
    const nextVersion = existingSnapshots.length > 0
      ? (existingSnapshots[0]!.version ?? 0) + 1
      : 1;

    quoteSnapshot = await createQuoteSnapshot({
      quoteId: `q-${scenarioId}-${nextVersion}`,
      scenarioId,
      projectId: scenario.projectId,
      version: nextVersion,
      label: `冻结快照 v${nextVersion}`,
      params: {
        costRates: settingsData.costRates,
        metalPrices: settingsData.metalPrices,
        annualDropRate: settingsData.annualDropRate as number ?? 0,
        lifecycleYears: scenario.lifecycleYears,
      },
      results: {
        harnessResults,
        totalMaterialCost,
        totalExFactoryPrice,
        totalDeliveredPrice,
        totalCopperWeight,
        totalAluminumWeight,
      },
      notes: options?.note || `场景 ${scenario.scenarioCode} 冻结时自动创建`,
    });

    quoteSnapshotId = quoteSnapshot.id;
  }

  // 3. 将快照ID写入场景元数据
  const snapshotMeta: ScenarioSnapshotMeta = {
    settingsSnapshotId,
    quoteSnapshotId: quoteSnapshotId ?? undefined,
    snapshotChainId: chainId,
  };

  await db.scenarios.update(scenarioId, {
    updatedAt: now,
    // 使用展开字段存储快照引用
    ...(snapshotMeta as any),
  });

  return {
    scenarioId,
    frozenAt: now,
    settingsSnapshotId,
    quoteSnapshotId,
    settingsSnapshot,
    quoteSnapshot,
  };
}

/**
 * 获取场景的快照链条
 */
export async function getSnapshotChain(
  scenarioId: string
): Promise<SnapshotChain | null> {
  const scenario = await db.scenarios.get(scenarioId);
  if (!scenario) return null;

  const meta = scenario as any as ScenarioSnapshotMeta & ScenarioRecord;
  if (!meta.settingsSnapshotId) return null;

  let settingsSnapshot: SettingsSnapshot | undefined;
  try {
    settingsSnapshot = await db.table('settingsSnapshots').get(meta.settingsSnapshotId);
  } catch { /* table may not exist */ }

  let quoteSnapshot: QuoteSnapshot | null = null;
  if (meta.quoteSnapshotId) {
    try {
      quoteSnapshot = await db.table('quoteSnapshots').get(meta.quoteSnapshotId) ?? null;
    } catch { /* table may not exist */ }
  }

  return {
    scenarioId,
    frozenAt: scenario.frozenAt ?? scenario.updatedAt,
    settingsSnapshotId: meta.settingsSnapshotId!,
    quoteSnapshotId: meta.quoteSnapshotId ?? null,
    settingsSnapshot,
    quoteSnapshot,
  };
}

/**
 * 从快照恢复参数 — 返回快照中的参数数据，由调用方决定如何应用
 */
export async function restoreFromSnapshot(
  settingsSnapshotId: string
): Promise<SettingsSnapshot['data'] | null> {
  try {
    const snapshot: SettingsSnapshot | undefined = await db
      .table('settingsSnapshots')
      .get(settingsSnapshotId);
    return snapshot?.data ?? null;
  } catch {
    return null;
  }
}

/**
 * 获取场景的所有历史快照（用于版本对比）
 */
export async function getScenarioSnapshotHistory(
  scenarioId: string,
  limit = 50
): Promise<{ settings: SettingsSnapshot[]; quotes: QuoteSnapshot[] }> {
  let settings: SettingsSnapshot[] = [];
  let quotes: QuoteSnapshot[] = [];

  try {
    settings = await db.table('settingsSnapshots')
      .where('scenarioId' as any).equals(scenarioId)
      .reverse()
      .limit(limit)
      .toArray();
  } catch { /* ignore */ }

  try {
    quotes = await loadQuoteSnapshots({ scenarioId, limit });
  } catch { /* ignore */ }

  return { settings, quotes };
}
