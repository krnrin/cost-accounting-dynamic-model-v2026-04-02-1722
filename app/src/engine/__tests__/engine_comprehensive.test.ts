import { describe, it, expect } from 'vitest';
import { computeHarnessCost, computeProjectFromHarnesses } from '../harness_costing';
import { computeChangePricing, computeAnnualDrop } from '../change_pricing';
import { computeMetalEscalation } from '../metal_escalation';
import { mapToGeelyTemplate } from '../quote_template';
import type { CostRates, MetalPrices } from '@/types/project';
import type { HarnessInput, HarnessResult } from '@/types/harness';
import fs from 'fs';
import path from 'path';

// 读取种子数据
const seedDataPath = path.resolve(__dirname, '../../../../_e281_harness_seed_data.json');
const seed = JSON.parse(fs.readFileSync(seedDataPath, 'utf8'));

const RATES: CostRates = {
  laborRate: 35,
  mfgRate: 46.69,
  wasteRate: 0.01,
  mgmtRate: 0.06,
  profitRate: 0.056627,
};

const METALS: MetalPrices = {
  copper: 72800,
  aluminum: 20500,
};

describe('Engine Comprehensive Tests (E281 Reference)', () => {
  
  describe('4a. Per-harness cost calculation (11 test cases)', () => {
    seed.harnesses.forEach((h: any) => {
      it(`应该正确计算线束: ${h.harnessId} (${h.name})`, () => {
        const input: HarnessInput = {
          harnessId: h.harnessId,
          harnessName: h.name,
          vehicleRatio: h.vehicleRatio,
          frontHours: h.processHours / 2,
          backHours: h.processHours / 2,
          bom: [], // 使用 fallback
          packaging: { 
            innerPack: h.packaging.innerPack, 
            outerPack: h.packaging.outerPack,
            subtotal: h.packaging.packSubtotal
          },
          freight: { 
            freight: h.packaging.freight || 0, 
            excessFreight: h.packaging.excessFreight || 0, 
            shortHaul: h.packaging.shortHaul || 0, 
            thirdPartyWarehouse: h.packaging.thirdPartyWarehouse || h.packaging.thirdParty || 0, 
            storage: h.packaging.storage || 0,
            subtotal: h.packaging.freightSubtotal
          },
        };

        // 设置 fallback 属性
        (input as any).materialCost = h.materialCost;
        (input as any).copperWeight = h.copperWeight;
        (input as any).aluminumWeight = h.aluminumWeight;
        (input as any).processHours = h.processHours;

        const result = computeHarnessCost(input, RATES, METALS);

        expect(result.materialCost).toBeCloseTo(h.materialCost, 1);
        expect(result.wasteCost).toBeCloseTo(h.wasteCost, 1);
        expect(result.directLabor).toBeCloseTo(h.directLabor, 1);
        expect(result.manufacturing).toBeCloseTo(h.manufacturing, 1);
        expect(result.mgmtFee).toBeCloseTo(h.mgmtFee, 1);
        expect(result.profit).toBeCloseTo(h.profit, 1);
        expect(result.exFactoryPrice).toBeCloseTo(h.exFactoryPrice, 1);
        expect(result.deliveredPrice).toBeCloseTo(h.deliveredPrice, 1);
      });
    });
  });

  describe('4b. Project-level aggregation', () => {
    it('应该正确汇总项目总成本', () => {
      const results: HarnessResult[] = seed.harnesses.map((h: any) => {
        const input: HarnessInput = {
          harnessId: h.harnessId,
          harnessName: h.name,
          vehicleRatio: h.vehicleRatio,
          frontHours: h.processHours / 2,
          backHours: h.processHours / 2,
          bom: [],
          packaging: { 
            innerPack: h.packaging.innerPack, 
            outerPack: h.packaging.outerPack,
            subtotal: h.packaging.packSubtotal
          },
          freight: { 
            freight: h.packaging.freight || 0, 
            excessFreight: h.packaging.excessFreight || 0, 
            shortHaul: h.packaging.shortHaul || 0, 
            thirdPartyWarehouse: h.packaging.thirdPartyWarehouse || h.packaging.thirdParty || 0, 
            storage: h.packaging.storage || 0,
            subtotal: h.packaging.freightSubtotal
          },
        };
        (input as any).materialCost = h.materialCost;
        (input as any).copperWeight = h.copperWeight;
        (input as any).aluminumWeight = h.aluminumWeight;
        (input as any).processHours = h.processHours;
        
        return computeHarnessCost(input, RATES, METALS);
      });

      const project = computeProjectFromHarnesses(results);

      expect(project.vehicleCost).toBeCloseTo(seed.projectSummary.vehicleCost, 1);
      expect(project.harnessCount).toBe(11);
      expect(project.totalCopperWeight).toBeCloseTo(
        seed.harnesses.reduce((sum: number, h: any) => sum + h.copperWeight, 0),
        4
      );
      expect(project.totalAluminumWeight).toBeCloseTo(
        seed.harnesses.reduce((sum: number, h: any) => sum + h.aluminumWeight, 0),
        4
      );
    });
  });

  describe('4c. Change pricing scenarios', () => {
    const getBaseProject = () => {
      const results = seed.harnesses.map((h: any) => {
        const input = {
          harnessId: h.harnessId,
          harnessName: h.name,
          vehicleRatio: h.vehicleRatio,
          processHours: h.processHours,
          materialCost: h.materialCost,
          copperWeight: h.copperWeight,
          aluminumWeight: h.aluminumWeight,
          packaging: { innerPack: h.packaging.innerPack, outerPack: h.packaging.outerPack, subtotal: h.packaging.packSubtotal },
          freight: { freight: h.packaging.freight, excessFreight: h.packaging.excessFreight, shortHaul: h.packaging.shortHaul, thirdPartyWarehouse: h.packaging.thirdPartyWarehouse, storage: h.packaging.storage, subtotal: h.packaging.freightSubtotal },
        };
        return computeHarnessCost(input as any, RATES, METALS);
      });
      return computeProjectFromHarnesses(results);
    };

    it('Scenario 1: BOM change - 修改一个线束的材料成本', () => {
      const baseProject = getBaseProject();
      const newHarnesses = seed.harnesses.map((h: any, index: number) => {
        const input = { ...h };
        if (index === 0) {
          input.materialCost += 10; // 增加10元
        }
        return computeHarnessCost({
          ...input,
          harnessName: input.name,
          bom: [],
          packaging: { innerPack: input.packaging.innerPack, outerPack: input.packaging.outerPack, subtotal: input.packaging.packSubtotal },
          freight: { ...input.packaging, subtotal: input.packaging.freightSubtotal }
        } as any, RATES, METALS);
      });
      const newProject = computeProjectFromHarnesses(newHarnesses);
      
      const change = computeChangePricing(baseProject, newProject);
      
      // 单车影响 = 10 * 废品率1.01 * 管理费1.06 * 利润1.056627 * 装车比
      // 这里的 cascading 逻辑在 engine 中实现
      // 实际上 mgmt 不含 waste
      // waste = 10 * 0.01 = 0.1
      // mgmt = 10 * 0.06 = 0.6
      // profit = (10 + 0.1 + 0.6) * 0.056627 = 0.6059
      // total_harness_delta = 10 + 0.1 + 0.6 + 0.6059 = 11.3059
      // vehicle_delta = 11.3059 * vehicleRatio
      
      expect(change.summary.totalDelta).toBeGreaterThan(0);
      expect(change.changes[0]!.delta.materialCost).toBeCloseTo(10, 1);
    });

    it('Scenario 2: Hours change - 修改工时', () => {
      const baseProject = getBaseProject();
      const newHarnesses = seed.harnesses.map((h: any, index: number) => {
        const input = { ...h };
        if (index === 0) {
          input.processHours += 0.5; // 增加0.5小时
        }
        return computeHarnessCost({
          ...input,
          harnessName: input.name,
          bom: [],
          packaging: { innerPack: input.packaging.innerPack, outerPack: input.packaging.outerPack, subtotal: input.packaging.packSubtotal },
          freight: { ...input.packaging, subtotal: input.packaging.freightSubtotal }
        } as any, RATES, METALS);
      });
      const newProject = computeProjectFromHarnesses(newHarnesses);
      const change = computeChangePricing(baseProject, newProject);
      
      expect(change.changes[0]!.delta.processHours).toBeCloseTo(0.5, 2);
      expect(change.changes[0]!.delta.directLabor).toBeCloseTo(0.5 * 35, 1);
    });

    it('Scenario 3: Annual drop - 年降', () => {
      const basePrice = 526.63;
      const dropRate = 0.02; // 2%
      const drops = computeAnnualDrop(basePrice, dropRate, 3);
      
      expect(drops[0]!.deliveredPrice).toBeCloseTo(basePrice, 1); // Year 1
      expect(drops[1]!.deliveredPrice).toBeCloseTo(basePrice * (1 - 0.02), 1); // Year 2
      expect(drops[2]!.deliveredPrice).toBeCloseTo(basePrice * (1 - 0.02) * (1 - 0.02), 1); // Year 3
    });
  });

  describe('4d. Metal escalation', () => {
    it('当铜价超出阈值时应该应用联动公式', () => {
      const baseMetal = { copper: 72800, aluminum: 20500 };
      const newMetal = { copper: 80000, aluminum: 20500 }; // 铜价大幅上涨
      
      const results = seed.harnesses.map((h: any) => {
        const input = {
          ...h,
          harnessName: h.name,
          bom: [],
          packaging: { innerPack: h.packaging.innerPack, outerPack: h.packaging.outerPack, subtotal: h.packaging.packSubtotal },
          freight: { ...h.packaging, subtotal: h.packaging.freightSubtotal }
        };
        return computeHarnessCost(input as any, RATES, baseMetal);
      });

      // 使用 5% 阈值
      const contract = {
        baseCopperPrice: 72800,
        baseAluminumPrice: 20500,
        thresholdPercent: 0.05,
        escalationRatio: 1.0,
        period: 'quarterly' as const
      };

      const escalation = computeMetalEscalation(results, baseMetal, newMetal, contract);
      
      // 80000 / 72800 = 1.098 (> 1.05)
      // 生效差异 = 80000 - 72800 * 1.05 = 80000 - 76440 = 3560
      expect(escalation.summary.totalWeightedDelta).toBeGreaterThan(0);
      
      const firstDelta = escalation.harnesses[0]!;
      if (firstDelta.copperWeight > 0) {
        expect(firstDelta.copperPriceDelta).toBeCloseTo(80000 - 72800 * 1.05, 0);
      }
    });

    it('当价格在阈值内时不应有调整', () => {
      const baseMetal = { copper: 72800, aluminum: 20500 };
      const newMetal = { copper: 74000, aluminum: 20500 }; // 74000/72800 = 1.016 (< 1.05)
      
      const results = seed.harnesses.map((h: any) => {
        const input = {
          ...h,
          harnessName: h.name,
          bom: [],
          packaging: { innerPack: h.packaging.innerPack, outerPack: h.packaging.outerPack, subtotal: h.packaging.packSubtotal },
          freight: { ...h.packaging, subtotal: h.packaging.freightSubtotal }
        };
        return computeHarnessCost(input as any, RATES, baseMetal);
      });

      const contract = {
        baseCopperPrice: 72800,
        baseAluminumPrice: 20500,
        thresholdPercent: 0.05,
        escalationRatio: 1.0,
        period: 'quarterly' as const
      };

      const escalation = computeMetalEscalation(results, baseMetal, newMetal, contract);
      expect(escalation.summary.totalWeightedDelta).toBe(0);
    });
  });

  describe('4e. Quote template mapping', () => {
    it('应该正确映射到吉利模板字段', () => {
      const h = seed.harnesses[0];
      const result = computeHarnessCost({
        ...h,
        harnessName: h.name,
        bom: [
          { partNo: 'WIRE01', partName: '导线', itemCategory: 'wire', qty: 1, unit: 'm', unitPrice: 50, amount: 50 } as any,
          { partNo: 'CONN01', partName: '连接器', itemCategory: 'connector', qty: 1, unit: '个', unitPrice: 38.0652, amount: 38.0652 } as any
        ],
        packaging: { innerPack: h.packaging.innerPack, outerPack: h.packaging.outerPack, subtotal: h.packaging.packSubtotal },
        freight: { ...h.packaging, subtotal: h.packaging.freightSubtotal }
      } as any, RATES, METALS);

      const geely = mapToGeelyTemplate(result);

      // A1 (原材料) = wire material cost = 50
      expect(geely.A1_rawMaterial).toBeCloseTo(50, 1);
      // A2 (外购件) = non-wire = 38.0652
      expect(geely.A2_purchasedParts).toBeCloseTo(38.0652, 1);
      // B1 (加工费) = manufacturing (根据 mapToGeelyTemplate 实现: 仅含制造费)
      expect(geely.B1_processingFee).toBeCloseTo(result.manufacturing, 1);
      // B2 (废品) = wasteCost (模板中计算逻辑为 (A1+A2) * wasteRate)
      expect(geely.B2_wasteLoss).toBeCloseTo((50 + 38.0652) * 0.01, 1);
    });
  });
});
