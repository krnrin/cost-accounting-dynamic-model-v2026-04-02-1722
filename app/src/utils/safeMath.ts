/**
 * safeMath.ts — Numeric safety helpers to avoid NaN / Infinity in UI rendering.
 *
 * Usage:
 *   import { safePercent, safeDivide } from '@/utils/safeMath';
 *   const pct = safePercent(part, total); // 0 if total is 0
 */

/**
 * Safe division: returns `fallback` when divisor is 0 or non-finite.
 */
export function safeDivide(numerator: number, denominator: number, fallback = 0): number {
  if (!denominator || !Number.isFinite(denominator)) return fallback;
  const result = numerator / denominator;
  return Number.isFinite(result) ? result : fallback;
}

/**
 * Safe percentage: `part / total`, returns 0 when total is 0.
 * Result is a ratio (0–1), not a percentage (0–100).
 */
export function safePercent(part: number, total: number): number {
  return safeDivide(part, total, 0);
}

/**
 * Format a ratio as percentage string, e.g. 0.123 => "12.3%".
 * Returns "-" if value is null/undefined.
 */
export function formatPercent(value: number | null | undefined, decimals = 1): string {
  if (value == null || !Number.isFinite(value)) return '-';
  return `${(value * 100).toFixed(decimals)}%`;
}

/**
 * Format currency, returns "-" for undefined/NaN.
 */
export function formatCurrency(value: number | null | undefined, prefix = '\u00a5'): string {
  if (value == null || !Number.isFinite(value)) return '-';
  return `${prefix}${value.toFixed(2)}`;
}
