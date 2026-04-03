/**
 * ui/renderers/compare_panel.js
 * Issue #6: 报价 vs 当前 对比面板渲染器
 * P1: XSS 修复 — innerHTML → textContent；error boundary
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
    try {
      var table = document.createElement('table');
      table.className = 'compare-table';
      var thead = document.createElement('thead');
      var headTr = document.createElement('tr');
      ['指标', '报价基线', '当前值', '差异'].forEach(function (text) {
        var th = document.createElement('th');
        th.textContent = text;
        headTr.appendChild(th);
      });
      thead.appendChild(headTr);
      table.appendChild(thead);
      var tbody = document.createElement('tbody');
      compareRows.forEach(function (row) {
        var label = row[0], base = row[1], current = row[2];
        var delta = Number.isFinite(base) && Number.isFinite(current) ? current - base : NaN;
        var deltaColor = delta > 0 ? '#4ade80' : delta < 0 ? '#f87171' : '#94a3b8';
        var tr = document.createElement('tr');
        var tdLabel = document.createElement('td');
        tdLabel.textContent = label;
        var tdBase = document.createElement('td');
        tdBase.textContent = formatValue(base, label);
        var tdCurrent = document.createElement('td');
        tdCurrent.textContent = formatValue(current, label);
        var tdDelta = document.createElement('td');
        tdDelta.textContent = formatValue(delta, label, true);
        tdDelta.style.color = deltaColor;
        tr.appendChild(tdLabel);
        tr.appendChild(tdBase);
        tr.appendChild(tdCurrent);
        tr.appendChild(tdDelta);
        tbody.appendChild(tr);
      });
      table.appendChild(tbody);
      container.appendChild(table);
    } catch (err) {
      console.error('[ComparePanel] render error:', err);
      container.innerHTML = '<div style="padding:12px;color:#f87171;">\u26A0 对比面板渲染出错</div>';
    }
  }

  function formatValue(value, label, isDelta) {
    if (!Number.isFinite(value)) return '--';
    if (label.includes('毛利率')) return (value * 100).toFixed(1) + '%';
    if (label.includes('回收销量')) return value === Infinity ? '\u221E' : Math.round(value).toLocaleString();
    var prefix = isDelta && value > 0 ? '+' : '';
    return prefix + value.toFixed(2);
  }

  global.G281UI = global.G281UI || {};
  global.G281UI.ComparePanel = { render: render };
})(globalThis);
