/**
 * BOM 标准化与特征提取模块
 * 基于 Python BOM对比方案移植
 * 职责：名称标准化、特征提取、多级匹配键生成
 */

import type { BomItem } from '../types/harness';

// ── 类型定义 ─────────────────────────────────────────────────────────────────

/** 标准化后的BOM项 */
export interface NormalizedBomItem extends BomItem {
  /** 标准化后的名称 */
  normalizedName: string;
  /** 标准供应商 */
  stdSupplier: string | null;
  /** 提取的特征 */
  features: BomFeatures;
  /** 主匹配键（优先料号） */
  mainKey: string;
  /** 备用匹配键（类别+系列+规格） */
  backupKey: string;
}

/** BOM特征 */
export interface BomFeatures {
  /** 业务类别 */
  category: 'connector' | 'terminal' | 'wire_cable' | 'seal' | 'plug_cap' | 'tube_protection' | 'tape' | 'clip_fastener' | 'bracket' | 'bolt_nut' | 'busbar' | 'label' | 'unknown';
  /** 显示类别 */
  businessCategory: 'CONNECTOR' | 'TERMINAL' | 'CABLE' | 'PROTECTION' | 'FASTENER' | 'OTHER';
  /** 孔位数 */
  poleCount?: string;
  /** 线径规格 */
  wireSize?: string;
  /** 长度 */
  length?: string;
  /** 角度 */
  angle?: '90DEG' | 'STRAIGHT';
  /** 温度等级 */
  temperature?: string;
  /** 电压等级 */
  voltage?: string;
  /** 颜色 */
  color?: 'ORANGE' | 'BLACK' | 'GRAY' | 'WHITE' | 'BLUE' | 'GREEN' | 'BROWN' | 'NATURAL';
  /** 是否屏蔽 */
  shielding?: 'SHIELDED' | 'UNSHIELDED';
  /** 是否防水 */
  waterproof?: 'SEALED' | 'UNSEALED';
  /** 系列 */
  series?: string;
}

/** 标准化配置 */
export interface NormalizationConfig {
  /** 同义词归一字典 */
  normalizeDict: Record<string, string>;
  /** 供应商别名字典 */
  supplierDict: Record<string, string[]>;
  /** 停用词表 */
  stopwords: Set<string>;
  /** 系列识别字典 */
  seriesDict: Record<string, Record<string, string>>;
}

/** 匹配级别 */
export enum MatchLevel {
  PART_NO_EXACT = 1,      // 料号完全一致
  BACKUP_KEY = 2,         // 类别+系列+规格
  FEATURE_CORE = 3,       // 核心规格相同
  TEXT_SIMILAR = 4,       // 文本相似度>0.78
  NO_MATCH = 5,           // 无匹配
}

/** 匹配结果 */
export interface MatchResult {
  level: MatchLevel;
  score: number;
  reason: string;
}

// ── 类别字典 ─────────────────────────────────────────────────────────────────

const CATEGORY_DICT: Record<BomFeatures['category'], string[]> = {
  connector: ['CONNECTOR', 'CONN', '接插件', '连接器', '插头', '插座', '护套', '壳体'],
  terminal: ['TERMINAL', '端子', '插针', '插孔', 'PIN', 'SOCKET'],
  wire_cable: ['CABLE', 'WIRE', '电缆', '导线', '高压线', '屏蔽线'],
  seal: ['SEAL', '胶塞', '线封', '防水塞', '堵水塞'],
  plug_cap: ['PLUG', 'CAP', '盲塞', '堵头', '防尘盖', '端帽'],
  tube_protection: ['TUBE', '管', '波纹管', '热缩管', '编织管', '护套管', '套管'],
  tape: ['TAPE', '胶带', '布胶带', '绒布胶带', 'PVC胶带'],
  clip_fastener: ['CLIP', '卡扣', '扎带', '固定夹', '卡子', 'FASTENER', 'TIE'],
  bracket: ['BRACKET', '支架', '安装支架', '固定板'],
  bolt_nut: ['BOLT', 'NUT', 'SCREW', '螺栓', '螺母', '螺钉'],
  busbar: ['BUSBAR', '母排', '铜排'],
  label: ['LABEL', '标签', '标识牌'],
  unknown: [],
};

// ── 正则表达式 ────────────────────────────────────────────────────────────────

const REGEX_POLE = /(\d+)\s*(P|PIN|WAY|孔|芯)\b/i;
const REGEX_WIRE_SIZE = /(\d+(?:\.\d+)?)\s*(MM2|MM²|SQ|AWG)\b/i;
const REGEX_LENGTH = /(?:(?:L\s*=\s*)?(\d+(?:\.\d+)?))\s*(MM|CM|M)\b/i;
const REGEX_ANGLE = /(90\s*DEG|180\s*DEG|90°|180°|RIGHT\s*ANGLE|STRAIGHT|弯头|直头)/i;
const REGEX_TEMP = /(\d{2,3})\s*°?\s*C\b/i;
const REGEX_VOLTAGE = /(\d{3,4})\s*V\b/i;

const PART_PATTERNS = [
  /\b\d{6,8}-\d+\b/,           // 2281234-1
  /\b[A-Z]\d{7,12}\b/,        // A12345678
  /\b[A-Z0-9][A-Z0-9\-\/\.]{4,}\b/, // 其他料号格式
];

// ── 基础工具函数 ─────────────────────────────────────────────────────────────

function normalizeText(text: string | null | undefined): string {
  if (!text) return '';

  // 先处理中文特殊字符和同义词替换（在大写转换前）
  let result = String(text);

  // 单位替换
  result = result.replace(/MM²/g, 'MM2');
  result = result.replace(/㎡/g, 'MM2');
  result = result.replace(/平方/g, 'MM2');

  // 大写转换（对中文无影响）
  result = result.toUpperCase();

  // 标点符号统一为空格
  result = result.replace(/[\(\)\[\]（）,，;；:_\/\\]+/g, ' ');
  result = result.replace(/[-]+/g, '-');

  // 合并空格
  result = result.replace(/\s+/g, ' ').trim();

  return result;
}

function applyNormalizeDict(text: string, dict: Record<string, string>): string {
  let result = text;

  // 先处理中文词（按长度降序，避免短词先替换）
  const chineseKeys = Object.keys(dict).filter(k => /[一-龥]/.test(k));
  chineseKeys.sort((a, b) => b.length - a.length);
  for (const key of chineseKeys) {
    // 中文词不使用\b边界，直接全局替换
    const pattern = new RegExp(escapeRegExp(key.toUpperCase()), 'g');
    result = result.replace(pattern, dict[key] || '');
  }

  // 再处理英文词（使用\b边界）
  const englishKeys = Object.keys(dict).filter(k => !/[一-龥]/.test(k));
  englishKeys.sort((a, b) => b.length - a.length);
  for (const key of englishKeys) {
    const pattern = new RegExp(`\\b${escapeRegExp(key.toUpperCase())}\\b`, 'g');
    result = result.replace(pattern, dict[key] || '');
  }

  return result;
}

function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function removeStopwords(text: string, stopwords: Set<string>): string {
  const tokens = text.split(/\s+/);
  return tokens.filter(t => !stopwords.has(t)).join(' ');
}

// ── 特征提取函数 ─────────────────────────────────────────────────────────────

function detectCategory(text: string): BomFeatures['category'] {
  for (const [category, keywords] of Object.entries(CATEGORY_DICT)) {
    for (const kw of keywords) {
      if (text.includes(kw.toUpperCase())) {
        return category as BomFeatures['category'];
      }
    }
  }
  return 'unknown';
}

function getBusinessCategory(category: BomFeatures['category']): BomFeatures['businessCategory'] {
  switch (category) {
    case 'connector': return 'CONNECTOR';
    case 'terminal': return 'TERMINAL';
    case 'wire_cable': return 'CABLE';
    case 'tube_protection':
    case 'tape':
    case 'seal':
    case 'plug_cap':
      return 'PROTECTION';
    case 'clip_fastener':
    case 'bracket':
    case 'bolt_nut':
      return 'FASTENER';
    default:
      return 'OTHER';
  }
}

function detectSupplier(
  text: string,
  rawSupplier: string | null | undefined,
  supplierDict: Record<string, string[]>
): string | null {
  // 优先检查 rawSupplier 字段
  if (rawSupplier) {
    const rawUpper = rawSupplier.toUpperCase();
    for (const [stdName, aliases] of Object.entries(supplierDict)) {
      for (const alias of aliases) {
        if (rawUpper === alias.toUpperCase() || rawUpper === stdName.toUpperCase()) {
          return stdName;
        }
      }
    }
  }

  // 再从 text 中检测
  for (const [stdName, aliases] of Object.entries(supplierDict)) {
    for (const alias of aliases) {
      if (text.includes(alias.toUpperCase())) {
        return stdName;
      }
    }
  }
  return null;
}

function extractPartNo(text: string, rawPartNo?: string | null): string | null {
  // 优先使用原始料号
  if (rawPartNo) {
    const s = String(rawPartNo).trim().toUpperCase();
    if (s) return s;
  }

  // 从文本中提取
  const candidates: string[] = [];
  for (const pattern of PART_PATTERNS) {
    const matches = text.match(pattern);
    if (matches) candidates.push(...matches);
  }

  if (candidates.length === 0) return null;

  // 过滤掉非料号词汇
  const blacklist = new Set([
    'CONNECTOR', 'TERMINAL', 'CABLE', 'WIRE', 'SHIELDED', 'SEALED',
    'STRAIGHT', 'ORANGE', 'BLACK', 'GRAY', 'WHITE', 'BLUE', 'GREEN',
    'BROWN', 'NATURAL', 'HV', 'LV'
  ]);

  const validCandidates = candidates.filter(c => !blacklist.has(c));
  if (validCandidates.length === 0) return null;

  // 去重并排序：优先包含-的，然后按长度降序
  const unique = [...new Set(validCandidates)];
  unique.sort((a, b) => {
    const aHasDash = a.includes('-') || a.includes('/') || a.includes('.') ? 0 : 1;
    const bHasDash = b.includes('-') || b.includes('/') || b.includes('.') ? 0 : 1;
    if (aHasDash !== bHasDash) return aHasDash - bHasDash;
    return b.length - a.length;
  });

  return unique[0] || null;
}

function extractPoleCount(text: string): string | undefined {
  const m = REGEX_POLE.exec(text);
  return m?.[1] ? `${m[1]}P` : undefined;
}

function extractWireSize(text: string): string | undefined {
  const m = REGEX_WIRE_SIZE.exec(text);
  return m?.[1] && m?.[2] ? `${m[1]}${m[2].toUpperCase()}` : undefined;
}

function extractLength(text: string): string | undefined {
  const m = REGEX_LENGTH.exec(text);
  return m?.[1] && m?.[2] ? `${m[1]}${m[2].toUpperCase()}` : undefined;
}

function extractAngle(text: string): '90DEG' | 'STRAIGHT' | undefined {
  const m = REGEX_ANGLE.exec(text);
  if (!m?.[1]) return undefined;
  const raw = m[1].toUpperCase();
  if (raw.includes('90') || raw.includes('弯头') || raw.includes('RIGHT ANGLE')) {
    return '90DEG';
  }
  if (raw.includes('180') || raw.includes('直头') || raw.includes('STRAIGHT')) {
    return 'STRAIGHT';
  }
  return undefined;
}

function extractTemp(text: string): string | undefined {
  const m = REGEX_TEMP.exec(text);
  return m?.[1] ? `${m[1]}C` : undefined;
}

function extractVoltage(text: string): string | undefined {
  const m = REGEX_VOLTAGE.exec(text);
  return m?.[1] ? `${m[1]}V` : undefined;
}

function extractColor(text: string): BomFeatures['color'] | undefined {
  const colors: Array<'ORANGE' | 'BLACK' | 'GRAY' | 'WHITE' | 'BLUE' | 'GREEN' | 'BROWN' | 'NATURAL'> =
    ['ORANGE', 'BLACK', 'GRAY', 'WHITE', 'BLUE', 'GREEN', 'BROWN', 'NATURAL'];
  for (const c of colors) {
    if (text.includes(c)) return c;
  }
  return undefined;
}

function extractShielding(text: string): 'SHIELDED' | 'UNSHIELDED' | undefined {
  if (text.includes('UNSHIELDED')) return 'UNSHIELDED';
  if (text.includes('SHIELDED') || text.includes('BRAID') || text.includes('FOIL')) {
    return 'SHIELDED';
  }
  return undefined;
}

function extractWaterproof(text: string): 'SEALED' | 'UNSEALED' | undefined {
  if (text.includes('UNSEALED')) return 'UNSEALED';
  if (text.includes('SEALED') || text.includes('WATERPROOF') || text.includes('防水')) {
    return 'SEALED';
  }
  return undefined;
}

function extractSeries(
  text: string,
  supplier: string | null,
  seriesDict: Record<string, Record<string, string>> | undefined
): string | undefined {
  if (!seriesDict || !supplier) return undefined;

  // 先查供应商特定系列
  if (supplier in seriesDict) {
    const supplierDict = seriesDict[supplier];
    if (supplierDict) {
      for (const [rawSeries, stdSeries] of Object.entries(supplierDict)) {
        if (text.includes(rawSeries.toUpperCase())) return stdSeries;
      }
    }
  }
  // 再查通用系列
  if ('COMMON' in seriesDict) {
    const commonDict = seriesDict['COMMON'];
    if (commonDict) {
      for (const [rawSeries, stdSeries] of Object.entries(commonDict)) {
        if (text.includes(rawSeries.toUpperCase())) return stdSeries;
      }
    }
  }
  return undefined;
}

// ── 匹配键生成 ───────────────────────────────────────────────────────────────

function buildBackupKey(item: NormalizedBomItem): string {
  const { features } = item;
  const parts: (string | undefined)[] = [];

  switch (features.category) {
    case 'connector':
      parts.push(
        features.category,
        features.series,
        features.poleCount,
        features.angle,
        features.color,
        features.shielding,
        features.waterproof
      );
      break;
    case 'terminal':
      parts.push(
        features.category,
        features.wireSize,
        features.waterproof
      );
      break;
    case 'wire_cable':
      parts.push(
        features.category,
        features.wireSize,
        features.length,
        features.color,
        features.shielding,
        features.voltage,
        features.temperature
      );
      break;
    default:
      parts.push(
        features.category,
        features.series,
        features.wireSize,
        features.length,
        features.color
      );
  }

  const validParts = parts.filter((p): p is string => p !== undefined && p !== null);
  return validParts.join('|') || 'unknown';
}

// ── 文本相似度 ───────────────────────────────────────────────────────────────

export function textSimilarity(a: string, b: string): number {
  if (!a && !b) return 1;
  if (!a || !b) return 0;

  // 简单的Levenshtein距离实现
  const strA = a.toUpperCase();
  const strB = b.toUpperCase();

  const lenA = strA.length;
  const lenB = strB.length;

  // 如果长度差异太大，快速返回
  if (Math.abs(lenA - lenB) > Math.max(lenA, lenB) * 0.5) {
    return 0;
  }

  // 计算最长公共子序列长度
  const matrix: (number[] | undefined)[] = Array(lenA + 1).fill(null).map(() => Array(lenB + 1).fill(0));

  for (let i = 1; i <= lenA; i++) {
    for (let j = 1; j <= lenB; j++) {
      const prevRow = matrix[i - 1];
      const currRow = matrix[i];
      if (!prevRow || !currRow) continue;

      if (strA[i - 1] === strB[j - 1]) {
        currRow[j] = (prevRow[j - 1] || 0) + 1;
      } else {
        currRow[j] = Math.max(prevRow[j] || 0, currRow[j - 1] || 0);
      }
    }
  }

  const lastRow = matrix[lenA];
  const lcsLength = lastRow?.[lenB] || 0;
  return (2 * lcsLength) / (lenA + lenB);
}

// ── 主函数：标准化BOM项 ──────────────────────────────────────────────────────

export function normalizeBomItem(
  item: BomItem,
  config: NormalizationConfig
): NormalizedBomItem {
  // 1. 清洗文本
  const rawName = item.partName || '';
  const text = normalizeText(rawName);

  // 2. 应用归一字典
  const normalized = applyNormalizeDict(text, config.normalizeDict);

  // 3. 去除停用词
  const cleanedName = removeStopwords(normalized, config.stopwords);

  // 4. 提取特征
  const category = detectCategory(cleanedName);
  const stdSupplier = detectSupplier(cleanedName, item.supplier, config.supplierDict);

  const features: BomFeatures = {
    category,
    businessCategory: getBusinessCategory(category),
    poleCount: extractPoleCount(cleanedName),
    wireSize: extractWireSize(cleanedName),
    length: extractLength(cleanedName),
    angle: extractAngle(cleanedName),
    temperature: extractTemp(cleanedName),
    voltage: extractVoltage(cleanedName),
    color: extractColor(cleanedName),
    shielding: extractShielding(cleanedName),
    waterproof: extractWaterproof(cleanedName),
    series: stdSupplier ? extractSeries(cleanedName, stdSupplier, config.seriesDict) : undefined,
  };

  // 5. 提取料号
  const partNo = extractPartNo(cleanedName, item.partNo);

  // 6. 构建匹配键
  const mainKey = partNo || '';
  const normalizedItem: NormalizedBomItem = {
    ...item,
    normalizedName: cleanedName,
    stdSupplier,
    features,
    mainKey,
    backupKey: '', // 先占位，后面填充
  };

  normalizedItem.backupKey = buildBackupKey(normalizedItem);

  return normalizedItem;
}

// ── 匹配函数 ─────────────────────────────────────────────────────────────────

export function compareItems(
  oldItem: NormalizedBomItem,
  newItem: NormalizedBomItem,
  substituteRules: SubstituteRule[]
): { type: string; level: MatchLevel; similarity?: number; changeDetail?: string } {
  // 1. 检查明确替代关系
  if (isExplicitSubstitute(oldItem, newItem, substituteRules)) {
    if (oldItem.qty !== newItem.qty) {
      return { type: 'SUBSTITUTE_QTY_CHANGED', level: MatchLevel.PART_NO_EXACT };
    }
    return { type: 'SUBSTITUTED', level: MatchLevel.PART_NO_EXACT };
  }

  // 2. 料号完全匹配（料号必须非空且看起来像真正的料号）
  const looksLikeRealPartNo = (key: string) => {
    // 真正的料号通常包含数字和字母的组合，或者带分隔符
    // 简单的类别词（如 CORRUGATED）不应该被视为料号
    return key.length >= 5 && (/\d/.test(key) || /[-/.]/.test(key));
  };
  if (oldItem.mainKey && newItem.mainKey &&
      oldItem.mainKey === newItem.mainKey &&
      looksLikeRealPartNo(oldItem.mainKey)) {
    if (oldItem.qty !== newItem.qty) {
      return { type: 'QTY_CHANGED', level: MatchLevel.PART_NO_EXACT };
    }
    return { type: 'SAME', level: MatchLevel.PART_NO_EXACT };
  }

  // 3. 同类别下检查核心特征变化（优先于备用键匹配）
  if (oldItem.features.category === newItem.features.category && oldItem.features.category !== 'unknown') {
    const coreChanges = checkCoreFeatureChanges(oldItem, newItem);
    if (coreChanges.length > 0) {
      const firstChange = coreChanges[0];
      if (firstChange) {
        return {
          type: firstChange.type,
          level: MatchLevel.FEATURE_CORE,
          changeDetail: coreChanges.map(c => `${c.field}: ${c.old} → ${c.new}`).join(' | '),
        };
      }
    }
  }

  // 4. 备用键匹配（类别+系列+规格）- 料号不同但规格相同
  if (oldItem.backupKey === newItem.backupKey && oldItem.backupKey !== 'unknown') {
    if (oldItem.qty !== newItem.qty) {
      return { type: 'QTY_CHANGED', level: MatchLevel.BACKUP_KEY };
    }
    return { type: 'SAME_SPEC_RENAMED', level: MatchLevel.BACKUP_KEY };
  }

  // 5. 文本相似度匹配
  const sim = textSimilarity(oldItem.normalizedName, newItem.normalizedName);
  if (sim >= 0.78) {
    return { type: 'POSSIBLE_SUBSTITUTE', level: MatchLevel.TEXT_SIMILAR, similarity: sim };
  }

  return { type: 'DIFFERENT', level: MatchLevel.NO_MATCH };
}

/** 替代件规则 */
export interface SubstituteRule {
  oldPn?: string;
  newPn?: string;
  oldNamePattern?: RegExp;
  newNamePattern?: RegExp;
  confidence: number;
  comment?: string;
}

function isExplicitSubstitute(
  oldItem: NormalizedBomItem,
  newItem: NormalizedBomItem,
  rules: SubstituteRule[]
): boolean {
  const oldPn = oldItem.mainKey.toUpperCase();
  const newPn = newItem.mainKey.toUpperCase();
  const oldName = oldItem.normalizedName;
  const newName = newItem.normalizedName;

  for (const rule of rules) {
    // 料号匹配
    if (rule.oldPn && rule.newPn) {
      if (rule.oldPn.toUpperCase() === oldPn && rule.newPn.toUpperCase() === newPn) {
        return true;
      }
    }
    // 名称模式匹配
    if (rule.oldNamePattern && rule.newNamePattern) {
      if (rule.oldNamePattern.test(oldName) && rule.newNamePattern.test(newName)) {
        return true;
      }
    }
  }
  return false;
}

interface FeatureChange {
  type: string;
  field: string;
  old: string | undefined;
  new: string | undefined;
}

function checkCoreFeatureChanges(oldItem: NormalizedBomItem, newItem: NormalizedBomItem): FeatureChange[] {
  if (oldItem.features.category !== newItem.features.category) {
    return [];
  }

  const changes: FeatureChange[] = [];
  const { features: oldF } = oldItem;
  const { features: newF } = newItem;

  // 孔数变化
  if (oldF.poleCount && newF.poleCount && oldF.poleCount !== newF.poleCount) {
    changes.push({ type: 'POLE_COUNT_CHANGED', field: 'poleCount', old: oldF.poleCount, new: newF.poleCount });
  }

  // 线径变化
  if (oldF.wireSize && newF.wireSize && oldF.wireSize !== newF.wireSize) {
    changes.push({ type: 'WIRE_SIZE_CHANGED', field: 'wireSize', old: oldF.wireSize, new: newF.wireSize });
  }

  // 长度变化
  if (oldF.length && newF.length && oldF.length !== newF.length) {
    changes.push({ type: 'LENGTH_CHANGED', field: 'length', old: oldF.length, new: newF.length });
  }

  // 角度变化
  if (oldF.angle && newF.angle && oldF.angle !== newF.angle) {
    changes.push({ type: 'ANGLE_CHANGED', field: 'angle', old: oldF.angle, new: newF.angle });
  }

  // 屏蔽变化
  if (oldF.shielding && newF.shielding && oldF.shielding !== newF.shielding) {
    changes.push({ type: 'SHIELDING_CHANGED', field: 'shielding', old: oldF.shielding, new: newF.shielding });
  }

  // 防水变化
  if (oldF.waterproof && newF.waterproof && oldF.waterproof !== newF.waterproof) {
    changes.push({ type: 'WATERPROOF_CHANGED', field: 'waterproof', old: oldF.waterproof, new: newF.waterproof });
  }

  // 颜色变化
  if (oldF.color && newF.color && oldF.color !== newF.color) {
    changes.push({ type: 'COLOR_CHANGED', field: 'color', old: oldF.color, new: newF.color });
  }

  // 其他规格变化
  const otherChanges: string[] = [];
  if (oldF.series !== newF.series) otherChanges.push('series');
  if (oldF.temperature !== newF.temperature) otherChanges.push('temperature');
  if (oldF.voltage !== newF.voltage) otherChanges.push('voltage');

  if (changes.length === 0 && otherChanges.length > 0) {
    return [{ type: 'SPEC_CHANGED', field: 'multiple', old: otherChanges.join(','), new: '' }];
  }

  return changes;
}

// ── 批量处理 ─────────────────────────────────────────────────────────────────

export interface ComparisonResult {
  businessCategory: string;
  diffType: string;
  similarity?: number;
  changeDetail?: string;
  oldItem?: NormalizedBomItem;
  newItem?: NormalizedBomItem;
  matchLevel: MatchLevel;
}

export function compareBomLists(
  oldItems: NormalizedBomItem[],
  newItems: NormalizedBomItem[],
  substituteRules: SubstituteRule[]
): ComparisonResult[] {
  const results: ComparisonResult[] = [];
  const matchedOld = new Set<number>();
  const matchedNew = new Set<number>();

  // 1. 料号精确匹配
  const oldMainMap = new Map<string, number[]>();
  oldItems.forEach((item, i) => {
    if (item.mainKey) {
      const arr = oldMainMap.get(item.mainKey) || [];
      arr.push(i);
      oldMainMap.set(item.mainKey, arr);
    }
  });

  for (let j = 0; j < newItems.length; j++) {
    const newItem = newItems[j];
    if (!newItem?.mainKey) continue;

    const candidates = oldMainMap.get(newItem.mainKey) || [];
    for (const i of candidates) {
      const oldItem = oldItems[i];
      if (!oldItem || matchedOld.has(i)) continue;

      matchedOld.add(i);
      matchedNew.add(j);
      const cmp = compareItems(oldItem, newItem, substituteRules);
      results.push({
        businessCategory: newItem.features.businessCategory,
        diffType: cmp.type,
        similarity: cmp.similarity,
        changeDetail: cmp.changeDetail,
        oldItem,
        newItem,
        matchLevel: cmp.level,
      });
      break;
    }
  }

  // 2. 备用键匹配
  for (let j = 0; j < newItems.length; j++) {
    if (matchedNew.has(j)) continue;
    const newItem = newItems[j];
    if (!newItem) continue;

    for (let i = 0; i < oldItems.length; i++) {
      if (matchedOld.has(i)) continue;
      const oldItem = oldItems[i];
      if (!oldItem) continue;

      if (oldItem.backupKey === newItem.backupKey && oldItem.backupKey !== 'unknown') {
        matchedOld.add(i);
        matchedNew.add(j);
        const cmp = compareItems(oldItem, newItem, substituteRules);
        const matchedNewItem = newItems[j];
        const matchedOldItem = oldItems[i];
        if (matchedNewItem && matchedOldItem) {
          results.push({
            businessCategory: matchedNewItem.features.businessCategory,
            diffType: cmp.type,
            similarity: cmp.similarity,
            changeDetail: cmp.changeDetail,
            oldItem: matchedOldItem,
            newItem: matchedNewItem,
            matchLevel: cmp.level,
          });
        }
        break;
      }
    }
  }

  // 3. 文本相似度匹配（同类，仅当至少一方无料号时）
  for (let j = 0; j < newItems.length; j++) {
    if (matchedNew.has(j)) continue;

    let bestI = -1;
    let bestScore = 0;

    for (let i = 0; i < oldItems.length; i++) {
      if (matchedOld.has(i)) continue;
      const oldItem = oldItems[i];
      const newItem = newItems[j];
      if (!oldItem || !newItem) continue;
      if (oldItem.features.category !== newItem.features.category) continue;

      // 如果双方都有料号，跳过文本相似度匹配（应该已经被前面的步骤匹配）
      if (oldItem.mainKey && newItem.mainKey) continue;

      const score = textSimilarity(oldItem.normalizedName, newItem.normalizedName);
      if (score > bestScore) {
        bestScore = score;
        bestI = i;
      }
    }

    if (bestI >= 0 && bestScore >= 0.78) {
      matchedOld.add(bestI);
      matchedNew.add(j);
      const matchedOldItem = oldItems[bestI];
      const matchedNewItem = newItems[j];
      if (matchedOldItem && matchedNewItem) {
        const cmp = compareItems(matchedOldItem, matchedNewItem, substituteRules);
        results.push({
          businessCategory: matchedNewItem.features.businessCategory,
          diffType: cmp.type,
          similarity: bestScore,
          changeDetail: cmp.changeDetail,
          oldItem: matchedOldItem,
          newItem: matchedNewItem,
          matchLevel: MatchLevel.TEXT_SIMILAR,
        });
      }
    }
  }

  // 4. 新增
  for (let j = 0; j < newItems.length; j++) {
    if (!matchedNew.has(j)) {
      const newItem = newItems[j];
      if (newItem) {
        results.push({
          businessCategory: newItem.features.businessCategory,
          diffType: 'ADDED',
          newItem,
          matchLevel: MatchLevel.NO_MATCH,
        });
      }
    }
  }

  // 5. 删除
  for (let i = 0; i < oldItems.length; i++) {
    if (!matchedOld.has(i)) {
      const oldItem = oldItems[i];
      if (oldItem) {
        results.push({
          businessCategory: oldItem.features.businessCategory,
          diffType: 'REMOVED',
          oldItem,
          matchLevel: MatchLevel.NO_MATCH,
        });
      }
    }
  }

  return sortResults(results);
}

function sortResults(results: ComparisonResult[]): ComparisonResult[] {
  const order: Record<string, number> = {
    'WIRE_SIZE_CHANGED': 1,
    'POLE_COUNT_CHANGED': 2,
    'SHIELDING_CHANGED': 3,
    'WATERPROOF_CHANGED': 4,
    'LENGTH_CHANGED': 5,
    'ANGLE_CHANGED': 6,
    'COLOR_CHANGED': 7,
    'SPEC_CHANGED': 8,
    'SUBSTITUTED': 9,
    'SUBSTITUTE_QTY_CHANGED': 10,
    'POSSIBLE_SUBSTITUTE': 11,
    'ADDED': 12,
    'REMOVED': 13,
    'QTY_CHANGED': 14,
    'SAME_SPEC_RENAMED': 15,
    'SAME': 16,
  };

  return results.sort((a, b) => {
    const orderA = order[a.diffType] || 99;
    const orderB = order[b.diffType] || 99;
    if (orderA !== orderB) return orderA - orderB;
    return a.businessCategory.localeCompare(b.businessCategory);
  });
}

// ── 默认配置 ─────────────────────────────────────────────────────────────────

export const DEFAULT_NORMALIZATION_CONFIG: NormalizationConfig = {
  normalizeDict: {
    // 类别归一
    '接插件': 'CONNECTOR',
    '连接器': 'CONNECTOR',
    '插头': 'CONNECTOR',
    '插座': 'CONNECTOR',
    '端子': 'TERMINAL',
    '导线': 'WIRE',
    '电缆': 'CABLE',
    '高压线': 'HV CABLE',
    '屏蔽线': 'SHIELDED CABLE',
    '波纹管': 'CORRUGATED TUBE',
    '热缩管': 'HEAT SHRINK TUBE',
    '编织管': 'BRAIDED TUBE',
    '胶塞': 'SEAL',
    '线封': 'SEAL',
    '防水塞': 'SEAL',
    '堵头': 'PLUG',
    '盲塞': 'PLUG',
    '扎带': 'CABLE TIE',
    '卡扣': 'CLIP',
    '固定夹': 'CLIP',
    '支架': 'BRACKET',
    // 特征归一
    '孔': 'PIN',
    '芯': 'PIN',
    '弯头': '90DEG',
    '直头': 'STRAIGHT',
    '橙色': 'ORANGE',
    '黑色': 'BLACK',
    '灰色': 'GRAY',
    '白色': 'WHITE',
    '蓝色': 'BLUE',
    '绿色': 'GREEN',
    '棕色': 'BROWN',
    '本色': 'NATURAL',
    '屏蔽': 'SHIELDED',
    '非屏蔽': 'UNSHIELDED',
    '防水': 'SEALED',
    '密封': 'SEALED',
    '非防水': 'UNSEALED',
    '高压': 'HV',
    '低压': 'LV',
  },
  supplierDict: {
    'TE': ['TE', 'TE CONNECTIVITY', 'TYCO', '泰科'],
    'APTIV': ['APTIV', 'DELPHI', '德尔福'],
    'YAZAKI': ['YAZAKI', '矢崎'],
    'SUMITOMO': ['SUMITOMO', '住友'],
    'LEONI': ['LEONI'],
    'ROSENBERGER': ['ROSENBERGER'],
    'AMPHENOL': ['AMPHENOL', '安费诺'],
    'MOLEX': ['MOLEX', '莫仕'],
  },
  stopwords: new Set([
    'ASSY', 'ASSEMBLY', 'COMPONENT', 'PART', 'ITEM',
    'USED', 'FOR', 'WITH', 'WITHOUT',
    '总成', '组件', '零件', '用于', '适用于',
    '备注', '说明', '标准件',
  ]),
  seriesDict: {
    'TE': {
      'HVA280': 'HVA280',
      'HVA630': 'HVA630',
      'HVP800': 'HVP800',
    },
    'APTIV': {
      'AK2': 'AK2',
      'GT': 'GT',
      'HES': 'HES',
    },
    'ROSENBERGER': {
      'HVR': 'HVR',
    },
    'COMMON': {
      'MSD': 'MSD',
      'HV280': 'HV280',
      'HV630': 'HV630',
    },
  },
};

export const DEFAULT_SUBSTITUTE_RULES: SubstituteRule[] = [
  // 示例：TE连接器版本升级
  { oldPn: '2281234-1', newPn: '2281234-2', comment: '连接器版本替代', confidence: 0.95 },
  // 示例：线缆升级
  { oldPn: 'A12345678', newPn: 'A12345679', comment: '线缆升级 35MM2→50MM2', confidence: 0.95 },
];
