import { describe, it, expect } from 'vitest';
import { 
  computeHarnessCost, 
  computeProjectFromHarnesses, 
  computeHarnessCostAdaptive, 
  computeHarnessesFromSeedData 
} from '@/engine/harness_costing';
import { computeChangePricing } from '@/engine/change_pricing';
import { computeVersionDiff } from '@/engine/version_diff';
import { CostRates, MetalPrices } from '@/types/project';
import { 
  HarnessInput, 
  BomItem, 
  WireItem, 
  ProjectHarnessResult, 
  HarnessResult 
} from '@/types/harness';
import { VersionSnapshot } from '@/types/version';

describe('E2E Full Pipeline Test', () => {
  const rates: CostRates = { 
    laborRate: 35, 
    mfgRate: 46.69, 
    wasteRate: 0.01, 
    mgmtRate: 0.06, 
    profitRate: 0.056627 
  };
  const metalPrices: MetalPrices = { copper: 76450, aluminum: 18910 };

  // Helper to store shared state between stages if needed (though Stage 1 handles its own)
  let sharedState: any = {};

  describe('Stage 1: Project Setup & Initial Costing', () => {
    it('should compute initial costs correctly for multiple harnesses', () => {
      // Define realistic BOM items
      const copperWire: WireItem = {
        partNo: 'W001',
        partName: 'Power Cable 50mm2',
        itemCategory: 'wire',
        qty: 2.5,
        unit: 'm',
        unitPrice: 0, // Calculated from metal price
        amount: 0,
        copperWeightPerUnit: 0.45, // kg/m
        aluminumWeightPerUnit: 0,
        nonMetalCostPerUnit: 5.5, // insulation etc
      };

      const connector: BomItem = {
        partNo: 'C001',
        partName: 'HV Connector 2P',
        itemCategory: 'connector',
        qty: 2,
        unit: 'pcs',
        unitPrice: 45.0,
        amount: 90.0,
      };

      const terminal: BomItem = {
        partNo: 'T001',
        partName: 'HV Terminal',
        itemCategory: 'terminal',
        qty: 4,
        unit: 'pcs',
        unitPrice: 3.5,
        amount: 14.0,
      };

      // Harness A: "6608442966"
      const inputA: HarnessInput = {
        harnessId: '6608442966',
        harnessName: 'Main HV Harness',
        vehicleRatio: 1.0,
        bom: [copperWire, connector, terminal, 
          { partNo: 'P001', partName: 'Tube', itemCategory: 'tape_tube', qty: 2.0, unit: 'm', unitPrice: 2.1, amount: 4.2 } as BomItem,
          { partNo: 'O001', partName: 'Clip', itemCategory: 'other', qty: 5, unit: 'pcs', unitPrice: 0.5, amount: 2.5 } as BomItem
        ],
        frontHours: 0.5,
        backHours: 0.5,
        packaging: { innerBoxCost: 2.0, outerBoxCost: 1.5, palletCost: 0.5, trayDividerCost: 0, bubbleWrapCost: 0.5, labelCost: 0.1, subtotal: 4.6 },
        freight: { freight: 1.2, excessFreight: 0, shortHaul: 0.5, thirdPartyWarehouse: 1.0, storage: 0.3, subtotal: 3.0 },
      };

      // Harness B: "6608442964" (simpler)
      const inputB: HarnessInput = {
        harnessId: '6608442964',
        harnessName: 'AC Harness',
        vehicleRatio: 1.0,
        bom: [
          { ...connector, qty: 1, amount: 45.0 },
          { ...terminal, qty: 2, amount: 7.0 },
          { partNo: 'W002', partName: 'Signal Wire', itemCategory: 'wire', qty: 1.5, unit: 'm', unitPrice: 1.2, amount: 1.8 } as BomItem
        ],
        frontHours: 0.2,
        backHours: 0.1,
        packaging: { innerBoxCost: 1.0, outerBoxCost: 0.5, palletCost: 0.2, trayDividerCost: 0, bubbleWrapCost: 0.2, labelCost: 0.1, subtotal: 2.0 },
        freight: { freight: 0.5, excessFreight: 0, shortHaul: 0.2, thirdPartyWarehouse: 0.5, storage: 0.1, subtotal: 1.8 },
      };

      // Harness C: "6608442963"
      const inputC: HarnessInput = {
        harnessId: '6608442963',
        harnessName: 'DC Harness',
        vehicleRatio: 0.5,
        bom: [
          copperWire,
          { ...copperWire, partNo: 'W003', copperWeightPerUnit: 0.2 } as WireItem,
          connector,
          terminal
        ],
        frontHours: 0.4,
        backHours: 0.3,
        packaging: { innerBoxCost: 1.5, outerBoxCost: 1.0, palletCost: 0.3, trayDividerCost: 0, bubbleWrapCost: 0.3, labelCost: 0.1, subtotal: 3.2 },
        freight: { freight: 0.8, excessFreight: 0, shortHaul: 0.3, thirdPartyWarehouse: 0.8, storage: 0.2, subtotal: 2.9 },
      };

      const resultA = computeHarnessCost(inputA, rates, metalPrices);
      const resultB = computeHarnessCost(inputB, rates, metalPrices);
      const resultC = computeHarnessCost(inputC, rates, metalPrices);

      [resultA, resultB, resultC].forEach(res => {
        expect(res.materialCost).toBeGreaterThan(0);
        expect(res.directLabor).toBeGreaterThan(0);
        expect(res.manufacturing).toBeGreaterThan(0);
        expect(res.deliveredPrice).toBeGreaterThan(res.exFactoryPrice);
        expect(res.exFactoryPrice).toBeGreaterThan(0);
      });

      const projectResult = computeProjectFromHarnesses([resultA, resultB, resultC]);
      expect(projectResult.vehicleCost).toBeGreaterThan(0);
      expect(projectResult.harnesses.length).toBe(3);
      
      sharedState.resultA = resultA;
      sharedState.resultB = resultB;
      sharedState.resultC = resultC;
      sharedState.inputA = inputA;
      sharedState.inputB = inputB;
      sharedState.inputC = inputC;
      sharedState.projectResult = projectResult;
    });
  });

  describe('Stage 2: Engineering Change Pricing', () => {
    it('should compute change pricing for modified harness A', () => {
      const { inputA, resultB, resultC, projectResult: baseProject } = sharedState;
      
      // Modify Harness A: change one BOM item quantity (+20%), add a new BOM item
      const modifiedInputA = JSON.parse(JSON.stringify(inputA));
      modifiedInputA.bom[1].qty *= 1.2; 
      modifiedInputA.bom[1].amount = modifiedInputA.bom[1].qty * modifiedInputA.bom[1].unitPrice;
      
      modifiedInputA.bom.push({
        partNo: 'NEW001',
        partName: 'New Shielding Tape',
        itemCategory: 'tape_tube',
        qty: 1,
        unit: 'roll',
        unitPrice: 15.0,
        amount: 15.0
      } as BomItem);

      const modifiedResultA = computeHarnessCost(modifiedInputA, rates, metalPrices);
      const newProject = computeProjectFromHarnesses([modifiedResultA, resultB, resultC]);

      const changeResult = computeChangePricing(baseProject, newProject, 'BOM_CHANGE');

      expect(changeResult.changes.length).toBeGreaterThanOrEqual(1);
      expect(changeResult.summary.totalDelta).not.toBe(0);
      
      const changeA = changeResult.changes.find(c => c.harnessId === inputA.harnessId);
      expect(changeA).toBeDefined();
      expect(changeA?.changeCategory).toBe('modify');
      expect(changeResult.summary.totalAfter).toBeGreaterThan(changeResult.summary.totalBefore);
      
      sharedState.modifiedInputA = modifiedInputA;
      sharedState.modifiedResultA = modifiedResultA;
      sharedState.newProject = newProject;
      sharedState.changeResult = changeResult;
    });
  });

  describe('Stage 3: Version Comparison', () => {
    it('should compare two versions correctly', () => {
      const { inputA, inputB, inputC, projectResult: baseProject } = sharedState;
      const { modifiedInputA, newProject } = sharedState;

      const beforeSnapshot: VersionSnapshot = {
        harnesses: [
          { harnessId: inputA.harnessId, harnessName: inputA.harnessName, input: inputA },
          { harnessId: inputB.harnessId, harnessName: inputB.harnessName, input: inputB },
          { harnessId: inputC.harnessId, harnessName: inputC.harnessName, input: inputC },
        ],
        config: { 
          costRates: rates, 
          metalPrices,
          volumes: [],
          annualDropRate: 0
        },
        summary: { 
          vehicleCost: baseProject.vehicleCost,
          totalMaterial: baseProject.weightedMaterial,
          totalLabor: baseProject.weightedLabor,
          harnessCount: 3
        },
      };

      const afterSnapshot: VersionSnapshot = {
        harnesses: [
          { harnessId: inputA.harnessId, harnessName: inputA.harnessName, input: modifiedInputA },
          { harnessId: inputB.harnessId, harnessName: inputB.harnessName, input: inputB },
          { harnessId: inputC.harnessId, harnessName: inputC.harnessName, input: inputC },
        ],
        config: beforeSnapshot.config,
        summary: {
          vehicleCost: newProject.vehicleCost,
          totalMaterial: newProject.weightedMaterial,
          totalLabor: newProject.weightedLabor,
          harnessCount: 3
        }
      };

      const versionDiff = computeVersionDiff(beforeSnapshot, afterSnapshot);

      expect(versionDiff.projectLevel.some(item => item.delta !== 0)).toBe(true);
      expect(versionDiff.harnessLevel.length).toBe(3);

      const diffA = versionDiff.harnessLevel.find(h => h.harnessId === inputA.harnessId);
      expect(diffA?.diffs.some(d => d.delta !== 0)).toBe(true);

      const diffB = versionDiff.harnessLevel.find(h => h.harnessId === inputB.harnessId);
      expect(diffB?.diffs.every(d => d.delta === 0)).toBe(true);
    });
  });

  describe('Stage 4: Adaptive Engine Pipeline', () => {
    it('should handle different precision levels', () => {
      // Level 3: with BOM
      const inputL3: HarnessInput = {
        harnessId: 'L3', harnessName: 'L3', vehicleRatio: 1,
        bom: [{ partNo: 'P1', partName: 'M1', itemCategory: 'connector', qty: 1, unit: 'pcs', unitPrice: 10, amount: 10 } as BomItem],
        frontHours: 1, backHours: 0,
        packaging: { innerBoxCost: 0, outerBoxCost: 0, palletCost: 0, trayDividerCost: 0, bubbleWrapCost: 0, labelCost: 0, subtotal: 0 },
        freight: { freight: 0, excessFreight: 0, shortHaul: 0, thirdPartyWarehouse: 0, storage: 0, subtotal: 0 }
      };

      // Level 2: materialCost but no BOM
      const inputL2: any = {
        harnessId: 'L2', harnessName: 'L2', vehicleRatio: 1,
        bom: [],
        materialCost: 50,
        processHours: 2,
        packaging: { subtotal: 5 },
        freight: { subtotal: 2 }
      };

      // Level 1: referenceTotalPrice only
      const inputL1: any = {
        harnessId: 'L1', harnessName: 'L1', vehicleRatio: 1,
        referenceTotalPrice: 200
      };

      const resL3 = computeHarnessCostAdaptive(inputL3, rates, metalPrices);
      const resL2 = computeHarnessCostAdaptive(inputL2, rates, metalPrices);
      const resL1 = computeHarnessCostAdaptive(inputL1, rates, metalPrices);

      expect(resL3.precisionLevel).toBe(3);
      expect(resL2.precisionLevel).toBe(2);
      expect(resL1.precisionLevel).toBe(1);
      
      expect(resL1.materialCost).toBeGreaterThan(0);
    });
  });

  describe('Stage 5: Full Pipeline Integration', () => {
    it('should verify consistency across full workflow', () => {
      // Simulate seed data format
      const seedData = [
        {
          harnessId: 'S1',
          name: 'Seed 1',
          vehicleRatio: 1.0,
          bomItems: [{ partNo: 'B1', partName: 'Item 1', itemCategory: 'connector', qty: 1, unit: 'pcs', unitPrice: 100, amount: 100 }],
          processHours: 1.5,
          packaging: { innerPack: 2, outerPack: 1, freight: 5, shortHaul: 2, thirdParty: 1, storage: 0 }
        }
      ];

      const baseProject = computeHarnessesFromSeedData(seedData, rates, metalPrices);
      
      // Change: increase hours
      const modifiedSeedData = JSON.parse(JSON.stringify(seedData));
      modifiedSeedData[0].processHours = 2.0;
      
      const newProject = computeHarnessesFromSeedData(modifiedSeedData, rates, metalPrices);
      
      const changePricing = computeChangePricing(baseProject, newProject, 'HOURS_CHANGE');
      
      const expectedDelta = newProject.vehicleCost - baseProject.vehicleCost;
      expect(changePricing.summary.totalDelta).toBeCloseTo(expectedDelta, 2);
    });
  });
});
