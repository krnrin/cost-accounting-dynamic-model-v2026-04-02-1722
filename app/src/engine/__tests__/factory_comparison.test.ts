import { describe, it, expect } from 'vitest';
import { 
  computeHarnessCostForFactory, 
  compareFactoryCosts, 
  REFERENCE_FACTORIES 
} from '../factory_comparison';
import { computeHarnessCost, DEFAULTS } from '../harness_costing';
import type { HarnessInput } from '@/types/harness';
import type { MetalPrices, FactoryConfig } from '@/types/project';

const TEST_INPUT: HarnessInput = {
  harnessId: 'TEST-001',
  harnessName: '测试线束',
  vehicleRatio: 1.0,
  bom: [],
  frontHours: 0.5,
  backHours: 0.3,
  packaging: { innerBoxCost: 1, outerBoxCost: 1, palletCost: 0.5, trayDividerCost: 0.2, bubbleWrapCost: 0.1, labelCost: 0.2, subtotal: 3 },
  freight: { freight: 2, excessFreight: 0, shortHaul: 0.5, thirdPartyWarehouse: 0, storage: 0, subtotal: 2.5 },
};

const METAL_PRICES: MetalPrices = {
  copper: 68400,
  aluminum: 18200,
};

describe('factory_comparison', () => {
  it('computeHarnessCostForFactory adjusts hours based on efficiency factor', () => {
    const factory: FactoryConfig = {
      factoryId: 'TEST',
      factoryName: 'Test Factory',
      costRates: DEFAULTS,
      efficiencyFactor: 1.2, // 效率低 20%，工时增加 20%
    };

    const input = { ...TEST_INPUT };
    (input as any).materialCost = 100;

    const result = computeHarnessCostForFactory(input, factory, METAL_PRICES);
    
    // Base process hours = 0.5 + 0.3 = 0.8
    // Adjusted hours = 0.8 * 1.2 = 0.96
    expect(result.processHours).toBeCloseTo(0.96);
    expect(result.directLabor).toBeCloseTo(0.96 * DEFAULTS.laborRate);
  });

  it('efficiency=1.0 gives same result as computeHarnessCost directly', () => {
    const factory: FactoryConfig = {
      factoryId: 'BASE',
      factoryName: 'Base Factory',
      costRates: DEFAULTS,
      efficiencyFactor: 1.0,
    };

    const input = { ...TEST_INPUT };
    (input as any).materialCost = 100;

    const resultFromFactory = computeHarnessCostForFactory(input, factory, METAL_PRICES);
    const directResult = computeHarnessCost(input, DEFAULTS, METAL_PRICES);

    expect(resultFromFactory.deliveredPrice).toBe(directResult.deliveredPrice);
    expect(resultFromFactory.directLabor).toBe(directResult.directLabor);
  });

  it('efficiency=0.5 halves labor and manufacturing costs', () => {
    const factory: FactoryConfig = {
      factoryId: 'FAST',
      factoryName: 'Fast Factory',
      costRates: DEFAULTS,
      efficiencyFactor: 0.5,
    };

    const input = { ...TEST_INPUT };
    (input as any).materialCost = 100;

    const result = computeHarnessCostForFactory(input, factory, METAL_PRICES);
    const baseResult = computeHarnessCost(input, DEFAULTS, METAL_PRICES);

    expect(result.processHours).toBe(baseResult.processHours * 0.5);
    expect(result.directLabor).toBe(baseResult.directLabor * 0.5);
    expect(result.manufacturing).toBe(baseResult.manufacturing * 0.5);
  });

  it('compareFactoryCosts finds correct lowest and highest cost factories', () => {
    const factories: FactoryConfig[] = [
      { factoryId: 'HQ', factoryName: 'HQ', costRates: { ...DEFAULTS, laborRate: 30 }, efficiencyFactor: 1.0, isBase: true },
      { factoryId: 'EXPENSIVE', factoryName: 'Expensive', costRates: { ...DEFAULTS, laborRate: 50 }, efficiencyFactor: 1.2 },
      { factoryId: 'CHEAP', factoryName: 'Cheap', costRates: { ...DEFAULTS, laborRate: 20 }, efficiencyFactor: 0.8 },
    ];

    const input = { ...TEST_INPUT };
    (input as any).materialCost = 100;

    const comparison = compareFactoryCosts(input, factories, METAL_PRICES);

    expect(comparison.lowestCostFactory).toBe('CHEAP');
    expect(comparison.highestCostFactory).toBe('EXPENSIVE');
    expect(comparison.factories).toHaveLength(3);
    
    const hqResult = comparison.factories.find(f => f.factoryId === 'HQ');
    expect(hqResult?.deltaFromBase).toBe(0);
    expect(hqResult?.deltaPercent).toBe(0);
  });

  it('empty factories array defaults to DEFAULTS', () => {
    const input = { ...TEST_INPUT };
    (input as any).materialCost = 100;

    const comparison = compareFactoryCosts(input, [], METAL_PRICES);

    expect(comparison.factories).toHaveLength(1);
    expect(comparison.factories[0]?.factoryId).toBe('default');
    expect(comparison.factories[0]?.result.deliveredPrice).toBeGreaterThan(0);
  });

  it('material cost is NOT affected by efficiency factor', () => {
    const factory1: FactoryConfig = {
      factoryId: 'F1',
      factoryName: 'F1',
      costRates: DEFAULTS,
      efficiencyFactor: 1.0,
    };
    const factory2: FactoryConfig = {
      factoryId: 'F2',
      factoryName: 'F2',
      costRates: DEFAULTS,
      efficiencyFactor: 2.0,
    };

    const input = { ...TEST_INPUT };
    (input as any).materialCost = 100;

    const res1 = computeHarnessCostForFactory(input, factory1, METAL_PRICES);
    const res2 = computeHarnessCostForFactory(input, factory2, METAL_PRICES);

    expect(res1.materialCost).toBe(100);
    expect(res2.materialCost).toBe(100);
    expect(res1.materialCost).toBe(res2.materialCost);
  });

  it('works with realistic REFERENCE_FACTORIES data', () => {
    const input = { ...TEST_INPUT };
    (input as any).materialCost = 50;

    const comparison = compareFactoryCosts(input, REFERENCE_FACTORIES, METAL_PRICES);
    
    expect(comparison.factories).toHaveLength(7);
    expect(comparison.lowestCostFactory).toBeDefined();
    expect(comparison.highestCostFactory).toBeDefined();
    expect(comparison.costRange).toBeGreaterThan(0);
  });
});
