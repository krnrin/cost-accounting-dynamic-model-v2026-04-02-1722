import { useMemo, useState } from 'react';
import type { AssemblyPartRow, ChangeHistoryRow, KskBomRow, SecondaryMaterialRow } from '@/types/bomWorkbook';
import type { BomChangeDetectionResult } from '@/engine/change_detector';
import type { SemanticChange } from '@/engine/change_pattern_classifier';
import {
  computeAssemblyPartsImpact,
  computeKskImpact,
  computeSecondaryMaterialImpact,
  type CascadeAction,
  type ImpactPreviewRow,
} from '@/engine/cascade_impact';
import { writeChangeHistory } from '@/engine/change_history_writer';

type StepKey = 'ksk_bom' | 'secondary_material' | 'assembly_parts';

const STEP_ORDER: StepKey[] = ['ksk_bom', 'secondary_material', 'assembly_parts'];

interface Props {
  detection: BomChangeDetectionResult;
  semanticChanges: SemanticChange[];
  assemblyRows: AssemblyPartRow[];
  secondaryRows: SecondaryMaterialRow[];
  kskRows: KskBomRow[];
  existingHistoryRows: ChangeHistoryRow[];
  onConfirm: (actions: CascadeAction[]) => Promise<void>;
  onCancel: () => void;
}

interface StepResult {
  key: StepKey;
  title: string;
  preview: ImpactPreviewRow[];
  actions: CascadeAction[];
}

function headersFor(step: StepKey): string[] {
  if (step === 'ksk_bom') return ['Part No.', 'Part Name', 'Current Qty', 'Action'];
  if (step === 'secondary_material') return ['Part No.', 'Part Name', 'Current Qty', 'Action'];
  return ['Part No.', 'Part Name', 'Current Qty', 'Action'];
}

function titleFor(step: StepKey): string {
  if (step === 'ksk_bom') return 'Step 1 / 3 - KSK BOM';
  if (step === 'secondary_material') return 'Step 2 / 3 - Secondary Material';
  return 'Step 3 / 3 - Assembly Parts';
}

export function CascadeConfirmWizard({
  detection,
  semanticChanges,
  assemblyRows,
  secondaryRows,
  kskRows,
  existingHistoryRows,
  onConfirm,
  onCancel,
}: Props) {
  const impacts = useMemo(() => {
    const ksk = computeKskImpact(detection.changes, semanticChanges, kskRows);
    const secondary = computeSecondaryMaterialImpact(detection.changes, semanticChanges, secondaryRows);
    const assembly = computeAssemblyPartsImpact(detection.changes, semanticChanges, assemblyRows);
    const steps: Record<StepKey, StepResult> = {
      ksk_bom: { key: 'ksk_bom', title: titleFor('ksk_bom'), preview: ksk.preview, actions: ksk.actions },
      secondary_material: {
        key: 'secondary_material',
        title: titleFor('secondary_material'),
        preview: secondary.preview,
        actions: secondary.actions,
      },
      assembly_parts: {
        key: 'assembly_parts',
        title: titleFor('assembly_parts'),
        preview: assembly.preview,
        actions: assembly.actions,
      },
    };
    return steps;
  }, [detection, semanticChanges, kskRows, secondaryRows, assemblyRows]);

  const [stepIndex, setStepIndex] = useState(0);
  const [confirming, setConfirming] = useState(false);
  const currentStep: StepKey = STEP_ORDER[stepIndex] ?? 'ksk_bom';
  const result = impacts[currentStep];
  const totalActions = STEP_ORDER.reduce((sum, step) => sum + impacts[step].actions.length, 0);

  const nextStep = () => setStepIndex(index => Math.min(index + 1, STEP_ORDER.length - 1));
  const previousStep = () => setStepIndex(index => Math.max(index - 1, 0));

  const confirmAll = async () => {
    setConfirming(true);
    try {
      const allActions = [
        ...impacts.ksk_bom.actions,
        ...impacts.secondary_material.actions,
        ...impacts.assembly_parts.actions,
      ];
      allActions.push(writeChangeHistory(detection, semanticChanges, allActions, existingHistoryRows));
      await onConfirm(allActions);
    } finally {
      setConfirming(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-lg shadow-xl w-[980px] max-h-[82vh] flex flex-col">
        <div className="px-6 py-4 border-b">
          <h2 className="text-lg font-bold">BOM Cascade Confirmation</h2>
          <p className="text-sm text-gray-500 mt-1">{detection.summary}</p>
        </div>
        <div className="px-6 py-3 border-b">
          <div className="text-sm font-medium">{result.title}</div>
          <div className="text-xs text-gray-500 mt-1">
            Review order is fixed: KSK -&gt; Secondary Material -&gt; Assembly Parts -&gt; Change History
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-6">
          <ImpactTable headers={headersFor(currentStep)} rows={result.preview} />
        </div>
        <div className="px-6 py-4 border-t flex justify-between items-center">
          <span className="text-sm text-gray-500">Prepared actions: {totalActions}</span>
          <div className="flex gap-3">
            <button className="px-4 py-2 text-sm rounded border hover:bg-gray-50" onClick={onCancel}>
              Cancel
            </button>
            <button
              className="px-4 py-2 text-sm rounded border hover:bg-gray-50 disabled:opacity-50"
              onClick={previousStep}
              disabled={stepIndex === 0}
            >
              Previous
            </button>
            {stepIndex < STEP_ORDER.length - 1 ? (
              <button className="px-4 py-2 text-sm rounded bg-blue-600 text-white hover:bg-blue-700" onClick={nextStep}>
                Confirm This Step
              </button>
            ) : (
              <button
                className="px-4 py-2 text-sm rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                onClick={confirmAll}
                disabled={confirming}
              >
                {confirming ? 'Applying...' : 'Finish And Write History'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ImpactTable({
  headers,
  rows,
}: {
  headers: string[];
  rows: ImpactPreviewRow[];
}) {
  const rowColor: Record<ImpactPreviewRow['changeType'], string> = {
    added: 'bg-green-50',
    removed: 'bg-red-50',
    modified: 'bg-amber-50',
    unchanged: '',
  };

  return (
    <table className="w-full text-sm border-collapse">
      <thead>
        <tr className="bg-gray-50">
          {headers.map(header => (
            <th key={header} className="px-3 py-2 text-left">
              {header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, index) => (
          <tr key={row.rowKey || index} className={`border-b ${rowColor[row.changeType]}`}>
            {row.cells.map((cell, cellIndex) => (
              <td key={cellIndex} className="px-3 py-2">
                {cell}
              </td>
            ))}
          </tr>
        ))}
        {rows.length === 0 && (
          <tr>
            <td className="px-3 py-6 text-gray-400" colSpan={headers.length}>
              No impacted rows in this step.
            </td>
          </tr>
        )}
      </tbody>
    </table>
  );
}
