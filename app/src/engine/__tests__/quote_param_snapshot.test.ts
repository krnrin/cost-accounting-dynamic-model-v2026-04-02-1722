import { describe, expect, it } from 'vitest';
import {
  captureQuoteParamRef,
  compareQuoteVersions,
  generateQuoteVerificationReport,
  hasParamChanged,
} from '../quote_param_snapshot';

describe('quote_param_snapshot factory-rate traceability', () => {
  it('captures factory-rate source with null defaults', () => {
    const ref = captureQuoteParamRef('q1', 's1', {
      metalPrices: { copper: 1, aluminum: 2, source: 'manual' },
      rates: {
        managementFeeRate: 0.06,
        profitRate: 0.05,
        scrapRate: 0.01,
        packagingRate: 0.02,
        laborRate: 35,
      },
      output: {
        totalCostPerSet: 100,
        sellingPricePerSet: 120,
        marginRate: 0.2,
        lifecycleProfit: 2000,
      },
    });

    expect(ref.factoryRateSource).toEqual({
      factoryId: null,
      factoryName: null,
      laborRate: null,
      manufacturingRate: null,
      sourceNote: null,
    });
  });

  it('compares factory-rate source changes in param diffs', () => {
    const base = captureQuoteParamRef('q1', 's1', {
      rateSnapshotVersion: 'v1',
      metalPrices: { copper: 1, aluminum: 2, source: 'manual' },
      rates: {
        managementFeeRate: 0.06,
        profitRate: 0.05,
        scrapRate: 0.01,
        packagingRate: 0.02,
        laborRate: 35,
      },
      factoryRateSource: {
        factoryId: 'KS',
        factoryName: '昆山工厂',
        laborRate: 28.6,
        manufacturingRate: 14.9,
        sourceNote: '来自《运营工时费报价基准》报价版运营成本工时费（不包含折旧）基准',
      },
      output: {
        totalCostPerSet: 100,
        sellingPricePerSet: 120,
        marginRate: 0.2,
        lifecycleProfit: 2000,
      },
    });

    const compare = captureQuoteParamRef('q2', 's1', {
      rateSnapshotVersion: 'v2',
      metalPrices: { copper: 1, aluminum: 2, source: 'manual' },
      rates: {
        managementFeeRate: 0.06,
        profitRate: 0.05,
        scrapRate: 0.01,
        packagingRate: 0.02,
        laborRate: 35,
      },
      factoryRateSource: {
        factoryId: 'WH',
        factoryName: '武汉工厂',
        laborRate: 30.1,
        manufacturingRate: 15.4,
        sourceNote: '来自新版运营工时费报价基准',
      },
      output: {
        totalCostPerSet: 101,
        sellingPricePerSet: 121,
        marginRate: 0.19,
        lifecycleProfit: 1980,
      },
    });

    const diff = compareQuoteVersions(base, compare);
    const fields = diff.paramDiffs.map(item => item.field);

    expect(fields).toContain('factoryRateSource.factoryId');
    expect(fields).toContain('factoryRateSource.factoryName');
    expect(fields).toContain('factoryRateSource.laborRate');
    expect(fields).toContain('factoryRateSource.manufacturingRate');
    expect(fields).toContain('factoryRateSource.sourceNote');
    expect(hasParamChanged(base, compare)).toBe(true);
  });

  it('generates verification report including factory-rate traceability', () => {
    const base = captureQuoteParamRef('q1', 's1', {
      rateSnapshotVersion: 'v1',
      bomVersionRef: 'bom-v1',
      metalPrices: { copper: 72000, aluminum: 19800, source: 'manual' },
      rates: {
        managementFeeRate: 0.06,
        profitRate: 0.05,
        scrapRate: 0.01,
        packagingRate: 0.02,
        laborRate: 35,
      },
      factoryRateSource: {
        factoryId: 'KS',
        factoryName: '昆山工厂',
        laborRate: 28.6,
        manufacturingRate: 14.9,
        sourceNote: '来自《运营工时费报价基准》报价版运营成本工时费（不包含折旧）基准',
      },
      output: {
        totalCostPerSet: 100,
        sellingPricePerSet: 120,
        marginRate: 0.2,
        lifecycleProfit: 2000,
      },
    });

    const compare = captureQuoteParamRef('q2', 's1', {
      rateSnapshotVersion: 'v2',
      bomVersionRef: 'bom-v2',
      metalPrices: { copper: 72100, aluminum: 19800, source: 'manual' },
      rates: {
        managementFeeRate: 0.06,
        profitRate: 0.05,
        scrapRate: 0.01,
        packagingRate: 0.021,
        laborRate: 35,
      },
      factoryRateSource: {
        factoryId: 'WH',
        factoryName: '武汉工厂',
        laborRate: 30.1,
        manufacturingRate: 15.4,
        sourceNote: '来自新版运营工时费报价基准',
      },
      output: {
        totalCostPerSet: 101,
        sellingPricePerSet: 121,
        marginRate: 0.19,
        lifecycleProfit: 1980,
      },
    });

    const report = generateQuoteVerificationReport(base, compare, {
      generatedAt: '2026-04-16T03:00:00.000Z',
    });

    expect(report).toContain('# Quote Parameter Verification Report');
    expect(report).toContain('## Base Factory Rate Source');
    expect(report).toContain('基准工厂: 昆山工厂 (KS)');
    expect(report).toContain('基准工厂: 武汉工厂 (WH)');
    expect(report).toContain('工厂费率来源说明');
    expect(report).toContain('Cost Impact: +1.0000');
  });
});
