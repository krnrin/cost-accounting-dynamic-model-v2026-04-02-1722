import type { FactoryConfig, InternalCostRates, MetalPrices } from '@/types/project';
import type { HarnessInput, HarnessResult } from '@/types/harness';
import { computeInternalHarnessCost, mapInternalToHarnessResult } from './harness_costing';
import { numberOr } from './shared_utils';
import { safeArray } from './shared_utils';

/**
 * [成本核算数据原则] 禁止回退到硬编码默认值
 *
 * deriveInternalRates 必须从 factory.internalRates 获取真实费率配置。
 * 如果工厂配置缺少 internalRates，抛出错误而非回退到默认值。
 */
function deriveInternalRates(factory: FactoryConfig): InternalCostRates {
  if (!factory.internalRates) {
    throw new Error(
      `[成本核算] 工厂 ${factory.factoryId} 缺少 internalRates 配置。` +
      '请在工厂配置中提供完整的内部费率数据，禁止回退到硬编码默认值。'
    );
  }
  return factory.internalRates;
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
 * [PR-099] efficiencyFactor 语义已确认：
 * - efficiencyFactor 是「效率系数」，效率越高（>1），单位工时产出越高，成本越低
 * - 公式：adjustedHours = baseHours / efficiencyFactor（效率越高，所需工时越少）
 * - 或等效：adjustedRate = baseRate / efficiencyFactor（效率越高，费率越低）
 *
 * 真实工厂数据来自 harness_costing.ts INTERNAL_FACTORY_RATES：
 * - K1~K7 工厂，各有独立的 6D MOH 费率
 * - K3 为基准工厂（INTERNAL_DEFAULTS）
 *
 * 注意：此函数仅用于多工厂比价场景，内部实绩核算应使用
 * computeInternalHarnessCost + getInternalFactoryRates。
 */
export function computeHarnessCostForFactory(
  input: HarnessInput,
  factory: FactoryConfig,
  metalPrices: MetalPrices,
  wireCatalog: Map<string, any> | null = null
): HarnessResult {
  // [PR-099] 修正：效率系数越高，工时越少
  // 公式：adjustedHours = baseHours / efficiencyFactor
  const efficiencyFactor = numberOr(factory.efficiencyFactor, 1.0);
  const adjustedInput: HarnessInput = {
    ...input,
    frontHours: input.frontHours / efficiencyFactor,
    backHours: input.backHours / efficiencyFactor,
  };

  if ((input as any).processHours !== undefined) {
    (adjustedInput as any).processHours = (input as any).processHours / efficiencyFactor;
  }

  const internalRates = deriveInternalRates(factory);

  return mapInternalToHarnessResult(
    computeInternalHarnessCost(adjustedInput, internalRates, metalPrices, wireCatalog),
  );
}

/**
 * compareFactoryCosts — 多工厂成本对比
 *
 * [成本核算数据原则] 必须传入工厂配置，禁止回退到默认值
 */
export function compareFactoryCosts(
  input: HarnessInput,
  factories: FactoryConfig[],
  metalPrices: MetalPrices,
  wireCatalog: Map<string, any> | null = null
): FactoryComparisonResult {
  const factoryList = [...safeArray(factories)];
  if (factoryList.length === 0) {
    throw new Error(
      '[成本核算] compareFactoryCosts 缺少工厂配置。' +
      '必须传入至少一个工厂配置，禁止使用默认值。'
    );
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
 * REFERENCE_FACTORIES — 真实工厂参考数据
 * K1~K7 为实际工厂代号，K3 为基准工厂
 *
 * [成本核算数据原则] 这些是参考数据，实际使用时必须配置真实费率
 *
 * 费率说明：
 * - laborRate: 直接人工费率 (元/h)
 * - indirectLaborRate ~ otherOverheadRate: 6D MOH 制造费率 (元/h)
 * - materialWasteRate: 材料损耗率
 */
export const REFERENCE_FACTORIES: FactoryConfig[] = [
  {
    factoryId: 'K3',
    factoryName: '基准工厂',
    costRates: { laborRate: 28.58, mfgRate: 16.14, wasteRate: 0.005, mgmtRate: 0, profitRate: 0 },
    internalRates: {
      laborRate: 28.58,
      indirectLaborRate: 8.50,
      lowValueConsumablesRate: 0.88,
      materialConsumptionRate: 1.86,
      factoryAmortizationRate: 1.45,
      automationAmortizationRate: 2.03,
      otherOverheadRate: 1.42,
      materialWasteRate: 0.005,
    },
    efficiencyFactor: 1.0,
    isBase: true,
    remark: '基准工厂，费率来自 INTERNAL_DEFAULTS',
  },
  {
    factoryId: 'K1',
    factoryName: '工厂K1',
    costRates: { laborRate: 30.1, mfgRate: 16.92, wasteRate: 0.0055, mgmtRate: 0, profitRate: 0 },
    internalRates: {
      laborRate: 30.1,
      indirectLaborRate: 8.9,
      lowValueConsumablesRate: 0.92,
      materialConsumptionRate: 1.94,
      factoryAmortizationRate: 1.56,
      automationAmortizationRate: 2.12,
      otherOverheadRate: 1.48,
      materialWasteRate: 0.0055,
    },
    efficiencyFactor: 0.95, // 效率略低于基准
    remark: '费率来自 INTERNAL_FACTORY_RATES.K1',
  },
  {
    factoryId: 'K2',
    factoryName: '工厂K2',
    costRates: { laborRate: 29.2, mfgRate: 16.58, wasteRate: 0.0052, mgmtRate: 0, profitRate: 0 },
    internalRates: {
      laborRate: 29.2,
      indirectLaborRate: 8.7,
      lowValueConsumablesRate: 0.9,
      materialConsumptionRate: 1.9,
      factoryAmortizationRate: 1.5,
      automationAmortizationRate: 2.08,
      otherOverheadRate: 1.45,
      materialWasteRate: 0.0052,
    },
    efficiencyFactor: 0.98,
    remark: '费率来自 INTERNAL_FACTORY_RATES.K2',
  },
  {
    factoryId: 'K4',
    factoryName: '工厂K4',
    costRates: { laborRate: 27.9, mfgRate: 15.78, wasteRate: 0.0048, mgmtRate: 0, profitRate: 0 },
    internalRates: {
      laborRate: 27.9,
      indirectLaborRate: 8.35,
      lowValueConsumablesRate: 0.86,
      materialConsumptionRate: 1.82,
      factoryAmortizationRate: 1.39,
      automationAmortizationRate: 1.97,
      otherOverheadRate: 1.39,
      materialWasteRate: 0.0048,
    },
    efficiencyFactor: 1.02, // 效率略高于基准
    remark: '费率来自 INTERNAL_FACTORY_RATES.K4',
  },
  {
    factoryId: 'K5',
    factoryName: '工厂K5',
    costRates: { laborRate: 27.4, mfgRate: 15.35, wasteRate: 0.0046, mgmtRate: 0, profitRate: 0 },
    internalRates: {
      laborRate: 27.4,
      indirectLaborRate: 8.18,
      lowValueConsumablesRate: 0.84,
      materialConsumptionRate: 1.76,
      factoryAmortizationRate: 1.33,
      automationAmortizationRate: 1.9,
      otherOverheadRate: 1.34,
      materialWasteRate: 0.0046,
    },
    efficiencyFactor: 1.05,
    remark: '费率来自 INTERNAL_FACTORY_RATES.K5',
  },
  {
    factoryId: 'K6',
    factoryName: '工厂K6',
    costRates: { laborRate: 26.8, mfgRate: 14.95, wasteRate: 0.0045, mgmtRate: 0, profitRate: 0 },
    internalRates: {
      laborRate: 26.8,
      indirectLaborRate: 8.02,
      lowValueConsumablesRate: 0.82,
      materialConsumptionRate: 1.71,
      factoryAmortizationRate: 1.28,
      automationAmortizationRate: 1.84,
      otherOverheadRate: 1.3,
      materialWasteRate: 0.0045,
    },
    efficiencyFactor: 1.08,
    remark: '费率来自 INTERNAL_FACTORY_RATES.K6',
  },
  {
    factoryId: 'K7',
    factoryName: '工厂K7',
    costRates: { laborRate: 31.0, mfgRate: 17.42, wasteRate: 0.0058, mgmtRate: 0, profitRate: 0 },
    internalRates: {
      laborRate: 31.0,
      indirectLaborRate: 9.1,
      lowValueConsumablesRate: 0.95,
      materialConsumptionRate: 2.01,
      factoryAmortizationRate: 1.62,
      automationAmortizationRate: 2.2,
      otherOverheadRate: 1.54,
      materialWasteRate: 0.0058,
    },
    efficiencyFactor: 0.92,
    remark: '费率来自 INTERNAL_FACTORY_RATES.K7',
  },
];
