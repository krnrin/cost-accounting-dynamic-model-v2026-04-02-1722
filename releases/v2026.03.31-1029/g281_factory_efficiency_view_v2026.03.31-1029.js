(function (global) {
  'use strict';

  const STORAGE_KEY = 'g281.factory.efficiency.v1';
  const TAB_CONFIG = [
    { key: 'efficiency', label: '工厂效率', description: '直接人工与制造费用效率口径' },
    { key: 'laborRate', label: '运营工时费率', description: '工时费率与制造费用费率口径' },
  ];

  const defaults = global.G281OperatingLaborRateSeedData || {
    factories: [],
    efficiency: { groups: [], note: '' },
    laborRate: { groups: [], note: '' },
  };

  const state = {
    root: null,
    container: null,
    header: null,
    status: null,
    tabs: {},
    panels: {},
    activeTab: TAB_CONFIG[0].key,
    data: clonePlain(defaults, {}),
    baseData: clonePlain(defaults, {}),
    versionCatalog: { current: clonePlain(defaults, {}) },
    activeVersionKey: 'current',
    compareVersionKey: 'none',
    editMode: false,
    dirty: false,
    lastSavedAt: null,
  };

  function clonePlain(value, fallback) {
    if (value === undefined || value === null) {
      return fallback;
    }
    return JSON.parse(JSON.stringify(value));
  }

  function resolveContainer(target) {
    if (!target) return null;
    if (typeof target === 'string') return document.querySelector(target);
    if (target instanceof HTMLElement) return target;
    if (target && target.current instanceof HTMLElement) return target.current;
    return null;
  }

  function ensureStyles() {
    if (document.querySelector('link[data-fe-style="factory-efficiency"]')) {
      return;
    }
    const head = document.head || document.getElementsByTagName('head')[0];
    if (!head) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.type = 'text/css';
    link.href = 'g281_factory_efficiency_view.css';
    link.dataset.feStyle = 'factory-efficiency';
    head.appendChild(link);
  }

  function loadOverrides() {
    try {
      const raw = global.localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (error) {
      return null;
    }
  }

  function saveOverrides(payload) {
    try {
      global.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
      return true;
    } catch (error) {
      return false;
    }
  }

  function clearOverrides() {
    try {
      global.localStorage.removeItem(STORAGE_KEY);
      return true;
    } catch (error) {
      return false;
    }
  }

  function hasSavedOverrides() {
    try {
      return Boolean(global.localStorage.getItem(STORAGE_KEY));
    } catch (error) {
      return false;
    }
  }

  function applyOverrides(baseData, overrides) {
    return clonePlain(overrides || baseData, clonePlain(baseData, {}));
  }

  function formatNumber(value, digits = 1) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
      return '-';
    }
    return numeric.toLocaleString('zh-CN', {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    });
  }

  function formatTimestamp(value) {
    if (!value) return '未保存';
    const time = new Date(value);
    if (Number.isNaN(time.getTime())) return '未保存';
    return time.toLocaleString('zh-CN', { hour12: false });
  }

  function createHeader() {
    const header = document.createElement('div');
    header.className = 'fe-header';
    header.innerHTML = `
      <div class="fe-title-block">
        <div class="fe-title">工厂效率与运营工时费率</div>
        <div class="fe-subtitle">离线本地维护，适合按工厂横向对比并直接录入修订。</div>
      </div>
      <div class="fe-header-actions">
        <label class="fe-select-wrap">
          <span>激活版本</span>
          <select class="fe-select" data-action="active-version"></select>
        </label>
        <label class="fe-select-wrap">
          <span>对比版本</span>
          <select class="fe-select" data-action="compare-version"></select>
        </label>
        <div class="fe-status" data-role="status"></div>
        <button class="fe-btn" type="button" data-action="toggle-edit">编辑</button>
        <button class="fe-btn" type="button" data-action="save">保存本地</button>
        <button class="fe-btn fe-btn-ghost" type="button" data-action="reset">恢复默认</button>
      </div>
    `;
    header.addEventListener('click', handleToolbarClick);
    header.addEventListener('change', handleHeaderChange);
    return header;
  }

  function createTableSkeleton(factories) {
    const table = document.createElement('table');
    table.className = 'fe-table';
    table.innerHTML = '<thead></thead><tbody></tbody>';
    updateTableHeader(table, factories);
    return { table, tableBody: table.querySelector('tbody') };
  }

  function updateTableHeader(table, factories) {
    const thead = table.querySelector('thead');
    if (!thead) return;
    const headers = ['项目', '单位'].concat((factories || []).map((factory) => factory || ''));
    thead.innerHTML = `<tr>${headers.map((text, index) => `<th${index < 2 ? ' class="fe-sticky-col"' : ''}>${text}</th>`).join('')}</tr>`;
  }

  function getSectionData(dataset, tabKey) {
    return dataset && dataset[tabKey] ? dataset[tabKey] : null;
  }

  function getCompareRowValue(compareSection, groupIndex, rowIndex, factory) {
    const group = compareSection?.groups?.[groupIndex];
    const row = group?.rows?.[rowIndex];
    if (!row) return null;
    const value = row.values?.[factory];
    return Number.isFinite(Number(value)) ? Number(value) : null;
  }

  function formatDiff(value) {
    if (!Number.isFinite(value) || Math.abs(value) < 1e-9) return '0.0';
    const sign = value > 0 ? '+' : '';
    return `${sign}${formatNumber(value, 1)}`;
  }

  function buildPanel(tab) {
    const panel = document.createElement('section');
    panel.className = 'fe-tab-panel';
    panel.dataset.tab = tab.key;

    const caption = document.createElement('div');
    caption.className = 'fe-caption-block';
    caption.innerHTML = `
      <div class="fe-caption">${tab.label}</div>
      <div class="fe-caption-note">${tab.description || ''}</div>
    `;

    const wrapper = document.createElement('div');
    wrapper.className = 'fe-table-wrapper';
    const { table, tableBody } = createTableSkeleton(state.data.factories);
    tableBody.addEventListener('input', handleInputChange);
    wrapper.appendChild(table);

    const remark = document.createElement('div');
    remark.className = 'fe-remark';

    panel.appendChild(caption);
    panel.appendChild(wrapper);
    panel.appendChild(remark);

    return { panel, table, tableBody, remark };
  }

  function renderPanel(panelState, tabKey, sectionData, compareSectionData) {
    if (!panelState) return;
    const factories = Array.isArray(state.data.factories) ? state.data.factories : [];
    updateTableHeader(panelState.table, factories);
    const tableBody = panelState.tableBody;
    tableBody.innerHTML = '';

    if (!sectionData || !Array.isArray(sectionData.groups) || !sectionData.groups.length) {
      tableBody.innerHTML = `<tr><td class="fe-empty" colspan="${2 + factories.length}">暂无数据</td></tr>`;
      panelState.remark.textContent = sectionData?.note || '暂无备注。';
      return;
    }

    sectionData.groups.forEach((group, groupIndex) => {
      const groupRow = document.createElement('tr');
      groupRow.className = 'fe-group-row';
      groupRow.innerHTML = `<td colspan="${2 + factories.length}">${group.groupLabel || ''}</td>`;
      tableBody.appendChild(groupRow);

      (group.rows || []).forEach((row, rowIndex) => {
        const rowEl = document.createElement('tr');
        const cells = [
          `<td class="fe-row-label fe-sticky-col">${row.label || ''}</td>`,
          `<td class="fe-unit fe-sticky-col">${row.unit || '-'}</td>`,
        ];
        factories.forEach((factory) => {
          const value = row.values?.[factory];
          if (state.editMode) {
            cells.push(
              `<td class="fe-input-cell"><input class="fe-input" type="number" step="0.1" value="${Number.isFinite(Number(value)) ? Number(value) : ''}" data-tab="${tabKey}" data-group-index="${groupIndex}" data-row-index="${rowIndex}" data-factory="${factory}"></td>`
            );
            return;
          }
          const numericValue = Number.isFinite(Number(value)) ? Number(value) : null;
          const compareValue = getCompareRowValue(compareSectionData, groupIndex, rowIndex, factory);
          const diff = numericValue !== null && compareValue !== null ? numericValue - compareValue : null;
          if (compareSectionData) {
            const diffClass = diff === null ? 'is-na' : (diff > 0 ? 'is-up' : (diff < 0 ? 'is-down' : 'is-same'));
            cells.push(`<td class="fe-number"><div class="fe-cell-stack"><span>${formatNumber(value)}</span><span class="fe-compare-diff ${diffClass}">Δ ${formatDiff(diff)}</span></div></td>`);
            return;
          }
          cells.push(`<td class="fe-number">${formatNumber(value)}</td>`);
        });
        rowEl.innerHTML = cells.join('');
        tableBody.appendChild(rowEl);
      });
    });

    const compareHint = compareSectionData ? ` | 对比版本: ${state.compareVersionKey}` : '';
    panelState.remark.textContent = `${sectionData.note || '当前页签未设置备注。'}${compareHint}`;
  }

  function renderPanels() {
    const compareDataset = state.compareVersionKey !== 'none' ? state.versionCatalog[state.compareVersionKey] : null;
    TAB_CONFIG.forEach((tab) => {
      const compareSection = getSectionData(compareDataset, tab.key);
      renderPanel(state.panels[tab.key], tab.key, state.data[tab.key], compareSection);
    });
    syncVersionSelectors();
    updateStatus();
    switchTab(state.activeTab);
  }

  function syncVersionSelectors() {
    if (!state.header) return;
    const activeSelect = state.header.querySelector('[data-action="active-version"]');
    const compareSelect = state.header.querySelector('[data-action="compare-version"]');
    if (!(activeSelect instanceof HTMLSelectElement) || !(compareSelect instanceof HTMLSelectElement)) return;

    const versionKeys = Object.keys(state.versionCatalog || {});
    activeSelect.innerHTML = versionKeys.map((key) => `<option value="${key}">${key}</option>`).join('');
    activeSelect.value = state.activeVersionKey;

    const compareOptions = ['<option value="none">不对比</option>']
      .concat(versionKeys.map((key) => `<option value="${key}">${key}</option>`));
    compareSelect.innerHTML = compareOptions.join('');
    compareSelect.value = state.compareVersionKey;
  }

  function updateStatus() {
    if (!state.status) return;
    const modeText = state.editMode ? '编辑模式' : '查看模式';
    const dirtyText = state.dirty ? '未保存' : '已同步';
    const storageText = state.lastSavedAt ? '本地已有缓存' : '本地未保存';
    state.status.classList.toggle('is-dirty', state.dirty);
    state.status.innerHTML = `
      <span>${modeText}</span>
      <span>${dirtyText}</span>
      <span>${storageText}</span>
      <span>激活: ${state.activeVersionKey}</span>
      <span>对比: ${state.compareVersionKey === 'none' ? '无' : state.compareVersionKey}</span>
      <span>更新时间：${formatTimestamp(state.lastSavedAt)}</span>
    `;
    Object.entries(state.tabs).forEach(([key, button]) => {
      button.classList.toggle('is-active', key === state.activeTab);
    });
    const editButton = state.header?.querySelector('[data-action="toggle-edit"]');
    if (editButton) {
      editButton.textContent = state.editMode ? '完成编辑' : '编辑';
      editButton.classList.toggle('is-active', state.editMode);
    }
    updateToolbarButtons();
  }

  function updateToolbarButtons() {
    if (!state.header) return;
    const saveButton = state.header.querySelector('[data-action="save"]');
    const resetButton = state.header.querySelector('[data-action="reset"]');
    if (saveButton) {
      const disableSave = !state.editMode || !state.dirty;
      saveButton.disabled = disableSave;
      saveButton.classList.toggle('is-disabled', disableSave);
    }
    if (resetButton) {
      const disableReset = !state.dirty && !hasSavedOverrides();
      resetButton.disabled = disableReset;
      resetButton.classList.toggle('is-disabled', disableReset);
    }
  }

  function switchTab(tabKey) {
    state.activeTab = tabKey;
    Object.entries(state.tabs).forEach(([key, button]) => {
      button.classList.toggle('is-active', key === tabKey);
    });
    Object.entries(state.panels).forEach(([key, panelState]) => {
      panelState.panel.classList.toggle('is-active', key === tabKey);
    });
  }

  function mergeIncomingData(data) {
    const incoming = clonePlain(data || defaults, clonePlain(defaults, {}));
    const incomingVersions = incoming?.versions && typeof incoming.versions === 'object'
      ? incoming.versions
      : { current: incoming };

    state.versionCatalog = clonePlain(incomingVersions, { current: clonePlain(defaults, {}) });
    const defaultActiveKey = incoming?.activeVersionKey && state.versionCatalog[incoming.activeVersionKey]
      ? incoming.activeVersionKey
      : (Object.keys(state.versionCatalog)[0] || 'current');
    state.activeVersionKey = state.versionCatalog[state.activeVersionKey] ? state.activeVersionKey : defaultActiveKey;
    state.compareVersionKey = state.compareVersionKey === 'none' || state.versionCatalog[state.compareVersionKey]
      ? state.compareVersionKey
      : 'none';

    state.baseData = clonePlain(state.versionCatalog[state.activeVersionKey], clonePlain(defaults, {}));
    if (state.editMode && state.dirty) {
      updateStatus();
      return;
    }
    const overrides = loadOverrides();
    state.data = applyOverrides(state.baseData, overrides);
    state.lastSavedAt = overrides?.meta?.updatedAt || null;
    state.dirty = false;
  }

  function handleHeaderChange(event) {
    const action = event.target?.dataset?.action;
    if (!action) return;
    if (action === 'active-version') {
      const nextKey = event.target.value;
      if (!state.versionCatalog[nextKey]) return;
      state.activeVersionKey = nextKey;
      state.baseData = clonePlain(state.versionCatalog[nextKey], clonePlain(defaults, {}));
      const overrides = loadOverrides();
      state.data = applyOverrides(state.baseData, overrides);
      state.lastSavedAt = overrides?.meta?.updatedAt || null;
      state.dirty = false;
      renderPanels();
      return;
    }
    if (action === 'compare-version') {
      state.compareVersionKey = event.target.value || 'none';
      renderPanels();
    }
  }

  function handleToolbarClick(event) {
    const action = event.target?.dataset?.action;
    if (!action) return;
    if (action === 'toggle-edit') {
      state.editMode = !state.editMode;
      renderPanels();
      return;
    }
    if (action === 'save') {
      const payload = clonePlain(state.data, {});
      payload.meta = {
        ...(payload.meta || {}),
        updatedAt: new Date().toISOString(),
        source: '本地编辑',
      };
      const ok = saveOverrides(payload);
      if (ok) {
        state.lastSavedAt = payload.meta.updatedAt;
        state.dirty = false;
        state.data = payload;
      }
      updateStatus();
      return;
    }
    if (action === 'reset') {
      clearOverrides();
      state.data = applyOverrides(state.baseData, null);
      state.editMode = false;
      state.dirty = false;
      state.lastSavedAt = null;
      renderPanels();
    }
  }

  function handleInputChange(event) {
    const input = event.target;
    if (!(input instanceof HTMLInputElement)) return;
    const tabKey = input.dataset.tab;
    const groupIndex = Number(input.dataset.groupIndex);
    const rowIndex = Number(input.dataset.rowIndex);
    const factory = input.dataset.factory;
    const numeric = input.value === '' ? null : Number(input.value);
    const section = state.data?.[tabKey];
    const group = section?.groups?.[groupIndex];
    const row = group?.rows?.[rowIndex];
    if (!row || !factory) return;
    row.values = row.values || {};
    row.values[factory] = numeric;
    state.dirty = true;
    updateStatus();
  }

  function render(data) {
    mergeIncomingData(data);
    renderPanels();
  }

  function open(payload) {
    if (!state.root) return;
    const data = payload?.data || payload;
    render(data || state.data);
    state.root.classList.remove('fe-hidden');
  }

  function close() {
    if (!state.root) return;
    state.root.classList.add('fe-hidden');
  }

  function mount(options) {
    const container = resolveContainer(options?.container) || document.body;
    if (!container) {
      throw new Error('Factory efficiency view needs a container element');
    }
    ensureStyles();

    if (state.root && state.root.parentElement) {
      state.root.remove();
    }

    mergeIncomingData(options?.data || defaults);

    const shell = document.createElement('div');
    shell.className = 'factory-efficiency-view-shell fe-hidden';
    shell.id = options?.id || 'g281-factory-efficiency-view';

    const header = createHeader();
    const status = header.querySelector('[data-role="status"]');
    const tabBar = document.createElement('div');
    tabBar.className = 'fe-tab-bar';
    const panelWrapper = document.createElement('div');
    panelWrapper.className = 'fe-tab-panels';

    state.tabs = {};
    state.panels = {};
    state.header = header;
    state.status = status;

    TAB_CONFIG.forEach((tab) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'fe-tab';
      button.textContent = tab.label;
      button.addEventListener('click', () => switchTab(tab.key));
      tabBar.appendChild(button);
      state.tabs[tab.key] = button;

      const panelState = buildPanel(tab);
      panelWrapper.appendChild(panelState.panel);
      state.panels[tab.key] = panelState;
    });

    shell.appendChild(header);
    shell.appendChild(tabBar);
    shell.appendChild(panelWrapper);
    container.appendChild(shell);

    state.root = shell;
    state.container = container;

    renderPanels();
    switchTab(state.activeTab);

    return {
      root: shell,
      render,
      open,
      close,
    };
  }

  global.G281FactoryEfficiencyView = {
    mount,
    render,
    open,
    close,
  };
})(window);
