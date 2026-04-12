/**
 * B8: 进度价 Running Price
 * 进度价 = 报价到厂价 + 金属联动 - 年降 + 其他调整
 */

import type { MetalPrices } from '@/types/project';

export interface RunningPriceRecord {
  id: string;
  harnessId: string;
  scenarioId: string;
  quoteDeliveredPrice: number;
  quoteMetalPrices: MetalPrices;
  currentDeliveredPrice: number;
  currentMetalPrices: MetalPrices;
  metalAdjustment: number;
  annualDropAdjustment: number;
  otherAdjustments: Array<{ reason: string; amount: number }>;
  runningPrice: number;
  calculatedAt: string;
  year: number;
}

export function computeRunningPrice(params: {
  quoteDeliveredPrice: number;
  quoteMetalPrices: MetalPrices;
  currentMetalPrices: MetalPrices;
  copperWeightKg: number;
  aluminumWeightKg: number;
  annualDropRate: number;
  yearsSinceQuote: number;
  otherAdjustments?: Array<{ reason: string; amount: number }>;
}): RunningPriceRecord {
  const {
    quoteDeliveredPrice, quoteMetalPrices, currentMetalPrices,
    copperWeightKg, aluminumWeightKg, annualDropRate, yearsSinceQuote,
    otherAdjustments = [],
  } = params;

  const copperDelta = (currentMetalPrices.copper - quoteMetalPrices.copper) / 1000 * copperWeightKg;
  const aluminumDelta = (currentMetalPrices.aluminum - quoteMetalPrices.aluminum) / 1000 * aluminumWeightKg;
  const metalAdjustment = copperDelta + aluminumDelta;

  const dropMultiplier = Math.pow(1 - annualDropRate, yearsSinceQuote);
  const priceAfterDrop = quoteDeliveredPrice * dropMultiplier;
  const annualDropAdjustment = priceAfterDrop - quoteDeliveredPrice;

  const otherTotal = otherAdjustments.reduce((sum, adj) => sum + adj.amount, 0);
  const runningPrice = quoteDeliveredPrice + metalAdjustment + annualDropAdjustment + otherTotal;

  return {
    id: `rp-${Date.now()}`,
    harnessId: '',
    scenarioId: '',
    quoteDeliveredPrice,
    quoteMetalPrices,
    currentDeliveredPrice: runningPrice,
    currentMetalPrices,
    metalAdjustment,
    annualDropAdjustment,
    otherAdjustments,
    runningPrice: Math.max(0, runningPrice),
    calculatedAt: new Date().toISOString(),
    year: new Date().getFullYear() + yearsSinceQuote,
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
