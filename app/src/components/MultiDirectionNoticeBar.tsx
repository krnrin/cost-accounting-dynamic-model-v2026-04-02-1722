import type { SheetChangeEvent, AffectedTarget, SheetType } from '@/engine/change_bus'
import type { BomChangeDetectionResult } from '@/engine/change_detector'

const SHEET_LABELS: Record<SheetType, string> = {
  bom: 'BOM明细',
  secondary_material: '二次物料明细',
  ksk_bom: 'KSK线束BOM明细',
  assembly_parts: '总成散件清单',
}

interface Props {
  currentSheetType: SheetType
  localDetection: BomChangeDetectionResult | null
  incomingEvents: Array<{ event: SheetChangeEvent; target: AffectedTarget }>
  onOpenOutboundCascade: (detection: BomChangeDetectionResult) => void
  onOpenInboundSync: (event: SheetChangeEvent, target: AffectedTarget) => void
  onDismissLocal: () => void
  onDismissIncoming: (eventId: string) => void
}

export function MultiDirectionNoticeBar({ currentSheetType, localDetection, incomingEvents, onOpenOutboundCascade, onOpenInboundSync, onDismissLocal, onDismissIncoming }: Props) {
  return (
    <div className="flex flex-col">
      {localDetection?.hasChanges && (
        <div className="flex items-center justify-between px-4 py-2 bg-amber-50 border-b border-amber-300 text-sm">
          <div className="flex items-center gap-2">
            <span>⚠️</span>
            <span className="text-amber-900 font-medium">本表({SHEET_LABELS[currentSheetType]})已修改：{localDetection.summary}</span>
          </div>
          <div className="flex gap-2">
            <button className="px-3 py-1 rounded bg-amber-500 text-white text-xs" onClick={() => onOpenOutboundCascade(localDetection)}>联动到其他表 →</button>
            <button className="text-xs text-gray-500" onClick={onDismissLocal}>稍后</button>
          </div>
        </div>
      )}
      {incomingEvents.map(({ event, target }) => (
        <div key={event.eventId} className="flex items-center justify-between px-4 py-2 bg-blue-50 border-b border-blue-300 text-sm">
          <div className="flex items-center gap-2">
            <span>🔔</span>
            <span className="text-blue-900 font-medium">{SHEET_LABELS[event.sourceSheet]}「{event.sourceSheetName}」修改了 {target.matchedPartNos.length} 个共享物料</span>
            <span className="px-1.5 py-0.5 rounded text-xs bg-blue-100 text-blue-700">影响本表 {target.affectedRowIndices.length} 行</span>
          </div>
          <div className="flex gap-2">
            <button className="px-3 py-1 rounded bg-blue-500 text-white text-xs" onClick={() => onOpenInboundSync(event, target)}>查看 & 确认同步</button>
            <button className="text-xs text-gray-500" onClick={() => onDismissIncoming(event.eventId)}>忽略</button>
          </div>
        </div>
      ))}
    </div>
  )
}
