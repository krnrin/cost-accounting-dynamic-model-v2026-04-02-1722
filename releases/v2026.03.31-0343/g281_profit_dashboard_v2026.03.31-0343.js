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
const DEFAULT_STATE = { bom: 'freeze', metal: 'quote', connector: 'batch', labor: 'base', equipment: 'base', packaging: 'base', configSheet: DEFAULT_CONFIG_SHEET_KEY, sales: 'quote', mix: 'quote', annualDrop: 'quote', oneTimeCustomer: 'quote', rebate: 'quote', vave: 'none' };
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
const state = { scenarioName: BASE.name, ...DEFAULT_STATE };
let connectorPricingState = {};
const metalVersionLocks = {};

function ensureDashboardUiScaffold() {
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

    let managementGrid = document.getElementById('managementTopGrid') || main.querySelector('.management-top-grid');
    if (!managementGrid) {
      managementGrid = document.createElement('section');
      managementGrid.className = 'management-top-grid';
      managementGrid.innerHTML = `
        <section class="hero hero-block">
          <div class="hero-block-head">
            <div>
              <h3>场景管理</h3>
              <p class="section-note">支持各成本要素自由组合生成场景并保存。</p>
            </div>
          </div>
          <div id="sceneManagementMount"></div>
          <div class="toolbar scene-toolbar" id="sceneToolbar"></div>
        </section>
        <section class="hero hero-block">
          <div class="hero-block-head">
            <div>
              <h3>数据管理</h3>
              <p class="section-note">支持 BOM、资源投入、工时、包装物流、工厂效率运营费用等模块的数据修改和多版本对比。</p>
            </div>
          </div>
          <div id="dataToolbarExtraMount" class="data-toolbar-extra"></div>
          <div class="toolbar data-toolbar" id="dataToolbar"></div>
        </section>
      `.trim();
      const insertBeforeNode = heroSection || main.children[1] || null;
      main.insertBefore(managementGrid, insertBeforeNode);
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
    const managementHeads = managementGrid.querySelectorAll('.hero-block-head');
    const sceneHead = managementHeads[0];
    const dataHead = managementHeads[1];
    if (sceneHead) {
      const title = sceneHead.querySelector('h3');
      const note = sceneHead.querySelector('.section-note');
      if (title) title.textContent = '场景管理';
      if (note) note.textContent = '支持各成本要素自由组合生成场景并保存。';
    }
    if (dataHead) {
      const title = dataHead.querySelector('h3');
      const note = dataHead.querySelector('.section-note');
      if (title) title.textContent = '数据管理';
      if (note) note.textContent = '支持 BOM、资源投入、工时、包装物流、工厂效率运营费用等模块的数据修改和多版本对比。';
    }

    sceneHead?.querySelector('h3')?.replaceChildren('场景管理');
    sceneHead?.querySelector('.section-note')?.replaceChildren('支持各成本要素自由组合生成场景并保存。');
    dataHead?.querySelector('h3')?.replaceChildren('数据管理');
    dataHead?.querySelector('.section-note')?.replaceChildren('支持 BOM、资源投入、工时、包装物流、工厂效率运营费用等模块的数据修改和多版本对比。');

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
      ['openBomValidationBtn', 'openConfigSheetManagerBtn', 'openCapitalValidationBtn', 'openLaborValidationBtn', 'openPackagingValidationBtn', 'openAnnualDropManagerBtn', 'openOneTimeCustomerManagerBtn', 'openRebateManagerBtn', 'openFactoryEfficiencyBtn'].forEach((id) => {
        const node = document.getElementById(id);
        if (node && dataToolbar && !dataToolbar.contains(node)) {
          dataToolbar.appendChild(node);
        }
      });
      const exportButton = document.getElementById('exportLayerBtn');
      if (exportButton && dataToolbar && !dataToolbar.contains(exportButton)) {
        dataToolbar.appendChild(exportButton);
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
  harnessProfitTable: $('harnessProfitTable'),
  wireProfitTable: $('wireProfitTable'),
  costBridge: $('costBridge'),
  annualChart: $('annualChart'),
  compareTable: document.querySelector('#compareTable tbody'),
  annualTable: document.querySelector('#annualTable tbody'),
  eventTable: document.querySelector('#eventTable tbody'),
  capitalLedger: $('capitalLedger'),
  activeSummary: $('activeSummary'),
  scenarioTags: $('scenarioTags'),
  versionTimelineDrawer: $('versionTimelineDrawer'),
  closeVersionTimelineBtn: $('closeVersionTimelineBtn'),
  versionTimelineMount: $('versionTimelineMount'),
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
  const recommendedStage = summary?.recommendedStage || recommendedConnectorStage(summary) || 'sample';
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

  const existingReleaseId = toText(option.semanticReleaseId, '');
  if (existingReleaseId && !options.forceRefresh) {
    try {
      const existingGraph = await bomSemanticRepo.getBomReleaseGraph(existingReleaseId);
      const existingMeta = existingGraph?.release?.meta || {};
      const isStaleSeedRelease = !option.userCreated
        && resolveWorkbookVersionKeyFromBomState(bomKey)
        && Number(existingMeta.harnessCount || 0) <= 0;
      if (existingGraph?.release && !isStaleSeedRelease) {
        return {
          releaseId: existingReleaseId,
          release: existingGraph.release,
          summary: clonePlain(option.semanticSummary, null),
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
    return semanticRecord;
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
  return compareBomSemanticReleases(leftRecord.releaseId, rightRecord.releaseId, {
    ...options,
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
      pasteHint: '支持整列粘贴执行档位；建议填写 批量价 / 协议价 / 进度价 / 样品价，也支持继续在右侧 Excel 区补充内容。',
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
    const workbookSnapshot = storedTemplateState.workbookSnapshot || buildLifecycleWorkbookSnapshotFromSeed(workbookSeed, '????');
    return finalizeVersionTemplateContext({
      group,
      activeKey,
      activeLabel,
      eyebrow: '????',
      title: '??????',
      subtitle: `???? ${activeLabel}?????? Excel ?????????????? ASP ????????????????????`,
      pasteHint: '?? Excel ???????? / ??? / ??ASP?? / ????????????????',
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
    const workbookSnapshot = storedTemplateState.workbookSnapshot || buildLifecycleWorkbookSnapshotFromSeed(workbookSeed, '???????');
    return finalizeVersionTemplateContext({
      group,
      activeKey,
      activeLabel,
      eyebrow: '???????',
      title: '???????(????)??',
      subtitle: `???? ${activeLabel}????????? Excel ??????????? / ????????????????????????? Sheet?`,
      pasteHint: '?? Excel ???????? / ?? / ?? / ???? / ????? / ???? / ??????????????',
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
    const workbookSnapshot = storedTemplateState.workbookSnapshot || buildLifecycleWorkbookSnapshotFromSeed(workbookSeed, '????');
    return finalizeVersionTemplateContext({
      group,
      activeKey,
      activeLabel,
      eyebrow: '????',
      title: '??????',
      subtitle: `???? ${activeLabel}?????? Excel ???????????????????????????????`,
      pasteHint: '?? Excel ???????? / ?????? / ????????????????',
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
    return `${sourceText}????????${annualDropSnapshotSummary({ yearRows })}${noteText}`.trim();
  }
  if (group === 'oneTimeCustomer') {
    const fallbackEntries = Array.isArray(context?.entries) ? context.entries : oneTimeCustomerVersionSnapshot(context?.activeKey).entries;
    const entries = workbookSnapshot
      ? parseOneTimeCustomerWorkbookEntries(workbookSnapshot, fallbackEntries, values?.amountTotal)
      : normalizeOneTimeCustomerEntries(fallbackEntries, lifecycleTemplateYears(), values?.amountTotal);
    return `${sourceText}???????????${oneTimeCustomerSnapshotSummary({ entries })}${noteText}`.trim();
  }
  if (group === 'rebate') {
    const fallbackRows = Array.isArray(context?.yearRows) ? context.yearRows : rebateVersionSnapshot(context?.activeKey).yearRows;
    const yearRows = workbookSnapshot
      ? parseRebateWorkbookRows(workbookSnapshot, fallbackRows, values?.amountPerSet)
      : normalizeRebateYearRows(fallbackRows, lifecycleTemplateYears(), lifecycleTemplateVolumes(), values?.amountPerSet);
    return `${sourceText}????????${rebateSnapshotSummary({ yearRows })}${noteText}`.trim();
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
      note: '?????????????? ASP ?????',
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
      note: '????????????????????????',
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
      note: '???????????????????',
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
      sourceNote: payload.sourceNote || `?????????????${currentLabel}?${annualDropSnapshotSummary({ yearRows })}?`,
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
      sourceNote: payload.sourceNote || `?????????????${currentLabel}?${oneTimeCustomerSnapshotSummary({ entries })}?`,
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
      sourceNote: payload.sourceNote || `?????????????${currentLabel}?${rebateSnapshotSummary({ yearRows })}?`,
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
  const note = '初始化规则：同一聚合连接器下全部映射项已达成时切协议价；若已有部分达成则切进度价；若仍全部未达成，则先按样品价。下方明细按 Excel 平铺展示，初始报价直接取自当前导入报价核算表的“二次物料明细”，未匹配到对应总成时留空。';
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

function renderDataManagementOverview(m) {
  if (!el.dataToolbarExtraMount) return;
  syncManagementButtonLabels();
  syncManagementButtonLabel(document.getElementById('openBomValidationBtn'), 'BOM 管理');
  syncManagementButtonLabel(document.getElementById('openCapitalValidationBtn'), '资源投入管理');
  syncManagementButtonLabel(document.getElementById('openLaborValidationBtn'), '工时管理');
  syncManagementButtonLabel(document.getElementById('openPackagingValidationBtn'), '包装物流管理');
  syncManagementButtonLabel(document.getElementById('openAnnualDropManagerBtn'), '年降管理');
  syncManagementButtonLabel(document.getElementById('openOneTimeCustomerManagerBtn'), '一次性费用管理');
  syncManagementButtonLabel(document.getElementById('openRebateManagerBtn'), '返点管理');
  syncManagementButtonLabel(document.getElementById('openFactoryEfficiencyBtn'), '工厂效率 / 运营费率');
  const cards = [
    {
      title: 'BOM 管理',
      state: m?.bom?.label || versionOptionLabel('bom', state.bom),
      meta: bomVersionSourceText(state.bom),
    },
    {
      title: '资源投入管理',
      state: m?.equip?.label || versionOptionLabel('equipment', state.equipment),
      meta: equipmentVersionSourceText(state.equipment),
    },
    {
      title: '工时管理',
      state: m?.labor?.label || versionOptionLabel('labor', state.labor),
      meta: laborVersionSourceText(state.labor),
    },
    {
      title: '包装物流管理',
      state: m?.pack?.label || versionOptionLabel('packaging', state.packaging),
      meta: packagingVersionSourceText(state.packaging),
    },
    {
      title: '工厂效率 / 运营费率',
      state: Number.isFinite(Number(m?.operating)) ? `${fmtMoney(m.operating)} 元/套` : '可编辑 / 可对比',
      meta: `当前工时 ${versionOptionLabel('labor', state.labor)} / 资源投入 ${versionOptionLabel('equipment', state.equipment)}`,
    },
  ];
  [
    'BOM 管理',
    '资源投入管理',
    '工时管理',
    '包装物流管理',
    '工厂效率 / 运营费率',
  ].forEach((title, index) => {
    if (cards[index]) cards[index].title = title;
  });
  el.dataToolbarExtraMount.innerHTML = cards.map((card) => `
    <article class="data-module-card">
      <div class="data-module-card-title">${escapeHtml(card.title)}</div>
      <div class="data-module-card-state"><span class="stat-pill"><strong>${escapeHtml(card.state || '-')}</strong></span></div>
      <div class="data-module-card-meta">${escapeHtml(card.meta || '')}</div>
    </article>
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

function renderDataManagementOverview(m) {
  if (!el.dataToolbarExtraMount) return;
  syncManagementButtonLabels();
  syncManagementButtonLabel(document.getElementById('openBomValidationBtn'), 'BOM \u7ba1\u7406');
  syncManagementButtonLabel(document.getElementById('openConfigSheetManagerBtn'), '配置清单管理');
  syncManagementButtonLabel(document.getElementById('openCapitalValidationBtn'), '\u8d44\u6e90\u6295\u5165\u7ba1\u7406');
  syncManagementButtonLabel(document.getElementById('openLaborValidationBtn'), '\u5de5\u65f6\u7ba1\u7406');
  syncManagementButtonLabel(document.getElementById('openPackagingValidationBtn'), '\u5305\u88c5\u7269\u6d41\u7ba1\u7406');
  syncManagementButtonLabel(document.getElementById('openAnnualDropManagerBtn'), '\u5e74\u964d\u7ba1\u7406');
  syncManagementButtonLabel(document.getElementById('openOneTimeCustomerManagerBtn'), '\u4e00\u6b21\u6027\u8d39\u7528\u7ba1\u7406');
  syncManagementButtonLabel(document.getElementById('openRebateManagerBtn'), '\u8fd4\u70b9\u7ba1\u7406');
  syncManagementButtonLabel(document.getElementById('openFactoryEfficiencyBtn'), '\u5de5\u5382\u6548\u7387 / \u8fd0\u8425\u8d39\u7387');
  const cards = [
    {
      title: 'BOM \u7ba1\u7406',
      state: m?.bom?.label || versionOptionLabel('bom', state.bom),
      meta: bomVersionSourceText(state.bom),
    },
    {
      title: '配置清单管理',
      state: versionOptionLabel('configSheet', state.configSheet),
      meta: configSheetVersionSourceText(state.configSheet),
    },
    {
      title: '\u8d44\u6e90\u6295\u5165\u7ba1\u7406',
      state: m?.equip?.label || versionOptionLabel('equipment', state.equipment),
      meta: equipmentVersionSourceText(state.equipment),
    },
    {
      title: '\u5de5\u65f6\u7ba1\u7406',
      state: m?.labor?.label || versionOptionLabel('labor', state.labor),
      meta: laborVersionSourceText(state.labor),
    },
    {
      title: '\u5305\u88c5\u7269\u6d41\u7ba1\u7406',
      state: m?.pack?.label || versionOptionLabel('packaging', state.packaging),
      meta: packagingVersionSourceText(state.packaging),
    },
    {
      title: '\u94dc\u94dd\u57fa\u4ef7\u7ba1\u7406',
      state: m?.metal?.label || versionOptionLabel('metal', state.metal),
      meta: `\u94dc ${fmtMoney(m?.d?.copperPrice || 0, 0)} \u5143/\u5428 / \u94dd ${fmtMoney(m?.d?.aluminumPrice || 0, 0)} \u5143/\u5428`,
    },
    {
      title: '\u8fde\u63a5\u5668\u4ef7\u683c\u7ba1\u7406',
      state: m?.conn?.label || versionOptionLabel('connector', state.connector),
      meta: `\u8986\u76d6 ${m?.connectorSummary?.overrideCount || 0} \u9879 / \u5f53\u524d ${fmtMoney(m?.connectorSummary?.totalCurrentCost || 0)} \u5143/\u5957`,
    },
    {
      title: '\u5e74\u964d\u7ba1\u7406',
      state: m?.annualDrop?.label || versionOptionLabel('annualDrop', state.annualDrop),
      meta: annualDropSnapshotSummary(m?.annualDrop),
    },
    {
      title: '\u4e00\u6b21\u6027\u8d39\u7528\u7ba1\u7406',
      state: m?.oneTimeCustomer?.label || versionOptionLabel('oneTimeCustomer', state.oneTimeCustomer),
      meta: oneTimeCustomerSnapshotSummary(m?.oneTimeCustomer),
    },
    {
      title: '\u8fd4\u70b9\u7ba1\u7406',
      state: m?.rebate?.label || versionOptionLabel('rebate', state.rebate),
      meta: rebateSnapshotSummary(m?.rebate),
    },
    {
      title: '\u5de5\u5382\u6548\u7387 / \u8fd0\u8425\u8d39\u7387',
      state: Number.isFinite(Number(m?.operating)) ? `${fmtMoney(m.operating)} \u5143/\u5957` : '\u53ef\u7f16\u8f91 / \u53ef\u5bf9\u6bd4',
      meta: `\u5f53\u524d\u5de5\u65f6 ${versionOptionLabel('labor', state.labor)} / \u8d44\u6e90\u6295\u5165 ${versionOptionLabel('equipment', state.equipment)}`,
    },
  ];
  el.dataToolbarExtraMount.innerHTML = cards.map((card) => `
    <article class="data-module-card">
      <div class="data-module-card-title">${escapeHtml(card.title)}</div>
      <div class="data-module-card-state"><span class="stat-pill"><strong>${escapeHtml(card.state || '-')}</strong></span></div>
      <div class="data-module-card-meta">${escapeHtml(card.meta || '')}</div>
    </article>
  `).join('');
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

function renderHarnessProfitV2(m) {
  if (!el.harnessProfitSummary || !el.harnessProfitNote || !el.harnessProfitTable) return;

  if (el.wireProfitTable) {
    const wireTableWrap = el.wireProfitTable.closest('.table-wrap');
    const wireHeadingBlock = wireTableWrap?.previousElementSibling;
    if (wireHeadingBlock) wireHeadingBlock.hidden = true;
    if (wireTableWrap) wireTableWrap.hidden = true;
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
  el.scenarioName.value=m.d.scenarioName; renderScenarioHistorySelect(); renderTags(m); renderVersionTimeline(); renderSummary(m); renderDataManagementOverview(m); renderKPIs(m); renderProfitDrivers(m); renderHarnessProfitV2(m); renderWireCatalog(m); renderBomAnalysis(m); renderConnectorPricing(m); renderArchitecture(m); renderCostBridge(m); renderAnnualChart(m); renderConfigBars(m); renderEventTable(m); renderCompare(m); renderCapital(m); renderAnnualTable(m); renderProfitInsights(m); if (factoryEfficiencyView && el.factoryEfficiencyModal && !el.factoryEfficiencyModal.hidden) { factoryEfficiencyView.render(buildFactoryEfficiencyPayload(m)); } clearDirty();
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

function setupProfitHomepage() {
  if (el.profitActionBar) {
    el.profitActionBar.innerHTML = '';
  }
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
    if (group === 'connector') {
      const connectorSourceKey = BASE.versions?.connector?.[state.connector]?.sourceKey || state.connector;
      const overrideCount = connectorOverrideCount(connectorPricingState, connectorSourceKey);
      note.textContent = `默认执行档位：${options[state[group]].label}。${options[state[group]].note} 当前已单独指定 ${overrideCount} 个连接器。`;
      return;
    }
    if (group === 'sales') {
      const salesStats = salesVersionStats(state.sales);
      note.textContent = `${options[state[group]].note} 生命周期 ${fmtInt(salesStats.total)} 套，首年 ${fmtInt(salesStats.firstYear)} 套。`;
      return;
    }
    if (group === 'metal') {
      renderMetalVersionEditor();
      const lockText = metalVersionLocks[state[group]] !== false ? '当前版本已锁定。' : '当前版本编辑中。';
      note.textContent = `${options[state[group]].note} ${metalVersionSourceText(state[group])} ${lockText}`.trim();
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
    if (group === 'configSheet') {
      note.textContent = `${options[state[group]].note} ${configSheetVersionSourceText(state[group])}`.trim();
      return;
    }
    if (group === 'annualDrop') {
      note.textContent = `${options[state[group]].note} ${annualDropVersionSourceText(state[group])}`.trim();
      return;
    }
    if (group === 'oneTimeCustomer') {
      note.textContent = `${options[state[group]].note} ${oneTimeCustomerVersionSourceText(state[group])}`.trim();
      return;
    }
    if (group === 'rebate') {
      note.textContent = `${options[state[group]].note} ${rebateVersionSourceText(state[group])}`.trim();
      return;
    }
    note.textContent = options[state[group]].note;
  });
  renderVersionTimeline();
}

el.sheets.textContent=`${BASE.sheetCount} sheets parsed`; el.faults.textContent=`${BASE.faultCount} formula faults`; el.priceTypes.textContent=`${BASE.priceTypeCount} price types`; bind();
