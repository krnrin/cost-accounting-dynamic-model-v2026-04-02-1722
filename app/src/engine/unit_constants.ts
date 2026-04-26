/**
 * 统一单位常量定义
 *
 * PR-071: 行级与跨sheet使用两套单位字典统一
 * 所有单位判断逻辑都应使用此文件的常量
 *
 * [PR-115] 补全跨文件单位映射
 */

/** 总成单位（套件级别） */
export const ASSEMBLY_UNITS = ['SET', '套', '组', 'set', '对', 'PAIR', 'pair'] as const;

/** 散件单位（零件级别） */
export const COMPONENT_UNITS = ['PCS', '个', '根', '米', 'M', 'KG', '条', '件', 'pcs', 'kg', '对', '盒', '箱', '卷'] as const;

/** 长度单位 */
export const LENGTH_UNITS = ['M', '米', 'METER', 'CM', '厘米', 'MM', '毫米', 'm', 'cm', 'mm', 'INCH', '英寸', 'in', '"'] as const;

/** 重量单位 */
export const WEIGHT_UNITS = ['KG', '千克', 'kg', 'G', '克', 'g', 'MG', '毫克', 'mg'] as const;

/** 标准单位映射 (非标单位 → 标准单位) */
export const UNIT_NORMALIZATION: Record<string, string> = {
  // 长度
  '米': 'm', 'M': 'm', 'meter': 'm', 'meters': 'm',
  '厘米': 'cm', 'CM': 'cm', 'centimeter': 'cm',
  '毫米': 'mm', 'MM': 'mm', 'millimeter': 'mm',
  '英寸': 'inch', 'INCH': 'inch', 'in': 'inch', '"': 'inch',
  // 数量
  '个': 'pcs', 'PCS': 'pcs', 'EA': 'pcs', 'ea': 'pcs', '只': 'pcs', '枚': 'pcs',
  '根': 'pcs', '条': 'pcs', '件': 'pcs', '支': 'pcs',
  '对': 'pair', 'PAIR': 'pair', '双': 'pair',
  '套': 'set', 'SET': 'set', 'Set': 'set', '组': 'set',
  '盒': 'box', 'BOX': 'box', '盒装': 'box',
  '箱': 'box', 'CASE': 'box', 'case': 'box',
  '卷': 'roll', 'ROLL': 'roll', '卷装': 'roll',
  // 重量
  '千克': 'kg', 'KG': 'kg', 'Kg': 'kg',
  '克': 'g', 'G': 'g',
  '毫克': 'mg', 'MG': 'mg',
};

/**
 * 判断是否为总成单位
 */
export function isAssemblyUnit(unit?: string): boolean {
  if (!unit) return false;
  const normalized = unit.trim().toUpperCase();
  return ASSEMBLY_UNITS.some(u => u.toUpperCase() === normalized);
}

/**
 * 判断是否为散件单位
 */
export function isComponentUnit(unit?: string): boolean {
  if (!unit) return false;
  const normalized = unit.trim().toUpperCase();
  return COMPONENT_UNITS.some(u => u.toUpperCase() === normalized);
}

/**
 * 判断是否为长度单位
 */
export function isLengthUnit(unit?: string): boolean {
  if (!unit) return false;
  const normalized = unit.trim().toUpperCase();
  return LENGTH_UNITS.some(u => u.toUpperCase() === normalized);
}

/**
 * 判断是否为重量单位
 */
export function isWeightUnit(unit?: string): boolean {
  if (!unit) return false;
  const normalized = unit.trim().toUpperCase();
  return WEIGHT_UNITS.some(u => u.toUpperCase() === normalized);
}

/**
 * 标准化单位
 */
export function normalizeUnit(unit: string): string {
  const trimmed = unit.trim();
  return UNIT_NORMALIZATION[trimmed] || trimmed.toLowerCase();
}

/**
 * 获取单位类型
 */
export type UnitKind = 'assembly' | 'component' | 'length' | 'weight' | 'unknown';

export function getUnitKind(unit?: string): UnitKind {
  if (isAssemblyUnit(unit)) return 'assembly';
  if (isLengthUnit(unit)) return 'length';
  if (isWeightUnit(unit)) return 'weight';
  if (isComponentUnit(unit)) return 'component';
  return 'unknown';
}
