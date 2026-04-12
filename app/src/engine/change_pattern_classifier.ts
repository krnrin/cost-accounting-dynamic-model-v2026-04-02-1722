import type { BomItem } from '@/types/harness';
import type { BomChangeDetectionResult, BomRowChange } from '@/engine/change_detector';

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

export interface SemanticChange {
  pattern: ChangePattern;
  description: string;
  relatedChanges: BomRowChange[];
  confidence: number;
  metadata?: Record<string, unknown>;
}

export interface ClassifyOptions {
  replaceThreshold?: number;
  wireReplaceThreshold?: number;
  qtyExplodeRatio?: number;
}

const DEFAULT_OPTIONS: Required<ClassifyOptions> = {
  replaceThreshold: 5,
  wireReplaceThreshold: 7,
  qtyExplodeRatio: 2.5,
};

function normalizeText(value: string | undefined): string {
  return (value || '').trim().toLowerCase();
}

function parseQty(change: BomRowChange): { before: number | null; after: number | null } {
  const field = change.fieldChanges.find(item => item.field === 'qty');
  const before = field && typeof field.before === 'number' ? field.before : null;
  const after = field && typeof field.after === 'number' ? field.after : null;
  return { before, after };
}

function isAssemblyUnit(unit: string | undefined): boolean {
  const normalized = normalizeText(unit);
  return ['set', 'assy', 'assembly'].includes(normalized);
}

function isComponentUnit(unit: string | undefined): boolean {
  const normalized = normalizeText(unit);
  return ['pc', 'pcs', 'ea', 'm'].includes(normalized);
}

function scoreReplace(
  removed: BomRowChange,
  added: BomRowChange,
  removedHint: ClassifyHint | undefined,
  addedHint: ClassifyHint | undefined
): number {
  let score = 0;
  if (normalizeText(removed.functionText) === normalizeText(added.functionText)) score += 3;
  if (normalizeText(removedHint?.endGroup) === normalizeText(addedHint?.endGroup)) score += 2;
  if (normalizeText(removedHint?.category as string) === normalizeText(addedHint?.category as string)) score += 2;
  if (normalizeText(removed.unit) === normalizeText(added.unit)) score += 1;
  if (normalizeText(removed.supplier) === normalizeText(added.supplier)) score += 1;
  const nameA = normalizeText(removed.partName);
  const nameB = normalizeText(added.partName);
  if (nameA && nameB && (nameA.includes(nameB) || nameB.includes(nameA))) score += 1;
  return score;
}

function scoreWireReplace(
  removed: BomRowChange,
  added: BomRowChange,
  removedHint: ClassifyHint | undefined,
  addedHint: ClassifyHint | undefined
): number {
  const base = scoreReplace(removed, added, removedHint, addedHint);
  const looksWire =
    normalizeText(removedHint?.category as string) === 'wire' ||
    normalizeText(addedHint?.category as string) === 'wire' ||
    normalizeText(removed.partName).includes('wire') ||
    normalizeText(added.partName).includes('wire');
  if (!looksWire) return base;
  const specBefore = removed.fieldChanges.find(f => f.field === 'spec')?.before;
  const specAfter = added.fieldChanges.find(f => f.field === 'spec')?.after;
  const specChanged = String(specBefore || '') !== String(specAfter || '');
  return base + (specChanged ? 2 : 1);
}

function isSameGroup(a: ClassifyHint | undefined, b: ClassifyHint | undefined): boolean {
  if (!a || !b) return false;
  if (normalizeText(a.endGroup) && normalizeText(a.endGroup) === normalizeText(b.endGroup)) return true;
  if (normalizeText(a.functionText) && normalizeText(a.functionText) === normalizeText(b.functionText)) return true;
  return false;
}

export function buildClassifyHints(items: BomItem[]): Map<string, ClassifyHint> {
  const hints = new Map<string, ClassifyHint>();
  items.forEach((item, rowIndex) => {
    hints.set(item.partNo, {
      rowIndex,
      endGroup: item.endGroup,
      category: item.itemCategory,
      unit: item.unit,
      supplier: item.supplier,
      partName: item.partName,
      functionText: item.functionText,
    });
  });
  return hints;
}

export function classifyChangePatterns(
  detection: BomChangeDetectionResult,
  hints: Map<string, ClassifyHint>,
  options: ClassifyOptions = {}
): SemanticChange[] {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const added = detection.changes.filter(change => change.changeType === 'added');
  const removed = detection.changes.filter(change => change.changeType === 'removed');
  const modified = detection.changes.filter(change => change.changeType === 'modified');

  const results: SemanticChange[] = [];
  const usedAdded = new Set<string>();
  const usedRemoved = new Set<string>();

  for (const rem of removed) {
    if (usedRemoved.has(rem.partNo)) continue;
    const remHint = hints.get(rem.partNo);
    if (!isAssemblyUnit(remHint?.unit)) continue;

    const componentAdds = added.filter(add => {
      if (usedAdded.has(add.partNo)) return false;
      return isSameGroup(remHint, hints.get(add.partNo)) && isComponentUnit(hints.get(add.partNo)?.unit);
    });
    if (componentAdds.length < 2) continue;
    results.push({
      pattern: 'split',
      description: `Split: ${rem.partNo} -> ${componentAdds.map(item => item.partNo).join(', ')}`,
      relatedChanges: [rem, ...componentAdds],
      confidence: 0.95,
    });
    usedRemoved.add(rem.partNo);
    componentAdds.forEach(item => usedAdded.add(item.partNo));
  }

  for (const add of added) {
    if (usedAdded.has(add.partNo)) continue;
    const addHint = hints.get(add.partNo);
    if (!isAssemblyUnit(addHint?.unit)) continue;

    const componentRemoves = removed.filter(rem => {
      if (usedRemoved.has(rem.partNo)) return false;
      return isSameGroup(addHint, hints.get(rem.partNo)) && isComponentUnit(hints.get(rem.partNo)?.unit);
    });
    if (componentRemoves.length < 2) continue;
    results.push({
      pattern: 'merge',
      description: `Merge: ${componentRemoves.map(item => item.partNo).join(', ')} -> ${add.partNo}`,
      relatedChanges: [...componentRemoves, add],
      confidence: 0.9,
    });
    usedAdded.add(add.partNo);
    componentRemoves.forEach(item => usedRemoved.add(item.partNo));
  }

  for (const rem of removed) {
    if (usedRemoved.has(rem.partNo)) continue;
    let best: BomRowChange | null = null;
    let bestScore = -1;
    const remHint = hints.get(rem.partNo);

    for (const add of added) {
      if (usedAdded.has(add.partNo)) continue;
      const addHint = hints.get(add.partNo);
      const wireScore = scoreWireReplace(rem, add, remHint, addHint);
      if (wireScore > bestScore) {
        bestScore = wireScore;
        best = add;
      }
    }

    if (best && bestScore >= opts.wireReplaceThreshold) {
      results.push({
        pattern: 'wire_spec_replace',
        description: `Wire replace: ${rem.partNo} -> ${best.partNo}`,
        relatedChanges: [rem, best],
        confidence: 0.88,
      });
      usedRemoved.add(rem.partNo);
      usedAdded.add(best.partNo);
      continue;
    }

    best = null;
    bestScore = -1;
    for (const add of added) {
      if (usedAdded.has(add.partNo)) continue;
      const score = scoreReplace(rem, add, hints.get(rem.partNo), hints.get(add.partNo));
      if (score > bestScore) {
        bestScore = score;
        best = add;
      }
    }
    if (best && bestScore >= opts.replaceThreshold) {
      results.push({
        pattern: 'replace',
        description: `Replace: ${rem.partNo} -> ${best.partNo}`,
        relatedChanges: [rem, best],
        confidence: 0.85,
      });
      usedRemoved.add(rem.partNo);
      usedAdded.add(best.partNo);
    }
  }

  for (const mod of modified) {
    const qty = parseQty(mod);
    if (qty.before !== null && qty.after !== null && qty.before !== qty.after) {
      const ratio = qty.before === 0 ? Number.POSITIVE_INFINITY : qty.after / qty.before;
      if (ratio >= opts.qtyExplodeRatio) {
        results.push({
          pattern: 'qty_explode',
          description: `Qty explode: ${mod.partNo} ${qty.before} -> ${qty.after}`,
          relatedChanges: [mod],
          confidence: 0.9,
          metadata: { beforeQty: qty.before, afterQty: qty.after, ratio },
        });
      } else {
        results.push({
          pattern: 'qty_change',
          description: `Qty change: ${mod.partNo} ${qty.before} -> ${qty.after}`,
          relatedChanges: [mod],
          confidence: 0.92,
          metadata: { beforeQty: qty.before, afterQty: qty.after, ratio },
        });
      }
      continue;
    }

    results.push({
      pattern: 'field_modify',
      description: `Field modify: ${mod.partNo}`,
      relatedChanges: [mod],
      confidence: 0.8,
    });
  }

  for (const rem of removed) {
    if (usedRemoved.has(rem.partNo)) continue;
    results.push({
      pattern: 'simple_remove',
      description: `Remove: ${rem.partNo}`,
      relatedChanges: [rem],
      confidence: 0.75,
    });
  }

  for (const add of added) {
    if (usedAdded.has(add.partNo)) continue;
    results.push({
      pattern: 'simple_add',
      description: `Add: ${add.partNo}`,
      relatedChanges: [add],
      confidence: 0.75,
    });
  }

  return results.sort((a, b) => {
    if (b.confidence !== a.confidence) return b.confidence - a.confidence;
    return a.description.localeCompare(b.description);
  });
}

