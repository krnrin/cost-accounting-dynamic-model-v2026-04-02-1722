/**
 * g281 Core Utilities
 * Extracted from g281_profit_dashboard.js — generic pure functions
 * used across multiple modules.
 *
 * Usage (browser, script tag):
 *   <script src="./utils/core.js"></script>
 *   // window.G281Core.toText(null, 'fallback')
 */
;(function (root) {
  'use strict';

  /** Coerce a value to a finite number, returning fallback if NaN/Infinity */
  function coerceNumber(value, fallback) {
    if (fallback === undefined) fallback = 0;
    const next = Number(value);
    return Number.isFinite(next) ? next : fallback;
  }

  /** Coerce a value to a trimmed non-empty string, returning fallback if empty */
  function toText(value, fallback) {
    if (fallback === undefined) fallback = '';
    const text = String(value ?? '').trim();
    return text || fallback;
  }

  /** Deep clone via JSON round-trip; returns fallback on failure */
  function clonePlain(value, fallback) {
    try {
      return JSON.parse(JSON.stringify(value));
    } catch (error) {
      return fallback;
    }
  }

  /** Shallow object equality check (same keys, same values via ===) */
  function shallowObjectEqual(left, right) {
    if (!left) left = {};
    if (!right) right = {};
    const leftKeys = Object.keys(left);
    const rightKeys = Object.keys(right);
    if (leftKeys.length !== rightKeys.length) return false;
    return leftKeys.every((key) => left[key] === right[key]);
  }

  /** Clamp a number between min and max (inclusive) */
  function clamp(v, min, max) {
    return Math.min(max, Math.max(min, v));
  }

  /**
   * Normalize a stored boolean value.
   * Accepts: true/false, 0/1, 'true'/'false', 'yes'/'no', 'on'/'off'.
   */
  function normalizeStoredBoolean(value, fallback) {
    if (fallback === undefined) fallback = false;
    if (value === null || value === undefined || value === '') return fallback;
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value !== 0;
    const normalized = String(value).trim().toLowerCase();
    if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
    if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
    return fallback;
  }

  // ─── Expose ──────────────────────────────────────────────────────

  const exports = {
    coerceNumber,
    toText,
    clonePlain,
    shallowObjectEqual,
    clamp,
    normalizeStoredBoolean,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exports;
  } else {
    root.G281Core = exports;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
