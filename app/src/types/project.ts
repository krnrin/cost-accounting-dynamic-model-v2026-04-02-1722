/**
 * 项目级类型定义
 */

import type { NreData } from './quote';

export const PROJECT_FACTORY_IDS = ['K1', 'K2', 'K3', 'K4', 'K5', 'K6', 'K7'] as const;
export type ProjectFactoryId = (typeof PROJECT_FACTORY_IDS)[number];
export const DEFAULT_PROJECT_FACTORY_ID: ProjectFactoryId = 'K3';

export const MATERIAL_PRICE_SOURCE_ORDER = [
  'final_negotiated',
  'customer_agreed',
  'supplier_quoted',
  'system',
  'batch',
  'amortized',
  'customer_designated',
  'metal_linked',
  'lifecycle_amortized',
  'auxiliary_purchase',
  'bom',
] as const;

export type MaterialPriceSource = (typeof MATERIAL_PRICE_SOURCE_ORDER)[number];

export interface PriceSourceCandidate {
  source: MaterialPriceSource;
  price: number;
  available: boolean;
  reason?: string;
}

export interface ResolvedPriceSource {
  source: MaterialPriceSource;
  price: number;
  priority: number;
  fallbackApplied: boolean;
  candidates: PriceSourceCandidate[];
}

export function getMaterialPriceSourcePriority(source: MaterialPriceSource): number {
  return MATERIAL_PRICE_SOURCE_ORDER.indexOf(source);
}

export function buildPriceSourceCandidate(
  source: MaterialPriceSource,
  price: number,
  reason?: string,
): PriceSourceCandidate {
  return {
    source,
    price,
    available: price > 0,
    reason,
  };
}

export function sortPriceSourceCandidates(candidates: PriceSourceCandidate[]): PriceSourceCandidate[] {
  return [...candidates].sort(
    (a, b) => getMaterialPriceSourcePriority(a.source) - getMaterialPriceSourcePriority(b.source),
  );
}

export function resolveMaterialPriceSource(candidates: PriceSourceCandidate[]): ResolvedPriceSource {
  const sorted = sortPriceSourceCandidates(candidates);
  const resolved = sorted.find((candidate) => candidate.available && candidate.price > 0) ?? {
    source: 'bom' as MaterialPriceSource,
    price: 0,
    available: false,
    reason: 'no_available_price',
  };

  return {
    source: resolved.source,
    price: resolved.price,
    priority: Math.max(0, getMaterialPriceSourcePriority(resolved.source)),
    fallbackApplied: sorted.length > 0 && sorted[0]?.source !== resolved.source,
    candidates: sorted,
  };
}

/** 7 工厂内部费率结构 */
export type InternalFactoryRatesMap = Record<ProjectFactoryId, InternalCostRates>;

export interface CustomerQuoteSnapshot {
  deliveredPrice: number;
  exFactoryPrice?: number;
}

/** 成本费率配置（对外客户报价） */
export interface CostRates {
  /** 直接人工费率 (元/小时) — 默认 35 */
  laborRate: number;
  /** 制造费率 (元/小时) — 默认 46.69 */
  mfgRate: number;
  /** 废品率 — 默认 0.01 (1%) */
  wasteRate: number;
  /** 管理费率 — 默认 0.06 (6%)，基数不含废品 */
  mgmtRate: number;
  /** 利润率 — 默认 0.056627 (5.6627%)，基数含废品 */
  profitRate: number;
}

/** 内部核算费率 (对内实绩精算) */
export interface InternalCostRates {
  /** 直接人工费率 (元/h) */
  laborRate: number;

  /** 6D MOH 制造费率分解 (元/h) */
  indirectLaborRate: number;
  lowValueConsumablesRate: number;
  materialConsumptionRate: number;
  factoryAmortizationRate: number;
  automationAmortizationRate: number;
  otherOverheadRate: number;

  /** 材料损耗率 */
  materialWasteRate: number;
}

/** 金属价格 (元/吨) */
export interface MetalPrices {
  copper: number;
  aluminum: number;
}

/** 年度产量计划 */
export interface VolumeSchedule {
  year: number;
  volume: number;
  remark?: string;
}

/** 项目元信息 */
export interface ProjectMeta {
  id?: string;
  projectCode: string;
  projectName: string;
  customer: string;
  platform?: string;
  lifecycleYears?: number;
  createdAt: string;
  updatedAt: string;
  status: 'draft' | 'quoted' | 'awarded' | 'production' | 'eol';
}

/** Level 1 系数近似参数 (成本分解系数) */
export interface Level1Coefficients {
  materialRatio: number;
  laborRatio: number;
  mfgRatio: number;
  packagingRatio: number;
  freightRatio: number;
}

/** 项目配置 */
export interface ProjectConfig {
  costRates: CostRates;
  internalRates?: InternalCostRates;
  internalFactoryRates?: Partial<InternalFactoryRatesMap>;
  selectedFactory?: ProjectFactoryId;
  metalPrices: MetalPrices;
  volumes: VolumeSchedule[];
  annualDropRate: number;
  nreData?: NreData;
  materialComposition?: {
    connector: number;
    copper: number;
    aluminum: number;
    other: number;
  };
  equipmentConfig?: EquipmentConfig;
  bomClassificationRules?: BomClassificationRule[];
  costStructure?: CostStructureSchema;
  factories?: FactoryConfig[];
  allocationConfig?: AllocationConfig;
  level1Coefficients?: Level1Coefficients;
  rebate?: RebateConfig;
  customerQuoteSnapshots?: Record<string, CustomerQuoteSnapshot>;
}

/** 工厂配置 */
export interface FactoryConfig {
  factoryId: string;
  factoryName: string;
  costRates: CostRates;
  internalRates?: InternalCostRates;
  efficiencyFactor: number;
  isBase?: boolean;
  remark?: string;
}

/** 设备投资配置 */
export interface EquipmentConfig {
  sharedInvestment: number;
  dedicatedInvestment: number;
  annualDepreciation: number;
  depreciationYears: number;
  residualRate?: number;
}

/** 完整项目定义 */
export interface Project {
  meta: ProjectMeta;
  config?: ProjectConfig;
}

/** BOM 分类规则 */
export interface BomClassificationRule {
  category: 'wire' | 'connector' | 'terminal' | 'ipt_terminal' | 'bracket_rubber' | 'tape_tube' | 'other';
  patterns: string[];
  excludePatterns?: string[];
  matchFields?: ('partName' | 'partNo' | 'spec' | 'itemCategory')[];
  priority?: number;
}

/** 成本项计算方式 */
export type CostItemCalcMethod =
  | 'bom_sum'
  | 'rate_x_hours'
  | 'rate_x_base'
  | 'direct'
  | 'fixed_per_unit'
  | 'custom_formula';

/** 单个成本项定义 */
export interface CostItemDef {
  key: string;
  label: string;
  calcMethod: CostItemCalcMethod;
  rate?: number;
  baseRef?: string[];
  fixedAmount?: number;
  inExFactory?: boolean;
  isAddon?: boolean;
  order?: number;
  visibleInternal?: boolean;
  visibleExternal?: boolean;
}

/** 成本结构 Schema */
export interface CostStructureSchema {
  name: string;
  version?: string;
  items: CostItemDef[];
}

/** 返点/返利配置 */
export interface RebateConfig {
  totalAmount: number;
  label: string;
  yearDistribution: number[];
}

/** 间接费用分摊驱动因子 */
export type AllocationDriver =
  | 'hours'
  | 'revenue'
  | 'material_cost'
  | 'direct'
  | 'volume'
  | 'equal';

/** 分摊配置项 */
export interface AllocationConfig {
  equipment: AllocationDriver;
  rnd: AllocationDriver;
  indirectLabor: AllocationDriver;
  management: AllocationDriver;
}
