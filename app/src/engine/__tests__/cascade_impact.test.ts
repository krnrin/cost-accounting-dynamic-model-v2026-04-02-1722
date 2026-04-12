import { describe, expect, it } from 'vitest';
import { computeKskImpact } from '@/engine/cascade_impact';
import type { BomRowChange } from '@/engine/change_detector';
import type { SemanticChange } from '@/engine/change_pattern_classifier';
import type { KskBomRow } from '@/types/bomWorkbook';

describe('cascade_impact', () => {
  it('applies semantic replace first for KSK rows', () => {
    const rows: KskBomRow[] = [
      {
        rowKey: 'H1::ksk::1::OLD-1',
        sheetType: 'ksk_bom',
        partNo: 'OLD-1',
        partName: 'Old Part',
        qty: 1,
        unit: 'PCS',
      },
    ];
    const changes: BomRowChange[] = [
      {
        changeType: 'removed',
        partNo: 'OLD-1',
        partName: 'Old Part',
        rowKey: 'H1::bom::1::OLD-1',
        rowIndex: 1,
        fieldChanges: [],
      },
      {
        changeType: 'added',
        partNo: 'NEW-1',
        partName: 'New Part',
        rowKey: 'H1::bom::1::NEW-1',
        rowIndex: 1,
        fieldChanges: [
          { field: 'qty', before: null, after: 2 },
          { field: 'supplier', before: null, after: 'S2' },
        ],
      },
    ];
    const semantic: SemanticChange[] = [
      {
        pattern: 'replace',
        description: 'OLD-1 -> NEW-1',
        relatedChanges: [changes[0], changes[1]],
        confidence: 0.9,
      },
    ];

    const result = computeKskImpact(changes, semantic, rows);
    expect(result.actions).toHaveLength(1);
    expect(result.actions[0].actionType).toBe('update');
    expect(result.actions[0].rowKey).toBe('H1::ksk::1::OLD-1');
    expect(result.actions[0].data.partNo).toBe('NEW-1');
    expect(result.preview[0].cells[0]).toContain('OLD-1 -> NEW-1');
  });
});

