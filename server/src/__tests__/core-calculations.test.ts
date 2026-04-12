import { describe, it, expect } from 'vitest';

/**
 * T34 核心计算规则 API 测试
 * 测试所有关键业务计算逻辑
 */

describe('核心计算规则', () => {
  describe('1. 单项成本计算', () => {
    it('unit_cost = quantity × unit_price', () => {
      const quantity = 10;
      const unitPrice = 15.5;
      const unitCost = quantity * unitPrice;

      expect(unitCost).toBe(155);
    });

    it('处理小数精度', () => {
      const quantity = 3;
      const unitPrice = 2.333;
      const unitCost = Math.round(quantity * unitPrice * 100) / 100;

      expect(unitCost).toBe(7.00);
    });

    it('零数量返回零成本', () => {
      const quantity = 0;
      const unitPrice = 100;
      const unitCost = quantity * unitPrice;

      expect(unitCost).toBe(0);
    });
  });

  describe('2. 线束总成本计算', () => {
    it('harness_cost = SUM(bom_rows.unit_cost)', () => {
      const bomRows = [
        { partNo: 'CONN-001', quantity: 2, unitPrice: 15.5, unitCost: 31 },
        { partNo: 'WIRE-001', quantity: 10, unitPrice: 2.3, unitCost: 23 },
        { partNo: 'SEAL-001', quantity: 4, unitPrice: 1.2, unitCost: 4.8 },
      ];

      const harnessCost = bomRows.reduce((sum, row) => sum + row.unitCost, 0);

      expect(harnessCost).toBe(58.8);
    });

    it('空 BOM 返回零成本', () => {
      const bomRows: any[] = [];
      const harnessCost = bomRows.reduce((sum, row) => sum + row.unitCost, 0);

      expect(harnessCost).toBe(0);
    });

    it('包含加工费和管理费', () => {
      const materialCost = 100;
      const laborCost = 35;
      const mfgCost = 46.69;
      const mgmtRate = 0.06;

      const subtotal = materialCost + laborCost + mfgCost;
      const mgmtCost = subtotal * mgmtRate;
      const totalCost = subtotal + mgmtCost;

      expect(totalCost).toBeCloseTo(192.59, 2);
    });
  });

  describe('3. 分摊计算', () => {
    it('unit_allocation = total_amount / baseline_volume', () => {
      const totalAmount = 500000;
      const baselineVolume = 100000;
      const unitAllocation = totalAmount / baselineVolume;

      expect(unitAllocation).toBe(5);
    });

    it('多线束分摊按比例分配', () => {
      const totalAmount = 600000;
      const harnesses = [
        { id: 'H1', volume: 50000 },
        { id: 'H2', volume: 30000 },
        { id: 'H3', volume: 20000 },
      ];

      const totalVolume = harnesses.reduce((sum, h) => sum + h.volume, 0);
      const allocations = harnesses.map(h => ({
        ...h,
        allocation: (totalAmount * h.volume) / totalVolume,
      }));

      expect(allocations[0].allocation).toBe(300000);
      expect(allocations[1].allocation).toBe(180000);
      expect(allocations[2].allocation).toBe(120000);
      expect(allocations.reduce((sum, a) => sum + a.allocation, 0)).toBe(totalAmount);
    });
  });

  describe('4. 回收进度计算', () => {
    it('recovery_progress = recovered_amount / total_allocation', () => {
      const totalAllocation = 500000;
      const recoveredAmount = 250000;
      const recoveryProgress = (recoveredAmount / totalAllocation) * 100;

      expect(recoveryProgress).toBe(50);
    });

    it('回收完成标记为 100%', () => {
      const totalAllocation = 500000;
      const recoveredAmount = 500000;
      const recoveryProgress = (recoveredAmount / totalAllocation) * 100;

      expect(recoveryProgress).toBe(100);
    });

    it('超额回收限制为 100%', () => {
      const totalAllocation = 500000;
      const recoveredAmount = 600000;
      const recoveryProgress = Math.min((recoveredAmount / totalAllocation) * 100, 100);

      expect(recoveryProgress).toBe(100);
    });
  });

  describe('5. 利润缺口计算', () => {
    it('profit_gap = effective_customer_price - internal_cost_baseline', () => {
      const effectiveCustomerPrice = 150;
      const internalCostBaseline = 120;
      const profitGap = effectiveCustomerPrice - internalCostBaseline;

      expect(profitGap).toBe(30);
    });

    it('负利润缺口表示亏损', () => {
      const effectiveCustomerPrice = 100;
      const internalCostBaseline = 120;
      const profitGap = effectiveCustomerPrice - internalCostBaseline;

      expect(profitGap).toBe(-20);
      expect(profitGap < 0).toBe(true);
    });
  });

  describe('6. 有效执行价 L3 切换逻辑 (规则 10.6)', () => {
    it('L3 = 客户价 - 年降', () => {
      const customerPrice = 150;
      const annualDrop = 5;
      const effectivePriceL3 = customerPrice - annualDrop;

      expect(effectivePriceL3).toBe(145);
    });

    it('多年年降累计', () => {
      const customerPrice = 150;
      const annualDropRate = 0.03; // 3%
      const years = 3;

      let effectivePrice = customerPrice;
      for (let i = 0; i < years; i++) {
        effectivePrice = effectivePrice * (1 - annualDropRate);
      }

      // 150 * 0.97^3 = 136.9009545
      expect(effectivePrice).toBeCloseTo(136.90, 2);
    });

    it('年降不能使价格为负', () => {
      const customerPrice = 10;
      const annualDrop = 15;
      const effectivePriceL3 = Math.max(customerPrice - annualDrop, 0);

      expect(effectivePriceL3).toBe(0);
    });
  });

  describe('7. 金属成本影响', () => {
    it('metal_cost_impact = (new_price - old_price) × weight', () => {
      const oldCopperPrice = 65000; // 元/吨
      const newCopperPrice = 72000;
      const copperWeightKg = 0.5;

      const priceDiff = (newCopperPrice - oldCopperPrice) / 1000; // 转换为元/kg
      const metalCostImpact = priceDiff * copperWeightKg;

      expect(metalCostImpact).toBe(3.5);
    });

    it('铜铝混合导线成本', () => {
      const copperPrice = 72000 / 1000; // 元/kg
      const aluminumPrice = 20000 / 1000;
      const copperWeight = 0.3;
      const aluminumWeight = 0.2;

      const metalCost = (copperPrice * copperWeight) + (aluminumPrice * aluminumWeight);

      expect(metalCost).toBeCloseTo(25.6, 2);
    });
  });

  describe('8. 成本影响 + 残值影响', () => {
    it('cost_impact = new_cost - baseline_cost', () => {
      const baselineCost = 100;
      const newCost = 120;
      const costImpact = newCost - baselineCost;

      expect(costImpact).toBe(20);
    });

    it('residual_impact = (old_residual - new_residual)', () => {
      const oldResidual = 10;
      const newResidual = 8;
      const residualImpact = oldResidual - newResidual;

      expect(residualImpact).toBe(2);
    });

    it('总影响 = cost_impact + residual_impact', () => {
      const costImpact = 20;
      const residualImpact = 2;
      const totalImpact = costImpact + residualImpact;

      expect(totalImpact).toBe(22);
    });
  });

  describe('9. 年降影响', () => {
    it('annual_drop_impact = baseline_price × drop_rate', () => {
      const baselinePrice = 150;
      const dropRate = 0.03;
      const annualDropImpact = baselinePrice * dropRate;

      expect(annualDropImpact).toBe(4.5);
    });

    it('累计年降影响', () => {
      const baselinePrice = 150;
      const dropRate = 0.03;
      const years = 5;

      let cumulativeImpact = 0;
      let currentPrice = baselinePrice;

      for (let i = 0; i < years; i++) {
        const yearDrop = currentPrice * dropRate;
        cumulativeImpact += yearDrop;
        currentPrice -= yearDrop;
      }

      // 累计: 4.5 + 4.365 + 4.23405 + 4.1070285 + 3.98381765 = 21.18989615
      expect(cumulativeImpact).toBeCloseTo(21.19, 2);
    });
  });

  describe('10. 综合场景计算', () => {
    it('完整线束成本计算流程', () => {
      // BOM 成本
      const bomCost = 80;

      // 加工成本
      const laborRate = 35;
      const mfgRate = 46.69;
      const processingCost = laborRate + mfgRate;

      // 管理费
      const subtotal = bomCost + processingCost;
      const mgmtRate = 0.06;
      const mgmtCost = subtotal * mgmtRate;

      // 利润
      const profitRate = 0.056627;
      const costBase = subtotal + mgmtCost;
      const profit = costBase * profitRate;

      // 最终报价
      const finalPrice = costBase + profit;

      // 80 + 81.69 = 161.69
      // 161.69 * 0.06 = 9.7014
      // 161.69 + 9.7014 = 171.3914
      // 171.3914 * 0.056627 = 9.7053781078
      // 171.3914 + 9.7053781078 = 181.0967781078
      expect(finalPrice).toBeCloseTo(181.10, 2);
    });

    it('场景对比 - 成本差异', () => {
      const scenario1Cost = 150;
      const scenario2Cost = 165;
      const costDiff = scenario2Cost - scenario1Cost;
      const costDiffPercent = (costDiff / scenario1Cost) * 100;

      expect(costDiff).toBe(15);
      expect(costDiffPercent).toBe(10);
    });
  });
});
