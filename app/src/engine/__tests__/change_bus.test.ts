import { describe, expect, it } from 'vitest';
import { ChangeBus } from '@/engine/change_bus';
import type { BomChangeDetectionResult } from '@/engine/change_detector';

function detection(partNo: string): BomChangeDetectionResult {
  return {
    harnessId: 'H1',
    harnessName: 'Harness 1',
    sheetName: 'BOM-H1',
    hasChanges: true,
    summary: 'changed',
    affectedEndGroups: ['FG1'],
    detectedAt: new Date().toISOString(),
    changes: [
      {
        changeType: 'modified',
        partNo,
        partName: `Part ${partNo}`,
        rowKey: `H1::bom::1::${partNo}`,
        rowIndex: 1,
        fieldChanges: [{ field: 'qty', before: 1, after: 2 }],
        functionText: 'FG1',
        endGroup: 'FG1',
        unit: 'PCS',
        supplier: 'S1',
        itemCategory: 'other',
      },
    ],
  };
}

describe('ChangeBus', () => {
  it('isolates scope by project/scenario/harness and partNo', () => {
    const bus = new ChangeBus();
    bus.rebuildIndex([
      {
        projectId: 'P1',
        scenarioId: 'S1',
        harnessId: 'H1',
        sheetType: 'bom',
        sheetId: 'bom-sheet',
        sheetName: 'BOM',
        partNo: 'A-100',
        rowIndex: 2,
      },
      {
        projectId: 'P1',
        scenarioId: 'S1',
        harnessId: 'H1',
        sheetType: 'ksk_bom',
        sheetId: 'ksk-sheet',
        sheetName: 'KSK',
        partNo: 'A-100',
        rowIndex: 8,
      },
      {
        projectId: 'P1',
        scenarioId: 'S1',
        harnessId: 'H2',
        sheetType: 'ksk_bom',
        sheetId: 'ksk-other-harness',
        sheetName: 'KSK-H2',
        partNo: 'A-100',
        rowIndex: 3,
      },
      {
        projectId: 'P2',
        scenarioId: 'S1',
        harnessId: 'H1',
        sheetType: 'ksk_bom',
        sheetId: 'ksk-other-project',
        sheetName: 'KSK-P2',
        partNo: 'A-100',
        rowIndex: 1,
      },
    ]);

    const { targets } = bus.emit({
      projectId: 'P1',
      scenarioId: 'S1',
      harnessId: 'H1',
      sourceSheet: 'bom',
      sourceSheetId: 'bom-sheet',
      sourceSheetName: 'BOM',
      detection: detection('A-100'),
    });

    expect(targets).toHaveLength(1);
    expect(targets[0].targetSheet).toBe('ksk_bom');
    expect(targets[0].targetSheetId).toBe('ksk-sheet');
    expect(targets[0].matchedPartNos).toEqual(['A-100']);
  });
});

