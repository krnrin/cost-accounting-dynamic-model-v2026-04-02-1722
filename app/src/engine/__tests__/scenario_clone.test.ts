/**
 * C8: scenario_clone.ts 单元测试
 */
import { describe, it, expect } from 'vitest';
import {
  cloneScenario,
  quickClone,
  createWhatIfScenario,
  validateClone,
} from '../scenario_clone';
import type { Scenario } from '@/types/harness';

// ─── Fixtures ─────────────────────────────────────────────────────────

const baseBom = [
  { partNo: 'P001', partName: '铜端子', qty: 10, unitPrice: 1.5, totalCost: 15 },
  { partNo: 'P002', partName: '铝导线', qty: 20, unitPrice: 0.8, totalCost: 16 },
];

const baseHarness = {
  id: 'H-001',
  name: 'E281-Main',
  projectId: 'PRJ-001',
  bom: baseBom,
  wires: [],
  assemblySteps: [],
  settings: { laborRate: 45, overheadPct: 8, scrapPct: 2 },
};

const baseScenario: Scenario = {
  id: 'SCN-001',
  name: '基准方案',
  projectId: 'PRJ-001',
  status: 'draft',
  harnesses: [baseHarness],
  createdAt: '2026-04-01T00:00:00Z',
  updatedAt: '2026-04-01T00:00:00Z',
};

// ─── Tests ────────────────────────────────────────────────────────────

describe('cloneScenario', () => {
  it('should deep clone a scenario with new id and name', () => {
    const cloned = cloneScenario(baseScenario, '基准方案-副本');
    expect(cloned.id).not.toBe(baseScenario.id);
    expect(cloned.name).toBe('基准方案-副本');
    expect(cloned.status).toBe('draft');
    expect(cloned.harnesses).toHaveLength(1);
    // Deep clone check: modifying clone should not affect original
    cloned.harnesses[0].bom[0].qty = 999;
    expect(baseScenario.harnesses[0].bom[0].qty).toBe(10);
  });

  it('should preserve all BOM items', () => {
    const cloned = cloneScenario(baseScenario);
    expect(cloned.harnesses[0].bom).toHaveLength(2);
    expect(cloned.harnesses[0].bom[0].partNo).toBe('P001');
    expect(cloned.harnesses[0].bom[1].partNo).toBe('P002');
  });

  it('should generate new harness ids', () => {
    const cloned = cloneScenario(baseScenario);
    expect(cloned.harnesses[0].id).not.toBe(baseHarness.id);
  });
});

describe('quickClone', () => {
  it('should clone with auto-generated name', () => {
    const cloned = quickClone(baseScenario);
    expect(cloned.name).toContain('基准方案');
    expect(cloned.name).toContain('副本');
  });
});

describe('createWhatIfScenario', () => {
  it('should create a what-if with overrides applied', () => {
    const whatIf = createWhatIfScenario(baseScenario, 'What-if 涨价10%', {
      priceFactor: 1.1,
    });
    expect(whatIf.name).toBe('What-if 涨价10%');
    expect(whatIf.status).toBe('draft');
  });
});

describe('validateClone', () => {
  it('should return valid for a properly cloned scenario', () => {
    const cloned = cloneScenario(baseScenario);
    const result = validateClone(baseScenario, cloned);
    expect(result.valid).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  it('should detect if ids are the same (bad clone)', () => {
    const badClone = { ...baseScenario }; // shallow copy, same id
    const result = validateClone(baseScenario, badClone);
    expect(result.valid).toBe(false);
    expect(result.issues.length).toBeGreaterThan(0);
  });
});
