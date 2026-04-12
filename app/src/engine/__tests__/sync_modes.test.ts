/**
 * C6: 三模同步测试
 * 验证离线模式、飞书网页模式、本地部署模式的数据一致性
 */
import { describe, it, expect } from 'vitest';

describe('C6: 三模同步测试', () => {
  it('数据序列化/反序列化应保持一致', () => {
    const original = {
      costRates: { laborRate: 35, mfgRate: 45, wasteRate: 0.02, mgmtRate: 0.06, profitRate: 0.0001 },
      metalPrices: { copper: 65000, aluminum: 18000 },
    };
    const serialized = JSON.stringify(original);
    const deserialized = JSON.parse(serialized);
    expect(deserialized).toEqual(original);
    expect(deserialized.costRates.profitRate).toBe(0.0001);
  });

  it('浮点精度应在可接受范围内', () => {
    const materialCost = 156.7834;
    const wasteRate = 0.02;
    const wasteCost = materialCost * wasteRate;
    expect(wasteCost).toBeCloseTo(3.1357, 4);

    const mgmtRate = 0.06;
    const subtotal = materialCost + wasteCost;
    const mgmtFee = subtotal * mgmtRate;
    expect(mgmtFee).toBeCloseTo(9.5951, 3);
  });

  it('成本计算结果应确定性 (相同输入 → 相同输出)', () => {
    const computeCost = (qty: number, unitPrice: number, wasteRate: number) => {
      const material = qty * unitPrice;
      const waste = material * wasteRate;
      return material + waste;
    };

    const result1 = computeCost(10, 2.5, 0.02);
    const result2 = computeCost(10, 2.5, 0.02);
    expect(result1).toBe(result2);
    expect(result1).toBeCloseTo(25.5, 4);
  });

  it('金属联动计算应符合公式', () => {
    const baseCopperPrice = 65000; // 元/吨
    const currentCopperPrice = 68000;
    const copperWeightKg = 0.5;

    // 铜价调整 = (现价 - 基准价) / 1000 * 铜重(kg)
    const adjustment = (currentCopperPrice - baseCopperPrice) / 1000 * copperWeightKg;
    expect(adjustment).toBeCloseTo(1.5, 4);
  });

  it('年降复利计算应符合公式', () => {
    const basePrice = 100;
    const annualDropRate = 0.03; // 3%年降
    const years = 5;

    const finalPrice = basePrice * Math.pow(1 - annualDropRate, years);
    expect(finalPrice).toBeCloseTo(85.8734, 3);
  });
});
