import type { HarnessInput, PrecisionLevel, PrecisionMeta } from '@/types/harness';
import type { CostRates, Level1Coefficients } from '@/types/project';
import { numberOr } from './shared_utils';

/** 检测可用精度等级 */
export function detectPrecisionLevel(input: HarnessInput): PrecisionLevel {
  // Level 3: has BOM with at least 1 item
  if (input.bom && input.bom.length > 0) return 3;
  
  // Level 2: has materialCost OR has processHours
  const hasMaterial = numberOr((input as any).materialCost, 0) > 0;
  const hasHours = (numberOr(input.frontHours, 0) + numberOr(input.backHours, 0)) > 0;
  if (hasMaterial || hasHours) return 2;
  
  // Level 1: coefficient approximation
  return 1;
}

/** 获取精度元信息 */
export function getPrecisionMeta(input: HarnessInput): PrecisionMeta {
  const level = detectPrecisionLevel(input);
  const missingData: string[] = [];
  
  // Check data completeness
  const hasBom = input.bom && input.bom.length > 0;
  const hasMaterial = numberOr((input as any).materialCost, 0) > 0;
  const hasHours = (numberOr(input.frontHours, 0) + numberOr(input.backHours, 0)) > 0;
  const hasPackaging = input.packaging && numberOr(input.packaging.subtotal, 0) > 0;
  const hasFreight = input.freight && numberOr(input.freight.subtotal, 0) > 0;
  
  if (!hasBom) missingData.push('BOM明细');
  if (!hasMaterial && !hasBom) missingData.push('材料成本');
  if (!hasHours) missingData.push('工时数据');
  if (!hasPackaging) missingData.push('包装费');
  if (!hasFreight) missingData.push('运输费');
  
  // Completeness score (5 data points)
  const points = [hasBom, hasMaterial || hasBom, hasHours, hasPackaging, hasFreight];
  const completeness = points.filter(Boolean).length / points.length;
  
  const descriptions: Record<PrecisionLevel, string> = {
    3: 'BOM行级精算',
    2: '线束级汇总',
    1: '系数近似估算',
  };
  
  return { level, description: descriptions[level]!, missingData, completeness };
}

/** Level 1 系数近似默认参数 */
export const LEVEL1_COEFFICIENTS: Level1Coefficients = {
  materialRatio: 0.65,
  laborRatio: 0.09,
  mfgRatio: 0.12,
  packagingRatio: 0.024,
  freightRatio: 0.006,
};

/** 
 * Level 1 系数近似计算 
 * @param totalPrice - 已知的到厂价或参考总价
 * @param rates - 费率配置
 * @param coefficients - 系数 (可选, 默认使用 LEVEL1_COEFFICIENTS)
 */
export function estimateByCoefficients(
  totalPrice: number,
  rates: CostRates,
  coefficients: Level1Coefficients = LEVEL1_COEFFICIENTS
): {
  materialCost: number;
  waste: number;
  directLabor: number;
  manufacturing: number;
  mgmtFee: number;
  profit: number;
  packaging: number;
  freight: number;
  exFactoryPrice: number;
  deliveredPrice: number;
} {
  const material = totalPrice * coefficients.materialRatio;
  const waste = material * numberOr(rates.wasteRate, 0.01);
  const labor = totalPrice * coefficients.laborRatio;
  const mfg = totalPrice * coefficients.mfgRatio;
  const mgmt = (material + labor + mfg) * numberOr(rates.mgmtRate, 0.06);
  const packaging = totalPrice * coefficients.packagingRatio;
  const freight = totalPrice * coefficients.freightRatio;
  const exFactory = material + waste + labor + mfg + mgmt;
  const profit = totalPrice - exFactory - packaging - freight;
  
  return {
    materialCost: material,
    waste,
    directLabor: labor,
    manufacturing: mfg,
    mgmtFee: mgmt,
    profit: Math.max(0, profit),
    packaging,
    freight,
    exFactoryPrice: exFactory + Math.max(0, profit),
    deliveredPrice: totalPrice,
  };
}
