(function (global) {
  'use strict';

  const DRAWER_ID = 'g281-profit-logic-drawer-root';
  const TAGLINE = '高压线束动态利润引擎';
  const VERSION_GROUPS = [
    { key: 'bom', label: 'BOM版本', kind: 'profit', note: '直接决定结构、材料口径和工程参数。' },
    { key: 'configSheet', label: '配置清单', kind: 'management', note: '当前用于开发对照与录入管理，不单独进入利润公式。' },
    { key: 'metal', label: '铜铝基价', kind: 'profit', note: '驱动导线与材料成本估算。' },
    { key: 'connector', label: '连接器价格', kind: 'profit', note: '决定连接器执行价与连接器材料成本。' },
    { key: 'labor', label: '工时版本', kind: 'profit', note: '决定直接工时与制造工时费率。' },
    { key: 'equipment', label: '资源投入', kind: 'profit', note: '决定设备/模具/工装/R&D摊销。' },
    { key: 'packaging', label: '包装物流', kind: 'profit', note: '决定包装、运费、仓储与其他物流成本。' },
    { key: 'sales', label: '销量预测', kind: 'profit', note: '决定生命周期销量与年度分布。' },
    { key: 'mix', label: '配置比例', kind: 'profit', note: '决定售价系数与成本系数。' },
    { key: 'annualDrop', label: '年降', kind: 'profit', note: '按年度作用到ASP。' },
    { key: 'oneTimeCustomer', label: '一次性费用', kind: 'profit', note: '客户直付或按量分摊进入收入。' },
    { key: 'rebate', label: '返点', kind: 'profit', note: '按年度总额折算到单套返点。' },
    { key: 'vave', label: 'VAVE', kind: 'profit', note: '作为节省额抵减单套成本。' },
  ];

  const currencyFormatters = new Map();

  function formatCurrency(value, digits = 2) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return '—';
    const key = String(digits);
    if (!currencyFormatters.has(key)) {
      currencyFormatters.set(key, new Intl.NumberFormat('zh-CN', {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
      }));
    }
    return currencyFormatters.get(key).format(numeric);
  }

  function formatNumber(value, digits = 2) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return '—';
    return new Intl.NumberFormat('zh-CN', {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    }).format(numeric);
  }

  function formatPercent(value, digits = 2) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return '—';
    return `${(numeric * 100).toFixed(digits)}%`;
  }

  function formatSignedCurrency(value, digits = 2) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return '—';
    return `${numeric >= 0 ? '+' : '-'}${formatCurrency(Math.abs(numeric), digits)}`;
  }

  function formatSignedPoints(value, digits = 2) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return '—';
    return `${numeric >= 0 ? '+' : ''}${numeric.toFixed(digits)} pt`;
  }

  function createElement(tag, className) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    return node;
  }

  function safeArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function safeObject(value) {
    return value && typeof value === 'object' ? value : {};
  }

  function toText(value, fallback = '') {
    const text = String(value ?? '').trim();
    return text || fallback;
  }

  function sumArray(values) {
    return safeArray(values).reduce((sum, value) => sum + (Number(value) || 0), 0);
  }

  function averageArray(values) {
    const list = safeArray(values).map((value) => Number(value) || 0);
    if (!list.length) return 0;
    return sumArray(list) / list.length;
  }

  function compareRow(model, index) {
    const rows = safeArray(model && model.compare);
    const row = safeArray(rows[index]);
    return {
      label: row[0] || '',
      base: Number(row[1]) || 0,
      current: Number(row[2]) || 0,
    };
  }

  function activeVersionKindLabel(kind) {
    return kind === 'management' ? '管理侧数据' : '直接入利润引擎';
  }

  function buildVersionMetrics(runtime, stateSnapshot, model) {
    const masterVersions = safeObject(runtime && runtime.master && runtime.master.versions);
    const modelState = safeObject(model && model.stateSnapshot);
    const mergedState = { ...safeObject(stateSnapshot), ...modelState };
    return VERSION_GROUPS.map((group) => {
      const key = mergedState[group.key] || '';
      const option = safeObject(masterVersions[group.key] && masterVersions[group.key][key]);
      const value = option.label || key || '未选择';
      const parts = [activeVersionKindLabel(group.kind)];
      if (group.note) parts.push(group.note);
      if (option.note) parts.push(String(option.note));
      return {
        label: group.label,
        value,
        note: parts.join(' · '),
      };
    });
  }

  function buildDraftMetrics(master, draft, model) {
    const annual = safeArray(model && model.annual);
    const totalVolume = annual.length
      ? annual.reduce((sum, row) => sum + (Number(row && row.volume) || 0), 0)
      : sumArray(draft && draft.volumes);
    const averageAsp = annual.length
      ? annual.reduce((sum, row) => sum + (Number(row && row.asp) || 0), 0) / annual.length
      : averageArray(draft && draft.asp);
    const packagingTotal = ['packInner', 'packFreight', 'packWarehouse', 'packOther']
      .reduce((sum, key) => sum + (Number(draft && draft[key]) || 0), 0);
    const connectorOverrides = Object.keys(safeObject(draft && draft.connectorPricing)).length;
    return [
      {
        label: '铜价（元/吨）',
        value: formatCurrency(draft && draft.copperPrice, 0),
        note: master && master.copperPrice ? `基准 ${formatCurrency(master.copperPrice, 0)}` : '',
      },
      {
        label: '铝价（元/吨）',
        value: formatCurrency(draft && draft.aluminumPrice, 0),
        note: master && master.aluminumPrice ? `基准 ${formatCurrency(master.aluminumPrice, 0)}` : '',
      },
      {
        label: '直接工时 × 费率',
        value: `${formatNumber(draft && draft.directHours, 2)}h × ${formatCurrency(draft && draft.directRate, 0)}/h`,
        note: '来自工时版本或手工覆盖。',
      },
      {
        label: '制造工时 × 费率',
        value: `${formatNumber(draft && draft.manufacturingHours, 2)}h × ${formatCurrency(draft && draft.manufacturingRate, 0)}/h`,
        note: '来自工时版本或手工覆盖。',
      },
      {
        label: '包装物流输入',
        value: formatCurrency(packagingTotal),
        note: '内包 + 运费 + 仓储 + 其他。',
      },
      {
        label: '连接器临时覆盖',
        value: `${connectorOverrides} 项`,
        note: connectorOverrides ? '场景草稿里有逐项覆盖。' : '当前未做临时覆盖。',
      },
      {
        label: '平均ASP × 生命周期销量',
        value: `${formatCurrency(averageAsp)} × ${formatNumber(totalVolume, 0)}套`,
        note: '会继续叠加年降、返点和一次性费用规则。',
      },
    ];
  }

  function buildCostMetrics(model) {
    const connectorSummary = safeObject(model && model.connectorSummary);
    return [
      {
        label: '材料成本',
        value: formatCurrency(model && model.material),
        note: `包含导线、连接器与其他材料；连接器当前 ${formatCurrency(connectorSummary.totalCurrentCost || 0)} 元/套。`,
      },
      {
        label: '直接人工',
        value: formatCurrency(model && model.directLabor),
      },
      {
        label: '制造人工',
        value: formatCurrency(model && model.manufacturing),
      },
      {
        label: '包装物流',
        value: formatCurrency(model && model.packaging),
      },
      {
        label: '资源投入摊销',
        value: formatCurrency(model && model.equipment),
        note: '设备 / 模具 / 工装 / 其他投入折算到单套。',
      },
      {
        label: '研发费用',
        value: formatCurrency(model && model.rnd),
      },
      {
        label: '成本系数',
        value: `${formatNumber(model && model.mixCost, 4)}x`,
        note: '由配置比例和成本指数共同决定。',
      },
      {
        label: 'VAVE节省',
        value: formatCurrency(model && model.vave && model.vave.savings),
      },
      {
        label: '单套运营成本',
        value: formatCurrency(model && model.operating),
        note: '这是利润引擎用于年度成本计算的最终单套成本。',
      },
    ];
  }

  function summarizeAnnualDrop(snapshot) {
    const rows = safeArray(snapshot && snapshot.yearRows);
    const active = rows.filter((row, index) => index > 0 && (Number(row && row.rate) || 0) > 0);
    if (!active.length) return '未设置年降';
    const first = active[0];
    const last = active[active.length - 1];
    const lastFactor = rows.length ? Number(rows[rows.length - 1].factor) || 0 : 1;
    return `${active.length}年生效，首年 ${first.year} ${formatPercent(first.rate)}，末年系数 ${formatNumber(lastFactor, 4)}x`;
  }

  function summarizeOneTime(snapshot) {
    const entries = safeArray(snapshot && snapshot.entries);
    const total = Number(snapshot && snapshot.amountTotal) || 0;
    const recognized = Number(snapshot && snapshot.recognizedTotal) || 0;
    const unallocated = Number(snapshot && snapshot.unallocatedTotal) || 0;
    if (!entries.length || total <= 0) return '未设置一次性费用';
    return `${entries.length}条，识别 ${formatCurrency(recognized)}，未分配 ${formatCurrency(unallocated)}`;
  }

  function summarizeRebate(snapshot) {
    const rows = safeArray(snapshot && snapshot.yearRows);
    const active = rows.filter((row) => (Number(row && row.amountTotal) || 0) > 0);
    const total = Number(snapshot && snapshot.amountTotal) || 0;
    if (!active.length || total <= 0) return '未设置返点';
    return `${active.length}年生效，累计 ${formatCurrency(total)}，当年按销量折算单套返点`;
  }

  function buildBusinessRuleMetrics(model) {
    const annual = safeArray(model && model.annual);
    const firstAnnual = annual[0] || {};
    const lastAnnual = annual.length ? annual[annual.length - 1] : {};
    return [
      {
        label: '年降',
        value: summarizeAnnualDrop(model && model.annualDrop),
      },
      {
        label: '一次性费用',
        value: summarizeOneTime(model && model.oneTimeCustomer),
      },
      {
        label: '返点',
        value: summarizeRebate(model && model.rebate),
      },
      {
        label: '首年实际ASP',
        value: formatCurrency(firstAnnual.asp),
        note: firstAnnual.year ? `${firstAnnual.year} 年` : '',
      },
      {
        label: '末年实际ASP',
        value: formatCurrency(lastAnnual.asp),
        note: lastAnnual.year ? `${lastAnnual.year} 年` : '',
      },
      {
        label: '年度收入识别',
        value: formatCurrency(sumArray(safeArray(model && model.oneTimeCustomer && model.oneTimeCustomer.revenueByYear))),
        note: '一次性收入会并入年度收入，不进入单套成本。',
      },
    ];
  }

  function buildFinancialContextMetrics(model) {
    const context = safeObject(model && model.financialContext);
    return [
      {
        label: '核算口径',
        value: context.exactApplied ? '命中核算表' : '场景推演',
        note: context.exactApplied
          ? `当前直接套用 ${toText(context.exactLabel || context.exactKey, '精确版本')}`
          : `当前按 ${toText(context.referenceLabel || context.referenceKey, '参考版本')} 做推演`,
      },
      {
        label: '可用核算版本',
        value: `${safeArray(context.availableKeys).length} 个`,
      },
      {
        label: '口径预警',
        value: `${safeArray(context.warnings).length} 条`,
        note: safeArray(context.warnings).slice(0, 2).join(' / '),
      },
    ];
  }

  function buildRevenueMetrics(model) {
    return [
      {
        label: '单套收入',
        value: formatCurrency(compareRow(model, 0).current),
      },
      {
        label: '单套成本',
        value: formatCurrency(compareRow(model, 1).current),
      },
      {
        label: '单套利润',
        value: formatCurrency(compareRow(model, 2).current),
      },
      {
        label: '生命周期收入',
        value: formatCurrency(model && model.totalRevenue),
      },
      {
        label: '生命周期成本',
        value: formatCurrency(model && model.totalCost),
      },
      {
        label: '生命周期利润',
        value: formatCurrency(model && model.totalProfit),
      },
      {
        label: '毛利率',
        value: formatPercent(model && model.margin),
      },
      {
        label: '静态回收销量 / 年份',
        value: `${formatNumber(model && model.paybackVolume, 0)} / ${formatNumber(model && model.paybackYears, 2)}`,
      },
    ];
  }

  function computeTargetPrice(runtime, stateSnapshot, draft) {
    if (!global.G281TargetPriceSolver || typeof global.G281TargetPriceSolver.solveTargetPrice !== 'function') {
      return null;
    }
    try {
      return global.G281TargetPriceSolver.solveTargetPrice(
        runtime || global.G281_RUNTIME,
        draft || {},
        stateSnapshot || global.G281DashboardBridge?.getStateSnapshot?.(),
        { metric: 'margin' },
      );
    } catch (error) {
      return null;
    }
  }

  function computeShapley(runtime, stateSnapshot, draft) {
    if (!global.G281ProfitShapley || typeof global.G281ProfitShapley.compute !== 'function') {
      return null;
    }
    try {
      return global.G281ProfitShapley.compute({
        runtime: runtime || global.G281_RUNTIME,
        engine: global.G281Engine,
        scenarioState: stateSnapshot || global.G281DashboardBridge?.getStateSnapshot?.(),
        draft: draft || {},
        baselineState: global.G281ProfitShapley.defaultBaselineState,
      });
    } catch (error) {
      return null;
    }
  }

  function buildTargetMetrics(targetPrice) {
    if (!targetPrice) {
      return [{
        label: '目标售价求解',
        value: '未生成',
        note: '当前环境未加载 TargetPriceSolver 或求解失败。',
      }];
    }
    return [
      {
        label: '目标模式',
        value: targetPrice.metric === 'margin' ? '按毛利率反推ASP' : '保持报价总利润',
      },
      {
        label: '基准毛利率',
        value: formatPercent(targetPrice.baselineMetric),
      },
      {
        label: '当前毛利率',
        value: formatPercent(targetPrice.currentMetric),
      },
      {
        label: '目标ASP',
        value: formatCurrency(targetPrice.targetAverageAsp),
      },
      {
        label: 'ASP调整量',
        value: formatSignedCurrency((Number(targetPrice.targetAverageAsp) || 0) - (Number(targetPrice.currentAverageAsp) || 0)),
        note: targetPrice.convergence && targetPrice.convergence.reason
          ? `求解状态：${targetPrice.convergence.reason}`
          : '',
      },
    ];
  }

  function buildShapleyList(shapley) {
    const contributions = safeArray(shapley && shapley.contributions);
    if (!contributions.length) return [];
    const active = contributions
      .map((item) => ({
        label: toText(item && item.label, item && item.key ? String(item.key) : '未命名因子'),
        raw: Number(item && item.marginContribution) || 0,
        baseState: toText(item && item.baseState, '基准'),
        scenarioState: toText(item && item.scenarioState, '当前'),
        share: Number(item && item.share) || 0,
      }))
      .sort((left, right) => Math.abs(right.raw) - Math.abs(left.raw));
    const visible = active.some((item) => Math.abs(item.raw) > 0.00001)
      ? active.filter((item) => Math.abs(item.raw) > 0.00001)
      : active;
    return visible.slice(0, 6).map((item) => ({
      label: item.label,
      value: formatSignedPoints(item.raw * 100),
      note: `${item.baseState} → ${item.scenarioState} · 占比 ${formatPercent(item.share, 1)}`,
    }));
  }

  function buildChangeMetrics(model, shapley) {
    const cost = compareRow(model, 1);
    const lifecycleProfit = compareRow(model, 5);
    const margin = compareRow(model, 6);
    const bomSummary = safeObject(model && model.bomSummary);
    const changedFactors = safeArray(shapley && shapley.contributions)
      .filter((item) => Math.abs(Number(item && item.marginContribution) || 0) > 0.00001)
      .length;
    return [
      {
        label: '变更利润因子',
        value: `${changedFactors} 项`,
        note: `Shapley 共分析 ${safeArray(shapley && shapley.contributions).length} 项因子。`,
      },
      {
        label: 'BOM变更项',
        value: `${(Number(bomSummary.replaceCount) || 0) + (Number(bomSummary.addCount) || 0) + (Number(bomSummary.cancelCount) || 0)} 项`,
        note: `替换 ${Number(bomSummary.replaceCount) || 0} / 新增 ${Number(bomSummary.addCount) || 0} / 取消 ${Number(bomSummary.cancelCount) || 0}`,
      },
      {
        label: '单套成本变化',
        value: formatSignedCurrency(cost.current - cost.base),
      },
      {
        label: '生命周期利润变化',
        value: formatSignedCurrency(lifecycleProfit.current - lifecycleProfit.base),
      },
      {
        label: '毛利率变化',
        value: formatSignedPoints((margin.current - margin.base) * 100),
      },
    ];
  }

  function buildHarnessMetrics(model) {
    const breakdown = safeObject(model && model.harnessProfit);
    const harnesses = safeArray(breakdown.harnesses);
    if (!harnesses.length) {
      return [{
        label: '单根线束拆解',
        value: '未生成',
        note: '当前没有可用于线束级利润拆解的数据。',
      }];
    }
    const best = harnesses.reduce((result, item) => (
      (Number(item && item.marginEstimated) || -Infinity) > (Number(result && result.marginEstimated) || -Infinity) ? item : result
    ), harnesses[0]);
    const worst = harnesses.reduce((result, item) => (
      (Number(item && item.marginEstimated) || Infinity) < (Number(result && result.marginEstimated) || Infinity) ? item : result
    ), harnesses[0]);
    return [
      {
        label: '线束条目',
        value: `${harnesses.length} 条`,
        note: `当前BOM口径：${toText(breakdown.meta && breakdown.meta.selectedBomVersionLabel, '当前BOM')}`,
      },
      {
        label: '导线目录命中',
        value: `${Number(breakdown.totals && breakdown.totals.matchedWireLineCount) || 0} 项`,
        note: `未命中 ${Number(breakdown.totals && breakdown.totals.unmatchedWireLineCount) || 0} 项`,
      },
      {
        label: '最高毛利线束',
        value: toText(best && best.harnessId, '—'),
        note: `${toText(best && best.harnessName, '')} / ${formatPercent(best && best.marginEstimated)}`,
      },
      {
        label: '最低毛利线束',
        value: toText(worst && worst.harnessId, '—'),
        note: `${toText(worst && worst.harnessName, '')} / ${formatPercent(worst && worst.marginEstimated)}`,
      },
      {
        label: '线束拆解口径',
        value: '整套利润回推',
        note: '用于定位拖利润线束，不代表真实单根采购/报价单价。',
      },
    ];
  }

  function buildHarnessExtra(model) {
    const breakdown = safeObject(model && model.harnessProfit);
    const warnings = safeArray(breakdown.meta && breakdown.meta.warnings);
    const items = [
      {
        label: '材料拆解',
        value: '导线目录 + 残余池分摊',
        note: '导线命中目录时按铜铝基价估算，未命中时回落到残余材料池。',
      },
      {
        label: '非材料拆解',
        value: '按材料占比分摊',
        note: '人工 / 包装 / 资源投入 / R&D 按线束材料占比分摊。',
      },
    ];
    warnings.slice(0, 2).forEach((warning, index) => {
      items.push({
        label: `预警 ${index + 1}`,
        value: '需人工复核',
        note: String(warning),
      });
    });
    return items;
  }

  function renderMetricsList(metrics) {
    const list = createElement('ul', 'g281-profit-logic-metrics');
    metrics.forEach((metric) => {
      const item = createElement('li', 'g281-profit-logic-metric');
      const label = createElement('span', 'g281-profit-logic-metric-label');
      label.textContent = metric.label;
      const value = createElement('span', 'g281-profit-logic-metric-value');
      value.textContent = metric.value;
      item.append(label, value);
      if (metric.note) {
        const note = createElement('span', 'g281-profit-logic-metric-note');
        note.textContent = metric.note;
        item.appendChild(note);
      }
      list.appendChild(item);
    });
    return list;
  }

  function renderExtraSection(extra) {
    if (!extra || !safeArray(extra.list).length) return null;
    const wrapper = createElement('div', 'g281-profit-logic-extra');
    if (extra.title) {
      const heading = createElement('p', 'g281-profit-logic-extra-title');
      heading.textContent = extra.title;
      wrapper.appendChild(heading);
    }
    const grid = createElement('div', 'g281-profit-logic-extra-grid');
    safeArray(extra.list).forEach((entry) => {
      const cell = createElement('div', 'g281-profit-logic-extra-item');
      const label = createElement('span', 'g281-profit-logic-extra-label');
      label.textContent = entry.label;
      const value = createElement('span', 'g281-profit-logic-extra-value');
      value.textContent = entry.value;
      const note = createElement('span', 'g281-profit-logic-extra-note');
      note.textContent = entry.note || '';
      cell.append(label, value, note);
      grid.appendChild(cell);
    });
    wrapper.appendChild(grid);
    return wrapper;
  }

  function renderStep(step, index) {
    const article = createElement('article', 'g281-profit-logic-step');
    const header = createElement('div', 'g281-profit-logic-step-head');
    const number = createElement('span', 'g281-profit-logic-step-number');
    number.textContent = String(index + 1).padStart(2, '0');
    const titleWrap = createElement('div', 'g281-profit-logic-step-title');
    const title = createElement('h3', 'g281-profit-logic-step-heading');
    title.textContent = step.title;
    const summary = createElement('p', 'g281-profit-logic-step-summary');
    summary.textContent = step.summary || '';
    titleWrap.append(title, summary);
    header.append(number, titleWrap);
    article.appendChild(header);
    if (safeArray(step.metrics).length) {
      article.appendChild(renderMetricsList(step.metrics));
    }
    if (step.formula) {
      const formula = createElement('p', 'g281-profit-logic-formula');
      formula.textContent = step.formula;
      article.appendChild(formula);
    }
    if (step.extra) {
      const extra = renderExtraSection(step.extra);
      if (extra) article.appendChild(extra);
    }
    return article;
  }

  const api = {};

  function createDrawer() {
    const root = createElement('div', 'g281-profit-logic-drawer');
    root.id = DRAWER_ID;
    root.hidden = true;
    root.setAttribute('aria-hidden', 'true');

    const backdrop = createElement('div', 'g281-profit-logic-backdrop');
    backdrop.setAttribute('data-profit-logic-close', 'true');

    const panel = createElement('aside', 'g281-profit-logic-panel');
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'true');

    const header = createElement('header', 'g281-profit-logic-panel-head');
    const info = createElement('div', 'g281-profit-logic-panel-info');
    const eyebrow = createElement('p', 'g281-profit-logic-eyebrow');
    eyebrow.textContent = TAGLINE;
    const title = createElement('h2', 'g281-profit-logic-panel-title');
    const tag = createElement('span', 'g281-profit-logic-panel-tag');
    const closeButton = createElement('button', 'g281-profit-logic-close');
    closeButton.type = 'button';
    closeButton.textContent = '关闭';
    closeButton.setAttribute('data-profit-logic-close', 'true');
    closeButton.addEventListener('click', () => api.close());
    info.append(eyebrow, title, tag);
    header.append(info, closeButton);

    const steps = createElement('div', 'g281-profit-logic-steps');
    panel.append(header, steps);
    root.append(backdrop, panel);

    root.addEventListener('click', (event) => {
      if (event.target.closest('[data-profit-logic-close]')) {
        api.close();
      }
    });
    panel.addEventListener('click', (event) => event.stopPropagation());
    return { root, title, tag, steps, closeButton };
  }

  const state = {
    mounted: false,
    drawer: null,
    isOpen: false,
    closeTimer: null,
    lastFocused: null,
  };

  function setRootVisibility(open) {
    if (!state.drawer) return;
    if (state.closeTimer) {
      global.clearTimeout(state.closeTimer);
      state.closeTimer = null;
    }
    if (open) {
      state.drawer.root.hidden = false;
      state.drawer.root.setAttribute('aria-hidden', 'false');
      return;
    }
    state.drawer.root.setAttribute('aria-hidden', 'true');
    state.closeTimer = global.setTimeout(() => {
      if (!state.isOpen && state.drawer) {
        state.drawer.root.hidden = true;
      }
      state.closeTimer = null;
    }, 360);
  }

  function handleDocumentKeydown(event) {
    if (!state.isOpen || event.key !== 'Escape') return;
    event.preventDefault();
    api.close();
  }

  function renderPayload(payload) {
    if (!payload || !state.drawer) return;
    state.drawer.title.textContent = payload.scenarioName || '动态利润引擎运行逻辑';
    state.drawer.tag.textContent = payload.contextTag || TAGLINE;
    state.drawer.steps.innerHTML = '';
    safeArray(payload.steps).forEach((step, index) => {
      state.drawer.steps.appendChild(renderStep(step, index));
    });
    setRootVisibility(true);
    state.drawer.root.classList.add('is-open');
    state.isOpen = true;
    global.requestAnimationFrame(() => state.drawer && state.drawer.closeButton && state.drawer.closeButton.focus && state.drawer.closeButton.focus());
  }

  function closeDrawer() {
    if (!state.drawer) return;
    state.isOpen = false;
    state.drawer.root.classList.remove('is-open');
    setRootVisibility(false);
    if (state.lastFocused && typeof state.lastFocused.focus === 'function') {
      state.lastFocused.focus();
    }
  }

  api.mount = function mount(options = {}) {
    if (state.mounted) return;
    const container = options.container instanceof Element ? options.container : document.body;
    container.querySelectorAll(`#${DRAWER_ID}`).forEach((node) => node.remove());
    state.drawer = createDrawer();
    container.appendChild(state.drawer.root);
    document.addEventListener('keydown', handleDocumentKeydown);
    state.mounted = true;
  };

  api.close = function close() {
    closeDrawer();
  };

  api.open = function open(payload) {
    if (!state.drawer || !payload) return;
    state.lastFocused = document.activeElement;
    renderPayload(payload);
  };

  api.isOpen = function isOpen() {
    return state.isOpen;
  };

  api.buildPayload = function buildPayload(
    runtime = global.G281_RUNTIME,
    stateSnapshot = global.G281DashboardBridge?.getStateSnapshot?.(),
    draft = {},
  ) {
    const safeRuntime = safeObject(runtime);
    const safeMaster = safeObject(safeRuntime.master);
    const safeState = safeObject(stateSnapshot);
    const safeDraft = safeObject(draft);
    const model = global.G281Engine && typeof global.G281Engine.computeModel === 'function'
      ? global.G281Engine.computeModel(safeRuntime, safeDraft, safeState)
      : null;
    const targetPrice = computeTargetPrice(safeRuntime, safeState, safeDraft);
    const shapley = computeShapley(safeRuntime, safeState, safeDraft);
    const financialContext = safeObject(model && model.financialContext);
    const contextTag = financialContext.exactApplied
      ? `命中核算口径：${toText(financialContext.exactLabel || financialContext.exactKey, '精确版本')}`
      : `推演口径：${toText(financialContext.referenceLabel || financialContext.referenceKey, '参考版本')}`;

    const steps = [
      {
        title: '版本装配与场景入口',
        summary: '左侧版本管理、右侧场景管理以及 Excel 式模板中的用户录入，会先合并成当前场景的 state + draft，再进入主引擎。',
        metrics: buildVersionMetrics(safeRuntime, safeState, model),
        formula: '主入口：G281Engine.computeModel(runtime, draft, state)；版本键负责选数据，draft 负责临时覆盖。',
        extra: {
          title: '当前说明',
          list: [
            {
              label: '配置清单',
              value: '管理侧版本',
              note: '当前主要用于开发对照、配置/BOM联动和录入模板，不单独改变利润公式。',
            },
            {
              label: '场景保存',
              value: '版本自由组合',
              note: '场景管理会保存一组版本绑定，用于快速复现报价、定点或试算场景。',
            },
          ],
        },
      },
      {
        title: '草稿输入与手工覆盖',
        summary: '当版本模板里有手工值或用户在当前场景做临时覆盖时，程序优先用草稿值；没填的字段才回退到版本默认值和 master 种子。',
        metrics: buildDraftMetrics(safeMaster, safeDraft, model),
        formula: '覆盖优先级：场景草稿 > 版本模板快照 > runtime.master 默认值。',
      },
      {
        title: '单套成本形成',
        summary: 'BOM、铜铝基价、连接器、工时、资源投入、包装物流和 VAVE 一起形成单套运营成本，这是后续利润计算的成本底座。',
        metrics: buildCostMetrics(model),
        formula: 'operating = (material + directLabor + manufacturing + packaging) × mixCost + equipment + rnd - vave.savings',
      },
      {
        title: '生命周期商务规则',
        summary: '销量预测、配置比例、年降、一次性费用和返点不会直接改单套成本，而是改变年度 ASP、收入识别和生命周期利润。',
        metrics: buildBusinessRuleMetrics(model),
        formula: '年度口径：asp = aspBase × annualDropFactor - rebatePerSet；revenue = volume × asp + oneTimeRevenue',
      },
      {
        title: '利润输出与核算口径',
        summary: '程序会先生成单套结果，再汇总到生命周期；如果当前场景恰好命中核算表口径，则直接使用核算表结果，否则走引擎推演。',
        metrics: buildRevenueMetrics(model).concat(buildFinancialContextMetrics(model)),
        formula: 'profit = revenue - cost；margin = profit / revenue；命中 exact financial 时，compare 与 annual 直接回落到核算表结果。',
        extra: {
          title: '口径预警',
          list: safeArray(financialContext.warnings).slice(0, 4).map((warning, index) => ({
            label: `预警 ${index + 1}`,
            value: '需复核',
            note: String(warning),
          })),
        },
      },
      {
        title: '目标售价、归因与变更可视化',
        summary: '在当前利润结果上，程序还会继续反推保持目标毛利率所需 ASP，并把利润率变化拆解到各成本因子，同时把 BOM 与成本变化汇总成首页的变更可视化。',
        metrics: buildTargetMetrics(targetPrice).concat(buildChangeMetrics(model, shapley)),
        formula: 'TargetPriceSolver 负责反推 ASP；ProfitShapley 负责利润率归因；变更可视化读取 compare / bomSummary / financialContext。',
        extra: {
          title: '主要归因因子',
          list: buildShapleyList(shapley),
        },
      },
      {
        title: '单根线束利润拆解',
        summary: '整套利润计算完成后，程序会把整套口径分摊到各线束号，用于定位哪一根线束在拖利润；这不是单根线束真实报价，而是定位口径。',
        metrics: buildHarnessMetrics(model),
        formula: 'HarnessProfit = 整套利润口径 + BOM 对齐结果 + 导线目录估算 + 残余材料池 + 非材料占比分摊',
        extra: {
          title: '线束拆解说明',
          list: buildHarnessExtra(model),
        },
      },
    ];

    return {
      scenarioName: toText(safeDraft.scenarioName, toText(safeMaster.name, TAGLINE)),
      contextTag,
      steps,
      runtime: safeRuntime,
      model,
      targetPrice,
      shapley,
    };
  };

  global.G281ProfitLogicDrawer = api;
})(window);
