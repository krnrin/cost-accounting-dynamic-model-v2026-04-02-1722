/**
 * ui/dashboard_utils.js
 * Low-risk utility extraction for dashboard.js.
 */
;(function (root) {
  'use strict';

  const shared = root.G281Shared || root.G281Core || {};

  function clonePlain(value, fallback) {
    if (typeof shared.clonePlain === 'function') {
      return shared.clonePlain(value, fallback);
    }
    try {
      return JSON.parse(JSON.stringify(value));
    } catch (_) {
      return fallback;
    }
  }

  function coerceNumber(value, fallback) {
    if (typeof shared.coerceNumber === 'function') {
      return shared.coerceNumber(value, fallback == null ? 0 : fallback);
    }
    const next = Number(value);
    return Number.isFinite(next) ? next : (fallback == null ? 0 : fallback);
  }

  function toText(value, fallback) {
    if (typeof shared.toText === 'function') {
      return shared.toText(value, fallback == null ? '' : fallback);
    }
    const text = String(value ?? '').trim();
    return text || (fallback == null ? '' : fallback);
  }

  function shallowObjectEqual(left, right) {
    if (typeof shared.shallowObjectEqual === 'function') {
      return shared.shallowObjectEqual(left || {}, right || {});
    }
    const leftValue = left || {};
    const rightValue = right || {};
    const leftKeys = Object.keys(leftValue);
    const rightKeys = Object.keys(rightValue);
    if (leftKeys.length !== rightKeys.length) return false;
    return leftKeys.every(function (key) {
      return leftValue[key] === rightValue[key];
    });
  }

  function normalizeStoredBoolean(value, fallback) {
    if (typeof shared.normalizeStoredBoolean === 'function') {
      return shared.normalizeStoredBoolean(value, fallback === undefined ? false : fallback);
    }
    if (fallback === undefined) fallback = false;
    if (value === null || value === undefined || value === '') return fallback;
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value !== 0;
    const normalized = String(value).trim().toLowerCase();
    if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
    if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
    return fallback;
  }

  function createUniqueScenarioId() {
    if (typeof shared.createId === 'function') {
      return shared.createId('scenario');
    }
    return 'scenario-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
  }

  const exports = {
    clonePlain: clonePlain,
    coerceNumber: coerceNumber,
    toText: toText,
    shallowObjectEqual: shallowObjectEqual,
    normalizeStoredBoolean: normalizeStoredBoolean,
    createUniqueScenarioId: createUniqueScenarioId,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exports;
  } else {
    root.G281DashboardUtils = exports;
  }
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this);
