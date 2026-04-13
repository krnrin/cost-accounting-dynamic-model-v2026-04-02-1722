/**
 * C10: bom_diff.ts 增强测试
 * 测试 useBomDiff hook 依赖的底层引擎
 */
import { describe, it, expect } from 'vitest';
import { diffBom } from '../bom_diff';

// ─── Fixtures ─────────────────────────────────────────────────────────

const oldBom = [
  { partNo: 'P001', partName: '铜端子 A', qty: 10, unitPrice: 1.5, totalCost: 15, category: 'terminal' },
  { partNo: 'P002', partName: '铝导线 B', qty: 20, unitPrice: 0.8, totalCost: 16, category: 'wire' },
  { partNo: 'P003', partName: '护套 C', qty: 5, unitPrice: 3.0, totalCost: 15, category: 'housing' },
];

const newBom = [
  { partNo: 'P001', partName: '铜端子 A', qty: 12, unitPrice: 1.5, totalCost: 18, category: 'terminal' }, // modified: qty 10→12
  // P002 removed
  { partNo: 'P003', partName: '护套 C', qty: 5, unitPrice: 3.0, totalCost: 15, category: 'housing' },   // unchanged
  { partNo: 'P004', partName: '密封件 D', qty: 8, unitPrice: 2.0, totalCost: 16, category: 'seal' },     // added
];

// ─── Tests ────────────────────────────────────────────────────────────

describe('diffBom', () => {
  it('should detect added, removed, modified, and unchanged items', () => {
    const result = diffBom(oldBom, newBom);
    expect(result.summary.added).toBe(1);     // P004
    expect(result.summary.removed).toBe(1);   // P002
    expect(result.summary.modified).toBe(1);  // P001
    expect(result.summary.unchanged).toBe(1); // P003
  });

  it('should sort rows by changeType priority', () => {
    const result = diffBom(oldBom, newBom);
    const types = result.rows.map(r => r.changeType);
    // added first, then removed, then modified, then unchanged
    expect(types.indexOf('added')).toBeLessThan(types.indexOf('unchanged'));
  });

  it('should compute cost impact per row', () => {
    const result = diffBom(oldBom, newBom);
    const p001 = result.rows.find(r => r.partNo === 'P001');
    expect(p001).toBeDefined();
    // qty changed 10→12 at 1.5 → cost 15→18 → impact +3
    expect(p001!.costImpact).toBeCloseTo(3, 1);
  });

  it('should compute total cost impact in summary', () => {
    const result = diffBom(oldBom, newBom);
    // P001: +3, P002: -16 (removed), P004: +16 (added)
    expect(result.summary.totalCostImpact).toBeCloseTo(3, 1);
  });

  it('should include field changes for modified items', () => {
    const result = diffBom(oldBom, newBom);
    const p001 = result.rows.find(r => r.partNo === 'P001');
    expect(p001!.fieldChanges.length).toBeGreaterThan(0);
    const qtyChange = p001!.fieldChanges.find(fc => fc.field === 'qty');
    expect(qtyChange).toBeDefined();
    expect(qtyChange!.oldValue).toBe(10);
    expect(qtyChange!.newValue).toBe(12);
  });

  it('should handle empty BOMs', () => {
    const result = diffBom([], []);
    expect(result.rows).toHaveLength(0);
    expect(result.summary.totalCostImpact).toBe(0);
  });

  it('should handle old empty → new has items (all added)', () => {
    const result = diffBom([], newBom);
    expect(result.summary.added).toBe(newBom.length);
    expect(result.summary.removed).toBe(0);
  });

  it('should handle new empty → all removed', () => {
    const result = diffBom(oldBom, []);
    expect(result.summary.removed).toBe(oldBom.length);
    expect(result.summary.added).toBe(0);
  });
});
