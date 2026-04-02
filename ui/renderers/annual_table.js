/**
 * ui/renderers/annual_table.js
 * Issue #6: 年度利润表渲染器
 * 纯函数：接收年度行数据，输出 <table> DOM
 */
(function (global) {
  'use strict';

  const COLUMNS = [
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
    const table = document.createElement('table');
    table.className = 'annual-table';
    // 表头
    const thead = document.createElement('thead');
    const headRow = document.createElement('tr');
    COLUMNS.forEach(col => {
      const th = document.createElement('th');
      th.textContent = col.label;
      headRow.appendChild(th);
    });
    thead.appendChild(headRow);
    table.appendChild(thead);
    // 表体
    const tbody = document.createElement('tbody');
    rows.forEach(row => {
      const tr = document.createElement('tr');
      COLUMNS.forEach(col => {
        const td = document.createElement('td');
        const value = row[col.key];
        td.textContent = formatCell(value, col.format);
        const style = cellColor(value, col.colorize);
        if (style) td.setAttribute('style', style);
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    container.appendChild(table);
  }

  global.G281UI = global.G281UI || {};
  global.G281UI.AnnualTable = { COLUMNS, render, formatCell };
})(typeof window !== 'undefined' ? window : globalThis);
