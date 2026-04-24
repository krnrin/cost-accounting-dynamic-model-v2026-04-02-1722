/**
 * engine/shared_utils.ts
 *
 * 共享工具函数与常量 (TypeScript version)
 *
 * Conversion Rules:
 * 1. Removed IIFE wrapper
 * 2. Removed global attachment
 * 3. ES module with named exports
 * 4. TypeScript type annotations added
 * 5. Logic preserved exactly
 * 6. No external imports
 */

// ── 常量 ──────────────────────────────────────

export const FINANCIAL_VERSION_KEYS: Set<string> = new Set(['quote', 'fixed']);

export const STATE_FINANCIAL_VERSION_MAP: Record<string, Record<string, string>> = {
  bom: { freeze: 'quote', light: 'fixed' },
  metal: { quote: 'quote', fixed: 'fixed' },
  connector: { quote: 'quote', fixed: 'fixed' },
  sales: { quote: 'quote', fixed: 'fixed' },
  labor: { base: 'quote', optimize: 'fixed' },
  equipment: { base: 'quote', shared: 'fixed' },
  packaging: { base: 'quote', optimize: 'fixed' },
  mix: { quote: 'quote', fixed: 'fixed' },
};

// ── 工具函数 ──────────────────────────────────

/**
 * 将数值限制在 [min, max] 范围内
 */
export const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

/**
 * 尝试将输入转换为数字，如果失败或非有限数则返回回退值
 */
export const numberOr = (value: any, fallback: number): number => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

/**
 * 优先使用 installationRatio；未提供时回退到 vehicleRatio。
 * 0 是合法值，不能被当成“未提供”。
 */
export const resolveEffectiveRatio = (
  installationRatio: any,
  vehicleRatio: any,
): number => {
  if (installationRatio !== undefined && installationRatio !== null) {
    const primary = Number(installationRatio);
    if (Number.isFinite(primary)) {
      return primary;
    }
  }
  return numberOr(vehicleRatio, 0);
};

/**
 * 确保返回一个数组，如果输入不是数组则返回空数组
 */
export const safeArray = <T = any>(value: any): T[] =>
  Array.isArray(value) ? value : [];

/**
 * 深度克隆纯数据对象（通过 JSON 序列化）
 */
export const clonePlain = <T>(value: T, fallback: T): T => {
  try {
    return JSON.parse(JSON.stringify(value));
  } catch (_) {
    return fallback;
  }
};

/**
 * 计算加权和
 * shares 为百分比数组，indexes 为对应的指标数组
 */
export const weighted = (shares: (number | string)[], indexes: number[]): number =>
  shares.reduce((sum: number, value: number | string, index: number) =>
    sum + (Number(value) || 0) / 100 * (indexes[index] || 0), 0);

/**
 * 归一化混合比例，确保总和为 100
 */
export const normalizeMix = (values: (number | string)[]): number[] => {
  const series = values.map((v) => Math.max(0, Number(v) || 0));
  const total = series.reduce((s, v) => s + v, 0) || 1;
  return series.map((v) => (v / total) * 100);
};

/**
 * 判断两个数是否在误差范围内相等
 */
export function approxEqual(left: any, right: any, epsilon?: number): boolean {
  return Math.abs(numberOr(left, 0) - numberOr(right, 0)) <= (epsilon || 1e-6);
}

/**
 * 判断两个数组是否在误差范围内相等
 */
export function arraysClose(left: any, right: any, epsilon?: number): boolean {
  const a = safeArray(left);
  const b = safeArray(right);
  if (a.length !== b.length) return false;
  return a.every((v, i) => approxEqual(v, b[i], epsilon));
}
