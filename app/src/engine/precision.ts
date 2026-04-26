import type { HarnessInput, PrecisionLevel, PrecisionMeta } from '@/types/harness';
import type { CostRates, Level1Coefficients } from '@/types/project';
import { numberOr } from './shared_utils';

/** 浮点精度 epsilon */
export const EPSILON = 1e-10;

/**
 * 精确加法：避免浮点累加误差
 * 使用整数运算后还原
 */
export function add(a: number, b: number): number {
  return Math.round((a + b) * 1e10) / 1e10;
}

/**
 * 精确乘法：避免浮点乘法误差
 */
export function multiply(a: number, b: number): number {
  return Math.round(a * b * 1e10) / 1e10;
}

/**
 * 精确除法
 */
export function divide(a: number, b: number): number {
  if (b === 0) return 0;
  return Math.round((a / b) * 1e10) / 1e10;
}

/**
 * 精确求和
 */
export function sum(values: number[]): number {
  return values.reduce((acc, val) => add(acc, val), 0);
}

/**
 * 四舍五入到指定小数位
 */
export function round(value: number, decimals: number = 4): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

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
 * @returns 计算结果，profit可能为负值（表示亏损），由上游业务层决定如何处理
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
  /** 利润为负时为true，供上游业务校验 */
  isLoss: boolean;
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
  // 不再静默截断负值，让上游业务层决定如何处理亏损情况
  const isLoss = profit < 0;

  return {
    materialCost: material,
    waste,
    directLabor: labor,
    manufacturing: mfg,
    mgmtFee: mgmt,
    profit,
    packaging,
    freight,
    exFactoryPrice: exFactory + profit,
    deliveredPrice: totalPrice,
    isLoss,
  };
}
