import { describe, it, expect } from 'vitest';
import { computeVersionDiff } from '../version_diff';
import type { VersionSnapshot } from '@/types/version';
import type { HarnessInput } from '@/types/harness';
import type { ProjectConfig } from '@/types/project';

const mockHarnessInput: HarnessInput = {
  harnessId: 'H001',
  harnessName: 'Main',
  vehicleRatio: 1,
  bom: [
    {
      partNo: 'W001',
      partName: 'Cable',
      itemCategory: 'wire',
      qty: 1,
      unit: 'm',
      unitPrice: 0,
      amount: 0,
      copperWeightPerUnit: 1,
      aluminumWeightPerUnit: 0,
      nonMetalCostPerUnit: 0
    } as any
  ],
  frontHours: 5,
  backHours: 5,
  packaging: { 
    innerBoxCost: 10, outerBoxCost: 10, palletCost: 0, 
    trayDividerCost: 0, bubbleWrapCost: 0, labelCost: 0, 
    subtotal: 20 
  },
  freight: { freight: 10, excessFreight: 5, shortHaul: 5, thirdPartyWarehouse: 5, storage: 5, subtotal: 30 }
};

const mockConfig: ProjectConfig = {
  projectId: 'P001',
  projectName: 'Test Project',
  customer: 'Test Customer',
  metalPrices: { copper: 70000, aluminum: 20000 },
  costRates: { wasteRate: 0.01, mgmtRate: 0.05, profitRate: 0.05, laborRate: 60, mfgRate: 80 }
};

const mockSnapshotBase: VersionSnapshot = {
  harnesses: [{ harnessId: 'H001', harnessName: 'Main', input: mockHarnessInput }],
  config: mockConfig,
  summary: { vehicleCost: 1000, totalMaterial: 500, totalLabor: 200, harnessCount: 1 }
};

describe('version_diff', () => {
  it('identical snapshots return zero deltas', () => {
    const diff = computeVersionDiff(mockSnapshotBase, mockSnapshotBase);
    
    expect(diff.projectLevel).toHaveLength(4);
    diff.projectLevel.forEach(item => {
      expect(item.delta).toBe(0);
      expect(item.deltaPercent).toBe(0);
    });
    
    expect(diff.harnessLevel).toHaveLength(1);
    diff.harnessLevel[0].diffs.forEach(item => {
      expect(item.delta).toBe(0);
    });
  });

  it('harness added in newer version', () => {
    const mockHarnessInput2: HarnessInput = { ...mockHarnessInput, harnessId: 'H002', harnessName: 'Aux' };
    const mockSnapshotNew: VersionSnapshot = {
      ...mockSnapshotBase,
      harnesses: [
        ...mockSnapshotBase.harnesses,
        { harnessId: 'H002', harnessName: 'Aux', input: mockHarnessInput2 }
      ],
      summary: { ...mockSnapshotBase.summary, harnessCount: 2, vehicleCost: 1500 }
    };

    const diff = computeVersionDiff(mockSnapshotBase, mockSnapshotNew);
    
    expect(diff.harnessLevel).toHaveLength(2);
    const addedHarness = diff.harnessLevel.find(h => h.harnessId === 'H002');
    expect(addedHarness).toBeDefined();
    
    const countDiff = diff.projectLevel.find(p => p.field === 'harnessCount');
    expect(countDiff?.delta).toBe(1);
    expect(countDiff?.after).toBe(2);
  });

  it('cost values changed shows correct deltas', () => {
    const mockSnapshotNew: VersionSnapshot = {
      ...mockSnapshotBase,
      config: {
        ...mockSnapshotBase.config,
        metalPrices: { copper: 80000, aluminum: 20000 } // price up
      },
      summary: { ...mockSnapshotBase.summary, vehicleCost: 1100 }
    };

    const diff = computeVersionDiff(mockSnapshotBase, mockSnapshotNew);
    
    const vehicleCostDiff = diff.projectLevel.find(p => p.field === 'vehicleCost');
    expect(vehicleCostDiff?.delta).toBe(100);
    expect(vehicleCostDiff?.deltaPercent).toBe(10);
    
    const harnessDiff = diff.harnessLevel[0].diffs.find(d => d.field === 'deliveredPrice');
    expect(harnessDiff?.delta).toBeGreaterThan(0);
  });
});
