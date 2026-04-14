/**
 * 报价 & 变更 & 金属联动类型定义
 */

import type { HarnessResult } from './harness';

// ── 吉利报价模板 ──

export type TemplateType = 'geely' | 'byd' | 'generic';

/** 吉利标准费率 */
export interface GeelyRates {
  mgmtRate: number;      // 管理费 (4%)
  financeRate: number;    // 财务费 (4%)
  salesRate: number;      // 销售费 (4%)
  profitRate: number;     // 利润 (4%)
  wasteRate: number;      // 废品率 (1%)
}

/** 吉利模板映射结果 */
export interface GeelyTemplateResult {
  templateName: string;
  harnessId: string;
  harnessName: string;

  A1_rawMaterial: number;
  A2_purchasedParts: number;
  B1_processingFee: number;
  B2_wasteLoss: number;
  C1_managementFee: number;
  C2_financeFee: number;
  C3_salesFee: number;
  D_profit: number;
  E1_borrowedTooling: number;
  E2_newTooling: number;
  F1_borrowedTesting: number;
  F2_newTesting: number;
  G1_borrowedRnd: number;
  G2_newRnd: number;

  directMaterial: number;
  manufacturingCost: number;
  periodExpense: number;
  amortization: number;
  exFactoryPrice: number;
  deliveredPrice: number;

  rates: GeelyRates;
}

/** 比亚迪模板映射结果 */
export interface BydTemplateResult {
  templateName: string;
  harnessId: string;
  harnessName: string;
  directMaterial: number;      // 直接材料
  processingFee: number;       // 加工费 (labor + mfg)
  wasteLoss: number;           // 废品
  managementFee: number;       // 管理费 6%
  profit: number;              // 利润 5%
  exFactoryPrice: number;      // 出厂价
  packagingCost: number;       // 包装费
  freightCost: number;         // 运输费
  deliveredPrice: number;      // 到厂价
  rates: { mgmtRate: number; profitRate: number; wasteRate: number };
}

/** 通用模板映射结果 */
export interface GenericTemplateResult {
  templateName: string;
  harnessId: string;
  harnessName: string;
  materialCost: number;
  laborCost: number;
  mfgCost: number;
  wasteCost: number;
  mgmtFee: number;
  profit: number;
  exFactoryPrice: number;
  packagingCost: number;
  freightCost: number;
  deliveredPrice: number;
  rates: { mgmtRate: number; profitRate: number; wasteRate: number };
}

/** 内部核算模板结果 */
export interface InternalTemplateResult {
  templateName: string;
  harnessId: string;
  harnessName: string;
  vehicleRatio: number;
  copperWeight: number;
  aluminumWeight: number;
  materialCost: number;
  wasteCost: number;
  processHours: number;
  directLabor: number;
  manufacturing: number;
  laborPlusMfg: number;
  mgmtFee: number;
  profit: number;
  exFactoryPrice: number;
  packSubtotal: number;
  freightSubtotal: number;
  deliveredPrice: number;
}

/** NRE 一次性费用数据 */
export interface NreData {
  borrowedTooling?: number;
  newTooling?: number;
  borrowedTesting?: number;
  newTesting?: number;
  borrowedRnd?: number;
  newRnd?: number;
  amortizationVolume?: number;
}

/** 模板预设 */
export interface TemplatePreset {
  name: string;
  structure: string;
  rates: Record<string, number>;
  amortizationFields: string[];
}

// ── 报价单 ──

/** 报价单元信息 */
export interface QuoteSheetMeta {
  projectName: string;
  customer: string;
  quotePerson: string;
  quoteDate: string;
  templateName: string;
  version: string;
  status: string;
}

/** 完整报价单 */
export interface QuoteSheet {
  meta: QuoteSheetMeta;
  harnesses: (GeelyTemplateResult | BydTemplateResult | GenericTemplateResult | InternalTemplateResult)[];
  totals: Record<string, number>;
  harnessCount: number;
}

// ── 变更报价 (设变) ──

/** 变更类型 */
export type ChangeCategory = 'add' | 'remove' | 'modify';

/** 变更报价单项 */
export interface ChangeItem {
  harnessId: string;
  harnessName: string;
  changeCategory: ChangeCategory;
  detailedType: string;
  before: HarnessResult | null;
  after: HarnessResult | null;
  delta: CostDelta;
}

/** 成本差异逐项 */
export interface CostDelta {
  materialCost: number;
  wasteCost: number;
  directLabor: number;
  manufacturing: number;
  laborPlusMfg: number;
  mgmtFee: number;
  profit: number;
  exFactoryPrice: number;
  packSubtotal: number;
  freightSubtotal: number;
  packTotal: number;
  deliveredPrice: number;
  copperWeight: number;
  aluminumWeight: number;
  processHours: number;
}

/** 变更汇总 */
export interface ChangeSummary {
  totalBefore: number;
  totalAfter: number;
  totalDelta: number;
  deltaPercent: number;
  affectedCount: number;
  unchangedCount: number;
  addedCount: number;
  removedCount: number;
  modifiedCount: number;
}

/** 年度影响条目 */
export interface AnnualImpactYear {
  year: number;
  volume: number;
  deltaPerVehicle: number;
  annualImpact: number;
  cumulativeImpact: number;
}

/** 年度影响汇总 */
export interface AnnualImpact {
  years: AnnualImpactYear[];
  totalLifecycleImpact: number;
  totalLifecycleVolume: number;
}

/** 变更报价结果 */
export interface ChangePricingResult {
  changeType: string;
  timestamp: string;
  changes: ChangeItem[];
  summary: ChangeSummary;
  annualImpact: AnnualImpact | null;
  metalPrices?: {
    before: { copper: number; aluminum: number };
    after: { copper: number; aluminum: number };
    delta: { copper: number; aluminum: number };
  };
}

// ── 金属联动 ──

/** 金属联动合同条款 */
export interface MetalContract {
  baseCopperPrice: number;
  baseAluminumPrice: number;
  thresholdPercent: number;
  escalationRatio: number;
  period: 'quarterly' | 'semiannual' | 'annual';
}

/** 单线束金属联动影响 */
export interface MetalDelta {
  harnessId: string;
  harnessName: string;
  vehicleRatio: number;
  copperWeight: number;
  aluminumWeight: number;
  copperPriceDelta: number;
  aluminumPriceDelta: number;
  deltaCopperCost: number;
  deltaAluminumCost: number;
  deltaMaterialCost: number;
  deltaWasteCost: number;
  deltaMgmtFee: number;
  deltaProfit: number;
  deltaDeliveredPrice: number;
  baseDeliveredPrice: number;
  newDeliveredPrice: number;
  weightedDelta: number;
}

/** 项目级金属联动结果 */
export interface MetalEscalationResult {
  metalPrices: {
    before: { copper: number; aluminum: number };
    after: { copper: number; aluminum: number };
    delta: { copper: number; aluminum: number };
  };
  harnesses: MetalDelta[];
  summary: {
    totalWeightedDelta: number;
    affectedCount: number;
    totalCopperWeight: number;
    totalAluminumWeight: number;
  };
  annualImpact: {
    years: { year: number; volume: number; annualImpact: number; cumulativeImpact: number }[];
    totalLifecycleImpact: number;
  } | null;
}

/** 金属价格敏感度矩阵 */
export interface MetalSensitivityMatrix {
  baseMetal: { copper: number; aluminum: number };
  copperRange: number[];
  aluminumRange: number[];
  matrix: { copper: number; aluminum: number; deltaPerVehicle: number }[][];
}

/** 年降结果条目 */
export interface AnnualDropResult {
  year: number;
  factor: number;
  deliveredPrice: number;
  dropFromBase: number;
  dropPercent: number;
}
