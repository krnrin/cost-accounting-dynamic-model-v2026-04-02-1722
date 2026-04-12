/**
 * B11: 跨场景比较
 * 多场景指标对比、最优场景选择
 */

import type { HarnessResult } from '@/types/harness';
import type { CostRates, MetalPrices } from '@/types/project';

export interface ScenarioSnapshot {
  scenarioId: string;
  scenarioName: string;
  costRates: CostRates;
  metalPrices: MetalPrices;
  harnessResults: Array<{
    harnessId: string;
    harnessName: string;
    result: HarnessResult;
  }>;
  totalDeliveredPrice: number;
  totalMaterialCost: number;
  totalCopperWeight: number;
  totalAluminumWeight: number;
}

export interface ScenarioCompareResult {
  scenarios: ScenarioSnapshot[];
  summaryDiff: Array<{
    metric: string;
    label: string;
    values: number[];
    minIndex: number;
    maxIndex: number;
    spread: number;
    spreadRate: number;
  }>;
  harnessDetails: Array<{
    harnessId: string;
    harnessName: string;
    prices: number[];
    minIndex: number;
    maxIndex: number;
  }>;
  optimalScenarioIndex: number;
}

export function compareScenarios(scenarios: ScenarioSnapshot[]): ScenarioCompareResult {
  if (scenarios.length < 2) throw new Error('至少需要2个场景进行比较');

  const metrics: Array<{ metric: string; label: string; getter: (s: ScenarioSnapshot) => number }> = [
    { metric: 'totalDeliveredPrice', label: '总到厂价', getter: s => s.totalDeliveredPrice },
    { metric: 'totalMaterialCost', label: '总材料成本', getter: s => s.totalMaterialCost },
    { metric: 'totalCopperWeight', label: '总铜重', getter: s => s.totalCopperWeight },
    { metric: 'laborRate', label: '人工费率', getter: s => s.costRates.laborRate },
    { metric: 'mfgRate', label: '制造费率', getter: s => s.costRates.mfgRate },
    { metric: 'copperPrice', label: '铜价', getter: s => s.metalPrices.copper },
  ];

  const summaryDiff = metrics.map(({ metric, label, getter }) => {
    const values = scenarios.map(getter);
    const minIndex = values.indexOf(Math.min(...values));
    const maxIndex = values.indexOf(Math.max(...values));
    const spread = Math.max(...values) - Math.min(...values);
    const spreadRate = Math.min(...values) !== 0 ? spread / Math.min(...values) : 0;
    return { metric, label, values, minIndex, maxIndex, spread, spreadRate };
  });

  const allHarnessIds = new Set<string>();
  for (const s of scenarios) {
    for (const h of s.harnessResults) allHarnessIds.add(h.harnessId);
  }

  const harnessDetails = [...allHarnessIds].map(harnessId => {
    const prices = scenarios.map(s => {
      const h = s.harnessResults.find(hr => hr.harnessId === harnessId);
      return h?.result.deliveredPrice || 0;
    });
    const hName = scenarios.flatMap(s => s.harnessResults).find(h => h.harnessId === harnessId)?.harnessName || harnessId;
    return {
      harnessId,
      harnessName: hName,
      prices,
      minIndex: prices.indexOf(Math.min(...prices)),
      maxIndex: prices.indexOf(Math.max(...prices)),
    };
  });

  const totals = scenarios.map(s => s.totalDeliveredPrice);
  const optimalScenarioIndex = totals.indexOf(Math.min(...totals));

  return { scenarios, summaryDiff, harnessDetails, optimalScenarioIndex };
}
