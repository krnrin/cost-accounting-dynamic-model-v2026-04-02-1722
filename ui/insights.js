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
          <h3>\u76EE\u6807\u6BDB\u5229\u7387\u53CD\u63A8\u552E\u4EF7</h3>
          <p class="profit-insight-subtitle" data-role="price-subtitle"></p>
        </div>
        <div class="profit-insight-pill" data-role="price-status"></div>
      </div>
      <div class="profit-insight-control-row">
        <label class="profit-insight-control">
          <span>\u76EE\u6807\u6BDB\u5229\u7387 (%)</span>
          <input type="number" step="0.01" min="-99.99" max="99.99" data-role="target-margin-input" />
        </label>
        <div class="profit-insight-control-actions">
          <button class="mini-button secondary" type="button" data-role="target-margin-apply">\u5E94\u7528</button>
          <button class="mini-button" type="button" data-role="target-margin-reset">\u6062\u590D\u62A5\u4EF7\u57FA\u51C6</button>
        </div>
      </div>
      <div class="profit-insight-metric-grid" data-role="price-metrics"></div>
      <p class="profit-insight-note" data-role="price-note"></p>
      <p class="profit-insight-spark" data-role="price-spark"></p>
    `;

    const metrics = {
      current: createMetric('\u5F53\u524D ASP'),
      required: createMetric('\u76EE\u6807 ASP'),
      delta: createMetric('\u552E\u4EF7\u5DEE\u5F02'),
      margin: createMetric('\u76EE\u6807\u6BDB\u5229\u7387'),
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
        input.setCustomValidity('\u8BF7\u8F93\u5165 -99.99 \u5230 99.99 \u4E4B\u95F4\u7684\u6BDB\u5229\u7387');
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
          <div class="profit-insight-eyebrow">Attribution</div>
          <h3>\u5229\u6DA6\u5F52\u56E0</h3>
          <p class="profit-insight-subtitle" data-role="waterfall-subtitle"></p>
        </div>
        <div class="profit-insight-pill" data-role="waterfall-total"></div>
      </div>
      <!-- Issue #3: \u53CC\u89C6\u56FE tab -->
      <div class="attribution-tabs">
        <div class="attribution-tab active" data-view="waterfall">\u56E0\u679C\u94FE\u7011\u5E03\u56FE</div>
        <div class="attribution-tab" data-view="shapley">Shapley \u5F52\u56E0</div>
      </div>
      <div class="attribution-view waterfall-view" data-role="waterfall-view"></div>
      <div class="attribution-view shapley-view" data-role="shapley-view" style="display:none;">
        <div class="profit-waterfall-list" data-role="waterfall-list"></div>
      </div>
      <p class="profit-insight-note" data-role="waterfall-note"></p>
    `;

    // Issue #3: tab \u5207\u6362\u4E8B\u4EF6
    const tabs = card.querySelectorAll('.attribution-tab');
    tabs.forEach((tab) => {
      tab.addEventListener('click', () => {
        tabs.forEach((t) => t.classList.remove('active'));
        tab.classList.add('active');
        const view = tab.dataset.view;
        card.querySelector('.waterfall-view').style.display = view === 'waterfall' ? '' : 'none';
        card.querySelector('.shapley-view').style.display = view === 'shapley' ? '' : 'none';
      });
    });

    return card;
  }

  function renderTargetPrice(cardRef, metrics, data = {}) {
    const subtitle = cardRef.querySelector('[data-role="price-subtitle"]');
    const status = cardRef.querySelector('[data-role="price-status"]');
    const input = cardRef.querySelector('[data-role="target-margin-input"]');
    subtitle.textContent = `${data.scenarioName || '\u9ED8\u8BA4\u573A\u666F'} \u00B7 ${data.targetModeLabel || data.varianceLabel || '\u6C42\u552E\u4EF7'}`;
    status.textContent = data.statusLabel || (data.convergence?.success === true ? '\u5DF2\u6536\u655B' : '\u5F85\u8BA1\u7B97');
    if (input) {
      input.value = isNumber(data.requestedMargin) ? Number(data.requestedMargin).toFixed(2) : '';
    }

    metrics.current.set(formatCurrency(data.currentASP), `\u5F53\u524D\u6BDB\u5229\u7387 ${formatPercent(data.currentMargin)}`);
    metrics.required.set(
      formatCurrency(data.requiredASP),
      `${data.targetModeLabel || '\u76EE\u6807\u6BDB\u5229\u7387'} ${formatPercent(data.requestedMargin)}`
    );
    metrics.delta.set(formatCurrency(data.deltaASP), `\u62A5\u4EF7 ASP ${formatCurrency(data.baseASP)}`);
    metrics.margin.set(formatPercent(data.requestedMargin), `\u6C42\u89E3\u7ED3\u679C ${formatPercent(data.requiredMargin)}`);
    metrics.margin.setLabel('\u76EE\u6807\u6BDB\u5229\u7387');

    cardRef.querySelector('[data-role="price-note"]').textContent = data.note || '';
    cardRef.querySelector('[data-role="price-spark"]').textContent = data.sparkline || '';
  }

  function renderShapley(cardRef, data = {}) {
    const list = cardRef.querySelector('[data-role="waterfall-list"]');
    const subtitle = cardRef.querySelector('[data-role="waterfall-subtitle"]');
    const total = cardRef.querySelector('[data-role="waterfall-total"]');
    const note = cardRef.querySelector('[data-role="waterfall-note"]');

    subtitle.textContent = `${data.subtitle || '\u6BDB\u5229\u7387\u62C6\u89E3'} \u00B7 \u8F93\u5165 ${formatPercent(data.baselineMargin)} \u8F93\u51FA ${formatPercent(data.scenarioMargin)}`;
    total.textContent = formatPoints(data.totalDelta);
    note.textContent = data.note || '';

    const series = Array.isArray(data.items) ? data.items : [];
    const aggregate = series.reduce((sum, entry) => sum + (Number(entry.value) || 0), 0);
    if (!data.note) {
      note.textContent = `\u5206\u9879\u5408\u8BA1 ${formatPoints(aggregate)}`;
    }

    const maxMagnitude =
      series.reduce((max, entry) => Math.max(max, Math.abs(Number(entry.value) || 0)), 0) || 1;

    list.innerHTML = '';

    series.forEach((entry) => {
      const row = document.createElement('div');
      row.className = 'profit-waterfall-row';

      const label = document.createElement('div');
      label.className = 'profit-waterfall-label';
      // P1: XSS fix — use textContent instead of innerHTML
      const labelStrong = document.createElement('strong');
      labelStrong.textContent = entry.label || '\u672A\u77E5\u9879';
      const labelSpan = document.createElement('span');
      labelSpan.textContent = `${entry.from || '\u5F00\u59CB'} \u2192 ${entry.to || '\u7ED3\u675F'}`;
      label.appendChild(labelStrong);
      label.appendChild(labelSpan);

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
      // P1: XSS fix — use textContent instead of innerHTML
      const valueStrong = document.createElement('strong');
      valueStrong.textContent = formatPoints(value);
      const valueSpan = document.createElement('span');
      valueSpan.textContent = formatPercent((Number(entry.share) || 0) * 100);
      valueNode.appendChild(valueStrong);
      valueNode.appendChild(valueSpan);

      row.appendChild(label);
      row.appendChild(track);
      row.appendChild(valueNode);
      list.appendChild(row);
    });
  }

  function renderWaterfall(cardRef, data = {}) {
    const view = cardRef.querySelector('[data-role="waterfall-view"]');
    if (!view) return;
    if (!data || !data.html) {
      view.innerHTML = '<div class="waterfall-empty">\u65E0\u7011\u5E03\u56FE\u6570\u636E</div>';
      return;
    }
    view.innerHTML = data.html;
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
      renderWaterfall: (data) => renderWaterfall(waterfall, data),
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

  // \u4E3B\u5BFC\u51FA\uFF08\u5411\u540E\u517C\u5BB9\uFF09
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
    renderWaterfall(data) {
      state.instance?.renderWaterfall(data);
    },
    get instance() {
      return state.instance;
    },
  };

  // P2#8: \u7EDF\u4E00\u547D\u540D\u7A7A\u95F4
  global.G281UI = global.G281UI || {};
  global.G281UI.ProfitInsights = global.g281ProfitInsights;
})(globalThis);
