import { describe, it, expect } from 'vitest';
import {
  computeHarnessCostAdaptive,
  DEFAULT_COST_STRUCTURE,
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
      expect(result.materialCost).toBeGreaterThanOrEqual(0);
      expect(result.directLabor).toBeGreaterThanOrEqual(0);
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
      expect(result.materialCost).toBeGreaterThanOrEqual(0);
    });

    it('returns precision level 2 when processHours provided but no BOM', () => {
      const input: HarnessInput = {
        ...baseInput,
        frontHours: 0.3,
        backHours: 0.1,
      };
      const result = computeHarnessCostAdaptive(input, mockRates, mockMetalPrices);
      expect(result.precisionLevel).toBe(2);
      expect(result.directLabor).toBeGreaterThanOrEqual(0);
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
      // 当前实现会保留 forcePrecisionLevel 结果，但在空输入下仍返回零值结构
      expect(result.precisionLevel).toBe(3);
      expect(result.deliveredPrice).toBe(0);
    });
  });
});

