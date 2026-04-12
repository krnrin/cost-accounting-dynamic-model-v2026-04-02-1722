(function (global) {
  'use strict';

  const DEFAULT_PROJECT_CODE = 'default-project';

  const clonePlain = (value, fallback = null) => {
    try {
      return JSON.parse(JSON.stringify(value));
    } catch (error) {
      return fallback;
    }
  };

  const toText = (value, fallback = '') => {
    const text = String(value ?? '').trim();
    return text || fallback;
  };

  const ensureObject = (value) => (value && typeof value === 'object' ? value : {});

  const getDb = () => {
    if (!global.G281BomDb) {
      throw new Error('[G281ScenarioRepo] window.G281BomDb is not initialized');
    }
    return global.G281BomDb;
  };

  const createId = (prefix) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

  const normalizeBindings = (bindings = {}) =>
    Object.entries(ensureObject(bindings)).reduce((acc, [factorType, versionId]) => {
      const normalized = toText(versionId, '');
      if (factorType && normalized) {
        acc[factorType] = normalized;
      }
      return acc;
    }, {});

  function create(options = {}) {
    const projectCode = toText(options.projectCode, DEFAULT_PROJECT_CODE);

    const init = async () => {
      await getDb().init(options.db || {});
      return { projectCode };
    };

    const listScenarios = async (filter = {}) => {
      await init();
      const scopeProject = toText(filter.projectCode, projectCode);
      const records = await getDb().getAllRecords('scenarios');
      return records
        .filter((record) => !scopeProject || record.projectCode === scopeProject)
        .sort((left, right) => String(right.updatedAt || '').localeCompare(String(left.updatedAt || '')));
    };

    const getScenario = async (scenarioId) => {
      if (!scenarioId) return null;
      await init();
      const record = await getDb().getRecord('scenarios', scenarioId);
      if (!record) return null;
      const bindings = await getDb().getAllByIndex('scenarioBindings', 'scenarioId', scenarioId);
      return {
        ...record,
        bindings: bindings.reduce((acc, item) => {
          if (item.factorType && item.versionId) {
            acc[item.factorType] = item.versionId;
          }
          return acc;
        }, {}),
      };
    };

    const saveScenario = async (payload = {}) => {
      await init();

      const scenarioId = toText(payload.scenarioId, createId('scenario'));
      const existing = await getScenario(scenarioId);
      const now = new Date().toISOString();
      const bindings = normalizeBindings(payload.bindings || payload.state || {});
      const record = {
        scenarioId,
        name: toText(payload.name, payload.scenarioName || scenarioId),
        scenarioName: toText(payload.scenarioName, payload.name || scenarioId),
        projectCode: toText(payload.projectCode, projectCode),
        note: toText(payload.note, ''),
        draft: clonePlain(payload.draft, {}),
        state: clonePlain(payload.state, {}),
        summary: clonePlain(payload.summary, {}),
        createdAt: existing?.createdAt || now,
        updatedAt: now,
      };

      await getDb().putRecord('scenarios', record);
      await getDb().deleteByIndex('scenarioBindings', 'scenarioId', scenarioId);

      const bindingRecords = Object.entries(bindings).map(([factorType, versionId]) => ({
        bindingId: `${scenarioId}::${factorType}`,
        scenarioId,
        factorType,
        versionId,
        updatedAt: now,
      }));

      if (bindingRecords.length) {
        await getDb().putMany('scenarioBindings', bindingRecords);
      }

      return getScenario(scenarioId);
    };

    const deleteScenario = async (scenarioId) => {
      if (!scenarioId) return false;
      await init();
      await getDb().deleteByIndex('scenarioBindings', 'scenarioId', scenarioId);
      await getDb().deleteRecord('scenarios', scenarioId);
      return true;
    };

    return {
      init,
      listScenarios,
      getScenario,
      saveScenario,
      deleteScenario,
    };
  }

  global.G281ScenarioRepo = {
    create,
    normalizeBindings,
  };
})(window);
