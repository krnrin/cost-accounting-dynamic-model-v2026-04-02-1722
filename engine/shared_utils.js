/**
 * engine/shared_utils.js
 * Issue #9: 共享工具函数与常量
 * 被所有 engine 子模块引用，必须最先加载
 */
(function (global) {
  'use strict';

  // ── 常量 ──────────────────────────────────────
  const FINANCIAL_VERSION_KEYS = new Set(['quote', 'fixed']);

  const STATE_FINANCIAL_VERSION_MAP = {
    bom: { freeze: 'quote', light: 'fixed' },
    metal: { quote: 'quote', fixed: 'fixed' },
    connector: { quote: 'quote', fixed: 'fixed' },
    sales: { quote: 'quote', fixed: 'fixed' },
    labor: { base: 'quote', optimize: 'fixed' },
    equipment: { base: 'quote', shared: 'fixed' },
    packaging: { base: 'quote', optimize: 'fixed' },
    mix: { quote: 'quote', fixed: 'fixed' },
  };

  // ── 基础工具 ──────────────────────────────────
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

  const weighted = (shares, indexes) =>
    shares.reduce((sum, value, index) => sum + (Number(value) || 0) / 100 * indexes[index], 0);

  const normalizeMix = (values) => {
    const series = values.map((v) => Math.max(0, Number(v) || 0));
    const total = series.reduce((s, v) => s + v, 0) || 1;
    return series.map((v) => v / total * 100);
  };

  function numberOr(value, fallback) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }

  function safeArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function clonePlain(value, fallback) {
    try { return JSON.parse(JSON.stringify(value)); }
    catch (_) { return fallback; }
  }

  function approxEqual(left, right, epsilon) {
    return Math.abs(numberOr(left, 0) - numberOr(right, 0)) <= (epsilon || 1e-6);
  }

  function arraysClose(left, right, epsilon) {
    const a = safeArray(left);
    const b = safeArray(right);
    if (a.length !== b.length) return false;
    return a.every((v, i) => approxEqual(v, b[i], epsilon));
  }

  // ── 导出 ──────────────────────────────────────
  global.G281SharedUtils = {
    FINANCIAL_VERSION_KEYS,
    STATE_FINANCIAL_VERSION_MAP,
    clamp,
    weighted,
    normalizeMix,
    numberOr,
    safeArray,
    clonePlain,
    approxEqual,
    arraysClose,
  };
})(typeof window !== 'undefined' ? window : globalThis);
