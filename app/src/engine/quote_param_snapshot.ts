/**
 * Quote Parameter Snapshot (C15 — Issue #69)
 *
 * 报价参数快照 + 报价版本比较
 * - 报价生成时关联当时的费率/金属价格/BOM版本
 * - 支持两个报价版本并排对比差异
 */

export interface QuoteParamRef {
  quoteId: string;
  scenarioId: string;
  createdAt: string;
  /** Rate snapshot version at time of quote */
  rateSnapshotVersion: string | null;
  /** BOM version ref at time of quote */
  bomVersionRef: string | null;
  /** Metal prices at time of quote */
  metalPrices: {
    copper: number;
    aluminum: number;
    source: 'benchmark' | 'shfe' | 'smm' | 'manual';
  };
  /** Key rate values captured */
  rates: {
    managementFeeRate: number;
    profitRate: number;
    scrapRate: number;
    packagingRate: number;
    freightRate: number;
    laborRate: number;
  };
  /** Factory-rate traceability captured for validation/reporting */
  factoryRateSource: {
    factoryId: string | null;
    factoryName: string | null;
    laborRate: number | null;
    manufacturingRate: number | null;
    sourceNote: string | null;
  };
  /** Quote output summary */
  output: {
    totalCostPerSet: number;
    sellingPricePerSet: number;
    marginRate: number;
    lifecycleProfit: number;
  };
}

export interface QuoteVersionDiff {
  baseQuoteId: string;
  compareQuoteId: string;
  paramDiffs: ParamDiffItem[];
  outputDiffs: OutputDiffItem[];
  summary: {
    totalParamChanges: number;
    costImpact: number;
    marginImpact: number;
  };
}

export interface ParamDiffItem {
  category: 'metal' | 'rate' | 'bom' | 'other';
  field: string;
  label: string;
  baseValue: number | string | null;
  compareValue: number | string | null;
  delta: number | null;
  deltaPercent: number | null;
}

export interface OutputDiffItem {
  field: string;
  label: string;
  baseValue: number;
  compareValue: number;
  delta: number;
  deltaPercent: number;
  direction: 'up' | 'down' | 'unchanged';
}

export interface QuoteVerificationReportOptions {
  title?: string;
  generatedAt?: string;
}

/** Create a parameter reference snapshot when generating a quote */
export function captureQuoteParamRef(
  quoteId: string,
  scenarioId: string,
  params: {
    rateSnapshotVersion?: string;
    bomVersionRef?: string;
    metalPrices: QuoteParamRef['metalPrices'];
    rates: QuoteParamRef['rates'];
    factoryRateSource?: Partial<QuoteParamRef['factoryRateSource']>;
    output: QuoteParamRef['output'];
  },
): QuoteParamRef {
  return {
    quoteId,
    scenarioId,
    createdAt: new Date().toISOString(),
    rateSnapshotVersion: params.rateSnapshotVersion || null,
    bomVersionRef: params.bomVersionRef || null,
    metalPrices: { ...params.metalPrices },
    rates: { ...params.rates },
    factoryRateSource: {
      factoryId: params.factoryRateSource?.factoryId || null,
      factoryName: params.factoryRateSource?.factoryName || null,
      laborRate: params.factoryRateSource?.laborRate ?? null,
      manufacturingRate: params.factoryRateSource?.manufacturingRate ?? null,
      sourceNote: params.factoryRateSource?.sourceNote || null,
    },
    output: { ...params.output },
  };
}

/** Compare two quote versions */
export function compareQuoteVersions(
  base: QuoteParamRef,
  compare: QuoteParamRef,
): QuoteVersionDiff {
  const paramDiffs: ParamDiffItem[] = [];
  const outputDiffs: OutputDiffItem[] = [];

  const metalFields: Array<{ key: keyof QuoteParamRef['metalPrices']; label: string }> = [
    { key: 'copper', label: '铜价 (元/吨)' },
    { key: 'aluminum', label: '铝价 (元/吨)' },
  ];
  for (const { key, label } of metalFields) {
    if (key === 'source') continue;
    const bv = base.metalPrices[key] as number;
    const cv = compare.metalPrices[key] as number;
    if (bv !== cv) {
      paramDiffs.push({
        category: 'metal',
        field: `metalPrices.${key}`,
        label,
        baseValue: bv,
        compareValue: cv,
        delta: cv - bv,
        deltaPercent: bv !== 0 ? ((cv - bv) / Math.abs(bv)) * 100 : null,
      });
    }
  }

  const rateLabels: Record<string, string> = {
    managementFeeRate: '管理费率',
    profitRate: '利润率',
    scrapRate: '废品率',
    packagingRate: '包装费率',
    freightRate: '运输费率',
    laborRate: '工时费率',
  };
  for (const [key, label] of Object.entries(rateLabels)) {
    const bv = (base.rates as any)[key] as number;
    const cv = (compare.rates as any)[key] as number;
    if (bv !== cv) {
      paramDiffs.push({
        category: 'rate',
        field: `rates.${key}`,
        label,
        baseValue: bv,
        compareValue: cv,
        delta: cv - bv,
        deltaPercent: bv !== 0 ? ((cv - bv) / Math.abs(bv)) * 100 : null,
      });
    }
  }

  if (base.bomVersionRef !== compare.bomVersionRef) {
    paramDiffs.push({
      category: 'bom',
      field: 'bomVersionRef',
      label: 'BOM 版本',
      baseValue: base.bomVersionRef,
      compareValue: compare.bomVersionRef,
      delta: null,
      deltaPercent: null,
    });
  }

  const factoryRateFields: Array<{
    key: keyof QuoteParamRef['factoryRateSource'];
    label: string;
    numeric?: boolean;
  }> = [
    { key: 'factoryId', label: '基准工厂ID' },
    { key: 'factoryName', label: '基准工厂名称' },
    { key: 'laborRate', label: '基准工厂人工费率', numeric: true },
    { key: 'manufacturingRate', label: '基准工厂制造费率', numeric: true },
    { key: 'sourceNote', label: '工厂费率来源说明' },
  ];
  for (const { key, label, numeric } of factoryRateFields) {
    const bv = base.factoryRateSource[key];
    const cv = compare.factoryRateSource[key];
    if (bv !== cv) {
      const baseNum = typeof bv === 'number' ? bv : null;
      const compareNum = typeof cv === 'number' ? cv : null;
      paramDiffs.push({
        category: 'rate',
        field: `factoryRateSource.${key}`,
        label,
        baseValue: bv,
        compareValue: cv,
        delta: numeric && baseNum !== null && compareNum !== null ? compareNum - baseNum : null,
        deltaPercent:
          numeric && baseNum !== null && compareNum !== null && baseNum !== 0
            ? ((compareNum - baseNum) / Math.abs(baseNum)) * 100
            : null,
      });
    }
  }

  const outputFields: Array<{ key: keyof QuoteParamRef['output']; label: string }> = [
    { key: 'totalCostPerSet', label: '单套成本' },
    { key: 'sellingPricePerSet', label: '单套售价' },
    { key: 'marginRate', label: '毛利率' },
    { key: 'lifecycleProfit', label: '生命周期利润' },
  ];
  for (const { key, label } of outputFields) {
    const bv = base.output[key];
    const cv = compare.output[key];
    const delta = cv - bv;
    outputDiffs.push({
      field: `output.${key}`,
      label,
      baseValue: bv,
      compareValue: cv,
      delta: Math.round(delta * 10000) / 10000,
      deltaPercent: bv !== 0 ? Math.round(((cv - bv) / Math.abs(bv)) * 10000) / 100 : 0,
      direction: delta > 0.0001 ? 'up' : delta < -0.0001 ? 'down' : 'unchanged',
    });
  }

  const costImpact = compare.output.totalCostPerSet - base.output.totalCostPerSet;
  const marginImpact = compare.output.marginRate - base.output.marginRate;

  return {
    baseQuoteId: base.quoteId,
    compareQuoteId: compare.quoteId,
    paramDiffs,
    outputDiffs,
    summary: {
      totalParamChanges: paramDiffs.length,
      costImpact: Math.round(costImpact * 100) / 100,
      marginImpact: Math.round(marginImpact * 10000) / 10000,
    },
  };
}

function formatNumber(value: number | null | undefined, digits = 4): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '-';
  return `${value.toFixed(digits)}`;
}

function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '-';
  return `${(value * 100).toFixed(2)}%`;
}

function formatDelta(value: number | null): string {
  if (value === null || Number.isNaN(value)) return '-';
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(4)}`;
}

function formatDeltaPercent(value: number | null): string {
  if (value === null || Number.isNaN(value)) return '-';
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}%`;
}

function buildFactoryRateSourceLines(ref: QuoteParamRef): string[] {
  return [
    `- 基准工厂: ${ref.factoryRateSource.factoryName || '-'} (${ref.factoryRateSource.factoryId || '-'})`,
    `- 人工费率: ${formatNumber(ref.factoryRateSource.laborRate, 4)}`,
    `- 制造费率: ${formatNumber(ref.factoryRateSource.manufacturingRate, 4)}`,
    `- 来源说明: ${ref.factoryRateSource.sourceNote || '-'}`,
  ];
}

export function generateQuoteVerificationReport(
  base: QuoteParamRef,
  compare: QuoteParamRef,
  options: QuoteVerificationReportOptions = {},
): string {
  const diff = compareQuoteVersions(base, compare);
  const generatedAt = options.generatedAt || new Date().toISOString();
  const title = options.title || 'Quote Parameter Verification Report';

  const paramLines = diff.paramDiffs.length
    ? diff.paramDiffs.map(item => {
        const deltaText = item.delta !== null ? ` | Δ ${formatDelta(item.delta)}` : '';
        const deltaPercentText = item.deltaPercent !== null ? ` | Δ% ${formatDeltaPercent(item.deltaPercent)}` : '';
        return `- [${item.category}] ${item.label}: ${item.baseValue ?? '-'} -> ${item.compareValue ?? '-'}${deltaText}${deltaPercentText}`;
      })
    : ['- 无参数变化'];

  const outputLines = diff.outputDiffs.map(
    item => `- ${item.label}: ${item.baseValue.toFixed(4)} -> ${item.compareValue.toFixed(4)} | Δ ${formatDelta(item.delta)} | Δ% ${formatDeltaPercent(item.deltaPercent)}`,
  );

  return [
    `# ${title}`,
    '',
    `- Generated At: ${generatedAt}`,
    `- Base Quote: ${base.quoteId}`,
    `- Compare Quote: ${compare.quoteId}`,
    `- Scenario: ${compare.scenarioId}`,
    `- Rate Snapshot: ${base.rateSnapshotVersion || '-'} -> ${compare.rateSnapshotVersion || '-'}`,
    `- BOM Version: ${base.bomVersionRef || '-'} -> ${compare.bomVersionRef || '-'}`,
    '',
    '## Base Factory Rate Source',
    '### Base Quote',
    ...buildFactoryRateSourceLines(base),
    '',
    '### Compare Quote',
    ...buildFactoryRateSourceLines(compare),
    '',
    '## Captured Parameter Baseline',
    `- Base Metal Prices: 铜 ${formatNumber(base.metalPrices.copper, 2)}, 铝 ${formatNumber(base.metalPrices.aluminum, 2)}, 来源 ${base.metalPrices.source}`,
    `- Compare Metal Prices: 铜 ${formatNumber(compare.metalPrices.copper, 2)}, 铝 ${formatNumber(compare.metalPrices.aluminum, 2)}, 来源 ${compare.metalPrices.source}`,
    `- Base Labor/Packaging/Freight: 工时 ${formatNumber(base.rates.laborRate, 4)}, 包装费率 ${formatPercent(base.rates.packagingRate)}, 运输费率 ${formatPercent(base.rates.freightRate)}`,
    `- Compare Labor/Packaging/Freight: 工时 ${formatNumber(compare.rates.laborRate, 4)}, 包装费率 ${formatPercent(compare.rates.packagingRate)}, 运输费率 ${formatPercent(compare.rates.freightRate)}`,
    '',
    `## Parameter Diffs (${diff.summary.totalParamChanges})`,
    ...paramLines,
    '',
    '## Output Diffs',
    ...outputLines,
    '',
    '## Summary',
    `- Cost Impact: ${formatDelta(diff.summary.costImpact)}`,
    `- Margin Impact: ${formatDelta(diff.summary.marginImpact)}`,
  ].join('\n');
}

/** Quick check: has any parameter changed between two quotes? */
export function hasParamChanged(base: QuoteParamRef, compare: QuoteParamRef): boolean {
  const diff = compareQuoteVersions(base, compare);
  return diff.summary.totalParamChanges > 0;
}
