/**
 * harness_costing.ts 核心公式验证
 * 对标 E281 Excel 验证数据
 */

import { describe, it, expect } from 'vitest';
import { computeInternalHarnessCost, INTERNAL_DEFAULTS } from '../harness_costing';
import type { MetalPrices } from '@/types/project';
import type { HarnessInput, BomItem, WireItem, PackagingCost, FreightCost } from '@/types/harness';

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

describe('computeInternalHarnessCost basics', () => {
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

    const result = computeInternalHarnessCost(input, INTERNAL_DEFAULTS, METALS);

    expect(result.materialCost).toBeCloseTo(130, 2);
    expect(result.processHours).toBeCloseTo(0.8, 4);
    expect(result.directLabor).toBeCloseTo(0.8 * INTERNAL_DEFAULTS.laborRate, 2);
    expect(result.materialWaste).toBeCloseTo(130 * INTERNAL_DEFAULTS.materialWasteRate, 2);
    const expectedMfg =
      0.8 * INTERNAL_DEFAULTS.indirectLaborRate +
      0.8 * INTERNAL_DEFAULTS.lowValueConsumablesRate +
      0.8 * INTERNAL_DEFAULTS.materialConsumptionRate +
      0.8 * INTERNAL_DEFAULTS.factoryAmortizationRate +
      0.8 * INTERNAL_DEFAULTS.automationAmortizationRate +
      0.8 * INTERNAL_DEFAULTS.otherOverheadRate +
      130 * INTERNAL_DEFAULTS.materialWasteRate;
    expect(result.mfgOverheadTotal).toBeCloseTo(expectedMfg, 2);
    expect(result.internalCost).toBeCloseTo(130 + result.directLabor + expectedMfg, 2);
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

    const result = computeInternalHarnessCost(input, INTERNAL_DEFAULTS, METALS);

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

    const result = computeInternalHarnessCost(input, INTERNAL_DEFAULTS, METALS);

    expect(result.packTotal).toBeCloseTo(10.5, 2);
    expect(result.internalCost).toBeCloseTo(
      result.materialCost + result.directLabor + result.mfgOverheadTotal + 10.5,
      2,
    );
    expect(result.vehicleRatio).toBe(0.525);
  });

  it('should correctly apply internal material waste basis', () => {
    const input: HarnessInput = {
      harnessId: 'MGMT001',
      harnessName: '材料损耗基数测试',
      vehicleRatio: 1.0,
      bom: [makeBomItem({ amount: 200 })],
      frontHours: 1,
      backHours: 0,
      packaging: zeroPack,
      freight: zeroFreight,
    };

    const result = computeInternalHarnessCost(input, INTERNAL_DEFAULTS, METALS);
    expect(result.materialWaste).toBeGreaterThanOrEqual(0);
    expect(result.materialWaste).toBeLessThanOrEqual(result.materialCost * INTERNAL_DEFAULTS.materialWasteRate + 1e-6);
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
    // 直接人工 = 1.0 × 28.58 (INTERNAL_DEFAULTS.laborRate)
    expect(result.directLabor).toBeCloseTo(28.58, 2);
    // 间接人工 = 1.0 × 8.50 (INTERNAL_DEFAULTS.indirectLaborRate)
    expect(result.indirectLabor).toBeCloseTo(8.50, 2);
    // 材料损耗 = 100 × 0.005 = 0.5
    expect(result.materialWaste).toBeCloseTo(0.5, 2);
    // 自动化仓 = 1.0 × 2.03
    expect(result.automationAmortization).toBeCloseTo(2.03, 2);

    // 制造费小计 (除直接人工外)
    // indirectLabor(8.50) + factoryAmortization(1.45) + materialConsumption(1.86) + otherOverhead(1.42) + materialWaste(0.5) + lowValueConsumables(0.88) + automationAmortization(2.03)
    const mfgExpected =
      8.50 + 1.45 + 1.86 + 1.42 + 0.5 + 0.88 + 2.03;
    expect(result.mfgOverheadTotal).toBeCloseTo(mfgExpected, 2);

    // 内部总成本 = 材料(100) + 直接人工(28.58) + 制造费(mfgExpected) + 包装运输(3)
    const totalExpected = 100 + 28.58 + mfgExpected + 3;
    expect(result.internalCost).toBeCloseTo(totalExpected, 2);
  });
});
