/**
 * C9: metal_price_reactor.ts 单元测试
 */
import { describe, it, expect } from 'vitest';
import {
  computeScenarioImpact,
  generateAlertEvents,
  buildReactionPlan,
  quickEstimate,
} from '../metal_price_reactor';

// ─── Fixtures ─────────────────────────────────────────────────────────

const scenario = {
  id: 'SCN-001',
  name: '基准方案',
  harnesses: [
    {
      id: 'H-001',
      name: 'E281-Main',
      deliveredPrice: 120,
      metalContent: {
        copper: { weightKg: 0.8, pricePerKg: 72 },
        aluminum: { weightKg: 0.3, pricePerKg: 20 },
      },
    },
    {
      id: 'H-002',
      name: 'E281-Sub',
      deliveredPrice: 45,
      metalContent: {
        copper: { weightKg: 0.2, pricePerKg: 72 },
        aluminum: { weightKg: 0.1, pricePerKg: 20 },
      },
    },
  ],
};

const newPrices = {
  copper: { pricePerKg: 80 },  // +11.1%
  aluminum: { pricePerKg: 22 }, // +10%
};

// ─── Tests ────────────────────────────────────────────────────────────

describe('computeScenarioImpact', () => {
  it('should compute positive cost impact for price increase', () => {
    const result = computeScenarioImpact(scenario, newPrices);
    expect(result.totalImpact).toBeGreaterThan(0);
    expect(result.harnessImpacts).toHaveLength(2);
  });

  it('should break down impact by harness', () => {
    const result = computeScenarioImpact(scenario, newPrices);
    const h1 = result.harnessImpacts.find(h => h.harnessId === 'H-001');
    expect(h1).toBeDefined();
    // copper: 0.8 * (80-72) = 6.4, aluminum: 0.3 * (22-20) = 0.6
    expect(h1!.metalImpact).toBeCloseTo(7.0, 1);
  });

  it('should compute zero impact when prices unchanged', () => {
    const samePrices = {
      copper: { pricePerKg: 72 },
      aluminum: { pricePerKg: 20 },
    };
    const result = computeScenarioImpact(scenario, samePrices);
    expect(result.totalImpact).toBeCloseTo(0, 2);
  });
});

describe('generateAlertEvents', () => {
  it('should generate alerts when impact exceeds threshold', () => {
    const impact = computeScenarioImpact(scenario, newPrices);
    const alerts = generateAlertEvents(impact, { warningPct: 5, dangerPct: 10 });
    expect(alerts.length).toBeGreaterThan(0);
  });

  it('should generate no alerts for negligible impact', () => {
    const tinyPrices = {
      copper: { pricePerKg: 72.01 },
      aluminum: { pricePerKg: 20.01 },
    };
    const impact = computeScenarioImpact(scenario, tinyPrices);
    const alerts = generateAlertEvents(impact, { warningPct: 5, dangerPct: 10 });
    expect(alerts).toHaveLength(0);
  });
});

describe('buildReactionPlan', () => {
  it('should produce a plan with recalc actions', () => {
    const impact = computeScenarioImpact(scenario, newPrices);
    const plan = buildReactionPlan(impact);
    expect(plan.actions.length).toBeGreaterThan(0);
    expect(plan.actions[0].type).toBe('recalculate');
  });
});

describe('quickEstimate', () => {
  it('should return a fast estimate without full plan', () => {
    const est = quickEstimate(scenario, newPrices);
    expect(est.totalImpact).toBeGreaterThan(0);
    expect(est.impactPct).toBeGreaterThan(0);
  });
});
