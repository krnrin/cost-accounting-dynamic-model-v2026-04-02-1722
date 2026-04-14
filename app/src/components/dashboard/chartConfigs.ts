/**
 * Dashboard ECharts option builders.
 * Pure functions — no React, no JSX, no side-effects.
 */
import { computeSensitivityMatrix } from '@/engine/metal_escalation';
import type {
  HarnessResult,
  ProjectHarnessResult,
  InternalHarnessResult,
  InternalProjectResult,
} from '@/types/harness';
import type { ScenarioRecord } from '@/data/db';
import type { EffectiveHarnessItem } from '@/hooks/useDashboardData';

const COLORS = [
  '#3b82f6', '#ef4444', '#f59e0b', '#10b981',
  '#8b5cf6', '#ec4899', '#6b7280',
];

/* ------------------------------------------------------------------ */
/*  Cost Bridge Waterfall                                              */
/* ------------------------------------------------------------------ */
export function buildWaterfallChart(summary: ProjectHarnessResult | null) {
  if (!summary) return {};

  const items = [
    { name: '材料', value: summary.weightedMaterial },
    { name: '废品', value: summary.weightedWaste },
    { name: '人工', value: summary.weightedLabor },
    { name: '制造费', value: summary.weightedMfg },
    { name: '管理费', value: summary.weightedMgmtFee },
    { name: '利润', value: summary.weightedProfit },
    { name: '包装运输', value: summary.weightedPack + summary.weightedFreight },
  ];

  let cumulative = 0;
  const placeholders: number[] = [];
  const values: number[] = [];
  for (const item of items) {
    placeholders.push(cumulative);
    values.push(+item.value.toFixed(2));
    cumulative += item.value;
  }
  placeholders.push(0);
  values.push(+cumulative.toFixed(2));

  return {
    tooltip: {
      trigger: 'axis' as const,
      formatter(params: any) {
        const idx: number =
          params[1]?.dataIndex ?? params[0]?.dataIndex ?? 0;
        const val = values[idx] ?? 0;
        if (idx === items.length) return '单车成本: ¥' + val.toFixed(2);
        const item = items[idx];
        return item
          ? item.name + ': ¥' + val.toFixed(2)
          : '¥' + val.toFixed(2);
      },
    },
    grid: { top: 20, bottom: 40, left: 60, right: 20 },
    xAxis: {
      type: 'category' as const,
      data: [...items.map((i) => i.name), '单车成本'],
      axisLabel: { fontSize: 11 },
    },
    yAxis: { type: 'value' as const, name: '元' },
    series: [
      {
        name: 'placeholder',
        type: 'bar' as const,
        stack: 'waterfall',
        itemStyle: { color: 'transparent' },
        data: placeholders,
      },
      {
        name: 'value',
        type: 'bar' as const,
        stack: 'waterfall',
        data: values.map((v, i) => ({
          value: v,
          itemStyle: {
            color: i === items.length ? '#2563eb' : COLORS[i],
          },
        })),
        label: {
          show: true,
          position: 'top' as const,
          formatter: (p: any) => '¥' + p.value.toFixed(1),
          fontSize: 10,
          color: '#333',
        },
      },
    ],
  };
}

/* ------------------------------------------------------------------ */
/*  Profit Compare (customer vs internal)                              */
/* ------------------------------------------------------------------ */
export function buildProfitCompareChart(
  effectiveCustomerHarnesses: EffectiveHarnessItem[],
  internalSummary: InternalProjectResult | null,
  internalHarnesses: InternalHarnessResult[],
) {
  if (!effectiveCustomerHarnesses.length || !internalSummary) return {};

  const labels = effectiveCustomerHarnesses.map((item) =>
    item.harness.harnessId.slice(-4),
  );
  const customerPrices = effectiveCustomerHarnesses.map((item) =>
    +item.effectiveDeliveredPrice.toFixed(2),
  );
  const internalCosts = internalHarnesses.map((h) =>
    +h.internalCost.toFixed(2),
  );
  const margins = customerPrices.map(
    (c, i) => +(c - (internalCosts[i] ?? 0)).toFixed(2),
  );

  return {
    tooltip: { trigger: 'axis' as const },
    legend: { data: ['客户到厂价', '内部实绩', '毛利额'], bottom: 0 },
    grid: { top: 20, bottom: 60, left: 60, right: 20 },
    xAxis: {
      type: 'category' as const,
      data: labels,
      axisLabel: { fontSize: 11 },
    },
    yAxis: { type: 'value' as const, name: '元/根' },
    series: [
      {
        name: '客户到厂价',
        type: 'bar' as const,
        data: customerPrices,
        itemStyle: { color: '#3b82f6' },
      },
      {
        name: '内部实绩',
        type: 'bar' as const,
        data: internalCosts,
        itemStyle: { color: '#f59e0b' },
      },
      {
        name: '毛利额',
        type: 'bar' as const,
        data: margins,
        itemStyle: {
          color(params: any) {
            return params.value >= 0 ? '#16a34a' : '#dc2626';
          },
        },
      },
    ],
  };
}

/* ------------------------------------------------------------------ */
/*  Cost Breakdown Stacked Bar                                         */
/* ------------------------------------------------------------------ */
export function buildCostBreakdownChart(
  summary: ProjectHarnessResult | null,
) {
  if (!summary) return {};
  const harnesses = summary.harnesses || [];
  const labels = harnesses.map((h) => h.harnessId.slice(-4));
  return {
    tooltip: { trigger: 'axis' as const },
    legend: {
      data: ['材料', '人工', '制造费', '管理费', '利润', '包装运输'],
      bottom: 0,
    },
    grid: { top: 20, bottom: 60, left: 60, right: 20 },
    xAxis: {
      type: 'category' as const,
      data: labels,
      axisLabel: { rotate: 0, fontSize: 11 },
    },
    yAxis: { type: 'value' as const, name: '元' },
    series: [
      { name: '材料', type: 'bar' as const, stack: 'cost', data: harnesses.map((h) => +h.materialCost.toFixed(2)), itemStyle: { color: '#3b82f6' } },
      { name: '人工', type: 'bar' as const, stack: 'cost', data: harnesses.map((h) => +h.directLabor.toFixed(2)), itemStyle: { color: '#f59e0b' } },
      { name: '制造费', type: 'bar' as const, stack: 'cost', data: harnesses.map((h) => +h.manufacturing.toFixed(2)), itemStyle: { color: '#10b981' } },
      { name: '管理费', type: 'bar' as const, stack: 'cost', data: harnesses.map((h) => +h.mgmtFee.toFixed(2)), itemStyle: { color: '#8b5cf6' } },
      { name: '利润', type: 'bar' as const, stack: 'cost', data: harnesses.map((h) => +h.profit.toFixed(2)), itemStyle: { color: '#ec4899' } },
      { name: '包装运输', type: 'bar' as const, stack: 'cost', data: harnesses.map((h) => +(h.packSubtotal + h.freightSubtotal).toFixed(2)), itemStyle: { color: '#6b7280' } },
    ],
  };
}

/* ------------------------------------------------------------------ */
/*  Metal Sensitivity Heatmap                                          */
/* ------------------------------------------------------------------ */
export function buildMetalSensitivityChart(
  summary: ProjectHarnessResult | null,
  scenario: ScenarioRecord | null,
) {
  if (!summary || !scenario) return {};

  const baseMetal = scenario.config.metalPrices;
  const baseCu = baseMetal.copper;
  const baseAl = baseMetal.aluminum;
  const pctSteps = [-20, -10, 0, 10, 20];
  const cuRange = pctSteps.map((p) => Math.round(baseCu * (1 + p / 100)));
  const alRange = pctSteps.map((p) => Math.round(baseAl * (1 + p / 100)));

  const harnessResults: HarnessResult[] = summary.harnesses || [];
  const matrix = computeSensitivityMatrix(
    harnessResults,
    baseMetal,
    cuRange,
    alRange,
  );

  const data: [number, number, number][] = [];
  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i < matrix.matrix.length; i++) {
    const row = matrix.matrix[i];
    if (!row) continue;
    for (let j = 0; j < row.length; j++) {
      const cell = row[j];
      if (!cell) continue;
      const val = +cell.deltaPerVehicle.toFixed(2);
      data.push([i, j, val]);
      if (val < min) min = val;
      if (val > max) max = val;
    }
  }

  return {
    tooltip: {
      formatter(p: any) {
        const [ci, ai, val] = p.data;
        const cuLabel = cuRange[ci]?.toLocaleString() ?? '';
        const alLabel = alRange[ai]?.toLocaleString() ?? '';
        return (
          '铜 ' +
          cuLabel +
          ' · 铝 ' +
          alLabel +
          '<br/>单车变动: <b>¥' +
          (val >= 0 ? '+' : '') +
          val.toFixed(2) +
          '</b>'
        );
      },
    },
    grid: { top: 10, bottom: 50, left: 80, right: 60 },
    xAxis: {
      type: 'category' as const,
      data: cuRange.map(
        (v) => ((v / baseCu - 1) * 100).toFixed(0) + '%',
      ),
      name: '铜价变动',
      nameLocation: 'center' as const,
      nameGap: 30,
    },
    yAxis: {
      type: 'category' as const,
      data: alRange.map(
        (v) => ((v / baseAl - 1) * 100).toFixed(0) + '%',
      ),
      name: '铝价变动',
    },
    visualMap: {
      min: Math.min(min, -1),
      max: Math.max(max, 1),
      calculable: true,
      orient: 'vertical' as const,
      right: 0,
      top: 'center',
      inRange: { color: ['#16a34a', '#fafafa', '#dc2626'] },
      formatter: (v: number) => '¥' + v.toFixed(1),
    },
    series: [
      {
        type: 'heatmap' as const,
        data,
        label: {
          show: true,
          formatter: (p: any) =>
            (p.data[2] >= 0 ? '+' : '') + p.data[2].toFixed(1),
          fontSize: 10,
        },
      },
    ],
  };
}
