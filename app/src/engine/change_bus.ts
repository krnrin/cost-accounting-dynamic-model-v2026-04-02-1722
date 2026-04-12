import type { BomChangeDetectionResult } from '@/engine/change_detector';
import type { WorkbookSheetType } from '@/types/bomWorkbook';

export type SheetType = Exclude<WorkbookSheetType, 'change_history'>;

export interface ChangeBusScope {
  projectId: string;
  scenarioId: string;
  harnessId: string;
  sheetType: SheetType;
  partNo: string;
}

export interface SheetChangeEvent {
  eventId: string;
  projectId: string;
  scenarioId: string;
  harnessId: string;
  sourceSheet: SheetType;
  sourceSheetId: string;
  sourceSheetName: string;
  affectedPartNos: string[];
  detection: BomChangeDetectionResult;
  timestamp: string;
}

export interface AffectedTarget {
  projectId: string;
  scenarioId: string;
  harnessId: string;
  targetSheet: SheetType;
  targetSheetId: string;
  targetSheetName: string;
  matchedPartNos: string[];
  affectedRowIndices: number[];
}

export interface SyncPreviewRow {
  partNo: string;
  partName: string;
  field: string;
  sourceValue: string | number | null;
  localValue: string | number | null;
  checked: boolean;
  localRowIndex: number;
}

export interface IndexedSheetRow {
  projectId: string;
  scenarioId: string;
  harnessId: string;
  sheetType: SheetType;
  sheetId: string;
  sheetName: string;
  partNo: string;
  rowIndex: number;
}

type EventHandler = (event: SheetChangeEvent, targets: AffectedTarget[]) => void;

type ScopeKey = string;

function normalizeScopePart(value: string | undefined | null): string {
  return String(value || '').trim();
}

function toScopeKey(scope: ChangeBusScope): ScopeKey {
  return [
    normalizeScopePart(scope.projectId),
    normalizeScopePart(scope.scenarioId),
    normalizeScopePart(scope.harnessId),
    normalizeScopePart(scope.sheetType),
    normalizeScopePart(scope.partNo),
  ].join('::');
}

function toTargetKey(ref: IndexedSheetRow): string {
  return [ref.projectId, ref.scenarioId, ref.harnessId, ref.sheetType, ref.sheetId].join('::');
}

export class ChangeBus {
  private handlers: EventHandler[] = [];

  private scopeIndex = new Map<ScopeKey, IndexedSheetRow[]>();

  private counter = 0;

  on(handler: EventHandler): () => void {
    this.handlers.push(handler);
    return () => {
      this.handlers = this.handlers.filter(item => item !== handler);
    };
  }

  rebuildIndex(rows: IndexedSheetRow[]): void {
    this.scopeIndex.clear();
    for (const row of rows) {
      if (!row.partNo) continue;
      const key = toScopeKey({
        projectId: row.projectId,
        scenarioId: row.scenarioId,
        harnessId: row.harnessId,
        sheetType: row.sheetType,
        partNo: row.partNo,
      });
      const bucket = this.scopeIndex.get(key);
      if (bucket) bucket.push(row);
      else this.scopeIndex.set(key, [row]);
    }
  }

  emit(source: {
    projectId: string;
    scenarioId: string;
    harnessId: string;
    sourceSheet: SheetType;
    sourceSheetId: string;
    sourceSheetName: string;
    detection: BomChangeDetectionResult;
  }): { event: SheetChangeEvent; targets: AffectedTarget[] } {
    const affectedPartNos = [...new Set(source.detection.changes.map(change => change.partNo).filter(Boolean))];
    const event: SheetChangeEvent = {
      eventId: `evt-${++this.counter}-${Date.now()}`,
      projectId: source.projectId,
      scenarioId: source.scenarioId,
      harnessId: source.harnessId,
      sourceSheet: source.sourceSheet,
      sourceSheetId: source.sourceSheetId,
      sourceSheetName: source.sourceSheetName,
      affectedPartNos,
      detection: source.detection,
      timestamp: new Date().toISOString(),
    };

    const targetMap = new Map<string, AffectedTarget>();
    for (const partNo of affectedPartNos) {
      const scopeCandidates: ChangeBusScope[] = (['bom', 'assembly_parts', 'secondary_material', 'ksk_bom'] as SheetType[]).map(
        sheetType => ({
          projectId: source.projectId,
          scenarioId: source.scenarioId,
          harnessId: source.harnessId,
          sheetType,
          partNo,
        })
      );
      for (const scope of scopeCandidates) {
        const refs = this.scopeIndex.get(toScopeKey(scope)) || [];
        for (const ref of refs) {
          const isSource = ref.sheetType === source.sourceSheet && ref.sheetId === source.sourceSheetId;
          if (isSource) continue;
          const key = toTargetKey(ref);
          const existing = targetMap.get(key);
          if (existing) {
            if (!existing.matchedPartNos.includes(partNo)) existing.matchedPartNos.push(partNo);
            if (!existing.affectedRowIndices.includes(ref.rowIndex)) existing.affectedRowIndices.push(ref.rowIndex);
            continue;
          }
          targetMap.set(key, {
            projectId: ref.projectId,
            scenarioId: ref.scenarioId,
            harnessId: ref.harnessId,
            targetSheet: ref.sheetType,
            targetSheetId: ref.sheetId,
            targetSheetName: ref.sheetName,
            matchedPartNos: [partNo],
            affectedRowIndices: [ref.rowIndex],
          });
        }
      }
    }

    const targets = [...targetMap.values()].map(target => ({
      ...target,
      affectedRowIndices: [...target.affectedRowIndices].sort((a, b) => a - b),
    }));

    for (const handler of this.handlers) handler(event, targets);
    return { event, targets };
  }
}

export const changeBus = new ChangeBus();

export function buildInboundSyncPreviewRows(
  event: SheetChangeEvent,
  target: AffectedTarget,
  localData: Array<Record<string, unknown>>
): SyncPreviewRow[] {
  const rows: SyncPreviewRow[] = [];
  for (const change of event.detection.changes) {
    if (!target.matchedPartNos.includes(change.partNo)) continue;
    const localRowIndex = target.affectedRowIndices.find(index => String(localData[index]?.partNo || '') === change.partNo);
    if (localRowIndex === undefined) continue;
    const localRow = localData[localRowIndex];
    for (const field of change.fieldChanges) {
      if (field.after === null) continue;
      const localValue = (localRow?.[field.field] ?? null) as string | number | null;
      if (String(localValue ?? '') === String(field.after ?? '')) continue;
      rows.push({
        partNo: change.partNo,
        partName: change.partName,
        field: field.field,
        sourceValue: field.after,
        localValue,
        checked: true,
        localRowIndex,
      });
    }
  }
  return rows;
}

