/**
 * snapshot_integration 单元测试
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock db
const mockScenario = {
  scenarioId: 'sc-001',
  scenarioName: '测试场景',
  scenarioCode: 'E281-T01',
  projectId: 'proj-001',
  lifecycleYears: 7,
  frozenAt: null,
  updatedAt: '2026-04-01T00:00:00Z',
};

const mockHarness = {
  harnessId: 'h-001',
  harnessName: 'Main Harness',
  scenarioId: 'sc-001',
  result: {
    materialCost: 120.5,
    processCost: 30.2,
    exFactoryPrice: 180.3,
    deliveredPrice: 195.8,
    copperWeight: 2.5,
    aluminumWeight: 0.3,
  },
  input: {},
  eopYear: 2032,
};

const mockDb = {
  scenarios: {
    get: vi.fn().mockResolvedValue(mockScenario),
    update: vi.fn().mockResolvedValue(1),
  },
  harnesses: {
    where: vi.fn().mockReturnValue({
      equals: vi.fn().mockReturnValue({
        toArray: vi.fn().mockResolvedValue([mockHarness]),
      }),
    }),
  },
  table: vi.fn().mockReturnValue({
    add: vi.fn().mockResolvedValue(undefined),
    get: vi.fn().mockResolvedValue(undefined),
  }),
};

vi.mock('@/data/db', () => ({ db: mockDb }));
vi.mock('../quote_snapshot', () => ({
  createQuoteSnapshot: vi.fn().mockResolvedValue({
    id: 'qs-001',
    version: 1,
    label: '冻结快照 v1',
    createdAt: '2026-04-13T10:00:00Z',
  }),
  loadQuoteSnapshots: vi.fn().mockResolvedValue([]),
  compareQuoteSnapshots: vi.fn(),
}));

import {
  createFreezeSnapshot,
  getSnapshotChain,
  restoreFromSnapshot,
  getScenarioSnapshotHistory,
} from '../snapshot_integration';

describe('snapshot_integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createFreezeSnapshot', () => {
    it('应创建参数快照和报价快照', async () => {
      const chain = await createFreezeSnapshot('sc-001', {
        costRates: { wasteRate: 0.01, mgmtRate: 0.06, profitRate: 0.056627 } as any,
        metalPrices: { copper: 72000, aluminum: 19000 } as any,
        annualDropRate: 0.03,
      });

      expect(chain.scenarioId).toBe('sc-001');
      expect(chain.settingsSnapshotId).toMatch(/^snap-/);
      expect(chain.quoteSnapshotId).toBe('qs-001');
      expect(chain.frozenAt).toBeDefined();

      // 应写入 settingsSnapshots
      expect(mockDb.table).toHaveBeenCalledWith('settingsSnapshots');

      // 应更新场景元数据
      expect(mockDb.scenarios.update).toHaveBeenCalledWith(
        'sc-001',
        expect.objectContaining({
          settingsSnapshotId: chain.settingsSnapshotId,
        })
      );
    });

    it('场景不存在时应抛出错误', async () => {
      mockDb.scenarios.get.mockResolvedValueOnce(undefined);

      await expect(
        createFreezeSnapshot('sc-999', {
          costRates: {} as any,
          metalPrices: {} as any,
        })
      ).rejects.toThrow('场景 sc-999 不存在');
    });

    it('无线束结果时不创建报价快照', async () => {
      mockDb.harnesses.where.mockReturnValueOnce({
        equals: vi.fn().mockReturnValue({
          toArray: vi.fn().mockResolvedValue([{ ...mockHarness, result: null }]),
        }),
      });

      const chain = await createFreezeSnapshot('sc-001', {
        costRates: {} as any,
        metalPrices: {} as any,
      });

      expect(chain.quoteSnapshotId).toBeNull();
    });
  });

  describe('getSnapshotChain', () => {
    it('场景无快照时返回 null', async () => {
      const result = await getSnapshotChain('sc-001');
      expect(result).toBeNull();
    });
  });

  describe('restoreFromSnapshot', () => {
    it('快照不存在时返回 null', async () => {
      const result = await restoreFromSnapshot('non-existent');
      expect(result).toBeNull();
    });
  });

  describe('getScenarioSnapshotHistory', () => {
    it('应返回空数组当无快照', async () => {
      const history = await getScenarioSnapshotHistory('sc-001');
      expect(history.settings).toEqual([]);
      expect(history.quotes).toEqual([]);
    });
  });
});
