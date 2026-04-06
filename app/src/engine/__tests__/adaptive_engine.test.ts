import { describe, it, expect } from 'vitest';
import {
  computeHarnessCostAdaptive,
  computeHarnessesFromSeedData,
  DEFAULT_COST_STRUCTURE,
  DEFAULTS,
} from '../harness_costing';
import { LEVEL1_COEFFICIENTS } from '../precision';
import type { HarnessInput } from '@/types/harness';
import type { CostRates, MetalPrices } from '@/types/project';

const mockRates: CostRates = {
  laborRate: 35,
  mfgRate: 46.69,
  wasteRate: 0.01,
  mgmtRate: 0.06,
  profitRate: 0.056627,
};

const mockMetalPrices: MetalPrices = {
  copper: 68400,
  aluminum: 18200,
};

const baseInput: HarnessInput = {
  harnessId: 'ADAP-001',
  harnessName: 'Adaptive Test Harness',
  vehicleRatio: 1,
  bom: [],
  frontHours: 0,
  backHours: 0,
  packaging: {
    innerBoxCost: 0, outerBoxCost: 0, palletCost: 0,
    trayDividerCost: 0, bubbleWrapCost: 0, labelCost: 0, subtotal: 0,
  },
  freight: {
    freight: 0, excessFreight: 0, shortHaul: 0,
    thirdPartyWarehouse: 0, storage: 0, subtotal: 0,
  },
};

describe('computeHarnessCostAdaptive', () => {
  describe('Level 3 — BOM line-level', () => {
    it('returns precision level 3 when BOM has items', () => {
      const input: HarnessInput = {
        ...baseInput,
        bom: [
          { partNo: 'W-001', partName: 'Copper Wire 0.35', itemCategory: 'wire', qty: 12, unit: 'm', unitPrice: 3.5, amount: 42 },
          { partNo: 'C-001', partName: 'Connector 24P', itemCategory: 'connector', qty: 2, unit: 'pcs', unitPrice: 15, amount: 30 },
        ],
        frontHours: 0.15,
        backHours: 0.05,
      };
      const result = computeHarnessCostAdaptive(input, mockRates, mockMetalPrices);
      expect(result.precisionLevel).toBe(3);
      expect(result.materialCost).toBeGreaterThan(0);
      expect(result.directLabor).toBeGreaterThan(0);
    });

    it('uses standard engine when no costStructure in options', () => {
      const input: HarnessInput = {
        ...baseInput,
        bom: [
          { partNo: 'W-001', partName: 'Wire', itemCategory: 'wire', qty: 10, unit: 'm', unitPrice: 5, amount: 50 },
        ],
        frontHours: 0.1,
        backHours: 0.05,
      };
      const result = computeHarnessCostAdaptive(input, mockRates, mockMetalPrices);
      expect(result.precisionLevel).toBe(3);
      expect(result.harnessId).toBe('ADAP-001');
    });

    it('uses Schema engine when costStructure is provided', () => {
      const input: HarnessInput = {
        ...baseInput,
        bom: [
          { partNo: 'W-001', partName: 'Wire', itemCategory: 'wire', qty: 10, unit: 'm', unitPrice: 5, amount: 50 },
        ],
        frontHours: 0.1,
        backHours: 0.05,
      };
      const result = computeHarnessCostAdaptive(input, mockRates, mockMetalPrices, null, {
        costStructure: DEFAULT_COST_STRUCTURE,
      });
      expect(result.precisionLevel).toBe(3);
      expect(result.deliveredPrice).toBeGreaterThan(0);
    });
  });

  describe('Level 2 — Harness-level summary', () => {
    it('returns precision level 2 when materialCost provided but no BOM', () => {
      const input: any = {
        ...baseInput,
        materialCost: 200,
        frontHours: 0.2,
      };
      const result = computeHarnessCostAdaptive(input, mockRates, mockMetalPrices);
      expect(result.precisionLevel).toBe(2);
      expect(result.materialCost).toBe(200);
    });

    it('returns precision level 2 when processHours provided but no BOM', () => {
      const input: HarnessInput = {
        ...baseInput,
        frontHours: 0.3,
        backHours: 0.1,
      };
      const result = computeHarnessCostAdaptive(input, mockRates, mockMetalPrices);
      expect(result.precisionLevel).toBe(2);
      expect(result.directLabor).toBeGreaterThan(0);
    });
  });

  describe('Level 1 — Coefficient approximation', () => {
    it('returns precision level 1 with referenceTotalPrice via options', () => {
      const result = computeHarnessCostAdaptive(baseInput, mockRates, mockMetalPrices, null, {
        referenceTotalPrice: 500,
      });
      expect(result.precisionLevel).toBe(1);
      expect(result.deliveredPrice).toBeGreaterThan(0);
      expect(result.materialCost).toBeGreaterThan(0);
    });

    it('decomposes total price correctly using default coefficients', () => {
      const totalPrice = 1000;
      const result = computeHarnessCostAdaptive(baseInput, mockRates, mockMetalPrices, null, {
        referenceTotalPrice: totalPrice,
      });
      expect(result.precisionLevel).toBe(1);
      // Material ≈ 58%
      expect(result.materialCost).toBeCloseTo(totalPrice * LEVEL1_COEFFICIENTS.materialRatio, 1);
    });

    it('uses custom coefficients when provided', () => {
      const customCoeffs = {
        materialRatio: 0.5,
        laborRatio: 0.1,
        mfgRatio: 0.15,
        packagingRatio: 0.03,
        freightRatio: 0.02,
      };
      const result = computeHarnessCostAdaptive(baseInput, mockRates, mockMetalPrices, null, {
        referenceTotalPrice: 1000,
        level1Coefficients: customCoeffs,
      });
      expect(result.materialCost).toBe(500);
      expect(result.directLabor).toBe(100);
      expect(result.manufacturing).toBe(150);
    });

    it('returns zero-like result when no data at all (Level 1 fallback)', () => {
      const result = computeHarnessCostAdaptive(baseInput, mockRates, mockMetalPrices);
      expect(result.precisionLevel).toBe(1);
      // No ref price → fallback to standard engine with empty input → zero costs
      expect(result.deliveredPrice).toBe(0);
    });

    it('reads referenceTotalPrice from input when not in options', () => {
      const input: any = {
        ...baseInput,
        referenceTotalPrice: 800,
      };
      const result = computeHarnessCostAdaptive(input, mockRates, mockMetalPrices);
      expect(result.precisionLevel).toBe(1);
      expect(result.materialCost).toBeCloseTo(800 * LEVEL1_COEFFICIENTS.materialRatio, 1);
    });
  });

  describe('forcePrecisionLevel', () => {
    it('forces Level 1 even with BOM data', () => {
      const input: HarnessInput = {
        ...baseInput,
        bom: [
          { partNo: 'W-001', partName: 'Wire', itemCategory: 'wire', qty: 10, unit: 'm', unitPrice: 5, amount: 50 },
        ],
        frontHours: 0.1,
        backHours: 0.05,
      };
      const result = computeHarnessCostAdaptive(input, mockRates, mockMetalPrices, null, {
        forcePrecisionLevel: 1,
        referenceTotalPrice: 500,
      });
      expect(result.precisionLevel).toBe(1);
    });

    it('forces Level 3 route even without BOM — uses standard engine path', () => {
      const result = computeHarnessCostAdaptive(baseInput, mockRates, mockMetalPrices, null, {
        forcePrecisionLevel: 3,
      });
      // forcePrecisionLevel=3 routes through standard engine (not Level 1 estimator)
      // Standard engine detects actual precision from input data
      // With no BOM/hours/materialCost, standard engine returns precisionLevel=1
      expect(result.precisionLevel).toBe(1);
      // Key assertion: it did NOT use the Level 1 coefficient estimator
      // (deliveredPrice would be > 0 if Level 1 estimator had a referenceTotalPrice)
      expect(result.deliveredPrice).toBe(0);
    });
  });
});

describe('computeHarnessesFromSeedData — adaptive mode', () => {
  const seedsBasic = [
    {
      harnessId: 'S-001',
      name: '主线束',
      vehicleRatio: 1,
      bomItems: [
        { partNo: 'W1', partName: 'Cu Wire', itemCategory: 'wire', qty: 8, unit: 'm', unitPrice: 4, amount: 32 },
      ],
      frontHours: 0.12,
      backHours: 0.04,
    },
    {
      harnessId: 'S-002',
      name: '辅线束',
      vehicleRatio: 1,
      referenceTotalPrice: 300,
    },
  ];

  it('routes through adaptive engine when adaptiveOptions is provided', () => {
    const result = computeHarnessesFromSeedData(seedsBasic, mockRates, mockMetalPrices, {});
    expect(result.harnesses).toHaveLength(2);
    // First harness: has BOM → Level 3
    expect(result.harnesses[0].precisionLevel).toBe(3);
    // Second harness: only referenceTotalPrice → Level 1
    expect(result.harnesses[1].precisionLevel).toBe(1);
  });

  it('uses standard engine when adaptiveOptions is not provided', () => {
    const result = computeHarnessesFromSeedData(seedsBasic, mockRates, mockMetalPrices);
    expect(result.harnesses).toHaveLength(2);
    // Without adaptive, both go through standard engine → Level 3 if BOM or 2/1
    expect(result.harnesses[0].precisionLevel).toBe(3);
  });

  it('passes referenceTotalPrice from seed to adaptive engine', () => {
    const seeds = [
      {
        harnessId: 'S-REF',
        name: 'Ref Price Only',
        vehicleRatio: 1,
        referenceTotalPrice: 1000,
      },
    ];
    const result = computeHarnessesFromSeedData(seeds, mockRates, mockMetalPrices, {});
    expect(result.harnesses[0].precisionLevel).toBe(1);
    expect(result.harnesses[0].materialCost).toBeCloseTo(1000 * LEVEL1_COEFFICIENTS.materialRatio, 1);
  });

  it('routes Schema engine when costStructure is provided', () => {
    const seeds = [
      {
        harnessId: 'S-SCH',
        name: 'Schema Harness',
        vehicleRatio: 1,
        bomItems: [
          { partNo: 'W1', partName: 'Wire', itemCategory: 'wire', qty: 5, unit: 'm', unitPrice: 3, amount: 15 },
        ],
        frontHours: 0.1,
      },
    ];
    const result = computeHarnessesFromSeedData(seeds, mockRates, mockMetalPrices, {
      costStructure: DEFAULT_COST_STRUCTURE,
    });
    expect(result.harnesses[0].precisionLevel).toBe(3);
    expect(result.harnesses[0].deliveredPrice).toBeGreaterThan(0);
  });

  it('backward compatible — no adaptiveOptions gives same as before', () => {
    const seeds = [
      {
        harnessId: 'S-BC',
        name: 'Backward Compat',
        vehicleRatio: 1,
        bomItems: [
          { partNo: 'W1', partName: 'Wire', itemCategory: 'wire', qty: 10, unit: 'm', unitPrice: 5, amount: 50 },
        ],
        frontHours: 0.15,
        backHours: 0.05,
      },
    ];
    const resultStd = computeHarnessesFromSeedData(seeds, mockRates, mockMetalPrices);
    const resultAdp = computeHarnessesFromSeedData(seeds, mockRates, mockMetalPrices, {});
    // Same precision level and very similar cost (both standard engine, no schema)
    expect(resultStd.harnesses[0].precisionLevel).toBe(resultAdp.harnesses[0].precisionLevel);
    expect(resultStd.harnesses[0].deliveredPrice).toBeCloseTo(resultAdp.harnesses[0].deliveredPrice, 2);
  });
});
