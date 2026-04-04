/**
 * ui/renderers/compare_panel.js
 * Issue #6: 报价 vs 当前 对比面板渲染器
 */
(function (global) {
  'use strict';

  /**
   * 渲染对比面板
   * @param {HTMLElement} container
   * @param {Array} compareRows - [[label, baseValue, currentValue], ...]
   */
  function render(container, compareRows) {
    if (!container) return;
    container.innerHTML = '';
    if (!compareRows || !compareRows.length) return;
    const table = document.createElement('table');
    table.className = 'compare-table';
    const thead = document.createElement('thead');
    thead.innerHTML = '<tr><th>指标</th><th>报价基线</th><th>当前值</th><th>差异</th></tr>';
    table.appendChild(thead);
    const tbody = document.createElement('tbody');
    compareRows.forEach(([label, base, current]) => {
      const delta = Number.isFinite(base) && Number.isFinite(current) ? current - base : NaN;
      const deltaColor = delta > 0 ? '#4ade80' : delta < 0 ? '#f87171' : '#94a3b8';
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${label}</td>
        <td>${formatValue(base, label)}</td>
        <td>${formatValue(current, label)}</td>
        <td style="color:${deltaColor}">${formatValue(delta, label, true)}</td>
      `;
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    container.appendChild(table);
  }

  function formatValue(value, label, isDelta) {
    if (!Number.isFinite(value)) return '--';
    if (label.includes('毛利率')) return (value * 100).toFixed(1) + '%';
    if (label.includes('回收销量')) return value === Infinity ? '∞' : Math.round(value).toLocaleString();
    const prefix = isDelta && value > 0 ? '+' : '';
    return prefix + value.toFixed(2);
  }

  global.G281UI = global.G281UI || {};
  global.G281UI.ComparePanel = { render };
})(typeof window !== 'undefined' ? window : globalThis);
