/**
 * 报价 & 变更 & 金属联动类型定义
 */

import type { HarnessResult } from './harness';

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
