/**
 * ui/renderers/kpi_grid.js
 * Issue #6: KPI 指标网格渲染器
 * 纯函数：接收计算结果，输出 KPI 卡片 DOM
 */
(function (global) {
  'use strict';

  const KPI_DEFINITIONS = [
    { key: 'revenue',      label: '单套收入', unit: '元',  color: '#818cf8', icon: '💰' },
    { key: 'cost',         label: '单套成本', unit: '元',  color: '#f87171', icon: '📦' },
    { key: 'profit',       label: '单套利润', unit: '元',  color: '#4ade80', icon: '📈' },
    { key: 'margin',       label: '毛利率',   unit: '%',  color: '#fbbf24', icon: '🎯' },
    { key: 'payback',      label: '回收销量', unit: '套', color: '#60a5fa', icon: '🔄' },
    { key: 'capitalReturn', label: '资本回报', unit: '年', color: '#c084fc', icon: '⏳' },
  ];

  function formatKpiValue(value, unit) {
    if (!Number.isFinite(value)) return '--';
    if (unit === '%') return (value * 100).toFixed(1) + '%';
    if (unit === '年') return value === Infinity ? '∞' : value.toFixed(1);
    if (unit === '套') return value === Infinity ? '∞' : Math.round(value).toLocaleString();
    return value.toFixed(2);
  }

  function kpiColor(key, value) {
    if (key === 'profit' || key === 'margin') {
      return value > 0 ? '#4ade80' : value < 0 ? '#f87171' : '#94a3b8';
    }
    return KPI_DEFINITIONS.find(d => d.key === key)?.color || '#94a3b8';
  }

  function renderCard(def, value) {
    const card = document.createElement('div');
    card.className = 'kpi-card';
    card.innerHTML = `
      <div class="kpi-icon">${def.icon}</div>
      <div class="kpi-label">${def.label}</div>
      <div class="kpi-value" style="color:${kpiColor(def.key, value)}">
        ${formatKpiValue(value, def.unit)}
      </div>
    `;
    return card;
  }

  /**
   * 渲染 KPI 网格
   * @param {HTMLElement} container - 容器元素
   * @param {Object} model - 计算结果
   *   model.operating   - 单套运营成本
   *   model.margin       - 毛利率
   *   model.paybackVolume - 回收销量
   *   model.paybackYears  - 资本回报年数
   *   model.totalRevenue / model.totalVolume → 单套收入
   *   model.totalProfit / model.totalVolume → 单套利润
   */
  function render(container, model) {
    if (!container || !model) return;
    container.innerHTML = '';
    const grid = document.createElement('div');
    grid.className = 'kpi-grid';
    const vol = model.totalVolume || 1;
    const values = {
      revenue: (model.totalRevenue || 0) / vol,
      cost: model.operating || 0,
      profit: (model.totalProfit || 0) / vol,
      margin: model.margin || 0,
      payback: model.paybackVolume || Infinity,
      capitalReturn: model.paybackYears || Infinity,
    };
    KPI_DEFINITIONS.forEach(def => {
      grid.appendChild(renderCard(def, values[def.key]));
    });
    container.appendChild(grid);
  }

  global.G281UI = global.G281UI || {};
  global.G281UI.KpiGrid = { KPI_DEFINITIONS, render, renderCard, formatKpiValue };
})(typeof window !== 'undefined' ? window : globalThis);
