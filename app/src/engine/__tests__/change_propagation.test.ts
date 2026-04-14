/**
 * change_propagation 单元测试
 */
import { describe, it, expect } from 'vitest';
import { computePropagation, createChangeEvent } from '../change_propagation';
import type { HarnessResult, HarnessInput } from '@/types/harness';
import type { CostRates } from '@/types/project';

const mockRates: CostRates = {
  wasteRate: 0.01,
  mgmtRate: 0.06,
  profitRate: 0.056627,
} as any;

const makeHarness = (id: string, deliveredPrice: number, materialCost: number) => ({
  harnessId: id,
  harnessName: `Harness ${id}`,
  input: {} as HarnessInput,
  result: {
    deliveredPrice,
    materialCost,
    processCost: 30,
    exFactoryPrice: deliveredPrice * 0.9,
    copperWeight: 2.5,
    aluminumWeight: 0.3,
    vehicleRatio: 0.5,
  } as HarnessResult,
});

describe('change_propagation', () => {
  describe('createChangeEvent', () => {
    it('应创建带正确字段的事件', () => {
      const event = createChangeEvent(
        'metal_price',
        'sc-001',
        'proj-001',
        { copper: 70000 },
        { copper: 75000 }
      );

      expect(event.id).toMatch(/^ce-/);
      expect(event.type).toBe('metal_price');
      expect(event.scenarioId).toBe('sc-001');
      expect(event.before).toEqual({ copper: 70000 });
      expect(event.after).toEqual({ copper: 75000 });
      expect(event.affectedHarnessIds).toBeNull();
    });
  });

  describe('computePropagation', () => {
    it('应计算 BOM 变更的级联影响', () => {
      const event = createChangeEvent(
        'bom_update',
        'sc-001',
        'proj-001',
        { materialCost: 100 },
        { materialCost: 110 }
      );

      const harnesses = [makeHarness('h1', 200, 100)];
      const result = computePropagation(event, harnesses, mockRates);

      expect(result.affectedCount).toBe(1);
      expect(result.impacts).toHaveLength(1);

      const impact = result.impacts[0];
      // 材料增加 10
      expect(impact.breakdown.deltaMaterialCost).toBeCloseTo(10, 2);
      // 废品 = 10 * 0.01 = 0.1
      expect(impact.breakdown.deltaWasteCost).toBeCloseTo(0.1, 2);
      // 管理费 = 10 * 0.06 = 0.6
      expect(impact.breakdown.deltaMgmtFee).toBeCloseTo(0.6, 2);
      // 所有三个变化后的利润
      expect(impact.breakdown.deltaProfit).toBeGreaterThan(0);
    });

    it('指定 affectedHarnessIds 时应只计算受影响的线束', () => {
      const event = createChangeEvent(
        'ecn',
        'sc-001',
        'proj-001',
        { materialCost: 100 },
        { materialCost: 120 },
        { affectedHarnessIds: ['h1'] }
      );

      const harnesses = [
        makeHarness('h1', 200, 100),
        makeHarness('h2', 300, 150),
      ];

      const result = computePropagation(event, harnesses, mockRates);
      expect(result.affectedCount).toBe(1);
      expect(result.impacts[0].harnessId).toBe('h1');
    });

    it('大变化应触发确认要求', () => {
      const event = createChangeEvent(
        'bom_update',
        'sc-001',
        'proj-001',
        { materialCost: 100 },
        { materialCost: 200 } // 100% 涨幅
      );

      const harnesses = [makeHarness('h1', 200, 100)];
      const result = computePropagation(event, harnesses, mockRates);

      expect(result.requiresConfirmation).toBe(true);
      expect(result.confirmReason).toBeDefined();
    });

    it('小变化不应触发确认要求', () => {
      const event = createChangeEvent(
        'bom_update',
        'sc-001',
        'proj-001',
        { materialCost: 100 },
        { materialCost: 100.5 } // 0.5% 涨幅
      );

      const harnesses = [makeHarness('h1', 200, 100)];
      const result = computePropagation(event, harnesses, mockRates);

      expect(result.requiresConfirmation).toBe(false);
    });
  });
});
