/**
 * utils/shared.js — 全局共享工具函数（唯一权威来源）
 *
 * Issue #10: 跨模块工具函数去重
 *
 * 以下函数曾在 5+ 个文件中重复定义：
 *   clonePlain  → utils/core.js, engine/shared_utils.js, engine/profit_shapley.js,
 *                  engine/bom_db.js, g281_factor_version_repo.js
 *   numberOr    → engine/shared_utils.js (numberOr), utils/core.js (coerceNumber)
 *   safeArray   → engine/shared_utils.js, g281_factor_version_repo.js (ensureArray)
 *   clamp       → engine/shared_utils.js, utils/core.js
 *   toText      → utils/core.js, g281_factor_version_repo.js
 *
 * 迁移方式：所有模块统一引用 G281Shared，不再自行定义。
 *
 * Usage:
 *   <script src="./utils/shared.js"></script>
 *   G281Shared.clonePlain(obj, fallback)
 */
;(function (root) {
  'use strict';

  // ── 类型守卫 ──────────────────────────────────

  /** 确保值为有限数字，否则返回 fallback */
  function numberOr(value, fallback) {
    if (fallback === undefined) fallback = 0;
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }

  /** coerceNumber 的别名，向后兼容 utils/core.js */
  const coerceNumber = numberOr;

  /** 确保值为数组 */
  function safeArray(value) {
    return Array.isArray(value) ? value : [];
  }

  /** 确保值为对象 */
  function ensureObject(value) {
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  }

  /** 确保值为非空字符串 */
  function toText(value, fallback) {
    if (fallback === undefined) fallback = '';
    const text = String(value ?? '').trim();
    return text || fallback;
  }

  // ── 数据操作 ──────────────────────────────────

  /** JSON 深克隆，失败返回 fallback */
  function clonePlain(value, fallback) {
    if (fallback === undefined) fallback = null;
    try {
      return JSON.parse(JSON.stringify(value));
    } catch (_) {
      return fallback;
    }
  }

  /** 数值区间钳制 */
  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  /** 浅对象等值比较 */
  function shallowObjectEqual(left, right) {
    if (!left) left = {};
    if (!right) right = {};
    const leftKeys = Object.keys(left);
    const rightKeys = Object.keys(right);
    if (leftKeys.length !== rightKeys.length) return false;
    return leftKeys.every((key) => left[key] === right[key]);
  }

  /** 布尔值标准化（支持 'yes'/'no'/'on'/'off'/0/1） */
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

  /** 近似相等（浮点） */
  function approxEqual(left, right, epsilon) {
    return Math.abs(numberOr(left, 0) - numberOr(right, 0)) <= (epsilon || 1e-6);
  }

  /** 数组近似相等 */
  function arraysClose(left, right, epsilon) {
    const a = safeArray(left);
    const b = safeArray(right);
    if (a.length !== b.length) return false;
    return a.every((v, i) => approxEqual(v, b[i], epsilon));
  }

  // ── 计算辅助 ──────────────────────────────────

  /** 加权求和 */
  function weighted(shares, indexes) {
    return shares.reduce((sum, value, index) =>
      sum + (Number(value) || 0) / 100 * indexes[index], 0);
  }

  /** 归一化配置比例 */
  function normalizeMix(values) {
    const series = values.map((v) => Math.max(0, Number(v) || 0));
    const total = series.reduce((s, v) => s + v, 0) || 1;
    return series.map((v) => v / total * 100);
  }

  // ── ID 生成 ───────────────────────────────────

  /** 生成带前缀的唯一 ID */
  function createId(prefix, suffix) {
    const stamp = Date.now().toString(36);
    const tail = Math.random().toString(36).slice(2, 8);
    return `${prefix}-${suffix ? `${suffix}-` : ''}${stamp}-${tail}`;
  }

  // ── 导出 ──────────────────────────────────────

  const exports = {
    // 类型守卫
    numberOr,
    coerceNumber,
    safeArray,
    ensureObject,
    toText,
    normalizeStoredBoolean,
    // 数据操作
    clonePlain,
    clamp,
    shallowObjectEqual,
    approxEqual,
    arraysClose,
    // 计算辅助
    weighted,
    normalizeMix,
    // ID
    createId,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exports;
  } else {
    root.G281Shared = exports;
    // 向后兼容：同时挂载到旧命名空间
    if (!root.G281Core) root.G281Core = exports;
  }
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this);
