import { describe, it, expect } from 'vitest';
import { 
  validateHarnessInput, 
  validateProjectConsistency, 
  crossValidateBomPricing,
  validateAll,
  summarizeValidation
} from '../consistency_check';
import type { HarnessInput } from '../../types/harness';
import type { CostRates } from '../../types/project';

describe('Consistency Check Engine', () => {
  const mockHarness: HarnessInput = {
    harnessId: 'H001',
    harnessName: 'Main Harness',
    vehicleRatio: 1.0,
    bom: [
      {
        partNo: 'W001',
        partName: 'Wire 0.5',
        itemCategory: 'wire',
        qty: 10,
        unit: 'm',
        unitPrice: 0.5,
        amount: 5.0,
        copperWeightPerUnit: 0.005,
        aluminumWeightPerUnit: 0
      } as any
    ],
    frontHours: 1.5,
    backHours: 2.5,
    packaging: {
      innerBoxCost: 1.0,
      outerBoxCost: 2.0,
      palletCost: 0.5,
      trayDividerCost: 0,
      bubbleWrapCost: 0.5,
      labelCost: 0.1,
      subtotal: 4.1
    },
    freight: {
      freight: 5.0,
      excessFreight: 0,
      shortHaul: 1.0,
      thirdPartyWarehouse: 0,
      storage: 0,
      subtotal: 6.0
    }
  };

  const mockRates: CostRates = {
    laborRate: 35,
    mfgRate: 46.69,
    wasteRate: 0.01,
    mgmtRate: 0.06,
    profitRate: 0.05
  };

  it('valid harness passes with 0 results', () => {
    const results = validateHarnessInput(mockHarness);
    expect(results.filter(r => r.severity === 'error' || r.severity === 'warning')).toHaveLength(0);
  });

  it('H001: Empty harnessId returns error', () => {
    const invalid = { ...mockHarness, harnessId: '' };
    const results = validateHarnessInput(invalid);
    expect(results).toContainEqual(expect.objectContaining({ code: 'H001', severity: 'error' }));
  });

  it('H005: BOM amount mismatch returns warning', () => {
    const invalid = { 
      ...mockHarness, 
      bom: [{ ...mockHarness.bom[0], amount: 10.0 }] 
    };
    const results = validateHarnessInput(invalid);
    expect(results).toContainEqual(expect.objectContaining({ code: 'H005', severity: 'warning' }));
  });

  it('H007: Zero process hours returns warning', () => {
    const invalid = { ...mockHarness, frontHours: 0, backHours: 0 };
    const results = validateHarnessInput(invalid);
    expect(results).toContainEqual(expect.objectContaining({ code: 'H007', severity: 'warning' }));
  });

  it('H008: Packaging subtotal mismatch returns warning', () => {
    const invalid = { 
      ...mockHarness, 
      packaging: { ...mockHarness.packaging, subtotal: 10.0 } 
    };
    const results = validateHarnessInput(invalid);
    expect(results).toContainEqual(expect.objectContaining({ code: 'H008', severity: 'warning' }));
  });

  it('H009: Freight subtotal mismatch returns warning', () => {
    const invalid = { 
      ...mockHarness, 
      freight: { ...mockHarness.freight, subtotal: 10.0 } 
    };
    const results = validateHarnessInput(invalid);
    expect(results).toContainEqual(expect.objectContaining({ code: 'H009', severity: 'warning' }));
  });

  it('P003: Duplicate harnessId returns error', () => {
    const harnesses = [mockHarness, { ...mockHarness }];
    const results = validateProjectConsistency(harnesses);
    expect(results).toContainEqual(expect.objectContaining({ code: 'P003', severity: 'error' }));
  });

  it('P002: vehicleRatio sum != 1 returns info', () => {
    const harnesses = [{ ...mockHarness, vehicleRatio: 0.5 }];
    const results = validateProjectConsistency(harnesses);
    expect(results).toContainEqual(expect.objectContaining({ code: 'P002', severity: 'info' }));
  });

  it('X001: Same partNo different prices returns warning', () => {
    const h1 = mockHarness;
    const h2: HarnessInput = {
      ...mockHarness,
      harnessId: 'H002',
      bom: [{ ...mockHarness.bom[0], unitPrice: 1.0 }]
    };
    const results = crossValidateBomPricing([h1, h2], 10);
    expect(results).toContainEqual(expect.objectContaining({ code: 'X001', severity: 'warning' }));
  });

  it('Cross-validate: same prices returns no results', () => {
    const h1 = mockHarness;
    const h2 = { ...mockHarness, harnessId: 'H002' };
    const results = crossValidateBomPricing([h1, h2], 10);
    expect(results).toHaveLength(0);
  });

  it('validateAll combines all checks', () => {
    const h1 = { ...mockHarness, harnessId: '' }; // H001 error
    const h2 = { ...mockHarness, harnessId: 'H001' }; // vehicleRatio sum = 2.0 (P002)
    const h3 = { ...mockHarness, harnessId: 'H001' }; // P003 error (duplicate 'H001')
    const results = validateAll([h1, h2, h3], mockRates);
    const codes = results.map(r => r.code);
    expect(codes).toContain('H001');
    expect(codes).toContain('P002');
    expect(codes).toContain('P003');
  });

  it('summarizeValidation counts correctly', () => {
    const results: any[] = [
      { severity: 'error' },
      { severity: 'error' },
      { severity: 'warning' },
      { severity: 'info' },
    ];
    const summary = summarizeValidation(results);
    expect(summary).toEqual({
      errors: 2,
      warnings: 1,
      infos: 1,
      total: 4
    });
  });
});
