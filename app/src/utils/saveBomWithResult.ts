/**
 * saveBomWithResult - Persist BOM changes from BomWorkbookPage with computed results.
 *
 * This wraps the BomWorkbookPage save flow to also write `result` into Dexie,
 * ensuring Dashboard/QuotePage read fresh cached data.
 *
 * Usage in BomWorkbookPage.handleSaveAll:
 *   import { saveBomHarnessWithResult } from '@/utils/saveBomWithResult';
 *   await saveBomHarnessWithResult(harness.id, modified, scenario);
 */
import { db } from '@/data/db';
import type { ScenarioRecord } from '@/data/db';
import { computeInternalHarnessCost, INTERNAL_DEFAULTS, mapInternalToHarnessResult } from '@/engine/harness_costing';
import type { HarnessInput, HarnessResult } from '@/types/harness';

/**
 * Save a single harness with recomputed result.
 * Called per-harness during BomWorkbookPage batch save.
 *
 * @param recordId - The Dexie record ID (harness.id)
 * @param input - The modified HarnessInput
 * @param scenario - The current scenario (for cost rates)
 * @returns The computed result, or null if computation failed
 */
export async function saveBomHarnessWithResult(
  recordId: string,
  input: HarnessInput,
  scenario: ScenarioRecord | null,
): Promise<HarnessResult | null> {
  let result: HarnessResult | null = null;

  if (scenario?.config?.metalPrices) {
    try {
      result = mapInternalToHarnessResult(
        computeInternalHarnessCost(
          input,
          scenario.config.internalRates ?? INTERNAL_DEFAULTS,
          scenario.config.metalPrices,
        ),
      );
    } catch (e) {
      console.warn('[saveBomHarnessWithResult] compute failed for', input.harnessId, e);
    }
  }

  await db.harnesses.update(recordId, {
    input,
    harnessName: input.harnessName,
    result: result ?? undefined,
    updatedAt: new Date().toISOString(),
  });

  return result;
}

/**
 * Batch save multiple harnesses with results.
 * Returns the count of successfully saved harnesses.
 */
export async function batchSaveBomWithResults(
  changes: Array<{ recordId: string; input: HarnessInput }>,
  scenario: ScenarioRecord | null,
): Promise<number> {
  let count = 0;
  for (const { recordId, input } of changes) {
    await saveBomHarnessWithResult(recordId, input, scenario);
    count++;
  }
  return count;
}
