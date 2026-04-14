/**
 * Scenario Deep Compare (C17 — Issue #65)
 * 
 * 场景对比深度增强 + 场景与版本关联
 * - 扩展对比维度：成本结构、利润率、分摊回收进度
 * - 场景关联版本号和快照状态
 */

// ─── Types ───

export interface ScenarioCompareInput {
  scenarioId: string;
  scenarioName: string;
  status: string;
  versionRef?: string;
  rateSnapshotVersion?: string;
  bomVersionRef?: string;
  kpis: ScenarioKpis;
  costBreakdown: CostBreakdown;
  allocRecovery?: AllocRecoveryStatus;
}

export interface ScenarioKpis {
  totalCostPerSet: number;
  sellingPricePerSet: number;
  marginRate: number;
  lifecycleProfit: number;
  vehicleCostPerSet: number;
  totalHarnesses: number;
}

export interface CostBreakdown {
  materialCost: number;
  laborCost: number;
  overheadCost: number;
  packagingCost: number;
  managementFee: number;
  scrapCost: number;
  metalCost: number;
  nreCostPerSet: number;
}

export interface AllocRecoveryStatus {
  totalNre: number;
  recoveredAmount: number;
  recoveryRate: number;
  remainingMonths: number | null;
}

export interface ComparisonDimension {
  key: string;
  label: string;
  category: 'kpi' | 'cost' | 'alloc' | 'version';
  values: Array<{ scenarioId: string; value: number | string | null }>;
  deltas: Array<{ fromId: string; toId: string; delta: number | null; deltaPercent: number | null }>;
}

export interface DeepCompareResult {
  scenarios: ScenarioCompareInput[];
  dimensions: ComparisonDimension[];
  summary: {
    totalDimensions: number;
    dimensionsWithDifference: number;
    largestCostDelta: { dimension: string; delta: number } | null;
    largestMarginDelta: number;
  };
}

// ─── Core Functions ───

/** Run deep multi-dimension comparison across scenarios */
export function deepCompareScenarios(
  scenarios: ScenarioCompareInput[],
): DeepCompareResult {
  if (scenarios.length < 2) {
    return {
      scenarios,
      dimensions: [],
      summary: { totalDimensions: 0, dimensionsWithDifference: 0, largestCostDelta: null, largestMarginDelta: 0 },
    };
  }

  const dimensions: ComparisonDimension[] = [];

  // KPI dimensions
  const kpiFields: Array<{ key: keyof ScenarioKpis; label: string }> = [
    { key: 'totalCostPerSet', label: '单套总成本' },
    { key: 'sellingPricePerSet', label: '单套售价' },
    { key: 'marginRate', label: '毛利率' },
    { key: 'lifecycleProfit', label: '生命周期利润' },
    { key: 'vehicleCostPerSet', label: '整车成本' },
    { key: 'totalHarnesses', label: '线束数量' },
  ];
  for (const { key, label } of kpiFields) {
    dimensions.push(buildNumericDimension(key, label, 'kpi', scenarios, s => s.kpis[key]));
  }

  // Cost breakdown dimensions
  const costFields: Array<{ key: keyof CostBreakdown; label: string }> = [
    { key: 'materialCost', label: '材料成本' },
    { key: 'laborCost', label: '加工费' },
    { key: 'overheadCost', label: '制造费用' },
    { key: 'packagingCost', label: '包装费' },
    { key: 'managementFee', label: '管理费' },
    { key: 'scrapCost', label: '废品费' },
    { key: 'metalCost', label: '金属成本' },
    { key: 'nreCostPerSet', label: '一次性费用分摊' },
  ];
  for (const { key, label } of costFields) {
    dimensions.push(buildNumericDimension(key, label, 'cost', scenarios, s => s.costBreakdown[key]));
  }

  // Alloc recovery dimensions
  dimensions.push(buildNumericDimension('recoveryRate', '回收进度', 'alloc', scenarios, s => s.allocRecovery?.recoveryRate ?? null));
  dimensions.push(buildNumericDimension('remainingMonths', '剩余回收月数', 'alloc', scenarios, s => s.allocRecovery?.remainingMonths ?? null));

  // Version info
  dimensions.push({
    key: 'versionRef',
    label: '关联版本',
    category: 'version',
    values: scenarios.map(s => ({ scenarioId: s.scenarioId, value: s.versionRef || '—' })),
    deltas: [],
  });
  dimensions.push({
    key: 'bomVersionRef',
    label: 'BOM版本',
    category: 'version',
    values: scenarios.map(s => ({ scenarioId: s.scenarioId, value: s.bomVersionRef || '—' })),
    deltas: [],
  });

  // Summary
  const withDiff = dimensions.filter(d =>
    d.deltas.some(dt => dt.delta !== null && Math.abs(dt.delta) > 0.0001)
  ).length;

  let largestCostDelta: { dimension: string; delta: number } | null = null;
  for (const d of dimensions.filter(d => d.category === 'cost')) {
    for (const dt of d.deltas) {
      if (dt.delta !== null && (!largestCostDelta || Math.abs(dt.delta) > Math.abs(largestCostDelta.delta))) {
        largestCostDelta = { dimension: d.label, delta: dt.delta };
      }
    }
  }

  const marginDim = dimensions.find(d => d.key === 'marginRate');
  const largestMarginDelta = marginDim?.deltas.reduce(
    (max, dt) => Math.max(max, Math.abs(dt.delta ?? 0)), 0
  ) ?? 0;

  return {
    scenarios,
    dimensions,
    summary: {
      totalDimensions: dimensions.length,
      dimensionsWithDifference: withDiff,
      largestCostDelta,
      largestMarginDelta,
    },
  };
}

function buildNumericDimension(
  key: string,
  label: string,
  category: ComparisonDimension['category'],
  scenarios: ScenarioCompareInput[],
  extractor: (s: ScenarioCompareInput) => number | null,
): ComparisonDimension {
  const values = scenarios.map(s => ({
    scenarioId: s.scenarioId,
    value: extractor(s),
  }));

  const deltas: ComparisonDimension['deltas'] = [];
  // Compare each pair (first scenario as base)
  const baseVal = extractor(scenarios[0]!);
  for (let i = 1; i < scenarios.length; i++) {
    const compVal = extractor(scenarios[i]!);
    const delta = (baseVal != null && compVal != null) ? Math.round((compVal - baseVal) * 10000) / 10000 : null;
    const deltaPercent = (delta != null && baseVal != null && baseVal !== 0)
      ? Math.round((delta / Math.abs(baseVal)) * 10000) / 100
      : null;
    deltas.push({
      fromId: scenarios[0]!.scenarioId,
      toId: scenarios[i]!.scenarioId,
      delta,
      deltaPercent,
    });
  }

  return { key, label, category, values, deltas };
}

/** Filter dimensions by category */
export function filterDimensions(
  result: DeepCompareResult,
  category: ComparisonDimension['category'] | 'all',
): ComparisonDimension[] {
  if (category === 'all') return result.dimensions;
  return result.dimensions.filter(d => d.category === category);
}
