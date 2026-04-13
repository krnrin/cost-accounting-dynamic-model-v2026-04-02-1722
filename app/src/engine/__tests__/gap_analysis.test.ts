/**
 * gap_analysis.test.ts
 * 报价 vs 实绩 Gap 分析引擎测试
 */

import { describe, it, expect } from 'vitest';
import {
  computeGapAnalysis,
  buildDualMetalPrices,
  createGapAlignedSnapshot,
  computeProjectGapSummary,
} from '../gap_analysis';
import type { HarnessResult, InternalHarnessResult } from '@/types/harness';
import type { DualMetalPrices, GapAlignedSnapshot } from '@/types/gap_analysis';

// ══════════════════════════════════════════════════
// 测试固定数据
// ══════════════════════════════════════════════════

function makeQuoteResult(overrides?: Partial<HarnessResult>): HarnessResult {
  return {
    harnessId: 'H-001',
    harnessName: '测试线束',
    vehicleRatio: 1.0,
    copperWeight: 2.5,    // kg
    aluminumWeight: 0.8,  // kg
    processHours: 1.2,
    materialCost: 180,    // 客户口径铜价算出
    wasteCost: 1.8,       // 180 * 1%
    directLabor: 42,      // 1.2h * 35
    manufacturing: 56.03, // 1.2h * 46.69
    laborPlusMfg: 98.03,
    mgmtFee: 19.2,        // (180+42+56.03) * 6%  ≈ 16.68 (简化)
    profit: 17.8,
    exFactoryPrice: 358.83,
    packSubtotal: 8,
    freightSubtotal: 5,
    packTotal: 13,
    deliveredPrice: 371.83,
    materialBreakdown: {
      cuCost: 120, alCost: 14.4, nonMetalCost: 45.6,
      byType: { wire: 134.4, connector: 30, terminal: 10, ipt_terminal: 0, bracket_rubber: 3.6, tape_tube: 2, other: 0 },
      totalMetalCost: 134.4, totalNonWireCost: 45.6,
    },
    packagingDetail: { innerBoxCost: 2, outerBoxCost: 3, palletCost: 1, trayDividerCost: 0.5, bubbleWrapCost: 1, labelCost: 0.5, subtotal: 8 },
    freightDetail: { freight: 3, excessFreight: 0, shortHaul: 1, thirdPartyWarehouse: 0.5, storage: 0.5, subtotal: 5 },
    _params: { wasteRate: 0.01, mgmtRate: 0.06, profitRate: 0.0566, laborRate: 35, mfgRate: 46.69 },
    ...overrides,
  };
}

function makeInternalResult(overrides?: Partial<InternalHarnessResult>): InternalHarnessResult {
  return {
    harnessId: 'H-001',
    harnessName: '测试线束',
    vehicleRatio: 1.0,
    materialCost: 195,      // 现铜价更高 → 实绩材料贵
    directLabor: 34.3,      // 1.2h * 28.58
    indirectLabor: 8.5,
    lowValueConsumables: 3.2,
    materialConsumption: 4.1,
    factoryAmortization: 6.8,
    automationAmortization: 5.5,
    otherOverhead: 2.9,
    materialWaste: 0.975,   // 195 * 0.5%
    mfgOverheadTotal: 31.0, // 各MOH合计
    packTotal: 13,
    internalCost: 274.275,  // 195+34.3+0.975+31+13
    processHours: 1.2,
    copperWeight: 2.5,
    aluminumWeight: 0.8,
    gapStatus: 'NORMAL',
    managementGapAmount: 0,
    salesAdjustmentBuffer: 0,
    ...overrides,
  };
}

// 客户口径: 铜68400 铝18200; 实绩口径: 现铜72150 现铝19000
function makeDualMetalPrices(): DualMetalPrices {
  return buildDualMetalPrices(
    68400, 18200,   // 客户口径
    72150, 19000,   // 实绩口径 (现货)
    'manual',
    '手动录入'
  );
}

// ══════════════════════════════════════════════════
// 测试
// ══════════════════════════════════════════════════

describe('buildDualMetalPrices', () => {
  it('正确计算铜铝价差', () => {
    const dual = makeDualMetalPrices();
    // 客户铜价68400 - 现铜72150 = -3750 (报价低于实绩，不利)
    expect(dual.copperSpread).toBe(-3750);
    // 客户铝价18200 - 现铝19000 = -800
    expect(dual.aluminumSpread).toBe(-800);
  });

  it('标签正确', () => {
    const dual = makeDualMetalPrices();
    expect(dual.customer.label).toBe('客户口径');
    expect(dual.internal.label).toBe('手动录入');
  });
});

describe('computeGapAnalysis', () => {
  const quote = makeQuoteResult();
  const internal = makeInternalResult();
  const metalPrices = makeDualMetalPrices();

  it('总 Gap = deliveredPrice - internalCost', () => {
    const gap = computeGapAnalysis(quote, internal, metalPrices);
    expect(gap.totalGap).toBeCloseTo(quote.deliveredPrice - internal.internalCost, 2);
  });

  it('瀑布图校验: 各项之和 === totalGap', () => {
    const gap = computeGapAnalysis(quote, internal, metalPrices);
    expect(gap.waterfallBalanced).toBe(true);
    const waterfallSum = gap.waterfall.reduce((s, item) => s + item.value, 0);
    expect(waterfallSum).toBeCloseTo(gap.totalGap, 1);
  });

  it('铜价效应 = copperWeight * copperSpread / 1000', () => {
    const gap = computeGapAnalysis(quote, internal, metalPrices);
    const expected = 2.5 * (-3750) / 1000; // -9.375
    expect(gap.copperPriceEffect).toBeCloseTo(expected, 2);
  });

  it('铝价效应 = aluminumWeight * aluminumSpread / 1000', () => {
    const gap = computeGapAnalysis(quote, internal, metalPrices);
    const expected = 0.8 * (-800) / 1000; // -0.64
    expect(gap.aluminumPriceEffect).toBeCloseTo(expected, 2);
  });

  it('金属价格效应 = 铜价效应 + 铝价效应', () => {
    const gap = computeGapAnalysis(quote, internal, metalPrices);
    expect(gap.metalPriceEffect).toBeCloseTo(gap.copperPriceEffect + gap.aluminumPriceEffect, 2);
  });

  it('用量效应 = materialGap - metalPriceEffect', () => {
    const gap = computeGapAnalysis(quote, internal, metalPrices);
    expect(gap.volumeEffect).toBeCloseTo(gap.materialGap - gap.metalPriceEffect, 2);
  });

  it('毛利空间 = 管理费 + 利润', () => {
    const gap = computeGapAnalysis(quote, internal, metalPrices);
    expect(gap.grossMarginDesigned).toBeCloseTo(quote.mgmtFee + quote.profit, 2);
  });

  it('当 totalGap < 0 时风险为 danger', () => {
    const expensiveInternal = makeInternalResult({ internalCost: 500 });
    const gap = computeGapAnalysis(quote, expensiveInternal, metalPrices);
    expect(gap.riskLevel).toBe('danger');
  });

  it('当 totalGapRate < 3% 时风险为 watch', () => {
    // 内部成本接近报价，毛利窇薄
    const thinMargin = makeInternalResult({ internalCost: 362 });
    const gap = computeGapAnalysis(quote, thinMargin, metalPrices);
    expect(gap.totalGapRate).toBeLessThan(0.03);
    expect(gap.riskLevel).toBe('watch');
  });
});

describe('createGapAlignedSnapshot', () => {
  it('自动生成 id 和 createdAt', () => {
    const snapshot = createGapAlignedSnapshot({
      scenarioId: 'sc-1',
      projectId: 'proj-1',
      trigger: 'manual',
      sharedBom: { bom: [], processHours: 1.2 },
      metalPrices: makeDualMetalPrices(),
      quote: {
        rates: { wasteRate: 0.01, mgmtRate: 0.06, profitRate: 0.0566, laborRate: 35, mfgRate: 46.69 },
        result: makeQuoteResult(),
      },
      internal: {
        factoryId: 'F1',
        rates: { assemblyLaborRate: 28.58, scrapRate: 0.005, mohComponents: {} },
        result: makeInternalResult(),
      },
    });

    expect(snapshot.id).toMatch(/^gap-/);
    expect(snapshot.createdAt).toBeTruthy();
    expect(snapshot.gap).toBeDefined();
    expect(snapshot.gap.totalGap).toBeDefined();
  });
});

describe('computeProjectGapSummary', () => {
  it('空快照返回安全状态', () => {
    const summary = computeProjectGapSummary([]);
    expect(summary.projectRiskLevel).toBe('safe');
    expect(summary.weightedTotalGap).toBe(0);
  });

  it('加权 Gap 等于各线束 Gap × vehicleRatio 之和', () => {
    const snap1 = createGapAlignedSnapshot({
      scenarioId: 'sc-1',
      projectId: 'proj-1',
      trigger: 'manual',
      sharedBom: { bom: [], processHours: 1.2 },
      metalPrices: makeDualMetalPrices(),
      quote: {
        rates: { wasteRate: 0.01, mgmtRate: 0.06, profitRate: 0.0566, laborRate: 35, mfgRate: 46.69 },
        result: makeQuoteResult({ vehicleRatio: 0.6 }),
      },
      internal: {
        factoryId: 'F1',
        rates: { assemblyLaborRate: 28.58, scrapRate: 0.005, mohComponents: {} },
        result: makeInternalResult({ vehicleRatio: 0.6 }),
      },
    });

    const snap2 = createGapAlignedSnapshot({
      scenarioId: 'sc-1',
      projectId: 'proj-1',
      trigger: 'manual',
      sharedBom: { bom: [], processHours: 0.8 },
      metalPrices: makeDualMetalPrices(),
      quote: {
        rates: { wasteRate: 0.01, mgmtRate: 0.06, profitRate: 0.0566, laborRate: 35, mfgRate: 46.69 },
        result: makeQuoteResult({ harnessId: 'H-002', harnessName: '线束2', vehicleRatio: 0.4 }),
      },
      internal: {
        factoryId: 'F1',
        rates: { assemblyLaborRate: 28.58, scrapRate: 0.005, mohComponents: {} },
        result: makeInternalResult({ harnessId: 'H-002', harnessName: '线束2', vehicleRatio: 0.4 }),
      },
    });

    const summary = computeProjectGapSummary([snap1, snap2]);
    const expected = snap1.gap.totalGap * 0.6 + snap2.gap.totalGap * 0.4;
    expect(summary.weightedTotalGap).toBeCloseTo(expected, 1);
  });

  it('亏损线束列表正确标记', () => {
    const dangerSnap = createGapAlignedSnapshot({
      scenarioId: 'sc-1',
      projectId: 'proj-1',
      trigger: 'manual',
      sharedBom: { bom: [], processHours: 1.2 },
      metalPrices: makeDualMetalPrices(),
      quote: {
        rates: { wasteRate: 0.01, mgmtRate: 0.06, profitRate: 0.0566, laborRate: 35, mfgRate: 46.69 },
        result: makeQuoteResult({ deliveredPrice: 200 }), // 报价远低于实绩
      },
      internal: {
        factoryId: 'F1',
        rates: { assemblyLaborRate: 28.58, scrapRate: 0.005, mohComponents: {} },
        result: makeInternalResult({ internalCost: 300 }),
      },
    });

    const summary = computeProjectGapSummary([dangerSnap]);
    expect(summary.dangerHarnesses.length).toBeGreaterThan(0);
    expect(summary.projectRiskLevel).not.toBe('safe');
  });
});
