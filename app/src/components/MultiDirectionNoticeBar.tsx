import type { AffectedTarget, SheetChangeEvent, SheetType } from '@/engine/change_bus';
import type { BomChangeDetectionResult } from '@/engine/change_detector';

const SHEET_LABELS: Record<SheetType, string> = {
  bom: 'BOM',
  assembly_parts: 'Assembly Parts',
  secondary_material: 'Secondary Material',
  ksk_bom: 'KSK BOM',
};

interface Props {
  currentSheetType: SheetType;
  localDetection: BomChangeDetectionResult | null;
  incomingEvents: Array<{ event: SheetChangeEvent; target: AffectedTarget }>;
  onOpenOutboundCascade: (detection: BomChangeDetectionResult) => void;
  onOpenInboundSync: (event: SheetChangeEvent, target: AffectedTarget) => void;
  onDismissLocal: () => void;
  onDismissIncoming: (eventId: string) => void;
}

export function MultiDirectionNoticeBar({
  currentSheetType,
  localDetection,
  incomingEvents,
  onOpenOutboundCascade,
  onOpenInboundSync,
  onDismissLocal,
  onDismissIncoming,
}: Props) {
  return (
    <div className="flex flex-col">
      {localDetection?.hasChanges && (
        <div className="flex items-center justify-between px-4 py-2 bg-amber-50 border-b border-amber-300 text-sm">
          <div className="flex items-center gap-2">
            <span aria-hidden>!</span>
            <span className="text-amber-900 font-medium">
              {SHEET_LABELS[currentSheetType]} changed: {localDetection.summary}
            </span>
          </div>
          <div className="flex gap-2">
            <button
              className="px-3 py-1 rounded bg-amber-500 text-white text-xs"
              onClick={() => onOpenOutboundCascade(localDetection)}
            >
              Start cascade
            </button>
            <button className="text-xs text-gray-500" onClick={onDismissLocal}>
              Later
            </button>
          </div>
        </div>
      )}
      {incomingEvents.map(({ event, target }) => (
        <div
          key={event.eventId}
          className="flex items-center justify-between px-4 py-2 bg-blue-50 border-b border-blue-300 text-sm"
        >
          <div className="flex items-center gap-2">
            <span aria-hidden>i</span>
            <span className="text-blue-900 font-medium">
              {SHEET_LABELS[event.sourceSheet]} ({event.sourceSheetName}) updated {target.matchedPartNos.length} shared
              parts
            </span>
            <span className="px-1.5 py-0.5 rounded text-xs bg-blue-100 text-blue-700">
              affecting {target.affectedRowIndices.length} rows
            </span>
          </div>
          <div className="flex gap-2">
            <button
              className="px-3 py-1 rounded bg-blue-500 text-white text-xs"
              onClick={() => onOpenInboundSync(event, target)}
            >
              Review sync
            </button>
            <button className="text-xs text-gray-500" onClick={() => onDismissIncoming(event.eventId)}>
              Dismiss
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

