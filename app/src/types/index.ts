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
  NreData,
  ChangeCategory, ChangePricingResult, ChangeItem,
  CostDelta, ChangeSummary, AnnualImpact, AnnualImpactYear,
  MetalContract, MetalDelta, MetalEscalationResult, MetalSensitivityMatrix,
  AnnualDropResult,
} from './quote';
export type { AuditLog } from './audit';
export type {
  WorkbookSheetType, WorkbookRowBase, BomSheetRow, AssemblyPartRow,
  SecondaryMaterialRow, KskBomRow, ChangeHistoryRow,
} from './bomWorkbook';
// financial_schema.ts: FactoryConfig conflicts with project.ts, use selective re-export
export type {
  FactoryLaborRates, FactoryMOHComponents,
  FactoryConfig as FinancialFactoryConfig,
  GapStatus, FinancialBenchmark, PricingContext,
} from './financial_schema';
export type {
  ConnectorPricingStatus, ConnectorPricingRecord, ConnectorPricingPayload,
  WirePricingRecord, WirePricingPayload, DevPartCategory, MoldInfo,
  DevPartPricingRecord, DevPartPricingPayload, DevPartMoldPayload,
  AuxiliaryPartRecord, AuxiliaryPartPayload,
  PriceDiscrepancyStatus, PricePartCategory, DiscrepancyResolutionType,
  PriceDiscrepancyRecord, PriceDiscrepancyPayload,
  CategoryPriceSummary, DevPartPriceSummary,
  LifecyclePriceBreakdown, PriceQueryResult,
} from './pricing';
export type {
  VersionStatus, VersionSnapshot, VersionRecord,
  VersionDiffItem, VersionDiff,
} from './version';
export { VERSION_TRANSITIONS, VERSION_STATUS_LABELS, validateTransition, isVersionEditable } from './version';
