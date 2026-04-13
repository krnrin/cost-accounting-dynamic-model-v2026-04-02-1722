/**
 * 引擎集成 Hooks 统一入口
 *
 * 每个 hook 桥接一个 engine 模块到页面组件：
 *   useScenarioLifecycle → scenario_lifecycle  → ProjectScenariosPage
 *   useAlertWorkflow     → alert_workflow      → AlertsPage
 *   useBomNormalizer     → bom_normalizer      → BomDiffPage
 *   useSmartPaste        → smart_paste          → BomWorkbookPage / HarnessEditPage
 *   useCascadeImpact     → cascade_impact       → ChangeEnginePage
 */
export { useScenarioLifecycle, getTransitionLabel, getTransitionConfirmText, getStatusLabel } from './useScenarioLifecycle';
export { useAlertWorkflow, SEVERITY_DISPLAY } from './useAlertWorkflow';
export { useBomNormalizer, enhancedBomCompare, BOM_TARGET_COLUMNS } from './useBomNormalizer';
export { useSmartPaste } from './useSmartPaste';
export { useCascadeImpact } from './useCascadeImpact';
