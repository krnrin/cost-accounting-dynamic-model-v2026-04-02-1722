import { useMemo, useState } from 'react';
import type { AffectedTarget, SheetChangeEvent } from '@/engine/change_bus';
import { buildInboundSyncPreviewRows } from '@/engine/change_bus';

interface Props {
  event: SheetChangeEvent;
  target: AffectedTarget;
  localData: Array<Record<string, unknown>>;
  onConfirmSync: (rows: ReturnType<typeof buildInboundSyncPreviewRows>) => Promise<void>;
  onCancel: () => void;
}

export function InboundSyncWizard({ event, target, localData, onConfirmSync, onCancel }: Props) {
  const initialRows = useMemo(
    () => buildInboundSyncPreviewRows(event, target, localData),
    [event, target, localData]
  );
  const [preview, setPreview] = useState(initialRows);
  const [syncing, setSyncing] = useState(false);
  const checkedCount = preview.filter(row => row.checked).length;

  const toggleRow = (index: number) =>
    setPreview(rows => rows.map((row, rowIndex) => (rowIndex === index ? { ...row, checked: !row.checked } : row)));

  const toggleAll = (checked: boolean) => setPreview(rows => rows.map(row => ({ ...row, checked })));

  const confirm = async () => {
    setSyncing(true);
    try {
      await onConfirmSync(preview.filter(row => row.checked));
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-lg shadow-xl w-[900px] max-h-[80vh] flex flex-col">
        <div className="px-6 py-4 border-b">
          <h2 className="text-lg font-bold">Inbound Sync Review</h2>
          <p className="text-sm text-gray-500 mt-1">
            Source sheet: <span className="font-medium">{event.sourceSheetName}</span>
          </p>
        </div>
        <div className="flex-1 overflow-y-auto p-6">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-gray-50">
                <th className="px-3 py-2 w-8">
                  <input
                    type="checkbox"
                    checked={checkedCount === preview.length && preview.length > 0}
                    onChange={e => toggleAll(e.target.checked)}
                  />
                </th>
                <th className="px-3 py-2 text-left">Part No.</th>
                <th className="px-3 py-2 text-left">Field</th>
                <th className="px-3 py-2 text-left">Incoming Value</th>
                <th className="px-3 py-2 text-left">Current Value</th>
              </tr>
            </thead>
            <tbody>
              {preview.map((row, index) => (
                <tr key={`${row.partNo}-${row.field}-${index}`} className={`border-b ${row.checked ? 'bg-blue-50' : ''}`}>
                  <td className="px-3 py-2">
                    <input type="checkbox" checked={row.checked} onChange={() => toggleRow(index)} />
                  </td>
                  <td className="px-3 py-2 font-mono text-xs">{row.partNo}</td>
                  <td className="px-3 py-2">{row.field}</td>
                  <td className="px-3 py-2 text-blue-700 font-medium">{String(row.sourceValue ?? '-')}</td>
                  <td className="px-3 py-2 text-gray-500 line-through">{String(row.localValue ?? '-')}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {preview.length === 0 && <p className="text-center text-gray-400 py-8">No inbound changes require sync.</p>}
        </div>
        <div className="px-6 py-4 border-t flex justify-between">
          <span className="text-sm text-gray-500">
            Selected {checkedCount} / {preview.length}
          </span>
          <div className="flex gap-3">
            <button className="px-4 py-2 text-sm rounded border" onClick={onCancel}>
              Cancel
            </button>
            <button
              className="px-4 py-2 text-sm rounded bg-blue-600 text-white disabled:opacity-50"
              onClick={confirm}
              disabled={syncing || checkedCount === 0}
            >
              {syncing ? 'Syncing...' : `Confirm Sync (${checkedCount})`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

