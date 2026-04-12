(function (global) {
  'use strict';

  const DRAWER_ID = 'g281-profit-logic-drawer-root';
  const TAGLINE = '高压线束动态利润引擎';
  const VERSION_GROUPS = [
    { key: 'bom', label: 'BOM版本' },
    { key: 'metal', label: '金属基价' },
    { key: 'connector', label: '连接器阶段' },
    { key: 'labor', label: '工时版本' },
    { key: 'equipment', label: '设备/资源' },
    { key: 'packaging', label: '包装物流' },
    { key: 'sales', label: '销量预测' },
    { key: 'mix', label: '配置比例' },
    { key: 'vave', label: 'VAVE' },
  ];

  const numberFormatter = new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 2 });
  const currencyFormatter = new Intl.NumberFormat('zh-CN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });

  function formatCurrency(value) {
    if (value === null || value === undefined || Number.isNaN(Number(value))) return '—';
    return currencyFormatter.format(Number(value));
  }

  function formatNumber(value, digits = 2) {
    if (value === null || value === undefined || Number.isNaN(Number(value))) return '—';
    return new Intl.NumberFormat('zh-CN', { maximumFractionDigits: digits, minimumFractionDigits: digits }).format(Number(value));
  }

  function formatPercent(value, digits = 2) {
    if (value === null || value === undefined || Number.isNaN(Number(value))) return '—';
    return `${(Number(value) * 100).toFixed(digits)}%`;
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

  function buildVersionMetrics(master, snapshot) {
    const dataSource = safeObject(master?.versions);
    return VERSION_GROUPS.map((group) => {
      const key = snapshot?.[group.key] || group.key;
      const metadata = dataSource[group.key]?.[key] || {};
      const label = metadata.label || key || '—';
      const note = metadata.note || metadata.sourceKind || '';
      return {
        label: group.label,
        value: label,
        note,
      };
    });
  }

  function buildInputMetrics(master, draft, monthlyAsp) {
    const base = safeObject(master);
    const mixSum = safeArray(monthlyAsp).length ? monthlyAsp.reduce((sum, value) => sum + Number(value || 0), 0) / monthlyAsp.length : 0;
    const packTotal = (Number(draft.packInner) || 0) + (Number(draft.packFreight) || 0) + (Number(draft.packWarehouse) || 0) + (Number(draft.packOther) || 0);
    return [
      {
        label: '铜价（元/kg）',
        value: formatCurrency(draft.copperPrice),
        note: base.copperPrice ? `基准 ${formatCurrency(base.copperPrice)}` : '',
      },
      {
        label: '铝价（元/kg）',
        value: formatCurrency(draft.aluminumPrice),
        note: base.aluminumPrice ? `基准 ${formatCurrency(base.aluminumPrice)}` : '',
      },
      {
        label: '直接工时 × 费率',
        value: `${formatNumber(draft.directHours, 2)}h × ${formatCurrency(draft.directRate)}/h`,
      },
      {
        label: '制造工时 × 费率',
        value: `${formatNumber(draft.manufacturingHours, 2)}h × ${formatCurrency(draft.manufacturingRate)}/h`,
      },
      {
        label: '包装构成',
        value: formatCurrency(packTotal),
      },
      {
        label: 'ASP/销量基底',
        value: `${formatCurrency(mixSum)} × ${safeArray(draft.volumes).reduce((sum, v) => sum + (Number(v) || 0), 0)} 套`,
      },
    ];
  }

  function buildCostMetrics(model) {
    if (!model) return [];
    const vave = safeObject(model.vave);
    return [
      { label: '材料（含铜/铝/连接器）', value: formatCurrency(model.material) },
      { label: '人工', value: formatCurrency(model.directLabor) },
      { label: '制造', value: formatCurrency(model.manufacturing) },
      { label: '包装', value: formatCurrency(model.packaging) },
      { label: '设备折摊', value: formatCurrency(model.equipment) },
      { label: '研发', value: formatCurrency(model.rnd) },
      { label: '混合系数', value: formatNumber(model.mixCost, 3) },
      { label: 'VAVE 节省', value: formatCurrency(vave.savings || 0) },
      { label: '单套运营成本', value: formatCurrency(model.operating) },
    ];
  }

  function buildRevenueMetrics(model) {
    if (!model) return [];
    const annual = safeArray(model.annual);
    const totalVolume = Number(model.totalVolume) || 0;
    const targetAsp = annual.length ? annual.reduce((sum, row) => sum + Number(row.asp || 0), 0) / annual.length : 0;
    return [
      { label: '生命周期销量', value: `${formatNumber(totalVolume, 0)} 套` },
      { label: '生命周期收入', value: formatCurrency(model.totalRevenue) },
      { label: '生命周期成本', value: formatCurrency(model.totalCost) },
      { label: '生命周期利润', value: formatCurrency(model.totalProfit) },
      { label: '毛利率', value: formatPercent(model.margin) },
      { label: '平均ASP', value: formatCurrency(targetAsp) },
      { label: '回收销量', value: formatNumber(model.paybackVolume, 0) },
      { label: '回收年份', value: formatNumber(model.paybackYears, 1) },
    ];
  }

  function buildConnectorMetrics(connectorSummary) {
    if (!connectorSummary) return [];
    return [
      { label: '连接器因子', value: formatNumber(connectorSummary.factor, 3) },
      { label: '跟随默认档', value: `${connectorSummary.followCount || 0} 个` },
      { label: '覆盖档', value: `${connectorSummary.overrideCount || 0} 个` },
    ];
  }

  function computeTargetPrice(runtime, state, draft) {
    if (!global.G281TargetPriceSolver || typeof global.G281TargetPriceSolver.solveTargetPrice !== 'function') {
      return null;
    }
    try {
      return global.G281TargetPriceSolver.solveTargetPrice(runtime || global.G281_RUNTIME, draft || {}, state || global.G281DashboardBridge?.getStateSnapshot(), { metric: 'margin' });
    } catch (error) {
      return null;
    }
  }

  function computeShapley(runtime, state, draft) {
    if (!global.G281ProfitShapley || typeof global.G281ProfitShapley.compute !== 'function') {
      return null;
    }
    try {
      return global.G281ProfitShapley.compute({
        runtime: runtime || global.G281_RUNTIME,
        engine: global.G281Engine,
        scenarioState: state || global.G281DashboardBridge?.getStateSnapshot(),
        draft: draft || (typeof global.readDraft === 'function' ? global.readDraft() : {}),
        baselineState: global.G281ProfitShapley.defaultBaselineState,
      });
    } catch (error) {
      return null;
    }
  }

  function buildTargetMetrics(targetPrice) {
    if (!targetPrice) return [];
    return [
      { label: '基准毛利率', value: formatPercent(targetPrice.baselineMetric) },
      { label: '当前毛利率', value: formatPercent(targetPrice.currentMetric) },
      { label: 'ASP 放缩因子', value: targetPrice.requiredFactor ? `${targetPrice.requiredFactor.toFixed(3)}×` : '—' },
      { label: '当前平均ASP', value: formatCurrency(targetPrice.currentAverageAsp) },
      { label: '目标平均ASP', value: formatCurrency(targetPrice.targetAverageAsp) },
    ];
  }

  function buildShapleyList(shapley) {
    if (!shapley || !Array.isArray(shapley.contributions)) return [];
    return shapley.contributions.map((item) => ({
      label: item.label,
      value: formatPercent(item.marginContribution),
      note: `从 ${item.baseState || '基准'} ➜ ${item.scenarioState || '当前'}`,
    }));
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

  function renderShapleyExtra(extra) {
    if (!extra?.list || !extra.list.length) return null;
    const wrapper = createElement('div', 'g281-profit-logic-extra');
    if (extra.title) {
      const heading = createElement('p', 'g281-profit-logic-extra-title');
      heading.textContent = extra.title;
      wrapper.appendChild(heading);
    }
    const grid = createElement('div', 'g281-profit-logic-extra-grid');
    extra.list.forEach((item) => {
      const cell = createElement('div', 'g281-profit-logic-extra-item');
      const label = createElement('span', 'g281-profit-logic-extra-label');
      label.textContent = item.label;
      const value = createElement('span', 'g281-profit-logic-extra-value');
      value.textContent = item.value;
      const note = createElement('span', 'g281-profit-logic-extra-note');
      note.textContent = item.note || '';
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
    if (step.metrics && step.metrics.length) {
      article.appendChild(renderMetricsList(step.metrics));
    }
    if (step.formula) {
      const formula = createElement('p', 'g281-profit-logic-formula');
      formula.textContent = step.formula;
      article.appendChild(formula);
    }
    if (step.extra) {
      const extraNode = renderShapleyExtra(step.extra);
      if (extraNode) article.appendChild(extraNode);
    }
    return article;
  }

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
    closeButton.addEventListener('click', () => module.close());
    info.append(eyebrow, title, tag);
    header.append(info, closeButton);
    const steps = createElement('div', 'g281-profit-logic-steps');
    panel.append(header, steps);
    root.append(backdrop, panel);
    root.addEventListener('click', (event) => {
      if (event.target.closest('[data-profit-logic-close]')) {
        module.close();
      }
    });
    panel.addEventListener('click', (event) => {
      event.stopPropagation();
    });
    return { root, title, tag, steps, panel, closeButton }; // keep refs
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
    module.close();
  }

  function renderPayload(payload) {
    if (!payload || !state.drawer) return;
    state.drawer.title.textContent = payload.scenarioName || '动态利润逻辑';
    const tagText = payload.contextTag || payload.scenarioName || TAGLINE;
    state.drawer.tag.textContent = tagText;
    state.drawer.steps.innerHTML = '';
    const steps = Array.isArray(payload.steps) ? payload.steps : [];
    steps.forEach((step, index) => {
      state.drawer.steps.appendChild(renderStep(step, index));
    });
    setRootVisibility(true);
    state.drawer.root.classList.add('is-open');
    state.isOpen = true;
    global.requestAnimationFrame(() => state.drawer?.closeButton?.focus?.());
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

  function openDrawer(payload) {
    if (!state.drawer) return;
    if (!payload) return;
    state.lastFocused = document.activeElement;
    renderPayload(payload);
  }

  const module = {
    mount(options = {}) {
      if (state.mounted) return;
      const container = options.container instanceof Element ? options.container : document.body;
      container.querySelectorAll(`#${DRAWER_ID}`).forEach((node) => node.remove());
      state.drawer = createDrawer();
      container.appendChild(state.drawer.root);
      document.addEventListener('keydown', handleDocumentKeydown);
      state.mounted = true;
    },
    close() {
      closeDrawer();
    },
    open(payload) {
      openDrawer(payload);
    },
    isOpen() {
      return state.isOpen;
    },
    buildPayload(runtime = global.G281_RUNTIME, stateSnapshot = global.G281DashboardBridge?.getStateSnapshot?.(), draft = typeof global.readDraft === 'function' ? global.readDraft() : {}) {
      const safeMaster = safeObject(runtime?.master);
      const safeDraft = safeObject(draft);
      const safeState = safeObject(stateSnapshot);
      const model = global.G281Engine && typeof global.G281Engine.computeModel === 'function'
        ? global.G281Engine.computeModel(runtime, safeDraft, safeState)
        : null;
      const inputs = buildInputMetrics(safeMaster, safeDraft, safeArray(safeDraft.volumes).length ? safeDraft.volumes : safeArray(model?.annual).map((row) => row.volume));
      const versionMetrics = buildVersionMetrics(safeMaster, model?.stateSnapshot || safeState);
      const costMetrics = buildCostMetrics(model);
      const revenueMetrics = buildRevenueMetrics(model);
      const targetPrice = computeTargetPrice(runtime, safeState, safeDraft);
      const shapley = computeShapley(runtime, safeState, safeDraft);
      const targetMetrics = buildTargetMetrics(targetPrice);
      const shapleyList = buildShapleyList(shapley);
      const steps = [];
      steps.push({
        title: '输入因子',
        summary: '铜/铝价格、工时、包装、销量与配置一起定义了单套成本的基底。',
        metrics: inputs,
        formula: 'mixPrice = Σ(d.mix × BASE.priceMixIndexes) / Σ(BASE.baselineMix × BASE.priceMixIndexes) + 稳定的工时/包装数据',
      });
      steps.push({
        title: '版本映射',
        summary: 'BOM、金属、连接器、工时等版本选定后会施加各自的因子。',
        metrics: versionMetrics,
        formula: '每个版本的 factor 会在 computeModel 中合成，影响物料与成本。',
      });
      steps.push({
        title: '单套成本与 BOM',
        summary: '材料+人工+制造+包装+设备+研发经过混合系数与 VAVE 节省，得到运营单套成本。',
        metrics: costMetrics.concat(buildConnectorMetrics(model?.connectorSummary)),
        formula: 'operating = (material + directLabor + manufacturing + packaging) × mixCost + equipment + rnd - vave.savings',
      });
      steps.push({
        title: '销量 × ASP → 收入/利润',
        summary: '预测销量与 ASP 生成年度收入/成本，差值求出利润和毛利率。',
        metrics: revenueMetrics,
        formula: 'revenue = Σ(volume × asp); profit = revenue - cost; margin = profit / revenue',
      });
      steps.push({
        title: '目标售价 & Shapley 归因',
        summary: 'TargetPriceSolver 计算要达成的 ASP 放大/缩减，Shapley 把毛利率变化拆解到因素。',
        metrics: targetMetrics,
        formula: 'G281TargetPriceSolver.solveTargetPrice(runtime, draft, state, { metric: "margin" }) & G281ProfitShapley 考察因素边际贡献。',
        extra: {
          title: 'Shapley 贡献',
          list: shapleyList,
        },
      });
      return {
        scenarioName: safeDraft.scenarioName || safeMaster.name || TAGLINE,
        contextTag: safeDraft.scenarioName || TAGLINE,
        steps,
        runtime,
        model,
        shapley,
        targetPrice,
      };
    },
  };

  global.G281ProfitLogicDrawer = module;
})(window);
