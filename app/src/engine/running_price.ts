/**
 * B8: 进度价 Running Price
 * 进度价 = 报价到厂价 + 金属联动 - 年降 + 其他调整
 */

import type { MetalPrices } from '@/types/project';
import { resolveEffectiveRatio } from './shared_utils';

export interface RunningPriceRecord {
  id: string;
  harnessId: string;
  scenarioId: string;
  quoteDeliveredPrice: number;
  quoteMetalPrices: MetalPrices;
  quoteOnetimeAddon: number;
  recurringQuotePrice: number;
  currentDeliveredPrice: number;
  currentMetalPrices: MetalPrices;
  metalAdjustment: number;
  annualDropAdjustment: number;
  activeOnetimeAddon: number;
  onetimeRecovered: boolean;
  otherAdjustments: Array<{ reason: string; amount: number }>;
  runningPrice: number;
  calculatedAt: string;
  year: number;
  installationRatio: number;
}

export function computeRunningPrice(params: {
  quoteDeliveredPrice: number;
  quoteMetalPrices: MetalPrices;
  currentMetalPrices: MetalPrices;
  copperWeightKg: number;
  aluminumWeightKg: number;
  annualDropRate: number;
  yearsSinceQuote: number;
  quoteOnetimeAddon?: number;
  currentOnetimeAddon?: number;
  onetimeRecovered?: boolean;
  onetimeRecoveryProgress?: number;
  installationRatio?: number;
  otherAdjustments?: Array<{ reason: string; amount: number }>;
}): RunningPriceRecord {
  const {
    quoteDeliveredPrice, quoteMetalPrices, currentMetalPrices,
    copperWeightKg, aluminumWeightKg, annualDropRate, yearsSinceQuote,
    quoteOnetimeAddon = 0,
    currentOnetimeAddon,
    onetimeRecovered,
    onetimeRecoveryProgress,
    installationRatio,
    otherAdjustments = [],
  } = params;

  const copperDelta = (currentMetalPrices.copper - quoteMetalPrices.copper) / 1000 * copperWeightKg;
  const aluminumDelta = (currentMetalPrices.aluminum - quoteMetalPrices.aluminum) / 1000 * aluminumWeightKg;
  const metalAdjustment = copperDelta + aluminumDelta;

  const resolvedOnetimeRecovered = onetimeRecovered ?? (onetimeRecoveryProgress !== undefined && onetimeRecoveryProgress >= 1);
  const recurringQuotePrice = quoteDeliveredPrice - quoteOnetimeAddon;
  const activeOnetimeAddon = resolvedOnetimeRecovered ? 0 : (currentOnetimeAddon ?? quoteOnetimeAddon);

  const dropMultiplier = Math.pow(1 - annualDropRate, yearsSinceQuote);
  const priceAfterDrop = recurringQuotePrice * dropMultiplier;
  const annualDropAdjustment = priceAfterDrop - recurringQuotePrice;

  const otherTotal = otherAdjustments.reduce((sum, adj) => sum + adj.amount, 0);
  const runningPrice = recurringQuotePrice + metalAdjustment + annualDropAdjustment + activeOnetimeAddon + otherTotal;

  return {
    id: `rp-${Date.now()}`,
    harnessId: '',
    scenarioId: '',
    quoteDeliveredPrice,
    quoteMetalPrices,
    quoteOnetimeAddon,
    recurringQuotePrice,
    currentDeliveredPrice: runningPrice,
    currentMetalPrices,
    metalAdjustment,
    annualDropAdjustment,
    activeOnetimeAddon,
    onetimeRecovered: resolvedOnetimeRecovered,
    otherAdjustments,
    // [PR-035] 移除 Math.max(0, ...) 静默截断，让负值穿透到上游业务校验
    runningPrice,
    calculatedAt: new Date().toISOString(),
    year: new Date().getFullYear() + yearsSinceQuote,
    installationRatio: resolveEffectiveRatio(installationRatio, 0),
  };
}

export function computeLifecycleRunningPrices(params: {
  quoteDeliveredPrice: number;
  quoteMetalPrices: MetalPrices;
  metalPriceForecasts: Array<{ year: number; prices: MetalPrices }>;
  copperWeightKg: number;
  aluminumWeightKg: number;
  annualDropRate: number;
  lifecycleYears: number;
  quoteOnetimeAddon?: number;
  currentOnetimeAddon?: number;
  onetimeRecovered?: boolean;
  onetimeRecoveryProgress?: number;
  installationRatio?: number;
}): RunningPriceRecord[] {
  const records: RunningPriceRecord[] = [];
  for (let y = 0; y < params.lifecycleYears; y++) {
    const forecast = params.metalPriceForecasts[y] || {
      year: new Date().getFullYear() + y,
      prices: params.quoteMetalPrices,
    };
    const record = computeRunningPrice({
      ...params,
      currentMetalPrices: forecast.prices,
      yearsSinceQuote: y,
    });
    record.year = forecast.year;
    records.push(record);
  }
  return records;
}

export function computeWeightedRunningPrice(records: RunningPriceRecord[]): number {
  return records.reduce(
    (sum, record) => sum + record.runningPrice * resolveEffectiveRatio(record.installationRatio, 0),
    0,
  );
}
