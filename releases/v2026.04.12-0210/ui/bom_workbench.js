;(function (global) {
  'use strict';

  const Shared = global.G281Shared || {};
  const textOf = Shared.toText || ((value, fallback) => {
    const text = String(value == null ? '' : value).trim();
    return text || (fallback == null ? '' : fallback);
  });
  const numberOf = Shared.numberOr || ((value, fallback) => {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : (fallback == null ? 0 : fallback);
  });
  const clonePlain = Shared.clonePlain || ((value, fallback) => {
    try {
      return JSON.parse(JSON.stringify(value));
    } catch (error) {
      return fallback;
    }
  });
  const safeArray = Shared.safeArray || ((value) => (Array.isArray(value) ? value : []));
  const ensureObject = Shared.ensureObject || ((value) => (value && typeof value === 'object' && !Array.isArray(value) ? value : {}));
  const createId = Shared.createId || ((prefix, suffix) => {
    const stamp = Date.now().toString(36);
    const tail = Math.random().toString(36).slice(2, 8);
    return `${prefix}-${suffix ? `${suffix}-` : ''}${stamp}-${tail}`;
  });

  const SYSTEM_SHEET_NAMES = ['变更履历', '总成散件清单', '二次物料明细', 'KSK线束BOM明细'];
  const BOM_VERSION_FALLBACKS = {
    quote: 'freeze',
    fixed: 'light',
    tt: 'regress',
  };
  const CHANGE_POLL_MS = 1800;
  const WORKBENCH_STORAGE_KEY = 'lifecycle_cost_platform.bom_workbench.v1';

  const state = {
    boot: null,
    runtime: null,
    repo: null,
    config: null,
    routeState: {},
    projectCode: '',
    projectName: '',
    baselineKey: '',
    lifecycleStageKey: '',
    returnTo: 'accounting.html',
    editor: null,
    versionEntries: [],
    currentVersionKey: '',
    currentSheetName: '',
    currentHarnessSheetName: '',
    workbookSnapshot: null,
    syncedSnapshot: null,
    sourceMeta: null,
    dirty: false,
    pendingSync: null,
    wizardState: null,
    hasStructureError: false,
    lastChangeSignature: '',
    pollTimer: 0,
  };

  const refs = {};

  function bindRefs() {
    refs.projectName = document.getElementById('bomProjectName');
    refs.projectCode = document.getElementById('bomProjectCode');
    refs.versionKeyLabel = document.getElementById('bomVersionKeyLabel');
    refs.currentHarnessLabel = document.getElementById('bomCurrentHarnessLabel');
    refs.saveStateLabel = document.getElementById('bomSaveStateLabel');
    refs.versionNameInput = document.getElementById('bomVersionNameInput');
    refs.versionSelect = document.getElementById('bomVersionSelect');
    refs.harnessSelect = document.getElementById('bomHarnessSelect');
    refs.returnButton = document.getElementById('returnAccountingButton');
    refs.saveCurrentButton = document.getElementById('saveCurrentButton');
    refs.saveAsNewButton = document.getElementById('saveAsNewButton');
    refs.undoButton = document.getElementById('undoButton');
    refs.redoButton = document.getElementById('redoButton');
    refs.filterButton = document.getElementById('filterButton');
    refs.freezeButton = document.getElementById('freezeButton');
    refs.insertRowButton = document.getElementById('insertRowButton');
    refs.insertColumnButton = document.getElementById('insertColumnButton');
    refs.mergeButton = document.getElementById('mergeButton');
    refs.jumpRelatedButton = document.getElementById('jumpRelatedButton');
    refs.status = document.getElementById('bomWorkbenchStatus');
    refs.alert = document.getElementById('bomChangeAlert');
    refs.alertTitle = document.getElementById('bomChangeAlertTitle');
    refs.alertSummary = document.getElementById('bomChangeAlertSummary');
    refs.startSyncReviewButton = document.getElementById('startSyncReviewButton');
    refs.jumpSyncReviewButton = document.getElementById('jumpSyncReviewButton');
    refs.dismissSyncAlertButton = document.getElementById('dismissSyncAlertButton');
    refs.syncSummary = document.getElementById('bomSyncSummary');
    refs.pendingMount = document.getElementById('bomPendingMount');
    refs.wizardMount = document.getElementById('bomWizardMount');
    refs.editorHost = document.getElementById('univerEditorHost');
  }

  function isUniverSnapshot(value) {
    return Boolean(value && Array.isArray(value.sheetOrder) && value.sheets && !Array.isArray(value.sheets));
  }

  function setStatus(message) {
    if (refs.status) refs.status.textContent = textOf(message, '');
  }

  function setSaveStateLabel(label) {
    if (refs.saveStateLabel) refs.saveStateLabel.textContent = textOf(label, '--');
  }

  function formatDateTime(value) {
    if (!value) return '--';
    const candidate = value instanceof Date ? value : new Date(value);
    if (!Number.isFinite(candidate.valueOf())) return textOf(value, '--');
    const year = candidate.getFullYear();
    const month = String(candidate.getMonth() + 1).padStart(2, '0');
    const date = String(candidate.getDate()).padStart(2, '0');
    const hours = String(candidate.getHours()).padStart(2, '0');
    const minutes = String(candidate.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${date} ${hours}:${minutes}`;
  }

  function persistWorkbenchState() {
    try {
      global.localStorage.setItem(WORKBENCH_STORAGE_KEY, JSON.stringify({
        currentVersionKey: state.currentVersionKey,
        currentHarnessSheetName: state.currentHarnessSheetName,
      }));
    } catch (error) {
      // Ignore storage failures in offline browser flows.
    }
  }

  function loadStoredWorkbenchState() {
    try {
      return JSON.parse(global.localStorage.getItem(WORKBENCH_STORAGE_KEY) || '{}');
    } catch (error) {
      return {};
    }
  }

  function buildDbOptions() {
    const registry = global.G281ProjectRegistry;
    if (!registry || typeof registry.getDbName !== 'function') return {};
    return {
      dbName: registry.getDbName(state.projectCode || ''),
    };
  }

  function factorRepo() {
    if (!global.G281FactorVersionRepo || typeof global.G281FactorVersionRepo.create !== 'function') {
      return null;
    }
    return global.G281FactorVersionRepo.create({
      projectCode: state.projectCode || 'PROJECT',
      db: buildDbOptions(),
    });
  }

  function toSnapshotFromWorkbookSource(workbookSource, options) {
    if (!workbookSource) return null;
    if (isUniverSnapshot(workbookSource)) {
      return clonePlain(workbookSource, null);
    }
    const helper = global.G281BomTemplateRuntime;
    if (!helper || typeof helper.convertIntermediateWorkbookToUniverSnapshot !== 'function') {
      return null;
    }
    return helper.convertIntermediateWorkbookToUniverSnapshot(workbookSource, {
      workbookName: textOf(options && options.workbookName, textOf(workbookSource.workbookName, '')),
    });
  }

  function systemSheetNames() {
    return SYSTEM_SHEET_NAMES.slice();
  }

  function getSheetRecordByName(snapshot, sheetName) {
    if (!isUniverSnapshot(snapshot) || !sheetName) return null;
    const sheetId = safeArray(snapshot.sheetOrder).find((candidate) => {
      const sheet = snapshot.sheets && snapshot.sheets[candidate];
      return textOf(sheet && sheet.name, '') === sheetName;
    });
    return sheetId ? snapshot.sheets[sheetId] : null;
  }

  function inferHarnessSheetNames(snapshot) {
    if (!isUniverSnapshot(snapshot)) return [];
    return safeArray(snapshot.sheetOrder)
      .map((sheetId) => snapshot.sheets && snapshot.sheets[sheetId])
      .filter(Boolean)
      .map((sheet) => textOf(sheet.name, ''))
      .filter((sheetName) => sheetName && systemSheetNames().indexOf(sheetName) === -1);
  }

  function currentHarnessName() {
    return textOf(state.currentHarnessSheetName || state.currentSheetName, '--');
  }

  function isHarnessSheetName(sheetName) {
    return Boolean(sheetName) && systemSheetNames().indexOf(sheetName) === -1;
  }

  function versionDisplayLabel(entry) {
    if (!entry) return '--';
    const suffix = entry.kind === 'editable' ? '工作版' : '基线';
    const updated = entry.updatedAt ? ` · ${formatDateTime(entry.updatedAt)}` : '';
    return `${textOf(entry.label, entry.key)} · ${suffix}${updated}`;
  }

  function resolveRuntimeVersionKeys() {
    const copies = ensureObject(state.runtime && state.runtime.bomWorkbookCopies);
    const versions = ensureObject(copies.versions);
    const ordered = safeArray(copies.versionOrder).filter((key) => versions[key]);
    return ordered.length ? ordered : Object.keys(versions);
  }

  function buildSeedEntries() {
    const copies = ensureObject(state.runtime && state.runtime.bomWorkbookCopies);
    const versions = ensureObject(copies.versions);
    return resolveRuntimeVersionKeys().map((key) => {
      const record = ensureObject(versions[key]);
      return {
        key,
        kind: 'seed',
        versionId: '',
        label: textOf(record.versionLabel || record.label, key),
        workbookVersionKey: key,
        workbookName: textOf(record.workbookName || record.sourceFileName || record.versionLabel, key),
        sourceLabel: textOf(record.sourceFileName, 'runtime-seed'),
        updatedAt: textOf(record.generatedAt || record.updatedAt, ''),
        userCreated: false,
        baseVersionKey: key,
      };
    });
  }

  async function buildEditableEntries() {
    const repo = factorRepo();
    if (!repo || typeof repo.listFactorVersions !== 'function') return [];
    const records = await repo.listFactorVersions({
      factorType: 'bom',
      projectCode: state.projectCode,
    });
    return safeArray(records).map((record) => ({
      key: textOf(record && record.versionId, ''),
      kind: 'editable',
      versionId: textOf(record && record.versionId, ''),
      label: textOf(record && record.versionLabel, textOf(record && record.versionId, '')),
      workbookVersionKey: textOf(record && record.meta && (record.meta.workbookVersionKeyFallback || record.meta.baseVersionKey), ''),
      workbookName: textOf(record && record.workbookName, textOf(record && record.versionLabel, '')),
      sourceLabel: textOf(record && record.sourceType, 'editable'),
      updatedAt: textOf(record && record.updatedAt, ''),
      userCreated: true,
      baseVersionKey: textOf(record && record.meta && record.meta.baseVersionKey, ''),
      meta: clonePlain(record && record.meta, {}),
    })).filter((entry) => entry.key);
  }

  function resolvePreferredVersionKey(preferredKey) {
    const availableKeys = state.versionEntries.map((entry) => entry.key);
    const stored = loadStoredWorkbenchState();
    const candidates = [
      textOf(preferredKey, ''),
      textOf(state.routeState && state.routeState.bomVersionKey, ''),
      textOf(stored.currentVersionKey, ''),
      textOf(state.routeState && state.routeState.baselineKey, ''),
    ].filter(Boolean);
    for (let index = 0; index < candidates.length; index += 1) {
      const candidate = candidates[index];
      if (availableKeys.indexOf(candidate) >= 0) return candidate;
      const fallback = BOM_VERSION_FALLBACKS[candidate];
      if (fallback && availableKeys.indexOf(fallback) >= 0) return fallback;
    }
    return availableKeys[0] || '';
  }

  async function refreshVersionEntries(preferredKey) {
    const editableEntries = await buildEditableEntries();
    const seedEntries = buildSeedEntries();
    const seen = new Set(editableEntries.map((entry) => entry.key));
    state.versionEntries = editableEntries.concat(seedEntries.filter((entry) => !seen.has(entry.key)));
    state.currentVersionKey = resolvePreferredVersionKey(preferredKey);
    renderVersionSelect();
  }

  function renderVersionSelect() {
    if (!refs.versionSelect) return;
    refs.versionSelect.innerHTML = state.versionEntries.map((entry) => (
      `<option value="${entry.key}"${entry.key === state.currentVersionKey ? ' selected' : ''}>${versionDisplayLabel(entry)}</option>`
    )).join('');
  }

  function renderHarnessSelect() {
    if (!refs.harnessSelect) return;
    const harnessNames = inferHarnessSheetNames(state.workbookSnapshot);
    const preferredHarness = textOf(
      state.currentHarnessSheetName || (loadStoredWorkbenchState().currentHarnessSheetName || ''),
      textOf(state.routeState && state.routeState.harnessSheetName, ''),
    );
    if (!state.currentHarnessSheetName || harnessNames.indexOf(state.currentHarnessSheetName) === -1) {
      state.currentHarnessSheetName = harnessNames.indexOf(preferredHarness) >= 0
        ? preferredHarness
        : (harnessNames[0] || '');
    }
    refs.harnessSelect.innerHTML = harnessNames.map((sheetName) => (
      `<option value="${sheetName}"${sheetName === state.currentHarnessSheetName ? ' selected' : ''}>${sheetName}</option>`
    )).join('');
  }

  function updateHeader() {
    const entry = state.versionEntries.find((candidate) => candidate.key === state.currentVersionKey) || null;
    if (refs.projectName) refs.projectName.textContent = textOf(state.projectName, '--');
    if (refs.projectCode) refs.projectCode.textContent = textOf(state.projectCode, '--');
    if (refs.versionKeyLabel) refs.versionKeyLabel.textContent = textOf(state.currentVersionKey, '--');
    if (refs.currentHarnessLabel) refs.currentHarnessLabel.textContent = currentHarnessName();
    if (refs.versionNameInput && !refs.versionNameInput.value) {
      refs.versionNameInput.value = textOf(entry && entry.label, state.currentVersionKey);
    }
  }

  function ensureEditor() {
    if (state.editor) return state.editor;
    if (!refs.editorHost) return null;
    if (!global.G281UniverTemplateEditor || typeof global.G281UniverTemplateEditor.create !== 'function') {
      throw new Error('未加载 Univer 编辑器资源');
    }
    refs.editorHost.innerHTML = '';
    state.editor = global.G281UniverTemplateEditor.create(refs.editorHost, {});
    return state.editor;
  }

  function getActiveSheetName() {
    const sheet = state.editor && typeof state.editor.getActiveSheet === 'function'
      ? state.editor.getActiveSheet()
      : null;
    return textOf(sheet && typeof sheet.getSheetName === 'function' ? sheet.getSheetName() : '', '');
  }

  function persistRouteState() {
    const payload = Object.assign(
      {},
      state.routeState || {},
      {
        projectId: state.projectCode,
        projectCode: state.projectCode,
        baselineKey: state.baselineKey,
        versionKey: state.baselineKey,
        lifecycleStageKey: state.lifecycleStageKey,
        bomVersionKey: state.currentVersionKey,
        harnessSheetName: state.currentHarnessSheetName || state.currentSheetName,
        returnTo: textOf(state.returnTo, 'accounting'),
      }
    );
    if (global.G281PageRouter && typeof global.G281PageRouter.saveState === 'function') {
      global.G281PageRouter.saveState(payload);
    }
    if (global.G281PageRouter && typeof global.G281PageRouter.writeUrlParams === 'function') {
      global.G281PageRouter.writeUrlParams(payload);
    }
    persistWorkbenchState();
  }

  function activateSheet(sheetName) {
    const editor = ensureEditor();
    const workbook = editor && typeof editor.getActiveWorkbook === 'function'
      ? editor.getActiveWorkbook()
      : null;
    if (!workbook || typeof workbook.getSheetBySheetName !== 'function' || typeof workbook.setActiveSheet !== 'function') {
      return false;
    }
    const target = workbook.getSheetBySheetName(sheetName);
    if (!target) return false;
    workbook.setActiveSheet(target);
    state.currentSheetName = sheetName;
    if (isHarnessSheetName(sheetName)) {
      state.currentHarnessSheetName = sheetName;
      if (refs.harnessSelect) refs.harnessSelect.value = sheetName;
    }
    updateHeader();
    persistRouteState();
    return true;
  }

  function captureSnapshot() {
    const snapshot = state.editor && typeof state.editor.saveSnapshot === 'function'
      ? state.editor.saveSnapshot()
      : null;
    if (!isUniverSnapshot(snapshot)) return null;
    state.workbookSnapshot = clonePlain(snapshot, null);
    return state.workbookSnapshot;
  }

  function loadSnapshotIntoEditor(snapshot, preferredSheetName) {
    if (!isUniverSnapshot(snapshot)) {
      throw new Error('无效的 Univer 工作簿快照');
    }
    const editor = ensureEditor();
    editor.loadTemplate({
      workbookSnapshot: clonePlain(snapshot, null),
    });
    state.workbookSnapshot = clonePlain(snapshot, null);
    renderHarnessSelect();
    updateHeader();
    const targetSheet = textOf(preferredSheetName, state.currentHarnessSheetName || inferHarnessSheetNames(snapshot)[0] || safeArray(snapshot.sheetOrder).map((sheetId) => snapshot.sheets[sheetId]).filter(Boolean).map((sheet) => textOf(sheet.name, '')).find(Boolean));
    global.setTimeout(() => {
      if (targetSheet) activateSheet(targetSheet);
    }, 0);
  }

  async function resolveSourceMeta(versionKey) {
    const entry = state.versionEntries.find((candidate) => candidate.key === versionKey) || null;
    if (!entry) {
      return { status: 'missing', error: '未找到指定的 BOM 版本。' };
    }

    if (entry.kind === 'editable') {
      const repo = factorRepo();
      if (repo && typeof repo.getSnapshotByVersionId === 'function') {
        const snapshot = await repo.getSnapshotByVersionId(entry.versionId, 'bom');
        if (isUniverSnapshot(snapshot)) {
          return Object.assign({}, entry, {
            status: 'ready',
            snapshot: clonePlain(snapshot, null),
          });
        }
      }
    }

    const versions = ensureObject(state.runtime && state.runtime.bomWorkbookCopies && state.runtime.bomWorkbookCopies.versions);
    const candidateKeys = [
      textOf(entry.workbookVersionKey, ''),
      textOf(entry.baseVersionKey, ''),
      BOM_VERSION_FALLBACKS[textOf(entry.workbookVersionKey, '')],
      BOM_VERSION_FALLBACKS[textOf(entry.baseVersionKey, '')],
      BOM_VERSION_FALLBACKS[textOf(entry.key, '')],
      textOf(entry.key, ''),
    ].filter(Boolean);

    for (let index = 0; index < candidateKeys.length; index += 1) {
      const candidateKey = candidateKeys[index];
      const workbookSource = versions[candidateKey];
      const snapshot = toSnapshotFromWorkbookSource(workbookSource, {
        workbookName: textOf(entry.workbookName, textOf(workbookSource && workbookSource.workbookName, candidateKey)),
      });
      if (isUniverSnapshot(snapshot)) {
        return Object.assign({}, entry, {
          status: 'ready',
          snapshot,
          workbookVersionKey: candidateKey,
          sourceLabel: textOf(workbookSource && workbookSource.sourceFileName, entry.sourceLabel),
        });
      }
    }

    if (global.G281BomTemplateRuntime && typeof global.G281BomTemplateRuntime.buildVersionTemplateContextWithUniver === 'function' && entry.workbookVersionKey) {
      try {
        const context = global.G281BomTemplateRuntime.buildVersionTemplateContextWithUniver({
          versionKey: entry.workbookVersionKey,
          source: state.runtime && state.runtime.bomWorkbookCopies,
        });
        if (context && isUniverSnapshot(context.workbookSnapshot)) {
          return Object.assign({}, entry, {
            status: 'ready',
            snapshot: clonePlain(context.workbookSnapshot, null),
            sourceLabel: textOf(context && context.sourceFileName, entry.sourceLabel),
          });
        }
      } catch (error) {
        console.warn('[G281BomWorkbench] Failed to build runtime BOM template snapshot', error);
      }
    }

    return Object.assign({}, entry, {
      status: 'missing',
      error: '当前 BOM 版本没有可加载的工作簿快照。',
    });
  }

  function validateWorkbookStructure(snapshot) {
    const sheetNames = isUniverSnapshot(snapshot)
      ? safeArray(snapshot.sheetOrder).map((sheetId) => textOf(snapshot.sheets && snapshot.sheets[sheetId] && snapshot.sheets[sheetId].name, '')).filter(Boolean)
      : [];
    const missing = systemSheetNames().filter((sheetName) => sheetNames.indexOf(sheetName) === -1);
    state.hasStructureError = missing.length > 0;
    return {
      missing,
      valid: missing.length === 0,
    };
  }

  function buildChangeSignature(result) {
    if (!result || !result.summary) return '';
    const summary = result.summary;
    const addedRows = safeArray(result.changes && result.changes.added).map((row) => row.rowNumber).slice(0, 5).join(',');
    const removedRows = safeArray(result.changes && result.changes.removed).map((row) => row.rowNumber).slice(0, 5).join(',');
    return [
      textOf(result.sheetName, ''),
      numberOf(summary.added, 0),
      numberOf(summary.removed, 0),
      numberOf(summary.quantityChanges, 0),
      numberOf(summary.fieldChanges, 0),
      addedRows,
      removedRows,
    ].join('|');
  }

  function fallbackPlanSummary(changeSet) {
    const summary = changeSet && changeSet.summary ? changeSet.summary : {};
    const fragments = [];
    if (summary.added) fragments.push(`新增 ${summary.added} 项`);
    if (summary.removed) fragments.push(`删除 ${summary.removed} 项`);
    if (summary.quantityChanges) fragments.push(`数量变更 ${summary.quantityChanges} 项`);
    if (summary.fieldChanges) fragments.push(`字段变更 ${summary.fieldChanges} 项`);
    return fragments.join(' / ') || '无结构变更';
  }

  function buildFallbackPlan(changeSet) {
    return {
      status: 'ready',
      changeSet,
      plannedSteps: [
        {
          phase: 'ksk',
          description: '检查 KSK线束BOM明细 中受影响的汇总明细行。',
          impacts: ['secondary', 'changeHistory'],
        },
        {
          phase: 'secondary',
          description: '检查 二次物料明细 中由 KSK 驱动的公式结果和行位。',
          impacts: ['changeHistory'],
        },
        {
          phase: 'changeHistory',
          description: '全部确认后追加一条变更履历。',
          impacts: [],
        },
      ],
      summary: changeSet && changeSet.summary ? changeSet.summary : {},
      hasChanges: Boolean(changeSet && changeSet.hasChanges),
      summaryText: fallbackPlanSummary(changeSet),
    };
  }

  function detectHarnessChanges(snapshot, harnessSheetName) {
    const detector = global.G281BomChangeDetector;
    const currentSheet = getSheetRecordByName(snapshot, harnessSheetName);
    const priorSheet = getSheetRecordByName(state.syncedSnapshot, harnessSheetName);
    if (!currentSheet) {
      return { status: 'missing', hasChanges: false, summary: { added: 0, removed: 0, quantityChanges: 0, fieldChanges: 0 } };
    }
    if (detector && typeof detector.detectChangeSet === 'function') {
      return detector.detectChangeSet({
        currentSheet,
        priorSheet,
        harnessId: harnessSheetName,
      });
    }
    return {
      status: 'ready',
      sheetName: harnessSheetName,
      harnessId: harnessSheetName,
      changes: { added: [], removed: [], quantityChanges: [], fieldChanges: [] },
      summary: { added: 0, removed: 0, quantityChanges: 0, fieldChanges: 0 },
      hasChanges: false,
    };
  }

  function buildSyncPlan(changeSet) {
    const planner = global.G281BomSyncPlanner;
    if (planner && typeof planner.planSync === 'function') {
      const plan = planner.planSync(changeSet);
      if (plan && typeof plan === 'object') {
        if (plan.hasChanges == null) {
          plan.hasChanges = Boolean(changeSet && changeSet.hasChanges);
        }
        if (!plan.summaryText) {
          plan.summaryText = fallbackPlanSummary(changeSet);
        }
        return plan;
      }
    }
    return buildFallbackPlan(changeSet);
  }

  function buildWizardState(plan) {
    const wizard = global.G281BomSyncWizard;
    let built = wizard && typeof wizard.buildWizardState === 'function'
      ? wizard.buildWizardState(plan)
      : null;
    if (!built || typeof built !== 'object') {
      built = {
        status: plan && plan.hasChanges ? 'ready' : 'idle',
        currentIndex: 0,
        steps: safeArray(plan && plan.plannedSteps).map((step) => ({
          key: step.phase,
          label: step.phase,
          description: step.description,
          impacts: step.impacts || [],
          status: 'pending',
        })),
      };
    }
    if ((built.status === 'idle' || !built.status) && safeArray(built.steps).length) {
      built.status = 'ready';
    }
    return built;
  }

  function currentWizardStep() {
    const wizard = global.G281BomSyncWizard;
    if (wizard && typeof wizard.getCurrentStep === 'function') {
      return wizard.getCurrentStep(state.wizardState);
    }
    if (!state.wizardState || state.wizardState.currentIndex == null) return null;
    return state.wizardState.steps[state.wizardState.currentIndex] || null;
  }

  function confirmWizardStep(note) {
    const wizard = global.G281BomSyncWizard;
    if (wizard && typeof wizard.confirmCurrentStep === 'function') {
      state.wizardState = wizard.confirmCurrentStep(state.wizardState, { note });
      if (state.wizardState && state.wizardState.currentIndex == null && state.wizardState.status !== 'completed') {
        state.wizardState.status = 'completed';
      }
      return;
    }
    const step = currentWizardStep();
    if (!step) return;
    step.status = 'completed';
    step.note = textOf(note, '');
    const nextIndex = safeArray(state.wizardState.steps).findIndex((candidate) => candidate.status === 'pending');
    state.wizardState.currentIndex = nextIndex >= 0 ? nextIndex : null;
    state.wizardState.status = nextIndex >= 0 ? 'ready' : 'completed';
  }

  function cancelWizard() {
    const wizard = global.G281BomSyncWizard;
    if (wizard && typeof wizard.cancelWizard === 'function') {
      state.wizardState = wizard.cancelWizard(state.wizardState, { reason: 'cancelled-by-user' });
      return;
    }
    if (state.wizardState) state.wizardState.status = 'cancelled';
  }

  function renderSyncSummary() {
    if (!refs.syncSummary) return;
    const changeSummary = state.pendingSync && state.pendingSync.changeSet ? state.pendingSync.changeSet.summary : null;
    const rows = [
      ['当前版本', textOf(state.currentVersionKey, '--')],
      ['当前线束', currentHarnessName()],
      ['结构校验', state.hasStructureError ? '缺少必要系统 Sheet' : '通过'],
      ['待同步', changeSummary ? fallbackPlanSummary({ summary: changeSummary }) : '无'],
    ];
    refs.syncSummary.innerHTML = rows.map((row) => `
      <div class="summary-item">
        <span>${row[0]}</span>
        <strong>${row[1]}</strong>
      </div>
    `).join('');
  }

  function renderPendingPanel() {
    if (!refs.pendingMount) return;
    if (!state.pendingSync || !state.pendingSync.plan || !state.pendingSync.plan.hasChanges) {
      refs.pendingMount.className = 'sidebar-empty';
      refs.pendingMount.textContent = state.hasStructureError
        ? '缺少变更履历、KSK线束BOM明细或二次物料明细等系统 Sheet，当前禁止保存。'
        : '当前没有待处理事项。';
      return;
    }
    const summary = state.pendingSync.changeSet && state.pendingSync.changeSet.summary
      ? state.pendingSync.changeSet.summary
      : {};
    const impacts = safeArray(state.pendingSync.plan && state.pendingSync.plan.plannedSteps).map((step) => step.description);
    refs.pendingMount.className = 'sidebar-stack';
    refs.pendingMount.innerHTML = `
      <div class="sidebar-key-value"><span>变更摘要</span><strong>${fallbackPlanSummary({ summary })}</strong></div>
      <div class="sidebar-key-value"><span>KSK</span><strong>${summary.added || summary.removed || summary.quantityChanges || summary.fieldChanges ? '待检查' : '无'}</strong></div>
      <div class="sidebar-key-value"><span>关联表</span><strong>${impacts.length ? 'KSK / 二次物料 / 变更履历' : '--'}</strong></div>
      <ul class="impact-list">
        ${impacts.map((description) => `<li>${description}</li>`).join('')}
      </ul>
    `;
  }

  function renderWizard() {
    if (!refs.wizardMount) return;
    if (!state.wizardState || !safeArray(state.wizardState.steps).length || state.wizardState.status === 'cancelled') {
      refs.wizardMount.className = 'sidebar-empty';
      refs.wizardMount.textContent = '改动后会在这里生成确认步骤。';
      return;
    }
    const currentStep = currentWizardStep();
    refs.wizardMount.className = 'sidebar-stack';
    refs.wizardMount.innerHTML = safeArray(state.wizardState.steps).map((step) => {
      const stepClass = [
        'sidebar-step',
        currentStep && currentStep.key === step.key ? 'is-current' : '',
        step.status === 'completed' ? 'is-done' : '',
      ].filter(Boolean).join(' ');
      return `
        <article class="${stepClass}">
          <header>
            <h3>${step.label || step.key}</h3>
            <span>${step.status || 'pending'}</span>
          </header>
          <p>${textOf(step.description, '')}</p>
          ${safeArray(step.impacts).length ? `<ul>${safeArray(step.impacts).map((impact) => `<li>${impact}</li>`).join('')}</ul>` : ''}
          ${currentStep && currentStep.key === step.key ? `
            <div class="sidebar-step-actions">
              <button type="button" data-bom-step-action="jump" data-step-key="${step.key}">跳转</button>
              <button type="button" data-bom-step-action="confirm" data-step-key="${step.key}">确认并继续</button>
              <button type="button" class="secondary" data-bom-step-action="skip" data-step-key="${step.key}">本步仅复核</button>
              <button type="button" class="ghost" data-bom-step-action="cancel" data-step-key="${step.key}">取消联动</button>
            </div>
          ` : ''}
        </article>
      `;
    }).join('');

    refs.wizardMount.querySelectorAll('[data-bom-step-action]').forEach((button) => {
      button.addEventListener('click', () => {
        const action = textOf(button.getAttribute('data-bom-step-action'), '');
        if (action === 'jump') {
          jumpToCurrentStepSheet();
          return;
        }
        if (action === 'cancel') {
          cancelWizard();
          renderAlert();
          renderPendingPanel();
          renderWizard();
          updateSaveButtons();
          setStatus('已取消严格逐表确认，当前改动仍未保存。');
          return;
        }
        const note = action === 'skip' ? 'review-only' : 'confirmed';
        confirmWizardStep(note);
        if (state.wizardState && state.wizardState.status === 'completed') {
          finalizeSyncConfirmation();
          return;
        }
        renderWizard();
        jumpToCurrentStepSheet();
        updateSaveButtons();
      });
    });
  }

  function renderAlert() {
    if (!refs.alert) return;
    if (!state.pendingSync || !state.pendingSync.plan || !state.pendingSync.plan.hasChanges) {
      refs.alert.hidden = true;
      return;
    }
    refs.alert.hidden = false;
    refs.alertTitle.textContent = `检测到 ${state.pendingSync.plan.summaryText || 'BOM 结构变更'}`;
    refs.alertSummary.textContent = '当前线束改动需同步 KSK线束BOM明细、二次物料明细，并在全部确认后自动登记到变更履历。';
  }

  function updateSaveButtons() {
    const canSave = Boolean(state.dirty) && !state.pendingSync && !state.hasStructureError && isUniverSnapshot(state.workbookSnapshot);
    if (refs.saveCurrentButton) {
      const currentEntry = state.versionEntries.find((candidate) => candidate.key === state.currentVersionKey) || null;
      refs.saveCurrentButton.disabled = !canSave || !(currentEntry && currentEntry.kind === 'editable');
    }
    if (refs.saveAsNewButton) refs.saveAsNewButton.disabled = !canSave;
    if (!state.dirty) {
      setSaveStateLabel('未修改');
      return;
    }
    if (state.pendingSync) {
      setSaveStateLabel('待联动确认');
      return;
    }
    if (state.hasStructureError) {
      setSaveStateLabel('结构异常');
      return;
    }
    setSaveStateLabel('待保存');
  }

  function syncActiveSheetState() {
    const activeSheetName = getActiveSheetName();
    if (!activeSheetName || activeSheetName === state.currentSheetName) return;
    state.currentSheetName = activeSheetName;
    if (isHarnessSheetName(activeSheetName)) {
      state.currentHarnessSheetName = activeSheetName;
    }
    renderHarnessSelect();
    updateHeader();
    persistRouteState();
  }

  function currentChangeSheetName() {
    if (isHarnessSheetName(state.currentSheetName)) {
      return state.currentSheetName;
    }
    return state.currentHarnessSheetName || inferHarnessSheetNames(state.workbookSnapshot)[0] || '';
  }

  function scheduleChangeCheck() {
    const snapshot = captureSnapshot();
    if (!snapshot || !isUniverSnapshot(state.syncedSnapshot)) return;
    const harnessSheetName = currentChangeSheetName();
    if (!harnessSheetName) return;
    const changeSet = detectHarnessChanges(snapshot, harnessSheetName);
    if (!changeSet || changeSet.status !== 'ready') return;
    const signature = buildChangeSignature(changeSet);
    if (signature === state.lastChangeSignature) return;
    state.lastChangeSignature = signature;
    if (!changeSet.hasChanges) {
      state.pendingSync = null;
      renderAlert();
      renderPendingPanel();
      renderWizard();
      updateSaveButtons();
      renderSyncSummary();
      return;
    }
    const plan = buildSyncPlan(changeSet);
    state.pendingSync = {
      snapshot,
      changeSet,
      plan,
      harnessSheetName,
    };
    state.wizardState = buildWizardState(plan);
    state.dirty = true;
    renderAlert();
    renderPendingPanel();
    renderWizard();
    updateSaveButtons();
    renderSyncSummary();
    setStatus(`检测到 ${plan.summaryText || 'BOM 结构变更'}，请先完成严格逐表确认。`);
  }

  function startPolling() {
    stopPolling();
    state.pollTimer = global.setInterval(() => {
      if (!state.editor) return;
      syncActiveSheetState();
      scheduleChangeCheck();
    }, CHANGE_POLL_MS);
  }

  function stopPolling() {
    if (state.pollTimer) {
      global.clearInterval(state.pollTimer);
      state.pollTimer = 0;
    }
  }

  function systemSheetForStep(stepKey) {
    if (stepKey === 'ksk') return 'KSK线束BOM明细';
    if (stepKey === 'secondary') return '二次物料明细';
    if (stepKey === 'changeHistory') return '变更履历';
    return state.currentHarnessSheetName;
  }

  function jumpToCurrentStepSheet() {
    const step = currentWizardStep();
    const targetSheet = systemSheetForStep(step && step.key);
    if (targetSheet) {
      activateSheet(targetSheet);
      setStatus(`已切换到 ${targetSheet}，请继续复核并确认。`);
    }
  }

  function buildHistoryEntryOptions() {
    const sourceEntry = state.versionEntries.find((candidate) => candidate.key === state.currentVersionKey) || {};
    const changeSummary = state.pendingSync && state.pendingSync.changeSet ? state.pendingSync.changeSet.summary : {};
    return {
      workbookName: textOf(refs.versionNameInput && refs.versionNameInput.value, textOf(sourceEntry.label, state.currentVersionKey)),
      packageName: textOf(refs.versionNameInput && refs.versionNameInput.value, textOf(sourceEntry.label, state.currentVersionKey)),
      harnessId: currentHarnessName(),
      harnessPartNo: currentHarnessName(),
      harnessName: currentHarnessName(),
      changeSummary,
      impacts: ['KSK线束BOM明细', '二次物料明细'],
      remark: '同步 KSK线束BOM明细、二次物料明细',
    };
  }

  function finalizeSyncConfirmation() {
    const snapshot = captureSnapshot();
    if (!snapshot) {
      setStatus('无法读取当前工作簿内容，未能完成变更履历写入。');
      return;
    }
    const historyWriter = global.G281ChangeHistoryWriter;
    const changeHistorySheet = getSheetRecordByName(snapshot, '变更履历');
    if (!changeHistorySheet || !historyWriter || typeof historyWriter.buildEntry !== 'function' || typeof historyWriter.appendEntry !== 'function') {
      setStatus('变更履历 Sheet 或履历写入模块不可用，当前无法完成联动。');
      return;
    }

    const entry = historyWriter.buildEntry(buildHistoryEntryOptions());
    const result = historyWriter.appendEntry(changeHistorySheet, entry);
    if (!result || result.status !== 'appended') {
      setStatus('变更履历追加失败，请检查模板结构。');
      return;
    }

    state.syncedSnapshot = clonePlain(snapshot, null);
    state.workbookSnapshot = clonePlain(snapshot, null);
    state.pendingSync = null;
    state.wizardState = null;
    state.dirty = true;
    state.lastChangeSignature = '';
    loadSnapshotIntoEditor(snapshot, state.currentHarnessSheetName || state.currentSheetName);
    renderAlert();
    renderPendingPanel();
    renderWizard();
    renderSyncSummary();
    updateSaveButtons();
    setStatus(`严格逐表确认完成，已在变更履历追加第 ${result.entryNumber} 条记录，当前可保存。`);
  }

  function normalizeSnapshotName(snapshot, workbookName) {
    const next = clonePlain(snapshot, null);
    if (next) {
      next.name = workbookName;
    }
    return next;
  }

  async function saveWorkbook(mode) {
    if (!state.dirty) {
      setStatus('当前没有待保存的修改。');
      return false;
    }
    if (state.pendingSync) {
      setStatus('存在未完成的严格逐表确认，当前禁止保存。');
      return false;
    }
    if (state.hasStructureError) {
      setStatus('系统 Sheet 不完整，当前禁止保存。');
      return false;
    }
    const snapshot = captureSnapshot();
    if (!snapshot) {
      setStatus('未检测到可保存的工作簿内容。');
      return false;
    }
    const repo = factorRepo();
    if (!repo || typeof repo.saveFactorVersionFromSnapshot !== 'function') {
      setStatus('本地 BOM 版本库不可用，无法保存。');
      return false;
    }

    const currentEntry = state.versionEntries.find((candidate) => candidate.key === state.currentVersionKey) || null;
    const requestedName = textOf(refs.versionNameInput && refs.versionNameInput.value, textOf(currentEntry && currentEntry.label, state.currentVersionKey));
    const shouldUpdateCurrent = mode === 'update-current' && currentEntry && currentEntry.kind === 'editable';
    const nextVersionId = shouldUpdateCurrent ? currentEntry.versionId : createId('bom-workbench', state.projectCode || 'project');
    const nextLabel = shouldUpdateCurrent ? requestedName || textOf(currentEntry && currentEntry.label, nextVersionId) : (requestedName || `BOM 工作版 ${formatDateTime(new Date())}`);
    const normalizedSnapshot = normalizeSnapshotName(snapshot, requestedName || textOf(currentEntry && currentEntry.workbookName, nextLabel));
    const result = await repo.saveFactorVersionFromSnapshot({
      factorType: 'bom',
      projectCode: state.projectCode,
      versionId: nextVersionId,
      versionLabel: nextLabel,
      workbookName: textOf(normalizedSnapshot && normalizedSnapshot.name, nextLabel),
      sourceType: shouldUpdateCurrent ? 'bom-workbench-update' : 'bom-workbench-save-as',
      status: 'active',
      workbookSnapshot: normalizedSnapshot,
      meta: {
        userCreated: true,
        baseVersionKey: textOf(currentEntry && currentEntry.baseVersionKey, state.baselineKey),
        workbookVersionKeyFallback: textOf(currentEntry && currentEntry.workbookVersionKey, state.baselineKey),
        sourceVersionKey: textOf(state.currentVersionKey, ''),
        sourceLabel: textOf(currentEntry && currentEntry.sourceLabel, ''),
        harnessSheetName: currentHarnessName(),
      },
    });

    state.syncedSnapshot = clonePlain(normalizedSnapshot, null);
    state.workbookSnapshot = clonePlain(normalizedSnapshot, null);
    state.dirty = false;
    state.pendingSync = null;
    state.wizardState = null;
    state.lastChangeSignature = '';
    await refreshVersionEntries(textOf(result && result.versionId, nextVersionId));
    state.currentVersionKey = textOf(result && result.versionId, nextVersionId);
    refs.versionNameInput.value = nextLabel;
    renderHarnessSelect();
    updateHeader();
    renderAlert();
    renderPendingPanel();
    renderWizard();
    renderSyncSummary();
    updateSaveButtons();
    persistRouteState();
    setStatus(`已保存 BOM 工作版本：${nextLabel}`);
    return true;
  }

  function executeEditorAction(action) {
    if (!state.editor) return false;
    if (action === 'undo' || action === 'redo') {
      const host = refs.editorHost;
      if (!host) return false;
      host.focus();
      host.dispatchEvent(new KeyboardEvent('keydown', {
        key: action === 'undo' ? 'z' : 'y',
        ctrlKey: true,
        bubbles: true,
      }));
      state.dirty = true;
      updateSaveButtons();
      setStatus(action === 'undo' ? '已发送撤销快捷键。' : '已发送重做快捷键。');
      return true;
    }
    if (action === 'filter') {
      const success = Boolean(state.editor.toggleFilter && state.editor.toggleFilter());
      if (success) setStatus('已切换筛选器。');
      return success;
    }
    if (action === 'insert-row') {
      const success = Boolean(state.editor.insertRowsAfterSelection && state.editor.insertRowsAfterSelection(1));
      if (success) {
        state.dirty = true;
        updateSaveButtons();
        setStatus('已在当前选区后插入 1 行。');
      }
      return success;
    }
    if (action === 'insert-column') {
      const success = Boolean(state.editor.insertColumnsAfterSelection && state.editor.insertColumnsAfterSelection(1));
      if (success) {
        state.dirty = true;
        updateSaveButtons();
        setStatus('已在当前选区后插入 1 列。');
      }
      return success;
    }
    if (action === 'merge') {
      const success = Boolean(state.editor.mergeSelection && state.editor.mergeSelection());
      if (success) {
        state.dirty = true;
        updateSaveButtons();
        setStatus('已合并当前选区。');
      }
      return success;
    }
    if (action === 'freeze') {
      const sheet = state.editor.getActiveSheet && state.editor.getActiveSheet();
      const range = state.editor.getActiveRange && state.editor.getActiveRange();
      if (!sheet || !range) return false;
      const startRow = numberOf(range.getRow && range.getRow(), 0);
      const startColumn = numberOf(range.getColumn && range.getColumn(), 0);
      if (typeof sheet.setFrozenRows === 'function') sheet.setFrozenRows(startRow);
      if (typeof sheet.setFrozenColumns === 'function') sheet.setFrozenColumns(startColumn);
      state.dirty = true;
      updateSaveButtons();
      setStatus('已按当前选区更新冻结窗格。');
      return true;
    }
    return false;
  }

  async function loadVersion(versionKey, preferredSheetName) {
    if (state.dirty || state.pendingSync) {
      setStatus('当前存在未保存或未确认的改动，请先完成保存后再切换版本。');
      renderVersionSelect();
      return false;
    }
    setStatus('正在加载 BOM 工作版本...');
    const sourceMeta = await resolveSourceMeta(versionKey);
    if (!sourceMeta || sourceMeta.status !== 'ready' || !isUniverSnapshot(sourceMeta.snapshot)) {
      setStatus(textOf(sourceMeta && sourceMeta.error, '当前版本没有可加载的工作簿。'));
      return false;
    }
    state.currentVersionKey = sourceMeta.key || versionKey;
    state.sourceMeta = sourceMeta;
    state.syncedSnapshot = clonePlain(sourceMeta.snapshot, null);
    state.workbookSnapshot = clonePlain(sourceMeta.snapshot, null);
    state.dirty = false;
    state.pendingSync = null;
    state.wizardState = null;
    state.lastChangeSignature = '';
    validateWorkbookStructure(sourceMeta.snapshot);
    if (refs.versionNameInput) {
      refs.versionNameInput.value = textOf(sourceMeta.label, state.currentVersionKey);
    }
    loadSnapshotIntoEditor(sourceMeta.snapshot, preferredSheetName || textOf(state.routeState && state.routeState.harnessSheetName, ''));
    renderAlert();
    renderPendingPanel();
    renderWizard();
    renderSyncSummary();
    updateHeader();
    updateSaveButtons();
    persistRouteState();
    setStatus(`已打开 ${textOf(sourceMeta.label, state.currentVersionKey)}${state.currentHarnessSheetName ? ` · ${state.currentHarnessSheetName}` : ''}`);
    return true;
  }

  function wireEvents() {
    refs.versionSelect && refs.versionSelect.addEventListener('change', async () => {
      const nextVersionKey = textOf(refs.versionSelect.value, '');
      if (!nextVersionKey || nextVersionKey === state.currentVersionKey) return;
      await loadVersion(nextVersionKey, '');
    });

    refs.harnessSelect && refs.harnessSelect.addEventListener('change', () => {
      const nextSheetName = textOf(refs.harnessSelect.value, '');
      if (!nextSheetName) return;
      state.currentHarnessSheetName = nextSheetName;
      activateSheet(nextSheetName);
    });

    refs.returnButton && refs.returnButton.addEventListener('click', () => {
      if (state.dirty || state.pendingSync) {
        setStatus('当前有未保存改动，请先保存后再返回核算页。');
        return;
      }
      const nextState = Object.assign({}, state.routeState || {}, {
        projectId: state.projectCode,
        projectCode: state.projectCode,
        baselineKey: state.baselineKey,
        versionKey: state.baselineKey,
        lifecycleStageKey: state.lifecycleStageKey,
        bomVersionKey: state.currentVersionKey,
        harnessSheetName: state.currentHarnessSheetName || state.currentSheetName,
        sourcePage: 'bom_workbench',
      });
      const pageFile = textOf(state.returnTo, 'accounting').replace(/\.html$/i, '') + '.html';
      if (global.G281PageRouter && typeof global.G281PageRouter.navigateTo === 'function') {
        global.G281PageRouter.navigateTo(pageFile, nextState);
        return;
      }
      global.location.href = pageFile;
    });

    refs.saveCurrentButton && refs.saveCurrentButton.addEventListener('click', () => {
      void saveWorkbook('update-current');
    });
    refs.saveAsNewButton && refs.saveAsNewButton.addEventListener('click', () => {
      void saveWorkbook('save-as-new');
    });
    refs.undoButton && refs.undoButton.addEventListener('click', () => {
      executeEditorAction('undo');
    });
    refs.redoButton && refs.redoButton.addEventListener('click', () => {
      executeEditorAction('redo');
    });
    refs.filterButton && refs.filterButton.addEventListener('click', () => {
      executeEditorAction('filter');
    });
    refs.freezeButton && refs.freezeButton.addEventListener('click', () => {
      executeEditorAction('freeze');
    });
    refs.insertRowButton && refs.insertRowButton.addEventListener('click', () => {
      executeEditorAction('insert-row');
    });
    refs.insertColumnButton && refs.insertColumnButton.addEventListener('click', () => {
      executeEditorAction('insert-column');
    });
    refs.mergeButton && refs.mergeButton.addEventListener('click', () => {
      executeEditorAction('merge');
    });
    refs.jumpRelatedButton && refs.jumpRelatedButton.addEventListener('click', () => {
      if (state.pendingSync) {
        jumpToCurrentStepSheet();
        return;
      }
      const fallbackSheet = getActiveSheetName() === 'KSK线束BOM明细' ? '二次物料明细' : 'KSK线束BOM明细';
      activateSheet(fallbackSheet);
    });

    refs.startSyncReviewButton && refs.startSyncReviewButton.addEventListener('click', () => {
      if (!state.pendingSync) return;
      if (!state.wizardState || state.wizardState.status === 'cancelled' || !safeArray(state.wizardState.steps).length) {
        state.wizardState = buildWizardState(state.pendingSync.plan);
      }
      renderWizard();
      jumpToCurrentStepSheet();
    });

    refs.jumpSyncReviewButton && refs.jumpSyncReviewButton.addEventListener('click', () => {
      jumpToCurrentStepSheet();
    });

    refs.dismissSyncAlertButton && refs.dismissSyncAlertButton.addEventListener('click', () => {
      refs.alert.hidden = true;
    });

    refs.versionNameInput && refs.versionNameInput.addEventListener('input', () => {
      if (!state.sourceMeta) return;
      state.dirty = true;
      updateSaveButtons();
      renderSyncSummary();
    });

    global.addEventListener('beforeunload', (event) => {
      if (!state.dirty && !state.pendingSync) return;
      event.preventDefault();
      event.returnValue = '';
    });
  }

  async function bootstrap() {
    bindRefs();
    if (!refs.editorHost) {
      throw new Error('未找到 BOM 工作台挂载节点');
    }

    const boot = global.G281ProjectBootstrap
      ? await global.G281ProjectBootstrap.resolve({ requireActiveProject: false })
      : {
          runtime: global.G281_RUNTIME || {},
          repo: global.G281Repo && typeof global.G281Repo.init === 'function' ? global.G281Repo.init(global.G281_RUNTIME || {}) : null,
          config: global.ConfigLoader && typeof global.ConfigLoader.loadProjectConfig === 'function'
            ? await global.ConfigLoader.loadProjectConfig({ runtime: global.G281_RUNTIME || {} })
            : null,
        };

    state.boot = boot;
    state.runtime = boot.runtime || global.G281_RUNTIME || {};
    state.repo = boot.repo || (global.G281Repo && typeof global.G281Repo.init === 'function' ? global.G281Repo.init(state.runtime) : null);
    state.config = boot.config || (global.ConfigLoader && typeof global.ConfigLoader.active === 'function' ? global.ConfigLoader.active() : null);
    state.routeState = global.G281ProjectBootstrap && typeof global.G281ProjectBootstrap.normalizeRouteState === 'function'
      ? global.G281ProjectBootstrap.normalizeRouteState(global.G281PageRouter && typeof global.G281PageRouter.resolveState === 'function' ? global.G281PageRouter.resolveState() : {})
      : (global.G281PageRouter && typeof global.G281PageRouter.resolveState === 'function' ? global.G281PageRouter.resolveState() : {});
    state.projectCode = textOf(state.config && (state.config.projectCode || state.config.projectId), textOf(boot && boot.projectCode, 'PROJECT'));
    state.projectName = textOf(state.config && state.config.projectName, state.projectCode);
    state.baselineKey = textOf(state.routeState && (state.routeState.baselineKey || state.routeState.versionKey), 'quote');
    state.lifecycleStageKey = textOf(state.routeState && (state.routeState.lifecycleStageKey || state.routeState.stageKey), state.baselineKey);
    state.returnTo = textOf(state.routeState && state.routeState.returnTo, 'accounting');

    if (global.G281ProjectBootstrap && typeof global.G281ProjectBootstrap.mountPageChrome === 'function') {
      global.G281ProjectBootstrap.mountPageChrome({ config: state.config });
    } else if (global.G281Nav && typeof global.G281Nav.mountNavBar === 'function') {
      global.G281Nav.mountNavBar(state.projectName);
    }

    await refreshVersionEntries(textOf(state.routeState && state.routeState.bomVersionKey, state.baselineKey));
    wireEvents();
    await loadVersion(state.currentVersionKey, textOf(state.routeState && state.routeState.harnessSheetName, ''));
    startPolling();
    return {
      projectCode: state.projectCode,
      currentVersionKey: state.currentVersionKey,
    };
  }

  global.G281BomWorkbench = {
    bootstrap,
    getStateSnapshot: () => clonePlain(state, null),
    activateSheet,
    saveWorkbook,
  };
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this);
