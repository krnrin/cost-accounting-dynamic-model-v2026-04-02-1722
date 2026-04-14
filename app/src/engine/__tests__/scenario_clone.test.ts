/**
 * C8: scenario_clone.ts 单元测试
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { db } from '@/data/db';
import {
  cloneScenario,
  quickClone,
  createWhatIfScenario,
  validateClone,
} from '../scenario_clone';

vi.mock('@/data/db', () => {
  const mockDbData = {
    scenarios: [] as any[],
    harnesses: [] as any[],
    bomItems: [] as any[],
    wireItems: [] as any[],
  };

  const createMockTable = (getStore: () => any[]) => ({
    get: vi.fn(async (id: string) => getStore().find((r) => r.id === id)),
    add: vi.fn(async (record: any) => {
      getStore().push(record);
      return record.id;
    }),
    where: vi.fn((field: string) => ({
      equals: vi.fn((value: any) => ({
        toArray: vi.fn(async () => getStore().filter((r) => r[field] === value)),
      })),
    })),
  });

  const mockDb = {
    scenarios: createMockTable(() => mockDbData.scenarios),
    harnesses: createMockTable(() => mockDbData.harnesses),
    bomItems: createMockTable(() => mockDbData.bomItems),
    wireItems: createMockTable(() => mockDbData.wireItems),
    transaction: vi.fn(async (_mode: any, _tables: any, callback: () => Promise<any>) => callback()),
    _data: mockDbData,
  };

  return { db: mockDb };
});

// ─── Fixtures ─────────────────────────────────────────────────────────

const baseScenario = {
  id: 'SCN-001',
  scenarioName: '基准方案',
  projectId: 'PRJ-001',
  status: 'draft',
  createdAt: '2026-04-01T00:00:00Z',
  updatedAt: '2026-04-01T00:00:00Z',
};

const baseHarness = {
  id: 'H-001',
  harnessId: 'H-001',
  harnessName: 'E281-Main',
  projectId: 'PRJ-001',
  scenarioId: 'SCN-001',
  input: {} as any,
  eopYear: null,
  updatedAt: '2026-04-01T00:00:00Z',
};

const baseBomItems = [
  { id: 'BOM-001', harnessId: 'H-001', scenarioId: 'SCN-001', partNo: 'P001', partName: '铜端子', qty: 10 },
  { id: 'BOM-002', harnessId: 'H-001', scenarioId: 'SCN-001', partNo: 'P002', partName: '铝导线', qty: 20 },
];

const baseWireItems = [
  { id: 'WIRE-001', harnessId: 'H-001', scenarioId: 'SCN-001', gauge: '0.5mm2', length: 100 },
];

function seedDb(data: any) {
  data.scenarios = [{ ...baseScenario }];
  data.harnesses = [{ ...baseHarness }];
  data.bomItems = baseBomItems.map((b) => ({ ...b }));
  data.wireItems = baseWireItems.map((w) => ({ ...w }));
}

function clearDb(data: any) {
  data.scenarios = [];
  data.harnesses = [];
  data.bomItems = [];
  data.wireItems = [];
}

// ─── Tests ────────────────────────────────────────────────────────────

describe('cloneScenario', () => {
  beforeEach(() => {
    const data = (db as any)._data;
    clearDb(data);
    seedDb(data);
  });

  it('should deep clone a scenario with new id and name', async () => {
    const result = await cloneScenario('SCN-001', { name: '基准方案-副本' });
    expect(result.scenarioId).not.toBe('SCN-001');
    expect(result.scenarioName).toBe('基准方案-副本');
    expect(result.sourceScenarioId).toBe('SCN-001');
    const data = (db as any)._data;
    const newScenario = data.scenarios.find((s: any) => s.id === result.scenarioId);
    expect(newScenario).toBeDefined();
    expect(newScenario.scenarioName).toBe('基准方案-副本');
    expect(newScenario.status).toBe('draft');
  });

  it('should preserve all BOM items', async () => {
    const result = await cloneScenario('SCN-001', { name: '基准方案-副本' });
    expect(result.stats.bomItemCount).toBe(2);
    const data = (db as any)._data;
    const clonedBom = data.bomItems.filter((b: any) => b.scenarioId === result.scenarioId);
    expect(clonedBom).toHaveLength(2);
    expect(clonedBom[0].partNo).toBe('P001');
    expect(clonedBom[1].partNo).toBe('P002');
  });

  it('should generate new harness ids', async () => {
    const result = await cloneScenario('SCN-001', { name: '基准方案-副本' });
    expect(result.stats.harnessCount).toBe(1);
    const data = (db as any)._data;
    const clonedHarness = data.harnesses.find((h: any) => h.scenarioId === result.scenarioId);
    expect(clonedHarness).toBeDefined();
    expect(clonedHarness.id).not.toBe('H-001');
  });
});

describe('quickClone', () => {
  beforeEach(() => {
    const data = (db as any)._data;
    clearDb(data);
    seedDb(data);
  });

  it('should clone with auto-generated name', async () => {
    const result = await quickClone('SCN-001');
    expect(result.scenarioName).toContain('基准方案');
    expect(result.scenarioName).toContain('副本');
    expect(result.sourceScenarioId).toBe('SCN-001');
  });
});

describe('createWhatIfScenario', () => {
  beforeEach(() => {
    const data = (db as any)._data;
    clearDb(data);
    seedDb(data);
  });

  it('should create a what-if with overrides applied', async () => {
    const result = await createWhatIfScenario('SCN-001', 'What-if 涨价10%');
    expect(result.scenarioName).toBe('What-if 涨价10%');
    const data = (db as any)._data;
    const newScenario = data.scenarios.find((s: any) => s.id === result.scenarioId);
    expect(newScenario).toBeDefined();
    expect(newScenario.status).toBe('draft');
  });
});

describe('validateClone', () => {
  beforeEach(() => {
    const data = (db as any)._data;
    clearDb(data);
    seedDb(data);
  });

  it('should return valid for a properly cloned scenario', async () => {
    const result = await validateClone('SCN-001', { name: '新方案' });
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should detect missing source scenario', async () => {
    const result = await validateClone('SCN-NOT-EXIST', { name: '新方案' });
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]).toContain('不存在');
  });
});
