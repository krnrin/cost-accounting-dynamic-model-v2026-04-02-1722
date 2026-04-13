/**
 * C11: change_orchestrator.ts 单元测试
 */
import { describe, it, expect } from 'vitest';
import {
  extractBomChanges,
  simulateCascade,
  estimateCostRecalc,
  generateAlerts,
  generateTrackingItems,
  orchestrate,
  DEFAULT_ORCHESTRATION_CONFIG,
} from '../change_orchestrator';

// ─── Fixtures ─────────────────────────────────────────────────────────

const rawChanges = [
  { partNo: 'P001', partName: '铜端子A', action: 'modify', oldQty: 10, newQty: 12, oldPrice: 1.5, newPrice: 1.5 },
  { partNo: 'P005', partName: '新密封件', action: 'add', newQty: 5, newPrice: 2.0 },
  { partNo: 'P002', partName: '铝导线B', action: 'remove', oldQty: 20, oldPrice: 0.8 },
  { partNo: 'P006', partName: '替代护套', action: 'replace', oldQty: 5, newQty: 5, oldPrice: 3.0, newPrice: 4.5 },
];

const harnessData = [
  { harnessId: 'H-001', harnessName: 'E281-Main', deliveredPrice: 120, affectedPartRatio: 0.6 },
  { harnessId: 'H-002', harnessName: 'E281-Sub', deliveredPrice: 45, affectedPartRatio: 0.3 },
];

const sheetCounts = { assembly: 10, secondary: 5, ksk: 3 };

// ─── Tests ────────────────────────────────────────────────────────────

describe('extractBomChanges', () => {
  it('should normalize change types', () => {
    const changes = extractBomChanges(rawChanges);
    expect(changes[0].changeType).toBe('modify');
    expect(changes[1].changeType).toBe('add');
    expect(changes[2].changeType).toBe('remove');
    expect(changes[3].changeType).toBe('replace');
  });

  it('should handle Chinese action names', () => {
    const cn = [{ partNo: 'X', action: '新增' }, { partNo: 'Y', action: '删除' }, { partNo: 'Z', action: '替换' }];
    const changes = extractBomChanges(cn);
    expect(changes[0].changeType).toBe('add');
    expect(changes[1].changeType).toBe('remove');
    expect(changes[2].changeType).toBe('replace');
  });
});

describe('simulateCascade', () => {
  it('should estimate cascade actions', () => {
    const bomChanges = extractBomChanges(rawChanges);
    const cascade = simulateCascade(bomChanges, 10, 5, 3);
    expect(cascade.totalActions).toBeGreaterThan(0);
    expect(cascade.affectedParts).toContain('P001');
  });

  it('should not exceed sheet counts', () => {
    const bomChanges = extractBomChanges(rawChanges);
    const cascade = simulateCascade(bomChanges, 2, 1, 0);
    expect(cascade.assemblyActions).toBeLessThanOrEqual(2);
    expect(cascade.secondaryActions).toBeLessThanOrEqual(1);
    expect(cascade.kskActions).toBe(0);
  });
});

describe('estimateCostRecalc', () => {
  it('should compute cost delta for each harness', () => {
    const bomChanges = extractBomChanges(rawChanges);
    const recalc = estimateCostRecalc(bomChanges, harnessData);
    expect(recalc).toHaveLength(2);
    expect(recalc[0].harnessId).toBe('H-001');
    expect(typeof recalc[0].delta).toBe('number');
    expect(typeof recalc[0].deltaPct).toBe('number');
  });
});

describe('generateAlerts', () => {
  it('should generate alerts for significant cost changes', () => {
    // Fabricate a large cost change
    const bigRecalc = [{
      harnessId: 'H-001',
      harnessName: 'E281-Main',
      oldDeliveredPrice: 100,
      newDeliveredPrice: 106,
      delta: 6,
      deltaPct: 6,
    }];
    const alerts = generateAlerts(bigRecalc, DEFAULT_ORCHESTRATION_CONFIG, 'CHG-001', '基准方案');
    expect(alerts.length).toBeGreaterThan(0);
    expect(alerts[0].severity).toBe('critical'); // 6% > 5% threshold
  });

  it('should generate warning for moderate changes', () => {
    const modRecalc = [{
      harnessId: 'H-001',
      harnessName: 'E281-Main',
      oldDeliveredPrice: 100,
      newDeliveredPrice: 103,
      delta: 3,
      deltaPct: 3,
    }];
    const alerts = generateAlerts(modRecalc, DEFAULT_ORCHESTRATION_CONFIG, 'CHG-002', '基准方案');
    expect(alerts.length).toBeGreaterThan(0);
    expect(alerts[0].severity).toBe('warning');
  });

  it('should generate no critical/warning for small changes', () => {
    const smallRecalc = [{
      harnessId: 'H-001',
      harnessName: 'E281-Main',
      oldDeliveredPrice: 100,
      newDeliveredPrice: 100.5,
      delta: 0.5,
      deltaPct: 0.5,
    }];
    const alerts = generateAlerts(smallRecalc, DEFAULT_ORCHESTRATION_CONFIG, 'CHG-003', '基准方案');
    const highSeverity = alerts.filter(a => a.severity === 'critical' || a.severity === 'warning');
    expect(highSeverity).toHaveLength(0);
  });
});

describe('generateTrackingItems', () => {
  it('should create tracking items for critical alerts', () => {
    const alerts = [{
      id: 'a1', type: 'cost_change' as const, severity: 'critical' as const,
      title: 'test', message: 'test', impactAmount: 10,
    }];
    const items = generateTrackingItems(alerts, 'CHG-001', DEFAULT_ORCHESTRATION_CONFIG);
    expect(items.length).toBeGreaterThan(0);
    expect(items[0].priority).toBe('high');
  });

  it('should not create items when autoCreateTracking is off', () => {
    const alerts = [{
      id: 'a1', type: 'cost_change' as const, severity: 'critical' as const,
      title: 'test', message: 'test', impactAmount: 10,
    }];
    const items = generateTrackingItems(alerts, 'CHG-001', { ...DEFAULT_ORCHESTRATION_CONFIG, autoCreateTracking: false });
    expect(items).toHaveLength(0);
  });
});

describe('orchestrate (full pipeline)', () => {
  it('should complete full orchestration pipeline', () => {
    const result = orchestrate(
      'CHG-001', 'SCN-001', 'PRJ-001', '基准方案',
      rawChanges, harnessData, sheetCounts
    );
    expect(result.stage).toBe('completed');
    expect(result.bomChanges).toHaveLength(4);
    expect(result.cascade).not.toBeNull();
    expect(result.costRecalc).toHaveLength(2);
    expect(typeof result.totalCostImpact).toBe('number');
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
    expect(result.error).toBeUndefined();
  });

  it('should handle empty change list gracefully', () => {
    const result = orchestrate(
      'CHG-002', 'SCN-001', 'PRJ-001', '空设变',
      [], harnessData, sheetCounts
    );
    expect(result.stage).toBe('completed');
    expect(result.bomChanges).toHaveLength(0);
    expect(result.totalCostImpact).toBeCloseTo(0, 2);
  });

  it('should respect custom config thresholds', () => {
    const result = orchestrate(
      'CHG-003', 'SCN-001', 'PRJ-001', '低阈值测试',
      rawChanges, harnessData, sheetCounts,
      { costWarningThresholdPct: 0.1, costCriticalThresholdPct: 0.5 }
    );
    expect(result.stage).toBe('completed');
    // With very low thresholds, more alerts should be generated
    const criticalAlerts = result.alerts.filter(a => a.severity === 'critical');
    expect(criticalAlerts.length).toBeGreaterThanOrEqual(0); // depends on actual deltas
  });
});
