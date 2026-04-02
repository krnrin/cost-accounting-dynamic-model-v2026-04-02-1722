/**
 * g281 Core Utilities
 * Issue #10: 重复函数委托给 G281Shared (utils/shared.js)
 * Usage (browser, script tag):
 *   <script src="./utils/shared.js"></script>  <!-- 必须先加载 -->
 *   <script src="./utils/core.js"></script>
 *   // window.G281Core.toText(null, 'fallback')
 */
;(function (root) {
  'use strict';

  // Issue #10: 委托给 G281Shared
  const _S = (typeof G281Shared !== 'undefined') ? G281Shared : {};

  const coerceNumber = _S.coerceNumber || _S.numberOr || function (value, fallback) {
    if (fallback === undefined) fallback = 0;
    const next = Number(value);
    return Number.isFinite(next) ? next : fallback;
  };

  const toText = _S.toText || function (value, fallback) {
    if (fallback === undefined) fallback = '';
    const text = String(value ?? '').trim();
    return text || fallback;
  };

  const clonePlain = _S.clonePlain || function (value, fallback) {
    try {
      return JSON.parse(JSON.stringify(value));
    } catch (error) {
      return fallback;
    }
  };

  /** Shallow object equality check (same keys, same values via ===) */
  function shallowObjectEqual(left, right) {
    if (!left) left = {};
    if (!right) right = {};
    const leftKeys = Object.keys(left);
    const rightKeys = Object.keys(right);
    if (leftKeys.length !== rightKeys.length) return false;
    return leftKeys.every((key) => left[key] === right[key]);
  }

  const clamp = _S.clamp || function (v, min, max) {
    return Math.min(max, Math.max(min, v));
  };

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
