import { describe, expect, it } from 'vitest';
import { writeChangeHistory } from '@/engine/change_history_writer';
import type { ChangeHistoryRow } from '@/types/bomWorkbook';
import type { BomChangeDetectionResult } from '@/engine/change_detector';
import type { SemanticChange } from '@/engine/change_pattern_classifier';
import type { CascadeAction } from '@/engine/cascade_impact';

function mockDetection(): BomChangeDetectionResult {
  return {
    harnessId: 'H-01',
    harnessName: 'Harness 01',
    sheetName: 'BOM-H-01',
    hasChanges: true,
    summary: 'BOM-H-01: added 1, modified 1',
    affectedEndGroups: ['FG1'],
    detectedAt: new Date().toISOString(),
    changes: [
      {
        changeType: 'added',
        partNo: 'P-NEW',
        partName: 'New Part',
        rowKey: 'H-01::bom::3::P-NEW',
        rowIndex: 3,
        fieldChanges: [{ field: 'qty', before: null, after: 1 }],
      },
    ],
  };
}

describe('change_history_writer', () => {
  it('generates next sequence from persisted history rows', () => {
    const existingRows: ChangeHistoryRow[] = [
      {
        rowKey: 'history::H-01::1',
        sheetType: 'change_history',
        seqNo: 1,
        packageName: 'pkg',
        harnessPartNo: 'H-01',
        partName: 'A',
        changeDescription: 'x',
        changeDate: '2026-01-01 10:00:00',
      },
      {
        rowKey: 'history::H-01::3',
        sheetType: 'change_history',
        seqNo: 3,
        packageName: 'pkg',
        harnessPartNo: 'H-01',
        partName: 'B',
        changeDescription: 'y',
        changeDate: '2026-01-01 10:05:00',
      },
    ];

    const semanticChanges: SemanticChange[] = [
      {
        pattern: 'simple_add',
        description: 'Add P-NEW',
        relatedChanges: [],
        confidence: 0.8,
      },
    ];
    const cascadeActions: CascadeAction[] = [
      { targetSheet: 'ksk_bom', actionType: 'add', data: {} },
      { targetSheet: 'secondary_material', actionType: 'update', rowKey: 'r1', data: {} },
    ];

    const action = writeChangeHistory(mockDetection(), semanticChanges, cascadeActions, existingRows);
    expect(action.targetSheet).toBe('change_history');
    expect(action.actionType).toBe('add');
    const rows = action.data.rows as ChangeHistoryRow[];
    expect(rows).toHaveLength(1);
    expect(rows[0].seqNo).toBe(4);
    expect(rows[0].remark).toContain('ksk_bom:1');
    expect(rows[0].remark).toContain('secondary_material:1');
  });
});

