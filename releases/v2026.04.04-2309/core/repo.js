(function (global) {
  'use strict';

  const Shared = global.G281Shared || {};
  const safeArray = Shared.safeArray || ((value) => (Array.isArray(value) ? value : []));
  const clonePlain = Shared.clonePlain || ((value, fallback) => {
    try {
      return JSON.parse(JSON.stringify(value));
    } catch (error) {
      return fallback;
    }
  });
  const toText = Shared.toText || ((value, fallback) => {
    const text = String(value == null ? '' : value).trim();
    return text || (fallback == null ? '' : fallback);
  });

  const STORAGE_SUFFIX = {
    history: 'history.extra',
    approvals: 'approvals.extra',
    artifactPublish: 'artifact.publish.v1',
    exceptionActions: 'exception.actions.v1',
    exportPackages: 'export.packages.v1',
    exportPackagesRegistry: 'export.packages.registry.v1',
  };

  const memoryStorage = {
    history: [],
    approvals: [],
    artifactPublish: [],
    exceptionActions: [],
    exportPackages: [],
    exportPackagesRegistry: [],
  };

  const hasLocalStorage = (() => {
    try {
      return typeof global.localStorage !== 'undefined';
    } catch (error) {
      return false;
    }
  })();

  let activeRepo = null;

  function safeParse(value, fallback) {
    if (!value) return fallback;
    try {
      return JSON.parse(value);
    } catch (error) {
      return fallback;
    }
  }

  function resolveRuntime(candidate) {
    if (candidate && candidate.master) return candidate;
    if (candidate && candidate.runtime && candidate.runtime.master) return candidate.runtime;
    if (candidate && typeof candidate.getRuntime === 'function') {
      const runtime = candidate.getRuntime();
      if (runtime && runtime.master) return runtime;
    }
    return global.G281_RUNTIME || {};
  }

  function projectKeyPrefix(runtime) {
    const configPrefix = toText(global.ConfigLoader && typeof global.ConfigLoader.active === 'function'
      ? global.ConfigLoader.active()?.storageKeyPrefix
      : '', '');
    if (configPrefix) return configPrefix;
    return toText(
      runtime && runtime.master && (runtime.master.projectCode || runtime.master.projectId),
      'g281'
    );
  }

  function storageKey(prefix, kind) {
    return `${prefix}.${STORAGE_SUFFIX[kind]}`;
  }

  function readStoredArray(prefix, kind) {
    const key = storageKey(prefix, kind);
    if (hasLocalStorage) {
      return safeArray(safeParse(global.localStorage.getItem(key), []));
    }
    return safeArray(memoryStorage[kind]).slice();
  }

  function writeStoredArray(prefix, kind, records) {
    const payload = JSON.stringify(safeArray(records));
    if (hasLocalStorage) {
      global.localStorage.setItem(storageKey(prefix, kind), payload);
      return;
    }
    memoryStorage[kind] = safeArray(records).slice();
  }

  function timeOf(record) {
    const raw = record && (record.createdAt || record.submittedAt || record.approvedAt || record.updatedAt || '');
    const time = new Date(raw).getTime();
    return Number.isFinite(time) ? time : 0;
  }

  function mergeById(seed, extra) {
    const map = new Map();
    safeArray(seed).forEach((record) => map.set(record.id, record));
    safeArray(extra).forEach((record) => map.set(record.id, record));
    return [...map.values()].sort((left, right) => timeOf(right) - timeOf(left));
  }

  function uniqueId(prefix, currentSize) {
    const stamp = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);
    return `${prefix}-${stamp}-${String(currentSize + 1).padStart(2, '0')}`;
  }

  function downloadJson(filename, payload) {
    if (!global.document || typeof Blob === 'undefined' || typeof URL === 'undefined') return false;
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = global.document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return true;
  }

  function normalizeArtifactPublishRecord(runtime, record) {
    const prefix = projectKeyPrefix(runtime);
    const normalized = {
      projectId: toText(record && record.projectId, prefix),
      harnessId: toText(record && record.harnessId, '*'),
      artifactType: toText(record && record.artifactType, ''),
      versionKey: toText(record && record.versionKey, ''),
      status: toText(record && record.status, 'published'),
      completionRate: Number(record && record.completionRate),
      blockedCount: Number(record && record.blockedCount),
      pendingCount: Number(record && record.pendingCount),
      exceptionCount: Number(record && record.exceptionCount),
      publishedAt: toText(record && record.publishedAt, new Date().toISOString()),
      updatedAt: new Date().toISOString(),
      note: toText(record && record.note, ''),
      meta: clonePlain(record && record.meta, {}),
    };
    if (!normalized.artifactType || !normalized.versionKey) {
      throw new Error('artifactType and versionKey are required for artifact publish state.');
    }
    normalized.id = `${normalized.projectId}::${normalized.harnessId}::${normalized.artifactType}::${normalized.versionKey}`;
    return normalized;
  }

  function normalizeExceptionActionRecord(runtime, record, currentSize) {
    const prefix = projectKeyPrefix(runtime);
    const normalized = {
      id: toText(record && record.id, uniqueId('EX', currentSize)),
      category: toText(record && record.category, ''),
      subjectKey: toText(record && record.subjectKey, ''),
      owner: toText(record && record.owner, 'local-user'),
      dueDate: toText(record && record.dueDate, ''),
      status: toText(record && record.status, 'open'),
      note: toText(record && record.note, ''),
      closedAt: toText(record && record.closedAt, ''),
      baselineKey: toText(record && record.baselineKey, 'quote'),
      projectId: toText(record && record.projectId, prefix),
      createdAt: toText(record && record.createdAt, new Date().toISOString()),
      updatedAt: new Date().toISOString(),
      meta: clonePlain(record && record.meta, {}),
    };
    if (!normalized.category || !normalized.subjectKey) {
      throw new Error('category and subjectKey are required for exception actions.');
    }
    return normalized;
  }

  function normalizeExportPackageRecord(runtime, record, currentSize) {
    const prefix = projectKeyPrefix(runtime);
    const normalized = {
      id: toText(record && record.id, uniqueId('EXP', currentSize)),
      projectId: toText(record && record.projectId, prefix),
      baselineKey: toText(record && record.baselineKey, 'quote'),
      stageKey: toText(record && record.stageKey, ''),
      templateKey: toText(record && record.templateKey, ''),
      fileName: toText(record && record.fileName, ''),
      createdAt: toText(record && record.createdAt, new Date().toISOString()),
      sheetNames: safeArray(record && record.sheetNames).map((name) => toText(name, '')).filter(Boolean),
      releaseVersionTag: toText(record && record.releaseVersionTag, ''),
      summary: clonePlain(record && record.summary, {}),
      meta: clonePlain(record && record.meta, {}),
    };
    if (!normalized.fileName) {
      throw new Error('fileName is required for export packages.');
    }
    return normalized;
  }

  function createRepo(runtimeInput) {
    const runtime = resolveRuntime(runtimeInput);
    const prefix = projectKeyPrefix(runtime);
    const seeds = {
      history: safeArray(runtime.historySeed),
      approvals: safeArray(runtime.approvalSeed),
    };

    let historyExtras = readStoredArray(prefix, 'history');
    let approvalExtras = readStoredArray(prefix, 'approvals');
    let artifactPublishStates = readStoredArray(prefix, 'artifactPublish');
    let exceptionActions = readStoredArray(prefix, 'exceptionActions');
    let exportPackages = mergeById(
      readStoredArray(prefix, 'exportPackages'),
      readStoredArray(prefix, 'exportPackagesRegistry')
    );

    function getHistory() {
      return mergeById(seeds.history, historyExtras);
    }

    function getApprovals() {
      return mergeById(seeds.approvals, approvalExtras);
    }

    function saveHistory(record) {
      historyExtras = [record, ...historyExtras.filter((item) => item.id !== record.id)];
      writeStoredArray(prefix, 'history', historyExtras);
      return getHistory();
    }

    function saveApproval(record) {
      approvalExtras = [record, ...approvalExtras.filter((item) => item.id !== record.id)];
      writeStoredArray(prefix, 'approvals', approvalExtras);
      return getApprovals();
    }

    function getExceptionActions(filter) {
      const filters = filter || {};
      return safeArray(exceptionActions)
        .filter((record) => {
          if (filters.projectId && filters.projectId !== record.projectId) return false;
          if (filters.baselineKey && filters.baselineKey !== record.baselineKey) return false;
          if (filters.category && filters.category !== record.category) return false;
          if (filters.subjectKey && filters.subjectKey !== record.subjectKey) return false;
          if (filters.status && filters.status !== record.status) return false;
          return true;
        })
        .sort((left, right) => timeOf(right) - timeOf(left));
    }

    function saveExceptionAction(record) {
      const normalized = normalizeExceptionActionRecord(runtime, record, exceptionActions.length);
      exceptionActions = [normalized, ...exceptionActions.filter((item) => item.id !== normalized.id)];
      writeStoredArray(prefix, 'exceptionActions', exceptionActions);
      return normalized;
    }

    function listExportPackages(filter) {
      const filters = filter || {};
      return safeArray(exportPackages)
        .filter((record) => {
          if (filters.projectId && filters.projectId !== record.projectId) return false;
          if (filters.baselineKey && filters.baselineKey !== record.baselineKey) return false;
          if (filters.stageKey && filters.stageKey !== record.stageKey) return false;
          if (filters.templateKey && filters.templateKey !== record.templateKey) return false;
          return true;
        })
        .sort((left, right) => timeOf(right) - timeOf(left));
    }

    function saveExportPackage(record) {
      const normalized = normalizeExportPackageRecord(runtime, record, exportPackages.length);
      exportPackages = [normalized, ...exportPackages.filter((item) => item.id !== normalized.id)];
      writeStoredArray(prefix, 'exportPackages', exportPackages);
      writeStoredArray(prefix, 'exportPackagesRegistry', exportPackages);
      return normalized;
    }

    function createHistoryRecord(model) {
      const timestamp = new Date().toISOString();
      return {
        id: uniqueId('H', getHistory().length + historyExtras.length),
        name: model && model.d && model.d.scenarioName ? model.d.scenarioName : 'Scenario Snapshot',
        scenarioName: model && model.d && model.d.scenarioName ? model.d.scenarioName : 'Scenario Snapshot',
        state: clonePlain(model && model.stateSnapshot, {}),
        draft: clonePlain(model && model.d, {}),
        createdAt: timestamp,
        author: 'local-user',
        note: 'Created from local offline workbench.',
        summary: {
          revenue: model && model.totalRevenue,
          cost: model && model.totalCost,
          profit: model && model.totalProfit,
          margin: model && model.margin,
          paybackYears: model && model.paybackYears,
          capitalTotal: model && model.capitalTotal,
        },
      };
    }

    function createApprovalRecord(model, versionRecord, title) {
      const timestamp = new Date().toISOString();
      return {
        id: uniqueId('A', getApprovals().length + approvalExtras.length),
        title: toText(title, `${toText(model && model.d && model.d.scenarioName, 'Scenario')} Approval`),
        relatedVersionId: toText(versionRecord && versionRecord.id, ''),
        status: 'PENDING',
        owner: 'local-role',
        submittedAt: timestamp,
        approvedAt: '',
        comment: 'Created from local offline workbench.',
        summary: {
          revenue: model && model.totalRevenue,
          cost: model && model.totalCost,
          profit: model && model.totalProfit,
          margin: model && model.margin,
        },
      };
    }

    function exportSnapshot(filename, payload) {
      return downloadJson(filename, payload);
    }

    function listFinancialVersions() {
      const versions = runtime && runtime.financialVersions && runtime.financialVersions.versions
        ? runtime.financialVersions.versions
        : {};
      return Object.keys(versions).map((key) => ({
        key,
        label: toText(versions[key] && versions[key].label, key),
      }));
    }

    function getFinancialVersion(key) {
      const versions = runtime && runtime.financialVersions && runtime.financialVersions.versions
        ? runtime.financialVersions.versions
        : {};
      return key && versions[key] ? versions[key] : null;
    }

    function getAssessmentWorkbookSeed(key) {
      const version = getFinancialVersion(key || 'quote');
      return version && version.assessmentWorkbookSeed ? version.assessmentWorkbookSeed : null;
    }

    function getBomWorkbookVersion(key) {
      const versions = runtime && runtime.bomWorkbookCopies && runtime.bomWorkbookCopies.versions
        ? runtime.bomWorkbookCopies.versions
        : {};
      return key && versions[key] ? versions[key] : null;
    }

    function getBomChanges() {
      return safeArray(runtime && runtime.bomChanges);
    }

    function getConnectorItems() {
      return safeArray(runtime && runtime.connectorProtocolStatus && runtime.connectorProtocolStatus.rows);
    }

    function getVersionHistory() {
      return getHistory();
    }

    function getPackagingValidation() {
      return runtime && runtime.packagingValidation ? runtime.packagingValidation : {};
    }

    function getCapitalValidation() {
      return runtime && runtime.capitalValidation ? runtime.capitalValidation : {};
    }

    function getLaborValidation() {
      return runtime && runtime.laborValidation ? runtime.laborValidation : {};
    }

    function getBomValidation() {
      return runtime && runtime.bomValidation ? runtime.bomValidation : {};
    }

    function getArtifactPublishStates(filter) {
      const filters = filter || {};
      return safeArray(artifactPublishStates)
        .filter((record) => {
          if (filters.projectId && filters.projectId !== record.projectId) return false;
          if (filters.harnessId && filters.harnessId !== record.harnessId) return false;
          if (filters.artifactType && filters.artifactType !== record.artifactType) return false;
          if (filters.versionKey && filters.versionKey !== record.versionKey) return false;
          return true;
        })
        .sort((left, right) => timeOf(right) - timeOf(left));
    }

    function setArtifactPublishState(record) {
      const normalized = normalizeArtifactPublishRecord(runtime, record);
      artifactPublishStates = [normalized, ...artifactPublishStates.filter((item) => item.id !== normalized.id)];
      writeStoredArray(prefix, 'artifactPublish', artifactPublishStates);
      return normalized;
    }

    function getRuntime() {
      return runtime;
    }

    return {
      runtime,
      data: runtime,
      seeds,
      projectKeyPrefix: prefix,
      getRuntime,
      getHistory,
      getApprovals,
      saveHistory,
      saveApproval,
      createHistoryRecord,
      createApprovalRecord,
      exportSnapshot,
      listFinancialVersions,
      getFinancialVersion,
      getAssessmentWorkbookSeed,
      getBomWorkbookVersion,
      getBomChanges,
      getConnectorItems,
      getVersionHistory,
      getPackagingValidation,
      getCapitalValidation,
      getLaborValidation,
      getBomValidation,
      getArtifactPublishStates,
      setArtifactPublishState,
      getExceptionActions,
      saveExceptionAction,
      listExportPackages,
      saveExportPackage,
    };
  }

  function init(runtimeInput) {
    activeRepo = createRepo(runtimeInput);
    return activeRepo;
  }

  function repoPrefix(repo) {
    return toText(repo && repo.projectKeyPrefix, '');
  }

  function runtimePrefix(runtimeInput) {
    const runtime = resolveRuntime(runtimeInput);
    return projectKeyPrefix(runtime);
  }

  function current(runtimeInput) {
    if (!activeRepo) {
      activeRepo = createRepo(runtimeInput);
      return activeRepo;
    }
    if (runtimeInput) {
      const desiredPrefix = runtimePrefix(runtimeInput);
      if (desiredPrefix && desiredPrefix !== repoPrefix(activeRepo)) {
        activeRepo = createRepo(runtimeInput);
      }
    }
    return activeRepo;
  }

  function proxy(methodName) {
    return function proxyMethod() {
      const repo = current();
      return repo[methodName].apply(repo, arguments);
    };
  }

  const api = {
    init,
    current,
    bootstrap: init,
    getRuntime: () => current().getRuntime(),
    getData: () => current().data,
    getHistory: proxy('getHistory'),
    getApprovals: proxy('getApprovals'),
    saveHistory: proxy('saveHistory'),
    saveApproval: proxy('saveApproval'),
    createHistoryRecord: proxy('createHistoryRecord'),
    createApprovalRecord: proxy('createApprovalRecord'),
    exportSnapshot: proxy('exportSnapshot'),
    listFinancialVersions: proxy('listFinancialVersions'),
    getFinancialVersion: proxy('getFinancialVersion'),
    getAssessmentWorkbookSeed: proxy('getAssessmentWorkbookSeed'),
    getBomWorkbookVersion: proxy('getBomWorkbookVersion'),
    getBomChanges: proxy('getBomChanges'),
    getConnectorItems: proxy('getConnectorItems'),
    getVersionHistory: proxy('getVersionHistory'),
    getPackagingValidation: proxy('getPackagingValidation'),
    getCapitalValidation: proxy('getCapitalValidation'),
    getLaborValidation: proxy('getLaborValidation'),
    getBomValidation: proxy('getBomValidation'),
    getArtifactPublishStates: proxy('getArtifactPublishStates'),
    setArtifactPublishState: proxy('setArtifactPublishState'),
    getExceptionActions: proxy('getExceptionActions'),
    saveExceptionAction: proxy('saveExceptionAction'),
    listExportPackages: proxy('listExportPackages'),
    saveExportPackage: proxy('saveExportPackage'),
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }

  global.G281Repo = api;
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this);
