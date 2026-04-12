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

describe('C5: 金属联动公式验证', () => {

  describe('computeMetalDelta - 金属差价计算', () => {
    it('铜价上涨时应产生正差价', () => {
      const delta = computeMetalDelta({
        metal: 'copper',
        basePrice: 60000,  // 基准铜价 6万/吨
        currentPrice: 65000, // 当前铜价 6.5万/吨
        weightKg: 2.5,     // 单套铜重 2.5kg
        contract: DEFAULT_CONTRACT,
      });
      expect(delta.amount).toBeGreaterThan(0);
      expect(delta.priceChangeRate).toBeCloseTo(0.0833, 2);
    });

    it('铝价下跌时应产生负差价', () => {
      const delta = computeMetalDelta({
        metal: 'aluminum',
        basePrice: 18000,
        currentPrice: 16000,
        weightKg: 1.0,
        contract: DEFAULT_CONTRACT,
      });
      expect(delta.amount).toBeLessThan(0);
    });

    it('价格不变时差价应为0', () => {
      const delta = computeMetalDelta({
        metal: 'copper',
        basePrice: 60000,
        currentPrice: 60000,
        weightKg: 2.5,
        contract: DEFAULT_CONTRACT,
      });
      expect(delta.amount).toBe(0);
    });

    it('零重量应返回零差价', () => {
      const delta = computeMetalDelta({
        metal: 'copper',
        basePrice: 60000,
        currentPrice: 70000,
        weightKg: 0,
        contract: DEFAULT_CONTRACT,
      });
      expect(delta.amount).toBe(0);
    });
  });

  describe('computeMetalEscalation - 整套线束金属联动', () => {
    it('应正确计算铜+铝综合联动金额', () => {
      const result = computeMetalEscalation({
        copperBasePrice: 60000,
        copperCurrentPrice: 65000,
        aluminumBasePrice: 18000,
        aluminumCurrentPrice: 19000,
        copperWeightKg: 2.5,
        aluminumWeightKg: 0.8,
        contract: DEFAULT_CONTRACT,
      });
      expect(result.copperDelta).toBeDefined();
      expect(result.aluminumDelta).toBeDefined();
      expect(result.totalDelta).toBe(result.copperDelta + result.aluminumDelta);
    });

    it('联动金额应与单独计算一致', () => {
      const params = {
        copperBasePrice: 60000,
        copperCurrentPrice: 68000,
        aluminumBasePrice: 18000,
        aluminumCurrentPrice: 17000,
        copperWeightKg: 3.0,
        aluminumWeightKg: 1.2,
        contract: DEFAULT_CONTRACT,
      };
      const escalation = computeMetalEscalation(params);

      const copperDeltaAlone = computeMetalDelta({
        metal: 'copper',
        basePrice: params.copperBasePrice,
        currentPrice: params.copperCurrentPrice,
        weightKg: params.copperWeightKg,
        contract: DEFAULT_CONTRACT,
      });

      const aluminumDeltaAlone = computeMetalDelta({
        metal: 'aluminum',
        basePrice: params.aluminumBasePrice,
        currentPrice: params.aluminumCurrentPrice,
        weightKg: params.aluminumWeightKg,
        contract: DEFAULT_CONTRACT,
      });

      expect(escalation.copperDelta).toBeCloseTo(copperDeltaAlone.amount, 4);
      expect(escalation.aluminumDelta).toBeCloseTo(aluminumDeltaAlone.amount, 4);
    });
  });

  describe('computeSensitivityMatrix - 敏感性矩阵', () => {
    it('应生成正确维度的矩阵', () => {
      const matrix = computeSensitivityMatrix({
        copperBasePrice: 60000,
        aluminumBasePrice: 18000,
        copperWeightKg: 2.5,
        aluminumWeightKg: 0.8,
        priceSteps: [-10, -5, 0, 5, 10],
        contract: DEFAULT_CONTRACT,
      });
      // 5 copper steps × 5 aluminum steps
      expect(matrix.length).toBe(5);
      expect(matrix[0].length).toBe(5);
    });

    it('基准价格点(0%偏移)对应的联动金额应为0', () => {
      const matrix = computeSensitivityMatrix({
        copperBasePrice: 60000,
        aluminumBasePrice: 18000,
        copperWeightKg: 2.5,
        aluminumWeightKg: 0.8,
        priceSteps: [-5, 0, 5],
        contract: DEFAULT_CONTRACT,
      });
      // [1][1] 对应 (0%, 0%)
      expect(matrix[1][1]).toBeCloseTo(0, 4);
    });

    it('对称偏移应产生相反的联动金额', () => {
      const matrix = computeSensitivityMatrix({
        copperBasePrice: 60000,
        aluminumBasePrice: 18000,
        copperWeightKg: 2.5,
        aluminumWeightKg: 0.8,
        priceSteps: [-10, 0, 10],
        contract: DEFAULT_CONTRACT,
      });
      // [0][1]=-10%铜, 0%铝 vs [2][1]=+10%铜, 0%铝
      // 应符号相反、绝对值接近
      expect(Math.abs(matrix[0][1] + matrix[2][1])).toBeLessThan(0.01);
    });
  });
});
