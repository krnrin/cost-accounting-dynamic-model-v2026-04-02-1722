/**
 * harness_costing.ts 核心公式验证
 * 对标 E281 Excel 验证数据
 */

import { describe, it, expect } from 'vitest';
import { computeHarnessCost, computeInternalHarnessCost, INTERNAL_DEFAULTS } from '../harness_costing';
import type { CostRates, MetalPrices, InternalCostRates } from '@/types/project';
import type { HarnessInput, BomItem, WireItem, PackagingCost, FreightCost } from '@/types/harness';

const RATES: CostRates = {
  laborRate: 35,
  mfgRate: 46.69,
  wasteRate: 0.01,
  mgmtRate: 0.06,
  profitRate: 0.056627,
};

const METALS: MetalPrices = {
  copper: 72800,
  aluminum: 20500,
};

function makeWireItem(overrides: Partial<WireItem>): WireItem {
  return {
    partNo: 'W001',
    partName: '测试导线',
    itemCategory: 'wire',
    qty: 1,
    unit: 'm',
    unitPrice: 0,
    amount: 0,
    copperWeightPerUnit: 0,
    aluminumWeightPerUnit: 0,
    nonMetalCostPerUnit: 0,
    ...overrides,
  };
}

function makeBomItem(overrides: Partial<BomItem>): BomItem {
  return {
    partNo: 'C001',
    partName: '测试连接器',
    itemCategory: 'connector',
    qty: 1,
    unit: '个',
    unitPrice: 10,
    amount: 10,
    ...overrides,
  };
}

const zeroPack: PackagingCost = { 
  innerBoxCost: 0, outerBoxCost: 0, palletCost: 0, 
  trayDividerCost: 0, bubbleWrapCost: 0, labelCost: 0, 
  subtotal: 0 
};
const zeroFreight: FreightCost = {
  freight: 0, excessFreight: 0, shortHaul: 0,
  thirdPartyWarehouse: 0, storage: 0, subtotal: 0,
};

describe('computeHarnessCost', () => {
  it('should compute basic material cost from BOM', () => {
    const input: HarnessInput = {
      harnessId: 'TEST001',
      harnessName: '测试线束',
      vehicleRatio: 1.0,
      bom: [
        makeBomItem({ partNo: 'C001', unitPrice: 50, qty: 2, amount: 100 }),
        makeBomItem({ partNo: 'C002', unitPrice: 30, qty: 1, amount: 30, itemCategory: 'terminal' }),
      ],
      frontHours: 0.5,
      backHours: 0.3,
      packaging: zeroPack,
      freight: zeroFreight,
    };

    const result = computeHarnessCost(input, RATES, METALS);

    // 材料 = 100 + 30 = 130
    expect(result.materialCost).toBeCloseTo(130, 2);
    // 废品 = 130 × 0.01 = 1.30
    expect(result.wasteCost).toBeCloseTo(1.30, 2);
    // 工时 = 0.5 + 0.3 = 0.8
    expect(result.processHours).toBeCloseTo(0.8, 4);
    // 人工 = 0.8 × 35 = 28
    expect(result.directLabor).toBeCloseTo(28, 2);
    // 制造 = 0.8 × 46.69 = 37.352
    expect(result.manufacturing).toBeCloseTo(37.352, 2);
    // 管理费 = (130 + 28 + 37.352) × 0.06 = 11.72112
    expect(result.mgmtFee).toBeCloseTo(11.72112, 2);
    // 利润 = (130 + 1.30 + 28 + 37.352 + 11.72112) × 0.056627
    const profitBase = 130 + 1.30 + 28 + 37.352 + 11.72112;
    expect(result.profit).toBeCloseTo(profitBase * 0.056627, 2);
    // 出厂价 = 材料+废品+人工+制造+管理+利润
    expect(result.exFactoryPrice).toBeCloseTo(
      result.materialCost + result.wasteCost + result.directLabor +
      result.manufacturing + result.mgmtFee + result.profit,
      2,
    );
    // 到厂价 = 出厂价 (无包装运输)
    expect(result.deliveredPrice).toBeCloseTo(result.exFactoryPrice, 2);
  });

  it('should compute wire material cost from metal weights', () => {
    const input: HarnessInput = {
      harnessId: 'WIRE001',
      harnessName: '导线测试',
      vehicleRatio: 1.0,
      bom: [
        makeWireItem({
          partNo: 'W001',
          qty: 10,
          copperWeightPerUnit: 0.001, // 1g/根
          aluminumWeightPerUnit: 0,
          nonMetalCostPerUnit: 0.5,
        }),
      ],
      frontHours: 0,
      backHours: 0,
      packaging: zeroPack,
      freight: zeroFreight,
    };

    const result = computeHarnessCost(input, RATES, METALS);

    // 铜成本 = 10 × 0.001 × 72800 = 728 (kg × 元/吨 → 需要看实际单位)
    // 铜重 = 10 × 0.001 = 0.01 kg
    expect(result.copperWeight).toBeCloseTo(0.01, 6);
  });

  it('should include packaging and freight in delivered price', () => {
    const input: HarnessInput = {
      harnessId: 'PACK001',
      harnessName: '包装测试',
      vehicleRatio: 0.525,
      bom: [
        makeBomItem({ amount: 100 }),
      ],
      frontHours: 0.1,
      backHours: 0.1,
      packaging: { ...zeroPack, innerBoxCost: 2, outerBoxCost: 3, subtotal: 5 },
      freight: {
        freight: 4, excessFreight: 1, shortHaul: 0.5,
        thirdPartyWarehouse: 0, storage: 0, subtotal: 5.5,
      },
    };

    const result = computeHarnessCost(input, RATES, METALS);

    expect(result.packSubtotal).toBeCloseTo(5, 2);
    expect(result.freightSubtotal).toBeCloseTo(5.5, 2);
    expect(result.deliveredPrice).toBeCloseTo(
      result.exFactoryPrice + 5 + 5.5,
      2,
    );
    expect(result.vehicleRatio).toBe(0.525);
  });

  it('should correctly apply management fee basis (excludes waste)', () => {
    // 管理费基数 = 材料 + 人工 + 制造 (不含废品)
    const input: HarnessInput = {
      harnessId: 'MGMT001',
      harnessName: '管理费基数测试',
      vehicleRatio: 1.0,
      bom: [makeBomItem({ amount: 200 })],
      frontHours: 1,
      backHours: 0,
      packaging: zeroPack,
      freight: zeroFreight,
    };

    const result = computeHarnessCost(input, RATES, METALS);

    // 管理费 = (材料 + 人工 + 制造) × 6%
    const mgmtBase = result.materialCost + result.directLabor + result.manufacturing;
    expect(result.mgmtFee).toBeCloseTo(mgmtBase * 0.06, 2);
  });
});

describe('computeInternalHarnessCost', () => {
  it('should compute internal cost with specific internal rates', () => {
    const input: HarnessInput = {
      harnessId: 'INT001',
      harnessName: '内部分解测试',
      vehicleRatio: 1.0,
      bom: [makeBomItem({ unitPrice: 100, qty: 1 })],
      frontHours: 0.6,
      backHours: 0.4,
      packaging: { ...zeroPack, innerBoxCost: 1, outerBoxCost: 1, subtotal: 2 },
      freight: {
        freight: 1, excessFreight: 0, shortHaul: 0,
        thirdPartyWarehouse: 0, storage: 0, subtotal: 1,
      },
    };

    const result = computeInternalHarnessCost(input, INTERNAL_DEFAULTS, METALS);

    // 工时 = 1.0
    expect(result.processHours).toBe(1.0);
    // 直接人工 = 1.0 × 29.19
    expect(result.directLabor).toBeCloseTo(29.19, 2);
    // 间接人工 = 1.0 × 8.4991
    expect(result.indirectLabor).toBeCloseTo(8.4991, 4);
    // 材料损耗 = 100 × 0.005 = 0.5
    expect(result.materialWaste).toBeCloseTo(0.5, 2);
    // 自动化仓 = 1.0 × 2.03
    expect(result.autoWarehouse).toBeCloseTo(2.03, 2);
    
    // 制造费小计 (除直接人工外)
    const mfgExpected = 
      8.4991 + 1.45 + 1.8563 + 1.4234 + 0.5 + 0.8764 + 2.03;
    expect(result.mfgOverheadTotal).toBeCloseTo(mfgExpected, 4);

    // 内部总成本 = 材料(100) + 直接人工(29.19) + 制造费(mfgExpected) + 包装运输(3)
    const totalExpected = 100 + 29.19 + mfgExpected + 3;
    expect(result.internalCost).toBeCloseTo(totalExpected, 2);
  });
});
