import type { ChangeHistoryRow } from '@/types/bomWorkbook';
import type { BomChangeDetectionResult } from '@/engine/change_detector';
import type { SemanticChange } from '@/engine/change_pattern_classifier';
import type { CascadeAction } from '@/engine/cascade_impact';

export interface ChangeHistoryWriterOptions {
  packageName?: string;
  harnessPartNo?: string;
  harnessName?: string;
  now?: Date;
}

function nextSeqNo(existingRows: ChangeHistoryRow[]): number {
  const max = existingRows.reduce((result, row) => Math.max(result, Number(row.seqNo || 0)), 0);
  return max + 1;
}

function formatDateTime(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  const ss = String(date.getSeconds()).padStart(2, '0');
  return `${y}-${m}-${d} ${hh}:${mm}:${ss}`;
}

function summarizeDescription(detection: BomChangeDetectionResult, semanticChanges: SemanticChange[]): string {
  if (semanticChanges.length > 0) {
    return semanticChanges.map(item => item.description).join('; ');
  }
  return detection.summary;
}

function summarizeAffectedSheets(cascadeActions: CascadeAction[]): string {
  const buckets = new Map<string, number>();
  for (const action of cascadeActions) {
    const key = action.targetSheet;
    buckets.set(key, (buckets.get(key) || 0) + 1);
  }
  const ordered = ['ksk_bom', 'secondary_material', 'assembly_parts'].filter(sheet => buckets.has(sheet));
  return ordered.map(sheet => `${sheet}:${buckets.get(sheet)}`).join(', ');
}

export function generateChangeHistoryRows(
  detection: BomChangeDetectionResult,
  semanticChanges: SemanticChange[],
  cascadeActions: CascadeAction[],
  existingRowsOrCount: ChangeHistoryRow[] | number,
  options: ChangeHistoryWriterOptions = {}
): ChangeHistoryRow[] {
  const now = options.now || new Date();
  const existingRows = Array.isArray(existingRowsOrCount)
    ? existingRowsOrCount
    : Array.from({ length: Math.max(0, existingRowsOrCount) }).map((_, index) => ({
        rowKey: `virtual::${index + 1}`,
        sheetType: 'change_history' as const,
        seqNo: index + 1,
        packageName: '',
        harnessPartNo: '',
        partName: '',
        changeDescription: '',
        changeDate: '',
      }));
  const seqNo = nextSeqNo(existingRows);
  const affectedPartNames = [...new Set(detection.changes.map(change => change.partName).filter(Boolean))];
  const description = summarizeDescription(detection, semanticChanges);
  const affectedSheets = summarizeAffectedSheets(cascadeActions);

  return [
    {
      rowKey: `history::${detection.harnessId}::${seqNo}`,
      sheetType: 'change_history',
      seqNo,
      packageName: options.packageName || detection.harnessName,
      harnessPartNo: options.harnessPartNo || detection.harnessId,
      partName: options.harnessName || affectedPartNames.join(', '),
      changeDescription: description,
      changeDate: formatDateTime(now),
      remark: affectedSheets,
    },
  ];
}

export function writeChangeHistory(
  detection: BomChangeDetectionResult,
  semanticChanges: SemanticChange[],
  cascadeActions: CascadeAction[],
  existingRowsOrCount: ChangeHistoryRow[] | number,
  options: ChangeHistoryWriterOptions = {}
): CascadeAction {
  const rows = generateChangeHistoryRows(
    detection,
    semanticChanges,
    cascadeActions,
    existingRowsOrCount,
    options
  );
  return {
    targetSheet: 'change_history',
    actionType: 'add',
    data: { rows },
  };
}

