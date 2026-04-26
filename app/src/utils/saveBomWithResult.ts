/**
 * saveBomWithResult - Persist BOM changes from BomWorkbookPage with computed results.
 *
 * This wraps the BomWorkbookPage save flow to also write `result` into Dexie,
 * ensuring Dashboard/QuotePage read fresh cached data.
 *
 * [成本核算数据原则] 必须传入 internalRates，禁止回退到硬编码默认值
 *
 * Usage in BomWorkbookPage.handleSaveAll:
 *   import { saveBomHarnessWithResult } from '@/utils/saveBomWithResult';
 *   await saveBomHarnessWithResult(harness.id, modified, scenario);
 */
import { db } from '@/data/db';
import type { ScenarioRecord } from '@/data/db';
import { computeInternalHarnessCost, mapInternalToHarnessResult } from '@/engine/harness_costing';
import type { HarnessInput, HarnessResult } from '@/types/harness';

/**
 * Save a single harness with recomputed result.
 * Called per-harness during BomWorkbookPage batch save.
 *
 * [成本核算数据原则] 缺少 internalRates 时返回 null，禁止回退
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

  if (scenario?.config?.metalPrices && scenario?.config?.internalRates) {
    try {
      result = mapInternalToHarnessResult(
        computeInternalHarnessCost(
          input,
          scenario.config.internalRates,
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
