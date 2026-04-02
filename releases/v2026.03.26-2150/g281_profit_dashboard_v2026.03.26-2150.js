const RUNTIME = window.G281_RUNTIME || {};
if (!RUNTIME.master || !window.G281Engine || !window.G281Repo) {
  throw new Error('G281 runtime bundle not loaded');
}
const BASE = RUNTIME.master;
const BOM_CHANGE_ROWS = RUNTIME.bomChanges || [];
const BOM_VERSIONS = RUNTIME.bomVersions || {};
const PROTOCOL_STATUS = RUNTIME.connectorProtocolStatus || {};
const LABOR_VALIDATION = RUNTIME.laborValidation || {};
const PACKAGING_VALIDATION = RUNTIME.packagingValidation || {};
const CAPITAL_VALIDATION = RUNTIME.capitalValidation || {};
const WIRE_CATALOG = RUNTIME.wireCatalog || {};
const HISTORY_SEED = Array.isArray(RUNTIME.historySeed) ? RUNTIME.historySeed : [];
const repo = window.G281Repo.init(RUNTIME);
let lastSavedVersionId = '';
const DEFAULT_STATE = { bom: 'freeze', metal: 'quote', connector: 'batch', labor: 'base', equipment: 'base', packaging: 'base', sales: 'quote', mix: 'quote', vave: 'none' };

const state = { scenarioName: BASE.name, ...DEFAULT_STATE };
let connectorPricingState = {};
const $ = (id) => document.getElementById(id);
const el = {
  scenarioName: $('scenarioName'),
  generateBtn: $('generateBtn'),
  resetBtn: $('resetBtn'),
  printBtn: $('printBtn'),
  saveVersionBtn: $('saveVersionBtn'),
  submitApprovalBtn: $('submitApprovalBtn'),
  exportLayerBtn: $('exportLayerBtn'),
  profitActionBar: $('profitActionBar'),
  kpiGrid: $('kpiGrid'),
  profitDriverGrid: $('profitDriverGrid'),
  costBridge: $('costBridge'),
  annualChart: $('annualChart'),
  compareTable: document.querySelector('#compareTable tbody'),
  annualTable: document.querySelector('#annualTable tbody'),
  eventTable: document.querySelector('#eventTable tbody'),
  capitalLedger: $('capitalLedger'),
  activeSummary: $('activeSummary'),
  scenarioTags: $('scenarioTags'),
  configBars: $('configBars'),
  typeBars: $('typeBars'),
  wireModelSummary: $('wireModelSummary'),
  wireCalcNote: $('wireCalcNote'),
  wireModelTable: $('wireModelTable'),
  wireCalc: $('wireCalc'),
  tapeCalc: $('tapeCalc'),
  bomStats: $('bomStats'),
  bomResourceGrid: $('bomResourceGrid'),
  bomChangeTable: document.querySelector('#bomChangeTable tbody'),
  connectorProtocolStats: $('connectorProtocolStats'),
  connectorProtocolHint: $('connectorProtocolHint'),
  connectorExecutionStats: $('connectorExecutionStats'),
  connectorPriceTable: document.querySelector('#connectorPriceTable tbody'),
  initConnectorProtocolBtn: $('initConnectorProtocolBtn'),
  clearConnectorOverridesBtn: $('clearConnectorOverridesBtn'),
  historyTable: document.querySelector('#historyTable tbody'),
  approvalTable: document.querySelector('#approvalTable tbody'),
  layerDataCount: $('layerDataCount'),
  layerDataMeta: $('layerDataMeta'),
  layerEngineMeta: $('layerEngineMeta'),
  layerHistoryCount: $('layerHistoryCount'),
  layerHistoryMeta: $('layerHistoryMeta'),
  layerApprovalCount: $('layerApprovalCount'),
  layerApprovalMeta: $('layerApprovalMeta'),
  sheets: $('sheetCount'),
  faults: $('faultCount'),
  priceTypes: $('priceTypeCount'),
};
const controls = {
  copperPrice: $('copperPrice'),
  aluminumPrice: $('aluminumPrice'),
  directHours: $('directHours'),
  directRate: $('directRate'),
  manufacturingHours: $('manufacturingHours'),
  manufacturingRate: $('manufacturingRate'),
  packInner: $('packInner'),
  packFreight: $('packFreight'),
  packWarehouse: $('packWarehouse'),
  packOther: $('packOther'),
  bomWireDrawing: $('bomWireDrawing'),
  bomWireEat: $('bomWireEat'),
  bomWireHidden: $('bomWireHidden'),
  bomTapeDiameter: $('bomTapeDiameter'),
  bomTapeWidth: $('bomTapeWidth'),
  bomTapeOverlap: $('bomTapeOverlap'),
};
const yearInputs = BASE.years.map((year) => $(`vol${year}`));
const mixInputs = ['mix0', 'mix1', 'mix2', 'mix3'].map($);
const WIRE_MODELS = Array.isArray(WIRE_CATALOG.models) ? WIRE_CATALOG.models : [];

const fmtMoney = (v, d = 2) => Number(v || 0).toLocaleString('zh-CN', { minimumFractionDigits: d, maximumFractionDigits: d });
const fmtNumber = (v, d = 2) => Number(v || 0).toLocaleString('zh-CN', { minimumFractionDigits: d, maximumFractionDigits: d });
const fmtMaybeMoney = (v, d = 2) => {
  if (v === '' || v === null || v === undefined) return '-';
  const n = Number(v);
  return Number.isFinite(n) ? fmtMoney(n, d) : '-';
};
const fmtMaybeNumber = (v, d = 2) => {
  if (v === '' || v === null || v === undefined) return '-';
  const n = Number(v);
  return Number.isFinite(n) ? fmtNumber(n, d) : '-';
};
const fmtMetric = (v, d = 2) => {
  const n = Number(v);
  return Number.isFinite(n) && Math.abs(n) > 0.000001 ? fmtNumber(n, d) : '-';
};
const fmtInt = (v) => Math.round(Number(v || 0)).toLocaleString('zh-CN');
const fmtPct = (v, d = 2) => `${(Number(v || 0) * 100).toFixed(d)}%`;
const fmtSigned = (v, d = 2) => `${Number(v || 0) >= 0 ? '+' : ''}${Math.abs(Number(v || 0)).toFixed(d)}`;
const fmtSignedMoney = (v) => `${Number(v || 0) >= 0 ? '+' : ''}${fmtMoney(Math.abs(Number(v || 0)))}`;
const fmtMaybeInt = (v) => { const n = Number(v); return Number.isNaN(n) ? '—' : Number.isFinite(n) ? fmtInt(n) : '∞'; };
const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
const normalizeMix = (vals) => window.G281Engine.normalizeMix(vals);
const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}[char]));
const connectorItems = Array.isArray(BASE.connectorPortfolio?.items) ? BASE.connectorPortfolio.items : [];
const connectorStageMetaMap = {
  ...BASE.versions.connector,
  progress: {
    label: '进度价',
    note: '已达成部分按协议价执行，未达成部分按样品价执行。',
  },
};
const connectorVersionKeys = Object.keys(BASE.versions.connector || {});
const connectorSelectableStageKeys = [...connectorVersionKeys, 'progress'];
const connectorVersionSet = new Set(connectorSelectableStageKeys);
const connectorItemIdSet = new Set(connectorItems.map((item) => item.id));
const protocolPortfolios = Array.isArray(PROTOCOL_STATUS.portfolios) ? PROTOCOL_STATUS.portfolios : [];
const protocolRows = Array.isArray(PROTOCOL_STATUS.rows) ? PROTOCOL_STATUS.rows : [];
const protocolPortfolioMap = new Map(protocolPortfolios.map((item) => [item.portfolioId, item]));
const protocolRowsByPortfolio = protocolRows.reduce((acc, row) => {
  if (!row || !row.portfolioId) return acc;
  if (!acc[row.portfolioId]) acc[row.portfolioId] = [];
  acc[row.portfolioId].push(row);
  return acc;
}, {});
const protocolStatusConfig = {
  confirmed: { label: '已达成', className: 'confirmed' },
  quoted_pending: { label: '待确认', className: 'quoted' },
  no_reply: { label: '暂无回复', className: 'blank' },
  dev_pending: { label: '开发中', className: 'dev' },
};
const VERSION_DISPLAY_ORDER = {
  bom: ['regress', 'light', 'freeze'],
  labor: ['ramp', 'optimize', 'base'],
  equipment: ['dedicated', 'shared', 'base'],
  packaging: ['longhaul', 'optimize', 'base'],
  sales: ['tt', 'fixed', 'quote'],
  mix: ['tt', 'fixed', 'quote'],
  metal: ['tt', 'fixed', 'quote'],
};

function versionOptionLabel(group, key) {
  return BASE.versions?.[group]?.[key]?.label || key || '';
}

function orderedVersionEntries(group, options) {
  const entries = Object.entries(options || {});
  const preferredOrder = VERSION_DISPLAY_ORDER[group];
  if (!preferredOrder || !preferredOrder.length) {
    return entries;
  }
  const rankMap = new Map(preferredOrder.map((key, index) => [key, index]));
  return entries.sort(([leftKey], [rightKey]) => {
    const leftRank = rankMap.has(leftKey) ? rankMap.get(leftKey) : -1;
    const rightRank = rankMap.has(rightKey) ? rankMap.get(rightKey) : -1;
    if (leftRank === rightRank) return 0;
    if (leftRank === -1) return -1;
    if (rightRank === -1) return 1;
    return leftRank - rightRank;
  });
}

function metalVersionSnapshot(versionKey) {
  const version = BASE.versions.metal?.[versionKey];
  if (!version) return null;
  return {
    key: versionKey,
    label: version.label || versionOptionLabel('metal', versionKey),
    copperPrice: Number(version.copperPrice ?? BASE.copperPrice) || 0,
    aluminumPrice: Number(version.aluminumPrice ?? BASE.aluminumPrice) || 0,
    sourceNote: version.sourceNote || '来源：g281_data_master.json 铜铝基价预设。',
  };
}

function applyMetalVersion(versionKey) {
  const snapshot = metalVersionSnapshot(versionKey);
  if (!snapshot) return;
  controls.copperPrice.value = snapshot.copperPrice;
  controls.aluminumPrice.value = snapshot.aluminumPrice;
}

function metalVersionSummary(versionKey) {
  const snapshot = metalVersionSnapshot(versionKey);
  if (!snapshot) return '';
  return `铜 ${fmtMoney(snapshot.copperPrice, 0)} 元/吨 / 铝 ${fmtMoney(snapshot.aluminumPrice, 0)} 元/吨`;
}

function metalVersionSourceText(versionKey) {
  const snapshot = metalVersionSnapshot(versionKey);
  if (!snapshot) return '';
  return `${snapshot.sourceNote} ${metalVersionSummary(versionKey)}。`;
}

function inferMetalVersion(copperPrice, aluminumPrice) {
  const targetCopper = Number(copperPrice);
  const targetAluminum = Number(aluminumPrice);
  const options = BASE.versions.metal || {};
  return Object.keys(options).find((key) => {
    const version = options[key] || {};
    return Number(version.copperPrice) === targetCopper && Number(version.aluminumPrice) === targetAluminum;
  }) || DEFAULT_STATE.metal;
}

function recordMetalVersionKey(record) {
  return record?.state?.metal || inferMetalVersion(record?.draft?.copperPrice, record?.draft?.aluminumPrice);
}

function salesVersionVolumes(versionKey) {
  const version = BASE.versions.sales?.[versionKey];
  return Array.isArray(version?.volumes) && version.volumes.length ? version.volumes : BASE.volumes.slice();
}

function applySalesVersion(versionKey) {
  const volumes = salesVersionVolumes(versionKey);
  yearInputs.forEach((input, index) => {
    input.value = volumes[index] ?? BASE.volumes[index] ?? 0;
  });
}

function salesVersionStats(versionKey) {
  const volumes = salesVersionVolumes(versionKey);
  return {
    total: volumes.reduce((sum, value) => sum + Math.max(0, Number(value) || 0), 0),
    firstYear: Math.max(0, Number(volumes[0]) || 0),
  };
}

function inferSalesVersion(volumes) {
  const target = Array.isArray(volumes) ? volumes.map((value) => Math.max(0, Number(value) || 0)) : [];
  const options = BASE.versions.sales || {};
  return Object.keys(options).find((key) => {
    const preset = salesVersionVolumes(key);
    return preset.length === target.length && preset.every((value, index) => Number(value || 0) === Number(target[index] || 0));
  }) || DEFAULT_STATE.sales;
}

function mixVersionValues(versionKey) {
  const version = BASE.versions.mix?.[versionKey];
  return Array.isArray(version?.values) && version.values.length ? normalizeMix(version.values) : BASE.baselineMix.slice();
}

function applyMixVersion(versionKey) {
  const values = mixVersionValues(versionKey);
  mixInputs.forEach((input, index) => {
    input.value = values[index] ?? BASE.baselineMix[index] ?? 0;
  });
}

function mixVersionSummary(versionKey) {
  const values = mixVersionValues(versionKey);
  return values.map((value, index) => `${BASE.configNames[index]} ${Number(value || 0).toFixed(0)}%`).join(' / ');
}

function inferMixVersion(values) {
  const target = Array.isArray(values) ? normalizeMix(values) : [];
  const options = BASE.versions.mix || {};
  return Object.keys(options).find((key) => {
    const preset = mixVersionValues(key);
    return preset.length === target.length && preset.every((value, index) => Number(value || 0) === Number(target[index] || 0));
  }) || DEFAULT_STATE.mix;
}

function seededVersionRecord(group, versionKey) {
  return HISTORY_SEED.find((record) => record?.state?.[group] === versionKey) || null;
}

function bomVersionSnapshot(versionKey) {
  const keyMap = {
    freeze: 'quote',
    light: 'fixed',
    regress: 'tt',
  };
  const snapshotKey = keyMap[versionKey];
  const snapshot = snapshotKey ? BOM_VERSIONS.versionSnapshots?.[snapshotKey] || null : null;
  const option = BASE.versions?.bom?.[versionKey] || {};
  return {
    kind: snapshot?.kind || snapshotKey || versionKey || '',
    label: snapshot?.label || `${versionOptionLabel('bom', versionKey)}BOM`,
    materialFactor: Number.isFinite(Number(snapshot?.materialFactor)) ? Number(snapshot.materialFactor) : (Number(option.factor) || 1),
    wireFactor: Number.isFinite(Number(snapshot?.wireFactor)) ? Number(snapshot.wireFactor) : 1,
    draft: snapshot?.draft || null,
    workbook: snapshot?.workbook || '',
    totalMeter: Number(snapshot?.totalMeter) || 0,
    wireMeter: Number(snapshot?.wireMeter) || 0,
    tapeMeter: Number(snapshot?.tapeMeter) || 0,
    tubeMeter: Number(snapshot?.tubeMeter) || 0,
    actualLengthChangeSummary: snapshot?.actualLengthChangeSummary || null,
  };
}

function applyBomVersion(versionKey) {
  const snapshot = bomVersionSnapshot(versionKey);
  const draft = snapshot?.draft;
  if (!draft) return;
  if (draft.bomWireDrawing !== null && draft.bomWireDrawing !== undefined) controls.bomWireDrawing.value = draft.bomWireDrawing;
  if (draft.bomWireEat !== null && draft.bomWireEat !== undefined) controls.bomWireEat.value = draft.bomWireEat;
  if (draft.bomWireHidden !== null && draft.bomWireHidden !== undefined) controls.bomWireHidden.value = draft.bomWireHidden;
  if (draft.bomTapeDiameter !== null && draft.bomTapeDiameter !== undefined) controls.bomTapeDiameter.value = draft.bomTapeDiameter;
  if (draft.bomTapeWidth !== null && draft.bomTapeWidth !== undefined) controls.bomTapeWidth.value = draft.bomTapeWidth;
  if (draft.bomTapeOverlap !== null && draft.bomTapeOverlap !== undefined) controls.bomTapeOverlap.value = draft.bomTapeOverlap;
}

function bomVersionSourceText(versionKey) {
  const snapshot = bomVersionSnapshot(versionKey);
  if (!snapshot) return '';
  const summary = `导线 ${snapshot.wireMeter.toFixed(3)} m / 胶带 ${snapshot.tapeMeter.toFixed(3)} m / 套管 ${snapshot.tubeMeter.toFixed(3)} m / 材料系数 ${((snapshot.materialFactor - 1) * 100).toFixed(1)}%`;
  if (versionKey === 'regress' && snapshot.actualLengthChangeSummary) {
    const change = snapshot.actualLengthChangeSummary;
    return `来源：${snapshot.workbook || 'TT BOM'}《二次物料明细》+ 各线束页实际开线长度回填，${summary}，已回填 ${change.changedHarnessCount} 条线束 / ${change.changedRowCount} 处长度行。`;
  }
  return `来源：${snapshot.workbook || 'BOM 工作簿'}《二次物料明细》，${summary}。`;
}

function laborVersionSnapshot(versionKey) {
  if (versionKey === 'base') return LABOR_VALIDATION.versionSnapshots?.quote || null;
  if (versionKey === 'optimize') return LABOR_VALIDATION.versionSnapshots?.fixed || null;
  const record = seededVersionRecord('labor', versionKey);
  if (!record?.draft) return null;
  return {
    kind: 'tt',
    label: `${versionOptionLabel('labor', versionKey)}工时`,
    directHours: record.draft.directHours,
    directRate: record.draft.directRate,
    manufacturingHours: record.draft.manufacturingHours,
    manufacturingRate: record.draft.manufacturingRate,
    sourceNote: `来源：g281_data_history.json ${record.id} 试制场景草稿`,
  };
}

function applyLaborVersion(versionKey) {
  const snapshot = laborVersionSnapshot(versionKey);
  if (!snapshot) return;
  if (snapshot.directHours !== null && snapshot.directHours !== undefined) controls.directHours.value = snapshot.directHours;
  if (snapshot.directRate !== null && snapshot.directRate !== undefined) controls.directRate.value = snapshot.directRate;
  if (snapshot.manufacturingHours !== null && snapshot.manufacturingHours !== undefined) controls.manufacturingHours.value = snapshot.manufacturingHours;
  if (snapshot.manufacturingRate !== null && snapshot.manufacturingRate !== undefined) controls.manufacturingRate.value = snapshot.manufacturingRate;
}

function laborVersionSourceText(versionKey) {
  const snapshot = laborVersionSnapshot(versionKey);
  if (!snapshot) return '';
  if (versionKey === 'base' || versionKey === 'optimize') {
    const directSource = snapshot.sources?.directHours || '';
    const manufacturingSource = snapshot.sources?.manufacturingHours || '';
    return `来源：${directSource}${manufacturingSource ? `；${manufacturingSource}` : ''}`;
  }
  return snapshot.sourceNote || '';
}

function packagingVersionSnapshot(versionKey) {
  if (versionKey === 'base') return PACKAGING_VALIDATION.versionSnapshots?.quote || null;
  if (versionKey === 'optimize') return PACKAGING_VALIDATION.versionSnapshots?.fixed || null;
  const record = seededVersionRecord('packaging', versionKey);
  if (!record?.draft) return null;
  return {
    kind: 'tt',
    label: `${versionOptionLabel('packaging', versionKey)}包装`,
    packInner: record.draft.packInner,
    packFreight: record.draft.packFreight,
    packWarehouse: record.draft.packWarehouse,
    packOther: record.draft.packOther,
    sourceNote: `来源：g281_data_history.json ${record.id} 试制场景草稿`,
  };
}

function applyPackagingVersion(versionKey) {
  const snapshot = packagingVersionSnapshot(versionKey);
  if (!snapshot) return;
  if (snapshot.packInner !== null && snapshot.packInner !== undefined) controls.packInner.value = snapshot.packInner;
  if (snapshot.packFreight !== null && snapshot.packFreight !== undefined) controls.packFreight.value = snapshot.packFreight;
  if (snapshot.packWarehouse !== null && snapshot.packWarehouse !== undefined) controls.packWarehouse.value = snapshot.packWarehouse;
  if (snapshot.packOther !== null && snapshot.packOther !== undefined) controls.packOther.value = snapshot.packOther;
}

function packagingVersionSourceText(versionKey) {
  const snapshot = packagingVersionSnapshot(versionKey);
  if (!snapshot) return '';
  if (versionKey === 'base' || versionKey === 'optimize') {
    const totalSource = snapshot.sources?.packTotal || '';
    return totalSource ? `来源：${totalSource}` : snapshot.note || '';
  }
  return snapshot.sourceNote || '';
}

function equipmentVersionSourceText(versionKey) {
  const meta = CAPITAL_VALIDATION.meta || {};
  if (versionKey === 'base') {
    return `来源：${meta.quoteWorkbook || '报价核算'}《设备投资明细》《项目专用模具》《项目工装投入》`;
  }
  if (versionKey === 'shared') {
    return `来源：${meta.fixedWorkbook || '定点核算'}《设备投资明细》《项目专用模具》《项目工装投入》`;
  }
  const factor = Number(BASE.versions?.equipment?.[versionKey]?.factor) || 1;
  return `来源：定点版投资汇总 × ${factor.toFixed(2)}，当前 TT 工作簿未包含设备/模具/工装核算页`;
}

function applyVersionPreset(group, key) {
  if (group === 'bom') {
    applyBomVersion(key);
    return;
  }
  if (group === 'metal') {
    applyMetalVersion(key);
    return;
  }
  if (group === 'sales') {
    applySalesVersion(key);
    return;
  }
  if (group === 'mix') {
    applyMixVersion(key);
    return;
  }
  if (group === 'labor') {
    applyLaborVersion(key);
    return;
  }
  if (group === 'packaging') {
    applyPackagingVersion(key);
  }
}

function sanitizeConnectorPricing(raw = {}, defaultKey = '') {
  return Object.entries(raw || {}).reduce((acc, [itemId, versionKey]) => {
    if (connectorItemIdSet.has(itemId) && connectorVersionSet.has(versionKey) && versionKey !== defaultKey) {
      acc[itemId] = versionKey;
    }
    return acc;
  }, {});
}

function connectorOverrideCount(pricing = {}, defaultKey = state.connector) {
  return Object.keys(sanitizeConnectorPricing(pricing, defaultKey)).length;
}

function connectorStageClass(stageKey) {
  if (stageKey === 'protocol') return 'protocol';
  if (stageKey === 'sample') return 'sample';
  if (stageKey === 'progress') return 'progress';
  return 'batch';
}

function connectorStageMeta(stageKey) {
  return connectorStageMetaMap[stageKey] || connectorStageMetaMap[state.connector] || { label: '跟随默认', note: '' };
}

function recommendedConnectorStage(summary) {
  if (!summary) return '';
  const sourceCount = Number(summary.sourceCount) || 0;
  const confirmed = protocolCount(summary, 'confirmed');
  if (sourceCount && confirmed === sourceCount) return 'protocol';
  if (confirmed > 0) return 'progress';
  return 'sample';
}

function protocolSummaryForItem(itemId) {
  return protocolPortfolioMap.get(itemId) || null;
}

function protocolCount(summary, key) {
  return Number(summary?.statusCounts?.[key]) || 0;
}

function protocolCountPills(summary) {
  return Object.entries(protocolStatusConfig)
    .map(([key, config]) => {
      const count = protocolCount(summary, key);
      if (!count) return '';
      return `<span class="protocol-count-pill ${config.className}">${config.label} ${count}</span>`;
    })
    .filter(Boolean)
    .join('');
}

function protocolCountsInline(summary) {
  return Object.entries(protocolStatusConfig)
    .map(([key, config]) => {
      const count = protocolCount(summary, key);
      return count ? `${config.label} ${count}` : '';
    })
    .filter(Boolean)
    .join(' / ');
}

function protocolRolledUpLabel(summary) {
  if (!summary) return '';
  const sourceCount = Number(summary.sourceCount) || 0;
  const confirmed = protocolCount(summary, 'confirmed');
  const quotedPending = protocolCount(summary, 'quoted_pending');
  const noReply = protocolCount(summary, 'no_reply');
  const devPending = protocolCount(summary, 'dev_pending');
  if (sourceCount && confirmed === sourceCount) return '已达成';
  if (devPending && !quotedPending && !noReply && !confirmed) return '开发中';
  if (quotedPending && !noReply && !devPending && !confirmed) return '待确认';
  if (noReply && !quotedPending && !devPending && !confirmed) return '暂无回复';
  return '部分达成';
}

function protocolReason(summary) {
  if (!summary) return '';
  const recommendedStage = recommendedConnectorStage(summary);
  if (recommendedStage === 'protocol') {
    return '当前映射项已全部达成，可直接按协议价执行。';
  }
  if (recommendedStage === 'progress') {
    return '已达成部分按协议价执行，其余部分按样品价执行。';
  }
  if (protocolCount(summary, 'dev_pending')) {
    return '仍有开发中项，初始化先按样品价。';
  }
  if (protocolCount(summary, 'quoted_pending')) {
    return '仍有待确认项，初始化先按样品价。';
  }
  if (protocolCount(summary, 'no_reply')) {
    return '仍有暂无回复项，初始化先按样品价。';
  }
  return '按当前默认档位执行。';
}

function protocolProgressText(item) {
  const confirmedShare = Number(item?.progressMeta?.confirmedShare) || 0;
  const sampleShare = Number(item?.progressMeta?.sampleShare) || 0;
  if (!confirmedShare && !sampleShare) return '';
  return `协议覆盖 ${fmtPct(confirmedShare)} / 样品覆盖 ${fmtPct(sampleShare)}`;
}

function protocolRowsForItem(itemId) {
  return protocolRowsByPortfolio[itemId] || [];
}

function protocolRowDisplayLabel(row) {
  return row?.functionBrief || row?.functionRaw || row?.groupLabel || '';
}

function protocolFunctionLines(itemId) {
  const summary = protocolSummaryForItem(itemId);
  const lines = Array.isArray(summary?.functionBriefs) && summary.functionBriefs.length
    ? summary.functionBriefs
    : protocolRowsForItem(itemId).map((row) => protocolRowDisplayLabel(row));
  return [...new Set(lines.filter((line) => String(line || '').trim()))];
}

function protocolSupplierLabel(itemId, fallback = '') {
  const summary = protocolSummaryForItem(itemId);
  const rows = protocolRowsForItem(itemId);
  const lines = Array.isArray(summary?.supplierNames) && summary.supplierNames.length
    ? summary.supplierNames
    : rows.map((row) => row?.supplierRaw || row?.supplier || '');
  const unique = [...new Set(lines.filter((line) => String(line || '').trim()))];
  return unique.length ? unique.join(' / ') : fallback;
}

function protocolStatusLabel(statusKey, fallback = '') {
  return protocolStatusConfig[statusKey]?.label || fallback || statusKey || '';
}

function protocolAssemblyNo(row) {
  const raw = String(row?.functionRaw || row?.functionBrief || '').trim();
  if (!raw) return row?.partNumber || '-';
  const first = raw.split(' / ')[0].trim();
  return first || raw;
}

function protocolAssemblyMeta(row) {
  const raw = String(row?.functionBrief || row?.functionRaw || '').trim();
  const assemblyNo = protocolAssemblyNo(row);
  if (!raw || !assemblyNo) return '';
  if (!raw.startsWith(assemblyNo)) return raw;
  return raw.slice(assemblyNo.length).replace(/^\s*\/\s*/, '').trim();
}

function renderProtocolPartDetail(row) {
  const partNumber = String(row?.partNumber || '').trim();
  const partName = String(row?.partNameRaw || row?.partName || '').trim();
  const assemblyRemark = String(row?.assemblyRemark || '').trim();
  const customerRemark = String(row?.customerRemark || '').trim();
  const notes = [assemblyRemark, customerRemark].filter(Boolean);
  if (!partNumber && !partName && !notes.length) return '';

  const partLine = [partNumber, partName].filter(Boolean)
    .map((text, index) => `<span class="${index === 0 ? 'connector-part-code' : 'connector-part-name'}">${escapeHtml(text)}</span>`)
    .join('<span class="connector-part-sep">/</span>');
  const noteLine = notes.length
    ? `<div class="connector-part-notes">${notes.map((text) => `<span class="connector-mini-note">${escapeHtml(text)}</span>`).join('')}</div>`
    : '';

  return `<div class="connector-part-detail">
    ${partLine ? `<div class="connector-part-line">${partLine}</div>` : ''}
    ${noteLine}
  </div>`;
}

function protocolRowWeight(row) {
  const targetWeight = Number(row?.targetProtocolPrice);
  if (Number.isFinite(targetWeight) && targetWeight > 0) return targetWeight;
  const replyWeight = Number(row?.replyPrice);
  if (Number.isFinite(replyWeight) && replyWeight > 0) return replyWeight;
  return 1;
}

function protocolRowInitialQuote(row) {
  const initialQuote = Number(row?.initialQuote);
  return Number.isFinite(initialQuote) ? initialQuote : null;
}

function protocolStatusMark(row, statusKey) {
  if (row?.statusKey !== statusKey) {
    return '<span class="connector-check connector-check-empty">-</span>';
  }
  const className = protocolStatusConfig[statusKey]?.className || 'confirmed';
  return `<span class="connector-check connector-check-${className}">✓</span>`;
}

function renderProtocolDetailRows(itemId) {
  const rows = protocolRowsForItem(itemId);
  if (!rows.length) {
    return '<div class="connector-detail-empty">未映射套件状态</div>';
  }
  return `<div class="connector-detail-list">${rows.map((row) => `
    <div class="connector-detail-item">
      <span class="connector-detail-name" title="${escapeHtml(protocolRowDisplayLabel(row))}">${escapeHtml(protocolRowDisplayLabel(row))}</span>
      <span class="protocol-count-pill ${protocolStatusConfig[row.statusKey]?.className || 'blank'}">${escapeHtml(protocolStatusLabel(row.statusKey, row.statusLabel))}</span>
    </div>
  `).join('')}</div>`;
}

function applyConnectorProtocolInitialization() {
  connectorPricingState = protocolPortfolios.reduce((acc, summary) => {
    const itemId = summary?.portfolioId;
    const stageKey = recommendedConnectorStage(summary);
    if (!connectorItemIdSet.has(itemId) || !connectorVersionSet.has(stageKey) || stageKey === state.connector) {
      return acc;
    }
    acc[itemId] = stageKey;
    return acc;
  }, {});
  renderVersions();
  queueRender();
}

function renderConnectorProtocolOverview() {
  if (!el.connectorProtocolStats || !el.connectorProtocolHint) return;
  const summary = PROTOCOL_STATUS.summary || {};
  const recommendationCounts = protocolPortfolios.reduce((acc, item) => {
    const stageKey = recommendedConnectorStage(item);
    if (!stageKey) return acc;
    acc[stageKey] = (acc[stageKey] || 0) + 1;
    return acc;
  }, { protocol: 0, progress: 0, sample: 0 });
  const stats = [
    `协议范围 <strong>${summary.totalRows || 0}</strong> 项`,
    `已达成 <strong>${summary.confirmed || 0}</strong>`,
    `待确认 <strong>${summary.quotedPending || 0}</strong>`,
    `暂无回复 <strong>${summary.noReply || 0}</strong>`,
    `开发中 <strong>${summary.devPending || 0}</strong>`,
    `聚合建议协议价 <strong>${recommendationCounts.protocol || 0}</strong>`,
    `聚合建议进度价 <strong>${recommendationCounts.progress || 0}</strong>`,
    `聚合建议样品价 <strong>${recommendationCounts.sample || 0}</strong>`,
  ];
  stats[0] = `状态明细 <strong>${summary.totalRows || 0}</strong> 项`;
  el.connectorProtocolStats.innerHTML = stats.map((text) => `<span class="stat-pill">${text}</span>`).join('');
  const note = '初始化规则：同一聚合连接器下全部映射项已达成时切协议价；若已有部分达成则切进度价；若仍全部未达成，则先按样品价。下方明细按 Excel 平铺展示，初始报价直接取自《吉利E281报价核算.xlsx》的“二次物料明细”，未匹配到对应总成时留空。';
  el.connectorProtocolHint.textContent = note;
  if (el.initConnectorProtocolBtn) {
    el.initConnectorProtocolBtn.disabled = !protocolPortfolios.length;
  }
}

function readDraft() {
  connectorPricingState = sanitizeConnectorPricing(connectorPricingState, state.connector);
  return { scenarioName: el.scenarioName.value.trim() || BASE.name, copperPrice: Number(controls.copperPrice.value) || 0, aluminumPrice: Number(controls.aluminumPrice.value) || 0, directHours: Number(controls.directHours.value) || 0, directRate: Number(controls.directRate.value) || 0, manufacturingHours: Number(controls.manufacturingHours.value) || 0, manufacturingRate: Number(controls.manufacturingRate.value) || 0, packInner: Number(controls.packInner.value) || 0, packFreight: Number(controls.packFreight.value) || 0, packWarehouse: Number(controls.packWarehouse.value) || 0, packOther: Number(controls.packOther.value) || 0, bomWireDrawing: Number(controls.bomWireDrawing.value) || 0, bomWireEat: Number(controls.bomWireEat.value) || 0, bomWireHidden: Number(controls.bomWireHidden.value) || 0, bomTapeDiameter: Number(controls.bomTapeDiameter.value) || 0, bomTapeWidth: Number(controls.bomTapeWidth.value) || 0, bomTapeOverlap: Number(controls.bomTapeOverlap.value) || 0, connectorPricing: { ...connectorPricingState }, mix: normalizeMix(mixInputs.map((input) => input.value)), volumes: yearInputs.map((input) => Math.max(0, Number(input.value) || 0)), asp: BASE.asp.slice() };
}

function calcModel() {
  return window.G281Engine.computeModel(RUNTIME, readDraft(), state);
}

function applyStateSnapshot(snapshot = {}) {
  Object.keys(DEFAULT_STATE).forEach((group) => {
    const nextValue = snapshot[group];
    state[group] = BASE.versions[group][nextValue] ? nextValue : DEFAULT_STATE[group];
  });
}

function applyDraft(draft = {}, fallbackScenarioName = '') {
  const nextDraft = {
    scenarioName: fallbackScenarioName || draft.scenarioName || BASE.name,
    copperPrice: draft.copperPrice ?? BASE.copperPrice,
    aluminumPrice: draft.aluminumPrice ?? BASE.aluminumPrice,
    directHours: draft.directHours ?? BASE.baseDirectHours,
    directRate: draft.directRate ?? BASE.baseDirectRate,
    manufacturingHours: draft.manufacturingHours ?? BASE.baseMfgHours,
    manufacturingRate: draft.manufacturingRate ?? BASE.baseMfgRate,
    packInner: draft.packInner ?? 3.2,
    packFreight: draft.packFreight ?? 4.1,
    packWarehouse: draft.packWarehouse ?? 2.95,
    packOther: draft.packOther ?? 2.3943008441667,
    bomWireDrawing: draft.bomWireDrawing ?? BASE.bomDefaults.wireDrawing,
    bomWireEat: draft.bomWireEat ?? BASE.bomDefaults.wireEat,
    bomWireHidden: draft.bomWireHidden ?? BASE.bomDefaults.wireHidden,
    bomTapeDiameter: draft.bomTapeDiameter ?? BASE.bomDefaults.tapeDiameter,
    bomTapeWidth: draft.bomTapeWidth ?? BASE.bomDefaults.tapeWidth,
    bomTapeOverlap: draft.bomTapeOverlap ?? BASE.bomDefaults.tapeOverlap,
    mix: Array.isArray(draft.mix) && draft.mix.length ? normalizeMix(draft.mix) : BASE.baselineMix.slice(),
    volumes: Array.isArray(draft.volumes) && draft.volumes.length ? draft.volumes.map((value) => Math.max(0, Number(value) || 0)) : BASE.volumes.slice(),
  };
  connectorPricingState = sanitizeConnectorPricing(draft.connectorPricing || {}, state.connector);

  state.scenarioName = nextDraft.scenarioName;
  el.scenarioName.value = nextDraft.scenarioName;
  controls.copperPrice.value = nextDraft.copperPrice;
  controls.aluminumPrice.value = nextDraft.aluminumPrice;
  controls.directHours.value = nextDraft.directHours;
  controls.directRate.value = nextDraft.directRate;
  controls.manufacturingHours.value = nextDraft.manufacturingHours;
  controls.manufacturingRate.value = nextDraft.manufacturingRate;
  controls.packInner.value = nextDraft.packInner;
  controls.packFreight.value = nextDraft.packFreight;
  controls.packWarehouse.value = nextDraft.packWarehouse;
  controls.packOther.value = nextDraft.packOther;
  controls.bomWireDrawing.value = nextDraft.bomWireDrawing;
  controls.bomWireEat.value = nextDraft.bomWireEat;
  controls.bomWireHidden.value = nextDraft.bomWireHidden;
  controls.bomTapeDiameter.value = nextDraft.bomTapeDiameter;
  controls.bomTapeWidth.value = nextDraft.bomTapeWidth;
  controls.bomTapeOverlap.value = nextDraft.bomTapeOverlap;
  yearInputs.forEach((input, index) => { input.value = nextDraft.volumes[index] ?? BASE.volumes[index]; });
  mixInputs.forEach((input, index) => { input.value = nextDraft.mix[index] ?? BASE.baselineMix[index]; });
}

function historyPreview(record) {
  if (record.summary && Number.isFinite(Number(record.summary.profit))) {
    const paybackYears = record.summary.paybackYears === null || record.summary.paybackYears === '' ? Infinity : Number(record.summary.paybackYears);
    return {
      totalProfit: Number(record.summary.profit) || 0,
      paybackYears,
    };
  }
  return window.G281Engine.computeModel(RUNTIME, record.draft || readDraft(), record.state || state);
}

function loadHistoryRecord(historyId) {
  const record = repo.getHistory().find((item) => item.id === historyId);
  if (!record) return;
  applyStateSnapshot(record.state || {});
  if (!record.state || !record.state.metal) {
    state.metal = recordMetalVersionKey(record);
  }
  if (!record.state || !record.state.sales) {
    state.sales = inferSalesVersion(record.draft?.volumes);
  }
  if (!record.state || !record.state.mix) {
    state.mix = inferMixVersion(record.draft?.mix);
  }
  applyDraft(record.draft || {}, record.scenarioName || record.name || BASE.name);
  lastSavedVersionId = record.id;
  renderVersions();
  render(calcModel());
}

function markDirty(){el.generateBtn.textContent='生成场景 · 待更新'}
function clearDirty(){el.generateBtn.textContent='生成场景'}

function renderTags(m){
  const tags = [`BOM ${m.bom.label}`,`铜铝 ${m.metal.label}`,`销量 ${m.sales.label}`,`配置 ${m.mix.label}`,`连接器默认 ${m.conn.label}`,`工时 ${m.labor.label}`,`设备 ${m.equip.label}`,`包装 ${m.pack.label}`,`VAVE ${m.vave.label}`];
  if (m.connectorSummary?.overrideCount) {
    tags.splice(5, 0, `连接器覆盖 ${m.connectorSummary.overrideCount} 项`);
  }
  el.scenarioTags.innerHTML = tags.map(t=>`<span class="chip">${t}</span>`).join('');
}
function renderSummary(m){el.activeSummary.innerHTML=[['混合售价系数',m.mixPrice.toFixed(4)+'x'],['混合成本系数',m.mixCost.toFixed(4)+'x'],['资本投入池',fmtMoney(m.capitalTotal)+' 元'],['静态回收销量',fmtInt(m.paybackVolume)+' 套']].map(x=>`<div class="summary-line"><span>${x[0]}</span><span>${x[1]}</span></div>`).join('')}
function renderKPIs(m){
  const cards=[['生命周期收入',fmtMoney(m.totalRevenue),`按 ${fmtInt(m.totalVolume)} 套计算`,'kpi info'],['生命周期成本',fmtMoney(m.totalCost),`单套成本 ${fmtMoney(m.operating)} 元`,'kpi warn'],['生命周期利润',fmtMoney(m.totalProfit),`单套利润 ${fmtMoney(m.avgProfit)} 元`,m.totalProfit>=0?'kpi good accent':'kpi bad accent'],['毛利率',fmtPct(m.margin),`混合售价系数 ${m.mixPrice.toFixed(4)}x`,'kpi good'],['静态回收期',Number.isFinite(m.paybackYears)?`${m.paybackYears.toFixed(2)} 年`:'∞',`资本投入 ${fmtMoney(m.capitalTotal)} 元`,'kpi info']];
  el.kpiGrid.innerHTML=cards.map(c=>`<article class="${c[3]}"><div class="title">${c[0]}</div><div class="num">${c[1]}</div><div class="sub">${c[2]}</div></article>`).join('');
}

function costDeltaTone(delta) {
  if (Math.abs(Number(delta) || 0) < 0.005) return 'info';
  return Number(delta) > 0 ? 'bad' : 'good';
}

function renderProfitDrivers(m) {
  if (!el.profitDriverGrid) return;
  const baseMaterial = Number(BASE.baseMaterial) || 0;
  const baseLabor = (Number(BASE.baseDirectHours) || 0) * (Number(BASE.baseDirectRate) || 0) + (Number(BASE.baseMfgHours) || 0) * (Number(BASE.baseMfgRate) || 0);
  const basePackaging = Number(BASE.basePackagingPerSet) || 0;
  const baseConnector = Number(BASE.connectorPortfolio?.baseCostPerSet) || baseMaterial * 0.24;
  const laborCost = (Number(m.directLabor) || 0) + (Number(m.manufacturing) || 0);
  const connectorCost = Number(m.connectorSummary?.totalCurrentCost) || 0;
  const connectorDelta = Number(m.connectorSummary?.deltaCost);
  const resolvedConnectorDelta = Number.isFinite(connectorDelta) ? connectorDelta : (connectorCost - baseConnector);
  const mixSpread = Number(m.mixPrice) - Number(m.mixCost);
  const lifecycleVave = (Number(m.vave?.savings) || 0) * (Number(m.totalVolume) || 0);
  const drivers = [
    {
      title: '材料 / BOM',
      value: `${fmtMoney(m.material)} 元/套`,
      meta: `${m.bom.label} / ${m.metal.label} · 对基准 ${fmtSignedMoney((Number(m.material) || 0) - baseMaterial)} 元/套`,
      tone: costDeltaTone((Number(m.material) || 0) - baseMaterial),
    },
    {
      title: '连接器执行',
      value: `${fmtMoney(connectorCost)} 元/套`,
      meta: `${m.conn.label} · ${fmtSignedMoney(resolvedConnectorDelta)} 元/套 · 覆盖 ${m.connectorSummary?.overrideCount || 0} 项`,
      tone: costDeltaTone(resolvedConnectorDelta),
    },
    {
      title: '工时',
      value: `${fmtMoney(laborCost)} 元/套`,
      meta: `${m.labor.label} · 对报价 ${fmtSignedMoney(laborCost - baseLabor)} 元/套`,
      tone: costDeltaTone(laborCost - baseLabor),
    },
    {
      title: '包装物流',
      value: `${fmtMoney(m.packaging)} 元/套`,
      meta: `${m.pack.label} · 对报价 ${fmtSignedMoney((Number(m.packaging) || 0) - basePackaging)} 元/套`,
      tone: costDeltaTone((Number(m.packaging) || 0) - basePackaging),
    },
    {
      title: '设备摊销',
      value: `${fmtMoney(m.equipment)} 元/套`,
      meta: `${m.equip.label} · 资本池 ${fmtMoney(m.capitalTotal)} 元 · ${fmtMoney(m.capitalPerSet)} 元/套`,
      tone: 'info',
    },
    {
      title: '销量预测',
      value: `${fmtInt(m.totalVolume)} 套`,
      meta: `${m.sales.label} · 生命周期销量`,
      tone: 'info',
    },
    {
      title: '配置比例',
      value: `${m.mixPrice.toFixed(4)}x`,
      meta: `${m.mix.label} · 成本系数 ${m.mixCost.toFixed(4)}x`,
      tone: mixSpread >= 0 ? 'good' : 'bad',
    },
    {
      title: 'VAVE',
      value: `${fmtMoney(m.vave.savings)} 元/套`,
      meta: `${m.vave.label} · 生命周期改善 ${fmtMoney(lifecycleVave)} 元`,
      tone: Number(m.vave.savings) > 0 ? 'good' : 'info',
    },
  ];
  el.profitDriverGrid.innerHTML = drivers.map((item) => `
    <article class="driver-card driver-${item.tone}">
      <div class="driver-title">${escapeHtml(item.title)}</div>
      <div class="driver-value">${escapeHtml(item.value)}</div>
      <div class="driver-meta">${escapeHtml(item.meta)}</div>
    </article>
  `).join('');
}

function renderCostBridge(m){
  const avgAsp=m.annual.reduce((s,r)=>s+r.asp,0)/m.annual.length; const rows=[['单套收入',avgAsp,1,'revenue'],['材料',m.material,m.material/avgAsp,'cost'],['工时',m.directLabor+m.manufacturing,(m.directLabor+m.manufacturing)/avgAsp,'cost'],['包装物流',m.packaging,m.packaging/avgAsp,'cost'],['设备',m.equipment,m.equipment/avgAsp,'cost'],['研发',m.rnd,m.rnd/avgAsp,'cost'],['VAVE',-m.vave.savings,m.vave.savings/avgAsp,'profit'],['单套利润',m.avgProfit,m.avgProfit/avgAsp,'profit']];
  const max=Math.max(...rows.map(r=>Math.abs(r[1])),1);
  el.costBridge.innerHTML=rows.map(r=>`<div class="bridge-row ${r[3]}"><div class="label">${r[0]}</div><div class="bridge-bar"><span style="width:${clamp(Math.abs(r[1])/max*100,2,100)}%"></span></div><div class="value ${r[1]>=0?'positive':'negative'}">${r[1]>=0?'':'-'}${fmtMoney(Math.abs(r[1]))}</div><div class="share">${fmtPct(r[2])}</div></div>`).join('');
}

function svgText(x,y,text,opts={}){return `<text x="${x}" y="${y}" fill="${opts.fill||'#dbe5fb'}" text-anchor="${opts.anchor||'middle'}" font-size="${opts.size||12}" font-weight="${opts.weight||500}" font-family="var(--body)">${text}</text>`}

function renderAnnualChart(m){
  const W=1040,H=340,p={t:26,r:26,b:44,l:56},cw=W-p.l-p.r,ch=H-p.t-p.b,max=Math.max(...m.annual.map(d=>Math.max(d.revenue,d.cost,Math.abs(d.profit))),1),gw=cw/m.annual.length,bw=Math.min(18,gw*.18),gap=Math.max(8,gw*.08),base=p.t+ch,scale=ch/max;
  let svg=`<svg viewBox="0 0 ${W} ${H}" width="100%" height="100%" preserveAspectRatio="none" role="img" aria-label="年度收益图"><defs><linearGradient id="revGrad" x1="0%" x2="0%" y1="0%" y2="100%"><stop offset="0%" stop-color="#ffb463"/><stop offset="100%" stop-color="#ff7f32"/></linearGradient><linearGradient id="costGrad" x1="0%" x2="0%" y1="0%" y2="100%"><stop offset="0%" stop-color="#77a7ff"/><stop offset="100%" stop-color="#4f6ef5"/></linearGradient><linearGradient id="profitGrad" x1="0%" x2="0%" y1="0%" y2="100%"><stop offset="0%" stop-color="#69e49b"/><stop offset="100%" stop-color="#23c55e"/></linearGradient></defs>`;
  for(let i=0;i<5;i++){const y=p.t+(ch/4)*i;svg+=`<line x1="${p.l}" y1="${y}" x2="${W-p.r}" y2="${y}" stroke="rgba(255,255,255,.07)" stroke-width="1"/>`}
  m.annual.forEach((row,i)=>{const gx=p.l+i*gw+gw*.16,revH=row.revenue*scale,costH=row.cost*scale,profH=Math.abs(row.profit)*scale,rx=gx,cx=gx+bw+gap,px=gx+(bw+gap)*2;svg+=`<rect x="${rx}" y="${base-revH}" width="${bw}" height="${revH}" rx="9" fill="url(#revGrad)"/><rect x="${cx}" y="${base-costH}" width="${bw}" height="${costH}" rx="9" fill="url(#costGrad)"/><rect x="${px}" y="${base-profH}" width="${bw}" height="${profH}" rx="9" fill="url(#profitGrad)"/>`;svg+=svgText(rx+bw/2,base-revH-8,fmtMoney(row.revenue,0),{size:10,fill:'#ffd9b3'});svg+=svgText(cx+bw/2,base-costH-8,fmtMoney(row.cost,0),{size:10,fill:'#c2d8ff'});svg+=svgText(px+bw/2,base-profH-8,fmtMoney(row.profit,0),{size:10,fill:'#b6f2cf'});svg+=svgText(gx+(bw+gap),H-16,row.year,{size:11,fill:'#c6d3e7'})});
  svg+=svgText(p.l-20,p.t+6,'元',{anchor:'end',size:11,fill:'#94a3b8'})+svgText(p.l-20,base-2,'0',{anchor:'end',size:11,fill:'#94a3b8'})+`</svg>`; el.annualChart.innerHTML=svg;
}

function renderConfigBars(m){
  const rows=m.currentMix.map((share,i)=>({name:BASE.configNames[i],share,rev:m.totalRevenue*(share/100)*BASE.priceMixIndexes[i]/m.mixPrice,cost:m.totalCost*(share/100)*BASE.costMixIndexes[i]/m.mixCost,profit:0}));
  const maxRev=Math.max(...rows.map(r=>r.rev),1); el.configBars.innerHTML=rows.map(r=>`<div class="price-row-visual"><div class="label">${r.name}</div><div class="bar"><span style="width:${clamp(r.rev/maxRev*100,2,100)}%"></span></div><div class="count">${fmtPct(r.share/100)} / ${fmtMoney(r.rev-r.cost)}</div></div>`).join('');
  const maxType=Math.max(...BASE.priceTypeCounts.map(d=>d.count),1); el.typeBars.innerHTML=BASE.priceTypeCounts.map(r=>`<div class="price-row-visual"><div class="label">${r.name}</div><div class="bar"><span style="width:${clamp(r.count/maxType*100,2,100)}%"></span></div><div class="count">${r.count}</div></div>`).join('');
}

function wireUsageLabel(key) {
  return ({
    quote: '报价版',
    fixed: '定点版',
    tt: 'TT版',
  })[key] || key || '-';
}

function requestedWireUsageKey() {
  const label = versionOptionLabel('bom', state.bom);
  const raw = `${state.bom || ''} ${label || ''}`.toLowerCase();
  if (state.bom === 'regress' || raw.includes('tt')) return 'tt';
  if (state.bom === 'light' || raw.includes('fixed') || raw.includes('定点')) return 'fixed';
  if (state.bom === 'freeze' || raw.includes('quote') || raw.includes('报价')) return 'quote';
  return 'fixed';
}

function wireUsageCandidates(requestedKey) {
  const candidates = [requestedKey];
  const fallback = WIRE_CATALOG.meta?.usageFallbackOrder?.[requestedKey];
  if (Array.isArray(fallback)) {
    fallback.forEach((key) => {
      if (key && !candidates.includes(key)) candidates.push(key);
    });
  }
  return candidates;
}

function resolveWireUsage(row, requestedKey) {
  const usage = row?.usage || {};
  const candidates = wireUsageCandidates(requestedKey);
  for (const key of candidates) {
    const value = usage[key];
    if (value !== null && value !== undefined && value !== '') {
      return { key, value: Number(value) || 0 };
    }
  }
  return { key: requestedKey, value: 0 };
}

function renderWireCatalog(m) {
  if (!el.wireModelSummary || !el.wireCalcNote || !el.wireModelTable) return;
  if (!WIRE_MODELS.length) {
    el.wireModelSummary.innerHTML = '<div class="wire-model-stat"><div class="label">导线型号</div><div class="value">0 个</div><div class="meta">当前未导入导线目录</div></div>';
    el.wireCalcNote.textContent = '当前未加载导线型号联动数据。';
    el.wireModelTable.innerHTML = '<tr><td colspan="10" class="wire-empty-cell">当前未加载导线型号数据。</td></tr>';
    return;
  }

  const requestedUsage = requestedWireUsageKey();
  const bomLabel = versionOptionLabel('bom', state.bom) || wireUsageLabel(requestedUsage);
  const copperPrice = Number(m.d.copperPrice) || 0;
  const aluminumPrice = Number(m.d.aluminumPrice) || 0;
  const rows = WIRE_MODELS.map((row) => {
    const weights = row.weights || {};
    const usage = resolveWireUsage(row, requestedUsage);
    const aluminumWeight = Number(weights.aluminum) || 0;
    const copperWeight = Number(weights.copper) || 0;
    const nonCopper = Number(weights.nonCopper) || 0;
    const aluminumCost = (aluminumWeight / 1000000) * aluminumPrice;
    const copperCost = (copperWeight / 1000000) * copperPrice;
    const currentUnitPrice = aluminumCost + copperCost + (nonCopper / 1000);
    const currentAmount = currentUnitPrice * usage.value;
    return {
      ...row,
      usageKey: usage.key,
      usageValue: usage.value,
      aluminumWeight,
      copperWeight,
      nonCopper,
      aluminumCost,
      copperCost,
      currentUnitPrice,
      currentAmount,
    };
  }).sort((left, right) => {
    const leftActive = left.usageValue > 0 ? 1 : 0;
    const rightActive = right.usageValue > 0 ? 1 : 0;
    if (leftActive !== rightActive) return rightActive - leftActive;
    if (Math.abs(right.currentAmount - left.currentAmount) > 0.0001) return right.currentAmount - left.currentAmount;
    return String(left.code || '').localeCompare(String(right.code || ''), 'zh-CN');
  });

  const visibleRows = rows.filter((row) => row.usageValue > 0);
  const rowsForView = visibleRows.length ? visibleRows : rows;
  const totalUsage = rowsForView.reduce((sum, row) => sum + row.usageValue, 0);
  const totalAmount = rowsForView.reduce((sum, row) => sum + row.currentAmount, 0);
  const inferredRows = rowsForView.filter((row) => row.weightSource?.inferred);
  const sourceCounts = rowsForView.reduce((acc, row) => {
    acc[row.usageKey] = (acc[row.usageKey] || 0) + 1;
    return acc;
  }, {});
  const sourceSummary = Object.entries(sourceCounts)
    .map(([key, count]) => `${wireUsageLabel(key)} ${count} 项`)
    .join(' / ');
  const sourceBooks = [WIRE_CATALOG.meta?.ttSourceWorkbook, WIRE_CATALOG.meta?.fixedSourceWorkbook, WIRE_CATALOG.meta?.quoteSourceWorkbook]
    .filter(Boolean)
    .join(' / ');
  const summaryCards = [
    ['导线目录', `${WIRE_MODELS.length} 个`, '所有版本导线型号'],
    ['当前 BOM', `${bomLabel} / ${rowsForView.length} 个`, `实取 ${sourceSummary || wireUsageLabel(requestedUsage)}`],
    ['铜基价', `${fmtMoney(copperPrice, 0)} 元/吨`, m.metal.label],
    ['铝基价', `${fmtMoney(aluminumPrice, 0)} 元/吨`, m.metal.label],
    ['材料汇总', `铝 ${fmtNumber(WIRE_CATALOG.summary?.totalAluminumWeight || 0, 2)} / 铜 ${fmtNumber(WIRE_CATALOG.summary?.totalCopperWeight || 0, 2)}`, `非铜 ${fmtNumber(WIRE_CATALOG.summary?.totalNonCopper || 0, 2)}`],
    ['当前导线金额', `${fmtMoney(totalAmount)} 元/套`, inferredRows.length ? `当前用量 ${fmtNumber(totalUsage, 2)} / 推算 ${inferredRows.length} 项` : `当前用量 ${fmtNumber(totalUsage, 2)}`],
  ];
  el.wireModelSummary.innerHTML = summaryCards.map(([label, value, meta]) => `
    <div class="wire-model-stat">
      <div class="label">${escapeHtml(label)}</div>
      <div class="value">${escapeHtml(value)}</div>
      <div class="meta">${escapeHtml(meta)}</div>
    </div>
  `).join('');

  const inferredNote = inferredRows.length ? `当前有 ${inferredRows.length} 项按 TT 专有规格模板推算，表内已标注。` : '';
  el.wireCalcNote.innerHTML = `单价规则：铝重 × 当前铝价 / 1,000,000 + 铜重 × 当前铜价 / 1,000,000 + 非铜/1000。铜价、铝价按元/吨输入，铝重 / 铜重 / 非铜按核算表原字段直接搬入。数据来源：${escapeHtml(sourceBooks || '导线联动核算表')}。当前 BOM 口径：${escapeHtml(bomLabel)}，用量来源：${escapeHtml(sourceSummary || wireUsageLabel(requestedUsage))}。${escapeHtml(inferredNote)}`;

  el.wireModelTable.innerHTML = rowsForView.map((row) => {
    const metaBits = [row.supplier, row.sap ? `SAP ${row.sap}` : '', row.priceType].filter(Boolean);
    const weightLabel = row.weightSource?.label || '';
    const weightNote = row.weightSource?.note || '';
    const templateCode = row.weightSource?.templateCode || '';
    return `
      <tr>
        <td class="wire-model-cell">
          <div class="wire-model-main">
            <strong>${escapeHtml(row.code || '-')}</strong>
            <span>${escapeHtml(row.name || '-')}</span>
          </div>
          <div class="wire-inline-meta">${metaBits.map((text) => `<span>${escapeHtml(text)}</span>`).join('')}</div>
          ${weightLabel ? `<div class="wire-cell-note" title="${escapeHtml(weightNote)}">${escapeHtml(weightLabel)}${templateCode ? ` · ${escapeHtml(templateCode)}` : ''}</div>` : ''}
        </td>
        <td>
          <div class="wire-family-stack">
            <span class="wire-family-chip">${escapeHtml(row.relationLabel || row.materialFamily || '-')}</span>
            <span class="wire-cell-note">${escapeHtml(row.materialFamily || '-')}</span>
          </div>
        </td>
        <td class="wire-number-cell">
          <div>${fmtNumber(row.usageValue, 2)}</div>
          <div class="wire-cell-note">${escapeHtml(wireUsageLabel(row.usageKey))}</div>
        </td>
        <td class="wire-number-cell">${fmtMetric(row.aluminumWeight, 2)}</td>
        <td class="wire-number-cell">${fmtMetric(row.copperWeight, 2)}</td>
        <td class="wire-number-cell">${fmtMetric(row.nonCopper, 2)}</td>
        <td class="wire-number-cell">${fmtMetric(row.aluminumCost, 3)}</td>
        <td class="wire-number-cell">${fmtMetric(row.copperCost, 3)}</td>
        <td class="wire-number-cell wire-money-cell">${fmtMoney(row.currentUnitPrice, 3)}</td>
        <td class="wire-number-cell wire-money-cell">${fmtMoney(row.currentAmount, 2)}</td>
      </tr>
    `;
  }).join('');
}

function renderBomAnalysis(m){
  const wireCards=[
    ['结算线长',`${m.bomCalc.wireQuoteM.toFixed(2)} m`,`图纸 ${fmtInt(m.d.bomWireDrawing)} + 吃线 ${fmtInt(m.d.bomWireEat)} + 余量 ${fmtInt(m.d.bomWireHidden)} mm`,'accent'],
    ['隐藏余量占比',fmtPct(m.bomCalc.wireHiddenRate),'隐藏利润余量 / 结算线长',''],
    ['线长折算',`${fmtMaybeInt(m.bomCalc.wireQuoteMm)} mm`,'用于裁线、出料与报价联动','blue'],
    ['工程结论','可直接下发','BOM 线长已经纳入场景引擎','green']
  ];
  el.wireCalc.innerHTML=wireCards.map(([label,value,meta,cls])=>`<div class="calc-chip ${cls}"><div class="label">${label}</div><div class="value">${value}</div><div class="meta">${meta}</div></div>`).join('');

  const tapeCards=[
    ['每米胶带用量',`${m.bomCalc.tapePerMm.toFixed(2)} m/m`,`受 ${m.d.bomTapeDiameter} mm 线径与 ${fmtPct(m.bomCalc.tapeOverlap)} 重叠率影响`,'blue'],
    ['单件胶带用量',`${m.bomCalc.tapeLengthM.toFixed(2)} m`,`${fmtMaybeInt(m.bomCalc.tapeLengthMm)} mm / 单件`,'accent'],
    ['缠绕圈数',`${m.bomCalc.tapeTurns.toFixed(1)} 圈`,`节距 ${m.bomCalc.tapePitch.toFixed(1)} mm`,'green'],
    ['重叠率',fmtPct(m.bomCalc.tapeOverlap),'越高则单位用量越大','']
  ];
  el.tapeCalc.innerHTML=tapeCards.map(([label,value,meta,cls])=>`<div class="calc-chip ${cls}"><div class="label">${label}</div><div class="value">${value}</div><div class="meta">${meta}</div></div>`).join('');

  const summary=m.bomSummary;
  const statRows=[
    ['替换',summary.replaceCount],
    ['新增',summary.addCount],
    ['取消',summary.cancelCount],
    ['影响配置',summary.configCount],
    ['呆滞库存',`${fmtInt(summary.obsoleteQty)} 套`],
    ['呆滞金额',`${fmtMoney(summary.obsoleteValue)} 元`]
  ];
  el.bomStats.innerHTML=statRows.map(([label,value])=>`<span class="stat-pill">${label} <strong>${value}</strong></span>`).join('');

  const impactRows=[
    ['设备资源',`${fmtSigned(summary.equipmentDelta,2)} h/套`,`裁线 / 压接 / 缠绕 / 测试联动`],
    ['工时',`${fmtSigned(summary.laborDelta,2)} h/套`,`节拍与返修动作变化`],
    ['包装',`${fmtSignedMoney(summary.packagingDelta)} / 套`,`内衬 / 箱规 / 贴标变化`],
    ['呆滞',`${fmtInt(summary.obsoleteQty)} 套`,`${fmtMoney(summary.obsoleteValue)} 元 · 处置`],
    ['配置',`${summary.configCount} 项`,summary.configList.join(' / ')]
  ];
  el.bomResourceGrid.innerHTML=impactRows.map(([label,value,meta])=>`<div class="metric-card"><div class="name">${label}</div><div class="value">${value}</div><div class="meta">${meta}</div></div>`).join('');

  el.bomChangeTable.innerHTML=BOM_CHANGE_ROWS.map(row=>{
    const actionClass=row.action==='替换'?'replace':row.action==='新增'?'add':'cancel';
    const relation=row.action==='取消' ? `<div class="relation"><span class="subtle">取消：</span>${row.from}</div>` : `<div class="relation"><span class="subtle">${row.from}</span> → <span class="relation">${row.to}</span></div>`;
    return `<tr><td><span class="action-pill ${actionClass}">${row.action}</span></td><td>${row.part}</td><td>${relation}</td><td><div>${row.resource}</div><div class="subtle">${fmtSigned(row.equipmentDelta,2)} h/套</div></td><td><div>${row.stock}</div><div class="subtle">${fmtMoney(row.obsoleteValue)} 元</div></td><td><div>${fmtSigned(row.laborDelta,2)} h/套</div><div class="subtle">${row.note}</div></td><td><div>${fmtSignedMoney(row.packagingDelta)} / 套</div></td><td><div class="config-list">${row.configs.map(c=>`<span class="mini-tag">${c}</span>`).join('')}</div></td></tr>`;
  }).join('');
}

function renderConnectorPricing(m){
  renderConnectorProtocolOverview();
  const summary = m.connectorSummary || {};
  const stageCounts = summary.stageCounts || { batch: 0, protocol: 0, sample: 0, progress: 0 };
  const deltaClass = summary.deltaCost > 0 ? 'delta-up' : summary.deltaCost < 0 ? 'delta-down' : 'delta-flat';
  const stats = [
    `默认执行 <strong>${summary.defaultLabel || BASE.versions.connector[state.connector].label}</strong>`,
    `跟随默认 <strong>${summary.followCount || 0}</strong>`,
    `逐项覆盖 <strong>${summary.overrideCount || 0}</strong>`,
    `批量价 <strong>${stageCounts.batch || 0}</strong>`,
    `协议价 <strong>${stageCounts.protocol || 0}</strong>`,
    `进度价 <strong>${stageCounts.progress || 0}</strong>`,
    `样品价 <strong>${stageCounts.sample || 0}</strong>`,
    `连接器成本 <strong>${fmtMoney(summary.totalCurrentCost || 0)}</strong> 元/套`,
    `相对基准 <strong class="${deltaClass}">${fmtSignedMoney(summary.deltaCost || 0)}</strong> 元/套`,
  ];
  el.connectorExecutionStats.innerHTML = stats.map((text) => `<span class="stat-pill">${text}</span>`).join('');

  el.connectorPriceTable.innerHTML = protocolRows.map((row) => {
    const assemblyNo = protocolAssemblyNo(row);
    const assemblyMeta = protocolAssemblyMeta(row);
    const partDetail = renderProtocolPartDetail(row);
    const supplierLabel = row?.supplierRaw || row?.supplier || '-';
    const protocolPrice = fmtMaybeMoney(row?.targetProtocolPrice);
    const progressPrice = fmtMaybeMoney(row?.replyPrice);
    const initialQuote = fmtMaybeMoney(protocolRowInitialQuote(row));
    const initialQuoteTitle = row?.initialQuoteSource || '报价核算《二次物料明细》未匹配到对应总成';
    const statusLabel = protocolStatusLabel(row?.statusKey, row?.statusLabel || '未配置');
    const statusClass = protocolStatusConfig[row?.statusKey]?.className || 'blank';

    return `<tr>
      <td class="connector-assembly-cell">
        <div class="connector-assembly-code" title="${escapeHtml(assemblyNo)}">${escapeHtml(assemblyNo)}</div>
        ${assemblyMeta ? `<div class="subtle connector-assembly-meta" title="${escapeHtml(row?.functionRaw || assemblyMeta)}">${escapeHtml(assemblyMeta)}</div>` : ''}
        ${partDetail}
      </td>
      <td class="connector-supplier-cell">${escapeHtml(supplierLabel)}</td>
      <td class="connector-number-cell">${protocolPrice}</td>
      <td class="connector-number-cell">${progressPrice}</td>
      <td class="connector-number-cell" title="${escapeHtml(initialQuoteTitle)}">${initialQuote}</td>
      <td class="connector-status-cell"><span class="protocol-count-pill ${statusClass}">${escapeHtml(statusLabel)}</span></td>
      <td class="connector-mark-cell">${protocolStatusMark(row, 'confirmed')}</td>
      <td class="connector-mark-cell">${protocolStatusMark(row, 'quoted_pending')}</td>
      <td class="connector-mark-cell">${protocolStatusMark(row, 'dev_pending')}</td>
    </tr>`;
  }).join('');
}

function formatDateTime(value){
  if(!value) return '—';
  const date = new Date(value);
  if(Number.isNaN(date.getTime())) return '—';
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')} ${String(date.getHours()).padStart(2,'0')}:${String(date.getMinutes()).padStart(2,'0')}`;
}

function statusKey(value){
  const text = String(value || '').toLowerCase();
  if(text.includes('approve')) return 'approved';
  if(text.includes('pending')) return 'pending';
  if(text.includes('review')) return 'review';
  if(text.includes('reject')) return 'rejected';
  return 'neutral';
}

function renderArchitecture(m){
  const history = repo.getHistory();
  const approvals = repo.getApprovals();
  const seedHistoryCount = Array.isArray(RUNTIME.historySeed) ? RUNTIME.historySeed.length : 0;
  const seedApprovalCount = Array.isArray(RUNTIME.approvalSeed) ? RUNTIME.approvalSeed.length : 0;
  const extraHistoryCount = Math.max(0, history.length - seedHistoryCount);
  const extraApprovalCount = Math.max(0, approvals.length - seedApprovalCount);
  const historyMap = new Map(history.map((record) => [record.id, record]));
  el.layerDataCount.textContent = '11 个文件';
  el.layerDataMeta.textContent = ['g281_data_master.json', 'g281_data_bom_changes.json', 'g281_data_bom_validation.json', 'g281_data_bom_versions.json', 'g281_data_capital_validation.json', 'g281_data_labor_validation.json', 'g281_data_packaging_validation.json', 'g281_data_connector_protocol_status.json', 'g281_data_wire_catalog.json', 'g281_data_history.json', 'g281_data_approvals.json'].join(' / ');
  el.layerEngineMeta.textContent = `${m.engineLayer} / pure compute / 无 DOM 依赖`;
  el.layerHistoryCount.textContent = `${history.length} 条`;
  el.layerHistoryMeta.textContent = `seed ${seedHistoryCount} + 自定义 ${extraHistoryCount}`;
  el.layerApprovalCount.textContent = `${approvals.length} 条`;
  el.layerApprovalMeta.textContent = `seed ${seedApprovalCount} + 自定义 ${extraApprovalCount}`;

  el.historyTable.innerHTML = history.map((record) => {
    const preview = historyPreview(record);
    const stateText = [
      versionOptionLabel('bom', record.state?.bom),
      versionOptionLabel('metal', recordMetalVersionKey(record)),
      versionOptionLabel('connector', record.state?.connector),
      versionOptionLabel('labor', record.state?.labor),
      versionOptionLabel('equipment', record.state?.equipment),
      versionOptionLabel('packaging', record.state?.packaging),
      versionOptionLabel('sales', record.state?.sales),
      versionOptionLabel('mix', record.state?.mix),
      versionOptionLabel('vave', record.state?.vave),
    ].filter(Boolean).join(' / ');
    const connectorOverrides = connectorOverrideCount(record.draft?.connectorPricing || {}, record.state?.connector || DEFAULT_STATE.connector);
    const note = record.note || '未填写版本说明';
    const author = record.author || 'system';
    return `<tr><td><div class="record-title"><div>${record.name || record.scenarioName}</div><div class="subtle">${record.scenarioName || ''}</div><div class="subtle">${formatDateTime(record.createdAt)} · ${author}</div></div></td><td><div class="state-stack"><div>${stateText || '基准'}</div><div class="subtle">${Object.values(record.state || {}).filter(Boolean).length} 个版本开关</div></div></td><td class="${preview.totalProfit >= 0 ? 'positive' : 'negative'}">${fmtMoney(preview.totalProfit)}</td><td>${Number.isFinite(preview.paybackYears) ? `${preview.paybackYears.toFixed(2)} 年` : '∞'}</td><td><div class="note-stack"><div>${note}</div><div class="subtle">ID ${record.id}</div></div></td><td><div class="table-actions"><button class="mini-button primary" type="button" data-load-history="${record.id}">载入版本</button></div></td></tr>`;
  }).join('');
  Array.from(el.historyTable.querySelectorAll('tr')).forEach((row, index) => {
    const record = history[index];
    const overrideCount = connectorOverrideCount(record?.draft?.connectorPricing || {}, record?.state?.connector || DEFAULT_STATE.connector);
    if (!overrideCount) return;
    const stateMeta = row.querySelector('.state-stack .subtle');
    if (!stateMeta || stateMeta.textContent.includes('连接器覆盖')) return;
    stateMeta.textContent = `${stateMeta.textContent} · 连接器覆盖 ${overrideCount} 项`;
  });

  el.approvalTable.innerHTML = approvals.map((record) => {
    const related = record.relatedVersionId ? (historyMap.get(record.relatedVersionId)?.name || record.relatedVersionId) : '未关联';
    const action = record.relatedVersionId ? `<button class="mini-button secondary" type="button" data-load-history="${record.relatedVersionId}">载入关联版本</button>` : '<span class="subtle">无</span>';
    return `<tr><td><div class="record-title"><div>${record.title}</div><div class="subtle">${record.owner || '未指定责任人'}</div></div></td><td>${related}</td><td><span class="status-pill status-${statusKey(record.status)}">${record.status}</span></td><td>${formatDateTime(record.submittedAt || record.createdAt)}</td><td><div class="table-actions">${action}</div></td></tr>`;
  }).join('');
}

function renderEventTable(m){
  const connectorImpact = `${((m.conn.effectiveFactor - 1) * 100).toFixed(1)}% / 默认 ${m.conn.label} / 覆盖 ${m.connectorSummary?.overrideCount || 0} 项`;
  const rows=[['BOM',m.bom.label,`${((m.material/BASE.baseMaterial-1)*100).toFixed(1)}% 材料变动`],['铜铝基价',m.metal.label,`铜 ${fmtMoney(m.d.copperPrice,0)} 元/吨 / 铝 ${fmtMoney(m.d.aluminumPrice,0)} 元/吨`],['连接器',m.conn.label,connectorImpact],['工时',m.labor.label,`${((m.labor.factor-1)*100).toFixed(1)}% 费率/工时`],['设备',m.equip.label,`${((m.equip.factor-1)*100).toFixed(1)}% 设备分摊`],['包装物流',m.pack.label,`${((m.pack.factor-1)*100).toFixed(1)}% 包装费率`],['销量预测',m.sales.label,`${fmtInt(m.totalVolume)} 套生命周期`],['配置比例',m.mix.label,`${m.currentMix.map(v=>v.toFixed(1)+'%').join(' / ')}`],['VAVE',m.vave.label,`${fmtMoney(m.vave.savings)} 元/套`]];
  el.eventTable.innerHTML=rows.map(r=>`<tr><td>${r[0]}</td><td>${r[1]}</td><td>${r[2]}</td></tr>`).join('');
}

function renderCompare(m){
  el.compareTable.innerHTML=m.compare.map(([label,base,current])=>{const diff=current-base,isPct=label==='毛利率',isVol=label==='回收销量';return `<tr><td>${label}</td><td>${isVol?fmtMaybeInt(base):isPct?fmtPct(base):fmtMoney(base)}</td><td>${isVol?fmtMaybeInt(current):isPct?fmtPct(current):fmtMoney(current)}</td><td class="${diff>=0?'positive':'negative'}">${isVol?fmtMaybeInt(diff):isPct?fmtPct(diff):fmtMoney(diff)}</td></tr>`}).join('');
}

function renderCapital(m){
  const capital = m.capitalBreakdown || {};
  const rows=[['设备资源',capital.equipment || 0,m.totalVolume ? (capital.equipment || 0)/m.totalVolume : 0],['专用模具',capital.tooling || 0,m.totalVolume ? (capital.tooling || 0)/m.totalVolume : 0],['工装投入',capital.fixtures || 0,m.totalVolume ? (capital.fixtures || 0)/m.totalVolume : 0],['研发费用',capital.rnd || 0,m.totalVolume ? (capital.rnd || 0)/m.totalVolume : 0],['合计',m.capitalTotal,m.capitalPerSet]];
  el.capitalLedger.innerHTML=rows.map(r=>`<div class="ledger-item"><div class="name">${r[0]}</div><div class="meta"><div>${fmtMoney(r[1])} 元</div><div>${fmtMoney(r[2])} 元 / 套</div></div></div>`).join('');
}

function renderAnnualTable(m){
  el.annualTable.innerHTML=m.annual.map(r=>`<tr><td>${r.year}</td><td>${fmtInt(r.volume)}</td><td>${fmtMoney(r.asp)}</td><td>${fmtMoney(r.revenue)}</td><td>${fmtMoney(m.operating)}</td><td>${fmtMoney(r.cost)}</td><td class="${r.profit>=0?'positive':'negative'}">${fmtMoney(r.profit)}</td><td class="${r.margin>=0?'positive':'negative'}">${fmtPct(r.margin)}</td></tr>`).join('');
}

function render(m){
  el.scenarioName.value=m.d.scenarioName; renderTags(m); renderSummary(m); renderKPIs(m); renderProfitDrivers(m); renderWireCatalog(m); renderBomAnalysis(m); renderConnectorPricing(m); renderArchitecture(m); renderCostBridge(m); renderAnnualChart(m); renderConfigBars(m); renderEventTable(m); renderCompare(m); renderCapital(m); renderAnnualTable(m); clearDirty();
}

function syncInputs(){
  applyDraft({}, state.scenarioName);
  applyVersionPreset('bom', state.bom);
  applyVersionPreset('metal', state.metal);
  applyVersionPreset('sales', state.sales);
  applyVersionPreset('mix', state.mix);
  applyVersionPreset('labor', state.labor);
  applyVersionPreset('packaging', state.packaging);
}

function generate(){state.scenarioName=el.scenarioName.value.trim()||BASE.name; render(calcModel())}
function reset(){applyStateSnapshot(DEFAULT_STATE);state.scenarioName=BASE.name;lastSavedVersionId='';syncInputs();renderVersions();generate()}

let renderTimer=0;
function queueRender(){markDirty(); clearTimeout(renderTimer); renderTimer=setTimeout(generate,120)}

function setupProfitHomepage() {
  if (el.profitActionBar) {
    [el.saveVersionBtn, el.submitApprovalBtn, el.exportLayerBtn].forEach((button) => {
      if (button && button.parentElement !== el.profitActionBar) {
        el.profitActionBar.appendChild(button);
      }
    });
  }
  document.querySelector('.bom-section')?.classList.add('profit-hidden');
  document.querySelector('.architecture-card')?.classList.add('profit-hidden');
  el.historyTable?.closest('section.two-col')?.classList.add('profit-hidden');
  el.eventTable?.closest('article.card')?.classList.add('profit-hidden');
  document.querySelector('.footer-note')?.closest('section.card.mt')?.classList.add('profit-hidden');
}

function bind(){
  setupProfitHomepage();
  renderVersions(); syncInputs(); generate();
  el.generateBtn.addEventListener('click',generate); el.resetBtn.addEventListener('click',reset); el.printBtn.addEventListener('click',()=>window.print());
  el.saveVersionBtn.addEventListener('click',()=>{const model=calcModel(); const record=repo.createHistoryRecord(model); repo.saveHistory(record); lastSavedVersionId=record.id; render(model)});
  el.submitApprovalBtn.addEventListener('click',()=>{const model=calcModel(); let versionRecord=lastSavedVersionId?repo.getHistory().find(item=>item.id===lastSavedVersionId):null; if(!versionRecord){versionRecord=repo.createHistoryRecord(model); repo.saveHistory(versionRecord); lastSavedVersionId=versionRecord.id;} const record=repo.createApprovalRecord(model,versionRecord); repo.saveApproval(record); render(model)});
  el.exportLayerBtn.addEventListener('click',()=>{repo.exportSnapshot(`g281_layer_snapshot_${new Date().toISOString().replace(/[:.]/g,'-')}.json`,{master:BASE,bomChanges:BOM_CHANGE_ROWS,bomValidation:RUNTIME.bomValidation||null,bomVersions:RUNTIME.bomVersions||null,capitalValidation:RUNTIME.capitalValidation||null,laborValidation:RUNTIME.laborValidation||null,packagingValidation:RUNTIME.packagingValidation||null,connectorProtocolStatus:RUNTIME.connectorProtocolStatus||null,wireCatalog:RUNTIME.wireCatalog||null,history:repo.getHistory(),approvals:repo.getApprovals()})});
  if (el.initConnectorProtocolBtn) {
    el.initConnectorProtocolBtn.addEventListener('click', applyConnectorProtocolInitialization);
  }
  if (el.clearConnectorOverridesBtn) {
    el.clearConnectorOverridesBtn.addEventListener('click',()=>{connectorPricingState={}; renderVersions(); queueRender()});
  }
  if (el.connectorPriceTable) {
    el.connectorPriceTable.addEventListener('click',(event)=>{
      const followButton = event.target.closest('[data-connector-mode="follow"]');
      if (followButton) {
        delete connectorPricingState[followButton.dataset.connectorId];
        renderVersions();
        queueRender();
        return;
      }
      const stageButton = event.target.closest('[data-connector-stage]');
      if (!stageButton) return;
      const itemId = stageButton.dataset.connectorId;
      const stageKey = stageButton.dataset.connectorStage;
      if (!connectorItemIdSet.has(itemId) || !connectorVersionSet.has(stageKey)) return;
      if (stageKey === state.connector) {
        delete connectorPricingState[itemId];
      } else {
        connectorPricingState[itemId] = stageKey;
      }
      renderVersions();
      queueRender();
    });
  }
  [el.historyTable, el.approvalTable].forEach((table) => {
    table.addEventListener('click', (event) => {
      const button = event.target.closest('[data-load-history]');
      if (!button) return;
      loadHistoryRecord(button.dataset.loadHistory);
    });
  });
  [el.scenarioName,...Object.values(controls),...yearInputs,...mixInputs].forEach(x=>x.addEventListener('input',queueRender));
  el.scenarioName.addEventListener('change',()=>state.scenarioName=el.scenarioName.value.trim()||BASE.name);
}

function renderVersions(){Object.entries(BASE.versions).forEach(([g,opts])=>{const box=document.querySelector(`.option-row[data-group="${g}"]`);box.innerHTML='';Object.entries(opts).forEach(([k,it])=>{const b=document.createElement('button');b.type='button';b.className='option'+(state[g]===k?' active':'');b.textContent=it.label;b.title=it.note;b.addEventListener('click',()=>{state[g]=k;renderVersions();queueRender()});box.appendChild(b)});const note=$(g+'Note');if(!note)return;note.textContent=g==='connector'?`默认执行档位：${opts[state[g]].label}。${opts[state[g]].note} 当前已单独指定 ${connectorOverrideCount(connectorPricingState)} 个连接器。`:opts[state[g]].note})}

function renderVersions() {
  Object.entries(BASE.versions).forEach(([group, options]) => {
    const box = document.querySelector(`.option-row[data-group="${group}"]`);
    if (!box) return;
    box.innerHTML = '';

    orderedVersionEntries(group, options).forEach(([key, option]) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'option' + (state[group] === key ? ' active' : '');
      button.textContent = option.label;
      button.title = option.note;
      button.addEventListener('click', () => {
        state[group] = key;
        if (group === 'connector') {
          connectorPricingState = sanitizeConnectorPricing(connectorPricingState, state.connector);
        }
        applyVersionPreset(group, key);
        renderVersions();
        queueRender();
      });
      box.appendChild(button);
    });

    const note = $(group + 'Note');
    if (!note) return;
    if (group === 'connector') {
      const overrideCount = connectorOverrideCount(connectorPricingState, state.connector);
      note.textContent = `默认执行档位：${options[state[group]].label}。${options[state[group]].note} 当前已单独指定 ${overrideCount} 个连接器。`;
      return;
    }
    if (group === 'sales') {
      const salesStats = salesVersionStats(state.sales);
      note.textContent = `${options[state[group]].note} 生命周期 ${fmtInt(salesStats.total)} 套，首年 ${fmtInt(salesStats.firstYear)} 套。`;
      return;
    }
    if (group === 'metal') {
      note.textContent = `${options[state[group]].note} ${metalVersionSourceText(state[group])}`.trim();
      return;
    }
    if (group === 'mix') {
      note.textContent = `${options[state[group]].note} ${mixVersionSummary(state.mix)}。`;
      return;
    }
    if (group === 'bom') {
      note.textContent = `${options[state[group]].note} ${bomVersionSourceText(state[group])}`.trim();
      return;
    }
    if (group === 'labor') {
      note.textContent = `${options[state[group]].note} ${laborVersionSourceText(state[group])}`.trim();
      return;
    }
    if (group === 'equipment') {
      note.textContent = `${options[state[group]].note} ${equipmentVersionSourceText(state[group])}`.trim();
      return;
    }
    if (group === 'packaging') {
      note.textContent = `${options[state[group]].note} ${packagingVersionSourceText(state[group])}`.trim();
      return;
    }
    note.textContent = options[state[group]].note;
  });
}

el.sheets.textContent=`${BASE.sheetCount} sheets parsed`; el.faults.textContent=`${BASE.faultCount} formula faults`; el.priceTypes.textContent=`${BASE.priceTypeCount} price types`; bind();
