import { useMemo, useState } from 'react'
import type { AffectedTarget, SheetChangeEvent } from '@/engine/change_bus'
import { buildInboundSyncPreviewRows } from '@/engine/change_bus'

interface Props {
  event: SheetChangeEvent
  target: AffectedTarget
  localData: Array<Record<string, unknown>>
  onConfirmSync: (rows: ReturnType<typeof buildInboundSyncPreviewRows>) => Promise<void>
  onCancel: () => void
}

export function InboundSyncWizard({ event, target, localData, onConfirmSync, onCancel }: Props) {
  const initialPreview = useMemo(() => buildInboundSyncPreviewRows(event, target, localData), [event, target, localData])
  const [preview, setPreview] = useState(initialPreview)
  const [syncing, setSyncing] = useState(false)
  const checkedCount = preview.filter(row => row.checked).length

  const toggleRow = (index: number) => setPreview(rows => rows.map((row, rowIndex) => rowIndex === index ? { ...row, checked: !row.checked } : row))
  const toggleAll = (checked: boolean) => setPreview(rows => rows.map(row => ({ ...row, checked })))

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-lg shadow-xl w-[850px] max-h-[80vh] flex flex-col">
        <div className="px-6 py-4 border-b">
          <h2 className="text-lg font-bold">来自其他表的物料变更同步</h2>
          <p className="text-sm text-gray-500 mt-1">来源表「{event.sourceSheetName}」修改了以下物料，建议同步到本表。</p>
        </div>
        <div className="flex-1 overflow-y-auto p-6">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-gray-50">
                <th className="px-3 py-2 w-8"><input type="checkbox" checked={checkedCount === preview.length && preview.length > 0} onChange={e => toggleAll(e.target.checked)} /></th>
                <th className="px-3 py-2 text-left">零件号</th>
                <th className="px-3 py-2 text-left">字段</th>
                <th className="px-3 py-2 text-left">来源表新值</th>
                <th className="px-3 py-2 text-left">本表当前值</th>
              </tr>
            </thead>
            <tbody>
              {preview.map((row, index) => (
                <tr key={`${row.partNo}-${row.field}-${index}`} className={`border-b ${row.checked ? 'bg-blue-50' : ''}`}>
                  <td className="px-3 py-2"><input type="checkbox" checked={row.checked} onChange={() => toggleRow(index)} /></td>
                  <td className="px-3 py-2 font-mono text-xs">{row.partNo}</td>
                  <td className="px-3 py-2">{row.field}</td>
                  <td className="px-3 py-2 text-blue-700 font-medium">{String(row.sourceValue ?? '-')}</td>
                  <td className="px-3 py-2 text-gray-500 line-through">{String(row.localValue ?? '-')}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {preview.length === 0 && <p className="text-center text-gray-400 py-8">本表中无需同步的差异</p>}
        </div>
        <div className="px-6 py-4 border-t flex justify-between">
          <span className="text-sm text-gray-500">已选 {checkedCount} / {preview.length} 项</span>
          <div className="flex gap-3">
            <button className="px-4 py-2 text-sm rounded border" onClick={onCancel}>取消</button>
            <button className="px-4 py-2 text-sm rounded bg-blue-600 text-white disabled:opacity-50" onClick={async () => { setSyncing(true); await onConfirmSync(preview.filter(row => row.checked)); setSyncing(false) }} disabled={syncing || checkedCount === 0}>{syncing ? '同步中...' : `确认同步 (${checkedCount} 项)`}</button>
          </div>
        </div>
      </div>
    </div>
  )
}
