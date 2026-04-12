/**
 * C5: 金属联动公式验证测试
 *
 * 验证 computeMetalDelta, computeMetalEscalation, computeSensitivityMatrix
 * 确保公式正确性
 */
import { describe, it, expect } from 'vitest';
import {
  computeMetalDelta,
  computeMetalEscalation,
  computeSensitivityMatrix,
  DEFAULT_CONTRACT,
} from '../metal_escalation';
import type { HarnessResult } from '@/types/harness';
import type { MetalPrices } from '@/types/project';

/** 构造最小化的 HarnessResult 测试桩 */
function makeHarness(overrides: Partial<HarnessResult> = {}): HarnessResult {
  return {
    harnessId: 'H-TEST-001',
    harnessName: '测试线束',
    vehicleRatio: 1,
    copperWeight: 2.5,
    aluminumWeight: 0.8,
    processHours: 1.5,
    materialCost: 80,
    wasteCost: 0.8,
    directLabor: 52.5,
    manufacturing: 70.035,
    laborPlusMfg: 122.535,
    mgmtFee: 12.15,
    profit: 12.19,
    exFactoryPrice: 227.67,
    packSubtotal: 5,
    freightSubtotal: 3,
    packTotal: 8,
    deliveredPrice: 235.67,
    materialBreakdown: {
      cuCost: 40, alCost: 10, nonMetalCost: 30,
      byType: { wire: 50, connector: 15, terminal: 8, ipt_terminal: 2, bracket_rubber: 3, tape_tube: 1, other: 1 },
      totalMetalCost: 50, totalNonWireCost: 30,
    },
    packagingDetail: { innerBoxCost: 1, outerBoxCost: 1, palletCost: 1, trayDividerCost: 0.5, bubbleWrapCost: 1, labelCost: 0.5, subtotal: 5 },
    freightDetail: { freight: 1.5, excessFreight: 0, shortHaul: 0.5, thirdPartyWarehouse: 0.5, storage: 0.5, subtotal: 3 },
    _params: { wasteRate: 0.01, mgmtRate: 0.06, profitRate: 0.056627, laborRate: 35, mfgRate: 46.69 },
    ...overrides,
  } as HarnessResult;
}

describe('C5: 金属联动公式验证', () => {

  describe('computeMetalDelta - 金属差价计算', () => {
    it('铜价上涨时应产生正差价', () => {
      const harness = makeHarness({ copperWeight: 2.5, aluminumWeight: 0 });
      const baseMetal: Partial<MetalPrices> = { copper: 60000, aluminum: 18000 };
      const newMetal: Partial<MetalPrices> = { copper: 65000, aluminum: 18000 };
      const delta = computeMetalDelta(harness, baseMetal, newMetal, DEFAULT_CONTRACT);
      expect(delta.deltaCopperCost).toBeGreaterThan(0);
      expect(delta.deltaDeliveredPrice).toBeGreaterThan(0);
    });

    it('铝价下跌时应产生负差价', () => {
      const harness = makeHarness({ copperWeight: 0, aluminumWeight: 1.0 });
      const baseMetal: Partial<MetalPrices> = { copper: 60000, aluminum: 18000 };
      const newMetal: Partial<MetalPrices> = { copper: 60000, aluminum: 16000 };
      const delta = computeMetalDelta(harness, baseMetal, newMetal, DEFAULT_CONTRACT);
      expect(delta.deltaAluminumCost).toBeLessThan(0);
      expect(delta.deltaDeliveredPrice).toBeLessThan(0);
    });

    it('价格不变时差价应为0', () => {
      const harness = makeHarness({ copperWeight: 2.5, aluminumWeight: 0.8 });
      const baseMetal: Partial<MetalPrices> = { copper: 60000, aluminum: 18000 };
      const newMetal: Partial<MetalPrices> = { copper: 60000, aluminum: 18000 };
      const delta = computeMetalDelta(harness, baseMetal, newMetal, DEFAULT_CONTRACT);
      expect(delta.deltaMaterialCost).toBe(0);
      expect(delta.deltaDeliveredPrice).toBe(0);
    });

    it('零重量应返回零差价', () => {
      const harness = makeHarness({ copperWeight: 0, aluminumWeight: 0 });
      const baseMetal: Partial<MetalPrices> = { copper: 60000, aluminum: 18000 };
      const newMetal: Partial<MetalPrices> = { copper: 70000, aluminum: 20000 };
      const delta = computeMetalDelta(harness, baseMetal, newMetal, DEFAULT_CONTRACT);
      expect(delta.deltaMaterialCost).toBe(0);
      expect(delta.deltaDeliveredPrice).toBe(0);
    });
  });

  describe('computeMetalEscalation - 整套线束金属联动', () => {
    it('应正确计算铜+铝综合联动金额', () => {
      const harness = makeHarness({ copperWeight: 2.5, aluminumWeight: 0.8 });
      const baseMetal: MetalPrices = { copper: 60000, aluminum: 18000 };
      const newMetal: MetalPrices = { copper: 65000, aluminum: 19000 };
      const result = computeMetalEscalation([harness], baseMetal, newMetal, DEFAULT_CONTRACT);

      expect(result.harnesses).toHaveLength(1);
      expect(result.harnesses[0].deltaCopperCost).toBeGreaterThan(0);
      expect(result.harnesses[0].deltaAluminumCost).toBeGreaterThan(0);
      // 总加权 delta = 铜 + 铝 (vehicleRatio=1)
      const d = result.harnesses[0];
      expect(result.summary.totalWeightedDelta).toBeCloseTo(d.weightedDelta, 4);
    });

    it('联动金额应与单独计算一致', () => {
      const harness = makeHarness({ copperWeight: 3.0, aluminumWeight: 1.2 });
      const baseMetal: MetalPrices = { copper: 60000, aluminum: 18000 };
      const newMetal: MetalPrices = { copper: 68000, aluminum: 17000 };

      const escalation = computeMetalEscalation([harness], baseMetal, newMetal, DEFAULT_CONTRACT);
      const singleDelta = computeMetalDelta(harness, baseMetal, newMetal, DEFAULT_CONTRACT);

      expect(escalation.harnesses[0].deltaCopperCost).toBeCloseTo(singleDelta.deltaCopperCost, 4);
      expect(escalation.harnesses[0].deltaAluminumCost).toBeCloseTo(singleDelta.deltaAluminumCost, 4);
      expect(escalation.harnesses[0].deltaDeliveredPrice).toBeCloseTo(singleDelta.deltaDeliveredPrice, 4);
    });
  });

  describe('computeSensitivityMatrix - 敏感性矩阵', () => {
    it('应生成正确维度的矩阵', () => {
      const harness = makeHarness({ copperWeight: 2.5, aluminumWeight: 0.8 });
      const baseMetal: MetalPrices = { copper: 60000, aluminum: 18000 };
      // 5 个铜价点 × 5 个铝价点
      const cuRange = [54000, 57000, 60000, 63000, 66000];
      const alRange = [16200, 17100, 18000, 18900, 19800];
      const result = computeSensitivityMatrix([harness], baseMetal, cuRange, alRange);
      expect(result.matrix.length).toBe(5);
      expect(result.matrix[0].length).toBe(5);
    });

    it('基准价格点(0%偏移)对应的联动金额应为0', () => {
      const harness = makeHarness({ copperWeight: 2.5, aluminumWeight: 0.8 });
      const baseMetal: MetalPrices = { copper: 60000, aluminum: 18000 };
      const cuRange = [57000, 60000, 63000];
      const alRange = [17100, 18000, 18900];
      const result = computeSensitivityMatrix([harness], baseMetal, cuRange, alRange);
      // [1][1] 对应 (60000, 18000) = 基准价, deltaPerVehicle 应为 0
      expect(result.matrix[1][1].deltaPerVehicle).toBeCloseTo(0, 4);
    });

    it('对称偏移应产生相反的联动金额', () => {
      const harness = makeHarness({ copperWeight: 2.5, aluminumWeight: 0.8 });
      const baseMetal: MetalPrices = { copper: 60000, aluminum: 18000 };
      // -10%, 0%, +10% 铜价; 铝价固定在基准
      const cuRange = [54000, 60000, 66000];
      const alRange = [18000];
      const result = computeSensitivityMatrix([harness], baseMetal, cuRange, alRange);
      // [0][0] = -10%铜 vs [2][0] = +10%铜, 应符号相反、绝对值接近
      expect(
        Math.abs(result.matrix[0][0].deltaPerVehicle + result.matrix[2][0].deltaPerVehicle)
      ).toBeLessThan(0.01);
    });
  });
});
