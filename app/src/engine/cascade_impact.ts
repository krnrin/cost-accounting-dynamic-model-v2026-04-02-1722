import type { AssemblyPartRow, KskBomRow, SecondaryMaterialRow } from '@/types/bomWorkbook';
import type { BomRowChange } from '@/engine/change_detector';
import type { SemanticChange } from '@/engine/change_pattern_classifier';

export type CascadeTargetSheet = 'assembly_parts' | 'secondary_material' | 'ksk_bom' | 'change_history';
export type CascadeActionType = 'update' | 'add' | 'remove';

export interface CascadeAction {
  targetSheet: CascadeTargetSheet;
  actionType: CascadeActionType;
  rowKey?: string;
  data: Record<string, unknown>;
}

export interface ImpactPreviewRow {
  rowKey?: string;
  cells: Array<string | number>;
  changeType: 'added' | 'removed' | 'modified' | 'unchanged';
}

export interface ImpactResult {
  actions: CascadeAction[];
  preview: ImpactPreviewRow[];
}

type TargetRow = {
  rowKey: string;
  partNo: string;
  partName?: string;
  qty?: number;
  supplier?: string;
  spec?: string;
  sourceBomRowKey?: string;
};

type TargetSheet = Exclude<CascadeTargetSheet, 'change_history'>;

function getField(change: BomRowChange, fieldName: string): string | number | null {
  const field = change.fieldChanges.find(item => item.field === fieldName);
  if (!field) return null;
  return field.after;
}

function findMatchedRow<T extends TargetRow>(rows: T[], change: BomRowChange): T | undefined {
  return rows.find(row => row.partNo === change.partNo || row.sourceBomRowKey === change.rowKey);
}

function buildBaseAddData(change: BomRowChange): Record<string, unknown> {
  return {
    partNo: change.partNo,
    partName: change.partName,
    qty: getField(change, 'qty') ?? 1,
    supplier: getField(change, 'supplier') ?? '',
    spec: getField(change, 'spec') ?? '',
  };
}

function applySimpleChanges<T extends TargetRow>(
  targetSheet: TargetSheet,
  rows: T[],
  changes: BomRowChange[],
  actions: CascadeAction[],
  preview: ImpactPreviewRow[],
  usedPartNos: Set<string>
): void {
  for (const change of changes) {
    const usageKey = `${change.changeType}::${change.partNo}`;
    if (usedPartNos.has(usageKey)) continue;

    const matched = findMatchedRow(rows, change);
    if (change.changeType === 'added') {
      actions.push({
        targetSheet,
        actionType: 'add',
        data: buildBaseAddData(change),
      });
      preview.push({
        cells: [change.partNo, change.partName, '-', 'add'],
        changeType: 'added',
      });
      continue;
    }

    if (change.changeType === 'removed' && matched) {
      actions.push({
        targetSheet,
        actionType: 'remove',
        rowKey: matched.rowKey,
        data: { partNo: change.partNo },
      });
      preview.push({
        rowKey: matched.rowKey,
        cells: [change.partNo, change.partName, matched.qty ?? '-', 'remove'],
        changeType: 'removed',
      });
      continue;
    }

    if (change.changeType === 'modified' && matched) {
      const payload: Record<string, unknown> = {};
      const qty = getField(change, 'qty');
      const supplier = getField(change, 'supplier');
      const spec = getField(change, 'spec');
      if (qty !== null) payload.qty = qty;
      if (supplier !== null) payload.supplier = supplier;
      if (spec !== null) payload.spec = spec;
      if (Object.keys(payload).length === 0) continue;
      actions.push({
        targetSheet,
        actionType: 'update',
        rowKey: matched.rowKey,
        data: payload,
      });
      preview.push({
        rowKey: matched.rowKey,
        cells: [change.partNo, change.partName, matched.qty ?? '-', 'modify'],
        changeType: 'modified',
      });
    }
  }
}

function applySemanticReplace<T extends TargetRow>(
  targetSheet: TargetSheet,
  rows: T[],
  semantics: SemanticChange[],
  actions: CascadeAction[],
  preview: ImpactPreviewRow[],
  usedPartNos: Set<string>
): void {
  for (const semantic of semantics) {
    if (!['replace', 'wire_spec_replace'].includes(semantic.pattern)) continue;
    const removed = semantic.relatedChanges.find(change => change.changeType === 'removed');
    const added = semantic.relatedChanges.find(change => change.changeType === 'added');
    if (!removed || !added) continue;
    const matched = rows.find(row => row.partNo === removed.partNo);
    if (!matched) continue;
    actions.push({
      targetSheet,
      actionType: 'update',
      rowKey: matched.rowKey,
      data: {
        partNo: added.partNo,
        partName: added.partName,
        qty: getField(added, 'qty') ?? matched.qty,
        supplier: getField(added, 'supplier') ?? matched.supplier,
        spec: getField(added, 'spec') ?? matched.spec,
      },
    });
    preview.push({
      rowKey: matched.rowKey,
      cells: [`${removed.partNo} -> ${added.partNo}`, added.partName, matched.qty ?? '-', 'replace'],
      changeType: 'modified',
    });
    usedPartNos.add(`${removed.changeType}::${removed.partNo}`);
    usedPartNos.add(`${added.changeType}::${added.partNo}`);
  }
}

function computeImpactForSheet<T extends TargetRow>(
  targetSheet: TargetSheet,
  rows: T[],
  changes: BomRowChange[],
  semanticChanges: SemanticChange[]
): ImpactResult {
  const actions: CascadeAction[] = [];
  const preview: ImpactPreviewRow[] = [];
  const usedPartNos = new Set<string>();

  applySemanticReplace(targetSheet, rows, semanticChanges, actions, preview, usedPartNos);
  applySimpleChanges(targetSheet, rows, changes, actions, preview, usedPartNos);

  return { actions, preview };
}

export function computeAssemblyPartsImpact(
  changes: BomRowChange[],
  semanticChanges: SemanticChange[],
  rows: AssemblyPartRow[]
): ImpactResult {
  return computeImpactForSheet('assembly_parts', rows, changes, semanticChanges);
}

export function computeSecondaryMaterialImpact(
  changes: BomRowChange[],
  semanticChanges: SemanticChange[],
  rows: SecondaryMaterialRow[]
): ImpactResult {
  return computeImpactForSheet('secondary_material', rows, changes, semanticChanges);
}

export function computeKskImpact(
  changes: BomRowChange[],
  semanticChanges: SemanticChange[],
  rows: KskBomRow[]
): ImpactResult {
  return computeImpactForSheet('ksk_bom', rows, changes, semanticChanges);
}

