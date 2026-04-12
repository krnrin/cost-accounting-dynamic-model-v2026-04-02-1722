import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MultiDirectionNoticeBar } from './MultiDirectionNoticeBar';
import type { BomChangeDetectionResult } from '@/engine/change_detector';
import type { AffectedTarget, SheetChangeEvent } from '@/engine/change_bus';

function makeDetection(overrides: Partial<BomChangeDetectionResult> = {}): BomChangeDetectionResult {
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
        fieldChanges: [{ field: 'qty', before: null, after: 2 }],
      },
    ],
    ...overrides,
  };
}

function makeIncoming(targetOverrides: Partial<AffectedTarget> = {}) {
  const event: SheetChangeEvent = {
    eventId: 'evt-1',
    projectId: 'p1',
    scenarioId: 's1',
    harnessId: 'H-001',
    sourceSheet: 'bom',
    sourceSheetId: 'bom-H-001',
    sourceSheetName: 'Harness 001',
    affectedPartNos: ['P-001'],
    detection: makeDetection(),
    timestamp: '2026-04-12T12:05:00.000Z',
  };

  const target: AffectedTarget = {
    projectId: 'p1',
    scenarioId: 's1',
    harnessId: 'H-001',
    targetSheet: 'ksk_bom',
    targetSheetId: 'ksk',
    targetSheetName: 'KSK BOM',
    matchedPartNos: ['P-001'],
    affectedRowIndices: [0, 1],
    ...targetOverrides,
  };

  return { event, target };
}

describe('MultiDirectionNoticeBar', () => {
  it('renders local yellow notice and opens cascade flow', () => {
    const onOpenOutboundCascade = vi.fn();

    render(
      <MultiDirectionNoticeBar
        currentSheetType="bom"
        localDetection={makeDetection()}
        incomingEvents={[]}
        onOpenOutboundCascade={onOpenOutboundCascade}
        onOpenInboundSync={vi.fn()}
        onDismissLocal={vi.fn()}
        onDismissIncoming={vi.fn()}
      />,
    );

    expect(screen.getByText(/BOM changed:/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Start cascade' }));
    expect(onOpenOutboundCascade).toHaveBeenCalledWith(expect.objectContaining({ harnessId: 'H-001' }));
  });

  it('renders incoming blue notice and opens sync review', () => {
    const onOpenInboundSync = vi.fn();
    const incoming = makeIncoming();

    render(
      <MultiDirectionNoticeBar
        currentSheetType="ksk_bom"
        localDetection={null}
        incomingEvents={[incoming]}
        onOpenOutboundCascade={vi.fn()}
        onOpenInboundSync={onOpenInboundSync}
        onDismissLocal={vi.fn()}
        onDismissIncoming={vi.fn()}
      />,
    );

    expect(screen.getByText(/updated 1 shared parts/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Review sync' }));
    expect(onOpenInboundSync).toHaveBeenCalledWith(incoming.event, incoming.target);
  });
});
