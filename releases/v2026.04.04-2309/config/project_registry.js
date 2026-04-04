/**
 * config/project_registry.js
 * Multi-project registry with localStorage persistence.
 */
;(function (root) {
  'use strict';

  const STORAGE_KEY = 'g281_project_registry';
  const ACTIVE_PROJECT_KEY = 'g281_active_project';

  let registry = Object.create(null);
  let activeProjectCode = null;
  let changeListeners = [];

  function safeParse(raw, fallback) {
    if (!raw) return fallback;
    try {
      return JSON.parse(raw);
    } catch (_) {
      return fallback;
    }
  }

  function clonePlain(value, fallback) {
    try {
      return JSON.parse(JSON.stringify(value));
    } catch (_) {
      return fallback;
    }
  }

  function normalizeProjectCode(projectCode, config) {
    const raw = String(
      projectCode
        || (config && (config.projectCode || config.projectId))
        || ''
    ).trim();
    return raw || '';
  }

  function normalizeProjectConfig(projectCode, config, existing) {
    const normalizedCode = normalizeProjectCode(projectCode, config);
    if (!normalizedCode) {
      throw new Error('[ProjectRegistry] projectCode or config.projectId is required');
    }
    if (!config || typeof config !== 'object') {
      throw new Error('[ProjectRegistry] config must be an object');
    }

    const normalized = clonePlain(config, {}) || {};
    normalized.projectCode = normalizedCode;
    normalized.projectId = String(normalized.projectId || normalizedCode).trim() || normalizedCode;

    if (!String(normalized.projectName || '').trim()) {
      throw new Error('[ProjectRegistry] config.projectName is required');
    }

    normalized._registeredAt = existing?._registeredAt || normalized._registeredAt || new Date().toISOString();
    normalized._locked = Boolean(existing?._locked || normalized._locked);
    normalized._lockedAt = existing?._lockedAt || normalized._lockedAt || null;
    normalized._changeLog = Array.isArray(existing?._changeLog)
      ? existing._changeLog.slice()
      : Array.isArray(normalized._changeLog)
        ? normalized._changeLog.slice()
        : [];

    return normalized;
  }

  function saveActiveSnapshot(config) {
    if (!root.ConfigLoader || typeof root.ConfigLoader.saveToStorage !== 'function') {
      return;
    }
    try {
      root.ConfigLoader.saveToStorage(config);
    } catch (error) {
      console.warn('[ProjectRegistry] Failed to persist config snapshot:', error);
    }
  }

  function loadRegistry() {
    const rawRegistry = safeParse(root.localStorage && localStorage.getItem(STORAGE_KEY), {});
    registry = Object.create(null);

    Object.keys(rawRegistry || {}).forEach((key) => {
      try {
        const normalized = normalizeProjectConfig(key, rawRegistry[key], rawRegistry[key]);
        registry[normalized.projectCode] = normalized;
      } catch (error) {
        console.warn('[ProjectRegistry] Skip invalid project record:', key, error);
      }
    });

    try {
      activeProjectCode = localStorage.getItem(ACTIVE_PROJECT_KEY) || null;
    } catch (_) {
      activeProjectCode = null;
    }

    if (activeProjectCode && !registry[activeProjectCode]) {
      activeProjectCode = null;
    }
  }

  function saveRegistry() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(registry));
      if (activeProjectCode) {
        localStorage.setItem(ACTIVE_PROJECT_KEY, activeProjectCode);
      } else {
        localStorage.removeItem(ACTIVE_PROJECT_KEY);
      }
    } catch (error) {
      console.warn('[ProjectRegistry] Failed to persist registry:', error);
    }
  }

  // Compatibility/bootstrap path: ensure the project exists and refresh
  // the stored snapshot if we recovered a newer config from storage.
  function registerProject(projectCode, config) {
    const normalizedCode = normalizeProjectCode(projectCode, config);
    const existing = registry[normalizedCode] || null;
    const normalized = normalizeProjectConfig(normalizedCode, config, existing);

    registry[normalizedCode] = normalized;
    saveActiveSnapshot(normalized);
    saveRegistry();
    return normalized;
  }

  // Strict create path for the new-project wizard. Existing project codes
  // must fail fast instead of silently overwriting registry records.
  function registerNewProject(projectCode, config) {
    const normalizedCode = normalizeProjectCode(projectCode, config);
    if (!normalizedCode) {
      throw new Error('[ProjectRegistry] projectCode or config.projectId is required');
    }
    if (registry[normalizedCode]) {
      throw new Error("[ProjectRegistry] Project '" + normalizedCode + "' already exists");
    }
    return registerProject(normalizedCode, config);
  }

  function getProject(projectCode) {
    const normalizedCode = normalizeProjectCode(projectCode);
    return normalizedCode ? registry[normalizedCode] || null : null;
  }

  function listProjects() {
    return Object.keys(registry)
      .sort()
      .map((projectCode) => ({
        projectCode: projectCode,
        projectId: registry[projectCode].projectId || projectCode,
        projectName: registry[projectCode].projectName || projectCode,
        locked: Boolean(registry[projectCode]._locked),
        registeredAt: registry[projectCode]._registeredAt || null,
      }));
  }

  function notifyProjectChange(payload) {
    changeListeners.slice().forEach((listener) => {
      try {
        listener(payload);
      } catch (error) {
        console.error('[ProjectRegistry] listener error:', error);
      }
    });
  }

  function switchProject(projectCode) {
    const normalizedCode = normalizeProjectCode(projectCode);
    const config = registry[normalizedCode];
    if (!config) {
      throw new Error("[ProjectRegistry] Project '" + normalizedCode + "' not found");
    }

    const previousCode = activeProjectCode;
    activeProjectCode = normalizedCode;
    saveRegistry();
    saveActiveSnapshot(config);

    if (root.ConfigLoader && typeof root.ConfigLoader.load === 'function') {
      const result = root.ConfigLoader.load(config);
      if (result && Array.isArray(result.errors) && result.errors.length) {
        console.warn('[ProjectRegistry] ConfigLoader validation warnings:', result.errors);
      }
    }

    notifyProjectChange({
      from: previousCode,
      to: normalizedCode,
      config: config,
    });

    return config;
  }

  function getActiveCode() {
    return activeProjectCode;
  }

  function getActiveConfig() {
    return activeProjectCode ? registry[activeProjectCode] || null : null;
  }

  function lockProject(projectCode) {
    const normalizedCode = normalizeProjectCode(projectCode);
    const config = registry[normalizedCode];
    if (!config) {
      throw new Error("[ProjectRegistry] Project '" + normalizedCode + "' not found");
    }
    config._locked = true;
    config._lockedAt = config._lockedAt || new Date().toISOString();
    saveActiveSnapshot(config);
    saveRegistry();
    return config;
  }

  function requestChange(projectCode, changeRequest) {
    const normalizedCode = normalizeProjectCode(projectCode);
    const config = registry[normalizedCode];
    if (!config) {
      throw new Error("[ProjectRegistry] Project '" + normalizedCode + "' not found");
    }
    if (!changeRequest || !changeRequest.reason) {
      throw new Error('[ProjectRegistry] changeRequest.reason is required');
    }
    if (config._locked && !changeRequest.requestedBy) {
      throw new Error(
        "[ProjectRegistry] Project '" + normalizedCode + "' is locked. Provide changeRequest.requestedBy."
      );
    }

    const fields = Array.isArray(changeRequest.fields) ? changeRequest.fields.slice() : [];
    const newValues = changeRequest.newValues && typeof changeRequest.newValues === 'object'
      ? changeRequest.newValues
      : {};
    const previousValues = {};

    fields.forEach((field) => {
      previousValues[field] = clonePlain(config[field], config[field]);
    });

    Object.keys(newValues).forEach((key) => {
      config[key] = clonePlain(newValues[key], newValues[key]);
    });

    const changeRecord = {
      id: 'CHG-' + Date.now().toString(36),
      timestamp: new Date().toISOString(),
      reason: changeRequest.reason,
      fields: fields,
      previousValues: previousValues,
      newValues: clonePlain(newValues, {}),
      requestedBy: changeRequest.requestedBy || 'unknown',
      status: 'applied',
      wasLocked: Boolean(config._locked),
    };

    config._changeLog = Array.isArray(config._changeLog) ? config._changeLog : [];
    config._changeLog.push(changeRecord);

    saveActiveSnapshot(config);
    saveRegistry();
    return changeRecord;
  }

  function getChangeLog(projectCode) {
    const normalizedCode = normalizeProjectCode(projectCode);
    return (registry[normalizedCode] && registry[normalizedCode]._changeLog) || [];
  }

  function onProjectChange(listener) {
    if (typeof listener === 'function' && !changeListeners.includes(listener)) {
      changeListeners.push(listener);
    }
  }

  function offProjectChange(listener) {
    changeListeners = changeListeners.filter((item) => item !== listener);
  }

  function getDbName(projectCode) {
    const normalizedCode = normalizeProjectCode(projectCode || activeProjectCode, { projectId: 'default' }) || 'default';
    return 'g281-bom-store-' + normalizedCode.toLowerCase();
  }

  loadRegistry();

  root.G281ProjectRegistry = {
    registerProject: registerProject,
    registerNewProject: registerNewProject,
    getProject: getProject,
    listProjects: listProjects,
    switchProject: switchProject,
    getActiveCode: getActiveCode,
    getActiveConfig: getActiveConfig,
    lockProject: lockProject,
    requestChange: requestChange,
    getChangeLog: getChangeLog,
    onProjectChange: onProjectChange,
    offProjectChange: offProjectChange,
    getDbName: getDbName,
  };
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this);
