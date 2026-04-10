import type { BomItem } from '../types/harness';

export type BomRowChangeType = 'added' | 'removed' | 'modified';

export interface BomRowFieldChange {
  field: string;
  before: string | number | boolean | null;
  after: string | number | boolean | null;
}

export interface BomRowChange {
  changeType: BomRowChangeType;
  partNo: string;
  partName: string;
  rowIndex: number;
  fieldChanges: BomRowFieldChange[];
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

export type ChangePattern =
  | 'simple_add'
  | 'simple_remove'
  | 'field_modify'
  | 'replace'
  | 'split'
  | 'merge'
  | 'qty_change'
  | 'qty_explode'
  | 'wire_spec_replace'
  | 'unknown';

export interface ClassifyHint {
  endGroup?: string;
  category?: BomItem['itemCategory'] | string;
  rowIndex: number;
  unit?: string;
  supplier?: string;
  partName?: string;
  functionText?: string;
}

export interface SupplierInheritanceCheck {
  assemblySupplier?: string;
  allInheritedOrUnknown: boolean;
  rows: Array<{
    partNo: string;
    supplier?: string;
    inheritsAssemblySupplier: boolean;
  }>;
}

export interface SemanticChange {
  pattern: ChangePattern;
  description: string;
  relatedChanges: BomRowChange[];
  confidence: number;
  supplierCheck?: SupplierInheritanceCheck;
  metadata?: Record<string, unknown>;
}

export interface ClassifyOptions {
  replaceThreshold?: number;
  wireReplaceThreshold?: number;
}

const DEFAULT_OPTIONS: Required<ClassifyOptions> = {
  replaceThreshold: 5,
  wireReplaceThreshold: 8,
};

export function classifyChangePatterns(
  detection: BomChangeDetectionResult,
  hints: Map<string, ClassifyHint>,
  options: ClassifyOptions = {}
): SemanticChange[] {
  const mergedOptions = { ...DEFAULT_OPTIONS, ...options };
  const { changes } = detection;
  const added = changes.filter(c => c.changeType === 'added');
  const removed = changes.filter(c => c.changeType === 'removed');
  const modified = changes.filter(c => c.changeType === 'modified');

  const results: SemanticChange[] = [];
  const usedAdded = new Set<string>();
  const usedRemoved = new Set<string>();

  classifySplit(removed, added, hints, usedRemoved, usedAdded, results);
  classifyMerge(removed, added, hints, usedRemoved, usedAdded, results);
  classifyWireSpecReplace(
    removed,
    added,
    hints,
    usedRemoved,
    usedAdded,
    results,
    mergedOptions.wireReplaceThreshold
  );
  classifyReplace(
    removed,
    added,
    hints,
    usedRemoved,
    usedAdded,
    results,
    mergedOptions.replaceThreshold
  );
  classifyModified(modified, results);
  classifyLeftovers(removed, added, usedRemoved, usedAdded, results);

  return results.sort((a, b) => {
    if (b.confidence !== a.confidence) return b.confidence - a.confidence;
    return a.description.localeCompare(b.description, 'zh-CN');
  });
}

export function buildClassifyHints(items: BomItem[]): Map<string, ClassifyHint> {
  const map = new Map<string, ClassifyHint>();
  items.forEach((item, index) => {
    map.set(item.partNo, {
      endGroup: item.endGroup,
      category: item.itemCategory,
      rowIndex: index,
      unit: item.unit,
      supplier: item.supplier,
      partName: item.partName,
      functionText: item.functionText,
    });
  });
  return map;
}

function classifySplit(
  removed: BomRowChange[],
  added: BomRowChange[],
  hints: Map<string, ClassifyHint>,
  usedRemoved: Set<string>,
  usedAdded: Set<string>,
  results: SemanticChange[]
): void {
  for (const rem of removed) {
    if (usedRemoved.has(rem.partNo)) continue;
    const remHint = hints.get(rem.partNo);
    if (!isAssemblyUnit(remHint?.unit)) continue;

    const sameGroupAdded = added.filter(add => {
      if (usedAdded.has(add.partNo)) return false;
      return isSameGroup(remHint, hints.get(add.partNo));
    });
    const componentAdds = sameGroupAdded.filter(add => isComponentUnit(hints.get(add.partNo)?.unit));

    if (componentAdds.length < 2) continue;

    const removedSupplier = normalizeText(remHint?.supplier);
    const allInheritedOrUnknown = componentAdds.every(add => {
      const supplier = normalizeText(hints.get(add.partNo)?.supplier);
      return !removedSupplier || !supplier || supplier === removedSupplier;
    });

    const confidence = allInheritedOrUnknown ? 0.98 : 0.95;
    const supplierCheck: SupplierInheritanceCheck = {
      assemblySupplier: remHint?.supplier,
      allInheritedOrUnknown,
      rows: componentAdds.map(add => {
        const supplier = hints.get(add.partNo)?.supplier;
        const inheritsAssemblySupplier =
          !removedSupplier || !normalizeText(supplier) || normalizeText(supplier) === removedSupplier;
        return {
          partNo: add.partNo,
          supplier,
          inheritsAssemblySupplier,
        };
      }),
    };

    results.push({
      pattern: 'split',
      description: `总成拆散件：${rem.partNo}(${rem.partName}) → ${componentAdds.length}个散件`,
      relatedChanges: [rem, ...componentAdds],
      confidence,
      supplierCheck,
    });

    usedRemoved.add(rem.partNo);
    componentAdds.forEach(add => usedAdded.add(add.partNo));
  }
}

function classifyMerge(
  removed: BomRowChange[],
  added: BomRowChange[],
  hints: Map<string, ClassifyHint>,
  usedRemoved: Set<string>,
  usedAdded: Set<string>,
  results: SemanticChange[]
): void {
  for (const add of added) {
    if (usedAdded.has(add.partNo)) continue;
    const addHint = hints.get(add.partNo);
    if (!isAssemblyUnit(addHint?.unit)) continue;

    const sameGroupRemoved = removed.filter(rem => {
      if (usedRemoved.has(rem.partNo)) return false;
      return isSameGroup(addHint, hints.get(rem.partNo));
    });
    const componentRemoved = sameGroupRemoved.filter(rem => isComponentUnit(hints.get(rem.partNo)?.unit));

    if (componentRemoved.length < 2) continue;

    results.push({
      pattern: 'merge',
      description: `散件合总成：${componentRemoved.length}个散件 → ${add.partNo}(${add.partName})`,
      relatedChanges: [...componentRemoved, add],
      confidence: 0.9,
    });

    usedAdded.add(add.partNo);
    componentRemoved.forEach(rem => usedRemoved.add(rem.partNo));
  }
}

function classifyWireSpecReplace(
  removed: BomRowChange[],
  added: BomRowChange[],
  hints: Map<string, ClassifyHint>,
  usedRemoved: Set<string>,
  usedAdded: Set<string>,
  results: SemanticChange[],
  threshold: number
): void {
  for (const rem of removed) {
    if (usedRemoved.has(rem.partNo)) continue;
    const remHint = hints.get(rem.partNo);

    let bestAdd: BomRowChange | null = null;
    let bestScore = -1;

    for (const add of added) {
      if (usedAdded.has(add.partNo)) continue;
      const addHint = hints.get(add.partNo);
      if (isAssemblyUnit(remHint?.unit) !== isAssemblyUnit(addHint?.unit)) continue;
      const score = scoreWireReplace(rem, add, remHint, addHint);
      if (score > bestScore) {
        bestScore = score;
        bestAdd = add;
      }
    }

    if (!bestAdd || bestScore < threshold) continue;

    const addHint = hints.get(bestAdd.partNo);
    results.push({
      pattern: 'wire_spec_replace',
      description: `导线规格替换：${rem.partNo} → ${bestAdd.partNo}`,
      relatedChanges: [rem, bestAdd],
      confidence: 0.93,
      metadata: {
        beforeSpec: extractSpecToken(rem.partNo) || extractSpecToken(rem.partName) || remHint?.unit,
        afterSpec: extractSpecToken(bestAdd.partNo) || extractSpecToken(bestAdd.partName) || addHint?.unit,
      },
    });

    usedRemoved.add(rem.partNo);
    usedAdded.add(bestAdd.partNo);
  }
}

function classifyReplace(
  removed: BomRowChange[],
  added: BomRowChange[],
  hints: Map<string, ClassifyHint>,
  usedRemoved: Set<string>,
  usedAdded: Set<string>,
  results: SemanticChange[],
  threshold: number
): void {
  for (const rem of removed) {
    if (usedRemoved.has(rem.partNo)) continue;
    const remHint = hints.get(rem.partNo);

    let bestAdd: BomRowChange | null = null;
    let bestScore = -1;

    for (const add of added) {
      if (usedAdded.has(add.partNo)) continue;
      const addHint = hints.get(add.partNo);
      if (isAssemblyUnit(remHint?.unit) !== isAssemblyUnit(addHint?.unit)) continue;
      const score = scoreReplace(rem, add, remHint, addHint);
      if (score > bestScore) {
        bestScore = score;
        bestAdd = add;
      }
    }

    if (!bestAdd || bestScore < threshold) continue;

    results.push({
      pattern: 'replace',
      description: `物料替换：${rem.partNo}(${rem.partName}) → ${bestAdd.partNo}(${bestAdd.partName})`,
      relatedChanges: [rem, bestAdd],
      confidence: Math.min(0.9, 0.55 + bestScore * 0.05),
    });

    usedRemoved.add(rem.partNo);
    usedAdded.add(bestAdd.partNo);
  }
}

function classifyModified(modified: BomRowChange[], results: SemanticChange[]): void {
  for (const mod of modified) {
    const qtyChange = mod.fieldChanges.find(change => change.field === 'qty');
    if (!qtyChange) {
      results.push({
        pattern: 'field_modify',
        description: `字段修改：${mod.partNo}`,
        relatedChanges: [mod],
        confidence: 1,
      });
      continue;
    }

    const before = Number(qtyChange.before ?? NaN);
    const after = Number(qtyChange.after ?? NaN);
    if (!Number.isNaN(before) && !Number.isNaN(after) && before === 1 && after >= 5) {
      results.push({
        pattern: 'qty_explode',
        description: `数量炸开：${mod.partNo} qty ${before} → ${after}`,
        relatedChanges: [mod],
        confidence: 0.6,
      });
      continue;
    }

    results.push({
      pattern: 'qty_change',
      description: `数量变化：${mod.partNo} qty ${qtyChange.before ?? '空'} → ${qtyChange.after ?? '空'}`,
      relatedChanges: [mod],
      confidence: 1,
    });
  }
}

function classifyLeftovers(
  removed: BomRowChange[],
  added: BomRowChange[],
  usedRemoved: Set<string>,
  usedAdded: Set<string>,
  results: SemanticChange[]
): void {
  removed.forEach(rem => {
    if (usedRemoved.has(rem.partNo)) return;
    results.push({
      pattern: 'simple_remove',
      description: `删除：${rem.partNo}`,
      relatedChanges: [rem],
      confidence: 1,
    });
  });

  added.forEach(add => {
    if (usedAdded.has(add.partNo)) return;
    results.push({
      pattern: 'simple_add',
      description: `新增：${add.partNo}`,
      relatedChanges: [add],
      confidence: 1,
    });
  });
}

function scoreReplace(
  rem: BomRowChange,
  add: BomRowChange,
  remHint?: ClassifyHint,
  addHint?: ClassifyHint
): number {
  let score = 0;
  if (isSameGroup(remHint, addHint)) score += 3;
  if (isSameSupplier(remHint?.supplier, addHint?.supplier)) score += 2;
  if (isSameUnitKind(remHint?.unit, addHint?.unit)) score += 2;
  if (normalizeText(rem.partName) === normalizeText(add.partName)) score += 2;
  if (Math.abs(rem.rowIndex - add.rowIndex) <= 3) score += 1;
  return score;
}

function scoreWireReplace(
  rem: BomRowChange,
  add: BomRowChange,
  remHint?: ClassifyHint,
  addHint?: ClassifyHint
): number {
  if (!isWireLike(rem, remHint) || !isWireLike(add, addHint)) return 0;

  let score = 0;
  if (isSameGroup(remHint, addHint)) score += 3;
  if (isSameSupplier(remHint?.supplier, addHint?.supplier)) score += 2;
  if (normalizeText(remHint?.unit) === normalizeText(addHint?.unit)) score += 1;

  const remPartBase = stripSpecToken(rem.partNo);
  const addPartBase = stripSpecToken(add.partNo);
  const remNameBase = stripSpecToken(rem.partName);
  const addNameBase = stripSpecToken(add.partName);
  if (remPartBase && remPartBase === addPartBase) score += 3;
  if (remNameBase && remNameBase === addNameBase) score += 2;

  const remSpec = extractSpecToken(rem.partNo) || extractSpecToken(rem.partName);
  const addSpec = extractSpecToken(add.partNo) || extractSpecToken(add.partName);
  if (remSpec && addSpec && remSpec !== addSpec) score += 1;

  return score;
}

function isWireLike(change: BomRowChange, hint?: ClassifyHint): boolean {
  const partName = normalizeText(hint?.partName || change.partName);
  const partNo = normalizeText(change.partNo);
  const unit = normalizeText(hint?.unit);
  return (
    unit === 'M' ||
    unit === '米' ||
    partName.includes('导线') ||
    partName.includes('线') ||
    partNo.includes('FHL') ||
    partNo.includes('WIRE') ||
    partNo.includes('CABLE')
  );
}

function extractSpecToken(text?: string): string {
  const value = normalizeText(text);
  const patterns = [/\d+(?:\.\d+)?MM²/g, /\d+(?:\.\d+)?方/g, /\d+(?:\.\d+)?\/橙/g];
  for (const pattern of patterns) {
    const match = value.match(pattern);
    if (match?.[0]) return match[0];
  }
  return '';
}

function stripSpecToken(text?: string): string {
  return normalizeText(text)
    .replace(/\d+(?:\.\d+)?MM²/g, '')
    .replace(/\d+(?:\.\d+)?方/g, '')
    .replace(/\d+(?:\.\d+)?\/橙/g, '')
    .replace(/[0-9.\-_\/]/g, '');
}

function isSameGroup(a?: ClassifyHint, b?: ClassifyHint): boolean {
  const ag = normalizeText(a?.endGroup || a?.functionText);
  const bg = normalizeText(b?.endGroup || b?.functionText);
  return Boolean(ag && bg && ag === bg);
}

function isSameSupplier(a?: string, b?: string): boolean {
  const left = normalizeText(a);
  const right = normalizeText(b);
  return !left || !right || left === right;
}

function isSameUnitKind(a?: string, b?: string): boolean {
  return isAssemblyUnit(a) === isAssemblyUnit(b);
}

function isAssemblyUnit(unit?: string): boolean {
  const value = normalizeText(unit);
  return value === 'SET' || value === '套' || value === '组';
}

function isComponentUnit(unit?: string): boolean {
  const value = normalizeText(unit);
  return ['PCS', '个', '根', '米', 'M', 'KG', '条'].includes(value);
}

function normalizeText(value?: string): string {
  return String(value ?? '').trim().toUpperCase();
}
