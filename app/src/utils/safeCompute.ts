/**
 * safeCompute - Wrap engine computation calls with error handling.
 *
 * Instead of letting computeHarnessCost throw and crash the page,
 * this wrapper catches errors, logs them, and returns null.
 *
 * Usage:
 *   import { safeComputeHarnessCost } from '@/utils/safeCompute';
 *   const result = safeComputeHarnessCost(input, costRates, metalPrices);
 *   if (!result) { /* handle gracefully * / }
 */
import { computeInternalHarnessCost, computeInternalProjectFromHarnesses } from '@/engine/harness_costing';
import type { HarnessInput, InternalHarnessResult } from '@/types/harness';
import type { MetalPrices, InternalCostRates } from '@/types/project';

export function safeComputeHarnessCost(
  input: HarnessInput,
  _costRates: InternalCostRates,
  metalPrices: MetalPrices,
  context?: string,
): InternalHarnessResult | null {
  try {
    return computeInternalHarnessCost(input, _costRates, metalPrices);
  } catch (error) {
    console.error(
      `[safeCompute] computeInternalHarnessCost failed for ${input.harnessId}${context ? ` (${context})` : ''}:`,
      error,
    );
    return null;
  }
}

export function safeComputeInternalHarnessCost(
  input: HarnessInput,
  internalRates: InternalCostRates,
  metalPrices: MetalPrices,
  context?: string,
): InternalHarnessResult | null {
  try {
    return computeInternalHarnessCost(input, internalRates, metalPrices);
  } catch (error) {
    console.error(
      `[safeCompute] computeInternalHarnessCost failed for ${input.harnessId}${context ? ` (${context})` : ''}:`,
      error,
    );
    return null;
  }
}

export function safeComputeProjectFromHarnesses(
  results: InternalHarnessResult[],
): ReturnType<typeof computeInternalProjectFromHarnesses> | null {
  try {
    return computeInternalProjectFromHarnesses(results);
  } catch (error) {
    console.error('[safeCompute] computeInternalProjectFromHarnesses failed:', error);
    return null;
  }
}

export function safeComputeInternalProjectFromHarnesses(
  results: InternalHarnessResult[],
): ReturnType<typeof computeInternalProjectFromHarnesses> | null {
  try {
    return computeInternalProjectFromHarnesses(results);
  } catch (error) {
    console.error('[safeCompute] computeInternalProjectFromHarnesses failed:', error);
    return null;
  }
}

/**
 * Batch compute with error isolation.
 * Failed harnesses are skipped (returned as null), not blocking others.
 */
export function batchSafeCompute(
  inputs: HarnessInput[],
  costRates: InternalCostRates,
  metalPrices: MetalPrices,
): Array<InternalHarnessResult | null> {
  return inputs.map(input => safeComputeHarnessCost(input, costRates, metalPrices, 'batch'));
}

/**
 * Batch compute internal engine with error isolation.
 */
export function batchSafeComputeInternal(
  inputs: HarnessInput[],
  internalRates: InternalCostRates,
  metalPrices: MetalPrices,
): Array<InternalHarnessResult | null> {
  return inputs.map(input => safeComputeInternalHarnessCost(input, internalRates, metalPrices, 'batch'));
}
