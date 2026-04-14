/**
 * Hooks barrel export — all custom hooks
 * [FIX P2-6] Updated to export all 33 hooks (was only 5)
 */

// === Core data hooks ===
export { useDashboardData } from './useDashboardData';
export { useDashboardAggregator } from './useDashboardAggregator';
export { useScenarioData } from './useScenarioData';
export { useHarnessSync } from './useHarnessSync';
export { useBomNormalizer } from './useBomNormalizer';

// === Scenario lifecycle ===
export { useScenarioLifecycle } from './useScenarioLifecycle';
export { useScenarioClone } from './useScenarioClone';
export { useScenarioDeepCompare } from './useScenarioDeepCompare';

// === Snapshot & version ===
export { useSnapshotIntegration } from './useSnapshotIntegration';
export { useBomSnapshot } from './useBomSnapshot';
export { useQuoteVersionCompare } from './useQuoteVersionCompare';
export { useVersionGovernance } from './useVersionGovernance';
export { useSimulationSnapshot } from './useSimulationSnapshot';

// === Gap analysis & pricing ===
export { useGapAnalysis } from './useGapAnalysis';
export { useMetalPriceReactor } from './useMetalPriceReactor';
export { useProgressPriceTracker } from './useProgressPriceTracker';

// === Change propagation ===
export { useChangePropagation } from './useChangePropagation';
export { useChangeOrchestrator } from './useChangeOrchestrator';
export { useChangeTrail } from './useChangeTrail';
export { useCascadeImpact } from './useCascadeImpact';
export { useBomDiff } from './useBomDiff';

// === Alerts & tracking ===
export { useAlertWorkflow } from './useAlertWorkflow';
export { useAlertTracking } from './useAlertTracking';
export { useAuditTrace } from './useAuditTrace';
export { useRecoveryLedger } from './useRecoveryLedger';

// === Manager & insights ===
export { useManagerInsights } from './useManagerInsights';

// === Permissions & settings ===
export { usePermission } from './usePermission';
export { useParamPermission } from './useParamPermission';
export { useSettingsPublishFlow } from './useSettingsPublishFlow';

// === UI & utilities ===
export { useTheme } from './useTheme';
export { useSmartPaste } from './useSmartPaste';
export { useGlobalErrorHandler } from './useGlobalErrorHandler';
export { useLocalPatchOverrides } from './useLocalPatchOverrides';
