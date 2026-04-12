const RUNTIME = window.G281_RUNTIME || {};
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
      ? `来源：${workbookName}《配置清单》`
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

function ensureDashboardUiScaffold() {
  if (document.body.dataset.scaffoldDone === 'true') return;
  document.body.dataset.scaffoldDone = 'true';
  const brandTitle = document.querySelector('.sidebar .brand h1');
  if (brandTitle) {
    brandTitle.id = brandTitle.id || 'openProfitLogicBtn';
    brandTitle.classList.add('engine-trigger');
    brandTitle.setAttribute('role', 'button');
    brandTitle.setAttribute('tabindex', '0');
    brandTitle.setAttribute('aria-label', '打开动态利润引擎逻辑说明');
  }

  const duplicateInsightMounts = Array.from(document.querySelectorAll('#profitInsightsMount'));
  duplicateInsightMounts.slice(1).forEach((node) => node.remove());

  const legacyWireHeading = document.querySelector('.harness-profit-section .section-subtitle');
  if (legacyWireHeading?.textContent?.includes('导线')) {
    legacyWireHeading.parentElement?.remove();
  }
  const legacyWireTable = document.getElementById('wireProfitTable');
  legacyWireTable?.closest('.table-wrap')?.remove();

  const main = document.querySelector('.main');
  const scenarioPanel = document.getElementById('scenarioConfigPanel') || document.querySelector('.sidebar > .panel');
  const versionPanel = document.getElementById('costVersionPanel') || document.querySelectorAll('.sidebar > .panel')[1] || null;
  const heroSection = document.getElementById('legacyHeroSection') || document.querySelector('.main > .hero');
  const legacySidebarPanels = [
    document.getElementById('volumeMirrorPanel'),
    document.getElementById('packSplitPanel'),
    document.getElementById('annualVolumePanel'),
    document.getElementById('mixConfigPanel'),
  ].filter(Boolean);

  if (versionPanel) {
    versionPanel.classList.add('version-management-panel');
    const versionTitle = versionPanel.querySelector('h2');
    if (versionTitle) {
      versionTitle.textContent = '成本要素版本管理';
      versionTitle.textContent = '成本要素版本管理';
    }
  }

  versionPanel?.querySelector('h2')?.replaceChildren('成本要素版本管理');

  const versionTimelineTrigger = versionPanel?.querySelector('h2');
  if (versionTimelineTrigger) {
    versionTimelineTrigger.textContent = '成本要素版本管理';
    versionTimelineTrigger.id = 'openVersionTimelineBtn';
    versionTimelineTrigger.classList.add('version-management-trigger');
    versionTimelineTrigger.setAttribute('role', 'button');
    versionTimelineTrigger.setAttribute('tabindex', '0');
    versionTimelineTrigger.setAttribute('aria-haspopup', 'dialog');
    versionTimelineTrigger.setAttribute('title', '打开版本时间线');
  }

  if (versionPanel) {
    const ensureVersionGroup = (group, title, subtitle, noteId, extraClass = '') => {
      if (versionPanel.querySelector(`.option-row[data-group="${group}"]`)) return;
      const wrapper = document.createElement('div');
      wrapper.className = `version-group ${extraClass}`.trim();
      wrapper.innerHTML = `
        <div class="version-title"><span>${title}</span><span>${subtitle}</span></div>
        <div class="option-row" data-group="${group}"></div>
        <div class="version-note" id="${noteId}"></div>
      `.trim();
      const anchor = versionPanel.querySelector('.option-row[data-group="vave"]')?.closest('.version-group') || null;
      if (anchor) {
        versionPanel.insertBefore(wrapper, anchor);
      } else {
        versionPanel.appendChild(wrapper);
      }
    };
    ensureVersionGroup('annualDrop', '年降', 'ASP 年度降幅', 'annualDropNote');
    ensureVersionGroup('oneTimeCustomer', '一次性费用(客户支付)', '生命周期返补', 'oneTimeCustomerNote');
    ensureVersionGroup('rebate', '返点(返给客户)', '单套返利', 'rebateNote');
    [
      ['annualDrop', '年降', 'ASP 年度降幅'],
      ['oneTimeCustomer', '一次性费用(客户支付)', '生命周期返补'],
      ['rebate', '返点(返给客户)', '单套返利'],
    ].forEach(([group, title, subtitle]) => {
      const titleSpans = versionPanel.querySelectorAll(`.option-row[data-group="${group}"]`)?.[0]
        ?.closest('.version-group')
        ?.querySelectorAll('.version-title span');
      if (titleSpans?.[0]) titleSpans[0].textContent = title;
      if (titleSpans?.[1]) titleSpans[1].textContent = subtitle;
    });
    ensureVersionGroup('configSheet', '配置清单', '配置总成 / 车型差异', 'configSheetNote');
    const equipmentTitleSpans = versionPanel.querySelector(`.option-row[data-group="equipment"]`)
      ?.closest('.version-group')
      ?.querySelectorAll('.version-title span');
    if (equipmentTitleSpans?.[0]) equipmentTitleSpans[0].textContent = '资源投入';
    if (equipmentTitleSpans?.[1]) equipmentTitleSpans[1].textContent = '折旧 / 产线';
    versionPanel.querySelector('.option-row[data-group="vave"]')?.closest('.version-group')?.remove();
    ['sales', 'mix'].forEach((group) => {
      versionPanel.querySelector(`.option-row[data-group="${group}"]`)?.closest('.version-group')?.classList.add('legacy-hidden-panel');
    });
  }

  legacySidebarPanels.forEach((panel) => panel.classList.add('legacy-hidden-panel'));

  if (main) {
    let workspaceShell = document.getElementById('workspaceShell');
    if (!workspaceShell) {
      workspaceShell = document.createElement('section');
      workspaceShell.id = 'workspaceShell';
      workspaceShell.className = 'workspace-shell';
      workspaceShell.innerHTML = `
        <div class="workspace-browser-bar">
          <div class="workspace-browser-tabs" id="workspacePageTabs" role="tablist" aria-label="工作页面切换">
            <button type="button" class="workspace-browser-tab is-active" id="workspaceTabProfit" data-workspace-tab="profit" role="tab" aria-selected="true" aria-controls="profitWorkspacePage">
              <span class="workspace-browser-tab-favicon workspace-browser-tab-favicon-profit" aria-hidden="true"></span>
              <span class="workspace-browser-tab-copy">
                <strong>利润总览</strong>
                <span>动态利润引擎</span>
              </span>
            </button>
            <button type="button" class="workspace-browser-tab" id="workspaceTabWorkflow" data-workspace-tab="workflow" role="tab" aria-selected="false" aria-controls="workflowWorkspacePage">
              <span class="workspace-browser-tab-favicon workspace-browser-tab-favicon-workflow" aria-hidden="true"></span>
              <span class="workspace-browser-tab-copy">
                <strong>流转视图</strong>
                <span>任务、回收、线束执行跟踪</span>
              </span>
            </button>
            <button type="button" class="workspace-browser-tab" id="workspaceTabData" data-workspace-tab="data" role="tab" aria-selected="false" aria-controls="dataWorkspacePage">
              <span class="workspace-browser-tab-favicon workspace-browser-tab-favicon-data" aria-hidden="true"></span>
              <span class="workspace-browser-tab-copy">
                <strong>数据管理</strong>
                <span>BOM / 资源 / 工时 / 包装</span>
              </span>
            </button>
          </div>
        </div>
        <div class="workspace-pages">
          <section class="workspace-page is-active" id="profitWorkspacePage" data-workspace-page="profit" role="tabpanel" aria-labelledby="workspaceTabProfit"></section>
          <section class="workspace-page" id="workflowWorkspacePage" data-workspace-page="workflow" role="tabpanel" aria-labelledby="workspaceTabWorkflow" hidden></section>
          <section class="workspace-page" id="dataWorkspacePage" data-workspace-page="data" role="tabpanel" aria-labelledby="workspaceTabData" hidden></section>
        </div>
      `.trim();
      main.prepend(workspaceShell);
    }
    const profitWorkspacePage = workspaceShell.querySelector('#profitWorkspacePage');
    if (profitWorkspacePage && !profitWorkspacePage.querySelector('#quoteControlStripSection')) {
      const quoteControlStrip = document.createElement('section');
      quoteControlStrip.id = 'quoteControlStripSection';
      quoteControlStrip.className = 'quote-control-strip card';
      quoteControlStrip.innerHTML = `
        <div class="quote-control-head">
          <div>
            <div class="eyebrow">QUOTE WORKSPACE</div>
            <h3>报价与执行预演工作台</h3>
            <p class="section-note">主口径面向工厂端实际执行利润。项目报价建立客户执行基线，变更报价必须绑定基线版本；销售填写回收规则，系统只承载预演与跟踪。</p>
          </div>
          <div class="quote-type-switcher-wrap" id="quoteTypeSwitcherMount"></div>
        </div>
        <div class="quote-control-topline">
          <article class="quote-control-card">
            <h4>基线报价版本</h4>
            <div id="baselineQuoteInfoMount"></div>
          </article>
          <article class="quote-control-card">
            <h4>数据责任</h4>
            <div id="dataResponsibilityMount"></div>
          </article>
        </div>
        <div class="quote-control-grid">
          <article class="quote-control-card">
            <h4>报价协作</h4>
            <div id="quoteWorkflowMount"></div>
          </article>
          <article class="quote-control-card">
            <h4>销售规则</h4>
            <div id="salesRuleMount"></div>
          </article>
          <article class="quote-control-card">
            <h4>回收与触发</h4>
            <div id="recoveryTriggerMount"></div>
          </article>
        </div>
      `.trim();
      profitWorkspacePage.appendChild(quoteControlStrip);
    }
    if (profitWorkspacePage && !profitWorkspacePage.querySelector('#projectProfitSummarySection')) {
      const projectSummarySection = document.createElement('section');
      projectSummarySection.id = 'projectProfitSummarySection';
      projectSummarySection.className = 'project-profit-summary-shell card';
      projectSummarySection.innerHTML = `
        <div class="project-profit-summary-head">
          <div>
            <div class="eyebrow">PROJECT EVALUATION SUMMARY</div>
            <h3>项目评估汇总</h3>
            <p class="section-note">第一屏先按项目评估汇总方式看收入、成本、资本投入与单线束利润焦点，再下钻驱动分析。</p>
          </div>
          <div class="project-profit-summary-badges" id="projectProfitSummaryBadges"></div>
        </div>
        <div class="project-profit-summary-layout">
          <div class="project-profit-summary-main" id="projectProfitSummaryMount"></div>
          <aside class="project-profit-summary-side">
            <article class="project-profit-side-card">
              <h4>年度利润节奏</h4>
              <div id="projectProfitAnnualMount"></div>
            </article>
            <article class="project-profit-side-card">
              <h4>单线束焦点</h4>
              <div id="harnessProfitMount"></div>
            </article>
          </aside>
        </div>
      `.trim();
      profitWorkspacePage.appendChild(projectSummarySection);
    }

    let timelineStrip = document.getElementById('versionTimelineSection') || main.querySelector('.timeline-strip');
    if (!timelineStrip) {
      timelineStrip = document.createElement('section');
      timelineStrip.className = 'timeline-strip card';
      timelineStrip.innerHTML = `
        <div class="hero-block-head timeline-strip-head">
          <div>
            <h3>鐗堟湰鍙戝竷鏃堕棿绾?</h3>
            <p class="section-note">灞曠ず鍚勬垚鏈绱犵増鏈殑鍙戝竷鏃堕棿銆佹渶杩戞洿鏂板拰褰撳墠鐢熸晥鐗堟湰銆?/p>
          </div>
          <div id="timelineScenarioTagsWrap" class="hero-badges"></div>
        </div>
        <div id="versionTimelineMount" class="timeline-strip-mount"></div>
      `.trim();
      main.insertBefore(timelineStrip, main.firstChild);
    }
    const timelineTitle = timelineStrip.querySelector('.timeline-strip-head h3');
    if (timelineTitle) {
      timelineTitle.textContent = '版本发布时间线';
    }
    const timelineNote = timelineStrip.querySelector('.timeline-strip-head .section-note');
    if (timelineNote) {
      timelineNote.textContent = '展示各成本要素版本的发布时间、最近更新时间和当前生效版本。';
    }

    timelineTitle?.replaceChildren('版本发布时间线');
    timelineNote?.replaceChildren('显示各成本要素版本的发布时间、最近更新时间和当前生效版本。');

    let timelineDrawer = document.getElementById('versionTimelineDrawer');
    if (!timelineDrawer) {
      timelineDrawer = document.createElement('div');
      timelineDrawer.id = 'versionTimelineDrawer';
      timelineDrawer.className = 'timeline-drawer';
      timelineDrawer.hidden = true;
      timelineDrawer.setAttribute('aria-hidden', 'true');
      timelineDrawer.innerHTML = `
        <div class="timeline-drawer-backdrop" data-version-timeline-close></div>
        <section class="timeline-drawer-panel" id="versionTimelineDrawerPanel" role="dialog" aria-modal="true" aria-labelledby="versionTimelineDrawerTitle"></section>
      `.trim();
      document.body.appendChild(timelineDrawer);
    }
    const timelineDrawerPanel = timelineDrawer.querySelector('#versionTimelineDrawerPanel');
    if (timelineTitle) {
      timelineTitle.id = 'versionTimelineDrawerTitle';
      timelineTitle.textContent = '时间线';
    }
    if (timelineNote) {
      timelineNote.textContent = '';
      timelineNote.hidden = true;
    }
    timelineStrip.classList.add('is-drawer-panel');
    timelineStrip.removeAttribute('hidden');
    timelineStrip.setAttribute('aria-hidden', 'false');
    let timelineCloseButton = timelineStrip.querySelector('#closeVersionTimelineBtn');
    if (!timelineCloseButton) {
      timelineCloseButton = document.createElement('button');
      timelineCloseButton.type = 'button';
      timelineCloseButton.id = 'closeVersionTimelineBtn';
      timelineCloseButton.className = 'timeline-strip-close';
      timelineCloseButton.setAttribute('data-version-timeline-close', 'true');
      timelineCloseButton.textContent = '关闭';
      timelineStrip.querySelector('.timeline-strip-head')?.appendChild(timelineCloseButton);
    }

    let quoteMatrixDrawer = document.getElementById('quoteMatrixDrawer');
    if (!quoteMatrixDrawer) {
      quoteMatrixDrawer = document.createElement('div');
      quoteMatrixDrawer.id = 'quoteMatrixDrawer';
      quoteMatrixDrawer.className = 'quote-matrix-drawer';
      quoteMatrixDrawer.hidden = true;
      quoteMatrixDrawer.setAttribute('aria-hidden', 'true');
      quoteMatrixDrawer.innerHTML = `
        <div class="quote-matrix-drawer-backdrop" data-quote-matrix-close></div>
        <section class="quote-matrix-drawer-panel" role="dialog" aria-modal="true" aria-labelledby="quoteMatrixDrawerTitle">
          <div class="timeline-strip-head">
            <div>
              <h3 id="quoteMatrixDrawerTitle">报价版费用来源</h3>
              <p class="section-note" id="quoteMatrixDrawerMeta"></p>
            </div>
            <button type="button" class="timeline-strip-close" data-quote-matrix-close>关闭</button>
          </div>
          <div class="quote-matrix-drawer-body" id="quoteMatrixDrawerBody"></div>
        </section>
      `.trim();
      document.body.appendChild(quoteMatrixDrawer);
    }

    let managementGrid = document.getElementById('managementTopGrid') || main.querySelector('.management-top-grid');
    if (!managementGrid) {
      managementGrid = document.createElement('section');
      managementGrid.id = 'managementTopGrid';
      managementGrid.className = 'management-top-grid';
      const insertBeforeNode = heroSection || main.children[1] || null;
      main.insertBefore(managementGrid, insertBeforeNode);
    }
    managementGrid.className = 'management-top-grid';
    // 若尚未初始化为看板结构，强制写入四格看板
    if (!managementGrid.querySelector('#kanbanScenario')) {
      managementGrid.innerHTML = `
        <section class="kanban-module kanban-module--scenario" id="kanbanScenario">
          <div class="kanban-module-head">
            <span class="kanban-module-icon"></span>
            <span class="kanban-module-title">场景管理</span>
            <span class="kanban-module-subtitle">版本组合 / 工厂 / 保存</span>
          </div>
          <div id="sceneManagementMount"></div>
          <div id="kanbanScenarioBody" class="kanban-module-body"></div>
          <div class="kanban-actions" id="sceneToolbar"></div>
        </section>
        <section class="kanban-module kanban-module--price" id="kanbanPrice">
          <div class="kanban-module-head">
            <span class="kanban-module-icon"></span>
            <span class="kanban-module-title">价格管理</span>
            <span class="kanban-module-subtitle">铜铝 / 连接器 / 导线 / 包装 / 工时费率</span>
          </div>
          <div id="kanbanPriceBody" class="kanban-module-body"></div>
          <div class="kanban-actions" id="kanbanPriceActions"></div>
        </section>
        <section class="kanban-module kanban-module--data" id="kanbanData">
          <div class="kanban-module-head">
            <span class="kanban-module-icon"></span>
            <span class="kanban-module-title">数据管理</span>
            <span class="kanban-module-subtitle">BOM / 工时 / 资源 / 效率</span>
          </div>
          <div id="dataToolbarExtraMount" class="data-toolbar-extra" style="display:none"></div>
          <div id="kanbanDataBody" class="kanban-module-body"></div>
          <div class="kanban-actions" id="dataToolbar"></div>
        </section>
        <section class="kanban-module kanban-module--change" id="kanbanChange">
          <div class="kanban-module-head">
            <span class="kanban-module-icon"></span>
            <span class="kanban-module-title">变更管理</span>
            <span class="kanban-module-subtitle">差异BOM / 影响评估 / 变更报价</span>
          </div>
          <div id="kanbanChangeBody" class="kanban-module-body"></div>
          <div class="kanban-actions" id="kanbanChangeActions"></div>
        </section>
      `.trim();
    }
    if (managementGrid.parentElement !== main) {
      main.insertBefore(managementGrid, heroSection || main.firstChild || null);
    }
    if (timelineStrip.parentElement !== main) {
      main.insertBefore(timelineStrip, heroSection || null);
    }
    if (managementGrid.nextElementSibling !== timelineStrip) {
      main.insertBefore(timelineStrip, managementGrid.nextSibling);
    }
    if (timelineDrawerPanel && !timelineDrawerPanel.contains(timelineStrip)) {
      timelineDrawerPanel.appendChild(timelineStrip);
    }
    // 新看板结构无需同步 hero-block-head 文字

    const sceneMount = managementGrid.querySelector('#sceneManagementMount');
    if (scenarioPanel && sceneMount && !sceneMount.contains(scenarioPanel)) {
      scenarioPanel.classList.remove('legacy-hidden-panel');
      scenarioPanel.classList.add('scene-management-panel');
      if (!scenarioPanel.querySelector('#scenarioHistorySelect')) {
        const historyField = document.createElement('label');
        historyField.className = 'field scene-history-field';
        historyField.innerHTML = `
          <span>已保存场景</span>
          <select id="scenarioHistorySelect">
            <option value="">当前场景（未保存）</option>
          </select>
        `.trim();
        const summaryAnchor = scenarioPanel.querySelector('#activeSummary');
        scenarioPanel.insertBefore(historyField, summaryAnchor || null);
      }
      const summary = scenarioPanel.querySelector('#activeSummary');
      const tags = document.getElementById('scenarioTags');
      const timelineTagsWrap = document.getElementById('timelineScenarioTagsWrap');
      sceneMount.appendChild(scenarioPanel);
      if (tags && timelineTagsWrap && !timelineTagsWrap.contains(tags)) {
        timelineTagsWrap.appendChild(tags);
      }
      if (summary) {
        sceneMount.appendChild(summary);
      }
    }

    const sceneToolbar = managementGrid.querySelector('#sceneToolbar');
    const dataToolbar = managementGrid.querySelector('#dataToolbar');
    if (heroSection) {
      const heroToolbar = heroSection.querySelector('.toolbar');
      ['generateBtn', 'resetBtn', 'printBtn', 'saveVersionBtn', 'submitApprovalBtn'].forEach((id) => {
        const node = document.getElementById(id);
        if (node && sceneToolbar && !sceneToolbar.contains(node)) {
          sceneToolbar.appendChild(node);
        }
      });
      // 价格管理按钮
      const priceActions = managementGrid.querySelector('#kanbanPriceActions');
      ['openAnnualDropManagerBtn', 'openOneTimeCustomerManagerBtn', 'openRebateManagerBtn'].forEach((id) => {
        const node = document.getElementById(id);
        if (node && priceActions && !priceActions.contains(node)) {
          priceActions.appendChild(node);
        }
      });
      // 数据管理按钮
      ['openBomValidationBtn', 'openConfigSheetManagerBtn', 'openCapitalValidationBtn', 'openLaborValidationBtn', 'openPackagingValidationBtn', 'openFactoryEfficiencyBtn'].forEach((id) => {
        const node = document.getElementById(id);
        if (node && dataToolbar && !dataToolbar.contains(node)) {
          dataToolbar.appendChild(node);
        }
      });
      // 变更管理按钮
      const changeActions = managementGrid.querySelector('#kanbanChangeActions');
      const exportButton = document.getElementById('exportLayerBtn');
      if (exportButton && changeActions && !changeActions.contains(exportButton)) {
        changeActions.appendChild(exportButton);
      }
      heroSection.classList.add('legacy-hidden-panel');
      heroSection.setAttribute('aria-hidden', 'true');
    }
  }

  const heroToolbar = document.getElementById('dataToolbar') || document.querySelector('.hero .toolbar');
  if (heroToolbar && !document.getElementById('openFactoryEfficiencyBtn')) {
    const button = document.createElement('button');
    button.type = 'button';
    button.id = 'openFactoryEfficiencyBtn';
    button.className = 'button ghost';
    button.textContent = '工厂效率 / 运营费率';
    heroToolbar.appendChild(button);
  }

  if (heroToolbar && !document.getElementById('openConfigSheetManagerBtn')) {
    const button = document.createElement('button');
    button.type = 'button';
    button.id = 'openConfigSheetManagerBtn';
    button.className = 'button ghost';
    button.textContent = '配置清单管理';
    const bomButton = document.getElementById('openBomValidationBtn');
    if (bomButton?.nextSibling) {
      heroToolbar.insertBefore(button, bomButton.nextSibling);
    } else {
      heroToolbar.appendChild(button);
    }
  }

  const importInput = document.getElementById('importBomValidationFile');
  if (importInput) {
    importInput.setAttribute('accept', '.json,.xlsx,.xlsm,.xlsb,.xls,application/json,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel');
  }

  const bomToolbar = document.querySelector('#bomValidationModal .bom-validate-toolbar');
  if (bomToolbar && !document.getElementById('exportBomValidationBtn')) {
    const importButton = document.getElementById('importBomValidationBtn');
    const exportButton = document.createElement('button');
    exportButton.type = 'button';
    exportButton.id = 'exportBomValidationBtn';
    exportButton.className = 'button ghost';
    exportButton.textContent = '导出原生BOM';
    if (importButton?.nextSibling) {
      bomToolbar.insertBefore(exportButton, importButton.nextSibling);
    } else {
      bomToolbar.appendChild(exportButton);
    }
  }

  if (!document.getElementById('factoryEfficiencyModal')) {
    const wrapper = document.createElement('div');
    wrapper.innerHTML = `
      <div class="bom-modal" id="factoryEfficiencyModal" hidden aria-hidden="true">
        <div class="bom-modal-backdrop" data-factory-efficiency-close></div>
        <section class="bom-modal-panel factory-efficiency-modal-panel" role="dialog" aria-modal="true" aria-labelledby="factoryEfficiencyTitle">
          <div class="bom-modal-head">
            <div>
              <div class="eyebrow">Factory Workspace</div>
              <h3 id="factoryEfficiencyTitle">工厂效率与运营工时费率</h3>
              <p class="section-note">这里用于查看各工厂效率与运营工时费率，当前先以离线模板承载，后续可以继续接入版本化数据。</p>
            </div>
            <div class="bom-validate-toolbar">
              <button class="button ghost bom-close-btn" id="closeFactoryEfficiencyBtn" type="button">关闭</button>
            </div>
          </div>
          <div id="factoryEfficiencyMount" class="factory-efficiency-mount"></div>
        </section>
      </div>
    `.trim();
    document.body.appendChild(wrapper.firstElementChild);
  }
}

ensureDashboardUiScaffold();
const initialCapitalButton = document.getElementById('openCapitalValidationBtn');
if (initialCapitalButton) {
  initialCapitalButton.textContent = '资源投入管理';
}
const initialCapitalTitle = document.getElementById('capitalValidationTitle');
if (initialCapitalTitle) {
  initialCapitalTitle.textContent = '资源投入管理';
}
function syncManagementButtonLabel(button, baseText) {
  if (!button) return;
  const suffixMatch = String(button.textContent || '').match(/\([^)]*\)\s*$/);
  button.textContent = suffixMatch ? `${baseText} ${suffixMatch[0].trim()}` : baseText;
}
function syncManagementButtonLabels() {
  syncManagementButtonLabel(document.getElementById('openBomValidationBtn'), 'BOM 管理');
  syncManagementButtonLabel(document.getElementById('openCapitalValidationBtn'), '资源投入管理');
  syncManagementButtonLabel(document.getElementById('openLaborValidationBtn'), '工时管理');
  syncManagementButtonLabel(document.getElementById('openPackagingValidationBtn'), '包装物流管理');
  syncManagementButtonLabel(document.getElementById('openAnnualDropManagerBtn'), '年降管理');
  syncManagementButtonLabel(document.getElementById('openOneTimeCustomerManagerBtn'), '一次性费用管理');
  syncManagementButtonLabel(document.getElementById('openRebateManagerBtn'), '返点管理');
  syncManagementButtonLabel(document.getElementById('openFactoryEfficiencyBtn'), '工厂效率 / 运营费率');
}
const initialFactoryButton = document.getElementById('openFactoryEfficiencyBtn');
if (initialFactoryButton) {
  initialFactoryButton.textContent = '工厂效率 / 运营费率';
}
const initialConfigSheetButton = document.getElementById('openConfigSheetManagerBtn');
if (initialConfigSheetButton) {
  initialConfigSheetButton.textContent = '配置清单管理';
}
const initialAnnualDropButton = document.getElementById('openAnnualDropManagerBtn');
if (initialAnnualDropButton) {
  initialAnnualDropButton.textContent = '年降管理';
}
const initialOneTimeCustomerButton = document.getElementById('openOneTimeCustomerManagerBtn');
if (initialOneTimeCustomerButton) {
  initialOneTimeCustomerButton.textContent = '一次性费用管理';
}
const initialRebateButton = document.getElementById('openRebateManagerBtn');
if (initialRebateButton) {
  initialRebateButton.textContent = '返点管理';
}
const initialExportBomButton = document.getElementById('exportBomValidationBtn');
if (initialExportBomButton) {
  initialExportBomButton.textContent = '导出原生BOM';
}
const initialLogicTrigger = document.getElementById('openProfitLogicBtn');
if (initialLogicTrigger) {
  initialLogicTrigger.setAttribute('aria-label', '打开动态利润引擎逻辑说明');
}
const initialFactoryTitle = document.getElementById('factoryEfficiencyTitle');
if (initialFactoryTitle) {
  initialFactoryTitle.textContent = '工厂效率与运营工时费率';
}
const initialFactoryNote = initialFactoryTitle?.parentElement?.querySelector('.section-note');
if (initialFactoryNote) {
  initialFactoryNote.textContent = '按工厂展开效率与费率口径，支持在弹窗内直接修改本地值，用于版本测算与横向对比。';
}
const initialFactoryClose = document.getElementById('closeFactoryEfficiencyBtn');
if (initialFactoryClose) {
  initialFactoryClose.textContent = '关闭';
}

initialCapitalButton?.replaceChildren('资源投入管理');
initialCapitalTitle?.replaceChildren('资源投入管理');
initialFactoryButton?.replaceChildren('工厂效率 / 运营费率');
initialExportBomButton?.replaceChildren('导出原生BOM');
initialLogicTrigger?.setAttribute('aria-label', '打开动态利润引擎逻辑说明');
initialFactoryTitle?.replaceChildren('工厂效率与运营工时费率');
initialFactoryNote?.replaceChildren('按工厂展开效率与费率口径，支持在弹窗内直接修改本地值，用于版本测算与横向对比。');
initialFactoryClose?.replaceChildren('关闭');

const $ = (id) => document.getElementById(id);
const el = {
  openProfitLogicBtn: $('openProfitLogicBtn'),
  openVersionTimelineBtn: $('openVersionTimelineBtn'),
  scenarioName: $('scenarioName'),
  scenarioHistorySelect: $('scenarioHistorySelect'),
  generateBtn: $('generateBtn'),
  resetBtn: $('resetBtn'),
  printBtn: $('printBtn'),
  openFactoryEfficiencyBtn: $('openFactoryEfficiencyBtn'),
  openConfigSheetManagerBtn: $('openConfigSheetManagerBtn'),
  openAnnualDropManagerBtn: $('openAnnualDropManagerBtn'),
  openOneTimeCustomerManagerBtn: $('openOneTimeCustomerManagerBtn'),
  openRebateManagerBtn: $('openRebateManagerBtn'),
  saveVersionBtn: $('saveVersionBtn'),
  submitApprovalBtn: $('submitApprovalBtn'),
  exportLayerBtn: $('exportLayerBtn'),
  profitActionBar: $('profitActionBar'),
  profitInsightsMount: $('profitInsightsMount'),
  kpiGrid: $('kpiGrid'),
  profitDriverGrid: $('profitDriverGrid'),
  harnessProfitSummary: $('harnessProfitSummary'),
  harnessProfitNote: $('harnessProfitNote'),
  harnessProfitHead: document.querySelector('.harness-profit-table thead'),
  harnessProfitTable: $('harnessProfitTable'),
  wireProfitTable: $('wireProfitTable'),
  changeVisualDeltaPill: $('changeVisualDeltaPill'),
  changeVisualSummary: $('changeVisualSummary'),
  changeVisualFactorList: $('changeVisualFactorList'),
  changeVisualBom: $('changeVisualBom'),
  changeVisualContext: $('changeVisualContext'),
  costBridge: $('costBridge'),
  annualChart: $('annualChart'),
  compareTable: document.querySelector('#compareTable tbody'),
  annualTable: document.querySelector('#annualTable tbody'),
  eventTable: document.querySelector('#eventTable tbody'),
  capitalLedger: $('capitalLedger'),
  activeSummary: $('activeSummary'),
  scenarioTags: $('scenarioTags'),
  workspaceShell: $('workspaceShell'),
  workspacePageTabs: $('workspacePageTabs'),
  profitWorkspacePage: $('profitWorkspacePage'),
  workflowWorkspacePage: $('workflowWorkspacePage'),
  dataWorkspacePage: $('dataWorkspacePage'),
  quoteTypeSwitcherMount: $('quoteTypeSwitcherMount'),
  baselineQuoteInfoMount: $('baselineQuoteInfoMount'),
  dataResponsibilityMount: $('dataResponsibilityMount'),
  quoteWorkflowMount: $('quoteWorkflowMount'),
  salesRuleMount: $('salesRuleMount'),
  recoveryTriggerMount: $('recoveryTriggerMount'),
  projectProfitSummaryBadges: $('projectProfitSummaryBadges'),
  projectProfitSummaryMount: $('projectProfitSummaryMount'),
  projectProfitAnnualMount: $('projectProfitAnnualMount'),
  harnessProfitMount: $('harnessProfitMount'),
  versionTimelineDrawer: $('versionTimelineDrawer'),
  closeVersionTimelineBtn: $('closeVersionTimelineBtn'),
  versionTimelineMount: $('versionTimelineMount'),
  quoteMatrixDrawer: $('quoteMatrixDrawer'),
  quoteMatrixDrawerBody: $('quoteMatrixDrawerBody'),
  quoteMatrixDrawerMeta: $('quoteMatrixDrawerMeta'),
  dataToolbarExtraMount: $('dataToolbarExtraMount'),
  metalVersionEditor: $('metalVersionEditor'),
  configBars: $('configBars'),
  typeBars: $('typeBars'),
  wireModelSummary: $('wireModelSummary'),
  wireCalcNote: $('wireCalcNote'),
  wireTableStatus: $('wireTableStatus'),
  toggleWireCatalogViewBtn: $('toggleWireCatalogViewBtn'),
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
  versionTemplateModal: $('versionTemplateModal'),
  versionTemplateEyebrow: $('versionTemplateEyebrow'),
  versionTemplateTitle: $('versionTemplateTitle'),
  versionTemplateSubtitle: $('versionTemplateSubtitle'),
  versionTemplateName: $('versionTemplateName'),
  versionTemplateSource: $('versionTemplateSource'),
  versionTemplateNote: $('versionTemplateNote'),
  versionTemplatePasteHint: $('versionTemplatePasteHint'),
  versionTemplatePaste: $('versionTemplatePaste'),
  versionTemplateStatus: $('versionTemplateStatus'),
  versionTemplateSelectionMeta: $('versionTemplateSelectionMeta'),
  versionTemplateSheetMeta: $('versionTemplateSheetMeta'),
  versionTemplateEditorMeta: $('versionTemplateEditorMeta'),
  versionTemplateFields: $('versionTemplateFields'),
  versionTemplateQuickbar: $('versionTemplateQuickbar'),
  versionTemplateParseBtn: $('versionTemplateParseBtn'),
  versionTemplateResetBtn: $('versionTemplateResetBtn'),
  versionTemplateSaveInlineBtn: $('versionTemplateSaveInlineBtn'),
  versionTemplateInsertRowBtn: $('versionTemplateInsertRowBtn'),
  versionTemplateInsertColumnBtn: $('versionTemplateInsertColumnBtn'),
  versionTemplateMergeBtn: $('versionTemplateMergeBtn'),
  versionTemplateUnmergeBtn: $('versionTemplateUnmergeBtn'),
  versionTemplateFilterBtn: $('versionTemplateFilterBtn'),
  versionTemplateConditionalBtn: $('versionTemplateConditionalBtn'),
  versionTemplateInsertImageBtn: $('versionTemplateInsertImageBtn'),
  versionTemplateAddSheetBtn: $('versionTemplateAddSheetBtn'),
  minimizeVersionTemplateWindowBtn: $('minimizeVersionTemplateWindowBtn'),
  toggleVersionTemplateWindowBtn: $('toggleVersionTemplateWindowBtn'),
  versionTemplateSaveBtn: $('saveVersionTemplateBtn'),
  closeVersionTemplateBtn: $('closeVersionTemplateBtn'),
  exportBomValidationBtn: $('exportBomValidationBtn'),
  factoryEfficiencyModal: $('factoryEfficiencyModal'),
  closeFactoryEfficiencyBtn: $('closeFactoryEfficiencyBtn'),
  factoryEfficiencyMount: $('factoryEfficiencyMount'),
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
const WORKBOOK_VERSION_FALLBACKS = { freeze: 'quote', light: 'fixed', regress: 'tt' };
const VIEWER_VERSION_LABELS = { quote: '报价版', fixed: '定点版', tt: 'TT版' };
const TARGET_MARGIN_STORAGE_KEY = 'g281.target.margin.override.v1';
const WIRE_CATALOG_VIEW_STORAGE_KEY = 'g281.wire.catalog.show-all.v1';
const WORKSPACE_PAGE_STORAGE_KEY = 'g281.workspace.page.v1';
const WORKSPACE_PAGE_VALUES = ['profit', 'workflow', 'data'];
const QUOTE_TYPE_STORAGE_KEY = 'g281.quote.type.v1';
const BASELINE_QUOTE_VERSION_STORAGE_KEY = 'g281.baseline.quote.version.v1';
const WORKFLOW_ROLE_STORAGE_KEY = 'g281.workflow.role.v1';
const WORKFLOW_SELECTED_RECORD_STORAGE_KEY = 'g281.workflow.selected.record.v1';
const QUOTE_TYPE_META = {
  project: {
    label: '项目报价',
    subtitle: '建立首轮客户执行基线',
    tag: '首轮建基线',
    description: '项目报价用于建立项目首个客户执行报价基线，作为后续变更报价和执行预演的起点。',
  },
  change: {
    label: '变更报价',
    subtitle: '绑定基线后表达增量变化',
    tag: '必须绑定基线',
    description: '变更报价必须绑定一个明确的项目报价或上一版变更报价，不能脱离基线独立存在。',
  },
};
const DATA_RESPONSIBILITY_ROWS = [
  {
    role: '销售',
    fields: '客户报价版本、承载线束号、回收规则、开票条件、调价条件',
    note: '回收规则由销售填写，系统不自动猜测。',
  },
  {
    role: '线束开发工程师',
    fields: 'BOM、SOR 对应关系、单线束基础资料、承载边界',
    note: '工厂端利润必须能按单线束颗粒度分析。',
  },
  {
    role: '工艺工程师',
    fields: '设备、工装、模具负荷与变更影响',
    note: '后续按单线束负荷分摊一次性投入。',
  },
  {
    role: '包装工程师',
    fields: '包材价格、包装方案、包装费用',
    note: '默认不要求采购介入，除非额外外采询价。',
  },
];
const WORKFLOW_ROLE_DEFS = [
  { roleCode: 'harness_engineer', roleLabel: '线束开发工程师' },
  { roleCode: 'process_engineer', roleLabel: '工艺工程师' },
  { roleCode: 'packaging_engineer', roleLabel: '包装工程师' },
  { roleCode: 'project_manager', roleLabel: '项目经理' },
  { roleCode: 'sales', roleLabel: '销售' },
];
const WORKFLOW_STAGE_DEFS = [
  { stageCode: 'harness_development', stageLabel: '线束开发', ownerRoleCodes: ['harness_engineer'], requiredFieldCodes: ['bom_master', 'sor_mapping', 'harness_master'] },
  { stageCode: 'data_freeze', stageLabel: 'BOM / 资料冻结', ownerRoleCodes: ['harness_engineer'], requiredFieldCodes: ['config_mapping', 'data_freeze_note'] },
  { stageCode: 'process_estimation', stageLabel: '工艺测算', ownerRoleCodes: ['process_engineer'], requiredFieldCodes: ['process_route', 'labor_profile'] },
  { stageCode: 'resource_packaging', stageLabel: '工装模具 / 设备负荷 / 包装物流', ownerRoleCodes: ['process_engineer', 'packaging_engineer'], requiredFieldCodes: ['equipment_load', 'tooling_load', 'packaging_plan', 'packaging_cost'] },
  { stageCode: 'pm_cost_review', stageLabel: '成本核价 / 项目经理评审', ownerRoleCodes: ['project_manager'], requiredFieldCodes: ['pm_review_summary'] },
  { stageCode: 'commercial_quote', stageLabel: '商务报价 / 回收规则 / 客户协议价', ownerRoleCodes: ['sales'], requiredFieldCodes: ['quote_context', 'carrier_harness_ids', 'sales_rule', 'invoice_trigger', 'repricing_trigger'] },
  { stageCode: 'execution_recovery', stageLabel: '客户执行 / 出货回收 / 开票调价跟踪', ownerRoleCodes: ['sales', 'project_manager'], requiredFieldCodes: ['shipment_progress', 'recovery_progress', 'invoice_reprice_action'] },
];
const WORKFLOW_FIELD_DEFS = [
  { fieldCode: 'bom_master', fieldLabel: 'BOM 主数据', stageCode: 'harness_development', ownerRoleCodes: ['harness_engineer'], inputType: 'text', required: true, note: '维护单线束 BOM 结构与物料口径。' },
  { fieldCode: 'sor_mapping', fieldLabel: 'SOR 映射', stageCode: 'harness_development', ownerRoleCodes: ['harness_engineer'], inputType: 'text', required: true, note: '客户 SOR 与线束方案映射。' },
  { fieldCode: 'harness_master', fieldLabel: '线束主数据', stageCode: 'harness_development', ownerRoleCodes: ['harness_engineer'], inputType: 'text', required: true, note: '线束号、名称、基础属性。' },
  { fieldCode: 'config_mapping', fieldLabel: '配置映射', stageCode: 'data_freeze', ownerRoleCodes: ['harness_engineer'], inputType: 'text', required: true, note: '配置表与承载边界冻结。' },
  { fieldCode: 'data_freeze_note', fieldLabel: '资料冻结说明', stageCode: 'data_freeze', ownerRoleCodes: ['harness_engineer'], inputType: 'textarea', required: true, note: '冻结版本、冻结说明、依赖清单。' },
  { fieldCode: 'process_route', fieldLabel: '工艺路线', stageCode: 'process_estimation', ownerRoleCodes: ['process_engineer'], inputType: 'text', required: true, note: '线束工艺路线与工序说明。' },
  { fieldCode: 'labor_profile', fieldLabel: '工时与费率', stageCode: 'process_estimation', ownerRoleCodes: ['process_engineer'], inputType: 'text', required: true, note: '工时版本、费率与关键假设。' },
  { fieldCode: 'equipment_load', fieldLabel: '设备负荷', stageCode: 'resource_packaging', ownerRoleCodes: ['process_engineer'], inputType: 'text', required: true, note: '按单线束号维护设备需求。' },
  { fieldCode: 'tooling_load', fieldLabel: '工装模具负荷', stageCode: 'resource_packaging', ownerRoleCodes: ['process_engineer'], inputType: 'text', required: true, note: '按单线束号维护工装模具负荷。' },
  { fieldCode: 'packaging_plan', fieldLabel: '包装方案', stageCode: 'resource_packaging', ownerRoleCodes: ['packaging_engineer'], inputType: 'text', required: true, note: '包装方案与承载方式。' },
  { fieldCode: 'packaging_cost', fieldLabel: '包装物流费用', stageCode: 'resource_packaging', ownerRoleCodes: ['packaging_engineer'], inputType: 'text', required: true, note: '包材价格与包装物流费用。' },
  { fieldCode: 'pm_review_summary', fieldLabel: '项目经理评审结论', stageCode: 'pm_cost_review', ownerRoleCodes: ['project_manager'], inputType: 'textarea', required: true, note: '偏差闭环与推进意见。' },
  { fieldCode: 'quote_context', fieldLabel: '报价上下文', stageCode: 'commercial_quote', ownerRoleCodes: ['sales'], inputType: 'text', required: true, note: '项目报价或变更报价说明。' },
  { fieldCode: 'baseline_quote_version', fieldLabel: '基线报价版本', stageCode: 'commercial_quote', ownerRoleCodes: ['sales'], inputType: 'text', required: false, note: '变更报价必须绑定基线版本。' },
  { fieldCode: 'carrier_harness_ids', fieldLabel: '承载线束号', stageCode: 'commercial_quote', ownerRoleCodes: ['sales'], inputType: 'textarea', required: true, note: '实际承载一次性费用的线束号。' },
  { fieldCode: 'sales_rule', fieldLabel: '回收规则', stageCode: 'commercial_quote', ownerRoleCodes: ['sales'], inputType: 'textarea', required: true, note: '一次性费用回收规则由销售填写。' },
  { fieldCode: 'invoice_trigger', fieldLabel: '开票触发条件', stageCode: 'commercial_quote', ownerRoleCodes: ['sales'], inputType: 'text', required: true, note: '到量开票或阈值开票条件。' },
  { fieldCode: 'repricing_trigger', fieldLabel: '调价触发条件', stageCode: 'commercial_quote', ownerRoleCodes: ['sales'], inputType: 'text', required: true, note: '达到阈值后的调价动作。' },
  { fieldCode: 'shipment_progress', fieldLabel: '出货进度', stageCode: 'execution_recovery', ownerRoleCodes: ['sales', 'project_manager'], inputType: 'number', required: true, note: '按承载线束号更新出货。' },
  { fieldCode: 'recovery_progress', fieldLabel: '费用回收进度', stageCode: 'execution_recovery', ownerRoleCodes: ['sales', 'project_manager'], inputType: 'number', required: true, note: '费用回收金额与剩余未回收金额。' },
  { fieldCode: 'invoice_reprice_action', fieldLabel: '开票/调价动作', stageCode: 'execution_recovery', ownerRoleCodes: ['sales', 'project_manager'], inputType: 'textarea', required: true, note: '阈值命中后的实际动作。' },
];
const WORKFLOW_IMPACT_OPTIONS = [
  { code: 'bom', label: 'BOM' },
  { code: 'configSheet', label: '配置表' },
  { code: 'harnessStructure', label: '线束结构' },
  { code: 'process', label: '工艺' },
  { code: 'labor', label: '工时' },
  { code: 'equipment', label: '设备' },
  { code: 'tooling', label: '工装' },
  { code: 'mold', label: '模具' },
  { code: 'packaging', label: '包装物流' },
  { code: 'oneTimeCustomer', label: '一次性费用' },
  { code: 'rebate', label: '返点' },
  { code: 'salesRule', label: '回收规则' },
  { code: 'commercial', label: '商务条件' },
];
let profitInsightsView = null;
let profitInsightsCacheKey = '';
let profitInsightsCacheValue = null;
let factoryEfficiencyView = null;
let factoryEfficiencyLastFocused = null;
let versionTimelineHandle = null;
let versionTimelineLoader = null;
let versionTimelineLastFocused = null;
let versionTimelineCloseTimer = null;
let customTargetMarginPercent = loadStoredTargetMarginPercent();
let showInactiveWireModels = loadStoredWireCatalogShowAll();
let activeWorkspacePage = loadStoredWorkspacePage();
let activeQuoteType = loadStoredQuoteType();
let baselineQuoteVersion = loadStoredBaselineQuoteVersion();
let salesRuleRepo = null;
let workflowRepo = null;
let latestSalesRuleSnapshot = null;
let latestWorkflowSnapshot = null;
let latestExecutionPreview = null;
let latestQuoteWorkbookMatrix = null;
let quoteMatrixDrawerState = {
  harnessId: '',
  rowKey: '',
};
let activeWorkflowRole = loadStoredWorkflowRole();
let selectedWorkflowRecordId = loadStoredWorkflowRecordId();
let workflowCreateDraft = {
  quoteType: 'project',
  quoteVersionId: '',
  harnessId: '',
  harnessName: '',
  scenarioName: '',
  baselineQuoteVersion: '',
  impactedModules: [],
};
let workflowFilters = {
  quoteType: '',
  quoteVersionId: '',
  harnessId: '',
  currentStageCode: '',
  overallStatus: '',
};
let workflowStageDraftBuffers = {};
let workflowUiErrors = [];
const WORKFLOW_TASK_LANES = [
  { key: 'pending', label: '待处理', statuses: ['待开始', '待处理'] },
  { key: 'progress', label: '进行中', statuses: ['进行中'] },
  { key: 'review', label: '待确认', statuses: ['待确认'] },
  { key: 'done', label: '已完成', statuses: ['已完成'] },
];

hydrateUserVersions();
cleanupVersionManagement();
persistUserVersions();
prepareMetalVersions();
ensureMetalVersionLocks();

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
    note: '已达成部分按定点版执行，未达成部分按报价版执行。',
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
const CONNECTOR_TEMPLATE_GROUP_TO_ITEM = {
  battery_end: 'battery_end_hv',
  edrive_end: 'edrive_end_hv',
  accm_end: 'accm_end',
  ptc_end: 'ptc_end',
  branch_splitter: 'branch_splitter',
  charge_socket: 'charge_socket_main',
  dc_charge_end: 'dc_charge_lv',
  ac_charge_end: 'ac_charge_lv',
  electronic_lock: 'electronic_lock',
  low_voltage_inline: 'low_voltage_inline',
  dc_ground: 'misc_terminal_set',
  ac_ground: 'misc_terminal_set',
  connector_misc: 'misc_terminal_set',
};
const BOM_VERSION_TEXT_MAP = {
  quote: '报价',
  fixed: '定点',
  tt: 'TT',
};
const protocolStatusConfig = {
  confirmed: { label: '已达成', className: 'confirmed' },
  quoted_pending: { label: '待确认', className: 'quoted' },
  no_reply: { label: '暂无回复', className: 'blank' },
  dev_pending: { label: '开发中', className: 'dev' },
};
const VERSION_DISPLAY_ORDER = {
  bom: ['light', 'freeze'],
  connector: ['fixed', 'quote'],
  labor: ['optimize', 'base'],
  equipment: ['shared', 'base'],
  packaging: ['optimize', 'base'],
  configSheet: ['fixed', 'quote', 'tt'],
  sales: ['fixed', 'quote'],
  mix: ['fixed', 'quote'],
  annualDrop: ['fixed', 'quote'],
  oneTimeCustomer: ['fixed', 'quote'],
  rebate: ['fixed', 'quote'],
  metal: ['fixed', 'quote'],
};
const VERSION_TEMPLATE_GROUPS = new Set(['bom', 'metal', 'connector', 'labor', 'equipment', 'packaging', 'configSheet', 'sales', 'mix', 'annualDrop', 'oneTimeCustomer', 'rebate']);
let versionTemplateDraft = null;
let versionTemplateEditor = null;
let versionTemplateResizeObserver = null;
let versionTemplateRenderMonitor = [];
let versionTemplateRenderToken = 0;
let versionTemplateReadyWatchTimer = 0;
let versionTemplateDebugPanel = null;
let versionTemplateDebugTimer = 0;
let versionTemplateStatusMetaTimer = 0;
let versionTemplateDebugHooksApplied = false;
const VERSION_TEMPLATE_DEBUG_ERRORS = [];

function versionOptionLabel(group, key) {
  return BASE.versions?.[group]?.[key]?.label || key || '';
}

function orderedVersionEntries(group, options) {
  const entries = Object.entries(options || {});
  const customEntrySorter = ([leftKey], [rightKey]) => {
    const leftOption = options?.[leftKey] || {};
    const rightOption = options?.[rightKey] || {};
    const leftCustom = Boolean(leftOption.userCreated);
    const rightCustom = Boolean(rightOption.userCreated);
    if (leftCustom !== rightCustom) {
      return leftCustom ? -1 : 1;
    }
    if (leftCustom && rightCustom) {
      const leftTime = Date.parse(leftOption.createdAt || '') || 0;
      const rightTime = Date.parse(rightOption.createdAt || '') || 0;
      if (leftTime !== rightTime) return rightTime - leftTime;
    }
    return 0;
  };
  const preferredOrder = VERSION_DISPLAY_ORDER[group];
  if (!preferredOrder || !preferredOrder.length) {
    return entries.sort(customEntrySorter);
  }
  const rankMap = new Map(preferredOrder.map((key, index) => [key, index]));
  return entries.sort(([leftKey], [rightKey]) => {
    const leftRank = rankMap.has(leftKey) ? rankMap.get(leftKey) : -1;
    const rightRank = rankMap.has(rightKey) ? rankMap.get(rightKey) : -1;
    if (leftRank === rightRank) {
      if (leftRank === -1) {
        const customOrder = customEntrySorter([leftKey], [rightKey]);
        if (customOrder !== 0) return customOrder;
      }
      return 0;
    }
    if (leftRank === -1) return -1;
    if (rightRank === -1) return 1;
    return leftRank - rightRank;
  });
}

function resolveVersionFallbackKey(group, excludedKey = '') {
  const options = BASE.versions?.[group] || {};
  const preferredKey = DEFAULT_STATE[group];
  if (preferredKey && preferredKey !== excludedKey && options[preferredKey]) {
    return preferredKey;
  }
  const nextEntry = orderedVersionEntries(group, options).find(([key]) => key !== excludedKey);
  return nextEntry?.[0] || '';
}

function clonePlain(value, fallback) {
  try {
    return JSON.parse(JSON.stringify(value));
  } catch (error) {
    return fallback;
  }
}

function numberOr(value, fallback) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function safeObject(value) {
  return value && typeof value === 'object' ? value : {};
}

function currentScenarioBindings() {
  return Object.keys(DEFAULT_STATE).reduce((acc, group) => {
    if (group === 'scenarioName') return acc;
    if (state[group]) {
      acc[group] = state[group];
    }
    return acc;
  }, {});
}

function savedScenarioRecords() {
  const merged = new Map();
  repo.getHistory().forEach((record) => {
    merged.set(record.id, {
      scenarioId: record.id,
      name: record.name || record.scenarioName || record.id,
      scenarioName: record.scenarioName || record.name || record.id,
      createdAt: record.createdAt,
      updatedAt: record.createdAt,
      draft: clonePlain(record.draft, {}),
      state: clonePlain(record.state, {}),
      bindings: clonePlain(record.state, {}),
      summary: clonePlain(record.summary, {}),
    });
  });
  (Array.isArray(scenarioVersionState.records) ? scenarioVersionState.records : []).forEach((record) => {
    const key = record.scenarioId || record.id;
    if (!key) return;
    merged.set(key, {
      ...merged.get(key),
      ...record,
      scenarioId: key,
    });
  });
  return Array.from(merged.values())
    .sort((left, right) => String(right.updatedAt || right.createdAt || '').localeCompare(String(left.updatedAt || left.createdAt || '')));
}

function refreshScenarioVersionState(options = {}) {
  if (!scenarioVersionRepo?.listScenarios) {
    scenarioVersionState.records = [];
    scenarioVersionState.ready = Promise.resolve([]);
    return scenarioVersionState.ready;
  }
  if (!options.force && scenarioVersionState.ready) {
    return scenarioVersionState.ready;
  }
  scenarioVersionState.ready = scenarioVersionRepo.listScenarios({ projectCode: PROJECT_CODE })
    .then((records) => {
      scenarioVersionState.records = Array.isArray(records) ? records : [];
      return scenarioVersionState.records;
    })
    .catch((error) => {
      console.warn('[G281Dashboard] Failed to refresh saved scenarios', error);
      scenarioVersionState.records = [];
      return [];
    });
  return scenarioVersionState.ready;
}

async function saveScenarioVersionRecord(model, options = {}) {
  if (!scenarioVersionRepo?.saveScenario) {
    return null;
  }
  try {
    const scenarioId = toText(options.scenarioId, createUniqueScenarioId());
    const record = await scenarioVersionRepo.saveScenario({
      scenarioId,
      name: model?.d?.scenarioName || state.scenarioName || BASE.name,
      scenarioName: model?.d?.scenarioName || state.scenarioName || BASE.name,
      projectCode: PROJECT_CODE,
      note: toText(options.note, ''),
      draft: clonePlain(model?.d, readDraft()),
      state: currentScenarioStateSnapshot(),
      bindings: currentScenarioBindings(),
      summary: {
        revenue: model?.totalRevenue,
        cost: model?.totalCost,
        profit: model?.totalProfit,
        margin: model?.margin,
        paybackYears: model?.paybackYears,
        capitalTotal: model?.capitalTotal,
      },
    });
    await refreshScenarioVersionState({ force: true });
    return record;
  } catch (error) {
    console.warn('[G281Dashboard] Failed to save scenario record', error);
    return null;
  }
}

async function loadSavedScenarioRecord(scenarioId) {
  if (!scenarioId || !scenarioVersionRepo?.getScenario) {
    return false;
  }
  try {
    const record = await scenarioVersionRepo.getScenario(scenarioId);
    if (!record) {
      return false;
    }
    applyStateSnapshot(record.state || record.bindings || {});
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
    lastSavedVersionId = scenarioId;
    renderVersions();
    render(calcModel());
    return true;
  } catch (error) {
    console.warn('[G281Dashboard] Failed to load saved scenario', error);
    return false;
  }
}

async function persistVersionOptionToStore(group, versionKey, option, payload = {}, extra = {}) {
  if (!factorVersionRepo?.saveFactorVersionFromSnapshot) {
    return null;
  }
  const workbookSnapshot = clonePlain(
    payload.templateWorkbookSnapshot ?? payload.workbookSnapshot ?? option?.templateWorkbookSnapshot,
    null,
  );
  if (!workbookSnapshot?.sheetOrder?.length || !workbookSnapshot?.sheets) {
    return null;
  }

  try {
    const stored = await factorVersionRepo.saveFactorVersionFromSnapshot({
      factorType: group,
      projectCode: PROJECT_CODE,
      versionId: versionKey,
      versionLabel: option?.label || versionKey,
      workbookSnapshot,
      workbookName: toText(option?.workbook, option?.label || versionKey),
      sourceType: toText(extra.sourceType, option?.entryMode || 'template'),
      status: toText(extra.status, 'active'),
      meta: {
        workbookVersionKeyFallback: option?.workbookVersionKeyFallback || payload?.workbookVersionKeyFallback || '',
        templateSource: option?.templateSource || payload?.source || '',
        sourceNote: option?.sourceNote || option?.note || '',
      },
    });
    const liveOption = BASE.versions?.[group]?.[versionKey];
    if (liveOption) {
      liveOption.nativeWorkbookVersionId = stored.versionId;
      liveOption.factorSnapshotId = stored.snapshotId;
      liveOption.persistedAt = stored.updatedAt;
      if (group === 'bom' && bomSemanticRepo?.saveBomReleaseFromSnapshot) {
        try {
          const semanticRecord = await bomSemanticRepo.saveBomReleaseFromSnapshot({
            releaseId: stored.versionId,
            versionId: stored.versionId,
            releaseLabel: option?.label || versionKey,
            versionLabel: option?.label || versionKey,
            projectCode: PROJECT_CODE,
            snapshotId: stored.snapshotId,
            baseReleaseId: toText(extra.baseReleaseId, ''),
            workbookSnapshot,
          });
          liveOption.semanticReleaseId = semanticRecord?.releaseId || stored.versionId;
          liveOption.semanticSummary = clonePlain(semanticRecord?.summary, null);
          if (extra.baseReleaseId && extra.baseReleaseId !== liveOption.semanticReleaseId) {
            try {
              const diffRecord = await compareBomSemanticReleases(extra.baseReleaseId, liveOption.semanticReleaseId, {
                forceRefresh: true,
                leftLabel: toText(extra.baseLabel, extra.baseReleaseId),
                rightLabel: toText(option?.label, versionKey),
              });
              if (diffRecord) {
                liveOption.baseSemanticReleaseId = toText(extra.baseReleaseId, '');
                liveOption.latestDiffResultId = toText(diffRecord.diffId, '');
                liveOption.latestDiffSummary = clonePlain(diffRecord.summary, null);
              }
            } catch (diffError) {
              console.warn('[G281Dashboard] Failed to persist BOM diff result', diffError);
            }
          }
        } catch (semanticError) {
          console.warn('[G281Dashboard] Failed to persist BOM semantic release', semanticError);
        }
      }
      persistUserVersions();
    }
    return stored;
  } catch (error) {
    console.warn(`[G281Dashboard] Failed to persist ${group} version store record`, error);
    return null;
  }
}

function createUniqueScenarioId() {
  return `scenario-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function readUserVersionStore() {
  try {
    const raw = window.localStorage.getItem(USER_VERSION_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (error) {
    return {};
  }
}

function persistUserVersions() {
  try {
    const payload = USER_VERSION_GROUPS.reduce((acc, group) => {
      const options = BASE.versions?.[group] || {};
      const customEntries = Object.entries(options).reduce((groupAcc, [key, option]) => {
        if (!option?.userCreated) return groupAcc;
        groupAcc[key] = clonePlain(option, option);
        return groupAcc;
      }, {});
      if (Object.keys(customEntries).length) {
        acc[group] = customEntries;
      }
      return acc;
    }, {});
    window.localStorage.setItem(USER_VERSION_STORAGE_KEY, JSON.stringify(payload));
  } catch (error) {
    // Ignore local persistence failures in offline browser mode.
  }
}

function normalizeTargetMarginPercent(value) {
  if (value === '' || value === null || value === undefined) return null;
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  return Math.max(-99.99, Math.min(99.99, Number(numeric.toFixed(2))));
}

function loadStoredTargetMarginPercent() {
  try {
    return normalizeTargetMarginPercent(window.localStorage.getItem(TARGET_MARGIN_STORAGE_KEY));
  } catch (error) {
    return null;
  }
}

function normalizeStoredBoolean(value, fallback = false) {
  if (value === null || value === undefined || value === '') return fallback;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  const normalized = String(value).trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  return fallback;
}

function loadStoredWireCatalogShowAll() {
  try {
    return normalizeStoredBoolean(window.localStorage.getItem(WIRE_CATALOG_VIEW_STORAGE_KEY), false);
  } catch (error) {
    return false;
  }
}

function persistWireCatalogShowAll(value) {
  try {
    if (!value) {
      window.localStorage.removeItem(WIRE_CATALOG_VIEW_STORAGE_KEY);
      return;
    }
    window.localStorage.setItem(WIRE_CATALOG_VIEW_STORAGE_KEY, '1');
  } catch (error) {
    // Ignore local persistence failures in offline browser mode.
  }
}

function setWireCatalogShowAll(value) {
  showInactiveWireModels = !!value;
  persistWireCatalogShowAll(showInactiveWireModels);
  render(calcModel());
}

function normalizeQuoteType(value) {
  return value === 'change' ? 'change' : 'project';
}

function loadStoredQuoteType() {
  try {
    return normalizeQuoteType(window.localStorage.getItem(QUOTE_TYPE_STORAGE_KEY));
  } catch (error) {
    return 'project';
  }
}

function persistQuoteType(value) {
  try {
    const normalized = normalizeQuoteType(value);
    if (normalized === 'project') {
      window.localStorage.removeItem(QUOTE_TYPE_STORAGE_KEY);
      return;
    }
    window.localStorage.setItem(QUOTE_TYPE_STORAGE_KEY, normalized);
  } catch (error) {
    // Ignore local persistence failures in offline browser mode.
  }
}

function loadStoredBaselineQuoteVersion() {
  try {
    return String(window.localStorage.getItem(BASELINE_QUOTE_VERSION_STORAGE_KEY) || '').trim();
  } catch (error) {
    return '';
  }
}

function persistBaselineQuoteVersion(value) {
  try {
    const normalized = String(value || '').trim();
    if (!normalized) {
      window.localStorage.removeItem(BASELINE_QUOTE_VERSION_STORAGE_KEY);
      return;
    }
    window.localStorage.setItem(BASELINE_QUOTE_VERSION_STORAGE_KEY, normalized);
  } catch (error) {
    // Ignore local persistence failures in offline browser mode.
  }
}

function loadStoredWorkflowRole() {
  try {
    const value = String(window.localStorage.getItem(WORKFLOW_ROLE_STORAGE_KEY) || '').trim();
    return value || 'sales';
  } catch (error) {
    return 'sales';
  }
}

function persistWorkflowRole(value) {
  try {
    const normalized = String(value || '').trim();
    if (!normalized || normalized === 'sales') {
      window.localStorage.removeItem(WORKFLOW_ROLE_STORAGE_KEY);
      return;
    }
    window.localStorage.setItem(WORKFLOW_ROLE_STORAGE_KEY, normalized);
  } catch (error) {
    // Ignore local persistence failures in offline browser mode.
  }
}

function loadStoredWorkflowRecordId() {
  try {
    return String(window.localStorage.getItem(WORKFLOW_SELECTED_RECORD_STORAGE_KEY) || '').trim();
  } catch (error) {
    return '';
  }
}

function persistWorkflowRecordId(value) {
  try {
    const normalized = String(value || '').trim();
    if (!normalized) {
      window.localStorage.removeItem(WORKFLOW_SELECTED_RECORD_STORAGE_KEY);
      return;
    }
    window.localStorage.setItem(WORKFLOW_SELECTED_RECORD_STORAGE_KEY, normalized);
  } catch (error) {
    // Ignore local persistence failures in offline browser mode.
  }
}

function setQuoteType(nextType) {
  const normalized = normalizeQuoteType(nextType);
  if (activeQuoteType === normalized) return;
  activeQuoteType = normalized;
  persistQuoteType(activeQuoteType);
  syncSalesRuleQuoteContext(window._g281LastModel || {});
  queueRender();
}

function setBaselineQuoteVersion(nextValue) {
  const normalized = String(nextValue || '').trim();
  if (baselineQuoteVersion === normalized) return;
  baselineQuoteVersion = normalized;
  persistBaselineQuoteVersion(baselineQuoteVersion);
  syncSalesRuleQuoteContext(window._g281LastModel || {});
  queueRender();
}

function setWorkflowRole(nextRole) {
  const normalized = String(nextRole || '').trim() || 'sales';
  if (activeWorkflowRole === normalized) return;
  activeWorkflowRole = normalized;
  persistWorkflowRole(activeWorkflowRole);
  queueRender();
}

function setSelectedWorkflowRecordId(recordId) {
  selectedWorkflowRecordId = String(recordId || '').trim();
  persistWorkflowRecordId(selectedWorkflowRecordId);
}

function resetWorkflowUiErrors() {
  workflowUiErrors = [];
}

function setWorkflowUiError(message) {
  workflowUiErrors = message ? [String(message)] : [];
}

function updateWorkflowCreateDraft(field, value) {
  if (field === 'toggleImpactModule') {
    const code = String(value || '').trim();
    const current = safeArray(workflowCreateDraft.impactedModules);
    workflowCreateDraft = {
      ...workflowCreateDraft,
      impactedModules: current.includes(code)
        ? current.filter((item) => item !== code)
        : current.concat(code),
    };
    return;
  }
  workflowCreateDraft = {
    ...workflowCreateDraft,
    [field]: value,
  };
}

function updateWorkflowFilter(field, value) {
  workflowFilters = {
    ...workflowFilters,
    [field]: String(value ?? '').trim(),
  };
}

function currentQuoteTypeMeta() {
  return QUOTE_TYPE_META[normalizeQuoteType(activeQuoteType)] || QUOTE_TYPE_META.project;
}

function baselineQuoteVersionLabel() {
  return baselineQuoteVersion || '待销售填写';
}

function buildQuoteContext(model) {
  const quoteMeta = currentQuoteTypeMeta();
  const financialContext = safeObject(model?.financialContext);
  const quoteType = normalizeQuoteType(activeQuoteType);
  const normalizedBaseline = String(baselineQuoteVersion || '').trim();
  return {
    projectCode: PROJECT_CODE,
    quoteType,
    quoteTypeLabel: quoteMeta.label,
    quoteVersion: toText(model?.versionTag || model?.financialContext?.referenceKey, ''),
    quoteName: state.scenarioName,
    baselineQuoteVersion: normalizedBaseline,
    baselineRequired: quoteType === 'change',
    baselineReady: quoteType === 'project' || Boolean(normalizedBaseline),
    description: quoteMeta.description,
    financialReferenceKey: toText(financialContext.referenceKey, ''),
    financialReferenceLabel: toText(financialContext.referenceLabel, ''),
    financialExactKey: toText(financialContext.exactKey, ''),
    financialExactLabel: toText(financialContext.exactLabel, ''),
    financialContextSummary: financialContextSummary(model || {}),
  };
}

function buildFallbackSalesRuleSnapshot(model) {
  const quoteContext = buildQuoteContext(model);
  return {
    schemaVersion: 1,
    projectCode: PROJECT_CODE,
    quoteType: quoteContext.quoteType,
    baselineQuoteVersion: quoteContext.baselineQuoteVersion,
    quoteContext,
    rules: [],
    tasks: [],
    recoveryTracking: [],
    roles: DATA_RESPONSIBILITY_ROWS.map((row, index) => ({
      id: `role-${index + 1}`,
      role: row.role,
      fields: row.fields,
      note: row.note,
    })),
    dataResponsibility: DATA_RESPONSIBILITY_ROWS.map((row, index) => ({
      fieldCode: `field-${index + 1}`,
      fieldName: row.fields,
      ownerRoleCode: `role-${index + 1}`,
      required: true,
      note: row.note,
    })),
    summary: {
      totalRules: 0,
      activeRules: 0,
      templateRules: 0,
      effectiveRules: 0,
    },
  };
}

function getSalesRuleRepo() {
  if (salesRuleRepo) return salesRuleRepo;
  const api = window.G281SalesRuleRepo;
  if (!api || typeof api.create !== 'function') return null;
  try {
    salesRuleRepo = api.create({
      projectCode: PROJECT_CODE,
      defaultQuoteType: normalizeQuoteType(activeQuoteType),
      defaultBaselineQuoteVersion: baselineQuoteVersion,
    });
  } catch (error) {
    console.warn('[G281] 初始化销售规则仓库失败:', error);
    salesRuleRepo = null;
  }
  return salesRuleRepo;
}

function syncSalesRuleQuoteContext(model) {
  const repo = getSalesRuleRepo();
  const quoteContext = buildQuoteContext(model || window._g281LastModel || {});
  if (!repo || typeof repo.setQuoteContext !== 'function') return quoteContext;
  try {
    repo.setQuoteContext({
      quoteType: quoteContext.quoteType,
      quoteVersion: quoteContext.quoteVersion,
      quoteName: quoteContext.quoteName,
      baselineQuoteVersion: quoteContext.baselineQuoteVersion,
      note: quoteContext.financialContextSummary,
    });
  } catch (error) {
    console.warn('[G281] 同步销售规则上下文失败:', error);
  }
  return quoteContext;
}

function getSalesRuleSnapshot(model) {
  const repo = getSalesRuleRepo();
  const fallback = buildFallbackSalesRuleSnapshot(model);
  if (!repo) return fallback;
  try {
    if (typeof repo.load === 'function') {
      repo.load();
    }
    syncSalesRuleQuoteContext(model);
    if (typeof repo.getSnapshot === 'function') {
      return repo.getSnapshot() || fallback;
    }
  } catch (error) {
    console.warn('[G281] 读取销售规则快照失败:', error);
  }
  return fallback;
}

function normalizeWorkflowRoleCode(roleCode) {
  const normalized = toText(roleCode, '').trim();
  const map = {
    harnessEngineer: 'harness_engineer',
    processEngineer: 'process_engineer',
    resourceEngineer: 'process_engineer',
    packagingEngineer: 'packaging_engineer',
    pm: 'project_manager',
    salesOps: 'sales',
  };
  return map[normalized] || normalized || 'sales';
}

function workflowRoleLabel(roleCode) {
  const normalized = normalizeWorkflowRoleCode(roleCode);
  return (WORKFLOW_ROLE_DEFS.find((item) => item.roleCode === normalized) || {}).roleLabel || normalized;
}

function currentAuthContext() {
  const runtime = safeObject(window.G281AuthContext || window.G281_FEISHU_CONTEXT || {});
  const explicitRoles = safeArray(runtime.roleCodes || runtime.roles).map((item) => normalizeWorkflowRoleCode(item)).filter(Boolean);
  const primaryRole = normalizeWorkflowRoleCode(runtime.primaryRole || runtime.roleCode || activeWorkflowRole);
  const roleCodes = Array.from(new Set([primaryRole].concat(explicitRoles).filter(Boolean)));
  const departmentCodes = safeArray(runtime.departmentCodes || runtime.departments).map((item) => toText(item, '')).filter(Boolean);
  const permissionCodes = safeArray(runtime.permissionCodes || runtime.permissions).map((item) => toText(item, '')).filter(Boolean);
  return {
    mode: toText(runtime.mode, runtime.userId ? 'feishu' : 'offline'),
    userId: toText(runtime.userId, ''),
    userName: toText(runtime.userName || runtime.name, roleCodes.length ? workflowRoleLabel(roleCodes[0]) : '离线角色'),
    primaryRole,
    roleCodes,
    departmentCodes,
    permissionCodes,
    source: runtime.userId ? 'feishu_reserved' : 'offline_role_switch',
  };
}

function authHasPermission(permissionCode, fallbackRoles = []) {
  const auth = currentAuthContext();
  const normalizedPermission = toText(permissionCode, '');
  if (safeArray(auth.permissionCodes).includes('workflow.admin')) return true;
  if (normalizedPermission && safeArray(auth.permissionCodes).includes(normalizedPermission)) return true;
  if (!safeArray(fallbackRoles).length) return false;
  return safeArray(fallbackRoles).some((roleCode) => auth.roleCodes.includes(normalizeWorkflowRoleCode(roleCode)));
}

function authContextSummaryText() {
  const auth = currentAuthContext();
  const departmentText = auth.departmentCodes.length ? ` · 部门 ${auth.departmentCodes.join(' / ')}` : '';
  const sourceText = auth.mode === 'feishu' ? '飞书鉴权接口预留' : '离线角色切换';
  return `${workflowRoleLabel(auth.primaryRole)}${departmentText} · ${sourceText}`;
}

function workflowStageMeta(stageCode) {
  return WORKFLOW_STAGE_DEFS.find((stage) => stage.stageCode === stageCode) || {
    stageCode,
    stageLabel: stageCode,
    ownerRoleCodes: [],
    requiredFieldCodes: [],
  };
}

function workflowFieldDefsForStage(stageCode) {
  return WORKFLOW_FIELD_DEFS.filter((field) => field.stageCode === stageCode);
}

function getWorkflowRepo() {
  if (workflowRepo) return workflowRepo;
  const api = window.G281WorkflowRepo;
  if (!api || typeof api.create !== 'function') return null;
  try {
    workflowRepo = api.create({ projectCode: PROJECT_CODE });
  } catch (error) {
    console.warn('[G281] 初始化 workflow repo 失败:', error);
    workflowRepo = null;
  }
  return workflowRepo;
}

function rawWorkflowStageStates(rawRecord) {
  if (Array.isArray(rawRecord?.stageStates)) return safeArray(rawRecord.stageStates);
  const rawStates = safeObject(rawRecord?.stageStates);
  return WORKFLOW_STAGE_DEFS.map((stage) => ({
    stageCode: stage.stageCode,
    ...safeObject(rawStates[stage.stageCode]),
  }));
}

function normalizeWorkflowStageState(rawStage, record) {
  const source = safeObject(rawStage);
  const stageCode = toText(source.stageCode, '');
  const meta = workflowStageMeta(stageCode);
  const rawOwner = source.ownerRoleCodes || source.ownerRole;
  const ownerRoleCodes = Array.isArray(rawOwner)
    ? rawOwner.map((item) => normalizeWorkflowRoleCode(item))
    : (rawOwner ? [normalizeWorkflowRoleCode(rawOwner)] : safeArray(meta.ownerRoleCodes));
  const currentStageCode = toText(record?.currentStageCode, '');
  let status = toText(source.status, 'not_started');
  if (currentStageCode === 'pm_cost_review' && ['harness_development', 'data_freeze', 'process_estimation', 'resource_packaging'].includes(stageCode) && status === 'submitted') {
    status = 'pending_review';
  }
  return {
    stageCode,
    stageLabel: toText(source.stageLabel || source.stageName, meta.stageLabel || stageCode),
    ownerRoleCodes,
    status,
    requiredFieldCodes: safeArray(source.requiredFieldCodes).length ? safeArray(source.requiredFieldCodes) : safeArray(meta.requiredFieldCodes),
    submittedAt: toText(source.submittedAt, ''),
    submittedByRole: normalizeWorkflowRoleCode(source.submittedByRole || source.updatedBy || ''),
    reviewedAt: toText(source.reviewedAt || source.approvedAt || source.rejectedAt, ''),
    reviewAction: toText(source.reviewAction || source.reviewedAction || source.reviewPayload?.decision, ''),
    reviewNote: toText(source.reviewNote || source.reviewPayload?.note || '', ''),
    source: source.inherited ? 'inherited' : toText(source.source, 'manual'),
    draftData: clonePlain(source.draftData || source.draftPayload || {}, {}),
    submitData: clonePlain(source.submitData || source.submitPayload || {}, {}),
  };
}

function deriveWorkflowRecordDisplayStage(record) {
  const currentStageCode = toText(record.currentStageCode, '');
  const submittedStage = record.stageStates.find((stage) => ['harness_development', 'data_freeze', 'process_estimation', 'resource_packaging'].includes(stage.stageCode) && ['pending_review', 'submitted'].includes(stage.status));
  if (submittedStage) return 'pm_cost_review';
  if (currentStageCode === 'commercial_quote') {
    const commercialStage = record.stageStates.find((stage) => stage.stageCode === 'commercial_quote');
    const executionStage = record.stageStates.find((stage) => stage.stageCode === 'execution_recovery');
    if (commercialStage?.status === 'submitted' || executionStage?.status === 'active' || record.overallStatus === 'active') {
      return 'execution_recovery';
    }
  }
  const pendingStage = record.stageStates.find((stage) => ['harness_development', 'data_freeze', 'process_estimation', 'resource_packaging'].includes(stage.stageCode) && ['pending_review', 'submitted'].includes(stage.status));
  if (pendingStage) return 'pm_cost_review';
  return currentStageCode || 'harness_development';
}

function normalizeWorkflowRecord(rawRecord) {
  const source = safeObject(rawRecord);
  const stageStates = rawWorkflowStageStates(source).map((stage) => normalizeWorkflowStageState(stage, source));
  const stageByCode = new Map(stageStates.map((stage) => [stage.stageCode, stage]));
  const overallStatus = toText(source.overallStatus || source.workflowStatus, 'draft');
  const displayStageCode = deriveWorkflowRecordDisplayStage({
    ...source,
    stageStates,
    overallStatus,
  });
  const displayStageMeta = workflowStageMeta(displayStageCode);
  const displayStageState = stageByCode.get(displayStageCode) || {};
  return {
    recordId: toText(source.recordId, ''),
    quoteVersionId: toText(source.quoteVersionId, ''),
    quoteType: toText(source.quoteType, 'project'),
    baselineQuoteVersion: toText(source.baselineQuoteVersion, ''),
    projectCode: toText(source.projectCode || source.metadata?.projectCode, PROJECT_CODE),
    scenarioName: toText(source.scenarioName || source.metadata?.scenarioName, state.scenarioName),
    harnessId: toText(source.harnessId, ''),
    harnessName: toText(source.harnessName, ''),
    impactedModules: safeArray(source.impactedModules),
    currentStageCode: toText(source.currentStageCode, displayStageCode),
    currentStageLabel: workflowStageMeta(toText(source.currentStageCode, displayStageCode)).stageLabel,
    displayStageCode,
    displayStageLabel: displayStageMeta.stageLabel,
    displayStatus: displayStageCode === 'pm_cost_review' ? 'review_pending' : overallStatus,
    overallStatus,
    stageStates,
    linkedSalesRuleIds: safeArray(source.linkedSalesRuleIds || source.metadata?.linkedSalesRuleIds),
    linkedTaskIds: safeArray(source.linkedTaskIds || source.metadata?.linkedTaskIds),
    linkedRecoveryHarnessId: toText(source.linkedRecoveryHarnessId || source.harnessId, ''),
    latestExecutionSnapshot: clonePlain(source.latestExecutionSnapshot || source.executionStatus || {}, {}),
    auditLog: safeArray(source.auditLog || source.metadata?.auditLog),
    currentOwnerRoles: safeArray(displayStageState.ownerRoleCodes || displayStageMeta.ownerRoleCodes).map((item) => workflowRoleLabel(item)),
    pendingReviewStageCode: (stageStates.find((stage) => ['harness_development', 'data_freeze', 'process_estimation', 'resource_packaging'].includes(stage.stageCode) && ['pending_review', 'submitted'].includes(stage.status)) || {}).stageCode || '',
    updatedAt: toText(source.updatedAt, source.createdAt),
    createdAt: toText(source.createdAt, ''),
  };
}

function buildFallbackWorkflowSnapshot(model) {
  return {
    schemaVersion: 1,
    projectCode: PROJECT_CODE,
    roles: clonePlain(WORKFLOW_ROLE_DEFS, []),
    stages: clonePlain(WORKFLOW_STAGE_DEFS, []),
    fieldDefinitions: clonePlain(WORKFLOW_FIELD_DEFS, []),
    impactStageMap: {},
    records: [],
    updatedAt: new Date().toISOString(),
  };
}

function getWorkflowSnapshot(model) {
  const repo = getWorkflowRepo();
  if (!repo || typeof repo.getSnapshot !== 'function') {
    latestWorkflowSnapshot = buildFallbackWorkflowSnapshot(model);
    return latestWorkflowSnapshot;
  }
  try {
    const snapshot = safeObject(repo.getSnapshot());
    latestWorkflowSnapshot = {
      schemaVersion: numberOr(snapshot.schemaVersion, 1),
      projectCode: toText(snapshot.projectCode, PROJECT_CODE),
      roles: clonePlain(WORKFLOW_ROLE_DEFS, []),
      stages: clonePlain(WORKFLOW_STAGE_DEFS, []),
      fieldDefinitions: clonePlain(WORKFLOW_FIELD_DEFS, []),
      impactStageMap: safeObject(snapshot.impactStageMap),
      records: safeArray(snapshot.records).map(normalizeWorkflowRecord),
      updatedAt: toText(snapshot.updatedAt, new Date().toISOString()),
    };
  } catch (error) {
    console.warn('[G281] 读取 workflow snapshot 失败:', error);
    latestWorkflowSnapshot = buildFallbackWorkflowSnapshot(model);
  }
  return latestWorkflowSnapshot;
}

function workflowAvailableHarnesses(model) {
  const previewRows = safeArray(latestExecutionPreview?.harnessRows).map((row) => ({
    harnessId: toText(row?.harnessId, ''),
    harnessName: toText(row?.harnessName, ''),
  }));
  const trackingRows = safeArray(latestSalesRuleSnapshot?.recoveryTracking).map((row) => ({
    harnessId: toText(row?.harnessId || row?.harnessNo, ''),
    harnessName: toText(row?.harnessName, ''),
  }));
  const merged = new Map();
  previewRows.concat(trackingRows).forEach((item) => {
    if (!item.harnessId) return;
    merged.set(item.harnessId, item);
  });
  return Array.from(merged.values()).sort((left, right) => left.harnessId.localeCompare(right.harnessId, 'zh-CN'));
}

function ensureWorkflowDraftDefaults(model) {
  const quoteContext = buildQuoteContext(model);
  if (!workflowCreateDraft.quoteVersionId) workflowCreateDraft.quoteVersionId = quoteContext.quoteVersion || toText(model?.versionTag, '');
  if (!workflowCreateDraft.scenarioName) workflowCreateDraft.scenarioName = quoteContext.quoteName || state.scenarioName;
  if (!workflowCreateDraft.baselineQuoteVersion) workflowCreateDraft.baselineQuoteVersion = quoteContext.baselineQuoteVersion || '';
  if (!workflowCreateDraft.quoteType) workflowCreateDraft.quoteType = quoteContext.quoteType || 'project';
}

function filteredWorkflowRecords(snapshot) {
  return safeArray(snapshot.records).filter((record) => {
    if (workflowFilters.quoteType && record.quoteType !== workflowFilters.quoteType) return false;
    if (workflowFilters.quoteVersionId && record.quoteVersionId !== workflowFilters.quoteVersionId) return false;
    if (workflowFilters.harnessId && record.harnessId !== workflowFilters.harnessId) return false;
    if (workflowFilters.currentStageCode && record.displayStageCode !== workflowFilters.currentStageCode) return false;
    if (workflowFilters.overallStatus && record.displayStatus !== workflowFilters.overallStatus && record.overallStatus !== workflowFilters.overallStatus) return false;
    return true;
  });
}

function selectedWorkflowRecord(snapshot) {
  const filtered = filteredWorkflowRecords(snapshot);
  let record = filtered.find((item) => item.recordId === selectedWorkflowRecordId);
  if (!record && snapshot.records.length) {
    record = snapshot.records.find((item) => item.recordId === selectedWorkflowRecordId) || filtered[0] || snapshot.records[0];
    if (record) setSelectedWorkflowRecordId(record.recordId);
  }
  return record || null;
}

function toWorkflowRule(rule, index = 0) {
  const source = safeObject(rule);
  const harnessNos = safeArray(source.carrierHarnessIds).map((item) => toText(item, '')).filter(Boolean);
  return {
    id: toText(source.ruleId, `rule-${index + 1}`),
    feeType: toText(source.feeTypeLabel || source.feeType, '一次性费用'),
    ruleName: toText(source.ruleName, `${toText(source.feeTypeLabel || source.feeType, '规则')} ${index + 1}`),
    harnessNos,
    harnessNoText: harnessNos.join(','),
    recoveryLimitSets: numberOr(source.recoveryCapSets, 50000),
    unitRecovery: numberOr(source.perSetAllocation, 0),
    totalAmount: numberOr(source.totalAmount, 0),
    includedInUnitPrice: !!source.includeInUnitPrice,
    separatePayment: !!source.standalonePayment,
    isActive: !!source.isActive,
    isTemplateRow: !!source.isTemplateOnly,
    triggerCondition: toText(source.triggerCondition, ''),
    note: toText(source.note, ''),
    ownerRole: toText(source.ownerRole, 'sales'),
    updatedAt: toText(source.updatedAt, ''),
  };
}

function fromWorkflowRule(rule) {
  const source = safeObject(rule);
  return {
    ruleId: toText(source.id || source.ruleId, ''),
    ruleName: toText(source.ruleName, ''),
    feeType: toText(source.feeType, '一次性费用'),
    feeTypeLabel: toText(source.feeType, '一次性费用'),
    carrierHarnessIds: safeArray(source.harnessNos).length
      ? safeArray(source.harnessNos)
      : String(source.harnessNoText || '')
        .split(/[\s,，;；]+/g)
        .map((item) => item.trim())
        .filter(Boolean),
    recoveryCapSets: numberOr(source.recoveryLimitSets, 0),
    perSetAllocation: numberOr(source.unitRecovery, 0),
    totalAmount: numberOr(source.totalAmount, 0),
    includeInUnitPrice: !!source.includedInUnitPrice,
    standalonePayment: !!source.separatePayment,
    isActive: !!source.isActive,
    isTemplateOnly: !!source.isTemplateRow,
    triggerCondition: toText(source.triggerCondition, ''),
    note: toText(source.note, ''),
    ownerRole: toText(source.ownerRole, 'sales'),
    updatedAt: new Date().toISOString(),
  };
}

function buildQuoteWorkflowPayloadLegacy(model) {
  const snapshot = latestSalesRuleSnapshot || getSalesRuleSnapshot(model);
  return {
    schemaVersion: snapshot.schemaVersion || 1,
    quoteContext: buildQuoteContext(model),
    roles: safeArray(snapshot.roles).length
      ? safeArray(snapshot.roles).map((role) => ({
        id: toText(role.id || role.roleCode, ''),
        role: toText(role.role || role.roleName, ''),
        fields: toText(role.fields, safeArray(role.responsibilities).join('、')),
        note: toText(role.note, ''),
      }))
      : DATA_RESPONSIBILITY_ROWS.map((row, index) => ({
        id: `role-${index + 1}`,
        role: row.role,
        fields: row.fields,
        note: row.note,
      })),
    rules: safeArray(snapshot.rules).map((rule, index) => toWorkflowRule(rule, index)),
    updatedAt: toText(snapshot.updatedAt, ''),
  };
}

function buildQuoteWorkflowPayload(model) {
  const workflowSnapshot = latestWorkflowSnapshot || getWorkflowSnapshot(model);
  ensureWorkflowDraftDefaults(model);
  return {
    schemaVersion: workflowSnapshot.schemaVersion || 1,
    quoteContext: buildQuoteContext(model),
    currentRole: activeWorkflowRole,
    currentRoleLabel: workflowRoleLabel(activeWorkflowRole),
    roles: clonePlain(workflowSnapshot.roles, []),
    stages: clonePlain(workflowSnapshot.stages, []),
    fieldDefinitions: clonePlain(workflowSnapshot.fieldDefinitions, []),
    impactModuleOptions: clonePlain(WORKFLOW_IMPACT_OPTIONS, []),
    availableHarnesses: workflowAvailableHarnesses(model),
    records: filteredWorkflowRecords(workflowSnapshot),
    selectedRecord: selectedWorkflowRecord(workflowSnapshot),
    filters: clonePlain(workflowFilters, {}),
    createDraft: clonePlain(workflowCreateDraft, {}),
    errors: clonePlain(workflowUiErrors, []),
    updatedAt: toText(workflowSnapshot.updatedAt, ''),
  };
}

function buildPreviewSalesRuleSnapshot(model) {
  const snapshot = latestSalesRuleSnapshot || getSalesRuleSnapshot(model);
  return {
    schemaVersion: numberOr(snapshot.schemaVersion, 1),
    quoteType: normalizeQuoteType(activeQuoteType),
    baselineQuoteVersion: String(baselineQuoteVersion || '').trim(),
    quoteContext: buildQuoteContext(model),
    rules: safeArray(snapshot.rules).map((rule) => ({
      ruleId: toText(rule.ruleId, ''),
      costType: toText(rule.feeTypeLabel || rule.feeType, 'unknown'),
      lineIds: safeArray(rule.carrierHarnessIds).map((item) => toText(item, '')).filter(Boolean),
      recoverLimitSets: numberOr(rule.recoveryCapSets, 0),
      singleUnitFee: numberOr(rule.perSetAllocation, 0),
      totalAmount: numberOr(rule.totalAmount, 0),
      shareMode: rule.standalonePayment ? 'separate_payment' : (rule.includeInUnitPrice ? 'included_in_price' : 'mixed'),
      isEnabled: !!rule.isActive,
      isEffective: !!rule.isActive && !rule.isTemplateOnly && (Math.abs(numberOr(rule.totalAmount, 0)) > 0 || Math.abs(numberOr(rule.perSetAllocation, 0)) > 0),
      isTemplateRow: !!rule.isTemplateOnly,
      triggerCondition: toText(rule.triggerCondition, ''),
      note: toText(rule.note, ''),
      deliveredSets: numberOr(rule.deliveredSets, 0),
      loadShares: safeObject(rule.loadShares),
      owner: toText(rule.ownerRole, 'sales'),
      updatedAt: toText(rule.updatedAt, ''),
    })),
    tasks: safeArray(snapshot.tasks).map((task) => ({
      id: toText(task.id || task.taskId, ''),
      title: toText(task.title || task.name, ''),
      owner: toText(task.owner || task.assignee || task.role, ''),
      due: toText(task.due || task.dueDate || task.deadline, ''),
      status: toText(task.status || task.state, ''),
      note: toText(task.note || task.description || task.message, ''),
      updatedAt: toText(task.updatedAt, ''),
    })),
    recoveryTracking: safeArray(snapshot.recoveryTracking).map((record) => ({
      harnessId: toText(record.harnessId || record.lineId || record.harnessNo, ''),
      harnessName: toText(record.harnessName || record.lineName || record.name, ''),
      deliveredSets: Math.max(0, numberOr(record.deliveredSets ?? record.deliveredUnits ?? record.shippedSets, 0)),
      recoveredAmount: Math.max(0, numberOr(record.recoveredAmount, 0)),
      remainingAmount: Math.max(0, numberOr(record.remainingAmount, 0)),
      updatedAt: toText(record.updatedAt, ''),
    })),
  };
}

function buildDefaultSalesRuleDraft() {
  return {
    feeType: '一次性费用',
    ruleName: '新规则',
    harnessNos: [],
    harnessNoText: '',
    recoveryLimitSets: 50000,
    unitRecovery: 0,
    totalAmount: 0,
    includedInUnitPrice: true,
    separatePayment: false,
    isActive: true,
    isTemplateRow: true,
    triggerCondition: '',
    note: '',
    ownerRole: 'sales',
    updatedAt: new Date().toISOString(),
  };
}

function mutateSalesRules(operationName, handler) {
  const repo = getSalesRuleRepo();
  if (!repo || typeof handler !== 'function') return false;
  try {
    handler(repo);
    latestSalesRuleSnapshot = typeof repo.getSnapshot === 'function'
      ? repo.getSnapshot()
      : getSalesRuleSnapshot(window._g281LastModel || {});
    queueRender();
    return true;
  } catch (error) {
    console.warn(`[G281] ${operationName}失败:`, error);
    return false;
  }
}

function createQuoteWorkflowActionsLegacy() {
  return {
    onQuoteTypeChange: (value) => setQuoteType(value),
    onBaselineChange: (value) => setBaselineQuoteVersion(value),
    onRuleAdd: (rule) => mutateSalesRules('新增销售规则', (repo) => repo.upsertRule(fromWorkflowRule(rule || buildDefaultSalesRuleDraft()))),
    onRuleChange: (rule) => mutateSalesRules('更新销售规则', (repo) => repo.upsertRule(fromWorkflowRule(rule || {}))),
    onRuleRemove: (rule) => mutateSalesRules('删除销售规则', (repo) => repo.removeRule(toText(rule?.id || rule?.ruleId || rule, ''))),
    onOpenRoleGuide: () => {
      if (el.dataResponsibilityMount && typeof el.dataResponsibilityMount.scrollIntoView === 'function') {
        el.dataResponsibilityMount.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }
    },
  };
}

function mutateWorkflow(operationName, handler) {
  const repo = getWorkflowRepo();
  if (!repo || typeof handler !== 'function') return false;
  try {
    handler(repo);
    latestWorkflowSnapshot = getWorkflowSnapshot(window._g281LastModel || {});
    queueRender();
    return true;
  } catch (error) {
    console.warn(`[G281] ${operationName}失败:`, error);
    setWorkflowUiError(error?.message || `${operationName}失败`);
    queueRender();
    return false;
  }
}

function createWorkflowRecord(recordType) {
  resetWorkflowUiErrors();
  const repo = getWorkflowRepo();
  const model = window._g281LastModel || {};
  if (!repo) {
    setWorkflowUiError('workflow repo 未就绪');
    queueRender();
    return false;
  }
  ensureWorkflowDraftDefaults(model);
  const payload = {
    quoteVersionId: toText(workflowCreateDraft.quoteVersionId, buildQuoteContext(model).quoteVersion || toText(model?.versionTag, '')),
    harnessId: toText(workflowCreateDraft.harnessId, ''),
    harnessName: toText(workflowCreateDraft.harnessName, ''),
    scenarioName: toText(workflowCreateDraft.scenarioName, state.scenarioName),
    baselineQuoteVersion: toText(workflowCreateDraft.baselineQuoteVersion, baselineQuoteVersion),
    impactedModules: safeArray(workflowCreateDraft.impactedModules),
    metadata: {
      projectCode: PROJECT_CODE,
      scenarioName: toText(workflowCreateDraft.scenarioName, state.scenarioName),
    },
    createdBy: activeWorkflowRole,
  };
  try {
    const record = recordType === 'change'
      ? repo.createChangeQuoteRecord(payload)
      : repo.createProjectQuoteRecord(payload);
    setSelectedWorkflowRecordId(record?.recordId || '');
    latestWorkflowSnapshot = getWorkflowSnapshot(model);
    queueRender();
    return true;
  } catch (error) {
    setWorkflowUiError(error?.message || '创建记录失败');
    queueRender();
    return false;
  }
}

function createQuoteWorkflowActions() {
  return {
    onQuoteTypeChange: (value) => setQuoteType(value),
    onBaselineChange: (value) => setBaselineQuoteVersion(value),
    onRoleChange: (value) => setWorkflowRole(value),
    onDraftChange: (field, value) => {
      resetWorkflowUiErrors();
      updateWorkflowCreateDraft(field, value);
      queueRender();
    },
    onCreateProjectRecord: () => createWorkflowRecord('project'),
    onCreateChangeRecord: () => createWorkflowRecord('change'),
    onSelectRecord: (recordId) => {
      setSelectedWorkflowRecordId(recordId);
      queueRender();
    },
    onFilterChange: (field, value) => {
      updateWorkflowFilter(field, value);
      queueRender();
    },
    onOpenRoleGuide: () => {
      if (el.dataResponsibilityMount && typeof el.dataResponsibilityMount.scrollIntoView === 'function') {
        el.dataResponsibilityMount.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }
    },
  };
}

function createRecoveryCenterActions() {
  return {
    onTaskAdd: (task) => mutateSalesRules('新增回收任务', (repo) => {
      if (typeof repo.upsertTask !== 'function') return;
      repo.upsertTask({
        id: toText(task?.id || task?.taskId, ''),
        title: toText(task?.title || task?.name, '新回收任务'),
        owner: toText(task?.owner || task?.assignee || task?.role, '项目经理'),
        due: toText(task?.due || task?.dueDate || task?.deadline, '本周'),
        status: toText(task?.status || task?.state, '待处理'),
        note: toText(task?.note || task?.description || task?.message, ''),
        updatedAt: new Date().toISOString(),
      });
    }),
    onTaskChange: (task) => mutateSalesRules('更新回收任务', (repo) => {
      if (typeof repo.upsertTask !== 'function') return;
      repo.upsertTask({
        id: toText(task?.id || task?.taskId, ''),
        title: toText(task?.title || task?.name, ''),
        owner: toText(task?.owner || task?.assignee || task?.role, ''),
        due: toText(task?.due || task?.dueDate || task?.deadline, ''),
        status: toText(task?.status || task?.state, ''),
        note: toText(task?.note || task?.description || task?.message, ''),
        updatedAt: new Date().toISOString(),
      });
    }),
    onTaskRemove: (task) => mutateSalesRules('删除回收任务', (repo) => {
      if (typeof repo.removeTask !== 'function') return;
      repo.removeTask(toText(task?.id || task?.taskId || task, ''));
    }),
    onShipmentChange: (record) => mutateSalesRules('更新回收出货', (repo) => {
      const harnessId = toText(record?.harnessId || record?.lineId || record?.harnessNo, '');
      if (!harnessId) return;
      const deliveredSets = Math.max(0, numberOr(record?.deliveredSets ?? record?.deliveredUnits ?? record?.shippedSets, 0));
      const recoveredAmount = Math.max(0, numberOr(record?.recoveredAmount, 0));
      const remainingAmount = Math.max(0, numberOr(record?.remainingAmount, 0));
      if (deliveredSets <= 0 && recoveredAmount <= 0 && remainingAmount <= 0 && typeof repo.removeTrackingRecord === 'function') {
        repo.removeTrackingRecord(harnessId);
        return;
      }
      if (typeof repo.upsertTrackingRecord !== 'function') return;
      repo.upsertTrackingRecord({
        harnessId,
        harnessName: toText(record?.harnessName || record?.lineName || record?.name, ''),
        deliveredSets,
        recoveredAmount,
        remainingAmount,
        updatedAt: new Date().toISOString(),
      });
    }),
  };
}

function buildExecutionPreview(model) {
  const api = window.G281ExecutionPreview;
  if (!api || typeof api.buildPreview !== 'function') return null;
  try {
    return api.buildPreview({
      runtime: RUNTIME,
      model,
      salesRuleSnapshot: buildPreviewSalesRuleSnapshot(model),
    });
  } catch (error) {
    console.warn('[G281] 构建执行预演失败:', error);
    return null;
  }
}

function prepareAsyncExecutionPreview(model) {
  latestSalesRuleSnapshot = getSalesRuleSnapshot(model);
  latestWorkflowSnapshot = getWorkflowSnapshot(model);
  latestExecutionPreview = buildExecutionPreview(model);
  window._g281LastSalesRuleSnapshot = latestSalesRuleSnapshot;
  window._g281LastWorkflowSnapshot = latestWorkflowSnapshot;
  window._g281LastExecutionPreview = latestExecutionPreview;
  return latestExecutionPreview;
}

function mountQuoteWorkflowModule(model) {
  const api = window.G281QuoteWorkflow;
  const renderer = api && (api.render || api.mount);
  if (typeof renderer !== 'function') return false;
  try {
    return !!renderer({
      quoteWorkflowMount: el.quoteWorkflowMount,
      salesRuleMount: el.salesRuleMount,
      baselineQuoteInfoMount: el.baselineQuoteInfoMount,
      dataResponsibilityMount: el.dataResponsibilityMount,
    }, buildQuoteWorkflowPayload(model), createQuoteWorkflowActions());
  } catch (error) {
    console.warn('[G281] 挂载报价协作模块失败:', error);
    return false;
  }
}

function mountRecoveryCenterModule(model) {
  const api = window.G281RecoveryCenter;
  const renderer = api && (api.render || api.mount);
  if (typeof renderer !== 'function' || !el.recoveryTriggerMount || !latestExecutionPreview) return false;
  try {
    const snapshot = latestSalesRuleSnapshot || getSalesRuleSnapshot(model);
    return !!renderer(el.recoveryTriggerMount, {
      recovery: latestExecutionPreview.recovery,
      alerts: latestExecutionPreview.alerts,
      quoteContext: latestExecutionPreview.quoteContext || buildQuoteContext(model),
      harnessRows: latestExecutionPreview.harnessRows,
      tasks: safeArray(snapshot.tasks),
      recoveryTracking: safeArray(snapshot.recoveryTracking),
    }, {
      projectCode: PROJECT_CODE,
      actions: createRecoveryCenterActions(),
    });
  } catch (error) {
    console.warn('[G281] 挂载回收中心失败:', error);
    return false;
  }
}

function financialContextSummary(model) {
  const financialContext = model?.financialContext || {};
  if (financialContext.exactApplied) {
    return `当前命中核算表口径：${toText(financialContext.exactLabel || financialContext.exactKey, '未命名版本')}`;
  }
  return `当前按执行预演口径推演：${toText(financialContext.referenceLabel || financialContext.referenceKey, '实时组合版本')}`;
}

function updateWireCatalogToggleButton(hiddenCount = 0) {
  if (!el.toggleWireCatalogViewBtn) return;
  const showAll = !!showInactiveWireModels;
  const suffix = hiddenCount > 0 && !showAll ? `（${hiddenCount}）` : '';
  el.toggleWireCatalogViewBtn.textContent = showAll ? '隐藏非版本导线' : `显示非版本导线${suffix}`;
  el.toggleWireCatalogViewBtn.setAttribute('aria-pressed', showAll ? 'true' : 'false');
  el.toggleWireCatalogViewBtn.disabled = !showAll && hiddenCount <= 0;
  el.toggleWireCatalogViewBtn.title = showAll
    ? '恢复为只显示当前版本实际使用的导线型号'
    : '展开显示当前版本未用、零用量或缺失的导线型号';
}

function clearProfitInsightsCache() {
  profitInsightsCacheKey = '';
  profitInsightsCacheValue = null;
}

function persistTargetMarginOverride(value) {
  try {
    if (value === null || value === undefined) {
      window.localStorage.removeItem(TARGET_MARGIN_STORAGE_KEY);
      return;
    }
    window.localStorage.setItem(TARGET_MARGIN_STORAGE_KEY, String(value));
  } catch (error) {
    // Ignore local persistence failures in offline browser mode.
  }
}

function setCustomTargetMarginPercent(value) {
  const normalized = normalizeTargetMarginPercent(value);
  if (normalized === null) return;
  customTargetMarginPercent = normalized;
  persistTargetMarginOverride(normalized);
  clearProfitInsightsCache();
  render(calcModel());
}

function resetCustomTargetMarginPercent(options = {}) {
  customTargetMarginPercent = null;
  persistTargetMarginOverride(null);
  clearProfitInsightsCache();
  if (!options.skipRender) {
    render(calcModel());
  }
}

function hydrateUserVersions() {
  const store = readUserVersionStore();
  USER_VERSION_GROUPS.forEach((group) => {
    const entries = store?.[group];
    if (!entries || typeof entries !== 'object') return;
    BASE.versions[group] = {
      ...(BASE.versions[group] || {}),
      ...clonePlain(entries, {}),
    };
  });
}

function cleanupVersionManagement() {
  Object.entries(VERSION_CLEANUP_KEEP_KEYS).forEach(([group, keepKeys]) => {
    const options = BASE.versions?.[group];
    if (!options || typeof options !== 'object') return;
    const nextOptions = keepKeys.reduce((acc, key) => {
      if (Object.prototype.hasOwnProperty.call(options, key)) {
        acc[key] = options[key];
      }
      return acc;
    }, {});
    if (Object.keys(nextOptions).length) {
      BASE.versions[group] = nextOptions;
    }
  });

  Object.keys(DEFAULT_STATE).forEach((group) => {
    const options = BASE.versions?.[group];
    if (!options || typeof options !== 'object') return;
    if (options[state[group]]) return;
    const fallbackKey = resolveVersionFallbackKey(group);
    if (fallbackKey) {
      state[group] = fallbackKey;
    }
  });

  connectorPricingState = sanitizeConnectorPricing(
    connectorPricingState,
    BASE.versions?.connector?.[state.connector] ? state.connector : DEFAULT_STATE.connector
  );
}

function isUserCreatedVersion(group, key = state[group]) {
  return Boolean(BASE.versions?.[group]?.[key]?.userCreated);
}

function currentBomDraftSnapshot() {
  return {
    bomWireDrawing: Number(controls.bomWireDrawing.value) || 0,
    bomWireEat: Number(controls.bomWireEat.value) || 0,
    bomWireHidden: Number(controls.bomWireHidden.value) || 0,
    bomTapeDiameter: Number(controls.bomTapeDiameter.value) || 0,
    bomTapeWidth: Number(controls.bomTapeWidth.value) || 0,
    bomTapeOverlap: Number(controls.bomTapeOverlap.value) || 0,
  };
}

function currentLaborDraftSnapshot() {
  return {
    directHours: Number(controls.directHours.value) || 0,
    directRate: Number(controls.directRate.value) || 0,
    manufacturingHours: Number(controls.manufacturingHours.value) || 0,
    manufacturingRate: Number(controls.manufacturingRate.value) || 0,
  };
}

function currentPackagingDraftSnapshot() {
  return {
    packInner: Number(controls.packInner.value) || 0,
    packFreight: Number(controls.packFreight.value) || 0,
    packWarehouse: Number(controls.packWarehouse.value) || 0,
    packOther: Number(controls.packOther.value) || 0,
  };
}

function currentSalesDraftSnapshot() {
  return yearInputs.map((input) => Math.max(0, Number(input.value) || 0));
}

function currentMixDraftSnapshot() {
  return normalizeMix(mixInputs.map((input) => input.value));
}

function lifecycleTemplateYears() {
  return Array.isArray(BASE?.years) && BASE.years.length
    ? BASE.years.map((year) => Number(year)).filter((year) => Number.isFinite(year))
    : [];
}

function lifecycleTemplateVolumes() {
  return Array.isArray(BASE?.volumes) && BASE.volumes.length
    ? BASE.volumes.map((value) => Math.max(0, Number(value) || 0))
    : lifecycleTemplateYears().map(() => 0);
}

function normalizeTemplateYear(value, fallback = null) {
  const numeric = Number(value);
  if (Number.isFinite(numeric) && numeric >= 1900 && numeric <= 3000) {
    return Math.round(numeric);
  }
  const match = String(value ?? '').match(/\b(20\d{2}|19\d{2})\b/);
  return match ? Number(match[1]) : fallback;
}

function parseLifecycleRate(value) {
  if (value === null || value === undefined || value === '') return 0;
  if (typeof value === 'number' && Number.isFinite(value)) {
    if (value > 1 && value <= 100) return Math.max(0, value / 100);
    return Math.max(0, value);
  }
  const text = String(value).trim();
  if (!text) return 0;
  const numeric = parseNumericCellValue(text);
  if (numeric === null) return 0;
  if (text.includes('%')) return Math.max(0, numeric / 100);
  if (numeric > 1 && numeric <= 100) return Math.max(0, numeric / 100);
  return Math.max(0, numeric);
}

function parseLifecycleMoney(value) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  const numeric = parseNumericCellValue(value);
  return numeric === null ? 0 : numeric;
}

function lifecycleVolumeTotal() {
  return lifecycleTemplateVolumes().reduce((sum, value) => sum + value, 0);
}

function legacyAnnualDropYearRows(years, annualRate) {
  const list = Array.isArray(years) ? years : [];
  const rate = Math.max(0, Number(annualRate) || 0);
  return list.map((year, index) => {
    if (index === 0 || rate <= 0) {
      return { year, rate: 0, note: index === 0 ? '首年基准' : '' };
    }
    const prevFactor = Math.max(0, 1 - rate * (index - 1));
    const nextFactor = Math.max(0, 1 - rate * index);
    const derivedRate = prevFactor > 0 ? Math.max(0, 1 - (nextFactor / prevFactor)) : 0;
    return {
      year,
      rate: derivedRate,
      note: '旧版线性年降迁移',
    };
  });
}

function normalizeAnnualDropYearRows(rawRows, years = lifecycleTemplateYears(), legacyAnnualRate = 0) {
  const yearList = Array.isArray(years) ? years : [];
  const rowMap = new Map();
  (Array.isArray(rawRows) ? rawRows : []).forEach((row) => {
    const year = normalizeTemplateYear(row?.year);
    if (!Number.isFinite(year)) return;
    rowMap.set(year, {
      year,
      rate: parseLifecycleRate(row?.rate),
      note: toText(row?.note, ''),
    });
  });
  if (!rowMap.size && Number(legacyAnnualRate)) {
    legacyAnnualDropYearRows(yearList, legacyAnnualRate).forEach((row) => rowMap.set(row.year, row));
  }
  return yearList.map((year, index) => rowMap.get(year) || {
    year,
    rate: 0,
    note: index === 0 ? '首年基准' : '',
  });
}

function normalizeOneTimeCustomerEntries(rawEntries, years = lifecycleTemplateYears(), legacyAmountTotal = 0) {
  const yearList = Array.isArray(years) ? years : [];
  const firstYear = yearList[0] || new Date().getFullYear();
  const lifecycleVolume = lifecycleVolumeTotal();
  const entries = (Array.isArray(rawEntries) ? rawEntries : []).reduce((acc, entry, index) => {
    const amount = Math.max(0, parseLifecycleMoney(entry?.amount));
    if (!amount) return acc;
    const modeText = toText(entry?.mode, '').toLowerCase();
    const mode = modeText.includes('直付') || modeText.includes('direct')
      ? 'direct'
      : (modeText.includes('摊') || modeText.includes('alloc') ? 'allocate' : 'allocate');
    acc.push({
      category: toText(entry?.category, `其他${index + 1}`),
      mode,
      amount,
      recognitionYear: normalizeTemplateYear(entry?.recognitionYear, firstYear),
      allocationStartYear: normalizeTemplateYear(entry?.allocationStartYear, firstYear),
      allocationVolume: Math.max(0, parseLifecycleMoney(entry?.allocationVolume || lifecycleVolume)),
      note: toText(entry?.note, ''),
    });
    return acc;
  }, []);
  if (entries.length) {
    return entries;
  }
  const legacyAmount = Math.max(0, Number(legacyAmountTotal) || 0);
  if (!legacyAmount) {
    return [];
  }
  return [{
    category: '其他',
    mode: 'allocate',
    amount: legacyAmount,
    recognitionYear: firstYear,
    allocationStartYear: firstYear,
    allocationVolume: lifecycleVolume,
    note: '旧版一次性费用迁移',
  }];
}

function normalizeRebateYearRows(rawRows, years = lifecycleTemplateYears(), volumes = lifecycleTemplateVolumes(), legacyAmountPerSet = 0) {
  const yearList = Array.isArray(years) ? years : [];
  const rowMap = new Map();
  (Array.isArray(rawRows) ? rawRows : []).forEach((row) => {
    const year = normalizeTemplateYear(row?.year);
    if (!Number.isFinite(year)) return;
    rowMap.set(year, {
      year,
      amountTotal: Math.max(0, parseLifecycleMoney(row?.amountTotal)),
      note: toText(row?.note, ''),
    });
  });
  if (!rowMap.size && Number(legacyAmountPerSet)) {
    yearList.forEach((year, index) => {
      rowMap.set(year, {
        year,
        amountTotal: Math.max(0, (Number(volumes[index]) || 0) * (Number(legacyAmountPerSet) || 0)),
        note: '旧版返点迁移',
      });
    });
  }
  return yearList.map((year) => rowMap.get(year) || {
    year,
    amountTotal: 0,
    note: '',
  });
}

function workbookTemplateSheetByName(workbookSnapshot, sheetName) {
  if (!isUniverWorkbookSnapshot(workbookSnapshot)) return null;
  return Object.values(workbookSnapshot.sheets || {}).find((sheet) => sheet?.name === sheetName) || null;
}

function workbookTemplateRows(workbookSnapshot, sheetName) {
  const sheet = workbookTemplateSheetByName(workbookSnapshot, sheetName);
  return sheet ? buildUniverWorkbookRowMap(sheet) : new Map();
}

function workbookTemplateCellValue(rowMap, rowIndex, columnIndex) {
  const row = rowMap instanceof Map ? rowMap.get(rowIndex) : null;
  return row ? row[columnIndex] : null;
}

function findWorkbookHeaderRow(rowMap, expectedHeaders = []) {
  const headers = Array.isArray(expectedHeaders) ? expectedHeaders : [];
  const rowIndexes = Array.from(rowMap.keys()).sort((left, right) => left - right);
  return rowIndexes.find((rowIndex) => {
    const row = rowMap.get(rowIndex) || {};
    const cells = Object.values(row).map((value) => toText(value, ''));
    return headers.every((header) => cells.some((value) => value.includes(header)));
  }) || 0;
}

function parseAnnualDropWorkbookRows(workbookSnapshot, fallbackRows = [], fallbackAnnualRate = 0) {
  const rowMap = workbookTemplateRows(workbookSnapshot, '版本录入');
  const years = lifecycleTemplateYears();
  const headerRow = findWorkbookHeaderRow(rowMap, ['年份', '年降率']);
  if (!headerRow) {
    return normalizeAnnualDropYearRows(fallbackRows, years, fallbackAnnualRate);
  }
  const parsedRows = [];
  for (let rowIndex = headerRow + 1; rowIndex <= headerRow + years.length + 16; rowIndex += 1) {
    const year = normalizeTemplateYear(workbookTemplateCellValue(rowMap, rowIndex, 1));
    if (!Number.isFinite(year)) continue;
    parsedRows.push({
      year,
      rate: parseLifecycleRate(workbookTemplateCellValue(rowMap, rowIndex, 2)),
      note: toText(workbookTemplateCellValue(rowMap, rowIndex, 4), ''),
    });
  }
  return normalizeAnnualDropYearRows(parsedRows, years, fallbackAnnualRate);
}

function parseOneTimeCustomerWorkbookEntries(workbookSnapshot, fallbackEntries = [], fallbackAmountTotal = 0) {
  const rowMap = workbookTemplateRows(workbookSnapshot, '版本录入');
  const years = lifecycleTemplateYears();
  const headerRow = findWorkbookHeaderRow(rowMap, ['类别', '金额', '方式']);
  if (headerRow) {
    const parsed = [];
    const rowIndexes = Array.from(rowMap.keys()).sort((left, right) => left - right);
    rowIndexes
      .filter((rowIndex) => rowIndex > headerRow)
      .forEach((rowIndex) => {
        const category = toText(workbookTemplateCellValue(rowMap, rowIndex, 1), '');
        const amount = Math.max(0, parseLifecycleMoney(workbookTemplateCellValue(rowMap, rowIndex, 2)));
        if (!category && !amount) return;
        parsed.push({
          category: category || `其他${rowIndex - headerRow}`,
          amount,
          mode: toText(workbookTemplateCellValue(rowMap, rowIndex, 3), '按量分摊'),
          recognitionYear: normalizeTemplateYear(workbookTemplateCellValue(rowMap, rowIndex, 4), years[0] || new Date().getFullYear()),
          allocationStartYear: normalizeTemplateYear(workbookTemplateCellValue(rowMap, rowIndex, 5), years[0] || new Date().getFullYear()),
          allocationVolume: Math.max(0, parseLifecycleMoney(workbookTemplateCellValue(rowMap, rowIndex, 6))),
          note: toText(workbookTemplateCellValue(rowMap, rowIndex, 7), ''),
        });
      });
    if (parsed.length) {
      return normalizeOneTimeCustomerEntries(parsed, years, 0);
    }
  }
  const legacyAmount = Math.max(
    0,
    parseLifecycleMoney(workbookTemplateCellValue(rowMap, 2, 2))
      || Number(fallbackAmountTotal)
      || 0,
  );
  return normalizeOneTimeCustomerEntries(fallbackEntries, years, legacyAmount);
}

function parseRebateWorkbookRows(workbookSnapshot, fallbackRows = [], fallbackAmountPerSet = 0) {
  const rowMap = workbookTemplateRows(workbookSnapshot, '版本录入');
  const years = lifecycleTemplateYears();
  const volumes = lifecycleTemplateVolumes();
  const headerRow = findWorkbookHeaderRow(rowMap, ['年份', '返点']);
  if (!headerRow) {
    return normalizeRebateYearRows(fallbackRows, years, volumes, fallbackAmountPerSet);
  }
  const parsedRows = [];
  for (let rowIndex = headerRow + 1; rowIndex <= headerRow + years.length + 16; rowIndex += 1) {
    const year = normalizeTemplateYear(workbookTemplateCellValue(rowMap, rowIndex, 1));
    if (!Number.isFinite(year)) continue;
    parsedRows.push({
      year,
      amountTotal: Math.max(0, parseLifecycleMoney(workbookTemplateCellValue(rowMap, rowIndex, 2))),
      note: toText(workbookTemplateCellValue(rowMap, rowIndex, 3), ''),
    });
  }
  return normalizeRebateYearRows(parsedRows, years, volumes, fallbackAmountPerSet);
}

function workbookSeedCell(address, value, options = {}) {
  return {
    address,
    row: Number(options.row) || Number(String(address).replace(/^[A-Z]+/, '')),
    column: Number(options.column) || excelColumnLabelToNumber(String(address).replace(/\d+/g, '')),
    value,
    formula: options.formula || null,
    dataType: options.dataType || (options.formula ? 'f' : null),
    styleId: Number.isFinite(Number(options.styleId)) ? Number(options.styleId) : null,
  };
}

function workbookSeedFromSheets(workbookName, sourceFileName, sourcePath, sheetDefs = []) {
  return {
    workbookName,
    sourceFileName: sourceFileName || workbookName,
    sourcePath: sourcePath || '',
    versionKey: 'manual-seed',
    versionLabel: workbookName,
    sheetOrder: sheetDefs.map((sheet) => sheet.sheetName),
    hiddenSheets: [],
    styleTable: {},
    sheets: sheetDefs,
  };
}

function annualDropWorkbookSeed(versionKey = state.annualDrop, option = BASE.versions?.annualDrop?.[versionKey] || {}) {
  const snapshot = annualDropVersionSnapshot(versionKey);
  const cells = [
    workbookSeedCell('A1', '年份'),
    workbookSeedCell('B1', '年降率'),
    workbookSeedCell('C1', '当年ASP系数'),
    workbookSeedCell('D1', '说明'),
  ];
  snapshot.yearRows.forEach((row, index) => {
    const line = index + 2;
    cells.push(workbookSeedCell(`A${line}`, row.year));
    cells.push(workbookSeedCell(`B${line}`, row.rate));
    if (index === 0) {
      cells.push(workbookSeedCell(`C${line}`, 1));
    } else {
      cells.push(workbookSeedCell(`C${line}`, null, { formula: `=C${line - 1}*(1-B${line})` }));
    }
    cells.push(workbookSeedCell(`D${line}`, row.note || (index === 0 ? '首年基准，默认不降价' : '')));
  });
  const sheet = {
    sheetName: '版本录入',
    sheetState: 'visible',
    maxRow: Math.max(snapshot.yearRows.length + 2, 16),
    maxColumn: 4,
    freezePane: 'A2',
    mergedRanges: [],
    rowDimensions: [],
    columnDimensions: [
      { index: 1, min: 1, max: 1, width: 88 },
      { index: 2, min: 2, max: 2, width: 88 },
      { index: 3, min: 3, max: 3, width: 110 },
      { index: 4, min: 4, max: 4, width: 220 },
    ],
    hiddenRows: [],
    hiddenColumns: [],
    cells,
  };
  return workbookSeedFromSheets(
    toText(option?.workbook, `${snapshot.label || versionKey}年降模板`),
    toText(option?.templateSource, `${snapshot.label || versionKey}年降模板`),
    '',
    [sheet],
  );
}

function oneTimeCustomerWorkbookSeed(versionKey = state.oneTimeCustomer, option = BASE.versions?.oneTimeCustomer?.[versionKey] || {}) {
  const snapshot = oneTimeCustomerVersionSnapshot(versionKey);
  const cells = [
    workbookSeedCell('A1', '类别'),
    workbookSeedCell('B1', '金额'),
    workbookSeedCell('C1', '方式'),
    workbookSeedCell('D1', '确认年份'),
    workbookSeedCell('E1', '分摊起始年'),
    workbookSeedCell('F1', '分摊总量'),
    workbookSeedCell('G1', '备注'),
  ];
  snapshot.entries.forEach((entry, index) => {
    const line = index + 2;
    cells.push(workbookSeedCell(`A${line}`, entry.category));
    cells.push(workbookSeedCell(`B${line}`, entry.amount));
    cells.push(workbookSeedCell(`C${line}`, entry.mode === 'direct' ? '客户直付' : '按量分摊'));
    cells.push(workbookSeedCell(`D${line}`, entry.recognitionYear));
    cells.push(workbookSeedCell(`E${line}`, entry.allocationStartYear));
    cells.push(workbookSeedCell(`F${line}`, entry.allocationVolume));
    cells.push(workbookSeedCell(`G${line}`, entry.note));
  });
  const sheetDefs = [
    {
      sheetName: '版本录入',
      sheetState: 'visible',
      maxRow: Math.max(snapshot.entries.length + 6, 24),
      maxColumn: 7,
      freezePane: 'A2',
      mergedRanges: [],
      rowDimensions: [],
      columnDimensions: [
        { index: 1, min: 1, max: 1, width: 120 },
        { index: 2, min: 2, max: 2, width: 100 },
        { index: 3, min: 3, max: 3, width: 100 },
        { index: 4, min: 4, max: 4, width: 88 },
        { index: 5, min: 5, max: 5, width: 110 },
        { index: 6, min: 6, max: 6, width: 100 },
        { index: 7, min: 7, max: 7, width: 220 },
      ],
      hiddenRows: [],
      hiddenColumns: [],
      cells,
    },
    { sheetName: '工装费', sheetState: 'visible', maxRow: 200, maxColumn: 26, freezePane: null, mergedRanges: [], rowDimensions: [], columnDimensions: [], hiddenRows: [], hiddenColumns: [], cells: [] },
    { sheetName: '试验费', sheetState: 'visible', maxRow: 200, maxColumn: 26, freezePane: null, mergedRanges: [], rowDimensions: [], columnDimensions: [], hiddenRows: [], hiddenColumns: [], cells: [] },
    { sheetName: '研发费', sheetState: 'visible', maxRow: 200, maxColumn: 26, freezePane: null, mergedRanges: [], rowDimensions: [], columnDimensions: [], hiddenRows: [], hiddenColumns: [], cells: [] },
  ];
  return workbookSeedFromSheets(
    toText(option?.workbook, `${snapshot.label || versionKey}一次性费用模板`),
    toText(option?.templateSource, `${snapshot.label || versionKey}一次性费用模板`),
    '',
    sheetDefs,
  );
}

function rebateWorkbookSeed(versionKey = state.rebate, option = BASE.versions?.rebate?.[versionKey] || {}) {
  const snapshot = rebateVersionSnapshot(versionKey);
  const cells = [
    workbookSeedCell('A1', '年份'),
    workbookSeedCell('B1', '年度返点总额'),
    workbookSeedCell('C1', '备注'),
  ];
  snapshot.yearRows.forEach((row, index) => {
    const line = index + 2;
    cells.push(workbookSeedCell(`A${line}`, row.year));
    cells.push(workbookSeedCell(`B${line}`, row.amountTotal));
    cells.push(workbookSeedCell(`C${line}`, row.note));
  });
  const sheet = {
    sheetName: '版本录入',
    sheetState: 'visible',
    maxRow: Math.max(snapshot.yearRows.length + 4, 16),
    maxColumn: 3,
    freezePane: 'A2',
    mergedRanges: [],
    rowDimensions: [],
    columnDimensions: [
      { index: 1, min: 1, max: 1, width: 88 },
      { index: 2, min: 2, max: 2, width: 120 },
      { index: 3, min: 3, max: 3, width: 220 },
    ],
    hiddenRows: [],
    hiddenColumns: [],
    cells,
  };
  return workbookSeedFromSheets(
    toText(option?.workbook, `${snapshot.label || versionKey}返点模板`),
    toText(option?.templateSource, `${snapshot.label || versionKey}返点模板`),
    '',
    [sheet],
  );
}

function buildLifecycleWorkbookSnapshotFromSeed(seed, fallbackName) {
  if (!seed) return null;
  const runtimeHelper = window.G281BomTemplateRuntime || null;
  if (!runtimeHelper?.buildWorkbookSnapshotFromSeed) return null;
  try {
    return runtimeHelper.buildWorkbookSnapshotFromSeed(seed, {
      workbookName: seed.workbookName || fallbackName || '版本模板',
    });
  } catch (error) {
    console.warn('[G281Dashboard] Failed to build lifecycle workbook snapshot', error);
    return null;
  }
}

function annualDropVersionSnapshot(versionKey) {
  const option = BASE.versions?.annualDrop?.[versionKey] || {};
  const workbookSnapshot = isUniverWorkbookSnapshot(option?.templateWorkbookSnapshot)
    ? option.templateWorkbookSnapshot
    : buildLifecycleWorkbookSnapshotFromSeed(option?.templateWorkbookSeed, '年降模板');
  const yearRows = workbookSnapshot
    ? parseAnnualDropWorkbookRows(workbookSnapshot, option?.yearRows, option?.annualRate)
    : normalizeAnnualDropYearRows(option?.yearRows, lifecycleTemplateYears(), option?.annualRate);
  const annualRate = yearRows.find((row, index) => index > 0 && Number(row?.rate) > 0)?.rate
    ?? yearRows.find((row) => Number(row?.rate) > 0)?.rate
    ?? 0;
  return {
    label: option.label || versionKey,
    annualRate: coerceNumber(annualRate, 0),
    yearRows,
    templateWorkbookSeed: clonePlain(option?.templateWorkbookSeed, null),
    sourceNote: option.sourceNote || option.note || '',
  };
}

function oneTimeCustomerVersionSnapshot(versionKey) {
  const option = BASE.versions?.oneTimeCustomer?.[versionKey] || {};
  const workbookSnapshot = isUniverWorkbookSnapshot(option?.templateWorkbookSnapshot)
    ? option.templateWorkbookSnapshot
    : buildLifecycleWorkbookSnapshotFromSeed(option?.templateWorkbookSeed, '一次性费用模板');
  const entries = workbookSnapshot
    ? parseOneTimeCustomerWorkbookEntries(workbookSnapshot, option?.entries, option?.amountTotal)
    : normalizeOneTimeCustomerEntries(option?.entries, lifecycleTemplateYears(), option?.amountTotal);
  const amountTotal = entries.reduce((sum, entry) => sum + Math.max(0, Number(entry?.amount) || 0), 0);
  return {
    label: option.label || versionKey,
    amountTotal: coerceNumber(amountTotal, 0),
    entries,
    templateWorkbookSeed: clonePlain(option?.templateWorkbookSeed, null),
    sourceNote: option.sourceNote || option.note || '',
  };
}

function rebateVersionSnapshot(versionKey) {
  const option = BASE.versions?.rebate?.[versionKey] || {};
  const workbookSnapshot = isUniverWorkbookSnapshot(option?.templateWorkbookSnapshot)
    ? option.templateWorkbookSnapshot
    : buildLifecycleWorkbookSnapshotFromSeed(option?.templateWorkbookSeed, '返点模板');
  const yearRows = workbookSnapshot
    ? parseRebateWorkbookRows(workbookSnapshot, option?.yearRows, option?.amountPerSet)
    : normalizeRebateYearRows(option?.yearRows, lifecycleTemplateYears(), lifecycleTemplateVolumes(), option?.amountPerSet);
  const amountTotal = yearRows.reduce((sum, row) => sum + Math.max(0, Number(row?.amountTotal) || 0), 0);
  const amountPerSet = lifecycleVolumeTotal() ? amountTotal / lifecycleVolumeTotal() : 0;
  return {
    label: option.label || versionKey,
    amountPerSet: coerceNumber(amountPerSet, 0),
    amountTotal: coerceNumber(amountTotal, 0),
    yearRows,
    templateWorkbookSeed: clonePlain(option?.templateWorkbookSeed, null),
    sourceNote: option.sourceNote || option.note || '',
  };
}

function currentScenarioStateSnapshot() {
  return { ...state };
}

const DASHBOARD_VERSION_CHANGE_EVENT = 'g281:dashboard-version-change';

function dispatchDashboardVersionChange(group, key, extra = {}) {
  window.dispatchEvent(new CustomEvent(DASHBOARD_VERSION_CHANGE_EVENT, {
    detail: {
      group,
      key,
      state: currentScenarioStateSnapshot(),
      timestamp: new Date().toISOString(),
      ...extra,
    },
  }));
}

function resolveWorkbookVersionKeyFromBomState(bomKey = state.bom) {
  const bomOption = BASE.versions?.bom?.[bomKey] || {};
  const candidate = bomOption.workbookVersionKeyFallback || WORKBOOK_VERSION_FALLBACKS[bomKey] || bomKey || 'quote';
  if (RUNTIME.bomWorkbookCopies?.versions?.[candidate] || RUNTIME.configSheetCopies?.versions?.[candidate]) {
    return candidate;
  }
  const available = Object.keys(RUNTIME.bomWorkbookCopies?.versions || RUNTIME.configSheetCopies?.versions || {});
  return available[0] || 'quote';
}

function averageAsp(model) {
  const totalRevenue = Number(model?.totalRevenue) || 0;
  const totalVolume = Number(model?.totalVolume) || 0;
  return totalVolume ? totalRevenue / totalVolume : 0;
}

function ensureVersionTimelineAssets() {
  if (window.G281VersionTimeline) {
    return Promise.resolve(window.G281VersionTimeline);
  }
  if (versionTimelineLoader) {
    return versionTimelineLoader;
  }
  versionTimelineLoader = new Promise((resolve, reject) => {
    let script = document.querySelector('script[data-g281-version-timeline]');
    if (!script) {
      script = document.createElement('script');
      script.src = './g281_version_timeline.js?v=20260329a';
      script.dataset.g281VersionTimeline = 'true';
      document.body.appendChild(script);
    }
    script.addEventListener('load', () => resolve(window.G281VersionTimeline || null), { once: true });
    script.addEventListener('error', (error) => reject(error), { once: true });
    if (window.G281VersionTimeline) {
      resolve(window.G281VersionTimeline);
    }
  });
  return versionTimelineLoader;
}

function versionTimelineOptionDate(group, key, option = {}) {
  return option.updatedAt || option.importedAt || option.createdAt
    || seededVersionRecord(group, key)?.createdAt
    || FINANCIAL_VERSIONS?.meta?.generatedAt
    || HISTORY_SEED[0]?.createdAt
    || new Date().toISOString();
}

function buildVersionTimelineEvents() {
  const timelineGroups = [
    ['bom', 'BOM'],
    ['metal', '铜铝基价'],
    ['connector', '连接器'],
    ['labor', '工时'],
    ['equipment', '资源投入'],
    ['packaging', '包装物流'],
    ['annualDrop', '年降'],
    ['oneTimeCustomer', '一次性费用'],
    ['rebate', '返点'],
    ['vave', 'VAVE'],
  ];

  const visibleTimelineGroups = timelineGroups.filter(([group]) => group !== 'vave');
  return visibleTimelineGroups.flatMap(([group, label]) => orderedVersionEntries(group, BASE.versions?.[group] || {}).map(([key, option]) => {
    const createdAt = versionTimelineOptionDate(group, key, option);
    return {
      id: `${group}:${key}`,
      name: option?.label || key,
      group: label,
      createdAt,
      updatedAt: option?.updatedAt || option?.importedAt || option?.createdAt || createdAt,
      meta: {
        group,
        key,
      },
    };
  }));
}

function renderVersionTimelineWithPlugin() {
  if (!el.versionTimelineMount) return;
  ensureVersionTimelineAssets()
    .then((timeline) => {
      if (!timeline?.renderTimeline) return;
      versionTimelineHandle?.destroy?.();
      versionTimelineHandle = timeline.renderTimeline(el.versionTimelineMount, buildVersionTimelineEvents(), {
        title: '成本要素版本时间线',
        subtitle: '显示各版本的发布时间与最近更新时间',
      });
    })
    .catch(() => {});
}

function insightPayloadKey(draft = {}, scenarioState = {}) {
  return JSON.stringify({
    state: scenarioState,
    targetMarginPercent: customTargetMarginPercent,
    draft: {
      copperPrice: Number(draft.copperPrice) || 0,
      aluminumPrice: Number(draft.aluminumPrice) || 0,
      directHours: Number(draft.directHours) || 0,
      directRate: Number(draft.directRate) || 0,
      manufacturingHours: Number(draft.manufacturingHours) || 0,
      manufacturingRate: Number(draft.manufacturingRate) || 0,
      packInner: Number(draft.packInner) || 0,
      packFreight: Number(draft.packFreight) || 0,
      packWarehouse: Number(draft.packWarehouse) || 0,
      packOther: Number(draft.packOther) || 0,
      bomWireDrawing: Number(draft.bomWireDrawing) || 0,
      bomWireEat: Number(draft.bomWireEat) || 0,
      bomWireHidden: Number(draft.bomWireHidden) || 0,
      bomTapeDiameter: Number(draft.bomTapeDiameter) || 0,
      bomTapeWidth: Number(draft.bomTapeWidth) || 0,
      bomTapeOverlap: Number(draft.bomTapeOverlap) || 0,
      mix: Array.isArray(draft.mix) ? draft.mix : [],
      volumes: Array.isArray(draft.volumes) ? draft.volumes : [],
      asp: Array.isArray(draft.asp) ? draft.asp : [],
      connectorPricing: draft.connectorPricing || {},
    },
  });
}

function templateColumnLabel(index) {
  let next = Number(index) + 1;
  let label = '';
  while (next > 0) {
    const offset = (next - 1) % 26;
    label = String.fromCharCode(65 + offset) + label;
    next = Math.floor((next - 1) / 26);
  }
  return label || 'A';
}

function templateValueColumnIndex(group) {
  return 5;
}

function templateFieldAddress(group, index) {
  return `${templateColumnLabel(templateValueColumnIndex(group))}${index + 2}`;
}

function isLocalFileProtocol() {
  return typeof window !== 'undefined' && window.location?.protocol === 'file:';
}

function canUseUniverTemplateEditor() {
  return Boolean(window.G281UniverTemplateEditor?.create);
}

function versionTemplatePasteHintText(context) {
  if (context?.editorMode === 'univer') {
    if (isLocalFileProtocol()) {
      return '右侧为 Excel 式编辑区。离线首次打开会先初始化 1-3 秒，随后可直接粘贴区域、输入公式、拖动填充。';
    }
    return '右侧已切换为 Excel 式编辑区，可直接粘贴区域、输入公式、拖动填充。';
  }
  return context?.pasteHint || '可直接在右侧模板中录入、粘贴和保存。';
}

function versionTemplateStatusText(context) {
  if (!context) return '';
  if (context.editorMode === 'univer') {
    if (isLocalFileProtocol()) {
      return `当前参考版本：${context.activeLabel}。右侧保持 Excel 式编辑区，离线首次打开会先初始化工作表，请等待 1-3 秒后再开始编辑。`;
    }
    return `当前参考版本：${context.activeLabel}。右侧可直接像 Excel 一样录入、粘贴和写公式，保存后生成新版本。`;
  }
  return `当前参考版本：${context.activeLabel}。当前使用内置表格模板，可直接录入、粘贴和保存为新版本。`;
}

function syncVersionTemplateChromeLabels() {
  const textMap = new Map([
    [el.versionTemplateSaveInlineBtn, '保存为新版本'],
    [el.versionTemplateResetBtn, '恢复当前值'],
    [el.versionTemplateParseBtn, '解析粘贴'],
    [el.versionTemplateInsertRowBtn, '插入行'],
    [el.versionTemplateInsertColumnBtn, '插入列'],
    [el.versionTemplateMergeBtn, '合并单元格'],
    [el.versionTemplateUnmergeBtn, '取消合并'],
    [el.versionTemplateFilterBtn, '筛选'],
    [el.versionTemplateConditionalBtn, '条件格式'],
    [el.versionTemplateInsertImageBtn, '图片'],
    [el.versionTemplateAddSheetBtn, '新增 Sheet'],
    [el.versionTemplateSaveBtn, '保存为新版本'],
  ]);
  textMap.forEach((text, node) => {
    if (node) node.textContent = text;
  });

  const nameLabel = el.versionTemplateName?.closest('.version-template-name-field')?.querySelector('span');
  if (nameLabel) nameLabel.textContent = '版本名称';
  if (el.versionTemplateName) el.versionTemplateName.placeholder = '请输入版本名称';

  const sourceLabel = el.versionTemplateSource?.closest('.field')?.querySelector('span');
  if (sourceLabel) sourceLabel.textContent = '来源文件 / 说明';
  if (el.versionTemplateSource) {
    el.versionTemplateSource.placeholder = '例如：新增核算表 / 手工试算 / Excel 片段';
  }

  const noteLabel = el.versionTemplateNote?.closest('.field')?.querySelector('span');
  if (noteLabel) noteLabel.textContent = '备注';
  if (el.versionTemplateNote) {
    el.versionTemplateNote.placeholder = '可补充版本用途、适用阶段、人工假设等信息';
  }

  const pasteTitle = el.versionTemplatePasteHint?.closest('.version-template-paste-head')?.querySelector('strong');
  if (pasteTitle) pasteTitle.textContent = 'Excel 粘贴区';
  if (el.versionTemplatePaste) {
    el.versionTemplatePaste.placeholder = '把 Excel 选中的区域直接粘贴到这里';
  }

  if (el.versionTemplateStatus && !versionTemplateDraft) {
    el.versionTemplateStatus.textContent = '当前还未粘贴数据，可直接在右侧模板里手工填写。';
  }
  if (el.versionTemplateSelectionMeta) el.versionTemplateSelectionMeta.textContent = '当前选区 --';
  if (el.versionTemplateSheetMeta) el.versionTemplateSheetMeta.textContent = '工作表 --';
  if (el.versionTemplateEditorMeta) el.versionTemplateEditorMeta.textContent = 'Excel 编辑区';
  const captionControls = el.toggleVersionTemplateWindowBtn?.closest('.window-caption-controls');
  if (captionControls) {
    captionControls.setAttribute('aria-label', '窗口控制');
  }

  if (el.minimizeVersionTemplateWindowBtn) {
    el.minimizeVersionTemplateWindowBtn.setAttribute('aria-label', '最小化');
    el.minimizeVersionTemplateWindowBtn.setAttribute('title', '最小化');
  }
  if (el.closeVersionTemplateBtn) {
    el.closeVersionTemplateBtn.setAttribute('aria-label', '关闭');
    el.closeVersionTemplateBtn.setAttribute('title', '关闭');
  }
}

function versionTemplateEditorMetaText(context = versionTemplateDraft) {
  if (!context) return '编辑模式待定';
  if (context.editorMode === 'univer') {
    return isLocalFileProtocol() ? '离线 Excel 编辑区' : 'Excel 编辑区';
  }
  return '内置表格模板';
}

function versionTemplateDebugEnabled() {
  return new URLSearchParams(window.location.search).has('debugTemplateState');
}

function pushVersionTemplateDebugError(source, error) {
  if (!versionTemplateDebugEnabled()) return;
  VERSION_TEMPLATE_DEBUG_ERRORS.push({
    time: new Date().toISOString(),
    source,
    message: String(error && error.stack || error),
  });
  if (VERSION_TEMPLATE_DEBUG_ERRORS.length > 8) {
    VERSION_TEMPLATE_DEBUG_ERRORS.splice(0, VERSION_TEMPLATE_DEBUG_ERRORS.length - 8);
  }
}

function ensureVersionTemplateDebugPanel() {
  if (!versionTemplateDebugEnabled()) return null;
  if (versionTemplateDebugPanel && document.body.contains(versionTemplateDebugPanel)) {
    return versionTemplateDebugPanel;
  }
  versionTemplateDebugPanel = document.createElement('pre');
  versionTemplateDebugPanel.className = 'version-template-debug-panel';
  document.body.appendChild(versionTemplateDebugPanel);
  return versionTemplateDebugPanel;
}

function updateVersionTemplateDebugPanel() {
  const panel = ensureVersionTemplateDebugPanel();
  if (!panel) return;
  const modalPanel = versionTemplatePanelElement();
  const main = el.versionTemplateFields?.parentElement || null;
  const fields = el.versionTemplateFields;
  const overlay = fields?.querySelector('.version-template-loading');
  const rect = fields?.getBoundingClientRect?.() || { width: 0, height: 0 };
  const panelRect = modalPanel?.getBoundingClientRect?.() || { width: 0, height: 0 };
  const mainRect = main?.getBoundingClientRect?.() || { width: 0, height: 0 };
  const style = fields ? window.getComputedStyle(fields) : null;
  const lines = [
    `debug=${new Date().toISOString()}`,
    `protocol=${window.location.protocol}`,
    `modalHidden=${Boolean(el.versionTemplateModal?.hidden)}`,
    `draftGroup=${versionTemplateDraft?.group || ''}`,
    `editorMode=${versionTemplateDraft?.editorMode || ''}`,
    `editorReason=${versionTemplateDraft?.editorReason || ''}`,
    `hasEditor=${Boolean(versionTemplateEditor)}`,
    `panelClass=${modalPanel?.className || ''}`,
    `panelRect=${Math.round(panelRect.width)}x${Math.round(panelRect.height)}`,
    `mainRect=${Math.round(mainRect.width)}x${Math.round(mainRect.height)}`,
    `canvasCount=${fields?.querySelectorAll('canvas').length || 0}`,
    `svgCount=${fields?.querySelectorAll('svg').length || 0}`,
    `childCount=${fields?.childElementCount || 0}`,
    `htmlLength=${fields?.innerHTML?.length || 0}`,
    `overlayHidden=${overlay ? overlay.hidden : 'n/a'}`,
    `overlayText=${overlay?.textContent?.trim() || ''}`,
    `rect=${Math.round(rect.width)}x${Math.round(rect.height)}`,
    `display=${style?.display || ''}`,
    `visibility=${style?.visibility || ''}`,
    `position=${style?.position || ''}`,
    `firstChild=${fields?.firstElementChild?.className || fields?.firstElementChild?.tagName || ''}`,
    `status=${el.versionTemplateStatus?.textContent || ''}`,
  ];
  if (VERSION_TEMPLATE_DEBUG_ERRORS.length) {
    lines.push('errors=');
    VERSION_TEMPLATE_DEBUG_ERRORS.forEach((item) => {
      lines.push(`${item.time} ${item.source}: ${item.message}`);
    });
  }
  panel.textContent = lines.join('\n');
}

function startVersionTemplateDebugPanel() {
  if (!versionTemplateDebugEnabled()) return;
  stopVersionTemplateDebugPanel();
  ensureVersionTemplateDebugPanel();
  updateVersionTemplateDebugPanel();
  versionTemplateDebugTimer = window.setInterval(updateVersionTemplateDebugPanel, 300);
}

function stopVersionTemplateDebugPanel() {
  if (versionTemplateDebugTimer) {
    window.clearInterval(versionTemplateDebugTimer);
    versionTemplateDebugTimer = 0;
  }
}

function installVersionTemplateDebugHooks() {
  if (!versionTemplateDebugEnabled() || versionTemplateDebugHooksApplied) return;
  versionTemplateDebugHooksApplied = true;
  window.addEventListener('error', (event) => {
    pushVersionTemplateDebugError('window.error', event.error || event.message || 'unknown error');
    updateVersionTemplateDebugPanel();
  }, true);
  window.addEventListener('unhandledrejection', (event) => {
    pushVersionTemplateDebugError('window.unhandledrejection', event.reason || 'unknown rejection');
    updateVersionTemplateDebugPanel();
  });
}

function templateSheetCellValue(rawInput, fallbackValue = '') {
  if (rawInput === null || rawInput === undefined || rawInput === '') {
    return fallbackValue ?? '';
  }
  if (typeof rawInput === 'number' || typeof rawInput === 'boolean') {
    return rawInput;
  }
  const text = String(rawInput).trim();
  if (!text) return fallbackValue ?? '';
  if (text.startsWith('=')) return text;
  const parsedNumber = parseNumericCellValue(text);
  return parsedNumber !== null ? parsedNumber : text;
}

function shallowObjectEqual(left = {}, right = {}) {
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  if (leftKeys.length !== rightKeys.length) return false;
  return leftKeys.every((key) => left[key] === right[key]);
}

function coerceNumber(value, fallback = 0) {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
}

function toText(value, fallback = '') {
  const text = String(value ?? '').trim();
  return text || fallback;
}

function connectorTemplateFieldKey(itemId) {
  return `connector_stage__${itemId}`;
}

function connectorTemplateJoin(values = [], separator = ' / ') {
  const list = Array.isArray(values) ? values : Array.from(values || []);
  const unique = [...new Set(list.map((value) => toText(value)).filter(Boolean))];
  return unique.join(separator);
}

function connectorTemplateJoinLines(values = []) {
  return connectorTemplateJoin(values, '\n');
}

function connectorTemplatePriceText(values = []) {
  const unique = [...new Set((values || [])
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value))
    .map((value) => Number(value.toFixed(4))))];
  if (!unique.length) return '';
  unique.sort((left, right) => left - right);
  if (unique.length === 1) return unique[0];
  return unique.map((value) => String(value)).join(' / ');
}

function connectorTemplateStageCandidates(fallbackKey = '') {
  return [...new Set([...connectorSelectableStageKeys, fallbackKey].filter(Boolean))]
    .map((key) => ({
      key,
      label: key === 'progress'
        ? connectorStageMetaMap.progress.label
        : (versionOptionLabel('connector', key) || key),
    }));
}

function connectorTemplateStageDisplay(stageKey, fallbackKey = '') {
  const key = stageKey || fallbackKey;
  if (!key) return '';
  const candidate = connectorTemplateStageCandidates(fallbackKey).find((item) => item.key === key);
  return candidate?.label || key;
}

function connectorTemplateStageHint(activeKey = '') {
  return connectorTemplateStageCandidates(activeKey).map((item) => item.label).join(' / ');
}

function connectorTemplateNormalizeStageInput(value) {
  const text = toText(value);
  if (!text) return '';
  const simpleFormulaMatch = text.match(/^=\s*["']?([^"']+)["']?\s*$/);
  return normalizeTemplateLookup(simpleFormulaMatch ? simpleFormulaMatch[1] : text);
}

function connectorTemplateStageKeyFromInput(value, fallbackKey = '') {
  const normalized = connectorTemplateNormalizeStageInput(value);
  if (!normalized) return fallbackKey;
  if (['跟随默认', '跟随当前', '当前默认', '当前版本', 'default', 'follow'].some((item) => normalized === normalizeTemplateLookup(item))) {
    return fallbackKey;
  }
  const match = connectorTemplateStageCandidates(fallbackKey).find((item) => {
    const keyMatch = normalizeTemplateLookup(item.key) === normalized;
    const labelMatch = normalizeTemplateLookup(item.label) === normalized;
    return keyMatch || labelMatch;
  });
  return match?.key || fallbackKey;
}

function connectorTemplateProtocolCount(summary, itemId, key) {
  if (summary) return protocolCount(summary, key);
  return protocolRowsForItem(itemId).filter((row) => row?.statusKey === key).length;
}

function connectorTemplateRolledUpStatus(summary, itemId) {
  if (summary) return protocolRolledUpLabel(summary);
  const rows = protocolRowsForItem(itemId);
  if (!rows.length) return '未配置';
  if (rows.every((row) => row?.statusKey === 'confirmed')) return '已达成';
  if (rows.every((row) => row?.statusKey === 'quoted_pending')) return '待确认';
  if (rows.every((row) => row?.statusKey === 'dev_pending')) return '开发中';
  if (rows.every((row) => row?.statusKey === 'no_reply')) return '暂无回复';
  return '部分达成';
}

function resolveConnectorTemplateItemId(groupKey = '') {
  return CONNECTOR_TEMPLATE_GROUP_TO_ITEM[groupKey] || '';
}

function collectConnectorTemplateValues(targetSet, values = []) {
  (values || []).forEach((value) => {
    const text = toText(value);
    if (text) targetSet.add(text);
  });
}

function collectConnectorTemplateVersionInfo(rowBucket, versionKey, row) {
  if (!rowBucket || !row) return;
  const versionLabel = BOM_VERSION_TEXT_MAP[versionKey] || versionKey;
  const assemblyTargets = rowBucket[`${versionKey}Assemblies`] || rowBucket.assemblyRefs;
  collectConnectorTemplateValues(assemblyTargets, [
    row.partNumber,
    ...(Array.isArray(row.assemblyRefs) ? row.assemblyRefs : []),
  ]);
  collectConnectorTemplateValues(rowBucket.suppliers, [
    ...(Array.isArray(row.suppliers) ? row.suppliers : []),
    ...(Array.isArray(row.remarks) ? row.remarks : []),
  ]);
  collectConnectorTemplateValues(rowBucket.partNumbers, [row.partNumber]);
  collectConnectorTemplateValues(rowBucket.sapNos, Array.isArray(row.sapNos) ? row.sapNos : []);
  const detailText = [
    versionLabel,
    [toText(row.partNumber), toText(row.partName)].filter(Boolean).join(' / '),
    Array.isArray(row.assemblyRefs) && row.assemblyRefs.length ? `引用:${connectorTemplateJoin(row.assemblyRefs)}` : '',
  ].filter(Boolean).join(' | ');
  if (detailText) {
    rowBucket.partDetails.add(detailText);
  }
}

function collectConnectorTemplatePartInfo(rowBucket, versionKey, part) {
  if (!rowBucket || !part) return;
  const versionLabel = BOM_VERSION_TEXT_MAP[versionKey] || versionKey;
  collectConnectorTemplateValues(rowBucket.suppliers, [
    ...(Array.isArray(part.suppliers) ? part.suppliers : []),
    ...(Array.isArray(part.remarks) ? part.remarks : []),
  ]);
  collectConnectorTemplateValues(rowBucket.partNumbers, [part.partNumber]);
  collectConnectorTemplateValues(rowBucket.sapNos, Array.isArray(part.sapNos) ? part.sapNos : []);
  const qty = Number(part.quantity);
  const qtyText = Number.isFinite(qty) && qty > 0 ? `x${qty}` : '';
  const supplierText = connectorTemplateJoin([
    ...(Array.isArray(part.suppliers) ? part.suppliers : []),
    ...(Array.isArray(part.remarks) ? part.remarks : []),
  ]);
  const sapText = connectorTemplateJoin(Array.isArray(part.sapNos) ? part.sapNos : []);
  const detailText = [
    versionLabel,
    [toText(part.partNumber), toText(part.partName)].filter(Boolean).join(' / '),
    qtyText,
    sapText ? `SAP:${sapText}` : '',
    supplierText ? `供应商:${supplierText}` : '',
  ].filter(Boolean).join(' | ');
  if (detailText) {
    rowBucket.partDetails.add(detailText);
  }
  const partKey = [
    versionKey,
    toText(part.partNumber),
    toText(part.partName),
    connectorTemplateJoin(Array.isArray(part.sapNos) ? part.sapNos : []),
    Number.isFinite(qty) ? qty : '',
    toText(part.unit),
    connectorTemplateJoin(Array.isArray(part.suppliers) ? part.suppliers : []),
    connectorTemplateJoin(Array.isArray(part.assemblyRefs) ? part.assemblyRefs : []),
  ].join('||');
  if (rowBucket.partRowKeys.has(partKey)) return;
  rowBucket.partRowKeys.add(partKey);
  rowBucket.partRows.push({
    versionKey,
    versionLabel,
    partNumber: toText(part.partNumber),
    partName: toText(part.partName),
    quantity: Number.isFinite(qty) ? qty : '',
    unit: toText(part.unit),
    suppliers: [...new Set((Array.isArray(part.suppliers) ? part.suppliers : []).map((value) => toText(value)).filter(Boolean))],
    remarks: [...new Set((Array.isArray(part.remarks) ? part.remarks : []).map((value) => toText(value)).filter(Boolean))],
    otherRemarks: [...new Set((Array.isArray(part.otherRemarks) ? part.otherRemarks : []).map((value) => toText(value)).filter(Boolean))],
    sapNos: [...new Set((Array.isArray(part.sapNos) ? part.sapNos : []).map((value) => toText(value)).filter(Boolean))],
    assemblyRefs: [...new Set((Array.isArray(part.assemblyRefs) ? part.assemblyRefs : []).map((value) => toText(value)).filter(Boolean))],
    functions: [...new Set((Array.isArray(part.functions) ? part.functions : []).map((value) => toText(value)).filter(Boolean))],
  });
}

function connectorTemplateVersionSortWeight(versionKey = '') {
  const order = ['quote', 'fixed', 'tt'];
  const index = order.indexOf(versionKey);
  return index === -1 ? order.length + 1 : index;
}

function connectorTemplateSortPartRows(rows = []) {
  return rows.slice().sort((left, right) => {
    const versionDelta = connectorTemplateVersionSortWeight(left?.versionKey) - connectorTemplateVersionSortWeight(right?.versionKey);
    if (versionDelta !== 0) return versionDelta;
    const leftPart = toText(left?.partNumber);
    const rightPart = toText(right?.partNumber);
    if (leftPart !== rightPart) return leftPart.localeCompare(rightPart, 'zh-CN');
    return toText(left?.partName).localeCompare(toText(right?.partName), 'zh-CN');
  });
}

function createConnectorTemplateSeedRow(item, activeKey, currentOverrides = {}) {
  const summary = protocolSummaryForItem(item.id);
  const rows = protocolRowsForItem(item.id);
  const recommendedStage = summary?.recommendedStage || recommendedConnectorStage(summary) || 'quote';
  const currentStage = currentOverrides[item.id] || activeKey;
  return {
    itemId: item.id,
    itemCode: toText(item.code),
    itemLabel: toText(item.name || item.label || item.id),
    assemblyRefs: new Set(),
    quoteAssemblies: new Set(),
    fixedAssemblies: new Set(),
    ttAssemblies: new Set(),
    protocolAssemblies: new Set(),
    suppliers: new Set(toText(item.supplier) ? [toText(item.supplier)] : []),
    groupLabels: new Set(),
    harnessIds: new Set(),
    partNumbers: new Set(),
    sapNos: new Set(),
    partDetails: new Set(),
    partRows: [],
    partRowKeys: new Set(),
    protocolPrices: rows.map((row) => row?.targetProtocolPrice),
    progressPrices: rows.map((row) => row?.replyPrice),
    initialQuotes: rows.map((row) => protocolRowInitialQuote(row)),
    summary,
    bomHitCount: 0,
    recommendedStage,
    currentStage,
    confirmedCount: connectorTemplateProtocolCount(summary, item.id, 'confirmed'),
    quotedPendingCount: connectorTemplateProtocolCount(summary, item.id, 'quoted_pending'),
    devPendingCount: connectorTemplateProtocolCount(summary, item.id, 'dev_pending'),
    noReplyCount: connectorTemplateProtocolCount(summary, item.id, 'no_reply'),
    statusLabel: connectorTemplateRolledUpStatus(summary, item.id),
  };
}

function finalizeConnectorTemplateRow(row) {
  const assemblyLines = connectorTemplateJoinLines(
    row.quoteAssemblies.size
      ? [...row.quoteAssemblies]
      : (row.assemblyRefs.size ? [...row.assemblyRefs] : [...row.protocolAssemblies])
  );
  const bomLocation = connectorTemplateJoinLines([
    row.groupLabels.size ? `分组：${connectorTemplateJoin(row.groupLabels, ' / ')}` : '',
    row.harnessIds.size ? `线束：${connectorTemplateJoin(row.harnessIds, ' / ')}` : '',
    row.bomHitCount ? `BOM命中：${row.bomHitCount}` : '',
  ].filter(Boolean));
  return {
    itemId: row.itemId,
    itemCode: row.itemCode,
    itemLabel: row.itemLabel,
    assemblyNo: assemblyLines,
    supplier: connectorTemplateJoin(row.suppliers),
    protocolPrice: connectorTemplatePriceText(row.protocolPrices),
    progressPrice: connectorTemplatePriceText(row.progressPrices),
    initialQuote: connectorTemplatePriceText(row.initialQuotes),
    statusLabel: row.statusLabel,
    confirmedCount: row.confirmedCount,
    quotedPendingCount: row.quotedPendingCount,
    devPendingCount: row.devPendingCount,
    noReplyCount: row.noReplyCount,
    recommendedStage: row.recommendedStage,
    recommendedStageLabel: connectorTemplateStageDisplay(row.recommendedStage, row.currentStage),
    currentStage: row.currentStage,
    currentStageLabel: connectorTemplateStageDisplay(row.currentStage, row.currentStage),
    sapNos: [...row.sapNos],
    harnessIds: [...row.harnessIds],
    groupLabels: [...row.groupLabels],
    partRows: connectorTemplateSortPartRows(row.partRows),
    partDetail: connectorTemplateJoinLines(row.partDetails),
    bomLocation,
  };
}

function buildConnectorTemplateRows(activeKey, activeOption = {}, templateSourceKey = activeKey) {
  const stageBaseKey = connectorVersionSet.has(templateSourceKey)
    ? templateSourceKey
    : (connectorVersionSet.has(activeOption?.sourceKey) ? activeOption.sourceKey : state.connector);
  const currentOverrides = sanitizeConnectorPricing(
    activeOption?.userCreated ? (activeOption.overrides || {}) : connectorPricingState,
    stageBaseKey
  );
  const savedRows = Array.isArray(activeOption?.templateRows) ? activeOption.templateRows : [];
  const savedRowMap = new Map(savedRows.filter((row) => row?.itemId).map((row) => [row.itemId, row]));

  const buckets = new Map();
  connectorItems.forEach((item) => {
    buckets.set(item.id, createConnectorTemplateSeedRow(item, stageBaseKey, currentOverrides));
  });

  const validation = RUNTIME.bomValidation;
  const harnessOrder = Array.isArray(validation?.harnessOrder) ? validation.harnessOrder : [];
  harnessOrder.forEach((harnessId) => {
    const groups = validation?.comparisons?.[harnessId]?.groups || [];
    groups.forEach((group) => {
      if (group?.section !== 'connector') return;
      const itemId = resolveConnectorTemplateItemId(group.key);
      if (!itemId || !buckets.has(itemId)) return;
      const bucket = buckets.get(itemId);
      bucket.groupLabels.add(toText(group.label || group.key));
      bucket.harnessIds.add(toText(harnessId));
      (group.aligned || []).forEach((alignedRow) => {
        bucket.bomHitCount += 1;
        Object.entries(alignedRow?.versions || {}).forEach(([versionKey, row]) => {
          collectConnectorTemplateVersionInfo(bucket, versionKey, row);
        });
        Object.entries(alignedRow?.partLists || {}).forEach(([versionKey, parts]) => {
          (parts || []).forEach((part) => collectConnectorTemplatePartInfo(bucket, versionKey, part));
        });
      });
    });
  });

  protocolRows.forEach((row) => {
    const itemId = row?.portfolioId;
    if (!itemId || !buckets.has(itemId)) return;
    const bucket = buckets.get(itemId);
    collectConnectorTemplateValues(bucket.protocolAssemblies, [protocolAssemblyNo(row)]);
    collectConnectorTemplateValues(bucket.suppliers, [row?.supplierRaw || row?.supplier]);
    if (row?.partNumber || row?.partName || row?.assemblyRemark || row?.customerRemark) {
      bucket.partDetails.add([
        '协议表',
        protocolAssemblyNo(row),
        renderProtocolPartDetail(row)
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim(),
      ].filter(Boolean).join(' | '));
    }
  });

  return connectorItems
    .map((item) => {
      const row = finalizeConnectorTemplateRow(buckets.get(item.id));
      const saved = savedRowMap.get(item.id);
      const currentStage = currentOverrides[row.itemId]
        || (connectorVersionSet.has(saved?.currentStage) ? saved.currentStage : row.currentStage)
        || stageBaseKey;
      return {
        ...row,
        currentStage,
        currentStageLabel: connectorTemplateStageDisplay(currentStage, stageBaseKey),
        recommendedStageLabel: connectorTemplateStageDisplay(row.recommendedStage || stageBaseKey, stageBaseKey),
      };
    })
    .filter((row) => row && (
      row.assemblyNo
      || (Array.isArray(row.partRows) && row.partRows.length)
      || row.partDetail
      || row.protocolPrice !== ''
      || row.progressPrice !== ''
      || row.initialQuote !== ''
      || row.bomLocation
      || row.currentStage
    ));
}

function buildConnectorTemplatePayloadRows(context, rawInputs = {}) {
  const baseRows = Array.isArray(context?.connectorRows) ? context.connectorRows : [];
  return baseRows.map((row) => {
    const fieldKey = connectorTemplateFieldKey(row.itemId);
    const rawStage = rawInputs[fieldKey] ?? row.currentStageLabel ?? '';
    const stageBaseKey = context?.connectorSourceKey || context?.activeStageKey || context?.activeKey || state.connector;
    const stageKey = connectorTemplateStageKeyFromInput(rawStage, row.currentStage || stageBaseKey);
    return {
      ...clonePlain(row, {}),
      fieldKey,
      rawStageInput: rawStage,
      currentStage: stageKey,
      currentStageLabel: connectorTemplateStageDisplay(stageKey, stageBaseKey),
    };
  });
}

function buildConnectorTemplateSheetModel(context) {
  const rows = Array.isArray(context?.connectorRows) ? context.connectorRows : [];
  const sheetRows = [];
  const mergeData = [];
  const fieldAddressMap = {};
  const assemblyRows = [];
  const detailRows = [];
  let sheetRowNumber = 2;

  rows.forEach((row, index) => {
    const fieldKey = connectorTemplateFieldKey(row.itemId);
    const stageValue = templateSheetCellValue(context?.rawInputs?.[fieldKey], row.currentStageLabel || '');
    const partRows = Array.isArray(row.partRows) && row.partRows.length
      ? row.partRows
      : [{
        versionLabel: '',
        partNumber: '',
        partName: '未提取散件',
        quantity: '',
        unit: '',
        suppliers: [],
        remarks: ['当前 BOM 尚未提取到该连接器散件清单'],
        otherRemarks: [],
        sapNos: [],
        assemblyRefs: [],
        functions: [],
      }];
    const startRow = sheetRowNumber;
    fieldAddressMap[fieldKey] = `R${startRow}`;

    sheetRows.push([
      index + 1,
      row.itemLabel || row.itemCode || row.itemId,
      '总成',
      row.assemblyNo || row.itemCode || '-',
      row.itemLabel || row.itemCode || '-',
      connectorTemplateJoin(row.sapNos, ' / ') || '',
      '',
      '',
      row.supplier || '-',
      templateSheetCellValue(row.protocolPrice, ''),
      templateSheetCellValue(row.progressPrice, ''),
      templateSheetCellValue(row.initialQuote, ''),
      row.statusLabel || '-',
      row.confirmedCount ?? 0,
      row.quotedPendingCount ?? 0,
      row.devPendingCount ?? 0,
      row.noReplyCount ?? 0,
      stageValue,
      '整套价格按连接器总成执行',
      row.bomLocation || '',
    ]);
    assemblyRows.push(startRow);
    sheetRowNumber += 1;

    partRows.forEach((part) => {
      const partRemark = [
        connectorTemplateJoin(part.functions, ' / '),
        connectorTemplateJoin(part.remarks, ' / '),
        connectorTemplateJoin(part.otherRemarks, ' / '),
      ].filter(Boolean).join(' | ');
      const partLocation = part.assemblyRefs?.length ? `引用 ${connectorTemplateJoin(part.assemblyRefs)}` : '';
      sheetRows.push([
        '',
        '',
        part.versionLabel ? `散件·${part.versionLabel}` : '散件',
        part.partNumber || '-',
        part.partName || '-',
        connectorTemplateJoin(part.sapNos, ' / ') || '',
        part.quantity === '' ? '' : part.quantity,
        part.unit || '',
        connectorTemplateJoin(part.suppliers, ' / ') || '-',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        partRemark,
        partLocation,
      ]);
      detailRows.push(sheetRowNumber);
      sheetRowNumber += 1;
    });

    const endRow = sheetRowNumber - 1;
    if (endRow > startRow) {
      ['A', 'B', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R'].forEach((column) => {
        mergeData.push({ range: `${column}${startRow}:${column}${endRow}` });
      });
    }
  });

  return {
    rows: sheetRows,
    mergeData,
    fieldAddressMap,
    assemblyRows,
    detailRows,
  };
}

function capitalValidationAmount(scopeId, kind, fallback) {
  const summaryKey = kind === 'quote' ? 'quoteSummary' : 'fixedSummary';
  const amount = Number(CAPITAL_VALIDATION?.comparisons?.[scopeId]?.[summaryKey]?.totalNewAmount);
  return Number.isFinite(amount) ? amount : coerceNumber(fallback, 0);
}

function equipmentVersionSnapshot(versionKey) {
  const option = BASE.versions?.equipment?.[versionKey] || {};
  const quoteSnapshot = {
    kind: 'quote',
    label: `${versionOptionLabel('equipment', 'base')}设备`,
    equipment: capitalValidationAmount('equipment', 'quote', BASE.capital?.equipment),
    tooling: capitalValidationAmount('tooling', 'quote', BASE.capital?.tooling),
    fixtures: capitalValidationAmount('fixtures', 'quote', BASE.capital?.fixtures),
    rnd: coerceNumber(BASE.capital?.rnd, 0),
    factor: 1,
    sourceNote: '',
  };
  const fixedSnapshot = {
    kind: 'fixed',
    label: `${versionOptionLabel('equipment', 'shared')}设备`,
    equipment: capitalValidationAmount('equipment', 'fixed', BASE.capital?.equipment),
    tooling: capitalValidationAmount('tooling', 'fixed', BASE.capital?.tooling),
    fixtures: capitalValidationAmount('fixtures', 'fixed', BASE.capital?.fixtures),
    rnd: coerceNumber(BASE.capital?.rnd, 0),
    factor: quoteSnapshot.equipment ? capitalValidationAmount('equipment', 'fixed', BASE.capital?.equipment) / quoteSnapshot.equipment : coerceNumber(option.factor, 1),
    sourceNote: '',
  };

  if ((option.userCreated || ['equipment', 'tooling', 'fixtures', 'rnd'].some((key) => option[key] !== undefined && option[key] !== null && option[key] !== ''))) {
    const equipment = coerceNumber(option.equipment, fixedSnapshot.equipment);
    const tooling = coerceNumber(option.tooling, fixedSnapshot.tooling);
    const fixtures = coerceNumber(option.fixtures, fixedSnapshot.fixtures);
    const rnd = coerceNumber(option.rnd, fixedSnapshot.rnd);
    return {
      kind: option.kind || 'custom',
      label: option.label || `${versionOptionLabel('equipment', versionKey)}设备`,
      equipment,
      tooling,
      fixtures,
      rnd,
      factor: quoteSnapshot.equipment ? equipment / quoteSnapshot.equipment : coerceNumber(option.factor, 1),
      sourceNote: option.sourceNote || '',
    };
  }

  if (versionKey === 'base') return quoteSnapshot;
  if (versionKey === 'shared') return fixedSnapshot;

  const scale = coerceNumber(option.factor, 1) || 1;
  return {
    kind: option.kind || 'tt',
    label: option.label || `${versionOptionLabel('equipment', versionKey)}设备`,
    equipment: fixedSnapshot.equipment * scale,
    tooling: fixedSnapshot.tooling * scale,
    fixtures: fixedSnapshot.fixtures * scale,
    rnd: fixedSnapshot.rnd,
    factor: scale,
    sourceNote: option.sourceNote || '',
  };
}

function suggestNewVersionLabel(group) {
  const baseLabel = versionOptionLabel(group, state[group]) || VERSION_GROUP_LABELS[group] || '新版本';
  const existingLabels = new Set(Object.values(BASE.versions?.[group] || {}).map((option) => option?.label).filter(Boolean));
  let index = Object.values(BASE.versions?.[group] || {}).filter((option) => option?.userCreated).length + 1;
  let candidate = `${baseLabel}-${index}`;
  while (existingLabels.has(candidate)) {
    index += 1;
    candidate = `${baseLabel}-${index}`;
  }
  return candidate;
}

function makeUserVersionKey(group) {
  let key = `user_${group}_${Date.now().toString(36)}`;
  let suffix = 2;
  while (BASE.versions?.[group]?.[key]) {
    key = `user_${group}_${Date.now().toString(36)}_${suffix}`;
    suffix += 1;
  }
  return key;
}

function inferImportedBomWorkbookVersionKey(record = {}) {
  const optionText = [
    record.versionKey,
    record.meta?.runtimeVersionKey,
    record.versionLabel,
    record.workbook?.workbookName,
    record.workbook?.sourceFileName,
    record.meta?.sourceFileName,
  ].filter(Boolean).join(' ');
  if (/tt/i.test(optionText)) return 'tt';
  if (/定点|fixed/i.test(optionText)) return 'fixed';
  if (/报价|quote/i.test(optionText)) return 'quote';
  return resolveWorkbookVersionKeyFromBomState();
}

function importedBomStateKeyFromWorkbookVersion(workbookVersionKey = '') {
  if (workbookVersionKey === 'fixed') return 'light';
  if (workbookVersionKey === 'tt') return 'regress';
  return 'freeze';
}

function getBomNativeVersionId(bomKey = state.bom) {
  const option = BASE.versions?.bom?.[bomKey] || {};
  return toText(option.nativeWorkbookVersionId, '');
}

function isUniverWorkbookSnapshot(value) {
  return Boolean(value && Array.isArray(value.sheetOrder) && value.sheets && !Array.isArray(value.sheets));
}

function buildSeedBomWorkbookSnapshotForOption(bomKey = state.bom, option = BASE.versions?.bom?.[bomKey] || null) {
  const runtimeHelper = window.G281BomTemplateRuntime || null;
  const workbookVersionKey = resolveWorkbookVersionKeyFromBomState(bomKey);
  if (!runtimeHelper || !RUNTIME?.bomWorkbookCopies || !workbookVersionKey) {
    return null;
  }

  try {
    if (runtimeHelper.buildWorkbookSnapshotFromSeed) {
      const seedPayload = RUNTIME?.bomWorkbookCopies?.versions?.[workbookVersionKey];
      const runtimeSnapshot = runtimeHelper.buildWorkbookSnapshotFromSeed(seedPayload, {
        workbookName: toText(option?.workbook, option?.label || workbookVersionKey),
      });
      if (isUniverWorkbookSnapshot(runtimeSnapshot)) {
        return runtimeSnapshot;
      }
    }
    if (runtimeHelper.buildVersionWorkbookSnapshot) {
      const runtimeSnapshot = runtimeHelper.buildVersionWorkbookSnapshot(workbookVersionKey, {
        source: RUNTIME.bomWorkbookCopies,
        workbookName: toText(option?.workbook, option?.label || workbookVersionKey),
      });
      if (isUniverWorkbookSnapshot(runtimeSnapshot)) {
        return runtimeSnapshot;
      }
    }
  } catch (error) {
    console.warn('[G281Dashboard] Failed to build runtime BOM snapshot', error);
  }

  return null;
}

async function resolveBomWorkbookSnapshotForOption(bomKey = state.bom) {
  const option = BASE.versions?.bom?.[bomKey] || null;
  if (!option) {
    return null;
  }

  if (isUniverWorkbookSnapshot(option.templateWorkbookSnapshot)) {
    return clonePlain(option.templateWorkbookSnapshot, null);
  }

  const seededSnapshot = buildSeedBomWorkbookSnapshotForOption(bomKey, option);
  if (!option.userCreated && isUniverWorkbookSnapshot(seededSnapshot)) {
    return seededSnapshot;
  }

  const nativeVersionId = toText(option.nativeWorkbookVersionId, '');
  if (nativeVersionId && factorVersionRepo?.getSnapshotByVersionId) {
    try {
      const persistedSnapshot = await factorVersionRepo.getSnapshotByVersionId(nativeVersionId, 'bom');
      if (isUniverWorkbookSnapshot(persistedSnapshot)) {
        return clonePlain(persistedSnapshot, null);
      }
    } catch (error) {
      console.warn('[G281Dashboard] Failed to load persisted BOM snapshot', error);
    }
  }

  if (isUniverWorkbookSnapshot(seededSnapshot)) {
    return seededSnapshot;
  }

  return null;
}

async function ensureBomSemanticReleaseForVersion(bomKey = state.bom, options = {}) {
  const option = BASE.versions?.bom?.[bomKey] || null;
  if (!option || !bomSemanticRepo?.saveBomReleaseFromSnapshot) {
    return null;
  }
  const parserVersion = toText(window.G281BomParser?.PARSER_VERSION, '');

  const existingReleaseId = toText(option.semanticReleaseId, '');
  if (existingReleaseId && !options.forceRefresh) {
    try {
      const existingGraph = await bomSemanticRepo.getBomReleaseGraph(existingReleaseId);
      const existingMeta = existingGraph?.release?.meta || {};
      const parserVersionMismatch = parserVersion && toText(existingMeta.parserVersion, '') !== parserVersion;
      const isStaleSeedRelease = !option.userCreated
        && resolveWorkbookVersionKeyFromBomState(bomKey)
        && Number(existingMeta.harnessCount || 0) <= 0;
      if (existingGraph?.release && !isStaleSeedRelease && !parserVersionMismatch) {
        return {
          releaseId: existingReleaseId,
          release: existingGraph.release,
          summary: clonePlain(option.semanticSummary, null),
          refreshed: false,
        };
      }
    } catch (error) {
      console.warn('[G281Dashboard] Failed to load existing semantic BOM release', error);
    }
  }

  const workbookSnapshot = await resolveBomWorkbookSnapshotForOption(bomKey);
  if (!isUniverWorkbookSnapshot(workbookSnapshot)) {
    return null;
  }

  let nativeVersionId = toText(option.nativeWorkbookVersionId, '');
  if (!nativeVersionId && factorVersionRepo?.saveFactorVersionFromSnapshot) {
    try {
      const storedSnapshot = await factorVersionRepo.saveFactorVersionFromSnapshot({
        factorType: 'bom',
        projectCode: PROJECT_CODE,
        versionId: `bom-native::${PROJECT_CODE}::${bomKey}`,
        versionLabel: option.label || bomKey,
        workbookSnapshot,
        workbookName: toText(option.workbook, option.label || bomKey),
        sourceType: 'runtime-seed',
        status: 'active',
        meta: {
          runtimeBomKey: bomKey,
          workbookVersionKey: resolveWorkbookVersionKeyFromBomState(bomKey),
        },
      });
      nativeVersionId = toText(storedSnapshot?.versionId, '');
      option.nativeWorkbookVersionId = nativeVersionId;
      option.factorSnapshotId = toText(storedSnapshot?.snapshotId, '');
    } catch (error) {
      console.warn('[G281Dashboard] Failed to persist native BOM snapshot before semantic parse', error);
    }
  }

  try {
    const semanticRecord = await bomSemanticRepo.saveBomReleaseFromSnapshot({
      releaseId: toText(options.releaseId, existingReleaseId || nativeVersionId || `bom-release::${PROJECT_CODE}::${bomKey}`),
      versionId: toText(options.versionId, nativeVersionId || existingReleaseId || `bom-release::${PROJECT_CODE}::${bomKey}`),
      releaseLabel: option.label || bomKey,
      versionLabel: option.label || bomKey,
      projectCode: PROJECT_CODE,
      snapshotId: toText(option.factorSnapshotId, ''),
      baseReleaseId: toText(options.baseReleaseId, ''),
      workbookSnapshot,
    });
    option.semanticReleaseId = semanticRecord?.releaseId || '';
    option.semanticSummary = clonePlain(semanticRecord?.summary, null);
    persistUserVersions();
    return {
      ...semanticRecord,
      refreshed: true,
    };
  } catch (error) {
    console.warn('[G281Dashboard] Failed to ensure semantic BOM release', error);
    return null;
  }
}

async function compareBomSemanticReleases(leftReleaseId, rightReleaseId, options = {}) {
  if (!leftReleaseId || !rightReleaseId || !bomSemanticRepo?.getBomReleaseGraph || !bomAlignmentEngine?.alignBomReleases || !bomDiffEngine?.buildBomDiffResult) {
    return null;
  }

  if (!options.forceRefresh && bomSemanticRepo?.getBomDiffResult) {
    try {
      const cached = await bomSemanticRepo.getBomDiffResult(leftReleaseId, rightReleaseId);
      if (cached && Array.isArray(cached.harnesses) && cached.harnesses.length) {
        return cached;
      }
    } catch (error) {
      console.warn('[G281Dashboard] Failed to read cached BOM diff result', error);
    }
  }

  try {
    const [leftGraph, rightGraph] = await Promise.all([
      bomSemanticRepo.getBomReleaseGraph(leftReleaseId),
      bomSemanticRepo.getBomReleaseGraph(rightReleaseId),
    ]);
    if (!leftGraph?.release || !rightGraph?.release) {
      return null;
    }
    const alignment = bomAlignmentEngine.alignBomReleases(leftGraph, rightGraph, {
      leftLabel: toText(options.leftLabel, leftGraph.release?.releaseLabel || leftReleaseId),
      rightLabel: toText(options.rightLabel, rightGraph.release?.releaseLabel || rightReleaseId),
    });
    const diffPayload = bomDiffEngine.buildBomDiffResult(alignment, {
      leftLabel: toText(options.leftLabel, leftGraph.release?.releaseLabel || leftReleaseId),
      rightLabel: toText(options.rightLabel, rightGraph.release?.releaseLabel || rightReleaseId),
      leftGraph,
      rightGraph,
    });
    if (bomSemanticRepo?.saveBomDiffResult) {
      return bomSemanticRepo.saveBomDiffResult(leftReleaseId, rightReleaseId, diffPayload);
    }
    return diffPayload;
  } catch (error) {
    console.warn('[G281Dashboard] Failed to compare semantic BOM releases', error);
    return null;
  }
}

async function compareBomVersions(leftBomKey, rightBomKey, options = {}) {
  const normalizedLeftKey = BASE.versions?.bom?.[leftBomKey] ? leftBomKey : state.bom;
  const normalizedRightKey = BASE.versions?.bom?.[rightBomKey] ? rightBomKey : state.bom;
  const leftRecord = await ensureBomSemanticReleaseForVersion(normalizedLeftKey, options);
  const rightRecord = await ensureBomSemanticReleaseForVersion(normalizedRightKey, options);
  if (!leftRecord?.releaseId || !rightRecord?.releaseId) {
    return null;
  }
  const shouldForceRefresh = Boolean(options.forceRefresh || leftRecord?.refreshed || rightRecord?.refreshed);
  return compareBomSemanticReleases(leftRecord.releaseId, rightRecord.releaseId, {
    ...options,
    forceRefresh: shouldForceRefresh,
    leftLabel: toText(options.leftLabel, BASE.versions?.bom?.[normalizedLeftKey]?.label || normalizedLeftKey),
    rightLabel: toText(options.rightLabel, BASE.versions?.bom?.[normalizedRightKey]?.label || normalizedRightKey),
  });
}

function importNativeBomVersion(record = {}, options = {}) {
  if (!record || typeof record !== 'object') {
    throw new Error('Native BOM record is required');
  }
  if (!BASE.versions?.bom) {
    throw new Error('BOM version store is not ready');
  }

  const workbookVersionKey = inferImportedBomWorkbookVersionKey(record);
  const seedBomKey = importedBomStateKeyFromWorkbookVersion(workbookVersionKey);
  const seedSnapshot = bomVersionSnapshot(seedBomKey) || {};
  const sourceFileName = toText(record.workbook?.sourceFileName, toText(record.meta?.sourceFileName, ''));
  const workbookName = toText(record.workbook?.workbookName, toText(record.versionLabel, sourceFileName || '导入 BOM'));
  const label = toText(options.label, workbookName || sourceFileName || suggestNewVersionLabel('bom'));
  const key = makeUserVersionKey('bom');
  const sourceText = sourceFileName || workbookName || label;
  const nextOption = buildUserVersionOption('bom', label, {
    kind: 'imported',
    factor: Number.isFinite(Number(seedSnapshot.materialFactor)) ? Number(seedSnapshot.materialFactor) : 1,
    wireFactor: Number.isFinite(Number(seedSnapshot.wireFactor)) ? Number(seedSnapshot.wireFactor) : 1,
    draft: clonePlain(seedSnapshot.draft, currentBomDraftSnapshot()) || currentBomDraftSnapshot(),
    workbook: workbookName || sourceText,
    source: sourceText,
    sourceNote: `来源：导入 Excel BOM ${sourceText}，整本工作簿已写入原生 BOM 库，可在 BOM 管理中继续导出。`,
    totalMeter: Number(seedSnapshot.totalMeter) || 0,
    wireMeter: Number(seedSnapshot.wireMeter) || 0,
    tapeMeter: Number(seedSnapshot.tapeMeter) || 0,
    tubeMeter: Number(seedSnapshot.tubeMeter) || 0,
    actualLengthChangeSummary: clonePlain(seedSnapshot.actualLengthChangeSummary, null),
  });

  nextOption.nativeWorkbookVersionId = toText(record.versionId, '');
  nextOption.nativeProjectId = toText(record.projectId, '');
  nextOption.nativeSourceType = toText(record.sourceType, '');
  nextOption.workbookVersionKeyFallback = workbookVersionKey;
  nextOption.importedAt = record.updatedAt || new Date().toISOString();
  nextOption.note = `导入 Excel BOM 版本，已同步到左侧 BOM 版本管理。`;

  BASE.versions.bom[key] = nextOption;
  state.bom = key;
  applyVersionPreset('bom', key);
  persistUserVersions();
  renderVersions();
  queueRender();

  return {
    versionKey: key,
    versionLabel: label,
    nativeWorkbookVersionId: nextOption.nativeWorkbookVersionId,
    workbookVersionKey,
  };
}

async function saveEditableBomWorkbookVersion(options = {}) {
  if (!BASE.versions?.bom) {
    throw new Error('BOM version store is not ready');
  }

  const requestedBaseKey = toText(options.baseVersionKey, state.bom);
  const activeKey = BASE.versions?.bom?.[requestedBaseKey] ? requestedBaseKey : state.bom;
  const activeOption = BASE.versions?.bom?.[activeKey] || {};
  const activeLabel = versionOptionLabel('bom', activeKey) || activeOption.label || activeKey || '当前 BOM 版本';
  const requestedMode = options.mode === 'update-current' ? 'update-current' : 'save-as-new';
  const actualMode = requestedMode === 'update-current' && activeOption.userCreated ? 'update-current' : 'save-as-new';
  const workbookSnapshot = clonePlain(options.workbookSnapshot, null);
  if (!workbookSnapshot?.sheetOrder?.length || !workbookSnapshot?.sheets) {
    throw new Error('Editable workbook snapshot is required');
  }

  const snapshot = bomVersionSnapshot(activeKey) || {};
  const fallbackWorkbookVersionKey = toText(
    options.workbookVersionKeyFallback,
    toText(activeOption.workbookVersionKeyFallback, resolveWorkbookVersionKeyFromBomState(activeKey)),
  );
  const label = toText(
    options.label,
    actualMode === 'update-current'
      ? (activeOption.label || activeLabel || suggestNewVersionLabel('bom'))
      : suggestNewVersionLabel('bom'),
  );
  const source = toText(
    options.source,
    toText(activeOption.templateSource || activeOption.source || activeOption.workbook, snapshot.workbook || label),
  );
  const templateNote = toText(options.note, toText(activeOption.templateNote || activeOption.note, ''));
  const payload = {
    kind: toText(options.kind, activeOption.kind || snapshot.kind || 'custom'),
    factor: options.factor !== undefined
      ? coerceNumber(options.factor, 1)
      : (Number(snapshot.materialFactor) || Number(activeOption.factor) || 1),
    wireFactor: options.wireFactor !== undefined
      ? coerceNumber(options.wireFactor, 1)
      : (Number(snapshot.wireFactor) || Number(activeOption.wireFactor) || 1),
    draft: clonePlain(options.draft, clonePlain(activeOption.draft, snapshot.draft || currentBomDraftSnapshot())) || currentBomDraftSnapshot(),
    workbook: toText(options.workbook, source || snapshot.workbook || label),
    source,
    sourceNote: actualMode === 'update-current'
      ? `来源：Excel 整表编辑，已覆盖当前 BOM 版本 ${activeLabel}。`
      : `来源：Excel 整表编辑，基于 ${activeLabel} 另存为新 BOM 版本。`,
    templateNote,
    templateWorkbookSnapshot: workbookSnapshot,
    totalMeter: options.totalMeter !== undefined
      ? coerceNumber(options.totalMeter, 0)
      : (Number(snapshot.totalMeter) || Number(activeOption.totalMeter) || 0),
    wireMeter: options.wireMeter !== undefined
      ? coerceNumber(options.wireMeter, 0)
      : (Number(snapshot.wireMeter) || Number(activeOption.wireMeter) || 0),
    tapeMeter: options.tapeMeter !== undefined
      ? coerceNumber(options.tapeMeter, 0)
      : (Number(snapshot.tapeMeter) || Number(activeOption.tapeMeter) || 0),
    tubeMeter: options.tubeMeter !== undefined
      ? coerceNumber(options.tubeMeter, 0)
      : (Number(snapshot.tubeMeter) || Number(activeOption.tubeMeter) || 0),
    actualLengthChangeSummary: clonePlain(
      options.actualLengthChangeSummary,
      clonePlain(activeOption.actualLengthChangeSummary, snapshot.actualLengthChangeSummary || null),
    ),
  };

  const timestamp = new Date().toISOString();
  const targetKey = actualMode === 'update-current' ? activeKey : makeUserVersionKey('bom');
  const nextOption = buildUserVersionOption('bom', label, payload);
  nextOption.updatedAt = timestamp;
  nextOption.createdAt = actualMode === 'update-current'
    ? toText(activeOption.createdAt, timestamp)
    : timestamp;
  nextOption.templateSource = source;
  nextOption.source = source;
  nextOption.note = actualMode === 'update-current'
    ? `Excel 整表编辑已保存到当前 BOM 版本：${label}`
    : `Excel 整表编辑另存为新 BOM 版本：${label}`;
  nextOption.workbookVersionKeyFallback = fallbackWorkbookVersionKey;

  if (activeOption.nativeWorkbookVersionId) {
    nextOption.nativeWorkbookVersionId = activeOption.nativeWorkbookVersionId;
  }
  if (activeOption.nativeProjectId) {
    nextOption.nativeProjectId = activeOption.nativeProjectId;
  }
  if (activeOption.nativeSourceType) {
    nextOption.nativeSourceType = activeOption.nativeSourceType;
  }

  BASE.versions.bom[targetKey] = nextOption;
  const persistedRecord = await persistVersionOptionToStore('bom', targetKey, nextOption, {
    ...payload,
    workbookVersionKeyFallback: fallbackWorkbookVersionKey,
  }, {
    sourceType: 'workbook-viewer',
    status: 'released',
    baseReleaseId: toText(activeOption.semanticReleaseId, toText(activeOption.nativeWorkbookVersionId, '')),
    baseLabel: activeLabel,
  });
  if (persistedRecord?.versionId) {
    nextOption.nativeWorkbookVersionId = persistedRecord.versionId;
  }
  state.bom = targetKey;
  applyVersionPreset('bom', targetKey);
  persistUserVersions();
  renderVersions();
  queueRender();

  return {
    versionKey: targetKey,
    versionLabel: label,
    requestedMode,
    actualMode,
    message: actualMode === 'update-current'
      ? `已保存当前 BOM 版本：${label}`
      : `已另存为新 BOM 版本：${label}`,
    option: clonePlain(nextOption, null),
  };
}

function saveEditableBomWorkbookVersionLegacyLocal(options = {}) {
  if (!BASE.versions?.bom) {
    throw new Error('BOM version store is not ready');
  }

  const requestedBaseKey = toText(options.baseVersionKey, state.bom);
  const activeKey = BASE.versions?.bom?.[requestedBaseKey] ? requestedBaseKey : state.bom;
  const activeOption = BASE.versions?.bom?.[activeKey] || {};
  const activeLabel = versionOptionLabel('bom', activeKey) || activeOption.label || activeKey || '当前 BOM 版本';
  const requestedMode = options.mode === 'update-current' ? 'update-current' : 'save-as-new';
  const actualMode = requestedMode === 'update-current' && activeOption.userCreated ? 'update-current' : 'save-as-new';
  const workbookSnapshot = clonePlain(options.workbookSnapshot, null);
  if (!workbookSnapshot?.sheetOrder?.length || !workbookSnapshot?.sheets) {
    throw new Error('Editable workbook snapshot is required');
  }

  const snapshot = bomVersionSnapshot(activeKey) || {};
  const fallbackWorkbookVersionKey = toText(
    options.workbookVersionKeyFallback,
    toText(activeOption.workbookVersionKeyFallback, resolveWorkbookVersionKeyFromBomState(activeKey)),
  );
  const label = toText(
    options.label,
    actualMode === 'update-current'
      ? (activeOption.label || activeLabel || suggestNewVersionLabel('bom'))
      : suggestNewVersionLabel('bom'),
  );
  const source = toText(
    options.source,
    toText(activeOption.templateSource || activeOption.source || activeOption.workbook, snapshot.workbook || label),
  );
  const templateNote = toText(options.note, toText(activeOption.templateNote || activeOption.note, ''));
  const payload = {
    kind: toText(options.kind, activeOption.kind || snapshot.kind || 'custom'),
    factor: options.factor !== undefined
      ? coerceNumber(options.factor, 1)
      : (Number(snapshot.materialFactor) || Number(activeOption.factor) || 1),
    wireFactor: options.wireFactor !== undefined
      ? coerceNumber(options.wireFactor, 1)
      : (Number(snapshot.wireFactor) || Number(activeOption.wireFactor) || 1),
    draft: clonePlain(options.draft, clonePlain(activeOption.draft, snapshot.draft || currentBomDraftSnapshot())) || currentBomDraftSnapshot(),
    workbook: toText(options.workbook, source || snapshot.workbook || label),
    source,
    sourceNote: actualMode === 'update-current'
      ? `来源：Excel 整表编辑，已覆盖当前 BOM 版本 ${activeLabel}。`
      : `来源：Excel 整表编辑，基于 ${activeLabel} 另存为新 BOM 版本。`,
    templateNote,
    templateWorkbookSnapshot: workbookSnapshot,
    totalMeter: options.totalMeter !== undefined
      ? coerceNumber(options.totalMeter, 0)
      : (Number(snapshot.totalMeter) || Number(activeOption.totalMeter) || 0),
    wireMeter: options.wireMeter !== undefined
      ? coerceNumber(options.wireMeter, 0)
      : (Number(snapshot.wireMeter) || Number(activeOption.wireMeter) || 0),
    tapeMeter: options.tapeMeter !== undefined
      ? coerceNumber(options.tapeMeter, 0)
      : (Number(snapshot.tapeMeter) || Number(activeOption.tapeMeter) || 0),
    tubeMeter: options.tubeMeter !== undefined
      ? coerceNumber(options.tubeMeter, 0)
      : (Number(snapshot.tubeMeter) || Number(activeOption.tubeMeter) || 0),
    actualLengthChangeSummary: clonePlain(
      options.actualLengthChangeSummary,
      clonePlain(activeOption.actualLengthChangeSummary, snapshot.actualLengthChangeSummary || null),
    ),
  };

  const timestamp = new Date().toISOString();
  const targetKey = actualMode === 'update-current' ? activeKey : makeUserVersionKey('bom');
  const nextOption = buildUserVersionOption('bom', label, payload);
  nextOption.updatedAt = timestamp;
  nextOption.createdAt = actualMode === 'update-current'
    ? toText(activeOption.createdAt, timestamp)
    : timestamp;
  nextOption.templateSource = source;
  nextOption.source = source;
  nextOption.note = actualMode === 'update-current'
    ? `Excel 整表编辑已保存到当前 BOM 版本：${label}`
    : `Excel 整表编辑另存为新 BOM 版本：${label}`;
  nextOption.workbookVersionKeyFallback = fallbackWorkbookVersionKey;

  if (activeOption.nativeWorkbookVersionId) {
    nextOption.nativeWorkbookVersionId = activeOption.nativeWorkbookVersionId;
  }
  if (activeOption.nativeProjectId) {
    nextOption.nativeProjectId = activeOption.nativeProjectId;
  }
  if (activeOption.nativeSourceType) {
    nextOption.nativeSourceType = activeOption.nativeSourceType;
  }

  BASE.versions.bom[targetKey] = nextOption;
  state.bom = targetKey;
  applyVersionPreset('bom', targetKey);
  persistUserVersions();
  renderVersions();
  queueRender();

  return {
    versionKey: targetKey,
    versionLabel: label,
    requestedMode,
    actualMode,
    message: actualMode === 'update-current'
      ? `已保存当前 BOM 版本：${label}`
      : `已另存为新 BOM 版本：${label}`,
    option: clonePlain(nextOption, null),
  };
}

function finalizeVersionTemplateContext(context, storedState = {}) {
  if (!context) return null;
  const fields = (context.fields || []).map((field, index) => ({
    ...field,
    address: storedState.fieldAddressMap?.[field.key] || field.address || templateFieldAddress(context.group, index),
  }));
  const rawInputs = fields.reduce((acc, field) => {
    if (storedState.rawInputs && Object.prototype.hasOwnProperty.call(storedState.rawInputs, field.key)) {
      acc[field.key] = storedState.rawInputs[field.key];
      return acc;
    }
    acc[field.key] = context.values?.[field.key] ?? '';
    return acc;
  }, {});
  const univerEnabled = canUseUniverTemplateEditor();
  return {
    ...context,
    editorMode: univerEnabled ? 'univer' : 'fallback',
    editorReason: univerEnabled ? (isLocalFileProtocol() ? 'univer-local-file' : 'univer') : 'fallback',
    fields,
    rawInputs,
    workbookSnapshot: clonePlain(storedState.workbookSnapshot ?? context.workbookSnapshot, null),
    skipFieldOverlay: univerEnabled
      ? Boolean(storedState.skipFieldOverlay ?? context.skipFieldOverlay)
      : false,
  };
}

function buildBomWorkbookTemplateContext(activeKey) {
  const runtimeHelper = window.G281BomTemplateRuntime;
  if (!runtimeHelper) return null;
  const versionKey = resolveWorkbookVersionKeyFromBomState(activeKey);
  if (runtimeHelper.buildGenericBomTemplateContextWithUniver) {
    return runtimeHelper.buildGenericBomTemplateContextWithUniver({
      versionKey,
      source: RUNTIME?.bomWorkbookCopies,
      workbookName: '通用BOM模板',
      sourceFileName: '通用BOM模板.xlsx',
    });
  }
  if (runtimeHelper.buildVersionTemplateContextWithUniver) {
    return runtimeHelper.buildVersionTemplateContextWithUniver({
      versionKey,
      source: RUNTIME?.bomWorkbookCopies,
    });
  }
  if (runtimeHelper.buildBomTemplateContext) {
    return runtimeHelper.buildBomTemplateContext({
      runtime: RUNTIME,
      versionKey,
    });
  }
  if (runtimeHelper.buildVersionTemplateContext) {
    return runtimeHelper.buildVersionTemplateContext(versionKey, {
      source: RUNTIME?.bomWorkbookCopies,
    });
  }
  return null;
}

function excelColumnLabelToNumber(label) {
  const text = String(label || '').trim().toUpperCase();
  if (!/^[A-Z]+$/.test(text)) return 0;
  return text.split('').reduce((sum, char) => (sum * 26) + (char.charCodeAt(0) - 64), 0);
}

function normalizeConfigSheetRowDimensions(rowDimensions) {
  return Object.entries(rowDimensions || {}).reduce((acc, [rowKey, payload]) => {
    const row = Number(rowKey);
    if (!Number.isFinite(row) || row <= 0) return acc;
    acc.push({
      row,
      ...(payload || {}),
    });
    return acc;
  }, []);
}

function normalizeConfigSheetColumnDimensions(columnDimensions) {
  return Object.entries(columnDimensions || {}).reduce((acc, [columnKey, payload]) => {
    const columnIndex = excelColumnLabelToNumber(columnKey);
    const min = Number(payload?.min) || columnIndex;
    const max = Number(payload?.max) || min;
    if (!Number.isFinite(min) || min <= 0 || !Number.isFinite(max) || max < min) return acc;
    acc.push({
      index: min,
      min,
      max,
      ...(payload || {}),
    });
    return acc;
  }, []);
}

function normalizeConfigSheetCells(cells) {
  return (Array.isArray(cells) ? cells : []).reduce((acc, cell) => {
    const row = Number(cell?.r);
    const column = Number(cell?.c);
    if (!Number.isFinite(row) || row <= 0 || !Number.isFinite(column) || column <= 0) {
      return acc;
    }
    acc.push({
      address: toText(cell?.addr, ''),
      row,
      column,
      value: Object.prototype.hasOwnProperty.call(cell || {}, 'displayValue')
        ? cell.displayValue
        : (Object.prototype.hasOwnProperty.call(cell || {}, 'value') ? cell.value : null),
      formula: cell?.formula ? String(cell.formula) : null,
      dataType: toText(cell?.type, ''),
      styleId: Number.isFinite(Number(cell?.styleId)) ? Number(cell.styleId) : null,
      comment: clonePlain(cell?.comment, null),
      hyperlink: toText(cell?.hyperlink, ''),
    });
    return acc;
  }, []);
}

function buildConfigSheetWorkbookSeed(versionKey = state.configSheet, option = BASE.versions?.configSheet?.[versionKey] || {}) {
  const runtimeVersionKey = toText(option?.workbookVersionKeyFallback, versionKey);
  const runtimeVersion = RUNTIME.configSheetCopies?.versions?.[runtimeVersionKey] || null;
  const rawSnapshot = runtimeVersion?.snapshot || null;
  if (!rawSnapshot) {
    return null;
  }
  const sheetName = toText(rawSnapshot.sheetName, toText(runtimeVersion?.sheetName, '配置清单'));
  const workbookName = toText(option?.workbook, toText(runtimeVersion?.workbook, `${sheetName}.xlsx`));
  return {
    workbookName,
    sourceFileName: toText(runtimeVersion?.workbook, workbookName),
    sourcePath: toText(runtimeVersion?.workbookPath, ''),
    sheetOrder: [sheetName],
    hiddenSheets: rawSnapshot?.metadata?.sheetState === 'hidden' ? [sheetName] : [],
    styleTable: clonePlain(rawSnapshot?.stylePool, {}),
    sheets: [
      {
        workbookSheetIndex: Number(runtimeVersion?.sheetIndex) || 0,
        sheetName,
        sheetState: toText(rawSnapshot?.metadata?.sheetState, 'visible'),
        isHidden: rawSnapshot?.metadata?.sheetState === 'hidden',
        sheetOrderKey: sheetName,
        dimensionRef: toText(rawSnapshot?.dimension, ''),
        maxRow: Number(rawSnapshot?.maxRow) || 0,
        maxColumn: Number(rawSnapshot?.maxColumn) || 0,
        sheetFormat: {
          defaultRowHeight: rawSnapshot?.defaultRowHeight ?? null,
          defaultColWidth: rawSnapshot?.defaultColWidth ?? null,
          pageSetup: clonePlain(rawSnapshot?.pageSetup, {}),
        },
        sheetView: clonePlain(rawSnapshot?.sheetView, {}),
        freezePane: toText(rawSnapshot?.freezePanes, ''),
        mergedRanges: clonePlain(rawSnapshot?.mergedRanges, []),
        rowDimensions: normalizeConfigSheetRowDimensions(rawSnapshot?.rowDimensions),
        columnDimensions: normalizeConfigSheetColumnDimensions(rawSnapshot?.columnDimensions),
        hiddenRows: clonePlain(rawSnapshot?.hiddenRows, []),
        hiddenColumns: clonePlain(rawSnapshot?.hiddenColumns, []),
        cells: normalizeConfigSheetCells(rawSnapshot?.cells),
      },
    ],
  };
}

function buildConfigSheetWorkbookSnapshot(versionKey = state.configSheet, option = BASE.versions?.configSheet?.[versionKey] || {}) {
  if (isUniverWorkbookSnapshot(option?.templateWorkbookSnapshot)) {
    return clonePlain(option.templateWorkbookSnapshot, null);
  }
  const runtimeHelper = window.G281BomTemplateRuntime || null;
  const workbookSeed = buildConfigSheetWorkbookSeed(versionKey, option);
  if (!runtimeHelper?.buildWorkbookSnapshotFromSeed || !workbookSeed) {
    return null;
  }
  try {
    return runtimeHelper.buildWorkbookSnapshotFromSeed(workbookSeed, {
      workbookName: workbookSeed.workbookName || '配置清单模板',
    });
  } catch (error) {
    console.warn('[G281Dashboard] Failed to build config-sheet workbook snapshot', error);
    return null;
  }
}

function configSheetVersionSourceText(versionKey) {
  const option = BASE.versions?.configSheet?.[versionKey] || {};
  const runtimeVersionKey = toText(option?.workbookVersionKeyFallback, versionKey);
  const runtimeVersion = RUNTIME.configSheetCopies?.versions?.[runtimeVersionKey] || null;
  if (option?.sourceNote) {
    return option.sourceNote;
  }
  if (option?.userCreated) {
    return `来源：配置清单 Excel 式版本。基于 ${toText(option?.templateSource, versionOptionLabel('configSheet', runtimeVersionKey) || runtimeVersionKey)} 继续维护。`;
  }
  if (runtimeVersion?.workbook) {
    return `来源：${runtimeVersion.workbook}《配置清单》`;
  }
  return '来源：配置清单内置版本模板';
}

function resolveConfigSheetRuntimeVersionKey(versionKey = state.configSheet) {
  const option = BASE.versions?.configSheet?.[versionKey] || {};
  const candidate = toText(option?.workbookVersionKeyFallback, versionKey);
  if (RUNTIME.configSheetCopies?.versions?.[candidate]) {
    return candidate;
  }
  return listConfigSheetRuntimeVersionKeys()[0] || 'quote';
}

function buildVersionTemplateContext(group) {
  const activeKey = state[group];
  const activeLabel = versionOptionLabel(group, activeKey) || VERSION_GROUP_LABELS[group] || group;
  const activeOption = BASE.versions?.[group]?.[activeKey] || {};
  const runtimeHelper = window.G281BomTemplateRuntime || null;
  const storedWorkbookSeed = clonePlain(activeOption.templateWorkbookSeed, null);
  const storedFieldAddressMap = clonePlain(activeOption.templateFieldAddressMap, null);
  const storedWorkbookSnapshot = clonePlain(activeOption.templateWorkbookSnapshot, null)
    || (
      storedWorkbookSeed
      && runtimeHelper?.buildWorkbookSnapshotFromSeed
      ? runtimeHelper.buildWorkbookSnapshotFromSeed(storedWorkbookSeed, {
        workbookName: storedWorkbookSeed.workbookName || `${activeLabel}模板`,
      })
      : null
    );
  const hasStoredWorkbookSnapshot = Boolean(storedWorkbookSnapshot?.sheetOrder?.length);
  const hasStoredFieldAddressMap = Boolean(storedFieldAddressMap && Object.keys(storedFieldAddressMap).length);
  const storedTemplateState = {
    rawInputs: clonePlain(activeOption.templateRawInputs, null),
    fieldAddressMap: storedFieldAddressMap,
    workbookSnapshot: storedWorkbookSnapshot,
    skipFieldOverlay: hasStoredWorkbookSnapshot
      ? (hasStoredFieldAddressMap ? false : Boolean(storedWorkbookSnapshot?.sheetOrder?.length > 1))
      : null,
  };
  const storedTemplateSource = toText(activeOption.templateSource || activeOption.source || activeOption.workbook || '');
  const storedTemplateNote = toText(activeOption.templateNote || '');

  if (group === 'bom') {
    const snapshot = bomVersionSnapshot(activeKey);
    const draft = { ...(snapshot?.draft || {}), ...currentBomDraftSnapshot() };
    const workbookTemplate = buildBomWorkbookTemplateContext(activeKey);
    return finalizeVersionTemplateContext({
      group,
      activeKey,
      activeLabel,
      eyebrow: 'BOM 模板',
      title: '新增 BOM 模板版本',
      subtitle: `参考当前 ${activeLabel}，可手工补入材料系数、长度汇总和工程口径参数，适合后续继续导入新 BOM 版本。`,
      pasteHint: '支持从 Excel 粘贴单列或多列数值，也支持“字段名 + 数值”两列粘贴。',
      suggestedLabel: suggestNewVersionLabel(group),
      source: storedTemplateSource || workbookTemplate?.sourceFileName || snapshot?.workbook || '',
      note: storedTemplateNote,
      workbookSnapshot: clonePlain(workbookTemplate?.workbookSnapshot, null),
      skipFieldOverlay: Boolean(workbookTemplate?.workbookSnapshot),
      values: {
        factor: coerceNumber(snapshot?.materialFactor, 1),
        wireFactor: coerceNumber(snapshot?.wireFactor, 1),
        totalMeter: coerceNumber(snapshot?.totalMeter, 0),
        wireMeter: coerceNumber(snapshot?.wireMeter, 0),
        tapeMeter: coerceNumber(snapshot?.tapeMeter, 0),
        tubeMeter: coerceNumber(snapshot?.tubeMeter, 0),
        bomWireDrawing: coerceNumber(draft.bomWireDrawing, 0),
        bomWireEat: coerceNumber(draft.bomWireEat, 0),
        bomWireHidden: coerceNumber(draft.bomWireHidden, 0),
        bomTapeDiameter: coerceNumber(draft.bomTapeDiameter, 0),
        bomTapeWidth: coerceNumber(draft.bomTapeWidth, 0),
        bomTapeOverlap: coerceNumber(draft.bomTapeOverlap, 0),
      },
      fields: [
        { key: 'factor', label: '材料系数', section: '结构系数', unit: 'x', step: '0.001', min: '0', aliases: ['材料系数', 'BOM系数'] },
        { key: 'wireFactor', label: '导线系数', section: '结构系数', unit: 'x', step: '0.001', min: '0', aliases: ['导线系数', '线长系数'] },
        { key: 'totalMeter', label: '总长度', section: '长度汇总', unit: 'm', step: '0.001', min: '0', aliases: ['总长度', '总米数'] },
        { key: 'wireMeter', label: '导线长度', section: '长度汇总', unit: 'm', step: '0.001', min: '0', aliases: ['导线长度', '导线米数'] },
        { key: 'tapeMeter', label: '胶带长度', section: '长度汇总', unit: 'm', step: '0.001', min: '0', aliases: ['胶带长度', '胶带米数'] },
        { key: 'tubeMeter', label: '套管长度', section: '长度汇总', unit: 'm', step: '0.001', min: '0', aliases: ['套管长度', '套管米数'] },
        { key: 'bomWireDrawing', label: '图纸线长', section: '工艺参数', unit: 'mm', step: '1', min: '0', aliases: ['图纸线长', '图纸长度'] },
        { key: 'bomWireEat', label: '吃线尺寸', section: '工艺参数', unit: 'mm', step: '1', min: '0', aliases: ['吃线尺寸', '吃线'] },
        { key: 'bomWireHidden', label: '隐藏余量', section: '工艺参数', unit: 'mm', step: '1', min: '0', aliases: ['隐藏余量', '余量'] },
        { key: 'bomTapeDiameter', label: '线径', section: '工艺参数', unit: 'mm', step: '0.1', min: '0', aliases: ['线径', '胶带线径'] },
        { key: 'bomTapeWidth', label: '胶带宽度', section: '工艺参数', unit: 'mm', step: '0.1', min: '0', aliases: ['胶带宽度', '带宽'] },
        { key: 'bomTapeOverlap', label: '重叠率', section: '工艺参数', unit: '%', step: '1', min: '0', aliases: ['重叠率', '搭接率'] },
      ],
    }, storedTemplateState);
  }

  if (group === 'metal') {
    const snapshot = metalVersionSnapshot(activeKey) || {};
    return finalizeVersionTemplateContext({
      group,
      activeKey,
      activeLabel,
      eyebrow: '铜铝基价模板',
      title: '新增铜铝基价版本',
      subtitle: `参考当前 ${activeLabel}，可直接在右侧按 Excel 方式录入铜价和铝价，保存后进入左侧版本管理。`,
      pasteHint: '支持直接粘贴两行数值，顺序为铜价、铝价；也支持在单元格内写公式。',
      suggestedLabel: suggestNewVersionLabel(group),
      source: storedTemplateSource,
      note: storedTemplateNote,
      values: {
        copperPrice: coerceNumber(controls.copperPrice?.value, coerceNumber(snapshot.copperPrice, BASE.copperPrice || 0)),
        aluminumPrice: coerceNumber(controls.aluminumPrice?.value, coerceNumber(snapshot.aluminumPrice, BASE.aluminumPrice || 0)),
      },
      fields: [
        { key: 'copperPrice', label: '铜价', section: '铜铝基价', unit: '元/吨', step: '100', min: '0', aliases: ['铜价', '铜基价', 'copper'] },
        { key: 'aluminumPrice', label: '铝价', section: '铜铝基价', unit: '元/吨', step: '100', min: '0', aliases: ['铝价', '铝基价', 'aluminum'] },
      ],
    }, storedTemplateState);
  }

  if (group === 'connector') {
    const connectorSourceKey = connectorVersionSet.has(activeKey)
      ? activeKey
      : (connectorVersionSet.has(activeOption?.sourceKey) ? activeOption.sourceKey : state.connector);
    const rows = buildConnectorTemplateRows(activeKey, activeOption, connectorSourceKey);
    const connectorSheetModel = buildConnectorTemplateSheetModel({
      connectorRows: rows,
      rawInputs: storedTemplateState.rawInputs,
    });
    const values = rows.reduce((acc, row) => {
      acc[connectorTemplateFieldKey(row.itemId)] = row.currentStageLabel;
      return acc;
    }, {});
    const fields = rows.map((row, index) => ({
      key: connectorTemplateFieldKey(row.itemId),
      label: `${row.itemLabel} 执行档位`,
      section: '连接器执行档位',
      unit: '-',
      aliases: [row.itemLabel, row.itemCode, row.itemId, '执行档位'],
      hint: `可填写：${connectorTemplateStageHint(connectorSourceKey)}`,
      address: connectorSheetModel.fieldAddressMap[connectorTemplateFieldKey(row.itemId)] || `R${index + 2}`,
      itemId: row.itemId,
    }));
    return finalizeVersionTemplateContext({
      group,
      activeKey,
      activeStageKey: connectorSourceKey,
      connectorSourceKey,
      activeLabel,
      eyebrow: '连接器价格模板',
      title: '新增连接器价格版本',
      subtitle: `自动从当前已录入 BOM 提取连接器总成/散件信息，并带入协议价、进度价、初始报价；保存后生成新的连接器价格版本。`,
      pasteHint: '支持整列粘贴执行档位；建议填写 报价版 / 定点版 / 进度价，也支持继续在右侧 Excel 区补充内容。',
      suggestedLabel: suggestNewVersionLabel(group),
      source: storedTemplateSource || '当前BOM提取 + 连接器协议价状态',
      note: storedTemplateNote,
      values,
      fields,
      connectorRows: rows,
      connectorSheetRows: connectorSheetModel.rows,
      connectorMergeData: connectorSheetModel.mergeData,
      connectorAssemblyRows: connectorSheetModel.assemblyRows,
      connectorDetailRows: connectorSheetModel.detailRows,
    }, storedTemplateState);
  }

  if (group === 'labor') {
    const snapshot = laborVersionSnapshot(activeKey);
    const draft = currentLaborDraftSnapshot();
    return finalizeVersionTemplateContext({
      group,
      activeKey,
      activeLabel,
      eyebrow: '工时模板',
      title: '新增工时模板版本',
      subtitle: `参考当前 ${activeLabel}，可把核算表中的工时与费率直接粘贴进来，保存后立即生成新的工时版本。`,
      pasteHint: '建议按“直接人工工时、直接人工费率、制造工时、制造费率”顺序粘贴。',
      suggestedLabel: suggestNewVersionLabel(group),
      source: storedTemplateSource,
      note: storedTemplateNote,
      values: {
        directHours: coerceNumber(draft.directHours, coerceNumber(snapshot?.directHours, 0)),
        directRate: coerceNumber(draft.directRate, coerceNumber(snapshot?.directRate, 0)),
        manufacturingHours: coerceNumber(draft.manufacturingHours, coerceNumber(snapshot?.manufacturingHours, 0)),
        manufacturingRate: coerceNumber(draft.manufacturingRate, coerceNumber(snapshot?.manufacturingRate, 0)),
      },
      fields: [
        { key: 'directHours', label: '直接人工工时', section: '前工程', unit: 'h/套', step: '0.01', min: '0', aliases: ['直接人工工时', '前工程工时', '直接工时'] },
        { key: 'directRate', label: '直接人工费率', section: '前工程', unit: '元/h', step: '0.1', min: '0', aliases: ['直接人工费率', '前工程费率', '直接费率'] },
        { key: 'manufacturingHours', label: '制造工时', section: '后工程', unit: 'h/套', step: '0.01', min: '0', aliases: ['制造工时', '后工程工时'] },
        { key: 'manufacturingRate', label: '制造费率', section: '后工程', unit: '元/h', step: '0.1', min: '0', aliases: ['制造费率', '后工程费率'] },
      ],
    }, storedTemplateState);
  }

  if (group === 'equipment') {
    const snapshot = equipmentVersionSnapshot(activeKey);
    return finalizeVersionTemplateContext({
      group,
      activeKey,
      activeLabel,
      eyebrow: '设备资源模板',
      title: '新增设备资源模板版本',
      subtitle: `参考当前 ${activeLabel}，可直接录入设备投资、专用模具、项目工装和研发费用，保存后自动进入版本管理。`,
      pasteHint: '支持粘贴核算表汇总金额，默认按“设备投资、专用模具、项目工装、研发费用”识别。',
      suggestedLabel: suggestNewVersionLabel(group),
      source: storedTemplateSource,
      note: storedTemplateNote,
      values: {
        equipment: coerceNumber(snapshot?.equipment, 0),
        tooling: coerceNumber(snapshot?.tooling, 0),
        fixtures: coerceNumber(snapshot?.fixtures, 0),
        rnd: coerceNumber(snapshot?.rnd, 0),
      },
      fields: [
        { key: 'equipment', label: '设备投资', section: '资本投入', unit: '元', step: '0.01', min: '0', aliases: ['设备投资', '设备资源'] },
        { key: 'tooling', label: '专用模具', section: '资本投入', unit: '元', step: '0.01', min: '0', aliases: ['专用模具', '项目专用模具'] },
        { key: 'fixtures', label: '项目工装', section: '资本投入', unit: '元', step: '0.01', min: '0', aliases: ['项目工装', '工装投入'] },
        { key: 'rnd', label: '研发费用', section: '资本投入', unit: '元', step: '0.01', min: '0', aliases: ['研发费用', '开发费用'] },
      ],
    }, storedTemplateState);
  }

  if (group === 'packaging') {
    const snapshot = packagingVersionSnapshot(activeKey);
    const draft = currentPackagingDraftSnapshot();
    return finalizeVersionTemplateContext({
      group,
      activeKey,
      activeLabel,
      eyebrow: '包装物流模板',
      title: '新增包装物流模板版本',
      subtitle: `参考当前 ${activeLabel}，可直接粘贴包装物流拆分项，保存后同步到左侧版本管理。`,
      pasteHint: '建议按“内外包装、运输费、仓储费、短驳/其他”顺序粘贴。',
      suggestedLabel: suggestNewVersionLabel(group),
      source: '',
      note: '',
      values: {
        packInner: coerceNumber(draft.packInner, coerceNumber(snapshot?.packInner, 0)),
        packFreight: coerceNumber(draft.packFreight, coerceNumber(snapshot?.packFreight, 0)),
        packWarehouse: coerceNumber(draft.packWarehouse, coerceNumber(snapshot?.packWarehouse, 0)),
        packOther: coerceNumber(draft.packOther, coerceNumber(snapshot?.packOther, 0)),
      },
      fields: [
        { key: 'packInner', label: '内外包装', section: '包装', unit: '元/套', step: '0.01', min: '0', aliases: ['内外包装', '包装费'] },
        { key: 'packFreight', label: '运输费', section: '物流', unit: '元/套', step: '0.01', min: '0', aliases: ['运输费', '运费'] },
        { key: 'packWarehouse', label: '仓储费', section: '物流', unit: '元/套', step: '0.01', min: '0', aliases: ['仓储费', '仓储'] },
        { key: 'packOther', label: '短驳/其他', section: '物流', unit: '元/套', step: '0.01', min: '0', aliases: ['短驳', '其他', '短驳其他'] },
      ],
    }, storedTemplateState);
  }

  if (group === 'configSheet') {
    const workbookSnapshot = storedTemplateState.workbookSnapshot || buildConfigSheetWorkbookSnapshot(activeKey, activeOption);
    const runtimeVersionKey = resolveConfigSheetRuntimeVersionKey(activeKey);
    return finalizeVersionTemplateContext({
      group,
      activeKey,
      runtimeVersionKey,
      activeLabel,
      eyebrow: '配置清单模板',
      title: '新增配置清单版本',
      subtitle: `参考当前 ${activeLabel}，右侧保留配置清单整表格式，可直接按 Excel 习惯维护配置总成与车型差异。`,
      pasteHint: '支持在右侧工作簿内直接编辑、粘贴、合并单元格、增加行列与新增 Sheet，保存后生成新的配置清单版本。',
      suggestedLabel: suggestNewVersionLabel(group),
      source: storedTemplateSource || toText(activeOption.workbook, ''),
      note: storedTemplateNote,
      templateWorkbookSeed: clonePlain(workbookSeed, null),
      workbookSnapshot: clonePlain(workbookSnapshot, null),
      skipFieldOverlay: Boolean(workbookSnapshot),
      values: {},
      fields: [],
    }, {
      ...storedTemplateState,
      workbookSnapshot: clonePlain(workbookSnapshot, null),
      skipFieldOverlay: Boolean(workbookSnapshot),
    });
  }

  if (group === 'sales') {
    const volumes = currentSalesDraftSnapshot();
    return finalizeVersionTemplateContext({
      group,
      activeKey,
      activeLabel,
      eyebrow: '销量预测模板',
      title: '新增销量预测模板版本',
      subtitle: `参考当前 ${activeLabel}，可录入整段生命周期销量预测，后续新增版本也能继续沿用这个模板。`,
      pasteHint: '支持粘贴 6 年销量；如果带年份列，系统会优先按年份匹配。',
      suggestedLabel: suggestNewVersionLabel(group),
      source: storedTemplateSource,
      note: storedTemplateNote,
      values: BASE.years.reduce((acc, year, index) => {
        acc[`sales_${year}`] = coerceNumber(volumes[index], 0);
        return acc;
      }, {}),
      fields: BASE.years.map((year, index) => ({
        key: `sales_${year}`,
        label: `${year} 销量`,
        section: '年度销量',
        unit: '套',
        step: '1',
        min: '0',
        aliases: [String(year), `${year}销量`, `销量${year}`],
        index,
      })),
    }, storedTemplateState);
  }

  if (group === 'mix') {
    const values = currentMixDraftSnapshot();
    return finalizeVersionTemplateContext({
      group,
      activeKey,
      activeLabel,
      eyebrow: '配置比例模板',
      title: '新增配置比例模板版本',
      subtitle: `参考当前 ${activeLabel}，可录入各车型配置比例；保存时会自动归一化到 100%。`,
      pasteHint: '支持粘贴 4 行配置比例；若带车型名称或 CM 编号，系统会优先按车型匹配。',
      suggestedLabel: suggestNewVersionLabel(group),
      source: storedTemplateSource,
      note: storedTemplateNote,
      values: BASE.configNames.reduce((acc, name, index) => {
        acc[`mix_${index}`] = coerceNumber(values[index], 0);
        return acc;
      }, {}),
      fields: BASE.configNames.map((name, index) => {
        const code = String(name).split(/\s+/)[0];
        return {
          key: `mix_${index}`,
          label: name,
          section: '车型配置',
          unit: '%',
          step: '0.1',
          min: '0',
          aliases: [name, code, `配置${index + 1}`],
          index,
        };
      }),
    }, storedTemplateState);
  }

  if (group === 'annualDrop') {
    const snapshot = annualDropVersionSnapshot(activeKey);
    const workbookSeed = clonePlain(activeOption.templateWorkbookSeed, null) || annualDropWorkbookSeed(activeKey, activeOption);
    const workbookSnapshot = storedTemplateState.workbookSnapshot || buildLifecycleWorkbookSnapshotFromSeed(workbookSeed, '年降模板');
    return finalizeVersionTemplateContext({
      group,
      activeKey,
      activeLabel,
      eyebrow: '年降模板',
      title: '新增年降版本',
      subtitle: `参考当前 ${activeLabel}，右侧为年降 Excel 工作簿，可按生命周期逐年维护 ASP 年降率，并继续使用公式、筛选、插行插列。`,
      pasteHint: '右侧 Excel 工作簿保留“年份 / 年降率 / 当年ASP系数 / 说明”，可直接粘贴多行年度数据。',
      suggestedLabel: suggestNewVersionLabel(group),
      source: storedTemplateSource,
      note: storedTemplateNote,
      yearRows: clonePlain(snapshot?.yearRows, []),
      templateWorkbookSeed: clonePlain(workbookSeed, null),
      workbookSnapshot: clonePlain(workbookSnapshot, null),
      skipFieldOverlay: Boolean(workbookSnapshot),
      values: {},
      fields: [],
    }, {
      ...storedTemplateState,
      workbookSnapshot: clonePlain(workbookSnapshot, null),
      skipFieldOverlay: Boolean(workbookSnapshot),
      fieldAddressMap: null,
    });
  }

  if (group === 'oneTimeCustomer') {
    const snapshot = oneTimeCustomerVersionSnapshot(activeKey);
    const workbookSeed = clonePlain(activeOption.templateWorkbookSeed, null) || oneTimeCustomerWorkbookSeed(activeKey, activeOption);
    const workbookSnapshot = storedTemplateState.workbookSnapshot || buildLifecycleWorkbookSnapshotFromSeed(workbookSeed, '一次性费用模板');
    return finalizeVersionTemplateContext({
      group,
      activeKey,
      activeLabel,
      eyebrow: '一次性费用模板',
      title: '新增一次性费用(客户支付)版本',
      subtitle: `参考当前 ${activeLabel}，右侧为一次性费用 Excel 工作簿，支持“客户直付 / 按量分摊”两种方式，并保留工装费、试验费、研发费等 Sheet。`,
      pasteHint: '右侧 Excel 工作簿保留“类别 / 金额 / 方式 / 确认年份 / 分摊起始年 / 分摊总量 / 备注”，可直接粘贴多行明细。',
      suggestedLabel: suggestNewVersionLabel(group),
      source: storedTemplateSource,
      note: storedTemplateNote,
      entries: clonePlain(snapshot?.entries, []),
      templateWorkbookSeed: clonePlain(workbookSeed, null),
      workbookSnapshot: clonePlain(workbookSnapshot, null),
      skipFieldOverlay: Boolean(workbookSnapshot),
      values: {},
      fields: [],
    }, {
      ...storedTemplateState,
      workbookSnapshot: clonePlain(workbookSnapshot, null),
      skipFieldOverlay: Boolean(workbookSnapshot),
      fieldAddressMap: null,
    });
  }

  if (group === 'rebate') {
    const snapshot = rebateVersionSnapshot(activeKey);
    const workbookSeed = clonePlain(activeOption.templateWorkbookSeed, null) || rebateWorkbookSeed(activeKey, activeOption);
    const workbookSnapshot = storedTemplateState.workbookSnapshot || buildLifecycleWorkbookSnapshotFromSeed(workbookSeed, '返点模板');
    return finalizeVersionTemplateContext({
      group,
      activeKey,
      activeLabel,
      eyebrow: '返点模板',
      title: '新增返点版本',
      subtitle: `参考当前 ${activeLabel}，右侧为返点 Excel 工作簿，可按年度维护返点总额，利润引擎会按当年销量折算到单套。`,
      pasteHint: '右侧 Excel 工作簿保留“年份 / 年度返点总额 / 备注”，可直接粘贴多年返点计划。',
      suggestedLabel: suggestNewVersionLabel(group),
      source: storedTemplateSource,
      note: storedTemplateNote,
      yearRows: clonePlain(snapshot?.yearRows, []),
      templateWorkbookSeed: clonePlain(workbookSeed, null),
      workbookSnapshot: clonePlain(workbookSnapshot, null),
      skipFieldOverlay: Boolean(workbookSnapshot),
      values: {},
      fields: [],
    }, {
      ...storedTemplateState,
      workbookSnapshot: clonePlain(workbookSnapshot, null),
      skipFieldOverlay: Boolean(workbookSnapshot),
      fieldAddressMap: null,
    });
  }
  return null;
}

function versionTemplatePanelElement() {
  return el.versionTemplateModal?.querySelector('.version-template-panel') || null;
}

function versionTemplateModalElement() {
  return el.versionTemplateModal || null;
}

function applyVersionTemplateWindowShellState() {
  const modal = versionTemplateModalElement();
  if (!modal) return;
  const active = !modal.hidden;
  const minimized = modal.classList.contains('is-window-minimized');
  document.body.classList.toggle('bom-modal-open', active && !minimized);
}

function syncVersionTemplateWindowControls() {
  const modal = versionTemplateModalElement();
  const panel = versionTemplatePanelElement();
  const minimized = Boolean(modal?.classList.contains('is-window-minimized'));
  const maximized = Boolean(panel?.classList.contains('is-window-maximized'));
  if (el.minimizeVersionTemplateWindowBtn) {
    el.minimizeVersionTemplateWindowBtn.setAttribute('aria-label', minimized ? '还原窗口' : '最小化');
    el.minimizeVersionTemplateWindowBtn.setAttribute('title', minimized ? '还原窗口' : '最小化');
    el.minimizeVersionTemplateWindowBtn.classList.toggle('is-active', minimized);
    el.minimizeVersionTemplateWindowBtn.setAttribute('aria-pressed', minimized ? 'true' : 'false');
  }
  if (el.toggleVersionTemplateWindowBtn) {
    el.toggleVersionTemplateWindowBtn.classList.toggle('is-restored', maximized);
    el.toggleVersionTemplateWindowBtn.setAttribute('aria-pressed', maximized ? 'true' : 'false');
    el.toggleVersionTemplateWindowBtn.setAttribute('aria-label', maximized ? '还原窗口' : '放大窗口');
    el.toggleVersionTemplateWindowBtn.setAttribute('title', maximized ? '还原窗口' : '放大窗口');
  }
}

function setVersionTemplateWindowMaximized(force) {
  const modal = versionTemplateModalElement();
  const panel = versionTemplatePanelElement();
  if (!panel) return;
  if (modal?.classList.contains('is-window-minimized')) {
    modal.classList.remove('is-window-minimized');
  }
  const next = typeof force === 'boolean'
    ? force
    : !panel.classList.contains('is-window-maximized');
  panel.classList.toggle('is-window-maximized', next);
  modal?.classList.toggle('is-window-maximized', next);
  syncVersionTemplateWindowControls();
  applyVersionTemplateWindowShellState();
  startVersionTemplateReadyWatch(versionTemplateDraft);
  window.requestAnimationFrame(() => {
    window.dispatchEvent(new Event('resize'));
    updateVersionTemplateDebugPanel();
  });
}

function setVersionTemplateWindowMinimized(force) {
  const modal = versionTemplateModalElement();
  const panel = versionTemplatePanelElement();
  if (!modal || !panel || modal.hidden) return;
  const next = typeof force === 'boolean'
    ? force
    : !modal.classList.contains('is-window-minimized');
  modal.classList.toggle('is-window-minimized', next);
  if (next) {
    panel.classList.remove('is-window-maximized');
    modal.classList.remove('is-window-maximized');
  }
  syncVersionTemplateWindowControls();
  applyVersionTemplateWindowShellState();
  if (!next) {
    startVersionTemplateReadyWatch(versionTemplateDraft);
  }
  window.requestAnimationFrame(() => {
    window.dispatchEvent(new Event('resize'));
    updateVersionTemplateDebugPanel();
  });
}

function disconnectVersionTemplateResizeObserver() {
  if (!versionTemplateResizeObserver) return;
  versionTemplateResizeObserver.disconnect();
  versionTemplateResizeObserver = null;
}

function syncVersionTemplatePanelMode(editorEnabled = false) {
  const panel = versionTemplatePanelElement();
  if (!panel) return;
  const isSheetMode = editorEnabled && VERSION_TEMPLATE_GROUPS.has(versionTemplateDraft?.group);
  panel.classList.toggle('is-bom-sheet-mode', isSheetMode);
  panel.dataset.templateGroup = versionTemplateDraft?.group || '';
  if (el.versionTemplateQuickbar) {
    el.versionTemplateQuickbar.hidden = !isSheetMode;
  }
}

function ensureVersionTemplateResizeObserver() {
  const panel = versionTemplatePanelElement();
  if (!panel || typeof ResizeObserver !== 'function') return;
  disconnectVersionTemplateResizeObserver();
  versionTemplateResizeObserver = new ResizeObserver(() => {
    window.requestAnimationFrame(() => {
      window.dispatchEvent(new Event('resize'));
    });
  });
  versionTemplateResizeObserver.observe(panel);
}

function setVersionTemplateEditorMode(enabled) {
  const panel = versionTemplatePanelElement();
  if (panel) panel.classList.toggle('is-univer-mode', enabled);
  syncVersionTemplatePanelMode(enabled);
  if (el.versionTemplateParseBtn) {
    el.versionTemplateParseBtn.hidden = enabled;
    el.versionTemplateParseBtn.disabled = enabled;
  }
  if (el.versionTemplatePaste) {
    el.versionTemplatePaste.hidden = enabled;
    el.versionTemplatePaste.disabled = enabled;
  }
  if (el.versionTemplatePasteHint && enabled) {
    el.versionTemplatePasteHint.textContent = '右侧已切换为 Excel 式编辑区，可直接粘贴区域、输入公式、拖动填充。';
  }
  updateVersionTemplateStatusMeta();
  updateVersionTemplateDebugPanel();
}

function getVersionTemplateSelectionLabel() {
  const selection = versionTemplateEditor?.getSelectionSnapshot?.();
  return selection?.a1 ? `当前选区 ${selection.a1}` : '当前选区';
}

function runVersionTemplateQuickAction(action) {
  if (!versionTemplateEditor || !VERSION_TEMPLATE_GROUPS.has(versionTemplateDraft?.group)) {
    updateVersionTemplateStatus('Excel 编辑区尚未准备完成，请等待工作表加载后再操作。');
    return false;
  }
  let success = false;
  let message = '';
  const selectionLabel = getVersionTemplateSelectionLabel();
  switch (action) {
    case 'insert-row':
      success = Boolean(versionTemplateEditor.insertRowsAfterSelection?.(1));
      message = `已在 ${selectionLabel} 下方插入 1 行。`;
      break;
    case 'insert-column':
      success = Boolean(versionTemplateEditor.insertColumnsAfterSelection?.(1));
      message = `已在 ${selectionLabel} 右侧插入 1 列。`;
      break;
    case 'merge':
      success = Boolean(versionTemplateEditor.mergeSelection?.());
      message = `已对 ${selectionLabel} 执行合并。`;
      break;
    case 'unmerge':
      success = Boolean(versionTemplateEditor.unmergeSelection?.());
      message = `已对 ${selectionLabel} 取消合并。`;
      break;
    case 'filter':
      success = Boolean(versionTemplateEditor.toggleFilter?.());
      message = `已调用筛选命令，请在 ${selectionLabel} 所在表头继续设置筛选。`;
      break;
    case 'conditional':
      success = Boolean(versionTemplateEditor.openConditionalFormattingPanel?.());
      message = '已打开条件格式面板。';
      break;
    case 'image':
      success = Boolean(versionTemplateEditor.openImageMenu?.());
      message = '已展开图片插入菜单。';
      break;
    case 'add-sheet':
      success = Boolean(versionTemplateEditor.appendSheet?.());
      message = '已新增一个工作表。';
      break;
    default:
      success = false;
  }
  if (!success) {
    updateVersionTemplateStatus('当前操作未成功，请先点击工作表中的目标单元格或稍后重试。');
    return false;
  }
  updateVersionTemplateStatus(message);
  updateVersionTemplateStatusMeta();
  window.requestAnimationFrame(() => {
    window.dispatchEvent(new Event('resize'));
  });
  return true;
}

function ensureVersionTemplateEditor() {
  if (!canUseUniverTemplateEditor() || !el.versionTemplateFields) return null;
  if (!versionTemplateEditor) {
    try {
      el.versionTemplateFields.innerHTML = '';
      versionTemplateEditor = window.G281UniverTemplateEditor.create(el.versionTemplateFields);
    } catch (error) {
      pushVersionTemplateDebugError('ensureVersionTemplateEditor.create', error);
      console.error('Failed to create Univer template editor', error);
      versionTemplateEditor = null;
    }
  }
  updateVersionTemplateStatusMeta();
  updateVersionTemplateDebugPanel();
  return versionTemplateEditor;
}

function disposeVersionTemplateEditor() {
  if (!versionTemplateEditor) return;
  try {
    versionTemplateEditor.destroy?.();
  } catch (error) {
    pushVersionTemplateDebugError('disposeVersionTemplateEditor.destroy', error);
    console.error('Failed to dispose Univer template editor', error);
  }
  versionTemplateEditor = null;
  if (el.versionTemplateFields) {
    el.versionTemplateFields.innerHTML = '';
  }
  updateVersionTemplateStatusMeta();
  updateVersionTemplateDebugPanel();
}

function ensureVersionTemplateLoadingOverlay() {
  if (!el.versionTemplateFields) return null;
  let overlay = el.versionTemplateFields.querySelector('.version-template-loading');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.className = 'version-template-loading';
    overlay.hidden = true;
    overlay.innerHTML = `
      <div class="version-template-loading-card">
        <div class="version-template-loading-spinner" aria-hidden="true"></div>
        <div class="version-template-loading-text">正在加载 Excel 编辑区...</div>
      </div>
    `;
    el.versionTemplateFields.appendChild(overlay);
  }
  return overlay;
}

function setVersionTemplateLoadingState(active, text = '') {
  const overlay = ensureVersionTemplateLoadingOverlay();
  if (!overlay) return;
  overlay.hidden = !active;
  if (text) {
    const textNode = overlay.querySelector('.version-template-loading-text');
    if (textNode) textNode.textContent = text;
  }
  updateVersionTemplateDebugPanel();
}

function stopVersionTemplateReadyWatch() {
  if (versionTemplateReadyWatchTimer) {
    window.clearInterval(versionTemplateReadyWatchTimer);
    versionTemplateReadyWatchTimer = 0;
  }
}

function finalizeVersionTemplateReady(context) {
  if (!context || versionTemplateDraft !== context || context.editorMode !== 'univer') return false;
  if (!versionTemplateEditorAppearsReady()) return false;
  stopVersionTemplateReadyWatch();
  setVersionTemplateLoadingState(false);
  updateVersionTemplateStatus(versionTemplateStatusText(context));
  updateVersionTemplateDebugPanel();
  return true;
}

function startVersionTemplateReadyWatch(context) {
  stopVersionTemplateReadyWatch();
  if (!context || context.editorMode !== 'univer') return;
  if (finalizeVersionTemplateReady(context)) return;
  const startedAt = Date.now();
  const maxDuration = isLocalFileProtocol() ? 30000 : 12000;
  versionTemplateReadyWatchTimer = window.setInterval(() => {
    if (versionTemplateDraft !== context || context.editorMode !== 'univer') {
      stopVersionTemplateReadyWatch();
      return;
    }
    if (finalizeVersionTemplateReady(context)) return;
    if (Date.now() - startedAt >= maxDuration) {
      stopVersionTemplateReadyWatch();
      updateVersionTemplateDebugPanel();
    }
  }, 250);
}

function clearVersionTemplateRenderMonitor() {
  versionTemplateRenderToken += 1;
  if (Array.isArray(versionTemplateRenderMonitor)) {
    versionTemplateRenderMonitor.forEach((timerId) => clearTimeout(timerId));
  }
  versionTemplateRenderMonitor = [];
  stopVersionTemplateReadyWatch();
  setVersionTemplateLoadingState(false);
  updateVersionTemplateDebugPanel();
}

function versionTemplateEditorAppearsReady() {
  if (!el.versionTemplateFields) return false;
  return el.versionTemplateFields.querySelectorAll('canvas').length > 0;
}

function pokeVersionTemplateEditorLayout() {
  if (!el.versionTemplateFields) return;
  el.versionTemplateFields.getBoundingClientRect();
  versionTemplatePanelElement()?.getBoundingClientRect();
  window.requestAnimationFrame(() => {
    window.dispatchEvent(new Event('resize'));
    updateVersionTemplateDebugPanel();
  });
}

function versionTemplateMountReady() {
  if (!el.versionTemplateFields) return false;
  const rect = el.versionTemplateFields.getBoundingClientRect();
  return rect.width > 240 && rect.height > 180;
}

function queueVersionTemplateFieldsRender(context) {
  if (!context) return;
  if (context.editorMode !== 'univer') {
    renderVersionTemplateFields(context);
    return;
  }

  setVersionTemplateEditorMode(true);
  const token = ++versionTemplateRenderToken;
  const loadingText = isLocalFileProtocol()
    ? '正在初始化离线 Excel 编辑区，首次打开可能需要 1-3 秒...'
    : '正在加载 Excel 编辑区...';
  setVersionTemplateLoadingState(true, loadingText);
  startVersionTemplateReadyWatch(context);

  let attempts = 0;
  const run = () => {
    if (token !== versionTemplateRenderToken || versionTemplateDraft !== context || el.versionTemplateModal?.hidden) {
      return;
    }
    attempts += 1;
    if (versionTemplateMountReady() || attempts >= 8) {
      renderVersionTemplateFields(context);
      return;
    }
    window.requestAnimationFrame(() => {
      setTimeout(run, 40);
    });
  };

  window.requestAnimationFrame(() => {
    setTimeout(run, 20);
  });
  updateVersionTemplateDebugPanel();
}

function scheduleVersionTemplateEditorWarmup(context) {
  clearVersionTemplateRenderMonitor();
  if (!context || context.editorMode !== 'univer') return;

  const token = versionTemplateRenderToken;
  const loadingText = isLocalFileProtocol()
    ? '正在初始化离线 Excel 编辑区，首次打开可能需要 1-3 秒...'
    : '正在加载 Excel 编辑区...';
  setVersionTemplateLoadingState(true, loadingText);

  let reinitialized = false;
  const checkpoints = [0, 120, 320, 800, 1600, 3000, 5000];
  versionTemplateRenderMonitor = checkpoints.map((delay, index) => setTimeout(() => {
    if (token !== versionTemplateRenderToken || versionTemplateDraft !== context || context.editorMode !== 'univer') {
      return;
    }
    if (versionTemplateEditorAppearsReady()) {
      setVersionTemplateLoadingState(false);
      updateVersionTemplateStatus(versionTemplateStatusText(context));
      return;
    }
    if (isLocalFileProtocol() && !reinitialized && delay >= 800) {
      reinitialized = true;
      disposeVersionTemplateEditor();
      if (token !== versionTemplateRenderToken || versionTemplateDraft !== context) return;
      queueVersionTemplateFieldsRender(context);
      return;
    }
    pokeVersionTemplateEditorLayout();
    if (index === checkpoints.length - 1) {
      updateVersionTemplateStatus(`当前参考版本：${context.activeLabel}。Excel 编辑区仍在初始化，请稍等片刻；若持续空白，可先关闭再重新打开。`);
    }
    updateVersionTemplateDebugPanel();
  }, delay));
}

function buildCurrentBomHarnessRows() {
  const extract = getActiveBomAutoExtract();
  const lineItems = Array.isArray(extract?.lineItems) ? extract.lineItems : [];
  const buckets = new Map();
  lineItems.forEach((item) => {
    const harnessId = toText(item?.harnessId, '');
    const harnessName = toText(item?.harnessName, harnessId || '未识别线束');
    const key = harnessId || harnessName || `row_${item?.rowIndex || buckets.size + 1}`;
    if (!buckets.has(key)) {
      buckets.set(key, {
        harnessId: harnessId || harnessName || '-',
        harnessName: harnessName || harnessId || '-',
        bomItemCount: 0,
        wireLineCount: 0,
        connectorLineCount: 0,
        otherLineCount: 0,
        totalQuantity: 0,
        sourceLabel: extract?.sourceLabel || '',
        sourceSheetName: extract?.sourceSheetName || '',
      });
    }
    const row = buckets.get(key);
    row.bomItemCount += 1;
    row.totalQuantity += Number(item?.quantity) || 0;
    if (isActiveBomWireItem(item)) {
      row.wireLineCount += 1;
    } else if (isActiveBomConnectorItem(item)) {
      row.connectorLineCount += 1;
    } else {
      row.otherLineCount += 1;
    }
  });
  return Array.from(buckets.values()).sort((left, right) => {
    const leftKey = String(left.harnessId || left.harnessName || '');
    const rightKey = String(right.harnessId || right.harnessName || '');
    return leftKey.localeCompare(rightKey, 'zh-CN', { numeric: true });
  });
}

function buildGenericVersionTemplateSheetSpec(context) {
  const lastRow = context.fields.length + 1;
  return {
    workbookName: context.title,
    sheetName: context.activeLabel || '模板',
    matrix: [
      ['NO.', 'Function / 分类', 'Part Number / 模板编码', 'Part Name / 项目名称', 'SPEC / 录入说明', 'Quantity / 数值', 'Unit / 单位', 'Remark', 'Other-Remark / 维护提示'],
      ...context.fields.map((field, index) => ([
        index + 1,
        field.section || '模板项目',
        field.templateCode || field.key.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toUpperCase(),
        field.label,
        field.spec || `${field.label} 维护项`,
        templateSheetCellValue(context.rawInputs?.[field.key], context.values?.[field.key]),
        field.unit || '-',
        '手工维护',
        field.hint || (field.aliases || []).slice(0, 2).join(' / ') || '可直接在表格内维护',
      ])),
    ],
    columnWidths: [56, 120, 160, 220, 180, 150, 84, 118, 220],
    rowHeights: Array.from({ length: lastRow }, (_, index) => (index === 0 ? 40 : 30)),
    frozenRows: 1,
    styles: [
      { range: `A1:I${lastRow}`, border: { type: 'ALL', style: 'THIN', color: '#e2e8f0' } },
      { range: 'A1:I1', background: '#e3eaf2', fontWeight: 'bold', wrap: true, horizontalAlignment: 'center', verticalAlignment: 'middle' },
      { range: `A2:A${lastRow}`, background: '#f8fafc', horizontalAlignment: 'center', verticalAlignment: 'middle' },
      { range: `B2:B${lastRow}`, background: '#eef5fb', horizontalAlignment: 'center', verticalAlignment: 'middle', wrap: true },
      { range: `C2:C${lastRow}`, background: '#fbfdff', wrap: true },
      { range: `D2:D${lastRow}`, background: '#fbfdff', wrap: true },
      { range: `E2:E${lastRow}`, background: '#fcfdff', wrap: true },
      { range: `F2:F${lastRow}`, horizontalAlignment: 'right', verticalAlignment: 'middle' },
      { range: `G2:G${lastRow}`, horizontalAlignment: 'center', verticalAlignment: 'middle' },
      { range: `H2:I${lastRow}`, background: '#fcfdff', wrap: true },
    ],
    activeRange: context.fields[0]?.address || 'F2',
  };
}

function buildBomVersionTemplateSheetSpec(context) {
  const lastRow = context.fields.length + 1;
  return {
    workbookName: context.title,
    sheetName: context.activeLabel || '模板',
    matrix: [
      ['NO.', 'Function / 功能', 'Part Number / 参数编码', 'Part Name / 参数名称', 'SPEC / 口径说明', 'Quantity / 数值', 'Unit / 单位', 'Remark', 'Other-Remark / 系统映射'],
      ...context.fields.map((field, index) => ([
        index + 1,
        field.section || 'BOM参数',
        field.templateCode || field.key.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toUpperCase(),
        field.label,
        field.spec || `${field.label}维护项`,
        templateSheetCellValue(context.rawInputs?.[field.key], context.values?.[field.key]),
        field.unit || '-',
        '手工维护',
        field.hint || (field.aliases || []).slice(0, 2).join(' / ') || '可直接在表格内维护',
      ])),
    ],
    columnWidths: [56, 120, 160, 220, 180, 150, 84, 118, 220],
    rowHeights: Array.from({ length: lastRow }, (_, index) => (index === 0 ? 40 : 30)),
    frozenRows: 1,
    styles: [
      { range: `A1:I${lastRow}`, border: { type: 'ALL', style: 'THIN', color: '#e2e8f0' } },
      { range: 'A1:I1', background: '#e3eaf2', fontWeight: 'bold', wrap: true, horizontalAlignment: 'center', verticalAlignment: 'middle' },
      { range: `A2:A${lastRow}`, background: '#f8fafc', horizontalAlignment: 'center', verticalAlignment: 'middle' },
      { range: `B2:B${lastRow}`, background: '#eef5fb', horizontalAlignment: 'center', verticalAlignment: 'middle', wrap: true },
      { range: `C2:C${lastRow}`, background: '#fbfdff', wrap: true },
      { range: `D2:D${lastRow}`, background: '#fbfdff', wrap: true },
      { range: `E2:E${lastRow}`, background: '#fcfdff', wrap: true },
      { range: `F2:F${lastRow}`, horizontalAlignment: 'right', verticalAlignment: 'middle' },
      { range: `G2:G${lastRow}`, horizontalAlignment: 'center', verticalAlignment: 'middle' },
      { range: `H2:I${lastRow}`, background: '#fcfdff', wrap: true },
    ],
    activeRange: context.fields[0]?.address || 'F2',
  };
}

function buildLaborVersionTemplateSheetSpec(context) {
  const harnessRows = buildCurrentBomHarnessRows();
  const baseRows = context.fields.map((field, index) => ([
    index + 1,
    field.section || '工时模板',
    field.templateCode || field.key.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toUpperCase(),
    field.label,
    field.spec || `${field.label} 维护项`,
    templateSheetCellValue(context.rawInputs?.[field.key], context.values?.[field.key]),
    field.unit || '-',
    '手工维护',
    field.hint || (field.aliases || []).slice(0, 2).join(' / ') || '可直接在表格内维护',
  ]));
  const sectionHeaderRow = context.fields.length + 3;
  const detailHeaderRow = sectionHeaderRow + 1;
  const detailRows = harnessRows.length
    ? harnessRows.map((row) => ([
      '',
      row.harnessId || '-',
      row.harnessName || row.harnessId || '-',
      Number(row.bomItemCount) || 0,
      Number(row.wireLineCount) || 0,
      '',
      '',
      '',
      '',
      row.sourceLabel ? `${row.sourceLabel}${row.sourceSheetName ? ` · ${row.sourceSheetName}` : ''}` : '来源于当前 BOM',
    ]))
    : [['', '当前 BOM 暂无线束展开', '', '', '', '', '', '', '', '']];
  const matrix = [
    ['NO.', 'Function / 分类', 'Part Number / 模板编码', 'Part Name / 项目名称', 'SPEC / 录入说明', 'Quantity / 数值', 'Unit / 单位', 'Remark', 'Other-Remark / 维护提示'],
    ...baseRows,
    ['', '', '', '', '', '', '', '', ''],
    ['', '线束展开', '', '', '', '', '', '', ''],
    ['', '线束号', '线束名称', 'BOM条目', '导线条数', '前工程工时', '前工程费率', '后工程工时', '后工程费率', '备注'],
    ...detailRows,
  ];
  const lastRow = matrix.length;
  return {
    workbookName: context.title,
    sheetName: context.activeLabel || '模板',
    matrix,
    columnWidths: [56, 120, 180, 100, 92, 110, 110, 110, 110, 220],
    rowHeights: Array.from({ length: lastRow }, (_, index) => {
      const row = index + 1;
      if (row === 1) return 40;
      if (row === sectionHeaderRow || row === detailHeaderRow) return 34;
      if (row === context.fields.length + 2) return 16;
      return 30;
    }),
    frozenRows: 1,
    styles: [
      { range: `A1:J${lastRow}`, border: { type: 'ALL', style: 'THIN', color: '#dbe4ee' } },
      { range: 'A1:I1', background: '#e3eaf2', fontWeight: 'bold', wrap: true, horizontalAlignment: 'center', verticalAlignment: 'middle' },
      { range: 'J1:J1', background: '#e3eaf2', fontWeight: 'bold', wrap: true, horizontalAlignment: 'center', verticalAlignment: 'middle' },
      { range: `A2:A${context.fields.length + 1}`, background: '#f8fafc', horizontalAlignment: 'center', verticalAlignment: 'middle' },
      { range: `B2:B${context.fields.length + 1}`, background: '#eef5fb', horizontalAlignment: 'center', verticalAlignment: 'middle', wrap: true },
      { range: `C2:C${context.fields.length + 1}`, background: '#fbfdff', wrap: true },
      { range: `D2:D${context.fields.length + 1}`, background: '#fbfdff', wrap: true },
      { range: `E2:E${context.fields.length + 1}`, background: '#fcfdff', wrap: true },
      { range: `F2:F${context.fields.length + 1}`, horizontalAlignment: 'right', verticalAlignment: 'middle' },
      { range: `G2:G${context.fields.length + 1}`, horizontalAlignment: 'center', verticalAlignment: 'middle' },
      { range: `H2:I${context.fields.length + 1}`, background: '#fcfdff', wrap: true },
      { range: `J2:J${context.fields.length + 1}`, background: '#fcfdff', wrap: true },
      { range: `A${sectionHeaderRow}:J${sectionHeaderRow}`, background: '#d9efe6', fontWeight: 'bold', horizontalAlignment: 'left', verticalAlignment: 'middle' },
      { range: `A${detailHeaderRow}:J${detailHeaderRow}`, background: '#eef5fb', fontWeight: 'bold', horizontalAlignment: 'center', verticalAlignment: 'middle', wrap: true },
      { range: `F${detailHeaderRow + 1}:I${lastRow}`, background: '#fffef6', verticalAlignment: 'middle' },
      { range: `J${detailHeaderRow + 1}:J${lastRow}`, wrap: true, verticalAlignment: 'top' },
    ],
    activeRange: context.fields[0]?.address || 'F2',
  };
}

function buildPackagingVersionTemplateSheetSpec(context) {
  const harnessRows = buildCurrentBomHarnessRows();
  const baseRows = context.fields.map((field, index) => ([
    index + 1,
    field.section || '包装物流模板',
    field.templateCode || field.key.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toUpperCase(),
    field.label,
    field.spec || `${field.label} 维护项`,
    templateSheetCellValue(context.rawInputs?.[field.key], context.values?.[field.key]),
    field.unit || '-',
    '手工维护',
    field.hint || (field.aliases || []).slice(0, 2).join(' / ') || '可直接在表格内维护',
  ]));
  const sectionHeaderRow = context.fields.length + 3;
  const detailHeaderRow = sectionHeaderRow + 1;
  const detailRows = harnessRows.length
    ? harnessRows.map((row) => ([
      '',
      row.harnessId || '-',
      row.harnessName || row.harnessId || '-',
      Number(row.bomItemCount) || 0,
      Number(row.wireLineCount) || 0,
      '',
      '',
      '',
      '',
      row.sourceLabel ? `${row.sourceLabel}${row.sourceSheetName ? ` · ${row.sourceSheetName}` : ''}` : '来源于当前 BOM',
    ]))
    : [['', '当前 BOM 暂无线束展开', '', '', '', '', '', '', '', '']];
  const matrix = [
    ['NO.', 'Function / 分类', 'Part Number / 模板编码', 'Part Name / 项目名称', 'SPEC / 录入说明', 'Quantity / 数值', 'Unit / 单位', 'Remark', 'Other-Remark / 维护提示'],
    ...baseRows,
    ['', '', '', '', '', '', '', '', ''],
    ['', '线束展开', '', '', '', '', '', '', ''],
    ['', '线束号', '线束名称', 'BOM条目', '导线条数', '内外包装', '运输费', '仓储费', '短驳/其他', '备注'],
    ...detailRows,
  ];
  const lastRow = matrix.length;
  return {
    workbookName: context.title,
    sheetName: context.activeLabel || '模板',
    matrix,
    columnWidths: [56, 120, 180, 100, 92, 110, 110, 110, 110, 220],
    rowHeights: Array.from({ length: lastRow }, (_, index) => {
      const row = index + 1;
      if (row === 1) return 40;
      if (row === sectionHeaderRow || row === detailHeaderRow) return 34;
      if (row === context.fields.length + 2) return 16;
      return 30;
    }),
    frozenRows: 1,
    styles: [
      { range: `A1:J${lastRow}`, border: { type: 'ALL', style: 'THIN', color: '#dbe4ee' } },
      { range: 'A1:I1', background: '#e3eaf2', fontWeight: 'bold', wrap: true, horizontalAlignment: 'center', verticalAlignment: 'middle' },
      { range: 'J1:J1', background: '#e3eaf2', fontWeight: 'bold', wrap: true, horizontalAlignment: 'center', verticalAlignment: 'middle' },
      { range: `A2:A${context.fields.length + 1}`, background: '#f8fafc', horizontalAlignment: 'center', verticalAlignment: 'middle' },
      { range: `B2:B${context.fields.length + 1}`, background: '#eef5fb', horizontalAlignment: 'center', verticalAlignment: 'middle', wrap: true },
      { range: `C2:C${context.fields.length + 1}`, background: '#fbfdff', wrap: true },
      { range: `D2:D${context.fields.length + 1}`, background: '#fbfdff', wrap: true },
      { range: `E2:E${context.fields.length + 1}`, background: '#fcfdff', wrap: true },
      { range: `F2:F${context.fields.length + 1}`, horizontalAlignment: 'right', verticalAlignment: 'middle' },
      { range: `G2:G${context.fields.length + 1}`, horizontalAlignment: 'center', verticalAlignment: 'middle' },
      { range: `H2:I${context.fields.length + 1}`, background: '#fcfdff', wrap: true },
      { range: `J2:J${context.fields.length + 1}`, background: '#fcfdff', wrap: true },
      { range: `A${sectionHeaderRow}:J${sectionHeaderRow}`, background: '#d9efe6', fontWeight: 'bold', horizontalAlignment: 'left', verticalAlignment: 'middle' },
      { range: `A${detailHeaderRow}:J${detailHeaderRow}`, background: '#eef5fb', fontWeight: 'bold', horizontalAlignment: 'center', verticalAlignment: 'middle', wrap: true },
      { range: `F${detailHeaderRow + 1}:I${lastRow}`, background: '#fffef6', verticalAlignment: 'middle' },
      { range: `J${detailHeaderRow + 1}:J${lastRow}`, wrap: true, verticalAlignment: 'top' },
    ],
    activeRange: context.fields[0]?.address || 'F2',
  };
}

function buildConnectorVersionTemplateSheetSpec(context) {
  const connectorSheetModel = buildConnectorTemplateSheetModel(context);
  const rows = connectorSheetModel.rows;
  const lastRow = rows.length + 1;
  const assemblyRowSet = new Set(connectorSheetModel.assemblyRows);
  return {
    workbookName: context.title,
    sheetName: context.activeLabel || '模板',
    matrix: [
      ['NO.', 'Function', '层级', '编号', '名称', 'SAP', '数量', '单位', '供应商', '协议价', '进度价', '初始报价', '状态', '已达成', '待确认', '开发中', '待回复', '执行档位', '备注', 'BOM定位'],
      ...rows,
    ],
    columnWidths: [56, 160, 96, 180, 200, 118, 72, 64, 120, 92, 92, 92, 90, 68, 68, 68, 78, 108, 240, 180],
    rowHeights: Array.from({ length: lastRow }, (_, index) => {
      if (index === 0) return 40;
      return assemblyRowSet.has(index + 1) ? 36 : 30;
    }),
    frozenRows: 1,
    mergeData: connectorSheetModel.mergeData,
    styles: [
      { range: `A1:T${lastRow}`, border: { type: 'ALL', style: 'THIN', color: '#dbe4ee' } },
      { range: 'A1:T1', background: '#e3eaf2', fontWeight: 'bold', wrap: true, horizontalAlignment: 'center', verticalAlignment: 'middle' },
      { range: `A2:A${lastRow}`, background: '#f8fafc', horizontalAlignment: 'center', verticalAlignment: 'middle' },
      { range: `B2:B${lastRow}`, background: '#eef5fb', horizontalAlignment: 'center', verticalAlignment: 'middle', wrap: true },
      { range: `C2:C${lastRow}`, horizontalAlignment: 'center', verticalAlignment: 'middle', wrap: true },
      { range: `D2:E${lastRow}`, background: '#fbfdff', wrap: true, verticalAlignment: 'middle' },
      { range: `F2:H${lastRow}`, horizontalAlignment: 'center', verticalAlignment: 'middle', wrap: true },
      { range: `I2:I${lastRow}`, background: '#fbfdff', wrap: true, verticalAlignment: 'middle' },
      { range: `J2:L${lastRow}`, horizontalAlignment: 'right', verticalAlignment: 'middle' },
      { range: `M2:Q${lastRow}`, horizontalAlignment: 'center', verticalAlignment: 'middle' },
      { range: `R2:R${lastRow}`, background: '#fffef6', horizontalAlignment: 'center', verticalAlignment: 'middle' },
      { range: `S2:T${lastRow}`, wrap: true, verticalAlignment: 'top' },
      ...connectorSheetModel.assemblyRows.map((row) => ({
        range: `A${row}:T${row}`,
        background: '#fcfdff',
        fontWeight: 'bold',
        verticalAlignment: 'middle',
      })),
      ...connectorSheetModel.detailRows.map((row) => ({
        range: `C${row}:T${row}`,
        background: '#ffffff',
        verticalAlignment: 'top',
      })),
    ],
    activeRange: context.fields[0]?.address || 'R2',
  };
}

function buildVersionTemplateSheetSpec(context) {
  if (context.workbookSnapshot) {
    return {
      workbookSnapshot: clonePlain(context.workbookSnapshot, null),
      activeRange: context.group === 'packaging'
        ? 'A1'
        : (context.skipFieldOverlay ? 'A1' : (context.fields[0]?.address || 'F2')),
    };
  }
  if (context.group === 'bom') return buildBomVersionTemplateSheetSpec(context);
  if (context.group === 'labor') return buildLaborVersionTemplateSheetSpec(context);
  if (context.group === 'packaging') return buildPackagingVersionTemplateSheetSpec(context);
  if (context.group === 'connector') return buildConnectorVersionTemplateSheetSpec(context);
  return buildGenericVersionTemplateSheetSpec(context);
}

function renderVersionTemplateEditor(context) {
  try {
    setVersionTemplateEditorMode(true);
    const editor = ensureVersionTemplateEditor();
    if (!editor) return false;
    editor.loadTemplate(buildVersionTemplateSheetSpec(context));
    if (!context.skipFieldOverlay) {
      editor.applyFieldInputs?.(context.fields, context.rawInputs, context.values);
    }
    scheduleVersionTemplateEditorWarmup(context);
    updateVersionTemplateDebugPanel();
    return true;
  } catch (error) {
    pushVersionTemplateDebugError('renderVersionTemplateEditor.loadTemplate', error);
    console.error('Failed to initialize Univer template editor', error);
    clearVersionTemplateRenderMonitor();
    setVersionTemplateEditorMode(false);
    updateVersionTemplateDebugPanel();
    return false;
  }
}

function renderVersionTemplateFields(context) {
  if (!el.versionTemplateFields) return;
  if (context.editorMode === 'univer' && renderVersionTemplateEditor(context)) {
    updateVersionTemplateDebugPanel();
    return;
  }
  clearVersionTemplateRenderMonitor();
  context.editorMode = 'fallback';
  if (String(context.editorReason || '').startsWith('univer')) {
    context.editorReason = 'fallback';
  }
  context.skipFieldOverlay = false;
  setVersionTemplateEditorMode(false);
  if (el.versionTemplatePasteHint) {
    el.versionTemplatePasteHint.textContent = versionTemplatePasteHintText(context);
  }
  if (context.group === 'bom') {
    const rows = context.fields.map((field, index) => {
      const value = context.values?.[field.key];
      const section = field.section || 'BOM参数';
      const code = field.templateCode || field.key.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toUpperCase();
      const hint = field.hint || (field.aliases || []).slice(0, 2).join(' / ') || '可直接编辑或整列粘贴';
      const spec = field.spec || `${field.label}维护项`;
      const attrs = [
        `data-template-field="${field.key}"`,
        `data-template-index="${index}"`,
        `class="version-template-sheet-input"`,
        `type="number"`,
        `inputmode="decimal"`,
        `aria-label="${escapeHtml(`${field.label} 数值`)}"`,
        `step="${field.step || '0.01'}"`,
        field.min !== undefined ? `min="${field.min}"` : '',
        field.max !== undefined ? `max="${field.max}"` : '',
        `value="${escapeHtml(value ?? '')}"`,
      ].filter(Boolean).join(' ');
      return `
        <tr>
          <td class="sheet-row-index">${index + 1}</td>
          <td class="sheet-bom-function">${escapeHtml(section)}</td>
          <td class="sheet-bom-code">${escapeHtml(code)}</td>
          <td class="sheet-bom-name">${escapeHtml(field.label)}</td>
          <td class="sheet-bom-spec">${escapeHtml(spec)}</td>
          <td class="sheet-value"><input ${attrs} /></td>
          <td class="sheet-unit">${escapeHtml(field.unit || '-')}</td>
          <td class="sheet-bom-remark">手工维护</td>
          <td class="sheet-hint">${escapeHtml(hint)}</td>
        </tr>
      `;
    }).join('');
    el.versionTemplateFields.innerHTML = `
      <div class="version-template-sheet-wrap">
        <div class="version-template-sheet-caption">线束 BOM 录入模板（参考线束页表头）</div>
        <table class="version-template-sheet is-bom-layout">
          <colgroup>
            <col class="sheet-col-index" />
            <col class="sheet-col-bom-function" />
            <col class="sheet-col-bom-code" />
            <col class="sheet-col-bom-name" />
            <col class="sheet-col-bom-spec" />
            <col class="sheet-col-bom-value" />
            <col class="sheet-col-bom-unit" />
            <col class="sheet-col-bom-remark" />
            <col class="sheet-col-bom-other" />
          </colgroup>
          <thead>
            <tr>
              <th>NO.</th>
              <th>Function<br>功能</th>
              <th>Part Number<br>参数编码</th>
              <th>Part Name<br>参数名称</th>
              <th>SPEC<br>口径说明</th>
              <th>Quantity<br>数值</th>
              <th>Unit<br>单位</th>
              <th>Remark</th>
              <th>Other-Remark<br>系统映射</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;
    updateVersionTemplateDebugPanel();
    return;
  }
  if (context.group === 'connector') {
    const rows = (context.connectorRows || []).map((row, index) => {
      const field = context.fields[index];
      const value = context.rawInputs?.[field.key] ?? context.values?.[field.key] ?? row.currentStageLabel ?? '';
      const attrs = [
        `data-template-field="${field.key}"`,
        `data-template-index="${index}"`,
        `class="version-template-sheet-input"`,
        `type="text"`,
        `aria-label="${escapeHtml(`${row.itemLabel} 执行档位`)}"`,
        `value="${escapeHtml(value ?? '')}"`,
      ].filter(Boolean).join(' ');
      return `
        <tr>
          <td class="sheet-row-index">${index + 1}</td>
          <td class="sheet-field-name">${escapeHtml(row.itemLabel)}</td>
          <td class="sheet-bom-name">${escapeHtml(row.assemblyNo || '-')}</td>
          <td class="sheet-unit">${escapeHtml(row.supplier || '-')}</td>
          <td class="sheet-unit">${escapeHtml(row.protocolPrice === '' ? '-' : row.protocolPrice)}</td>
          <td class="sheet-unit">${escapeHtml(row.progressPrice === '' ? '-' : row.progressPrice)}</td>
          <td class="sheet-unit">${escapeHtml(row.initialQuote === '' ? '-' : row.initialQuote)}</td>
          <td class="sheet-section">${escapeHtml(row.statusLabel || '-')}</td>
          <td class="sheet-row-index">${row.confirmedCount ?? 0}</td>
          <td class="sheet-row-index">${row.quotedPendingCount ?? 0}</td>
          <td class="sheet-row-index">${row.devPendingCount ?? 0}</td>
          <td class="sheet-row-index">${row.noReplyCount ?? 0}</td>
          <td class="sheet-value"><input ${attrs} /></td>
          <td class="sheet-hint">${escapeHtml(row.partDetail || '')}</td>
          <td class="sheet-hint">${escapeHtml(row.bomLocation || '')}</td>
        </tr>
      `;
    }).join('');
    el.versionTemplateFields.innerHTML = `
      <div class="version-template-sheet-wrap">
        <div class="version-template-sheet-caption">连接器价格模板（自动提取当前 BOM）</div>
        <table class="version-template-sheet is-bom-layout">
          <thead>
            <tr>
              <th>NO.</th>
              <th>连接器</th>
              <th>总成号</th>
              <th>供应商</th>
              <th>协议价</th>
              <th>进度价</th>
              <th>初始报价</th>
              <th>状态</th>
              <th>已达成</th>
              <th>待确认</th>
              <th>开发中</th>
              <th>暂无回复</th>
              <th>执行档位</th>
              <th>散件明细</th>
              <th>BOM定位</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;
    updateVersionTemplateDebugPanel();
    return;
  }
  const rows = context.fields.map((field, index) => {
    const value = context.values?.[field.key];
    const section = field.section || '模板项目';
    const attrs = [
      `data-template-field="${field.key}"`,
      `data-template-index="${index}"`,
      `class="version-template-sheet-input"`,
      `type="number"`,
      `inputmode="decimal"`,
      `aria-label="${escapeHtml(`${field.label} 数值`)}"`,
      `step="${field.step || '0.01'}"`,
      field.min !== undefined ? `min="${field.min}"` : '',
      field.max !== undefined ? `max="${field.max}"` : '',
      `value="${escapeHtml(value ?? '')}"`,
    ].filter(Boolean).join(' ');
    const hint = field.hint || (field.aliases || []).slice(0, 2).join(' / ') || '可直接编辑或整列粘贴';
    return `
      <tr>
        <td class="sheet-row-index">${index + 1}</td>
        <td class="sheet-section">${escapeHtml(section)}</td>
        <td class="sheet-field-name">${escapeHtml(field.label)}</td>
        <td class="sheet-unit">${escapeHtml(field.unit || '-')}</td>
        <td class="sheet-value"><input ${attrs} /></td>
        <td class="sheet-hint">${escapeHtml(hint)}</td>
      </tr>
    `;
  }).join('');
  const caption = context.group === 'bom' ? '线束 BOM 参数模板' : '版本模板明细';
  el.versionTemplateFields.innerHTML = `
    <div class="version-template-sheet-wrap">
      <div class="version-template-sheet-caption">${caption}</div>
      <table class="version-template-sheet${context.group === 'bom' ? ' is-bom-like' : ''}">
        <colgroup>
          <col class="sheet-col-index" />
          <col class="sheet-col-section" />
          <col class="sheet-col-field" />
          <col class="sheet-col-unit" />
          <col class="sheet-col-value" />
          <col class="sheet-col-hint" />
        </colgroup>
        <thead>
          <tr>
            <th>#</th>
            <th>分类</th>
            <th>项目</th>
            <th>单位</th>
            <th>数值</th>
            <th>维护说明</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
  updateVersionTemplateDebugPanel();
}

function updateVersionTemplateStatus(text) {
  if (el.versionTemplateStatus) {
    el.versionTemplateStatus.textContent = text;
  }
  updateVersionTemplateStatusMeta();
}

function getVersionTemplateSheetTabs() {
  if (!el.versionTemplateFields) return [];
  return Array.from(el.versionTemplateFields.querySelectorAll('[data-u-comp="slide-tab-item"]'))
    .map((node) => ({
      label: toText(node.textContent),
      active: node.getAttribute('aria-selected') === 'true',
    }))
    .filter((item) => item.label);
}

function updateVersionTemplateStatusMeta() {
  if (el.versionTemplateSelectionMeta) {
    if (versionTemplateDraft?.editorMode === 'univer') {
      const selection = versionTemplateEditor?.getSelectionSnapshot?.();
      el.versionTemplateSelectionMeta.textContent = selection?.a1 ? `当前选区 ${selection.a1}` : '当前选区 --';
    } else {
      el.versionTemplateSelectionMeta.textContent = '当前选区 表单模式';
    }
  }
  if (el.versionTemplateSheetMeta) {
    if (versionTemplateDraft?.editorMode !== 'univer') {
      const fieldCount = Array.isArray(versionTemplateDraft?.fields) ? versionTemplateDraft.fields.length : 0;
      el.versionTemplateSheetMeta.textContent = fieldCount ? `${fieldCount} 项字段 · 表单模式` : '表单模式';
    } else {
      const tabs = getVersionTemplateSheetTabs();
      const activeTab = tabs.find((item) => item.active);
      if (!tabs.length) {
        el.versionTemplateSheetMeta.textContent = '工作表加载中';
        if (el.versionTemplateEditorMeta) {
          el.versionTemplateEditorMeta.textContent = versionTemplateEditorMetaText(versionTemplateDraft);
        }
        return;
      }
      el.versionTemplateSheetMeta.textContent = activeTab
        ? `${tabs.length} 张表 · 当前 ${activeTab.label}`
        : `${tabs.length} 张表`;
    }
  }
  if (el.versionTemplateEditorMeta) {
    el.versionTemplateEditorMeta.textContent = versionTemplateEditorMetaText(versionTemplateDraft);
  }
}

function stopVersionTemplateStatusMetaTimer() {
  if (versionTemplateStatusMetaTimer) {
    window.clearInterval(versionTemplateStatusMetaTimer);
    versionTemplateStatusMetaTimer = 0;
  }
}

function startVersionTemplateStatusMetaTimer() {
  stopVersionTemplateStatusMetaTimer();
  updateVersionTemplateStatusMeta();
  versionTemplateStatusMetaTimer = window.setInterval(() => {
    if (!el.versionTemplateModal || el.versionTemplateModal.hidden) {
      stopVersionTemplateStatusMetaTimer();
      return;
    }
    updateVersionTemplateStatusMeta();
  }, 500);
}

function openVersionTemplateModal(group) {
  if (!VERSION_TEMPLATE_GROUPS.has(group) || !el.versionTemplateModal) return false;
  const context = buildVersionTemplateContext(group);
  if (!context) return false;
  versionTemplateDraft = context;
  syncVersionTemplateChromeLabels();
  el.versionTemplateModal.classList.remove('is-window-minimized');
  setVersionTemplateWindowMaximized(context.editorMode === 'univer');
  startVersionTemplateDebugPanel();
  startVersionTemplateStatusMetaTimer();
  syncVersionTemplatePanelMode(context.editorMode === 'univer');
  if (el.versionTemplateEyebrow) el.versionTemplateEyebrow.textContent = context.eyebrow;
  if (el.versionTemplateTitle) el.versionTemplateTitle.textContent = context.title;
  if (el.versionTemplateSubtitle) el.versionTemplateSubtitle.textContent = context.subtitle;
  if (el.versionTemplatePasteHint) el.versionTemplatePasteHint.textContent = versionTemplatePasteHintText(context);
  if (el.versionTemplateName) el.versionTemplateName.value = context.suggestedLabel;
  if (el.versionTemplateName) el.versionTemplateName.placeholder = '请输入版本名称';
  const sourceField = el.versionTemplateSource?.closest('.field');
  if (sourceField) sourceField.hidden = context.group === 'packaging';
  if (el.versionTemplateSource) el.versionTemplateSource.value = context.source || '';
  if (el.versionTemplateNote) el.versionTemplateNote.value = context.note || '';
  if (el.versionTemplatePaste) el.versionTemplatePaste.value = '';
  el.versionTemplateModal.hidden = false;
  el.versionTemplateModal.setAttribute('aria-hidden', 'false');
  applyVersionTemplateWindowShellState();
  syncVersionTemplateWindowControls();
  queueVersionTemplateFieldsRender(context);
  ensureVersionTemplateResizeObserver();
  updateVersionTemplateStatus(`当前参考版本：${context.activeLabel}。右侧可直接像 Excel 一样录入、粘贴和写公式，保存后生成新版本。`);
  window.requestAnimationFrame(() => el.versionTemplateName?.focus());
  updateVersionTemplateStatus(versionTemplateStatusText(versionTemplateDraft));
  updateVersionTemplateDebugPanel();
  return true;
}

function closeVersionTemplateModal() {
  if (!el.versionTemplateModal) return;
  clearVersionTemplateRenderMonitor();
  stopVersionTemplateStatusMetaTimer();
  disposeVersionTemplateEditor();
  disconnectVersionTemplateResizeObserver();
  syncVersionTemplatePanelMode(false);
  el.versionTemplateModal.classList.remove('is-window-minimized');
  setVersionTemplateWindowMaximized(false);
  el.versionTemplateModal.hidden = true;
  el.versionTemplateModal.setAttribute('aria-hidden', 'true');
  applyVersionTemplateWindowShellState();
  versionTemplateDraft = null;
  updateVersionTemplateDebugPanel();
  stopVersionTemplateDebugPanel();
}

function handleVersionTemplateGlobalShortcuts(event) {
  if (!el.versionTemplateModal || el.versionTemplateModal.hidden) return;
  const isSaveShortcut = (event.ctrlKey || event.metaKey)
    && !event.shiftKey
    && !event.altKey
    && String(event.key || '').toLowerCase() === 's';
  if (!isSaveShortcut) return;
  event.preventDefault();
  saveVersionTemplate();
}

function resetVersionTemplateForm() {
  if (!versionTemplateDraft) return;
  openVersionTemplateModal(versionTemplateDraft.group);
}

function normalizeTemplateLookup(value) {
  return String(value ?? '').toLowerCase().replace(/[\s\r\n\t:：,，/\\_|【】\[\]（）()%-]+/g, '');
}

function parseNumericCellValue(value) {
  const text = String(value ?? '').trim();
  if (!text) return null;
  const cleaned = text.replace(/,/g, '').replace(/，/g, '').replace(/%/g, '').trim();
  if (!/^[+-]?\d+(?:\.\d+)?$/.test(cleaned)) return null;
  const next = Number(cleaned);
  return Number.isFinite(next) ? next : null;
}

function parseVersionTemplateMatrix(text) {
  return String(text || '')
    .split(/\r?\n/)
    .map((line) => line.split('\t').map((cell) => cell.trim()))
    .filter((row) => row.some((cell) => cell));
}

function rowMatchesTemplateAliases(row, field) {
  const rowText = normalizeTemplateLookup(row.join(' '));
  return (field.aliases || []).some((alias) => rowText.includes(normalizeTemplateLookup(alias)));
}

function lastNumericCell(row) {
  for (let index = row.length - 1; index >= 0; index -= 1) {
    const value = parseNumericCellValue(row[index]);
    if (value !== null) {
      return { value, cellIndex: index };
    }
  }
  return null;
}

function extractSequentialTemplateValues(text) {
  const rows = parseVersionTemplateMatrix(text);
  if (!rows.length) return [];
  if (rows.length === 1) {
    return rows[0]
      .map((cell) => parseNumericCellValue(cell))
      .filter((value) => value !== null);
  }
  return rows
    .map((row) => lastNumericCell(row)?.value ?? null)
    .filter((value) => value !== null);
}

function handleVersionTemplateSheetInput(event) {
  if (!versionTemplateDraft) return;
  const input = event.target.closest('[data-template-field]');
  if (!input) return;
  const fieldKey = input.dataset.templateField;
  versionTemplateDraft.values = {
    ...versionTemplateDraft.values,
    [fieldKey]: coerceNumber(input.value, coerceNumber(versionTemplateDraft.values?.[fieldKey], 0)),
  };
}

function handleVersionTemplateSheetPaste(event) {
  if (!versionTemplateDraft || !el.versionTemplateFields) return;
  const input = event.target.closest('[data-template-field]');
  if (!input) return;
  const rawText = event.clipboardData?.getData('text/plain') || '';
  if (!/[\t\r\n]/.test(rawText)) return;
  const values = extractSequentialTemplateValues(rawText);
  if (values.length < 2) return;
  const startIndex = Number(input.dataset.templateIndex || -1);
  if (!Number.isInteger(startIndex) || startIndex < 0) return;
  event.preventDefault();
  let filledCount = 0;
  values.forEach((value, offset) => {
    const field = versionTemplateDraft.fields[startIndex + offset];
    if (!field) return;
    const target = el.versionTemplateFields.querySelector(`[data-template-field="${field.key}"]`);
    if (!target) return;
    target.value = value;
    versionTemplateDraft.values[field.key] = value;
    filledCount += 1;
  });
  if (filledCount) {
    updateVersionTemplateStatus(`已从右侧工作表粘贴 ${filledCount} 个数值，并按模板顺序向下回填。`);
  }
}

function parseVersionTemplatePaste() {
  if (!versionTemplateDraft || !el.versionTemplatePaste) return;
  syncVersionTemplateDraftValuesFromDom();
  const text = el.versionTemplatePaste.value;
  const rows = parseVersionTemplateMatrix(text);
  if (!rows.length) {
    updateVersionTemplateStatus('未识别到可解析内容，请先粘贴 Excel 片段。');
    return;
  }

  const parsedValues = {};
  const usedCellKeys = new Set();

  versionTemplateDraft.fields.forEach((field) => {
    const rowIndex = rows.findIndex((row) => rowMatchesTemplateAliases(row, field));
    if (rowIndex === -1) return;
    const match = lastNumericCell(rows[rowIndex]);
    if (!match) return;
    parsedValues[field.key] = match.value;
    usedCellKeys.add(`${rowIndex}:${match.cellIndex}`);
  });

  const numericCells = [];
  rows.forEach((row, rowIndex) => {
    row.forEach((cell, cellIndex) => {
      const value = parseNumericCellValue(cell);
      if (value === null) return;
      const key = `${rowIndex}:${cellIndex}`;
      if (usedCellKeys.has(key)) return;
      numericCells.push({ value, key });
    });
  });

  let cursor = 0;
  versionTemplateDraft.fields.forEach((field) => {
    if (parsedValues[field.key] !== undefined) return;
    const next = numericCells[cursor];
    if (!next) return;
    parsedValues[field.key] = next.value;
    cursor += 1;
  });

  const filledKeys = Object.keys(parsedValues);
  if (!filledKeys.length) {
    updateVersionTemplateStatus('已粘贴内容，但没有识别到可用数字。请检查是否为 Excel 数值列。');
    return;
  }

  versionTemplateDraft.values = {
    ...versionTemplateDraft.values,
    ...parsedValues,
  };
  renderVersionTemplateFields(versionTemplateDraft);
  updateVersionTemplateStatus(`已识别 ${filledKeys.length} 个字段，并回填到右侧模板。未识别项会继续保留当前值。`);
}

function readVersionTemplateFieldState() {
  if (!versionTemplateDraft) {
    return { values: {}, rawInputs: {} };
  }
  if (versionTemplateDraft.skipFieldOverlay) {
    return {
      values: clonePlain(versionTemplateDraft.values, {}) || {},
      rawInputs: clonePlain(versionTemplateDraft.rawInputs, {}) || {},
    };
  }
  if (versionTemplateDraft.editorMode === 'univer' && versionTemplateEditor) {
    const fieldStateMap = versionTemplateEditor.getFieldState(versionTemplateDraft.fields);
    return versionTemplateDraft.fields.reduce((acc, field) => {
      const fieldState = fieldStateMap?.[field.key] || {};
      const fallbackValue = versionTemplateDraft.values?.[field.key];
      const fallbackRawInput = versionTemplateDraft.rawInputs?.[field.key];
      const formula = typeof fieldState.formula === 'string' ? fieldState.formula.trim() : '';
      const value = fieldState.value;
      const parsedValue = typeof value === 'number' ? value : parseNumericCellValue(value);
      acc.values[field.key] = parsedValue !== null ? parsedValue : coerceNumber(fallbackValue, 0);
      acc.rawInputs[field.key] = formula || templateSheetCellValue(value, fallbackRawInput ?? fallbackValue ?? '');
      return acc;
    }, { values: {}, rawInputs: {} });
  }
  if (!el.versionTemplateFields) {
    return {
      values: clonePlain(versionTemplateDraft.values, {}) || {},
      rawInputs: clonePlain(versionTemplateDraft.rawInputs, {}) || {},
    };
  }
  return versionTemplateDraft.fields.reduce((acc, field) => {
    const input = el.versionTemplateFields.querySelector(`[data-template-field="${field.key}"]`);
    const rawValue = input?.value;
    const fallbackValue = versionTemplateDraft.values?.[field.key];
    const fallbackRawInput = versionTemplateDraft.rawInputs?.[field.key];
    acc.values[field.key] = coerceNumber(rawValue, coerceNumber(fallbackValue, 0));
    acc.rawInputs[field.key] = templateSheetCellValue(rawValue, fallbackRawInput ?? fallbackValue ?? '');
    return acc;
  }, { values: {}, rawInputs: {} });
}

function readVersionTemplateFieldValues() {
  return readVersionTemplateFieldState().values;
}

function syncVersionTemplateDraftValuesFromDom() {
  if (!versionTemplateDraft) return { values: {}, rawInputs: {} };
  const fieldState = readVersionTemplateFieldState();
  versionTemplateDraft.values = {
    ...versionTemplateDraft.values,
    ...fieldState.values,
  };
  versionTemplateDraft.rawInputs = {
    ...versionTemplateDraft.rawInputs,
    ...fieldState.rawInputs,
  };
  if (versionTemplateDraft.editorMode === 'univer' && versionTemplateEditor) {
    versionTemplateDraft.workbookSnapshot = clonePlain(versionTemplateEditor.saveSnapshot(), null);
  }
  return fieldState;
}

function annualDropSnapshotSummary(snapshot) {
  const yearRows = Array.isArray(snapshot?.yearRows) ? snapshot.yearRows : [];
  if (!yearRows.length) return '未设置生命周期年降';
  const nonZeroRows = yearRows.filter((row, index) => index > 0 && Number(row?.rate) > 0);
  if (!nonZeroRows.length) return `共 ${fmtInt(yearRows.length)} 年，未设置年降`;
  const maxRate = nonZeroRows.reduce((max, row) => Math.max(max, coerceNumber(row?.rate, 0)), 0);
  const firstYear = nonZeroRows[0]?.year;
  return `共 ${fmtInt(yearRows.length)} 年，${firstYear || '后续年度'}起年降，最高 ${fmtPct(maxRate)}`;
}

function oneTimeCustomerSnapshotSummary(snapshot) {
  const entries = Array.isArray(snapshot?.entries) ? snapshot.entries : [];
  if (!entries.length) return '未设置一次性费用';
  const directTotal = entries.reduce((sum, entry) => sum + (entry?.mode === 'direct' ? Math.max(0, Number(entry?.amount) || 0) : 0), 0);
  const allocateTotal = entries.reduce((sum, entry) => sum + (entry?.mode === 'direct' ? 0 : Math.max(0, Number(entry?.amount) || 0)), 0);
  return `${fmtInt(entries.length)} 条，直付 ${fmtMoney(directTotal)} 元，分摊 ${fmtMoney(allocateTotal)} 元`;
}

function rebateSnapshotSummary(snapshot) {
  const yearRows = Array.isArray(snapshot?.yearRows) ? snapshot.yearRows : [];
  if (!yearRows.length) return '未设置返点';
  const total = yearRows.reduce((sum, row) => sum + Math.max(0, Number(row?.amountTotal) || 0), 0);
  const activeRows = yearRows.filter((row) => Number(row?.amountTotal) > 0);
  if (!activeRows.length) return `生命周期 ${fmtMoney(total)} 元`;
  return `生命周期 ${fmtMoney(total)} 元，${activeRows[0]?.year || ''} 起 ${fmtInt(activeRows.length)} 年`;
}

function buildVersionTemplateSourceNote(group, context, source, note, values, workbookSnapshot = null) {
  const sourceText = source ? `来源：${source}` : `来源：手工模板录入，参考 ${context.activeLabel}`;
  const noteText = note ? `；备注：${note}` : '';
  if (group === 'bom') {
    return `${sourceText}；BOM 模板维护。材料系数 ${fmtNumber(values.factor, 3)}，导线 ${fmtNumber(values.wireMeter, 3)} m，胶带 ${fmtNumber(values.tapeMeter, 3)} m${noteText}`.trim();
  }
  if (group === 'metal') {
    return `${sourceText}；铜铝基价模板维护。铜价 ${fmtMoney(values.copperPrice || 0, 0)} 元/吨，铝价 ${fmtMoney(values.aluminumPrice || 0, 0)} 元/吨${noteText}`.trim();
  }
  if (group === 'connector') {
    const rowCount = Array.isArray(context?.connectorRows) ? context.connectorRows.length : 0;
    return `${sourceText}；连接器价格模板维护。已带出 ${fmtInt(rowCount)} 行连接器信息，可按整套执行档位维护${noteText}`.trim();
  }
  if (group === 'labor') {
    return `${sourceText}；工时模板维护。直接人工 ${fmtNumber(values.directHours, 2)} h/套，制造工时 ${fmtNumber(values.manufacturingHours, 2)} h/套${noteText}`.trim();
  }
  if (group === 'equipment') {
    return `${sourceText}；设备资源模板维护。设备 ${fmtMoney(values.equipment)} 元，模具 ${fmtMoney(values.tooling)} 元，工装 ${fmtMoney(values.fixtures)} 元${noteText}`.trim();
  }
  if (group === 'packaging') {
    return '';
  }
  if (group === 'configSheet') {
    return `${sourceText}；配置清单模板维护，保留整表格式、公式与表头结构${noteText}`.trim();
  }
  if (group === 'sales') {
    const total = Object.keys(values).reduce((sum, key) => sum + coerceNumber(values[key], 0), 0);
    return `${sourceText}；销量预测模板维护。生命周期销量 ${fmtInt(total)} 套${noteText}`.trim();
  }
  if (group === 'mix') {
    return `${sourceText}；配置比例模板维护，保存时自动归一化到 100%${noteText}`.trim();
  }
  if (group === 'annualDrop') {
    const fallbackRows = Array.isArray(context?.yearRows) ? context.yearRows : annualDropVersionSnapshot(context?.activeKey).yearRows;
    const yearRows = workbookSnapshot
      ? parseAnnualDropWorkbookRows(workbookSnapshot, fallbackRows, values?.annualRate)
      : normalizeAnnualDropYearRows(fallbackRows, lifecycleTemplateYears(), values?.annualRate);
    return `${sourceText}；年降模板维护。${annualDropSnapshotSummary({ yearRows })}${noteText}`.trim();
  }
  if (group === 'oneTimeCustomer') {
    const fallbackEntries = Array.isArray(context?.entries) ? context.entries : oneTimeCustomerVersionSnapshot(context?.activeKey).entries;
    const entries = workbookSnapshot
      ? parseOneTimeCustomerWorkbookEntries(workbookSnapshot, fallbackEntries, values?.amountTotal)
      : normalizeOneTimeCustomerEntries(fallbackEntries, lifecycleTemplateYears(), values?.amountTotal);
    return `${sourceText}；一次性费用模板维护。${oneTimeCustomerSnapshotSummary({ entries })}${noteText}`.trim();
  }
  if (group === 'rebate') {
    const fallbackRows = Array.isArray(context?.yearRows) ? context.yearRows : rebateVersionSnapshot(context?.activeKey).yearRows;
    const yearRows = workbookSnapshot
      ? parseRebateWorkbookRows(workbookSnapshot, fallbackRows, values?.amountPerSet)
      : normalizeRebateYearRows(fallbackRows, lifecycleTemplateYears(), lifecycleTemplateVolumes(), values?.amountPerSet);
    return `${sourceText}；返点模板维护。${rebateSnapshotSummary({ yearRows })}${noteText}`.trim();
  }
  return `${sourceText}${noteText}`.trim();
}

function buildVersionTemplatePayload(group, context, values, source, note, rawInputs = {}, workbookSnapshot = null) {
  const sourceNote = buildVersionTemplateSourceNote(group, context, source, note, values, workbookSnapshot);
  const templateState = {
    source,
    sourceNote,
    templateNote: note || '',
    templateRawInputs: clonePlain(rawInputs, null),
    templateFieldAddressMap: Array.isArray(context?.fields)
      ? context.fields.reduce((acc, field) => {
        if (field?.key && field?.address) {
          acc[field.key] = field.address;
        }
        return acc;
      }, {})
      : null,
    templateWorkbookSeed: clonePlain(context?.templateWorkbookSeed, null),
    templateWorkbookSnapshot: clonePlain(workbookSnapshot, null),
  };
  if (group === 'bom') {
    return {
      ...templateState,
      kind: 'custom',
      note: '手工模板版本，可继续录入或粘贴新的 BOM 口径。',
      source,
      sourceNote,
      factor: values.factor,
      wireFactor: values.wireFactor,
      totalMeter: values.totalMeter,
      wireMeter: values.wireMeter,
      tapeMeter: values.tapeMeter,
      tubeMeter: values.tubeMeter,
      draft: {
        bomWireDrawing: values.bomWireDrawing,
        bomWireEat: values.bomWireEat,
        bomWireHidden: values.bomWireHidden,
        bomTapeDiameter: values.bomTapeDiameter,
        bomTapeWidth: values.bomTapeWidth,
        bomTapeOverlap: values.bomTapeOverlap,
      },
    };
  }
  if (group === 'metal') {
    return {
      ...templateState,
      kind: 'custom',
      note: '手工模板版本，可继续录入新的铜铝基价。',
      source,
      sourceNote,
      copperPrice: Math.max(0, coerceNumber(values.copperPrice, 0)),
      aluminumPrice: Math.max(0, coerceNumber(values.aluminumPrice, 0)),
      manualManaged: true,
    };
  }
  if (group === 'connector') {
    const rows = buildConnectorTemplatePayloadRows(context, rawInputs);
    const sourceKey = context.connectorSourceKey || context.activeStageKey || context.activeKey;
    const overrides = rows.reduce((acc, row) => {
      if (row.currentStage && row.currentStage !== sourceKey) {
        acc[row.itemId] = row.currentStage;
      }
      return acc;
    }, {});
    return {
      ...templateState,
      kind: 'custom',
      note: '手工模板版本，可继续维护连接器执行档位。',
      source,
      sourceKey,
      sourceNote: `${sourceNote}；已解析 ${fmtInt(rows.length)} 行连接器，显式指定 ${fmtInt(Object.keys(overrides).length)} 行执行档位。`,
      overrides,
      templateRows: rows,
    };
  }
  if (group === 'labor') {
    return {
      ...templateState,
      kind: 'custom',
      note: '手工模板版本，可继续录入或粘贴新的工时口径。',
      source,
      sourceNote,
      directHours: values.directHours,
      directRate: values.directRate,
      manufacturingHours: values.manufacturingHours,
      manufacturingRate: values.manufacturingRate,
    };
  }
  if (group === 'equipment') {
    const quoteEquipment = equipmentVersionSnapshot('base').equipment || 0;
    return {
      ...templateState,
      kind: 'custom',
      note: '手工模板版本，可继续录入或粘贴新的设备资源金额。',
      source,
      sourceNote,
      equipment: values.equipment,
      tooling: values.tooling,
      fixtures: values.fixtures,
      rnd: values.rnd,
      factor: quoteEquipment ? values.equipment / quoteEquipment : 1,
    };
  }
  if (group === 'packaging') {
    return {
      ...templateState,
      kind: 'custom',
      note: '手工模板版本，可继续录入或粘贴新的包装物流拆分。',
      source,
      sourceNote,
      packInner: values.packInner,
      packFreight: values.packFreight,
      packWarehouse: values.packWarehouse,
      packOther: values.packOther,
    };
  }
  if (group === 'configSheet') {
    return {
      ...templateState,
      kind: 'custom',
      note: 'Excel 式配置清单版本，可继续维护配置清单整表内容。',
      source,
      sourceNote,
      workbook: toText(source, toText(context?.activeLabel, '配置清单')),
      workbookVersionKeyFallback: toText(context?.runtimeVersionKey, toText(context?.activeKey, state.configSheet)),
    };
  }
  if (group === 'sales') {
    return {
      ...templateState,
      kind: 'custom',
      note: '手工模板版本，可继续录入或粘贴新的销量预测。',
      source,
      sourceNote,
      volumes: BASE.years.map((year) => Math.max(0, coerceNumber(values[`sales_${year}`], 0))),
    };
  }
  if (group === 'mix') {
    return {
      ...templateState,
      kind: 'custom',
      note: '手工模板版本，可继续录入或粘贴新的配置比例。',
      source,
      sourceNote,
      values: normalizeMix(BASE.configNames.map((_, index) => coerceNumber(values[`mix_${index}`], 0))),
    };
  }
  if (group === 'annualDrop') {
    const fallbackRows = Array.isArray(context?.yearRows) ? context.yearRows : [];
    const yearRows = workbookSnapshot
      ? parseAnnualDropWorkbookRows(workbookSnapshot, fallbackRows, values?.annualRate)
      : normalizeAnnualDropYearRows(fallbackRows, lifecycleTemplateYears(), values?.annualRate);
    const annualRate = yearRows.find((row, index) => index > 0 && Number(row?.rate) > 0)?.rate
      ?? yearRows.find((row) => Number(row?.rate) > 0)?.rate
      ?? 0;
    return {
      ...templateState,
      kind: 'custom',
      note: '手工模板版本，可继续录入新的 ASP 年降口径。',
      source,
      sourceNote,
      yearRows,
      annualRate: Math.max(0, coerceNumber(annualRate, 0)),
    };
  }
  if (group === 'oneTimeCustomer') {
    const fallbackEntries = Array.isArray(context?.entries) ? context.entries : [];
    const entries = workbookSnapshot
      ? parseOneTimeCustomerWorkbookEntries(workbookSnapshot, fallbackEntries, values?.amountTotal)
      : normalizeOneTimeCustomerEntries(fallbackEntries, lifecycleTemplateYears(), values?.amountTotal);
    const amountTotal = entries.reduce((sum, entry) => sum + Math.max(0, Number(entry?.amount) || 0), 0);
    return {
      ...templateState,
      kind: 'custom',
      note: '手工模板版本，可继续录入新的客户一次性费用口径。',
      source,
      sourceNote,
      entries,
      amountTotal: Math.max(0, coerceNumber(amountTotal, 0)),
    };
  }
  if (group === 'rebate') {
    const fallbackRows = Array.isArray(context?.yearRows) ? context.yearRows : [];
    const yearRows = workbookSnapshot
      ? parseRebateWorkbookRows(workbookSnapshot, fallbackRows, values?.amountPerSet)
      : normalizeRebateYearRows(fallbackRows, lifecycleTemplateYears(), lifecycleTemplateVolumes(), values?.amountPerSet);
    const amountTotal = yearRows.reduce((sum, row) => sum + Math.max(0, Number(row?.amountTotal) || 0), 0);
    const amountPerSet = lifecycleVolumeTotal() ? amountTotal / lifecycleVolumeTotal() : 0;
    return {
      ...templateState,
      kind: 'custom',
      note: '手工模板版本，可继续录入新的返点口径。',
      source,
      sourceNote,
      yearRows,
      amountTotal: Math.max(0, coerceNumber(amountTotal, 0)),
      amountPerSet: Math.max(0, coerceNumber(amountPerSet, 0)),
    };
  }
  return {
    ...templateState,
  };
}

function saveVersionTemplate() {
  if (!versionTemplateDraft) return;
  const group = versionTemplateDraft.group;
  const label = toText(el.versionTemplateName?.value);
  if (!label) {
    window.alert('版本名称不能为空。');
    el.versionTemplateName?.focus();
    return;
  }
  const key = makeUserVersionKey(versionTemplateDraft.group);
  const source = toText(el.versionTemplateSource?.value);
  const note = toText(el.versionTemplateNote?.value);
  const fieldState = syncVersionTemplateDraftValuesFromDom();
  const payload = buildVersionTemplatePayload(
    group,
    versionTemplateDraft,
    fieldState.values,
    source,
    note,
    fieldState.rawInputs,
    versionTemplateDraft.workbookSnapshot
  );
  BASE.versions[group][key] = buildUserVersionOption(group, label, payload);
  state[group] = key;
  void persistVersionOptionToStore(group, key, BASE.versions[group][key], payload, {
    sourceType: 'template-modal',
    status: 'active',
    baseReleaseId: group === 'bom'
      ? toText(
        BASE.versions?.bom?.[versionTemplateDraft?.activeKey]?.semanticReleaseId,
        toText(BASE.versions?.bom?.[versionTemplateDraft?.activeKey]?.nativeWorkbookVersionId, ''),
      )
      : '',
  });
  closeVersionTemplateModal();
  applyVersionPreset(group, key);
  persistUserVersions();
  renderVersions();
  queueRender();
}

function ensureVersionAddButtons() {
  document.querySelectorAll('.version-group').forEach((groupElement) => {
    const optionRow = groupElement.querySelector('.option-row[data-group]');
    const title = groupElement.querySelector('.version-title');
    if (!optionRow || !title) return;
    const group = optionRow.dataset.group;
    let side = title.querySelector('.version-title-side');
    if (!side) {
      side = document.createElement('div');
      side.className = 'version-title-side';
      const subtitle = title.children[1];
      if (subtitle) {
        side.appendChild(subtitle);
      }
      title.appendChild(side);
    }
    if (side.querySelector(`[data-add-version="${group}"]`)) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'version-add-btn';
    button.dataset.addVersion = group;
    button.title = `新增${VERSION_GROUP_LABELS[group] || group}`;
    button.textContent = '+';
    side.appendChild(button);
  });
}

function buildUserVersionOption(group, label, payload = {}) {
  const activeKey = state[group];
  const activeOption = clonePlain(BASE.versions?.[group]?.[activeKey] || {}, {});
  const createdAt = new Date().toISOString();
  const currentLabel = versionOptionLabel(group, activeKey) || VERSION_GROUP_LABELS[group] || group;
  const manualPayload = payload && Object.keys(payload).length > 0;
  const templateSource = toText(payload.source, toText(activeOption.templateSource || activeOption.source || activeOption.workbook || ''));
  const baseOption = {
    ...activeOption,
    label,
    userCreated: true,
    createdAt,
    entryMode: manualPayload ? 'template' : 'clone',
    templateSource,
    templateNote: payload.templateNote !== undefined ? payload.templateNote : toText(activeOption.templateNote || ''),
    templateRawInputs: clonePlain(payload.templateRawInputs, clonePlain(activeOption.templateRawInputs, null)) || null,
    templateFieldAddressMap: clonePlain(payload.templateFieldAddressMap, clonePlain(activeOption.templateFieldAddressMap, null)) || null,
    templateWorkbookSeed: clonePlain(payload.templateWorkbookSeed, clonePlain(activeOption.templateWorkbookSeed, null)) || null,
    templateWorkbookSnapshot: clonePlain(payload.templateWorkbookSnapshot, clonePlain(activeOption.templateWorkbookSnapshot, null)) || null,
    note: payload.note || `离线新增版本，复制自${currentLabel}，保存在当前浏览器。`,
  };

  if (group === 'bom') {
    const snapshot = bomVersionSnapshot(activeKey);
    const draft = {
      ...(snapshot?.draft || {}),
      ...currentBomDraftSnapshot(),
      ...(payload.draft || {}),
    };
    return {
      ...baseOption,
      kind: payload.kind || activeOption.kind || 'custom',
      factor: payload.factor !== undefined ? coerceNumber(payload.factor, 1) : (Number(snapshot?.materialFactor) || Number(activeOption.factor) || 1),
      wireFactor: payload.wireFactor !== undefined ? coerceNumber(payload.wireFactor, 1) : (Number(snapshot?.wireFactor) || Number(activeOption.wireFactor) || 1),
      draft,
      sourceNote: payload.sourceNote || `来源：离线新增版本，复制自${currentLabel}，BOM参数按当前页面快照保存。`,
      workbook: templateSource || payload.workbook || snapshot?.workbook || '',
      totalMeter: payload.totalMeter !== undefined ? coerceNumber(payload.totalMeter, 0) : (Number(snapshot?.totalMeter) || 0),
      wireMeter: payload.wireMeter !== undefined ? coerceNumber(payload.wireMeter, 0) : (Number(snapshot?.wireMeter) || 0),
      tapeMeter: payload.tapeMeter !== undefined ? coerceNumber(payload.tapeMeter, 0) : (Number(snapshot?.tapeMeter) || 0),
      tubeMeter: payload.tubeMeter !== undefined ? coerceNumber(payload.tubeMeter, 0) : (Number(snapshot?.tubeMeter) || 0),
      actualLengthChangeSummary: payload.actualLengthChangeSummary || snapshot?.actualLengthChangeSummary || null,
    };
  }
  if (group === 'metal') {
    return {
      ...baseOption,
      copperPrice: payload.copperPrice !== undefined ? Math.max(0, coerceNumber(payload.copperPrice, 0)) : (Number(controls.copperPrice.value) || 0),
      aluminumPrice: payload.aluminumPrice !== undefined ? Math.max(0, coerceNumber(payload.aluminumPrice, 0)) : (Number(controls.aluminumPrice.value) || 0),
      manualManaged: payload.manualManaged !== undefined ? Boolean(payload.manualManaged) : true,
      seedSourceNote: payload.sourceNote || `来源：离线新增版本，复制自${currentLabel}，铜铝基价按当前页面快照保存。`,
      sourceNote: payload.sourceNote || `来源：离线新增版本，复制自${currentLabel}，铜铝基价按当前页面快照保存。`,
    };
  }
  if (group === 'connector') {
    const connectorSourceKey = connectorVersionSet.has(payload.sourceKey)
      ? payload.sourceKey
      : (connectorVersionSet.has(activeOption.sourceKey) ? activeOption.sourceKey : DEFAULT_STATE.connector);
    return {
      ...baseOption,
      factor: payload.factor !== undefined ? coerceNumber(payload.factor, Number(activeOption.factor) || 1) : (Number(activeOption.factor) || 1),
      sourceKey: connectorSourceKey,
      overrides: sanitizeConnectorPricing(payload.overrides || connectorPricingState, connectorSourceKey),
      templateRows: clonePlain(payload.templateRows, clonePlain(activeOption.templateRows, [])) || [],
      sourceNote: payload.sourceNote || `来源：离线新增版本，复制自${currentLabel}，保留当前连接器覆盖项。`,
    };
  }
  if (group === 'labor') {
    return {
      ...baseOption,
      kind: payload.kind || activeOption.kind || 'custom',
      directHours: payload.directHours !== undefined ? coerceNumber(payload.directHours, 0) : currentLaborDraftSnapshot().directHours,
      directRate: payload.directRate !== undefined ? coerceNumber(payload.directRate, 0) : currentLaborDraftSnapshot().directRate,
      manufacturingHours: payload.manufacturingHours !== undefined ? coerceNumber(payload.manufacturingHours, 0) : currentLaborDraftSnapshot().manufacturingHours,
      manufacturingRate: payload.manufacturingRate !== undefined ? coerceNumber(payload.manufacturingRate, 0) : currentLaborDraftSnapshot().manufacturingRate,
      sourceNote: payload.sourceNote || `来源：离线新增版本，复制自${currentLabel}，工时与费率按当前页面快照保存。`,
    };
  }
  if (group === 'equipment') {
    return {
      ...baseOption,
      kind: payload.kind || activeOption.kind || 'custom',
      factor: payload.factor !== undefined ? coerceNumber(payload.factor, 1) : (Number(activeOption.factor) || 1),
      equipment: payload.equipment !== undefined ? coerceNumber(payload.equipment, 0) : activeOption.equipment,
      tooling: payload.tooling !== undefined ? coerceNumber(payload.tooling, 0) : activeOption.tooling,
      fixtures: payload.fixtures !== undefined ? coerceNumber(payload.fixtures, 0) : activeOption.fixtures,
      rnd: payload.rnd !== undefined ? coerceNumber(payload.rnd, 0) : activeOption.rnd,
      sourceNote: payload.sourceNote || `来源：离线新增版本，复制自${currentLabel}，当前设备投资系数 ${fmtNumber(Number(activeOption.factor) || 1, 3)}。`,
    };
  }
  if (group === 'packaging') {
    return {
      ...baseOption,
      kind: payload.kind || activeOption.kind || 'custom',
      packInner: payload.packInner !== undefined ? coerceNumber(payload.packInner, 0) : currentPackagingDraftSnapshot().packInner,
      packFreight: payload.packFreight !== undefined ? coerceNumber(payload.packFreight, 0) : currentPackagingDraftSnapshot().packFreight,
      packWarehouse: payload.packWarehouse !== undefined ? coerceNumber(payload.packWarehouse, 0) : currentPackagingDraftSnapshot().packWarehouse,
      packOther: payload.packOther !== undefined ? coerceNumber(payload.packOther, 0) : currentPackagingDraftSnapshot().packOther,
      sourceNote: payload.sourceNote ?? activeOption.sourceNote ?? '',
    };
  }
  if (group === 'configSheet') {
    return {
      ...baseOption,
      kind: payload.kind || activeOption.kind || 'custom',
      workbook: toText(payload.workbook, templateSource || activeOption.workbook || label),
      workbookVersionKeyFallback: toText(
        payload.workbookVersionKeyFallback,
        toText(activeOption.workbookVersionKeyFallback, activeKey || state.configSheet),
      ),
      sourceNote: payload.sourceNote || `来源：配置清单 Excel 式版本，复制自 ${currentLabel}。`,
    };
  }
  if (group === 'sales') {
    return {
      ...baseOption,
      kind: payload.kind || activeOption.kind || 'custom',
      volumes: Array.isArray(payload.volumes) ? payload.volumes.map((value) => Math.max(0, coerceNumber(value, 0))) : currentSalesDraftSnapshot(),
      sourceNote: payload.sourceNote || `来源：离线新增版本，复制自${currentLabel}，销量预测按当前页面快照保存。`,
    };
  }
  if (group === 'mix') {
    return {
      ...baseOption,
      kind: payload.kind || activeOption.kind || 'custom',
      values: Array.isArray(payload.values) ? normalizeMix(payload.values) : currentMixDraftSnapshot(),
      sourceNote: payload.sourceNote || `来源：离线新增版本，复制自${currentLabel}，配置比例按当前页面快照保存。`,
    };
  }
  if (group === 'annualDrop') {
    const fallbackSnapshot = annualDropVersionSnapshot(activeKey);
    const yearRows = Array.isArray(payload.yearRows)
      ? normalizeAnnualDropYearRows(payload.yearRows, lifecycleTemplateYears(), payload.annualRate)
      : fallbackSnapshot.yearRows;
    const annualRate = yearRows.find((row, index) => index > 0 && Number(row?.rate) > 0)?.rate
      ?? yearRows.find((row) => Number(row?.rate) > 0)?.rate
      ?? Math.max(0, coerceNumber(fallbackSnapshot.annualRate, 0));
    return {
      ...baseOption,
      kind: payload.kind || activeOption.kind || 'custom',
      yearRows,
      annualRate: Math.max(0, coerceNumber(annualRate, 0)),
      sourceNote: payload.sourceNote || `来源：离线新增版本，复制自${currentLabel}，${annualDropSnapshotSummary({ yearRows })}。`,
    };
  }
  if (group === 'oneTimeCustomer') {
    const fallbackSnapshot = oneTimeCustomerVersionSnapshot(activeKey);
    const entries = Array.isArray(payload.entries)
      ? normalizeOneTimeCustomerEntries(payload.entries, lifecycleTemplateYears(), payload.amountTotal)
      : fallbackSnapshot.entries;
    const amountTotal = entries.reduce((sum, entry) => sum + Math.max(0, Number(entry?.amount) || 0), 0);
    return {
      ...baseOption,
      kind: payload.kind || activeOption.kind || 'custom',
      entries,
      amountTotal: Math.max(0, coerceNumber(amountTotal, 0)),
      sourceNote: payload.sourceNote || `来源：离线新增版本，复制自${currentLabel}，${oneTimeCustomerSnapshotSummary({ entries })}。`,
    };
  }
  if (group === 'rebate') {
    const fallbackSnapshot = rebateVersionSnapshot(activeKey);
    const yearRows = Array.isArray(payload.yearRows)
      ? normalizeRebateYearRows(payload.yearRows, lifecycleTemplateYears(), lifecycleTemplateVolumes(), payload.amountPerSet)
      : fallbackSnapshot.yearRows;
    const amountTotal = yearRows.reduce((sum, row) => sum + Math.max(0, Number(row?.amountTotal) || 0), 0);
    const amountPerSet = lifecycleVolumeTotal() ? amountTotal / lifecycleVolumeTotal() : 0;
    return {
      ...baseOption,
      kind: payload.kind || activeOption.kind || 'custom',
      yearRows,
      amountTotal: Math.max(0, coerceNumber(amountTotal, 0)),
      amountPerSet: Math.max(0, coerceNumber(amountPerSet, 0)),
      sourceNote: payload.sourceNote || `来源：离线新增版本，复制自${currentLabel}，${rebateSnapshotSummary({ yearRows })}。`,
    };
  }
  if (group === 'vave') {
    return {
      ...baseOption,
      savings: Number(activeOption.savings) || 0,
      sourceNote: `来源：离线新增版本，复制自${currentLabel}，当前VAVE降本 ${fmtMoney(Number(activeOption.savings) || 0)} 元/套。`,
    };
  }
  return baseOption;
}

function createUserVersion(group) {
  if (!BASE.versions?.[group]) return;
  if (openVersionTemplateModal(group)) return;
  const suggestedLabel = suggestNewVersionLabel(group);
  const rawLabel = window.prompt(`请输入${VERSION_GROUP_LABELS[group] || group}的新版本名称`, suggestedLabel);
  if (rawLabel === null) return;
  const label = rawLabel.trim();
  if (!label) {
    window.alert('版本名称不能为空。');
    return;
  }
  const key = makeUserVersionKey(group);
  BASE.versions[group][key] = buildUserVersionOption(group, label);
  if (group === 'metal') {
    metalVersionLocks[key] = true;
  }
  state[group] = key;
  applyVersionPreset(group, key);
  persistUserVersions();
  renderVersions();
  queueRender();
}

function deleteUserVersion(group, key) {
  const option = BASE.versions?.[group]?.[key] || null;
  if (!option?.userCreated) return false;
  const label = versionOptionLabel(group, key) || key;
  const groupLabel = VERSION_GROUP_LABELS[group] || group;
  const confirmed = window.confirm(`确定删除${groupLabel}版本“${label}”吗？删除后不会影响内置版本。`);
  if (!confirmed) return false;

  const fallbackKey = resolveVersionFallbackKey(group, key);
  delete BASE.versions[group][key];
  if (group === 'metal') {
    delete metalVersionLocks[key];
  }

  if (state[group] === key) {
    state[group] = fallbackKey;
    if (fallbackKey) {
      applyVersionPreset(group, fallbackKey);
    }
  }

  if (group === 'connector') {
    connectorPricingState = sanitizeConnectorPricing(connectorPricingState, state.connector || DEFAULT_STATE.connector);
  }

  persistUserVersions();
  renderVersions();
  queueRender();
  return true;
}

function syncTemplateStateToVersion(option, patch = {}) {
  if (!option?.userCreated) return;
  const keys = Object.keys(patch);
  if (!keys.length) return;
  const nextRawInputs = clonePlain(option.templateRawInputs, {}) || {};
  let changed = false;
  keys.forEach((key) => {
    if (nextRawInputs[key] === patch[key]) return;
    nextRawInputs[key] = patch[key];
    changed = true;
  });
  if (!changed && option.templateRawInputs) return;
  option.templateRawInputs = nextRawInputs;
  if (changed && option.templateWorkbookSnapshot) {
    option.templateWorkbookSnapshot = null;
  }
}

function syncActiveCustomVersionsFromInputs() {
  const activeBom = BASE.versions?.bom?.[state.bom];
  if (activeBom?.userCreated) {
    const draft = currentBomDraftSnapshot();
    activeBom.draft = draft;
    syncTemplateStateToVersion(activeBom, draft);
  }
  const activeLabor = BASE.versions?.labor?.[state.labor];
  if (activeLabor?.userCreated) {
    const draft = currentLaborDraftSnapshot();
    Object.assign(activeLabor, draft);
    syncTemplateStateToVersion(activeLabor, draft);
  }
  const activePackaging = BASE.versions?.packaging?.[state.packaging];
  if (activePackaging?.userCreated) {
    const draft = currentPackagingDraftSnapshot();
    Object.assign(activePackaging, draft);
    syncTemplateStateToVersion(activePackaging, draft);
  }
  const activeSales = BASE.versions?.sales?.[state.sales];
  if (activeSales?.userCreated) {
    const volumes = currentSalesDraftSnapshot();
    activeSales.volumes = volumes;
    syncTemplateStateToVersion(activeSales, BASE.years.reduce((acc, year, index) => {
      acc[`sales_${year}`] = volumes[index];
      return acc;
    }, {}));
  }
  const activeMix = BASE.versions?.mix?.[state.mix];
  if (activeMix?.userCreated) {
    const values = currentMixDraftSnapshot();
    activeMix.values = values;
    syncTemplateStateToVersion(activeMix, BASE.configNames.reduce((acc, _name, index) => {
      acc[`mix_${index}`] = values[index];
      return acc;
    }, {}));
  }
  persistUserVersions();
}

function syncActiveConnectorCustomVersion() {
  const option = BASE.versions?.connector?.[state.connector];
  if (!option?.userCreated) return;
  option.overrides = { ...connectorPricingState };
  persistUserVersions();
}

function prepareMetalVersions() {
  Object.values(BASE.versions?.metal || {}).forEach((version) => {
    if (!version) return;
    if (!version.seedSourceNote) {
      version.seedSourceNote = version.sourceNote || '来源：g281_data_master.json 铜铝基价预设。';
    }
    if (typeof version.manualManaged !== 'boolean') {
      version.manualManaged = false;
    }
  });
}

function ensureMetalVersionLocks() {
  Object.keys(BASE.versions?.metal || {}).forEach((key) => {
    if (!(key in metalVersionLocks)) {
      metalVersionLocks[key] = true;
    }
  });
}

function setMetalVersionValues(versionKey, patch = {}, options = {}) {
  const version = BASE.versions?.metal?.[versionKey];
  if (!version) return;
  const nextCopper = Number(patch.copperPrice);
  const nextAluminum = Number(patch.aluminumPrice);
  if (patch.copperPrice !== undefined && Number.isFinite(nextCopper)) {
    version.copperPrice = nextCopper;
  }
  if (patch.aluminumPrice !== undefined && Number.isFinite(nextAluminum)) {
    version.aluminumPrice = nextAluminum;
  }
  if (options.manualManaged) {
    version.manualManaged = true;
  }
}

function metalVersionSnapshot(versionKey) {
  const version = BASE.versions.metal?.[versionKey];
  if (!version) return null;
  return {
    key: versionKey,
    label: version.label || versionOptionLabel('metal', versionKey),
    copperPrice: Number(version.copperPrice ?? BASE.copperPrice) || 0,
    aluminumPrice: Number(version.aluminumPrice ?? BASE.aluminumPrice) || 0,
    manualManaged: Boolean(version.manualManaged),
    sourceNote: version.manualManaged ? '来源：左侧版本价维护。' : (version.seedSourceNote || version.sourceNote || '来源：g281_data_master.json 铜铝基价预设。'),
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

function renderMetalVersionEditor() {
  if (!el.metalVersionEditor) return;
  ensureMetalVersionLocks();
  const entries = orderedVersionEntries('metal', BASE.versions?.metal || {});
  el.metalVersionEditor.innerHTML = entries.map(([key]) => {
    const snapshot = metalVersionSnapshot(key);
    if (!snapshot) return '';
    const locked = metalVersionLocks[key] !== false;
    const active = state.metal === key;
    const stateText = active ? '当前生效' : '待切换';
    const lockText = locked ? '已锁定' : '编辑中';
    return `
      <div class="metal-version-row${active ? ' active' : ''}">
        <div class="metal-version-row-head">
          <div class="metal-version-meta">
            <span class="metal-version-badge">${escapeHtml(snapshot.label)}</span>
            <span class="metal-version-state">${escapeHtml(stateText)}</span>
          </div>
          <button class="metal-lock-toggle${locked ? '' : ' is-unlocked'}" type="button" data-metal-lock="${escapeHtml(key)}">${escapeHtml(lockText)}</button>
        </div>
        <div class="metal-version-grid">
          <label class="metal-version-field">
            <span>铜价（元/吨）</span>
            <input data-metal-key="${escapeHtml(key)}" data-metal-field="copperPrice" type="number" step="100" min="50000" max="100000" value="${snapshot.copperPrice}" ${locked ? 'readonly' : ''} />
          </label>
          <label class="metal-version-field">
            <span>铝价（元/吨）</span>
            <input data-metal-key="${escapeHtml(key)}" data-metal-field="aluminumPrice" type="number" step="100" min="12000" max="30000" value="${snapshot.aluminumPrice}" ${locked ? 'readonly' : ''} />
          </label>
        </div>
        <div class="metal-version-source">${escapeHtml(snapshot.sourceNote)}</div>
      </div>
    `;
  }).join('');
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

function salesVersionAsp(versionKey) {
  const version = BASE.versions.sales?.[versionKey];
  if (Array.isArray(version?.asp) && version.asp.length) {
    return version.asp.map((value) => Number(value) || 0);
  }
  const financialSeries = FINANCIAL_VERSIONS?.versions?.[versionKey]?.asp;
  if (Array.isArray(financialSeries) && financialSeries.length) {
    return financialSeries.map((value) => Number(value) || 0);
  }
  return Array.isArray(BASE.asp) ? BASE.asp.slice() : [];
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
  const option = BASE.versions?.bom?.[versionKey] || {};
  if (option.userCreated) {
    return {
      kind: option.kind || 'custom',
      label: option.label || `${versionOptionLabel('bom', versionKey)}BOM`,
      materialFactor: Number.isFinite(Number(option.factor)) ? Number(option.factor) : 1,
      wireFactor: Number.isFinite(Number(option.wireFactor)) ? Number(option.wireFactor) : 1,
      draft: option.draft || null,
      workbook: option.workbook || '',
      totalMeter: Number(option.totalMeter) || 0,
      wireMeter: Number(option.wireMeter) || 0,
      tapeMeter: Number(option.tapeMeter) || 0,
      tubeMeter: Number(option.tubeMeter) || 0,
      actualLengthChangeSummary: option.actualLengthChangeSummary || null,
      sourceNote: option.sourceNote || '',
    };
  }
  const keyMap = {
    freeze: 'quote',
    light: 'fixed',
    regress: 'tt',
  };
  const snapshotKey = keyMap[versionKey];
  const snapshot = snapshotKey ? BOM_VERSIONS.versionSnapshots?.[snapshotKey] || null : null;
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
  if (snapshot.sourceNote) return snapshot.sourceNote;
  const summary = `导线 ${snapshot.wireMeter.toFixed(3)} m / 胶带 ${snapshot.tapeMeter.toFixed(3)} m / 套管 ${snapshot.tubeMeter.toFixed(3)} m / 材料系数 ${((snapshot.materialFactor - 1) * 100).toFixed(1)}%`;
  if (versionKey === 'regress' && snapshot.actualLengthChangeSummary) {
    const change = snapshot.actualLengthChangeSummary;
    return `来源：${snapshot.workbook || 'TT BOM'}《二次物料明细》+ 各线束页实际开线长度回填，${summary}，已回填 ${change.changedHarnessCount} 条线束 / ${change.changedRowCount} 处长度行。`;
  }
  return `来源：${snapshot.workbook || 'BOM 工作簿'}《二次物料明细》，${summary}。`;
}

function laborVersionSnapshot(versionKey) {
  const option = BASE.versions?.labor?.[versionKey] || {};
  if (option.userCreated || Object.prototype.hasOwnProperty.call(option, 'directHours')) {
    return {
      kind: option.kind || 'custom',
      label: option.label || `${versionOptionLabel('labor', versionKey)}工时`,
      directHours: option.directHours,
      directRate: option.directRate,
      manufacturingHours: option.manufacturingHours,
      manufacturingRate: option.manufacturingRate,
      sourceNote: option.sourceNote || '',
    };
  }
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
  if (snapshot.sourceNote) return snapshot.sourceNote;
  if (versionKey === 'base' || versionKey === 'optimize') {
    const directSource = snapshot.sources?.directHours || '';
    const manufacturingSource = snapshot.sources?.manufacturingHours || '';
    return `来源：${directSource}${manufacturingSource ? `；${manufacturingSource}` : ''}`;
  }
  return snapshot.sourceNote || '';
}

function packagingVersionSnapshot(versionKey) {
  const option = BASE.versions?.packaging?.[versionKey] || {};
  if (option.userCreated || Object.prototype.hasOwnProperty.call(option, 'packInner')) {
    return {
      kind: option.kind || 'custom',
      label: option.label || `${versionOptionLabel('packaging', versionKey)}包装`,
      packInner: option.packInner,
      packFreight: option.packFreight,
      packWarehouse: option.packWarehouse,
      packOther: option.packOther,
      sourceNote: option.sourceNote || '',
    };
  }
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
  return '';
}

function annualDropVersionSourceText(versionKey) {
  const snapshot = annualDropVersionSnapshot(versionKey);
  if (!snapshot) return '';
  if (snapshot.sourceNote) return snapshot.sourceNote;
  return `来源：版本管理维护。${annualDropSnapshotSummary(snapshot)}。`;
  return `来源：版本管理维护。当前年降 ${fmtPct(snapshot.annualRate || 0)}。`;
}

function oneTimeCustomerVersionSourceText(versionKey) {
  const snapshot = oneTimeCustomerVersionSnapshot(versionKey);
  if (!snapshot) return '';
  if (snapshot.sourceNote) return snapshot.sourceNote;
  return `来源：版本管理维护。${oneTimeCustomerSnapshotSummary(snapshot)}。`;
  return `来源：版本管理维护。客户一次性费用 ${fmtMoney(snapshot.amountTotal || 0)} 元。`;
}

function rebateVersionSourceText(versionKey) {
  const snapshot = rebateVersionSnapshot(versionKey);
  if (!snapshot) return '';
  if (snapshot.sourceNote) return snapshot.sourceNote;
  return `来源：版本管理维护。${rebateSnapshotSummary(snapshot)}。`;
  return `来源：版本管理维护。返点 ${fmtMoney(snapshot.amountPerSet || 0)} 元/套。`;
}

function equipmentVersionSourceText(versionKey) {
  const snapshot = equipmentVersionSnapshot(versionKey);
  const option = BASE.versions?.equipment?.[versionKey] || {};
  if (snapshot?.sourceNote) {
    return snapshot.sourceNote;
  }
  if (option.userCreated && ['equipment', 'tooling', 'fixtures', 'rnd'].some((key) => option[key] !== undefined && option[key] !== null && option[key] !== '')) {
    return `来源：离线模板版本。设备 ${fmtMoney(snapshot?.equipment || 0)} 元 / 模具 ${fmtMoney(snapshot?.tooling || 0)} 元 / 工装 ${fmtMoney(snapshot?.fixtures || 0)} 元 / 研发 ${fmtMoney(snapshot?.rnd || 0)} 元。`;
  }
  if (option.userCreated) {
    return option.sourceNote || `来源：离线新增版本，当前设备投资系数 ${fmtNumber(Number(option.factor) || 1, 3)}。`;
  }
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

function applyConnectorVersion(versionKey) {
  const option = BASE.versions?.connector?.[versionKey];
  if (option?.userCreated) {
    const sourceKey = connectorVersionSet.has(option.sourceKey) ? option.sourceKey : DEFAULT_STATE.connector;
    connectorPricingState = sanitizeConnectorPricing(option.overrides || {}, sourceKey);
    return;
  }
  connectorPricingState = sanitizeConnectorPricing(connectorPricingState, state.connector);
}

function applyVersionPreset(group, key) {
  if (group === 'bom') {
    applyBomVersion(key);
    dispatchDashboardVersionChange(group, key, {
      bomVersionKey: key,
      workbookVersionKey: resolveWorkbookVersionKeyFromBomState(key),
    });
    return;
  }
  if (group === 'metal') {
    applyMetalVersion(key);
    dispatchDashboardVersionChange(group, key);
    return;
  }
  if (group === 'connector') {
    applyConnectorVersion(key);
    dispatchDashboardVersionChange(group, key);
    return;
  }
  if (group === 'sales') {
    applySalesVersion(key);
    dispatchDashboardVersionChange(group, key);
    return;
  }
  if (group === 'mix') {
    applyMixVersion(key);
    dispatchDashboardVersionChange(group, key);
    return;
  }
  if (group === 'labor') {
    applyLaborVersion(key);
    dispatchDashboardVersionChange(group, key);
    return;
  }
  if (group === 'packaging') {
    applyPackagingVersion(key);
    dispatchDashboardVersionChange(group, key);
    return;
  }
  if (group === 'annualDrop' || group === 'oneTimeCustomer' || group === 'rebate' || group === 'equipment' || group === 'configSheet' || group === 'vave') {
    dispatchDashboardVersionChange(group, key);
    return;
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
  if (stageKey === 'fixed') return 'protocol';
  if (stageKey === 'quote') return 'sample';
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
  if (sourceCount && confirmed === sourceCount) return 'fixed';
  if (confirmed > 0) return 'progress';
  return 'quote';
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
  if (recommendedStage === 'fixed') {
    return '当前映射项已全部达成，可直接按定点版价格执行。';
  }
  if (recommendedStage === 'progress') {
    return '已达成部分按定点版执行，其余部分按报价版执行。';
  }
  if (protocolCount(summary, 'dev_pending')) {
    return '仍有开发中项，初始化先按报价版。';
  }
  if (protocolCount(summary, 'quoted_pending')) {
    return '仍有待确认项，初始化先按报价版。';
  }
  if (protocolCount(summary, 'no_reply')) {
    return '仍有暂无回复项，初始化先按报价版。';
  }
  return '按当前默认版本执行。';
}

function protocolProgressText(item) {
  const confirmedShare = Number(item?.progressMeta?.confirmedShare) || 0;
  const quoteShare = Number(item?.progressMeta?.quoteShare) || 0;
  if (!confirmedShare && !quoteShare) return '';
  return `定点覆盖 ${fmtPct(confirmedShare)} / 报价覆盖 ${fmtPct(quoteShare)}`;
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
  syncActiveConnectorCustomVersion();
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
  }, { fixed: 0, progress: 0, quote: 0 });
  const stats = [
    `协议范围 <strong>${summary.totalRows || 0}</strong> 项`,
    `已达成 <strong>${summary.confirmed || 0}</strong>`,
    `待确认 <strong>${summary.quotedPending || 0}</strong>`,
    `暂无回复 <strong>${summary.noReply || 0}</strong>`,
    `开发中 <strong>${summary.devPending || 0}</strong>`,
    `聚合建议定点版 <strong>${recommendationCounts.fixed || 0}</strong>`,
    `聚合建议进度价 <strong>${recommendationCounts.progress || 0}</strong>`,
    `聚合建议报价版 <strong>${recommendationCounts.quote || 0}</strong>`,
  ];
  stats[0] = `状态明细 <strong>${summary.totalRows || 0}</strong> 项`;
  el.connectorProtocolStats.innerHTML = stats.map((text) => `<span class="stat-pill">${text}</span>`).join('');
  const note = '初始化规则：同一聚合连接器下全部映射项已达成时切定点版；若已有部分达成则切进度价；若仍全部未达成，则先按报价版。下方明细按 Excel 平铺展示，初始报价直接取自当前导入报价核算表的“二次物料明细”，未匹配到对应总成时留空。';
  el.connectorProtocolHint.textContent = note;
  if (el.initConnectorProtocolBtn) {
    el.initConnectorProtocolBtn.disabled = !protocolPortfolios.length;
  }
}

function readDraft() {
  connectorPricingState = sanitizeConnectorPricing(connectorPricingState, state.connector);
  return { scenarioName: el.scenarioName.value.trim() || BASE.name, copperPrice: Number(controls.copperPrice.value) || 0, aluminumPrice: Number(controls.aluminumPrice.value) || 0, directHours: Number(controls.directHours.value) || 0, directRate: Number(controls.directRate.value) || 0, manufacturingHours: Number(controls.manufacturingHours.value) || 0, manufacturingRate: Number(controls.manufacturingRate.value) || 0, packInner: Number(controls.packInner.value) || 0, packFreight: Number(controls.packFreight.value) || 0, packWarehouse: Number(controls.packWarehouse.value) || 0, packOther: Number(controls.packOther.value) || 0, bomWireDrawing: Number(controls.bomWireDrawing.value) || 0, bomWireEat: Number(controls.bomWireEat.value) || 0, bomWireHidden: Number(controls.bomWireHidden.value) || 0, bomTapeDiameter: Number(controls.bomTapeDiameter.value) || 0, bomTapeWidth: Number(controls.bomTapeWidth.value) || 0, bomTapeOverlap: Number(controls.bomTapeOverlap.value) || 0, connectorPricing: { ...connectorPricingState }, mix: normalizeMix(mixInputs.map((input) => input.value)), volumes: yearInputs.map((input) => Math.max(0, Number(input.value) || 0)), asp: salesVersionAsp(state.sales) };
}
window.readDraft = readDraft;

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
  if (BASE.versions?.metal?.[state.metal]) {
    setMetalVersionValues(
      state.metal,
      {
        copperPrice: nextDraft.copperPrice,
        aluminumPrice: nextDraft.aluminumPrice,
      },
      {
        manualManaged: Object.prototype.hasOwnProperty.call(draft, 'copperPrice') || Object.prototype.hasOwnProperty.call(draft, 'aluminumPrice'),
      },
    );
  }
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

/*
function markDirty(){el.generateBtn.textContent='生成场景 · 待更新'}
function clearDirty(){el.generateBtn.textContent='生成场景'}

*/
function clearDirty(){el.generateBtn.textContent='\u751f\u6210\u573a\u666f'}

function renderScenarioHistorySelect() {
  if (!el.scenarioHistorySelect) return;
  const records = savedScenarioRecords();
  const selectedId = records.some((record) => (record.scenarioId || record.id) === lastSavedVersionId) ? lastSavedVersionId : '';
  const options = [
    '<option value="">当前场景（未保存）</option>',
    ...records.map((record) => {
      const recordId = record.scenarioId || record.id;
      const recordTime = record.updatedAt || record.createdAt;
      const label = `${record.name || record.scenarioName || recordId} · ${formatDateTime(recordTime)}`;
      return `<option value="${escapeHtml(recordId)}">${escapeHtml(label)}</option>`;
    }),
  ].join('');
  if (el.scenarioHistorySelect.innerHTML !== options) {
    el.scenarioHistorySelect.innerHTML = options;
  }
  el.scenarioHistorySelect.disabled = records.length === 0;
  el.scenarioHistorySelect.value = selectedId;
}

/*
function markDirty(){lastSavedVersionId=''; renderScenarioHistorySelect(); el.generateBtn.textContent='鐢熸垚鍦烘櫙 路 寰呮洿鏂?}

*/
function markDirty(){lastSavedVersionId=''; renderScenarioHistorySelect(); el.generateBtn.textContent='\u751f\u6210\u573a\u666f \u00b7 \u5f85\u66f4\u65b0'}

function fallbackTimelineTimestamp(group, key, option, groupIndex, orderIndex) {
  const direct = Date.parse(
    option?.updatedAt
    || option?.createdAt
    || option?.generatedAt
    || option?.effectiveAt
    || option?.effectiveDate
    || option?.publishedAt
    || ''
  );
  if (Number.isFinite(direct) && direct > 0) {
    return direct;
  }
  const baseTime = Date.parse(FINANCIAL_VERSIONS?.meta?.generatedAt || HISTORY_SEED[0]?.createdAt || new Date().toISOString()) || Date.now();
  const keyRank = Math.max(0, (VERSION_DISPLAY_ORDER[group] || []).indexOf(key));
  return baseTime - ((groupIndex + 1) * 6 + Math.max(orderIndex, keyRank, 0) * 2) * 3600 * 1000;
}

function collectVersionTimelineRows() {
  return TIMELINE_VERSION_GROUPS
    .map((group, groupIndex) => {
      const options = BASE.versions?.[group] || {};
      const events = orderedVersionEntries(group, options).map(([key, option], orderIndex) => ({
        key,
        label: option?.label || key,
        active: state[group] === key,
        timestamp: fallbackTimelineTimestamp(group, key, option, groupIndex, orderIndex),
        note: option?.sourceNote || option?.note || '',
      })).sort((left, right) => left.timestamp - right.timestamp);
      return {
        key: group,
        label: VERSION_GROUP_LABELS[group] || group,
        activeLabel: versionOptionLabel(group, state[group]) || state[group] || '-',
        events,
      };
    })
    .filter((row) => row.events.length);
}

function buildTimelineCurvePath(points) {
  if (!Array.isArray(points) || !points.length) return '';
  if (points.length === 1) {
    return `M ${points[0].left} ${points[0].trackTop}`;
  }
  let path = `M ${points[0].left} ${points[0].trackTop}`;
  for (let index = 0; index < points.length - 1; index += 1) {
    const p0 = points[index - 1] || points[index];
    const p1 = points[index];
    const p2 = points[index + 1];
    const p3 = points[index + 2] || p2;
    const c1x = p1.left + ((p2.left - p0.left) / 6);
    const c1y = p1.trackTop + ((p2.trackTop - p0.trackTop) / 6);
    const c2x = p2.left - ((p3.left - p1.left) / 6);
    const c2y = p2.trackTop - ((p3.trackTop - p1.trackTop) / 6);
    path += ` C ${c1x} ${c1y}, ${c2x} ${c2y}, ${p2.left} ${p2.trackTop}`;
  }
  return path;
}

function renderVersionTimeline() {
  if (!el.versionTimelineMount) return;
  const rows = collectVersionTimelineRows();
  const timestamps = rows.flatMap((row) => row.events.map((event) => event.timestamp));
  if (!timestamps.length) {
    el.versionTimelineMount.innerHTML = '<div class="timeline-empty">暂无版本时间线数据。</div>';
    return;
  }
  const min = Math.min(...timestamps);
  const max = Math.max(...timestamps);
  const span = Math.max(max - min, 1);
  el.versionTimelineMount.innerHTML = rows.map((row) => `
    <section class="timeline-group">
      <div class="timeline-group-label">
        <strong>${escapeHtml(row.label)}</strong>
        <span>当前：${escapeHtml(row.activeLabel)}</span>
      </div>
      <div class="timeline-track">
        ${row.events.map((event) => {
          const left = span <= 1 ? 50 : clamp(((event.timestamp - min) / span) * 100, 2, 98);
          const timeText = new Date(event.timestamp).toLocaleString('zh-CN', {
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
          });
          return `
            <div class="timeline-node${event.active ? ' is-active' : ''}" style="left:${left}%">
              <span class="timeline-node-dot"></span>
              <div class="timeline-node-card" title="${escapeHtml(event.note || event.label)}">
                <strong>${escapeHtml(event.label)}</strong>
                <span>${escapeHtml(timeText)}</span>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    </section>
  `).join('');
}


function syncManagementButtonLabels() {
  syncManagementButtonLabel(document.getElementById('openBomValidationBtn'), 'BOM \u7ba1\u7406');
  syncManagementButtonLabel(document.getElementById('openConfigSheetManagerBtn'), '配置清单管理');
  syncManagementButtonLabel(document.getElementById('openCapitalValidationBtn'), '\u8d44\u6e90\u6295\u5165\u7ba1\u7406');
  syncManagementButtonLabel(document.getElementById('openLaborValidationBtn'), '\u5de5\u65f6\u7ba1\u7406');
  syncManagementButtonLabel(document.getElementById('openPackagingValidationBtn'), '\u5305\u88c5\u7269\u6d41\u7ba1\u7406');
  syncManagementButtonLabel(document.getElementById('openAnnualDropManagerBtn'), '\u5e74\u964d\u7ba1\u7406');
  syncManagementButtonLabel(document.getElementById('openOneTimeCustomerManagerBtn'), '\u4e00\u6b21\u6027\u8d39\u7528\u7ba1\u7406');
  syncManagementButtonLabel(document.getElementById('openRebateManagerBtn'), '\u8fd4\u70b9\u7ba1\u7406');
  syncManagementButtonLabel(document.getElementById('openFactoryEfficiencyBtn'), '\u5de5\u5382\u6548\u7387 / \u8fd0\u8425\u8d39\u7387');
}

function scheduleManagementButtonSync() {
  syncManagementButtonLabels();
  window.setTimeout(syncManagementButtonLabels, 0);
  window.setTimeout(syncManagementButtonLabels, 120);
}
if (document.readyState === 'complete') {
  scheduleManagementButtonSync();
} else {
  window.addEventListener('load', scheduleManagementButtonSync, { once: true });
}

function collectVersionTimelineEvents() {
  return TIMELINE_VERSION_GROUPS
    .flatMap((group, groupIndex) => {
      const options = BASE.versions?.[group] || {};
      return orderedVersionEntries(group, options).map(([key, option], orderIndex) => ({
        id: `${group}:${key}`,
        group,
        groupLabel: VERSION_GROUP_LABELS[group] || group,
        key,
        label: option?.label || key,
        active: state[group] === key,
        timestamp: fallbackTimelineTimestamp(group, key, option, groupIndex, orderIndex),
        note: option?.sourceNote || option?.note || '',
      }));
    })
    .sort((left, right) => {
      if (left.timestamp !== right.timestamp) {
        return left.timestamp - right.timestamp;
      }
      return String(left.id).localeCompare(String(right.id));
      });
}

function timelineColumnCount(eventCount, mountWidth) {
  if (eventCount <= 1) return 1;
  if (mountWidth >= 1500) return Math.min(11, eventCount);
  if (mountWidth >= 1220) return Math.min(10, eventCount);
  if (mountWidth >= 880) return Math.min(8, eventCount);
  if (mountWidth >= 640) return Math.min(7, eventCount);
  return Math.min(6, eventCount);
}

function formatTimelineStamp(timestamp) {
  return new Date(timestamp).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatTimelineDay(timestamp) {
  return new Date(timestamp).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
  });
}

function formatTimelineMiniStamp(timestamp) {
  return new Date(timestamp).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function shortTimelineGroupLabel(group, fallback) {
  const labels = {
    bom: 'BOM',
    metal: '铜铝',
    connector: '连接器',
    labor: '工时',
    equipment: '资源',
    packaging: '包装',
    annualDrop: '年降',
    oneTimeCustomer: '一次费',
    rebate: '返点',
    vave: 'VAVE',
  };
  return labels[group] || fallback || group;
}

function shortTimelineVersionLabel(label) {
  const text = String(label || '').trim();
  if (!text) return '';
  if (text.includes('TT')) return 'TT';
  if (text.includes('定点')) return '定点';
  if (text.includes('报价')) return '报价';
  if (text.includes('基准')) return '基准';
  return text.replace(/版|版本/g, '').trim().slice(0, 4) || text.slice(0, 4);
}

function compactTimelineEventLabel(event) {
  const group = shortTimelineGroupLabel(event.group, event.groupLabel);
  const version = shortTimelineVersionLabel(event.label);
  return version ? `${group}·${version}` : group;
}

function renderVersionTimeline() {
  if (!el.versionTimelineMount) return;
  const events = collectVersionTimelineEvents();
  if (!events.length) {
    el.versionTimelineMount.innerHTML = '<div class="timeline-empty">\u6682\u65e0\u7248\u672c\u65f6\u95f4\u7ebf\u6570\u636e\u3002</div>';
    return;
  }
  const mountWidth = Math.max(el.versionTimelineMount.clientWidth || 0, 560);
  const columns = timelineColumnCount(events.length, mountWidth);
  const rowHeight = columns >= 7 ? 44 : 48;
  const trackTop = 10;
  const labelTop = 15;
  const canvasHeight = Math.ceil(events.length / columns) * rowHeight + 2;
  const positionedEvents = events.map((event, index) => {
    const row = Math.floor(index / columns);
    const indexInRow = index % columns;
    const reverse = row % 2 === 1;
    const column = reverse ? columns - 1 - indexInRow : indexInRow;
    const left = columns === 1 ? 50 : 4 + (column * (92 / (columns - 1)));
    return {
      ...event,
      left,
      trackTop: row * rowHeight + trackTop,
      labelTop: row * rowHeight + labelTop,
    };
  });
  const linePath = buildTimelineCurvePath(positionedEvents);
  el.versionTimelineMount.innerHTML = `
    <section class="timeline-snake" aria-label="\u65f6\u95f4\u7ebf">
      <div class="timeline-canvas" style="height:${canvasHeight}px">
        <svg class="timeline-snake-svg" viewBox="0 0 100 ${canvasHeight}" preserveAspectRatio="none" aria-hidden="true">
          <path class="timeline-snake-line" d="${linePath}"></path>
        </svg>
        ${positionedEvents.map((event) => `
          <span class="timeline-event-dot${event.active ? ' is-active' : ''}" style="left:${event.left}%; top:${event.trackTop}px"></span>
          <span class="timeline-event${event.active ? ' is-active' : ''}" style="left:${event.left}%; top:${event.labelTop}px" title="${escapeHtml(`${event.groupLabel} / ${event.label} / ${formatTimelineStamp(event.timestamp)}${event.note ? ` / ${event.note}` : ''}`)}">
            <span class="timeline-event-label">${escapeHtml(compactTimelineEventLabel(event))}</span>
            <span class="timeline-event-time">${escapeHtml(formatTimelineMiniStamp(event.timestamp))}</span>
          </span>
        `).join('')}
      </div>
    </section>
  `;
}

function setVersionTimelineDrawerOpen(open) {
  if (!el.versionTimelineDrawer) return;
  if (versionTimelineCloseTimer) {
    window.clearTimeout(versionTimelineCloseTimer);
    versionTimelineCloseTimer = null;
  }
  if (open) {
    versionTimelineLastFocused = document.activeElement;
    el.versionTimelineDrawer.hidden = false;
    el.versionTimelineDrawer.setAttribute('aria-hidden', 'false');
    el.versionTimelineDrawer.classList.add('is-open');
    window.requestAnimationFrame(() => {
      renderVersionTimeline();
      el.closeVersionTimelineBtn?.focus();
    });
    return;
  }
  el.versionTimelineDrawer.classList.remove('is-open');
  el.versionTimelineDrawer.setAttribute('aria-hidden', 'true');
  versionTimelineCloseTimer = window.setTimeout(() => {
    if (el.versionTimelineDrawer && !el.versionTimelineDrawer.classList.contains('is-open')) {
      el.versionTimelineDrawer.hidden = true;
    }
    versionTimelineCloseTimer = null;
  }, 280);
  if (versionTimelineLastFocused && typeof versionTimelineLastFocused.focus === 'function') {
    window.requestAnimationFrame(() => versionTimelineLastFocused.focus());
  }
}

// ── 看板：场景管理 ──
function renderKanbanScenario(m) {
  const mount = document.getElementById('kanbanScenarioBody');
  if (!mount) return;
  const factoryOptions = Object.keys(FACTORY_RATE_TABLE).map((key) => {
    const sel = key === state.factory ? ' selected' : '';
    return `<option value="${escapeHtml(key)}"${sel}>${escapeHtml(FACTORY_RATE_TABLE[key].label)}</option>`;
  }).join('');
  const tags = [
    `BOM ${m.bom.label}`, `铜铝 ${m.metal.label}`, `连接器 ${m.conn.label}`,
    `工时 ${m.labor.label}`, `资源投入 ${m.equip.label}`, `包装 ${m.pack.label}`,
  ].map((t) => `<span class="chip">${escapeHtml(t)}</span>`).join('');
  mount.innerHTML = `
    <div class="kanban-stat-row">
      <span class="kanban-stat-label">工厂</span>
      <select id="kanbanFactorySelect" style="font-size:10px;padding:2px 4px;border-radius:5px;border:1px solid #cbd5e1">${factoryOptions}</select>
      <span class="kanban-stat-sep">·</span>
      <span class="kanban-stat-label">效率</span>
      <span class="kanban-stat-value">${(state.productionEfficiency * 100).toFixed(0)}%</span>
    </div>
    <div style="display:flex;flex-wrap:wrap;gap:3px;margin-top:2px">${tags}</div>
  `;
  const factorySelect = document.getElementById('kanbanFactorySelect');
  if (factorySelect && !factorySelect.dataset.bound) {
    factorySelect.dataset.bound = 'true';
    factorySelect.addEventListener('change', () => {
      state.factory = factorySelect.value;
      queueRender();
    });
  }
}

// ── 看板：价格管理 ──
function renderKanbanPrice(m) {
  const mount = document.getElementById('kanbanPriceBody');
  if (!mount) return;
  const copperPrice = Number(m?.d?.copperPrice) || 0;
  const aluminumPrice = Number(m?.d?.aluminumPrice) || 0;
  const baseCopperPrice = Number(BASE.copperPrice) || 1;
  const baseAluminumPrice = Number(BASE.aluminumPrice) || 1;
  const copperFactor = (1 + ((copperPrice - baseCopperPrice) / baseCopperPrice) * 0.65).toFixed(4);
  const aluminumFactor = (1 + ((aluminumPrice - baseAluminumPrice) / baseAluminumPrice) * 0.45).toFixed(4);
  const connCost = fmtMoney(m?.connectorSummary?.totalCurrentCost || 0);
  const connOverride = m?.connectorSummary?.overrideCount || 0;
  const packTotal = fmtMoney(Number(m?.packaging) || 0);
  const factoryKey = state.factory || 'K3';
  const factoryRate = FACTORY_RATE_TABLE[factoryKey] || FACTORY_RATE_TABLE['K3'];
  const directHours = Number(m?.d?.directHours) || 0;
  const mfgHours = Number(m?.d?.manufacturingHours) || 0;
  const factoryRows = Object.entries(FACTORY_RATE_TABLE).map(([key, r]) => {
    const active = key === factoryKey ? ' class="is-active"' : '';
    return `<tr${active}><td>${escapeHtml(r.label)}</td><td>${r.directRate.toFixed(2)}</td><td>${r.mfgRate.toFixed(2)}</td></tr>`;
  }).join('');

  mount.innerHTML = `
    <div class="kanban-formula">
      <div class="kanban-formula-label">铜铝基价</div>
      <div class="kanban-formula-expr">材料成本 = 基准材料 × (0.38×铜价系数 + 0.18×铝价系数 + 0.24×连接器系数 + 0.20)
铜价系数 = 1 + (铜价 - ${fmtMoney(baseCopperPrice, 0)}) / ${fmtMoney(baseCopperPrice, 0)} × 0.65 = ${copperFactor}
铝价系数 = 1 + (铝价 - ${fmtMoney(baseAluminumPrice, 0)}) / ${fmtMoney(baseAluminumPrice, 0)} × 0.45 = ${aluminumFactor}</div>
      <div class="kanban-stat-row">
        <span class="kanban-stat-label">铜价</span>
        <span class="kanban-stat-value">${fmtMoney(copperPrice, 0)} 元/吨</span>
        <span class="kanban-stat-sep">·</span>
        <span class="kanban-stat-label">铝价</span>
        <span class="kanban-stat-value">${fmtMoney(aluminumPrice, 0)} 元/吨</span>
        <span class="kanban-stat-sep">·</span>
        <span class="kanban-stat-label">材料</span>
        <span class="kanban-stat-value">${fmtMoney(m?.material || 0)} 元/套</span>
      </div>
    </div>
    <div class="kanban-formula">
      <div class="kanban-formula-label">连接器价格</div>
      <div class="kanban-formula-expr">连接器成本 = 基准连接器成本 × 执行系数</div>
      <div class="kanban-stat-row">
        <span class="kanban-stat-label">${escapeHtml(m?.conn?.label || '')}</span>
        <span class="kanban-stat-sep">·</span>
        <span class="kanban-stat-label">覆盖 ${connOverride} 项</span>
        <span class="kanban-stat-sep">·</span>
        <span class="kanban-stat-value">${connCost} 元/套</span>
      </div>
    </div>
    <div class="kanban-formula">
      <div class="kanban-formula-label">包装物流</div>
      <div class="kanban-formula-expr">包装成本 = 内外包装 + 运输费 + 仓储费 + 短驳/其他</div>
      <div class="kanban-stat-row">
        <span class="kanban-stat-label">合计</span>
        <span class="kanban-stat-value">${packTotal} 元/套</span>
        <span class="kanban-stat-sep">·</span>
        <span class="kanban-stat-label">${escapeHtml(m?.pack?.label || '')}</span>
      </div>
    </div>
    <div class="kanban-formula">
      <div class="kanban-formula-label">运营工时费率（按工厂分列）</div>
      <div class="kanban-formula-expr">直接人工 = ${directHours.toFixed(4)}h × ${factoryRate.directRate.toFixed(2)}元/h = ${fmtMoney(directHours * factoryRate.directRate)} 元/套
制造费用 = ${mfgHours.toFixed(4)}h × ${factoryRate.mfgRate.toFixed(2)}元/h = ${fmtMoney(mfgHours * factoryRate.mfgRate)} 元/套</div>
      <table class="factory-rate-table">
        <thead><tr><th>工厂</th><th>直接人工(元/h)</th><th>制造费率(元/h)</th></tr></thead>
        <tbody>${factoryRows}</tbody>
      </table>
    </div>
    <div class="kanban-formula">
      <div class="kanban-formula-label">年降 / 返点 / 一次性费用</div>
      <div class="kanban-stat-row">
        <span class="kanban-stat-label">年降</span>
        <span class="kanban-stat-value">${escapeHtml(m?.annualDrop?.label || '-')}</span>
        <span class="kanban-stat-sep">·</span>
        <span class="kanban-stat-label">返点</span>
        <span class="kanban-stat-value">${escapeHtml(m?.rebate?.label || '-')}</span>
        <span class="kanban-stat-sep">·</span>
        <span class="kanban-stat-label">一次性</span>
        <span class="kanban-stat-value">${escapeHtml(m?.oneTimeCustomer?.label || '-')}</span>
      </div>
    </div>
  `;
}

// ── 看板：数据管理 ──
function renderKanbanData(m) {
  const mount = document.getElementById('kanbanDataBody');
  if (!mount) return;
  const rows = [
    ['BOM版本', m?.bom?.label || versionOptionLabel('bom', state.bom), bomVersionSourceText(state.bom)],
    ['配置清单', versionOptionLabel('configSheet', state.configSheet), configSheetVersionSourceText(state.configSheet)],
    ['工时版本', m?.labor?.label || versionOptionLabel('labor', state.labor), `前工程 ${Number(m?.d?.directHours || 0).toFixed(4)}h × ${Number(m?.d?.directRate || 0).toFixed(1)}元/h · 后工程 ${Number(m?.d?.manufacturingHours || 0).toFixed(4)}h × ${Number(m?.d?.manufacturingRate || 0).toFixed(1)}元/h`],
    ['资源投入', m?.equip?.label || versionOptionLabel('equipment', state.equipment), `设备 ${fmtMoney(m?.capitalBreakdown?.equipment || 0)} · 模具 ${fmtMoney(m?.capitalBreakdown?.tooling || 0)} · 工装 ${fmtMoney(m?.capitalBreakdown?.fixtures || 0)} · 研发 ${fmtMoney(m?.capitalBreakdown?.rnd || 0)}`],
    ['包装物流', m?.pack?.label || versionOptionLabel('packaging', state.packaging), `内外包装 ${fmtMoney(m?.d?.packInner || 0)} · 运输 ${fmtMoney(m?.d?.packFreight || 0)} · 仓储 ${fmtMoney(m?.d?.packWarehouse || 0)} · 短驳 ${fmtMoney(m?.d?.packOther || 0)}`],
  ];
  const rowsHtml = rows.map(([label, val, meta]) => `
    <div class="kanban-stat-row">
      <span class="kanban-stat-label">${escapeHtml(label)}</span>
      <span class="kanban-stat-value">${escapeHtml(val || '-')}</span>
      <span class="kanban-stat-sep">·</span>
      <span class="kanban-stat-label" style="font-size:8px;color:#64748b">${escapeHtml(meta || '')}</span>
    </div>
  `).join('');
  const effVal = (state.productionEfficiency * 100).toFixed(0);
  mount.innerHTML = `
    ${rowsHtml}
    <div class="kanban-stat-row" style="margin-top:4px">
      <span class="kanban-stat-label">生产效率</span>
      <input id="kanbanEfficiencyInput" type="number" min="50" max="100" step="1" value="${effVal}" style="width:50px;font-size:10px;padding:2px 4px;border-radius:5px;border:1px solid #cbd5e1;text-align:center" />
      <span class="kanban-stat-label">%（K3工厂基准效率，影响工时费率折算）</span>
    </div>
  `;
  const effInput = document.getElementById('kanbanEfficiencyInput');
  if (effInput && !effInput.dataset.bound) {
    effInput.dataset.bound = 'true';
    effInput.addEventListener('input', () => {
      const val = Math.max(0.5, Math.min(1, (Number(effInput.value) || 90) / 100));
      state.productionEfficiency = val;
      try { window.localStorage?.setItem('g281.productionEfficiency.v1', String(val)); } catch (e) {}
    });
  }
}

// ── 看板：变更管理 ──
function renderKanbanChange(m) {
  const mount = document.getElementById('kanbanChangeBody');
  if (!mount) return;
  const bomSummary = m?.bomSummary || window.G281Engine?.summarizeBomChanges?.(BOM_CHANGE_ROWS) || {};
  const replaceCount = bomSummary.replaceCount || 0;
  const addCount = bomSummary.addCount || 0;
  const cancelCount = bomSummary.cancelCount || 0;
  const obsoleteValue = Number(bomSummary.obsoleteValue) || 0;
  const equipDelta = Number(bomSummary.equipmentDelta) || 0;
  const laborDelta = Number(bomSummary.laborDelta) || 0;
  const packDelta = Number(bomSummary.packagingDelta) || 0;
  const ca = changeAssessment;
  const devTotal = (Number(ca.dev.dvCost) || 0) + (Number(ca.dev.pvCost) || 0);
  const processTooling = (Number(ca.process.newToolingCost) || 0) + (Number(ca.process.obsoleteToolingCost) || 0);
  const processEquip = (Number(ca.process.newEquipment) || 0) + (Number(ca.process.obsoleteEquipment) || 0);
  const qualityTotal = (Number(ca.quality.newFixtures) || 0) + (Number(ca.quality.obsoleteFixtures) || 0);
  const logisticsTotal = (Number(ca.logistics.obsoleteMaterialFactory) || 0) + (Number(ca.logistics.obsoleteMaterialSupplier) || 0) + (Number(ca.logistics.obsoleteMaterialCustomer) || 0) + (Number(ca.logistics.obsoleteMaterialTransit) || 0) + (Number(ca.logistics.obsoleteWip) || 0) + (Number(ca.logistics.obsoleteFinished) || 0);
  const oneTimeTotal = devTotal + processTooling + processEquip + qualityTotal + logisticsTotal + obsoleteValue;
  const remainVol = Number(ca.remainingVolume) || Number(m?.totalVolume) || 600000;
  const perSetAlloc = remainVol > 0 ? oneTimeTotal / remainVol : 0;
  const materialDelta = (Number(m?.material) || 0) - (Number(BASE.baseMaterial) || 0);

  function caField(path, label, w) {
    const parts = path.split('.');
    const val = parts.reduce((o, k) => o?.[k], ca) || 0;
    return `<label class="field" style="flex:1 1 ${w || '80px'}"><span>${escapeHtml(label)}</span><input type="number" step="1" value="${Number(val) || 0}" data-ca-path="${escapeHtml(path)}" class="ca-input" /></label>`;
  }

  mount.innerHTML = `
    <div class="change-bom-stats">
      <span class="change-bom-stat">替换 <strong>${replaceCount}</strong></span>
      <span class="change-bom-stat">新增 <strong>${addCount}</strong></span>
      <span class="change-bom-stat">取消 <strong>${cancelCount}</strong></span>
      <span class="change-bom-stat">呆滞 <strong>${fmtMoney(obsoleteValue)}</strong> 元</span>
      <span class="change-bom-stat">设备Δ <strong>${fmtSignedMoney(equipDelta)}</strong></span>
      <span class="change-bom-stat">工时Δ <strong>${fmtSignedMoney(laborDelta)}</strong></span>
      <span class="change-bom-stat">包装Δ <strong>${fmtSignedMoney(packDelta)}</strong></span>
    </div>

    <div class="change-dept-block">
      <div class="change-dept-title">开发</div>
      <div class="change-formula-row">
        <span class="change-formula-eq">试验费 =</span>
        ${caField('dev.dvCost', 'DV试验费', '90px')}
        <span class="change-formula-eq">+</span>
        ${caField('dev.pvCost', 'PV试验费', '90px')}
        <span class="change-formula-eq">=</span>
        <span class="change-formula-total">${fmtMoney(devTotal)} 元</span>
      </div>
    </div>

    <div class="change-dept-block">
      <div class="change-dept-title">工艺</div>
      <div class="change-formula-row">
        <span class="change-formula-eq">新增工装 =</span>
        ${caField('process.newToolingCost', '新增工装费', '90px')}
        <span class="change-formula-eq">呆滞工装 =</span>
        ${caField('process.obsoleteToolingCost', '呆滞工装费', '90px')}
      </div>
      <div class="change-formula-row">
        <span class="change-formula-eq">新增设备 =</span>
        ${caField('process.newEquipment', '新增公用设备', '90px')}
        <span class="change-formula-eq">呆滞设备 =</span>
        ${caField('process.obsoleteEquipment', '呆滞公用设备', '90px')}
      </div>
      <div class="change-formula-row">
        <span class="change-formula-eq">工时变化 =</span>
        ${caField('process.newLaborHours', '新工时(h)', '70px')}
        <span class="change-formula-eq">× 费率 = ${fmtMoney((Number(ca.process.newLaborHours) || 0) * (Number(m?.d?.directRate) || 35))} 元</span>
      </div>
    </div>

    <div class="change-dept-block">
      <div class="change-dept-title">质量</div>
      <div class="change-formula-row">
        <span class="change-formula-eq">检具变化 =</span>
        ${caField('quality.newFixtures', '新增检具', '90px')}
        <span class="change-formula-eq">-</span>
        ${caField('quality.obsoleteFixtures', '呆滞检具残值', '90px')}
        <span class="change-formula-eq">=</span>
        <span class="change-formula-total">${fmtMoney(qualityTotal)} 元</span>
      </div>
    </div>

    <div class="change-dept-block">
      <div class="change-dept-title">计划物流</div>
      <div class="change-formula-row">
        ${caField('logistics.obsoleteMaterialFactory', '厂内呆滞', '70px')}
        ${caField('logistics.obsoleteMaterialSupplier', '供应商处', '70px')}
        ${caField('logistics.obsoleteMaterialCustomer', '客户处', '70px')}
        ${caField('logistics.obsoleteMaterialTransit', '在途', '70px')}
      </div>
      <div class="change-formula-row">
        ${caField('logistics.obsoleteWip', '呆滞半成品', '90px')}
        ${caField('logistics.obsoleteFinished', '呆滞成品', '90px')}
        <span class="change-formula-eq">= 合计</span>
        <span class="change-formula-total">${fmtMoney(logisticsTotal)} 元</span>
      </div>
    </div>

    <div class="change-quote-result">
      <div class="change-quote-title">变更报价计算</div>
      <div class="change-quote-row">
        <span class="change-quote-eq">线束售价变化（单套Δ）= 材料Δ ${fmtSignedMoney(materialDelta)} + 工时Δ ${fmtSignedMoney(laborDelta)} =</span>
        <span class="change-quote-value">${fmtSignedMoney(materialDelta + laborDelta)} 元/套</span>
      </div>
      <div class="change-quote-row">
        <span class="change-quote-eq">一次性费用合计 =</span>
        <span class="change-quote-value">${fmtMoney(oneTimeTotal)} 元</span>
      </div>
      <div class="change-quote-row">
        <span class="change-quote-eq">单套分摊 = ${fmtMoney(oneTimeTotal)} /</span>
        <label class="field" style="flex:0 0 90px;margin:0"><span>剩余销量</span><input type="number" step="1000" value="${remainVol}" data-ca-path="remainingVolume" class="ca-input" style="font-size:10px;padding:2px 4px;height:20px" /></label>
        <span class="change-quote-eq">=</span>
        <span class="change-quote-value">${fmtMoney(perSetAlloc)} 元/套</span>
      </div>
    </div>
  `;

  // 绑定所有 ca-input 事件
  if (!mount.dataset.caBound) {
    mount.dataset.caBound = 'true';
    mount.addEventListener('input', (event) => {
      const input = event.target.closest('.ca-input');
      if (!input) return;
      const path = input.dataset.caPath;
      if (!path) return;
      const parts = path.split('.');
      let target = changeAssessment;
      for (let i = 0; i < parts.length - 1; i++) {
        if (!target[parts[i]]) target[parts[i]] = {};
        target = target[parts[i]];
      }
      target[parts[parts.length - 1]] = Number(input.value) || 0;
      saveChangeAssessment(changeAssessment);
      // 重新渲染变更模块以更新计算结果
      renderKanbanChange(window._g281LastModel || m);
    });
  }
}

// ── 看板总调度 ──
function renderDataManagementOverview(m) {
  syncManagementButtonLabels();
  renderKanbanScenario(m);
  renderKanbanPrice(m);
  renderKanbanData(m);
  renderKanbanChange(m);
}

function renderWorkspaceContextShell(m) {
  const quoteMeta = currentQuoteTypeMeta();
  const baselineReady = activeQuoteType === 'project' || Boolean(baselineQuoteVersion.trim());
  const statusClass = baselineReady ? 'quote-status-chip is-ready' : 'quote-status-chip is-pending';
  const statusText = activeQuoteType === 'project'
    ? '发布后形成基线'
    : (baselineReady ? '已绑定基线' : '待销售填写');
  const baselineHint = activeQuoteType === 'project'
    ? '项目报价用于建立首轮客户执行基线。'
    : '变更报价必须绑定一个已存在的项目报价或上一版变更报价。';
  const contextText = financialContextSummary(m);
  if (el.quoteTypeSwitcherMount) {
    el.quoteTypeSwitcherMount.innerHTML = `
      <div class="quote-type-switcher" role="tablist" aria-label="报价类型切换">
        ${Object.entries(QUOTE_TYPE_META).map(([key, meta]) => `
          <button
            type="button"
            class="quote-type-btn${key === activeQuoteType ? ' is-active' : ''}"
            data-quote-type="${key}"
            role="tab"
            aria-selected="${key === activeQuoteType ? 'true' : 'false'}"
          >
            <span>${meta.label}</span>
            <small>${meta.subtitle}</small>
          </button>
        `).join('')}
      </div>
      <div class="quote-type-caption">
        <span class="${statusClass}">${quoteMeta.tag}</span>
        <span>${quoteMeta.description}</span>
      </div>
    `.trim();
    if (el.quoteTypeSwitcherMount.dataset.bound !== 'true') {
      el.quoteTypeSwitcherMount.dataset.bound = 'true';
      el.quoteTypeSwitcherMount.addEventListener('click', (event) => {
        const button = event.target.closest('[data-quote-type]');
        if (!button) return;
        setQuoteType(button.dataset.quoteType);
      });
    }
  }
  if (el.baselineQuoteInfoMount) {
    el.baselineQuoteInfoMount.innerHTML = activeQuoteType === 'change'
      ? `
        <div class="quote-baseline-stack">
          <div class="quote-baseline-row">
            <span class="${statusClass}">${statusText}</span>
            <span class="quote-mini-meta">${baselineHint}</span>
          </div>
          <label class="field quote-inline-field">
            <span>基线报价版本</span>
            <input type="text" data-baseline-quote-input value="${escapeHtml(baselineQuoteVersion)}" placeholder="例如：quote_v1 / 2026Q2 项目报价版" />
          </label>
          <div class="quote-mini-meta">${contextText}</div>
        </div>
      `.trim()
      : `
        <div class="quote-baseline-stack">
          <div class="quote-baseline-row">
            <span class="${statusClass}">${statusText}</span>
            <span class="quote-mini-meta">${baselineHint}</span>
          </div>
          <div class="quote-baseline-placeholder">当前为项目报价，发布后自动形成后续变更报价的基线来源。</div>
          <div class="quote-mini-meta">${contextText}</div>
        </div>
      `.trim();
    if (el.baselineQuoteInfoMount.dataset.bound !== 'true') {
      el.baselineQuoteInfoMount.dataset.bound = 'true';
      el.baselineQuoteInfoMount.addEventListener('change', (event) => {
        const input = event.target.closest('[data-baseline-quote-input]');
        if (!input) return;
        setBaselineQuoteVersion(input.value);
      });
      el.baselineQuoteInfoMount.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter') return;
        const input = event.target.closest('[data-baseline-quote-input]');
        if (!input) return;
        event.preventDefault();
        input.blur();
      });
    }
  }
  if (el.dataResponsibilityMount) {
    el.dataResponsibilityMount.innerHTML = `
      <div class="data-responsibility-list">
        ${DATA_RESPONSIBILITY_ROWS.map((row) => `
          <article class="data-responsibility-item">
            <strong>${row.role}</strong>
            <span>${row.fields}</span>
            <em>${row.note}</em>
          </article>
        `).join('')}
      </div>
    `.trim();
  }
  if (el.quoteWorkflowMount) {
    el.quoteWorkflowMount.innerHTML = `
      <div class="workflow-step-list">
        <article class="workflow-step${activeQuoteType === 'project' ? ' is-active' : ''}">
          <strong>项目报价</strong>
          <span>建立项目首轮客户执行基线，锁定首版客户承载规则。</span>
        </article>
        <article class="workflow-step${activeQuoteType === 'change' ? ' is-active' : ''}">
          <strong>变更报价</strong>
          <span>基于既有基线表达 BOM、工艺、配置与客户条件的增量变化。</span>
        </article>
        <article class="workflow-step is-accent">
          <strong>执行预演</strong>
          <span>按销售填写的实际承载与回收规则，回看工厂端真实利润和成本。</span>
        </article>
      </div>
    `.trim();
  }
  if (el.salesRuleMount) {
    el.salesRuleMount.innerHTML = `
      <div class="sales-rule-list">
        <div class="sales-rule-row"><span>规则来源</span><strong>销售填写</strong></div>
        <div class="sales-rule-row"><span>承载对象</span><strong>实际承载的线束号</strong></div>
        <div class="sales-rule-row"><span>回收上限</span><strong>例如前 5W 套</strong></div>
        <div class="sales-rule-row"><span>非零承载行</span><strong>保留，供模板复用</strong></div>
        <div class="sales-rule-row"><span>零金额模板行</span><strong>保留结构，不参与当前有效回收</strong></div>
      </div>
    `.trim();
  }
  if (el.recoveryTriggerMount) {
    el.recoveryTriggerMount.innerHTML = `
      <div class="trigger-list">
        <article class="trigger-item">
          <strong>出货更新</strong>
          <span>业务定期回填实际出货数量，作为费用回收和调价触发依据。</span>
        </article>
        <article class="trigger-item">
          <strong>阈值提醒</strong>
          <span>达到回收上限、开票条件或调价条件时，后续进入跟踪任务。</span>
        </article>
        <article class="trigger-item">
          <strong>当前状态</strong>
          <span>${activeQuoteType === 'change' && !baselineQuoteVersion.trim() ? '待销售补充基线版本' : '已具备脊柱挂载位，等待规则接入'}</span>
        </article>
      </div>
    `.trim();
  }
  mountQuoteWorkflowModule(m);
  mountRecoveryCenterModule(m);
}

function renderProjectProfitSummaryShell(m) {
  if (!el.projectProfitSummaryMount) return;
  const quoteMeta = currentQuoteTypeMeta();
  const portfolio = m?.portfolioSummary || {};
  const lifecycle = portfolio.lifecycle || {};
  const unit = portfolio.unit || {};
  const annualRows = Array.isArray(portfolio.annual) && portfolio.annual.length
    ? portfolio.annual
    : (Array.isArray(m?.annual) ? m.annual : []);
  const volume = Number(lifecycle.volume || m?.totalVolume || 0);
  const connectorUnitCost = Number(m?.connectorSummary?.totalCurrentCost) || 0;
  const capital = m?.capitalBreakdown || {};
  const summaryRows = [
    {
      group: '收入',
      label: 'ASP / 单套收入',
      unitValue: Number(unit.revenue || (volume ? Number(lifecycle.revenue || 0) / volume : 0)),
      lifecycleValue: Number(lifecycle.revenue || m?.totalRevenue || 0),
      note: `${quoteMeta.label} · ${toText(m?.financialContext?.exactLabel || m?.financialContext?.referenceLabel, '当前执行口径')}`,
      toneValue: Number(unit.revenue || (volume ? Number(lifecycle.revenue || 0) / volume : 0)),
    },
    {
      group: '成本',
      label: '材料成本',
      unitValue: Number(unit.material || m?.material || 0),
      lifecycleValue: Number(unit.material || m?.material || 0) * volume,
      note: `${toText(m?.bom?.label, '当前 BOM')} / ${toText(m?.metal?.label, '当前铜铝基价')}`,
    },
    {
      group: '成本',
      label: '连接器成本',
      unitValue: connectorUnitCost,
      lifecycleValue: connectorUnitCost * volume,
      note: `${toText(m?.conn?.label, '当前连接器版本')} · 覆盖 ${fmtInt(m?.connectorSummary?.overrideCount || 0)} 项`,
    },
    {
      group: '成本',
      label: '直接人工',
      unitValue: Number(unit.directLabor || m?.directLabor || 0),
      lifecycleValue: Number(unit.directLabor || m?.directLabor || 0) * volume,
      note: toText(m?.labor?.label, '当前工时版本'),
    },
    {
      group: '成本',
      label: '制造费用',
      unitValue: Number(unit.manufacturing || m?.manufacturing || 0),
      lifecycleValue: Number(unit.manufacturing || m?.manufacturing || 0) * volume,
      note: `${FACTORY_RATE_TABLE[state.factory || 'K3']?.label || 'K3工厂'} · 当前工厂费率口径`,
    },
    {
      group: '成本',
      label: '包装物流',
      unitValue: Number(unit.packaging || m?.packaging || 0),
      lifecycleValue: Number(unit.packaging || m?.packaging || 0) * volume,
      note: toText(m?.pack?.label, '当前包装版本'),
    },
    {
      group: '成本',
      label: '设备摊销',
      unitValue: Number(unit.equipment || m?.equipment || 0),
      lifecycleValue: Number(unit.equipment || m?.equipment || 0) * volume,
      note: toText(m?.equip?.label, '当前资源投入版本'),
    },
    {
      group: '成本',
      label: '研发摊销',
      unitValue: Number(unit.rnd || m?.rnd || 0),
      lifecycleValue: Number(unit.rnd || m?.rnd || 0) * volume,
      note: '当前引擎口径，后续承接实际回收规则。',
    },
    {
      group: '结果',
      label: '单套总成本',
      unitValue: Number(unit.cost || m?.operating || 0),
      lifecycleValue: Number(lifecycle.cost || m?.totalCost || 0),
      note: '工厂端执行利润主口径',
      toneValue: -Math.abs(Number(unit.cost || m?.operating || 0)),
    },
    {
      group: '结果',
      label: '单套利润',
      unitValue: Number(unit.profit || m?.avgProfit || 0),
      lifecycleValue: Number(lifecycle.profit || m?.totalProfit || 0),
      note: `毛利率 ${fmtPct(lifecycle.margin || m?.margin || 0)}`,
      toneValue: Number(unit.profit || m?.avgProfit || 0),
    },
    {
      group: '结果',
      label: '资本投入池',
      unitText: `${fmtMoney(m?.capitalPerSet || 0)} /套`,
      lifecycleText: fmtMoney(m?.capitalTotal || 0),
      note: `设备 ${fmtMoney(capital.equipment || 0)} · 模具 ${fmtMoney(capital.tooling || 0)} · 工装 ${fmtMoney(capital.fixtures || 0)} · 研发 ${fmtMoney(capital.rnd || 0)}`,
    },
    {
      group: '结果',
      label: '静态回收',
      unitText: Number.isFinite(Number(m?.paybackVolume)) ? `${fmtInt(m.paybackVolume)} 套` : '∞',
      lifecycleText: Number.isFinite(Number(m?.paybackYears)) ? `${fmtNumber(m.paybackYears, 2)} 年` : '∞',
      note: '按当前单套利润与资本投入池估算',
    },
  ];
  const badges = [
    quoteMeta.label,
    '工厂端实际执行口径',
    '单线束颗粒度',
    m?.financialContext?.exactApplied ? '命中核算表' : '执行预演',
  ];
  if (activeQuoteType === 'change') {
    badges.push(`基线 ${baselineQuoteVersionLabel()}`);
  }
  if (el.projectProfitSummaryBadges) {
    el.projectProfitSummaryBadges.innerHTML = badges.map((item) => `<span class="summary-badge">${escapeHtml(item)}</span>`).join('');
  }
  el.projectProfitSummaryMount.innerHTML = `
    <div class="project-summary-caption">
      <div class="project-summary-caption-title">项目评估汇总式总览</div>
      <div class="project-summary-caption-meta">${financialContextSummary(m)}</div>
    </div>
    <div class="table-wrap">
      <table class="project-summary-table">
        <thead>
          <tr>
            <th>分区</th>
            <th>项目评估项</th>
            <th>单套口径</th>
            <th>生命周期口径</th>
            <th>说明</th>
          </tr>
        </thead>
        <tbody>
          ${summaryRows.map((row) => {
            const toneClass = Number.isFinite(Number(row.toneValue)) ? (Number(row.toneValue) >= 0 ? 'positive' : 'negative') : '';
            const unitCell = row.unitText || fmtMoney(row.unitValue || 0);
            const lifecycleCell = row.lifecycleText || fmtMoney(row.lifecycleValue || 0);
            return `
              <tr>
                <td><span class="project-summary-group project-summary-group--${row.group}">${row.group}</span></td>
                <td>${row.label}</td>
                <td class="${toneClass}">${unitCell}</td>
                <td class="${toneClass}">${lifecycleCell}</td>
                <td>${escapeHtml(row.note || '')}</td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>
  `.trim();
  if (el.projectProfitAnnualMount) {
    el.projectProfitAnnualMount.innerHTML = annualRows.length
      ? `
        <div class="project-annual-grid">
          ${annualRows.slice(0, 6).map((row) => `
            <article class="project-annual-card">
              <div class="project-annual-year">${escapeHtml(row.year)}</div>
              <div class="project-annual-profit ${Number(row.profit || 0) >= 0 ? 'positive' : 'negative'}">${fmtMoney(row.profit || 0)}</div>
              <div class="project-annual-meta">${fmtInt(row.volume || 0)} 套 · ASP ${fmtMoney(row.asp || 0)}</div>
            </article>
          `).join('')}
        </div>
      `.trim()
      : '<div class="project-empty-state">当前暂无年度利润节奏数据。</div>';
  }
  if (el.harnessProfitMount) {
    let harnessRows = [];
    if (Array.isArray(m?.harnessProfit?.harnesses) && m.harnessProfit.harnesses.length) {
      harnessRows = m.harnessProfit.harnesses.map((row) => ({
        harnessId: row.harnessId,
        harnessName: row.harnessName,
        margin: Number(row.marginEstimated),
        profit: Number(row.unitProfitEstimated),
        basis: `${fmtInt(row.counts?.selectedItemCount || 0)} 件 / 导线 ${fmtInt(row.counts?.wireLineCount || 0)} 项`,
      }));
    } else {
      harnessRows = buildHarnessProfitRows(m).map((row) => ({
        harnessId: row.harnessId,
        harnessName: row.harnessName,
        margin: Number(row.margin),
        profit: Number(row.profit),
        basis: row.basis,
      }));
    }
    if (!harnessRows.length) {
      el.harnessProfitMount.innerHTML = '<div class="project-empty-state">当前暂无单线束利润焦点数据。</div>';
    } else {
      const focusRows = harnessRows
        .slice()
        .sort((left, right) => Number(left.margin || 0) - Number(right.margin || 0))
        .slice(0, 3);
      el.harnessProfitMount.innerHTML = `
        <div class="harness-focus-list">
          ${focusRows.map((row, index) => `
            <article class="harness-focus-item">
              <div class="harness-focus-rank">#${index + 1}</div>
              <div class="harness-focus-copy">
                <strong>${escapeHtml(row.harnessId || '-')}</strong>
                <span>${escapeHtml(row.harnessName || '-')}</span>
                <em>${escapeHtml(row.basis || '待补充分摊依据')}</em>
              </div>
              <div class="harness-focus-metrics">
                <span class="${Number(row.profit || 0) >= 0 ? 'positive' : 'negative'}">${fmtMoney(row.profit || 0)}</span>
                <span class="${Number(row.margin || 0) >= 0 ? 'positive' : 'negative'}">${fmtPct(row.margin || 0)}</span>
              </div>
            </article>
          `).join('')}
        </div>
      `.trim();
    }
  }
}

function renderProjectProfitExecutionShell(m) {
  if (!el.projectProfitSummaryMount) return;
  {
    const quoteMeta = currentQuoteTypeMeta();
    const previewSummary = latestExecutionPreview && window.G281ExecutionPreview?.buildProjectSummary
      ? window.G281ExecutionPreview.buildProjectSummary(latestExecutionPreview)
      : null;
    const recoverySummary = latestExecutionPreview && window.G281ExecutionPreview?.buildRecoverySummary
      ? window.G281ExecutionPreview.buildRecoverySummary(latestExecutionPreview)
      : null;
    const previewHarnessRows = latestExecutionPreview && window.G281ExecutionPreview?.buildHarnessRows
      ? window.G281ExecutionPreview.buildHarnessRows(latestExecutionPreview)
      : [];
    const portfolio = safeObject(m?.portfolioSummary);
    const lifecycle = safeObject(previewSummary?.lifecycle || portfolio.lifecycle);
    const unit = safeObject(previewSummary?.unit || portfolio.unit);
    const annualRows = safeArray(previewSummary?.annual).length
      ? safeArray(previewSummary.annual)
      : (safeArray(portfolio.annual).length ? safeArray(portfolio.annual) : safeArray(m?.annual));
    const evaluation = buildProjectEvaluationRows(m, previewSummary, recoverySummary);
    const totalVolume = numberOr(lifecycle.volume, m?.totalVolume || 0);
    const revenuePerSet = numberOr(unit.revenuePerSet, portfolio.unit?.revenue || (totalVolume ? numberOr(lifecycle.revenue, m?.totalRevenue || 0) / totalVolume : 0));
    const baseProfitPerSet = numberOr(unit.baseProfitPerSet, portfolio.unit?.profit || m?.avgProfit || 0);
    const recoveryPerSet = numberOr(unit.projectedRecoveryPerSet, recoverySummary?.totalProjectedRecoveryPerSet || 0);
    const executionProfitPerSet = numberOr(unit.adjustedProfitPerSet, baseProfitPerSet + recoveryPerSet);
    const operatingCostPerSet = numberOr(unit.cost, portfolio.unit?.cost || m?.operating || 0);
    const executionLifecycleProfit = numberOr(lifecycle.adjustedProfit, executionProfitPerSet * totalVolume);
    const capital = safeObject(m?.capitalBreakdown);
    const activeRuleCount = numberOr(recoverySummary?.activeRuleCount, latestSalesRuleSnapshot?.summary?.effectiveRules || 0);
    const templateRuleCount = numberOr(recoverySummary?.templateRuleCount, latestSalesRuleSnapshot?.summary?.templateRules || 0);
    const coveredHarnessCount = numberOr(
      recoverySummary?.coveredHarnessCount,
      safeArray(previewHarnessRows).filter((row) => safeArray(row?.activeRules).length).length
    );
    const summaryCards = [
      {
        label: '报价版本',
        value: quoteMeta.label,
        meta: activeQuoteType === 'change' ? `基线 ${baselineQuoteVersionLabel()}` : '项目报价基线',
      },
      {
        label: '收入/套',
        value: fmtMoney(revenuePerSet),
        meta: `${fmtInt(totalVolume)} 套生命周期销量`,
      },
      {
        label: '经营利润/套',
        value: fmtMoney(baseProfitPerSet),
        meta: `基础成本池 ${fmtMoney(operatingCostPerSet)}`,
        tone: baseProfitPerSet >= 0 ? 'positive' : 'negative',
      },
      {
        label: '回收影响/套',
        value: fmtMoney(recoveryPerSet),
        meta: `有效规则 ${fmtInt(activeRuleCount)} / 模板 ${fmtInt(templateRuleCount)}`,
        tone: recoveryPerSet >= 0 ? 'positive' : 'negative',
      },
      {
        label: '实际执行利润/套',
        value: fmtMoney(executionProfitPerSet),
        meta: `${fmtPct(numberOr(unit.adjustedMargin, lifecycle.margin || m?.margin || 0))} 利润率`,
        tone: executionProfitPerSet >= 0 ? 'positive' : 'negative',
      },
      {
        label: '生命周期利润',
        value: fmtMoney(executionLifecycleProfit),
        meta: `承载线束 ${fmtInt(coveredHarnessCount)}`,
        tone: executionLifecycleProfit >= 0 ? 'positive' : 'negative',
      },
    ];
    const badges = [
      quoteMeta.label,
      '报价版口径',
      '工厂端实际执行',
      '单线束颗粒度',
      m?.financialContext?.exactApplied ? '命中核算表' : '执行预演',
    ];
    if (activeQuoteType === 'change') {
      badges.push(`基线 ${baselineQuoteVersionLabel()}`);
    }
    if (el.projectProfitSummaryBadges) {
      el.projectProfitSummaryBadges.innerHTML = badges.map((item) => `<span class="summary-badge">${escapeHtml(item)}</span>`).join('');
    }
    el.projectProfitSummaryMount.innerHTML = `
      <div class="project-summary-caption">
        <div class="project-summary-caption-title">项目评估汇总式总览</div>
        <div class="project-summary-caption-meta">${financialContextSummary(m)}</div>
      </div>
      <div class="project-eval-hero">
        ${summaryCards.map((card) => `
          <article class="project-eval-stat${card.tone ? ` ${card.tone}` : ''}">
            <span class="project-eval-stat-label">${escapeHtml(card.label)}</span>
            <strong class="project-eval-stat-value">${escapeHtml(card.value)}</strong>
            <span class="project-eval-stat-meta">${escapeHtml(card.meta)}</span>
          </article>
        `).join('')}
      </div>
      <div class="table-wrap project-eval-wrap">
        <table class="project-summary-table project-eval-table">
          <thead>
            <tr>
              <th>分区</th>
              <th>项目评估项</th>
              ${evaluation.years.map((year) => `<th>${escapeHtml(year)}</th>`).join('')}
              <th>生命周期</th>
              <th>单套</th>
            </tr>
          </thead>
          <tbody>
            ${evaluation.rows.map((row) => `
              <tr>
                <td><span class="project-summary-group project-summary-group--${escapeHtml(row.group)}">${escapeHtml(row.group)}</span></td>
                <td>${escapeHtml(row.label)}</td>
                ${safeArray(row.years).map((value) => {
                  const toneClass = row.tone === 'profit' ? (Number(value || 0) >= 0 ? 'positive' : 'negative') : '';
                  return `<td class="${toneClass}">${formatProjectEvaluationCell(value, row.type)}</td>`;
                }).join('')}
                <td class="${row.tone === 'profit' ? (Number(row.lifecycle || 0) >= 0 ? 'positive' : 'negative') : ''}">${formatProjectEvaluationCell(row.lifecycle, row.type)}</td>
                <td class="${row.tone === 'profit' ? (Number(row.unit || 0) >= 0 ? 'positive' : 'negative') : ''}">${formatProjectEvaluationCell(row.unit, row.type)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
      <div class="project-eval-note">
        <span>设备 ${fmtMoney(capital.equipment || 0)}</span>
        <span>工装 ${fmtMoney(capital.fixtures || 0)}</span>
        <span>模具 ${fmtMoney(capital.tooling || 0)}</span>
        <span>研发 ${fmtMoney(capital.rnd || 0)}</span>
        <span>说明：当前先按报价版底座回放实际承载与回收规则，不引入总部财务平均分摊。</span>
      </div>
    `.trim();
    if (el.projectProfitAnnualMount) {
      el.projectProfitAnnualMount.innerHTML = annualRows.length
        ? `
          <div class="project-annual-grid project-eval-annual-grid">
            ${annualRows.slice(0, 6).map((row) => {
              const executionProfit = numberOr(
                row.adjustedProfit,
                numberOr(row.profit, 0) + numberOr(row.volume, 0) * recoveryPerSet
              );
              return `
                <article class="project-annual-card">
                  <div class="project-annual-year">${escapeHtml(row.year)}</div>
                  <div class="project-annual-profit ${executionProfit >= 0 ? 'positive' : 'negative'}">${fmtMoney(executionProfit)}</div>
                  <div class="project-annual-meta">${fmtInt(row.volume || 0)} 套 · ASP ${fmtMoney(row.asp || 0)}</div>
                  <div class="project-annual-meta">经营利润 ${fmtMoney(row.profit || 0)} · 回收影响 ${fmtMoney(numberOr(row.volume, 0) * recoveryPerSet)}</div>
                </article>
              `;
            }).join('')}
          </div>
        `.trim()
        : '<div class="project-empty-state">当前暂无年度执行利润节奏数据。</div>';
    }
    if (el.harnessProfitMount) {
      let harnessRows = [];
      if (safeArray(previewHarnessRows).length) {
        harnessRows = safeArray(previewHarnessRows).map((row) => ({
          harnessId: row.harnessId,
          harnessName: row.harnessName,
          profit: numberOr(row.adjusted?.profitPerSet, row.base?.profitPerSet || 0),
          margin: numberOr(row.adjusted?.margin, row.base?.margin || 0),
          ruleCount: safeArray(row.activeRules).length,
          recoveredAmount: numberOr(row.estimatedRecoveredAmount, 0),
          carrierFlag: safeArray(row.activeRules).length ? '承载' : '未挂规则',
        }));
      } else if (safeArray(m?.harnessProfit?.harnesses).length) {
        harnessRows = safeArray(m.harnessProfit.harnesses).map((row) => ({
          harnessId: row.harnessId,
          harnessName: row.harnessName,
          profit: numberOr(row.unitProfitEstimated, 0),
          margin: numberOr(row.marginEstimated, 0),
          ruleCount: 0,
          recoveredAmount: 0,
          carrierFlag: '基础利润',
        }));
      } else {
        harnessRows = buildHarnessProfitRows(m).map((row) => ({
          harnessId: row.harnessId,
          harnessName: row.harnessName,
          profit: numberOr(row.profit, 0),
          margin: numberOr(row.margin, 0),
          ruleCount: 0,
          recoveredAmount: 0,
          carrierFlag: '基础利润',
        }));
      }
      if (!harnessRows.length) {
        el.harnessProfitMount.innerHTML = '<div class="project-empty-state">当前暂无单线束利润焦点数据。</div>';
      } else {
        const focusRows = harnessRows
          .slice()
          .sort((left, right) => Number(left.profit || 0) - Number(right.profit || 0))
          .slice(0, 4);
        el.harnessProfitMount.innerHTML = `
          <div class="harness-focus-list">
            ${focusRows.map((row, index) => `
              <article class="harness-focus-item">
                <div class="harness-focus-rank">#${index + 1}</div>
                <div class="harness-focus-copy">
                  <strong>${escapeHtml(row.harnessId || '-')}</strong>
                  <span>${escapeHtml(row.harnessName || '-')}</span>
                  <em>${escapeHtml(`${row.carrierFlag} · 规则 ${fmtInt(row.ruleCount || 0)} · 已回收 ${fmtMoney(row.recoveredAmount || 0)}`)}</em>
                </div>
                <div class="harness-focus-metrics">
                  <span class="${Number(row.profit || 0) >= 0 ? 'positive' : 'negative'}">${fmtMoney(row.profit || 0)}</span>
                  <span class="${Number(row.margin || 0) >= 0 ? 'positive' : 'negative'}">${fmtPct(row.margin || 0)}</span>
                </div>
              </article>
            `).join('')}
          </div>
        `.trim();
      }
    }
    return;
  }
  const quoteMeta = currentQuoteTypeMeta();
  const previewSummary = latestExecutionPreview && window.G281ExecutionPreview?.buildProjectSummary
    ? window.G281ExecutionPreview.buildProjectSummary(latestExecutionPreview)
    : null;
  const recoverySummary = latestExecutionPreview && window.G281ExecutionPreview?.buildRecoverySummary
    ? window.G281ExecutionPreview.buildRecoverySummary(latestExecutionPreview)
    : null;
  const previewHarnessRows = latestExecutionPreview && window.G281ExecutionPreview?.buildHarnessRows
    ? window.G281ExecutionPreview.buildHarnessRows(latestExecutionPreview)
    : [];
  return renderProjectProfitExecutionShellV2(m, {
    quoteMeta,
    previewSummary,
    recoverySummary,
    previewHarnessRows,
  });
  const portfolio = m?.portfolioSummary || {};
  const lifecycle = portfolio.lifecycle || {};
  const unit = portfolio.unit || {};
  const annualRows = Array.isArray(previewSummary?.annual) && previewSummary.annual.length
    ? previewSummary.annual
    : (Array.isArray(portfolio.annual) && portfolio.annual.length
      ? portfolio.annual
      : (Array.isArray(m?.annual) ? m.annual : []));
  const volume = Number(previewSummary?.lifecycle?.volume || lifecycle.volume || m?.totalVolume || 0);
  const connectorUnitCost = Number(m?.connectorSummary?.totalCurrentCost) || 0;
  const capital = m?.capitalBreakdown || {};
  const adjustedProfitPerSet = Number(previewSummary?.unit?.adjustedProfitPerSet || unit.profit || m?.avgProfit || 0);
  const adjustedLifecycleProfit = Number(previewSummary?.lifecycle?.adjustedProfit || lifecycle.profit || m?.totalProfit || 0);
  const projectedRecoveryPerSet = Number(previewSummary?.unit?.projectedRecoveryPerSet || recoverySummary?.totalProjectedRecoveryPerSet || 0);
  const adjustedMargin = Number(previewSummary?.unit?.adjustedMargin || lifecycle.margin || m?.margin || 0);
  const summaryRows = [
    {
      group: '收入',
      label: 'ASP / 单套收入',
      unitValue: Number(previewSummary?.unit?.revenuePerSet || unit.revenue || (volume ? Number(lifecycle.revenue || 0) / volume : 0)),
      lifecycleValue: Number(previewSummary?.lifecycle?.revenue || lifecycle.revenue || m?.totalRevenue || 0),
      note: `${quoteMeta.label} · ${toText(m?.financialContext?.exactLabel || m?.financialContext?.referenceLabel, '当前执行口径')}`,
      toneValue: Number(previewSummary?.unit?.revenuePerSet || unit.revenue || 0),
    },
    {
      group: '成本',
      label: '材料成本',
      unitValue: Number(unit.material || m?.material || 0),
      lifecycleValue: Number(unit.material || m?.material || 0) * volume,
      note: `${toText(m?.bom?.label, '当前 BOM')} / ${toText(m?.metal?.label, '当前铜铝基价')}`,
    },
    {
      group: '成本',
      label: '连接器成本',
      unitValue: connectorUnitCost,
      lifecycleValue: connectorUnitCost * volume,
      note: `${toText(m?.conn?.label, '当前连接器版本')} · 覆盖 ${fmtInt(m?.connectorSummary?.overrideCount || 0)} 项`,
    },
    {
      group: '成本',
      label: '直接人工',
      unitValue: Number(unit.directLabor || m?.directLabor || 0),
      lifecycleValue: Number(unit.directLabor || m?.directLabor || 0) * volume,
      note: toText(m?.labor?.label, '当前工时版本'),
    },
    {
      group: '成本',
      label: '制造费用',
      unitValue: Number(unit.manufacturing || m?.manufacturing || 0),
      lifecycleValue: Number(unit.manufacturing || m?.manufacturing || 0) * volume,
      note: `${FACTORY_RATE_TABLE[state.factory || 'K3']?.label || 'K3工厂'} · 当前工厂费率口径`,
    },
    {
      group: '成本',
      label: '包装物流',
      unitValue: Number(unit.packaging || m?.packaging || 0),
      lifecycleValue: Number(unit.packaging || m?.packaging || 0) * volume,
      note: toText(m?.pack?.label, '当前包装版本'),
    },
    {
      group: '成本',
      label: '设备+研发',
      unitValue: Number(unit.equipment || m?.equipment || 0) + Number(unit.rnd || m?.rnd || 0),
      lifecycleValue: (Number(unit.equipment || m?.equipment || 0) + Number(unit.rnd || m?.rnd || 0)) * volume,
      note: `设备 ${fmtMoney(capital.equipment || 0)} · 工装 ${fmtMoney(capital.fixtures || 0)} · 模具 ${fmtMoney(capital.tooling || 0)} · 研发 ${fmtMoney(capital.rnd || 0)}`,
    },
    {
      group: '结果',
      label: '单套总成本',
      unitValue: Number(unit.cost || m?.operating || 0),
      lifecycleValue: Number(lifecycle.cost || m?.totalCost || 0),
      note: '工厂端实际执行口径的基础成本池',
      toneValue: -Math.abs(Number(unit.cost || m?.operating || 0)),
    },
    {
      group: '结果',
      label: '执行预演利润',
      unitValue: adjustedProfitPerSet,
      lifecycleValue: adjustedLifecycleProfit,
      note: projectedRecoveryPerSet > 0
        ? `已叠加销售规则预演回收 ${fmtMoney(projectedRecoveryPerSet)} 元/套`
        : `当前毛利率 ${fmtPct(adjustedMargin)}`,
      toneValue: adjustedProfitPerSet,
    },
    {
      group: '结果',
      label: '资本投入池',
      unitText: `${fmtMoney(m?.capitalPerSet || 0)} /套`,
      lifecycleText: fmtMoney(m?.capitalTotal || 0),
      note: '设备、工装、模具和研发池仍保留项目总额，用于后续继续按线束负荷细分',
    },
    {
      group: '结果',
      label: '有效销售规则',
      unitText: `${fmtInt(recoverySummary?.activeRuleCount || latestSalesRuleSnapshot?.summary?.effectiveRules || 0)} 条`,
      lifecycleText: `${fmtInt(recoverySummary?.coveredHarnessCount || 0)} 个线束`,
      note: '按销售填写的实际承载线束号参与执行预演',
    },
    {
      group: '结果',
      label: '模板保留行',
      unitText: `${fmtInt(recoverySummary?.templateRuleCount || latestSalesRuleSnapshot?.summary?.templateRules || 0)} 条`,
      lifecycleText: fmtMoney(recoverySummary?.totalEstimatedRecoveredAmount || 0),
      note: '零金额模板行保留结构；右侧金额为当前预估已回收',
    },
  ];
  const badges = [
    quoteMeta.label,
    '工厂端实际执行口径',
    '单线束颗粒度',
    m?.financialContext?.exactApplied ? '命中核算表' : '执行预演',
  ];
  if (recoverySummary?.totalRuleCount) {
    badges.push(`规则 ${fmtInt(recoverySummary.totalRuleCount)}`);
  }
  if (activeQuoteType === 'change') {
    badges.push(`基线 ${baselineQuoteVersionLabel()}`);
  }
  if (el.projectProfitSummaryBadges) {
    el.projectProfitSummaryBadges.innerHTML = badges.map((item) => `<span class="summary-badge">${escapeHtml(item)}</span>`).join('');
  }
  el.projectProfitSummaryMount.innerHTML = `
    <div class="project-summary-caption">
      <div class="project-summary-caption-title">项目评估汇总式总览</div>
      <div class="project-summary-caption-meta">${financialContextSummary(m)}</div>
    </div>
    <div class="table-wrap">
      <table class="project-summary-table">
        <thead>
          <tr>
            <th>分区</th>
            <th>项目评估项</th>
            <th>单套口径</th>
            <th>生命周期口径</th>
            <th>说明</th>
          </tr>
        </thead>
        <tbody>
          ${summaryRows.map((row) => {
            const toneClass = Number.isFinite(Number(row.toneValue)) ? (Number(row.toneValue) >= 0 ? 'positive' : 'negative') : '';
            const unitCell = row.unitText || fmtMoney(row.unitValue || 0);
            const lifecycleCell = row.lifecycleText || fmtMoney(row.lifecycleValue || 0);
            return `
              <tr>
                <td><span class="project-summary-group project-summary-group--${row.group}">${row.group}</span></td>
                <td>${row.label}</td>
                <td class="${toneClass}">${unitCell}</td>
                <td class="${toneClass}">${lifecycleCell}</td>
                <td>${escapeHtml(row.note || '')}</td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>
  `.trim();
  if (el.projectProfitAnnualMount) {
    el.projectProfitAnnualMount.innerHTML = annualRows.length
      ? `
        <div class="project-annual-grid">
          ${annualRows.slice(0, 6).map((row) => {
            const annualProfit = Number(row.adjustedProfit || row.profit || 0);
            return `
              <article class="project-annual-card">
                <div class="project-annual-year">${escapeHtml(row.year)}</div>
                <div class="project-annual-profit ${annualProfit >= 0 ? 'positive' : 'negative'}">${fmtMoney(annualProfit)}</div>
                <div class="project-annual-meta">${fmtInt(row.volume || 0)} 套 · ASP ${fmtMoney(row.asp || 0)}</div>
              </article>
            `;
          }).join('')}
        </div>
      `.trim()
      : '<div class="project-empty-state">当前暂无年度利润节奏数据。</div>';
  }
  if (el.harnessProfitMount) {
    let harnessRows = [];
    if (Array.isArray(previewHarnessRows) && previewHarnessRows.length) {
      harnessRows = previewHarnessRows.map((row) => ({
        harnessId: row.harnessId,
        harnessName: row.harnessName,
        margin: Number(row.adjusted?.margin ?? row.base?.margin ?? 0),
        profit: Number(row.adjusted?.profitPerSet ?? row.base?.profitPerSet ?? 0),
        basis: `${fmtInt(row.activeRules?.length || 0)} 条有效规则 · 预估回收 ${fmtMoney(row.estimatedRecoveredAmount || 0)}`,
      }));
    } else if (Array.isArray(m?.harnessProfit?.harnesses) && m.harnessProfit.harnesses.length) {
      harnessRows = m.harnessProfit.harnesses.map((row) => ({
        harnessId: row.harnessId,
        harnessName: row.harnessName,
        margin: Number(row.marginEstimated),
        profit: Number(row.unitProfitEstimated),
        basis: `${fmtInt(row.counts?.selectedItemCount || 0)} 件 / 导线 ${fmtInt(row.counts?.wireLineCount || 0)} 项`,
      }));
    } else {
      harnessRows = buildHarnessProfitRows(m).map((row) => ({
        harnessId: row.harnessId,
        harnessName: row.harnessName,
        margin: Number(row.margin),
        profit: Number(row.profit),
        basis: row.basis,
      }));
    }
    if (!harnessRows.length) {
      el.harnessProfitMount.innerHTML = '<div class="project-empty-state">当前暂无单线束利润焦点数据。</div>';
    } else {
      const focusRows = harnessRows
        .slice()
        .sort((left, right) => Number(left.margin || 0) - Number(right.margin || 0))
        .slice(0, 3);
      el.harnessProfitMount.innerHTML = `
        <div class="harness-focus-list">
          ${focusRows.map((row, index) => `
            <article class="harness-focus-item">
              <div class="harness-focus-rank">#${index + 1}</div>
              <div class="harness-focus-copy">
                <strong>${escapeHtml(row.harnessId || '-')}</strong>
                <span>${escapeHtml(row.harnessName || '-')}</span>
                <em>${escapeHtml(row.basis || '待补充分摊依据')}</em>
              </div>
              <div class="harness-focus-metrics">
                <span class="${Number(row.profit || 0) >= 0 ? 'positive' : 'negative'}">${fmtMoney(row.profit || 0)}</span>
                <span class="${Number(row.margin || 0) >= 0 ? 'positive' : 'negative'}">${fmtPct(row.margin || 0)}</span>
              </div>
            </article>
          `).join('')}
        </div>
      `.trim();
    }
  }
}

function renderProjectProfitExecutionShellV3(m) {
  if (!el.projectProfitSummaryMount) return;
  const quoteMeta = currentQuoteTypeMeta();
  const previewSummary = latestExecutionPreview && window.G281ExecutionPreview?.buildProjectSummary
    ? window.G281ExecutionPreview.buildProjectSummary(latestExecutionPreview)
    : null;
  const recoverySummary = latestExecutionPreview && window.G281ExecutionPreview?.buildRecoverySummary
    ? window.G281ExecutionPreview.buildRecoverySummary(latestExecutionPreview)
    : null;
  const previewHarnessRows = latestExecutionPreview && window.G281ExecutionPreview?.buildHarnessRows
    ? window.G281ExecutionPreview.buildHarnessRows(latestExecutionPreview)
    : [];
  const portfolio = safeObject(m?.portfolioSummary);
  const lifecycle = safeObject(portfolio.lifecycle);
  const evaluation = buildProjectEvaluationRows(m, previewSummary, recoverySummary);
  const trackingRows = buildWorkflowTrackingRows(m);
  const operatingProfitPerSet = numberOr(previewSummary?.unit?.baseProfitPerSet, portfolio.unit?.profit || m?.avgProfit || 0);
  const recoveryPerSet = numberOr(previewSummary?.unit?.projectedRecoveryPerSet, recoverySummary?.totalProjectedRecoveryPerSet || 0);
  const executionProfitPerSet = numberOr(previewSummary?.unit?.adjustedProfitPerSet, operatingProfitPerSet + recoveryPerSet);
  const lifecycleExecutionProfit = numberOr(previewSummary?.lifecycle?.adjustedProfit, lifecycle.profit || m?.totalProfit || 0);
  const lifecycleRevenue = numberOr(previewSummary?.lifecycle?.revenue, lifecycle.revenue || m?.totalRevenue || 0);
  const totalTargetAmount = trackingRows.reduce((sum, row) => sum + numberOr(row.targetAmount, 0), 0);
  const totalRecoveredAmount = trackingRows.reduce((sum, row) => sum + numberOr(row.recoveredAmount, 0), 0);
  const totalRemainingAmount = trackingRows.reduce((sum, row) => sum + numberOr(row.remainingAmount, 0), 0);
  const thresholdHitCount = trackingRows.filter((row) => !!row.thresholdReached).length;
  const activeRuleCount = numberOr(recoverySummary?.activeRuleCount, latestSalesRuleSnapshot?.summary?.effectiveRules || 0);
  const coveredHarnessCount = numberOr(
    recoverySummary?.coveredHarnessCount,
    trackingRows.filter((row) => numberOr(row.activeRuleCount, 0) > 0 || numberOr(row.templateRuleCount, 0) > 0).length,
  );
  const annualVolumeRow = evaluation.rows.find((row) => row.label.indexOf('销量') >= 0) || {};
  const annualAspRow = evaluation.rows.find((row) => row.label.indexOf('ASP') >= 0) || {};
  const annualExecutionRow = evaluation.rows.find((row) => row.label.indexOf('实际执行利润') >= 0) || {};
  const summaryCards = [
    {
      label: '报价版本',
      value: escapeHtml(toText(m?.financialContext?.referenceLabel, quoteMeta.label)),
      meta: escapeHtml(toText(m?.financialContext?.referenceKey, 'quote')),
    },
    {
      label: '经营利润/套',
      value: fmtMoney(operatingProfitPerSet),
      meta: '不含一次性费用回收',
      tone: operatingProfitPerSet >= 0 ? 'positive' : 'negative',
    },
    {
      label: '回收影响/套',
      value: fmtMoney(recoveryPerSet),
      meta: `${fmtInt(activeRuleCount)} 条有效规则 / ${fmtInt(coveredHarnessCount)} 款承载线束`,
      tone: recoveryPerSet >= 0 ? 'positive' : '',
    },
    {
      label: '实际执行利润/套',
      value: fmtMoney(executionProfitPerSet),
      meta: `执行利润率 ${fmtPct(lifecycleRevenue > 0 ? lifecycleExecutionProfit / lifecycleRevenue : 0)}`,
      tone: executionProfitPerSet >= 0 ? 'positive' : 'negative',
    },
    {
      label: '生命周期执行利润',
      value: fmtMoney(lifecycleExecutionProfit),
      meta: `回收目标 ${fmtMoney(totalTargetAmount)}`,
      tone: lifecycleExecutionProfit >= 0 ? 'positive' : 'negative',
    },
    {
      label: '已回收 / 未回收',
      value: `${fmtMoney(totalRecoveredAmount)} / ${fmtMoney(totalRemainingAmount)}`,
      meta: `${fmtInt(thresholdHitCount)} 个阈值命中`,
    },
  ];
  const badges = [
    quoteMeta.label,
    '报价版口径',
    '项目评估汇总页展示',
    '工厂实际执行利润',
  ];
  if (activeQuoteType === 'change') {
    badges.push(`基线 ${baselineQuoteVersionLabel()}`);
  }
  if (el.projectProfitSummaryBadges) {
    el.projectProfitSummaryBadges.innerHTML = badges.map((item) => `<span class="summary-badge">${escapeHtml(item)}</span>`).join('');
  }
  el.projectProfitSummaryMount.innerHTML = `
    <div class="project-eval-shell">
      <div class="project-summary-caption project-eval-head">
        <div>
          <div class="project-summary-caption-title">项目评估汇总</div>
          <div class="project-summary-caption-meta">按报价版成本底座回放当前实际承载与回收规则，优先查看工厂端实际执行利润。</div>
        </div>
        <div class="project-summary-caption-meta">${financialContextSummary(m)}</div>
      </div>
      <div class="project-eval-summary-grid">
        ${summaryCards.map((card) => `
          <article class="project-eval-summary-card${card.tone ? ` is-${card.tone}` : ''}">
            <span>${card.label}</span>
            <strong>${card.value}</strong>
            <em>${card.meta}</em>
          </article>
        `).join('')}
      </div>
      <div class="table-wrap project-eval-table-wrap">
        <table class="project-summary-table project-eval-table">
          <thead>
            <tr>
              <th>分区</th>
              <th>项目评估项</th>
              ${evaluation.years.map((year) => `<th>${escapeHtml(toText(year, '-'))}</th>`).join('')}
              <th>单套</th>
              <th>生命周期</th>
            </tr>
          </thead>
          <tbody>
            ${evaluation.rows.map((row) => `
              <tr class="project-eval-row${row.tone ? ` project-eval-row--${escapeHtml(row.tone)}` : ''}">
                <td><span class="project-summary-group project-summary-group--${row.group}">${row.group}</span></td>
                <td class="project-eval-item">${escapeHtml(row.label)}</td>
                ${safeArray(row.years).map((value) => `
                  <td class="${row.tone === 'profit' && numberOr(value, 0) < 0 ? 'negative' : (row.tone === 'profit' && numberOr(value, 0) > 0 ? 'positive' : '')}">
                    ${formatProjectEvaluationCell(value, row.type)}
                  </td>
                `).join('')}
                <td class="${row.tone === 'profit' && numberOr(row.unit, 0) < 0 ? 'negative' : (row.tone === 'profit' && numberOr(row.unit, 0) > 0 ? 'positive' : '')}">
                  ${formatProjectEvaluationCell(row.unit, row.type)}
                </td>
                <td class="${row.tone === 'profit' && numberOr(row.lifecycle, 0) < 0 ? 'negative' : (row.tone === 'profit' && numberOr(row.lifecycle, 0) > 0 ? 'positive' : '')}">
                  ${formatProjectEvaluationCell(row.lifecycle, row.type)}
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `.trim();
  if (el.projectProfitAnnualMount) {
    el.projectProfitAnnualMount.innerHTML = evaluation.years.length
      ? `
        <div class="project-eval-side-stack">
          <article class="project-profit-side-card project-eval-side-card">
            <h4>年度执行节奏</h4>
            <div class="project-annual-grid">
              ${evaluation.years.map((year, index) => {
                const annualProfit = numberOr(annualExecutionRow.years?.[index], 0);
                return `
                  <article class="project-annual-card">
                    <div class="project-annual-year">${escapeHtml(toText(year, '-'))}</div>
                    <div class="project-annual-profit ${annualProfit >= 0 ? 'positive' : 'negative'}">${fmtMoney(annualProfit)}</div>
                    <div class="project-annual-meta">${fmtInt(annualVolumeRow.years?.[index] || 0)} 套 / ASP ${fmtMoney(annualAspRow.years?.[index] || 0)}</div>
                  </article>
                `;
              }).join('')}
            </div>
          </article>
        </div>
      `.trim()
      : '<div class="project-empty-state">当前暂无年度利润节奏数据。</div>';
  }
  if (el.harnessProfitMount) {
    const harnessRows = Array.isArray(previewHarnessRows) && previewHarnessRows.length
      ? previewHarnessRows.map((row) => ({
        harnessId: row.harnessId,
        harnessName: row.harnessName,
        margin: numberOr(row.adjusted?.margin, row.base?.margin || 0),
        executionProfit: numberOr(row.adjusted?.profitPerSet, row.base?.profitPerSet || 0),
        basis: `${fmtInt(safeArray(row.activeRules).length)} 条规则 / 已回收 ${fmtMoney(row.estimatedRecoveredAmount || 0)}`,
      }))
      : buildHarnessProfitRows(m).map((row) => ({
        harnessId: row.harnessId,
        harnessName: row.harnessName,
        margin: numberOr(row.margin, 0),
        executionProfit: numberOr(row.profit, 0),
        basis: row.basis,
      }));
    if (!harnessRows.length) {
      el.harnessProfitMount.innerHTML = '<div class="project-empty-state">当前暂无单线束执行利润焦点数据。</div>';
    } else {
      const focusRows = harnessRows
        .slice()
        .sort((left, right) => numberOr(left.executionProfit, 0) - numberOr(right.executionProfit, 0))
        .slice(0, 5);
      el.harnessProfitMount.innerHTML = `
        <div class="harness-focus-list project-eval-focus-list">
          ${focusRows.map((row, index) => `
            <article class="harness-focus-item">
              <div class="harness-focus-rank">#${index + 1}</div>
              <div class="harness-focus-copy">
                <strong>${escapeHtml(row.harnessId || '-')}</strong>
                <span>${escapeHtml(row.harnessName || '-')}</span>
                <em>${escapeHtml(row.basis || '待补充分摊依据')}</em>
              </div>
              <div class="harness-focus-metrics">
                <span class="${numberOr(row.executionProfit, 0) >= 0 ? 'positive' : 'negative'}">${fmtMoney(row.executionProfit)}</span>
                <span class="${numberOr(row.margin, 0) >= 0 ? 'positive' : 'negative'}">${fmtPct(row.margin)}</span>
              </div>
            </article>
          `).join('')}
        </div>
      `.trim();
    }
  }
}

function renderProjectProfitExecutionShellV2(m, context = {}) {
  const quoteMeta = safeObject(context.quoteMeta);
  const previewSummary = safeObject(context.previewSummary);
  const recoverySummary = safeObject(context.recoverySummary);
  const previewHarnessRows = safeArray(context.previewHarnessRows);
  const portfolio = safeObject(m?.portfolioSummary);
  const lifecycle = safeObject(portfolio.lifecycle);
  const unit = safeObject(portfolio.unit);
  const volume = numberOr(previewSummary?.lifecycle?.volume, lifecycle.volume || m?.totalVolume || 0);
  const projectedRecoveryPerSet = numberOr(previewSummary?.unit?.projectedRecoveryPerSet, recoverySummary?.totalProjectedRecoveryPerSet || 0);
  const adjustedProfitPerSet = numberOr(previewSummary?.unit?.adjustedProfitPerSet, unit.profit || m?.avgProfit || 0);
  const adjustedLifecycleProfit = numberOr(previewSummary?.lifecycle?.adjustedProfit, lifecycle.profit || m?.totalProfit || 0);
  const adjustedMargin = numberOr(previewSummary?.unit?.adjustedMargin, lifecycle.margin || m?.margin || 0);
  const baseProfitPerSet = numberOr(previewSummary?.unit?.baseProfitPerSet, unit.profit || m?.avgProfit || 0);
  const evaluation = buildProjectEvaluationRows(m, previewSummary, recoverySummary);
  const quoteVersion = quoteFinancialVersion();
  const focusRows = (previewHarnessRows.length
    ? previewHarnessRows.map((row) => ({
      harnessId: toText(row?.harnessId, ''),
      harnessName: toText(row?.harnessName, ''),
      executionProfit: numberOr(row?.adjusted?.profitPerSet, row?.base?.profitPerSet || 0),
      executionMargin: numberOr(row?.adjusted?.margin, row?.base?.margin || 0),
      basis: safeArray(row?.activeRules).length
        ? `${fmtInt(safeArray(row?.activeRules).length)} 条承载规则 / 预计回收 ${fmtMoney(row?.estimatedRecoveredAmount || 0)}`
        : '未挂承载规则',
    }))
    : buildHarnessProfitRows(m).map((row) => ({
      harnessId: row.harnessId,
      harnessName: row.harnessName,
      executionProfit: numberOr(row.profit, 0),
      executionMargin: numberOr(row.margin, 0),
      basis: row.basis,
    })))
    .filter((row) => row.harnessId)
    .sort((left, right) => numberOr(left.executionMargin, 0) - numberOr(right.executionMargin, 0))
    .slice(0, 5);
  const badges = [
    toText(quoteMeta.label, '报价版'),
    '报价版项目评估汇总',
    '工厂端执行利润口径',
    '单线束颗粒度',
  ];
  if (quoteVersion?.label || quoteVersion?.name) {
    badges.push(`报价底座 ${toText(quoteVersion.label || quoteVersion.name, '')}`);
  }
  if (recoverySummary?.activeRuleCount) {
    badges.push(`规则 ${fmtInt(recoverySummary.activeRuleCount)}`);
  }
  if (activeQuoteType === 'change') {
    badges.push(`基线 ${baselineQuoteVersionLabel()}`);
  }
  if (el.projectProfitSummaryBadges) {
    el.projectProfitSummaryBadges.innerHTML = badges.map((item) => `<span class="summary-badge">${escapeHtml(item)}</span>`).join('');
  }
  el.projectProfitSummaryMount.innerHTML = `
    <div class="project-eval-shell">
      <div class="project-summary-caption">
        <div>
          <div class="project-summary-caption-title">项目评估汇总 · 报价版执行利润</div>
          <div class="project-summary-caption-meta">${financialContextSummary(m)}</div>
        </div>
        <div class="project-summary-caption-meta">按报价版年度列展开，执行利润额外叠加当前挂载回收规则影响</div>
      </div>
      <div class="project-profit-summary-layout project-eval-layout">
        <div class="project-profit-summary-main">
          <div class="table-wrap">
            <table class="project-summary-table project-eval-table">
              <thead>
                <tr>
                  <th rowspan="2">分区</th>
                  <th rowspan="2">项目评估项</th>
                  <th colspan="${Math.max(evaluation.years.length, 1)}">报价版年度展开</th>
                  <th rowspan="2">生命周期</th>
                  <th rowspan="2">单套</th>
                </tr>
                <tr>
                  ${(evaluation.years.length ? evaluation.years : ['报价版']).map((year) => `<th>${escapeHtml(toText(year, '报价版'))}</th>`).join('')}
                </tr>
              </thead>
              <tbody>
                ${evaluation.rows.map((row) => `
                  <tr>
                    <td><span class="project-summary-group project-summary-group--${escapeHtml(row.group)}">${escapeHtml(row.group)}</span></td>
                    <td>${escapeHtml(row.label)}</td>
                    ${safeArray(row.years).map((value) => {
                      const toneClass = row.tone === 'profit' ? (numberOr(value, 0) >= 0 ? 'positive' : 'negative') : '';
                      return `<td class="${toneClass}">${formatProjectEvaluationCell(value, row.type)}</td>`;
                    }).join('')}
                    <td class="${row.tone === 'profit' ? (numberOr(row.lifecycle, 0) >= 0 ? 'positive' : 'negative') : ''}">${formatProjectEvaluationCell(row.lifecycle, row.type)}</td>
                    <td class="${row.tone === 'profit' ? (numberOr(row.unit, 0) >= 0 ? 'positive' : 'negative') : ''}">${formatProjectEvaluationCell(row.unit, row.type)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
        <aside class="project-profit-summary-side project-eval-side">
          <article class="project-profit-side-card project-eval-card">
            <h4>执行口径摘要</h4>
            <div class="sales-rule-list">
              <div class="sales-rule-row"><span>收入 / 套</span><strong>${fmtMoney(previewSummary?.unit?.revenuePerSet || unit.revenue || 0)}</strong></div>
              <div class="sales-rule-row"><span>经营利润 / 套</span><strong class="${baseProfitPerSet >= 0 ? 'positive' : 'negative'}">${fmtMoney(baseProfitPerSet)}</strong></div>
              <div class="sales-rule-row"><span>执行利润 / 套</span><strong class="${adjustedProfitPerSet >= 0 ? 'positive' : 'negative'}">${fmtMoney(adjustedProfitPerSet)}</strong></div>
              <div class="sales-rule-row"><span>生命周期执行利润</span><strong class="${adjustedLifecycleProfit >= 0 ? 'positive' : 'negative'}">${fmtMoney(adjustedLifecycleProfit)}</strong></div>
              <div class="sales-rule-row"><span>执行利润率</span><strong class="${adjustedMargin >= 0 ? 'positive' : 'negative'}">${fmtPct(adjustedMargin)}</strong></div>
              <div class="sales-rule-row"><span>规则回收影响 / 套</span><strong>${fmtMoney(projectedRecoveryPerSet)}</strong></div>
            </div>
          </article>
          <article class="project-profit-side-card project-eval-card">
            <h4>回收规则摘要</h4>
            <div class="sales-rule-list">
              <div class="sales-rule-row"><span>有效规则</span><strong>${fmtInt(recoverySummary?.activeRuleCount || 0)} 条</strong></div>
              <div class="sales-rule-row"><span>承载线束</span><strong>${fmtInt(recoverySummary?.coveredHarnessCount || 0)} 款</strong></div>
              <div class="sales-rule-row"><span>模板保留行</span><strong>${fmtInt(recoverySummary?.templateRuleCount || 0)} 条</strong></div>
              <div class="sales-rule-row"><span>预计已回收</span><strong>${fmtMoney(recoverySummary?.totalEstimatedRecoveredAmount || 0)}</strong></div>
              <div class="sales-rule-row"><span>生命周期总量</span><strong>${fmtInt(volume)} 套</strong></div>
              <div class="sales-rule-row"><span>当前报价底座</span><strong>${escapeHtml(toText(quoteVersion?.label || quoteVersion?.name, quoteMeta.label || '报价版'))}</strong></div>
            </div>
          </article>
        </aside>
      </div>
    </div>
  `.trim();
  if (el.projectProfitAnnualMount) {
    el.projectProfitAnnualMount.innerHTML = evaluation.years.length
      ? `
        <div class="project-annual-grid">
          ${evaluation.years.map((year, index) => {
            const annualVolume = numberOr(evaluation.rows[0]?.years?.[index], 0);
            const annualAsp = numberOr(evaluation.rows[1]?.years?.[index], previewSummary?.unit?.revenuePerSet || unit.revenue || 0);
            const annualProfit = numberOr(evaluation.rows[evaluation.rows.length - 1]?.years?.[index], 0);
            const annualRecovery = numberOr(evaluation.rows[evaluation.rows.length - 2]?.years?.[index], projectedRecoveryPerSet);
            return `
              <article class="project-annual-card">
                <div class="project-annual-year">${escapeHtml(toText(year, '-'))}</div>
                <div class="project-annual-profit ${annualProfit >= 0 ? 'positive' : 'negative'}">${fmtMoney(annualProfit)}</div>
                <div class="project-annual-meta">${fmtInt(annualVolume)} 套 · ASP ${fmtMoney(annualAsp)} · 回收影响 ${fmtMoney(annualRecovery)}</div>
              </article>
            `;
          }).join('')}
        </div>
      `.trim()
      : '<div class="project-empty-state">当前暂无报价版年度评估数据。</div>';
  }
  if (el.harnessProfitMount) {
    el.harnessProfitMount.innerHTML = focusRows.length
      ? `
        <div class="harness-focus-list">
          ${focusRows.map((row, index) => `
            <article class="harness-focus-item">
              <div class="harness-focus-rank">#${index + 1}</div>
              <div class="harness-focus-copy">
                <strong>${escapeHtml(row.harnessId || '-')}</strong>
                <span>${escapeHtml(row.harnessName || '-')}</span>
                <em>${escapeHtml(row.basis || '待补充分摊依据')}</em>
              </div>
              <div class="harness-focus-metrics">
                <span class="${numberOr(row.executionProfit, 0) >= 0 ? 'positive' : 'negative'}">${fmtMoney(row.executionProfit || 0)}</span>
                <span class="${numberOr(row.executionMargin, 0) >= 0 ? 'positive' : 'negative'}">${fmtPct(row.executionMargin || 0)}</span>
              </div>
            </article>
          `).join('')}
        </div>
      `.trim()
      : '<div class="project-empty-state">当前暂无单线束执行利润焦点数据。</div>';
  }
}

function normalizeWorkflowTask(task, index = 0) {
  return {
    id: toText(task?.id || task?.taskId, `workflow-task-${index + 1}`),
    title: toText(task?.title || task?.name, '待跟踪任务'),
    owner: toText(task?.owner || task?.assignee || task?.role, '项目经理'),
    due: toText(task?.due || task?.dueDate || task?.deadline, '待排期'),
    status: toText(task?.status || task?.state, '待处理'),
    note: toText(task?.note || task?.description || task?.message, ''),
    updatedAt: toText(task?.updatedAt, ''),
  };
}

function workflowTaskLaneKey(status) {
  const normalized = toText(status, '待处理').trim();
  if (WORKFLOW_TASK_LANES[3].statuses.includes(normalized)) return 'done';
  if (WORKFLOW_TASK_LANES[2].statuses.includes(normalized)) return 'review';
  if (WORKFLOW_TASK_LANES[1].statuses.includes(normalized)) return 'progress';
  return 'pending';
}

function workflowTaskToneClass(status) {
  const lane = workflowTaskLaneKey(status);
  if (lane === 'done') return 'is-done';
  if (lane === 'review') return 'is-review';
  if (lane === 'progress') return 'is-progress';
  return 'is-pending';
}

function workflowAlertTitle(code, level) {
  const normalized = toText(code, '');
  if (normalized === 'baseline_missing') return '变更报价缺少基线';
  if (normalized === 'rule_missing') return '销售回收规则未填写';
  if (normalized === 'harness_missing') return '缺少线束颗粒度数据';
  if (normalized.startsWith('threshold_reached_')) return '达到回收阈值';
  if (normalized.startsWith('threshold_near_')) return '接近回收阈值';
  return level === 'warning' ? '执行提醒' : '信息提醒';
}

function buildWorkflowTrackingRows(model) {
  const preview = safeObject(latestExecutionPreview);
  const snapshot = latestSalesRuleSnapshot || getSalesRuleSnapshot(model);
  const trackingMap = new Map();
  const previewMap = new Map();
  const candidateHarnessIds = new Set();
  safeArray(snapshot?.recoveryTracking).forEach((record) => {
    const harnessId = toText(record?.harnessId || record?.lineId || record?.harnessNo, '');
    if (!harnessId) return;
    trackingMap.set(harnessId, safeObject(record));
    candidateHarnessIds.add(harnessId);
  });
  safeArray(preview?.harnessRows).forEach((row) => {
    const harnessId = toText(row?.harnessId, '');
    if (!harnessId) return;
    previewMap.set(harnessId, safeObject(row));
    candidateHarnessIds.add(harnessId);
  });
  safeArray(snapshot?.rules).forEach((rule) => {
    safeArray(rule?.carrierHarnessIds).forEach((harnessId) => {
      const normalizedHarnessId = toText(harnessId, '');
      if (!normalizedHarnessId) return;
      candidateHarnessIds.add(normalizedHarnessId);
    });
  });
  const rows = Array.from(candidateHarnessIds).map((harnessId) => {
    const row = previewMap.get(harnessId) || {};
    const tracking = trackingMap.get(harnessId) || {};
    const activeRules = safeArray(row?.activeRules).length
      ? safeArray(row?.activeRules)
      : safeArray(snapshot?.rules).filter((rule) => {
        const carrierIds = safeArray(rule?.carrierHarnessIds).map((item) => toText(item, ''));
        return carrierIds.includes(harnessId) && !!rule?.isActive && !rule?.isTemplateOnly;
      });
    const templateRules = safeArray(row?.templateReservedRules).length
      ? safeArray(row?.templateReservedRules)
      : safeArray(snapshot?.rules).filter((rule) => {
        const carrierIds = safeArray(rule?.carrierHarnessIds).map((item) => toText(item, ''));
        return carrierIds.includes(harnessId) && !!rule?.isTemplateOnly;
      });
    const deliveredSets = Math.max(0, numberOr(tracking?.deliveredSets, row?.deliveredSets || 0));
    const projectedRecoveryPerSet = Math.max(0, numberOr(row?.projectedRecoveryPerSet, activeRules.reduce(
      (sum, rule) => sum + Math.max(0, numberOr(rule?.perSetRecoverAmount, rule?.perSetAllocation || 0)),
      0
    )));
    const recoveryLimitSets = activeRules.reduce(
      (max, rule) => Math.max(max, Math.max(0, numberOr(rule?.recoverLimitSets, rule?.recoveryCapSets || 0))),
      0
    );
    const targetAmount = activeRules.reduce((sum, rule) => {
      const totalAmount = Math.max(0, numberOr(rule?.totalAmount, 0));
      const perSetAmount = Math.max(0, numberOr(rule?.perSetRecoverAmount, rule?.perSetAllocation || 0));
      const capSets = Math.max(0, numberOr(rule?.recoverLimitSets, rule?.recoveryCapSets || 0));
      return sum + (totalAmount > 0 ? totalAmount : (capSets > 0 ? perSetAmount * capSets : 0));
    }, 0);
    const recoveredAmount = Math.max(0, numberOr(tracking?.recoveredAmount, row?.estimatedRecoveredAmount || 0));
    const remainingAmount = Math.max(
      0,
      numberOr(tracking?.remainingAmount, targetAmount > 0 ? targetAmount - recoveredAmount : 0)
    );
    const notes = safeArray(row?.notes).map((item) => toText(item, '')).filter(Boolean);
    return {
      harnessId,
      harnessName: toText(row?.harnessName || tracking?.harnessName, ''),
      activeRuleCount: activeRules.length,
      templateRuleCount: templateRules.length,
      projectedRecoveryPerSet,
      deliveredSets,
      targetAmount,
      recoveredAmount,
      remainingAmount,
      recoveryLimitSets,
      thresholdReached: recoveryLimitSets > 0 && deliveredSets >= recoveryLimitSets,
      progressRatio: recoveryLimitSets > 0 ? Math.min(deliveredSets / recoveryLimitSets, 1) : 0,
      adjustedProfitPerSet: numberOr(row?.adjusted?.profitPerSet, row?.base?.profitPerSet || 0),
      adjustedMargin: numberOr(row?.adjusted?.margin, row?.base?.margin || 0),
      notes,
    };
  }).filter((row) => (
    row.harnessId
    && (
      row.activeRuleCount
      || row.templateRuleCount
      || row.deliveredSets
      || row.targetAmount
      || row.recoveredAmount
      || row.remainingAmount
    )
  ));
  return rows.sort((left, right) => {
    const leftScore = Math.max(numberOr(left.targetAmount, 0), numberOr(left.recoveredAmount, 0), numberOr(left.deliveredSets, 0));
    const rightScore = Math.max(numberOr(right.targetAmount, 0), numberOr(right.recoveredAmount, 0), numberOr(right.deliveredSets, 0));
    if (rightScore !== leftScore) return rightScore - leftScore;
    if (right.activeRuleCount !== left.activeRuleCount) return right.activeRuleCount - left.activeRuleCount;
    return toText(left.harnessId, '').localeCompare(toText(right.harnessId, ''), 'zh-CN');
  });
}

function buildWorkflowAlertRows(preview, thresholdRows) {
  const rows = safeArray(preview?.alerts).map((alert, index) => ({
    id: toText(alert?.code, `preview-alert-${index + 1}`),
    level: toText(alert?.level, 'info'),
    title: workflowAlertTitle(alert?.code, alert?.level),
    message: toText(alert?.message, ''),
  }));
  thresholdRows.forEach((row) => {
    if (row.thresholdReached) {
      rows.push({
        id: `threshold_reached_${row.harnessId}`,
        level: 'warning',
        title: workflowAlertTitle(`threshold_reached_${row.harnessId}`, 'warning'),
        message: `${row.harnessId} 已达到协议套数阈值，可触发开票/调价复核。`,
      });
      return;
    }
    if (row.recoveryLimitSets > 0 && row.progressRatio >= 0.8) {
      rows.push({
        id: `threshold_near_${row.harnessId}`,
        level: 'info',
        title: workflowAlertTitle(`threshold_near_${row.harnessId}`, 'info'),
        message: `${row.harnessId} 已达到 ${fmtPct(row.progressRatio)} 阈值，建议提前检查回收与调价动作。`,
      });
    }
  });
  const deduped = new Map();
  rows.forEach((row) => {
    if (!row.id) return;
    deduped.set(row.id, row);
  });
  return Array.from(deduped.values());
}

function buildWorkflowTasks(viewModel, snapshot) {
  const taskMap = new Map();
  const derivedTasks = [
    {
      id: 'shipment-update',
      title: '更新实际出货',
      owner: '业务/销售',
      due: '每周',
      status: viewModel.shippedSets > 0 ? '进行中' : '待开始',
      note: '按实际承载线束号回填出货套数，系统据此更新费用回收。',
    },
  ];
  if (viewModel.quoteContext?.quoteType === 'change' && !viewModel.quoteContext?.baselineQuoteVersion) {
    derivedTasks.push({
      id: 'baseline-bind',
      title: '绑定变更报价基线',
      owner: '销售/项目经理',
      due: '尽快',
      status: '待处理',
      note: '变更报价必须明确挂接基线版本，避免执行口径失真。',
    });
  }
  if (!viewModel.activeRuleCount) {
    derivedTasks.push({
      id: 'rule-complete',
      title: '补齐销售回收规则',
      owner: '销售',
      due: '本周',
      status: '待处理',
      note: '按实际承载线束号填写一次性费用回收规则后再做正式判断。',
    });
  }
  if (viewModel.thresholdRows.some((row) => row.thresholdReached)) {
    derivedTasks.push({
      id: 'invoice-reprice',
      title: '触发开票/调价复核',
      owner: '销售/财务/项目经理',
      due: '立即',
      status: '待确认',
      note: '已有承载线束达到回收阈值，需要核对开票、调价与回收动作。',
    });
  }
  derivedTasks.forEach((task, index) => {
    const normalized = normalizeWorkflowTask(task, index);
    taskMap.set(normalized.id, normalized);
  });
  safeArray(snapshot?.tasks).forEach((task, index) => {
    const normalized = normalizeWorkflowTask(task, index + derivedTasks.length);
    taskMap.set(normalized.id, normalized);
  });
  const tasks = Array.from(taskMap.values());
  return WORKFLOW_TASK_LANES.map((lane) => ({
    key: lane.key,
    label: lane.label,
    items: tasks.filter((task) => workflowTaskLaneKey(task.status) === lane.key),
  }));
}

function bindWorkflowWorkspaceActionsLegacy() {
  if (!el.workflowWorkspacePage || el.workflowWorkspacePage.dataset.bound === 'true') return;
  el.workflowWorkspacePage.dataset.bound = 'true';
  el.workflowWorkspacePage.addEventListener('click', (event) => {
    const button = event.target.closest('[data-workflow-nav]');
    if (!button) return;
    const action = button.dataset.workflowNav;
    let nextPage = 'workflow';
    let targetId = '';
    if (action === 'profit-summary') {
      nextPage = 'profit';
      targetId = 'projectProfitSummarySection';
    } else if (action === 'quote-control') {
      nextPage = 'profit';
      targetId = 'quoteControlStripSection';
    } else if (action === 'recovery-center') {
      nextPage = 'profit';
      targetId = 'recoveryTriggerMount';
    } else if (action === 'data-management') {
      nextPage = 'data';
      targetId = 'managementTopGrid';
    }
    setWorkspacePage(nextPage);
    const target = targetId ? document.getElementById(targetId) : null;
    if (target && typeof target.scrollIntoView === 'function') {
      target.scrollIntoView({ block: 'start', behavior: 'smooth' });
    }
  });
}

function renderWorkflowWorkspaceLegacy(model) {
  if (!el.workflowWorkspacePage) return;
  bindWorkflowWorkspaceActions();
  const preview = safeObject(latestExecutionPreview);
  const snapshot = latestSalesRuleSnapshot || getSalesRuleSnapshot(model);
  const quoteContext = safeObject(preview?.quoteContext?.quoteType ? preview.quoteContext : buildQuoteContext(model));
  const recoverySummary = safeObject(preview?.recovery);
  const trackingRows = buildWorkflowTrackingRows(model);
  const shippedSets = trackingRows.reduce((sum, row) => sum + Math.max(0, numberOr(row.deliveredSets, 0)), 0);
  const recoveredAmount = trackingRows.reduce((sum, row) => sum + Math.max(0, numberOr(row.recoveredAmount, 0)), 0);
  const targetAmount = trackingRows.reduce((sum, row) => sum + Math.max(0, numberOr(row.targetAmount, 0)), 0);
  const targetSets = trackingRows.reduce((sum, row) => sum + Math.max(0, numberOr(row.recoveryLimitSets, 0)), 0);
  const thresholdRows = trackingRows
    .filter((row) => row.recoveryLimitSets > 0 || row.deliveredSets > 0 || row.targetAmount > 0)
    .slice()
    .sort((left, right) => {
      if (left.thresholdReached !== right.thresholdReached) return left.thresholdReached ? -1 : 1;
      return numberOr(right.progressRatio, 0) - numberOr(left.progressRatio, 0);
    })
    .slice(0, 8);
  const alertRows = buildWorkflowAlertRows(preview, thresholdRows);
  const activeRuleCount = numberOr(recoverySummary?.activeRuleCount, snapshot?.summary?.effectiveRules || 0);
  const templateRuleCount = numberOr(recoverySummary?.templateRuleCount, snapshot?.summary?.templateRules || 0);
  const coveredHarnessCount = trackingRows.filter((row) => row.activeRuleCount > 0).length || numberOr(recoverySummary?.coveredHarnessCount, 0);
  const taskLanes = buildWorkflowTasks({
    quoteContext,
    shippedSets,
    activeRuleCount,
    thresholdRows,
  }, snapshot);
  const allTasks = taskLanes.flatMap((lane) => lane.items);
  const openTaskCount = allTasks.filter((task) => workflowTaskLaneKey(task.status) !== 'done').length;
  const worstHarness = safeObject(preview?.project?.harnessFocus);
  const summaryCards = [
    {
      label: '报价口径',
      value: escapeHtml(toText(quoteContext.quoteTypeLabel, currentQuoteTypeMeta().label)),
      meta: escapeHtml(quoteContext.quoteType === 'change'
        ? `基线 ${quoteContext.baselineQuoteVersion || '待填写'}`
        : '项目报价发布后形成基线'),
    },
    {
      label: '有效规则',
      value: escapeHtml(fmtInt(activeRuleCount)),
      meta: escapeHtml(`覆盖 ${fmtInt(coveredHarnessCount)} 款线束 / 模板 ${fmtInt(templateRuleCount)} 条`),
    },
    {
      label: '已出货套数',
      value: escapeHtml(fmtInt(shippedSets)),
      meta: escapeHtml(targetSets > 0 ? `目标 ${fmtInt(targetSets)} 套` : '按承载线束累计跟踪'),
    },
    {
      label: '已回收金额',
      value: escapeHtml(fmtMoney(recoveredAmount)),
      meta: escapeHtml(targetAmount > 0 ? `目标 ${fmtMoney(targetAmount)}` : '按销售规则实时预演'),
    },
    {
      label: '待跟踪事项',
      value: escapeHtml(fmtInt(openTaskCount)),
      meta: escapeHtml(`${fmtInt(alertRows.length)} 条提醒 / ${fmtInt(thresholdRows.filter((row) => row.thresholdReached).length)} 条触发`),
    },
    {
      label: '利润焦点线束',
      value: escapeHtml(toText(worstHarness?.harnessId, '-')),
      meta: escapeHtml(worstHarness?.harnessId
        ? `${fmtPct(numberOr(worstHarness?.adjustedMargin, 0))} / ${fmtMoney(numberOr(worstHarness?.adjustedProfitPerSet, 0))}`
        : '当前暂无异常焦点'),
    },
  ];
  el.workflowWorkspacePage.innerHTML = `
    <div class="workflow-workspace">
      <section class="card workflow-hero-card">
        <div class="workflow-hero-head">
          <div class="workflow-hero-copy">
            <div class="eyebrow">WORKFLOW BOARD</div>
            <h3>报价流转与费用回收视图</h3>
            <p class="section-note">按工厂端实际执行口径展示任务、承载线束出货与一次性费用回收，不走财务平均分摊。</p>
            <div class="hero-badges">
              <span class="chip"><span class="dot"></span><span>${escapeHtml(toText(quoteContext.quoteName, state.scenarioName || '当前场景'))}</span></span>
              <span class="chip"><span class="dot alt"></span><span>${escapeHtml(toText(quoteContext.financialContextSummary, '执行预演口径'))}</span></span>
              <span class="chip"><span class="dot gold"></span><span>${escapeHtml(quoteContext.quoteType === 'change' ? `基线：${quoteContext.baselineQuoteVersion || '待填写'}` : '项目报价基线创建中')}</span></span>
            </div>
          </div>
          <div class="workflow-nav-actions">
            <button class="button ghost" type="button" data-workflow-nav="profit-summary">看利润总览</button>
            <button class="button ghost" type="button" data-workflow-nav="quote-control">去销售规则</button>
            <button class="button ghost" type="button" data-workflow-nav="recovery-center">去回收中心</button>
            <button class="button ghost" type="button" data-workflow-nav="data-management">去数据管理</button>
          </div>
        </div>
        <div class="workflow-summary-grid">
          ${summaryCards.map((card) => `
            <article class="workflow-summary-card">
              <span class="workflow-summary-label">${card.label}</span>
              <strong class="workflow-summary-value">${card.value}</strong>
              <span class="workflow-summary-meta">${card.meta}</span>
            </article>
          `).join('')}
        </div>
      </section>

      <section class="workflow-board-grid">
        <article class="card workflow-board-card">
          <div class="project-summary-caption">
            <div class="project-summary-caption-title">流转任务板</div>
            <div class="project-summary-caption-meta">报价分为项目报价与变更报价，按当前规则跟踪执行进度</div>
          </div>
          <div class="workflow-lane-grid">
            ${taskLanes.map((lane) => `
              <section class="workflow-lane">
                <div class="workflow-lane-head">
                  <strong>${lane.label}</strong>
                  <span class="workflow-lane-count">${fmtInt(lane.items.length)}</span>
                </div>
                <div class="workflow-task-list">
                  ${lane.items.length ? lane.items.map((task) => `
                    <article class="workflow-task-card ${workflowTaskToneClass(task.status)}">
                      <div class="workflow-task-title">${escapeHtml(task.title)}</div>
                      <div class="workflow-task-meta">
                        <span>${escapeHtml(task.owner || '未指定责任人')}</span>
                        <span>${escapeHtml(task.due || '待排期')}</span>
                        <span>${escapeHtml(task.status || '待处理')}</span>
                      </div>
                      <div class="workflow-task-note">${escapeHtml(task.note || '待补充说明')}</div>
                    </article>
                  `).join('') : '<div class="workflow-empty">当前阶段暂无任务</div>'}
                </div>
              </section>
            `).join('')}
          </div>
        </article>

        <div class="workflow-side-stack">
          <article class="card workflow-side-card">
            <div class="project-summary-caption">
              <div class="project-summary-caption-title">触发提醒</div>
              <div class="project-summary-caption-meta">基线缺失、规则缺失、阈值命中都会在这里排队</div>
            </div>
            <div class="workflow-alert-list">
              ${alertRows.length ? alertRows.map((alert) => `
                <article class="workflow-alert-item ${toText(alert.level, 'info') === 'warning' ? 'is-warning' : 'is-info'}">
                  <strong>${escapeHtml(alert.title)}</strong>
                  <span>${escapeHtml(alert.message)}</span>
                </article>
              `).join('') : '<div class="workflow-empty">当前没有待处理提醒</div>'}
            </div>
          </article>

          <article class="card workflow-side-card">
            <div class="project-summary-caption">
              <div class="project-summary-caption-title">阈值与回收队列</div>
              <div class="project-summary-caption-meta">按承载线束号核对出货、阈值与费用回收</div>
            </div>
            <div class="workflow-threshold-list">
              ${thresholdRows.length ? thresholdRows.map((row) => `
                <article class="workflow-threshold-item">
                  <div class="workflow-threshold-head">
                    <strong>${escapeHtml(row.harnessId)}</strong>
                    <span>${escapeHtml(row.thresholdReached ? '已触发' : '跟踪中')}</span>
                  </div>
                  <div class="workflow-threshold-meta">
                    <span>${escapeHtml(row.harnessName || '-')}</span>
                    <span>出货 ${fmtInt(row.deliveredSets)} / ${fmtInt(row.recoveryLimitSets || 0)} 套</span>
                  </div>
                  <div class="workflow-progress"><span style="width:${Math.max(0, Math.min(numberOr(row.progressRatio, 0), 1)) * 100}%"></span></div>
                  <div class="workflow-threshold-foot">
                    <span>已回收 ${fmtMoney(row.recoveredAmount)}</span>
                    <span>待回收 ${fmtMoney(row.remainingAmount)}</span>
                  </div>
                </article>
              `).join('') : '<div class="workflow-empty">当前没有可跟踪的承载线束阈值</div>'}
            </div>
          </article>
        </div>
      </section>

      <section class="card workflow-lines-card">
        <div class="project-summary-caption">
          <div class="project-summary-caption-title">承载线束执行表</div>
          <div class="project-summary-caption-meta">保留非零承载行与模板行结构，便于模板复用和执行跟踪</div>
        </div>
        <div class="table-wrap">
          <table class="project-summary-table workflow-line-table">
            <thead>
              <tr>
                <th>线束号</th>
                <th>线束名称</th>
                <th>有效规则</th>
                <th>模板行</th>
                <th>回收上限</th>
                <th>已出货</th>
                <th>预计回收/套</th>
                <th>已回收金额</th>
                <th>待回收金额</th>
                <th>预演利润/套</th>
                <th>备注</th>
              </tr>
            </thead>
            <tbody>
              ${trackingRows.length ? trackingRows.map((row) => `
                <tr>
                  <td>${escapeHtml(row.harnessId)}</td>
                  <td>${escapeHtml(row.harnessName || '-')}</td>
                  <td>${fmtInt(row.activeRuleCount)}</td>
                  <td>${fmtInt(row.templateRuleCount)}</td>
                  <td>${fmtInt(row.recoveryLimitSets || 0)} 套</td>
                  <td>${fmtInt(row.deliveredSets || 0)} 套</td>
                  <td>${fmtMoney(row.projectedRecoveryPerSet || 0)}</td>
                  <td>${fmtMoney(row.recoveredAmount || 0)}</td>
                  <td>${fmtMoney(row.remainingAmount || 0)}</td>
                  <td class="${numberOr(row.adjustedProfitPerSet, 0) >= 0 ? 'positive' : 'negative'}">${fmtMoney(row.adjustedProfitPerSet || 0)} / ${fmtPct(row.adjustedMargin || 0)}</td>
                  <td>${escapeHtml(row.notes.length ? row.notes.join('；') : '按实际规则执行')}</td>
                </tr>
              `).join('') : `
                <tr>
                  <td colspan="11">
                    <div class="workflow-empty">当前没有可展示的承载线束执行数据</div>
                  </td>
                </tr>
              `}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  `.trim();
}

function workflowStatusLabel(status) {
  const map = {
    draft: '草稿',
    review_pending: '待评审',
    returned: '已退回',
    active: '执行中',
    closed: '已关闭',
    approved: '已通过',
    pending_review: '待评审',
    submitted: '待评审',
    not_started: '未开始',
  };
  return map[toText(status, '')] || toText(status, '草稿');
}

function workflowBufferKey(recordId, stageCode) {
  return `${toText(recordId, '')}::${toText(stageCode, '')}`;
}

function getWorkflowStageBuffer(record, stageCode) {
  const key = workflowBufferKey(record?.recordId, stageCode);
  if (!workflowStageDraftBuffers[key]) {
    const stage = safeArray(record?.stageStates).find((item) => item.stageCode === stageCode) || {};
    const seed = {
      ...clonePlain(stage.draftData || {}, {}),
      ...clonePlain(stage.submitData || {}, {}),
    };
    if (stageCode === 'execution_recovery') {
      seed.deliveredSets = seed.deliveredSets ?? numberOr(record?.latestExecutionSnapshot?.deliveredSets, 0);
      seed.recoveredAmount = seed.recoveredAmount ?? numberOr(record?.latestExecutionSnapshot?.recoveredAmount, 0);
      seed.remainingAmount = seed.remainingAmount ?? numberOr(record?.latestExecutionSnapshot?.remainingAmount, 0);
      seed.shipment_progress = seed.shipment_progress ?? seed.deliveredSets;
      seed.recovery_progress = seed.recovery_progress ?? seed.recoveredAmount;
      seed.invoice_reprice_action = seed.invoice_reprice_action ?? toText(record?.latestExecutionSnapshot?.lastTaskHint, '');
    }
    workflowStageDraftBuffers[key] = seed;
  }
  return workflowStageDraftBuffers[key];
}

function updateWorkflowStageBuffer(recordId, stageCode, field, value) {
  const key = workflowBufferKey(recordId, stageCode);
  workflowStageDraftBuffers[key] = {
    ...getWorkflowStageBuffer({ recordId, stageStates: [] }, stageCode),
    [field]: value,
  };
}

function clearWorkflowStageBuffer(recordId, stageCode) {
  delete workflowStageDraftBuffers[workflowBufferKey(recordId, stageCode)];
}

function workflowVisibleFieldDefs(record, stageCode, roleCode) {
  const normalizedRole = normalizeWorkflowRoleCode(roleCode);
  return workflowFieldDefsForStage(stageCode).filter((field) => safeArray(field.ownerRoleCodes).includes(normalizedRole));
}

function workflowCompletion(record, stageCode, roleCode) {
  const fields = workflowVisibleFieldDefs(record, stageCode, roleCode);
  if (!fields.length) return { filled: 0, total: 0 };
  const buffer = getWorkflowStageBuffer(record, stageCode);
  const filled = fields.filter((field) => {
    const value = buffer[field.fieldCode];
    return !(value === '' || value === null || value === undefined);
  }).length;
  return {
    filled,
    total: fields.length,
  };
}

function workflowEffectiveRulesForHarness(harnessId) {
  return safeArray(latestSalesRuleSnapshot?.rules).filter((rule) => {
    const lineIds = safeArray(rule?.carrierHarnessIds).map((item) => toText(item, ''));
    return lineIds.includes(toText(harnessId, '')) && !!rule?.isActive && !rule?.isTemplateOnly;
  });
}

function workflowTrackingSummary(record, trackingRows) {
  return trackingRows.find((row) => row.harnessId === record.harnessId) || {
    deliveredSets: numberOr(record?.latestExecutionSnapshot?.deliveredSets, 0),
    recoveredAmount: numberOr(record?.latestExecutionSnapshot?.recoveredAmount, 0),
    remainingAmount: numberOr(record?.latestExecutionSnapshot?.remainingAmount, 0),
    targetAmount: 0,
    recoveryLimitSets: 0,
    thresholdReached: false,
    progressRatio: 0,
  };
}

function workflowRuleRowsForHarness(harnessId) {
  const normalizedHarnessId = toText(harnessId, '');
  const repo = getSalesRuleRepo();
  if (repo && typeof repo.listRules === 'function') {
    try {
      return safeArray(repo.listRules({
        activeOnly: true,
        includeTemplate: false,
        harnessIds: [normalizedHarnessId],
      }));
    } catch (error) {
      console.warn('[G281] workflow rule lookup failed:', error);
    }
  }
  return workflowEffectiveRulesForHarness(normalizedHarnessId);
}

function workflowThresholdTaskId(recordId) {
  return `invoice-reprice:${toText(recordId, '')}`;
}

function workflowSyncTrackingRecord(record, values, model) {
  const repo = getSalesRuleRepo();
  if (!repo || typeof repo.upsertTrackingRecord !== 'function') return;
  repo.upsertTrackingRecord({
    harnessId: toText(record?.harnessId, ''),
    harnessName: toText(record?.harnessName, ''),
    deliveredSets: Math.max(0, numberOr(values?.deliveredSets, record?.latestExecutionSnapshot?.deliveredSets || 0)),
    recoveredAmount: Math.max(0, numberOr(values?.recoveredAmount, record?.latestExecutionSnapshot?.recoveredAmount || 0)),
    remainingAmount: Math.max(0, numberOr(values?.remainingAmount, record?.latestExecutionSnapshot?.remainingAmount || 0)),
    updatedAt: new Date().toISOString(),
  });
  latestSalesRuleSnapshot = getSalesRuleSnapshot(model);
}

function workflowSyncLinkedArtifacts(record, model, options = {}) {
  const salesRepo = getSalesRuleRepo();
  const ruleRows = workflowRuleRowsForHarness(record?.harnessId);
  const linkedSalesRuleIds = Array.from(new Set(ruleRows.map((rule) => toText(rule?.ruleId, '')).filter(Boolean)));
  const trackingRow = buildWorkflowTrackingRows(model).find((row) => row.harnessId === record?.harnessId) || {};
  const nextTaskIds = new Set(safeArray(record?.linkedTaskIds));
  if (trackingRow.thresholdReached && salesRepo && typeof salesRepo.upsertTask === 'function') {
    const taskId = workflowThresholdTaskId(record?.recordId);
    salesRepo.upsertTask({
      id: taskId,
      title: '开票/调价复核',
      owner: '销售 / 项目经理',
      due: '立即',
      status: '待确认',
      note: `${toText(record?.harnessId, '')} 已达到回收阈值，需复核开票与调价动作`,
      updatedAt: new Date().toISOString(),
    });
    nextTaskIds.add(taskId);
    latestSalesRuleSnapshot = getSalesRuleSnapshot(model);
  }
  return {
    linkedSalesRuleIds,
    linkedTaskIds: Array.from(nextTaskIds),
    linkedRecoveryHarnessId: toText(record?.harnessId, ''),
  };
}

function workflowExecutionDraftValues(record, buffer, model) {
  const tracking = workflowTrackingSummary(record, buildWorkflowTrackingRows(model));
  const deliveredSets = Math.max(
    0,
    numberOr(buffer?.shipment_progress, numberOr(buffer?.deliveredSets, numberOr(record?.latestExecutionSnapshot?.deliveredSets, 0))),
  );
  const recoveredAmount = Math.max(
    0,
    numberOr(buffer?.recovery_progress, numberOr(buffer?.recoveredAmount, numberOr(record?.latestExecutionSnapshot?.recoveredAmount, 0))),
  );
  const remainingFallback = numberOr(tracking?.targetAmount, 0) > 0
    ? Math.max(0, numberOr(tracking?.targetAmount, 0) - recoveredAmount)
    : numberOr(record?.latestExecutionSnapshot?.remainingAmount, 0);
  const remainingAmount = Math.max(0, numberOr(buffer?.remainingAmount, remainingFallback));
  return {
    deliveredSets,
    recoveredAmount,
    remainingAmount,
  };
}

function workflowCanEditStage(record, stageCode, roleCode) {
  const meta = workflowStageMeta(stageCode);
  const normalizedRole = normalizeWorkflowRoleCode(roleCode || currentAuthContext().primaryRole);
  if (stageCode === 'pm_cost_review') {
    return authHasPermission(`workflow.stage.${stageCode}.edit`, ['project_manager']) || normalizedRole === 'project_manager';
  }
  return authHasPermission(`workflow.stage.${stageCode}.edit`, meta.ownerRoleCodes) || safeArray(meta.ownerRoleCodes).includes(normalizedRole);
}

function workflowStagePayload(record, stageCode) {
  const stage = safeArray(record?.stageStates).find((item) => item.stageCode === stageCode) || {};
  return {
    ...clonePlain(stage.draftData || {}, {}),
    ...clonePlain(stage.submitData || {}, {}),
  };
}

function workflowStageCompletion(record, stageCode) {
  const fields = workflowFieldDefsForStage(stageCode);
  if (!fields.length) return { filled: 0, total: 0 };
  const payload = workflowStagePayload(record, stageCode);
  const filled = fields.filter((field) => !(payload[field.fieldCode] === '' || payload[field.fieldCode] === null || payload[field.fieldCode] === undefined)).length;
  return { filled, total: fields.length };
}

function workflowStageStatus(record, stageCode) {
  return safeArray(record?.stageStates).find((item) => item.stageCode === stageCode) || {};
}

const WORKFLOW_PUBLICATION_CONFIGS = [
  {
    key: 'bom_release',
    stageCode: 'harness_development',
    title: 'BOM 发布',
    targetLabel: '采购先询价',
    buttonLabel: '发布 BOM',
    description: '单线束 BOM 在页面内确认后即可先发布给采购，不再等待整包完整冻结。',
  },
  {
    key: 'process_release',
    stageCode: 'process_estimation',
    title: '工艺资料发布',
    targetLabel: '核价 / 采购 / 项目',
    buttonLabel: '发布工艺资料',
    description: '工艺路线、工时和资源负荷形成可询价资料后即可提前下发。',
  },
  {
    key: 'packaging_release',
    stageCode: 'resource_packaging',
    title: '包装资料发布',
    targetLabel: '采购 / 包装',
    buttonLabel: '发布包装资料',
    description: '包材价格和包装方案由包装工程师维护，成熟后直接发布，不强依赖采购介入。',
  },
];

function workflowPublicationState(record, config) {
  const payload = workflowStagePayload(record, config.stageCode);
  const stage = workflowStageStatus(record, config.stageCode);
  return {
    status: toText(payload[`${config.key}_status`], '') || (payload[`${config.key}_publishedAt`] ? 'published' : ''),
    publishedAt: toText(payload[`${config.key}_publishedAt`], ''),
    publishedBy: toText(payload[`${config.key}_publishedBy`], ''),
    note: toText(payload[`${config.key}_note`], ''),
    canPublish: workflowCanEditStage(record, config.stageCode, activeWorkflowRole) && !['approved', 'not_started'].includes(toText(stage.status, 'not_started')),
  };
}

function workflowPublishPayload(config) {
  return {
    [`${config.key}_status`]: 'published',
    [`${config.key}_target`]: config.targetLabel,
    [`${config.key}_publishedAt`]: new Date().toISOString(),
    [`${config.key}_publishedBy`]: currentAuthContext().userName,
    [`${config.key}_note`]: `${config.title}已发布至${config.targetLabel}`,
    note: `${config.title}已发布至${config.targetLabel}`,
    updatedByRole: activeWorkflowRole,
  };
}

function workflowPublishDraftPatch(config) {
  const payload = workflowPublishPayload(config);
  return {
    [`${config.key}_status`]: payload[`${config.key}_status`],
    [`${config.key}_target`]: payload[`${config.key}_target`],
    [`${config.key}_publishedAt`]: payload[`${config.key}_publishedAt`],
    [`${config.key}_publishedBy`]: payload[`${config.key}_publishedBy`],
    [`${config.key}_note`]: payload[`${config.key}_note`],
    updatedByRole: payload.updatedByRole,
  };
}

function buildWorkflowBomSheetPreview(record) {
  const extract = getActiveBomAutoExtract();
  const allRows = safeArray(extract?.lineItems);
  const harnessId = toText(record?.harnessId, '');
  const previewRows = allRows.filter((row) => toText(row?.harnessId, '') === harnessId);
  const wireCount = previewRows.filter((row) => isActiveBomWireItem(row)).length;
  const connectorCount = previewRows.filter((row) => isActiveBomConnectorItem(row)).length;
  const supplierCount = new Set(previewRows.map((row) => toText(row?.supplier, '')).filter(Boolean)).size;
  return {
    hasSource: !!extract?.hasSource,
    sourceLabel: toText(extract?.sourceLabel, ''),
    sourceSheetName: toText(extract?.sourceSheetName, ''),
    rowCount: previewRows.length,
    wireCount,
    connectorCount,
    supplierCount,
    rows: previewRows.slice(0, 18),
  };
}

function workflowFlowOverviewHtml(snapshot, selectedRecord) {
  const stageCountMap = safeArray(snapshot?.records).reduce((acc, record) => {
    const key = toText(record?.displayStageCode, '');
    if (!key) return acc;
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  return `
    <div class="workflow-flow-track">
      ${WORKFLOW_STAGE_DEFS.map((stage, index) => {
        const stageState = selectedRecord ? workflowStageStatus(selectedRecord, stage.stageCode) : {};
        const completion = selectedRecord ? workflowStageCompletion(selectedRecord, stage.stageCode) : { filled: 0, total: 0 };
        const progress = completion.total ? completion.filled / completion.total : (toText(stageState.status, '') === 'approved' ? 1 : 0);
        const tone = stage.stageCode === selectedRecord?.displayStageCode
          ? 'is-current'
          : (toText(stageState.status, '') === 'approved' ? 'is-done' : '');
        return `
          <div class="workflow-flow-segment">
            <article class="workflow-flow-node ${tone}">
              <span class="workflow-flow-index">${String(index + 1).padStart(2, '0')}</span>
              <strong>${escapeHtml(stage.stageLabel)}</strong>
              <span>${escapeHtml(stage.ownerRoleCodes.map((role) => workflowRoleLabel(role)).join(' / ') || '-')}</span>
              <div class="workflow-flow-meta">
                <em>${fmtInt(stageCountMap[stage.stageCode] || 0)} 条记录</em>
                <em>${escapeHtml(selectedRecord ? workflowStatusLabel(stageState.status || 'not_started') : '未选记录')}</em>
              </div>
              <div class="workflow-flow-progress"><span style="width:${Math.max(0, Math.min(progress, 1)) * 100}%"></span></div>
            </article>
            ${index < WORKFLOW_STAGE_DEFS.length - 1 ? '<div class="workflow-flow-connector" aria-hidden="true"></div>' : ''}
          </div>
        `;
      }).join('')}
    </div>
  `.trim();
}

function workflowDocumentPanelHtml(record, config, extra = {}) {
  const stage = workflowStageStatus(record, config.stageCode);
  const payload = workflowStagePayload(record, config.stageCode);
  const completion = workflowStageCompletion(record, config.stageCode);
  const publish = workflowPublicationState(record, config);
  const previewRows = workflowFieldDefsForStage(config.stageCode)
    .slice(0, 4)
    .map((field) => {
      const value = toText(payload[field.fieldCode], '');
      return `
        <div class="workflow-doc-line">
          <span>${escapeHtml(field.fieldLabel)}</span>
          <strong>${escapeHtml(value || '待填写')}</strong>
        </div>
      `;
    }).join('');
  return `
    <article class="card workflow-doc-card">
      <div class="workflow-doc-head">
        <div>
          <h4>${escapeHtml(config.title)}</h4>
          <p>${escapeHtml(extra.description || config.description || '')}</p>
        </div>
        <span class="workflow-doc-status">${escapeHtml(workflowStatusLabel(stage.status || 'not_started'))}</span>
      </div>
      <div class="workflow-doc-summary">
        <span>完成度 ${completion.filled}/${completion.total || 0}</span>
        <span>${escapeHtml(config.targetLabel)}</span>
      </div>
      <div class="workflow-doc-lines">${previewRows || '<div class="workflow-empty">当前阶段还没有可展示字段</div>'}</div>
      <div class="workflow-doc-publish">
        <span>${publish.status === 'published' ? `已发布 · ${toText(publish.publishedAt, '-')} · ${toText(publish.publishedBy, '-')}` : '未发布'}</span>
        ${publish.canPublish ? `<button class="button ghost" type="button" data-wf-publish-action="publish" data-wf-record-id="${escapeHtml(record.recordId)}" data-wf-publish-key="${escapeHtml(config.key)}"> ${escapeHtml(config.buttonLabel)} </button>` : ''}
      </div>
      ${publish.note ? `<div class="workflow-doc-note">${escapeHtml(publish.note)}</div>` : ''}
    </article>
  `.trim();
}

function workflowBomSheetHtml(record) {
  if (!record) {
    return '<article class="card workflow-inline-sheet-card"><div class="workflow-empty">请选择一条记录查看单线束 BOM Sheet。</div></article>';
  }
  const preview = buildWorkflowBomSheetPreview(record);
  const bomConfig = WORKFLOW_PUBLICATION_CONFIGS.find((item) => item.key === 'bom_release');
  const publish = bomConfig ? workflowPublicationState(record, bomConfig) : null;
  return `
    <article class="card workflow-inline-sheet-card">
      <div class="workflow-inline-sheet-head">
        <div>
          <h4>${escapeHtml(record.harnessId)} · BOM Sheet</h4>
          <p>${escapeHtml(preview.hasSource ? `${preview.sourceLabel} / ${preview.sourceSheetName}` : '当前没有可用 BOM Sheet 源数据')}</p>
        </div>
        <div class="workflow-inline-sheet-side">
          <div class="workflow-inline-sheet-stats">
          <span>${fmtInt(preview.rowCount)} 行</span>
          <span>导线 ${fmtInt(preview.wireCount)}</span>
          <span>连接器 ${fmtInt(preview.connectorCount)}</span>
          <span>供应商 ${fmtInt(preview.supplierCount)}</span>
          </div>
          ${publish ? `
            <div class="workflow-inline-sheet-actions">
              <span class="workflow-inline-sheet-status">${escapeHtml(publish.status === 'published' ? `宸插彂甯?路 ${toText(publish.publishedAt, '-')}` : '鏈彂甯?')}</span>
              ${publish.canPublish ? `<button class="button ghost" type="button" data-wf-publish-action="publish" data-wf-record-id="${escapeHtml(record.recordId)}" data-wf-publish-key="bom_release">鍦?Sheet 鍐呭彂甯?BOM</button>` : ''}
            </div>
          ` : ''}
        </div>
      </div>
      ${preview.rows.length ? `
        <div class="table-wrap workflow-inline-sheet-wrap">
          <table class="workflow-inline-sheet-table">
            <thead>
              <tr>
                <th>行</th>
                <th>线束号</th>
                <th>零件号</th>
                <th>零件名称</th>
                <th>数量</th>
                <th>单位</th>
                <th>供应商</th>
                <th>备注</th>
              </tr>
            </thead>
            <tbody>
              ${preview.rows.map((row) => `
                <tr>
                  <td>${fmtInt(row.rowIndex || 0)}</td>
                  <td>${escapeHtml(row.harnessId || '-')}</td>
                  <td>${escapeHtml(row.partNumber || '-')}</td>
                  <td>${escapeHtml(row.partName || '-')}</td>
                  <td>${fmtMaybeNumber(row.quantity, 3)}</td>
                  <td>${escapeHtml(row.unit || '-')}</td>
                  <td>${escapeHtml(row.supplier || '-')}</td>
                  <td>${escapeHtml(row.remark || '-')}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      ` : '<div class="workflow-empty">当前活动 BOM 中还没有识别到这条线束的明细行。</div>'}
    </article>
  `.trim();
}

function quoteFinancialVersion() {
  return safeObject(FINANCIAL_VERSIONS?.versions?.quote);
}

function buildProjectEvaluationRows(model, previewSummary, recoverySummary) {
  const annualPreview = safeArray(previewSummary?.annual).length ? safeArray(previewSummary.annual) : safeArray(model?.annual);
  const quoteVersion = quoteFinancialVersion();
  const annualFinancial = safeObject(quoteVersion.annual);
  const years = safeArray(quoteVersion.years).length
    ? safeArray(quoteVersion.years)
    : annualPreview.map((row) => row?.year).filter(Boolean);
  const totalVolume = years.reduce((sum, _, index) => sum + numberOr(annualPreview[index]?.volume, safeArray(quoteVersion.volumes)[index] || 0), 0);
  const revenuePerSet = numberOr(previewSummary?.unit?.revenuePerSet, model?.portfolioSummary?.unit?.revenue || 0);
  const recoveryPerSet = numberOr(previewSummary?.unit?.projectedRecoveryPerSet, recoverySummary?.totalProjectedRecoveryPerSet || 0);
  const baseProfitPerSet = numberOr(previewSummary?.unit?.baseProfitPerSet, model?.portfolioSummary?.unit?.profit || model?.avgProfit || 0);
  const adjustedProfitPerSet = numberOr(previewSummary?.unit?.adjustedProfitPerSet, baseProfitPerSet + recoveryPerSet);
  const baseProfitSeries = years.map((_, index) => {
    const row = annualPreview[index] || {};
    const volume = numberOr(row.volume, 0);
    return volume > 0 ? numberOr(row.profit, 0) / volume : 0;
  });
  return {
    years,
    rows: [
      {
        group: '收入',
        label: '年度销量',
        type: 'int',
        years: years.map((_, index) => numberOr(annualPreview[index]?.volume, safeArray(quoteVersion.volumes)[index] || 0)),
        lifecycle: totalVolume,
        unit: null,
      },
      {
        group: '收入',
        label: 'ASP / 套',
        type: 'money',
        years: years.map((_, index) => numberOr(annualPreview[index]?.asp, safeArray(quoteVersion.asp)[index] || revenuePerSet)),
        lifecycle: null,
        unit: revenuePerSet,
      },
      {
        group: '收入',
        label: '销售收入',
        type: 'money',
        years: years.map((_, index) => numberOr(annualPreview[index]?.revenue, 0)),
        lifecycle: numberOr(previewSummary?.lifecycle?.revenue, model?.totalRevenue || 0),
        unit: revenuePerSet,
      },
      {
        group: '成本',
        label: '材料 / 套',
        type: 'money',
        years: safeArray(annualFinancial.materialPerSet).length ? safeArray(annualFinancial.materialPerSet).slice(0, years.length) : years.map(() => numberOr(model?.material, 0)),
        lifecycle: numberOr(quoteVersion?.totals?.material, numberOr(model?.material, 0) * totalVolume),
        unit: numberOr(quoteVersion?.perSet?.material, model?.material || 0),
      },
      {
        group: '成本',
        label: '直接人工 / 套',
        type: 'money',
        years: safeArray(annualFinancial.directLaborPerSet).length ? safeArray(annualFinancial.directLaborPerSet).slice(0, years.length) : years.map(() => numberOr(model?.directLabor, 0)),
        lifecycle: numberOr(quoteVersion?.totals?.directLabor, numberOr(model?.directLabor, 0) * totalVolume),
        unit: numberOr(quoteVersion?.perSet?.directLabor, model?.directLabor || 0),
      },
      {
        group: '成本',
        label: '制造费 / 套',
        type: 'money',
        years: safeArray(annualFinancial.manufacturingPerSet).length ? safeArray(annualFinancial.manufacturingPerSet).slice(0, years.length) : years.map(() => numberOr(model?.manufacturing, 0)),
        lifecycle: numberOr(quoteVersion?.totals?.manufacturing, numberOr(model?.manufacturing, 0) * totalVolume),
        unit: numberOr(quoteVersion?.perSet?.manufacturing, model?.manufacturing || 0),
      },
      {
        group: '成本',
        label: '包装物流 / 套',
        type: 'money',
        years: safeArray(annualFinancial.packagingPerSet).length ? safeArray(annualFinancial.packagingPerSet).slice(0, years.length) : years.map(() => numberOr(model?.packaging, 0)),
        lifecycle: numberOr(quoteVersion?.totals?.packaging, numberOr(model?.packaging, 0) * totalVolume),
        unit: numberOr(quoteVersion?.perSet?.packaging, model?.packaging || 0),
      },
      {
        group: '成本',
        label: '设备摊销 / 套',
        type: 'money',
        years: safeArray(annualFinancial.equipmentPerSet).length ? safeArray(annualFinancial.equipmentPerSet).slice(0, years.length) : years.map(() => numberOr(model?.equipment, 0)),
        lifecycle: numberOr(quoteVersion?.totals?.equipment, numberOr(model?.equipment, 0) * totalVolume),
        unit: numberOr(quoteVersion?.perSet?.equipment, model?.equipment || 0),
      },
      {
        group: '成本',
        label: '研发 / 套',
        type: 'money',
        years: safeArray(annualFinancial.rndPerSet).length ? safeArray(annualFinancial.rndPerSet).slice(0, years.length) : years.map(() => numberOr(model?.rnd, 0)),
        lifecycle: numberOr(quoteVersion?.totals?.rnd, numberOr(model?.rnd, 0) * totalVolume),
        unit: numberOr(quoteVersion?.perSet?.rnd, model?.rnd || 0),
      },
      {
        group: '结果',
        label: '经营利润 / 套',
        type: 'money',
        years: baseProfitSeries,
        lifecycle: numberOr(previewSummary?.lifecycle?.baseProfit, model?.totalProfit || 0),
        unit: baseProfitPerSet,
        tone: 'profit',
      },
      {
        group: '结果',
        label: '回收影响 / 套',
        type: 'money',
        years: years.map(() => recoveryPerSet),
        lifecycle: recoveryPerSet * totalVolume,
        unit: recoveryPerSet,
        tone: 'profit',
      },
      {
        group: '结果',
        label: '实际执行利润 / 套',
        type: 'money',
        years: baseProfitSeries.map((value) => value + recoveryPerSet),
        lifecycle: numberOr(previewSummary?.lifecycle?.adjustedProfit, adjustedProfitPerSet * totalVolume),
        unit: adjustedProfitPerSet,
        tone: 'profit',
      },
    ],
  };
}

function formatProjectEvaluationCell(value, type) {
  if (value === null || value === undefined) return '-';
  if (type === 'int') return fmtInt(value);
  return fmtMoney(value);
}

function workflowRecordListHtml(records, selectedRecord) {
  if (!safeArray(records).length) {
    return '<div class="workflow-empty">当前筛选条件下暂无工作流记录。</div>';
  }
  return `
    <div class="workflow-record-list">
      ${safeArray(records).map((record) => {
        const completion = workflowStageCompletion(record, record.displayStageCode);
        const latestAudit = safeArray(record?.auditLog).slice(-1)[0] || {};
        const updatedAt = toText(latestAudit.createdAt || record?.updatedAt, '');
        return `
          <button
            type="button"
            class="workflow-record-list-item${selectedRecord?.recordId === record.recordId ? ' is-active' : ''}"
            data-wf-record-id="${escapeHtml(record.recordId)}"
          >
            <div class="workflow-record-list-head">
              <strong>${escapeHtml(record.harnessId || '-')}</strong>
              <span>${escapeHtml(record.quoteType === 'change' ? '变更报价' : '项目报价')}</span>
            </div>
            <div class="workflow-record-list-title">${escapeHtml(record.harnessName || '未命名线束')}</div>
            <div class="workflow-record-list-meta">
              <span>${escapeHtml(record.quoteVersionId || '-')}</span>
              <span>${escapeHtml(record.displayStageLabel || workflowStageMeta(record.displayStageCode)?.stageLabel || '-')}</span>
              <span>${escapeHtml(workflowStatusLabel(record.displayStatus || record.overallStatus || 'draft'))}</span>
            </div>
            <div class="workflow-record-list-foot">
              <span>字段完成 ${completion.filled}/${completion.total || 0}</span>
              <span>${escapeHtml(updatedAt || '待更新')}</span>
            </div>
          </button>
        `;
      }).join('')}
    </div>
  `.trim();
}

function workflowAlertRailHtml(alertRows) {
  if (!safeArray(alertRows).length) {
    return '<div class="workflow-empty">当前没有待处理提醒。</div>';
  }
  return `
    <div class="workflow-alert-list">
      ${safeArray(alertRows).map((alert) => `
        <article class="workflow-alert-item ${toText(alert.level, 'info') === 'warning' ? 'is-warning' : 'is-info'}">
          <strong>${escapeHtml(alert.title)}</strong>
          <span>${escapeHtml(alert.message)}</span>
        </article>
      `).join('')}
    </div>
  `.trim();
}

function workflowThresholdRailHtml(rows) {
  if (!safeArray(rows).length) {
    return '<div class="workflow-empty">当前没有可跟踪的承载线束阈值。</div>';
  }
  return `
    <div class="workflow-threshold-list">
      ${safeArray(rows).map((row) => `
        <article class="workflow-threshold-item">
          <div class="workflow-threshold-head">
            <strong>${escapeHtml(row.harnessId || '-')}</strong>
            <span>${escapeHtml(row.thresholdReached ? '已触发' : '跟踪中')}</span>
          </div>
          <div class="workflow-threshold-meta">
            <span>${escapeHtml(row.harnessName || '-')}</span>
            <span>出货 ${fmtInt(row.deliveredSets || 0)} / ${fmtInt(row.recoveryLimitSets || 0)} 套</span>
          </div>
          <div class="workflow-progress"><span style="width:${Math.max(0, Math.min(numberOr(row.progressRatio, 0), 1)) * 100}%"></span></div>
          <div class="workflow-threshold-foot">
            <span>已回收 ${fmtMoney(row.recoveredAmount || 0)}</span>
            <span>未回收 ${fmtMoney(row.remainingAmount || 0)}</span>
          </div>
        </article>
      `).join('')}
    </div>
  `.trim();
}

function workflowTaskRailHtml(taskLanes) {
  const lanes = safeArray(taskLanes).filter((lane) => safeArray(lane?.items).length);
  if (!lanes.length) {
    return '<div class="workflow-empty">当前没有待推进任务。</div>';
  }
  return `
    <div class="workflow-task-rail">
      ${lanes.map((lane) => `
        <section class="workflow-task-rail-lane">
          <div class="workflow-task-rail-head">
            <strong>${escapeHtml(lane.label || '-')}</strong>
            <span>${fmtInt(safeArray(lane.items).length)}</span>
          </div>
          <div class="workflow-task-list">
            ${safeArray(lane.items).map((task) => `
              <article class="workflow-task-card ${workflowTaskToneClass(task.status)}">
                <div class="workflow-task-title">${escapeHtml(task.title || '-')}</div>
                <div class="workflow-task-meta">
                  <span>${escapeHtml(task.owner || '-')}</span>
                  <span>${escapeHtml(task.due || '-')}</span>
                  <span>${escapeHtml(task.status || '-')}</span>
                </div>
                <div class="workflow-task-note">${escapeHtml(task.note || '')}</div>
              </article>
            `).join('')}
          </div>
        </section>
      `).join('')}
    </div>
  `.trim();
}

function workflowActionButtons(record, trackingRows) {
  const stageCode = record.displayStageCode;
  const canEdit = workflowCanEditStage(record, stageCode, activeWorkflowRole);
  if (stageCode === 'pm_cost_review') {
    if (!canEdit) return '<div class="workflow-empty">当前角色仅可查看项目经理评审池</div>';
    const pending = toText(record.pendingReviewStageCode, '');
    const pendingIndex = WORKFLOW_STAGE_DEFS.findIndex((item) => item.stageCode === pending);
    const returnTargets = WORKFLOW_STAGE_DEFS.slice(0, Math.max(0, pendingIndex) + 1).filter((item) => item.stageCode !== 'pm_cost_review' && item.stageCode !== 'commercial_quote' && item.stageCode !== 'execution_recovery');
    return `
      <div class="workflow-action-row">
        <button class="button primary" type="button" data-wf-action="approve" data-wf-record-id="${escapeHtml(record.recordId)}">通过并推进</button>
        <button class="button ghost" type="button" data-wf-action="return" data-wf-record-id="${escapeHtml(record.recordId)}">退回前序阶段</button>
      </div>
      <label class="field quote-inline-field">
        <span>退回目标阶段</span>
        <select data-wf-return-stage="${escapeHtml(record.recordId)}">
          ${returnTargets.map((item) => `<option value="${escapeHtml(item.stageCode)}">${escapeHtml(item.stageLabel)}</option>`).join('')}
        </select>
      </label>
    `;
  }
  if (stageCode === 'execution_recovery') {
    if (!canEdit) return '<div class="workflow-empty">当前角色仅可查看执行跟踪</div>';
    return `
      <div class="workflow-action-row">
        <button class="button primary" type="button" data-wf-action="save" data-wf-record-id="${escapeHtml(record.recordId)}">更新执行状态</button>
        <button class="button ghost" type="button" data-wf-action="close" data-wf-record-id="${escapeHtml(record.recordId)}">手工关闭</button>
      </div>
    `;
  }
  if (!canEdit) return '<div class="workflow-empty">当前角色仅可查看该阶段数据</div>';
  return `
    <div class="workflow-action-row">
      <button class="button ghost" type="button" data-wf-action="save" data-wf-record-id="${escapeHtml(record.recordId)}">保存草稿</button>
      <button class="button primary" type="button" data-wf-action="submit" data-wf-record-id="${escapeHtml(record.recordId)}">${stageCode === 'commercial_quote' ? '提交进入执行' : '提报至项目经理评审池'}</button>
    </div>
  `;
}

function workflowDetailHtml(record, trackingRows) {
  if (!record) {
    return '<article class="card workflow-detail-card"><div class="workflow-empty">请选择一条记录查看阶段详情</div></article>';
  }
  const stageCode = record.displayStageCode;
  const fields = workflowVisibleFieldDefs(record, stageCode, activeWorkflowRole);
  const completion = workflowCompletion(record, stageCode, activeWorkflowRole);
  const buffer = getWorkflowStageBuffer(record, stageCode);
  const tracking = workflowTrackingSummary(record, trackingRows);
  const stageTimeline = safeArray(record.stageStates).map((stage) => {
    const isCurrent = stage.stageCode === stageCode;
    return `<span class="workflow-stage-chip${isCurrent ? ' is-current' : ''}">${escapeHtml(stage.stageLabel)} · ${escapeHtml(workflowStatusLabel(stage.status))}</span>`;
  }).join('');
  const auditRows = safeArray(record.auditLog).slice(-6).reverse();
  return `
    <article class="card workflow-detail-card">
      <div class="workflow-detail-head">
        <div>
          <h4>${escapeHtml(record.harnessId)} · ${escapeHtml(record.harnessName || '未命名线束')}</h4>
          <p class="section-note">${escapeHtml(record.quoteType === 'change' ? `变更报价，基线 ${record.baselineQuoteVersion || '待填写'}` : `项目报价，版本 ${record.quoteVersionId || '-'}`)}</p>
        </div>
        <div class="workflow-detail-status">${escapeHtml(record.displayStageLabel)} / ${escapeHtml(workflowStatusLabel(record.displayStatus || record.overallStatus))}</div>
      </div>
      <div class="workflow-stage-chip-row">${stageTimeline}</div>
      <div class="workflow-detail-grid">
        <div class="workflow-detail-section">
          <div class="workflow-detail-title">字段完成度</div>
          <div class="workflow-detail-metric">${completion.total ? `${completion.filled} / ${completion.total}` : '当前角色无可编辑字段'}</div>
          <div class="workflow-field-list">
            ${fields.length ? fields.map((field) => `
              <label class="field workflow-field-item">
                <span>${escapeHtml(field.fieldLabel)}</span>
                ${field.inputType === 'textarea'
                  ? `<textarea data-wf-field="${escapeHtml(field.fieldCode)}" data-wf-record-id="${escapeHtml(record.recordId)}" data-wf-stage-code="${escapeHtml(stageCode)}">${escapeHtml(toText(buffer[field.fieldCode], ''))}</textarea>`
                  : `<input type="${field.inputType === 'number' ? 'number' : 'text'}" data-wf-field="${escapeHtml(field.fieldCode)}" data-wf-record-id="${escapeHtml(record.recordId)}" data-wf-stage-code="${escapeHtml(stageCode)}" value="${escapeHtml(toText(buffer[field.fieldCode], ''))}" />`
                }
                <em>${escapeHtml(field.note || '')}</em>
              </label>
            `).join('') : '<div class="workflow-empty">当前角色在该阶段没有可编辑字段</div>'}
          </div>
          ${workflowActionButtons(record, trackingRows)}
        </div>
        <div class="workflow-detail-section">
          <div class="workflow-detail-title">依赖与联动</div>
          <div class="workflow-detail-kv">
                <div><span>责任角色</span><strong>${escapeHtml(safeArray(record.currentOwnerRoles).join(' / ') || '-')}</strong></div>
                <div><span>影响模块</span><strong>${escapeHtml(safeArray(record.impactedModules).join(' / ') || '项目初始')}</strong></div>
            <div><span>有效销售规则</span><strong>${escapeHtml(String(workflowEffectiveRulesForHarness(record.harnessId).length))}</strong></div>
            <div><span>已出货 / 阈值</span><strong>${escapeHtml(`${fmtInt(tracking.deliveredSets || 0)} / ${fmtInt(tracking.recoveryLimitSets || 0)}`)}</strong></div>
            <div><span>已回收 / 待回收</span><strong>${escapeHtml(`${fmtMoney(tracking.recoveredAmount || 0)} / ${fmtMoney(tracking.remainingAmount || 0)}`)}</strong></div>
          </div>
          <div class="workflow-detail-title">日志</div>
          <div class="workflow-log-list">
            ${auditRows.length ? auditRows.map((item) => `
              <article class="workflow-log-item">
                <strong>${escapeHtml(item.action || 'workflow')}</strong>
                <span>${escapeHtml(item.note || item.stageCode || '-')}</span>
                <em>${escapeHtml(item.createdAt || '-')}</em>
              </article>
            `).join('') : '<div class="workflow-empty">当前还没有审批日志</div>'}
          </div>
        </div>
      </div>
    </article>
  `;
}

function workflowSummaryCards(snapshot, trackingRows, alertRows) {
  const records = safeArray(snapshot.records);
  const pendingReviewCount = records.filter((record) => record.displayStageCode === 'pm_cost_review').length;
  const activeExecutionCount = records.filter((record) => record.displayStageCode === 'execution_recovery').length;
  const commercialCount = records.filter((record) => record.displayStageCode === 'commercial_quote').length;
  const shippedSets = trackingRows.reduce((sum, row) => sum + numberOr(row.deliveredSets, 0), 0);
  const recoveredAmount = trackingRows.reduce((sum, row) => sum + numberOr(row.recoveredAmount, 0), 0);
  return [
    { label: '工作流记录', value: fmtInt(records.length), meta: '单线束号 × 报价版本' },
    { label: '待项目经理评审', value: fmtInt(pendingReviewCount), meta: '1-4阶段提报池' },
    { label: '待商务提交', value: fmtInt(commercialCount), meta: '需补齐回收规则与触发条件' },
    { label: '执行中', value: fmtInt(activeExecutionCount), meta: '销售与项目经理长期跟踪' },
    { label: '累计出货', value: fmtInt(shippedSets), meta: '按承载线束号回填' },
    { label: '累计回收', value: fmtMoney(recoveredAmount), meta: `${fmtInt(alertRows.length)} 条提醒` },
  ];
}

function bindWorkflowWorkspaceActions() {
  if (!el.workflowWorkspacePage || el.workflowWorkspacePage.dataset.bound === 'true') return;
  el.workflowWorkspacePage.dataset.bound = 'true';
  el.workflowWorkspacePage.addEventListener('click', (event) => {
    const nav = event.target.closest('[data-workflow-nav]');
    if (nav) {
      const action = nav.dataset.workflowNav;
      let nextPage = 'workflow';
      let targetId = '';
      if (action === 'profit-summary') {
        nextPage = 'profit';
        targetId = 'projectProfitSummarySection';
      } else if (action === 'quote-control') {
        nextPage = 'profit';
        targetId = 'quoteControlStripSection';
      } else if (action === 'recovery-center') {
        nextPage = 'profit';
        targetId = 'recoveryTriggerMount';
      } else if (action === 'data-management') {
        nextPage = 'data';
        targetId = 'managementTopGrid';
      }
      setWorkspacePage(nextPage);
      const target = targetId ? document.getElementById(targetId) : null;
      if (target && typeof target.scrollIntoView === 'function') {
        target.scrollIntoView({ block: 'start', behavior: 'smooth' });
      }
      return;
    }
    const publishButton = event.target.closest('[data-wf-publish-action]');
    if (publishButton) {
      const publishKey = publishButton.getAttribute('data-wf-publish-key');
      const recordId = publishButton.getAttribute('data-wf-record-id');
      const config = WORKFLOW_PUBLICATION_CONFIGS.find((item) => item.key === publishKey);
      const model = window._g281LastModel || {};
      const snapshot = latestWorkflowSnapshot || getWorkflowSnapshot(model);
      const record = safeArray(snapshot.records).find((item) => item.recordId === recordId);
      const repo = getWorkflowRepo();
      if (!config || !record || !repo) return;
      try {
        resetWorkflowUiErrors();
        const publishState = workflowPublicationState(record, config);
        if (!publishState.canPublish) {
          throw new Error('褰撳墠闃舵鏆備笉鍏佽鍙戝竷');
        }
        repo.saveStageDraft(record.recordId, config.stageCode, {
          ...getWorkflowStageBuffer(record, config.stageCode),
          ...workflowPublishPayload(config),
        });
        clearWorkflowStageBuffer(record.recordId, config.stageCode);
        latestWorkflowSnapshot = getWorkflowSnapshot(model);
        queueRender();
      } catch (error) {
        setWorkflowUiError(error?.message || '璧勬枡鍙戝竷澶辫触');
        queueRender();
      }
      return;
    }
    const recordButton = event.target.closest('.workflow-record-list-item[data-wf-record-id]');
    if (recordButton && !event.target.closest('[data-wf-action]')) {
      setSelectedWorkflowRecordId(recordButton.getAttribute('data-wf-record-id'));
      queueRender();
      return;
    }
    const actionButton = event.target.closest('[data-wf-action]');
    if (!actionButton) return;
    const recordId = actionButton.getAttribute('data-wf-record-id');
    const snapshot = latestWorkflowSnapshot || getWorkflowSnapshot(window._g281LastModel || {});
    const record = safeArray(snapshot.records).find((item) => item.recordId === recordId);
    if (!record) return;
    const repo = getWorkflowRepo();
    if (!repo) return;
    const model = window._g281LastModel || {};
    const action = actionButton.getAttribute('data-wf-action');
    const stageCode = record.displayStageCode;
    const buffer = getWorkflowStageBuffer(record, stageCode);
    try {
      resetWorkflowUiErrors();
      if (action === 'save') {
        if (stageCode === 'execution_recovery' && typeof repo.updateExecutionStatus === 'function') {
          const executionValues = workflowExecutionDraftValues(record, buffer, model);
          workflowSyncTrackingRecord(record, {
            deliveredSets: executionValues.deliveredSets,
            recoveredAmount: executionValues.recoveredAmount,
            remainingAmount: executionValues.remainingAmount,
          }, model);
          const linked = workflowSyncLinkedArtifacts(record, model);
          repo.updateExecutionStatus(record.recordId, {
            deliveredSets: executionValues.deliveredSets,
            recoveredAmount: executionValues.recoveredAmount,
            remainingAmount: executionValues.remainingAmount,
            note: toText(buffer.invoice_reprice_action, ''),
            updatedBy: activeWorkflowRole,
            stageStatus: 'active',
            status: 'in_progress',
            lastTaskHint: toText(buffer.invoice_reprice_action, ''),
            ...linked,
          });
        } else {
          repo.saveStageDraft(record.recordId, stageCode, {
            ...buffer,
            updatedByRole: activeWorkflowRole,
          });
        }
        clearWorkflowStageBuffer(record.recordId, stageCode);
      } else if (action === 'submit') {
        if (stageCode === 'commercial_quote') {
          latestSalesRuleSnapshot = getSalesRuleSnapshot(model);
          const effectiveRules = workflowRuleRowsForHarness(record.harnessId);
          const linked = {
            linkedSalesRuleIds: Array.from(new Set(effectiveRules.map((rule) => toText(rule?.ruleId, '')).filter(Boolean))),
            linkedTaskIds: safeArray(record.linkedTaskIds),
            linkedRecoveryHarnessId: toText(record.harnessId, ''),
          };
          repo.submitStage(record.recordId, stageCode, {
            ...buffer,
            submittedByRole: activeWorkflowRole,
            ...linked,
            requirementsComplete: effectiveRules.length > 0 && !!toText(buffer.sales_rule, '') && !!toText(buffer.carrier_harness_ids, '') && !!toText(buffer.invoice_trigger, '') && !!toText(buffer.repricing_trigger, ''),
          });
          if (typeof repo.updateExecutionStatus === 'function') {
            repo.updateExecutionStatus(record.recordId, {
              stageStatus: 'active',
              status: 'in_progress',
              updatedBy: activeWorkflowRole,
              lastTaskHint: toText(buffer.invoice_reprice_action, ''),
              ...linked,
            });
          }
        } else {
          repo.submitStage(record.recordId, stageCode, {
            ...buffer,
            submittedByRole: activeWorkflowRole,
          });
        }
        clearWorkflowStageBuffer(record.recordId, stageCode);
      } else if (action === 'approve') {
        repo.reviewStage(record.recordId, 'pm_cost_review', {
          decision: 'approve',
          reviewer: activeWorkflowRole,
          note: toText(buffer.pm_review_summary, ''),
        });
        clearWorkflowStageBuffer(record.recordId, stageCode);
      } else if (action === 'return') {
        const select = el.workflowWorkspacePage.querySelector(`[data-wf-return-stage="${CSS.escape(record.recordId)}"]`);
        repo.reviewStage(record.recordId, 'pm_cost_review', {
          decision: 'return',
          reviewer: activeWorkflowRole,
          note: toText(buffer.pm_review_summary, ''),
          returnToStageCode: select?.value || 'harness_development',
        });
        clearWorkflowStageBuffer(record.recordId, stageCode);
      } else if (action === 'close' && typeof repo.updateExecutionStatus === 'function') {
        const executionValues = workflowExecutionDraftValues(record, buffer, model);
        workflowSyncTrackingRecord(record, {
          deliveredSets: executionValues.deliveredSets,
          recoveredAmount: executionValues.recoveredAmount,
          remainingAmount: executionValues.remainingAmount,
        }, model);
        const linked = workflowSyncLinkedArtifacts(record, model);
        repo.updateExecutionStatus(record.recordId, {
          deliveredSets: executionValues.deliveredSets,
          recoveredAmount: executionValues.recoveredAmount,
          remainingAmount: executionValues.remainingAmount,
          status: 'approved',
          stageStatus: 'approved',
          updatedBy: activeWorkflowRole,
          lastTaskHint: toText(buffer.invoice_reprice_action, ''),
          ...linked,
        });
        clearWorkflowStageBuffer(record.recordId, stageCode);
      }
      latestSalesRuleSnapshot = getSalesRuleSnapshot(model);
      latestWorkflowSnapshot = getWorkflowSnapshot(model);
      queueRender();
    } catch (error) {
      setWorkflowUiError(error?.message || '工作流操作失败');
      queueRender();
    }
  });
  el.workflowWorkspacePage.addEventListener('change', (event) => {
    const filter = event.target.closest('[data-wf-filter]');
    if (filter) {
      updateWorkflowFilter(filter.getAttribute('data-wf-filter'), filter.value);
      queueRender();
      return;
    }
    const field = event.target.closest('[data-wf-field]');
    if (field) {
      updateWorkflowStageBuffer(
        field.getAttribute('data-wf-record-id'),
        field.getAttribute('data-wf-stage-code'),
        field.getAttribute('data-wf-field'),
        field.value,
      );
    }
  });
}

function workflowRecordRailHtml(records, selectedRecord) {
  if (!safeArray(records).length) {
    return '<div class="workflow-empty">当前筛选条件下没有报价记录。</div>';
  }
  return `
    <div class="workflow-record-list">
      ${records.map((record) => `
        <button
          type="button"
          class="workflow-record-item${selectedRecord?.recordId === record.recordId ? ' is-active' : ''}"
          data-wf-record-id="${escapeHtml(record.recordId)}"
        >
          <div class="workflow-record-head">
            <strong class="workflow-record-title">${escapeHtml(record.harnessId || '-')}</strong>
            <span class="workflow-record-status">${escapeHtml(workflowStatusLabel(record.displayStatus || record.overallStatus))}</span>
          </div>
          <div class="workflow-record-subtitle">${escapeHtml(record.harnessName || '未命名线束')}</div>
          <div class="workflow-record-meta">
            <span>${escapeHtml(record.quoteType === 'change' ? '变更报价' : '项目报价')}</span>
            <span>${escapeHtml(record.quoteVersionId || '-')}</span>
            <span>${escapeHtml(record.displayStageLabel || '-')}</span>
          </div>
          <div class="workflow-record-meta">
            <span>${escapeHtml(safeArray(record.currentOwnerRoles).map((role) => workflowRoleLabel(role)).join(' / ') || '-')}</span>
            <span>${escapeHtml(safeArray(record.impactedModules).join(' / ') || '首轮报价')}</span>
          </div>
        </button>
      `).join('')}
    </div>
  `.trim();
}

function workflowRecoveryPanelsHtml(thresholdRows, alertRows) {
  return `
    <div class="workflow-rail-stack">
      <article class="card workflow-side-card">
        <div class="project-summary-caption">
          <div class="project-summary-caption-title">执行回收联动区</div>
          <div class="project-summary-caption-meta">按实际承载线束号跟踪出货、回收、阈值与开票/调价动作</div>
        </div>
        <div class="workflow-threshold-list">
          ${thresholdRows.length ? thresholdRows.map((row) => `
            <article class="workflow-threshold-item">
              <div class="workflow-threshold-head">
                <strong>${escapeHtml(row.harnessId)}</strong>
                <span>${escapeHtml(row.thresholdReached ? '已触发' : '跟踪中')}</span>
              </div>
              <div class="workflow-threshold-meta">
                <span>${escapeHtml(row.harnessName || '-')}</span>
                <span>出货 ${fmtInt(row.deliveredSets)} / ${fmtInt(row.recoveryLimitSets || 0)} 套</span>
              </div>
              <div class="workflow-progress"><span style="width:${Math.max(0, Math.min(numberOr(row.progressRatio, 0), 1)) * 100}%"></span></div>
              <div class="workflow-threshold-foot">
                <span>已回收 ${fmtMoney(row.recoveredAmount)}</span>
                <span>待回收 ${fmtMoney(row.remainingAmount)}</span>
              </div>
            </article>
          `).join('') : '<div class="workflow-empty">当前没有可跟踪的承载线束阈值。</div>'}
        </div>
      </article>
      <article class="card workflow-side-card">
        <div class="project-summary-caption">
          <div class="project-summary-caption-title">提醒队列</div>
          <div class="project-summary-caption-meta">规则缺失、阈值命中、回收异常统一进入这里</div>
        </div>
        <div class="workflow-alert-list">
          ${alertRows.length ? alertRows.map((alert) => `
            <article class="workflow-alert-item ${toText(alert.level, 'info') === 'warning' ? 'is-warning' : 'is-info'}">
              <strong>${escapeHtml(alert.title)}</strong>
              <span>${escapeHtml(alert.message)}</span>
            </article>
          `).join('') : '<div class="workflow-empty">当前没有待处理提醒。</div>'}
        </div>
      </article>
    </div>
  `.trim();
}

function renderWorkflowWorkspaceV3(model) {
  const workflowSnapshot = latestWorkflowSnapshot || getWorkflowSnapshot(model);
  const filteredRecords = filteredWorkflowRecords(workflowSnapshot);
  const selectedRecord = selectedWorkflowRecord(workflowSnapshot);
  const trackingRows = buildWorkflowTrackingRows(model);
  const thresholdRows = trackingRows
    .filter((row) => row.recoveryLimitSets > 0 || row.deliveredSets > 0 || row.targetAmount > 0)
    .sort((left, right) => numberOr(right.progressRatio, 0) - numberOr(left.progressRatio, 0))
    .slice(0, 8);
  const alertRows = buildWorkflowAlertRows(safeObject(latestExecutionPreview), thresholdRows);
  const summaryCards = workflowSummaryCards(workflowSnapshot, trackingRows, alertRows);
  const selectedCompletion = selectedRecord
    ? workflowCompletion(selectedRecord, selectedRecord.displayStageCode, activeWorkflowRole)
    : { filled: 0, total: 0 };
  el.workflowWorkspacePage.innerHTML = `
    <div class="workflow-workspace workflow-flow-shell">
      <section class="card workflow-stage-hero">
        <div class="workflow-hero-head">
          <div class="workflow-hero-copy">
            <div class="eyebrow">WORKFLOW OVERVIEW</div>
            <h3>单线束报价流转与资料发布</h3>
            <p class="section-note">先按单线束号驱动 BOM、工艺、包装资料逐步发布，再进入项目经理评审、销售报价与执行回收。</p>
            <div class="hero-badges">
              <span class="chip"><span class="dot"></span><span>${escapeHtml(state.scenarioName || '当前场景')}</span></span>
              <span class="chip"><span class="dot alt"></span><span>${escapeHtml(authContextSummaryText())}</span></span>
              <span class="chip"><span class="dot gold"></span><span>${escapeHtml(`${filteredRecords.length} 条记录 / ${workflowSnapshot.records.length} 总记录`)}</span></span>
            </div>
          </div>
          <div class="workflow-nav-actions">
            <button class="button ghost" type="button" data-workflow-nav="profit-summary">看利润总览</button>
            <button class="button ghost" type="button" data-workflow-nav="quote-control">去报价工作台</button>
            <button class="button ghost" type="button" data-workflow-nav="recovery-center">去回收中心</button>
            <button class="button ghost" type="button" data-workflow-nav="data-management">去数据管理</button>
          </div>
        </div>
        <div class="workflow-summary-grid">
          ${summaryCards.map((card) => `
            <article class="workflow-summary-card">
              <span class="workflow-summary-label">${card.label}</span>
              <strong class="workflow-summary-value">${card.value}</strong>
              <span class="workflow-summary-meta">${card.meta}</span>
            </article>
          `).join('')}
        </div>
      </section>

      <section class="card workflow-filter-card">
        <div class="workflow-filter-grid">
          <label class="field quote-inline-field"><span>报价类型</span><select data-wf-filter="quoteType"><option value="">全部</option><option value="project"${workflowFilters.quoteType === 'project' ? ' selected' : ''}>项目报价</option><option value="change"${workflowFilters.quoteType === 'change' ? ' selected' : ''}>变更报价</option></select></label>
          <label class="field quote-inline-field"><span>报价版本</span><input type="text" data-wf-filter="quoteVersionId" value="${escapeHtml(workflowFilters.quoteVersionId)}" placeholder="版本筛选" /></label>
          <label class="field quote-inline-field"><span>线束号</span><input type="text" data-wf-filter="harnessId" value="${escapeHtml(workflowFilters.harnessId)}" placeholder="线束号筛选" /></label>
          <label class="field quote-inline-field"><span>阶段</span><select data-wf-filter="currentStageCode"><option value="">全部</option>${WORKFLOW_STAGE_DEFS.map((stage) => `<option value="${escapeHtml(stage.stageCode)}"${workflowFilters.currentStageCode === stage.stageCode ? ' selected' : ''}>${escapeHtml(stage.stageLabel)}</option>`).join('')}</select></label>
          <label class="field quote-inline-field"><span>状态</span><select data-wf-filter="overallStatus"><option value="">全部</option><option value="draft"${workflowFilters.overallStatus === 'draft' ? ' selected' : ''}>草稿</option><option value="review_pending"${workflowFilters.overallStatus === 'review_pending' ? ' selected' : ''}>待评审</option><option value="returned"${workflowFilters.overallStatus === 'returned' ? ' selected' : ''}>已退回</option><option value="active"${workflowFilters.overallStatus === 'active' ? ' selected' : ''}>执行中</option><option value="closed"${workflowFilters.overallStatus === 'closed' ? ' selected' : ''}>已关闭</option></select></label>
        </div>
        ${workflowUiErrors.length ? `<div class="workflow-inline-error">${escapeHtml(workflowUiErrors.join('；'))}</div>` : ''}
      </section>

      <section class="workflow-board-grid workflow-board-grid--top">
        <article class="card workflow-rail-card">
          <div class="project-summary-caption">
            <div class="project-summary-caption-title">报价记录轨道</div>
            <div class="project-summary-caption-meta">按线束号 × 报价版本浏览当前流转状态</div>
          </div>
          ${workflowRecordRailHtml(filteredRecords, selectedRecord)}
        </article>
        <div class="workflow-main-stack">
          <article class="card workflow-stage-overview-card">
            <div class="project-summary-caption">
              <div>
                <div class="project-summary-caption-title">流程图概览</div>
                <div class="project-summary-caption-meta">${selectedRecord ? `${selectedRecord.harnessId} · ${selectedRecord.harnessName || '未命名线束'}` : '先从左侧选择一条记录'}</div>
              </div>
              <div class="project-summary-caption-meta">${selectedRecord ? `${selectedRecord.displayStageLabel} · ${workflowStatusLabel(selectedRecord.displayStatus || selectedRecord.overallStatus)}` : '未选择记录'}</div>
            </div>
            ${workflowFlowOverviewHtml(workflowSnapshot, selectedRecord)}
            ${selectedRecord ? `
              <div class="workflow-stage-hero-grid">
                <article class="workflow-stage-hero-kpi">
                  <span>当前责任角色</span>
                  <strong>${escapeHtml(safeArray(selectedRecord.currentOwnerRoles).map((role) => workflowRoleLabel(role)).join(' / ') || '-')}</strong>
                </article>
                <article class="workflow-stage-hero-kpi">
                  <span>当前阶段完成度</span>
                  <strong>${selectedCompletion.total ? `${selectedCompletion.filled} / ${selectedCompletion.total}` : '当前角色无可编辑字段'}</strong>
                </article>
                <article class="workflow-stage-hero-kpi">
                  <span>影响模块</span>
                  <strong>${escapeHtml(safeArray(selectedRecord.impactedModules).join(' / ') || '首轮报价')}</strong>
                </article>
                <article class="workflow-stage-hero-kpi">
                  <span>关联规则 / 任务</span>
                  <strong>${fmtInt(safeArray(selectedRecord.linkedSalesRuleIds).length)} / ${fmtInt(safeArray(selectedRecord.linkedTaskIds).length)}</strong>
                </article>
              </div>
            ` : ''}
          </article>
          <div class="workflow-doc-grid">
            ${selectedRecord
              ? WORKFLOW_PUBLICATION_CONFIGS.map((config) => workflowDocumentPanelHtml(selectedRecord, config)).join('')
              : '<article class="card workflow-doc-card"><div class="workflow-empty">选择记录后，这里会直接展示 BOM、工艺、包装资料发布状态。</div></article>'}
          </div>
        </div>
      </section>

      ${workflowDetailHtml(selectedRecord, trackingRows)}

      <section class="workflow-board-grid workflow-board-grid--bottom">
        <div class="workflow-main-stack">
          ${workflowBomSheetHtml(selectedRecord)}
        </div>
        ${workflowRecoveryPanelsHtml(thresholdRows, alertRows)}
      </section>
    </div>
  `.trim();
}

function renderWorkflowWorkspace(model) {
  if (!el.workflowWorkspacePage) return;
  {
    bindWorkflowWorkspaceActions();
    const workflowSnapshot = latestWorkflowSnapshot || getWorkflowSnapshot(model);
    const filteredRecords = filteredWorkflowRecords(workflowSnapshot);
    const selectedRecord = selectedWorkflowRecord(workflowSnapshot);
    const preview = safeObject(latestExecutionPreview);
    const salesRuleSnapshot = latestSalesRuleSnapshot || getSalesRuleSnapshot(model);
    const quoteContext = safeObject(preview?.quoteContext?.quoteType ? preview.quoteContext : buildQuoteContext(model));
    const recoverySummary = safeObject(preview?.recovery);
    const trackingRows = buildWorkflowTrackingRows(model);
    const shippedSets = trackingRows.reduce((sum, row) => sum + Math.max(0, numberOr(row.deliveredSets, 0)), 0);
    const recoveredAmount = trackingRows.reduce((sum, row) => sum + Math.max(0, numberOr(row.recoveredAmount, 0)), 0);
    const targetAmount = trackingRows.reduce((sum, row) => sum + Math.max(0, numberOr(row.targetAmount, 0)), 0);
    const targetSets = trackingRows.reduce((sum, row) => sum + Math.max(0, numberOr(row.recoveryLimitSets, 0)), 0);
    const thresholdRows = trackingRows
      .filter((row) => row.recoveryLimitSets > 0 || row.deliveredSets > 0 || row.targetAmount > 0)
      .slice()
      .sort((left, right) => {
        if (left.thresholdReached !== right.thresholdReached) return left.thresholdReached ? -1 : 1;
        return numberOr(right.progressRatio, 0) - numberOr(left.progressRatio, 0);
      })
      .slice(0, 8);
    const alertRows = buildWorkflowAlertRows(preview, thresholdRows);
    const activeRuleCount = numberOr(recoverySummary?.activeRuleCount, salesRuleSnapshot?.summary?.effectiveRules || 0);
    const templateRuleCount = numberOr(recoverySummary?.templateRuleCount, salesRuleSnapshot?.summary?.templateRules || 0);
    const coveredHarnessCount = trackingRows.filter((row) => row.activeRuleCount > 0).length || numberOr(recoverySummary?.coveredHarnessCount, 0);
    const taskLanes = buildWorkflowTasks({
      quoteContext,
      shippedSets,
      activeRuleCount,
      thresholdRows,
    }, salesRuleSnapshot);
    const allTasks = taskLanes.flatMap((lane) => lane.items);
    const openTaskCount = allTasks.filter((task) => workflowTaskLaneKey(task.status) !== 'done').length;
    const summaryCards = [
      {
        label: '报价版',
        value: quoteContext.quoteType === 'change' ? '变更报价' : '项目报价',
        meta: quoteContext.quoteType === 'change'
          ? `基线 ${quoteContext.baselineQuoteVersion || '待补充'}`
          : '按报价版底座执行预演',
      },
      {
        label: '流程记录',
        value: fmtInt(filteredRecords.length),
        meta: `${fmtInt(workflowSnapshot.records.length)} 条总记录`,
      },
      {
        label: '有效规则',
        value: fmtInt(activeRuleCount),
        meta: `承载 ${fmtInt(coveredHarnessCount)} 款 / 模板 ${fmtInt(templateRuleCount)}`,
      },
      {
        label: '累计出货',
        value: fmtInt(shippedSets),
        meta: targetSets > 0 ? `回收上限 ${fmtInt(targetSets)} 套` : '按承载线束持续回填',
      },
      {
        label: '累计回收',
        value: fmtMoney(recoveredAmount),
        meta: targetAmount > 0 ? `目标 ${fmtMoney(targetAmount)}` : '待销售补齐规则',
      },
      {
        label: '提醒/任务',
        value: fmtInt(alertRows.length),
        meta: `待推进 ${fmtInt(openTaskCount)} 项`,
      },
    ];
    const documentCards = selectedRecord
      ? WORKFLOW_PUBLICATION_CONFIGS.map((config) => workflowDocumentPanelHtml(selectedRecord, config)).join('')
      : '<article class="card workflow-doc-card"><div class="workflow-empty">请选择一条记录查看资料发布与明细。</div></article>';
    el.workflowWorkspacePage.innerHTML = `
      <div class="workflow-workspace workflow-rail-layout">
        <section class="card workflow-stage-hero">
          <div class="workflow-hero-head">
            <div class="workflow-hero-copy">
              <div class="eyebrow">QUOTE WORKFLOW</div>
              <h3>报价版单线束流转概览</h3>
              <p class="section-note">按单线束号推进开发、资料发布、项目经理评审和销售回收规则。BOM、工艺、包装资料在页面内可直接查看并向下游发布，不再等待整包冻结。</p>
              <div class="hero-badges">
                <span class="chip"><span class="dot"></span><span>${escapeHtml(state.scenarioName || '当前场景')}</span></span>
                <span class="chip"><span class="dot alt"></span><span>${escapeHtml(workflowRoleLabel(activeWorkflowRole))}</span></span>
                <span class="chip"><span class="dot gold"></span><span>${escapeHtml(authContextSummaryText())}</span></span>
              </div>
            </div>
            <div class="workflow-nav-actions">
              <button class="button ghost" type="button" data-workflow-nav="profit-summary">看利润总览</button>
              <button class="button ghost" type="button" data-workflow-nav="quote-control">去报价工作台</button>
              <button class="button ghost" type="button" data-workflow-nav="recovery-center">去回收中心</button>
              <button class="button ghost" type="button" data-workflow-nav="data-management">去数据管理</button>
            </div>
          </div>
          <div class="workflow-summary-grid">
            ${summaryCards.map((card) => `
              <article class="workflow-summary-card">
                <span class="workflow-summary-label">${escapeHtml(card.label)}</span>
                <strong class="workflow-summary-value">${escapeHtml(card.value)}</strong>
                <span class="workflow-summary-meta">${escapeHtml(card.meta)}</span>
              </article>
            `).join('')}
          </div>
        </section>

        <section class="card workflow-filter-card">
          <div class="workflow-filter-grid">
            <label class="field quote-inline-field"><span>报价类型</span><select data-wf-filter="quoteType"><option value="">全部</option><option value="project"${workflowFilters.quoteType === 'project' ? ' selected' : ''}>项目报价</option><option value="change"${workflowFilters.quoteType === 'change' ? ' selected' : ''}>变更报价</option></select></label>
            <label class="field quote-inline-field"><span>报价版本</span><input type="text" data-wf-filter="quoteVersionId" value="${escapeHtml(workflowFilters.quoteVersionId)}" placeholder="版本筛选" /></label>
            <label class="field quote-inline-field"><span>线束号</span><input type="text" data-wf-filter="harnessId" value="${escapeHtml(workflowFilters.harnessId)}" placeholder="线束号筛选" /></label>
            <label class="field quote-inline-field"><span>阶段</span><select data-wf-filter="currentStageCode"><option value="">全部</option>${WORKFLOW_STAGE_DEFS.map((stage) => `<option value="${escapeHtml(stage.stageCode)}"${workflowFilters.currentStageCode === stage.stageCode ? ' selected' : ''}>${escapeHtml(stage.stageLabel)}</option>`).join('')}</select></label>
            <label class="field quote-inline-field"><span>状态</span><select data-wf-filter="overallStatus"><option value="">全部</option><option value="draft"${workflowFilters.overallStatus === 'draft' ? ' selected' : ''}>草稿</option><option value="review_pending"${workflowFilters.overallStatus === 'review_pending' ? ' selected' : ''}>待评审</option><option value="returned"${workflowFilters.overallStatus === 'returned' ? ' selected' : ''}>已退回</option><option value="active"${workflowFilters.overallStatus === 'active' ? ' selected' : ''}>执行中</option><option value="closed"${workflowFilters.overallStatus === 'closed' ? ' selected' : ''}>已关闭</option></select></label>
          </div>
          ${workflowUiErrors.length ? `<div class="workflow-inline-error">${escapeHtml(workflowUiErrors.join('；'))}</div>` : ''}
        </section>

        <section class="workflow-rail-grid">
          <aside class="workflow-rail-sidebar">
            <article class="card workflow-record-list-card">
              <div class="project-summary-caption">
                <div class="project-summary-caption-title">记录列表</div>
                <div class="project-summary-caption-meta">按报价版本 × 单线束号定位当前节点</div>
              </div>
              ${workflowRecordListHtml(filteredRecords, selectedRecord)}
            </article>
            <article class="card workflow-side-card">
              <div class="project-summary-caption">
                <div class="project-summary-caption-title">提醒队列</div>
                <div class="project-summary-caption-meta">规则缺失、阈值命中、基线问题统一在这里暴露</div>
              </div>
              ${workflowAlertRailHtml(alertRows)}
            </article>
          </aside>

          <div class="workflow-rail-main">
            <article class="card workflow-flow-card">
              <div class="project-summary-caption">
                <div class="project-summary-caption-title">流程图总览</div>
                <div class="project-summary-caption-meta">${escapeHtml(selectedRecord ? `${selectedRecord.harnessId} · ${selectedRecord.harnessName || '未命名线束'}` : '请选择记录查看节点完成情况')}</div>
              </div>
              ${workflowFlowOverviewHtml(workflowSnapshot, selectedRecord)}
            </article>
            <section class="workflow-doc-grid">
              ${documentCards}
            </section>
            ${workflowBomSheetHtml(selectedRecord)}
            ${workflowDetailHtml(selectedRecord, trackingRows)}
          </div>

          <aside class="workflow-rail-side">
            <article class="card workflow-side-card">
              <div class="project-summary-caption">
                <div class="project-summary-caption-title">执行回收联动</div>
                <div class="project-summary-caption-meta">只对实际承载线束号跟踪出货、回收与阈值</div>
              </div>
              ${workflowThresholdRailHtml(thresholdRows)}
            </article>
            <article class="card workflow-side-card">
              <div class="project-summary-caption">
                <div class="project-summary-caption-title">任务推进</div>
                <div class="project-summary-caption-meta">从规则补齐到开票 / 调价复核的待办队列</div>
              </div>
              ${workflowTaskRailHtml(taskLanes)}
            </article>
          </aside>
        </section>
      </div>
    `.trim();
    return;
  }
  bindWorkflowWorkspaceActions();
  return renderWorkflowWorkspaceV2(model);
  const workflowSnapshot = latestWorkflowSnapshot || getWorkflowSnapshot(model);
  const filteredRecords = filteredWorkflowRecords(workflowSnapshot);
  const selectedRecord = selectedWorkflowRecord(workflowSnapshot);
  const trackingRows = buildWorkflowTrackingRows(model);
  const thresholdRows = trackingRows
    .filter((row) => row.recoveryLimitSets > 0 || row.deliveredSets > 0 || row.targetAmount > 0)
    .sort((left, right) => numberOr(right.progressRatio, 0) - numberOr(left.progressRatio, 0))
    .slice(0, 8);
  const alertRows = buildWorkflowAlertRows(safeObject(latestExecutionPreview), thresholdRows);
  const summaryCards = workflowSummaryCards(workflowSnapshot, trackingRows, alertRows);
  const lanes = WORKFLOW_STAGE_DEFS.map((stage) => ({
    ...stage,
    records: filteredRecords.filter((record) => record.displayStageCode === stage.stageCode),
  }));
  el.workflowWorkspacePage.innerHTML = `
    <div class="workflow-workspace workflow-execution-board">
      <section class="card workflow-hero-card">
        <div class="workflow-hero-head">
          <div class="workflow-hero-copy">
            <div class="eyebrow">WORKFLOW BOARD</div>
            <h3>单线束报价流转与执行回收</h3>
            <p class="section-note">工厂端按单线束颗粒度管理项目报价、变更报价、项目经理评审、销售回收规则与执行跟踪。</p>
            <div class="hero-badges">
              <span class="chip"><span class="dot"></span><span>${escapeHtml(state.scenarioName || '当前场景')}</span></span>
              <span class="chip"><span class="dot alt"></span><span>${escapeHtml(workflowRoleLabel(activeWorkflowRole))}</span></span>
              <span class="chip"><span class="dot gold"></span><span>${escapeHtml(`${filteredRecords.length} 条记录 / ${workflowSnapshot.records.length} 总记录`)}</span></span>
            </div>
          </div>
          <div class="workflow-nav-actions">
            <button class="button ghost" type="button" data-workflow-nav="profit-summary">看利润总览</button>
            <button class="button ghost" type="button" data-workflow-nav="quote-control">去记录创建器</button>
            <button class="button ghost" type="button" data-workflow-nav="recovery-center">去回收中心</button>
            <button class="button ghost" type="button" data-workflow-nav="data-management">去数据管理</button>
          </div>
        </div>
        <div class="workflow-summary-grid">
          ${summaryCards.map((card) => `
            <article class="workflow-summary-card">
              <span class="workflow-summary-label">${card.label}</span>
              <strong class="workflow-summary-value">${card.value}</strong>
              <span class="workflow-summary-meta">${card.meta}</span>
            </article>
          `).join('')}
        </div>
      </section>

      <section class="card workflow-filter-card">
        <div class="workflow-filter-grid">
          <label class="field quote-inline-field"><span>报价类型</span><select data-wf-filter="quoteType"><option value="">全部</option><option value="project"${workflowFilters.quoteType === 'project' ? ' selected' : ''}>项目报价</option><option value="change"${workflowFilters.quoteType === 'change' ? ' selected' : ''}>变更报价</option></select></label>
          <label class="field quote-inline-field"><span>报价版本</span><input type="text" data-wf-filter="quoteVersionId" value="${escapeHtml(workflowFilters.quoteVersionId)}" placeholder="版本筛选" /></label>
          <label class="field quote-inline-field"><span>线束号</span><input type="text" data-wf-filter="harnessId" value="${escapeHtml(workflowFilters.harnessId)}" placeholder="线束号筛选" /></label>
          <label class="field quote-inline-field"><span>阶段</span><select data-wf-filter="currentStageCode"><option value="">全部</option>${WORKFLOW_STAGE_DEFS.map((stage) => `<option value="${escapeHtml(stage.stageCode)}"${workflowFilters.currentStageCode === stage.stageCode ? ' selected' : ''}>${escapeHtml(stage.stageLabel)}</option>`).join('')}</select></label>
          <label class="field quote-inline-field"><span>状态</span><select data-wf-filter="overallStatus"><option value="">全部</option><option value="draft"${workflowFilters.overallStatus === 'draft' ? ' selected' : ''}>草稿</option><option value="review_pending"${workflowFilters.overallStatus === 'review_pending' ? ' selected' : ''}>待评审</option><option value="returned"${workflowFilters.overallStatus === 'returned' ? ' selected' : ''}>已退回</option><option value="active"${workflowFilters.overallStatus === 'active' ? ' selected' : ''}>执行中</option><option value="closed"${workflowFilters.overallStatus === 'closed' ? ' selected' : ''}>已关闭</option></select></label>
        </div>
        ${workflowUiErrors.length ? `<div class="workflow-inline-error">${escapeHtml(workflowUiErrors.join('；'))}</div>` : ''}
      </section>

      <section class="workflow-board-grid workflow-stage-board">
        ${lanes.map((lane) => `
          <article class="card workflow-lane-card">
            <div class="workflow-lane-head">
              <strong>${escapeHtml(lane.stageLabel)}</strong>
              <span class="workflow-lane-count">${fmtInt(lane.records.length)}</span>
            </div>
            <div class="workflow-record-kanban">
              ${lane.records.length ? lane.records.map((record) => `
                <button type="button" class="workflow-record-kanban-card${selectedRecord?.recordId === record.recordId ? ' is-active' : ''}" data-wf-record-id="${escapeHtml(record.recordId)}">
                  <div class="workflow-record-kanban-title">${escapeHtml(record.harnessId)} · ${escapeHtml(record.harnessName || '未命名线束')}</div>
                  <div class="workflow-record-kanban-meta">
                    <span>${escapeHtml(record.quoteType === 'change' ? '变更报价' : '项目报价')}</span>
                    <span>${escapeHtml(record.quoteVersionId || '-')}</span>
                  </div>
                  <div class="workflow-record-kanban-meta">
                    <span>${escapeHtml(record.currentOwnerRoles.join(' / ') || '-')}</span>
                    <span>${escapeHtml(workflowStatusLabel(record.displayStatus || record.overallStatus))}</span>
                  </div>
                </button>
              `).join('') : '<div class="workflow-empty">当前阶段暂无记录</div>'}
            </div>
          </article>
        `).join('')}
      </section>

      ${workflowDetailHtml(selectedRecord, trackingRows)}

      <section class="workflow-board-grid workflow-link-grid">
        <article class="card workflow-side-card">
          <div class="project-summary-caption">
            <div class="project-summary-caption-title">执行回收联动区</div>
            <div class="project-summary-caption-meta">这里继续看销售规则完整度、出货进度、阈值命中与开票 / 调价复核。</div>
          </div>
          <div class="workflow-threshold-list">
            ${thresholdRows.length ? thresholdRows.map((row) => `
              <article class="workflow-threshold-item">
                <div class="workflow-threshold-head">
                  <strong>${escapeHtml(row.harnessId)}</strong>
                  <span>${escapeHtml(row.thresholdReached ? '已触发' : '跟踪中')}</span>
                </div>
                <div class="workflow-threshold-meta">
                  <span>${escapeHtml(row.harnessName || '-')}</span>
                  <span>出货 ${fmtInt(row.deliveredSets)} / ${fmtInt(row.recoveryLimitSets || 0)} 套</span>
                </div>
                <div class="workflow-progress"><span style="width:${Math.max(0, Math.min(numberOr(row.progressRatio, 0), 1)) * 100}%"></span></div>
                <div class="workflow-threshold-foot">
                  <span>已回收 ${fmtMoney(row.recoveredAmount)}</span>
                  <span>待回收 ${fmtMoney(row.remainingAmount)}</span>
                </div>
              </article>
            `).join('') : '<div class="workflow-empty">当前没有可跟踪的承载线束阈值</div>'}
          </div>
        </article>
        <article class="card workflow-side-card">
          <div class="project-summary-caption">
            <div class="project-summary-caption-title">提醒队列</div>
            <div class="project-summary-caption-meta">规则缺失、阈值命中、回收异常都会在这里排队。</div>
          </div>
          <div class="workflow-alert-list">
            ${alertRows.length ? alertRows.map((alert) => `
              <article class="workflow-alert-item ${toText(alert.level, 'info') === 'warning' ? 'is-warning' : 'is-info'}">
                <strong>${escapeHtml(alert.title)}</strong>
                <span>${escapeHtml(alert.message)}</span>
              </article>
            `).join('') : '<div class="workflow-empty">当前没有待处理提醒</div>'}
          </div>
        </article>
      </section>
    </div>
  `.trim();
}

function renderWorkflowWorkspaceV2(model) {
  if (!el.workflowWorkspacePage) return;
  bindWorkflowWorkspaceActions();
  const workflowSnapshot = latestWorkflowSnapshot || getWorkflowSnapshot(model);
  const filteredRecords = filteredWorkflowRecords(workflowSnapshot);
  const selectedRecord = selectedWorkflowRecord(workflowSnapshot);
  const trackingRows = buildWorkflowTrackingRows(model);
  const thresholdRows = trackingRows
    .filter((row) => row.recoveryLimitSets > 0 || row.deliveredSets > 0 || row.targetAmount > 0)
    .sort((left, right) => numberOr(right.progressRatio, 0) - numberOr(left.progressRatio, 0))
    .slice(0, 8);
  const alertRows = buildWorkflowAlertRows(safeObject(latestExecutionPreview), thresholdRows);
  const summaryCards = workflowSummaryCards(workflowSnapshot, trackingRows, alertRows);
  const selectedTracking = selectedRecord ? workflowTrackingSummary(selectedRecord, trackingRows) : null;
  const selectedAudit = selectedRecord ? safeArray(selectedRecord.auditLog).slice(-1)[0] : null;
  const selectedStages = selectedRecord
    ? safeArray(selectedRecord.stageStates).map((stage) => `<span class="workflow-stage-chip${stage.stageCode === selectedRecord.displayStageCode ? ' is-current' : ''}">${escapeHtml(stage.stageLabel)} / ${escapeHtml(workflowStatusLabel(stage.status))}</span>`).join('')
    : '';
  el.workflowWorkspacePage.innerHTML = `
    <div class="workflow-workspace workflow-flow-shell">
      <section class="card workflow-stage-hero">
        <div class="workflow-hero-head workflow-stage-hero-head">
          <div class="workflow-hero-copy">
            <div class="eyebrow">QUOTE WORKFLOW</div>
            <h3>单线束报价流转总览</h3>
            <p class="section-note">在同一页面查看流程节点完成情况、阶段资料、BOM Sheet 和提报动作。开发完成单款线束后即可直接发布给下游。</p>
            <div class="hero-badges">
              <span class="chip"><span class="dot"></span><span>${escapeHtml(state.scenarioName || '当前场景')}</span></span>
              <span class="chip"><span class="dot alt"></span><span>${escapeHtml(workflowRoleLabel(activeWorkflowRole))}</span></span>
              <span class="chip"><span class="dot gold"></span><span>${escapeHtml(`${filteredRecords.length} 条记录 / 报价版`)}</span></span>
            </div>
          </div>
          <div class="workflow-nav-actions">
            <button class="button ghost" type="button" data-workflow-nav="profit-summary">查看利润汇总</button>
            <button class="button ghost" type="button" data-workflow-nav="quote-control">切换报价记录</button>
            <button class="button ghost" type="button" data-workflow-nav="recovery-center">查看回收中心</button>
            <button class="button ghost" type="button" data-workflow-nav="data-management">查看数据管理</button>
          </div>
        </div>
        <div class="workflow-summary-grid">
          ${summaryCards.map((card) => `
            <article class="workflow-summary-card">
              <span class="workflow-summary-label">${card.label}</span>
              <strong class="workflow-summary-value">${card.value}</strong>
              <span class="workflow-summary-meta">${card.meta}</span>
            </article>
          `).join('')}
        </div>
        <div class="workflow-flow-panel">
          ${workflowFlowOverviewHtml(workflowSnapshot, selectedRecord)}
        </div>
      </section>

      <section class="card workflow-filter-card">
        <div class="workflow-filter-grid workflow-filter-grid--main">
          <label class="field quote-inline-field"><span>报价类型</span><select data-wf-filter="quoteType"><option value="">全部</option><option value="project"${workflowFilters.quoteType === 'project' ? ' selected' : ''}>项目报价</option><option value="change"${workflowFilters.quoteType === 'change' ? ' selected' : ''}>变更报价</option></select></label>
          <label class="field quote-inline-field"><span>报价版本</span><input type="text" data-wf-filter="quoteVersionId" value="${escapeHtml(workflowFilters.quoteVersionId)}" placeholder="按版本筛选" /></label>
          <label class="field quote-inline-field"><span>线束号</span><input type="text" data-wf-filter="harnessId" value="${escapeHtml(workflowFilters.harnessId)}" placeholder="按线束号筛选" /></label>
          <label class="field quote-inline-field"><span>当前阶段</span><select data-wf-filter="currentStageCode"><option value="">全部</option>${WORKFLOW_STAGE_DEFS.map((stage) => `<option value="${escapeHtml(stage.stageCode)}"${workflowFilters.currentStageCode === stage.stageCode ? ' selected' : ''}>${escapeHtml(stage.stageLabel)}</option>`).join('')}</select></label>
          <label class="field quote-inline-field"><span>状态</span><select data-wf-filter="overallStatus"><option value="">全部</option><option value="draft"${workflowFilters.overallStatus === 'draft' ? ' selected' : ''}>草稿</option><option value="review_pending"${workflowFilters.overallStatus === 'review_pending' ? ' selected' : ''}>待评审</option><option value="returned"${workflowFilters.overallStatus === 'returned' ? ' selected' : ''}>已退回</option><option value="active"${workflowFilters.overallStatus === 'active' ? ' selected' : ''}>执行中</option><option value="closed"${workflowFilters.overallStatus === 'closed' ? ' selected' : ''}>已关闭</option></select></label>
        </div>
        ${workflowUiErrors.length ? `<div class="workflow-inline-error">${escapeHtml(workflowUiErrors.join('；'))}</div>` : ''}
      </section>

      <section class="workflow-rail-layout">
        <article class="card workflow-record-rail">
          <div class="workflow-record-rail-head">
            <div>
              <h4>记录列表</h4>
              <p>${escapeHtml(`主记录粒度：单线束号 × 报价版本，共 ${filteredRecords.length} 条`)}</p>
            </div>
            <span class="workflow-record-rail-chip">${escapeHtml(workflowRoleLabel(activeWorkflowRole))}</span>
          </div>
          <div class="workflow-record-list">
            ${filteredRecords.length ? filteredRecords.map((record) => {
              const lastAudit = safeArray(record.auditLog).slice(-1)[0] || {};
              return `
                <button type="button" class="workflow-record-item${selectedRecord?.recordId === record.recordId ? ' is-active' : ''}" data-wf-record-id="${escapeHtml(record.recordId)}">
                  <div class="workflow-record-item-top">
                    <strong>${escapeHtml(record.harnessId || '-')}</strong>
                    <span class="workflow-record-stage">${escapeHtml(record.displayStageLabel || '-')}</span>
                  </div>
                  <div class="workflow-record-item-meta">
                    <span>${escapeHtml(record.harnessName || '-')}</span>
                    <span>${escapeHtml(record.quoteType === 'change' ? '变更报价' : '项目报价')}</span>
                  </div>
                  <div class="workflow-record-item-meta">
                    <span>${escapeHtml(record.quoteVersionId || '-')}</span>
                    <span>${escapeHtml(workflowStatusLabel(record.displayStatus || record.overallStatus))}</span>
                  </div>
                  <div class="workflow-record-item-meta">
                    <span>${escapeHtml(record.currentOwnerRoles.join(' / ') || '-')}</span>
                    <span>${escapeHtml(toText(lastAudit.createdAt, '-'))}</span>
                  </div>
                  ${lastAudit?.note ? `<div class="workflow-record-item-note">${escapeHtml(lastAudit.note)}</div>` : ''}
                </button>
              `;
            }).join('') : '<div class="workflow-empty">当前筛选条件下暂无工作流记录。</div>'}
          </div>
        </article>

        <div class="workflow-main-stack">
          ${selectedRecord ? `
            <section class="workflow-board-grid workflow-board-grid--flow">
              <div class="workflow-main-primary">
                <article class="card workflow-stage-context-card">
                  <div class="workflow-stage-context-head">
                    <div>
                      <h4>${escapeHtml(selectedRecord.harnessId)} / ${escapeHtml(selectedRecord.harnessName || '未命名线束')}</h4>
                      <p class="section-note">${escapeHtml(selectedRecord.quoteType === 'change' ? `变更报价，基线 ${selectedRecord.baselineQuoteVersion || '待绑定'}` : `项目报价，版本 ${selectedRecord.quoteVersionId || '-'}`)}</p>
                    </div>
                    <div class="workflow-detail-status">${escapeHtml(selectedRecord.displayStageLabel)} / ${escapeHtml(workflowStatusLabel(selectedRecord.displayStatus || selectedRecord.overallStatus))}</div>
                  </div>
                  <div class="workflow-stage-chip-row">${selectedStages}</div>
                  <div class="workflow-stage-context-kv workflow-detail-kv">
                    <div><span>责任角色</span><strong>${escapeHtml(selectedRecord.currentOwnerRoles.join(' / ') || '-')}</strong></div>
                    <div><span>影响模块</span><strong>${escapeHtml(selectedRecord.impactedModules.join(' / ') || '项目初始')}</strong></div>
                    <div><span>有效规则</span><strong>${fmtInt(workflowEffectiveRulesForHarness(selectedRecord.harnessId).length)}</strong></div>
                    <div><span>出货 / 阈值</span><strong>${escapeHtml(`${fmtInt(selectedTracking?.deliveredSets || 0)} / ${fmtInt(selectedTracking?.recoveryLimitSets || 0)}`)}</strong></div>
                    <div><span>已回收 / 未回收</span><strong>${escapeHtml(`${fmtMoney(selectedTracking?.recoveredAmount || 0)} / ${fmtMoney(selectedTracking?.remainingAmount || 0)}`)}</strong></div>
                    <div><span>最近动作</span><strong>${escapeHtml(toText(selectedAudit?.action, 'workflow'))}</strong></div>
                  </div>
                </article>

                <div class="workflow-doc-grid">
                  ${WORKFLOW_PUBLICATION_CONFIGS.map((config) => workflowDocumentPanelHtml(selectedRecord, config)).join('')}
                </div>

                ${workflowBomSheetHtml(selectedRecord)}
                ${workflowDetailHtml(selectedRecord, trackingRows)}
              </div>

              <div class="workflow-main-side">
                <article class="card workflow-side-card">
                  <div class="project-summary-caption">
                    <div class="project-summary-caption-title">执行回收联动</div>
                    <div class="project-summary-caption-meta">当前记录优先，兼看全局阈值进度。</div>
                  </div>
                  ${selectedTracking ? `
                    <div class="workflow-detail-kv">
                      <div><span>承载线束</span><strong>${escapeHtml(selectedRecord.harnessId || '-')}</strong></div>
                      <div><span>目标金额</span><strong>${fmtMoney(selectedTracking.targetAmount || 0)}</strong></div>
                      <div><span>已回收</span><strong>${fmtMoney(selectedTracking.recoveredAmount || 0)}</strong></div>
                      <div><span>未回收</span><strong>${fmtMoney(selectedTracking.remainingAmount || 0)}</strong></div>
                      <div><span>出货进度</span><strong>${escapeHtml(`${fmtInt(selectedTracking.deliveredSets || 0)} / ${fmtInt(selectedTracking.recoveryLimitSets || 0)}`)}</strong></div>
                      <div><span>阈值状态</span><strong>${escapeHtml(selectedTracking.thresholdReached ? '已命中' : '跟踪中')}</strong></div>
                    </div>
                  ` : '<div class="workflow-empty">当前记录还没有出货/回收跟踪数据。</div>'}
                  <div class="workflow-threshold-list">
                    ${thresholdRows.length ? thresholdRows.map((row) => `
                      <article class="workflow-threshold-item">
                        <div class="workflow-threshold-head">
                          <strong>${escapeHtml(row.harnessId)}</strong>
                          <span>${escapeHtml(row.thresholdReached ? '已触发' : '跟踪中')}</span>
                        </div>
                        <div class="workflow-threshold-meta">
                          <span>${escapeHtml(row.harnessName || '-')}</span>
                          <span>出货 ${fmtInt(row.deliveredSets)} / ${fmtInt(row.recoveryLimitSets || 0)} 套</span>
                        </div>
                        <div class="workflow-progress"><span style="width:${Math.max(0, Math.min(numberOr(row.progressRatio, 0), 1)) * 100}%"></span></div>
                        <div class="workflow-threshold-foot">
                          <span>已回收 ${fmtMoney(row.recoveredAmount)}</span>
                          <span>未回收 ${fmtMoney(row.remainingAmount)}</span>
                        </div>
                      </article>
                    `).join('') : '<div class="workflow-empty">当前没有可跟踪的阈值进度。</div>'}
                  </div>
                </article>

                <article class="card workflow-side-card">
                  <div class="project-summary-caption">
                    <div class="project-summary-caption-title">提醒队列</div>
                    <div class="project-summary-caption-meta">缺规则、命中阈值、待调价动作都在这里集中查看。</div>
                  </div>
                  <div class="workflow-alert-list">
                    ${alertRows.length ? alertRows.map((alert) => `
                      <article class="workflow-alert-item ${toText(alert.level, 'info') === 'warning' ? 'is-warning' : 'is-info'}">
                        <strong>${escapeHtml(alert.title)}</strong>
                        <span>${escapeHtml(alert.message)}</span>
                      </article>
                    `).join('') : '<div class="workflow-empty">当前没有待处理提醒。</div>'}
                  </div>
                </article>
              </div>
            </section>
          ` : '<article class="card workflow-detail-card"><div class="workflow-empty">请选择一条记录查看流程图、资料面板与 BOM Sheet。</div></article>'}
        </div>
      </section>
    </div>
  `.trim();
}

function safeCssSelectorValue(value) {
  const text = toText(value, '');
  if (typeof CSS !== 'undefined' && CSS && typeof CSS.escape === 'function') {
    return CSS.escape(text);
  }
  return text.replace(/["\\]/g, '\\$&');
}

function workflowLiveStagePayload(record, stageCode) {
  const payload = {
    ...getWorkflowStageBuffer(record, stageCode),
  };
  if (!el.workflowWorkspacePage || !record?.recordId || !stageCode) return payload;
  const recordSelector = safeCssSelectorValue(record.recordId);
  const stageSelector = safeCssSelectorValue(stageCode);
  const fields = Array.from(el.workflowWorkspacePage.querySelectorAll(
    `[data-wf-record-id="${recordSelector}"][data-wf-stage-code="${stageSelector}"][data-wf-field]`
  ));
  fields.forEach((field) => {
    const fieldCode = toText(field.getAttribute('data-wf-field'), '');
    if (!fieldCode) return;
    payload[fieldCode] = field.value;
  });
  return payload;
}

function workflowFlowOverviewHtml(snapshot, selectedRecord) {
  const stageCountMap = safeArray(snapshot?.records).reduce((acc, record) => {
    const key = toText(record?.displayStageCode, '');
    if (!key) return acc;
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  return `
    <div class="workflow-rail">
      <div class="workflow-rail-track">
        ${WORKFLOW_STAGE_DEFS.map((stage, index) => {
          const stageState = selectedRecord ? workflowStageStatus(selectedRecord, stage.stageCode) : {};
          const completion = selectedRecord ? workflowStageCompletion(selectedRecord, stage.stageCode) : { filled: 0, total: 0 };
          const tone = stage.stageCode === selectedRecord?.displayStageCode
            ? 'is-current'
            : (toText(stageState.status, '') === 'approved' ? 'is-done' : '');
          const globalCount = fmtInt(stageCountMap[stage.stageCode] || 0);
          const statusText = selectedRecord
            ? `${workflowStatusLabel(stageState.status || 'not_started')} · 完成 ${completion.filled}/${completion.total || 0}`
            : `全局 ${globalCount} 条记录`;
          return `
            <article class="workflow-rail-item ${tone}">
              <strong>${String(index + 1).padStart(2, '0')} · ${escapeHtml(stage.stageLabel)}</strong>
              <span>${escapeHtml(stage.ownerRoleCodes.map((role) => workflowRoleLabel(role)).join(' / ') || '-')}</span>
              <span>${escapeHtml(statusText)}</span>
              <span>阶段记录 ${globalCount}</span>
            </article>
          `;
        }).join('')}
      </div>
    </div>
  `.trim();
}

function workflowDocumentPanelHtml(record, config, extra = {}) {
  const stage = workflowStageStatus(record, config.stageCode);
  const payload = workflowStagePayload(record, config.stageCode);
  const completion = workflowStageCompletion(record, config.stageCode);
  const publish = workflowPublicationState(record, config);
  const previewRows = workflowFieldDefsForStage(config.stageCode)
    .slice(0, 4)
    .map((field) => {
      const value = toText(payload[field.fieldCode], '');
      return `<div class="workflow-doc-meta"><strong>${escapeHtml(field.fieldLabel)}</strong>：${escapeHtml(value || '待补充')}</div>`;
    }).join('');
  return `
    <article class="card workflow-doc-card">
      <div class="workflow-doc-title">${escapeHtml(config.title)}</div>
      <div class="workflow-doc-meta">${escapeHtml(extra.description || config.description || '')}</div>
      <div class="workflow-doc-meta">阶段状态：${escapeHtml(workflowStatusLabel(stage.status || 'not_started'))} · 完成度 ${completion.filled}/${completion.total || 0} · 下游：${escapeHtml(config.targetLabel)}</div>
      <div class="workflow-doc-lines">${previewRows || '<div class="workflow-doc-meta">当前阶段还没有可展示字段</div>'}</div>
      <div class="workflow-doc-actions">
        <span class="workflow-doc-meta">${publish.status === 'published' ? `已发布 · ${toText(publish.publishedAt, '-')} · ${toText(publish.publishedBy, '-')}` : '未发布'}</span>
        ${publish.canPublish ? `<button class="button ghost" type="button" data-wf-publish-action="publish" data-wf-record-id="${escapeHtml(record.recordId)}" data-wf-publish-key="${escapeHtml(config.key)}">${escapeHtml(config.buttonLabel)}</button>` : ''}
      </div>
      ${publish.note ? `<div class="workflow-doc-meta">${escapeHtml(publish.note)}</div>` : ''}
    </article>
  `.trim();
}

function workflowBomSheetHtml(record) {
  if (!record) {
    return `
      <article class="card workflow-inline-sheet">
        <div class="workflow-inline-sheet-title">BOM Sheet 预览</div>
        <div class="workflow-inline-sheet-meta">请选择一条记录，查看单线束 BOM 资料与可发布明细。</div>
      </article>
    `.trim();
  }
  const preview = buildWorkflowBomSheetPreview(record);
  return `
    <article class="card workflow-inline-sheet">
      <div class="workflow-inline-sheet-head">
        <div>
          <h4 class="workflow-inline-sheet-title">${escapeHtml(record.harnessId)} · BOM Sheet</h4>
          <div class="workflow-inline-sheet-meta">${escapeHtml(preview.hasSource ? `${preview.sourceLabel} / ${preview.sourceSheetName}` : '当前没有可用 BOM Sheet 源数据')}</div>
        </div>
        <div class="workflow-inline-sheet-meta">行数 ${fmtInt(preview.rowCount)} · 导线 ${fmtInt(preview.wireCount)} · 连接器 ${fmtInt(preview.connectorCount)} · 供应商 ${fmtInt(preview.supplierCount)}</div>
      </div>
      ${preview.rows.length ? `
        <div class="table-wrap workflow-inline-sheet-wrap">
          <table class="workflow-inline-sheet-table">
            <thead>
              <tr>
                <th>行</th>
                <th>线束号</th>
                <th>零件号</th>
                <th>零件名称</th>
                <th>数量</th>
                <th>单位</th>
                <th>供应商</th>
                <th>备注</th>
              </tr>
            </thead>
            <tbody>
              ${preview.rows.map((row) => `
                <tr>
                  <td>${fmtInt(row.rowIndex || 0)}</td>
                  <td>${escapeHtml(row.harnessId || '-')}</td>
                  <td>${escapeHtml(row.partNumber || '-')}</td>
                  <td>${escapeHtml(row.partName || '-')}</td>
                  <td>${fmtMaybeNumber(row.quantity, 3)}</td>
                  <td>${escapeHtml(row.unit || '-')}</td>
                  <td>${escapeHtml(row.supplier || '-')}</td>
                  <td>${escapeHtml(row.remark || '-')}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      ` : '<div class="workflow-empty">当前活动 BOM 中还没有识别到这条线束的明细行。</div>'}
      <div class="workflow-inline-sheet-note">开发工程师完成单线束 BOM 后，可在当前页面直接发布给采购先行询价，不必等待整包 BOM 全部冻结。</div>
    </article>
  `.trim();
}

function renderProjectProfitExecutionShell(m) {
  if (!el.projectProfitSummaryMount) return;
  latestQuoteWorkbookMatrix = null;
  const quoteMatrix = getQuoteWorkbookMatrix();
  if (quoteMatrix) {
    renderQuoteWorkbookProjectSummary(quoteMatrix);
    return;
  }
  const quoteMeta = currentQuoteTypeMeta();
  const previewSummary = latestExecutionPreview && window.G281ExecutionPreview?.buildProjectSummary
    ? window.G281ExecutionPreview.buildProjectSummary(latestExecutionPreview)
    : null;
  const recoverySummary = latestExecutionPreview && window.G281ExecutionPreview?.buildRecoverySummary
    ? window.G281ExecutionPreview.buildRecoverySummary(latestExecutionPreview)
    : null;
  const previewHarnessRows = latestExecutionPreview && window.G281ExecutionPreview?.buildHarnessRows
    ? window.G281ExecutionPreview.buildHarnessRows(latestExecutionPreview)
    : [];
  const evaluation = buildProjectEvaluationRows(m, previewSummary, recoverySummary);
  const lifecycleVolume = numberOr(evaluation.rows?.[0]?.lifecycle, previewSummary?.lifecycle?.volume || m?.totalVolume || 0);
  const baseProfitPerSet = numberOr(previewSummary?.unit?.baseProfitPerSet, m?.portfolioSummary?.unit?.profit || m?.avgProfit || 0);
  const recoveryPerSet = numberOr(previewSummary?.unit?.projectedRecoveryPerSet, recoverySummary?.totalProjectedRecoveryPerSet || 0);
  const adjustedProfitPerSet = numberOr(previewSummary?.unit?.adjustedProfitPerSet, baseProfitPerSet + recoveryPerSet);
  const adjustedLifecycleProfit = numberOr(previewSummary?.lifecycle?.adjustedProfit, adjustedProfitPerSet * lifecycleVolume);
  const trackingRows = buildWorkflowTrackingRows(window._g281LastModel || m);
  const recoveredAmount = trackingRows.reduce((sum, row) => sum + numberOr(row.recoveredAmount, 0), 0);
  const remainingAmount = trackingRows.reduce((sum, row) => sum + numberOr(row.remainingAmount, 0), 0);
  const shippedSets = trackingRows.reduce((sum, row) => sum + numberOr(row.deliveredSets, 0), 0);
  const thresholdCount = trackingRows.filter((row) => row.thresholdReached).length;
  const activeRuleCount = numberOr(recoverySummary?.activeRuleCount, latestSalesRuleSnapshot?.summary?.effectiveRules || 0);
  const carrierHarnessCount = numberOr(recoverySummary?.coveredHarnessCount, 0);
  const badges = [
    quoteMeta.label,
    '报价版项目评估汇总',
    '工厂实际执行口径',
    authContextSummaryText(),
  ];
  if (activeQuoteType === 'change') {
    badges.push(`基线 ${baselineQuoteVersionLabel()}`);
  }
  if (el.projectProfitSummaryBadges) {
    el.projectProfitSummaryBadges.innerHTML = badges.map((item) => `<span class="summary-badge">${escapeHtml(item)}</span>`).join('');
  }
  const metricCards = [
    {
      label: '实际执行利润 / 套',
      value: fmtMoney(adjustedProfitPerSet),
      meta: `经营利润 ${fmtMoney(baseProfitPerSet)} · 回收影响 ${fmtMoney(recoveryPerSet)}`,
      tone: adjustedProfitPerSet >= 0 ? 'positive' : 'negative',
    },
    {
      label: '生命周期执行利润',
      value: fmtMoney(adjustedLifecycleProfit),
      meta: `${fmtInt(lifecycleVolume)} 套 · ${quoteMeta.label}`,
      tone: adjustedLifecycleProfit >= 0 ? 'positive' : 'negative',
    },
    {
      label: '已回收 / 待回收',
      value: `${fmtMoney(recoveredAmount)} / ${fmtMoney(remainingAmount)}`,
      meta: `承载线束 ${fmtInt(carrierHarnessCount)} · 有效规则 ${fmtInt(activeRuleCount)}`,
      tone: remainingAmount > 0 ? '' : 'positive',
    },
    {
      label: '累计出货 / 阈值命中',
      value: `${fmtInt(shippedSets)} / ${fmtInt(thresholdCount)}`,
      meta: thresholdCount ? '需关注开票 / 调价复核' : '当前执行跟踪正常',
      tone: thresholdCount ? 'negative' : '',
    },
  ];
  el.projectProfitSummaryMount.innerHTML = `
    <div class="project-eval-shell">
      <section class="project-eval-section">
        <div class="project-eval-caption">
          <div>
            <div class="project-eval-caption-title">项目评估汇总</div>
            <div class="project-eval-caption-meta">${financialContextSummary(m)} · ${authContextSummaryText()}</div>
          </div>
          <div class="project-eval-caption-meta">只展示报价版成本底座，并叠加当前实际承载与回收执行结果。</div>
        </div>
        <div class="workflow-summary-grid">
          ${metricCards.map((card) => `
            <article class="project-eval-metric ${card.tone ? card.tone : ''}">
              <span>${escapeHtml(card.label)}</span>
              <strong>${escapeHtml(card.value)}</strong>
              <em>${escapeHtml(card.meta)}</em>
            </article>
          `).join('')}
        </div>
      </section>
      <section class="project-eval-section">
        <div class="table-wrap">
          <table class="project-summary-table project-eval-table">
            <thead>
              <tr>
                <th>区段</th>
                <th>项目评估项</th>
                ${safeArray(evaluation.years).map((year) => `<th>${escapeHtml(String(year))}</th>`).join('')}
                <th>生命周期</th>
                <th>单套口径</th>
              </tr>
            </thead>
            <tbody>
              ${safeArray(evaluation.rows).map((row) => `
                <tr data-tone="${escapeHtml(toText(row.tone, ''))}">
                  <td><span class="project-summary-group project-summary-group--${row.group}">${row.group}</span></td>
                  <td>${escapeHtml(row.label)}</td>
                  ${safeArray(row.years).map((value) => {
                    const toneClass = row.tone === 'profit' ? (numberOr(value, 0) >= 0 ? 'positive' : 'negative') : '';
                    return `<td class="${toneClass}"><span class="num">${formatProjectEvaluationCell(value, row.type)}</span></td>`;
                  }).join('')}
                  <td class="${row.tone === 'profit' ? (numberOr(row.lifecycle, 0) >= 0 ? 'positive' : 'negative') : ''}"><span class="num">${formatProjectEvaluationCell(row.lifecycle, row.type)}</span></td>
                  <td class="${row.tone === 'profit' ? (numberOr(row.unit, 0) >= 0 ? 'positive' : 'negative') : ''}"><span class="num">${formatProjectEvaluationCell(row.unit, row.type)}</span></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  `.trim();
  if (el.projectProfitAnnualMount) {
    const volumeRow = evaluation.rows?.[0] || {};
    const aspRow = evaluation.rows?.[1] || {};
    const recoveryRow = evaluation.rows?.[evaluation.rows.length - 2] || {};
    const executionRow = evaluation.rows?.[evaluation.rows.length - 1] || {};
    el.projectProfitAnnualMount.innerHTML = safeArray(evaluation.years).length
      ? `
        <div class="project-annual-grid">
          ${safeArray(evaluation.years).map((year, index) => `
            <article class="project-annual-card">
              <div class="project-annual-year">${escapeHtml(String(year))}</div>
              <div class="project-annual-profit ${numberOr(executionRow.years?.[index], 0) >= 0 ? 'positive' : 'negative'}">${fmtMoney(executionRow.years?.[index] || 0)}</div>
              <div class="project-annual-meta">销量 ${fmtInt(volumeRow.years?.[index] || 0)} · ASP ${fmtMoney(aspRow.years?.[index] || 0)}</div>
              <div class="project-annual-meta">回收影响 ${fmtMoney(recoveryRow.years?.[index] || 0)}</div>
            </article>
          `).join('')}
        </div>
      `.trim()
      : '<div class="project-empty-state">当前没有年度项目评估数据。</div>';
  }
  if (el.harnessProfitMount) {
    const trackingMap = new Map(trackingRows.map((row) => [row.harnessId, row]));
    const harnessRows = safeArray(previewHarnessRows).length
      ? safeArray(previewHarnessRows).map((row) => {
        const tracking = trackingMap.get(toText(row?.harnessId, '')) || {};
        return {
          harnessId: toText(row?.harnessId, ''),
          harnessName: toText(row?.harnessName, ''),
          margin: numberOr(row?.adjusted?.margin, row?.base?.margin || 0),
          profit: numberOr(row?.adjusted?.profitPerSet, row?.base?.profitPerSet || 0),
          basis: `${fmtInt(safeArray(row?.activeRules).length)} 条规则 · 已回收 ${fmtMoney(tracking.recoveredAmount || row?.estimatedRecoveredAmount || 0)} · 待回收 ${fmtMoney(tracking.remainingAmount || 0)}`,
        };
      })
      : buildHarnessProfitRows(m).map((row) => {
        const tracking = trackingMap.get(toText(row?.harnessId, '')) || {};
        return {
          harnessId: row.harnessId,
          harnessName: row.harnessName,
          margin: numberOr(row.margin, 0),
          profit: numberOr(row.profit, 0),
          basis: `${row.basis} · 已回收 ${fmtMoney(tracking.recoveredAmount || 0)}`,
        };
      });
    if (!harnessRows.length) {
      el.harnessProfitMount.innerHTML = '<div class="project-empty-state">当前没有可展示的单线束执行利润焦点。</div>';
    } else {
      const focusRows = harnessRows
        .slice()
        .sort((left, right) => numberOr(left.profit, 0) - numberOr(right.profit, 0))
        .slice(0, 4);
      el.harnessProfitMount.innerHTML = `
        <div class="harness-focus-list">
          ${focusRows.map((row, index) => `
            <article class="harness-focus-item">
              <div class="harness-focus-rank">#${index + 1}</div>
              <div class="harness-focus-copy">
                <strong>${escapeHtml(row.harnessId || '-')}</strong>
                <span>${escapeHtml(row.harnessName || '-')}</span>
                <em>${escapeHtml(row.basis || '待补充执行依据')}</em>
              </div>
              <div class="harness-focus-metrics">
                <span class="${numberOr(row.profit, 0) >= 0 ? 'positive' : 'negative'}">${fmtMoney(row.profit || 0)}</span>
                <span class="${numberOr(row.margin, 0) >= 0 ? 'positive' : 'negative'}">${fmtPct(row.margin || 0)}</span>
              </div>
            </article>
          `).join('')}
        </div>
      `.trim();
    }
  }
}

function bindWorkflowWorkspaceActions() {
  if (!el.workflowWorkspacePage || el.workflowWorkspacePage.dataset.bound === 'true') return;
  el.workflowWorkspacePage.dataset.bound = 'true';
  el.workflowWorkspacePage.addEventListener('click', (event) => {
    const nav = event.target.closest('[data-workflow-nav]');
    if (nav) {
      const action = nav.dataset.workflowNav;
      let nextPage = 'workflow';
      let targetId = '';
      if (action === 'profit-summary') {
        nextPage = 'profit';
        targetId = 'projectProfitSummarySection';
      } else if (action === 'quote-control') {
        nextPage = 'profit';
        targetId = 'quoteControlStripSection';
      } else if (action === 'recovery-center') {
        nextPage = 'profit';
        targetId = 'recoveryTriggerMount';
      } else if (action === 'data-management') {
        nextPage = 'data';
        targetId = 'managementTopGrid';
      }
      setWorkspacePage(nextPage);
      const target = targetId ? document.getElementById(targetId) : null;
      if (target && typeof target.scrollIntoView === 'function') {
        target.scrollIntoView({ block: 'start', behavior: 'smooth' });
      }
      return;
    }
    const publishButton = event.target.closest('[data-wf-publish-action]');
    if (publishButton) {
      const recordId = publishButton.getAttribute('data-wf-record-id');
      const publishKey = publishButton.getAttribute('data-wf-publish-key');
      const model = window._g281LastModel || {};
      const snapshot = latestWorkflowSnapshot || getWorkflowSnapshot(model);
      const record = safeArray(snapshot.records).find((item) => item.recordId === recordId);
      const config = safeArray(WORKFLOW_PUBLICATION_CONFIGS).find((item) => item.key === publishKey);
      const repo = getWorkflowRepo();
      if (!record || !config || !repo) return;
      try {
        resetWorkflowUiErrors();
        if (!workflowPublicationState(record, config).canPublish) {
          throw new Error('当前阶段不可发布');
        }
        repo.saveStageDraft(record.recordId, config.stageCode, {
          ...workflowLiveStagePayload(record, config.stageCode),
          ...workflowPublishDraftPatch(config),
        });
        clearWorkflowStageBuffer(record.recordId, config.stageCode);
        latestWorkflowSnapshot = getWorkflowSnapshot(model);
        queueRender();
      } catch (error) {
        setWorkflowUiError(error?.message || '资料发布失败');
        queueRender();
      }
      return;
    }
    const recordButton = event.target.closest('[data-wf-record-id]');
    if (recordButton && !event.target.closest('[data-wf-action]') && !event.target.closest('[data-wf-publish-action]')) {
      setSelectedWorkflowRecordId(recordButton.getAttribute('data-wf-record-id'));
      queueRender();
      return;
    }
    const actionButton = event.target.closest('[data-wf-action]');
    if (!actionButton) return;
    const recordId = actionButton.getAttribute('data-wf-record-id');
    const snapshot = latestWorkflowSnapshot || getWorkflowSnapshot(window._g281LastModel || {});
    const record = safeArray(snapshot.records).find((item) => item.recordId === recordId);
    if (!record) return;
    const repo = getWorkflowRepo();
    if (!repo) return;
    const model = window._g281LastModel || {};
    const action = actionButton.getAttribute('data-wf-action');
    const stageCode = record.displayStageCode;
    const buffer = workflowLiveStagePayload(record, stageCode);
    try {
      resetWorkflowUiErrors();
      if (action === 'save') {
        if (stageCode === 'execution_recovery' && typeof repo.updateExecutionStatus === 'function') {
          const executionValues = workflowExecutionDraftValues(record, buffer, model);
          workflowSyncTrackingRecord(record, {
            deliveredSets: executionValues.deliveredSets,
            recoveredAmount: executionValues.recoveredAmount,
            remainingAmount: executionValues.remainingAmount,
          }, model);
          const linked = workflowSyncLinkedArtifacts(record, model);
          repo.updateExecutionStatus(record.recordId, {
            deliveredSets: executionValues.deliveredSets,
            recoveredAmount: executionValues.recoveredAmount,
            remainingAmount: executionValues.remainingAmount,
            note: toText(buffer.invoice_reprice_action, ''),
            updatedBy: activeWorkflowRole,
            stageStatus: 'active',
            status: 'in_progress',
            lastTaskHint: toText(buffer.invoice_reprice_action, ''),
            ...linked,
          });
        } else {
          repo.saveStageDraft(record.recordId, stageCode, {
            ...buffer,
            updatedByRole: activeWorkflowRole,
          });
        }
        clearWorkflowStageBuffer(record.recordId, stageCode);
      } else if (action === 'submit') {
        if (stageCode === 'commercial_quote') {
          latestSalesRuleSnapshot = getSalesRuleSnapshot(model);
          const effectiveRules = workflowRuleRowsForHarness(record.harnessId);
          const linked = {
            linkedSalesRuleIds: Array.from(new Set(effectiveRules.map((rule) => toText(rule?.ruleId, '')).filter(Boolean))),
            linkedTaskIds: safeArray(record.linkedTaskIds),
            linkedRecoveryHarnessId: toText(record.harnessId, ''),
          };
          repo.submitStage(record.recordId, stageCode, {
            ...buffer,
            submittedByRole: activeWorkflowRole,
            ...linked,
            requirementsComplete: effectiveRules.length > 0 && !!toText(buffer.sales_rule, '') && !!toText(buffer.carrier_harness_ids, '') && !!toText(buffer.invoice_trigger, '') && !!toText(buffer.repricing_trigger, ''),
          });
          if (typeof repo.updateExecutionStatus === 'function') {
            repo.updateExecutionStatus(record.recordId, {
              stageStatus: 'active',
              status: 'in_progress',
              updatedBy: activeWorkflowRole,
              lastTaskHint: toText(buffer.invoice_reprice_action, ''),
              ...linked,
            });
          }
        } else {
          repo.submitStage(record.recordId, stageCode, {
            ...buffer,
            submittedByRole: activeWorkflowRole,
          });
        }
        clearWorkflowStageBuffer(record.recordId, stageCode);
      } else if (action === 'approve') {
        repo.reviewStage(record.recordId, 'pm_cost_review', {
          decision: 'approve',
          reviewer: activeWorkflowRole,
          note: toText(buffer.pm_review_summary, ''),
        });
        clearWorkflowStageBuffer(record.recordId, stageCode);
      } else if (action === 'return') {
        const select = el.workflowWorkspacePage.querySelector(`[data-wf-return-stage="${safeCssSelectorValue(record.recordId)}"]`);
        repo.reviewStage(record.recordId, 'pm_cost_review', {
          decision: 'return',
          reviewer: activeWorkflowRole,
          note: toText(buffer.pm_review_summary, ''),
          returnToStageCode: select?.value || 'harness_development',
        });
        clearWorkflowStageBuffer(record.recordId, stageCode);
      } else if (action === 'close' && typeof repo.updateExecutionStatus === 'function') {
        const executionValues = workflowExecutionDraftValues(record, buffer, model);
        workflowSyncTrackingRecord(record, {
          deliveredSets: executionValues.deliveredSets,
          recoveredAmount: executionValues.recoveredAmount,
          remainingAmount: executionValues.remainingAmount,
        }, model);
        const linked = workflowSyncLinkedArtifacts(record, model);
        repo.updateExecutionStatus(record.recordId, {
          deliveredSets: executionValues.deliveredSets,
          recoveredAmount: executionValues.recoveredAmount,
          remainingAmount: executionValues.remainingAmount,
          status: 'approved',
          stageStatus: 'approved',
          updatedBy: activeWorkflowRole,
          lastTaskHint: toText(buffer.invoice_reprice_action, ''),
          ...linked,
        });
        clearWorkflowStageBuffer(record.recordId, stageCode);
      }
      latestSalesRuleSnapshot = getSalesRuleSnapshot(model);
      latestWorkflowSnapshot = getWorkflowSnapshot(model);
      queueRender();
    } catch (error) {
      setWorkflowUiError(error?.message || '工作流操作失败');
      queueRender();
    }
  });
  el.workflowWorkspacePage.addEventListener('change', (event) => {
    const filter = event.target.closest('[data-wf-filter]');
    if (filter) {
      updateWorkflowFilter(filter.getAttribute('data-wf-filter'), filter.value);
      queueRender();
      return;
    }
    const field = event.target.closest('[data-wf-field]');
    if (field) {
      updateWorkflowStageBuffer(
        field.getAttribute('data-wf-record-id'),
        field.getAttribute('data-wf-stage-code'),
        field.getAttribute('data-wf-field'),
        field.value,
      );
    }
  });
}

function renderWorkflowWorkspace(model) {
  if (!el.workflowWorkspacePage) return;
  bindWorkflowWorkspaceActions();
  const workflowSnapshot = latestWorkflowSnapshot || getWorkflowSnapshot(model);
  const filteredRecords = filteredWorkflowRecords(workflowSnapshot);
  const selectedRecord = selectedWorkflowRecord(workflowSnapshot);
  const trackingRows = buildWorkflowTrackingRows(model);
  const thresholdRows = trackingRows
    .filter((row) => row.recoveryLimitSets > 0 || row.deliveredSets > 0 || row.targetAmount > 0)
    .sort((left, right) => numberOr(right.progressRatio, 0) - numberOr(left.progressRatio, 0))
    .slice(0, 8);
  const alertRows = buildWorkflowAlertRows(safeObject(latestExecutionPreview), thresholdRows);
  const summaryCards = workflowSummaryCards(workflowSnapshot, trackingRows, alertRows);
  const selectedTracking = selectedRecord ? workflowTrackingSummary(selectedRecord, trackingRows) : null;
  const selectedRules = selectedRecord ? workflowEffectiveRulesForHarness(selectedRecord.harnessId).length : 0;
  const heroBadges = selectedRecord
    ? [
      { text: selectedRecord.quoteVersionId || '未命名报价版' },
      { text: selectedRecord.displayStageLabel || selectedRecord.currentStageCode || '当前阶段' },
      { text: workflowStatusLabel(selectedRecord.displayStatus || selectedRecord.overallStatus), tone: 'success' },
      ...(selectedTracking?.thresholdReached ? [{ text: '触发调价 / 开票复核', tone: 'warning' }] : []),
    ]
    : [
      { text: '报价版流程总览' },
      { text: authContextSummaryText() },
    ];
  const heroKpis = selectedRecord
    ? [
      { label: '当前责任', value: safeArray(selectedRecord.currentOwnerRoles).join(' / ') || '-', meta: '按当前阶段显示可编辑角色' },
      { label: '有效规则', value: fmtInt(selectedRules), meta: `关联任务 ${fmtInt(safeArray(selectedRecord.linkedTaskIds).length)}` },
      { label: '出货 / 已回收', value: `${fmtInt(selectedTracking?.deliveredSets || 0)} / ${fmtMoney(selectedTracking?.recoveredAmount || 0)}`, meta: `待回收 ${fmtMoney(selectedTracking?.remainingAmount || 0)}` },
    ]
    : summaryCards.slice(0, 3).map((item) => ({ label: item.label, value: item.value, meta: item.meta }));
  const recordListHtml = filteredRecords.length
    ? `
      <div class="workflow-record-list">
        ${filteredRecords.map((record) => {
          const tracking = workflowTrackingSummary(record, trackingRows);
          return `
            <button type="button" class="workflow-record-list-item${selectedRecord?.recordId === record.recordId ? ' is-active' : ''}" data-wf-record-id="${escapeHtml(record.recordId)}">
              <div class="workflow-record-list-main">${escapeHtml(record.harnessId)} · ${escapeHtml(record.harnessName || '未命名线束')}</div>
              <div class="workflow-record-list-meta">
                <span>${escapeHtml(record.quoteType === 'change' ? '变更报价' : '项目报价')}</span>
                <span>${escapeHtml(record.quoteVersionId || '-')}</span>
                <span>${escapeHtml(record.displayStageLabel || record.currentStageCode || '-')}</span>
              </div>
              <div class="workflow-record-list-meta">
                <span>规则 ${fmtInt(workflowEffectiveRulesForHarness(record.harnessId).length)}</span>
                <span>出货 ${fmtInt(tracking.deliveredSets || 0)}</span>
                <span>状态 ${escapeHtml(workflowStatusLabel(record.displayStatus || record.overallStatus))}</span>
              </div>
            </button>
          `;
        }).join('')}
      </div>
    `
    : '<div class="workflow-record-list-empty">当前筛选条件下没有符合条件的记录。</div>';
  const documentCardsHtml = selectedRecord
    ? WORKFLOW_PUBLICATION_CONFIGS.map((config) => workflowDocumentPanelHtml(selectedRecord, config)).join('')
    : WORKFLOW_PUBLICATION_CONFIGS.map((config) => `
      <article class="card workflow-doc-card">
        <div class="workflow-doc-title">${escapeHtml(config.title)}</div>
        <div class="workflow-doc-meta">${escapeHtml(config.description)}</div>
        <div class="workflow-doc-meta">请选择左侧记录后查看字段完成度、发布状态和下游对象。</div>
      </article>
    `).join('');
  el.workflowWorkspacePage.innerHTML = `
    <div class="workflow-workspace workflow-flow-shell">
      <section class="card workflow-stage-hero">
        <div class="workflow-stage-hero-head">
          <div>
            <h3 class="workflow-stage-hero-title">${escapeHtml(selectedRecord ? `${selectedRecord.harnessId} · ${selectedRecord.harnessName || '未命名线束'}` : '报价版单线束流转视图')}</h3>
            <p class="workflow-stage-hero-subtitle">${escapeHtml(selectedRecord ? `${selectedRecord.quoteVersionId || '-'} · 当前阶段 ${selectedRecord.displayStageLabel || selectedRecord.currentStageCode || '-'} · ${authContextSummaryText()}` : `按单线束号 × 报价版本管理开发、工艺、资源、商务和执行回收。${authContextSummaryText()}`)}</p>
          </div>
          <div class="workflow-stage-hero-badges">
            ${heroBadges.map((badge) => `<span class="workflow-stage-hero-badge${badge.tone ? ` is-${badge.tone}` : ''}">${escapeHtml(badge.text)}</span>`).join('')}
          </div>
        </div>
        <div class="workflow-flow-kpi-grid">
          ${heroKpis.map((item) => `
            <article class="workflow-flow-kpi">
              <span class="label">${escapeHtml(item.label)}</span>
              <strong class="value">${escapeHtml(item.value)}</strong>
              <span class="meta">${escapeHtml(item.meta)}</span>
            </article>
          `).join('')}
        </div>
      </section>
      <section class="card workflow-filter-card workflow-filter-wrap">
        <div class="workflow-filter-grid">
          <label class="workflow-filter-group">
            <span class="workflow-filter-label">报价类型</span>
            <select class="workflow-filter-input" data-wf-filter="quoteType">
              <option value="">全部</option>
              <option value="project"${workflowFilters.quoteType === 'project' ? ' selected' : ''}>项目报价</option>
              <option value="change"${workflowFilters.quoteType === 'change' ? ' selected' : ''}>变更报价</option>
            </select>
          </label>
          <label class="workflow-filter-group">
            <span class="workflow-filter-label">报价版本</span>
            <input class="workflow-filter-input" type="text" data-wf-filter="quoteVersionId" value="${escapeHtml(workflowFilters.quoteVersionId)}" placeholder="例如 quote_v1 / 2026Q2" />
          </label>
          <label class="workflow-filter-group">
            <span class="workflow-filter-label">线束号</span>
            <input class="workflow-filter-input" type="text" data-wf-filter="harnessId" value="${escapeHtml(workflowFilters.harnessId)}" placeholder="筛选单线束号" />
          </label>
          <label class="workflow-filter-group">
            <span class="workflow-filter-label">阶段</span>
            <select class="workflow-filter-input" data-wf-filter="currentStageCode">
              <option value="">全部</option>
              ${WORKFLOW_STAGE_DEFS.map((stage) => `<option value="${escapeHtml(stage.stageCode)}"${workflowFilters.currentStageCode === stage.stageCode ? ' selected' : ''}>${escapeHtml(stage.stageLabel)}</option>`).join('')}
            </select>
          </label>
          <label class="workflow-filter-group">
            <span class="workflow-filter-label">状态</span>
            <select class="workflow-filter-input" data-wf-filter="overallStatus">
              <option value="">全部</option>
              <option value="draft"${workflowFilters.overallStatus === 'draft' ? ' selected' : ''}>草稿</option>
              <option value="review_pending"${workflowFilters.overallStatus === 'review_pending' ? ' selected' : ''}>待评审</option>
              <option value="returned"${workflowFilters.overallStatus === 'returned' ? ' selected' : ''}>已退回</option>
              <option value="active"${workflowFilters.overallStatus === 'active' ? ' selected' : ''}>执行中</option>
              <option value="closed"${workflowFilters.overallStatus === 'closed' ? ' selected' : ''}>已关闭</option>
            </select>
          </label>
        </div>
        ${workflowUiErrors.length ? `<div class="workflow-inline-error">${escapeHtml(workflowUiErrors.join('；'))}</div>` : ''}
      </section>
      <div class="workflow-flow-grid">
        <aside class="workflow-flow-side">
          <article class="card workflow-flow-card">
            <div class="workflow-record-list-head">
              <div>
                <div class="workflow-flow-card-title">报价记录列表</div>
                <div class="workflow-doc-meta">按单线束号查看当前阶段、规则覆盖、出货与回收状态。</div>
              </div>
              <div class="workflow-doc-meta">${fmtInt(filteredRecords.length)} / ${fmtInt(safeArray(workflowSnapshot.records).length)} 条</div>
            </div>
            ${recordListHtml}
          </article>
          <article class="card workflow-flow-card">
            <div class="workflow-flow-card-head">
              <div class="workflow-flow-card-title">提醒队列</div>
              <button class="button ghost" type="button" data-workflow-nav="recovery-center">去回收中心</button>
            </div>
            <div class="workflow-alert-list">
              ${alertRows.length ? alertRows.map((alert) => `
                <article class="workflow-alert-item ${toText(alert.level, 'info') === 'warning' ? 'is-warning' : 'is-info'}">
                  <strong>${escapeHtml(alert.title)}</strong>
                  <span>${escapeHtml(alert.message)}</span>
                </article>
              `).join('') : '<div class="workflow-empty">当前没有待处理提醒。</div>'}
            </div>
          </article>
        </aside>
        <div class="workflow-flow-main">
          <article class="card workflow-flow-card">
            <div class="workflow-flow-card-head">
              <div>
                <div class="workflow-flow-card-title">七阶段流程图概览</div>
                <div class="workflow-doc-meta">节点显示全局记录量；选择单条记录后会同步显示该记录在各阶段的完成度。</div>
              </div>
              <button class="button ghost" type="button" data-workflow-nav="quote-control">去记录创建器</button>
            </div>
            ${workflowFlowOverviewHtml(workflowSnapshot, selectedRecord)}
          </article>
          <section class="workflow-doc-grid">
            ${documentCardsHtml}
          </section>
          ${workflowBomSheetHtml(selectedRecord)}
          ${workflowDetailHtml(selectedRecord, trackingRows)}
          <section class="workflow-flow-grid">
            <article class="card workflow-side-card">
              <div class="project-summary-caption">
                <div class="project-summary-caption-title">执行回收联动区</div>
                <div class="project-summary-caption-meta">承载线束、出货进度、阈值与开票 / 调价复核。</div>
              </div>
              <div class="workflow-threshold-list">
                ${thresholdRows.length ? thresholdRows.map((row) => `
                  <article class="workflow-threshold-item">
                    <div class="workflow-threshold-head">
                      <strong>${escapeHtml(row.harnessId)}</strong>
                      <span>${escapeHtml(row.thresholdReached ? '已触发' : '跟踪中')}</span>
                    </div>
                    <div class="workflow-threshold-meta">
                      <span>${escapeHtml(row.harnessName || '-')}</span>
                      <span>出货 ${fmtInt(row.deliveredSets)} / ${fmtInt(row.recoveryLimitSets || 0)} 套</span>
                    </div>
                    <div class="workflow-progress"><span style="width:${Math.max(0, Math.min(numberOr(row.progressRatio, 0), 1)) * 100}%"></span></div>
                    <div class="workflow-threshold-foot">
                      <span>已回收 ${fmtMoney(row.recoveredAmount)}</span>
                      <span>待回收 ${fmtMoney(row.remainingAmount)}</span>
                    </div>
                  </article>
                `).join('') : '<div class="workflow-empty">当前没有可跟踪的回收阈值记录。</div>'}
              </div>
            </article>
            <article class="card workflow-side-card">
              <div class="project-summary-caption">
                <div class="project-summary-caption-title">流程摘要</div>
                <div class="project-summary-caption-meta">用于快速切回利润页、数据页和商务录入入口。</div>
              </div>
              <div class="workflow-summary-grid">
                ${summaryCards.map((card) => `
                  <article class="workflow-summary-card">
                    <span class="workflow-summary-label">${escapeHtml(card.label)}</span>
                    <strong class="workflow-summary-value">${escapeHtml(card.value)}</strong>
                    <span class="workflow-summary-meta">${escapeHtml(card.meta)}</span>
                  </article>
                `).join('')}
              </div>
              <div class="workflow-doc-actions">
                <button class="button ghost" type="button" data-workflow-nav="profit-summary">看利润汇总</button>
                <button class="button ghost" type="button" data-workflow-nav="data-management">看数据管理</button>
              </div>
            </article>
          </section>
        </div>
      </div>
    </div>
  `.trim();
}

function renderTags(m){
  const tags = [
    `BOM ${m.bom.label}`,
    `铜铝 ${m.metal.label}`,
    `连接器 ${m.conn.label}`,
    `工时 ${m.labor.label}`,
    `资源投入 ${m.equip.label}`,
    `包装 ${m.pack.label}`,
    `年降 ${m.annualDrop?.label || ''}`.trim(),
    `一次性费用 ${m.oneTimeCustomer?.label || ''}`.trim(),
    `返点 ${m.rebate?.label || ''}`.trim(),
    `VAVE ${m.vave.label}`,
  ].filter((item) => !/\s$/.test(item));
  if (m.connectorSummary?.overrideCount) {
    tags.splice(3, 0, `连接器覆盖 ${m.connectorSummary.overrideCount} 项`);
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

function buildHarnessProfitRows(m) {
  const validation = RUNTIME.bomValidation;
  const harnessOrder = Array.isArray(validation?.harnessOrder) ? validation.harnessOrder : [];
  if (!harnessOrder.length) return [];

  const comparisons = validation?.comparisons || {};
  const workbookVersionKey = resolveWorkbookVersionKeyFromBomState();
  const versionLabel = VIEWER_VERSION_LABELS[workbookVersionKey] || workbookVersionKey || '当前';
  const avgAsp = Array.isArray(m.annual) && m.annual.length
    ? m.annual.reduce((sum, row) => sum + (Number(row.asp) || 0), 0) / m.annual.length
    : 0;
  const totalLabor = (Number(m.directLabor) || 0) + (Number(m.manufacturing) || 0);
  const capitalAndRnd = (Number(m.equipment) || 0) + (Number(m.rnd) || 0);

  const baseRows = harnessOrder.map((harnessId) => {
    const comparison = comparisons[harnessId] || {};
    const summary = comparison.summary || {};
    const itemCounts = summary.itemCounts || {};
    const weight = Number(itemCounts[workbookVersionKey])
      || Number(itemCounts.fixed)
      || Number(itemCounts.quote)
      || Number(itemCounts.tt)
      || 0;
    return {
      harnessId,
      harnessName: comparison.harnessName || harnessId,
      weight,
      matchedCount: Number(summary.matchedCount) || 0,
      connectorGroupCount: Number(summary.connectorGroupCount) || 0,
      syncGroupCount: Number(summary.syncGroupCount) || 0,
    };
  });

  const weightedRows = baseRows.filter((row) => row.weight > 0);
  const totalWeight = weightedRows.reduce((sum, row) => sum + row.weight, 0);
  const fallbackShare = baseRows.length ? 1 / baseRows.length : 0;

  return baseRows.map((row) => {
    const share = totalWeight > 0 && row.weight > 0 ? row.weight / totalWeight : fallbackShare;
    const revenue = avgAsp * share;
    const material = (Number(m.material) || 0) * share;
    const labor = totalLabor * share;
    const packaging = (Number(m.packaging) || 0) * share;
    const capital = capitalAndRnd * share;
    const cost = material + labor + packaging + capital;
    const profit = revenue - cost;
    const margin = revenue ? profit / revenue : 0;
    return {
      ...row,
      share,
      revenue,
      material,
      labor,
      packaging,
      capital,
      cost,
      profit,
      margin,
      basis: totalWeight > 0 && row.weight > 0
        ? `${versionLabel} BOM件数 ${row.weight}/${totalWeight}`
        : '平均分摊',
    };
  }).sort((left, right) => right.cost - left.cost);
}

function renderHarnessProfit(m) {
  if (!el.harnessProfitSummary || !el.harnessProfitNote || !el.harnessProfitTable) return;

  let breakdown = null;
  if (window.G281HarnessProfit?.buildHarnessProfitBreakdown) {
    try {
      breakdown = window.G281HarnessProfit.buildHarnessProfitBreakdown(RUNTIME, m);
    } catch (error) {
      console.error('Failed to build harness profit breakdown', error);
    }
  }

  if (Array.isArray(breakdown?.harnesses) && breakdown.harnesses.length) {
    const harnessRows = breakdown.harnesses.slice().sort((left, right) => (Number(right.unitCostEstimated) || 0) - (Number(left.unitCostEstimated) || 0));
    const wireRows = Array.isArray(breakdown.wireLines) ? breakdown.wireLines.slice().sort((left, right) => (Number(right.materialCost) || 0) - (Number(left.materialCost) || 0)) : [];
    const bestRow = harnessRows.reduce((best, row) => (row.marginEstimated > best.marginEstimated ? row : best), harnessRows[0]);
    const worstRow = harnessRows.reduce((worst, row) => (row.marginEstimated < worst.marginEstimated ? row : worst), harnessRows[0]);
    const summaryCards = [
      ['线束条目', `${harnessRows.length} 条`, `${escapeHtml(breakdown.meta?.selectedBomVersionLabel || '当前 BOM')} / 导线 ${fmtInt(breakdown.totals?.wireLineCount || 0)} 根`],
      ['整套收入/套', `${fmtMoney(breakdown.portfolio?.unitRevenue || 0)} 元`, '整套利润口径直接取当前引擎结果'],
      ['整套成本/套', `${fmtMoney(breakdown.portfolio?.unitCost || 0)} 元`, '材料 + 工时 + 包装 + 设备 + 研发'],
      ['整套毛利率', fmtPct(breakdown.portfolio?.margin || 0), `单套毛利 ${fmtMoney(breakdown.portfolio?.unitProfit || 0)} 元`],
      ['最高毛利线束', `${bestRow.harnessId}`, `${bestRow.harnessName} / ${fmtPct(bestRow.marginEstimated)}`],
      ['最低毛利线束', `${worstRow.harnessId}`, `${worstRow.harnessName} / ${fmtPct(worstRow.marginEstimated)}`],
    ];
    el.harnessProfitSummary.innerHTML = summaryCards.map(([label, value, meta]) => `
      <div class="wire-model-stat">
        <div class="label">${escapeHtml(label)}</div>
        <div class="value">${escapeHtml(value)}</div>
        <div class="meta">${typeof meta === 'string' ? meta : escapeHtml(meta)}</div>
      </div>
    `).join('');

    const noteParts = [
      `当前按 ${breakdown.meta?.selectedBomVersionLabel || '当前 BOM'} 版展示单根线束利润。`,
      `导线目录命中 ${fmtInt(breakdown.totals?.matchedWireLineCount || 0)} 项，未命中 ${fmtInt(breakdown.totals?.unmatchedWireLineCount || 0)} 项，仅用于支撑线束原材料成本拆解。`,
      '导线属于原材料，页面只看导线成本；利润工作台只展示整套线和单根线束利润。',
    ];
    if (Array.isArray(breakdown.meta?.warnings) && breakdown.meta.warnings.length) {
      noteParts.push(breakdown.meta.warnings.join(' '));
    }
    el.harnessProfitNote.textContent = typeof noteParts !== 'undefined'
      ? noteParts.join(' ')
      : (typeof versionLabel !== 'undefined'
        ? `当前按 ${versionLabel} 版 BOM 件数占比对整套收入和成本做结构分摊，用于定位哪一根线束在拉低利润；导线型号、用量和单价请在导线原材料成本计算区查看。`
        : '当前没有可用于展示单根线束利润的线束级数据；导线型号、用量和单价请在导线原材料成本计算区查看。');

    el.harnessProfitTable.innerHTML = harnessRows.map((row) => {
      const tone = row.marginEstimated <= (Number(m.margin) || 0) * 0.65 ? 'low' : row.marginEstimated >= (Number(m.margin) || 0) * 1.15 ? 'high' : 'mid';
      const basis = `${fmtInt(row.counts?.selectedItemCount || 0)} 件 / 导线 ${fmtInt(row.counts?.wireLineCount || 0)} 根`;
      return `
        <tr data-profit-tone="${tone}">
          <td>${escapeHtml(row.harnessId)}</td>
          <td>${escapeHtml(row.harnessName)}</td>
          <td>${fmtMoney(row.unitRevenueEstimated)}</td>
          <td>${fmtMoney(row.unitCostEstimated)}</td>
          <td class="${row.unitProfitEstimated >= 0 ? 'positive' : 'negative'}">${fmtMoney(row.unitProfitEstimated)}</td>
          <td class="${row.marginEstimated >= 0 ? 'positive' : 'negative'}">${fmtPct(row.marginEstimated)}</td>
          <td>${fmtMoney(row.unitMaterialCost)}</td>
          <td>${fmtMoney((Number(row.unitDirectLaborCost) || 0) + (Number(row.unitManufacturingCost) || 0))}</td>
          <td>${fmtMoney(row.unitPackagingCost)}</td>
          <td>${fmtMoney((Number(row.unitEquipmentCost) || 0) + (Number(row.unitRndCost) || 0))}</td>
          <td>${escapeHtml(basis)}</td>
        </tr>
      `;
    }).join('');

    if (el.wireProfitTable) {
      el.wireProfitTable.innerHTML = wireRows.length ? wireRows.map((row) => {
        const precision = row.catalogMatched ? '目录命中' : '残余分摊';
        return `
          <tr>
            <td>${escapeHtml(row.harnessId)}</td>
            <td>${escapeHtml(row.partNumber || row.itemKey || '-')}</td>
            <td>${escapeHtml(row.partName || row.catalogName || '-')}</td>
            <td>${escapeHtml((row.sapNos || []).join(' / ') || '-')}</td>
            <td>${fmtNumber(row.quantity, 2)}${row.unit ? ` ${escapeHtml(row.unit)}` : ''}</td>
            <td>${fmtMoney(row.materialCost, 4)}</td>
            <td>${fmtMoney(row.unitCostEstimated, 4)}</td>
            <td>${fmtMoney(row.unitRevenueEstimated, 4)}</td>
            <td class="${row.unitProfitEstimated >= 0 ? 'positive' : 'negative'}">${fmtMoney(row.unitProfitEstimated, 4)}</td>
            <td class="${row.marginEstimated >= 0 ? 'positive' : 'negative'}">${fmtPct(row.marginEstimated)}</td>
            <td>${escapeHtml(precision)}</td>
          </tr>
        `;
      }).join('') : '<tr><td colspan="11" class="wire-empty-cell">当前 BOM 版本下未识别到可拆解的导线行。</td></tr>';
    }
    return;
  }

  const rows = buildHarnessProfitRows(m);
  const avgAsp = Array.isArray(m.annual) && m.annual.length
    ? m.annual.reduce((sum, row) => sum + (Number(row.asp) || 0), 0) / m.annual.length
    : 0;

  if (!rows.length) {
    el.harnessProfitSummary.innerHTML = '<div class="wire-model-stat"><div class="label">线束条目</div><div class="value">0 条</div><div class="meta">当前未加载线束级 BOM 对照数据</div></div>';
    el.harnessProfitNote.textContent = typeof noteParts !== 'undefined'
      ? noteParts.join(' ')
      : (typeof versionLabel !== 'undefined'
        ? `当前按 ${versionLabel} 版 BOM 件数占比对整套收入和成本做结构分摊，用于定位哪一根线束在拉低利润；导线型号、用量和单价请在导线原材料成本计算区查看。`
        : '当前没有可用于展示单根线束利润的线束级数据；导线型号、用量和单价请在导线原材料成本计算区查看。');
    el.harnessProfitTable.innerHTML = '<tr><td colspan="11" class="wire-empty-cell">当前未加载线束级利润拆解数据。</td></tr>';
    if (el.wireProfitTable) {
      el.wireProfitTable.innerHTML = '<tr><td colspan="11" class="wire-empty-cell">当前未加载单根导线利润拆解数据。</td></tr>';
    }
    return;
  }

  const bestRow = rows.reduce((best, row) => (row.margin > best.margin ? row : best), rows[0]);
  const worstRow = rows.reduce((worst, row) => (row.margin < worst.margin ? row : worst), rows[0]);
  const summaryCards = [
    ['线束条目', `${rows.length} 条`, '按当前 BOM 版本逐条展开'],
    ['整套收入/套', `${fmtMoney(avgAsp)} 元`, '当前场景加权 ASP'],
    ['整套成本/套', `${fmtMoney(m.operating)} 元`, '材料 + 工时 + 包装 + 设备 + 研发'],
    ['整套毛利率', fmtPct(m.margin), `单套毛利 ${fmtMoney(avgAsp - m.operating)} 元`],
    ['最高毛利条目', `${bestRow.harnessId}`, `${bestRow.harnessName} / ${fmtPct(bestRow.margin)}`],
    ['最低毛利条目', `${worstRow.harnessId}`, `${worstRow.harnessName} / ${fmtPct(worstRow.margin)}`],
  ];
  el.harnessProfitSummary.innerHTML = summaryCards.map(([label, value, meta]) => `
    <div class="wire-model-stat">
      <div class="label">${escapeHtml(label)}</div>
      <div class="value">${escapeHtml(value)}</div>
      <div class="meta">${escapeHtml(meta)}</div>
    </div>
  `).join('');

  const workbookVersionKey = resolveWorkbookVersionKeyFromBomState();
  const versionLabel = VIEWER_VERSION_LABELS[workbookVersionKey] || workbookVersionKey || '当前';
  el.harnessProfitNote.textContent = typeof noteParts !== 'undefined'
      ? noteParts.join(' ')
      : (typeof versionLabel !== 'undefined'
        ? `当前按 ${versionLabel} 版 BOM 件数占比对整套收入和成本做结构分摊，用于定位哪一根线束在拉低利润；导线型号、用量和单价请在导线原材料成本计算区查看。`
        : '当前没有可用于展示单根线束利润的线束级数据；导线型号、用量和单价请在导线原材料成本计算区查看。');

  el.harnessProfitTable.innerHTML = rows.map((row) => {
    const tone = row.margin <= m.margin * 0.65 ? 'low' : row.margin >= m.margin * 1.15 ? 'high' : 'mid';
    return `
      <tr data-profit-tone="${tone}">
        <td>${escapeHtml(row.harnessId)}</td>
        <td>${escapeHtml(row.harnessName)}</td>
        <td>${fmtMoney(row.revenue)}</td>
        <td>${fmtMoney(row.cost)}</td>
        <td class="${row.profit >= 0 ? 'positive' : 'negative'}">${fmtMoney(row.profit)}</td>
        <td class="${row.margin >= 0 ? 'positive' : 'negative'}">${fmtPct(row.margin)}</td>
        <td>${fmtMoney(row.material)}</td>
        <td>${fmtMoney(row.labor)}</td>
        <td>${fmtMoney(row.packaging)}</td>
        <td>${fmtMoney(row.capital)}</td>
        <td>${escapeHtml(row.basis)}</td>
      </tr>
    `;
  }).join('');

  if (el.wireProfitTable) {
    el.wireProfitTable.innerHTML = '<tr><td colspan="11" class="wire-empty-cell">当前仍在使用旧的件数占比分摊逻辑，单根导线明细待新利润引擎挂接后展示。</td></tr>';
  }
}

function getQuoteWorkbookMatrix() {
  if (latestQuoteWorkbookMatrix) return latestQuoteWorkbookMatrix;
  if (!window.G281HarnessProfit?.buildQuoteWorkbookMatrix) return null;
  try {
    latestQuoteWorkbookMatrix = window.G281HarnessProfit.buildQuoteWorkbookMatrix(RUNTIME);
    return latestQuoteWorkbookMatrix;
  } catch (error) {
    console.error('Failed to build quote workbook matrix', error);
    return null;
  }
}

function quoteMatrixCell(matrix, rowKey, harnessId) {
  return safeObject(safeObject(matrix?.harnessCostMatrix)[rowKey])[harnessId] || null;
}

function renderQuoteWorkbookProjectSummary(matrix) {
  if (!el.projectProfitSummaryMount) return false;
  const summary = safeObject(matrix?.projectSummary);
  const harnessColumns = safeArray(matrix?.harnessColumns);
  const badges = [
    '报价版',
    '核算表真实值',
    `${fmtInt(harnessColumns.length)} 款线束`,
    `${fmtInt(safeArray(matrix?.sheetOrder).length)} 张来源 sheet`,
  ];
  if (el.projectProfitSummaryBadges) {
    el.projectProfitSummaryBadges.innerHTML = badges.map((item) => `<span class="summary-badge">${escapeHtml(item)}</span>`).join('');
  }

  const summaryItems = [
    ['目标销售数量', `${fmtInt(summary.totalVolume)} 套`],
    ['目标销售收入', fmtMoney(summary.totalRevenue)],
    ['目标利润额', fmtMoney(summary.totalProfit)],
    ['毛利率', fmtPct(summary.grossMargin)],
    ['单套项目总成本', fmtMoney(summary.totalCost)],
    ['单套材料成本', fmtMoney(summary.material)],
    ['单套直接人工', fmtMoney(summary.directLabor)],
    ['单套设备成本', fmtMoney(summary.equipment)],
    ['制造费用', fmtMoney(summary.manufacturing)],
    ['研发费用', fmtMoney(summary.rnd)],
    ['包装物流', fmtMoney(summary.packaging)],
  ];

  el.projectProfitSummaryMount.innerHTML = `
    <div class="quote-matrix-summary-grid">
      ${summaryItems.map(([label, value]) => `
        <article class="quote-matrix-summary-item">
          <span>${escapeHtml(label)}</span>
          <strong>${escapeHtml(value)}</strong>
        </article>
      `).join('')}
    </div>
    <p class="quote-matrix-hero-note">利润区已切换为报价核算表真实费用矩阵。下方每一列直接对应《项目评估汇总（昆山90%）》的单线束列，点击任意列或单元格可下钻公式与来源。</p>
  `.trim();

  if (el.projectProfitAnnualMount) {
    el.projectProfitAnnualMount.innerHTML = `
      <div class="quote-matrix-detail-grid">
        <div class="quote-matrix-source-card"><span>工作簿</span><strong>${escapeHtml(toText(matrix?.workbookName, '-'))}</strong></div>
        <div class="quote-matrix-source-card"><span>汇总 sheet</span><strong>${escapeHtml(toText(summary.sheetName, '项目评估汇总（昆山90%）'))}</strong></div>
        <div class="quote-matrix-source-card"><span>矩阵行数</span><strong>${fmtInt(safeArray(matrix?.summaryRows).length)}</strong></div>
        <div class="quote-matrix-source-card"><span>来源快照</span><strong>${fmtInt(safeArray(matrix?.sheetOrder).length)} 张</strong></div>
      </div>
    `.trim();
  }

  if (el.harnessProfitMount) {
    const focusRows = harnessColumns.slice().sort((left, right) => {
      const rightValue = Number(quoteMatrixCell(matrix, 'projectCost', right.harnessId)?.value) || 0;
      const leftValue = Number(quoteMatrixCell(matrix, 'projectCost', left.harnessId)?.value) || 0;
      return rightValue - leftValue;
    }).slice(0, 3);
    el.harnessProfitMount.innerHTML = `
      <div class="harness-focus-list">
        ${focusRows.map((row, index) => `
          <button type="button" class="harness-focus-item quote-matrix-cell-trigger" data-quote-matrix-open="true" data-harness-id="${escapeHtml(row.harnessId)}">
            <span class="harness-focus-rank">${index + 1}</span>
            <span class="harness-focus-copy">
              <strong>${escapeHtml(row.harnessId)}</strong>
              <span>${escapeHtml(row.harnessName || row.harnessId)}</span>
              <em>配置数量 ${fmtInt(row.configQty)} / 装车比 ${fmtPct(row.loadRatio)}</em>
            </span>
            <span class="harness-focus-metrics">
              <strong>${escapeHtml(quoteMatrixCell(matrix, 'projectCost', row.harnessId)?.displayText || '-')}</strong>
              <em>单套项目总成本</em>
            </span>
          </button>
        `).join('')}
      </div>
    `.trim();
  }
  return true;
}

function renderQuoteWorkbookMatrix(matrix) {
  if (!el.harnessProfitSummary || !el.harnessProfitNote || !el.harnessProfitTable) return false;
  const head = el.harnessProfitHead || document.querySelector('.harness-profit-table thead');
  const table = el.harnessProfitTable.closest('table');
  const wrap = table?.closest('.table-wrap');
  if (!head) return false;
  el.harnessProfitHead = head;
  wrap?.classList.add('quote-matrix-table-wrap');
  table?.classList.add('quote-matrix-table');
  const summaryRows = safeArray(matrix?.summaryRows);
  const harnessColumns = safeArray(matrix?.harnessColumns);

  el.harnessProfitSummary.innerHTML = `
    <div class="quote-matrix-summary-grid">
      <article class="quote-matrix-summary-item"><span>线束列数</span><strong>${fmtInt(harnessColumns.length)}</strong></article>
      <article class="quote-matrix-summary-item"><span>费用行数</span><strong>${fmtInt(summaryRows.length)}</strong></article>
      <article class="quote-matrix-summary-item"><span>来源工作簿</span><strong>${escapeHtml(toText(matrix?.workbookName, '-'))}</strong></article>
      <article class="quote-matrix-summary-item"><span>解析来源</span><strong>${fmtInt(safeArray(matrix?.sheetOrder).length)} 张 sheet</strong></article>
    </div>
  `.trim();
  el.harnessProfitNote.textContent = '横向逐列查看 11 款线束的真实费用差异。左侧固定费用项、费率说明与公式来源；右侧每个单元格都是核算表真实值，不再按程序模拟分摊。';

  head.innerHTML = `
    <tr>
      <th class="quote-matrix-sticky-1">费用项</th>
      <th class="quote-matrix-sticky-2">费率 / 说明</th>
      <th class="quote-matrix-sticky-3">公式来源</th>
      ${harnessColumns.map((column) => `
        <th class="quote-matrix-colhead">
          <button type="button" class="quote-matrix-cell-trigger" data-quote-matrix-open="true" data-harness-id="${escapeHtml(column.harnessId)}">
            <strong>${escapeHtml(column.harnessId)}</strong>
            <span>${escapeHtml(column.harnessName || column.harnessId)}</span>
            <em class="quote-matrix-colmeta">配置 ${fmtInt(column.configQty)} / 装车比 ${fmtPct(column.loadRatio)} / 总量 ${fmtInt(column.lifecycleVolume)}</em>
          </button>
        </th>
      `).join('')}
    </tr>
  `.trim();

  el.harnessProfitTable.innerHTML = summaryRows.map((row) => `
    <tr data-quote-row="${escapeHtml(row.key)}">
      <th class="quote-matrix-sticky-1">${escapeHtml(row.label)}</th>
      <td class="quote-matrix-sticky-2">${escapeHtml(toText(row.note, '-'))}</td>
      <td class="quote-matrix-sticky-3"><span class="quote-matrix-source-chip">${escapeHtml(toText(row.sourceSummary, '-'))}</span></td>
      ${harnessColumns.map((column) => {
        const cell = quoteMatrixCell(matrix, row.key, column.harnessId);
        return `
          <td class="quote-matrix-cell">
            <button type="button" class="quote-matrix-cell-trigger" data-quote-matrix-open="true" data-harness-id="${escapeHtml(column.harnessId)}" data-row-key="${escapeHtml(row.key)}">
              ${escapeHtml(toText(cell?.displayText, '-'))}
            </button>
          </td>
        `;
      }).join('')}
    </tr>
  `).join('');
  return true;
}

function quoteMatrixSourceLabel(source) {
  const base = `${toText(source?.sheetName, '-') }!${toText(source?.address, '-')}`;
  const value = toText(source?.displayText, '');
  return value ? `${base} = ${value}` : base;
}

function renderQuoteMatrixResourceRows(rows) {
  return safeArray(rows).map((row) => `
    <tr${row.templateOnly ? ' class="is-template"' : ''}>
      <td>${escapeHtml(toText(row.itemName || row.label, '-'))}</td>
      <td>${escapeHtml(toText(row.spec, '-'))}</td>
      <td>${escapeHtml(toText(row.demandQty, '0'))}</td>
      <td>${escapeHtml(toText(row.unitPrice, '0'))}</td>
      <td>${escapeHtml(toText(row.newAmount, '0'))}</td>
      <td>${escapeHtml(`${toText(row.sheetName, '-')}:${toText(row.demandAddress || row.address, '-')}`)}</td>
    </tr>
  `).join('');
}

function renderQuoteMatrixDrawer() {
  if (!el.quoteMatrixDrawerBody || !el.quoteMatrixDrawerMeta) return;
  const matrix = latestQuoteWorkbookMatrix;
  const harnessId = toText(quoteMatrixDrawerState.harnessId, '');
  const detail = safeObject(safeObject(matrix?.harnessSourceDetails)[harnessId]);
  if (!harnessId || !detail.harnessId) {
    el.quoteMatrixDrawerBody.innerHTML = '<div class="project-empty-state">未找到该线束的来源明细。</div>';
    el.quoteMatrixDrawerMeta.textContent = '';
    return;
  }

  const focusRow = safeArray(detail.rows).find((row) => row.rowKey === quoteMatrixDrawerState.rowKey) || null;
  const groupLabels = {
    sales: '销售与毛利',
    cost: '成本总览',
    labor: '直接人工',
    capital: '设备 / 模具 / 工装',
    manufacturing: '制造费用',
    support: '研发与包装',
  };
  const groupOrder = ['sales', 'cost', 'labor', 'capital', 'manufacturing', 'support'];
  const groupedRows = groupOrder.map((group) => ({
    key: group,
    label: groupLabels[group],
    rows: safeArray(detail.rows).filter((row) => row.group === group),
  })).filter((group) => group.rows.length);

  el.quoteMatrixDrawerMeta.textContent = `${detail.harnessId} / ${detail.harnessName || detail.harnessId} / 配置数量 ${fmtInt(detail.configQty)} / 装车比 ${fmtPct(detail.loadRatio)} / 生命周期 ${fmtInt(detail.lifecycleVolume)} 套`;
  el.quoteMatrixDrawerBody.innerHTML = `
    ${focusRow ? `
      <section class="quote-matrix-resource-group">
        <h4>当前点击项</h4>
        <div class="quote-matrix-detail-grid">
          <div class="quote-matrix-source-card"><span>费用项</span><strong>${escapeHtml(focusRow.label)}</strong></div>
          <div class="quote-matrix-source-card"><span>当前值</span><strong>${escapeHtml(toText(focusRow.displayText, '-'))}</strong></div>
          <div class="quote-matrix-source-card"><span>公式</span><strong>${escapeHtml(toText(focusRow.formula, '-'))}</strong></div>
        </div>
      </section>
    ` : ''}
    <section class="quote-matrix-resource-group">
      <h4>线束基础信息</h4>
      <div class="quote-matrix-detail-grid">
        <div class="quote-matrix-source-card"><span>线束号</span><strong>${escapeHtml(detail.harnessId)}</strong></div>
        <div class="quote-matrix-source-card"><span>线束名称</span><strong>${escapeHtml(detail.harnessName || detail.harnessId)}</strong></div>
        <div class="quote-matrix-source-card"><span>配置数量</span><strong>${fmtInt(detail.configQty)}</strong></div>
        <div class="quote-matrix-source-card"><span>装车比</span><strong>${fmtPct(detail.loadRatio)}</strong></div>
        <div class="quote-matrix-source-card"><span>总生命周期量</span><strong>${fmtInt(detail.lifecycleVolume)}</strong></div>
        <div class="quote-matrix-source-card"><span>目标售价</span><strong>${fmtMoney(detail.targetAsp)}</strong></div>
      </div>
    </section>
    ${groupedRows.map((group) => `
      <section class="quote-matrix-resource-group">
        <h4>${escapeHtml(group.label)}</h4>
        <table class="quote-matrix-detail-table">
          <thead><tr><th>费用项</th><th>值</th><th>公式</th><th>来源</th></tr></thead>
          <tbody>
            ${group.rows.map((row) => `
              <tr${row.rowKey === quoteMatrixDrawerState.rowKey ? ' class="is-selected"' : ''}>
                <td>${escapeHtml(row.label)}</td>
                <td>${escapeHtml(toText(row.displayText, '-'))}</td>
                <td>${escapeHtml(toText(row.formula, '-'))}</td>
                <td>${safeArray(row.sources).length ? safeArray(row.sources).map((source) => `<span class="quote-matrix-source-chip">${escapeHtml(quoteMatrixSourceLabel(source))}</span>`).join('') : '<span class="quote-matrix-source-chip">无额外来源</span>'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </section>
    `).join('')}
    ${safeArray(detail.resources?.equipment).map((group) => `
      <section class="quote-matrix-resource-group">
        <h4>${escapeHtml(group.label)}</h4>
        <table class="quote-matrix-resource-table">
          <thead><tr><th>名称</th><th>规格</th><th>需求数量</th><th>单价</th><th>新增金额</th><th>来源</th></tr></thead>
          <tbody>${renderQuoteMatrixResourceRows(group.rows)}</tbody>
        </table>
      </section>
    `).join('')}
    ${safeArray(detail.resources?.tooling).map((group) => `
      <section class="quote-matrix-resource-group">
        <h4>${escapeHtml(group.label)}</h4>
        <table class="quote-matrix-resource-table">
          <thead><tr><th>名称</th><th>规格</th><th>需求数量</th><th>单价</th><th>新增金额</th><th>来源</th></tr></thead>
          <tbody>${renderQuoteMatrixResourceRows(group.rows)}</tbody>
        </table>
      </section>
    `).join('')}
    ${safeArray(detail.resources?.fixtures).map((group) => `
      <section class="quote-matrix-resource-group">
        <h4>${escapeHtml(group.label)}</h4>
        <table class="quote-matrix-resource-table">
          <thead><tr><th>名称</th><th>规格</th><th>需求数量</th><th>单价</th><th>新增金额</th><th>来源</th></tr></thead>
          <tbody>${renderQuoteMatrixResourceRows(group.rows)}</tbody>
        </table>
      </section>
    `).join('')}
    <section class="quote-matrix-resource-group">
      <h4>包装物流分项</h4>
      <table class="quote-matrix-resource-table">
        <thead><tr><th>分项</th><th>值</th><th>来源</th></tr></thead>
        <tbody>
          ${safeArray(detail.resources?.packaging).map((row) => `
            <tr>
              <td>${escapeHtml(row.label)}</td>
              <td>${escapeHtml(toText(row.displayText, '-'))}</td>
              <td>${escapeHtml(`${toText(row.sheetName, '-')}:${toText(row.address, '-')}`)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </section>
  `.trim();
}

function setQuoteMatrixDrawerOpen(open, harnessId, rowKey) {
  if (!el.quoteMatrixDrawer) return;
  if (!open) {
    quoteMatrixDrawerState = { harnessId: '', rowKey: '' };
    el.quoteMatrixDrawer.classList.remove('open');
    el.quoteMatrixDrawer.hidden = true;
    el.quoteMatrixDrawer.setAttribute('aria-hidden', 'true');
    return;
  }
  quoteMatrixDrawerState = {
    harnessId: toText(harnessId, ''),
    rowKey: toText(rowKey, ''),
  };
  renderQuoteMatrixDrawer();
  el.quoteMatrixDrawer.hidden = false;
  el.quoteMatrixDrawer.classList.add('open');
  el.quoteMatrixDrawer.setAttribute('aria-hidden', 'false');
}

function renderHarnessProfitV2(m) {
  if (!el.harnessProfitSummary || !el.harnessProfitNote || !el.harnessProfitTable) return;

  if (el.wireProfitTable) {
    const wireTableWrap = el.wireProfitTable.closest('.table-wrap');
    const wireHeadingBlock = wireTableWrap?.previousElementSibling;
    if (wireHeadingBlock) wireHeadingBlock.hidden = true;
    if (wireTableWrap) wireTableWrap.hidden = true;
  }

  const quoteMatrix = getQuoteWorkbookMatrix();
  if (quoteMatrix) {
    renderQuoteWorkbookMatrix(quoteMatrix);
    return;
  }

  let breakdown = null;
  if (window.G281HarnessProfit?.buildHarnessProfitBreakdown) {
    try {
      breakdown = window.G281HarnessProfit.buildHarnessProfitBreakdown(RUNTIME, m);
    } catch (error) {
      console.error('Failed to build harness profit breakdown', error);
    }
  }

  if (Array.isArray(breakdown?.harnesses) && breakdown.harnesses.length) {
    const harnessRows = breakdown.harnesses
      .slice()
      .sort((left, right) => (Number(right.unitCostEstimated) || 0) - (Number(left.unitCostEstimated) || 0));
    const bestRow = harnessRows.reduce((best, row) => (row.marginEstimated > best.marginEstimated ? row : best), harnessRows[0]);
    const worstRow = harnessRows.reduce((worst, row) => (row.marginEstimated < worst.marginEstimated ? row : worst), harnessRows[0]);
    const summaryCards = [
      ['线束条目', `${harnessRows.length} 条`, `${breakdown.meta?.selectedBomVersionLabel || '当前 BOM'} / 单根线束利润`],
      ['整套收入/套', `${fmtMoney(breakdown.portfolio?.unitRevenue || 0)} 元`, '整套收入直接取当前利润引擎结果'],
      ['整套成本/套', `${fmtMoney(breakdown.portfolio?.unitCost || 0)} 元`, '材料 + 工时 + 包装 + 设备 + 研发'],
      ['整套毛利率', fmtPct(breakdown.portfolio?.margin || 0), `单套毛利 ${fmtMoney(breakdown.portfolio?.unitProfit || 0)} 元`],
      ['最高毛利线束', `${bestRow.harnessId}`, `${bestRow.harnessName} / ${fmtPct(bestRow.marginEstimated)}`],
      ['最低毛利线束', `${worstRow.harnessId}`, `${worstRow.harnessName} / ${fmtPct(worstRow.marginEstimated)}`],
    ];
    el.harnessProfitSummary.innerHTML = summaryCards.map(([label, value, meta]) => `
      <div class="wire-model-stat">
        <div class="label">${escapeHtml(label)}</div>
        <div class="value">${escapeHtml(value)}</div>
        <div class="meta">${escapeHtml(meta)}</div>
      </div>
    `).join('');

    const noteParts = [
      `当前按 ${breakdown.meta?.selectedBomVersionLabel || '当前 BOM'} 版展示单根线束利润。`,
      `导线目录命中 ${fmtInt(breakdown.totals?.matchedWireLineCount || 0)} 项，未命中 ${fmtInt(breakdown.totals?.unmatchedWireLineCount || 0)} 项，仅用于支撑线束原材料成本拆解。`,
      '导线属于原材料，页面只看导线成本；利润工作台只展示整套线和单根线束利润。',
    ];
    if (Array.isArray(breakdown.meta?.warnings) && breakdown.meta.warnings.length) {
      noteParts.push(breakdown.meta.warnings.join(' '));
    }
    el.harnessProfitNote.textContent = typeof noteParts !== 'undefined'
      ? noteParts.join(' ')
      : (typeof versionLabel !== 'undefined'
        ? `当前按 ${versionLabel} 版 BOM 件数占比对整套收入和成本做结构分摊，用于定位哪一根线束在拉低利润；导线型号、用量和单价请在导线原材料成本计算区查看。`
        : '当前没有可用于展示单根线束利润的线束级数据；导线型号、用量和单价请在导线原材料成本计算区查看。');

    el.harnessProfitTable.innerHTML = harnessRows.map((row) => {
      const tone = row.marginEstimated <= (Number(m.margin) || 0) * 0.65 ? 'low' : row.marginEstimated >= (Number(m.margin) || 0) * 1.15 ? 'high' : 'mid';
      const basis = `${fmtInt(row.counts?.selectedItemCount || 0)} 件 / 导线项 ${fmtInt(row.counts?.wireLineCount || 0)} 个`;
      return `
        <tr data-profit-tone="${tone}">
          <td>${escapeHtml(row.harnessId)}</td>
          <td>${escapeHtml(row.harnessName)}</td>
          <td>${fmtMoney(row.unitRevenueEstimated)}</td>
          <td>${fmtMoney(row.unitCostEstimated)}</td>
          <td class="${row.unitProfitEstimated >= 0 ? 'positive' : 'negative'}">${fmtMoney(row.unitProfitEstimated)}</td>
          <td class="${row.marginEstimated >= 0 ? 'positive' : 'negative'}">${fmtPct(row.marginEstimated)}</td>
          <td>${fmtMoney(row.unitMaterialCost)}</td>
          <td>${fmtMoney((Number(row.unitDirectLaborCost) || 0) + (Number(row.unitManufacturingCost) || 0))}</td>
          <td>${fmtMoney(row.unitPackagingCost)}</td>
          <td>${fmtMoney((Number(row.unitEquipmentCost) || 0) + (Number(row.unitRndCost) || 0))}</td>
          <td>${escapeHtml(basis)}</td>
        </tr>
      `;
    }).join('');
    return;
  }

  const rows = buildHarnessProfitRows(m);
  const avgAsp = Array.isArray(m.annual) && m.annual.length
    ? m.annual.reduce((sum, row) => sum + (Number(row.asp) || 0), 0) / m.annual.length
    : 0;

  if (!rows.length) {
    el.harnessProfitSummary.innerHTML = '<div class="wire-model-stat"><div class="label">线束条目</div><div class="value">0 条</div><div class="meta">当前未加载线束级 BOM 对照数据</div></div>';
    el.harnessProfitNote.textContent = typeof noteParts !== 'undefined'
      ? noteParts.join(' ')
      : (typeof versionLabel !== 'undefined'
        ? `当前按 ${versionLabel} 版 BOM 件数占比对整套收入和成本做结构分摊，用于定位哪一根线束在拉低利润；导线型号、用量和单价请在导线原材料成本计算区查看。`
        : '当前没有可用于展示单根线束利润的线束级数据；导线型号、用量和单价请在导线原材料成本计算区查看。');
    el.harnessProfitTable.innerHTML = '<tr><td colspan="11" class="wire-empty-cell">当前未加载线束级利润拆解数据。</td></tr>';
    return;
  }

  const bestRow = rows.reduce((best, row) => (row.margin > best.margin ? row : best), rows[0]);
  const worstRow = rows.reduce((worst, row) => (row.margin < worst.margin ? row : worst), rows[0]);
  const summaryCards = [
    ['线束条目', `${rows.length} 条`, '按当前 BOM 版本逐条展开'],
    ['整套收入/套', `${fmtMoney(avgAsp)} 元`, '当前场景加权 ASP'],
    ['整套成本/套', `${fmtMoney(m.operating)} 元`, '材料 + 工时 + 包装 + 设备 + 研发'],
    ['整套毛利率', fmtPct(m.margin), `单套毛利 ${fmtMoney(avgAsp - m.operating)} 元`],
    ['最高毛利线束', `${bestRow.harnessId}`, `${bestRow.harnessName} / ${fmtPct(bestRow.margin)}`],
    ['最低毛利线束', `${worstRow.harnessId}`, `${worstRow.harnessName} / ${fmtPct(worstRow.margin)}`],
  ];
  el.harnessProfitSummary.innerHTML = summaryCards.map(([label, value, meta]) => `
    <div class="wire-model-stat">
      <div class="label">${escapeHtml(label)}</div>
      <div class="value">${escapeHtml(value)}</div>
      <div class="meta">${escapeHtml(meta)}</div>
    </div>
  `).join('');

  const workbookVersionKey = resolveWorkbookVersionKeyFromBomState();
  const versionLabel = VIEWER_VERSION_LABELS[workbookVersionKey] || workbookVersionKey || '当前';
  el.harnessProfitNote.textContent = typeof noteParts !== 'undefined'
      ? noteParts.join(' ')
      : (typeof versionLabel !== 'undefined'
        ? `当前按 ${versionLabel} 版 BOM 件数占比对整套收入和成本做结构分摊，用于定位哪一根线束在拉低利润；导线型号、用量和单价请在导线原材料成本计算区查看。`
        : '当前没有可用于展示单根线束利润的线束级数据；导线型号、用量和单价请在导线原材料成本计算区查看。');

  el.harnessProfitTable.innerHTML = rows.map((row) => {
    const tone = row.margin <= m.margin * 0.65 ? 'low' : row.margin >= m.margin * 1.15 ? 'high' : 'mid';
    return `
      <tr data-profit-tone="${tone}">
        <td>${escapeHtml(row.harnessId)}</td>
        <td>${escapeHtml(row.harnessName)}</td>
        <td>${fmtMoney(row.revenue)}</td>
        <td>${fmtMoney(row.cost)}</td>
        <td class="${row.profit >= 0 ? 'positive' : 'negative'}">${fmtMoney(row.profit)}</td>
        <td class="${row.margin >= 0 ? 'positive' : 'negative'}">${fmtPct(row.margin)}</td>
        <td>${fmtMoney(row.material)}</td>
        <td>${fmtMoney(row.labor)}</td>
        <td>${fmtMoney(row.packaging)}</td>
        <td>${fmtMoney(row.capital)}</td>
        <td>${escapeHtml(row.basis)}</td>
      </tr>
    `;
  }).join('');
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

const BOM_ACTIVE_WIRE_CODE_SUFFIX_RE = /\/AL\d+$/i;
const BOM_ACTIVE_EMPTY_ROW_LIMIT = 36;
const BOM_ACTIVE_WIRE_UNITS = new Set(['M', '米']);
const BOM_ACTIVE_WIRE_KEYWORDS = ['导线', 'WIRE', 'CABLE'];
const BOM_ACTIVE_NON_WIRE_KEYWORDS = ['胶带', '套管', '热缩管', '编织套管', '扎带', '支架'];
const BOM_ACTIVE_CONNECTOR_KEYWORDS = ['连接器', '插座', '插头', '护套', '端子', '防水栓', '盲栓', '密封塞', '胶壳', '壳体', 'CONNECTOR', 'TERMINAL', 'SEAL', 'PLUG', 'RECEPTACLE', 'HEADER', 'TPA', 'CPA'];
let activeBomAutoExtractCacheKey = '';
let activeBomAutoExtractCacheValue = null;

function normalizeBomExtractText(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function normalizeBomLookupText(value) {
  return normalizeBomExtractText(value).toUpperCase().replace(/\s+/g, '');
}

function normalizeBomPartCode(value) {
  return normalizeBomLookupText(value).replace(BOM_ACTIVE_WIRE_CODE_SUFFIX_RE, '');
}

function normalizeBomNameKey(value) {
  return normalizeBomExtractText(value).replace(/\s+/g, '').trim().toUpperCase();
}

function bomSectionSizeFromCodeOrName(code, name) {
  const codeMatch = String(code || '').match(/\/(\d+(?:\.\d+)?)(?:\/|$)/);
  if (codeMatch) return Number(codeMatch[1]);
  const nameMatch = String(name || '').match(/(\d+(?:\.\d+)?)\s*(?:MM²|MM2|平方|方)/i);
  if (nameMatch) return Number(nameMatch[1]);
  return null;
}

function bomFamilyKeyFromCode(value) {
  const normalized = normalizeBomPartCode(value);
  const match = normalized.match(/^(.+?)\/(\d+(?:\.\d+)?)(?:\/.*)?$/);
  return match ? match[1] : normalized;
}

function bomContainsKeyword(text, keywords) {
  const upper = normalizeBomLookupText(text);
  return keywords.some((keyword) => upper.includes(String(keyword || '').toUpperCase()));
}

function bomReadUniverCellValue(cell) {
  if (!cell || typeof cell !== 'object') return null;
  if (cell.p?.body?.dataStream) return cell.p.body.dataStream;
  if (Object.prototype.hasOwnProperty.call(cell, 'v')) return cell.v;
  if (Object.prototype.hasOwnProperty.call(cell, 'm')) return cell.m;
  return null;
}

function buildBuiltInWorkbookRowMap(sheet) {
  const rows = new Map();
  (sheet?.cells || []).forEach((cell) => {
    const rowIndex = Number(cell?.row);
    const columnIndex = Number(cell?.column);
    if (!Number.isFinite(rowIndex) || rowIndex < 1 || !Number.isFinite(columnIndex) || columnIndex < 1) return;
    if (!rows.has(rowIndex)) rows.set(rowIndex, {});
    rows.get(rowIndex)[columnIndex] = Object.prototype.hasOwnProperty.call(cell, 'display')
      ? cell.display
      : (Object.prototype.hasOwnProperty.call(cell, 'value') ? cell.value : null);
  });
  return rows;
}

function buildUniverWorkbookRowMap(sheet) {
  const rows = new Map();
  Object.entries(sheet?.cellData || {}).forEach(([rowKey, rowCells]) => {
    const rowIndex = Number(rowKey) + 1;
    if (!Number.isFinite(rowIndex) || rowIndex < 1) return;
    const rowRecord = {};
    Object.entries(rowCells || {}).forEach(([columnKey, cell]) => {
      const columnIndex = Number(columnKey) + 1;
      if (!Number.isFinite(columnIndex) || columnIndex < 1) return;
      rowRecord[columnIndex] = bomReadUniverCellValue(cell);
    });
    if (Object.keys(rowRecord).length) rows.set(rowIndex, rowRecord);
  });
  return rows;
}

function resolveActiveBomWorkbookSheet() {
  const activeBom = BASE.versions?.bom?.[state.bom] || {};
  const customSheets = activeBom?.templateWorkbookSnapshot?.sheets;
  if (customSheets && typeof customSheets === 'object') {
    const sheet = Object.values(customSheets).find((entry) => entry?.name === 'KSK线束BOM明细');
    if (sheet) {
      return {
        kind: 'custom',
        versionKey: state.bom,
        sourceLabel: `${versionOptionLabel('bom', state.bom) || state.bom} · 当前整表快照`,
        sheetName: sheet.name,
        maxRow: Number(sheet?.rowCount) || 0,
        rows: buildUniverWorkbookRowMap(sheet),
      };
    }
  }

  const workbookVersionKey = resolveWorkbookVersionKeyFromBomState();
  const workbookVersion = RUNTIME?.bomWorkbookCopies?.versions?.[workbookVersionKey];
  const workbookSheet = Array.isArray(workbookVersion?.sheets)
    ? workbookVersion.sheets.find((entry) => entry?.sheetName === 'KSK线束BOM明细')
    : null;
  if (workbookSheet) {
    return {
      kind: 'runtime',
      versionKey: workbookVersionKey,
      sourceLabel: `${VIEWER_VERSION_LABELS[workbookVersionKey] || workbookVersionKey || '当前'} · KSK线束BOM明细`,
      sheetName: workbookSheet.sheetName,
      maxRow: Number(workbookSheet?.maxRow) || 0,
      rows: buildBuiltInWorkbookRowMap(workbookSheet),
    };
  }

  return null;
}

function parseBomNumericValue(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const text = normalizeBomExtractText(value).replace(/,/g, '');
  if (!text) return 0;
  const numeric = Number(text);
  return Number.isFinite(numeric) ? numeric : 0;
}

function extractActiveBomLineItems() {
  const workbookSheet = resolveActiveBomWorkbookSheet();
  if (!workbookSheet) {
    return {
      hasSource: false,
      sourceLabel: '',
      sourceSheetName: '',
      items: [],
    };
  }

  const items = [];
  let emptyRun = 0;
  const maxRow = Math.max(Number(workbookSheet.maxRow) || 0, 120);
  for (let rowIndex = 2; rowIndex <= maxRow; rowIndex += 1) {
    const row = workbookSheet.rows.get(rowIndex);
    if (!row || !Object.keys(row).length) {
      emptyRun += 1;
      if (rowIndex > 40 && emptyRun >= BOM_ACTIVE_EMPTY_ROW_LIMIT) break;
      continue;
    }
    emptyRun = 0;

    const harnessId = normalizeBomExtractText(row[1]);
    const harnessName = normalizeBomExtractText(row[2]);
    const assemblyNo = normalizeBomExtractText(row[3] || row[4]);
    const partNumber = normalizeBomExtractText(row[4] || row[3]);
    const partName = normalizeBomExtractText(row[5]);
    const unit = normalizeBomExtractText(row[12]);
    const supplier = normalizeBomExtractText(row[13]);
    const sap = normalizeBomExtractText(row[7]);
    const remark = normalizeBomExtractText(row[14]);
    const quantity = parseBomNumericValue(row[11]);

    if (![harnessId, harnessName, assemblyNo, partNumber, partName, quantity].some(Boolean)) {
      continue;
    }

    items.push({
      rowIndex,
      harnessId,
      harnessName,
      assemblyNo,
      partNumber,
      partName,
      unit,
      quantity,
      supplier,
      sap,
      remark,
      sourceLabel: workbookSheet.sourceLabel,
      sourceSheetName: workbookSheet.sheetName,
    });
  }

  return {
    hasSource: items.length > 0,
    sourceLabel: workbookSheet.sourceLabel,
    sourceSheetName: workbookSheet.sheetName,
    items,
  };
}

function isActiveBomWireItem(item) {
  const nameText = `${item?.partName || ''} ${item?.partNumber || ''}`;
  const unit = normalizeBomLookupText(item?.unit);
  if (!BOM_ACTIVE_WIRE_UNITS.has(unit)) return false;
  if (!bomContainsKeyword(nameText, BOM_ACTIVE_WIRE_KEYWORDS)) return false;
  return !bomContainsKeyword(nameText, BOM_ACTIVE_NON_WIRE_KEYWORDS);
}

function isActiveBomConnectorItem(item) {
  if (isActiveBomWireItem(item)) return false;
  const text = `${item?.partNumber || ''} ${item?.partName || ''} ${item?.remark || ''}`;
  return bomContainsKeyword(text, BOM_ACTIVE_CONNECTOR_KEYWORDS);
}

function addBomUsageValue(map, key, amount) {
  if (!key) return;
  map.set(key, (map.get(key) || 0) + amount);
}

function buildActiveBomWireExtract(lineItemsResult) {
  const exact = new Map();
  const normalized = new Map();
  const nameSize = new Map();
  const familySize = new Map();
  const items = lineItemsResult.items.filter(isActiveBomWireItem);

  items.forEach((item) => {
    const amount = Math.max(parseBomNumericValue(item.quantity), 0);
    const exactKey = normalizeBomLookupText(item.partNumber);
    const normalizedKey = normalizeBomPartCode(item.partNumber);
    const size = bomSectionSizeFromCodeOrName(item.partNumber, item.partName);
    const nameKey = normalizeBomNameKey(item.partName);
    const familyKey = bomFamilyKeyFromCode(item.partNumber);
    addBomUsageValue(exact, exactKey, amount);
    addBomUsageValue(normalized, normalizedKey, amount);
    if (nameKey && size !== null) addBomUsageValue(nameSize, `${nameKey}__${size}`, amount);
    if (familyKey && size !== null) addBomUsageValue(familySize, `${familyKey}__${size}`, amount);
  });

  return {
    hasSource: lineItemsResult.hasSource && items.length > 0,
    sourceLabel: lineItemsResult.sourceLabel,
    sourceSheetName: lineItemsResult.sourceSheetName,
    items,
    exact,
    normalized,
    nameSize,
    familySize,
  };
}

function resolveActiveBomWireUsage(row, wireExtract) {
  if (!wireExtract?.hasSource) return null;
  const exactCode = normalizeBomLookupText(row?.code);
  const normalizedCode = normalizeBomPartCode(row?.code);
  const size = bomSectionSizeFromCodeOrName(row?.code, row?.name);
  const nameKey = normalizeBomNameKey(row?.name);
  const familyKey = bomFamilyKeyFromCode(row?.code);
  if (exactCode && wireExtract.exact.has(exactCode)) {
    return { key: 'bom_auto', value: wireExtract.exact.get(exactCode), hasValue: true, missing: false, sourceLabel: wireExtract.sourceLabel, matchMethod: 'exact_code' };
  }
  if (normalizedCode && wireExtract.normalized.has(normalizedCode)) {
    return { key: 'bom_auto', value: wireExtract.normalized.get(normalizedCode), hasValue: true, missing: false, sourceLabel: wireExtract.sourceLabel, matchMethod: 'normalized_code' };
  }
  if (nameKey && size !== null) {
    const composite = `${nameKey}__${size}`;
    if (wireExtract.nameSize.has(composite)) {
      return { key: 'bom_auto', value: wireExtract.nameSize.get(composite), hasValue: true, missing: false, sourceLabel: wireExtract.sourceLabel, matchMethod: 'name_and_size' };
    }
  }
  if (familyKey && size !== null) {
    const composite = `${familyKey}__${size}`;
    if (wireExtract.familySize.has(composite)) {
      return { key: 'bom_auto', value: wireExtract.familySize.get(composite), hasValue: true, missing: false, sourceLabel: wireExtract.sourceLabel, matchMethod: 'family_and_size' };
    }
  }
  return { key: 'bom_auto', value: 0, hasValue: false, missing: true, sourceLabel: wireExtract.sourceLabel, matchMethod: 'unmatched' };
}

function mergeActiveBomConnectorItem(acc, item) {
  const quantity = Math.max(parseBomNumericValue(item.quantity), 0);
  acc.quantity += quantity;
  acc.rowCount += 1;
  if (item.harnessId) acc.harnessIds.add(item.harnessId);
  if (item.assemblyNo) acc.assemblyNos.add(item.assemblyNo);
  if (item.sap) acc.sapNos.add(item.sap);
  if (item.remark) acc.remarks.add(item.remark);
  return acc;
}

function normalizeConnectorMatchCode(value) {
  return normalizeBomLookupText(value).replace(/[（）()]/g, '');
}

function normalizeConnectorMatchName(value) {
  return normalizeBomLookupText(String(value || '').replace(/[（(].*?[)）]/g, ''));
}

function matchProtocolRowToConnectorItem(item) {
  const itemPartCode = normalizeConnectorMatchCode(item?.partNumber);
  const itemAssemblyCodes = Array.from(item?.assemblyNos || []).map((value) => normalizeConnectorMatchCode(value)).filter(Boolean);
  const itemSupplier = normalizeBomLookupText(item?.supplier);
  const itemName = normalizeConnectorMatchName(item?.partName);
  let bestRow = null;
  let bestScore = 0;

  protocolRows.forEach((row) => {
    let score = 0;
    const rowPartCode = normalizeConnectorMatchCode(row?.partNumber);
    const rowAssemblyCode = normalizeConnectorMatchCode(protocolAssemblyNo(row));
    const rowSupplier = normalizeBomLookupText(row?.supplierRaw || row?.supplier);
    const rowName = normalizeConnectorMatchName(row?.partNameRaw || row?.partName);
    const rowFunction = normalizeConnectorMatchCode(row?.functionRaw || row?.functionBrief);

    if (itemPartCode && rowPartCode && itemPartCode === rowPartCode) score += 100;
    if (itemPartCode && rowAssemblyCode && itemPartCode === rowAssemblyCode) score += 80;
    if (itemAssemblyCodes.length && rowAssemblyCode && itemAssemblyCodes.includes(rowAssemblyCode)) score += 60;
    if (itemAssemblyCodes.length && rowFunction && itemAssemblyCodes.some((code) => rowFunction.includes(code))) score += 40;
    if (itemSupplier && rowSupplier && itemSupplier === rowSupplier) score += 12;
    if (itemName && rowName && itemName === rowName) score += 18;

    if (score > bestScore) {
      bestScore = score;
      bestRow = row;
    }
  });

  return {
    row: bestScore >= 40 ? bestRow : null,
    score: bestScore,
  };
}

function buildActiveBomConnectorExtract(lineItemsResult) {
  const grouped = new Map();
  lineItemsResult.items
    .filter(isActiveBomConnectorItem)
    .forEach((item) => {
      const key = normalizeConnectorMatchCode(item.partNumber) || `${normalizeConnectorMatchName(item.partName)}__${normalizeBomLookupText(item.supplier)}`;
      if (!key) return;
      if (!grouped.has(key)) {
        grouped.set(key, {
          key,
          partNumber: item.partNumber,
          partName: item.partName,
          supplier: item.supplier,
          unit: item.unit,
          quantity: 0,
          rowCount: 0,
          harnessIds: new Set(),
          assemblyNos: new Set(),
          sapNos: new Set(),
          remarks: new Set(),
          sourceLabel: lineItemsResult.sourceLabel,
          sourceSheetName: lineItemsResult.sourceSheetName,
        });
      }
      mergeActiveBomConnectorItem(grouped.get(key), item);
    });

  const items = Array.from(grouped.values())
    .map((item) => {
      const protocolMatch = matchProtocolRowToConnectorItem(item);
      return {
        ...item,
        harnessIds: Array.from(item.harnessIds),
        assemblyNos: Array.from(item.assemblyNos),
        sapNos: Array.from(item.sapNos),
        remarks: Array.from(item.remarks),
        protocolRow: protocolMatch.row,
        protocolScore: protocolMatch.score,
      };
    })
    .sort((left, right) => {
      if (Math.abs((right.quantity || 0) - (left.quantity || 0)) > 0.0001) return (right.quantity || 0) - (left.quantity || 0);
      return String(left.partNumber || '').localeCompare(String(right.partNumber || ''), 'zh-CN');
    });

  return {
    hasSource: lineItemsResult.hasSource && items.length > 0,
    sourceLabel: lineItemsResult.sourceLabel,
    sourceSheetName: lineItemsResult.sourceSheetName,
    items,
    matchedCount: items.filter((item) => item.protocolRow).length,
    unmatchedCount: items.filter((item) => !item.protocolRow).length,
  };
}

function buildActiveBomAutoExtract() {
  const lineItemsResult = extractActiveBomLineItems();
  return {
    hasSource: lineItemsResult.hasSource,
    sourceLabel: lineItemsResult.sourceLabel,
    sourceSheetName: lineItemsResult.sourceSheetName,
    lineItems: lineItemsResult.items,
    wire: buildActiveBomWireExtract(lineItemsResult),
    connector: buildActiveBomConnectorExtract(lineItemsResult),
  };
}

function activeBomAutoExtractCacheToken() {
  const activeBom = BASE.versions?.bom?.[state.bom] || {};
  const workbookSnapshot = activeBom?.templateWorkbookSnapshot;
  return [
    state.bom,
    resolveWorkbookVersionKeyFromBomState(),
    activeBom.updatedAt || activeBom.createdAt || '',
    workbookSnapshot?.id || '',
    Array.isArray(workbookSnapshot?.sheetOrder) ? workbookSnapshot.sheetOrder.join('|') : '',
  ].join('::');
}

function getActiveBomAutoExtract() {
  const token = activeBomAutoExtractCacheToken();
  if (token === activeBomAutoExtractCacheKey && activeBomAutoExtractCacheValue) {
    return activeBomAutoExtractCacheValue;
  }
  activeBomAutoExtractCacheKey = token;
  activeBomAutoExtractCacheValue = buildActiveBomAutoExtract();
  return activeBomAutoExtractCacheValue;
}

function activeBomWireMatchLabel(method) {
  return ({
    exact_code: 'BOM零件号直取',
    normalized_code: 'BOM规格归一',
    name_and_size: '名称+截面匹配',
    family_and_size: '系列+截面匹配',
    unmatched: '当前BOM未命中',
  })[method] || '当前BOM自动抓取';
}

function renderActiveBomConnectorPartDetail(item) {
  const notes = [];
  if (item?.sapNos?.length) notes.push(`SAP ${item.sapNos[0]}`);
  if (item?.remarks?.length) notes.push(item.remarks[0]);
  notes.push(`BOM数量 ${fmtNumber(item?.quantity || 0, 2)} ${item?.unit || ''}`.trim());
  const partLine = [item?.partNumber, item?.partName].filter(Boolean)
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

function wireUsageLabel(key) {
  return ({
    quote: '报价版',
    fixed: '定点版',
    tt: 'TT版',
    bom_auto: '当前 BOM 自动抓取',
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

function resolveWireUsage(row, requestedKey, autoExtract = null) {
  const activeWireExtract = autoExtract?.wire || null;
  if (activeWireExtract?.hasSource) {
    return resolveActiveBomWireUsage(row, activeWireExtract);
  }
  const usage = row?.usage || {};
  const candidates = wireUsageCandidates(requestedKey);
  for (const key of candidates) {
    const value = usage[key];
    if (value !== null && value !== undefined && value !== '') {
      return { key, value: Number(value) || 0, hasValue: true, missing: false };
    }
  }
  return { key: requestedKey, value: 0, hasValue: false, missing: true };
}

function renderWireCatalog(m) {
  if (!el.wireModelSummary || !el.wireCalcNote || !el.wireModelTable) return;
  if (!WIRE_MODELS.length) {
    el.wireModelSummary.innerHTML = '<div class="wire-model-stat"><div class="label">导线型号</div><div class="value">0 个</div><div class="meta">当前未导入导线目录</div></div>';
    el.wireCalcNote.textContent = '当前未加载导线型号联动数据。';
    if (el.wireTableStatus) {
      el.wireTableStatus.textContent = '当前未加载导线型号数据。';
    }
    el.wireModelTable.innerHTML = '<tr><td colspan="10" class="wire-empty-cell">当前未加载导线型号数据。</td></tr>';
    return;
  }

  const requestedUsage = requestedWireUsageKey();
  const bomLabel = versionOptionLabel('bom', state.bom) || wireUsageLabel(requestedUsage);
  const activeBomExtract = getActiveBomAutoExtract();
  const copperPrice = Number(m.d.copperPrice) || 0;
  const aluminumPrice = Number(m.d.aluminumPrice) || 0;
  const rows = WIRE_MODELS.map((row) => {
    const weights = row.weights || {};
    const usage = resolveWireUsage(row, requestedUsage, activeBomExtract);
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
      hasUsageValue: usage.hasValue,
      usageMissing: usage.missing,
      usageSourceLabel: usage.sourceLabel || '',
      usageMatchMethod: usage.matchMethod || '',
      aluminumWeight,
      copperWeight,
      nonCopper,
      aluminumCost,
      copperCost,
      currentUnitPrice,
      currentAmount,
    };
  }).sort((left, right) => {
    const leftRank = left.usageValue > 0 ? 2 : left.hasUsageValue ? 1 : 0;
    const rightRank = right.usageValue > 0 ? 2 : right.hasUsageValue ? 1 : 0;
    if (leftRank !== rightRank) return rightRank - leftRank;
    if (Math.abs(right.currentAmount - left.currentAmount) > 0.0001) return right.currentAmount - left.currentAmount;
    return String(left.code || '').localeCompare(String(right.code || ''), 'zh-CN');
  });

  const totalModels = rows.length;
  const activeRows = rows.filter((row) => row.usageValue > 0);
  const activeCount = activeRows.length;
  const zeroUsageRows = rows.filter((row) => row.hasUsageValue && row.usageValue <= 0);
  const missingUsageRows = rows.filter((row) => !row.hasUsageValue);
  const inactiveCount = totalModels - activeCount;
  const usageRows = activeCount ? activeRows : rows.filter((row) => row.hasUsageValue);
  const fallbackRows = activeCount ? activeRows : rows.filter((row) => row.hasUsageValue);
  const rowsForView = showInactiveWireModels ? rows : fallbackRows;
  const hiddenCount = Math.max(0, totalModels - rowsForView.length);
  const totalUsage = activeRows.reduce((sum, row) => sum + row.usageValue, 0);
  const totalAmount = activeRows.reduce((sum, row) => sum + row.currentAmount, 0);
  const inferredRows = rows.filter((row) => row.weightSource?.inferred);
  const sourceCounts = usageRows.reduce((acc, row) => {
    acc[row.usageKey] = (acc[row.usageKey] || 0) + 1;
    return acc;
  }, {});
  const sourceSummary = Object.entries(sourceCounts)
    .map(([key, count]) => `${wireUsageLabel(key)} ${count} 项`)
    .join(' / ');
  const sourceBooks = activeBomExtract?.wire?.hasSource
    ? `${activeBomExtract.wire.sourceLabel} / ${activeBomExtract.wire.sourceSheetName}`
    : [WIRE_CATALOG.meta?.ttSourceWorkbook, WIRE_CATALOG.meta?.fixedSourceWorkbook, WIRE_CATALOG.meta?.quoteSourceWorkbook]
      .filter(Boolean)
      .join(' / ');
  const summaryCards = [
    ['导线目录', `${totalModels} 个`, '所有版本导线型号'],
    ['当前 BOM', `${bomLabel} / ${totalModels} 个`, activeCount ? `实取 ${sourceSummary || wireUsageLabel(requestedUsage)}` : '当前版本未启用'],
    ['版本覆盖', `${activeCount}/${totalModels} 型号启用`, inactiveCount ? `${inactiveCount} 型号还未启用` : '全部启用'],
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

  if (el.wireTableStatus) {
    el.wireTableStatus.innerHTML = `
      <span class="wire-table-status-count">${totalModels} 型号 · ${activeCount} 已用 · ${zeroUsageRows.length} 零用量 · ${missingUsageRows.length} 缺失</span>
      <span class="wire-table-status-note">全部 26 个型号保留展示；零用量和缺失项不再隐藏。</span>
    `;
  }

  if (el.wireTableStatus) {
    const statusNote = showInactiveWireModels
      ? `已展开全部导线，其中 ${zeroUsageRows.length} 条零用量，${missingUsageRows.length} 条缺失口径。`
      : hiddenCount > 0
        ? `默认仅显示当前版本已用导线，已隐藏 ${hiddenCount} 条非当前版本导线。`
        : '当前版本导线已全部显示。';
    el.wireTableStatus.innerHTML = `
      <span class="wire-table-status-count">${totalModels} 型号 · ${activeCount} 已用 · 当前显示 ${rowsForView.length} 条</span>
      <span class="wire-table-status-note">${statusNote}</span>
    `;
  }
  updateWireCatalogToggleButton(hiddenCount);

  if (!rowsForView.length) {
    el.wireModelTable.innerHTML = '<tr><td colspan="10" class="wire-empty-cell">当前版本暂无已用导线，点击“显示非版本导线”可查看全部目录。</td></tr>';
    return;
  }

  el.wireModelTable.innerHTML = rowsForView.map((row) => {
    const metaBits = [row.supplier, row.sap ? `SAP ${row.sap}` : '', row.priceType].filter(Boolean);
    const weightLabel = row.weightSource?.label || '';
    const weightNote = row.weightSource?.note || '';
    const templateCode = row.weightSource?.templateCode || '';
    const isActive = row.usageValue > 0;
    const isMissing = !row.hasUsageValue;
    const statusKey = isActive ? 'active' : isMissing ? 'missing' : 'zero';
    const usageLabelText = wireUsageLabel(row.usageKey);
    const usageNote = isActive
      ? `<div class="wire-cell-note">${escapeHtml(usageLabelText)}</div>`
      : `<div class="wire-cell-note wire-cell-note--inactive">${isMissing ? '当前版本缺失用量' : '当前版本零用量'} · ${escapeHtml(usageLabelText)}</div>`;
    const usageFlag = `<div class="wire-usage-flag is-${statusKey}">${isActive ? '已启用' : isMissing ? '缺失' : '零用量'}</div>`;
    return `
      <tr class="wire-row${isActive ? '' : ' wire-row-inactive'}${isMissing ? ' wire-row-missing' : ''}" data-wire-status="${statusKey}">
        <td class="wire-model-cell">
          <div class="wire-model-main">
            <strong>${escapeHtml(row.code || '-')}</strong>
            <span>${escapeHtml(row.name || '-')}</span>
          </div>
          <div class="wire-inline-meta">${metaBits.map((text) => `<span>${escapeHtml(text)}</span>`).join('')}</div>
          ${weightLabel ? `<div class="wire-cell-note" title="${escapeHtml(weightNote)}">${escapeHtml(weightLabel)}${templateCode ? ` 路 ${escapeHtml(templateCode)}` : ''}</div>` : ''}
        </td>
        <td>
          <div class="wire-family-stack">
            <span class="wire-family-chip">${escapeHtml(row.relationLabel || row.materialFamily || '-')}</span>
            <span class="wire-cell-note">${escapeHtml(row.materialFamily || '-')}</span>
          </div>
        </td>
        <td class="wire-number-cell">
          <div class="wire-number-main${isActive ? '' : ' wire-number-muted'}">${fmtNumber(row.usageValue, 2)}</div>
          ${usageNote}
          ${usageFlag}
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

/* Legacy duplicate kept only for reference during recovery; disabled so the
   full-catalog implementation above remains the single active renderer.
renderWireCatalog legacy backup:
  if (!el.wireModelSummary || !el.wireCalcNote || !el.wireModelTable) return;
  if (!WIRE_MODELS.length) {
    el.wireModelSummary.innerHTML = '<div class="wire-model-stat"><div class="label">导线型号</div><div class="value">0 个</div><div class="meta">当前未导入导线目录</div></div>';
    el.wireCalcNote.textContent = '当前未加载导线型号联动数据。';
    if (el.wireTableStatus) el.wireTableStatus.textContent = '暂无导线型号数据。';
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

  const totalModels = rows.length;
  const activeRows = rows.filter((row) => row.usageValue > 0);
  const activeCount = activeRows.length;
  const inactiveCount = totalModels - activeCount;
  const sourceRows = activeRows.length ? activeRows : rows;
  const totalUsage = activeRows.reduce((sum, row) => sum + row.usageValue, 0);
  const totalAmount = activeRows.reduce((sum, row) => sum + row.currentAmount, 0);
  const inferredRows = rows.filter((row) => row.weightSource?.inferred);
  const sourceCounts = sourceRows.reduce((acc, row) => {
    acc[row.usageKey] = (acc[row.usageKey] || 0) + 1;
    return acc;
  }, {});
  const sourceSummary = Object.entries(sourceCounts)
    .map(([key, count]) => `${wireUsageLabel(key)} ${count}项`)
    .join(' / ');
  const sourceBooks = [WIRE_CATALOG.meta?.ttSourceWorkbook, WIRE_CATALOG.meta?.fixedSourceWorkbook, WIRE_CATALOG.meta?.quoteSourceWorkbook]
    .filter(Boolean)
    .join(' / ');
  const summaryCards = [
    ['导线目录', `${totalModels} 个`, '按当前项目已导入的全部导线型号展示'],
    ['当前 BOM', `${bomLabel} / 启用 ${activeCount} 个`, activeCount ? `实际取数 ${sourceSummary || wireUsageLabel(requestedUsage)}` : '当前版本未启用导线用量'],
    ['版本覆盖', `${activeCount}/${totalModels} 型号启用`, inactiveCount ? `${inactiveCount} 个型号当前为零用量` : '全部型号已启用'],
    ['铜基价', `${fmtMoney(copperPrice, 0)} 元/吨`, m.metal.label],
    ['铝基价', `${fmtMoney(aluminumPrice, 0)} 元/吨`, m.metal.label],
    ['材料重量', `铝 ${fmtNumber(WIRE_CATALOG.summary?.totalAluminumWeight || 0, 2)} / 铜 ${fmtNumber(WIRE_CATALOG.summary?.totalCopperWeight || 0, 2)}`, `非铜 ${fmtNumber(WIRE_CATALOG.summary?.totalNonCopper || 0, 2)}`],
    ['当前导线金额', `${fmtMoney(totalAmount)} 元/套`, inferredRows.length ? `当前用量 ${fmtNumber(totalUsage, 2)} / 推算 ${inferredRows.length} 项` : `当前用量 ${fmtNumber(totalUsage, 2)}`],
  ];
  el.wireModelSummary.innerHTML = summaryCards.map(([label, value, meta]) => `
    <div class="wire-model-stat">
      <div class="label">${escapeHtml(label)}</div>
      <div class="value">${escapeHtml(value)}</div>
      <div class="meta">${escapeHtml(meta)}</div>
    </div>
  `).join('');

  const inferredNote = inferredRows.length ? `当前有 ${inferredRows.length} 项按模板规则推算，表内已标注。` : '';
  el.wireCalcNote.innerHTML = `单价规则：铝重 × 当前铝价 / 1,000,000 + 铜重 × 当前铜价 / 1,000,000 + 非铜 / 1000。数据来源：${escapeHtml(sourceBooks || '导线联动核算表')}。当前 BOM 口径：${escapeHtml(bomLabel)}；实际启用来源：${escapeHtml(sourceSummary || wireUsageLabel(requestedUsage))}。${escapeHtml(inferredNote)}`;

  if (el.wireTableStatus) {
    el.wireTableStatus.innerHTML = `
      <span class="wire-table-status-count">${totalModels} 型号 · ${activeCount} 已启用 · ${inactiveCount} 零用量保留展示</span>
      <span class="wire-table-status-note">当前版本未用到的型号不再隐藏，方便核对 26 个型号的完整性</span>
    `;
  }

  el.wireModelTable.innerHTML = rows.map((row) => {
    const metaBits = [row.supplier, row.sap ? `SAP ${row.sap}` : '', row.priceType].filter(Boolean);
    const weightLabel = row.weightSource?.label || '';
    const weightNote = row.weightSource?.note || '';
    const templateCode = row.weightSource?.templateCode || '';
    const isActive = row.usageValue > 0;
    const usageLabelText = wireUsageLabel(row.usageKey);
    const usageNote = isActive
      ? `<div class="wire-cell-note">${escapeHtml(usageLabelText)}</div>`
      : `<div class="wire-cell-note wire-cell-note--inactive">当前版本未启用 · ${escapeHtml(usageLabelText)}</div>`;
    return `
      <tr class="wire-row${isActive ? '' : ' wire-row-inactive'}" data-wire-status="${isActive ? 'active' : 'inactive'}">
        <td class="wire-model-cell">
          <div class="wire-model-main">
            <strong>${escapeHtml(row.code || '-')}</strong>
            <span>${escapeHtml(row.name || '-')}</span>
          </div>
          <div class="wire-inline-meta">${metaBits.map((text) => `<span>${escapeHtml(text)}</span>`).join('')}</div>
          ${weightLabel ? `<div class="wire-cell-note" title="${escapeHtml(weightNote)}">${escapeHtml(weightLabel)}${templateCode ? ` 路 ${escapeHtml(templateCode)}` : ''}</div>` : ''}
        </td>
        <td>
          <div class="wire-family-stack">
            <span class="wire-family-chip">${escapeHtml(row.relationLabel || row.materialFamily || '-')}</span>
            <span class="wire-cell-note">${escapeHtml(row.materialFamily || '-')}</span>
          </div>
        </td>
        <td class="wire-number-cell">
          <div class="wire-number-main${isActive ? '' : ' wire-number-muted'}">${fmtNumber(row.usageValue, 2)}</div>
          ${usageNote}
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
*/

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
  const stageCounts = summary.stageCounts || { quote: 0, fixed: 0, progress: 0 };
  const deltaClass = summary.deltaCost > 0 ? 'delta-up' : summary.deltaCost < 0 ? 'delta-down' : 'delta-flat';
  const stats = [
    `默认执行 <strong>${summary.defaultLabel || BASE.versions.connector[state.connector].label}</strong>`,
    `跟随默认 <strong>${summary.followCount || 0}</strong>`,
    `逐项覆盖 <strong>${summary.overrideCount || 0}</strong>`,
    `报价版 <strong>${stageCounts.quote || 0}</strong>`,
    `定点版 <strong>${stageCounts.fixed || 0}</strong>`,
    `进度价 <strong>${stageCounts.progress || 0}</strong>`,
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
  const quoteMaterialBase = Number(FINANCIAL_VERSIONS?.versions?.quote?.perSet?.material) || Number(BASE.baseMaterial) || 0;
  const connectorImpact = `${((m.conn.effectiveFactor - 1) * 100).toFixed(1)}% / 默认 ${m.conn.label} / 覆盖 ${m.connectorSummary?.overrideCount || 0} 项`;
  const rows=[
    ['BOM',m.bom.label,`${((m.material/quoteMaterialBase-1)*100).toFixed(1)}% 材料变动`],
    ['铜铝基价',m.metal.label,`铜 ${fmtMoney(m.d.copperPrice,0)} 元/吨 / 铝 ${fmtMoney(m.d.aluminumPrice,0)} 元/吨`],
    ['连接器',m.conn.label,connectorImpact],
    ['工时',m.labor.label,`${((m.labor.factor-1)*100).toFixed(1)}% 费率/工时`],
    ['设备',m.equip.label,`${((m.equip.factor-1)*100).toFixed(1)}% 设备分摊`],
    ['包装物流',m.pack.label,`${((m.pack.factor-1)*100).toFixed(1)}% 包装费率`],
    ['年降',m.annualDrop?.label || '-',annualDropSnapshotSummary(m.annualDrop)],
    ['一次性费用',m.oneTimeCustomer?.label || '-',oneTimeCustomerSnapshotSummary(m.oneTimeCustomer)],
    ['返点',m.rebate?.label || '-',rebateSnapshotSummary(m.rebate)],
    ['VAVE',m.vave.label,`${fmtMoney(m.vave.savings)} 元/套`]
  ];
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

function ensureProfitInsights() {
  if (profitInsightsView || !el.profitInsightsMount || !window.g281ProfitInsights?.init) return;
  profitInsightsView = window.g281ProfitInsights.init('g281-profit-insights', el.profitInsightsMount, {
    onTargetMarginChange: setCustomTargetMarginPercent,
    onTargetMarginReset: () => resetCustomTargetMarginPercent(),
  });
}

function describeTargetPriceConvergence(targetPrice, requestedMarginPercent) {
  const convergence = targetPrice?.convergence || {};
  const marginText = `${fmtNumber(requestedMarginPercent, 2)}%`;
  if (convergence.reason === 'already_at_target') {
    return {
      statusLabel: '已满足',
      note: `当前场景毛利率已满足目标毛利率 ${marginText}，无需调整售价。`,
    };
  }
  if (convergence.reason === 'converged') {
    return {
      statusLabel: '已收敛',
      note: `已按目标毛利率 ${marginText} 完成反推。`,
    };
  }
  if (convergence.reason === 'tolerance_on_factor') {
    return {
      statusLabel: '近似收敛',
      note: `已在精度阈值内停止，结果接近目标毛利率 ${marginText}。`,
    };
  }
  if (convergence.reason === 'target_not_bracketed') {
    return {
      statusLabel: '待复核',
      note: `未找到完整求解区间，已返回最接近目标毛利率 ${marginText} 的售价，请人工复核。`,
    };
  }
  return {
    statusLabel: convergence.success ? '已收敛' : '待计算',
    note: convergence.reason || '',
  };
}

function computeProfitInsightsPayload(model) {
  if (!window.G281TargetPriceSolver?.solveTargetPrice || !window.G281ProfitShapley?.compute) {
    return null;
  }
  const scenarioState = { ...(model?.stateSnapshot || currentScenarioStateSnapshot()) };
  const draft = model?.d ? JSON.parse(JSON.stringify(model.d)) : readDraft();
  const cacheKey = insightPayloadKey(draft, scenarioState);
  if (profitInsightsCacheKey === cacheKey && profitInsightsCacheValue) {
    return profitInsightsCacheValue;
  }

  const hasCustomTargetMargin = Number.isFinite(customTargetMarginPercent);
  const targetPrice = window.G281TargetPriceSolver.solveTargetPrice(RUNTIME, draft, scenarioState, {
    metric: 'margin',
    ...(hasCustomTargetMargin ? { targetValue: customTargetMarginPercent / 100 } : {}),
  });
  const shapley = window.G281ProfitShapley.compute({
    engine: window.G281Engine,
    runtime: RUNTIME,
    draft,
    scenarioState,
  });

  const baselineASP = averageAsp(targetPrice.baselineModel);
  const currentASP = averageAsp(targetPrice.currentModel);
  const requiredASP = averageAsp(targetPrice.solvedModel);
  const annualAspSeries = Array.isArray(targetPrice.effectiveAnnualAspSeries) ? targetPrice.effectiveAnnualAspSeries : [];
  const requestedMarginPercent = (Number(targetPrice.targetValue) || 0) * 100;
  const convergenceMeta = describeTargetPriceConvergence(targetPrice, requestedMarginPercent);
  const sparkline = (RUNTIME.master?.years || []).map((year, index) => {
    const asp = Number(annualAspSeries[index]) || 0;
    return `${year}:${fmtMoney(asp)}`;
  }).join(' / ');

  const payload = {
    targetPrice: {
      scenarioName: draft.scenarioName || BASE.name,
      varianceLabel: targetPrice.metric === 'margin' ? '目标毛利率反推售价' : '保持报价总利润',
      targetMode: hasCustomTargetMargin ? 'custom' : 'baseline',
      targetModeLabel: hasCustomTargetMargin ? '自定义目标毛利率' : '保持报价毛利率',
      currentASP,
      requiredASP,
      baseASP: baselineASP,
      deltaASP: requiredASP - currentASP,
      currentMargin: (Number(targetPrice.currentModel?.margin) || 0) * 100,
      baseMargin: (Number(targetPrice.baselineModel?.margin) || 0) * 100,
      requestedMargin: requestedMarginPercent,
      requiredMargin: (Number(targetPrice.solvedModel?.margin) || 0) * 100,
      currentMetric: Number(targetPrice.currentMetric) || 0,
      baselineMetric: Number(targetPrice.baselineMetric) || 0,
      achievedMetric: Number(targetPrice.achievedMetric) || 0,
      statusLabel: convergenceMeta.statusLabel,
      note: convergenceMeta.note,
      convergence: targetPrice.convergence || null,
      sparkline,
    },
    shapley: {
      title: 'Shapley 利润归因',
      subtitle: '相对全报价版本的利润率变化占比',
      baselineMargin: (Number(shapley.baseline?.margin) || 0) * 100,
      scenarioMargin: (Number(shapley.scenario?.margin) || 0) * 100,
      totalDelta: (Number(shapley.delta) || 0) * 100,
      items: (shapley.contributions || []).map((item) => ({
        key: item.key,
        label: item.label,
        value: (Number(item.marginContribution) || 0) * 100,
        share: Number(item.share) || 0,
        from: item.baseState,
        to: item.scenarioState,
      })),
    },
  };

  profitInsightsCacheKey = cacheKey;
  profitInsightsCacheValue = payload;
  return payload;
}

function renderProfitInsights(model) {
  ensureProfitInsights();
  if (!profitInsightsView) return;
  const payload = computeProfitInsightsPayload(model);
  if (!payload) return;
  profitInsightsView.renderTargetPrice(payload.targetPrice);
  profitInsightsView.renderShapleyWaterfall(payload.shapley);
}

function compareRowSnapshot(model, index) {
  const rows = Array.isArray(model?.compare) ? model.compare : [];
  const row = Array.isArray(rows[index]) ? rows[index] : [];
  return {
    label: row[0] || '',
    base: coerceNumber(row[1], 0),
    current: coerceNumber(row[2], 0),
  };
}

function formatSignedPoints(value, digits = 2) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return '-';
  return `${numeric >= 0 ? '+' : ''}${numeric.toFixed(digits)} pt`;
}

function formatSignedCurrency(value, digits = 2) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return '-';
  return `${numeric >= 0 ? '+' : '-'}${fmtMoney(Math.abs(numeric), digits)}`;
}

function changeTone(value, epsilon = 0.005) {
  const numeric = Number(value) || 0;
  if (Math.abs(numeric) < epsilon) return 'neutral';
  return numeric > 0 ? 'positive' : 'negative';
}

function changeFactorMode(item) {
  const from = toText(item?.from);
  const to = toText(item?.to);
  if (from && to && from !== to) return 'version';
  if (Math.abs(Number(item?.value) || 0) >= 0.005) return 'input';
  return 'steady';
}

function changeFactorMeta(key, model, item) {
  if (key === 'bom') {
    const summary = model?.bomSummary || {};
    return `替换 ${fmtInt(summary.replaceCount || 0)} / 新增 ${fmtInt(summary.addCount || 0)} / 取消 ${fmtInt(summary.cancelCount || 0)}`;
  }
  if (key === 'metal') {
    return `铜 ${fmtMoney(model?.d?.copperPrice || 0, 0)} 元/吨 / 铝 ${fmtMoney(model?.d?.aluminumPrice || 0, 0)} 元/吨`;
  }
  if (key === 'connector') {
    return `覆盖 ${fmtInt(model?.connectorSummary?.overrideCount || 0)} 项 / 当前 ${fmtMoney(model?.connectorSummary?.totalCurrentCost || 0)} 元/套`;
  }
  if (key === 'labor') {
    return `直接 ${fmtMoney(model?.directLabor || 0)} / 制造 ${fmtMoney(model?.manufacturing || 0)} 元/套`;
  }
  if (key === 'equipment') {
    return `资源投入 ${fmtMoney(model?.equipment || 0)} / 研发 ${fmtMoney(model?.rnd || 0)} 元/套`;
  }
  if (key === 'packaging') {
    return `包装物流 ${fmtMoney(model?.packaging || 0)} 元/套`;
  }
  if (key === 'sales') {
    return `生命周期销量 ${fmtInt(model?.totalVolume || 0)} 套`;
  }
  if (key === 'mix') {
    return `售价系数 ${fmtNumber(model?.mixPrice || 0, 4)}x / 成本系数 ${fmtNumber(model?.mixCost || 0, 4)}x`;
  }
  if (key === 'annualDrop') {
    return annualDropSnapshotSummary(model?.annualDrop);
  }
  if (key === 'oneTimeCustomer') {
    return oneTimeCustomerSnapshotSummary(model?.oneTimeCustomer);
  }
  if (key === 'rebate') {
    return rebateSnapshotSummary(model?.rebate);
  }
  if (key === 'vave') {
    return `VAVE ${fmtMoney(model?.vave?.savings || 0)} 元/套`;
  }
  return `${toText(item?.from, '-')} → ${toText(item?.to, '-')}`;
}

function computeChangeVisualizationPayload(model) {
  const insight = computeProfitInsightsPayload(model);
  const unitRevenue = compareRowSnapshot(model, 0);
  const unitCost = compareRowSnapshot(model, 1);
  const unitProfit = compareRowSnapshot(model, 2);
  const lifecycleProfit = compareRowSnapshot(model, 5);
  const margin = compareRowSnapshot(model, 6);
  const bomSummary = model?.bomSummary || {};
  const shapleyItems = Array.isArray(insight?.shapley?.items) ? insight.shapley.items : [];
  const factors = shapleyItems
    .map((item) => {
      const value = Number(item?.value) || 0;
      const mode = changeFactorMode(item);
      return {
        key: item.key || '',
        label: item.label || item.key || '-',
        from: toText(item?.from, '-'),
        to: toText(item?.to, '-'),
        value,
        share: Number(item?.share) || 0,
        mode,
        changed: mode !== 'steady',
        meta: changeFactorMeta(item?.key, model, item),
      };
    })
    .sort((left, right) => Math.abs(right.value) - Math.abs(left.value));
  const visibleFactors = factors.filter((item) => item.changed);
  const factorRows = visibleFactors.length ? visibleFactors : factors;
  const maxFactorAbs = factorRows.reduce((max, item) => Math.max(max, Math.abs(item.value)), 0) || 1;
  const bomChangeCount = coerceNumber(bomSummary.replaceCount, 0) + coerceNumber(bomSummary.addCount, 0) + coerceNumber(bomSummary.cancelCount, 0);
  const changedFactorCount = visibleFactors.length;
  const targetPrice = insight?.targetPrice || null;
  const financialContext = model?.financialContext || {};
  const summary = [
    {
      label: '已变更要素',
      value: fmtInt(changedFactorCount),
      meta: `共 ${fmtInt(factors.length)} 个成本因子参与归因`,
      tone: changedFactorCount ? 'positive' : 'neutral',
    },
    {
      label: 'BOM 变更项',
      value: fmtInt(bomChangeCount),
      meta: `替换 ${fmtInt(bomSummary.replaceCount || 0)} / 新增 ${fmtInt(bomSummary.addCount || 0)} / 取消 ${fmtInt(bomSummary.cancelCount || 0)}`,
      tone: bomChangeCount ? 'negative' : 'neutral',
    },
    {
      label: '单套成本变化',
      value: formatSignedCurrency(unitCost.current - unitCost.base),
      meta: `当前 ${fmtMoney(unitCost.current)} / 基准 ${fmtMoney(unitCost.base)}`,
      tone: changeTone(unitCost.current - unitCost.base),
    },
    {
      label: '生命周期利润变化',
      value: formatSignedCurrency(lifecycleProfit.current - lifecycleProfit.base),
      meta: `当前 ${fmtMoney(lifecycleProfit.current)} / 基准 ${fmtMoney(lifecycleProfit.base)}`,
      tone: changeTone(lifecycleProfit.current - lifecycleProfit.base, 1),
    },
    {
      label: '毛利率变化',
      value: formatSignedPoints((margin.current - margin.base) * 100),
      meta: `当前 ${fmtPct(margin.current)} / 基准 ${fmtPct(margin.base)}`,
      tone: changeTone((margin.current - margin.base) * 100, 0.01),
    },
  ];
  const bomRows = [
    {
      label: '替换',
      value: fmtInt(bomSummary.replaceCount || 0),
      meta: `配置影响 ${fmtInt(bomSummary.configCount || 0)} 项`,
    },
    {
      label: '新增',
      value: fmtInt(bomSummary.addCount || 0),
      meta: `呆滞数量 ${fmtInt(bomSummary.obsoleteQty || 0)} 套`,
    },
    {
      label: '取消',
      value: fmtInt(bomSummary.cancelCount || 0),
      meta: `呆滞金额 ${fmtMoney(bomSummary.obsoleteValue || 0)}`,
    },
    {
      label: '单套利润变化',
      value: formatSignedCurrency(unitProfit.current - unitProfit.base),
      meta: `收入 ${formatSignedCurrency(unitRevenue.current - unitRevenue.base)} / 成本 ${formatSignedCurrency(unitCost.current - unitCost.base)}`,
    },
  ];
  const contextRows = [];
  if (targetPrice) {
    contextRows.push(
      `${targetPrice.targetModeLabel || '目标毛利率'} ${fmtNumber(targetPrice.requestedMargin || 0, 2)}%，所需 ASP ${fmtMoney(targetPrice.requiredASP)} / 套，较当前 ${formatSignedCurrency(targetPrice.deltaASP)}。`
    );
  }
  if (financialContext.exactApplied) {
    contextRows.push(`当前命中核算口径：${toText(financialContext.exactLabel || financialContext.exactKey, '未命名版本')}。`);
  } else {
    contextRows.push(`当前按 ${toText(financialContext.referenceLabel || financialContext.referenceKey, '参考版本')} 做推演。`);
  }
  if (Array.isArray(financialContext.warnings) && financialContext.warnings.length) {
    financialContext.warnings.slice(0, 3).forEach((warning) => {
      contextRows.push(String(warning));
    });
  } else {
    contextRows.push(
      changedFactorCount
        ? `当前最显著的利润率变化来自 ${factorRows[0]?.label || '核心成本因子'}。`
        : '当前场景与报价基准没有形成显著变更。'
    );
  }
  if (Array.isArray(bomSummary.configList) && bomSummary.configList.length) {
    contextRows.push(`受影响配置：${bomSummary.configList.join(' / ')}`);
  }
  return {
    pill: {
      value: formatSignedPoints((margin.current - margin.base) * 100),
      tone: changeTone((margin.current - margin.base) * 100, 0.01),
    },
    summary,
    factors: factorRows,
    maxFactorAbs,
    bomRows,
    configList: Array.isArray(bomSummary.configList) ? bomSummary.configList : [],
    contextRows,
  };
}

function renderChangeVisualization(model) {
  if (!el.changeVisualSummary || !el.changeVisualFactorList || !el.changeVisualBom || !el.changeVisualContext) {
    return;
  }
  const payload = computeChangeVisualizationPayload(model);
  if (el.changeVisualDeltaPill) {
    el.changeVisualDeltaPill.textContent = payload.pill.value;
    el.changeVisualDeltaPill.dataset.tone = payload.pill.tone;
  }
  el.changeVisualSummary.innerHTML = payload.summary.map((card) => `
    <article class="change-visual-summary-card" data-tone="${escapeHtml(card.tone || 'neutral')}">
      <div class="label">${escapeHtml(card.label)}</div>
      <div class="value">${escapeHtml(card.value)}</div>
      <div class="meta">${escapeHtml(card.meta)}</div>
    </article>
  `).join('');

  if (!payload.factors.length) {
    el.changeVisualFactorList.innerHTML = '<div class="change-visual-empty">当前没有可展示的显著变更因子。</div>';
  } else {
    el.changeVisualFactorList.innerHTML = payload.factors.map((item) => {
      const width = Math.max(6, Math.round((Math.abs(item.value) / payload.maxFactorAbs) * 50));
      const tone = item.value >= 0 ? 'positive' : 'negative';
      const modeLabel = item.mode === 'version' ? '版本切换' : item.mode === 'input' ? '录入变化' : '未变化';
      const versionText = item.from === item.to ? item.to : `${item.from} → ${item.to}`;
      return `
        <article class="change-factor-row">
          <div class="change-factor-label">
            <strong>${escapeHtml(item.label)}</strong>
            <span class="change-factor-meta">${escapeHtml(versionText)}</span>
            <span class="change-factor-meta">${escapeHtml(item.meta)}</span>
          </div>
          <div class="change-factor-track" aria-hidden="true">
            <span class="change-factor-fill ${tone}" style="width:${width}%"></span>
          </div>
          <div class="change-factor-value">
            <span class="change-factor-chip ${escapeHtml(item.mode)}">${escapeHtml(modeLabel)}</span>
            <strong>${escapeHtml(formatSignedPoints(item.value))}</strong>
            <span>${escapeHtml(fmtPct(item.share, 1))}</span>
          </div>
        </article>
      `;
    }).join('');
  }

  el.changeVisualBom.innerHTML = `
    <div class="change-visual-bom-grid">
      ${payload.bomRows.map((row) => `
        <div class="change-visual-bom-item">
          <div class="label">${escapeHtml(row.label)}</div>
          <div class="value">${escapeHtml(row.value)}</div>
          <div class="meta">${escapeHtml(row.meta)}</div>
        </div>
      `).join('')}
    </div>
    ${payload.configList.length ? `<div class="change-visual-config-list">${payload.configList.map((value) => `<span class="mini-tag">${escapeHtml(value)}</span>`).join('')}</div>` : ''}
  `;
  el.changeVisualContext.innerHTML = `<div class="change-visual-context-list">${payload.contextRows.map((row) => `<div class="change-visual-context-row">${escapeHtml(row)}</div>`).join('')}</div>`;
}

function updateDashboardBridge() {
  window.G281DashboardBridge = {
    getStateSnapshot: () => currentScenarioStateSnapshot(),
    getDraftSnapshot: () => readDraft(),
    getRuntimeSnapshot: () => RUNTIME,
    applyVersionStatePatch: (patch = {}) => {
      let changed = false;
      Object.entries(patch || {}).forEach(([group, key]) => {
        if (!BASE.versions?.[group]?.[key] || state[group] === key) return;
        state[group] = key;
        applyVersionPreset(group, key);
        changed = true;
      });
      if (changed) {
        renderVersions();
        render(calcModel());
      }
      return currentScenarioStateSnapshot();
    },
    getDashboardEventNames: () => ({ versionChange: DASHBOARD_VERSION_CHANGE_EVENT }),
    getWorkbookVersionKey: () => resolveWorkbookVersionKeyFromBomState(),
    getBomNativeVersionId,
    getBomSemanticReleaseId: (bomKey = state.bom) => toText(BASE.versions?.bom?.[bomKey]?.semanticReleaseId, ''),
    getBomSemanticSummary: (bomKey = state.bom) => clonePlain(BASE.versions?.bom?.[bomKey]?.semanticSummary || null, null),
    getBomDiffResult: (leftReleaseId, rightReleaseId) => bomSemanticRepo?.getBomDiffResult?.(leftReleaseId, rightReleaseId) || Promise.resolve(null),
    ensureBomSemanticReleaseForVersion,
    compareBomSemanticReleases,
    compareBomVersions,
    getActiveBomVersionKey: () => state.bom,
    getBomVersionOption: (bomKey = state.bom) => clonePlain(BASE.versions?.bom?.[bomKey] || null, null),
    getActiveBomAutoExtract: () => clonePlain(getActiveBomAutoExtract(), null),
    listBomVersions: () => orderedVersionEntries('bom', BASE.versions?.bom || {}).map(([key, option]) => ({
      key,
      label: option?.label || key,
      workbookVersionKey: resolveWorkbookVersionKeyFromBomState(key),
      nativeWorkbookVersionId: toText(option?.nativeWorkbookVersionId, ''),
      workbook: toText(option?.workbook, ''),
      source: toText(option?.source, ''),
      userCreated: Boolean(option?.userCreated),
    })),
    getVersionTimelineRows: () => clonePlain(collectVersionTimelineRows(), []),
    getVersionLabels: () => ({ ...VIEWER_VERSION_LABELS }),
    getProjectCode: () => PROJECT_CODE,
    listSavedScenarios: () => clonePlain(savedScenarioRecords(), []),
    getTargetMarginOverride: () => customTargetMarginPercent,
    getVersionTemplateEditorDebugSnapshot: () => ({
      selection: versionTemplateEditor?.getSelectionSnapshot?.() || null,
      sheetTabs: getVersionTemplateSheetTabs(),
      workbookSnapshot: versionTemplateEditor?.saveSnapshot?.() || null,
    }),
    importNativeBomVersion,
    saveEditableBomWorkbookVersion,
    openVersionTemplateModal,
    closeVersionTemplateModal,
  };
}

function buildFactoryEfficiencyPayloadLegacy(model = null) {
  const seed = clonePlain(window.G281OperatingLaborRateSeedData, null) || {
    factories: [],
    efficiency: { groups: [], note: '' },
    laborRate: { groups: [], note: '' },
  };
  const draft = readDraft();
  const laborLabel = versionOptionLabel('labor', state.labor);
  const equipmentLabel = versionOptionLabel('equipment', state.equipment);
  return {
    factories: clonePlain(seed.factories, []),
    efficiency: {
      ...(seed.efficiency || {}),
      note: [seed.efficiency?.note || '', laborLabel ? `当前工时版本：${laborLabel}` : ''].filter(Boolean).join(' '),
    },
    laborRate: {
      ...(seed.laborRate || {}),
      note: [
        seed.laborRate?.note || '',
        `前工程 ${fmtNumber(draft.directHours, 2)}h × ${fmtMoney(draft.directRate, 0)}/h`,
        `后工程 ${fmtNumber(draft.manufacturingHours, 2)}h × ${fmtMoney(draft.manufacturingRate, 0)}/h`,
        equipmentLabel ? `设备资源：${equipmentLabel}` : '',
        model ? `当前单套运营成本 ${fmtMoney(model.operating)}` : '',
      ].filter(Boolean).join('；'),
    },
  };
}

function buildFactoryEfficiencyPayload(model = null) {
  const seed = clonePlain(window.G281OperatingLaborRateSeedData, null) || {
    factories: [],
    efficiency: { groups: [], note: '' },
    laborRate: { groups: [], note: '' },
  };
  const draft = readDraft();
  const bomLabel = versionOptionLabel('bom', state.bom);
  const laborLabel = versionOptionLabel('labor', state.labor);
  const equipmentLabel = versionOptionLabel('equipment', state.equipment);
  return {
    factories: clonePlain(seed.factories, []),
    efficiency: {
      ...(seed.efficiency || {}),
      note: [
        seed.efficiency?.note || '',
        bomLabel ? `当前 BOM 版本：${bomLabel}` : '',
        laborLabel ? `工时版本：${laborLabel}` : '',
      ].filter(Boolean).join(' ｜ '),
    },
    laborRate: {
      ...(seed.laborRate || {}),
      note: [
        seed.laborRate?.note || '',
        `前工程 ${fmtNumber(draft.directHours, 2)}h × ${fmtMoney(draft.directRate, 0)}/h`,
        `后工程 ${fmtNumber(draft.manufacturingHours, 2)}h × ${fmtMoney(draft.manufacturingRate, 0)}/h`,
        equipmentLabel ? `设备资源：${equipmentLabel}` : '',
        model ? `当前单套经营成本 ${fmtMoney(model.operating)}` : '',
      ].filter(Boolean).join(' ｜ '),
    },
  };
}

function ensureFactoryEfficiencyView(model = null) {
  if (!window.G281FactoryEfficiencyView?.mount || !el.factoryEfficiencyMount) return null;
  if (!factoryEfficiencyView) {
    factoryEfficiencyView = window.G281FactoryEfficiencyView.mount({
      container: el.factoryEfficiencyMount,
      id: 'g281-factory-efficiency-view',
      data: buildFactoryEfficiencyPayload(model),
    });
  }
  return factoryEfficiencyView;
}

function setFactoryEfficiencyModalOpen(open, model = null) {
  if (!el.factoryEfficiencyModal) return;
  if (open) {
    factoryEfficiencyLastFocused = document.activeElement;
    el.factoryEfficiencyModal.hidden = false;
    el.factoryEfficiencyModal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('bom-modal-open');
    const view = ensureFactoryEfficiencyView(model);
    view?.open({ data: buildFactoryEfficiencyPayload(model) });
    window.requestAnimationFrame(() => el.closeFactoryEfficiencyBtn?.focus());
    return;
  }
  el.factoryEfficiencyModal.hidden = true;
  el.factoryEfficiencyModal.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('bom-modal-open');
  factoryEfficiencyView?.close();
  if (factoryEfficiencyLastFocused && typeof factoryEfficiencyLastFocused.focus === 'function') {
    factoryEfficiencyLastFocused.focus();
  }
}

function mountProfitLogicDrawer() {
  window.G281ProfitLogicDrawer?.mount?.();
}

function openProfitLogicDrawer() {
  if (!window.G281ProfitLogicDrawer?.buildPayload || !window.G281ProfitLogicDrawer?.open) return;
  const payload = window.G281ProfitLogicDrawer.buildPayload(RUNTIME, currentScenarioStateSnapshot(), readDraft());
  window.G281ProfitLogicDrawer.open(payload);
}

function render(m){
  window._g281LastModel = m;
  prepareAsyncExecutionPreview(m);
el.scenarioName.value=m.d.scenarioName; renderScenarioHistorySelect(); renderTags(m); renderVersionTimeline(); renderSummary(m); renderWorkspaceContextShell(m); renderProjectProfitExecutionShell(m); renderWorkflowWorkspace(m); renderDataManagementOverview(m); renderKPIs(m); renderProfitDrivers(m); renderHarnessProfitV2(m); renderWireCatalog(m); renderBomAnalysis(m); renderConnectorPricing(m); renderArchitecture(m); renderCostBridge(m); renderAnnualChart(m); renderConfigBars(m); renderEventTable(m); renderCompare(m); renderCapital(m); renderAnnualTable(m); renderProfitInsights(m); renderChangeVisualization(m); if (factoryEfficiencyView && el.factoryEfficiencyModal && !el.factoryEfficiencyModal.hidden) { factoryEfficiencyView.render(buildFactoryEfficiencyPayload(m)); } clearDirty();
}

function syncInputs(){
  applyDraft({}, state.scenarioName);
  applyVersionPreset('bom', state.bom);
  applyVersionPreset('metal', state.metal);
  applyVersionPreset('connector', state.connector);
  applyVersionPreset('sales', state.sales);
  applyVersionPreset('mix', state.mix);
  applyVersionPreset('labor', state.labor);
  applyVersionPreset('packaging', state.packaging);
  applyVersionPreset('annualDrop', state.annualDrop);
  applyVersionPreset('oneTimeCustomer', state.oneTimeCustomer);
  applyVersionPreset('rebate', state.rebate);
}

function generate(){state.scenarioName=el.scenarioName.value.trim()||BASE.name; render(calcModel())}
function reset(){applyStateSnapshot(DEFAULT_STATE);state.scenarioName=BASE.name;lastSavedVersionId='';resetCustomTargetMarginPercent({ skipRender: true });syncInputs();renderVersions();generate()}

let renderTimer=0;
function queueRender(){markDirty(); clearTimeout(renderTimer); renderTimer=setTimeout(generate,120)}

function normalizeWorkspacePage(page) {
  return WORKSPACE_PAGE_VALUES.includes(page) ? page : 'profit';
}

function loadStoredWorkspacePage() {
  try {
    return normalizeWorkspacePage(window.localStorage?.getItem(WORKSPACE_PAGE_STORAGE_KEY));
  } catch (error) {
    return 'profit';
  }
}

function persistWorkspacePage(page) {
  try {
    window.localStorage?.setItem(WORKSPACE_PAGE_STORAGE_KEY, page);
  } catch (error) {
    // Ignore storage failures and keep the current in-memory page.
  }
}

function mountWorkspacePages() {
  const main = document.querySelector('.main');
  const profitPage = el.profitWorkspacePage;
  const dataPage = el.dataWorkspacePage;
  if (!main || !profitPage || !dataPage) return;

  Array.from(main.children).forEach((child) => {
    if (child === el.workspaceShell) return;
    if (child.id === 'versionTimelineSection') return;
    const targetPage = child.id === 'managementTopGrid' || child.id === 'legacyHeroSection'
      ? dataPage
      : profitPage;
    if (child.parentElement !== targetPage) {
      targetPage.appendChild(child);
    }
  });
}

function setWorkspacePage(nextPage = 'profit') {
  const page = normalizeWorkspacePage(nextPage);
  activeWorkspacePage = page;
  persistWorkspacePage(page);
  document.querySelectorAll('[data-workspace-tab]').forEach((button) => {
    const isActive = button.dataset.workspaceTab === page;
    button.classList.toggle('is-active', isActive);
    button.setAttribute('aria-selected', isActive ? 'true' : 'false');
    button.setAttribute('tabindex', isActive ? '0' : '-1');
  });
  document.querySelectorAll('[data-workspace-page]').forEach((panel) => {
    const isActive = panel.dataset.workspacePage === page;
    panel.classList.toggle('is-active', isActive);
    panel.hidden = !isActive;
  });
  el.workspaceShell?.setAttribute('data-active-page', page);
}

function bindWorkspaceTabs() {
  if (!el.workspacePageTabs || el.workspacePageTabs.dataset.bound === 'true') return;
  el.workspacePageTabs.dataset.bound = 'true';
  el.workspacePageTabs.addEventListener('click', (event) => {
    const button = event.target.closest('[data-workspace-tab]');
    if (!button) return;
    setWorkspacePage(button.dataset.workspaceTab);
  });
  el.workspacePageTabs.addEventListener('keydown', (event) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    const buttons = Array.from(el.workspacePageTabs.querySelectorAll('[data-workspace-tab]'));
    const currentIndex = buttons.findIndex((button) => button === document.activeElement);
    if (currentIndex < 0) return;
    event.preventDefault();
    const delta = event.key === 'ArrowRight' ? 1 : -1;
    const nextButton = buttons[(currentIndex + delta + buttons.length) % buttons.length];
    nextButton?.focus();
    if (nextButton?.dataset.workspaceTab) {
      setWorkspacePage(nextButton.dataset.workspaceTab);
    }
  });
}

function setupProfitHomepage() {
  if (el.profitActionBar) {
    el.profitActionBar.innerHTML = '';
  }
  mountWorkspacePages();
  setWorkspacePage(activeWorkspacePage);
  document.querySelector('.bom-section')?.classList.add('profit-hidden');
  document.querySelector('.architecture-card')?.classList.add('profit-hidden');
  el.historyTable?.closest('section.two-col')?.classList.add('profit-hidden');
  el.eventTable?.closest('article.card')?.classList.add('profit-hidden');
  document.querySelector('.footer-note')?.closest('section.card.mt')?.classList.add('profit-hidden');
}

function applyDashboardDebugHooks() {
  const params = new URLSearchParams(window.location.search);
  installVersionTemplateDebugHooks();
  const debugOpenTemplate = params.get('debugOpenTemplate') || '';
  const debugTemplateWindow = params.get('debugTemplateWindow') || '';
  if (VERSION_TEMPLATE_GROUPS.has(debugOpenTemplate)) {
    window.setTimeout(() => {
      openVersionTemplateModal(debugOpenTemplate);
    }, 900);
    if (debugTemplateWindow === 'max') {
      window.setTimeout(() => {
        setVersionTemplateWindowMaximized(true);
      }, 2200);
    } else if (debugTemplateWindow === 'min') {
      window.setTimeout(() => {
        setVersionTemplateWindowMinimized(true);
      }, 2200);
    }
  }
}

function bind(){
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
  el.generateBtn.addEventListener('click',generate); el.resetBtn.addEventListener('click',reset); el.printBtn.addEventListener('click',()=>window.print());
  if (el.openProfitLogicBtn) {
    el.openProfitLogicBtn.addEventListener('click', openProfitLogicDrawer);
    el.openProfitLogicBtn.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        openProfitLogicDrawer();
      }
    });
  }
  if (el.openVersionTimelineBtn) {
    el.openVersionTimelineBtn.addEventListener('click', () => setVersionTimelineDrawerOpen(true));
    el.openVersionTimelineBtn.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        setVersionTimelineDrawerOpen(true);
      }
    });
  }
  if (el.openFactoryEfficiencyBtn) {
    el.openFactoryEfficiencyBtn.addEventListener('click', () => setFactoryEfficiencyModalOpen(true, calcModel()));
  }
  if (el.openConfigSheetManagerBtn) {
    el.openConfigSheetManagerBtn.addEventListener('click', () => openVersionTemplateModal('configSheet'));
  }
  if (el.openAnnualDropManagerBtn) {
    el.openAnnualDropManagerBtn.addEventListener('click', () => openVersionTemplateModal('annualDrop'));
  }
  if (el.openOneTimeCustomerManagerBtn) {
    el.openOneTimeCustomerManagerBtn.addEventListener('click', () => openVersionTemplateModal('oneTimeCustomer'));
  }
  if (el.openRebateManagerBtn) {
    el.openRebateManagerBtn.addEventListener('click', () => openVersionTemplateModal('rebate'));
  }
  if (el.scenarioHistorySelect) {
    el.scenarioHistorySelect.addEventListener('change', async () => {
      const scenarioId = el.scenarioHistorySelect.value;
      if (!scenarioId) {
        lastSavedVersionId = '';
        renderScenarioHistorySelect();
        return;
      }
      const loaded = await loadSavedScenarioRecord(scenarioId);
      if (!loaded) {
        loadHistoryRecord(scenarioId);
      }
    });
  }
  el.saveVersionBtn.addEventListener('click', async () => {
    const model = calcModel();
    const record = repo.createHistoryRecord(model);
    repo.saveHistory(record);
    lastSavedVersionId = record.id;
    await saveScenarioVersionRecord(model, { scenarioId: record.id, note: record.note || '' });
    render(model);
  });
  el.submitApprovalBtn.addEventListener('click',()=>{const model=calcModel(); let versionRecord=lastSavedVersionId?repo.getHistory().find(item=>item.id===lastSavedVersionId):null; if(!versionRecord){versionRecord=repo.createHistoryRecord(model); repo.saveHistory(versionRecord); lastSavedVersionId=versionRecord.id;} const record=repo.createApprovalRecord(model,versionRecord); repo.saveApproval(record); render(model)});
  el.exportLayerBtn.addEventListener('click',()=>{repo.exportSnapshot(`hvh_cost_snapshot_${new Date().toISOString().replace(/[:.]/g,'-')}.json`,{master:BASE,bomChanges:BOM_CHANGE_ROWS,bomValidation:RUNTIME.bomValidation||null,bomVersions:RUNTIME.bomVersions||null,capitalValidation:RUNTIME.capitalValidation||null,laborValidation:RUNTIME.laborValidation||null,packagingValidation:RUNTIME.packagingValidation||null,connectorProtocolStatus:RUNTIME.connectorProtocolStatus||null,wireCatalog:RUNTIME.wireCatalog||null,history:repo.getHistory(),approvals:repo.getApprovals()})});
  document.querySelector('.sidebar')?.addEventListener('click', (event) => {
    const addButton = event.target.closest('[data-add-version]');
    if (!addButton) return;
    createUserVersion(addButton.dataset.addVersion);
  });
  if (el.versionTemplateModal) {
    el.versionTemplateModal.addEventListener('click', (event) => {
      if (event.target.closest('[data-version-template-close]')) {
        closeVersionTemplateModal();
      }
    });
  }
  if (el.factoryEfficiencyModal) {
    el.factoryEfficiencyModal.addEventListener('click', (event) => {
      if (event.target.closest('[data-factory-efficiency-close]')) {
        setFactoryEfficiencyModalOpen(false);
      }
    });
  }
  if (el.versionTimelineDrawer) {
    el.versionTimelineDrawer.addEventListener('click', (event) => {
      if (event.target.closest('[data-version-timeline-close]')) {
        setVersionTimelineDrawerOpen(false);
      }
    });
  }
  if (el.quoteMatrixDrawer) {
    el.quoteMatrixDrawer.addEventListener('click', (event) => {
      if (event.target.closest('[data-quote-matrix-close]')) {
        setQuoteMatrixDrawerOpen(false);
      }
    });
  }
  if (el.profitWorkspacePage) {
    el.profitWorkspacePage.addEventListener('click', (event) => {
      const trigger = event.target.closest('[data-quote-matrix-open]');
      if (!trigger) return;
      setQuoteMatrixDrawerOpen(true, trigger.dataset.harnessId, trigger.dataset.rowKey);
    });
  }
  if (el.closeFactoryEfficiencyBtn) {
    el.closeFactoryEfficiencyBtn.addEventListener('click', () => setFactoryEfficiencyModalOpen(false));
  }
  if (el.closeVersionTimelineBtn) {
    el.closeVersionTimelineBtn.addEventListener('click', () => setVersionTimelineDrawerOpen(false));
  }
  if (el.closeVersionTemplateBtn) {
    el.closeVersionTemplateBtn.addEventListener('click', closeVersionTemplateModal);
  }
  if (el.minimizeVersionTemplateWindowBtn) {
    el.minimizeVersionTemplateWindowBtn.addEventListener('click', () => setVersionTemplateWindowMinimized());
  }
  if (el.toggleVersionTemplateWindowBtn) {
    el.toggleVersionTemplateWindowBtn.addEventListener('click', () => setVersionTemplateWindowMaximized());
  }
  if (el.versionTemplateResetBtn) {
    el.versionTemplateResetBtn.addEventListener('click', resetVersionTemplateForm);
  }
  if (el.versionTemplateSaveInlineBtn) {
    el.versionTemplateSaveInlineBtn.addEventListener('click', saveVersionTemplate);
  }
  if (el.versionTemplateInsertRowBtn) {
    el.versionTemplateInsertRowBtn.addEventListener('click', () => runVersionTemplateQuickAction('insert-row'));
  }
  if (el.versionTemplateInsertColumnBtn) {
    el.versionTemplateInsertColumnBtn.addEventListener('click', () => runVersionTemplateQuickAction('insert-column'));
  }
  if (el.versionTemplateMergeBtn) {
    el.versionTemplateMergeBtn.addEventListener('click', () => runVersionTemplateQuickAction('merge'));
  }
  if (el.versionTemplateUnmergeBtn) {
    el.versionTemplateUnmergeBtn.addEventListener('click', () => runVersionTemplateQuickAction('unmerge'));
  }
  if (el.versionTemplateFilterBtn) {
    el.versionTemplateFilterBtn.addEventListener('click', () => runVersionTemplateQuickAction('filter'));
  }
  if (el.versionTemplateConditionalBtn) {
    el.versionTemplateConditionalBtn.addEventListener('click', () => runVersionTemplateQuickAction('conditional'));
  }
  if (el.versionTemplateInsertImageBtn) {
    el.versionTemplateInsertImageBtn.addEventListener('click', () => runVersionTemplateQuickAction('image'));
  }
  if (el.versionTemplateAddSheetBtn) {
    el.versionTemplateAddSheetBtn.addEventListener('click', () => runVersionTemplateQuickAction('add-sheet'));
  }
  if (el.versionTemplateParseBtn) {
    el.versionTemplateParseBtn.addEventListener('click', parseVersionTemplatePaste);
  }
  if (el.versionTemplateSaveBtn) {
    el.versionTemplateSaveBtn.addEventListener('click', saveVersionTemplate);
  }
  if (el.versionTemplateFields) {
    el.versionTemplateFields.addEventListener('input', handleVersionTemplateSheetInput);
    el.versionTemplateFields.addEventListener('paste', handleVersionTemplateSheetPaste);
    el.versionTemplateFields.addEventListener('pointerup', () => window.setTimeout(updateVersionTemplateStatusMeta, 60));
    el.versionTemplateFields.addEventListener('keyup', () => window.setTimeout(updateVersionTemplateStatusMeta, 60));
  }
  window.addEventListener('keydown', handleVersionTemplateGlobalShortcuts);
  if (el.initConnectorProtocolBtn) {
    el.initConnectorProtocolBtn.addEventListener('click', applyConnectorProtocolInitialization);
  }
  if (el.clearConnectorOverridesBtn) {
    el.clearConnectorOverridesBtn.addEventListener('click',()=>{connectorPricingState={}; syncActiveConnectorCustomVersion(); renderVersions(); queueRender()});
  }
  if (el.toggleWireCatalogViewBtn) {
    el.toggleWireCatalogViewBtn.addEventListener('click', () => {
      setWireCatalogShowAll(!showInactiveWireModels);
    });
  }
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && el.quoteMatrixDrawer && !el.quoteMatrixDrawer.hidden) {
      setQuoteMatrixDrawerOpen(false);
      return;
    }
    if (event.key === 'Escape' && el.versionTimelineDrawer && !el.versionTimelineDrawer.hidden) {
      setVersionTimelineDrawerOpen(false);
      return;
    }
    if (event.key === 'Escape' && el.factoryEfficiencyModal && !el.factoryEfficiencyModal.hidden) {
      setFactoryEfficiencyModalOpen(false);
      return;
    }
    if (event.key === 'Escape' && el.versionTemplateModal && !el.versionTemplateModal.hidden) {
      closeVersionTemplateModal();
    }
  });
  if (el.connectorPriceTable) {
    el.connectorPriceTable.addEventListener('click',(event)=>{
      const followButton = event.target.closest('[data-connector-mode="follow"]');
      if (followButton) {
        delete connectorPricingState[followButton.dataset.connectorId];
        syncActiveConnectorCustomVersion();
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
      syncActiveConnectorCustomVersion();
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
  if (el.metalVersionEditor) {
    el.metalVersionEditor.addEventListener('click', (event) => {
      const lockButton = event.target.closest('[data-metal-lock]');
      if (!lockButton) return;
      const versionKey = lockButton.dataset.metalLock;
      if (!BASE.versions?.metal?.[versionKey]) return;
      metalVersionLocks[versionKey] = !metalVersionLocks[versionKey];
      renderVersions();
    });
    el.metalVersionEditor.addEventListener('input', (event) => {
      const input = event.target.closest('[data-metal-key][data-metal-field]');
      if (!input) return;
      const versionKey = input.dataset.metalKey;
      const field = input.dataset.metalField;
      if (!BASE.versions?.metal?.[versionKey] || metalVersionLocks[versionKey] !== false) return;
      const value = Number(input.value);
      if (!Number.isFinite(value)) return;
      setMetalVersionValues(versionKey, { [field]: value }, { manualManaged: true });
      persistUserVersions();
      if (state.metal === versionKey) {
        applyMetalVersion(versionKey);
        queueRender();
      }
      const note = $('metalNote');
      if (note) {
        note.textContent = `${BASE.versions.metal[state.metal].note} ${metalVersionSourceText(state.metal)}`.trim();
      }
    });
    el.metalVersionEditor.addEventListener('change', (event) => {
      const input = event.target.closest('[data-metal-key][data-metal-field]');
      if (!input) return;
      renderVersions();
    });
  }
  [el.scenarioName,...Object.values(controls),...yearInputs,...mixInputs].forEach((input) => input.addEventListener('input', () => {
    syncActiveCustomVersionsFromInputs();
    queueRender();
  }));
  el.scenarioName.addEventListener('change',()=>state.scenarioName=el.scenarioName.value.trim()||BASE.name);
}

function renderVersions() {
  Object.entries(BASE.versions).forEach(([group, options]) => {
    const box = document.querySelector(`.option-row[data-group="${group}"]`);
    if (!box) return;
    box.innerHTML = '';

    orderedVersionEntries(group, options).forEach(([key, option]) => {
      const chip = document.createElement('div');
      chip.className = 'option-chip' + (option?.userCreated ? ' is-user-created' : '');
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
      chip.appendChild(button);
      if (option?.userCreated) {
        const deleteButton = document.createElement('button');
        deleteButton.type = 'button';
        deleteButton.className = 'option-delete-btn';
        deleteButton.title = `删除版本 ${option.label}`;
        deleteButton.setAttribute('aria-label', `删除版本 ${option.label}`);
        deleteButton.textContent = '×';
        deleteButton.addEventListener('click', (event) => {
          event.preventDefault();
          event.stopPropagation();
          deleteUserVersion(group, key);
        });
        chip.appendChild(deleteButton);
      }
      box.appendChild(chip);
    });

    const note = $(group + 'Note');
    if (!note) return;
    const currentOption = options?.[state[group]] || { label: state[group], note: '' };
    if (group === 'connector') {
      const connectorSourceKey = BASE.versions?.connector?.[state.connector]?.sourceKey || state.connector;
      const overrideCount = connectorOverrideCount(connectorPricingState, connectorSourceKey);
      note.textContent = `默认执行版本：${currentOption.label}。${currentOption.note} 当前已单独指定 ${overrideCount} 个连接器。`;
      return;
    }
    if (group === 'sales') {
      const salesStats = salesVersionStats(state.sales);
      note.textContent = `${currentOption.note} 生命周期 ${fmtInt(salesStats.total)} 套，首年 ${fmtInt(salesStats.firstYear)} 套。`;
      return;
    }
    if (group === 'metal') {
      renderMetalVersionEditor();
      const lockText = metalVersionLocks[state[group]] !== false ? '当前版本已锁定。' : '当前版本编辑中。';
      note.textContent = `${currentOption.note} ${metalVersionSourceText(state[group])} ${lockText}`.trim();
      return;
    }
    if (group === 'mix') {
      note.textContent = `${currentOption.note} ${mixVersionSummary(state.mix)}。`;
      return;
    }
    if (group === 'bom') {
      note.textContent = `${currentOption.note} ${bomVersionSourceText(state[group])}`.trim();
      return;
    }
    if (group === 'labor') {
      note.textContent = `${currentOption.note} ${laborVersionSourceText(state[group])}`.trim();
      return;
    }
    if (group === 'equipment') {
      note.textContent = `${currentOption.note} ${equipmentVersionSourceText(state[group])}`.trim();
      return;
    }
    if (group === 'packaging') {
      note.textContent = `${currentOption.note} ${packagingVersionSourceText(state[group])}`.trim();
      return;
    }
    if (group === 'configSheet') {
      note.textContent = `${currentOption.note} ${configSheetVersionSourceText(state[group])}`.trim();
      return;
    }
    if (group === 'annualDrop') {
      note.textContent = `${currentOption.note} ${annualDropVersionSourceText(state[group])}`.trim();
      return;
    }
    if (group === 'oneTimeCustomer') {
      note.textContent = `${currentOption.note} ${oneTimeCustomerVersionSourceText(state[group])}`.trim();
      return;
    }
    if (group === 'rebate') {
      note.textContent = `${currentOption.note} ${rebateVersionSourceText(state[group])}`.trim();
      return;
    }
    note.textContent = currentOption.note;
  });
  renderVersionTimeline();
}

el.sheets.textContent=`${BASE.sheetCount} sheets parsed`; el.faults.textContent=`${BASE.faultCount} formula faults`; el.priceTypes.textContent=`${BASE.priceTypeCount} price types`; bind();

function getWorkflowStageBuffer(record, stageCode) {
  const key = workflowBufferKey(record?.recordId, stageCode);
  if (!workflowStageDraftBuffers[key]) {
    const stage = safeArray(record?.stageStates).find((item) => item.stageCode === stageCode) || {};
    const seed = {
      ...clonePlain(stage.submitData || {}, {}),
      ...clonePlain(stage.draftData || {}, {}),
    };
    if (stageCode === 'execution_recovery') {
      seed.deliveredSets = seed.deliveredSets ?? numberOr(record?.latestExecutionSnapshot?.deliveredSets, 0);
      seed.recoveredAmount = seed.recoveredAmount ?? numberOr(record?.latestExecutionSnapshot?.recoveredAmount, 0);
      seed.remainingAmount = seed.remainingAmount ?? numberOr(record?.latestExecutionSnapshot?.remainingAmount, 0);
      seed.shipment_progress = seed.shipment_progress ?? seed.deliveredSets;
      seed.recovery_progress = seed.recovery_progress ?? seed.recoveredAmount;
      seed.invoice_reprice_action = seed.invoice_reprice_action ?? toText(record?.latestExecutionSnapshot?.lastTaskHint, '');
    }
    workflowStageDraftBuffers[key] = seed;
  }
  return workflowStageDraftBuffers[key];
}

function workflowStagePayload(record, stageCode) {
  const stage = safeArray(record?.stageStates).find((item) => item.stageCode === stageCode) || {};
  return {
    ...clonePlain(stage.submitData || {}, {}),
    ...clonePlain(stage.draftData || {}, {}),
  };
}

function workflowFlowOverviewHtml(snapshot, selectedRecord) {
  const stageCountMap = safeArray(snapshot?.records).reduce((acc, record) => {
    const key = toText(record?.displayStageCode, '');
    if (!key) return acc;
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  return `
    <div class="workflow-flow-track">
      ${WORKFLOW_STAGE_DEFS.map((stage, index) => {
        const stageState = selectedRecord ? workflowStageStatus(selectedRecord, stage.stageCode) : {};
        const completion = selectedRecord ? workflowStageCompletion(selectedRecord, stage.stageCode) : { filled: 0, total: 0 };
        const progress = completion.total ? completion.filled / completion.total : (toText(stageState.status, '') === 'approved' ? 1 : 0);
        const tone = stage.stageCode === selectedRecord?.displayStageCode
          ? 'is-current'
          : (toText(stageState.status, '') === 'approved' ? 'is-done' : '');
        const globalCount = fmtInt(stageCountMap[stage.stageCode] || 0);
        const publicationConfigs = safeArray(WORKFLOW_PUBLICATION_CONFIGS).filter((config) => config.stageCode === stage.stageCode);
        let publicationText = '';
        if (selectedRecord && publicationConfigs.length) {
          const publishedConfigs = publicationConfigs.filter((config) => workflowPublicationState(selectedRecord, config).status === 'published');
          if (publishedConfigs.length) {
            publicationText = `已发布 ${publishedConfigs.map((config) => config.title.replace('发布', '').trim() || config.title).join(' / ')}`;
          } else if (publicationConfigs.some((config) => workflowPublicationState(selectedRecord, config).canPublish)) {
            publicationText = `可发布至 ${publicationConfigs.map((config) => config.targetLabel).join(' / ')}`;
          } else {
            publicationText = '资料未达到发布条件';
          }
        }
        return `
          <div class="workflow-flow-segment">
            <article class="workflow-flow-node ${tone}">
              <span class="workflow-flow-index">${String(index + 1).padStart(2, '0')}</span>
              <strong>${escapeHtml(stage.stageLabel)}</strong>
              <span>${escapeHtml(stage.ownerRoleCodes.map((role) => workflowRoleLabel(role)).join(' / ') || '-')}</span>
              <div class="workflow-flow-meta">
                <em>全局 ${globalCount} 条记录</em>
                <em>${escapeHtml(selectedRecord ? workflowStatusLabel(stageState.status || 'not_started') : '未选记录')}</em>
                ${publicationText ? `<em>${escapeHtml(publicationText)}</em>` : ''}
              </div>
              <div class="workflow-flow-progress"><span style="width:${Math.max(0, Math.min(progress, 1)) * 100}%"></span></div>
              <span>${escapeHtml(selectedRecord ? `完成 ${completion.filled}/${completion.total || 0}` : `阶段当前 ${globalCount} 条`)}</span>
            </article>
            ${index < WORKFLOW_STAGE_DEFS.length - 1 ? '<div class="workflow-flow-connector" aria-hidden="true"></div>' : ''}
          </div>
        `;
      }).join('')}
    </div>
  `.trim();
}

function workflowDocumentPanelHtml(record, config, extra = {}) {
  const stage = workflowStageStatus(record, config.stageCode);
  const payload = workflowStagePayload(record, config.stageCode);
  const completion = workflowStageCompletion(record, config.stageCode);
  const publish = workflowPublicationState(record, config);
  const previewRows = workflowFieldDefsForStage(config.stageCode)
    .slice(0, 4)
    .map((field) => {
      const value = toText(payload[field.fieldCode], '');
      return `
        <div class="workflow-doc-line">
          <span>${escapeHtml(field.fieldLabel)}</span>
          <strong>${escapeHtml(value || '待补充')}</strong>
        </div>
      `;
    }).join('');
  return `
    <article class="card workflow-doc-card">
      <div class="workflow-doc-head">
        <div>
          <h4>${escapeHtml(config.title)}</h4>
          <p>${escapeHtml(extra.description || config.description || '')}</p>
        </div>
        <span class="workflow-doc-status">${escapeHtml(workflowStatusLabel(stage.status || 'not_started'))}</span>
      </div>
      <div class="workflow-doc-summary">
        <span>完成度 ${completion.filled}/${completion.total || 0}</span>
        <span>下游 ${escapeHtml(config.targetLabel)}</span>
        <span>${escapeHtml(publish.status === 'published' ? '已发布' : '待发布')}</span>
      </div>
      <div class="workflow-doc-lines">${previewRows || '<div class="workflow-empty">当前阶段还没有可展示字段</div>'}</div>
      <div class="workflow-doc-publish">
        <span>${escapeHtml(publish.status === 'published' ? `已发布 · ${toText(publish.publishedAt, '-')} · ${toText(publish.publishedBy, '-')}` : `未发布 · 目标 ${config.targetLabel}`)}</span>
        ${publish.canPublish ? `<button class="button ghost" type="button" data-wf-publish-action="publish" data-wf-record-id="${escapeHtml(record.recordId)}" data-wf-publish-key="${escapeHtml(config.key)}">${escapeHtml(config.buttonLabel)}</button>` : ''}
      </div>
      ${publish.note ? `<div class="workflow-doc-note">${escapeHtml(publish.note)}</div>` : ''}
    </article>
  `.trim();
}

function workflowBomSheetHtml(record) {
  if (!record) {
    return `
      <article class="card workflow-inline-sheet">
        <div class="workflow-inline-sheet-title">BOM Sheet 预览</div>
        <div class="workflow-inline-sheet-meta">请选择一条记录，查看单线束 BOM 资料与页内发布动作。</div>
      </article>
    `.trim();
  }
  const preview = buildWorkflowBomSheetPreview(record);
  const bomConfig = WORKFLOW_PUBLICATION_CONFIGS.find((item) => item.key === 'bom_release');
  const publish = bomConfig ? workflowPublicationState(record, bomConfig) : null;
  return `
    <article class="card workflow-inline-sheet">
      <div class="workflow-inline-sheet-head">
        <div>
          <h4 class="workflow-inline-sheet-title">${escapeHtml(record.harnessId)} · BOM Sheet</h4>
          <div class="workflow-inline-sheet-meta">${escapeHtml(preview.hasSource ? `${preview.sourceLabel} / ${preview.sourceSheetName}` : '当前没有可用 BOM Sheet 源数据')}</div>
        </div>
        <div class="workflow-inline-sheet-side">
          <div class="workflow-inline-sheet-actions">
            <span class="workflow-inline-sheet-status">${escapeHtml(
              publish
                ? (publish.status === 'published'
                  ? `已发布 · ${toText(publish.publishedAt, '-')}`
                  : '待发布 · 开发完成后可直接下发')
                : '未挂发布链路'
            )}</span>
            ${publish?.canPublish ? `<button class="button ghost" type="button" data-wf-publish-action="publish" data-wf-record-id="${escapeHtml(record.recordId)}" data-wf-publish-key="${escapeHtml(bomConfig?.key || 'bom_release')}">在 Sheet 内发布 BOM</button>` : ''}
          </div>
          <div class="workflow-inline-sheet-meta">行数 ${fmtInt(preview.rowCount)} · 导线 ${fmtInt(preview.wireCount)} · 连接器 ${fmtInt(preview.connectorCount)} · 供应商 ${fmtInt(preview.supplierCount)}</div>
        </div>
      </div>
      <div class="workflow-doc-summary">
        <span>单线束号发布</span>
        <span>开发完成后即可发到采购先询价</span>
        <span>无需等待整包 BOM 冻结</span>
      </div>
      ${preview.rows.length ? `
        <div class="table-wrap workflow-inline-sheet-wrap">
          <table class="workflow-inline-sheet-table">
            <thead>
              <tr>
                <th>行</th>
                <th>线束号</th>
                <th>零件号</th>
                <th>零件名称</th>
                <th>数量</th>
                <th>单位</th>
                <th>供应商</th>
                <th>备注</th>
              </tr>
            </thead>
            <tbody>
              ${preview.rows.map((row) => `
                <tr>
                  <td>${fmtInt(row.rowIndex || 0)}</td>
                  <td>${escapeHtml(row.harnessId || '-')}</td>
                  <td>${escapeHtml(row.partNumber || '-')}</td>
                  <td>${escapeHtml(row.partName || '-')}</td>
                  <td>${fmtMaybeNumber(row.quantity, 3)}</td>
                  <td>${escapeHtml(row.unit || '-')}</td>
                  <td>${escapeHtml(row.supplier || '-')}</td>
                  <td>${escapeHtml(row.remark || '-')}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      ` : '<div class="workflow-empty">当前活动 BOM 中还没有识别到这条线束的明细行。</div>'}
      <div class="workflow-inline-sheet-note">BOM 以单线束号为粒度预览。开发完成一款线束后，可直接在当前页发布给采购先行询价，不必等待整包资料全部完成。</div>
    </article>
  `.trim();
}

function renderProjectProfitExecutionShell(m) {
  if (!el.projectProfitSummaryMount) return;
  const quoteMatrix = getQuoteWorkbookMatrix();
  if (quoteMatrix) {
    renderQuoteWorkbookProjectSummary(quoteMatrix);
    return;
  }
  const quoteMeta = currentQuoteTypeMeta();
  const pricingBasisLabel = '报价版底座';
  const previewSummary = latestExecutionPreview && window.G281ExecutionPreview?.buildProjectSummary
    ? window.G281ExecutionPreview.buildProjectSummary(latestExecutionPreview)
    : null;
  const recoverySummary = latestExecutionPreview && window.G281ExecutionPreview?.buildRecoverySummary
    ? window.G281ExecutionPreview.buildRecoverySummary(latestExecutionPreview)
    : null;
  const previewHarnessRows = latestExecutionPreview && window.G281ExecutionPreview?.buildHarnessRows
    ? window.G281ExecutionPreview.buildHarnessRows(latestExecutionPreview)
    : [];
  const evaluation = buildProjectEvaluationRows(m, previewSummary, recoverySummary);
  const lifecycleVolume = numberOr(evaluation.rows?.[0]?.lifecycle, previewSummary?.lifecycle?.volume || m?.totalVolume || 0);
  const revenuePerSet = numberOr(previewSummary?.unit?.revenuePerSet, m?.portfolioSummary?.unit?.revenue || 0);
  const baseProfitPerSet = numberOr(previewSummary?.unit?.baseProfitPerSet, m?.portfolioSummary?.unit?.profit || m?.avgProfit || 0);
  const recoveryPerSet = numberOr(previewSummary?.unit?.projectedRecoveryPerSet, recoverySummary?.totalProjectedRecoveryPerSet || 0);
  const adjustedProfitPerSet = numberOr(previewSummary?.unit?.adjustedProfitPerSet, baseProfitPerSet + recoveryPerSet);
  const adjustedLifecycleProfit = numberOr(previewSummary?.lifecycle?.adjustedProfit, adjustedProfitPerSet * lifecycleVolume);
  const operatingCostPerSet = numberOr(revenuePerSet - baseProfitPerSet, m?.operating || 0);
  const trackingRows = buildWorkflowTrackingRows(window._g281LastModel || m);
  const recoveredAmount = trackingRows.reduce((sum, row) => sum + numberOr(row.recoveredAmount, 0), 0);
  const remainingAmount = trackingRows.reduce((sum, row) => sum + numberOr(row.remainingAmount, 0), 0);
  const shippedSets = trackingRows.reduce((sum, row) => sum + numberOr(row.deliveredSets, 0), 0);
  const thresholdCount = trackingRows.filter((row) => row.thresholdReached).length;
  const activeRuleCount = numberOr(recoverySummary?.activeRuleCount, latestSalesRuleSnapshot?.summary?.effectiveRules || 0);
  const carrierHarnessCount = numberOr(recoverySummary?.coveredHarnessCount, 0);
  const recoveryTargetAmount = recoveredAmount + remainingAmount;
  const focusRows = (safeArray(previewHarnessRows).length
    ? safeArray(previewHarnessRows).map((row) => ({
      harnessId: toText(row?.harnessId, ''),
      harnessName: toText(row?.harnessName, ''),
      profit: numberOr(row?.adjusted?.profitPerSet, row?.base?.profitPerSet || 0),
      margin: numberOr(row?.adjusted?.margin, row?.base?.margin || 0),
      rules: safeArray(row?.activeRules).length,
    }))
    : buildHarnessProfitRows(m).map((row) => ({
      harnessId: row.harnessId,
      harnessName: row.harnessName,
      profit: numberOr(row.profit, 0),
      margin: numberOr(row.margin, 0),
      rules: 0,
    })))
    .sort((left, right) => numberOr(left.profit, 0) - numberOr(right.profit, 0))
    .slice(0, 3);
  const badges = [
    quoteMeta.label,
    '报价版项目评估汇总',
    '工厂实际执行口径',
    authContextSummaryText(),
  ];
  if (activeQuoteType === 'change') {
    badges.push(`基线 ${baselineQuoteVersionLabel()}`);
  }
  if (el.projectProfitSummaryBadges) {
    el.projectProfitSummaryBadges.innerHTML = badges.map((item) => `<span class="summary-badge">${escapeHtml(item)}</span>`).join('');
  }
  const metricCards = [
    {
      label: '收入 / 套',
      value: fmtMoney(revenuePerSet),
      meta: `生命周期收入 ${fmtMoney(numberOr(previewSummary?.lifecycle?.revenue, m?.totalRevenue || 0))}`,
      tone: '',
    },
    {
      label: '成本 / 套',
      value: fmtMoney(operatingCostPerSet),
      meta: `${pricingBasisLabel} · 工厂执行回放`,
      tone: '',
    },
    {
      label: '经营利润 / 套',
      value: fmtMoney(baseProfitPerSet),
      meta: `单套利润率 ${fmtPct(revenuePerSet ? baseProfitPerSet / revenuePerSet : 0)}`,
      tone: baseProfitPerSet >= 0 ? 'positive' : 'negative',
    },
    {
      label: '实际执行利润 / 套',
      value: fmtMoney(adjustedProfitPerSet),
      meta: `经营利润 ${fmtMoney(baseProfitPerSet)} · 回收影响 ${fmtMoney(recoveryPerSet)}`,
      tone: adjustedProfitPerSet >= 0 ? 'positive' : 'negative',
    },
    {
      label: '回收目标 / 已回收',
      value: `${fmtMoney(recoveryTargetAmount)} / ${fmtMoney(recoveredAmount)}`,
      meta: `待回收 ${fmtMoney(remainingAmount)} · 有效规则 ${fmtInt(activeRuleCount)}`,
      tone: remainingAmount > 0 ? '' : 'positive',
    },
    {
      label: '累计出货 / 阈值命中',
      value: `${fmtInt(shippedSets)} / ${fmtInt(thresholdCount)}`,
      meta: thresholdCount ? '需关注开票 / 调价复核' : `承载线束 ${fmtInt(carrierHarnessCount)} · 进度正常`,
      tone: thresholdCount ? 'negative' : '',
    },
  ];
  el.projectProfitSummaryMount.innerHTML = `
    <div class="project-eval-shell">
      <section class="project-eval-section project-eval-head">
        <div class="project-eval-caption">
          <div>
            <div class="project-eval-caption-title">项目评估汇总</div>
            <div class="project-eval-caption-meta">${financialContextSummary(m)} · ${authContextSummaryText()}</div>
          </div>
          <div class="project-eval-caption-meta">只展示报价版成本底座，并叠加当前实际承载、回收规则与出货执行结果。</div>
        </div>
        <div class="project-eval-summary-grid">
          ${metricCards.map((card) => `
            <article class="project-eval-summary-card ${card.tone ? `is-${card.tone}` : ''}">
              <span>${escapeHtml(card.label)}</span>
              <strong>${escapeHtml(card.value)}</strong>
              <em>${escapeHtml(card.meta)}</em>
            </article>
          `).join('')}
        </div>
      </section>
      <div class="project-eval-layout">
        <section class="project-eval-section">
          <div class="table-wrap">
            <table class="project-summary-table project-eval-table">
              <thead>
                <tr>
                  <th>区段</th>
                  <th>项目评估项</th>
                  ${safeArray(evaluation.years).map((year) => `<th>${escapeHtml(String(year))}</th>`).join('')}
                  <th>生命周期</th>
                  <th>单套口径</th>
                </tr>
              </thead>
              <tbody>
                ${safeArray(evaluation.rows).map((row) => `
                  <tr data-tone="${escapeHtml(toText(row.tone, ''))}">
                    <td><span class="project-summary-group project-summary-group--${row.group}">${row.group}</span></td>
                    <td>${escapeHtml(row.label)}</td>
                    ${safeArray(row.years).map((value) => {
                      const toneClass = row.tone === 'profit' ? (numberOr(value, 0) >= 0 ? 'positive' : 'negative') : '';
                      return `<td class="${toneClass}"><span class="num">${formatProjectEvaluationCell(value, row.type)}</span></td>`;
                    }).join('')}
                    <td class="${row.tone === 'profit' ? (numberOr(row.lifecycle, 0) >= 0 ? 'positive' : 'negative') : ''}"><span class="num">${formatProjectEvaluationCell(row.lifecycle, row.type)}</span></td>
                    <td class="${row.tone === 'profit' ? (numberOr(row.unit, 0) >= 0 ? 'positive' : 'negative') : ''}"><span class="num">${formatProjectEvaluationCell(row.unit, row.type)}</span></td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </section>
        <aside class="project-eval-side">
          <article class="card project-eval-card">
            <div class="workflow-doc-head">
              <div>
                <h4>执行口径</h4>
                <p>仅看报价版底座，不混入总部财务平均分摊；一次性费用按承载线束和实际回收规则回放。</p>
              </div>
            </div>
            <div class="workflow-doc-lines">
              <div class="workflow-doc-line">
                <span>生命周期执行利润</span>
                <strong>${escapeHtml(fmtMoney(adjustedLifecycleProfit))}</strong>
              </div>
              <div class="workflow-doc-line">
                <span>承载线束 / 有效规则</span>
                <strong>${escapeHtml(`${fmtInt(carrierHarnessCount)} / ${fmtInt(activeRuleCount)}`)}</strong>
              </div>
              <div class="workflow-doc-line">
                <span>当前预警</span>
                <strong>${escapeHtml(thresholdCount ? `已命中 ${fmtInt(thresholdCount)} 条阈值` : '暂未命中调价 / 开票阈值')}</strong>
              </div>
            </div>
          </article>
          <article class="card project-eval-card">
            <div class="workflow-doc-head">
              <div>
                <h4>当前关注线束</h4>
                <p>按实际执行利润从低到高快速定位当前拖利线束。</p>
              </div>
            </div>
            <div class="workflow-doc-lines">
              ${focusRows.length ? focusRows.map((row) => `
                <div class="workflow-doc-line">
                  <span>${escapeHtml(row.harnessId || '-')} · 规则 ${fmtInt(row.rules || 0)}</span>
                  <strong>${escapeHtml(`${row.harnessName || '-'} · ${fmtMoney(row.profit || 0)} / 套 · ${fmtPct(row.margin || 0)}`)}</strong>
                </div>
              `).join('') : '<div class="workflow-empty">当前没有可用的单线束关注数据。</div>'}
            </div>
          </article>
        </aside>
      </div>
    </div>
  `.trim();
  if (el.projectProfitAnnualMount) {
    const volumeRow = evaluation.rows?.[0] || {};
    const aspRow = evaluation.rows?.[1] || {};
    const recoveryRow = evaluation.rows?.[evaluation.rows.length - 2] || {};
    const executionRow = evaluation.rows?.[evaluation.rows.length - 1] || {};
    el.projectProfitAnnualMount.innerHTML = safeArray(evaluation.years).length
      ? `
        <div class="project-annual-grid">
          ${safeArray(evaluation.years).map((year, index) => `
            <article class="project-annual-card">
              <div class="project-annual-year">${escapeHtml(String(year))}</div>
              <div class="project-annual-profit ${numberOr(executionRow.years?.[index], 0) >= 0 ? 'positive' : 'negative'}">${fmtMoney(executionRow.years?.[index] || 0)}</div>
              <div class="project-annual-meta">销量 ${fmtInt(volumeRow.years?.[index] || 0)} · ASP ${fmtMoney(aspRow.years?.[index] || 0)}</div>
              <div class="project-annual-meta">回收影响 ${fmtMoney(recoveryRow.years?.[index] || 0)}</div>
            </article>
          `).join('')}
        </div>
      `.trim()
      : '<div class="project-empty-state">当前没有年度项目评估数据。</div>';
  }
  if (el.harnessProfitMount) {
    const trackingMap = new Map(trackingRows.map((row) => [row.harnessId, row]));
    const harnessRows = safeArray(previewHarnessRows).length
      ? safeArray(previewHarnessRows).map((row) => {
        const tracking = trackingMap.get(toText(row?.harnessId, '')) || {};
        return {
          harnessId: toText(row?.harnessId, ''),
          harnessName: toText(row?.harnessName, ''),
          margin: numberOr(row?.adjusted?.margin, row?.base?.margin || 0),
          profit: numberOr(row?.adjusted?.profitPerSet, row?.base?.profitPerSet || 0),
          basis: `${fmtInt(safeArray(row?.activeRules).length)} 条规则 · 已回收 ${fmtMoney(tracking.recoveredAmount || row?.estimatedRecoveredAmount || 0)} · 待回收 ${fmtMoney(tracking.remainingAmount || 0)}`,
        };
      })
      : buildHarnessProfitRows(m).map((row) => {
        const tracking = trackingMap.get(toText(row?.harnessId, '')) || {};
        return {
          harnessId: row.harnessId,
          harnessName: row.harnessName,
          margin: numberOr(row.margin, 0),
          profit: numberOr(row.profit, 0),
          basis: `${row.basis} · 已回收 ${fmtMoney(tracking.recoveredAmount || 0)}`,
        };
      });
    if (!harnessRows.length) {
      el.harnessProfitMount.innerHTML = '<div class="project-empty-state">当前没有可展示的单线束执行利润焦点。</div>';
    } else {
      const focusHarnessRows = harnessRows
        .slice()
        .sort((left, right) => numberOr(left.profit, 0) - numberOr(right.profit, 0))
        .slice(0, 4);
      el.harnessProfitMount.innerHTML = `
        <div class="harness-focus-list">
          ${focusHarnessRows.map((row, index) => `
            <article class="harness-focus-item">
              <div class="harness-focus-rank">#${index + 1}</div>
              <div class="harness-focus-copy">
                <strong>${escapeHtml(row.harnessId || '-')}</strong>
                <span>${escapeHtml(row.harnessName || '-')}</span>
                <em>${escapeHtml(row.basis || '待补充执行依据')}</em>
              </div>
              <div class="harness-focus-metrics">
                <span class="${numberOr(row.profit, 0) >= 0 ? 'positive' : 'negative'}">${fmtMoney(row.profit || 0)}</span>
                <span class="${numberOr(row.margin, 0) >= 0 ? 'positive' : 'negative'}">${fmtPct(row.margin || 0)}</span>
              </div>
            </article>
          `).join('')}
        </div>
      `.trim();
    }
  }
}
