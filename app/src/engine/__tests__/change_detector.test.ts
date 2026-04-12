import { describe, expect, it } from 'vitest';
import type { BomSheetRow } from '@/types/bomWorkbook';
import { detectBomChanges } from '@/engine/change_detector';

function row(overrides: Partial<BomSheetRow>): BomSheetRow {
  return {
    rowKey: 'H1::bom::1::P1',
    sheetType: 'bom',
    harnessId: 'H1',
    harnessName: 'Harness 1',
    seqNo: 1,
    functionText: 'FG1',
    partNo: 'P1',
    partName: 'Part 1',
    isSemiFinished: false,
    qty: 1,
    unit: 'PCS',
    itemCategory: 'other',
    unitPrice: 10,
    amount: 10,
    ...overrides,
  };
}

describe('detectBomChanges', () => {
  it('does not treat pure row reorder as add/remove', () => {
    const before = [row({ rowKey: 'H1::bom::1::P1', partNo: 'P1' }), row({ rowKey: 'H1::bom::2::P2', partNo: 'P2' })];
    const after = [row({ rowKey: 'H1::bom::2::P2', partNo: 'P2' }), row({ rowKey: 'H1::bom::1::P1', partNo: 'P1' })];

    const result = detectBomChanges('H1', 'Harness 1', 'BOM-H1', before, after);
    expect(result.hasChanges).toBe(false);
    expect(result.changes).toHaveLength(0);
  });

  it('detects modify/add/remove with summary', () => {
    const before = [row({ rowKey: 'H1::bom::1::P1', partNo: 'P1', qty: 1 }), row({ rowKey: 'H1::bom::2::P2', partNo: 'P2' })];
    const after = [row({ rowKey: 'H1::bom::1::P1', partNo: 'P1', qty: 3 }), row({ rowKey: 'H1::bom::3::P3', partNo: 'P3' })];

    const result = detectBomChanges('H1', 'Harness 1', 'BOM-H1', before, after);
    expect(result.hasChanges).toBe(true);
    expect(result.changes.some(change => change.changeType === 'modified' && change.partNo === 'P1')).toBe(true);
    expect(result.changes.some(change => change.changeType === 'removed' && change.partNo === 'P2')).toBe(true);
    expect(result.changes.some(change => change.changeType === 'added' && change.partNo === 'P3')).toBe(true);
    expect(result.summary).toContain('added 1');
    expect(result.summary).toContain('removed 1');
    expect(result.summary).toContain('modified 1');
  });
});

