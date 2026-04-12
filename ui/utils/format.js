/**
 * ui/utils/format.js
 * 统一格式化函数 — 消除 insights.js / logic_drawer.js / kpi_grid.js 等模块中的重复定义
 * 所有 UI 模块应引用 G281UI.Format 而非自行定义 formatCurrency/formatPercent 等函数
 */
(function (global) {
  'use strict';

  var formatters = new Map();

  function isNumber(value) {
    return Number.isFinite(Number(value));
  }

  /**
   * 格式化货币（人民币）
   * @param {*} value - 数值
   * @param {number} [digits=2] - 小数位数
   * @returns {string}
   */
  function formatCurrency(value, digits) {
    if (digits === undefined) digits = 2;
    var numeric = Number(value);
    if (!Number.isFinite(numeric)) return '\u2014';
    var key = 'c' + digits;
    if (!formatters.has(key)) {
      formatters.set(key, new Intl.NumberFormat('zh-CN', {
        style: 'currency', currency: 'CNY',
        minimumFractionDigits: digits, maximumFractionDigits: digits,
      }));
    }
    return formatters.get(key).format(numeric);
  }

  /**
   * 格式化数值（带千分位）
   */
  function formatNumber(value, digits) {
    if (digits === undefined) digits = 2;
    var numeric = Number(value);
    if (!Number.isFinite(numeric)) return '\u2014';
    return new Intl.NumberFormat('zh-CN', {
      minimumFractionDigits: digits, maximumFractionDigits: digits,
    }).format(numeric);
  }

  /**
   * 格式化百分比（输入为小数，如 0.05 → "5.00%"）
   */
  function formatPercent(value, digits) {
    if (digits === undefined) digits = 2;
    var numeric = Number(value);
    if (!Number.isFinite(numeric)) return '\u2014';
    return (numeric * 100).toFixed(digits) + '%';
  }

  /**
   * 格式化带符号货币（+¥1.23 / -¥4.56）
   */
  function formatSignedCurrency(value, digits) {
    if (digits === undefined) digits = 2;
    var numeric = Number(value);
    if (!Number.isFinite(numeric)) return '\u2014';
    var prefix = numeric >= 0 ? '+' : '-';
    // 去掉 formatCurrency 自带的负号
    var abs = formatCurrency(Math.abs(numeric), digits);
    return prefix + abs;
  }

  /**
   * 格式化带符号百分比（+5.00% / -3.20%）
   */
  function formatSignedPercent(value, digits) {
    if (digits === undefined) digits = 2;
    var numeric = Number(value);
    if (!Number.isFinite(numeric)) return '\u2014';
    return (numeric >= 0 ? '+' : '') + numeric.toFixed(digits) + '%';
  }

  /**
   * 格式化带符号点数（+1.23 pt / -0.45 pt）
   */
  function formatPoints(value, digits) {
    if (digits === undefined) digits = 2;
    var numeric = Number(value);
    if (!Number.isFinite(numeric)) return '\u2014';
    return (numeric >= 0 ? '+' : '') + numeric.toFixed(digits) + ' pt';
  }

  /**
   * HTML 转义 — 防 XSS
   */
  function escapeHtml(str) {
    if (typeof str !== 'string') return String(str == null ? '' : str);
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /**
   * 安全取字符串，空值回退到 fallback
   */
  function toText(value, fallback) {
    if (fallback === undefined) fallback = '';
    var text = String(value == null ? '' : value).trim();
    return text || fallback;
  }

  global.G281UI = global.G281UI || {};
  global.G281UI.Format = {
    isNumber: isNumber,
    formatCurrency: formatCurrency,
    formatNumber: formatNumber,
    formatPercent: formatPercent,
    formatSignedCurrency: formatSignedCurrency,
    formatSignedPercent: formatSignedPercent,
    formatPoints: formatPoints,
    escapeHtml: escapeHtml,
    toText: toText,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = global.G281UI.Format;
  }
})(globalThis);
