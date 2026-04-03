/**
 * waterfall_causal.js — Issue #3: 因果链瀑布图
 *
 * 业务逻辑：
 * Shapley 归因忽略因果顺序（对称博弈），导致归因不清晰。
 * 瀑布图按**业务因果链**的固定顺序逐步叠加，让用户看到：
 *   基准利润 → BOM变更影响 → 铜铝价影响 → 连接器影响 → ... → 最终利润
 *
 * 因果链顺序（不可调）：
 *   1. BOM版本（设计变更最先锁定）
 *   2. 铜铝基价（大宗商品，不可控）
 *   3. 连接器价格（供应商协议价）
 *   4. 工时（工艺优化）
 *   5. 设备资源
 *   6. 包装物流
 *   7. 销量预测（市场侧）
 *   8. 配置比例（客户侧）
 *   9. 年降
 *   10. 一次性费用
 *   11. 返点
 *   12. VAVE
 *
 * 保留 Shapley 作为「辅助归因视图」，瀑布图为「主因果视图」。
 */
(function (global) {
  'use strict';

  // P2#9: 委托给 G281Shared，消除重复 clonePlain
  const clonePlain = (global.G281Shared && global.G281Shared.clonePlain)
    || function (value) { try { return JSON.parse(JSON.stringify(value)); } catch (e) { return {}; } };

  // 因果链固定顺序
  const CAUSAL_ORDER = [
    { key: 'bom',             label: 'BOM版本',    color: '#5B8DEF' },
    { key: 'metal',           label: '铜铝基价',    color: '#F5A623' },
    { key: 'connector',       label: '连接器价格',  color: '#7B68EE' },
    { key: 'labor',           label: '工时',        color: '#4ECDC4' },
    { key: 'equipment',       label: '设备资源',    color: '#95A5A6' },
    { key: 'packaging',       label: '包装物流',    color: '#E67E22' },
    { key: 'sales',           label: '销量预测',    color: '#3498DB' },
    { key: 'mix',             label: '配置比例',    color: '#9B59B6' },
    { key: 'annualDrop',      label: '年降',        color: '#1ABC9C' },
    { key: 'oneTimeCustomer', label: '一次性费用',  color: '#E74C3C' },
    { key: 'rebate',          label: '返点',        color: '#F39C12' },
    { key: 'vave',            label: 'VAVE',        color: '#2ECC71' },
  ];

  /**
   * 计算因果链瀑布图数据
   */
  function computeCausalWaterfall(options) {
    const engine = options?.engine;
    const runtime = options?.runtime;
    if (!engine || typeof engine.computeModel !== 'function') {
      throw new Error('waterfall_causal requires engine.computeModel(...).');
    }

    const factors = options?.factors || CAUSAL_ORDER;
    const baselineState = options?.baselineState || {};
    const baselineDraft = options?.baselineDraft || {};
    const scenarioState = options?.scenarioState || {};
    const scenarioDraft = options?.scenarioDraft || {};

    // Step 0: 基准
    const baseModel = engine.computeModel(runtime, baselineDraft, baselineState);
    const baseMargin = Number(baseModel?.margin) || 0;

    // 逐步切换每个因素
    let currentState = { ...baselineState };
    let currentDraft = clonePlain(baselineDraft);
    let prevMargin = baseMargin;

    const steps = [{
      key: '_baseline',
      label: '基准利润率',
      margin: baseMargin,
      delta: 0,
      cumulative: baseMargin,
      isBaseline: true,
      isTotal: false,
      color: '#34495E',
    }];

    factors.forEach(factor => {
      currentState = { ...currentState, [factor.key]: scenarioState[factor.key] };
      if (factor.draftKeys) {
        factor.draftKeys.forEach(dk => {
          if (scenarioDraft.hasOwnProperty(dk)) {
            currentDraft[dk] = clonePlain(scenarioDraft[dk]);
          }
        });
      }

      const model = engine.computeModel(runtime, currentDraft, currentState);
      const margin = Number(model?.margin) || 0;
      const delta = margin - prevMargin;

      steps.push({
        key: factor.key,
        label: factor.label,
        margin,
        delta,
        cumulative: margin,
        isBaseline: false,
        isTotal: false,
        color: delta >= 0 ? '#2ECC71' : '#E74C3C',
        factorColor: factor.color,
      });

      prevMargin = margin;
    });

    // 最终结果
    const finalMargin = prevMargin;
    steps.push({
      key: '_total',
      label: '最终利润率',
      margin: finalMargin,
      delta: finalMargin - baseMargin,
      cumulative: finalMargin,
      isBaseline: false,
      isTotal: true,
      color: finalMargin >= baseMargin ? '#27AE60' : '#C0392B',
    });

    return {
      steps,
      baseMargin,
      finalMargin,
      totalDelta: finalMargin - baseMargin,
      factorCount: factors.length,
      topFactors: steps
        .filter(s => !s.isBaseline && !s.isTotal)
        .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
        .slice(0, 5)
        .map(s => ({ key: s.key, label: s.label, delta: s.delta })),
    };
  }

  /**
   * 生成瀑布图 HTML（纯 DOM，不依赖 Chart.js）
   */
  function renderWaterfallHTML(waterfallData, renderOptions = {}) {
    const width = renderOptions.width || '100%';
    const barHeight = renderOptions.barHeight || 32;
    const steps = waterfallData?.steps || [];
    if (!steps.length) return '<div class="waterfall-empty">无瀑布图数据</div>';

    const margins = steps.map(s => s.cumulative);
    const maxMargin = Math.max(...margins, 0);
    const minMargin = Math.min(...margins, 0);
    const range = maxMargin - minMargin || 1;

    const formatPct = (v) => (v * 100).toFixed(2) + '%';
    const formatDelta = (v) => (v >= 0 ? '+' : '') + formatPct(v);

    let html = `<div class="waterfall-chart" style="width:${width}">`;
    html += '<div class="waterfall-header"><span class="waterfall-title">因果链瀑布图</span>';
    html += `<span class="waterfall-subtitle">${formatPct(waterfallData.baseMargin)} → ${formatPct(waterfallData.finalMargin)} (${formatDelta(waterfallData.totalDelta)})</span></div>`;

    steps.forEach(step => {
      const leftPct = ((Math.min(step.cumulative, step.cumulative - step.delta) - minMargin) / range * 80 + 10);
      const widthPct = Math.abs(step.delta) / range * 80;

      const barClass = step.isBaseline || step.isTotal ? 'waterfall-bar-total' : (step.delta >= 0 ? 'waterfall-bar-positive' : 'waterfall-bar-negative');

      html += '<div class="waterfall-row">';
      html += `<div class="waterfall-label">${step.label}</div>`;
      html += '<div class="waterfall-bar-container">';

      if (step.isBaseline || step.isTotal) {
        const totalLeft = ((0 - minMargin) / range * 80 + 10);
        const totalWidth = Math.abs(step.cumulative) / range * 80;
        html += `<div class="${barClass}" style="left:${Math.min(totalLeft, totalLeft + (step.cumulative < 0 ? -totalWidth : 0))}%;width:${totalWidth}%;height:${barHeight}px"></div>`;
      } else {
        html += `<div class="${barClass}" style="left:${leftPct}%;width:${Math.max(widthPct, 0.5)}%;height:${barHeight}px"></div>`;
      }

      html += '</div>';
      html += `<div class="waterfall-value ${step.delta >= 0 ? 'positive' : 'negative'}">${step.isBaseline ? formatPct(step.margin) : (step.isTotal ? formatPct(step.margin) : formatDelta(step.delta))}</div>`;
      html += '</div>';
    });

    html += '</div>';
    return html;
  }

  // --- 导出 ---
  const api = {
    computeCausalWaterfall,
    renderWaterfallHTML,
    CAUSAL_ORDER,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  global.G281WaterfallCausal = api;
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this);
