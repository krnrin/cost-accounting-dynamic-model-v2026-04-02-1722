import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CascadeConfirmWizard } from './CascadeConfirmWizard';
import type { BomChangeDetectionResult } from '@/engine/change_detector';
import type { ChangeHistoryRow } from '@/types/bomWorkbook';

function makeDetection(): BomChangeDetectionResult {
  return {
    harnessId: 'H-001',
    harnessName: 'Harness 001',
    sheetName: 'Harness 001',
    hasChanges: true,
    summary: 'Harness 001: added 1',
    affectedEndGroups: ['A'],
    detectedAt: '2026-04-12T12:00:00.000Z',
    changes: [
      {
        changeType: 'added',
        partNo: 'P-001',
        partName: 'Part 001',
        rowKey: 'bom::1',
        rowIndex: 1,
        fieldChanges: [
          { field: 'qty', before: null, after: 2 },
          { field: 'supplier', before: null, after: 'Supplier A' },
        ],
        functionText: 'A',
        supplier: 'Supplier A',
        itemCategory: 'other',
        unit: 'EA',
      },
    ],
  };
}

const existingHistoryRows: ChangeHistoryRow[] = [
  {
    rowKey: 'history::1',
    sheetType: 'change_history',
    seqNo: 1,
    packageName: 'PKG',
    harnessPartNo: 'H-001',
    partName: 'Harness 001',
    changeDescription: 'initial',
    changeDate: '2026-04-12 12:00:00',
    remark: '',
  },
];

describe('CascadeConfirmWizard', () => {
  it('forces step-by-step confirmation and appends change history action', async () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined);

    render(
      <CascadeConfirmWizard
        detection={makeDetection()}
        semanticChanges={[]}
        assemblyRows={[]}
        secondaryRows={[]}
        kskRows={[]}
        existingHistoryRows={existingHistoryRows}
        onConfirm={onConfirm}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.getByText('Step 1 / 3 - KSK BOM')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Confirm This Step' }));
    expect(screen.getByText('Step 2 / 3 - Secondary Material')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Confirm This Step' }));
    expect(screen.getByText('Step 3 / 3 - Assembly Parts')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Finish And Write History' }));

    await waitFor(() => {
      expect(onConfirm).toHaveBeenCalledTimes(1);
    });

    const [actions] = onConfirm.mock.calls[0] as [Array<{ targetSheet: string; data: Record<string, unknown> }>];
    expect(actions.some((action) => action.targetSheet === 'change_history')).toBe(true);
  });
});
