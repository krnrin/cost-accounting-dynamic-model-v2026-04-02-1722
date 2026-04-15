import { describe, it, expect } from 'vitest';
import {
  computeHarnessCost,
  computeHarnessCostBySchema,
  DEFAULT_COST_STRUCTURE,
  computeInternalHarnessCost,
  INTERNAL_DEFAULTS,
} from '../harness_costing';
import type { CostRates, MetalPrices, CostStructureSchema } from '@/types/project';
import type { HarnessInput, BomItem, PackagingCost, FreightCost } from '@/types/harness';

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

describe('computeHarnessCostBySchema', () => {
  const input: HarnessInput = {
    harnessId: 'TEST001',
    harnessName: '测试线束',
    vehicleRatio: 1.0,
    bom: [
      makeBomItem({ unitPrice: 50, qty: 2, amount: 100 }),
      makeBomItem({ unitPrice: 30, qty: 1, amount: 30, itemCategory: 'terminal' }),
    ],
    frontHours: 0.5,
    backHours: 0.3,
    packaging: { ...zeroPack, subtotal: 5 },
    freight: { ...zeroFreight, subtotal: 5.5 },
  };

  it('1. Test default schema computes all configured items', () => {
    const schemaResult = computeHarnessCostBySchema(input, DEFAULT_COST_STRUCTURE, METALS, null, RATES);

    expect(schemaResult.items['material']).toBeGreaterThan(0);
    expect(schemaResult.items['waste']).toBeGreaterThan(0);
    expect(schemaResult.items['directLabor']).toBeGreaterThan(0);
    expect(schemaResult.items['manufacturing']).toBeGreaterThan(0);
    expect(schemaResult.items['mgmtFee']).toBeGreaterThanOrEqual(0);
    expect(schemaResult.items['profit']).toBeGreaterThanOrEqual(0);
    expect(schemaResult.items['packaging']).toBeGreaterThan(0);
    expect(schemaResult.items['freight']).toBeGreaterThanOrEqual(0);
    expect(schemaResult.deliveredPrice).toBeGreaterThan(schemaResult.exFactoryPrice);
  });

  it('2. Test custom schema with extra items (e.g. add 认证费 as fixed_per_unit)', () => {
    const customSchema: CostStructureSchema = {
      name: '自定义结构',
      items: [
        ...DEFAULT_COST_STRUCTURE.items,
        { key: 'certFee', label: '认证费', calcMethod: 'fixed_per_unit', fixedAmount: 100, order: 100, inExFactory: true }
      ]
    };

    const result = computeHarnessCostBySchema(input, customSchema, METALS, null, RATES);
    const baseResult = computeHarnessCostBySchema(input, DEFAULT_COST_STRUCTURE, METALS, null, RATES);

    expect(result.items['certFee']).toBe(100);
    expect(result.exFactoryPrice).toBeCloseTo(baseResult.exFactoryPrice + 100, 2);
    expect(result.deliveredPrice).toBeCloseTo(baseResult.deliveredPrice + 100, 2);
  });

  it('2. Test custom schema with extra items (e.g. add 认证费 as fixed_per_unit)', () => {
    const customSchema: CostStructureSchema = {
      name: '自定义结构',
      items: [
        ...DEFAULT_COST_STRUCTURE.items,
        { key: 'certFee', label: '认证费', calcMethod: 'fixed_per_unit', fixedAmount: 100, order: 100, inExFactory: true }
      ]
    };

    const result = computeHarnessCostBySchema(input, customSchema, METALS, null, RATES);
    const baseResult = computeHarnessCostBySchema(input, DEFAULT_COST_STRUCTURE, METALS, null, RATES);

    expect(result.items['certFee']).toBe(100);
    expect(result.exFactoryPrice).toBeCloseTo(baseResult.exFactoryPrice + 100, 2);
    expect(result.deliveredPrice).toBeCloseTo(baseResult.deliveredPrice + 100, 2);
  });

  it('3. Test schema with different baseRef (e.g. mgmtFee based on material only)', () => {
    const customSchema: CostStructureSchema = {
      name: '材料基数管理费',
      items: [
        { key: 'material', label: '材料', calcMethod: 'bom_sum', order: 10 },
        { key: 'mgmtFee', label: '管理费', calcMethod: 'rate_x_base', rate: 0.1, baseRef: ['material'], order: 20 }
      ]
    };

    const result = computeHarnessCostBySchema(input, customSchema, METALS, null, RATES);
    
    expect(result.items['material']).toBe(130);
    expect(result.items['mgmtFee']).toBe(13); // 130 * 0.1
    expect(result.exFactoryPrice).toBe(143);
  });

  it('4. Test schema with missing items (no profit) — should still work', () => {
    const noProfitSchema: CostStructureSchema = {
      name: '无利润结构',
      items: DEFAULT_COST_STRUCTURE.items.filter(i => i.key !== 'profit')
    };

    const result = computeHarnessCostBySchema(input, noProfitSchema, METALS, null, RATES);

    expect(result.items['profit']).toBeUndefined();
    expect(result.exFactoryPrice).toBeGreaterThan(0);
  });

  it('5. Test backward compatibility — computeInternalHarnessCost works for runtime cost engine', () => {
    const result = computeInternalHarnessCost(input, INTERNAL_DEFAULTS, METALS);
    expect(result.harnessId).toBe('TEST001');
    expect(result.internalCost).toBeGreaterThan(0);
  });
});
