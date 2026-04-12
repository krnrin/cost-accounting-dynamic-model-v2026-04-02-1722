(function (global) {
  'use strict';

  const STORAGE_KEY = 'g281.sales.recovery.rules.v1';
  const DEFAULT_SCHEMA_VERSION = 1;
  const DEFAULT_PROJECT_CODE = 'default-project';

  const toText = (value, fallback = '') => {
    const text = String(value ?? '').trim();
    return text || fallback;
  };

  const toNumberOr = (value, fallback = 0) => {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : fallback;
  };

  const toBoolean = (value, fallback = false) => {
    if (typeof value === 'boolean') return value;
    if (value === 'true' || value === '1' || value === 1) return true;
    if (value === 'false' || value === '0' || value === 0) return false;
    return fallback;
  };

  const ensureObject = (value) => (value && typeof value === 'object' ? value : {});
  const ensureArray = (value) => (Array.isArray(value) ? value : []);

  const clonePlain = (value, fallback = null) => {
    try {
      return JSON.parse(JSON.stringify(value));
    } catch (error) {
      return fallback;
    }
  };

  const safeParse = (value, fallback) => {
    if (!value) return fallback;
    try {
      return JSON.parse(value);
    } catch (error) {
      return fallback;
    }
  };

  const hasLocalStorage = (() => {
    try {
      return typeof global.localStorage !== 'undefined';
    } catch (error) {
      return false;
    }
  })();

  const nowIso = () => new Date().toISOString();
  const createId = (prefix = 'rule') => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

  const normalizeQuoteType = (value, fallback = 'project') => {
    const input = toText(value, fallback).toLowerCase();
    return input === 'change' ? 'change' : 'project';
  };

  const normalizeHarnessIds = (value) => {
    const rawList = Array.isArray(value)
      ? value
      : String(value ?? '')
        .split(/[\n,;，；\s]+/g);
    const seen = new Set();
    const results = [];
    rawList.forEach((item) => {
      const id = toText(item, '');
      if (!id || seen.has(id)) return;
      seen.add(id);
      results.push(id);
    });
    return results;
  };

  const DEFAULT_ROLES = Object.freeze([
    {
      roleCode: 'sales',
      roleName: '销售',
      owner: true,
      responsibilities: ['回收规则维护', '报价类型维护', '基线报价版本维护'],
      canEditRuleFields: ['feeType', 'carrierHarnessIds', 'recoveryCapSets', 'perSetAllocation', 'includeInUnitPrice', 'standalonePayment', 'isActive', 'isTemplateOnly', 'triggerCondition', 'note'],
    },
    {
      roleCode: 'harnessEngineer',
      roleName: '线束开发工程师',
      owner: true,
      responsibilities: ['BOM与线束主数据'],
      canEditRuleFields: [],
    },
    {
      roleCode: 'processEngineer',
      roleName: '工艺工程师',
      owner: true,
      responsibilities: ['工时和设备工装模具负荷'],
      canEditRuleFields: [],
    },
    {
      roleCode: 'packagingEngineer',
      roleName: '包装工程师',
      owner: true,
      responsibilities: ['包材价格与包装费用维护'],
      canEditRuleFields: ['feeType', 'note'],
    },
    {
      roleCode: 'procurement',
      roleName: '采购',
      owner: false,
      responsibilities: ['非默认参与包装费用填报'],
      canEditRuleFields: [],
    },
  ]);

  const DEFAULT_DATA_RESPONSIBILITY = Object.freeze([
    {
      fieldCode: 'salesRecoveryRule',
      fieldName: '销售回收规则',
      ownerRoleCode: 'sales',
      required: true,
      note: '由销售填写，系统不猜测',
    },
    {
      fieldCode: 'packagingCost',
      fieldName: '包装费用',
      ownerRoleCode: 'packagingEngineer',
      required: true,
      note: '默认由包装工程师填写，不需要采购介入',
    },
    {
      fieldCode: 'harnessLoad',
      fieldName: '单线束负荷',
      ownerRoleCode: 'processEngineer',
      required: true,
      note: '用于执行预演阶段按线束颗粒度分摊',
    },
  ]);

  const normalizeQuoteContext = (rawContext, fallbackContext = {}) => {
    const context = ensureObject(rawContext);
    const fallback = ensureObject(fallbackContext);
    const quoteType = normalizeQuoteType(context.quoteType, fallback.quoteType || 'project');
    const baselineQuoteVersion = toText(context.baselineQuoteVersion, fallback.baselineQuoteVersion || '');
    const baselineRequired = quoteType === 'change';
    return {
      quoteType,
      quoteVersion: toText(context.quoteVersion, fallback.quoteVersion || ''),
      quoteName: toText(context.quoteName, fallback.quoteName || ''),
      baselineQuoteVersion,
      baselineRequired,
      baselineReady: !baselineRequired || Boolean(baselineQuoteVersion),
      effectiveDate: toText(context.effectiveDate, fallback.effectiveDate || ''),
      note: toText(context.note, fallback.note || ''),
    };
  };

  const normalizeRule = (rawRule, index = 0) => {
    const rule = ensureObject(rawRule);
    const normalizedAmount = toNumberOr(rule.totalAmount, 0);
    const normalizedPerSet = toNumberOr(rule.perSetAllocation, 0);
    const isTemplateOnly = toBoolean(rule.isTemplateOnly, false);
    const hasNonZeroAmount = Math.abs(normalizedAmount) > 0 || Math.abs(normalizedPerSet) > 0;
    const fallbackActive = !isTemplateOnly && hasNonZeroAmount;
    const carrierHarnessIds = normalizeHarnessIds(rule.carrierHarnessIds);
    return {
      ruleId: toText(rule.ruleId, createId(`rule${index + 1}`)),
      feeType: toText(rule.feeType, 'oneTime'),
      feeTypeLabel: toText(rule.feeTypeLabel, ''),
      carrierHarnessIds,
      recoveryCapSets: Math.max(0, toNumberOr(rule.recoveryCapSets, 0)),
      totalAmount: normalizedAmount,
      perSetAllocation: normalizedPerSet,
      includeInUnitPrice: toBoolean(rule.includeInUnitPrice, false),
      standalonePayment: toBoolean(rule.standalonePayment, false),
      isActive: toBoolean(rule.isActive, fallbackActive),
      isTemplateOnly,
      triggerCondition: toText(rule.triggerCondition, ''),
      note: toText(rule.note, ''),
      effectiveFrom: toText(rule.effectiveFrom, ''),
      effectiveTo: toText(rule.effectiveTo, ''),
      createdAt: toText(rule.createdAt, nowIso()),
      updatedAt: toText(rule.updatedAt, nowIso()),
    };
  };

  const normalizeTask = (rawTask, index = 0) => {
    const task = ensureObject(rawTask);
    const timestamp = nowIso();
    return {
      id: toText(task.id || task.taskId, createId(`task${index + 1}`)),
      title: toText(task.title, ''),
      owner: toText(task.owner, ''),
      due: toText(task.due, ''),
      status: toText(task.status, ''),
      note: toText(task.note, ''),
      createdAt: toText(task.createdAt, timestamp),
      updatedAt: toText(task.updatedAt, timestamp),
    };
  };

  const normalizeTrackingRecord = (rawRecord, index = 0) => {
    const record = ensureObject(rawRecord);
    const timestamp = nowIso();
    return {
      harnessId: toText(record.harnessId || record.lineId || record.harnessNo, ''),
      harnessName: toText(record.harnessName || record.lineName || record.name, ''),
      deliveredSets: Math.max(0, toNumberOr(record.deliveredSets ?? record.deliveredUnits ?? record.shippedSets, 0)),
      recoveredAmount: Math.max(0, toNumberOr(record.recoveredAmount, 0)),
      remainingAmount: Math.max(0, toNumberOr(record.remainingAmount, 0)),
      createdAt: toText(record.createdAt, timestamp),
      updatedAt: toText(record.updatedAt, timestamp),
    };
  };

  const normalizeTasks = (rawTasks) => ensureArray(rawTasks).map((task, index) => normalizeTask(task, index));
  const normalizeTrackingRecords = (rawRecords) => ensureArray(rawRecords).map((record, index) => normalizeTrackingRecord(record, index));

  const normalizeRoles = (rawRoles) => {
    const merged = ensureArray(rawRoles).length ? ensureArray(rawRoles) : DEFAULT_ROLES;
    return merged.map((role) => {
      const source = ensureObject(role);
      return {
        roleCode: toText(source.roleCode, createId('role')),
        roleName: toText(source.roleName, ''),
        owner: toBoolean(source.owner, false),
        responsibilities: ensureArray(source.responsibilities).map((item) => toText(item, '')).filter(Boolean),
        canEditRuleFields: ensureArray(source.canEditRuleFields).map((item) => toText(item, '')).filter(Boolean),
      };
    });
  };

  const normalizeDataResponsibility = (rawRows) => {
    const merged = ensureArray(rawRows).length ? ensureArray(rawRows) : DEFAULT_DATA_RESPONSIBILITY;
    return merged.map((row) => {
      const source = ensureObject(row);
      return {
        fieldCode: toText(source.fieldCode, createId('field')),
        fieldName: toText(source.fieldName, ''),
        ownerRoleCode: toText(source.ownerRoleCode, ''),
        required: toBoolean(source.required, true),
        note: toText(source.note, ''),
      };
    });
  };

  const buildRuleSummary = (rules) => {
    const safeRules = ensureArray(rules);
    let activeCount = 0;
    let templateCount = 0;
    let effectiveCount = 0;
    safeRules.forEach((rule) => {
      if (rule.isActive) activeCount += 1;
      if (rule.isTemplateOnly) templateCount += 1;
      if (rule.isActive && !rule.isTemplateOnly) effectiveCount += 1;
    });
    return {
      totalRules: safeRules.length,
      activeRules: activeCount,
      templateRules: templateCount,
      effectiveRules: effectiveCount,
    };
  };

  const buildDefaultSnapshot = (options = {}) => {
    const quoteContext = normalizeQuoteContext({
      quoteType: options.defaultQuoteType || 'project',
      baselineQuoteVersion: options.defaultBaselineQuoteVersion || '',
    });
    const createdAt = nowIso();
    return {
      schemaVersion: toNumberOr(options.schemaVersion, DEFAULT_SCHEMA_VERSION),
      projectCode: toText(options.projectCode, DEFAULT_PROJECT_CODE),
      quoteType: quoteContext.quoteType,
      baselineQuoteVersion: quoteContext.baselineQuoteVersion,
      quoteContext,
      rules: [],
      tasks: [],
      roles: normalizeRoles(options.roles),
      dataResponsibility: normalizeDataResponsibility(options.dataResponsibility),
      recoveryTracking: [],
      summary: buildRuleSummary([]),
      createdAt,
      updatedAt: createdAt,
    };
  };

  const normalizeSnapshot = (rawSnapshot, options = {}, fallbackSnapshot = null) => {
    const raw = ensureObject(rawSnapshot);
    const fallback = ensureObject(fallbackSnapshot);
    const defaults = buildDefaultSnapshot(options);
    const quoteContext = normalizeQuoteContext(raw.quoteContext || raw, fallback.quoteContext || defaults.quoteContext);
    const rules = ensureArray(raw.rules).map((rule, index) => normalizeRule(rule, index));
    const tasks = normalizeTasks(raw.tasks || fallback.tasks || defaults.tasks);
    const recoveryTracking = normalizeTrackingRecords(raw.recoveryTracking || fallback.recoveryTracking || defaults.recoveryTracking);
    const createdAt = toText(raw.createdAt, toText(fallback.createdAt, defaults.createdAt));
    const normalized = {
      schemaVersion: toNumberOr(raw.schemaVersion, toNumberOr(fallback.schemaVersion, defaults.schemaVersion)),
      projectCode: toText(raw.projectCode, toText(fallback.projectCode, defaults.projectCode)),
      quoteType: quoteContext.quoteType,
      baselineQuoteVersion: quoteContext.baselineQuoteVersion,
      quoteContext,
      rules,
      tasks,
      roles: normalizeRoles(raw.roles || fallback.roles || defaults.roles),
      dataResponsibility: normalizeDataResponsibility(raw.dataResponsibility || fallback.dataResponsibility || defaults.dataResponsibility),
      summary: buildRuleSummary(rules),
      recoveryTracking,
      createdAt,
      updatedAt: nowIso(),
    };
    return normalized;
  };

  const createStorageDriver = (storageKey) => {
    let memorySnapshot = null;
    const read = () => {
      if (hasLocalStorage) {
        try {
          return safeParse(global.localStorage.getItem(storageKey), null);
        } catch (error) {
          return clonePlain(memorySnapshot, null);
        }
      }
      return clonePlain(memorySnapshot, null);
    };
    const write = (snapshot) => {
      const payload = JSON.stringify(snapshot);
      if (hasLocalStorage) {
        try {
          global.localStorage.setItem(storageKey, payload);
          return true;
        } catch (error) {
          memorySnapshot = clonePlain(snapshot, null);
          return false;
        }
      }
      memorySnapshot = clonePlain(snapshot, null);
      return true;
    };
    const clear = () => {
      memorySnapshot = null;
      if (hasLocalStorage) {
        try {
          global.localStorage.removeItem(storageKey);
        } catch (error) {
          // ignore storage clear errors
        }
      }
    };
    return { read, write, clear };
  };

  function create(options = {}) {
    const storageKey = toText(options.storageKey, STORAGE_KEY);
    const storage = createStorageDriver(storageKey);
    let snapshot = normalizeSnapshot(storage.read() || buildDefaultSnapshot(options), options);
    storage.write(snapshot);

    const load = () => {
      snapshot = normalizeSnapshot(storage.read() || snapshot, options, snapshot);
      storage.write(snapshot);
      return clonePlain(snapshot, buildDefaultSnapshot(options));
    };

    const save = (payload = {}) => {
      const merged = {
        ...snapshot,
        ...ensureObject(payload),
      quoteContext: ensureObject(payload).quoteContext
        ? { ...snapshot.quoteContext, ...ensureObject(payload.quoteContext) }
        : snapshot.quoteContext,
      rules: Object.prototype.hasOwnProperty.call(ensureObject(payload), 'rules') ? ensureArray(payload.rules) : snapshot.rules,
      roles: Object.prototype.hasOwnProperty.call(ensureObject(payload), 'roles') ? ensureArray(payload.roles) : snapshot.roles,
      dataResponsibility: Object.prototype.hasOwnProperty.call(ensureObject(payload), 'dataResponsibility')
        ? ensureArray(payload.dataResponsibility)
        : snapshot.dataResponsibility,
      tasks: Object.prototype.hasOwnProperty.call(ensureObject(payload), 'tasks') ? ensureArray(payload.tasks) : snapshot.tasks,
      recoveryTracking: Object.prototype.hasOwnProperty.call(ensureObject(payload), 'recoveryTracking')
        ? ensureArray(payload.recoveryTracking)
        : snapshot.recoveryTracking,
    };
      snapshot = normalizeSnapshot(merged, options, snapshot);
      storage.write(snapshot);
      return clonePlain(snapshot, buildDefaultSnapshot(options));
    };

    const reset = () => {
      storage.clear();
      snapshot = buildDefaultSnapshot(options);
      storage.write(snapshot);
      return clonePlain(snapshot, buildDefaultSnapshot(options));
    };

    const getSnapshot = () => clonePlain(snapshot, buildDefaultSnapshot(options));

    const setQuoteContext = (context = {}) => {
      const mergedContext = normalizeQuoteContext(context, snapshot.quoteContext);
      snapshot = normalizeSnapshot({
        ...snapshot,
        ...mergedContext,
        quoteContext: { ...snapshot.quoteContext, ...mergedContext },
      }, options, snapshot);
      storage.write(snapshot);
      return clonePlain(snapshot, buildDefaultSnapshot(options));
    };

    const upsertTask = (task = {}) => {
      const incoming = ensureObject(task);
      const taskId = toText(incoming.id || incoming.taskId, '');
      const nextTasks = ensureArray(snapshot.tasks).slice();
      const index = taskId ? nextTasks.findIndex((item) => item.id === taskId) : -1;
      if (index >= 0) {
        nextTasks[index] = normalizeTask({
          ...nextTasks[index],
          ...incoming,
          id: nextTasks[index].id,
          createdAt: nextTasks[index].createdAt,
          updatedAt: nowIso(),
        }, index);
      } else {
        nextTasks.push(normalizeTask({
          ...incoming,
          createdAt: nowIso(),
          updatedAt: nowIso(),
        }, nextTasks.length));
      }
      snapshot = normalizeSnapshot({ ...snapshot, tasks: nextTasks }, options, snapshot);
      storage.write(snapshot);
      return clonePlain(snapshot, buildDefaultSnapshot(options));
    };

    const removeTask = (taskId) => {
      const normalizedTaskId = toText(taskId, '');
      if (!normalizedTaskId) return false;
      const nextTasks = ensureArray(snapshot.tasks).filter((task) => task.id !== normalizedTaskId);
      if (nextTasks.length === ensureArray(snapshot.tasks).length) {
        return false;
      }
      snapshot = normalizeSnapshot({ ...snapshot, tasks: nextTasks }, options, snapshot);
      storage.write(snapshot);
      return true;
    };

    const upsertTrackingRecord = (record = {}) => {
      const incoming = ensureObject(record);
      const harnessId = toText(incoming.harnessId || incoming.lineId || incoming.harnessNo, '');
      if (!harnessId) return clonePlain(snapshot, buildDefaultSnapshot(options));
      const nextRecords = ensureArray(snapshot.recoveryTracking).slice();
      const index = nextRecords.findIndex((item) => item.harnessId === harnessId);
      if (index >= 0) {
        nextRecords[index] = normalizeTrackingRecord({
          ...nextRecords[index],
          ...incoming,
          harnessId: nextRecords[index].harnessId,
          createdAt: nextRecords[index].createdAt,
          updatedAt: nowIso(),
        }, index);
      } else {
        nextRecords.push(normalizeTrackingRecord({
          ...incoming,
          harnessId,
          createdAt: nowIso(),
          updatedAt: nowIso(),
        }, nextRecords.length));
      }
      snapshot = normalizeSnapshot({ ...snapshot, recoveryTracking: nextRecords }, options, snapshot);
      storage.write(snapshot);
      return clonePlain(snapshot, buildDefaultSnapshot(options));
    };

    const removeTrackingRecord = (harnessId) => {
      const normalizedHarnessId = toText(harnessId, '');
      if (!normalizedHarnessId) return false;
      const nextRecords = ensureArray(snapshot.recoveryTracking).filter((record) => record.harnessId !== normalizedHarnessId);
      if (nextRecords.length === ensureArray(snapshot.recoveryTracking).length) {
        return false;
      }
      snapshot = normalizeSnapshot({ ...snapshot, recoveryTracking: nextRecords }, options, snapshot);
      storage.write(snapshot);
      return true;
    };

    const upsertRule = (rule = {}) => {
      const incoming = ensureObject(rule);
      const ruleId = toText(incoming.ruleId, '');
      const nextRules = ensureArray(snapshot.rules).slice();
      const index = ruleId ? nextRules.findIndex((item) => item.ruleId === ruleId) : -1;
      if (index >= 0) {
        const mergedRule = normalizeRule({
          ...nextRules[index],
          ...incoming,
          ruleId: nextRules[index].ruleId,
          createdAt: nextRules[index].createdAt,
          updatedAt: nowIso(),
        }, index);
        nextRules[index] = mergedRule;
      } else {
        nextRules.push(normalizeRule({ ...incoming, createdAt: nowIso(), updatedAt: nowIso() }, nextRules.length));
      }
      snapshot = normalizeSnapshot({ ...snapshot, rules: nextRules }, options, snapshot);
      storage.write(snapshot);
      return clonePlain(snapshot, buildDefaultSnapshot(options));
    };

    const removeRule = (ruleId) => {
      const normalizedRuleId = toText(ruleId, '');
      if (!normalizedRuleId) return false;
      const nextRules = ensureArray(snapshot.rules).filter((rule) => rule.ruleId !== normalizedRuleId);
      if (nextRules.length === ensureArray(snapshot.rules).length) {
        return false;
      }
      snapshot = normalizeSnapshot({ ...snapshot, rules: nextRules }, options, snapshot);
      storage.write(snapshot);
      return true;
    };

    const listRules = (filters = {}) => {
      const normalizedFilters = ensureObject(filters);
      const activeOnly = toBoolean(normalizedFilters.activeOnly, false);
      const includeTemplate = toBoolean(normalizedFilters.includeTemplate, true);
      const feeTypes = normalizeHarnessIds(normalizedFilters.feeTypes || normalizedFilters.feeType || []);
      const harnessIds = normalizeHarnessIds(normalizedFilters.harnessIds || []);
      const list = ensureArray(snapshot.rules).filter((rule) => {
        if (activeOnly && !rule.isActive) return false;
        if (!includeTemplate && rule.isTemplateOnly) return false;
        if (feeTypes.length && !feeTypes.includes(rule.feeType)) return false;
        if (harnessIds.length) {
          const overlap = rule.carrierHarnessIds.some((id) => harnessIds.includes(id));
          if (!overlap) return false;
        }
        return true;
      });
      return clonePlain(list, []);
    };

    return {
      load,
      save,
      reset,
      getSnapshot,
      upsertTask,
      removeTask,
      upsertTrackingRecord,
      removeTrackingRecord,
      upsertRule,
      removeRule,
      setQuoteContext,
      listRules,
    };
  }

  global.G281SalesRuleRepo = {
    create,
  };

  /*
   * Exported API:
   * window.G281SalesRuleRepo.create(options?) => {
   *   load, save, reset, getSnapshot, upsertRule, removeRule, setQuoteContext, listRules
   * }
   */
})(window);
