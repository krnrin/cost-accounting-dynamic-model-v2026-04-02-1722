import type { FactoryConfig, InternalCostRates, MetalPrices } from '@/types/project';
import type { HarnessInput, HarnessResult } from '@/types/harness';
import { computeInternalHarnessCost, INTERNAL_DEFAULTS, mapInternalToHarnessResult } from './harness_costing';
import { numberOr } from './shared_utils';
import { safeArray } from './shared_utils';

const INTERNAL_MFG_COMPONENT_BASE =
  INTERNAL_DEFAULTS.indirectLaborRate +
  INTERNAL_DEFAULTS.lowValueConsumablesRate +
  INTERNAL_DEFAULTS.materialConsumptionRate +
  INTERNAL_DEFAULTS.factoryAmortizationRate +
  INTERNAL_DEFAULTS.automationAmortizationRate +
  INTERNAL_DEFAULTS.otherOverheadRate;

function deriveInternalRates(factory: FactoryConfig): InternalCostRates {
  if (factory.internalRates) {
    return factory.internalRates;
  }

  const targetMfgRate = numberOr(factory.costRates?.mfgRate, INTERNAL_MFG_COMPONENT_BASE);
  const targetLaborRate = numberOr(factory.costRates?.laborRate, INTERNAL_DEFAULTS.laborRate);
  const targetWasteRate = numberOr(factory.costRates?.wasteRate, INTERNAL_DEFAULTS.materialWasteRate);
  const mfgScale = INTERNAL_MFG_COMPONENT_BASE > 0 ? targetMfgRate / INTERNAL_MFG_COMPONENT_BASE : 1;

  return {
    laborRate: targetLaborRate,
    indirectLaborRate: INTERNAL_DEFAULTS.indirectLaborRate * mfgScale,
    lowValueConsumablesRate: INTERNAL_DEFAULTS.lowValueConsumablesRate * mfgScale,
    materialConsumptionRate: INTERNAL_DEFAULTS.materialConsumptionRate * mfgScale,
    factoryAmortizationRate: INTERNAL_DEFAULTS.factoryAmortizationRate * mfgScale,
    automationAmortizationRate: INTERNAL_DEFAULTS.automationAmortizationRate * mfgScale,
    otherOverheadRate: INTERNAL_DEFAULTS.otherOverheadRate * mfgScale,
    materialWasteRate: targetWasteRate,
  };
}

/** 单工厂单线束核算结果 */
export interface FactoryHarnessResult {
  factoryId: string;
  factoryName: string;
  efficiencyFactor: number;
  result: HarnessResult;
  /** 与基准工厂的到厂价差异 */
  deltaFromBase: number;
  /** 差异率 (%) */
  deltaPercent: number;
}

/** 多工厂比价结果 */
export interface FactoryComparisonResult {
  harnessId: string;
  harnessName: string;
  /** 各工厂的核算结果 */
  factories: FactoryHarnessResult[];
  /** 最低成本工厂 */
  lowestCostFactory: string;
  /** 最高成本工厂 */
  highestCostFactory: string;
  /** 成本差异范围 (最高-最低) */
  costRange: number;
}

/**
 * computeHarnessCostForFactory — 按指定工厂费率计算线束成本
 * 
 * efficiencyFactor 影响实际工时: adjustedHours = baseHours × efficiencyFactor
 */
export function computeHarnessCostForFactory(
  input: HarnessInput,
  factory: FactoryConfig,
  metalPrices: MetalPrices,
  wireCatalog: Map<string, any> | null = null
): HarnessResult {
  const adjustedInput: HarnessInput = {
    ...input,
    frontHours: input.frontHours * factory.efficiencyFactor,
    backHours: input.backHours * factory.efficiencyFactor,
  };

  if ((input as any).processHours !== undefined) {
    (adjustedInput as any).processHours = (input as any).processHours * factory.efficiencyFactor;
  }

  const internalRates = deriveInternalRates(factory);

  return mapInternalToHarnessResult(
    computeInternalHarnessCost(adjustedInput, internalRates, metalPrices, wireCatalog),
  );
}

/**
 * compareFactoryCosts — 多工厂成本对比
 */
export function compareFactoryCosts(
  input: HarnessInput,
  factories: FactoryConfig[],
  metalPrices: MetalPrices,
  wireCatalog: Map<string, any> | null = null
): FactoryComparisonResult {
  const factoryList = [...safeArray(factories)];
  if (factoryList.length === 0) {
    // 无工厂配置时使用默认
    const defaultFactory: FactoryConfig = {
      factoryId: 'default',
      factoryName: '默认工厂',
      costRates: { laborRate: INTERNAL_DEFAULTS.laborRate, mfgRate: INTERNAL_DEFAULTS.indirectLaborRate + INTERNAL_DEFAULTS.lowValueConsumablesRate + INTERNAL_DEFAULTS.materialConsumptionRate + INTERNAL_DEFAULTS.factoryAmortizationRate + INTERNAL_DEFAULTS.automationAmortizationRate + INTERNAL_DEFAULTS.otherOverheadRate, wasteRate: INTERNAL_DEFAULTS.materialWasteRate, mgmtRate: 0, profitRate: 0 },
      efficiencyFactor: 1.0,
      isBase: true,
    };
    factoryList.push(defaultFactory);
  }

  // Find base factory (first one with isBase, or first one)
  const baseFactory = factoryList.find(f => f.isBase) || factoryList[0]!;
  const baseResult = computeHarnessCostForFactory(input, baseFactory, metalPrices, wireCatalog);

  const results: FactoryHarnessResult[] = factoryList.map(factory => {
    const result = factory.factoryId === baseFactory.factoryId
      ? baseResult
      : computeHarnessCostForFactory(input, factory, metalPrices, wireCatalog);
    
    const delta = result.deliveredPrice - baseResult.deliveredPrice;
    const deltaPercent = baseResult.deliveredPrice !== 0 
      ? (delta / baseResult.deliveredPrice) * 100 
      : 0;

    return {
      factoryId: factory.factoryId,
      factoryName: factory.factoryName,
      efficiencyFactor: factory.efficiencyFactor,
      result,
      deltaFromBase: delta,
      deltaPercent,
    };
  });

  // Find min/max
  let lowestIdx = 0, highestIdx = 0;
  for (let i = 1; i < results.length; i++) {
    const r = results[i];
    const lowest = results[lowestIdx];
    const highest = results[highestIdx];
    if (r && lowest && r.result.deliveredPrice < lowest.result.deliveredPrice) lowestIdx = i;
    if (r && highest && r.result.deliveredPrice > highest.result.deliveredPrice) highestIdx = i;
  }

  const lowestResult = results[lowestIdx];
  const highestResult = results[highestIdx];

  return {
    harnessId: input.harnessId,
    harnessName: input.harnessName,
    factories: results,
    lowestCostFactory: lowestResult?.factoryId ?? '',
    highestCostFactory: highestResult?.factoryId ?? '',
    costRange: (highestResult?.result.deliveredPrice ?? 0) - (lowestResult?.result.deliveredPrice ?? 0),
  };
}

/**
 * DEFAULT_FACTORIES — 7 工厂参考数据 (来自 G281 运营工时费报价基准)
 * 注意: 这些是参考数据，实际项目应根据配置填充
 */
export const REFERENCE_FACTORIES: FactoryConfig[] = [
  { factoryId: 'HQ',   factoryName: '总部工厂',   costRates: { laborRate: 35, mfgRate: 46.69, wasteRate: 0.01, mgmtRate: 0.06, profitRate: 0.056627 }, efficiencyFactor: 1.0, isBase: true },
  { factoryId: 'SZ',   factoryName: '深圳工厂',   costRates: { laborRate: 38, mfgRate: 50.00, wasteRate: 0.01, mgmtRate: 0.06, profitRate: 0.056627 }, efficiencyFactor: 0.95 },
  { factoryId: 'CS',   factoryName: '长沙工厂',   costRates: { laborRate: 30, mfgRate: 40.00, wasteRate: 0.01, mgmtRate: 0.06, profitRate: 0.056627 }, efficiencyFactor: 1.05 },
  { factoryId: 'WH',   factoryName: '武汉工厂',   costRates: { laborRate: 32, mfgRate: 42.00, wasteRate: 0.01, mgmtRate: 0.06, profitRate: 0.056627 }, efficiencyFactor: 1.02 },
  { factoryId: 'CQ',   factoryName: '重庆工厂',   costRates: { laborRate: 28, mfgRate: 38.00, wasteRate: 0.01, mgmtRate: 0.06, profitRate: 0.056627 }, efficiencyFactor: 1.08 },
  { factoryId: 'CD',   factoryName: '成都工厂',   costRates: { laborRate: 29, mfgRate: 39.00, wasteRate: 0.01, mgmtRate: 0.06, profitRate: 0.056627 }, efficiencyFactor: 1.06 },
  { factoryId: 'TJ',   factoryName: '天津工厂',   costRates: { laborRate: 34, mfgRate: 45.00, wasteRate: 0.01, mgmtRate: 0.06, profitRate: 0.056627 }, efficiencyFactor: 0.98 },
];
