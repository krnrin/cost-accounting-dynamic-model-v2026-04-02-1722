import { describe, it, expect } from 'vitest';
import { computeAnnualizedCost, computeProjectAnnualizedCost } from '../annualized_cost';
import type { HarnessResult } from '@/types/harness';
import type { EquipmentConfig, VolumeSchedule } from '@/types/project';

const MOCK_HARNESS: HarnessResult = {
  harnessId: 'H001',
  harnessName: 'Test Harness',
  vehicleRatio: 1.0,
  copperWeight: 0,
  aluminumWeight: 0,
  processHours: 0,
  materialCost: 0,
  wasteCost: 0,
  directLabor: 0,
  manufacturing: 0,
  laborPlusMfg: 0,
  mgmtFee: 0,
  profit: 0,
  exFactoryPrice: 0,
  packSubtotal: 0,
  freightSubtotal: 0,
  packTotal: 0,
  deliveredPrice: 100, // variableCostPerUnit = 100
  materialBreakdown: {} as any,
  packagingDetail: {} as any,
  freightDetail: {} as any,
  _params: {} as any,
};

const MOCK_EQUIPMENT: EquipmentConfig = {
  sharedInvestment: 0,
  dedicatedInvestment: 0,
  annualDepreciation: 500000,
  depreciationYears: 5,
};

describe('computeAnnualizedCost', () => {
  it('should compute constant equipmentPerUnit when volume is constant', () => {
    const volumes: VolumeSchedule[] = [
      { year: 1, volume: 10000 },
      { year: 2, volume: 10000 },
    ];
    const result = computeAnnualizedCost(MOCK_HARNESS, MOCK_EQUIPMENT, volumes);
    
    expect(result.annualBreakdown[0]?.equipmentPerUnit).toBe(50); // 500000 / 10000
    expect(result.annualBreakdown[1]?.equipmentPerUnit).toBe(50);
    expect(result.lifecycleWeightedAvg).toBe(150); // 100 + 50
  });

  it('should vary equipmentPerUnit with volume', () => {
    const volumes: VolumeSchedule[] = [
      { year: 1, volume: 50000 },
      { year: 2, volume: 100000 },
    ];
    const result = computeAnnualizedCost(MOCK_HARNESS, MOCK_EQUIPMENT, volumes);
    
    expect(result.annualBreakdown[0]?.equipmentPerUnit).toBe(10); // 500000 / 50000
    expect(result.annualBreakdown[1]?.equipmentPerUnit).toBe(5);  // 500000 / 100000
    // (110*50000 + 105*100000) / 150000 = (5.5M + 10.5M) / 150K = 10.666...
    // Wait: (100+10)*50000 + (100+5)*100000 = 5.5M + 10.5M = 16M
    // 16M / 150000 = 106.666...
    expect(result.lifecycleWeightedAvg).toBeCloseTo(106.67, 2);
  });

  it('should set equipmentPerUnit to 0 beyond depreciation years', () => {
    const volumes: VolumeSchedule[] = [
      { year: 5, volume: 10000 },
      { year: 6, volume: 10000 },
    ];
    const result = computeAnnualizedCost(MOCK_HARNESS, MOCK_EQUIPMENT, volumes);
    
    expect(result.annualBreakdown[0]?.equipmentPerUnit).toBe(50);
    expect(result.annualBreakdown[1]?.equipmentPerUnit).toBe(0);
  });

  it('should compute lifecycleWeightedAvg correctly', () => {
    const volumes: VolumeSchedule[] = [
      { year: 1, volume: 10000 },
      { year: 2, volume: 20000 },
    ];
    const result = computeAnnualizedCost(MOCK_HARNESS, MOCK_EQUIPMENT, volumes);
    // Year 1: cost = 100 + 500000/10000 = 150
    // Year 2: cost = 100 + 500000/20000 = 125
    // Avg = (150*10000 + 125*20000) / 30000 = (1.5M + 2.5M) / 30000 = 4M / 30000 = 133.333
    expect(result.lifecycleWeightedAvg).toBeCloseTo(133.33, 2);
  });

  it('should compute maxDeviation and maxDeviationPercent', () => {
    const volumes: VolumeSchedule[] = [
      { year: 1, volume: 10000 }, // cost 150
      { year: 2, volume: 20000 }, // cost 125
    ];
    const result = computeAnnualizedCost(MOCK_HARNESS, MOCK_EQUIPMENT, volumes);
    // Avg = 133.333
    // Dev1 = |150 - 133.333| = 16.666
    // Dev2 = |125 - 133.333| = 8.333
    // maxDev = 16.666
    expect(result.maxDeviation).toBeCloseTo(16.67, 2);
    expect(result.maxDeviationPercent).toBeCloseTo((16.666 / 133.333) * 100, 2);
  });

  it('should verify with G281-like data', () => {
    // investment = 2,606,000, depreciation = 5 years => annualDepreciation = 521,200
    const equipment: EquipmentConfig = {
      sharedInvestment: 0,
      dedicatedInvestment: 0,
      annualDepreciation: 521200,
      depreciationYears: 5,
    };
    const volumes: VolumeSchedule[] = [
      { year: 1, volume: 85000 },
      { year: 2, volume: 100000 },
      { year: 3, volume: 120000 },
      { year: 4, volume: 105000 },
      { year: 5, volume: 80000 },
      { year: 6, volume: 41000 },
    ];
    
    const result = computeAnnualizedCost(MOCK_HARNESS, equipment, volumes);
    
    // Year 1: 521200 / 85000 = 6.1317...
    expect(result.annualBreakdown[0]?.equipmentPerUnit).toBeCloseTo(6.13, 2);
    // Year 3: 521200 / 120000 = 4.3433...
    expect(result.annualBreakdown[2]?.equipmentPerUnit).toBeCloseTo(4.34, 2);
    // Year 6: 0
    expect(result.annualBreakdown[5]?.equipmentPerUnit).toBe(0);
  });

  it('should compute project-level aggregation with vehicleRatio weighting', () => {
    const h1: HarnessResult = { ...MOCK_HARNESS, harnessId: 'H1', vehicleRatio: 1.0, deliveredPrice: 100 };
    const h2: HarnessResult = { ...MOCK_HARNESS, harnessId: 'H2', vehicleRatio: 0.5, deliveredPrice: 200 };
    const equipment: EquipmentConfig = {
      sharedInvestment: 0,
      dedicatedInvestment: 0,
      annualDepreciation: 500000,
      depreciationYears: 5,
    };
    const volumes: VolumeSchedule[] = [{ year: 1, volume: 10000 }];
    
    const result = computeProjectAnnualizedCost([h1, h2], equipment, volumes);
    
    // h1: totalCost = 100 + 500000/10000 = 150
    // h2: totalCost = 200 + 500000/10000 = 250
    // projectTotalCost = 150*1.0 + 250*0.5 = 150 + 125 = 275
    expect(result.projectAnnualBreakdown[0]?.totalCostPerUnit).toBe(275);
    // projectEquipmentPerUnit = 50*1.0 + 50*0.5 = 75
    expect(result.projectAnnualBreakdown[0]?.equipmentPerUnit).toBe(75);
  });
});
