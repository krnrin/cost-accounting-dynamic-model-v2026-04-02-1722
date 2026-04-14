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

const basePrices = { copper: 72, aluminum: 20 };

const change = {
  oldPrices: basePrices,
  newPrices: { copper: 80, aluminum: 22 },
  source: 'manual' as const,
  changedAt: new Date().toISOString(),
};

const scenario = {
  scenarioId: 'SCN-001',
  scenarioName: '基准方案',
  projectId: 'P-001',
  projectName: 'G281',
  status: 'draft',
  basePrices,
};

const harnessResults = [
  {
    harnessId: 'H-001',
    harnessName: 'E281-Main',
    result: {} as any,
    copperWeight: 800,
    aluminumWeight: 300,
  },
  {
    harnessId: 'H-002',
    harnessName: 'E281-Sub',
    result: {} as any,
    copperWeight: 200,
    aluminumWeight: 100,
  },
];

// ─── Tests ────────────────────────────────────────────────────────────

describe('computeScenarioImpact', () => {
  it('should compute positive cost impact for price increase', () => {
    const result = computeScenarioImpact(scenario, change, harnessResults);
    expect(result.totalImpact).toBeGreaterThan(0);
    expect(result.harnessImpacts).toHaveLength(2);
  });

  it('should break down impact by harness', () => {
    const result = computeScenarioImpact(scenario, change, harnessResults);
    const h1 = result.harnessImpacts.find(h => h.harnessId === 'H-001');
    expect(h1).toBeDefined();
    // copper: 0.8 * (80-72) = 6.4, aluminum: 0.3 * (22-20) = 0.6
    expect(h1!.totalImpact).toBeCloseTo(7.0, 1);
  });

  it('should compute zero impact when prices unchanged', () => {
    const sameChange = {
      ...change,
      newPrices: basePrices,
    };
    const result = computeScenarioImpact(scenario, sameChange, harnessResults);
    expect(result.totalImpact).toBeCloseTo(0, 2);
  });
});

describe('generateAlertEvents', () => {
  it('should generate alerts when impact exceeds threshold', () => {
    const impact = computeScenarioImpact(scenario, change, harnessResults);
    const alerts = generateAlertEvents(impact, change);
    expect(alerts.length).toBeGreaterThan(0);
  });

  it('should generate no alerts for negligible impact', () => {
    const tinyChange = {
      ...change,
      newPrices: { copper: 72.01, aluminum: 20.01 },
    };
    const impact = computeScenarioImpact(scenario, tinyChange, harnessResults);
    const alerts = generateAlertEvents(impact, tinyChange);
    expect(alerts).toHaveLength(0);
  });
});

describe('buildReactionPlan', () => {
  it('should produce a plan with recalc actions', async () => {
    const plan = await buildReactionPlan(
      change,
      [scenario],
      async () => harnessResults,
    );
    expect(plan.scenarioImpacts.length).toBeGreaterThan(0);
    expect(plan.summary.totalScenariosAffected).toBeGreaterThan(0);
  });
});

describe('quickEstimate', () => {
  it('should return a fast estimate without full plan', () => {
    const est = quickEstimate(basePrices, change.newPrices, 1000, 400);
    expect(est.totalImpact).toBeGreaterThan(0);
  });
});
