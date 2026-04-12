/**
 * ui/renderers/kpi_grid.js
 * Issue #6: KPI 指标网格渲染器
 * P1: XSS 修复 — innerHTML → textContent；error boundary
 */
(function (global) {
  'use strict';

  var KPI_DEFINITIONS = [
    { key: 'revenue',       label: '单套收入', unit: '元',  color: '#818cf8', icon: '\uD83D\uDCB0' },
    { key: 'cost',          label: '单套成本', unit: '元',  color: '#f87171', icon: '\uD83D\uDCE6' },
    { key: 'profit',        label: '单套利润', unit: '元',  color: '#4ade80', icon: '\uD83D\uDCC8' },
    { key: 'margin',        label: '毛利率',   unit: '%',  color: '#fbbf24', icon: '\uD83C\uDFAF' },
    { key: 'payback',       label: '回收销量', unit: '套', color: '#60a5fa', icon: '\uD83D\uDD04' },
    { key: 'capitalReturn', label: '资本回报', unit: '年', color: '#c084fc', icon: '\u23F3' },
  ];

  function formatKpiValue(value, unit) {
    if (!Number.isFinite(value)) return '--';
    if (unit === '%') return (value * 100).toFixed(1) + '%';
    if (unit === '年') return value === Infinity ? '\u221E' : value.toFixed(1);
    if (unit === '套') return value === Infinity ? '\u221E' : Math.round(value).toLocaleString();
    return value.toFixed(2);
  }

  function kpiColor(key, value) {
    if (key === 'profit' || key === 'margin') {
      return value > 0 ? '#4ade80' : value < 0 ? '#f87171' : '#94a3b8';
    }
    var def = KPI_DEFINITIONS.find(function (d) { return d.key === key; });
    return (def && def.color) || '#94a3b8';
  }

  function renderCard(def, value) {
    var card = document.createElement('div');
    card.className = 'kpi-card';
    var iconEl = document.createElement('div');
    iconEl.className = 'kpi-icon';
    iconEl.textContent = def.icon;
    var labelEl = document.createElement('div');
    labelEl.className = 'kpi-label';
    labelEl.textContent = def.label;
    var valueEl = document.createElement('div');
    valueEl.className = 'kpi-value';
    valueEl.style.color = kpiColor(def.key, value);
    valueEl.textContent = formatKpiValue(value, def.unit);
    card.appendChild(iconEl);
    card.appendChild(labelEl);
    card.appendChild(valueEl);
    return card;
  }

  /**
   * 渲染 KPI 网格
   * @param {HTMLElement} container - 容器元素
   * @param {Object} model - 计算结果
   */
  function render(container, model) {
    if (!container || !model) return;
    container.innerHTML = '';
    try {
      var grid = document.createElement('div');
      grid.className = 'kpi-grid';
      var vol = model.totalVolume || 1;
      var values = {
        revenue: (model.totalRevenue || 0) / vol,
        cost: model.operating || 0,
        profit: (model.totalProfit || 0) / vol,
        margin: model.margin || 0,
        payback: model.paybackVolume || Infinity,
        capitalReturn: model.paybackYears || Infinity,
      };
      KPI_DEFINITIONS.forEach(function (def) {
        grid.appendChild(renderCard(def, values[def.key]));
      });
      container.appendChild(grid);
    } catch (err) {
      console.error('[KpiGrid] render error:', err);
      container.innerHTML = '<div style="padding:12px;color:#f87171;">\u26A0 KPI 渲染出错</div>';
    }
  }

  global.G281UI = global.G281UI || {};
  global.G281UI.KpiGrid = { KPI_DEFINITIONS: KPI_DEFINITIONS, render: render, renderCard: renderCard, formatKpiValue: formatKpiValue };
})(globalThis);
