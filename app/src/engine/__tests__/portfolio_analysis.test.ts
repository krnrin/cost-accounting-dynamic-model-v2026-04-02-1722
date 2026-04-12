import { describe, it, expect } from 'vitest';
import { 
  computePortfolioSummary, 
  computeProjectContribution, 
  analyzeRiskExposure,
  ProjectSummaryInput
} from '../portfolio_analysis';
import type { HarnessInput, HarnessResult } from '../../types/harness';
import type { CostRates, MetalPrices } from '../../types/project';

const MOCK_RATES: CostRates = {
  laborRate: 35,
  mfgRate: 46.69,
  wasteRate: 0.01,
  mgmtRate: 0.06,
  profitRate: 0.05,
};

const MOCK_METALS: MetalPrices = {
  copper: 70000,
  aluminum: 20000,
};

/**
 * Helper to create a realistic mock project for testing.
 */
function makeTestProject(
  id: string, name: string, customer: string, volume: number,
  vehicleCost: number, weightedMaterial: number, profitPerVehicle: number,
  harnessInputs: HarnessInput[], costRates: CostRates, metalPrices: MetalPrices,
  harnesses: HarnessResult[]
): ProjectSummaryInput {
  return {
    projectId: id,
    projectName: name,
    customer,
    annualVolume: volume,
    projectResult: {
      vehicleCost,
      harnesses,
      harnessCount: harnesses.length,
      weightedMaterial,
      weightedLaborPlusMfg: vehicleCost * 0.1, // Adjusted for realism
      weightedProfit: profitPerVehicle,
      weightedOther: vehicleCost - weightedMaterial - (vehicleCost * 0.1) - profitPerVehicle,
      totalCopperWeight: 1,
      totalAluminumWeight: 0,
      totalProcessHours: 10,
      weightedWaste: 0,
      weightedLabor: 0,
      weightedMfg: 0,
      weightedMgmtFee: 0,
      weightedExFactory: 0,
      weightedPack: 0,
      weightedFreight: 0,
      weightedCopperWeight: 0,
      weightedAluminumWeight: 0,
      weightedProcessHours: 0
    },
    harnessInputs,
    costRates,
    metalPrices,
  };
}

/**
 * Mock a single harness for sensitivity testing.
 * Simplifies BOM to just one wire with copper.
 */
function mockHarnessInput(id: string, cuWeight: number): HarnessInput {
  return {
    harnessId: id,
    harnessName: 'Test Harness',
    vehicleRatio: 1,
    bom: [
      {
        partNo: 'WIRE-CU',
        partName: 'Copper Wire',
        itemCategory: 'wire',
        qty: 1,
        unit: 'm',
        unitPrice: 0, // Computed by engine
        amount: 0,
        copperWeightPerUnit: cuWeight,
        aluminumWeightPerUnit: 0,
        nonMetalCostPerUnit: 1,
      } as any
    ],
    frontHours: 1,
    backHours: 1,
    packaging: { innerBoxCost: 0, outerBoxCost: 0, palletCost: 0, trayDividerCost: 0, bubbleWrapCost: 0, labelCost: 0, subtotal: 0 },
    freight: { freight: 0, excessFreight: 0, shortHaul: 0, thirdPartyWarehouse: 0, storage: 0, subtotal: 0 }
  };
}

function mockHarnessResult(id: string, material: number, cuCost: number): HarnessResult {
  return {
    harnessId: id,
    harnessName: 'Test Harness',
    vehicleRatio: 1,
    copperWeight: 0.5,
    aluminumWeight: 0,
    processHours: 2,
    materialCost: material,
    wasteCost: material * 0.01,
    directLabor: 70,
    manufacturing: 90,
    laborPlusMfg: 160,
    mgmtFee: (material + 160) * 0.06,
    profit: 50,
    exFactoryPrice: material + 160 + 50,
    packSubtotal: 0,
    freightSubtotal: 0,
    packTotal: 0,
    deliveredPrice: material + 160 + 50,
    materialBreakdown: {
      cuCost,
      alCost: 0,
      nonMetalCost: material - cuCost,
      byType: { wire: material, connector: 0, terminal: 0, ipt_terminal: 0, bracket_rubber: 0, tape_tube: 0, other: 0 },
      totalMetalCost: cuCost,
      totalNonWireCost: 0
    },
    packagingDetail: { innerBoxCost: 0, outerBoxCost: 0, palletCost: 0, trayDividerCost: 0, bubbleWrapCost: 0, labelCost: 0, subtotal: 0 },
    freightDetail: { freight: 0, excessFreight: 0, shortHaul: 0, thirdPartyWarehouse: 0, storage: 0, subtotal: 0 },
    _params: { ...MOCK_RATES }
  };
}

describe('Portfolio Analysis Engine', () => {
  it('should return zeros for empty portfolio', () => {
    const summary = computePortfolioSummary([]);
    expect(summary.projectCount).toBe(0);
    expect(summary.totalRevenue).toBe(0);
    expect(summary.totalProfit).toBe(0);
  });

  it('should compute single project correctly', () => {
    const h1 = mockHarnessResult('H1', 100, 50);
    const p1 = makeTestProject('P1', 'Proj 1', 'Tesla', 1000, 200, 100, 20, [mockHarnessInput('H1', 0.5)], MOCK_RATES, MOCK_METALS, [h1]);
    
    const summary = computePortfolioSummary([p1]);
    expect(summary.projectCount).toBe(1);
    expect(summary.totalRevenue).toBe(200000); // 200 * 1000
    expect(summary.totalProfit).toBe(20000);   // 20 * 1000
    expect(summary.totalCopperCost).toBe(50000); // 50 * 1 * 1000
    expect(summary.customerBreakdown['Tesla'].revenue).toBe(200000);
  });

  it('should compute two projects and weighted averages', () => {
    const p1 = makeTestProject('P1', 'P1', 'Tesla', 1000, 200, 100, 20, [], MOCK_RATES, MOCK_METALS, [mockHarnessResult('H1', 100, 50)]);
    const p2 = makeTestProject('P2', 'P2', 'BYD', 2000, 300, 180, 45, [], MOCK_RATES, MOCK_METALS, [mockHarnessResult('H2', 180, 80)]);
    
    const summary = computePortfolioSummary([p1, p2]);
    // Total Revenue = 1000*200 + 2000*300 = 200,000 + 600,000 = 800,000
    // Total Profit = 1000*20 + 2000*45 = 20,000 + 90,000 = 110,000
    expect(summary.totalRevenue).toBe(800000);
    expect(summary.totalProfit).toBe(110000);
    expect(summary.weightedProfitRate).toBeCloseTo(110000 / 800000);
    
    // Weighted Material Ratio = (1000*100 + 2000*180) / 800,000 = (100,000 + 360,000) / 800,000 = 0.575
    expect(summary.weightedMaterialRatio).toBe(0.575);
  });

  it('should calculate project contributions with marginal contribution', () => {
    // Variable cost = (material + labor + mfg) = (100 + 200 * 0.1) = 120
    // Marginal = 200 - 120 = 80. Marginal Rate = 80 / 200 = 0.4
    const p1 = makeTestProject('P1', 'P1', 'Tesla', 1000, 200, 100, 20, [], MOCK_RATES, MOCK_METALS, []);
    const contributions = computeProjectContribution([p1]);
    
    expect(contributions[0].revenueShare).toBe(1);
    expect(contributions[0].profitShare).toBe(1);
    expect(contributions[0].marginalContribution).toBe(80000);
    expect(contributions[0].marginalContributionRate).toBe(0.4);
    expect(contributions[0].profitRate).toBe(0.1); // 20 / 200
  });

  it('should analyze risk exposure for copper price increase', () => {
    // Copper price is 70,000. Harness has 0.5kg copper -> 35元 copper cost.
    // If copper price +10% (77,000), copper cost becomes 38.5元 (+3.5元).
    // Material cost increases, so profit decreases by at least that much.
    const h1_input = mockHarnessInput('H1', 0.0005); // 0.5kg copper = 0.0005 tons
    const h1_result = mockHarnessResult('H1', 100, 35);
    const p1 = makeTestProject('P1', 'P1', 'C1', 1000, 200, 100, 20, [h1_input], MOCK_RATES, MOCK_METALS, [h1_result]);
    
    const risk = analyzeRiskExposure([p1], 'copper', 0.10);
    
    expect(risk.priceChangePercent).toBe(0.10);
    expect(risk.projectImpacts[0].profitDelta).toBeLessThan(0);
    expect(risk.totalProfitDelta).toBeLessThan(0);
  });

  it('should analyze risk exposure for copper price decrease', () => {
    const h1_input = mockHarnessInput('H1', 0.0005);
    const h1_result = mockHarnessResult('H1', 100, 35);
    const p1 = makeTestProject('P1', 'P1', 'C1', 1000, 200, 100, 20, [h1_input], MOCK_RATES, MOCK_METALS, [h1_result]);
    
    const risk = analyzeRiskExposure([p1], 'copper', -0.10);
    
    expect(risk.priceChangePercent).toBe(-0.10);
    expect(risk.projectImpacts[0].profitDelta).toBeGreaterThan(0);
    expect(risk.totalProfitDelta).toBeGreaterThan(0);
  });

  it('should compute customer breakdown correctly', () => {
    const p1 = makeTestProject('P1', 'P1', 'Tesla', 1000, 200, 100, 20, [], MOCK_RATES, MOCK_METALS, []);
    const p2 = makeTestProject('P2', 'P2', 'Tesla', 2000, 100, 50, 10, [], MOCK_RATES, MOCK_METALS, []);
    const p3 = makeTestProject('P3', 'P3', 'BYD', 1000, 500, 300, 50, [], MOCK_RATES, MOCK_METALS, []);

    const summary = computePortfolioSummary([p1, p2, p3]);
    // Tesla: 1000*200 + 2000*100 = 400,000
    // BYD: 1000*500 = 500,000
    // Total: 900,000
    expect(summary.customerBreakdown['Tesla'].revenue).toBe(400000);
    expect(summary.customerBreakdown['Tesla'].share).toBeCloseTo(400000 / 900000);
    expect(summary.customerBreakdown['BYD'].revenue).toBe(500000);
    expect(summary.customerBreakdown['BYD'].share).toBeCloseTo(500000 / 900000);
  });
});
