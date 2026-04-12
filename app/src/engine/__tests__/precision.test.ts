import { describe, it, expect } from 'vitest';
import { detectPrecisionLevel, getPrecisionMeta, estimateByCoefficients, LEVEL1_COEFFICIENTS } from '../precision';
import { computeHarnessCost } from '../harness_costing';
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
  harnessId: 'TEST-001',
  harnessName: 'Test Harness',
  vehicleRatio: 1,
  bom: [],
  frontHours: 0,
  backHours: 0,
  packaging: {
    innerBoxCost: 0,
    outerBoxCost: 0,
    palletCost: 0,
    trayDividerCost: 0,
    bubbleWrapCost: 0,
    labelCost: 0,
    subtotal: 0,
  },
  freight: {
    freight: 0,
    excessFreight: 0,
    shortHaul: 0,
    thirdPartyWarehouse: 0,
    storage: 0,
    subtotal: 0,
  },
};

describe('Precision Engine', () => {
  describe('detectPrecisionLevel', () => {
    it('returns 3 when BOM has items', () => {
      const input: HarnessInput = {
        ...baseInput,
        bom: [{ partNo: 'P1', partName: 'Wire', itemCategory: 'wire', qty: 10, unit: 'm', unitPrice: 5, amount: 50 }],
      };
      expect(detectPrecisionLevel(input)).toBe(3);
    });

    it('returns 2 when materialCost provided but no BOM', () => {
      const input: any = {
        ...baseInput,
        materialCost: 100,
      };
      expect(detectPrecisionLevel(input)).toBe(2);
    });

    it('returns 2 when processHours provided but no BOM', () => {
      const input: HarnessInput = {
        ...baseInput,
        frontHours: 1,
      };
      expect(detectPrecisionLevel(input)).toBe(2);
    });

    it('returns 1 when no BOM, no materialCost, no hours', () => {
      expect(detectPrecisionLevel(baseInput)).toBe(1);
    });
  });

  describe('getPrecisionMeta', () => {
    it('calculates completeness correctly', () => {
      const input: HarnessInput = {
        ...baseInput,
        bom: [{ partNo: 'P1', partName: 'Wire', itemCategory: 'wire', qty: 10, unit: 'm', unitPrice: 5, amount: 50 }],
        frontHours: 1,
        packaging: { ...baseInput.packaging, subtotal: 5 },
      };
      // hasBom: true
      // hasMaterial || hasBom: true
      // hasHours: true
      // hasPackaging: true
      // hasFreight: false
      // Completeness: 4/5 = 0.8
      const meta = getPrecisionMeta(input);
      expect(meta.completeness).toBe(0.8);
    });

    it('lists missing data items', () => {
      const meta = getPrecisionMeta(baseInput);
      expect(meta.missingData).toContain('BOM明细');
      expect(meta.missingData).toContain('材料成本');
      expect(meta.missingData).toContain('工时数据');
      expect(meta.missingData).toContain('包装费');
      expect(meta.missingData).toContain('运输费');
    });
  });

  describe('estimateByCoefficients', () => {
    it('values sum to totalPrice (within rounding)', () => {
      const totalPrice = 1000;
      const result = estimateByCoefficients(totalPrice, mockRates);
      
      const sum = result.exFactoryPrice + result.packaging + result.freight;
      expect(sum).toBeCloseTo(totalPrice, 2);
    });

    it('waste = material * wasteRate', () => {
      const totalPrice = 1000;
      const result = estimateByCoefficients(totalPrice, mockRates);
      expect(result.waste).toBe(result.materialCost * mockRates.wasteRate!);
    });

    it('custom coefficients work', () => {
      const customCoeffs = {
        materialRatio: 0.5,
        laborRatio: 0.1,
        mfgRatio: 0.1,
        packagingRatio: 0.05,
        freightRatio: 0.05,
      };
      const result = estimateByCoefficients(1000, mockRates, customCoeffs);
      expect(result.materialCost).toBe(500);
      expect(result.directLabor).toBe(100);
      expect(result.manufacturing).toBe(100);
      expect(result.packaging).toBe(50);
      expect(result.freight).toBe(50);
    });
  });

  describe('Integration with computeHarnessCost', () => {
    it('returns precisionLevel in result', () => {
      const input: HarnessInput = {
        ...baseInput,
        bom: [{ partNo: 'P1', partName: 'Wire', itemCategory: 'wire', qty: 10, unit: 'm', unitPrice: 5, amount: 50 }],
      };
      const result = computeHarnessCost(input, mockRates, mockMetalPrices);
      expect(result.precisionLevel).toBe(3);
    });
  });
});
