/**
 * saveHarnessWithResult — Persist harness input AND recomputed result atomically.
 *
 * Solves the stale-result problem: previously HarnessEditPage saved only
 * the `input` field, leaving `result` outdated. Dashboard/QuotePage then
 * read stale cached results or had to recompute on every render.
 *
 * Usage:
 *   import { saveHarnessWithResult } from '@/utils/saveHarnessWithResult';
 *   await saveHarnessWithResult({ projectId, scenarioId, input, isNew });
 */
import { db } from '@/data/db';
import type { HarnessRecord, ScenarioRecord } from '@/data/db';
import { computeHarnessCost } from '@/engine/harness_costing';
import type { HarnessInput, HarnessResult } from '@/types/harness';

export interface SaveHarnessOptions {
  /** Dexie project ID */
  projectId: string;
  /** Scenario ID to associate the harness with */
  scenarioId: string;
  /** The harness input data to persist */
  input: HarnessInput;
  /** True when creating a new harness (generates new UUID) */
  isNew: boolean;
  /** Existing harness record (required when isNew=false) */
  existingRecord?: HarnessRecord;
}

export interface SaveHarnessReturn {
  /** The Dexie record ID */
  recordId: string;
  /** The recomputed result (null if scenario config missing) */
  result: HarnessResult | null;
}

/**
 * Save harness input and recomputed result to Dexie in one operation.
 *
 * 1. Loads the scenario config (costRates + metalPrices)
 * 2. Recomputes HarnessResult from the input
 * 3. Writes both input and result to Dexie
 */
export async function saveHarnessWithResult(
  opts: SaveHarnessOptions,
): Promise<SaveHarnessReturn> {
  const { projectId, scenarioId, input, isNew, existingRecord } = opts;
  const now = new Date().toISOString();

  // Load scenario for cost rates
  let result: HarnessResult | null = null;
  if (scenarioId) {
    const scenario = await db.scenarios.get(scenarioId);
    if (scenario?.config?.costRates && scenario?.config?.metalPrices) {
      try {
        result = computeHarnessCost(
          input,
          scenario.config.costRates,
          scenario.config.metalPrices,
        );
      } catch (e) {
        console.warn('[saveHarnessWithResult] recompute failed:', e);
      }
    }
  }

  if (isNew) {
    const recordId = crypto.randomUUID();
    await db.harnesses.put({
      id: recordId,
      projectId,
      scenarioId: scenarioId || '',
      eopYear: null,
      harnessId: input.harnessId,
      harnessName: input.harnessName || input.harnessId,
      input,
      result: result ?? undefined,
      updatedAt: now,
    });
    return { recordId, result };
  }

  // Update existing
  if (!existingRecord) {
    throw new Error('existingRecord is required when isNew=false');
  }
  await db.harnesses.update(existingRecord.id, {
    input,
    harnessName: input.harnessName,
    result: result ?? undefined,
    updatedAt: now,
  });
  return { recordId: existingRecord.id, result };
}
