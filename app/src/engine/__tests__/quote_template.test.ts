import { describe, it, expect } from 'vitest';
import { 
  mapToGeelyTemplate, 
  mapToBydTemplate, 
  mapToGenericTemplate, 
  buildQuoteSheet,
  GEELY_RATES,
  BYD_RATES
} from '../quote_template';
import type { HarnessResult } from '@/types/harness';
import type { NreData } from '@/types/quote';

const mockHarnessResult: HarnessResult = {
  harnessId: 'H001',
  harnessName: 'Main Harness',
  vehicleRatio: 1,
  copperWeight: 2.5,
  aluminumWeight: 0.5,
  processHours: 10,
  materialCost: 1000,
  wasteCost: 10,
  directLabor: 200,
  manufacturing: 300,
  laborPlusMfg: 500,
  mgmtFee: 60,
  profit: 50,
  exFactoryPrice: 1120,
  packSubtotal: 20,
  freightSubtotal: 30,
  packTotal: 50,
  deliveredPrice: 1170,
  materialBreakdown: {
    cuCost: 600,
    alCost: 100,
    nonMetalCost: 50,
    byType: {
      wire: 750,
      connector: 150,
      terminal: 50,
      ipt_terminal: 20,
      bracket_rubber: 10,
      tape_tube: 10,
      other: 10
    },
    totalMetalCost: 700,
    totalNonWireCost: 250
  },
  packagingDetail: { 
    innerBoxCost: 10, outerBoxCost: 10, palletCost: 0, 
    trayDividerCost: 0, bubbleWrapCost: 0, labelCost: 0, 
    subtotal: 20 
  },
  freightDetail: { freight: 10, excessFreight: 5, shortHaul: 5, thirdPartyWarehouse: 5, storage: 5, subtotal: 30 },
  _params: {
    wasteRate: 0.01,
    mgmtRate: 0.06,
    profitRate: 0.05,
    laborRate: 20,
    mfgRate: 30
  }
};

const mockNreData: NreData = {
  borrowedTooling: 1000,
  newTooling: 2000,
  borrowedTesting: 500,
  newTesting: 1500,
  borrowedRnd: 1000,
  newRnd: 3000,
  amortizationVolume: 1000
};

describe('quote_template', () => {
  it('mapToGeelyTemplate maps correctly', () => {
    const result = mapToGeelyTemplate(mockHarnessResult, mockNreData);
    
    expect(result.templateName).toBe('吉利高压线束报价');
    expect(result.harnessId).toBe('H001');
    expect(result.A1_rawMaterial).toBe(750); // from byType.wire
    expect(result.A2_purchasedParts).toBe(1000 - 750); // materialCost - A1
    expect(result.B1_processingFee).toBe(300); // manufacturing
    
    const B2 = (750 + 250) * GEELY_RATES.wasteRate; // (A1 + A2) * 0.01
    expect(result.B2_wasteLoss).toBeCloseTo(B2);
    
    const base = 750 + 250 + 300 + B2;
    expect(result.C1_managementFee).toBeCloseTo(base * GEELY_RATES.mgmtRate);
    expect(result.D_profit).toBeCloseTo(base * GEELY_RATES.profitRate);
    
    expect(result.E1_borrowedTooling).toBe(1); // 1000 / 1000
    expect(result.E2_newTooling).toBe(2); // 2000 / 1000
    
    expect(result.deliveredPrice).toBeGreaterThan(result.exFactoryPrice);
  });

  it('mapToBydTemplate maps correctly', () => {
    const result = mapToBydTemplate(mockHarnessResult);
    
    expect(result.templateName).toBe('比亚迪报价模板');
    expect(result.directMaterial).toBe(1000);
    expect(result.processingFee).toBe(200 + 300); // directLabor + manufacturing
    expect(result.wasteLoss).toBe(10);
    
    const mgmt = (1000 + 500) * 0.06;
    expect(result.managementFee).toBeCloseTo(mgmt);
    
    const profit = (1000 + 500 + 10 + mgmt) * 0.05;
    expect(result.profit).toBeCloseTo(profit);
  });

  it('mapToGenericTemplate maps correctly', () => {
    const result = mapToGenericTemplate(mockHarnessResult);
    
    expect(result.templateName).toBe('通用报价模板');
    expect(result.materialCost).toBe(1000);
    expect(result.laborCost).toBe(200);
    expect(result.mfgCost).toBe(300);
    expect(result.wasteCost).toBe(10);
    expect(result.mgmtFee).toBe(60);
    expect(result.profit).toBe(50);
  });

  it('buildQuoteSheet works for different templates', () => {
    const results = [mockHarnessResult];
    
    const geelySheet = buildQuoteSheet(results, 'geely', { projectName: 'Test Project' }, mockNreData);
    expect(geelySheet.meta.templateName).toBe('geely');
    expect(geelySheet.harnesses[0].templateName).toBe('吉利高压线束报价');
    expect(geelySheet.totals.exFactoryPrice).toBeGreaterThan(0);

    const bydSheet = buildQuoteSheet(results, 'byd');
    expect(bydSheet.meta.templateName).toBe('byd');
    expect(bydSheet.harnesses[0].templateName).toBe('比亚迪报价模板');

    const genericSheet = buildQuoteSheet(results, 'generic');
    expect(genericSheet.meta.templateName).toBe('generic');
    expect(genericSheet.harnesses[0].templateName).toBe('通用报价模板');
  });

  it('buildQuoteSheet calculates default amortization volume from first 3 years', () => {
    const results = [mockHarnessResult];
    const nreWithoutVol: NreData = { newTooling: 30000 };
    const volumes = [
      { year: 1, volume: 1000 },
      { year: 2, volume: 2000 },
      { year: 3, volume: 3000 },
      { year: 4, volume: 4000 },
    ];
    
    // Default vol should be 1000 + 2000 + 3000 = 6000
    // E2 = 30000 / 6000 = 5
    const sheet = buildQuoteSheet(results, 'geely', {}, nreWithoutVol, volumes);
    const h = sheet.harnesses[0] as any;
    expect(h.E2_newTooling).toBe(5);
  });

  it('handles zero values correctly', () => {
    const zeroHarness: HarnessResult = {
      ...mockHarnessResult,
      materialCost: 0,
      directLabor: 0,
      manufacturing: 0,
      wasteCost: 0,
      mgmtFee: 0,
      profit: 0,
      exFactoryPrice: 0,
      deliveredPrice: 0,
      materialBreakdown: {
        ...mockHarnessResult.materialBreakdown,
        cuCost: 0, alCost: 0, nonMetalCost: 0,
        byType: { wire: 0, connector: 0, terminal: 0, ipt_terminal: 0, bracket_rubber: 0, tape_tube: 0, other: 0 }
      }
    };
    
    const result = mapToGeelyTemplate(zeroHarness);
    expect(result.deliveredPrice).toBe(0);
    expect(result.A1_rawMaterial).toBe(0);
  });

  it('mapToGeelyTemplate with override rates', () => {
    const customRates = { mgmtRate: 0.1, profitRate: 0.1 };
    const result = mapToGeelyTemplate(mockHarnessResult, undefined, customRates);
    
    const A1 = 750;
    const A2 = 250;
    const B1 = 300;
    const B2 = (A1 + A2) * GEELY_RATES.wasteRate;
    const base = A1 + A2 + B1 + B2;
    
    expect(result.C1_managementFee).toBeCloseTo(base * 0.1);
    expect(result.D_profit).toBeCloseTo(base * 0.1);
  });
});
