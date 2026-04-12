/**
 * scenarioConfigSync — Batch recompute all harness results after scenario config changes.
 *
 * Call this after:
 * - Cost rate changes (laborRate, mfgRate, etc.)
 * - Metal price changes (copper, aluminum)
 * - Any scenario config modification
 *
 * Usage:
 *   import { batchResyncScenario } from '@/utils/scenarioConfigSync';
 *   const updated = await batchResyncScenario(scenarioId);
 *   Toast.success(`Updated ${updated} harness results`);
 */
import { syncAllHarnessResults } from '@/hooks/useHarnessSync';

export { syncAllHarnessResults };

/**
 * Batch resync all harness results for a scenario.
 * Returns the number of harnesses that were updated.
 */
export async function batchResyncScenario(scenarioId: string): Promise<number> {
  if (!scenarioId) return 0;
  return syncAllHarnessResults(scenarioId);
}
