(function (global) {
  'use strict';

  const doc = global.document;
  if (!doc) return;

  const ROLE_PRESETS = {
    harness: {
      label: '线束开发',
      stepKey: 'bom',
      focus: '先看单线束号清单、BOM 工程台和变更影响，确认哪一根线束在拖累整套利润。',
      boundary: '当前页面只提供离线角色视图，不做真实权限封口；后续飞书鉴权接口直接复用这里的角色语义。',
      actions: [
        { label: '跳到线束利润表', kind: 'scroll', target: '.harness-profit-section' },
        { label: '切到数据管理', kind: 'click', target: '#workspaceTabData' },
        { label: '打开 BOM 管理', kind: 'click', target: '#openBomValidationBtn' },
      ],
    },
    procurement: {
      label: '采购',
      stepKey: 'connector',
      focus: '优先看连接器执行状态、包装物流和低利润线束，先把询价和协议落地路径收紧。',
      boundary: '采购在本页只消费利润结果和定位问题，不直接改利润引擎与项目汇总口径。',
      actions: [
        { label: '跳到连接器执行', kind: 'scroll', target: '#connectorPriceTable' },
        { label: '打开包装管理', kind: 'click', target: '#openPackagingValidationBtn' },
        { label: '打开资源投入', kind: 'click', target: '#openCapitalValidationBtn' },
      ],
    },
    ie: {
      label: '工艺 IE',
      stepKey: 'labor',
      focus: '优先核对工时、制造费用和设备投入，确认工艺口径是否支撑当前报价版利润。',
      boundary: '本页只展示工艺侧结果和跳转入口，不新增独立工艺数据存储。',
      actions: [
        { label: '切到数据管理', kind: 'click', target: '#workspaceTabData' },
        { label: '打开工时管理', kind: 'click', target: '#openLaborValidationBtn' },
        { label: '打开资源投入', kind: 'click', target: '#openCapitalValidationBtn' },
      ],
    },
    finance: {
      label: '财务',
      stepKey: 'profit',
      focus: '先看生命周期利润、回收期和资本池，再看哪一根线束触发利润预警。',
      boundary: '维持离线单机的角色边界预留，不在本页落真实组织权限和总部平均分摊。',
      actions: [
        { label: '跳到年度利润表', kind: 'scroll', target: '#annualTable' },
        { label: '跳到资本池', kind: 'scroll', target: '#capitalLedger' },
        { label: '跳到利润驱动', kind: 'scroll', target: '#profitDriverGrid' },
      ],
    },
    sales: {
      label: '销售',
      stepKey: 'release',
      focus: '聚焦场景版本、对比结果和对外报价口径，先确认当前报价版的说明是否完整。',
      boundary: '销售在本页只消费成本和利润结果，不直接维护 BOM、工时和包装规则。',
      actions: [
        { label: '打开版本时间线', kind: 'click', target: '#openVersionTimelineBtn' },
        { label: '跳到场景对比', kind: 'scroll', target: '#compareTable' },
        { label: '切到数据管理', kind: 'click', target: '#workspaceTabData' },
      ],
    },
    management: {
      label: '管理层',
      stepKey: 'release',
      focus: '先看项目总览和高风险线束，再沿着流程概览确认哪一个节点还没有闭环。',
      boundary: '当前只做看板级可见性，不做真实审批流和部门鉴权，后续接飞书审批接口。',
      actions: [
        { label: '跳到 KPI 总览', kind: 'scroll', target: '#kpiGrid' },
        { label: '跳到年度走势', kind: 'scroll', target: '#annualChart' },
        { label: '打开版本时间线', kind: 'click', target: '#openVersionTimelineBtn' },
      ],
    },
  };

  const state = {
    role: 'harness',
    selectedHarnessId: '',
    mounted: false,
    refreshToken: 0,
    observers: [],
    tableBound: false,
    mountBound: false,
  };

  function $(id) {
    return doc.getElementById(id);
  }

  function textOf(value) {
    return String(value == null ? '' : value).trim();
  }

  function escapeHtml(value) {
    return textOf(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function numberOr(value, fallback) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : fallback;
  }

  function parseNumberText(value) {
    const normalized = textOf(value).replace(/,/g, '').replace(/[^0-9.+-]/g, '');
    if (!normalized) return null;
    const numeric = Number(normalized);
    return Number.isFinite(numeric) ? numeric : null;
  }

  function formatMoney(value) {
    return Number.isFinite(value) ? `${value.toFixed(2)} 元` : '--';
  }

  function formatPercent(value) {
    return Number.isFinite(value) ? `${(value * 100).toFixed(2)}%` : '--';
  }

  function countTableRows(id) {
    const table = $(id);
    if (!table) return 0;
    const rows = Array.from(table.querySelectorAll('tbody tr')).filter(function (row) {
      return row.querySelectorAll('td').length > 1;
    });
    if (rows.length) return rows.length;
    const fallbackRows = Array.from(table.querySelectorAll('tr')).filter(function (row, index) {
      return index > 0 && row.querySelectorAll('td').length > 1;
    });
    return fallbackRows.length;
  }

  function collectChipTexts(selector) {
    return Array.from(doc.querySelectorAll(selector))
      .map(function (node) {
        return textOf(node.textContent);
      })
      .filter(Boolean);
  }

  function readKpiCards() {
    const grid = $('kpiGrid');
    if (!grid) return [];
    return Array.from(grid.querySelectorAll('article')).map(function (card) {
      const titleNode = card.querySelector('.title');
      const valueNode = card.querySelector('.num');
      const subNode = card.querySelector('.sub');
      return {
        title: textOf(titleNode && titleNode.textContent),
        value: textOf(valueNode && valueNode.textContent),
        meta: textOf(subNode && subNode.textContent),
      };
    }).filter(function (card) {
      return card.title;
    });
  }

  function toneClass(tone) {
    if (tone === 'low') return 'is-low';
    if (tone === 'high') return 'is-high';
    return 'is-mid';
  }

  function toneLabel(tone) {
    if (tone === 'low') return '利润预警';
    if (tone === 'high') return '利润健康';
    return '关注跟进';
  }

  function inferTone(row) {
    if (textOf(row.tone)) return row.tone;
    if (Number.isFinite(row.margin) && row.margin < 0.12) return 'low';
    if (Number.isFinite(row.margin) && row.margin >= 0.2) return 'high';
    return 'mid';
  }

  function collectHarnessRowsFromTable() {
    const body = $('harnessProfitTable');
    if (!body) return [];
    return Array.from(body.querySelectorAll('tr')).map(function (row, index) {
      const cells = row.querySelectorAll('td');
      if (!cells.length || cells.length < 11) return null;
      const harnessId = textOf(cells[0].textContent);
      if (!harnessId) return null;
      const tone = inferTone({ tone: row.getAttribute('data-profit-tone') || '' });
      return {
        index: index + 1,
        harnessId: harnessId,
        harnessName: textOf(cells[1].textContent),
        revenueText: textOf(cells[2].textContent),
        costText: textOf(cells[3].textContent),
        profitText: textOf(cells[4].textContent),
        marginText: textOf(cells[5].textContent),
        materialText: textOf(cells[6].textContent),
        laborText: textOf(cells[7].textContent),
        packagingText: textOf(cells[8].textContent),
        equipmentText: textOf(cells[9].textContent),
        basisText: textOf(cells[10].textContent),
        revenue: parseNumberText(cells[2].textContent),
        cost: parseNumberText(cells[3].textContent),
        profit: parseNumberText(cells[4].textContent),
        margin: (parseNumberText(cells[5].textContent) || 0) / 100,
        tone: tone,
      };
    }).filter(Boolean).sort(function (left, right) {
      const leftMargin = Number.isFinite(left.margin) ? left.margin : Number.POSITIVE_INFINITY;
      const rightMargin = Number.isFinite(right.margin) ? right.margin : Number.POSITIVE_INFINITY;
      if (leftMargin !== rightMargin) return leftMargin - rightMargin;
      return (left.profit || 0) - (right.profit || 0);
    });
  }

  function resolveSelectedHarness(rows) {
    if (!rows.length) {
      state.selectedHarnessId = '';
      return null;
    }
    const selected = rows.find(function (row) {
      return row.harnessId === state.selectedHarnessId;
    }) || rows[0];
    state.selectedHarnessId = selected.harnessId;
    return selected;
  }

  function findKpi(cards, title) {
    return cards.find(function (card) {
      return card.title === title;
    }) || null;
  }

  function buildFlow(vm) {
    return [
      {
        key: 'bom',
        label: 'BOM 拆解',
        status: vm.harnessRows.length ? 'done' : 'pending',
        detail: vm.harnessRows.length ? `${vm.harnessRows.length} 条线束已展开` : '等待线束级数据',
      },
      {
        key: 'connector',
        label: '询价执行',
        status: vm.connectorCount ? 'done' : 'pending',
        detail: vm.connectorCount ? `连接器明细 ${vm.connectorCount} 条` : '等待连接器执行数据',
      },
      {
        key: 'labor',
        label: '工时核定',
        status: vm.directHours > 0 || vm.manufacturingHours > 0 ? 'done' : 'pending',
        detail: `前工程 ${vm.directHours.toFixed(2)}h / 总装 ${vm.manufacturingHours.toFixed(2)}h`,
      },
      {
        key: 'packaging',
        label: '包装物流',
        status: vm.packagingTotal > 0 ? 'done' : 'pending',
        detail: vm.packagingTotal > 0 ? `${vm.packagingTotal.toFixed(2)} 元/套` : '等待包装费用',
      },
      {
        key: 'profit',
        label: '利润复核',
        status: vm.harnessRows.length ? 'done' : 'pending',
        detail: vm.lowRiskCount ? `${vm.lowRiskCount} 条线束需复核` : '当前未出现线束级预警',
      },
      {
        key: 'release',
        label: '版本归档',
        status: vm.historyCount ? 'done' : 'pending',
        detail: vm.historyCount ? `历史版本 ${vm.historyCount} 条` : '当前无历史快照',
      },
    ];
  }

  function buildViewModel() {
    const model = global._g281LastModel || null;
    const harnessRows = collectHarnessRowsFromTable();
    const selectedHarness = resolveSelectedHarness(harnessRows);
    const kpiCards = readKpiCards();
    const scenarioName = textOf(($('scenarioName') && $('scenarioName').value) || (model && model.d && model.d.scenarioName)) || '当前场景';
    const scenarioTags = collectChipTexts('#scenarioTags .chip');
    const timelineTags = collectChipTexts('#timelineScenarioTagsWrap .chip');
    const tags = scenarioTags.concat(timelineTags).filter(function (item, index, array) {
      return item && array.indexOf(item) === index;
    }).slice(0, 9);
    const totalProfitCard = findKpi(kpiCards, '生命周期利润');
    const marginCard = findKpi(kpiCards, '毛利率');
    const paybackCard = findKpi(kpiCards, '静态回收期');
    const volumeCard = findKpi(kpiCards, '生命周期收入');
    const lowRiskCount = harnessRows.filter(function (row) {
      return row.tone === 'low' || row.profit < 0;
    }).length;
    const negativeCount = harnessRows.filter(function (row) {
      return row.profit < 0;
    }).length;
    const directHours = numberOr($('directHours') && $('directHours').value, 0);
    const manufacturingHours = numberOr($('manufacturingHours') && $('manufacturingHours').value, 0);
    const packagingTotal =
      numberOr($('packInner') && $('packInner').value, 0) +
      numberOr($('packFreight') && $('packFreight').value, 0) +
      numberOr($('packWarehouse') && $('packWarehouse').value, 0) +
      numberOr($('packOther') && $('packOther').value, 0);
    const connectorCount = countTableRows('connectorPriceTable');
    const historyCount = countTableRows('historyTable');

    return {
      model: model,
      role: ROLE_PRESETS[state.role] || ROLE_PRESETS.harness,
      scenarioName: scenarioName,
      tags: tags,
      harnessRows: harnessRows,
      selectedHarness: selectedHarness,
      kpiCards: kpiCards.slice(0, 4),
      totalProfitCard: totalProfitCard,
      marginCard: marginCard,
      paybackCard: paybackCard,
      volumeCard: volumeCard,
      lowRiskCount: lowRiskCount,
      negativeCount: negativeCount,
      directHours: directHours,
      manufacturingHours: manufacturingHours,
      packagingTotal: packagingTotal,
      connectorCount: connectorCount,
      historyCount: historyCount,
    };
  }

  function renderHeroMetrics(vm) {
    const cards = vm.kpiCards.length ? vm.kpiCards : [
      {
        title: '生命周期利润',
        value: vm.totalProfitCard ? vm.totalProfitCard.value : formatMoney(vm.model && vm.model.totalProfit),
        meta: vm.paybackCard ? vm.paybackCard.value : '--',
      },
      {
        title: '毛利率',
        value: vm.marginCard ? vm.marginCard.value : formatPercent(vm.model && vm.model.margin),
        meta: vm.selectedHarness ? `${vm.selectedHarness.harnessId} 为当前最低利润线束` : '等待线束数据',
      },
    ];
    return cards.map(function (card) {
      return [
        '<div class="landing-workbench__summary-card">',
        `<div class="landing-workbench__summary-label">${escapeHtml(card.title)}</div>`,
        `<div class="landing-workbench__summary-value">${escapeHtml(card.value || '--')}</div>`,
        `<div class="landing-workbench__summary-meta">${escapeHtml(card.meta || '')}</div>`,
        '</div>',
      ].join('');
    }).join('');
  }

  function renderRoleActions(role) {
    return role.actions.map(function (action) {
      return `<button type="button" class="button ghost landing-action-button" data-action-kind="${escapeHtml(action.kind)}" data-action-target="${escapeHtml(action.target)}">${escapeHtml(action.label)}</button>`;
    }).join('');
  }

  function renderFlowNodes(vm) {
    return buildFlow(vm).map(function (step) {
      const isCurrent = step.key === vm.role.stepKey;
      const statusClass = step.status === 'done' ? 'is-done' : 'is-pending';
      const currentClass = isCurrent ? ' is-current' : '';
      const statusText = isCurrent ? '当前角色' : (step.status === 'done' ? '已就绪' : '待补齐');
      return [
        `<article class="landing-flow__node ${statusClass}${currentClass}">`,
        `<span class="landing-flow__status">${escapeHtml(statusText)}</span>`,
        `<h4 class="landing-flow__name">${escapeHtml(step.label)}</h4>`,
        `<div class="landing-flow__meta">${escapeHtml(step.detail)}</div>`,
        '</article>',
      ].join('');
    }).join('');
  }

  function renderHarnessList(vm) {
    if (!vm.harnessRows.length) {
      return '<div class="landing-empty">当前还没有可复用的线束利润拆解结果。先生成场景或检查底部线束利润表是否已渲染。</div>';
    }
    return vm.harnessRows.map(function (row) {
      const activeClass = row.harnessId === state.selectedHarnessId ? ' is-active' : '';
      return [
        `<button type="button" class="landing-harness-list__item${activeClass}" data-harness-id="${escapeHtml(row.harnessId)}">`,
        '<div class="landing-harness-list__head">',
        `<div><div class="landing-harness-list__title">${escapeHtml(row.harnessId)}</div><div class="landing-harness-list__subtitle">${escapeHtml(row.harnessName)}</div></div>`,
        `<span class="landing-harness-list__tone ${toneClass(row.tone)}">${escapeHtml(toneLabel(row.tone))}</span>`,
        '</div>',
        '<div class="landing-harness-list__metrics">',
        `<div class="landing-harness-list__metric"><div class="landing-harness-list__metric-label">毛利率</div><div class="landing-harness-list__metric-value">${escapeHtml(row.marginText || '--')}</div></div>`,
        `<div class="landing-harness-list__metric"><div class="landing-harness-list__metric-label">毛利额/套</div><div class="landing-harness-list__metric-value">${escapeHtml(row.profitText || '--')}</div></div>`,
        `<div class="landing-harness-list__metric"><div class="landing-harness-list__metric-label">分摊依据</div><div class="landing-harness-list__metric-value">${escapeHtml(row.basisText || '--')}</div></div>`,
        '</div>',
        '</button>',
      ].join('');
    }).join('');
  }

  function renderDetail(vm) {
    if (!vm.selectedHarness) {
      return '<div class="landing-empty">当前没有选中的线束。生成场景后，左侧会自动按线束毛利率从低到高排列。</div>';
    }
    const row = vm.selectedHarness;
    const roleHint = vm.role.stepKey === 'profit'
      ? '优先检查该线束对整套利润的拖累程度，再决定是否进入资本或年度利润复核。'
      : vm.role.stepKey === 'connector'
        ? '优先对照连接器执行和包装物流区，确认这条线束的采购落地状态。'
        : '优先从当前明细跳到底部对应工作区，沿现有页面继续处理。';
    return [
      '<div class="landing-detail__head">',
      `<div><h3 class="landing-detail__title">${escapeHtml(row.harnessId)} · ${escapeHtml(row.harnessName)}</h3><p class="landing-detail__subtitle">单线束主视角复用现有利润表结果，不改底层计算规则。</p></div>`,
      `<span class="landing-detail__tone ${toneClass(row.tone)}">${escapeHtml(toneLabel(row.tone))}</span>`,
      '</div>',
      '<div class="landing-detail__meta-grid">',
      `<div class="landing-detail__metric"><div class="landing-detail__metric-label">收入/套</div><div class="landing-detail__metric-value">${escapeHtml(row.revenueText || '--')}</div></div>`,
      `<div class="landing-detail__metric"><div class="landing-detail__metric-label">成本/套</div><div class="landing-detail__metric-value">${escapeHtml(row.costText || '--')}</div></div>`,
      `<div class="landing-detail__metric"><div class="landing-detail__metric-label">毛利额/套</div><div class="landing-detail__metric-value">${escapeHtml(row.profitText || '--')}</div></div>`,
      `<div class="landing-detail__metric"><div class="landing-detail__metric-label">毛利率</div><div class="landing-detail__metric-value">${escapeHtml(row.marginText || '--')}</div></div>`,
      '</div>',
      '<div class="landing-detail__support">',
      `<div class="landing-detail__metric"><div class="landing-detail__metric-label">材料</div><div class="landing-detail__metric-value">${escapeHtml(row.materialText || '--')}</div></div>`,
      `<div class="landing-detail__metric"><div class="landing-detail__metric-label">工时</div><div class="landing-detail__metric-value">${escapeHtml(row.laborText || '--')}</div></div>`,
      `<div class="landing-detail__metric"><div class="landing-detail__metric-label">包装</div><div class="landing-detail__metric-value">${escapeHtml(row.packagingText || '--')}</div></div>`,
      `<div class="landing-detail__metric"><div class="landing-detail__metric-label">设备 + 研发</div><div class="landing-detail__metric-value">${escapeHtml(row.equipmentText || '--')}</div></div>`,
      '</div>',
      `<p class="landing-detail__note"><strong>分摊依据：</strong>${escapeHtml(row.basisText || '未提供')}<br /><strong>当前角色建议：</strong>${escapeHtml(roleHint)}</p>`,
      `<p class="landing-detail__note"><strong>整页提示：</strong>${escapeHtml(textOf(($('harnessProfitNote') && $('harnessProfitNote').textContent) || '当前工作台只做角色视图和入口收拢，实际核算仍以下方原始区域为准。'))}</p>`,
      `<div class="landing-role-panel__actions">${renderRoleActions(vm.role)}</div>`,
    ].join('');
  }

  function render() {
    const mount = $('landingWorkbenchMount');
    if (!mount) return;
    const vm = buildViewModel();

    mount.innerHTML = [
      '<section class="card landing-workbench">',
      '<div class="landing-workbench__hero">',
      '<article class="landing-workbench__hero-panel">',
      '<div class="landing-workbench__eyebrow">Quote Workbench</div>',
      `<h2 class="landing-workbench__hero-title">报价工作台 · ${escapeHtml(vm.scenarioName)}</h2>`,
      '<div class="landing-workbench__hero-meta">',
      vm.tags.map(function (tag) {
        return `<span class="landing-workbench__hero-chip">${escapeHtml(tag)}</span>`;
      }).join(''),
      '</div>',
      '<p class="landing-workbench__hero-copy">本轮只在现有静态 dashboard 上增加工作台壳层：上方先按角色收拢信息和流程节点，下面把单线束号作为主导航，不改动原有利润区、BOM 工程台和各类管理入口。</p>',
      `<p class="landing-workbench__boundary"><strong>${escapeHtml(vm.role.label)}</strong> 视角：${escapeHtml(vm.role.focus)}<br />${escapeHtml(vm.role.boundary)}</p>`,
      '</article>',
      '<aside class="landing-workbench__summary-panel">',
      '<h3 class="landing-workbench__summary-title">工作台摘要</h3>',
      `<div class="landing-workbench__summary-grid">${renderHeroMetrics(vm)}</div>`,
      '</aside>',
      '</div>',
      '<section class="landing-workbench__role-panel">',
      '<h3 class="landing-workbench__section-title">角色边界</h3>',
      '<div class="landing-role-chip-row">',
      Object.keys(ROLE_PRESETS).map(function (key) {
        const role = ROLE_PRESETS[key];
        const activeClass = state.role === key ? ' is-active' : '';
        return `<button type="button" class="landing-role-chip${activeClass}" data-role="${escapeHtml(key)}">${escapeHtml(role.label)}</button>`;
      }).join(''),
      '</div>',
      '<div class="landing-role-panel__body">',
      `<article class="landing-role-panel__card"><div class="landing-role-panel__label">当前关注</div><p class="landing-role-panel__value">${escapeHtml(vm.role.focus)}</p></article>`,
      `<article class="landing-role-panel__card"><div class="landing-role-panel__label">本页边界</div><p class="landing-role-panel__value">${escapeHtml(vm.role.boundary)}</p></article>`,
      '</div>',
      '</section>',
      '<section class="landing-workbench__flow-panel">',
      '<h3 class="landing-workbench__section-title">流程概览</h3>',
      `<div class="landing-flow">${renderFlowNodes(vm)}</div>`,
      '</section>',
      '<div class="landing-workbench__grid">',
      '<aside class="landing-workbench__nav">',
      `<h3 class="landing-workbench__section-title">单线束列表</h3>`,
      `<div class="landing-workbench__summary-meta">按当前毛利率从低到高排序。低利润或负利润线束会优先浮到前面，便于先处理拖累项目利润的线束。</div>`,
      `<div class="landing-workbench__summary-grid">
        <div class="landing-workbench__summary-card">
          <div class="landing-workbench__summary-label">线束条目</div>
          <div class="landing-workbench__summary-value">${escapeHtml(String(vm.harnessRows.length))}</div>
          <div class="landing-workbench__summary-meta">当前已展开条目</div>
        </div>
        <div class="landing-workbench__summary-card">
          <div class="landing-workbench__summary-label">利润预警</div>
          <div class="landing-workbench__summary-value">${escapeHtml(String(vm.lowRiskCount))}</div>
          <div class="landing-workbench__summary-meta">含负利润 ${escapeHtml(String(vm.negativeCount))} 条</div>
        </div>
      </div>`,
      `<div class="landing-harness-list">${renderHarnessList(vm)}</div>`,
      '</aside>',
      '<section class="landing-workbench__detail">',
      '<h3 class="landing-workbench__section-title">线束详情</h3>',
      renderDetail(vm),
      '</section>',
      '</div>',
      '</section>',
    ].join('');

    syncTableSelection();
  }

  function syncTableSelection() {
    const body = $('harnessProfitTable');
    if (!body) return;
    Array.from(body.querySelectorAll('tr')).forEach(function (row) {
      const firstCell = row.querySelector('td');
      const harnessId = textOf(firstCell && firstCell.textContent);
      if (harnessId && harnessId === state.selectedHarnessId) {
        row.setAttribute('data-landing-selected', 'true');
      } else {
        row.removeAttribute('data-landing-selected');
      }
    });
  }

  function scheduleRefresh() {
    if (state.refreshToken) return;
    state.refreshToken = global.requestAnimationFrame(function () {
      state.refreshToken = 0;
      render();
    });
  }

  function handleAction(kind, selector) {
    const target = selector ? doc.querySelector(selector) : null;
    if (!target) return;
    if (kind === 'click' && typeof target.click === 'function') {
      target.click();
      return;
    }
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function bindMountEvents() {
    const mount = $('landingWorkbenchMount');
    if (!mount || state.mountBound) return;
    mount.addEventListener('click', function (event) {
      const roleButton = event.target.closest('[data-role]');
      if (roleButton) {
        state.role = roleButton.getAttribute('data-role') || state.role;
        scheduleRefresh();
        return;
      }
      const harnessButton = event.target.closest('[data-harness-id]');
      if (harnessButton) {
        state.selectedHarnessId = harnessButton.getAttribute('data-harness-id') || '';
        scheduleRefresh();
        return;
      }
      const actionButton = event.target.closest('[data-action-kind]');
      if (actionButton) {
        handleAction(actionButton.getAttribute('data-action-kind'), actionButton.getAttribute('data-action-target'));
      }
    });
    state.mountBound = true;
  }

  function bindTableEvents() {
    const body = $('harnessProfitTable');
    if (!body || state.tableBound) return;
    body.addEventListener('click', function (event) {
      const row = event.target.closest('tr');
      if (!row) return;
      const firstCell = row.querySelector('td');
      const harnessId = textOf(firstCell && firstCell.textContent);
      if (!harnessId) return;
      state.selectedHarnessId = harnessId;
      scheduleRefresh();
    });
    state.tableBound = true;
  }

  function watchTargets() {
    if (state.observers.length || typeof MutationObserver === 'undefined') return;
    const targets = [
      $('kpiGrid'),
      $('harnessProfitSummary'),
      $('harnessProfitNote'),
      $('harnessProfitTable'),
      $('scenarioTags'),
      $('timelineScenarioTagsWrap'),
      $('historyTable'),
      $('connectorPriceTable'),
    ].filter(Boolean);
    targets.forEach(function (target) {
      const observer = new MutationObserver(function () {
        scheduleRefresh();
      });
      observer.observe(target, {
        childList: true,
        subtree: true,
        characterData: true,
      });
      state.observers.push(observer);
    });
  }

  function init() {
    if (state.mounted) return;
    if (!$('landingWorkbenchMount')) return;
    bindMountEvents();
    bindTableEvents();
    watchTargets();
    state.mounted = true;
    scheduleRefresh();
  }

  if (doc.readyState === 'loading') {
    doc.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }

  global.G281LandingWorkbench = {
    refresh: scheduleRefresh,
    selectHarness: function (harnessId) {
      state.selectedHarnessId = textOf(harnessId);
      scheduleRefresh();
    },
    setRole: function (roleKey) {
      if (!ROLE_PRESETS[roleKey]) return false;
      state.role = roleKey;
      scheduleRefresh();
      return true;
    },
  };
})(window);
