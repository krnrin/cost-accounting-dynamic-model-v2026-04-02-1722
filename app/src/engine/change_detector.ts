import type { BomItem, WireItem } from '@/types/harness';
import type { BomSheetRow } from '@/types/bomWorkbook';
import { buildBomSheetRows } from '@/engine/bom_workbook_builders';

export type BomRowChangeType = 'added' | 'removed' | 'modified';

export interface BomRowFieldChange {
  field: string;
  before: string | number | null;
  after: string | number | null;
}

export interface BomRowChange {
  changeType: BomRowChangeType;
  partNo: string;
  partName: string;
  rowKey: string;
  rowIndex: number;
  fieldChanges: BomRowFieldChange[];
  functionText?: string;
  endGroup?: string;
  unit?: string;
  supplier?: string;
  itemCategory?: string;
}

export interface BomChangeDetectionResult {
  harnessId: string;
  harnessName: string;
  sheetName: string;
  hasChanges: boolean;
  changes: BomRowChange[];
  summary: string;
  affectedEndGroups: string[];
  detectedAt: string;
}

const COMPARE_FIELDS: Array<keyof BomSheetRow> = [
  'partNo',
  'partName',
  'qty',
  'unit',
  'spec',
  'supplier',
  'sapNo',
  'functionText',
  'itemCategory',
  'isSemiFinished',
  'unitPrice',
  'amount',
];

type IndexedRow = { row: BomSheetRow; rowIndex: number };

function normalizeValue(value: unknown): string | number | null {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value === 'boolean') return value ? 1 : 0;
  if (typeof value === 'number') return Number.isFinite(value) ? Number(value.toFixed(6)) : null;
  return String(value);
}

function getBusinessKey(row: BomSheetRow): string {
  return [
    row.partNo,
    row.functionText || '',
    row.itemCategory || '',
    row.unit || '',
    row.spec || '',
  ].join('::');
}

function getPartNoKey(row: BomSheetRow): string {
  return row.partNo;
}

function buildBuckets(rows: IndexedRow[], keyOf: (row: BomSheetRow) => string): Map<string, IndexedRow[]> {
  const map = new Map<string, IndexedRow[]>();
  for (const entry of rows) {
    const key = keyOf(entry.row);
    const bucket = map.get(key);
    if (bucket) bucket.push(entry);
    else map.set(key, [entry]);
  }
  return map;
}

function shiftOne(map: Map<string, IndexedRow[]>, key: string): IndexedRow | null {
  const bucket = map.get(key);
  if (!bucket || bucket.length === 0) return null;
  const hit = bucket.shift() || null;
  if (bucket.length === 0) map.delete(key);
  return hit;
}

function detectFieldChanges(before: BomSheetRow, after: BomSheetRow): BomRowFieldChange[] {
  return COMPARE_FIELDS
    .map(field => {
      const b = normalizeValue(before[field]);
      const a = normalizeValue(after[field]);
      return { field: String(field), before: b, after: a };
    })
    .filter(change => String(change.before ?? '') !== String(change.after ?? ''));
}

function toAdded(entry: IndexedRow): BomRowChange {
  return {
    changeType: 'added',
    partNo: entry.row.partNo,
    partName: entry.row.partName,
    rowKey: entry.row.rowKey,
    rowIndex: entry.rowIndex,
    functionText: entry.row.functionText,
    endGroup: entry.row.functionText,
    unit: entry.row.unit,
    supplier: entry.row.supplier,
    itemCategory: entry.row.itemCategory,
    fieldChanges: COMPARE_FIELDS.map(field => ({
      field: String(field),
      before: null,
      after: normalizeValue(entry.row[field]),
    })),
  };
}

function toRemoved(entry: IndexedRow): BomRowChange {
  return {
    changeType: 'removed',
    partNo: entry.row.partNo,
    partName: entry.row.partName,
    rowKey: entry.row.rowKey,
    rowIndex: entry.rowIndex,
    functionText: entry.row.functionText,
    endGroup: entry.row.functionText,
    unit: entry.row.unit,
    supplier: entry.row.supplier,
    itemCategory: entry.row.itemCategory,
    fieldChanges: COMPARE_FIELDS.map(field => ({
      field: String(field),
      before: normalizeValue(entry.row[field]),
      after: null,
    })),
  };
}

function summarize(sheetName: string, changes: BomRowChange[], affectedEndGroups: string[]): string {
  if (changes.length === 0) return `${sheetName}: no changes`;
  const added = changes.filter(change => change.changeType === 'added').length;
  const removed = changes.filter(change => change.changeType === 'removed').length;
  const modified = changes.filter(change => change.changeType === 'modified').length;
  const parts: string[] = [];
  if (added > 0) parts.push(`added ${added}`);
  if (removed > 0) parts.push(`removed ${removed}`);
  if (modified > 0) parts.push(`modified ${modified}`);
  const groups = affectedEndGroups.length > 0 ? `; groups: ${affectedEndGroups.join(', ')}` : '';
  return `${sheetName}: ${parts.join(', ')}${groups}`;
}

function stableSort(changes: BomRowChange[]): BomRowChange[] {
  return [...changes].sort((a, b) => {
    if (a.rowIndex !== b.rowIndex) return a.rowIndex - b.rowIndex;
    if (a.partNo !== b.partNo) return a.partNo.localeCompare(b.partNo);
    return a.changeType.localeCompare(b.changeType);
  });
}

export function detectBomChanges(
  harnessId: string,
  harnessName: string,
  sheetName: string,
  beforeRows: BomSheetRow[],
  afterRows: BomSheetRow[]
): BomChangeDetectionResult {
  const beforeIndexed: IndexedRow[] = beforeRows.map((row, rowIndex) => ({ row, rowIndex }));
  const afterIndexed: IndexedRow[] = afterRows.map((row, rowIndex) => ({ row, rowIndex }));

  const beforeByRowKey = new Map(beforeIndexed.map(entry => [entry.row.rowKey, entry] as const));
  const afterByRowKey = new Map(afterIndexed.map(entry => [entry.row.rowKey, entry] as const));

  const matchedBefore = new Set<string>();
  const matchedAfter = new Set<string>();
  const changes: BomRowChange[] = [];

  for (const [rowKey, beforeEntry] of beforeByRowKey) {
    const afterEntry = afterByRowKey.get(rowKey);
    if (!afterEntry) continue;
    matchedBefore.add(rowKey);
    matchedAfter.add(rowKey);
    const fieldChanges = detectFieldChanges(beforeEntry.row, afterEntry.row);
    if (fieldChanges.length === 0) continue;
    changes.push({
      changeType: 'modified',
      partNo: afterEntry.row.partNo,
      partName: afterEntry.row.partName,
      rowKey: afterEntry.row.rowKey,
      rowIndex: afterEntry.rowIndex,
      fieldChanges,
      functionText: afterEntry.row.functionText,
      endGroup: afterEntry.row.functionText,
      unit: afterEntry.row.unit,
      supplier: afterEntry.row.supplier,
      itemCategory: afterEntry.row.itemCategory,
    });
  }

  const beforeUnmatched = beforeIndexed.filter(entry => !matchedBefore.has(entry.row.rowKey));
  const afterUnmatched = afterIndexed.filter(entry => !matchedAfter.has(entry.row.rowKey));
  const afterBusinessBuckets = buildBuckets(afterUnmatched, getBusinessKey);
  const afterPartBuckets = buildBuckets(afterUnmatched, getPartNoKey);
  const consumedAfterKeys = new Set<string>();

  for (const beforeEntry of beforeUnmatched) {
    const byBusiness = shiftOne(afterBusinessBuckets, getBusinessKey(beforeEntry.row));
    let match = byBusiness;
    if (!match) {
      match = shiftOne(afterPartBuckets, getPartNoKey(beforeEntry.row));
    }
    if (!match) {
      changes.push(toRemoved(beforeEntry));
      continue;
    }
    consumedAfterKeys.add(match.row.rowKey);
    const fieldChanges = detectFieldChanges(beforeEntry.row, match.row);
    if (fieldChanges.length === 0) {
      continue;
    }
    changes.push({
      changeType: 'modified',
      partNo: match.row.partNo,
      partName: match.row.partName,
      rowKey: match.row.rowKey,
      rowIndex: match.rowIndex,
      fieldChanges,
      functionText: match.row.functionText,
      endGroup: match.row.functionText,
      unit: match.row.unit,
      supplier: match.row.supplier,
      itemCategory: match.row.itemCategory,
    });
  }

  for (const afterEntry of afterUnmatched) {
    if (consumedAfterKeys.has(afterEntry.row.rowKey)) continue;
    changes.push(toAdded(afterEntry));
  }

  const sortedChanges = stableSort(changes);
  const affectedEndGroups = [
    ...new Set(sortedChanges.map(change => change.functionText || '').filter(Boolean)),
  ];

  return {
    harnessId,
    harnessName,
    sheetName,
    hasChanges: sortedChanges.length > 0,
    changes: sortedChanges,
    summary: summarize(sheetName, sortedChanges, affectedEndGroups),
    affectedEndGroups,
    detectedAt: new Date().toISOString(),
  };
}

export function buildBomSheetRowsFromBom(
  harnessId: string,
  harnessName: string,
  bom: Array<BomItem | WireItem>
): BomSheetRow[] {
  return buildBomSheetRows(harnessId, harnessName, bom);
}
