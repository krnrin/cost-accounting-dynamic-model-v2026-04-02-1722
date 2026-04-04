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
    scenarioBound: false,
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

  function formatLocaleNumber(value, digits) {
    if (!Number.isFinite(value)) return '--';
    return Number(value).toLocaleString('zh-CN', {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    });
  }

  function formatMoneyValue(value) {
    return Number.isFinite(value) ? `${formatLocaleNumber(value, 2)} 元` : '--';
  }

  function formatPercentValue(value) {
    return Number.isFinite(value) ? `${(value * 100).toFixed(2)}%` : '--';
  }

  function getDashboardBridge() {
    return global.G281DashboardBridge || null;
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

  function uniqueTexts(values) {
    return values.filter(function (item, index, array) {
      return item && array.indexOf(item) === index;
    });
  }

  function readScenarioTagsFromModel(model) {
    if (!model) return [];
    const tags = [
      model.bom && model.bom.label ? `BOM ${model.bom.label}` : '',
      model.metal && model.metal.label ? `铜铝 ${model.metal.label}` : '',
      model.conn && model.conn.label ? `连接器 ${model.conn.label}` : '',
      model.labor && model.labor.label ? `工时 ${model.labor.label}` : '',
      model.equip && model.equip.label ? `资源投入 ${model.equip.label}` : '',
      model.pack && model.pack.label ? `包装 ${model.pack.label}` : '',
      model.annualDrop && model.annualDrop.label ? `年降 ${model.annualDrop.label}` : '',
      model.oneTimeCustomer && model.oneTimeCustomer.label ? `一次性费用 ${model.oneTimeCustomer.label}` : '',
      model.rebate && model.rebate.label ? `返点 ${model.rebate.label}` : '',
      model.vave && model.vave.label ? `VAVE ${model.vave.label}` : '',
    ].filter(Boolean);
    if (numberOr(model.connectorSummary && model.connectorSummary.overrideCount, 0) > 0) {
      tags.splice(3, 0, `连接器覆盖 ${model.connectorSummary.overrideCount} 项`);
    }
    return uniqueTexts(tags).slice(0, 9);
  }

  function buildKpiCardsFromModel(model) {
    if (!model) return [];
    const totalVolume = numberOr(model.totalVolume, 0);
    return [
      {
        title: '生命周期收入',
        value: formatMoneyValue(numberOr(model.totalRevenue, NaN)),
        meta: totalVolume > 0 ? `按 ${formatLocaleNumber(totalVolume, 0)} 套计算` : '',
      },
      {
        title: '生命周期成本',
        value: formatMoneyValue(numberOr(model.totalCost, NaN)),
        meta: `单套成本 ${formatMoneyValue(numberOr(model.operating, NaN))}`,
      },
      {
        title: '生命周期利润',
        value: formatMoneyValue(numberOr(model.totalProfit, NaN)),
        meta: `单套利润 ${formatMoneyValue(numberOr(model.avgProfit, NaN))}`,
      },
      {
        title: '毛利率',
        value: formatPercentValue(numberOr(model.margin, NaN)),
        meta: `混合售价系数 ${formatLocaleNumber(numberOr(model.mixPrice, 0), 4)}x`,
      },
      {
        title: '静态回收期',
        value: Number.isFinite(numberOr(model.paybackYears, NaN))
          ? `${numberOr(model.paybackYears, 0).toFixed(2)} 年`
          : '∞',
        meta: `资本投入 ${formatMoneyValue(numberOr(model.capitalTotal, NaN))}`,
      },
    ];
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

  function buildHarnessBasisText(row, fallbackLabel) {
    if (textOf(row && row.basis)) return row.basis;
    const selectedItemCount = numberOr(row && row.counts && row.counts.selectedItemCount, NaN);
    const wireLineCount = numberOr(row && row.counts && row.counts.wireLineCount, NaN);
    if (Number.isFinite(selectedItemCount) || Number.isFinite(wireLineCount)) {
      return `${formatLocaleNumber(selectedItemCount || 0, 0)} 件 / 导线项 ${formatLocaleNumber(wireLineCount || 0, 0)} 个`;
    }
    const matchedWireCount = numberOr(row && row.matchedWireCount, NaN);
    const unmatchedWireCount = numberOr(row && row.unmatchedWireCount, NaN);
    if (Number.isFinite(matchedWireCount) || Number.isFinite(unmatchedWireCount)) {
      return `${fallbackLabel || '当前'} / 导线命中 ${formatLocaleNumber(matchedWireCount || 0, 0)} 项 / 未命中 ${formatLocaleNumber(unmatchedWireCount || 0, 0)} 项`;
    }
    const revenueShare = numberOr(row && row.revenueShare, NaN);
    if (Number.isFinite(revenueShare)) {
      return `收入占比 ${(revenueShare * 100).toFixed(1)}%`;
    }
    return '--';
  }

  function normalizeHarnessRows(rows) {
    return rows.slice().sort(function (left, right) {
      const leftMargin = Number.isFinite(left.margin) ? left.margin : Number.POSITIVE_INFINITY;
      const rightMargin = Number.isFinite(right.margin) ? right.margin : Number.POSITIVE_INFINITY;
      if (leftMargin !== rightMargin) return leftMargin - rightMargin;
      return (left.profit || 0) - (right.profit || 0);
    }).map(function (row, index) {
      return Object.assign({}, row, { index: index + 1 });
    });
  }

  function mapBreakdownHarnessRows(runtime, model, bridge) {
    if (!runtime || !model || !global.G281HarnessProfit || typeof global.G281HarnessProfit.buildHarnessProfitBreakdown !== 'function') {
      return [];
    }
    let breakdown = null;
    try {
      breakdown = global.G281HarnessProfit.buildHarnessProfitBreakdown(runtime, model);
    } catch (error) {
      console.warn('[G281LandingWorkbench] Failed to read harness breakdown', error);
      return [];
    }
    if (!Array.isArray(breakdown && breakdown.harnesses) || !breakdown.harnesses.length) {
      return [];
    }
    const versionLabels = bridge && bridge.getVersionLabels ? bridge.getVersionLabels() : {};
    const workbookVersionKey = textOf(bridge && bridge.getWorkbookVersionKey && bridge.getWorkbookVersionKey()) || 'quote';
    const workbookLabel = textOf(versionLabels && versionLabels[workbookVersionKey]) || workbookVersionKey || '当前';
    return normalizeHarnessRows(breakdown.harnesses.map(function (row) {
      const revenue = numberOr(row.unitRevenueEstimated, numberOr(row.revenue, NaN));
      const cost = numberOr(row.unitCostEstimated, numberOr(row.totalCost, NaN));
      const profit = numberOr(row.unitProfitEstimated, numberOr(row.profit, NaN));
      const margin = numberOr(row.marginEstimated, numberOr(row.profitMargin, NaN));
      const material = numberOr(row.unitMaterialCost, numberOr(row.materialCost, numberOr(row.harnessMaterialCost, NaN)));
      const labor = numberOr(
        numberOr(row.unitDirectLaborCost, 0) + numberOr(row.unitManufacturingCost, 0),
        numberOr(row.overheadItems && row.overheadItems.labor, NaN)
      );
      const packaging = numberOr(row.unitPackagingCost, numberOr(row.overheadItems && row.overheadItems.packaging, NaN));
      const equipment = numberOr(
        numberOr(row.unitEquipmentCost, 0) + numberOr(row.unitRndCost, 0),
        numberOr(row.overheadItems && row.overheadItems.equipment, 0) + numberOr(row.overheadItems && row.overheadItems.rd, 0)
      );
      return {
        harnessId: textOf(row.harnessId),
        harnessName: textOf(row.harnessName || row.harnessId),
        revenueText: formatMoneyValue(revenue),
        costText: formatMoneyValue(cost),
        profitText: formatMoneyValue(profit),
        marginText: formatPercentValue(margin),
        materialText: formatMoneyValue(material),
        laborText: formatMoneyValue(labor),
        packagingText: formatMoneyValue(packaging),
        equipmentText: formatMoneyValue(equipment),
        basisText: buildHarnessBasisText(row, workbookLabel),
        revenue: revenue,
        cost: cost,
        profit: profit,
        margin: margin,
        tone: inferTone({ margin: margin }),
      };
    }).filter(function (row) {
      return row.harnessId;
    }));
  }

  function mapValidationHarnessRows(runtime, model, bridge) {
    const validation = runtime && runtime.bomValidation;
    const harnessOrder = Array.isArray(validation && validation.harnessOrder) ? validation.harnessOrder : [];
    if (!model || !harnessOrder.length) return [];
    const comparisons = validation && validation.comparisons ? validation.comparisons : {};
    const workbookVersionKey = textOf(bridge && bridge.getWorkbookVersionKey && bridge.getWorkbookVersionKey()) || 'quote';
    const versionLabels = bridge && bridge.getVersionLabels ? bridge.getVersionLabels() : {};
    const versionLabel = textOf(versionLabels && versionLabels[workbookVersionKey]) || workbookVersionKey || '当前';
    const annualRows = Array.isArray(model.annual) ? model.annual : [];
    const avgAsp = annualRows.length
      ? annualRows.reduce(function (sum, row) { return sum + numberOr(row && row.asp, 0); }, 0) / annualRows.length
      : 0;
    const totalLabor = numberOr(model.directLabor, 0) + numberOr(model.manufacturing, 0);
    const capitalAndRnd = numberOr(model.equipment, 0) + numberOr(model.rnd, 0);
    const baseRows = harnessOrder.map(function (harnessId) {
      const comparison = comparisons[harnessId] || {};
      const summary = comparison.summary || {};
      const itemCounts = summary.itemCounts || {};
      const weight = numberOr(itemCounts[workbookVersionKey], 0)
        || numberOr(itemCounts.fixed, 0)
        || numberOr(itemCounts.quote, 0)
        || numberOr(itemCounts.tt, 0);
      return {
        harnessId: harnessId,
        harnessName: comparison.harnessName || harnessId,
        weight: weight,
      };
    });
    const weightedRows = baseRows.filter(function (row) { return row.weight > 0; });
    const totalWeight = weightedRows.reduce(function (sum, row) { return sum + row.weight; }, 0);
    const fallbackShare = baseRows.length ? 1 / baseRows.length : 0;
    return normalizeHarnessRows(baseRows.map(function (row) {
      const share = totalWeight > 0 && row.weight > 0 ? row.weight / totalWeight : fallbackShare;
      const revenue = avgAsp * share;
      const material = numberOr(model.material, 0) * share;
      const labor = totalLabor * share;
      const packaging = numberOr(model.packaging, 0) * share;
      const capital = capitalAndRnd * share;
      const cost = material + labor + packaging + capital;
      const profit = revenue - cost;
      const margin = revenue > 0 ? profit / revenue : 0;
      return {
        harnessId: textOf(row.harnessId),
        harnessName: textOf(row.harnessName),
        revenueText: formatMoneyValue(revenue),
        costText: formatMoneyValue(cost),
        profitText: formatMoneyValue(profit),
        marginText: formatPercentValue(margin),
        materialText: formatMoneyValue(material),
        laborText: formatMoneyValue(labor),
        packagingText: formatMoneyValue(packaging),
        equipmentText: formatMoneyValue(capital),
        basisText: totalWeight > 0 && row.weight > 0
          ? `${versionLabel} BOM件数 ${formatLocaleNumber(row.weight, 0)}/${formatLocaleNumber(totalWeight, 0)}`
          : '平均分摊',
        revenue: revenue,
        cost: cost,
        profit: profit,
        margin: margin,
        tone: inferTone({ margin: margin }),
      };
    }).filter(function (row) {
      return row.harnessId;
    }));
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

  function collectHarnessRows(model, bridge) {
    const runtime = bridge && bridge.getRuntimeSnapshot ? bridge.getRuntimeSnapshot() : null;
    const breakdownRows = mapBreakdownHarnessRows(runtime, model, bridge);
    if (breakdownRows.length) return breakdownRows;
    const validationRows = mapValidationHarnessRows(runtime, model, bridge);
    if (validationRows.length) return validationRows;
    return collectHarnessRowsFromTable();
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

  function getHarnessIds() {
    return collectHarnessRows(global._g281LastModel || null, getDashboardBridge()).map(function (row) {
      return row.harnessId;
    }).filter(Boolean);
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
    const bridge = getDashboardBridge();
    const draft = (bridge && bridge.getDraftSnapshot && bridge.getDraftSnapshot()) || (model && model.d) || null;
    const harnessRows = collectHarnessRows(model, bridge);
    const selectedHarness = resolveSelectedHarness(harnessRows);
    const kpiCards = buildKpiCardsFromModel(model);
    const scenarioName = textOf((draft && draft.scenarioName) || (model && model.d && model.d.scenarioName) || ($('scenarioName') && $('scenarioName').value)) || '当前场景';
    const tags = readScenarioTagsFromModel(model).length
      ? readScenarioTagsFromModel(model)
      : uniqueTexts(collectChipTexts('#scenarioTags .chip').concat(collectChipTexts('#timelineScenarioTagsWrap .chip'))).slice(0, 9);
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
    const directHours = numberOr(draft && draft.directHours, numberOr(model && model.d && model.d.directHours, 0));
    const manufacturingHours = numberOr(draft && draft.manufacturingHours, numberOr(model && model.d && model.d.manufacturingHours, 0));
    const packagingTotal =
      numberOr(draft && draft.packInner, numberOr(model && model.d && model.d.packInner, 0)) +
      numberOr(draft && draft.packFreight, numberOr(model && model.d && model.d.packFreight, 0)) +
      numberOr(draft && draft.packWarehouse, numberOr(model && model.d && model.d.packWarehouse, 0)) +
      numberOr(draft && draft.packOther, numberOr(model && model.d && model.d.packOther, 0));
    const connectorCount = (
      numberOr(model && model.connectorSummary && model.connectorSummary.followCount, 0)
      + numberOr(model && model.connectorSummary && model.connectorSummary.overrideCount, 0)
    ) || countTableRows('connectorPriceTable');
    const savedScenarios = bridge && bridge.listSavedScenarios ? bridge.listSavedScenarios() : null;
    const historyCount = Array.isArray(savedScenarios) ? savedScenarios.length : countTableRows('historyTable');

    return {
      model: model,
      role: ROLE_PRESETS[state.role] || ROLE_PRESETS.harness,
      scenarioName: scenarioName,
      tags: tags,
      harnessRows: harnessRows,
      selectedHarness: selectedHarness,
      kpiCards: (kpiCards.length ? kpiCards : readKpiCards()).slice(0, 4),
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
    watchTargets();
    if (state.refreshToken) return;
    state.refreshToken = global.requestAnimationFrame(function () {
      state.refreshToken = 0;
      render();
    });
  }

  function disconnectObservers() {
    state.observers.forEach(function (observer) {
      observer.disconnect();
    });
    state.observers = [];
  }

  function shouldUseMutationFallback() {
    const bridge = getDashboardBridge();
    return !bridge
      || typeof bridge.getStateSnapshot !== 'function'
      || typeof bridge.getDraftSnapshot !== 'function'
      || typeof bridge.getRuntimeSnapshot !== 'function';
  }

  function tryBridgeAction(selector) {
    const bridge = getDashboardBridge();
    if (!bridge) return false;
    try {
      if (selector === '#workspaceTabProfit' && typeof bridge.setWorkspacePage === 'function') {
        bridge.setWorkspacePage('profit');
        return true;
      }
      if (selector === '#workspaceTabData' && typeof bridge.setWorkspacePage === 'function') {
        bridge.setWorkspacePage('data');
        return true;
      }
      if (selector === '#openVersionTimelineBtn' && typeof bridge.openVersionTimeline === 'function') {
        return bridge.openVersionTimeline() !== false;
      }
      if (selector === '#openBomValidationBtn' && typeof bridge.openBomValidation === 'function') {
        return bridge.openBomValidation() !== false;
      }
      if (selector === '#openPackagingValidationBtn' && typeof bridge.openPackagingValidation === 'function') {
        return bridge.openPackagingValidation() !== false;
      }
      if (selector === '#openCapitalValidationBtn' && typeof bridge.openCapitalValidation === 'function') {
        return bridge.openCapitalValidation() !== false;
      }
      if (selector === '#openLaborValidationBtn' && typeof bridge.openLaborValidation === 'function') {
        return bridge.openLaborValidation() !== false;
      }
    } catch (error) {
      console.warn('[G281LandingWorkbench] Failed to run bridge action', selector, error);
      return false;
    }
    return false;
  }

  function handleAction(kind, selector) {
    if (kind === 'click' && tryBridgeAction(selector)) {
      return;
    }
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

  function bindScenarioEvents() {
    const input = $('scenarioName');
    if (!input || state.scenarioBound) return;
    input.addEventListener('change', function () {
      scheduleRefresh();
    });
    state.scenarioBound = true;
  }

  function watchTargets() {
    if (typeof MutationObserver === 'undefined') return;
    if (!shouldUseMutationFallback()) {
      disconnectObservers();
      return;
    }
    if (state.observers.length) return;
    const targets = [
      $('kpiGrid'),
      $('harnessProfitSummary'),
      $('harnessProfitNote'),
      $('harnessProfitTable'),
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
    bindScenarioEvents();
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
    getStateSnapshot: function () {
      const vm = buildViewModel();
      return {
        roleKey: state.role,
        roleLabel: textOf(vm.role && vm.role.label),
        selectedHarnessId: state.selectedHarnessId,
        harnessCount: vm.harnessRows.length,
        harnessIds: vm.harnessRows.map(function (row) { return row.harnessId; }),
        selectedHarness: vm.selectedHarness ? {
          harnessId: vm.selectedHarness.harnessId,
          harnessName: vm.selectedHarness.harnessName,
          profitText: vm.selectedHarness.profitText,
          marginText: vm.selectedHarness.marginText,
          tone: vm.selectedHarness.tone,
        } : null,
      };
    },
    listHarnessIds: function () {
      return getHarnessIds();
    },
    selectHarness: function (harnessId) {
      const nextHarnessId = textOf(harnessId);
      const harnessIds = getHarnessIds();
      if (!nextHarnessId || !harnessIds.includes(nextHarnessId)) {
        return false;
      }
      state.selectedHarnessId = nextHarnessId;
      scheduleRefresh();
      return true;
    },
    setRole: function (roleKey) {
      if (!ROLE_PRESETS[roleKey]) return false;
      state.role = roleKey;
      scheduleRefresh();
      return true;
    },
  };
})(window);
