(function (global) {
  'use strict';

  const STORAGE_KEY = 'g281.landing.workbench.v1';
  const ROLE_MAP = {
    costing: { label: '成本', current: '基线核算' },
    finance: { label: '财务', current: '财务复核' },
    procurement: { label: '采购', current: '询价执行' },
    sales: { label: '销售', current: '报价评审' },
  };

  const state = {
    roleKey: 'costing',
    selectedHarnessId: '',
    rows: [],
  };

  let refs = null;
  let observer = null;

  function textOf(value, fallback) {
    const text = String(value == null ? '' : value).trim();
    return text || (fallback == null ? '' : fallback);
  }

  function safeArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function readStored() {
    try {
      const raw = global.localStorage && global.localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (error) {
      return {};
    }
  }

  function saveStored() {
    try {
      if (!global.localStorage) return;
      global.localStorage.setItem(STORAGE_KEY, JSON.stringify({
        roleKey: state.roleKey,
        selectedHarnessId: state.selectedHarnessId,
      }));
    } catch (error) {
      // ignore
    }
  }

  function workspacePage() {
    return textOf(global.document.querySelector('[data-workspace-tab].is-active')?.getAttribute('data-workspace-tab'), 'profit');
  }

  function setWorkspacePage(nextPage) {
    const page = nextPage === 'data' ? 'data' : 'profit';
    const button = global.document.querySelector('[data-workspace-tab="' + page + '"]');
    if (button) button.click();
    return page;
  }

  function clickById(id) {
    const node = global.document.getElementById(id);
    if (node) {
      node.click();
      return true;
    }
    return false;
  }

  function patchBridge() {
    const bridge = Object.assign({}, global.G281DashboardBridge || {});
    bridge.setWorkspacePage = setWorkspacePage;
    bridge.getWorkspacePage = workspacePage;
    bridge.openVersionTimeline = function () { return clickById('openVersionTimelineBtn'); };
    bridge.closeVersionTimeline = function () { return clickById('closeVersionTimelineBtn'); };
    bridge.openBomValidation = function () { return clickById('openBomValidationBtn'); };
    global.G281DashboardBridge = bridge;
  }

  function getHarnessRows() {
    return Array.from(global.document.querySelectorAll('#harnessProfitTable tr')).map((row) => {
      const cells = Array.from(row.querySelectorAll('td'));
      if (!cells.length) return null;
      return {
        harnessId: textOf(cells[0] && cells[0].textContent, ''),
        harnessName: textOf(cells[1] && cells[1].textContent, ''),
        revenue: textOf(cells[2] && cells[2].textContent, '--'),
        cost: textOf(cells[3] && cells[3].textContent, '--'),
        margin: textOf(cells[4] && cells[4].textContent, '--'),
      };
    }).filter((row) => row && row.harnessId);
  }

  function selectedRow() {
    return state.rows.find((row) => row.harnessId === state.selectedHarnessId) || state.rows[0] || null;
  }

  function syncTableSelection() {
    Array.from(global.document.querySelectorAll('#harnessProfitTable tr')).forEach((row) => {
      const rowId = textOf(row.querySelector('td')?.textContent, '');
      if (rowId && rowId === state.selectedHarnessId) {
        row.setAttribute('data-landing-selected', 'true');
      } else {
        row.removeAttribute('data-landing-selected');
      }
    });
  }

  function render() {
    if (!refs) return;
    refs.root.hidden = false;
    const role = ROLE_MAP[state.roleKey] || ROLE_MAP.costing;
    const row = selectedRow();
    refs.role.innerHTML = [
      '<div class="landing-role-panel__label">Landing Workbench</div>',
      '<div class="landing-role-chip-list">',
      Object.keys(ROLE_MAP).map((roleKey) => {
        const active = roleKey === state.roleKey ? ' is-active' : '';
        return '<button type="button" class="landing-role-chip' + active + '" data-role-key="' + roleKey + '">' + ROLE_MAP[roleKey].label + '</button>';
      }).join(''),
      '</div>',
      '<div class="landing-flow">',
      '<div class="landing-flow__node"><span class="landing-flow__step">01</span><span class="landing-flow__name">Harness</span><span class="landing-flow__note">BOM / cost</span></div>',
      '<div class="landing-flow__node is-current"><span class="landing-flow__step">02</span><span class="landing-flow__name">' + role.current + '</span><span class="landing-flow__note">role focus</span></div>',
      '<div class="landing-flow__node"><span class="landing-flow__step">03</span><span class="landing-flow__name">Release</span><span class="landing-flow__note">publish / audit</span></div>',
      '</div>',
      '<div class="landing-role-panel__actions">',
      '<button type="button" class="landing-action-button" data-action="timeline">打开版本时间线</button>',
      '<button type="button" class="landing-action-button" data-action="data">切到数据管理</button>',
      '</div>',
    ].join('');
    refs.list.innerHTML = [
      '<div class="landing-harness-list__label">Harness Queue</div>',
      '<div class="landing-harness-list__items">',
      state.rows.map((rowItem) => {
        const active = rowItem.harnessId === state.selectedHarnessId ? ' is-selected' : '';
        return '<button type="button" class="landing-harness-list__item' + active + '" data-harness-id="' + rowItem.harnessId + '"><span class="landing-harness-list__id">' + rowItem.harnessId + '</span><span class="landing-harness-list__name">' + rowItem.harnessName + '</span><span class="landing-harness-list__meta">' + rowItem.margin + '</span></button>';
      }).join('') || '<div class="landing-detail__note">No harness rows.</div>',
      '</div>',
    ].join('');
    refs.detail.innerHTML = row ? [
      '<div class="landing-detail__eyebrow">Harness Detail</div>',
      '<h2 class="landing-detail__title">' + row.harnessId + ' · ' + row.harnessName + '</h2>',
      '<p class="landing-detail__meta">workspace ' + workspacePage() + ' · role ' + role.label + '</p>',
      '<div class="landing-detail__stats">',
      '<div class="landing-detail__stat"><span class="landing-detail__stat-label">Revenue / set</span><span class="landing-detail__stat-value">' + row.revenue + '</span></div>',
      '<div class="landing-detail__stat"><span class="landing-detail__stat-label">Cost / set</span><span class="landing-detail__stat-value">' + row.cost + '</span></div>',
      '<div class="landing-detail__stat"><span class="landing-detail__stat-label">Margin</span><span class="landing-detail__stat-value">' + row.margin + '</span></div>',
      '</div>',
      '<p class="landing-detail__note">Switch role or harness to keep the homepage anchored on a single line item.</p>',
    ].join('') : '<div class="landing-detail__note">Waiting for harness profit rows...</div>';
    syncTableSelection();
  }

  function refresh() {
    state.rows = getHarnessRows();
    const stored = readStored();
    if (ROLE_MAP[textOf(stored.roleKey, '')]) state.roleKey = textOf(stored.roleKey, state.roleKey);
    if (!state.rows.some((row) => row.harnessId === state.selectedHarnessId)) {
      const preferred = textOf(stored.selectedHarnessId, state.rows[0] && state.rows[0].harnessId);
      state.selectedHarnessId = state.rows.some((row) => row.harnessId === preferred) ? preferred : textOf(state.rows[0] && state.rows[0].harnessId, '');
    }
    render();
  }

  function setRole(roleKey) {
    if (!ROLE_MAP[roleKey]) return false;
    state.roleKey = roleKey;
    saveStored();
    render();
    return true;
  }

  function selectHarness(harnessId) {
    if (!state.rows.some((row) => row.harnessId === harnessId)) return false;
    state.selectedHarnessId = harnessId;
    saveStored();
    render();
    return true;
  }

  function ensureMount() {
    const profitPage = global.document.getElementById('profitWorkspacePage');
    if (!profitPage) return false;
    let root = profitPage.querySelector('.landing-workbench');
    if (!root) {
      root = global.document.createElement('section');
      root.className = 'landing-workbench';
      root.innerHTML = [
        '<div class="landing-workbench__head">',
        '<section class="landing-detail">',
        '<h1 class="landing-workbench__title">Landing Workbench</h1>',
        '<p class="landing-workbench__copy">Default the profit homepage to a harness-first workbench, keep role actions explicit, and preserve the existing dashboard below.</p>',
        '</section>',
        '<section class="landing-role-panel"></section>',
        '</div>',
        '<div class="landing-workbench__body">',
        '<section class="landing-harness-list"></section>',
        '<section class="landing-detail landing-detail-panel"></section>',
        '</div>',
      ].join('');
      profitPage.prepend(root);
    }
    refs = {
      root: root,
      role: root.querySelector('.landing-role-panel'),
      list: root.querySelector('.landing-harness-list'),
      detail: root.querySelector('.landing-detail-panel'),
    };
    if (!root.dataset.bound) {
      root.dataset.bound = 'true';
      root.addEventListener('click', (event) => {
        const roleButton = event.target.closest('[data-role-key]');
        if (roleButton) {
          setRole(textOf(roleButton.getAttribute('data-role-key'), 'costing'));
          return;
        }
        const harnessButton = event.target.closest('[data-harness-id]');
        if (harnessButton) {
          selectHarness(textOf(harnessButton.getAttribute('data-harness-id'), ''));
          return;
        }
        const actionButton = event.target.closest('[data-action]');
        if (!actionButton) return;
        const action = textOf(actionButton.getAttribute('data-action'), '');
        if (action === 'timeline') global.G281DashboardBridge.openVersionTimeline();
        if (action === 'data') global.G281DashboardBridge.setWorkspacePage('data');
      });
    }
    return Boolean(refs.role && refs.list && refs.detail);
  }

  function observeTable() {
    const table = global.document.getElementById('harnessProfitTable');
    if (!table || observer) return;
    observer = new MutationObserver(refresh);
    observer.observe(table, { childList: true, subtree: true });
  }

  function init() {
    if (!ensureMount()) {
      global.setTimeout(init, 100);
      return;
    }
    patchBridge();
    observeTable();
    refresh();
  }

  global.G281LandingWorkbench = {
    getStateSnapshot: function () {
      return {
        roleKey: state.roleKey,
        selectedHarnessId: state.selectedHarnessId,
        harnessCount: state.rows.length,
        harnessIds: safeArray(state.rows).map((row) => row.harnessId),
      };
    },
    listHarnessIds: function () {
      return safeArray(state.rows).map((row) => row.harnessId);
    },
    setRole: setRole,
    selectHarness: selectHarness,
    refresh: refresh,
  };

  if (global.document.readyState === 'loading') {
    global.document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})(typeof globalThis !== 'undefined' ? globalThis : window);
