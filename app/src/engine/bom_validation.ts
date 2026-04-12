/**
 * B3: BOM 导入校验规则引擎深化
 * 
 * 提供 partNo 唯一性、分类合规、单位标准化等校验
 */
import type { BomItem, WireItem } from '@/types/harness';

export interface ValidationError {
  row: number;
  field: string;
  value: unknown;
  rule: string;
  message: string;
  severity: 'error' | 'warning';
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
  /** 自动修正建议 */
  suggestions: Array<{ row: number; field: string; suggestedValue: unknown; reason: string }>;
}

/** 标准单位映射 (非标单位 → 标准单位) */
const UNIT_NORMALIZATION: Record<string, string> = {
  '米': 'm', 'M': 'm', 'meter': 'm', 'meters': 'm',
  '个': 'pcs', 'PCS': 'pcs', 'EA': 'pcs', 'ea': 'pcs', '只': 'pcs', '枚': 'pcs',
  '根': 'pcs', '条': 'pcs',
  '套': 'set', 'SET': 'set', 'Set': 'set',
  '卷': 'roll', 'ROLL': 'roll',
  '千克': 'kg', 'KG': 'kg', 'Kg': 'kg',
  '克': 'g', 'G': 'g',
};

/** 标准物料分类 */
const VALID_CATEGORIES = ['wire', 'connector', 'terminal', 'ipt_terminal', 'bracket_rubber', 'tape_tube', 'other'];

/** partNo 格式正则 (允许字母数字横杠下划线点) */
const PART_NO_PATTERN = /^[A-Za-z0-9._\-]{3,50}$/;

/**
 * 标准化单位
 */
export function normalizeUnit(unit: string): string {
  const trimmed = unit.trim();
  return UNIT_NORMALIZATION[trimmed] || trimmed.toLowerCase();
}

/**
 * 校验 BOM 数据
 */
export function validateBom(items: Array<Partial<BomItem | WireItem>>): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];
  const suggestions: ValidationResult['suggestions'] = [];
  const partNoSet = new Set<string>();

  items.forEach((item, idx) => {
    const row = idx + 1;

    // 1. partNo 必填
    if (!item.partNo || !item.partNo.trim()) {
      errors.push({ row, field: 'partNo', value: item.partNo, rule: 'required', message: `第${row}行: 物料编号不能为空`, severity: 'error' });
    } else {
      // partNo 格式校验
      if (!PART_NO_PATTERN.test(item.partNo.trim())) {
        warnings.push({ row, field: 'partNo', value: item.partNo, rule: 'format', message: `第${row}行: 物料编号 "${item.partNo}" 格式异常(建议仅使用字母数字横杠)`, severity: 'warning' });
      }
      // partNo 唯一性
      const normalizedPartNo = item.partNo.trim().toUpperCase();
      if (partNoSet.has(normalizedPartNo)) {
        errors.push({ row, field: 'partNo', value: item.partNo, rule: 'unique', message: `第${row}行: 物料编号 "${item.partNo}" 重复`, severity: 'error' });
      }
      partNoSet.add(normalizedPartNo);
    }

    // 2. partName 必填
    if (!item.partName || !item.partName.trim()) {
      errors.push({ row, field: 'partName', value: item.partName, rule: 'required', message: `第${row}行: 物料名称不能为空`, severity: 'error' });
    }

    // 3. itemCategory 校验
    if (item.itemCategory && !VALID_CATEGORIES.includes(item.itemCategory)) {
      errors.push({ row, field: 'itemCategory', value: item.itemCategory, rule: 'enum', message: `第${row}行: 无效分类 "${item.itemCategory}"，有效值: ${VALID_CATEGORIES.join(',')}`, severity: 'error' });
    }

    // 4. qty 校验
    if (item.qty === undefined || item.qty === null || item.qty < 0) {
      errors.push({ row, field: 'qty', value: item.qty, rule: 'positive', message: `第${row}行: 用量必须 ≥ 0`, severity: 'error' });
    } else if (item.qty === 0) {
      warnings.push({ row, field: 'qty', value: 0, rule: 'zero_qty', message: `第${row}行: 用量为0，请确认是否正确`, severity: 'warning' });
    }

    // 5. unitPrice 校验
    if (item.unitPrice !== undefined && item.unitPrice < 0) {
      errors.push({ row, field: 'unitPrice', value: item.unitPrice, rule: 'positive', message: `第${row}行: 单价不能为负数`, severity: 'error' });
    }

    // 6. unit 标准化建议
    if (item.unit) {
      const normalized = normalizeUnit(item.unit);
      if (normalized !== item.unit.trim()) {
        suggestions.push({ row, field: 'unit', suggestedValue: normalized, reason: `建议将 "${item.unit}" 标准化为 "${normalized}"` });
      }
    }

    // 7. 导线特有字段校验
    if (item.itemCategory === 'wire') {
      const wireItem = item as Partial<WireItem>;
      if (wireItem.copperWeightPerUnit !== undefined && wireItem.copperWeightPerUnit < 0) {
        errors.push({ row, field: 'copperWeightPerUnit', value: wireItem.copperWeightPerUnit, rule: 'positive', message: `第${row}行: 铜重不能为负数`, severity: 'error' });
      }
      if (wireItem.aluminumWeightPerUnit !== undefined && wireItem.aluminumWeightPerUnit < 0) {
        errors.push({ row, field: 'aluminumWeightPerUnit', value: wireItem.aluminumWeightPerUnit, rule: 'positive', message: `第${row}行: 铝重不能为负数`, severity: 'error' });
      }
      // 导线必须有铜重或铝重
      if ((!wireItem.copperWeightPerUnit || wireItem.copperWeightPerUnit === 0) && 
          (!wireItem.aluminumWeightPerUnit || wireItem.aluminumWeightPerUnit === 0)) {
        warnings.push({ row, field: 'copperWeightPerUnit', value: 0, rule: 'wire_weight', message: `第${row}行: 导线类物料铜重和铝重均为0，请确认`, severity: 'warning' });
      }
    }
  });

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    suggestions,
  };
}

/**
 * 自动修正 BOM 数据
 */
export function autoFixBom(items: Array<Partial<BomItem>>): Array<Partial<BomItem>> {
  return items.map((item) => {
    const fixed = { ...item };
    // 标准化单位
    if (fixed.unit) {
      fixed.unit = normalizeUnit(fixed.unit);
    }
    // trim partNo
    if (fixed.partNo) {
      fixed.partNo = fixed.partNo.trim();
    }
    // trim partName
    if (fixed.partName) {
      fixed.partName = fixed.partName.trim();
    }
    // 自动计算 amount
    if (fixed.qty !== undefined && fixed.unitPrice !== undefined && (fixed.amount === undefined || fixed.amount === 0)) {
      fixed.amount = fixed.qty * fixed.unitPrice;
    }
    return fixed;
  });
}
