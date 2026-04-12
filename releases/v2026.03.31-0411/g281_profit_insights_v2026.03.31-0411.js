(function (global) {
  'use strict';

  const state = {
    instance: null,
    options: {},
  };

  const isNumber = (value) => Number.isFinite(Number(value));

  const formatCurrency = (value, digits = 2) => {
    if (!isNumber(value)) return '-';
    return new Intl.NumberFormat('zh-CN', {
      style: 'currency',
      currency: 'CNY',
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    }).format(Number(value));
  };

  const formatPercent = (value, digits = 2) => {
    if (!isNumber(value)) return '-';
    const next = Number(value);
    return `${next >= 0 ? '+' : ''}${next.toFixed(digits)}%`;
  };

  const formatPoints = (value, digits = 2) => {
    if (!isNumber(value)) return '-';
    const next = Number(value);
    return `${next >= 0 ? '+' : ''}${next.toFixed(digits)} pt`;
  };

  function createMetric(label) {
    const wrapper = document.createElement('div');
    wrapper.className = 'profit-insight-metric';

    const labelEl = document.createElement('div');
    labelEl.className = 'profit-insight-metric-label';
    labelEl.textContent = label;

    const valueEl = document.createElement('strong');
    valueEl.className = 'profit-insight-metric-value';

    const hintEl = document.createElement('div');
    hintEl.className = 'profit-insight-metric-hint';

    wrapper.appendChild(labelEl);
    wrapper.appendChild(valueEl);
    wrapper.appendChild(hintEl);

    return {
      card: wrapper,
      setLabel(nextLabel) {
        labelEl.textContent = nextLabel;
      },
      set(value, hint) {
        valueEl.textContent = value;
        hintEl.textContent = hint || '';
      },
    };
  }

  function buildPriceCard(options = {}) {
    const card = document.createElement('article');
    card.className = 'profit-insight-card';
    card.innerHTML = `
      <div class="profit-insight-head">
        <div>
          <div class="profit-insight-eyebrow">Target Price</div>
          <h3>目标毛利率反推售价</h3>
          <p class="profit-insight-subtitle" data-role="price-subtitle"></p>
        </div>
        <div class="profit-insight-pill" data-role="price-status"></div>
      </div>
      <div class="profit-insight-control-row">
        <label class="profit-insight-control">
          <span>目标毛利率 (%)</span>
          <input type="number" step="0.01" min="-99.99" max="99.99" data-role="target-margin-input" />
        </label>
        <div class="profit-insight-control-actions">
          <button class="mini-button secondary" type="button" data-role="target-margin-apply">应用</button>
          <button class="mini-button" type="button" data-role="target-margin-reset">恢复报价基准</button>
        </div>
      </div>
      <div class="profit-insight-metric-grid" data-role="price-metrics"></div>
      <p class="profit-insight-note" data-role="price-note"></p>
      <p class="profit-insight-spark" data-role="price-spark"></p>
    `;

    const metrics = {
      current: createMetric('当前 ASP'),
      required: createMetric('目标 ASP'),
      delta: createMetric('售价差异'),
      margin: createMetric('目标毛利率'),
    };

    const container = card.querySelector('[data-role="price-metrics"]');
    Object.values(metrics).forEach((entry) => container.appendChild(entry.card));

    const input = card.querySelector('[data-role="target-margin-input"]');
    const applyButton = card.querySelector('[data-role="target-margin-apply"]');
    const resetButton = card.querySelector('[data-role="target-margin-reset"]');

    const commitTargetMargin = () => {
      const raw = String(input.value || '').trim();
      if (!raw) {
        input.setCustomValidity('');
        options.onTargetMarginReset?.();
        return;
      }

      const numeric = Number(raw);
      if (!Number.isFinite(numeric) || numeric <= -100 || numeric >= 100) {
        input.setCustomValidity('请输入 -99.99 到 99.99 之间的毛利率');
        input.reportValidity();
        return;
      }

      input.setCustomValidity('');
      options.onTargetMarginChange?.(Number(numeric.toFixed(2)));
    };

    applyButton.addEventListener('click', commitTargetMargin);
    resetButton.addEventListener('click', () => {
      input.setCustomValidity('');
      options.onTargetMarginReset?.();
    });
    input.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter') return;
      event.preventDefault();
      commitTargetMargin();
    });

    return {
      card,
      metrics,
      setOptions(nextOptions) {
        options = nextOptions || {};
      },
    };
  }

  function buildWaterfallCard() {
    const card = document.createElement('article');
    card.className = 'profit-insight-card';
    card.innerHTML = `
      <div class="profit-insight-head">
        <div>
          <div class="profit-insight-eyebrow">Shapley</div>
          <h3>毛利率贡献拆解</h3>
          <p class="profit-insight-subtitle" data-role="waterfall-subtitle"></p>
        </div>
        <div class="profit-insight-pill" data-role="waterfall-total"></div>
      </div>
      <div class="profit-waterfall-list" data-role="waterfall-list"></div>
      <p class="profit-insight-note" data-role="waterfall-note"></p>
    `;

    return card;
  }

  function renderTargetPrice(cardRef, metrics, data = {}) {
    const subtitle = cardRef.querySelector('[data-role="price-subtitle"]');
    const status = cardRef.querySelector('[data-role="price-status"]');
    const input = cardRef.querySelector('[data-role="target-margin-input"]');
    subtitle.textContent = `${data.scenarioName || '默认场景'} · ${data.targetModeLabel || data.varianceLabel || '求售价'}`;
    status.textContent = data.statusLabel || (data.convergence?.success === true ? '已收敛' : '待计算');
    if (input) {
      input.value = isNumber(data.requestedMargin) ? Number(data.requestedMargin).toFixed(2) : '';
    }

    metrics.current.set(formatCurrency(data.currentASP), `当前毛利率 ${formatPercent(data.currentMargin)}`);
    metrics.required.set(
      formatCurrency(data.requiredASP),
      `${data.targetModeLabel || '目标毛利率'} ${formatPercent(data.requestedMargin)}`
    );
    metrics.delta.set(formatCurrency(data.deltaASP), `报价 ASP ${formatCurrency(data.baseASP)}`);
    metrics.margin.set(formatPercent(data.requestedMargin), `求解结果 ${formatPercent(data.requiredMargin)}`);
    metrics.margin.setLabel('目标毛利率');

    cardRef.querySelector('[data-role="price-note"]').textContent = data.note || '';
    cardRef.querySelector('[data-role="price-spark"]').textContent = data.sparkline || '';
  }

  function renderShapley(cardRef, data = {}) {
    const list = cardRef.querySelector('[data-role="waterfall-list"]');
    const subtitle = cardRef.querySelector('[data-role="waterfall-subtitle"]');
    const total = cardRef.querySelector('[data-role="waterfall-total"]');
    const note = cardRef.querySelector('[data-role="waterfall-note"]');

    subtitle.textContent = `${data.subtitle || '毛利率拆解'} · 输入 ${formatPercent(data.baselineMargin)} 输出 ${formatPercent(data.scenarioMargin)}`;
    total.textContent = formatPoints(data.totalDelta);
    note.textContent = data.note || '';

    const series = Array.isArray(data.items) ? data.items : [];
    const aggregate = series.reduce((sum, entry) => sum + (Number(entry.value) || 0), 0);
    if (!note) {
      note.textContent = `分项合计 ${formatPoints(aggregate)}`;
    }

    const maxMagnitude =
      series.reduce((max, entry) => Math.max(max, Math.abs(Number(entry.value) || 0)), 0) || 1;

    list.innerHTML = '';

    series.forEach((entry) => {
      const row = document.createElement('div');
      row.className = 'profit-waterfall-row';

      const label = document.createElement('div');
      label.className = 'profit-waterfall-label';
      label.innerHTML = `<strong>${entry.label || '未知项'}</strong><span>${entry.from || '开始'} → ${entry.to || '结束'}</span>`;

      const track = document.createElement('div');
      track.className = 'profit-waterfall-track';
      const bar = document.createElement('div');
      const value = Number(entry.value) || 0;
      const normalized = Math.max(6, Math.round((Math.abs(value) / maxMagnitude) * 100));
      bar.className = `profit-waterfall-fill ${value >= 0 ? 'positive' : 'negative'}`;
      bar.style.width = `${normalized}%`;
      bar.style[value >= 0 ? 'left' : 'right'] = '0';
      track.appendChild(bar);

      const valueNode = document.createElement('div');
      valueNode.className = 'profit-waterfall-value';
      valueNode.innerHTML = `<strong>${formatPoints(value)}</strong><span>${formatPercent((Number(entry.share) || 0) * 100)}</span>`;

      row.appendChild(label);
      row.appendChild(track);
      row.appendChild(valueNode);
      list.appendChild(row);
    });
  }

  function init(baseId, mountPoint, options = {}) {
    if (!mountPoint || !(mountPoint instanceof HTMLElement)) {
      throw new Error('profit insights mount point is required');
    }

    state.options = options || {};

    if (state.instance) {
      state.instance.setOptions(state.options);
      return state.instance;
    }

    const section = document.createElement('section');
    section.className = 'profit-insights-grid mt';
    section.id = `${baseId}-section`;

    const price = buildPriceCard(state.options);
    const waterfall = buildWaterfallCard();

    section.appendChild(price.card);
    section.appendChild(waterfall);
    mountPoint.appendChild(section);

    return {
      section,
      setOptions(nextOptions) {
        state.options = nextOptions || {};
        price.setOptions(state.options);
      },
      renderTargetPrice: (data) => renderTargetPrice(price.card, price.metrics, data),
      renderShapleyWaterfall: (data) => renderShapley(waterfall, data),
    };
  }

  function ready(callback) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', callback);
    } else {
      callback();
    }
  }

  function ensureAutoMount() {
    const mountPoint = document.getElementById('profitInsightsMount');
    if (!mountPoint) return;
    if (!state.instance) {
      state.instance = init('profitInsights', mountPoint);
    }
  }

  ready(ensureAutoMount);

  global.g281ProfitInsights = {
    init(baseId, mountPoint, options = {}) {
      if (state.instance) {
        state.instance.setOptions(options || state.options);
        return state.instance;
      }
      state.instance = init(baseId, mountPoint, options);
      return state.instance;
    },
    renderTargetPrice(data) {
      state.instance?.renderTargetPrice(data);
    },
    renderShapleyWaterfall(data) {
      state.instance?.renderShapleyWaterfall(data);
    },
    get instance() {
      return state.instance;
    },
  };
})(window);
