import type { HarnessResult } from '@/types/harness';
import type { CustomerQuoteSnapshot } from '@/types/project';

export function applyCustomerQuoteSnapshot(
  result: HarnessResult,
  snapshot?: CustomerQuoteSnapshot,
): HarnessResult {
  if (!snapshot) return result;

  return {
    ...result,
    deliveredPrice: snapshot.deliveredPrice,
    exFactoryPrice: snapshot.exFactoryPrice ?? result.exFactoryPrice,
  };
}
