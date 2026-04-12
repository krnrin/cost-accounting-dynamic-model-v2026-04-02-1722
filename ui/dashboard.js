// ═══════════════════════════════════════════
// 1. RUNTIME 初始化 & 全局变量
// ═══════════════════════════════════════════

﻿const RUNTIME = window.G281_RUNTIME || {};
const urlParams = new URLSearchParams(window.location.search);
const projectId = urlParams.get('projectId');
if (projectId) {
  const cfg = localStorage.getItem('G281_PROJECT_CONFIG_' + projectId);
  if (cfg) {
    const p = JSON.parse(cfg);
    Object.assign(window.G281_RUNTIME.master, p);
    window.G281_RUNTIME.master.projectId = projectId;
    window.G281_RUNTIME.master.projectCode = projectId;
    
    // Load harness seed data
    const seed = localStorage.getItem('G281_SEED_DATA_' + projectId);
    if (seed) {
        window.G281_RUNTIME.master.harnessSeedData = JSON.parse(seed);
    }
    // Flatten baseline for compatibility
    if (p.baseline) {
        window.G281_RUNTIME.master.years = p.baseline.annualVolumes.map(v => v.year);
        window.G281_RUNTIME.master.volumes = p.baseline.annualVolumes.map(v => v.volume);
        window.G281_RUNTIME.master.asp = window.G281_RUNTIME.master.years.map(() => 500); // Default ASP
    }
  }
}

if (!RUNTIME.master || !window.G281Engine || !window.G281Repo) {
  throw new Error('G281 runtime bundle not loaded');
}
const BASE = RUNTIME.master;
BASE.modelName = '高压线束通用成本核算平台';
BASE.name = '通用基准生命周期场景';
const BOM_CHANGE_ROWS = RUNTIME.bomChanges || [];
const BOM_VERSIONS = RUNTIME.bomVersions || {};
const PROTOCOL_STATUS = RUNTIME.connectorProtocolStatus || {};
const LABOR_VALIDATION = RUNTIME.laborValidation || {};
const PACKAGING_VALIDATION = RUNTIME.packagingValidation || {};
const CAPITAL_VALIDATION = RUNTIME.capitalValidation || {};
const WIRE_CATALOG = RUNTIME.wireCatalog || {};
const FINANCIAL_VERSIONS = RUNTIME.financialVersions || {};
const HISTORY_SEED = Array.isArray(RUNTIME.historySeed) ? RUNTIME.historySeed : [];
const repo = window.G281Repo.init(RUNTIME);
const DashboardUtils = window.G281DashboardUtils || {};
const clonePlain = DashboardUtils.clonePlain || function (value, fallback) {
  try {
    return JSON.parse(JSON.stringify(value));
  } catch (error) {
    return fallback;
  }
};
const coerceNumber = DashboardUtils.coerceNumber || function (value, fallback = 0) {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
};
const toText = DashboardUtils.toText || function (value, fallback = '') {
  const text = String(value ?? '').trim();
  return text || fallback;
};
const shallowObjectEqual = DashboardUtils.shallowObjectEqual || function (left = {}, right = {}) {
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  if (leftKeys.length !== rightKeys.length) return false;
  return leftKeys.every((key) => left[key] === right[key]);
};
const normalizeStoredBoolean = DashboardUtils.normalizeStoredBoolean || function (value, fallback = false) {
  if (value === null || value === undefined || value === '') return fallback;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  const normalized = String(value).trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  return fallback;
};
const createUniqueScenarioId = DashboardUtils.createUniqueScenarioId || function () {
  return "scenario-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
};
const PROJECT_CODE = toText(
  RUNTIME.master?.projectCode,
  toText(RUNTIME.master?.projectId, toText(BASE.projectCode, 'default-project')),
);
const factorVersionRepo = window.G281FactorVersionRepo?.create?.({ projectCode: PROJECT_CODE }) || null;
const scenarioVersionRepo = window.G281ScenarioRepo?.create?.({ projectCode: PROJECT_CODE }) || null;
const bomSemanticRepo = window.G281BomSemanticRepo?.create?.({ projectCode: PROJECT_CODE }) || null;
const bomAlignmentEngine = window.G281BomAlignmentEngine || null;
const bomDiffEngine = window.G281BomDiffEngine || null;
const scenarioVersionState = {
  records: [],
  ready: null,
};
let lastSavedVersionId = '';
const SUPPLEMENTAL_VERSION_ORDER = ['tt', 'fixed', 'quote'];
function listConfigSheetRuntimeVersionKeys() {
  const versions = RUNTIME.configSheetCopies?.versions || {};
  const meta = RUNTIME.configSheetCopies?.meta || {};
  const ordered = []
    .concat(Array.isArray(meta.availableVersions) ? meta.availableVersions : [])
    .concat(Array.isArray(meta.versionOrder) ? meta.versionOrder : [])
    .concat(Object.keys(versions))
    .filter((key, index, items) => key && versions[key] && items.indexOf(key) === index);
  return ordered.length ? ordered : Object.keys(versions);
}

function buildRuntimeConfigSheetOption(versionKey) {
  const runtimeVersion = RUNTIME.configSheetCopies?.versions?.[versionKey] || {};
  const workbookName = toText(runtimeVersion.workbook, toText(runtimeVersion.label, versionKey));
  return {
    label: toText(runtimeVersion.label, workbookName || versionKey),
    workbook: workbookName,
    source: workbookName,
    sourceNote: workbookName
      ? "来源：" + workbookName + "《配置清单》"
      : '来源：配置清单内置版本模板',
    workbookVersionKeyFallback: versionKey,
    note: '配置清单版本，支持按 Excel 式工作簿继续编辑、另存和对比。',
    createdAt: RUNTIME.configSheetCopies?.meta?.generatedAt || new Date().toISOString(),
  };
}

function ensureConfigSheetVersionGroup() {
  if (!BASE.versions.configSheet || typeof BASE.versions.configSheet !== 'object') {
    BASE.versions.configSheet = {};
  }
  listConfigSheetRuntimeVersionKeys().forEach((key) => {
    if (!BASE.versions.configSheet[key]) {
      BASE.versions.configSheet[key] = buildRuntimeConfigSheetOption(key);
    }
  });
}

const SUPPLEMENTAL_VERSION_GROUPS = {
  annualDrop: {
    quote: { label: '报价版', note: '默认年降 0.00%，保持原始 ASP 曲线。', annualRate: 0 },
    fixed: { label: '定点版', note: '默认年降 0.00%，后续可录入定点执行年降。', annualRate: 0 },
    tt: { label: 'TT版', note: '默认年降 0.00%，后续可录入试制口径年降。', annualRate: 0 },
  },
  oneTimeCustomer: {
    quote: { label: '报价版', note: '默认客户一次性费用为 0 元。', amountTotal: 0 },
    fixed: { label: '定点版', note: '默认客户一次性费用为 0 元。', amountTotal: 0 },
    tt: { label: 'TT版', note: '默认客户一次性费用为 0 元。', amountTotal: 0 },
  },
  rebate: {
    quote: { label: '报价版', note: '默认返点为 0 元/套。', amountPerSet: 0 },
    fixed: { label: '定点版', note: '默认返点为 0 元/套。', amountPerSet: 0 },
    tt: { label: 'TT版', note: '默认返点为 0 元/套。', amountPerSet: 0 },
  },
};
const VERSION_CLEANUP_KEEP_KEYS = {
  bom: ['light', 'freeze'],
  metal: ['fixed', 'quote'],
  connector: ['fixed', 'quote'],
  labor: ['optimize', 'base'],
  equipment: ['shared', 'base'],
  packaging: ['optimize', 'base'],
  sales: ['fixed', 'quote'],
  mix: ['fixed', 'quote'],
  annualDrop: ['fixed', 'quote'],
  oneTimeCustomer: ['fixed', 'quote'],
  rebate: ['fixed', 'quote'],
};

function ensureSupplementalVersionGroups() {
  const quoteCreatedAt = FINANCIAL_VERSIONS?.meta?.generatedAt || HISTORY_SEED[0]?.createdAt || new Date().toISOString();
  const fixedCreatedAt = FINANCIAL_VERSIONS?.meta?.generatedAt || quoteCreatedAt;
  const ttCreatedAt = HISTORY_SEED.find((record) => record?.state?.bom === 'regress')?.createdAt || HISTORY_SEED[HISTORY_SEED.length - 1]?.createdAt || fixedCreatedAt;
  const createdMap = { quote: quoteCreatedAt, fixed: fixedCreatedAt, tt: ttCreatedAt };

  Object.entries(SUPPLEMENTAL_VERSION_GROUPS).forEach(([group, presets]) => {
    if (!BASE.versions[group] || typeof BASE.versions[group] !== 'object') {
      BASE.versions[group] = {};
    }
    SUPPLEMENTAL_VERSION_ORDER.forEach((key) => {
      if (BASE.versions[group][key]) return;
      BASE.versions[group][key] = {
        ...presets[key],
        createdAt: createdMap[key],
      };
    });
  });
}

ensureSupplementalVersionGroups();
ensureConfigSheetVersionGroup();
const DEFAULT_CONFIG_SHEET_KEY = listConfigSheetRuntimeVersionKeys().includes('quote')
  ? 'quote'
  : (listConfigSheetRuntimeVersionKeys()[0] || 'quote');
const DEFAULT_STATE = { bom: 'freeze', metal: 'quote', connector: 'quote', labor: 'base', equipment: 'base', packaging: 'base', configSheet: DEFAULT_CONFIG_SHEET_KEY, sales: 'quote', mix: 'quote', annualDrop: 'quote', oneTimeCustomer: 'quote', rebate: 'quote', vave: 'none' };
const USER_VERSION_STORAGE_KEY = 'g281.user.version.presets.v1';
const USER_VERSION_GROUPS = ['bom', 'metal', 'connector', 'labor', 'equipment', 'packaging', 'configSheet', 'sales', 'mix', 'annualDrop', 'oneTimeCustomer', 'rebate', 'vave'];
const VERSION_GROUP_LABELS = {
  bom: 'BOM版本',
  metal: '铜铝基价',
  connector: '连接器价格',
  labor: '工时版本',
  equipment: '设备资源',
  packaging: '包装物流',
  sales: '销量预测',
  mix: '配置比例',
  annualDrop: '年降',
  oneTimeCustomer: '一次性费用(客户支付)',
  rebate: '返点(返给客户)',
  vave: 'VAVE',
};

VERSION_GROUP_LABELS.equipment = '资源投入';
VERSION_GROUP_LABELS.configSheet = '配置清单';
const TIMELINE_VERSION_GROUPS = ['bom', 'metal', 'connector', 'labor', 'equipment', 'packaging', 'annualDrop', 'oneTimeCustomer', 'rebate'];
const state = { scenarioName: BASE.name, ...DEFAULT_STATE, factory: 'K3', productionEfficiency: 0.90 };
let connectorPricingState = {};
const metalVersionLocks = {};

// 工厂费率表（来源：定点核算sheet5）
const FACTORY_RATE_TABLE = {
  'K1K2':  { label: 'K1K2工厂', directRate: 28.61, mfgRate: 16.14 },
  'K3':    { label: 'K3工厂',   directRate: 26.27, mfgRate: 15.17 },
  '高端工厂': { label: '高端工厂', directRate: 26.77, mfgRate: 20.32 },
  '其他工厂': { label: '其他工厂', directRate: 28.17, mfgRate: 15.13 },
  '高压专线': { label: '高压专线', directRate: 31.18, mfgRate: 15.81 },
};
const CHANGE_ASSESSMENT_STORAGE_KEY = 'g281.change.assessment.v1';

function loadChangeAssessment() {
  try {
    const raw = window.localStorage?.getItem(CHANGE_ASSESSMENT_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) { return null; }
}
function saveChangeAssessment(data) {
  try { window.localStorage?.setItem(CHANGE_ASSESSMENT_STORAGE_KEY, JSON.stringify(data)); } catch (e) {}
}
let changeAssessment = loadChangeAssessment() || {
  dev: { dvCost: 0, pvCost: 0 },
  process: { newToolingCost: 0, obsoleteToolingCost: 0, newEquipment: 0, obsoleteEquipment: 0, newLaborHours: 0 },
  quality: { newFixtures: 0, obsoleteFixtures: 0 },
  logistics: { obsoleteMaterialFactory: 0, obsoleteMaterialSupplier: 0, obsoleteMaterialCustomer: 0, obsoleteMaterialTransit: 0, obsoleteWip: 0, obsoleteFinished: 0 },
  remainingVolume: 0,
};
const $ = (id) => document.getElementById(id);
const el = {
  sheets: $('sheets'), faults: $('faults'), priceTypes: $('priceTypes'),
  scenarioName: $('scenarioName'),
  generateBtn: $('generateBtn'), resetBtn: $('resetBtn'), printBtn: $('printBtn'), saveVersionBtn: $('saveVersionBtn'),
  exportLayerBtn: $('exportLayerBtn'), submitApprovalBtn: $('submitApprovalBtn'),
  historyTable: $('historyTable'), approvalTable: $('approvalTable'), scenarioHistorySelect: $('scenarioHistorySelect'),
  metalVersionEditor: $('metalVersionEditor'),
  connectorPriceTable: $('connectorPriceTable'),
  initConnectorProtocolBtn: $('initConnectorProtocolBtn'), clearConnectorOverridesBtn: $('clearConnectorOverridesBtn'),
  toggleWireCatalogViewBtn: $('toggleWireCatalogViewBtn'),
  openProfitLogicBtn: $('openProfitLogicBtn'), profitLogicDrawer: $('profitLogicDrawer'), closeProfitLogicBtn: $('closeProfitLogicBtn'),
  profitInsightsContainer: $('profitInsightsContainer'),
  openVersionTimelineBtn: $('openVersionTimelineBtn'), versionTimelineDrawer: $('versionTimelineDrawer'), closeVersionTimelineBtn: $('closeVersionTimelineBtn'),
  openFactoryEfficiencyBtn: $('openFactoryEfficiencyBtn'), factoryEfficiencyModal: $('factoryEfficiencyModal'), closeFactoryEfficiencyBtn: $('closeFactoryEfficiencyBtn'),
  openConfigSheetManagerBtn: $('openConfigSheetManagerBtn'), openAnnualDropManagerBtn: $('openAnnualDropManagerBtn'), openOneTimeCustomerManagerBtn: $('openOneTimeCustomerManagerBtn'), openRebateManagerBtn: $('openRebateManagerBtn'),
  versionTemplateModal: $('versionTemplateModal'), closeVersionTemplateBtn: $('closeVersionTemplateBtn'), versionTemplateTitle: $('versionTemplateTitle'),
  minimizeVersionTemplateWindowBtn: $('minimizeVersionTemplateWindowBtn'), toggleVersionTemplateWindowBtn: $('toggleVersionTemplateWindowBtn'),
  versionTemplateResetBtn: $('versionTemplateResetBtn'), versionTemplateSaveBtn: $('versionTemplateSaveBtn'), versionTemplateSaveInlineBtn: $('versionTemplateSaveInlineBtn'),
  versionTemplateInsertRowBtn: $('versionTemplateInsertRowBtn'), versionTemplateInsertColumnBtn: $('versionTemplateInsertColumnBtn'),
  versionTemplateMergeBtn: $('versionTemplateMergeBtn'), versionTemplateUnmergeBtn: $('versionTemplateUnmergeBtn'),
  versionTemplateFilterBtn: $('versionTemplateFilterBtn'), versionTemplateConditionalBtn: $('versionTemplateConditionalBtn'),
  versionTemplateInsertImageBtn: $('versionTemplateInsertImageBtn'), versionTemplateAddSheetBtn: $('versionTemplateAddSheetBtn'),
  versionTemplateParseBtn: $('versionTemplateParseBtn'), versionTemplatePasteArea: $('versionTemplatePasteArea'), versionTemplateFields: $('versionTemplateFields'),
  versionTemplateStatusText: $('versionTemplateStatusText'), versionTemplateMetaText: $('versionTemplateMetaText'),
  workspaceShell: $('workspaceShell'), workspacePageTabs: $('workspacePageTabs'), workspacePagePanels: document.querySelectorAll('[data-workspace-page]'),
  profitActionBar: $('profitActionBar'),
  eventTable: $('eventTable'),
};

function openManagedModal(controller) {
  if (!controller || typeof controller.open !== 'function') return;
  controller.open();
}

const controls = {
  factory: $('factory'),
  productionEfficiency: $('productionEfficiency'),
};

const yearInputs = Array.from({ length: 10 }, (_, i) => $("year" + (i + 1)));
const mixInputs = Array.from({ length: 10 }, (_, i) => $("mix" + (i + 1)));

// ═══════════════════════════════════════════
// 2. 格式化工具函数
// ═══════════════════════════════════════════

const fmtMoney = (v, d = 2) => Number(v || 0).toLocaleString('zh-CN', { minimumFractionDigits: d, maximumFractionDigits: d });
const fmtNumber = (v, d = 2) => Number(v || 0).toLocaleString('zh-CN', { minimumFractionDigits: d, maximumFractionDigits: d });
const fmtMaybeMoney = (v, d = 2) => {
  const n = Number(v);
  return Number.isNaN(n) ? '—' : Number.isFinite(n) ? fmtMoney(n, d) : '∞';
};
const fmtMaybeNumber = (v, d = 2) => {
  const n = Number(v);
  return Number.isNaN(n) ? '—' : Number.isFinite(n) ? fmtNumber(n, d) : '∞';
};
const fmtMetric = (v, d = 2) => {
  const n = Number(v);
  return Number.isNaN(n) ? '—' : n.toFixed(d);
};
const fmtInt = (v) => Math.round(Number(v || 0)).toLocaleString('zh-CN');
const fmtPct = (v, d = 2) => (Number(v || 0) * 100).toFixed(d) + '%';
const fmtSigned = (v, d = 2) => (Number(v || 0) >= 0 ? '+' : '') + Math.abs(Number(v || 0)).toFixed(d);
const fmtSignedMoney = (v) => (Number(v || 0) >= 0 ? '+' : '') + fmtMoney(Math.abs(Number(v || 0)));
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

// ═══════════════════════════════════════════
// 3. 子模块 Stub 函数（由 dash_*.js 覆盖）
// ═══════════════════════════════════════════

function refreshScenarioVersionState() { /* stub - overridden by sub-module */ }
function versionTemplateStatusText() { /* stub - overridden by sub-module */ }
function syncVersionTemplateWindowControls() { /* stub - overridden by sub-module */ }
function mountProfitLogicDrawer() { /* stub - overridden by sub-module */ }
function ensureProfitInsights() { /* stub - overridden by sub-module */ }
function updateDashboardBridge() { /* stub - overridden by sub-module */ }
function ensureFactoryEfficiencyView() { /* stub - overridden by sub-module */ }
function ensureVersionAddButtons() { /* stub - overridden by sub-module */ }
function saveScenarioVersionRecord() { /* stub - overridden by sub-module */ }
function renderVersionGroupChips() { /* stub - overridden by sub-module */ }
function renderVersionGroupNote() { /* stub - overridden by sub-module */ }
function renderVersionTimeline() { /* stub - overridden by sub-module */ }
function renderKanbanScenario() { /* stub - overridden by sub-module */ }
function renderKanbanComparison() { /* stub - overridden by sub-module */ }
function renderKanbanWaterfall() { /* stub - overridden by sub-module */ }
function renderKanbanProfit() { /* stub - overridden by sub-module */ }
function renderCharts() { /* stub - overridden by sub-module */ }
function renderHarnessTable() { /* stub - overridden by sub-module */ }
function renderBOM() { /* stub - overridden by sub-module */ }
function renderConnectorPricing() { /* stub - overridden by sub-module */ }
function renderWireCatalog() { /* stub - overridden by sub-module */ }
function renderLaborValidation() { /* stub - overridden by sub-module */ }
function renderPackagingValidation() { /* stub - overridden by sub-module */ }
function renderCapitalValidation() { /* stub - overridden by sub-module */ }
function renderFinancialVersions() { /* stub - overridden by sub-module */ }
function renderHistory() { /* stub - overridden by sub-module */ }
function renderApprovals() { /* stub - overridden by sub-module */ }
function renderProjectInfo() { /* stub - overridden by sub-module */ }
function renderScenarioInfo() { /* stub - overridden by sub-module */ }

// ═══════════════════════════════════════════
// 4. 核心函数
// ═══════════════════════════════════════════

const connectorItems = [
  { id: 'HV_INTER_01', label: '高压互锁连接器A', type: 'harness', category: 'connector' },
  { id: 'HV_INTER_02', label: '高压互锁连接器B', type: 'harness', category: 'connector' },
  { id: 'HV_POW_01', label: '动力电池连接器A', type: 'harness', category: 'connector' },
  { id: 'HV_POW_02', label: '动力电池连接器B', type: 'harness', category: 'connector' },
  { id: 'HV_MTR_01', label: '电机控制器连接器', type: 'harness', category: 'connector' },
  { id: 'HV_CHG_01', label: '充电插座连接器', type: 'harness', category: 'connector' },
];
const connectorItemIdSet = new Set(connectorItems.map(item => item.id));
const connectorVersionSet = new Set(['tt', 'fixed', 'quote']);
const connectorStageMetaMap = {
  quote: { label: '报价版', note: '默认报价协议价。' },
  fixed: { label: '定点版', note: '默认定点协议价。' },
  tt: { label: 'TT版', note: '默认试制协议价。' },
};

function clearDirty() { BASE.isDirty = false; }
function markDirty() { BASE.isDirty = true; }
function renderScenarioHistorySelect() {
  if (!el.scenarioHistorySelect) return;
  const history = repo.getHistory();
  const currentVal = el.scenarioHistorySelect.value;
  el.scenarioHistorySelect.innerHTML = '<option value="">-- 历史版本 --</option>';
  history.forEach((record) => {
    const option = document.createElement('option');
    option.value = record.id;
    option.textContent = (record.id === lastSavedVersionId ? '✓ ' : '') + record.note + ' (' + new Date(record.createdAt).toLocaleString() + ')';
    el.scenarioHistorySelect.appendChild(option);
  });
  el.scenarioHistorySelect.value = currentVal;
}
function generate() {
  const model = calcModel();
  render(model);
}
function calcModel() {
  const m = window.G281Engine.calculate(BASE, state);
  return m;
}
function render(m) {
  renderKanbanScenario(m);
  renderKanbanComparison(m);
  renderKanbanWaterfall(m);
  renderKanbanProfit(m);
  renderCharts(m);
  renderHarnessTable(m);
  renderBOM(m);
  renderConnectorPricing(m);
  renderWireCatalog(m);
  renderLaborValidation(m);
  renderPackagingValidation(m);
  renderCapitalValidation(m);
  renderFinancialVersions(m);
  renderHistory(m);
  renderApprovals(m);
  renderProjectInfo(m);
  renderScenarioInfo(m);
}
function syncInputs() {
  el.scenarioName.value = state.scenarioName;
  controls.factory.value = state.factory;
  controls.productionEfficiency.value = (state.productionEfficiency * 100).toFixed(0);
  yearInputs.forEach((input, i) => { if (input) input.value = BASE.volumes[i] || 0; });
  mixInputs.forEach((input, i) => { if (input) input.value = (BASE.mixes?.[i] || 0) * 100; });
}
function bind() {
  setupProfitHomepage();
  bindWorkspaceTabs();
  updateDashboardBridge();
  void refreshScenarioVersionState({ force: true }).then(() => {
    renderScenarioHistorySelect();
  });
  mountProfitLogicDrawer();
  ensureProfitInsights();
  ensureFactoryEfficiencyView();
  ensureVersionAddButtons();
  syncVersionTemplateWindowControls();
  renderVersions(); syncInputs(); generate();
  applyDashboardDebugHooks();
  el.generateBtn.addEventListener('click', generate);
  el.resetBtn.addEventListener('click', reset);
  el.printBtn.addEventListener('click', () => window.print());
  el.saveVersionBtn.addEventListener('click', async () => {
    const model = calcModel();
    const record = repo.createHistoryRecord(model);
    repo.saveHistory(record);
    lastSavedVersionId = record.id;
    await saveScenarioVersionRecord(model, { scenarioId: record.id, note: record.note || '' });
    render(model);
  });
  bindWorkspaceTabs();
}
function reset() {
  Object.assign(state, DEFAULT_STATE);
  state.scenarioName = BASE.name;
  syncInputs();
  generate();
}
function renderVersions() {
  Object.entries(BASE.versions).forEach(([group, options]) => {
    const box = document.querySelector('.option-row[data-group="' + group + '"]');
    if (!box) return;
    renderVersionGroupChips(group, options, box);
    const note = $(group + 'Note');
    if (!note) return;
    const currentOption = options?.[state[group]] || { label: state[group], note: '' };
    renderVersionGroupNote(group, options, note, currentOption);
  });
  renderVersionTimeline();
}
el.sheets.textContent = BASE.sheetCount + ' sheets parsed';
el.faults.textContent = BASE.faultCount + ' formula faults';
el.priceTypes.textContent = BASE.priceTypeCount + ' price types';
bind();
