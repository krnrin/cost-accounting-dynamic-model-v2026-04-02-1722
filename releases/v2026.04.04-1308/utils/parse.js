/**
 * g281 Parse Utilities
 * Extracted from g281_profit_dashboard.js — pure parsing functions.
 * No DOM dependencies. Safe to unit-test independently.
 *
 * Usage (browser, script tag):
 *   <script src="./utils/parse.js"></script>
 *   // window.G281Parse.parseLifecycleRate('3.5%')
 *
 * Usage (ES module, future):
 *   import { parseLifecycleRate } from './utils/parse.js';
 */
;(function (root) {
  'use strict';

  // ─── Dependencies ────────────────────────────────────────────────
  // parseNumericCellValue is defined in g281_bom_parser.js and exposed
  // on window. We reference it lazily to avoid load-order issues.
  function getParseNumericCellValue() {
    return (
      (typeof window !== 'undefined' && window.G281BomParser?.parseNumericCellValue) ||
      fallbackParseNumericCellValue
    );
  }

  /** Minimal fallback when g281_bom_parser.js is not loaded */
  function fallbackParseNumericCellValue(text) {
    if (text === null || text === undefined || text === '') return null;
    const cleaned = String(text).trim().replace(/,/g, '').replace(/¥|￥|\$/g, '');
    if (!cleaned) return null;
    const n = Number(cleaned.replace(/%$/, ''));
    return Number.isFinite(n) ? n : null;
  }

  // ─── Lifecycle Parsers ───────────────────────────────────────────

  /**
   * Parse a lifecycle rate value.
   * Handles percentages ("3.5%" → 0.035), plain decimals, and
   * ambiguous values >1 and <=100 (treated as percentages).
   * Always returns a non-negative number.
   */
  function parseLifecycleRate(value) {
    if (value === null || value === undefined || value === '') return 0;
    if (typeof value === 'number' && Number.isFinite(value)) {
      if (value > 1 && value <= 100) return Math.max(0, value / 100);
      return Math.max(0, value);
    }
    const text = String(value).trim();
    if (!text) return 0;
    const numeric = getParseNumericCellValue()(text);
    if (numeric === null) return 0;
    if (text.includes('%')) return Math.max(0, numeric / 100);
    if (numeric > 1 && numeric <= 100) return Math.max(0, numeric / 100);
    return Math.max(0, numeric);
  }

  /**
   * Parse a lifecycle money value.
   * Returns a finite number or 0.
   */
  function parseLifecycleMoney(value) {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
    const numeric = getParseNumericCellValue()(value);
    return numeric === null ? 0 : numeric;
  }

  /**
   * Normalize a year value.
   * Accepts numbers (2026) or strings ("FY2026", "2026年").
   * Returns a 4-digit year or the fallback.
   */
  function normalizeTemplateYear(value, fallback) {
    if (fallback === undefined) fallback = null;
    const numeric = Number(value);
    if (Number.isFinite(numeric) && numeric >= 1900 && numeric <= 3000) {
      return Math.round(numeric);
    }
    const match = String(value ?? '').match(/\b(20\d{2}|19\d{2})\b/);
    return match ? Number(match[1]) : fallback;
  }

  /**
   * Normalize a target margin percent value.
   * Clamps to [-99.99, 99.99] and rounds to 2 decimal places.
   * Returns null for invalid input.
   */
  function normalizeTargetMarginPercent(value) {
    if (value === '' || value === null || value === undefined) return null;
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return null;
    return Math.max(-99.99, Math.min(99.99, Number(numeric.toFixed(2))));
  }

  // ─── Expose ──────────────────────────────────────────────────────

  const exports = {
    parseLifecycleRate,
    parseLifecycleMoney,
    normalizeTemplateYear,
    normalizeTargetMarginPercent,
    fallbackParseNumericCellValue,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exports;
  } else {
    root.G281Parse = exports;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
