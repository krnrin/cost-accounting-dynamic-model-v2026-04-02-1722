/**
 * @module types
 * 全局类型系统 — 引擎、数据层、UI 共享
 */

export type {
  CostRates, MetalPrices, VolumeSchedule, ProjectMeta, Project, ProjectConfig,
  FactoryConfig, EquipmentConfig, BomClassificationRule, CostStructureSchema,
  CostItemDef, CostItemCalcMethod, AllocationConfig, AllocationDriver,
  Level1Coefficients,
} from './project';
export type {
  BomItem, WireItem, PackagingCost, FreightCost, HarnessInput,
  HarnessResult, MaterialBreakdown, ProjectHarnessResult,
} from './harness';
export type {
  GeelyRates, GeelyTemplateResult, InternalTemplateResult,
  QuoteSheetMeta, QuoteSheet, TemplatePreset,
  NreData, ChangeCategory, ChangePricingResult, ChangeItem,
  ChangeSummary, AnnualImpact, AnnualImpactYear,
  MetalContract, MetalDelta, MetalEscalationResult, MetalSensitivityMatrix,
  AnnualDropResult,
} from './quote';
