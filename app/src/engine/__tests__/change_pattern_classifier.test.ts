import { describe, expect, it } from 'vitest';
import {
  classifyChangePatterns,
  type ClassifyHint,
} from '@/engine/change_pattern_classifier';
import type { BomChangeDetectionResult, BomRowChange } from '@/engine/change_detector';

function detection(changes: BomRowChange[]): BomChangeDetectionResult {
  return {
    harnessId: 'H1',
    harnessName: 'Harness 1',
    sheetName: 'H1',
    hasChanges: changes.length > 0,
    changes,
    summary: 'changed',
    affectedEndGroups: ['FG1'],
    detectedAt: '2026-04-12T00:00:00.000Z',
  };
}

describe('change_pattern_classifier', () => {
  it('classifies wire_spec_replace for matching wire remove/add pairs', () => {
    const removed: BomRowChange = {
      changeType: 'removed',
      partNo: 'OLD-1',
      partName: '导线 0.5mm²',
      rowKey: 'H1::bom::1::OLD-1',
      rowIndex: 0,
      functionText: 'FG1',
      unit: 'M',
      supplier: 'S1',
      itemCategory: 'wire',
      fieldChanges: [],
    };
    const added: BomRowChange = {
      changeType: 'added',
      partNo: 'NEW-1',
      partName: '导线 0.75mm²',
      rowKey: 'H1::bom::1::NEW-1',
      rowIndex: 0,
      functionText: 'FG1',
      unit: 'M',
      supplier: 'S1',
      itemCategory: 'wire',
      fieldChanges: [],
    };
    const hints = new Map<string, ClassifyHint>([
      ['OLD-1', { rowIndex: 0, endGroup: 'FG1', category: 'wire', unit: 'M', supplier: 'S1', functionText: 'FG1' }],
      ['NEW-1', { rowIndex: 0, endGroup: 'FG1', category: 'wire', unit: 'M', supplier: 'S1', functionText: 'FG1' }],
    ]);

    const result = classifyChangePatterns(detection([removed, added]), hints);
    expect(result[0]?.pattern).toBe('wire_spec_replace');
  });

  it('classifies qty_explode when quantity jumps sharply', () => {
    const qtyChange: BomRowChange = {
      changeType: 'modified',
      partNo: 'P1',
      partName: 'Part 1',
      rowKey: 'H1::bom::1::P1',
      rowIndex: 0,
      functionText: 'FG1',
      fieldChanges: [{ field: 'qty', before: 1, after: 5 }],
    };

    const result = classifyChangePatterns(detection([qtyChange]), new Map());
    expect(result[0]?.pattern).toBe('qty_explode');
  });

  it('classifies split when one assembly becomes multiple components', () => {
    const removed: BomRowChange = {
      changeType: 'removed',
      partNo: 'ASSY-1',
      partName: 'Assembly',
      rowKey: 'H1::bom::1::ASSY-1',
      rowIndex: 0,
      functionText: 'FG1',
      unit: 'SET',
      itemCategory: 'other',
      fieldChanges: [],
    };
    const addA: BomRowChange = {
      changeType: 'added',
      partNo: 'CMP-1',
      partName: 'Component A',
      rowKey: 'H1::bom::2::CMP-1',
      rowIndex: 1,
      functionText: 'FG1',
      unit: 'PCS',
      itemCategory: 'other',
      fieldChanges: [],
    };
    const addB: BomRowChange = {
      changeType: 'added',
      partNo: 'CMP-2',
      partName: 'Component B',
      rowKey: 'H1::bom::3::CMP-2',
      rowIndex: 2,
      functionText: 'FG1',
      unit: 'PCS',
      itemCategory: 'other',
      fieldChanges: [],
    };
    const hints = new Map<string, ClassifyHint>([
      ['ASSY-1', { rowIndex: 0, endGroup: 'FG1', unit: 'SET', functionText: 'FG1' }],
      ['CMP-1', { rowIndex: 1, endGroup: 'FG1', unit: 'PCS', functionText: 'FG1' }],
      ['CMP-2', { rowIndex: 2, endGroup: 'FG1', unit: 'PCS', functionText: 'FG1' }],
    ]);

    const result = classifyChangePatterns(detection([removed, addA, addB]), hints);
    expect(result[0]?.pattern).toBe('split');
  });
});
