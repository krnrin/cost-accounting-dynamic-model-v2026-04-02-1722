/**
 * 数据一致性校验引擎
 * 
 * 校验线束输入数据和项目配置的完整性、一致性和合理性。
 * 用于导入数据后、报价前的自动化质量检查。
 */

import type { HarnessInput, WireItem } from '../types/harness';
import type { CostRates } from '../types/project';

export type ValidationSeverity = 'error' | 'warning' | 'info';

export interface ValidationResult {
  /** Unique rule code */
  code: string;
  /** Severity level */
  severity: ValidationSeverity;
  /** Human-readable message */
  message: string;
  /** Which harness or entity this applies to (optional) */
  target?: string;
  /** Problematic field or value (optional) */
  field?: string;
  /** Actual value found */
  actual?: number | string;
  /** Expected value or range */
  expected?: string;
}

/**
 * Validate a single HarnessInput for completeness and consistency.
 */
export function validateHarnessInput(input: HarnessInput): ValidationResult[] {
  const results: ValidationResult[] = [];
  const target = input.harnessId || input.harnessName || 'unknown';
  
  // H001: harnessId required
  if (!input.harnessId || input.harnessId.trim() === '') {
    results.push({
      code: 'H001', severity: 'error',
      message: '线束编号 (harnessId) 不能为空',
      target,
    });
  }
  
  // H002: harnessName required
  if (!input.harnessName || input.harnessName.trim() === '') {
    results.push({
      code: 'H002', severity: 'warning',
      message: '线束名称 (harnessName) 为空',
      target,
    });
  }
  
  // H003: vehicleRatio must be > 0 and <= 1
  if (input.vehicleRatio <= 0 || input.vehicleRatio > 1) {
    results.push({
      code: 'H003', severity: 'error',
      message: `单车用量 (vehicleRatio) 应在 (0, 1] 之间`,
      target, field: 'vehicleRatio',
      actual: input.vehicleRatio, expected: '(0, 1]',
    });
  }
  
  // H004: BOM should not be empty
  if (!input.bom || input.bom.length === 0) {
    results.push({
      code: 'H004', severity: 'warning',
      message: 'BOM 清单为空，将使用 Level 2 或 Level 1 估算',
      target,
    });
  }
  
  // H005: BOM item amounts should match qty * unitPrice
  if (input.bom) {
    for (const item of input.bom) {
      const expected = item.qty * item.unitPrice;
      if (Math.abs(item.amount - expected) > 0.01) {
        results.push({
          code: 'H005', severity: 'warning',
          message: `BOM 项 "${item.partName}" 金额(${item.amount})与 数量×单价(${expected.toFixed(2)}) 不一致`,
          target, field: `bom.${item.partNo}.amount`,
          actual: item.amount, expected: expected.toFixed(2),
        });
      }
    }
  }
  
  // H006: BOM total vs declared materialCost
  if (input.bom && input.bom.length > 0 && (input as any).materialCost != null) {
    const bomTotal = input.bom.reduce((s, b) => s + (b.amount || 0), 0);
    const declared = (input as any).materialCost;
    if (Math.abs(bomTotal - declared) > 1) {
      results.push({
        code: 'H006', severity: 'warning',
        message: `BOM 合计(${bomTotal.toFixed(2)})与声明材料成本(${declared.toFixed(2)})偏差超过 1 元`,
        target, field: 'materialCost',
        actual: bomTotal, expected: declared.toFixed(2),
      });
    }
  }
  
  // H007: Process hours should be positive
  const totalHours = (input.frontHours || 0) + (input.backHours || 0);
  if (totalHours <= 0) {
    results.push({
      code: 'H007', severity: 'warning',
      message: '工时合计 ≤ 0，人工和制造费将为零',
      target, field: 'processHours',
      actual: totalHours, expected: '> 0',
    });
  }
  
  // H008: Packaging subtotal consistency
  if (input.packaging) {
    const p = input.packaging;
    const calcSubtotal = (p.innerBoxCost || 0) + (p.outerBoxCost || 0) +
      (p.palletCost || 0) + (p.trayDividerCost || 0) +
      (p.bubbleWrapCost || 0) + (p.labelCost || 0);
    if (Math.abs((p.subtotal || 0) - calcSubtotal) > 0.01) {
      results.push({
        code: 'H008', severity: 'warning',
        message: `包装费小计(${p.subtotal})与明细合计(${calcSubtotal.toFixed(2)})不一致`,
        target, field: 'packaging.subtotal',
        actual: p.subtotal, expected: calcSubtotal.toFixed(2),
      });
    }
  }
  
  // H009: Freight subtotal consistency
  if (input.freight) {
    const f = input.freight;
    const calcSubtotal = (f.freight || 0) + (f.excessFreight || 0) +
      (f.shortHaul || 0) + (f.thirdPartyWarehouse || 0) + (f.storage || 0);
    if (Math.abs((f.subtotal || 0) - calcSubtotal) > 0.01) {
      results.push({
        code: 'H009', severity: 'warning',
        message: `运输费小计(${f.subtotal})与明细合计(${calcSubtotal.toFixed(2)})不一致`,
        target, field: 'freight.subtotal',
        actual: f.subtotal, expected: calcSubtotal.toFixed(2),
      });
    }
  }
  
  // H010: Wire items should have metal weight info
  if (input.bom) {
    const wires = input.bom.filter(b => b.itemCategory === 'wire') as WireItem[];
    for (const w of wires) {
      if (w.copperWeightPerUnit === undefined && w.aluminumWeightPerUnit === undefined) {
        results.push({
          code: 'H010', severity: 'info',
          message: `导线 "${w.partName}" 缺少铜重/铝重信息，金属联动精度降低`,
          target, field: `bom.${w.partNo}`,
        });
      }
    }
  }
  
  // H011: BOM items should have non-zero unitPrice
  if (input.bom) {
    for (const item of input.bom) {
      if (item.unitPrice <= 0) {
        results.push({
          code: 'H011', severity: 'warning',
          message: `BOM 项 "${item.partName}" 单价 ≤ 0`,
          target, field: `bom.${item.partNo}.unitPrice`,
          actual: item.unitPrice, expected: '> 0',
        });
      }
    }
  }
  
  return results;
}

/**
 * Validate project-level consistency across multiple harnesses.
 */
export function validateProjectConsistency(
  harnesses: HarnessInput[],
  rates?: CostRates
): ValidationResult[] {
  const results: ValidationResult[] = [];
  
  // P001: At least one harness
  if (harnesses.length === 0) {
    results.push({
      code: 'P001', severity: 'error',
      message: '项目中没有线束数据',
    });
    return results;
  }
  
  // P002: vehicleRatio sum should be close to 1.0
  const ratioSum = harnesses.reduce((s, h) => s + (h.vehicleRatio || 0), 0);
  if (Math.abs(ratioSum - 1.0) > 0.001 && ratioSum > 0) {
    // Note: vehicleRatio is not always expected to sum to 1 (depends on project), so this is just info
    results.push({
      code: 'P002', severity: 'info',
      message: `所有线束的单车用量之和为 ${ratioSum.toFixed(4)}，非 1.0`,
      field: 'vehicleRatio',
      actual: ratioSum,
      expected: '1.0 (如果是单车线束套)',
    });
  }
  
  // P003: Duplicate harnessId check
  const idCounts = new Map<string, number>();
  for (const h of harnesses) {
    const id = h.harnessId || '';
    idCounts.set(id, (idCounts.get(id) || 0) + 1);
  }
  for (const [id, count] of Array.from(idCounts.entries())) {
    if (count > 1) {
      results.push({
        code: 'P003', severity: 'error',
        message: `线束编号 "${id}" 重复出现 ${count} 次`,
        field: 'harnessId',
        actual: id,
      });
    }
  }
  
  // P004: Cost rates should be positive
  if (rates) {
    const rateChecks: [keyof CostRates, string][] = [
      ['laborRate', '人工费率'],
      ['mfgRate', '制造费率'],
    ];
    for (const [key, label] of rateChecks) {
      const val = rates[key];
      if (typeof val === 'number' && val <= 0) {
        results.push({
          code: 'P004', severity: 'error',
          message: `${label} (${key}) 为 ${val}，应为正数`,
          field: key,
          actual: val,
          expected: '> 0',
        });
      }
    }
    
    // P005: wasteRate/mgmtRate/profitRate should be reasonable (0 < rate < 0.5)
    const percentChecks: [keyof CostRates, string][] = [
      ['wasteRate', '废损率'],
      ['mgmtRate', '管理费率'],
      ['profitRate', '利润率'],
    ];
    for (const [key, label] of percentChecks) {
      const val = rates[key];
      if (typeof val === 'number' && (val < 0 || val > 0.5)) {
        results.push({
          code: 'P005', severity: 'warning',
          message: `${label} (${key}) = ${val}，通常应在 [0, 0.5] 之间`,
          field: key,
          actual: val,
          expected: '[0, 0.5]',
        });
      }
    }
  }
  
  return results;
}

/**
 * Cross-validate BOM pricing: same partNo across different harnesses
 * should have consistent unit prices.
 */
export function crossValidateBomPricing(
  harnesses: HarnessInput[],
  thresholdPercent: number = 10
): ValidationResult[] {
  const results: ValidationResult[] = [];
  
  // Build map: partNo → { harnessId, unitPrice }[]
  const partPriceMap = new Map<string, { harnessId: string; partName: string; unitPrice: number }[]>();
  
  for (const h of harnesses) {
    if (!h.bom) continue;
    for (const item of h.bom) {
      if (!item.partNo) continue;
      const key = item.partNo;
      if (!partPriceMap.has(key)) partPriceMap.set(key, []);
      partPriceMap.get(key)!.push({
        harnessId: h.harnessId || h.harnessName || 'unknown',
        partName: item.partName,
        unitPrice: item.unitPrice,
      });
    }
  }
  
  // Check each partNo that appears in multiple harnesses
  for (const [partNo, entries] of Array.from(partPriceMap.entries())) {
    if (entries.length < 2) continue;
    
    const prices = entries.map(e => e.unitPrice);
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    
    if (minPrice <= 0) continue; // skip zero-price items
    
    const deviationPercent = ((maxPrice - minPrice) / minPrice) * 100;
    
    if (deviationPercent > thresholdPercent) {
      const details = entries.map(e => `${e.harnessId}:${e.unitPrice}`).join(', ');
      results.push({
        code: 'X001', severity: 'warning',
        message: `物料 "${entries[0]!.partName}" (${partNo}) 跨线束单价偏差 ${deviationPercent.toFixed(1)}% > ${thresholdPercent}%: [${details}]`,
        field: `bom.${partNo}.unitPrice`,
        actual: `${minPrice} ~ ${maxPrice}`,
        expected: `偏差 < ${thresholdPercent}%`,
      });
    }
  }
  
  return results;
}

/**
 * Run all validations on a set of harnesses.
 */
export function validateAll(
  harnesses: HarnessInput[],
  rates?: CostRates,
  crossValidateThreshold?: number
): ValidationResult[] {
  const results: ValidationResult[] = [];
  
  // Per-harness validation
  for (const h of harnesses) {
    results.push(...validateHarnessInput(h));
  }
  
  // Project-level validation
  results.push(...validateProjectConsistency(harnesses, rates));
  
  // Cross-validation
  results.push(...crossValidateBomPricing(harnesses, crossValidateThreshold ?? 10));
  
  return results;
}

/**
 * Get summary counts by severity.
 */
export function summarizeValidation(results: ValidationResult[]): {
  errors: number;
  warnings: number;
  infos: number;
  total: number;
} {
  return {
    errors: results.filter(r => r.severity === 'error').length,
    warnings: results.filter(r => r.severity === 'warning').length,
    infos: results.filter(r => r.severity === 'info').length,
    total: results.length,
  };
}
