/**
 * g281 DOM Utilities
 * Extracted from g281_profit_dashboard.js — DOM-related helpers.
 *
 * Usage (browser, script tag):
 *   <script src="./utils/dom.js"></script>
 *   // window.G281Dom.escapeHtml('<script>')
 */
;(function (root) {
  'use strict';

  /** Escape HTML special characters to prevent XSS */
  const escapeHtml = (value) =>
    String(value ?? '').replace(/[&<>"']/g, (char) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      }[char]),
    );

  /**
   * Convert a 1-based column index to an Excel-style column label.
   * e.g. 0 → 'A', 25 → 'Z', 26 → 'AA'
   */
  function templateColumnLabel(index) {
    let next = Number(index) + 1;
    let label = '';
    while (next > 0) {
      const offset = (next - 1) % 26;
      label = String.fromCharCode(65 + offset) + label;
      next = Math.floor((next - 1) / 26);
    }
    return label || 'A';
  }

  // ─── Expose ──────────────────────────────────────────────────────

  const exports = {
    escapeHtml,
    templateColumnLabel,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exports;
  } else {
    root.G281Dom = exports;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
