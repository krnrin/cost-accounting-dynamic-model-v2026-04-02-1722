import { describe, it, expect } from 'vitest';
import { 
  computeChangePricing, 
  computeAnnualDrop, 
  computeHoursChange, 
  computeConfigChange, 
  computeMetalChange,
  computeAnnualImpact,
  buildChangeComparisonTable
} from '../change_pricing';
import type { ProjectHarnessResult, HarnessResult } from '@/types/harness';

const mockHarness1: HarnessResult = {
  harnessId: 'H001',
  harnessName: 'H1',
  vehicleRatio: 1,
  deliveredPrice: 1000,
  materialCost: 700,
  directLabor: 100,
  manufacturing: 100,
  wasteCost: 7,
  mgmtFee: 50,
  profit: 43,
  packTotal: 50,
  copperWeight: 1,
  aluminumWeight: 0,
  processHours: 2,
  exFactoryPrice: 950,
  packSubtotal: 20,
  freightSubtotal: 30,
  laborPlusMfg: 200,
  materialBreakdown: {} as any,
  packagingDetail: {} as any,
  freightDetail: {} as any,
  _params: { wasteRate: 0.01, mgmtRate: 0.05, profitRate: 0.05, laborRate: 50, mfgRate: 50 }
};

const mockProjectBase: ProjectHarnessResult = {
  harnesses: [mockHarness1],
  vehicleCost: 1000,
  harnessCount: 1,
  totalCopperWeight: 1,
  totalAluminumWeight: 0,
  totalProcessHours: 2,
  weightedMaterial: 700,
  weightedWaste: 7,
  weightedLabor: 100,
  weightedMfg: 100,
  weightedLaborPlusMfg: 200,
  weightedMgmtFee: 50,
  weightedProfit: 43,
  weightedExFactory: 950,
  weightedPack: 20,
  weightedFreight: 30,
  weightedCopperWeight: 1,
  weightedAluminumWeight: 0,
  weightedProcessHours: 2
};

describe('change_pricing', () => {
  it('computeChangePricing identifies add, remove, and modify', () => {
    const mockHarness2: HarnessResult = { ...mockHarness1, harnessId: 'H002', deliveredPrice: 500 };
    const mockProjectNew: ProjectHarnessResult = {
      ...mockProjectBase,
      harnesses: [
        { ...mockHarness1, deliveredPrice: 1100, materialCost: 800 }, // modified
        mockHarness2 // added
      ],
      vehicleCost: 1600
    };

    const result = computeChangePricing(mockProjectBase, mockProjectNew);
    
    expect(result.summary.affectedCount).toBe(2);
    expect(result.summary.addedCount).toBe(1);
    expect(result.summary.modifiedCount).toBe(1);
    expect(result.summary.totalDelta).toBe(600);
    
    const modifyChange = result.changes.find(c => c.changeCategory === 'modify');
    expect(modifyChange?.delta.deliveredPrice).toBe(100);
    expect(modifyChange?.detailedType).toBe('material');
  });

  it('computeAnnualDrop calculates correctly', () => {
    const drops = computeAnnualDrop(1000, 0.02, 3);
    
    expect(drops).toHaveLength(3);
    expect(drops[0].year).toBe(1);
    expect(drops[0].deliveredPrice).toBe(1000); // 1st year no drop usually
    expect(drops[1].year).toBe(2);
    expect(drops[1].deliveredPrice).toBe(1000 * 0.98);
    expect(drops[2].year).toBe(3);
    expect(drops[2].deliveredPrice).toBeCloseTo(1000 * 0.98 * 0.98);
  });

  it('computeHoursChange returns change result', () => {
    const mockProjectNew = { ...mockProjectBase, vehicleCost: 1050 };
    const result = computeHoursChange(mockProjectBase, mockProjectNew);
    
    expect(result.changeType).toBe('hours_change');
    expect(result.summary.totalDelta).toBe(50);
  });

  it('computeConfigChange returns change result', () => {
    const mockProjectNew = { ...mockProjectBase, vehicleCost: 900 };
    const result = computeConfigChange(mockProjectBase, mockProjectNew);
    
    expect(result.changeType).toBe('config_change');
    expect(result.summary.totalDelta).toBe(-100);
  });

  it('computeMetalChange returns change result', () => {
    const mockProjectNew = { ...mockProjectBase, vehicleCost: 1200 };
    const result = computeMetalChange(mockProjectBase, mockProjectNew);
    
    expect(result.changeType).toBe('metal_change');
    expect(result.summary.totalDelta).toBe(200);
  });

  it('computeAnnualImpact handles volumes correctly', () => {
    const impact = computeAnnualImpact(100, [1000, 2000, 3000]);
    
    expect(impact.years).toHaveLength(3);
    expect(impact.years[0].annualImpact).toBe(100000);
    expect(impact.years[1].annualImpact).toBe(200000);
    expect(impact.totalLifecycleImpact).toBe(600000);
    expect(impact.totalLifecycleVolume).toBe(6000);
  });

  it('buildChangeComparisonTable returns correct columns and rows', () => {
    const mockResult = computeChangePricing(mockProjectBase, {
      ...mockProjectBase,
      harnesses: [{ ...mockHarness1, deliveredPrice: 1100, materialCost: 800 }],
      vehicleCost: 1100
    });
    const table = buildChangeComparisonTable(mockResult);
    
    expect(table.columns.length).toBe(7);
    expect(table.columns[0].key).toBe('harnessId');
    expect(table.rows.length).toBeGreaterThan(0);
    expect(table.totals.beforePrice).toBeDefined();
    expect(table.totals.afterPrice).toBeDefined();
    expect(table.totals.deltaPrice).toBeDefined();
  });

  it('buildChangeComparisonTable shows correct delta percentage', () => {
    const result = computeChangePricing(mockProjectBase, {
      ...mockProjectBase,
      harnesses: [{ ...mockHarness1, deliveredPrice: 1200 }],
      vehicleCost: 1200
    });
    const table = buildChangeComparisonTable(result);
    const row = table.rows[0];
    expect(row.deltaPercent).toBeCloseTo(20, 0); // 200/1000 * 100 = 20%
  });
});
