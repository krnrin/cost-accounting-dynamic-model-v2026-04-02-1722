import { describe, expect, it } from 'vitest';
import {
  computeLifecycleRunningPrices,
  computeRunningPrice,
  computeWeightedRunningPrice,
} from '../running_price';

describe('running_price', () => {
  const quoteMetalPrices = {
    copper: 65000,
    aluminum: 18000,
  };

  it('removes one-time addon after recovery completes', () => {
    const active = computeRunningPrice({
      quoteDeliveredPrice: 120,
      quoteMetalPrices,
      currentMetalPrices: quoteMetalPrices,
      copperWeightKg: 0,
      aluminumWeightKg: 0,
      annualDropRate: 0,
      yearsSinceQuote: 0,
      quoteOnetimeAddon: 20,
      currentOnetimeAddon: 20,
      onetimeRecoveryProgress: 0.4,
    });

    const recovered = computeRunningPrice({
      quoteDeliveredPrice: 120,
      quoteMetalPrices,
      currentMetalPrices: quoteMetalPrices,
      copperWeightKg: 0,
      aluminumWeightKg: 0,
      annualDropRate: 0,
      yearsSinceQuote: 0,
      quoteOnetimeAddon: 20,
      currentOnetimeAddon: 20,
      onetimeRecoveryProgress: 1,
    });

    expect(active.activeOnetimeAddon).toBe(20);
    expect(active.runningPrice).toBe(120);
    expect(recovered.activeOnetimeAddon).toBe(0);
    expect(recovered.runningPrice).toBe(100);
  });

  it('computes weighted running price by installationRatio', () => {
    const a = computeRunningPrice({
      quoteDeliveredPrice: 100,
      quoteMetalPrices,
      currentMetalPrices: quoteMetalPrices,
      copperWeightKg: 0,
      aluminumWeightKg: 0,
      annualDropRate: 0,
      yearsSinceQuote: 0,
      installationRatio: 0.6,
    });
    const b = computeRunningPrice({
      quoteDeliveredPrice: 80,
      quoteMetalPrices,
      currentMetalPrices: quoteMetalPrices,
      copperWeightKg: 0,
      aluminumWeightKg: 0,
      annualDropRate: 0,
      yearsSinceQuote: 0,
      installationRatio: 0.1,
    });

    expect(computeWeightedRunningPrice([a, b])).toBeCloseTo(100 * 0.6 + 80 * 0.1);
  });

  it('keeps lifecycle records compatible with one-time addon params', () => {
    const records = computeLifecycleRunningPrices({
      quoteDeliveredPrice: 150,
      quoteMetalPrices,
      metalPriceForecasts: [
        { year: 2026, prices: quoteMetalPrices },
        { year: 2027, prices: quoteMetalPrices },
      ],
      copperWeightKg: 0,
      aluminumWeightKg: 0,
      annualDropRate: 0.05,
      lifecycleYears: 2,
      quoteOnetimeAddon: 30,
      currentOnetimeAddon: 30,
      onetimeRecovered: false,
      installationRatio: 0.25,
    });

    expect(records).toHaveLength(2);
    expect(records[0]?.activeOnetimeAddon).toBe(30);
    expect(records[0]?.installationRatio).toBe(0.25);
    expect(records[1]?.runningPrice).toBeLessThan(records[0]!.runningPrice);
  });
});
