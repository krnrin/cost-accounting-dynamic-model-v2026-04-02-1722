import { useMemo, useState } from 'react';
import type { AssemblyPartRow, KskBomRow, SecondaryMaterialRow } from '@/types/bomWorkbook';
import type { BomChangeDetectionResult } from '@/engine/change_detector';
import type { SemanticChange } from '@/engine/change_pattern_classifier';
import {
  computeAssemblyPartsImpact,
  computeKskImpact,
  computeSecondaryMaterialImpact,
  type CascadeAction,
} from '@/engine/cascade_impact';
import { writeChangeHistory } from '@/engine/change_history_writer';

type WizardTab = 'assembly_parts' | 'secondary_material' | 'ksk_bom';

interface Props {
  detection: BomChangeDetectionResult;
  semanticChanges: SemanticChange[];
  assemblyRows: AssemblyPartRow[];
  secondaryRows: SecondaryMaterialRow[];
  kskRows: KskBomRow[];
  historyRowCount: number;
  onConfirm: (actions: CascadeAction[]) => Promise<void>;
  onCancel: () => void;
}

export function CascadeConfirmWizard({ detection, semanticChanges, assemblyRows, secondaryRows, kskRows, historyRowCount, onConfirm, onCancel }: Props) {
  const [activeTab, setActiveTab] = useState<WizardTab>('assembly_parts');
  const [confirming, setConfirming] = useState(false);

  const assemblyImpact = useMemo(() => computeAssemblyPartsImpact(detection.changes, semanticChanges, assemblyRows), [detection, semanticChanges, assemblyRows]);
  const secondaryImpact = useMemo(() => computeSecondaryMaterialImpact(detection.changes, semanticChanges, secondaryRows), [detection, semanticChanges, secondaryRows]);
  const kskImpact = useMemo(() => computeKskImpact(detection.changes, semanticChanges, kskRows), [detection, semanticChanges, kskRows]);

  const totalActions = assemblyImpact.actions.length + secondaryImpact.actions.length + kskImpact.actions.length;

  const handleConfirm = async () => {
    setConfirming(true);
    try {
      const allActions = [
        ...assemblyImpact.actions,
        ...secondaryImpact.actions,
        ...kskImpact.actions,
      ];
      allActions.push(writeChangeHistory(detection, semanticChanges, allActions, historyRowCount));
      await onConfirm(allActions);
    } finally {
      setConfirming(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-lg shadow-xl w-[980px] max-h-[80vh] flex flex-col">
        <div className="px-6 py-4 border-b">
          <h2 className="text-lg font-bold">BOM 变更联动确认</h2>
          <p className="text-sm text-gray-500 mt-1">{detection.summary}</p>
        </div>
        <div className="flex border-b px-6">
          <TabButton active={activeTab === 'assembly_parts'} onClick={() => setActiveTab('assembly_parts')} label="总成散件清单" badge={assemblyImpact.actions.length} />
          <TabButton active={activeTab === 'secondary_material'} onClick={() => setActiveTab('secondary_material')} label="二次物料明细表" badge={secondaryImpact.actions.length} />
          <TabButton active={activeTab === 'ksk_bom'} onClick={() => setActiveTab('ksk_bom')} label="KSK 配置BOM明细表" badge={kskImpact.actions.length} />
        </div>
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'assembly_parts' && <ImpactTable headers={['零件号', '零件名称', '当前/原数量', '变更后/动作', '类型']} rows={assemblyImpact.preview} />}
          {activeTab === 'secondary_material' && <ImpactTable headers={['零件号', '零件名称', '当前/原数量', '变更后/动作', '类型']} rows={secondaryImpact.preview} />}
          {activeTab === 'ksk_bom' && <ImpactTable headers={['零件号', '零件名称', '当前/原数量', '变更后/动作', '类型']} rows={kskImpact.preview} />}
        </div>
        <div className="px-6 py-4 border-t flex justify-between items-center">
          <span className="text-sm text-gray-500">共 {totalActions} 处联动修改</span>
          <div className="flex gap-3">
            <button className="px-4 py-2 text-sm rounded border hover:bg-gray-50" onClick={onCancel}>取消</button>
            <button className="px-4 py-2 text-sm rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50" onClick={handleConfirm} disabled={confirming || totalActions === 0}>{confirming ? '执行中...' : `确认修改 (${totalActions} 处)`}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function TabButton({ active, onClick, label, badge }: { active: boolean; onClick: () => void; label: string; badge: number }) {
  return (
    <button className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${active ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`} onClick={onClick}>
      {label}
      {badge > 0 && <span className="ml-1.5 px-1.5 py-0.5 rounded-full text-xs bg-red-100 text-red-600">{badge}</span>}
    </button>
  );
}

function ImpactTable({ headers, rows }: { headers: string[]; rows: Array<{ rowKey?: string; cells: (string | number)[]; changeType: 'added' | 'removed' | 'modified' | 'unchanged' }> }) {
  const rowColor: Record<string, string> = {
    added: 'bg-green-50',
    removed: 'bg-red-50 line-through',
    modified: 'bg-amber-50',
    unchanged: '',
  };
  return (
    <table className="w-full text-sm border-collapse">
      <thead>
        <tr className="bg-gray-50">
          {headers.map(header => <th key={header} className="px-3 py-2 text-left">{header}</th>)}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, index) => (
          <tr key={row.rowKey || index} className={`border-b ${rowColor[row.changeType]}`}>
            {row.cells.map((cell, cellIndex) => <td key={cellIndex} className="px-3 py-2">{cell}</td>)}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
