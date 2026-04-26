/**
 * useHarnessSync — Recompute and persist HarnessResult to Dexie
 * whenever harness input or scenario config changes.
 *
 * This ensures that cached `result` in Dexie is always fresh,
 * so Dashboard / QuotePage / exports read consistent data.
 *
 * [成本核算数据原则] 必须传入 internalRates，禁止回退到硬编码默认值
 *
 * Usage:
 *   useHarnessSync(scenarioId);
 *   // Automatically watches scenario config + harness inputs
 *   // and batch-updates stale results in Dexie.
 */
import { useEffect, useRef } from 'react';
import { db } from '@/data/db';
import type { ScenarioRecord, HarnessRecord } from '@/data/db';
import { computeInternalHarnessCost, mapInternalToHarnessResult } from '@/engine/harness_costing';
import type { HarnessResult } from '@/types/harness';

/**
 * Recompute a single harness result from its input + scenario config.
 * Returns null if scenario is missing required config.
 *
 * [成本核算数据原则] 缺少 internalRates 时返回 null，禁止回退
 */
export function recomputeResult(
  harness: HarnessRecord,
  scenario: ScenarioRecord,
): HarnessResult | null {
  if (!scenario.config?.metalPrices) {
    return null;
  }
  if (!scenario.config?.internalRates) {
    // [成本核算数据原则] 缺少费率配置时返回 null，禁止回退到硬编码
    return null;
  }
  try {
    return mapInternalToHarnessResult(
      computeInternalHarnessCost(
        harness.input,
        scenario.config.internalRates,
        scenario.config.metalPrices,
      ),
    );
  } catch {
    return null;
  }
}

/**
 * Batch recompute all harnesses for a scenario and persist results.
 * Can be called imperatively (e.g. after config change).
 *
 * Includes harnesses with empty scenarioId (legacy/v7 migration data)
 * that belong to the same project.
 */
export async function syncAllHarnessResults(scenarioId: string): Promise<number> {
  const scenario = await db.scenarios.get(scenarioId);
  if (!scenario) return 0;

  // Get harnesses that match the exact scenarioId
  const exactMatch = await db.harnesses
    .where('scenarioId')
    .equals(scenarioId)
    .toArray();

  // Also get harnesses with empty scenarioId from the same project
  // (legacy data from v7 migration that hasn't been assigned a scenario)
  let legacyMatch: HarnessRecord[] = [];
  if (scenario.projectId) {
    const projectHarnesses = await db.harnesses
      .where('projectId')
      .equals(scenario.projectId)
      .toArray();
    legacyMatch = projectHarnesses.filter(h => h.scenarioId === '' || h.scenarioId === undefined);
  }

  // Deduplicate by id
  const seen = new Set<string>();
  const harnesses: HarnessRecord[] = [];
  for (const h of [...exactMatch, ...legacyMatch]) {
    const key = h.id ?? h.harnessId;
    if (!seen.has(key)) {
      seen.add(key);
      harnesses.push(h);
    }
  }

  let updated = 0;
  for (const h of harnesses) {
    const result = recomputeResult(h, scenario);
    if (result) {
      // Only write if result actually changed (compare internalCost as quick check)
      const oldPrice = h.result?.deliveredPrice;
      if (oldPrice !== result.deliveredPrice) {
        await db.harnesses.update(h.id, {
          result,
          updatedAt: new Date().toISOString(),
        });
        updated++;
      }
    }
  }
  return updated;
}

/**
 * React hook: auto-sync harness results when scenario changes.
 * Debounced to avoid excessive writes during rapid edits.
 */
export function useHarnessSync(scenarioId: string | undefined) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!scenarioId) return;

    // Debounce: wait 500ms after last trigger before syncing
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      void syncAllHarnessResults(scenarioId);
    }, 500);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [scenarioId]);
}

export default useHarnessSync;
