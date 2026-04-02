/**
 * g281 Format Utilities
 * Extracted from g281_profit_dashboard.js — pure formatting functions.
 * No DOM dependencies. Safe to unit-test independently.
 *
 * Usage (browser, script tag):
 *   <script src="./utils/format.js"></script>
 *   // window.G281Format.fmtMoney(12345.6)
 *
 * Usage (ES module, future):
 *   import { fmtMoney, fmtPct } from './utils/format.js';
 */
;(function (root) {
  'use strict';

  // ─── Number Formatting ───────────────────────────────────────────

  /** Format as zh-CN locale money string, e.g. 12,345.67 */
  const fmtMoney = (v, d = 2) =>
    Number(v || 0).toLocaleString('zh-CN', {
      minimumFractionDigits: d,
      maximumFractionDigits: d,
    });

  /** Alias of fmtMoney — generic number with locale grouping */
  const fmtNumber = (v, d = 2) =>
    Number(v || 0).toLocaleString('zh-CN', {
      minimumFractionDigits: d,
      maximumFractionDigits: d,
    });

  /** Format money, returning '-' for null/undefined/empty/NaN */
  const fmtMaybeMoney = (v, d = 2) => {
    if (v === '' || v === null || v === undefined) return '-';
    const n = Number(v);
    return Number.isFinite(n) ? fmtMoney(n, d) : '-';
  };

  /** Format number, returning '-' for null/undefined/empty/NaN */
  const fmtMaybeNumber = (v, d = 2) => {
    if (v === '' || v === null || v === undefined) return '-';
    const n = Number(v);
    return Number.isFinite(n) ? fmtNumber(n, d) : '-';
  };

  /** Format metric: returns '-' if value is zero or non-finite */
  const fmtMetric = (v, d = 2) => {
    const n = Number(v);
    return Number.isFinite(n) && Math.abs(n) > 0.000001 ? fmtNumber(n, d) : '-';
  };

  /** Format as integer with locale grouping */
  const fmtInt = (v) => Math.round(Number(v || 0)).toLocaleString('zh-CN');

  /** Format as percentage, e.g. 0.156 → "15.60%" */
  const fmtPct = (v, d = 2) => `${(Number(v || 0) * 100).toFixed(d)}%`;

  /** Format with explicit sign, e.g. +1.23 or -4.56 */
  const fmtSigned = (v, d = 2) =>
    `${Number(v || 0) >= 0 ? '+' : ''}${Math.abs(Number(v || 0)).toFixed(d)}`;

  /** Format money with explicit sign */
  const fmtSignedMoney = (v) =>
    `${Number(v || 0) >= 0 ? '+' : ''}${fmtMoney(Math.abs(Number(v || 0)))}`;

  /** Format integer with fallback for NaN (—) and Infinity (∞) */
  const fmtMaybeInt = (v) => {
    const n = Number(v);
    return Number.isNaN(n) ? '—' : Number.isFinite(n) ? fmtInt(n) : '∞';
  };

  // ─── Expose ──────────────────────────────────────────────────────

  const exports = {
    fmtMoney,
    fmtNumber,
    fmtMaybeMoney,
    fmtMaybeNumber,
    fmtMetric,
    fmtInt,
    fmtPct,
    fmtSigned,
    fmtSignedMoney,
    fmtMaybeInt,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exports;
  } else {
    root.G281Format = exports;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
