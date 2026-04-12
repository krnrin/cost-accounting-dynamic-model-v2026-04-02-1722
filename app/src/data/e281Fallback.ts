/**
 * data/e281Fallback.ts — Re-export from canonical utils/e281Fallback.ts
 *
 * FIX #24: Two copies existed with slightly different implementations.
 * utils/e281Fallback.ts is the canonical version (more complete, cleaner types).
 * This file re-exports everything to maintain backward compatibility for
 * existing imports from '@/data/e281Fallback'.
 */
export {
  applyE281ScenarioFallback,
  getScenarioCustomerQuoteSnapshots,
  getScenarioVehicleConfigs,
  getScenarioVehicleConfigMeta,
  getE281ScenarioOnetimeCostInputs,
  getScenarioOnetimeCostFallback,
  isE281ProjectId,
} from '@/utils/e281Fallback';
