/**
 * Simulation Snapshot (C20 — Issue #72)
 * 
 * 仿真结果保存 + 一键转场景 + 年降与场景挂接
 * - 保存仿真配置和结果快照
 * - 仿真结果一键转为正式场景
 * - 年降结果关联到场景KPI
 */

// ─── Types ───

export interface SimulationSnapshot {
  id: string;
  scenarioId: string;
  createdAt: string;
  name: string;
  description: string;
  parameters: SimulationParams;
  results: SimulationResults;
  tags: string[];
}

export interface SimulationParams {
  adjustments: SimAdjustment[];
  metalPrices?: { copper: number; aluminum: number };
  volumeOverride?: number;
  rateOverrides?: Record<string, number>;
}

export interface SimAdjustment {
  dimension: string;
  field: string;
  originalValue: number;
  adjustedValue: number;
  delta: number;
  deltaPercent: number;
}

export interface SimulationResults {
  totalCostPerSet: number;
  sellingPricePerSet: number;
  marginRate: number;
  lifecycleProfit: number;
  costDelta: number;
  marginDelta: number;
}

export interface AnnualDropLink {
  scenarioId: string;
  annualDropId: string;
  year: number;
  dropRate: number;
  impactOnLifecycleCost: number;
  appliedAt: string;
}

export interface ScenarioFromSimulation {
  sourceSimulationId: string;
  scenarioName: string;
  parameters: SimulationParams;
  results: SimulationResults;
  createdAt: string;
}

// ─── Core Functions ───

/** Create a simulation snapshot */
export function createSimulationSnapshot(
  scenarioId: string,
  name: string,
  description: string,
  parameters: SimulationParams,
  results: SimulationResults,
  tags: string[] = [],
): SimulationSnapshot {
  return {
    id: `sim-${scenarioId}-${Date.now().toString(36)}`,
    scenarioId,
    createdAt: new Date().toISOString(),
    name,
    description,
    parameters: JSON.parse(JSON.stringify(parameters)),
    results: { ...results },
    tags,
  };
}

/** Compare two simulation snapshots */
export function compareSimulations(
  a: SimulationSnapshot,
  b: SimulationSnapshot,
): Array<{ field: string; label: string; valueA: number; valueB: number; delta: number }> {
  const fields: Array<{ key: keyof SimulationResults; label: string }> = [
    { key: 'totalCostPerSet', label: '单套成本' },
    { key: 'sellingPricePerSet', label: '单套售价' },
    { key: 'marginRate', label: '毛利率' },
    { key: 'lifecycleProfit', label: '生命周期利润' },
  ];

  return fields.map(({ key, label }) => ({
    field: key,
    label,
    valueA: a.results[key],
    valueB: b.results[key],
    delta: Math.round((b.results[key] - a.results[key]) * 10000) / 10000,
  }));
}

/** Prepare data to convert simulation into a formal scenario */
export function prepareScenarioFromSimulation(
  simulation: SimulationSnapshot,
  scenarioName: string,
): ScenarioFromSimulation {
  return {
    sourceSimulationId: simulation.id,
    scenarioName,
    parameters: JSON.parse(JSON.stringify(simulation.parameters)),
    results: { ...simulation.results },
    createdAt: new Date().toISOString(),
  };
}

/** Link annual drop results to scenario lifecycle cost */
export function linkAnnualDropToScenario(
  scenarioId: string,
  annualDropId: string,
  year: number,
  dropRate: number,
  baseLifecycleCost: number,
): AnnualDropLink {
  const impact = Math.round(baseLifecycleCost * dropRate * 100) / 100;
  return {
    scenarioId,
    annualDropId,
    year,
    dropRate,
    impactOnLifecycleCost: impact,
    appliedAt: new Date().toISOString(),
  };
}

/** Compute lifecycle cost with annual drops applied */
export function computeLifecycleCostWithDrops(
  baseAnnualCosts: number[],
  drops: AnnualDropLink[],
): { adjustedCosts: number[]; totalSavings: number; totalLifecycleCost: number } {
  const adjustedCosts = baseAnnualCosts.map((cost, yearIdx) => {
    const yearDrops = drops.filter(d => d.year === yearIdx + 1);
    const totalDropRate = yearDrops.reduce((sum, d) => sum + d.dropRate, 0);
    return Math.round(cost * (1 - totalDropRate) * 100) / 100;
  });

  const totalBase = baseAnnualCosts.reduce((s, c) => s + c, 0);
  const totalAdjusted = adjustedCosts.reduce((s, c) => s + c, 0);

  return {
    adjustedCosts,
    totalSavings: Math.round((totalBase - totalAdjusted) * 100) / 100,
    totalLifecycleCost: Math.round(totalAdjusted * 100) / 100,
  };
}
