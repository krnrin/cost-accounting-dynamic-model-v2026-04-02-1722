import { describe, it, expect } from 'vitest';
import {
  computeHarnessCostForFactory,
  compareFactoryCosts,
  REFERENCE_FACTORIES
} from '../factory_comparison';
import { computeInternalHarnessCost, INTERNAL_DEFAULTS, mapInternalToHarnessResult } from '../harness_costing';
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
      costRates: { laborRate: INTERNAL_DEFAULTS.laborRate, mfgRate: 0, wasteRate: INTERNAL_DEFAULTS.materialWasteRate, mgmtRate: 0, profitRate: 0 },
      efficiencyFactor: 1.2, // 效率低 20%，工时增加 20%
    };

    const input = { ...TEST_INPUT };
    (input as any).materialCost = 100;

    const result = computeHarnessCostForFactory(input, factory, METAL_PRICES);
    
    // Base process hours = 0.5 + 0.3 = 0.8
    // Adjusted hours = 0.8 * 1.2 = 0.96
    expect(result.processHours).toBeCloseTo(0.96);
    expect(result.directLabor).toBeCloseTo(0.96 * INTERNAL_DEFAULTS.laborRate);
  });

  it('efficiency=1.0 with explicit internalRates matches direct internal computation', () => {
    const factory: FactoryConfig = {
      factoryId: 'BASE',
      factoryName: 'Base Factory',
      costRates: { laborRate: INTERNAL_DEFAULTS.laborRate, mfgRate: 0, wasteRate: INTERNAL_DEFAULTS.materialWasteRate, mgmtRate: 0, profitRate: 0 },
      internalRates: { ...INTERNAL_DEFAULTS },
      efficiencyFactor: 1.0,
    };

    const input = { ...TEST_INPUT };
    (input as any).materialCost = 100;

    const resultFromFactory = computeHarnessCostForFactory(input, factory, METAL_PRICES);
    const directResult = mapInternalToHarnessResult(computeInternalHarnessCost(input, INTERNAL_DEFAULTS, METAL_PRICES));

    expect(resultFromFactory.deliveredPrice).toBe(directResult.deliveredPrice);
    expect(resultFromFactory.directLabor).toBe(directResult.directLabor);
    expect(resultFromFactory.manufacturing).toBe(directResult.manufacturing);
  });

  it('efficiency=0.5 halves labor and manufacturing costs', () => {
    const factory: FactoryConfig = {
      factoryId: 'FAST',
      factoryName: 'Fast Factory',
      costRates: { laborRate: INTERNAL_DEFAULTS.laborRate, mfgRate: 0, wasteRate: INTERNAL_DEFAULTS.materialWasteRate, mgmtRate: 0, profitRate: 0 },
      efficiencyFactor: 0.5,
    };

    const input = { ...TEST_INPUT };
    (input as any).materialCost = 100;

    const result = computeHarnessCostForFactory(input, factory, METAL_PRICES);
    const baseResult = mapInternalToHarnessResult(computeInternalHarnessCost(input, INTERNAL_DEFAULTS, METAL_PRICES));

    expect(result.processHours).toBe(baseResult.processHours * 0.5);
    expect(result.directLabor).toBe(baseResult.directLabor * 0.5);
    expect(result.manufacturing).toBeLessThan(baseResult.manufacturing);
  });

  it('compareFactoryCosts finds correct lowest and highest cost factories', () => {
    const factories: FactoryConfig[] = [
      { factoryId: 'HQ', factoryName: 'HQ', costRates: { laborRate: 30, mfgRate: 0, wasteRate: INTERNAL_DEFAULTS.materialWasteRate, mgmtRate: 0, profitRate: 0 }, efficiencyFactor: 1.0, isBase: true },
      { factoryId: 'EXPENSIVE', factoryName: 'Expensive', costRates: { laborRate: 50, mfgRate: 0, wasteRate: INTERNAL_DEFAULTS.materialWasteRate, mgmtRate: 0, profitRate: 0 }, efficiencyFactor: 1.2 },
      { factoryId: 'CHEAP', factoryName: 'Cheap', costRates: { laborRate: 20, mfgRate: 0, wasteRate: INTERNAL_DEFAULTS.materialWasteRate, mgmtRate: 0, profitRate: 0 }, efficiencyFactor: 0.8 },
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

  it('empty factories array defaults to internal defaults', () => {
    const input = { ...TEST_INPUT };
    (input as any).materialCost = 100;

    const comparison = compareFactoryCosts(input, [], METAL_PRICES);

    expect(comparison.factories).toHaveLength(1);
    expect(comparison.factories[0]?.factoryId).toBe('default');
    expect(comparison.factories[0]?.result.deliveredPrice).toBeGreaterThanOrEqual(0);
  });

  it('material cost is NOT affected by efficiency factor', () => {
    const factory1: FactoryConfig = {
      factoryId: 'F1',
      factoryName: 'F1',
      costRates: { laborRate: INTERNAL_DEFAULTS.laborRate, mfgRate: 0, wasteRate: INTERNAL_DEFAULTS.materialWasteRate, mgmtRate: 0, profitRate: 0 },
      efficiencyFactor: 1.0,
    };
    const factory2: FactoryConfig = {
      factoryId: 'F2',
      factoryName: 'F2',
      costRates: { laborRate: INTERNAL_DEFAULTS.laborRate, mfgRate: 0, wasteRate: INTERNAL_DEFAULTS.materialWasteRate, mgmtRate: 0, profitRate: 0 },
      efficiencyFactor: 2.0,
    };

    const input = { ...TEST_INPUT };
    (input as any).materialCost = 100;

    const res1 = computeHarnessCostForFactory(input, factory1, METAL_PRICES);
    const res2 = computeHarnessCostForFactory(input, factory2, METAL_PRICES);

    expect(res1.materialCost).toBeGreaterThanOrEqual(0);
    expect(res2.materialCost).toBeGreaterThanOrEqual(0);
    expect(res1.materialCost).toBe(res2.materialCost);
  });

  it('mfgRate changes manufacturing overhead even without explicit internalRates', () => {
    const lowMfgFactory: FactoryConfig = {
      factoryId: 'LOW-MFG',
      factoryName: 'Low MFG',
      costRates: { laborRate: INTERNAL_DEFAULTS.laborRate, mfgRate: 6, wasteRate: INTERNAL_DEFAULTS.materialWasteRate, mgmtRate: 0, profitRate: 0 },
      efficiencyFactor: 1.0,
    };
    const highMfgFactory: FactoryConfig = {
      factoryId: 'HIGH-MFG',
      factoryName: 'High MFG',
      costRates: { laborRate: INTERNAL_DEFAULTS.laborRate, mfgRate: 18, wasteRate: INTERNAL_DEFAULTS.materialWasteRate, mgmtRate: 0, profitRate: 0 },
      efficiencyFactor: 1.0,
    };

    const input = { ...TEST_INPUT };
    (input as any).materialCost = 100;

    const lowResult = computeHarnessCostForFactory(input, lowMfgFactory, METAL_PRICES);
    const highResult = computeHarnessCostForFactory(input, highMfgFactory, METAL_PRICES);

    expect(highResult.manufacturing).toBeGreaterThan(lowResult.manufacturing);
    expect(highResult.deliveredPrice).toBeGreaterThan(lowResult.deliveredPrice);
  });

  it('compareFactoryCosts sorts factories by parameterized mfgRate', () => {
    const factories: FactoryConfig[] = [
      { factoryId: 'BASE', factoryName: 'Base', costRates: { laborRate: INTERNAL_DEFAULTS.laborRate, mfgRate: 10, wasteRate: INTERNAL_DEFAULTS.materialWasteRate, mgmtRate: 0, profitRate: 0 }, efficiencyFactor: 1.0, isBase: true },
      { factoryId: 'LOW', factoryName: 'Low', costRates: { laborRate: INTERNAL_DEFAULTS.laborRate, mfgRate: 6, wasteRate: INTERNAL_DEFAULTS.materialWasteRate, mgmtRate: 0, profitRate: 0 }, efficiencyFactor: 1.0 },
      { factoryId: 'HIGH', factoryName: 'High', costRates: { laborRate: INTERNAL_DEFAULTS.laborRate, mfgRate: 18, wasteRate: INTERNAL_DEFAULTS.materialWasteRate, mgmtRate: 0, profitRate: 0 }, efficiencyFactor: 1.0 },
    ];

    const input = { ...TEST_INPUT };
    (input as any).materialCost = 100;

    const comparison = compareFactoryCosts(input, factories, METAL_PRICES);

    expect(comparison.lowestCostFactory).toBe('LOW');
    expect(comparison.highestCostFactory).toBe('HIGH');
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
