(function (global) {
  'use strict';

  var STORAGE_KEY = 'g281.workflow.records.v1';
  var SCHEMA_VERSION = 1;
  var DEFAULT_PROJECT_CODE = 'g281-default-project';

  var ROLE_CODE_MAP = Object.freeze({
    harnessEngineer: 'harness_engineer',
    processEngineer: 'process_engineer',
    resourceEngineer: 'process_engineer',
    packagingEngineer: 'packaging_engineer',
    pm: 'project_manager',
    salesOps: 'sales',
  });

  var EXACT_ROLES = Object.freeze([
    { roleCode: 'harness_engineer', roleLabel: '线束开发工程师' },
    { roleCode: 'process_engineer', roleLabel: '工艺工程师' },
    { roleCode: 'packaging_engineer', roleLabel: '包装工程师' },
    { roleCode: 'project_manager', roleLabel: '项目经理' },
    { roleCode: 'sales', roleLabel: '销售' },
  ]);

  var EXACT_STAGES = Object.freeze([
    { stageCode: 'harness_development', stageLabel: '线束开发', ownerRoleCodes: ['harness_engineer'], requiredFieldCodes: ['bom_master', 'sor_mapping', 'harness_master'] },
    { stageCode: 'data_freeze', stageLabel: 'BOM / 资料冻结', ownerRoleCodes: ['harness_engineer'], requiredFieldCodes: ['config_mapping', 'data_freeze_note'] },
    { stageCode: 'process_estimation', stageLabel: '工艺测算', ownerRoleCodes: ['process_engineer'], requiredFieldCodes: ['process_route', 'labor_profile'] },
    { stageCode: 'resource_packaging', stageLabel: '工装模具 / 设备负荷 / 包装物流', ownerRoleCodes: ['process_engineer', 'packaging_engineer'], requiredFieldCodes: ['equipment_load', 'tooling_load', 'packaging_plan', 'packaging_cost'] },
    { stageCode: 'pm_cost_review', stageLabel: '成本核价 / 项目经理评审', ownerRoleCodes: ['project_manager'], requiredFieldCodes: ['pm_review_summary'] },
    { stageCode: 'commercial_quote', stageLabel: '商务报价 / 回收规则 / 客户协议价', ownerRoleCodes: ['sales'], requiredFieldCodes: ['quote_context', 'carrier_harness_ids', 'sales_rule', 'invoice_trigger', 'repricing_trigger'] },
    { stageCode: 'execution_recovery', stageLabel: '客户执行 / 出货回收 / 开票调价跟踪', ownerRoleCodes: ['sales', 'project_manager'], requiredFieldCodes: ['shipment_progress', 'recovery_progress', 'invoice_reprice_action'] },
  ]);

  var EXACT_FIELD_DEFINITIONS = Object.freeze([
    { fieldCode: 'bom_master', fieldLabel: 'BOM 主数据', stageCode: 'harness_development', ownerRoleCodes: ['harness_engineer'], required: true, inputType: 'text' },
    { fieldCode: 'sor_mapping', fieldLabel: 'SOR 映射', stageCode: 'harness_development', ownerRoleCodes: ['harness_engineer'], required: true, inputType: 'text' },
    { fieldCode: 'harness_master', fieldLabel: '线束主数据', stageCode: 'harness_development', ownerRoleCodes: ['harness_engineer'], required: true, inputType: 'text' },
    { fieldCode: 'config_mapping', fieldLabel: '配置映射', stageCode: 'data_freeze', ownerRoleCodes: ['harness_engineer'], required: true, inputType: 'text' },
    { fieldCode: 'data_freeze_note', fieldLabel: '资料冻结说明', stageCode: 'data_freeze', ownerRoleCodes: ['harness_engineer'], required: true, inputType: 'textarea' },
    { fieldCode: 'process_route', fieldLabel: '工艺路线', stageCode: 'process_estimation', ownerRoleCodes: ['process_engineer'], required: true, inputType: 'text' },
    { fieldCode: 'labor_profile', fieldLabel: '工时与费率', stageCode: 'process_estimation', ownerRoleCodes: ['process_engineer'], required: true, inputType: 'text' },
    { fieldCode: 'equipment_load', fieldLabel: '设备负荷', stageCode: 'resource_packaging', ownerRoleCodes: ['process_engineer'], required: true, inputType: 'text' },
    { fieldCode: 'tooling_load', fieldLabel: '工装模具负荷', stageCode: 'resource_packaging', ownerRoleCodes: ['process_engineer'], required: true, inputType: 'text' },
    { fieldCode: 'packaging_plan', fieldLabel: '包装方案', stageCode: 'resource_packaging', ownerRoleCodes: ['packaging_engineer'], required: true, inputType: 'text' },
    { fieldCode: 'packaging_cost', fieldLabel: '包装物流费用', stageCode: 'resource_packaging', ownerRoleCodes: ['packaging_engineer'], required: true, inputType: 'text' },
    { fieldCode: 'pm_review_summary', fieldLabel: '项目经理评审结论', stageCode: 'pm_cost_review', ownerRoleCodes: ['project_manager'], required: true, inputType: 'textarea' },
    { fieldCode: 'quote_context', fieldLabel: '报价上下文', stageCode: 'commercial_quote', ownerRoleCodes: ['sales'], required: true, inputType: 'text' },
    { fieldCode: 'baseline_quote_version', fieldLabel: '基线报价版本', stageCode: 'commercial_quote', ownerRoleCodes: ['sales'], required: false, inputType: 'text' },
    { fieldCode: 'carrier_harness_ids', fieldLabel: '承载线束号', stageCode: 'commercial_quote', ownerRoleCodes: ['sales'], required: true, inputType: 'textarea' },
    { fieldCode: 'sales_rule', fieldLabel: '回收规则', stageCode: 'commercial_quote', ownerRoleCodes: ['sales'], required: true, inputType: 'textarea' },
    { fieldCode: 'invoice_trigger', fieldLabel: '开票触发条件', stageCode: 'commercial_quote', ownerRoleCodes: ['sales'], required: true, inputType: 'text' },
    { fieldCode: 'repricing_trigger', fieldLabel: '调价触发条件', stageCode: 'commercial_quote', ownerRoleCodes: ['sales'], required: true, inputType: 'text' },
    { fieldCode: 'shipment_progress', fieldLabel: '出货进度', stageCode: 'execution_recovery', ownerRoleCodes: ['sales', 'project_manager'], required: true, inputType: 'number' },
    { fieldCode: 'recovery_progress', fieldLabel: '费用回收进度', stageCode: 'execution_recovery', ownerRoleCodes: ['sales', 'project_manager'], required: true, inputType: 'number' },
    { fieldCode: 'invoice_reprice_action', fieldLabel: '开票 / 调价动作', stageCode: 'execution_recovery', ownerRoleCodes: ['sales', 'project_manager'], required: true, inputType: 'textarea' },
  ]);

  var MODULE_CODE_MAP = Object.freeze({
    bom: 'bom',
    configsheet: 'configSheet',
    harnessstructure: 'harnessStructure',
    process: 'process',
    labor: 'labor',
    equipment: 'equipment',
    tooling: 'tooling',
    mold: 'mold',
    packaging: 'packaging',
    onetimecustomer: 'oneTimeCustomer',
    rebate: 'rebate',
    salesrule: 'salesRule',
    commercial: 'commercial',
    configsheets: 'configSheet',
  });

  var IMPACT_STAGE_MAP = Object.freeze({
    bom: 'harness_development',
    configsheet: 'harness_development',
    harnessstructure: 'harness_development',
    process: 'process_estimation',
    labor: 'process_estimation',
    equipment: 'resource_packaging',
    tooling: 'resource_packaging',
    mold: 'resource_packaging',
    packaging: 'resource_packaging',
    onetimecustomer: 'commercial_quote',
    rebate: 'commercial_quote',
    salesrule: 'commercial_quote',
    commercial: 'commercial_quote',
  });

  var STAGE_STATUS_MAP = Object.freeze({
    not_started: 'not_started',
    draft: 'draft',
    in_progress: 'in_progress',
    submitted: 'submitted',
    pending_review: 'submitted',
    approved: 'approved',
    returned: 'returned',
    rejected: 'returned',
    active: 'active',
    closed: 'closed',
  });

  function txt(value, fallback) {
    var text = String(value == null ? '' : value).trim();
    if (text) return text;
    return String(fallback == null ? '' : fallback).trim();
  }

  function toNumberOr(value, fallback) {
    var numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : (Number.isFinite(fallback) ? fallback : 0);
  }

  function toBoolean(value, fallback) {
    if (typeof value === 'boolean') return value;
    if (value === 1 || value === '1' || value === 'true') return true;
    if (value === 0 || value === '0' || value === 'false') return false;
    return !!fallback;
  }

  function ensureObject(value) {
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  }

  function ensureArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function clonePlain(value, fallback) {
    try {
      return JSON.parse(JSON.stringify(value));
    } catch (error) {
      return fallback;
    }
  }

  function safeParse(value, fallback) {
    if (!value) return fallback;
    try {
      return JSON.parse(value);
    } catch (error) {
      return fallback;
    }
  }

  function nowIso() {
    return new Date().toISOString();
  }

  function hasLocalStorage() {
    try {
      return typeof global.localStorage !== 'undefined';
    } catch (error) {
      return false;
    }
  }

  function recordIdOf(quoteVersionId, harnessId) {
    return txt(quoteVersionId, '') + txt(harnessId, '');
  }

  function normalizeRoleCode(value, fallback) {
    var normalized = txt(value, fallback || '').trim();
    return ROLE_CODE_MAP[normalized] || normalized || txt(fallback, 'sales');
  }

  function normalizeStageStatus(value, fallback) {
    var normalized = txt(value, fallback || 'not_started');
    return STAGE_STATUS_MAP[normalized] || txt(fallback, 'not_started');
  }

  function stageMeta(stageCode) {
    var code = txt(stageCode, '');
    for (var i = 0; i < EXACT_STAGES.length; i += 1) {
      if (EXACT_STAGES[i].stageCode === code) return EXACT_STAGES[i];
    }
    return null;
  }

  function stageIndex(stageCode) {
    var code = txt(stageCode, '');
    for (var i = 0; i < EXACT_STAGES.length; i += 1) {
      if (EXACT_STAGES[i].stageCode === code) return i;
    }
    return -1;
  }

  function normalizeModuleCode(value) {
    var raw = txt(value, '').replace(/[\s_-]+/g, '').toLowerCase();
    return MODULE_CODE_MAP[raw] || txt(value, '');
  }

  function normalizeModules(value) {
    var rawList = Array.isArray(value)
      ? value
      : String(value == null ? '' : value).split(/[\n,;，；\s]+/g);
    var seen = Object.create(null);
    var result = [];
    rawList.forEach(function (item) {
      var moduleCode = normalizeModuleCode(item);
      var dedupeKey = txt(moduleCode, '').toLowerCase();
      if (!dedupeKey || seen[dedupeKey]) return;
      seen[dedupeKey] = true;
      result.push(moduleCode);
    });
    return result;
  }

  function normalizeImpactKey(value) {
    return txt(value, '').replace(/[\s_-]+/g, '').toLowerCase();
  }

  function normalizeIdArray(value) {
    var list = Array.isArray(value)
      ? value
      : String(value == null ? '' : value).split(/[\n,;，；\s]+/g);
    var seen = Object.create(null);
    var result = [];
    list.forEach(function (item) {
      var id = txt(item, '');
      if (!id || seen[id]) return;
      seen[id] = true;
      result.push(id);
    });
    return result;
  }

  function normalizeExecutionSnapshot(value) {
    var source = ensureObject(value);
    return {
      status: txt(source.status, 'not_started'),
      deliveredSets: Math.max(0, toNumberOr(source.deliveredSets, 0)),
      recoveredAmount: Math.max(0, toNumberOr(source.recoveredAmount, 0)),
      remainingAmount: Math.max(0, toNumberOr(source.remainingAmount, 0)),
      lastTaskHint: txt(source.lastTaskHint || source.note, ''),
      updatedBy: normalizeRoleCode(source.updatedBy || source.updatedByRole || '', ''),
      updatedAt: txt(source.updatedAt, nowIso()),
    };
  }

  function createStageState(definition, overrides) {
    var source = ensureObject(overrides);
    return {
      stageCode: definition.stageCode,
      stageLabel: txt(source.stageLabel || source.stageName, definition.stageLabel),
      ownerRoleCodes: ensureArray(source.ownerRoleCodes).length
        ? ensureArray(source.ownerRoleCodes).map(function (item) { return normalizeRoleCode(item, ''); }).filter(Boolean)
        : (function () {
          var rawOwner = Array.isArray(source.ownerRole) ? source.ownerRole : [];
          if (rawOwner.length) return rawOwner.map(function (item) { return normalizeRoleCode(item, ''); }).filter(Boolean);
          if (txt(source.ownerRole, '')) return [normalizeRoleCode(source.ownerRole, '')];
          return clonePlain(definition.ownerRoleCodes, []);
        }()),
      status: normalizeStageStatus(source.status, 'not_started'),
      requiredFieldCodes: ensureArray(source.requiredFieldCodes).length ? clonePlain(source.requiredFieldCodes, []) : clonePlain(definition.requiredFieldCodes, []),
      submittedAt: txt(source.submittedAt, ''),
      submittedByRole: normalizeRoleCode(source.submittedByRole || source.updatedBy || '', ''),
      reviewedAt: txt(source.reviewedAt || source.approvedAt || source.rejectedAt, ''),
      reviewAction: txt(source.reviewAction || source.reviewedAction || ensureObject(source.reviewPayload).decision, ''),
      reviewNote: txt(source.reviewNote || ensureObject(source.reviewPayload).note, ''),
      source: txt(source.source, toBoolean(source.inherited, false) ? 'inherited' : 'manual') === 'inherited' ? 'inherited' : 'manual',
      draftData: clonePlain(source.draftData || source.draftPayload || {}, {}),
      submitData: clonePlain(source.submitData || source.submitPayload || {}, {}),
    };
  }

  function normalizeStageStates(value) {
    var rawArray = Array.isArray(value) ? value : null;
    var rawObject = rawArray ? null : ensureObject(value);
    return EXACT_STAGES.map(function (definition) {
      var source = rawArray
        ? (rawArray.find(function (item) { return txt(ensureObject(item).stageCode, '') === definition.stageCode; }) || {})
        : ensureObject(rawObject[definition.stageCode]);
      return createStageState(definition, source);
    });
  }

  function getStage(record, stageCode) {
    var stages = ensureArray(record && record.stageStates);
    for (var i = 0; i < stages.length; i += 1) {
      if (txt(stages[i].stageCode, '') === txt(stageCode, '')) return stages[i];
    }
    return null;
  }

  function stageSummaryStatus(record, rawOverallStatus) {
    var explicit = txt(rawOverallStatus || record.overallStatus || record.workflowStatus, '');
    if (explicit === 'active' || explicit === 'closed' || explicit === 'review_pending' || explicit === 'returned' || explicit === 'draft') {
      return explicit;
    }
    var executionStage = getStage(record, 'execution_recovery');
    if (executionStage && (executionStage.status === 'approved' || executionStage.status === 'closed')) return 'closed';
    if (executionStage && (executionStage.status === 'active' || executionStage.status === 'in_progress' || executionStage.status === 'submitted')) return 'active';
    if (txt(record.currentStageCode, '') === 'pm_cost_review') return 'review_pending';
    if (ensureArray(record.stageStates).some(function (stage) { return stage.status === 'returned'; })) return 'returned';
    return 'draft';
  }

  function deriveCurrentStageCode(record) {
    var explicit = txt(record.currentStageCode, '');
    if (stageMeta(explicit)) return explicit;
    var pendingStage = ensureArray(record.stageStates).find(function (stage) {
      return ['harness_development', 'data_freeze', 'process_estimation', 'resource_packaging'].indexOf(stage.stageCode) >= 0 && stage.status === 'submitted';
    });
    if (pendingStage) return 'pm_cost_review';
    var executionStage = getStage(record, 'execution_recovery');
    if (executionStage && executionStage.status !== 'not_started') return 'execution_recovery';
    var activeStage = ensureArray(record.stageStates).find(function (stage) {
      return stage.status === 'in_progress' || stage.status === 'draft' || stage.status === 'returned' || stage.status === 'active';
    });
    if (activeStage) return activeStage.stageCode;
    var nextStage = ensureArray(record.stageStates).find(function (stage) { return stage.status !== 'approved'; });
    return nextStage ? nextStage.stageCode : EXACT_STAGES[0].stageCode;
  }

  function normalizeRecord(rawRecord, options) {
    var source = ensureObject(rawRecord);
    var opt = ensureObject(options);
    var quoteVersionId = txt(source.quoteVersionId, '');
    var harnessId = txt(source.harnessId, '');
    var stageStates = normalizeStageStates(source.stageStates);
    var record = {
      recordId: txt(source.recordId, recordIdOf(quoteVersionId, harnessId)),
      quoteVersionId: quoteVersionId,
      quoteType: txt(source.quoteType, 'project') === 'change' ? 'change' : 'project',
      baselineQuoteVersion: txt(source.baselineQuoteVersion, ''),
      projectCode: txt(source.projectCode || ensureObject(source.metadata).projectCode, txt(opt.projectCode, DEFAULT_PROJECT_CODE)),
      scenarioName: txt(source.scenarioName || ensureObject(source.metadata).scenarioName, ''),
      harnessId: harnessId,
      harnessName: txt(source.harnessName, ''),
      impactedModules: normalizeModules(source.impactedModules),
      currentStageCode: txt(source.currentStageCode, ''),
      overallStatus: txt(source.overallStatus || source.workflowStatus, ''),
      stageStates: stageStates,
      linkedSalesRuleIds: normalizeIdArray(source.linkedSalesRuleIds || ensureObject(source.metadata).linkedSalesRuleIds),
      linkedTaskIds: normalizeIdArray(source.linkedTaskIds || ensureObject(source.metadata).linkedTaskIds),
      linkedRecoveryHarnessId: txt(source.linkedRecoveryHarnessId, harnessId),
      latestExecutionSnapshot: normalizeExecutionSnapshot(source.latestExecutionSnapshot || source.executionStatus),
      auditLog: ensureArray(source.auditLog || ensureObject(source.metadata).auditLog).map(function (item, index) {
        var row = ensureObject(item);
        return {
          id: txt(row.id, 'audit-' + index + '-' + Date.now().toString(36)),
          action: txt(row.action, 'workflow'),
          stageCode: txt(row.stageCode, ''),
          note: txt(row.note, ''),
          actorRole: normalizeRoleCode(row.actorRole || row.role || '', ''),
          createdAt: txt(row.createdAt, nowIso()),
        };
      }),
      createdAt: txt(source.createdAt, nowIso()),
      updatedAt: txt(source.updatedAt, nowIso()),
    };
    record.currentStageCode = deriveCurrentStageCode(record);
    record.overallStatus = stageSummaryStatus(record, record.overallStatus);
    if (record.currentStageCode === 'pm_cost_review') {
      var pmStage = getStage(record, 'pm_cost_review');
      if (pmStage && pmStage.status === 'not_started') pmStage.status = 'in_progress';
    }
    if (record.currentStageCode === 'execution_recovery') {
      var executionStage = getStage(record, 'execution_recovery');
      if (executionStage && executionStage.status === 'not_started') executionStage.status = record.overallStatus === 'closed' ? 'approved' : 'active';
    }
    return record;
  }

  function normalizeSnapshot(rawSnapshot, options) {
    var source = ensureObject(rawSnapshot);
    var opt = ensureObject(options);
    return {
      schemaVersion: SCHEMA_VERSION,
      projectCode: txt(source.projectCode, txt(opt.projectCode, DEFAULT_PROJECT_CODE)),
      records: ensureArray(source.records).map(function (record) { return normalizeRecord(record, opt); }),
      updatedAt: txt(source.updatedAt, nowIso()),
    };
  }

  function buildDefaultSnapshot(options) {
    var opt = ensureObject(options);
    return normalizeSnapshot({
      projectCode: txt(opt.projectCode, DEFAULT_PROJECT_CODE),
      records: [],
      updatedAt: nowIso(),
    }, opt);
  }

  function createInitialStageStates(startStageCode) {
    return EXACT_STAGES.map(function (definition) {
      return createStageState(definition, {
        status: definition.stageCode === startStageCode
          ? (definition.stageCode === 'execution_recovery' ? 'active' : 'in_progress')
          : 'not_started',
      });
    });
  }

  function resolveReopenStageCode(impactedModules) {
    var normalized = normalizeModules(impactedModules);
    var minIndex = EXACT_STAGES.length - 1;
    var found = false;
    normalized.forEach(function (item) {
      var stageCode = IMPACT_STAGE_MAP[normalizeImpactKey(item)];
      var index = stageIndex(stageCode);
      if (index < 0) return;
      found = true;
      if (index < minIndex) minIndex = index;
    });
    return found ? EXACT_STAGES[minIndex].stageCode : EXACT_STAGES[0].stageCode;
  }

  function copyInheritedStages(baseRecord, reopenStageCode) {
    var reopenIndex = stageIndex(reopenStageCode);
    return EXACT_STAGES.map(function (definition, index) {
      var baseStage = getStage(baseRecord, definition.stageCode);
      if (index < reopenIndex && baseStage && baseStage.status === 'approved') {
        return createStageState(definition, {
          status: 'approved',
          source: 'inherited',
          submittedAt: baseStage.submittedAt,
          submittedByRole: baseStage.submittedByRole,
          reviewedAt: baseStage.reviewedAt,
          reviewAction: baseStage.reviewAction || 'approve',
          reviewNote: baseStage.reviewNote,
          draftData: clonePlain(baseStage.draftData, {}),
          submitData: clonePlain(baseStage.submitData, {}),
        });
      }
      if (index === reopenIndex) {
        return createStageState(definition, { status: 'in_progress', source: 'manual' });
      }
      return createStageState(definition, { status: 'not_started', source: 'manual' });
    });
  }

  function pushAudit(record, action, stageCode, note, actorRole) {
    record.auditLog = ensureArray(record.auditLog);
    record.auditLog.unshift({
      id: 'audit-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8),
      action: txt(action, 'workflow'),
      stageCode: txt(stageCode, ''),
      note: txt(note, ''),
      actorRole: normalizeRoleCode(actorRole, ''),
      createdAt: nowIso(),
    });
  }

  function mergeLinkedIds(record, patch) {
    var payload = ensureObject(patch);
    if (Object.prototype.hasOwnProperty.call(payload, 'linkedSalesRuleIds')) {
      record.linkedSalesRuleIds = normalizeIdArray(payload.linkedSalesRuleIds);
    }
    if (Object.prototype.hasOwnProperty.call(payload, 'linkedTaskIds')) {
      record.linkedTaskIds = normalizeIdArray(payload.linkedTaskIds);
    }
    if (Object.prototype.hasOwnProperty.call(payload, 'linkedRecoveryHarnessId')) {
      record.linkedRecoveryHarnessId = txt(payload.linkedRecoveryHarnessId, record.linkedRecoveryHarnessId || record.harnessId);
    }
  }

  function ensureIdentity(input) {
    var source = ensureObject(input);
    var quoteVersionId = txt(source.quoteVersionId, '');
    var harnessId = txt(source.harnessId, '');
    if (!quoteVersionId || !harnessId) throw new Error('quoteVersionId and harnessId are required');
    return {
      quoteVersionId: quoteVersionId,
      harnessId: harnessId,
      recordId: recordIdOf(quoteVersionId, harnessId),
    };
  }

  function findRecordIndex(snapshot, recordId) {
    var key = txt(recordId, '');
    return ensureArray(snapshot.records).findIndex(function (record) { return txt(record.recordId, '') === key; });
  }

  function findRecordByQuoteHarness(snapshot, quoteVersionId, harnessId) {
    var id = recordIdOf(quoteVersionId, harnessId);
    var index = findRecordIndex(snapshot, id);
    return index >= 0 ? ensureArray(snapshot.records)[index] : null;
  }

  function createStorage(options) {
    var opt = ensureObject(options);
    var snapshot = buildDefaultSnapshot(opt);
    var enabled = hasLocalStorage();

    function read() {
      if (!enabled) return null;
      try {
        return safeParse(global.localStorage.getItem(STORAGE_KEY), null);
      } catch (error) {
        return null;
      }
    }

    function write(nextSnapshot) {
      if (!enabled) return;
      try {
        global.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextSnapshot));
      } catch (error) {}
    }

    function load() {
      snapshot = normalizeSnapshot(read() || snapshot, opt);
      return clonePlain(snapshot, buildDefaultSnapshot(opt));
    }

    function save(nextSnapshot) {
      snapshot = normalizeSnapshot(nextSnapshot || snapshot, opt);
      write(snapshot);
      return clonePlain(snapshot, buildDefaultSnapshot(opt));
    }

    function persist() {
      snapshot.updatedAt = nowIso();
      snapshot = normalizeSnapshot(snapshot, opt);
      write(snapshot);
      return clonePlain(snapshot, buildDefaultSnapshot(opt));
    }

    function getSnapshot() {
      return snapshot;
    }

    function reset() {
      snapshot = buildDefaultSnapshot(opt);
      if (enabled) {
        try {
          global.localStorage.removeItem(STORAGE_KEY);
        } catch (error) {}
      }
      return clonePlain(snapshot, buildDefaultSnapshot(opt));
    }

    return {
      load: load,
      save: save,
      persist: persist,
      getSnapshot: getSnapshot,
      reset: reset,
    };
  }

  function create(options) {
    var opt = ensureObject(options);
    var storage = createStorage(opt);
    storage.load();

    function snapshot() {
      return storage.getSnapshot();
    }

    function persistRecord(record) {
      var current = snapshot();
      var records = ensureArray(current.records).slice();
      var normalized = normalizeRecord(record, opt);
      var index = findRecordIndex(current, normalized.recordId);
      if (index >= 0) {
        normalized.createdAt = txt(records[index].createdAt, normalized.createdAt);
        records[index] = normalized;
      } else {
        records.push(normalized);
      }
      current.records = records;
      current.updatedAt = nowIso();
      storage.save(current);
      return clonePlain(normalized, null);
    }

    function mutate(recordId, handler) {
      var current = snapshot();
      var index = findRecordIndex(current, recordId);
      if (index < 0) return null;
      var draft = clonePlain(ensureArray(current.records)[index], null);
      if (!draft) return null;
      handler(draft);
      draft.updatedAt = nowIso();
      draft = normalizeRecord(draft, opt);
      current.records[index] = draft;
      current.updatedAt = nowIso();
      storage.save(current);
      return clonePlain(draft, null);
    }

    function createProjectQuoteRecord(payload) {
      var source = ensureObject(payload);
      var identity = ensureIdentity(source);
      var current = snapshot();
      var existing = findRecordByQuoteHarness(current, identity.quoteVersionId, identity.harnessId);
      if (existing && !toBoolean(source.overwrite, false)) return clonePlain(existing, null);
      var timestamp = nowIso();
      var record = {
        recordId: identity.recordId,
        quoteVersionId: identity.quoteVersionId,
        quoteType: 'project',
        baselineQuoteVersion: '',
        projectCode: txt(source.projectCode || ensureObject(source.metadata).projectCode, txt(opt.projectCode, DEFAULT_PROJECT_CODE)),
        scenarioName: txt(source.scenarioName || ensureObject(source.metadata).scenarioName, ''),
        harnessId: identity.harnessId,
        harnessName: txt(source.harnessName, ''),
        impactedModules: normalizeModules(source.impactedModules),
        currentStageCode: 'harness_development',
        overallStatus: 'draft',
        stageStates: createInitialStageStates('harness_development'),
        linkedSalesRuleIds: normalizeIdArray(source.linkedSalesRuleIds),
        linkedTaskIds: normalizeIdArray(source.linkedTaskIds),
        linkedRecoveryHarnessId: txt(source.linkedRecoveryHarnessId, identity.harnessId),
        latestExecutionSnapshot: normalizeExecutionSnapshot(source.latestExecutionSnapshot || source.executionStatus),
        auditLog: [],
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      pushAudit(record, 'record_created', 'harness_development', '创建项目报价记录', source.createdBy || source.updatedByRole);
      return persistRecord(record);
    }

    function createChangeQuoteRecord(payload) {
      var source = ensureObject(payload);
      var identity = ensureIdentity(source);
      var baselineQuoteVersion = txt(source.baselineQuoteVersion, '');
      var impactedModules = normalizeModules(source.impactedModules);
      if (!baselineQuoteVersion) throw new Error('baselineQuoteVersion is required for change quote');
      if (!impactedModules.length) throw new Error('impactedModules is required for change quote');
      var current = snapshot();
      var existing = findRecordByQuoteHarness(current, identity.quoteVersionId, identity.harnessId);
      if (existing && !toBoolean(source.overwrite, false)) return clonePlain(existing, null);
      var baselineRecord = findRecordByQuoteHarness(current, baselineQuoteVersion, identity.harnessId);
      if (!baselineRecord) throw new Error('baseline record not found for harness');
      var reopenStageCode = resolveReopenStageCode(impactedModules);
      var timestamp = nowIso();
      var record = {
        recordId: identity.recordId,
        quoteVersionId: identity.quoteVersionId,
        quoteType: 'change',
        baselineQuoteVersion: baselineQuoteVersion,
        projectCode: txt(source.projectCode || ensureObject(source.metadata).projectCode, txt(opt.projectCode, DEFAULT_PROJECT_CODE)),
        scenarioName: txt(source.scenarioName || ensureObject(source.metadata).scenarioName || baselineRecord.scenarioName, ''),
        harnessId: identity.harnessId,
        harnessName: txt(source.harnessName, baselineRecord.harnessName),
        impactedModules: impactedModules,
        currentStageCode: reopenStageCode,
        overallStatus: 'draft',
        stageStates: copyInheritedStages(baselineRecord, reopenStageCode),
        linkedSalesRuleIds: [],
        linkedTaskIds: [],
        linkedRecoveryHarnessId: txt(source.linkedRecoveryHarnessId, identity.harnessId),
        latestExecutionSnapshot: normalizeExecutionSnapshot(source.latestExecutionSnapshot || source.executionStatus),
        auditLog: [],
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      pushAudit(record, 'record_created', reopenStageCode, '创建变更报价记录', source.createdBy || source.updatedByRole);
      pushAudit(record, 'reopen_from_baseline', reopenStageCode, '基线版本: ' + baselineQuoteVersion, source.createdBy || source.updatedByRole);
      return persistRecord(record);
    }

    function saveStageDraft(recordId, stageCode, payload) {
      return mutate(recordId, function (record) {
        var definition = stageMeta(stageCode);
        var stage = getStage(record, stageCode);
        var patch = ensureObject(payload);
        if (!definition || !stage) throw new Error('invalid stageCode');
        stage.draftData = Object.assign({}, ensureObject(stage.draftData), patch);
        if (stage.status === 'not_started') {
          stage.status = definition.stageCode === 'execution_recovery' ? 'active' : 'draft';
        } else if (stage.status === 'returned') {
          stage.status = definition.stageCode === 'execution_recovery' ? 'active' : 'in_progress';
        }
        mergeLinkedIds(record, patch);
        record.currentStageCode = definition.stageCode;
        record.overallStatus = definition.stageCode === 'execution_recovery'
          ? (record.overallStatus === 'closed' ? 'closed' : 'active')
          : 'draft';
        pushAudit(record, 'draft_saved', definition.stageCode, patch.note || patch.pm_review_summary || '', patch.updatedByRole || patch.updatedBy);
      });
    }

    function submitStage(recordId, stageCode, payload) {
      return mutate(recordId, function (record) {
        var definition = stageMeta(stageCode);
        var patch = ensureObject(payload);
        var stage = getStage(record, stageCode);
        if (!definition || !stage) throw new Error('invalid stageCode');
        stage.submitData = Object.assign({}, ensureObject(stage.submitData), patch);
        stage.submittedAt = nowIso();
        stage.submittedByRole = normalizeRoleCode(patch.submittedByRole || patch.submitter || patch.updatedByRole || patch.updatedBy, '');
        stage.reviewedAt = '';
        stage.reviewAction = '';
        stage.reviewNote = '';
        mergeLinkedIds(record, patch);
        if (stageCode === 'commercial_quote') {
          if (patch.requirementsComplete !== true) throw new Error('commercial_quote submit requires payload.requirementsComplete === true');
          stage.status = 'approved';
          stage.reviewedAt = stage.submittedAt;
          stage.reviewAction = 'approve';
          var executionStage = getStage(record, 'execution_recovery');
          if (executionStage) executionStage.status = 'active';
          record.currentStageCode = 'execution_recovery';
          record.overallStatus = 'active';
          pushAudit(record, 'commercial_submitted', 'commercial_quote', '商务阶段提交并进入执行跟踪', stage.submittedByRole);
          return;
        }
        if (stageCode === 'execution_recovery') {
          stage.status = 'active';
          record.currentStageCode = 'execution_recovery';
          record.overallStatus = 'active';
          pushAudit(record, 'execution_submitted', 'execution_recovery', patch.note || '', stage.submittedByRole);
          return;
        }
        if (['harness_development', 'data_freeze', 'process_estimation', 'resource_packaging'].indexOf(stageCode) >= 0) {
          stage.status = 'submitted';
          var pmStage = getStage(record, 'pm_cost_review');
          if (pmStage) pmStage.status = 'in_progress';
          record.currentStageCode = 'pm_cost_review';
          record.overallStatus = 'review_pending';
          pushAudit(record, 'stage_submitted', stageCode, patch.note || '', stage.submittedByRole);
          return;
        }
        if (stageCode === 'pm_cost_review') {
          stage.status = 'submitted';
          record.currentStageCode = 'pm_cost_review';
          record.overallStatus = 'review_pending';
          pushAudit(record, 'pm_review_submitted', 'pm_cost_review', patch.note || '', stage.submittedByRole);
        }
      });
    }

    function parseReviewPayload(actionOrPayload, note) {
      if (actionOrPayload && typeof actionOrPayload === 'object' && !Array.isArray(actionOrPayload)) {
        return {
          action: txt(actionOrPayload.action || actionOrPayload.decision, 'approve').toLowerCase(),
          note: txt(actionOrPayload.note, ''),
          reviewer: normalizeRoleCode(actionOrPayload.reviewer || actionOrPayload.reviewedBy || '', ''),
          returnToStageCode: txt(actionOrPayload.returnToStageCode || actionOrPayload.returnStageCode, ''),
        };
      }
      return {
        action: txt(actionOrPayload, 'approve').toLowerCase(),
        note: txt(note, ''),
        reviewer: '',
        returnToStageCode: '',
      };
    }

    function resetStageForReturn(stage, status, keepPayload) {
      stage.status = status;
      stage.submittedAt = '';
      stage.submittedByRole = '';
      stage.reviewedAt = '';
      stage.reviewAction = '';
      stage.reviewNote = '';
      stage.source = 'manual';
      if (!keepPayload) {
        stage.draftData = {};
        stage.submitData = {};
      }
    }

    function reviewStage(recordId, stageCode, actionOrPayload, note) {
      return mutate(recordId, function (record) {
        var review = parseReviewPayload(actionOrPayload, note);
        var requestedStageCode = txt(stageCode, '');
        var targetStage = null;
        var pmStage = getStage(record, 'pm_cost_review');
        if (requestedStageCode === 'pm_cost_review') {
          targetStage = ensureArray(record.stageStates).find(function (stage) {
            return ['harness_development', 'data_freeze', 'process_estimation', 'resource_packaging'].indexOf(stage.stageCode) >= 0 && stage.status === 'submitted';
          });
        } else {
          targetStage = getStage(record, requestedStageCode);
        }
        if (!targetStage) throw new Error('no stage pending project manager review');
        if (['harness_development', 'data_freeze', 'process_estimation', 'resource_packaging'].indexOf(targetStage.stageCode) < 0) {
          throw new Error('reviewStage only supports project manager review stages');
        }
        var targetIndex = stageIndex(targetStage.stageCode);
        if (review.action === 'return' || review.action === 'reject') {
          var returnToStageCode = txt(review.returnToStageCode, targetStage.stageCode);
          var returnIndex = stageIndex(returnToStageCode);
          if (returnIndex < 0 || returnIndex > targetIndex || returnIndex >= stageIndex('pm_cost_review')) {
            throw new Error('returnToStageCode must be a valid previous stage');
          }
          if (pmStage) {
            pmStage.status = 'returned';
            pmStage.reviewedAt = nowIso();
            pmStage.reviewAction = 'return';
            pmStage.reviewNote = review.note;
          }
          for (var i = returnIndex; i < EXACT_STAGES.length; i += 1) {
            var stage = getStage(record, EXACT_STAGES[i].stageCode);
            if (!stage) continue;
            if (EXACT_STAGES[i].stageCode === returnToStageCode) {
              resetStageForReturn(stage, 'in_progress', true);
              continue;
            }
            resetStageForReturn(stage, 'not_started', false);
          }
          record.currentStageCode = returnToStageCode;
          record.overallStatus = 'returned';
          pushAudit(record, 'stage_returned', targetStage.stageCode, review.note || ('退回至 ' + returnToStageCode), review.reviewer);
          return;
        }
        targetStage.status = 'approved';
        targetStage.reviewedAt = nowIso();
        targetStage.reviewAction = 'approve';
        targetStage.reviewNote = review.note;
        if (pmStage) {
          pmStage.status = 'approved';
          pmStage.reviewedAt = targetStage.reviewedAt;
          pmStage.reviewAction = 'approve';
          pmStage.reviewNote = review.note;
        }
        var nextDefinition = EXACT_STAGES[targetIndex + 1];
        if (!nextDefinition || nextDefinition.stageCode === 'pm_cost_review') nextDefinition = EXACT_STAGES[targetIndex + 2];
        if (nextDefinition) {
          var nextStage = getStage(record, nextDefinition.stageCode);
          if (nextStage && nextStage.status === 'not_started') {
            nextStage.status = nextDefinition.stageCode === 'execution_recovery' ? 'active' : 'in_progress';
          }
          record.currentStageCode = nextDefinition.stageCode;
          record.overallStatus = nextDefinition.stageCode === 'execution_recovery' ? 'active' : 'draft';
        } else {
          record.currentStageCode = targetStage.stageCode;
          record.overallStatus = 'closed';
        }
        pushAudit(record, 'stage_approved', targetStage.stageCode, review.note || '', review.reviewer);
      });
    }

    function updateExecutionStatus(recordId, payload) {
      return mutate(recordId, function (record) {
        var patch = ensureObject(payload);
        var executionStage = getStage(record, 'execution_recovery');
        var currentSnapshot = normalizeExecutionSnapshot(record.latestExecutionSnapshot);
        if (!executionStage) throw new Error('execution_recovery stage not found');
        mergeLinkedIds(record, patch);
        record.latestExecutionSnapshot = normalizeExecutionSnapshot({
          status: txt(patch.status, currentSnapshot.status),
          deliveredSets: Object.prototype.hasOwnProperty.call(patch, 'deliveredSets') ? patch.deliveredSets : currentSnapshot.deliveredSets,
          recoveredAmount: Object.prototype.hasOwnProperty.call(patch, 'recoveredAmount') ? patch.recoveredAmount : currentSnapshot.recoveredAmount,
          remainingAmount: Object.prototype.hasOwnProperty.call(patch, 'remainingAmount') ? patch.remainingAmount : currentSnapshot.remainingAmount,
          lastTaskHint: patch.lastTaskHint || patch.note || currentSnapshot.lastTaskHint,
          updatedBy: patch.updatedBy || patch.updatedByRole || currentSnapshot.updatedBy,
          updatedAt: nowIso(),
        });
        var stageStatus = normalizeStageStatus(patch.stageStatus, executionStage.status);
        if (stageStatus === 'approved' || txt(patch.status, '') === 'approved' || txt(patch.status, '') === 'closed') {
          executionStage.status = 'approved';
          record.currentStageCode = 'execution_recovery';
          record.overallStatus = 'closed';
          pushAudit(record, 'execution_closed', 'execution_recovery', patch.note || '', patch.updatedBy || patch.updatedByRole);
          return;
        }
        executionStage.status = stageStatus === 'not_started' ? 'active' : (stageStatus === 'in_progress' ? 'active' : stageStatus);
        record.currentStageCode = 'execution_recovery';
        record.overallStatus = 'active';
        pushAudit(record, 'execution_updated', 'execution_recovery', patch.note || '', patch.updatedBy || patch.updatedByRole);
      });
    }

    function listRecords(filters) {
      var query = ensureObject(filters);
      var records = ensureArray(snapshot().records).filter(function (record) {
        if (query.recordId && txt(record.recordId, '') !== txt(query.recordId, '')) return false;
        if (query.quoteVersionId && txt(record.quoteVersionId, '') !== txt(query.quoteVersionId, '')) return false;
        if (query.harnessId && txt(record.harnessId, '') !== txt(query.harnessId, '')) return false;
        if (query.quoteType && txt(record.quoteType, 'project') !== txt(query.quoteType, 'project')) return false;
        if (query.baselineQuoteVersion && txt(record.baselineQuoteVersion, '') !== txt(query.baselineQuoteVersion, '')) return false;
        if (query.currentStageCode && txt(record.currentStageCode, '') !== txt(query.currentStageCode, '')) return false;
        if (query.overallStatus && txt(record.overallStatus, '') !== txt(query.overallStatus, '')) return false;
        if (query.stageCode && query.stageStatus) {
          var stage = getStage(record, query.stageCode);
          if (!stage || txt(stage.status, '') !== txt(query.stageStatus, '')) return false;
        }
        return true;
      });
      records.sort(function (left, right) {
        return Date.parse(txt(right.updatedAt, right.createdAt)) - Date.parse(txt(left.updatedAt, left.createdAt));
      });
      return clonePlain(records, []);
    }

    function getRecord(recordId) {
      var current = snapshot();
      var index = findRecordIndex(current, recordId);
      return index >= 0 ? clonePlain(ensureArray(current.records)[index], null) : null;
    }

    function getSnapshot() {
      var current = normalizeSnapshot(snapshot(), opt);
      return {
        schemaVersion: SCHEMA_VERSION,
        storageKey: STORAGE_KEY,
        projectCode: txt(current.projectCode, txt(opt.projectCode, DEFAULT_PROJECT_CODE)),
        roles: clonePlain(EXACT_ROLES, []),
        stages: clonePlain(EXACT_STAGES, []),
        fieldDefinitions: clonePlain(EXACT_FIELD_DEFINITIONS, []),
        impactStageMap: clonePlain(IMPACT_STAGE_MAP, {}),
        records: clonePlain(current.records, []),
        totalRecords: ensureArray(current.records).length,
        updatedAt: txt(current.updatedAt, nowIso()),
      };
    }

    return {
      createProjectQuoteRecord: createProjectQuoteRecord,
      createChangeQuoteRecord: createChangeQuoteRecord,
      saveStageDraft: saveStageDraft,
      submitStage: submitStage,
      reviewStage: reviewStage,
      updateExecutionStatus: updateExecutionStatus,
      listRecords: listRecords,
      getRecord: getRecord,
      getSnapshot: getSnapshot,
      load: storage.load,
      save: storage.save,
      reset: storage.reset,
    };
  }

  global.G281WorkflowRepo = {
    create: create,
  };
}(window));
