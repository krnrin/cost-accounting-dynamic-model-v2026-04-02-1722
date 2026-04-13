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
  | 'fixed_length'      // 散裁→定长件 (如波纹管定长化)
  | 'segmented_length'  // 分段定长 (如1m→3×0.3m)
  | 'cross_sheet_inconsistency'  // 跨sheet不一致
  | 'unknown';

export interface ClassifyHint {
  partNo: string;
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

// ── 跨sheet一致性验证 ─────────────────────────────────────────────────────────

export type CrossSheetIssueType =
  | 'missing_in_assembly_sheet'   // 在KSK明细中有，总成散件清单没有
  | 'missing_in_ksk_sheet'        // 在总成清单有，KSK中没有
  | 'price_mismatch'              // 同物料在不同sheet中单价不一致
  | 'qty_mismatch'                // 同物料在不同sheet中数量不一致
  | 'duplicate_in_ksk';           // KSK中同一物料出现多次

export interface CrossSheetIssue {
  type: CrossSheetIssueType;
  assemblyNo: string;
  partNo: string;
  partName: string;
  presentIn: string[];
  missingIn: string[];
  kskQty?: number;
  assemblyQty?: number;
  kskPrice?: number;
  assemblyPrice?: number;
  impact: CostImpact;
  recommendedAction: string;
  /** 置信度 0-1 */
  confidence: number;
  /** 单位类型推断 */
  unitType?: {
    inKsk?: 'assembly' | 'component' | 'unknown';
    inAssembly?: 'assembly' | 'component' | 'unknown';
    mismatch?: boolean;
  };
  /** 供应商检查 */
  supplierCheck?: {
    kskSupplier?: string;
    assemblySupplier?: string;
    inferredRelationship?: 'same' | 'different' | 'unknown';
  };
  /** 语义推断 */
  semanticInference?: {
    likelyPattern?: ChangePattern;
    relatedPartNo?: string;  // 疑似替换/关联的物料号
    evidence: string[];      // 推断依据
  };
}

export interface CostImpact {
  amount: number;
  currency: string;
  description: string;
}

export interface CrossSheetValidationResult {
  assemblyNo: string;
  assemblyName?: string;
  issues: CrossSheetIssue[];
  summary: {
    totalIssues: number;
    totalImpact: number;
    missingItems: number;
    priceMismatches: number;
  };
}

export interface BomSheetData {
  sheetName: string;
  items: BomItem[];
}

export interface BomCrossSheetDiffRequest {
  harnessId: string;
  harnessName: string;
  sheets: BomSheetData[];
  sheetPairs?: Array<[string, string]>;  // 需要对比的sheet对，默认 [['KSK线束BOM明细', '总成散件清单']]
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
  classifyWireSpecReplace(removed, added, hints, usedRemoved, usedAdded, results, mergedOptions.wireReplaceThreshold);
  classifyReplace(removed, added, hints, usedRemoved, usedAdded, results, mergedOptions.replaceThreshold);
  classifyModified(modified, results);
  classifyFixedLength(removed, added, hints, usedRemoved, usedAdded, results);
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
      partNo: item.partNo,
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

function classifySplit(removed: BomRowChange[], added: BomRowChange[], hints: Map<string, ClassifyHint>, usedRemoved: Set<string>, usedAdded: Set<string>, results: SemanticChange[]): void {
  for (const rem of removed) {
    if (usedRemoved.has(rem.partNo)) continue;
    const remHint = hints.get(rem.partNo);
    if (!isAssemblyUnit(remHint?.unit)) continue;
    const sameGroupAdded = added.filter(add => !usedAdded.has(add.partNo) && isSameGroup(remHint, hints.get(add.partNo)));
    const componentAdds = sameGroupAdded.filter(add => isComponentUnit(hints.get(add.partNo)?.unit));
    if (componentAdds.length < 2) continue;
    const removedSupplier = normalizeText(remHint?.supplier);
    const allInheritedOrUnknown = componentAdds.every(add => {
      const supplier = normalizeText(hints.get(add.partNo)?.supplier);
      return !removedSupplier || !supplier || supplier === removedSupplier;
    });
    results.push({
      pattern: 'split',
      description: `总成拆散件：${rem.partNo}(${rem.partName}) → ${componentAdds.length}个散件`,
      relatedChanges: [rem, ...componentAdds],
      confidence: allInheritedOrUnknown ? 0.98 : 0.95,
      supplierCheck: {
        assemblySupplier: remHint?.supplier,
        allInheritedOrUnknown,
        rows: componentAdds.map(add => {
          const supplier = hints.get(add.partNo)?.supplier;
          return {
            partNo: add.partNo,
            supplier,
            inheritsAssemblySupplier: !removedSupplier || !normalizeText(supplier) || normalizeText(supplier) === removedSupplier,
          };
        }),
      },
    });
    usedRemoved.add(rem.partNo);
    componentAdds.forEach(add => usedAdded.add(add.partNo));
  }
}

function classifyMerge(removed: BomRowChange[], added: BomRowChange[], hints: Map<string, ClassifyHint>, usedRemoved: Set<string>, usedAdded: Set<string>, results: SemanticChange[]): void {
  for (const add of added) {
    if (usedAdded.has(add.partNo)) continue;
    const addHint = hints.get(add.partNo);
    if (!isAssemblyUnit(addHint?.unit)) continue;
    const sameGroupRemoved = removed.filter(rem => !usedRemoved.has(rem.partNo) && isSameGroup(addHint, hints.get(rem.partNo)));
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

function classifyWireSpecReplace(removed: BomRowChange[], added: BomRowChange[], hints: Map<string, ClassifyHint>, usedRemoved: Set<string>, usedAdded: Set<string>, results: SemanticChange[], threshold: number): void {
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

function classifyReplace(removed: BomRowChange[], added: BomRowChange[], hints: Map<string, ClassifyHint>, usedRemoved: Set<string>, usedAdded: Set<string>, results: SemanticChange[], threshold: number): void {
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
      results.push({ pattern: 'field_modify', description: `字段修改：${mod.partNo}`, relatedChanges: [mod], confidence: 1 });
      continue;
    }
    const before = Number(qtyChange.before ?? NaN);
    const after = Number(qtyChange.after ?? NaN);
    if (!Number.isNaN(before) && !Number.isNaN(after) && before > 0 && after / before >= 4) {
      results.push({ pattern: 'qty_explode', description: `数量炸开：${mod.partNo} qty ${before} → ${after}`, relatedChanges: [mod], confidence: 0.6 });
      continue;
    }
    results.push({ pattern: 'qty_change', description: `数量变化：${mod.partNo} qty ${qtyChange.before ?? '空'} → ${qtyChange.after ?? '空'}`, relatedChanges: [mod], confidence: 1 });
  }
}

/**
 * 定长化分类：识别波纹管/胶带等从散裁(M)到定长件(PCS)的变更
 * 场景1: 0.86M → 1PCS (定长化)
 * 场景2: 1M×1根 → 0.3M×3根 (分段定长)
 */
function classifyFixedLength(
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

    // 只处理波纹管、胶带、套管等可定长物料
    if (!isFixedLengthMaterial(remHint)) continue;

    // 查找同组的新增物料
    const candidates = added.filter(add => {
      if (usedAdded.has(add.partNo)) return false;
      const addHint = hints.get(add.partNo);
      // 检查是否是同类物料（名称相似或零件号前缀相同）
      return isSameMaterialFamily(rem.partNo, remHint, add.partNo, addHint);
    });

    if (candidates.length === 0) continue;

    // 场景1: 一换一（定长化）
    if (candidates.length === 1) {
      const add = candidates[0];
      if (!add) continue;
      const addHint = hints.get(add.partNo);

      // 检查单位变化：M→PCS 且数量变为1或整数
      const remUnit = normalizeText(remHint?.unit);
      const addUnit = normalizeText(addHint?.unit);
      const qtyField = add.fieldChanges.find(f => f.field === 'qty');
      const newQty = Number(qtyField?.after ?? 1);

      if (remUnit === 'M' && addUnit === 'PCS' && Number.isInteger(newQty)) {
        // 提取长度信息
        const remLength = extractLengthFromPartNo(rem.partNo) || extractLengthFromQty(rem.fieldChanges.find(f => f.field === 'qty')?.before);
        const addLength = extractLengthFromPartNo(add.partNo);

        results.push({
          pattern: 'fixed_length',
          description: `定长化：${rem.partNo}(${remLength || '散裁'}) → ${add.partNo}(${addLength || '定长'})`,
          relatedChanges: [rem, add],
          confidence: 0.92,
          metadata: {
            beforeLength: remLength,
            afterLength: addLength,
            beforeUnit: 'M',
            afterUnit: 'PCS',
            type: '散裁→定长件',
          },
        });
        usedRemoved.add(rem.partNo);
        usedAdded.add(add.partNo);
        continue;
      }
    }

    // 场景2: 一分多（分段定长）
    // 如：1M×1根 → 0.3M×3根
    if (candidates.length >= 2) {
      const addHints = candidates.map(c => hints.get(c.partNo));
      const firstCandidate = candidates[0];
      const allSamePartBase = firstCandidate && addHints.every(_h => {
        const base = stripLengthSuffix(firstCandidate.partNo);
        return stripLengthSuffix(firstCandidate.partNo) === base;
      });

      // 检查是否都是PCS且数量总和接近原长度
      const remQtyField = rem.fieldChanges.find(f => f.field === 'qty');
      const remQty = Number(remQtyField?.before ?? 1);
      const remUnit = normalizeText(remHint?.unit);

      let totalNewQty = 0;
      const allPcs = candidates.every(c => {
        const h = hints.get(c.partNo);
        const qty = Number(c.fieldChanges.find(f => f.field === 'qty')?.after ?? 1);
        totalNewQty += qty;
        return normalizeText(h?.unit) === 'PCS';
      });

      // 如果原单位是M，新单位都是PCS，且新零件号相似
      if (remUnit === 'M' && allPcs && allSamePartBase && firstCandidate) {
        const segLength = extractLengthFromPartNo(firstCandidate.partNo);
        results.push({
          pattern: 'segmented_length',
          description: `分段定长：${rem.partNo}(${remQty}M×1根) → ${candidates.length}×${segLength || '定长段'}`,
          relatedChanges: [rem, ...candidates],
          confidence: 0.88,
          metadata: {
            originalLength: remQty,
            segmentCount: candidates.length,
            segmentLength: segLength,
            totalQuantity: totalNewQty,
            type: '整根→分段',
          },
        });
        usedRemoved.add(rem.partNo);
        candidates.forEach(c => usedAdded.add(c.partNo));
      }
    }
  }
}

function classifyLeftovers(removed: BomRowChange[], added: BomRowChange[], usedRemoved: Set<string>, usedAdded: Set<string>, results: SemanticChange[]): void {
  removed.forEach(rem => { if (!usedRemoved.has(rem.partNo)) results.push({ pattern: 'simple_remove', description: `删除：${rem.partNo}`, relatedChanges: [rem], confidence: 1 }); });
  added.forEach(add => { if (!usedAdded.has(add.partNo)) results.push({ pattern: 'simple_add', description: `新增：${add.partNo}`, relatedChanges: [add], confidence: 1 }); });
}

function scoreReplace(rem: BomRowChange, add: BomRowChange, remHint?: ClassifyHint, addHint?: ClassifyHint): number {
  let score = 0;
  if (isSameGroup(remHint, addHint)) score += 3;
  if (isSameSupplier(remHint?.supplier, addHint?.supplier)) score += 2;
  if (isSameUnitKind(remHint?.unit, addHint?.unit)) score += 2;
  if (normalizeText(rem.partName) === normalizeText(add.partName)) score += 2;
  if (Math.abs(rem.rowIndex - add.rowIndex) <= 3) score += 1;
  return score;
}

function scoreWireReplace(rem: BomRowChange, add: BomRowChange, remHint?: ClassifyHint, addHint?: ClassifyHint): number {
  let score = 0;
  const wireLikePair = isWireLike(rem, remHint) && isWireLike(add, addHint);
  const sameGroup = isSameGroup(remHint, addHint);
  const sameSupplier = isSameSupplier(remHint?.supplier, addHint?.supplier);
  const sameUnit = normalizeText(remHint?.unit) === normalizeText(addHint?.unit);
  if (!wireLikePair && !(sameGroup && sameSupplier && sameUnit)) return 0;
  if (sameGroup) score += 3;
  if (sameSupplier) score += 2;
  if (sameUnit) score += 1;
  const remPartBase = stripSpecToken(rem.partNo);
  const addPartBase = stripSpecToken(add.partNo);
  const remNameBase = stripSpecToken(rem.partName);
  const addNameBase = stripSpecToken(add.partName);
  if (remPartBase && remPartBase === addPartBase) score += 3;
  if (remNameBase && remNameBase === addNameBase) score += 2;
  const remSpec = extractSpecToken(rem.partNo) || extractSpecToken(rem.partName);
  const addSpec = extractSpecToken(add.partNo) || extractSpecToken(add.partName);
  if (remSpec && addSpec && remSpec !== addSpec) score += 1;
  if (!wireLikePair && sameGroup && sameSupplier && sameUnit) score += 2;
  return score;
}

function isWireLike(change: BomRowChange, hint?: ClassifyHint): boolean {
  const partName = normalizeText(hint?.partName || change.partName);
  const partNo = normalizeText(change.partNo);
  const unit = normalizeText(hint?.unit);
  return unit === 'M' || unit === '米' || partName.includes('导线') || partName.includes('线') || partNo.includes('FHL') || partNo.includes('WIRE') || partNo.includes('CABLE');
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
  return normalizeText(text).replace(/\d+(?:\.\d+)?MM²/g, '').replace(/\d+(?:\.\d+)?方/g, '').replace(/\d+(?:\.\d+)?\/橙/g, '').replace(/[0-9.\-_\/]/g, '');
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

function isSameUnitKind(a?: string, b?: string): boolean { return isAssemblyUnit(a) === isAssemblyUnit(b); }
function isAssemblyUnit(unit?: string): boolean { const value = normalizeText(unit); return value === 'SET' || value === '套' || value === '组'; }
function isComponentUnit(unit?: string): boolean { const value = normalizeText(unit); return ['PCS', '个', '根', '米', 'M', 'KG', '条'].includes(value); }
function normalizeText(value?: string): string { return String(value ?? '').trim().toUpperCase(); }

// ── 定长化识别辅助函数 ─────────────────────────────────────────────────────────

/** 判断是否是可定长物料（波纹管、编织套管、自卷管等管类，不含胶带） */
function isFixedLengthMaterial(hint?: ClassifyHint): boolean {
  if (!hint) return false;
  const name = normalizeText(hint.partName);
  const partNo = normalizeText(hint.partNo);
  const category = normalizeText(hint.category);

  // 排除胶带类（不会定长）
  if (name.includes('胶带') || name.includes('胶布')) return false;

  // 管类物料关键词（可定长裁切）
  const tubeMaterials = ['波纹管', '套管', '热缩管', '编织套管', '编织管', '自卷管', '缠绕管', '软管', '保护管'];
  if (tubeMaterials.some(kw => name.includes(kw))) return true;

  // 按零件号前缀判断（常见波纹管型号）
  // LG=螺冠, PP=波纹管, SCS=编织套管, AD/PA/PE=尼龙管
  const tubePrefixes = ['LG', 'PP', 'SCS', 'AD', 'PA', 'PE'];
  if (tubePrefixes.some(p => partNo.startsWith(p)) && name.includes('管')) return true;

  // 按分类判断（只保留套管类，排除胶带类）
  if (category === 'tape_tube' && !name.includes('胶带') && !name.includes('胶布')) return true;

  return false;
}

/** 判断两个零件是否属于同一家族（可互相替换定长） */
function isSameMaterialFamily(partNo1: string, hint1?: ClassifyHint, partNo2?: string, hint2?: ClassifyHint): boolean {
  if (!partNo2) return false;

  // 基础型号相同（去除长度后缀后）
  const base1 = stripLengthSuffix(partNo1);
  const base2 = stripLengthSuffix(partNo2);
  if (base1 === base2) return true;

  // 名称相似度（去除规格数字后）
  const name1 = normalizeText(hint1?.partName).replace(/\d+(?:\.\d+)?/g, '');
  const name2 = normalizeText(hint2?.partName).replace(/\d+(?:\.\d+)?/g, '');
  if (name1 && name1 === name2) return true;

  return false;
}

/** 从零件号中提取长度信息（如 LG3305D012BL0803 → 800mm/0.8m） */
function extractLengthFromPartNo(partNo?: string): string | null {
  if (!partNo) return null;
  const normalized = normalizeText(partNo);

  // 匹配 L + 4位数字（如 L0803 = 800mm或803mm）
  const match4 = normalized.match(/L(\d{4})$/);
  if (match4) {
    const len = parseInt(match4[1]!, 10);
    // 判断是mm还是cm：>500通常是mm，<50通常是cm
    if (len > 500) return `${(len / 1000).toFixed(2)}m`;
    if (len > 50) return `${len}cm`;
    return `${len}mm`;
  }

  // 匹配 L + 3位数字
  const match3 = normalized.match(/L(\d{3})$/);
  if (match3) {
    const len = parseInt(match3[1]!, 10);
    return len > 100 ? `${(len / 10).toFixed(1)}cm` : `${len}mm`;
  }

  // 匹配末尾的数字（如 LG3305D012B_0.8M）
  const matchM = normalized.match(/(\d+(?:\.\d+)?)M?$/);
  if (matchM) return `${matchM[1]}m`;

  return null;
}

/** 从数量字段提取长度 */
function extractLengthFromQty(qty?: string | number | boolean | null): string | null {
  if (qty === undefined || qty === null || typeof qty === 'boolean') return null;
  const val = Number(qty);
  if (Number.isNaN(val)) return null;
  return val >= 1 ? `${val}m` : `${(val * 100).toFixed(0)}cm`;
}

/** 去除零件号中的长度后缀（用于比较基础型号） */
function stripLengthSuffix(partNo?: string): string {
  if (!partNo) return '';
  return normalizeText(partNo)
    .replace(/L\d{3,4}$/, '')     // 去除 L0803, L800 等
    .replace(/[_-]?\d+\.?\d*M?$/i, '')  // 去除末尾的长度标记
    .replace(/\d{2,4}MM$/i, '');  // 去除 MM 单位
}

// ── 跨sheet一致性验证实现 ─────────────────────────────────────────────────────

/**
 * 验证跨sheet BOM一致性
 * 检测同一总成在不同sheet中的物料是否一致
 */
export function validateCrossSheetConsistency(
  request: BomCrossSheetDiffRequest
): CrossSheetValidationResult[] {
  const { sheets, sheetPairs = [['KSK线束BOM明细', '总成散件清单']] } = request;
  const results: CrossSheetValidationResult[] = [];

  // 构建sheet索引
  const sheetMap = new Map<string, BomItem[]>();
  for (const sheet of sheets) {
    sheetMap.set(sheet.sheetName, sheet.items);
  }

  // 对每个sheet对进行验证
  for (const [sheetAName, sheetBName] of sheetPairs) {
    const sheetA = sheetMap.get(sheetAName);
    const sheetB = sheetMap.get(sheetBName);

    if (!sheetA || !sheetB) {
      console.warn(`[validateCrossSheetConsistency] Sheet not found: ${sheetAName} or ${sheetBName}`);
      continue;
    }

    // 按总成分组
    const assemblyGroupsA = groupByAssembly(sheetA);
    const assemblyGroupsB = groupByAssembly(sheetB);

    // 获取所有总成编号
    const allAssemblies = new Set([
      ...Array.from(assemblyGroupsA.keys()),
      ...Array.from(assemblyGroupsB.keys()),
    ]);

    for (const assemblyNo of allAssemblies) {
      const itemsA = assemblyGroupsA.get(assemblyNo) || [];
      const itemsB = assemblyGroupsB.get(assemblyNo) || [];

      const issues = detectAssemblyInconsistencies(
        assemblyNo,
        itemsA,
        itemsB,
        sheetAName,
        sheetBName
      );

      if (issues.length > 0) {
        const assemblyName = itemsA[0]?.assemblyName || itemsB[0]?.assemblyName;
        const totalImpact = issues.reduce((sum, issue) => sum + issue.impact.amount, 0);

        results.push({
          assemblyNo,
          assemblyName,
          issues,
          summary: {
            totalIssues: issues.length,
            totalImpact,
            missingItems: issues.filter(i =>
              i.type === 'missing_in_assembly_sheet' || i.type === 'missing_in_ksk_sheet'
            ).length,
            priceMismatches: issues.filter(i => i.type === 'price_mismatch').length,
          },
        });
      }
    }
  }

  return results.sort((a, b) => b.summary.totalImpact - a.summary.totalImpact);
}

/**
 * 按总成编号分组物料
 */
function groupByAssembly(items: BomItem[]): Map<string, BomItem[]> {
  const groups = new Map<string, BomItem[]>();

  for (const item of items) {
    // 总成编号可能存储在不同字段，需要兼容处理
    const assemblyNo = item.assemblyNo || item.harnessNo || item.kskNo;
    if (!assemblyNo) continue;

    const key = normalizeText(assemblyNo);
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(item);
  }

  return groups;
}

/**
 * 检测单个总成的跨sheet不一致
 */
function detectAssemblyInconsistencies(
  assemblyNo: string,
  itemsA: BomItem[],
  itemsB: BomItem[],
  sheetAName: string,
  sheetBName: string
): CrossSheetIssue[] {
  const issues: CrossSheetIssue[] = [];

  // 构建物料索引（按物料编号）
  const indexA = buildPartIndex(itemsA);
  const indexB = buildPartIndex(itemsB);

  // 获取所有物料编号
  const allParts = new Set([...indexA.keys(), ...indexB.keys()]);

  for (const partNo of allParts) {
    const itemsInA = indexA.get(partNo) || [];
    const itemsInB = indexB.get(partNo) || [];
    const itemA = itemsInA[0];
    const itemB = itemsInB[0];

    // 计算单位类型
    const unitTypeA = getUnitType(itemA?.unit);
    const unitTypeB = getUnitType(itemB?.unit);

    // 检测缺失
    if (itemsInA.length > 0 && itemsInB.length === 0) {
      // 在A中有，B中没有
      const item = itemA!;
      const isKSK = sheetAName.includes('KSK');

      // 构建基础issue（不含confidence）
      const baseIssue: Omit<CrossSheetIssue, 'confidence'> = {
        type: isKSK ? 'missing_in_assembly_sheet' : 'missing_in_ksk_sheet',
        assemblyNo,
        partNo,
        partName: item.partName || item.itemName || '未知',
        presentIn: [sheetAName],
        missingIn: [sheetBName],
        kskQty: isKSK ? getTotalQty(itemsInA) : undefined,
        kskPrice: isKSK ? getUnitPrice(itemA) : undefined,
        impact: calculateImpact(itemsInA),
        recommendedAction: isKSK
          ? `补充 ${partNo} 到 ${sheetBName}，或从 ${sheetAName} 中删除`
          : `检查 ${partNo} 是否应从 ${sheetAName} 添加到 ${sheetBName}`,
        unitType: isKSK
          ? { inKsk: unitTypeA, inAssembly: unitTypeB, mismatch: unitTypeA !== unitTypeB }
          : { inKsk: unitTypeB, inAssembly: unitTypeA, mismatch: unitTypeA !== unitTypeB },
        supplierCheck: isKSK
          ? { kskSupplier: item.supplier }
          : { assemblySupplier: item.supplier },
      };

      // 计算置信度
      const confidence = calculateCrossSheetConfidence(baseIssue, issues, itemsA, itemsB);

      issues.push({
        ...baseIssue,
        confidence,
        recommendedAction: generateSemanticChangeDescription({ ...baseIssue, confidence }).action,
      });
      continue;
    }

    if (itemsInA.length === 0 && itemsInB.length > 0) {
      // 在B中有，A中没有
      const item = itemB!;
      const isKSK = sheetBName.includes('KSK');

      const baseIssue: Omit<CrossSheetIssue, 'confidence'> = {
        type: isKSK ? 'missing_in_assembly_sheet' : 'missing_in_ksk_sheet',
        assemblyNo,
        partNo,
        partName: item.partName || item.itemName || '未知',
        presentIn: [sheetBName],
        missingIn: [sheetAName],
        assemblyQty: isKSK ? undefined : getTotalQty(itemsInB),
        assemblyPrice: isKSK ? undefined : getUnitPrice(itemB),
        impact: calculateImpact(itemsInB),
        recommendedAction: isKSK
          ? `补充 ${partNo} 到 ${sheetAName}，或从 ${sheetBName} 中删除`
          : `检查 ${partNo} 是否应从 ${sheetBName} 添加到 ${sheetAName}`,
        unitType: isKSK
          ? { inKsk: unitTypeB, inAssembly: unitTypeA, mismatch: unitTypeA !== unitTypeB }
          : { inKsk: unitTypeA, inAssembly: unitTypeB, mismatch: unitTypeA !== unitTypeB },
        supplierCheck: isKSK
          ? { kskSupplier: item.supplier }
          : { assemblySupplier: item.supplier },
      };

      const confidence = calculateCrossSheetConfidence(baseIssue, issues, itemsA, itemsB);

      issues.push({
        ...baseIssue,
        confidence,
        recommendedAction: generateSemanticChangeDescription({ ...baseIssue, confidence }).action,
      });
      continue;
    }

    // 检测数量不一致
    const qtyA = getTotalQty(itemsInA);
    const qtyB = getTotalQty(itemsInB);
    if (Math.abs(qtyA - qtyB) > 0.001) {
      const baseIssue: Omit<CrossSheetIssue, 'confidence'> = {
        type: 'qty_mismatch',
        assemblyNo,
        partNo,
        partName: itemA?.partName || '未知',
        presentIn: [sheetAName, sheetBName],
        missingIn: [],
        kskQty: sheetAName.includes('KSK') ? qtyA : qtyB,
        assemblyQty: sheetAName.includes('KSK') ? qtyB : qtyA,
        impact: calculatePriceImpact(itemA, Math.abs(qtyA - qtyB)),
        recommendedAction: `核对 ${partNo} 数量：${sheetAName}=${qtyA}, ${sheetBName}=${qtyB}`,
      };

      const confidence = calculateCrossSheetConfidence(baseIssue, issues, itemsA, itemsB);

      issues.push({ ...baseIssue, confidence });
    }

    // 检测价格不一致
    const priceA = getUnitPrice(itemA);
    const priceB = getUnitPrice(itemB);
    if (priceA > 0 && priceB > 0 && Math.abs(priceA - priceB) > 0.01) {
      const baseIssue: Omit<CrossSheetIssue, 'confidence'> = {
        type: 'price_mismatch',
        assemblyNo,
        partNo,
        partName: itemA?.partName || '未知',
        presentIn: [sheetAName, sheetBName],
        missingIn: [],
        kskPrice: sheetAName.includes('KSK') ? priceA : priceB,
        assemblyPrice: sheetAName.includes('KSK') ? priceB : priceA,
        impact: {
          amount: Math.abs(priceA - priceB) * Math.max(qtyA, qtyB),
          currency: 'CNY',
          description: `单价差异: ${Math.abs(priceA - priceB).toFixed(2)}元`,
        },
        recommendedAction: `统一 ${partNo} 单价：${sheetAName}=${priceA}, ${sheetBName}=${priceB}`,
      };

      const confidence = calculateCrossSheetConfidence(baseIssue, issues, itemsA, itemsB);

      issues.push({ ...baseIssue, confidence });
    }

    // 检测KSK中重复
    if (sheetAName.includes('KSK') && itemsInA.length > 1) {
      const baseIssue: Omit<CrossSheetIssue, 'confidence'> = {
        type: 'duplicate_in_ksk',
        assemblyNo,
        partNo,
        partName: itemA?.partName || '未知',
        presentIn: [sheetAName],
        missingIn: [],
        kskQty: getTotalQty(itemsInA),
        impact: calculateImpact(itemsInA.slice(1)), // 重复部分的金额
        recommendedAction: `${partNo} 在 ${sheetAName} 中出现 ${itemsInA.length} 次，请检查是否需要合并`,
      };

      const confidence = 0.95; // 重复检测是确定的

      issues.push({ ...baseIssue, confidence });
    }
  }

  return issues;
}

/**
 * 构建物料索引（一个物料编号可能对应多行）
 */
function buildPartIndex(items: BomItem[]): Map<string, BomItem[]> {
  const index = new Map<string, BomItem[]>();

  for (const item of items) {
    const partNo = normalizeText(item.partNo || item.itemNo || '');
    if (!partNo) continue;

    if (!index.has(partNo)) {
      index.set(partNo, []);
    }
    index.get(partNo)!.push(item);
  }

  return index;
}

/**
 * 获取总数量
 */
function getTotalQty(items: BomItem[]): number {
  return items.reduce((sum, item) => {
    const qty = Number(item.qty || item.quantity || 0);
    return sum + (Number.isNaN(qty) ? 0 : qty);
  }, 0);
}

/**
 * 获取单价
 */
function getUnitPrice(item?: BomItem): number {
  if (!item) return 0;
  const price = Number(item.unitPrice || item.price || 0);
  return Number.isNaN(price) ? 0 : price;
}

/**
 * 计算影响金额
 */
function calculateImpact(items: BomItem[]): CostImpact {
  const amount = items.reduce((sum, item) => {
    const qty = Number(item.qty || item.quantity || 0);
    const price = Number(item.unitPrice || item.price || 0);
    return sum + qty * price;
  }, 0);

  return {
    amount: Number(amount.toFixed(4)),
    currency: 'CNY',
    description: `涉及金额: ${amount.toFixed(2)}元`,
  };
}

/**
 * 计算价格差异影响
 */
function calculatePriceImpact(item: BomItem | undefined, qtyDiff: number): CostImpact {
  if (!item) {
    return { amount: 0, currency: 'CNY', description: '无价格数据' };
  }

  const price = Number(item.unitPrice || item.price || 0);
  const amount = price * qtyDiff;

  return {
    amount: Number(amount.toFixed(4)),
    currency: 'CNY',
    description: `数量差异 ${qtyDiff} × 单价 ${price} = ${amount.toFixed(2)}元`,
  };
}

/**
 * 将跨sheet问题转换为语义变更（用于统一输出）
 */
export function crossSheetIssuesToSemanticChanges(
  results: CrossSheetValidationResult[]
): SemanticChange[] {
  const changes: SemanticChange[] = [];

  for (const result of results) {
    for (const issue of result.issues) {
      const display = PATTERN_DISPLAY[issue.type];
      const { title, detail, action } = generateSemanticChangeDescription(issue);

      // 根据置信度确定pattern
      let pattern: ChangePattern = 'cross_sheet_inconsistency';
      if (issue.semanticInference?.likelyPattern === 'replace') {
        pattern = 'replace';
      } else if (issue.semanticInference?.likelyPattern === 'split') {
        pattern = 'split';
      } else if (issue.semanticInference?.likelyPattern === 'merge') {
        pattern = 'merge';
      }

      // 置信度标签
      const confBadge = issue.confidence >= 0.9 ? '【高】' :
                       issue.confidence >= 0.7 ? '【中】' : '【低】';

      changes.push({
        pattern,
        description: `${display.icon} ${title} ${confBadge}`,
        relatedChanges: [], // 跨sheet问题不涉及行级变更
        confidence: issue.confidence,
        metadata: {
          crossSheetIssue: issue,
          assemblyNo: issue.assemblyNo,
          detail,           // 详细描述
          recommendedAction: action,  // 推荐操作
          unitType: issue.unitType,   // 单位类型
          supplierCheck: issue.supplierCheck, // 供应商检查
        },
      });
    }
  }

  return changes.sort((a, b) => b.confidence - a.confidence);
}

/**
 * 生成跨sheet差异报告（用于前端展示）
 */
export function generateCrossSheetReport(
  results: CrossSheetValidationResult[]
): {
  summary: string;
  semanticSummaries: string[]; // 每个总成的语义化摘要
  totalIssues: number;
  totalImpact: number;
  criticalIssues: CrossSheetIssue[];
  details: CrossSheetValidationResult[];
} {
  const totalIssues = results.reduce((sum, r) => sum + r.issues.length, 0);
  const totalImpact = results.reduce((sum, r) => sum + r.summary.totalImpact, 0);

  // 找出高影响问题（金额>10元）
  const criticalIssues = results
    .flatMap(r => r.issues)
    .filter(i => i.impact.amount > 10)
    .sort((a, b) => b.impact.amount - a.impact.amount);

  // 按总成生成语义化摘要
  const semanticSummaries = results.map(r => enrichValidationResult(r).semanticSummary);

  // 统计各类型问题
  const typeCount: Record<string, number> = {};
  for (const r of results) {
    for (const i of r.issues) {
      const pattern = i.semanticInference?.likelyPattern || i.type;
      typeCount[pattern] = (typeCount[pattern] || 0) + 1;
    }
  }

  // 构建摘要
  const typeSummary = Object.entries(typeCount)
    .map(([type, count]) => `${PATTERN_DISPLAY[type as CrossSheetIssueType]?.label || type}${count}个`)
    .join('，');

  const summary = `📊 BOM跨表一致性检查完成\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `总计：${totalIssues} 个问题，影响 ${results.length} 个总成，金额 ${totalImpact.toFixed(2)} 元\n` +
    `类型分布：${typeSummary}\n` +
    `⚠️ 高影响问题：${criticalIssues.length} 个需优先处理\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━`;

  return {
    summary,
    semanticSummaries, // 每个总成的详细语义摘要
    totalIssues,
    totalImpact,
    criticalIssues,
    details: results,
  };
}

// ── 语义化升级：置信度评分、单位类型、推断关系 ─────────────────────────────────────

/** 单位类型 */
export type UnitType = 'assembly' | 'component' | 'unknown';

/** 获取单位类型 */
export function getUnitType(unit?: string): UnitType {
  if (!unit) return 'unknown';
  const u = normalizeText(unit);
  if (['SET', '套', '组'].includes(u)) return 'assembly';
  if (['个', '根', '米', '条', 'M', 'KG', 'PCS', '件'].includes(u)) return 'component';
  return 'unknown';
}

/** 变更模式显示配置 */
export const PATTERN_DISPLAY: Record<ChangePattern | CrossSheetIssueType, { icon: string; color: string; label: string }> = {
  // 行级变更模式
  simple_add:        { icon: '➕', color: '#38A169', label: '新增' },
  simple_remove:     { icon: '➖', color: '#E53E3E', label: '删除' },
  field_modify:      { icon: '✏️', color: '#D69E2E', label: '修改' },
  replace:           { icon: '🔄', color: '#805AD5', label: '物料替换' },
  split:             { icon: '💥', color: '#DD6B20', label: '总成拆散件' },
  merge:             { icon: '🔗', color: '#319795', label: '散件合总成' },
  qty_change:        { icon: '📊', color: '#3182CE', label: '数量变化' },
  qty_explode:       { icon: '📈', color: '#E53E3E', label: '数量异常' },
  wire_spec_replace: { icon: '🔌', color: '#805AD5', label: '导线规格替换' },
  fixed_length:      { icon: '📏', color: '#319795', label: '散裁→定长' },
  segmented_length:  { icon: '✂️', color: '#319795', label: '分段定长' },
  cross_sheet_inconsistency: { icon: '⚠️', color: '#D69E2E', label: '跨表不一致' },
  unknown:           { icon: '❓', color: '#718096', label: '未知' },
  // 跨sheet问题类型
  missing_in_assembly_sheet: { icon: '📦', color: '#DD6B20', label: 'KSK有/总成缺' },
  missing_in_ksk_sheet:      { icon: '📋', color: '#DD6B20', label: '总成有/KSK缺' },
  price_mismatch:            { icon: '💰', color: '#E53E3E', label: '价格不一致' },
  qty_mismatch:              { icon: '#️⃣', color: '#D69E3E', label: '数量不一致' },
  duplicate_in_ksk:          { icon: '🔁', color: '#805AD5', label: 'KSK重复' },
};

/**
 * 计算跨sheet问题的置信度（多因子评分）
 *
 * 评分维度：
 * 1. 单位类型匹配 (+0.2) - SET→散件 或 散件→SET 是强判据
 * 2. 同端组 (+0.15)
 * 3. 供应商一致 (+0.15)
 * 4. 金额影响显著 (+0.1)
 * 5. 有疑似替换物料 (+0.2)
 * 6. 基础分 0.5
 */
export function calculateCrossSheetConfidence(
  issue: Omit<CrossSheetIssue, 'confidence'>,
  _allIssues: CrossSheetIssue[],
  itemsInKsk: BomItem[],
  itemsInAssembly: BomItem[]
): number {
  let score = 0.5; // 基础分
  const evidence: string[] = [];

  const _kskItem = itemsInKsk.find(i => i.partNo === issue.partNo);
  const _assemblyItem = itemsInAssembly.find(i => i.partNo === issue.partNo);

  // 1. 单位类型检查
  if (issue.unitType) {
    if (issue.unitType.inKsk === 'assembly' && issue.unitType.inAssembly === 'component') {
      score += 0.2;
      evidence.push('单位类型：KSK中是总成(SET)，总成清单中是散件');
    } else if (issue.unitType.inKsk === 'component' && issue.unitType.inAssembly === 'assembly') {
      score += 0.2;
      evidence.push('单位类型：总成清单中是总成(SET)，KSK中是散件');
    } else if (issue.unitType.mismatch) {
      score += 0.1;
      evidence.push('单位类型不一致');
    }
  }

  // 2. 供应商检查
  if (issue.supplierCheck) {
    if (issue.supplierCheck.inferredRelationship === 'same') {
      score += 0.15;
      evidence.push('供应商一致');
    } else if (issue.supplierCheck.inferredRelationship === 'different') {
      score -= 0.05; // 供应商不同降低置信度
      evidence.push('供应商不同');
    }
  }

  // 3. 金额影响
  if (issue.impact.amount > 10) {
    score += 0.1;
    evidence.push(`金额影响显著(${issue.impact.amount.toFixed(2)}元)`);
  }

  // 4. 检查是否有疑似替换物料（同供应商+金额相近）
  if (issue.type === 'missing_in_assembly_sheet') {
    const potentialReplace = findPotentialReplace(issue, itemsInAssembly);
    if (potentialReplace) {
      score += 0.2;
      evidence.push(`疑似替换为 ${potentialReplace.partNo}(${potentialReplace.partName})`);
      issue.semanticInference = {
        likelyPattern: 'replace',
        relatedPartNo: potentialReplace.partNo,
        evidence,
      };
    }
  } else if (issue.type === 'missing_in_ksk_sheet') {
    const potentialReplace = findPotentialReplace(issue, itemsInKsk);
    if (potentialReplace) {
      score += 0.2;
      evidence.push(`疑似替换为 ${potentialReplace.partNo}(${potentialReplace.partName})`);
      issue.semanticInference = {
        likelyPattern: 'replace',
        relatedPartNo: potentialReplace.partNo,
        evidence,
      };
    }
  }

  // 5. 名称相似度检查（散件合总成/总成拆散件）
  if (issue.partName) {
    const nameEvidence = checkNamePattern(issue.partName, issue.type, itemsInKsk, itemsInAssembly);
    if (nameEvidence) {
      score += 0.1;
      evidence.push(nameEvidence);
    }
  }

  // 确保在0.3-0.98范围内
  return Math.min(0.98, Math.max(0.3, score));
}

/**
 * 查找疑似替换物料
 * 规则：同供应商 + 金额相近(±20%) + 同分类
 */
function findPotentialReplace(
  issue: Omit<CrossSheetIssue, 'confidence'>,
  candidates: BomItem[]
): BomItem | undefined {
  if (!issue.supplierCheck?.kskSupplier) return undefined;

  let bestMatch: BomItem | undefined;
  let bestScore = 0;

  for (const candidate of candidates) {
    if (candidate.partNo === issue.partNo) continue;

    let score = 0;

    // 供应商匹配
    if (candidate.supplier === issue.supplierCheck.kskSupplier) {
      score += 3;
    }

    // 金额相近
    if (issue.impact.amount > 0 && candidate.unitPrice) {
      const priceRatio = candidate.unitPrice / issue.impact.amount;
      if (priceRatio >= 0.8 && priceRatio <= 1.2) {
        score += 2;
      }
    }

    // 分类相同
    if (candidate.itemCategory && candidate.itemCategory === issue.semanticInference?.likelyPattern) {
      score += 1;
    }

    // 名称相似
    const nameSim = similarity(issue.partName, candidate.partName || '');
    if (nameSim > 0.6) {
      score += 2;
    }

    if (score > bestScore) {
      bestScore = score;
      bestMatch = candidate;
    }
  }

  return bestScore >= 4 ? bestMatch : undefined;
}

/**
 * 名称模式检查
 * 检查是否可能是拆分/合并
 */
function checkNamePattern(
  partName: string,
  issueType: CrossSheetIssueType,
  itemsInKsk: BomItem[],
  itemsInAssembly: BomItem[]
): string | null {
  const name = normalizeText(partName);

  // 总成关键词
  const assemblyKeywords = ['总成', '组件', '套件', '连接器总成'];
  // 散件关键词
  const componentKeywords = ['端子', '密封圈', '尾盖', '护套', '屏蔽环'];

  if (issueType === 'missing_in_assembly_sheet') {
    // 缺失的是总成？可能是拆散件
    if (assemblyKeywords.some(k => name.includes(k))) {
      // 检查总成清单中是否有相关散件
      const hasComponents = itemsInAssembly.some(i =>
        componentKeywords.some(k => normalizeText(i.partName || '').includes(k))
      );
      if (hasComponents) {
        return `疑似总成拆散件：${partName}`;
      }
    }
  } else if (issueType === 'missing_in_ksk_sheet') {
    // 缺失的是散件？可能是合总成
    if (componentKeywords.some(k => name.includes(k))) {
      // 检查KSK中是否有相关总成
      const hasAssembly = itemsInKsk.some(i =>
        assemblyKeywords.some(k => normalizeText(i.partName || '').includes(k))
      );
      if (hasAssembly) {
        return `疑似散件合总成：${partName}`;
      }
    }
  }

  return null;
}

/**
 * 计算字符串相似度 (0-1)
 */
function similarity(a: string, b: string): number {
  const s1 = normalizeText(a);
  const s2 = normalizeText(b);
  if (s1 === s2) return 1;
  if (!s1 || !s2) return 0;

  // 简单实现：公共子串长度/最大长度
  let maxLen = 0;
  for (let i = 0; i < s1.length; i++) {
    for (let j = i + 1; j <= s1.length; j++) {
      const substr = s1.substring(i, j);
      if (s2.includes(substr) && substr.length > maxLen) {
        maxLen = substr.length;
      }
    }
  }
  return maxLen / Math.max(s1.length, s2.length);
}

/**
 * 生成语义化的变更履历描述
 */
export function generateSemanticChangeDescription(
  issue: CrossSheetIssue
): { title: string; detail: string; action: string } {
  const display = PATTERN_DISPLAY[issue.type];
  let title = `${display.icon} ${display.label}：${issue.partNo}`;
  let detail = '';
  let action = issue.recommendedAction;

  switch (issue.type) {
    case 'missing_in_assembly_sheet': {
      const confBadge = issue.confidence >= 0.9 ? '【高置信度】' :
                       issue.confidence >= 0.7 ? '【中置信度】' : '【低置信度】';

      if (issue.semanticInference?.likelyPattern === 'replace' && issue.semanticInference.relatedPartNo) {
        title = `🔄 物料替换疑似未同步：${issue.partNo} → ${issue.semanticInference.relatedPartNo}`;
        detail = `类型：${issue.partName}\n` +
                `位置：${issue.assemblyNo}总成\n` +
                `影响：-${issue.impact.amount.toFixed(2)}元（如删除）\n` +
                `证据：${issue.semanticInference.evidence.join('；')}`;
        action = `确认是否为协议价变更：如${issue.partNo}被${issue.semanticInference.relatedPartNo}替代，请同步更新；如为遗漏，请补充到总成散件清单`;
      } else if (issue.unitType?.inKsk === 'assembly') {
        title = `💥 总成拆散件疑似未同步：${issue.partNo}`;
        detail = `总成：${issue.partName}\n` +
                `位置：${issue.assemblyNo}总成\n` +
                `KSK数量：${issue.kskQty}套\n` +
                `影响：-${issue.impact.amount.toFixed(2)}元\n` +
                `${confBadge}`;
        action = `检查总成散件清单是否已拆分：如已拆分为散件，请删除KSK中的${issue.partNo}；如未拆分，请补充到总成清单`;
      } else {
        detail = `物料：${issue.partName}\n` +
                `位置：${issue.assemblyNo}总成\n` +
                `KSK数量：${issue.kskQty}${issue.unitType?.inKsk === 'component' ? '个' : '套'}\n` +
                `影响：-${issue.impact.amount.toFixed(2)}元\n` +
                `${confBadge}`;
      }
      break;
    }

    case 'missing_in_ksk_sheet': {
      if (issue.unitType?.inAssembly === 'assembly') {
        title = `🔗 散件合总成疑似未同步：${issue.partNo}`;
        detail = `总成：${issue.partName}\n` +
                `位置：${issue.assemblyNo}总成\n` +
                `影响：需确认是否在KSK中以散件形式存在`;
      } else {
        detail = `物料：${issue.partName}\n` +
                `位置：${issue.assemblyNo}总成\n` +
                `总成数量：${issue.assemblyQty}个`;
      }
      break;
    }

    case 'price_mismatch': {
      const diff = (issue.kskPrice || 0) - (issue.assemblyPrice || 0);
      const pct = issue.assemblyPrice ? (diff / issue.assemblyPrice * 100).toFixed(1) : 'N/A';
      title = `💰 价格差异：${issue.partNo}`;
      detail = `物料：${issue.partName}\n` +
              `KSK单价：${issue.kskPrice}元\n` +
              `散件单价：${issue.assemblyPrice}元\n` +
              `差异：${diff > 0 ? '+' : ''}${diff.toFixed(2)}元 (${pct}%)\n` +
              `影响金额：${issue.impact.amount.toFixed(2)}元`;
      action = diff > 0
        ? `KSK价格高于散件价格，建议确认是否为最新协议价`
        : `散件价格高于KSK价格，建议同步更新或确认是否为不同批次`;
      break;
    }

    case 'qty_mismatch': {
      title = `#️⃣ 数量不一致：${issue.partNo}`;
      detail = `物料：${issue.partName}\n` +
              `KSK数量：${issue.kskQty}\n` +
              `散件数量：${issue.assemblyQty}\n` +
              `差异：${Math.abs((issue.kskQty || 0) - (issue.assemblyQty || 0)).toFixed(2)}\n` +
              `影响金额：${issue.impact.amount.toFixed(2)}元`;
      break;
    }

    case 'duplicate_in_ksk': {
      title = `🔁 KSK重复：${issue.partNo}`;
      detail = `物料：${issue.partName}\n` +
              `总数量：${issue.kskQty}（多次出现）\n` +
              `建议：合并为单行或检查是否为不同配置`;
      break;
    }
  }

  return { title, detail, action };
}

/**
 * 升级CrossSheetValidationResult，添加语义化描述
 */
export function enrichValidationResult(
  result: CrossSheetValidationResult
): CrossSheetValidationResult & { semanticSummary: string } {
  const _issueDescriptions = result.issues.map(i => {
    const { title } = generateSemanticChangeDescription(i);
    return title;
  });

  const patterns = new Set(result.issues.map(i => i.semanticInference?.likelyPattern).filter(Boolean));
  const patternStr = patterns.size > 0
    ? `，疑似涉及：${Array.from(patterns).map(p =>
        p === 'replace' ? '物料替换' :
        p === 'split' ? '总成拆散件' :
        p === 'merge' ? '散件合总成' : p
      ).join('、')}`
    : '';

  const semanticSummary = `${result.assemblyNo}${result.assemblyName ? `(${result.assemblyName})` : ''}：` +
    `发现 ${result.summary.totalIssues} 个问题` +
    `（缺失${result.summary.missingItems}项，价格差异${result.summary.priceMismatches}项）` +
    `${patternStr}，` +
    `总影响 ${result.summary.totalImpact.toFixed(2)} 元`;

  return {
    ...result,
    semanticSummary,
  };
}
