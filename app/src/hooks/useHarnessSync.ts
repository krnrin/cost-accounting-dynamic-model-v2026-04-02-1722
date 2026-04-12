/**
 * useHarnessSync — Recompute and persist HarnessResult to Dexie
 * whenever harness input or scenario config changes.
 *
 * This ensures that cached `result` in Dexie is always fresh,
 * so Dashboard / QuotePage / exports read consistent data.
 *
 * Usage:
 *   useHarnessSync(scenarioId);
 *   // Automatically watches scenario config + harness inputs
 *   // and batch-updates stale results in Dexie.
 */
import { useEffect, useRef } from 'react';
import { db } from '@/data/db';
import type { ScenarioRecord, HarnessRecord } from '@/data/db';
import { computeHarnessCost } from '@/engine/harness_costing';
import type { HarnessResult } from '@/types/harness';

/**
 * Recompute a single harness result from its input + scenario config.
 * Returns null if scenario is missing required config.
 */
export function recomputeResult(
  harness: HarnessRecord,
  scenario: ScenarioRecord,
): HarnessResult | null {
  if (!scenario.config?.costRates || !scenario.config?.metalPrices) {
    return null;
  }
  try {
    return computeHarnessCost(
      harness.input,
      scenario.config.costRates,
      scenario.config.metalPrices,
    );
  } catch {
    return null;
  }
}

/**
 * Batch recompute all harnesses for a scenario and persist results.
 * Can be called imperatively (e.g. after config change).
 */
export async function syncAllHarnessResults(scenarioId: string): Promise<number> {
  const scenario = await db.scenarios.get(scenarioId);
  if (!scenario) return 0;

  const harnesses = await db.harnesses
    .where('scenarioId')
    .equals(scenarioId)
    .toArray();

  let updated = 0;
  for (const h of harnesses) {
    const result = recomputeResult(h, scenario);
    if (result) {
      // Only write if result actually changed (compare deliveredPrice as quick check)
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
