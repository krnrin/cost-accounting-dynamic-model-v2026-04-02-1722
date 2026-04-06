import { describe, it, expect } from 'vitest';
import { 
  computeMetalEscalation, 
  computeMetalDelta, 
  checkThreshold,
  DEFAULT_CONTRACT
} from '../metal_escalation';
import type { HarnessResult } from '@/types/harness';
import type { MetalPrices } from '@/types/project';
import type { MetalContract } from '@/types/quote';

const mockHarness: HarnessResult = {
  harnessId: 'H001',
  harnessName: 'H1',
  vehicleRatio: 1,
  copperWeight: 10,   // kg
  aluminumWeight: 5,  // kg
  deliveredPrice: 2000,
  _params: {
    wasteRate: 0.01,
    mgmtRate: 0.04,
    profitRate: 0.04,
    laborRate: 50,
    mfgRate: 50
  }
} as any;

const basePrices: MetalPrices = {
  copper: 68400,
  aluminum: 18200
};

describe('metal_escalation', () => {
  it('checkThreshold applies threshold correctly', () => {
    const base = 70000;
    const thresholdPercent = 0.05; // ±3500
    
    // Within threshold
    expect(checkThreshold(base, 73000, thresholdPercent, 1.0)).toBe(0);
    expect(checkThreshold(base, 67000, thresholdPercent, 1.0)).toBe(0);
    
    // Above threshold (only excess part)
    expect(checkThreshold(base, 75000, thresholdPercent, 1.0)).toBe(1500); // (75000-70000) - 3500 = 1500
    expect(checkThreshold(base, 65000, thresholdPercent, 1.0)).toBe(-1500); // (65000-70000) + 3500 = -1500
    
    // No threshold
    expect(checkThreshold(base, 71000, 0, 1.0)).toBe(1000);
  });

  it('computeMetalDelta handles copper price increase', () => {
    const newPrices: MetalPrices = { copper: 78400, aluminum: 18200 }; // +10000
    const contract: MetalContract = { ...DEFAULT_CONTRACT, thresholdPercent: 0 };
    
    const delta = computeMetalDelta(mockHarness, basePrices, newPrices, contract);
    
    // deltaCuCost = 10kg * 10000 / 1000 = 100
    expect(delta.deltaCopperCost).toBe(100);
    expect(delta.deltaMaterialCost).toBe(100);
    
    // deltaWaste = 100 * 0.01 = 1
    expect(delta.deltaWasteCost).toBe(1);
    // deltaMgmt = 100 * 0.04 = 4
    expect(delta.deltaMgmtFee).toBe(4);
    // deltaProfit = (100 + 1 + 4) * 0.04 = 105 * 0.04 = 4.2
    expect(delta.deltaProfit).toBeCloseTo(4.2);
    
    expect(delta.deltaDeliveredPrice).toBeCloseTo(109.2);
    expect(delta.newDeliveredPrice).toBeCloseTo(2109.2);
  });

  it('computeMetalDelta handles price below threshold', () => {
    const newPrices: MetalPrices = { copper: 70000, aluminum: 19000 };
    const contract: MetalContract = { ...DEFAULT_CONTRACT, thresholdPercent: 0.1 }; // 10% threshold
    
    const delta = computeMetalDelta(mockHarness, basePrices, newPrices, contract);
    
    expect(delta.deltaCopperCost).toBe(0);
    expect(delta.deltaAluminumCost).toBe(0);
    expect(delta.deltaDeliveredPrice).toBe(0);
  });

  it('computeMetalEscalation calculates batch and annual impact', () => {
    const newPrices: MetalPrices = { copper: 78400, aluminum: 20200 }; // cu:+10000, al:+2000
    const contract: MetalContract = { ...DEFAULT_CONTRACT, thresholdPercent: 0 };
    
    const result = computeMetalEscalation([mockHarness], basePrices, newPrices, contract, { annualVolumes: [1000] });
    
    expect(result.harnesses).toHaveLength(1);
    expect(result.summary.totalWeightedDelta).toBeGreaterThan(0);
    expect(result.annualImpact).not.toBeNull();
    expect(result.annualImpact?.totalLifecycleImpact).toBeGreaterThan(0);
    
    const hDelta = result.harnesses[0];
    // deltaCu = 100, deltaAl = 5 * 2000 / 1000 = 10
    expect(hDelta.deltaMaterialCost).toBe(110);
  });

  it('handles negative price change (price drop)', () => {
    const newPrices: MetalPrices = { copper: 58400, aluminum: 18200 }; // -10000
    const contract: MetalContract = { ...DEFAULT_CONTRACT, thresholdPercent: 0 };
    
    const delta = computeMetalDelta(mockHarness, basePrices, newPrices, contract);
    
    expect(delta.deltaCopperCost).toBe(-100);
    expect(delta.deltaDeliveredPrice).toBeLessThan(0);
  });
});
