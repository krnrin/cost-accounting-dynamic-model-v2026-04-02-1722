/**
 * ui/renderers/annual_table.js
 * Issue #6: 年度利润表渲染器
 * P1: error boundary 防护
 */
(function (global) {
  'use strict';

  var COLUMNS = [
    { key: 'year',     label: '年度',     format: 'plain' },
    { key: 'volume',   label: '销量',     format: 'integer' },
    { key: 'asp',      label: 'ASP',      format: 'decimal2' },
    { key: 'revenue',  label: '收入',     format: 'currency' },
    { key: 'cost',     label: '成本',     format: 'currency' },
    { key: 'profit',   label: '利润',     format: 'currency', colorize: true },
    { key: 'margin',   label: '毛利率',   format: 'percent', colorize: true },
  ];

  function formatCell(value, format) {
    if (!Number.isFinite(value)) return '--';
    switch (format) {
      case 'integer':  return Math.round(value).toLocaleString();
      case 'decimal2': return value.toFixed(2);
      case 'currency': return value.toLocaleString('zh-CN', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
      case 'percent':  return (value * 100).toFixed(1) + '%';
      default:         return String(value);
    }
  }

  function cellColor(value, colorize) {
    if (!colorize || !Number.isFinite(value)) return '';
    return value > 0 ? 'color:#4ade80' : value < 0 ? 'color:#f87171' : '';
  }

  /**
   * 渲染年度利润表
   * @param {HTMLElement} container
   * @param {Array} rows - 年度行数组 [{ year, volume, asp, revenue, cost, profit, margin }]
   */
  function render(container, rows) {
    if (!container) return;
    container.innerHTML = '';
    if (!rows || !rows.length) {
      container.innerHTML = '<p style="color:#666">暂无年度数据</p>';
      return;
    }
    try {
      var table = document.createElement('table');
      table.className = 'annual-table';
      // 表头
      var thead = document.createElement('thead');
      var headRow = document.createElement('tr');
      COLUMNS.forEach(function (col) {
        var th = document.createElement('th');
        th.textContent = col.label;
        headRow.appendChild(th);
      });
      thead.appendChild(headRow);
      table.appendChild(thead);
      // 表体
      var tbody = document.createElement('tbody');
      rows.forEach(function (row) {
        var tr = document.createElement('tr');
        COLUMNS.forEach(function (col) {
          var td = document.createElement('td');
          var value = row[col.key];
          td.textContent = formatCell(value, col.format);
          var style = cellColor(value, col.colorize);
          if (style) td.setAttribute('style', style);
          tr.appendChild(td);
        });
        tbody.appendChild(tr);
      });
      table.appendChild(tbody);
      container.appendChild(table);
    } catch (err) {
      console.error('[AnnualTable] render error:', err);
      container.innerHTML = '<div style="padding:12px;color:#f87171;">\u26A0 年度表渲染出错</div>';
    }
  }

  global.G281UI = global.G281UI || {};
  global.G281UI.AnnualTable = { COLUMNS: COLUMNS, render: render, formatCell: formatCell };
})(globalThis);
