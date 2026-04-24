import { describe, it, expect } from 'vitest';
import { computeAllocationWeights, allocateIndirectCosts, DEFAULT_ALLOCATION } from '../allocation';
import type { HarnessResult } from '../../types/harness';

describe('allocation engine', () => {
  const mockHarnesses: HarnessResult[] = [
    {
      harnessId: 'H1',
      harnessName: 'Harness 1',
      processHours: 1.0,
      deliveredPrice: 100,
      materialCost: 50,
      vehicleRatio: 1.0,
      mgmtFee: 5,
    } as any,
    {
      harnessId: 'H2',
      harnessName: 'Harness 2',
      processHours: 2.0,
      deliveredPrice: 200,
      materialCost: 100,
      vehicleRatio: 0.5,
      mgmtFee: 10,
    } as any,
    {
      harnessId: 'H3',
      harnessName: 'Harness 3',
      processHours: 2.0,
      deliveredPrice: 300,
      materialCost: 150,
      vehicleRatio: 0.5,
      mgmtFee: 15,
    } as any,
  ];

  describe('computeAllocationWeights', () => {
    it('should compute weights by hours', () => {
      // Total hours = 1 + 2 + 2 = 5
      const weights = computeAllocationWeights(mockHarnesses, 'hours');
      expect(weights).toEqual([0.2, 0.4, 0.4]);
      expect(weights.reduce((a, b) => a + b, 0)).toBeCloseTo(1);
    });

    it('should compute weights equally', () => {
      const weights = computeAllocationWeights(mockHarnesses, 'equal');
      expect(weights).toEqual([1/3, 1/3, 1/3]);
      expect(weights.reduce((a, b) => a + b, 0)).toBeCloseTo(1);
    });

    it('should compute weights as 1 for direct driver', () => {
      const weights = computeAllocationWeights(mockHarnesses, 'direct');
      expect(weights).toEqual([1, 1, 1]);
    });

    it('should compute weights by revenue (deliveredPrice)', () => {
      // Total price = 100 + 200 + 300 = 600
      const weights = computeAllocationWeights(mockHarnesses, 'revenue');
      expect(weights).toEqual([100/600, 200/600, 300/600]);
      expect(weights.reduce((a, b) => a + b, 0)).toBeCloseTo(1);
    });

    it('should compute weights by material_cost', () => {
      // Total material = 50 + 100 + 150 = 300
      const weights = computeAllocationWeights(mockHarnesses, 'material_cost');
      expect(weights).toEqual([50/300, 100/300, 150/300]);
    });

    it('should compute weights by volume (vehicleRatio)', () => {
      // Total ratio = 1.0 + 0.5 + 0.5 = 2.0
      const weights = computeAllocationWeights(mockHarnesses, 'volume');
      expect(weights).toEqual([0.5, 0.25, 0.25]);
    });

    it('should prefer installationRatio for volume allocation', () => {
      const harnesses = [
        { ...mockHarnesses[0], vehicleRatio: 0.9, installationRatio: 0.6 },
        { ...mockHarnesses[1], vehicleRatio: 0.05, installationRatio: 0.3 },
        { ...mockHarnesses[2], vehicleRatio: 0.05, installationRatio: 0.1 },
      ] as HarnessResult[];
      const weights = computeAllocationWeights(harnesses, 'volume');
      expect(weights[0]).toBeCloseTo(0.6);
      expect(weights[1]).toBeCloseTo(0.3);
      expect(weights[2]).toBeCloseTo(0.1);
    });

    it('should handle zero total and return equal weights', () => {
      const zeroHarnesses = mockHarnesses.map(h => ({ ...h, processHours: 0 }));
      const weights = computeAllocationWeights(zeroHarnesses as any, 'hours');
      expect(weights).toEqual([1/3, 1/3, 1/3]);
    });
  });

  describe('allocateIndirectCosts', () => {
    it('should allocate costs based on config (hours for eq, revenue for rnd)', () => {
      const totals = {
        equipmentTotal: 5000,
        rndTotal: 6000,
      };
      const results = allocateIndirectCosts(mockHarnesses, DEFAULT_ALLOCATION, totals);

      // eq weights (hours): [0.2, 0.4, 0.4] -> [1000, 2000, 2000]
      // rnd weights (revenue): [1/6, 2/6, 3/6] -> [1000, 2000, 3000]
      // il weights (hours): [0.2, 0.4, 0.4] -> [0, 0, 0]
      // management (direct) -> uses h.mgmtFee: [5, 10, 15]
      
      expect(results[0]?.equipmentAllocation).toBe(1000);
      expect(results[0]?.rndAllocation).toBe(1000);
      expect(results[1]?.equipmentAllocation).toBe(2000);
      expect(results[1]?.rndAllocation).toBe(2000);
      expect(results[2]?.equipmentAllocation).toBe(2000);
      expect(results[2]?.rndAllocation).toBe(3000);

      expect(results[0]?.managementAllocation).toBe(5);
      expect(results[1]?.managementAllocation).toBe(10);
      expect(results[2]?.managementAllocation).toBe(15);
    });

    it('should handle zero totals', () => {
      const results = allocateIndirectCosts(mockHarnesses, DEFAULT_ALLOCATION, {});
      results.forEach(r => {
        expect(r.equipmentAllocation).toBe(0);
        expect(r.rndAllocation).toBe(0);
        expect(r.indirectLaborAllocation).toBe(0);
        // mgmt is 'direct' so it keeps its own
        expect(r.managementAllocation).toBeGreaterThan(0);
      });
    });

    it('should support non-direct management allocation', () => {
      const config = { ...DEFAULT_ALLOCATION, management: 'revenue' as const };
      const totals = { managementTotal: 600 };
      const results = allocateIndirectCosts(mockHarnesses, config, totals);

      // revenue weights: [1/6, 2/6, 3/6] -> [100, 200, 300]
      expect(results[0]?.managementAllocation).toBe(100);
      expect(results[1]?.managementAllocation).toBe(200);
      expect(results[2]?.managementAllocation).toBe(300);
    });

    it('should be backward compatible with DEFAULT_ALLOCATION', () => {
      // Current behavior (before this task): 
      // - equipment/rnd not allocated per-harness (or done manually elsewhere)
      // - management calculated per-harness (equivalent to 'direct')
      // DEFAULT_ALLOCATION uses 'direct' for management, and 'hours'/'revenue' for others.
      // If we pass 0 for totals, it should reflect current behavior for management.
      const results = allocateIndirectCosts(mockHarnesses, DEFAULT_ALLOCATION, { managementTotal: 9999 });
      
      mockHarnesses.forEach((h, i) => {
        expect(results[i]?.managementAllocation).toBe(h.mgmtFee);
      });
    });
  });
});
