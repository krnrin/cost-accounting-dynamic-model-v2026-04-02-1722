/**
 * shared/app_bootstrap.js
 * Shared bootstrap for multi-project pages.
 */
;(function (root) {
  'use strict';

  function toText(value, fallback) {
    const text = String(value == null ? '' : value).trim();
    return text || (fallback || '');
  }

  function ensureRegistry() {
    if (!root.G281ProjectRegistry) {
      throw new Error('[Bootstrap] G281ProjectRegistry is required');
    }
    return root.G281ProjectRegistry;
  }

  async function loadJson(path) {
    const response = await fetch(path, { cache: 'no-store' });
    if (!response.ok) {
      throw new Error('[Bootstrap] Failed to load ' + path);
    }
    return response.json();
  }

  function normalizeOptions(options) {
    const input = options || {};
    return {
      preferredProjectCode: String(
        input.preferredProjectCode
          || input.projectCode
          || ''
      ).trim(),
      defaultProjectCode: String(
        input.defaultProjectCode
          || input.defaultCode
          || input.projectId
          || ''
      ).trim(),
      defaultConfigPath: input.defaultProjectConfigPath || input.defaultConfigPath || input.configPath || '../config/g281.project.json',
      mountNav: input.mountNav !== false,
      navOptions: input.navOptions || {},
      lockDefault: input.lockDefaultProject !== false && input.lockDefault !== false,
      initIdb: input.initIdb !== false && input.initDb !== false && input.initBomDb !== false,
      runSchema: input.runSchema !== false && input.runSchemaMigrator !== false,
    };
  }

  function resolveStatusElement(statusElement) {
    if (!statusElement) {
      return null;
    }
    if (typeof statusElement === 'string') {
      if (!root.document || typeof root.document.getElementById !== 'function') {
        return null;
      }
      return root.document.getElementById(statusElement);
    }
    if (typeof statusElement === 'object' && statusElement) {
      return statusElement;
    }
    return null;
  }

  function normalizePageOptions(options) {
    const input = options || {};
    const initOptions = Object.assign({}, input.initOptions || {});

    if (input.defaultProjectCode != null && initOptions.defaultProjectCode == null) {
      initOptions.defaultProjectCode = input.defaultProjectCode;
    }
    if (input.defaultConfigPath != null && initOptions.defaultConfigPath == null) {
      initOptions.defaultConfigPath = input.defaultConfigPath;
    }
    if (input.initIdb != null && initOptions.initIdb == null) {
      initOptions.initIdb = input.initIdb;
    }
    if (input.runSchema != null && initOptions.runSchema == null) {
      initOptions.runSchema = input.runSchema;
    }

    return {
      initOptions: initOptions,
      statusElement: resolveStatusElement(
        input.statusElement || input.statusElementId || input.statusId
      ),
      failureHtml: String(input.failureHtml || '').trim(),
    };
  }

  function mountPageChrome(options) {
    const opts = options || {};
    const registry = root.G281ProjectRegistry;
    const activeConfig = registry && typeof registry.getActiveConfig === 'function'
      ? registry.getActiveConfig()
      : null;
    const activeCode = registry && typeof registry.getActiveCode === 'function'
      ? registry.getActiveCode()
      : null;

    if (root.G281Nav && typeof root.G281Nav.mountNavBar === 'function' && opts.mountNav !== false) {
      root.G281Nav.mountNavBar(Object.assign({}, opts.navOptions || {}, {
        projectName: activeConfig && activeConfig.projectName,
      }));
    }
    return {
      repo: typeof root.G281Repo !== 'undefined' ? root.G281Repo : null,
      activeCode: activeCode || null,
      activeConfig: activeConfig || null,
    };
  }

  function applyFailureStatus(statusElement, failureHtml) {
    if (!statusElement || !failureHtml) {
      return;
    }
    statusElement.innerHTML = failureHtml;
  }

  function normalizeProjectCode(projectCode, config, fallbackCode) {
    return toText(
      projectCode
      || (config && (config.projectCode || config.projectId))
      || fallbackCode
      || '',
      ''
    );
  }

  function normalizeProjectConfig(projectCode, rawConfig) {
    const source = rawConfig && typeof rawConfig === 'object' ? rawConfig : {};
    const code = normalizeProjectCode(projectCode, source, 'PROJECT');
    return Object.assign({}, source, {
      projectId: toText(source.projectId, code),
      projectCode: code,
      projectName: toText(source.projectName, code),
    });
  }

  function registerNormalizedProject(registry, projectCode, rawConfig) {
    const normalizedConfig = normalizeProjectConfig(projectCode, rawConfig);
    const code = normalizedConfig.projectCode;

    if (registry.getProject(code)) {
      return registry.getProject(code);
    }

    return registry.registerProject(code, normalizedConfig);
  }

  function restoreProjectFromStorage(registry, preferredProjectCode) {
    if (!root.ConfigLoader || typeof root.ConfigLoader.loadFromStorage !== 'function') {
      return null;
    }

    const candidateCodes = [];
    const preferredCode = toText(preferredProjectCode);
    const activeCode = toText(registry.getActiveCode && registry.getActiveCode());

    if (preferredCode) {
      candidateCodes.push(preferredCode);
    }
    if (activeCode && candidateCodes.indexOf(activeCode) === -1) {
      candidateCodes.push(activeCode);
    }

    for (let index = 0; index < candidateCodes.length; index += 1) {
      const code = candidateCodes[index];
      try {
        const loaded = root.ConfigLoader.loadFromStorage(code);
        if (loaded && loaded.config) {
          return registerNormalizedProject(registry, code, loaded.config);
        }
      } catch (error) {
        console.warn('[Bootstrap] failed to restore project from storage:', code, error);
      }
    }

    return null;
  }

  function resolveRestoredProjectCode(registry, preferredProjectCode) {
    const preferredCode = String(preferredProjectCode || '').trim();
    if (preferredCode && registry.getProject(preferredCode)) {
      return preferredCode;
    }

    const activeCode = String(registry.getActiveCode() || '').trim();
    if (activeCode && registry.getProject(activeCode)) {
      return activeCode;
    }

    if (root.ConfigLoader && typeof root.ConfigLoader.active === 'function') {
      const activeConfig = root.ConfigLoader.active();
      const configCode = activeConfig && String(activeConfig.projectCode || activeConfig.projectId || '').trim();
      if (configCode && registry.getProject(configCode)) {
        return configCode;
      }
    }

    return '';
  }

  async function ensureProjectStorage(projectCode, options) {
    const opts = normalizeOptions(options);
    const registry = ensureRegistry();

    if (!opts.initIdb || !root.G281BomDb || typeof root.G281BomDb.init !== 'function') {
      return null;
    }

    const dbState = await root.G281BomDb.init({
      dbName: registry.getDbName(projectCode),
    });

    if (
      opts.runSchema
      && root.G281SchemaMigrator
      && typeof root.G281SchemaMigrator.runPending === 'function'
    ) {
      await root.G281SchemaMigrator.runPending(root.G281BomDb);
    }

    return dbState;
  }

  async function ensureActiveProject(options) {
    const opts = normalizeOptions(options);
    const registry = ensureRegistry();
    let projectCode = resolveRestoredProjectCode(registry, opts.preferredProjectCode);
    let config = projectCode ? registry.getProject(projectCode) : null;
    let usedDefault = false;
    let restoredFromStorage = false;

    if (!config) {
      config = restoreProjectFromStorage(registry, opts.preferredProjectCode);
      if (config) {
        projectCode = normalizeProjectCode(projectCode, config, opts.preferredProjectCode);
        restoredFromStorage = true;
      }
    }

    if (!config) {
      projectCode = opts.defaultProjectCode;
      config = projectCode ? registry.getProject(projectCode) : null;
    }

    if (!config && projectCode) {
      const defaultConfig = await loadJson(opts.defaultConfigPath);
      config = registerNormalizedProject(registry, projectCode || opts.defaultProjectCode, defaultConfig);
      if (opts.lockDefault) {
        registry.lockProject(config.projectCode || config.projectId);
        config = registry.getProject(config.projectCode || config.projectId);
      }
      usedDefault = true;
      projectCode = normalizeProjectCode(projectCode, config, opts.defaultProjectCode);
    }

    if (!config || !projectCode) {
      return {
        activeCode: null,
        activeConfig: null,
        usedDefault: false,
        restoredFromStorage: restoredFromStorage,
        idb: null,
      };
    }

    projectCode = normalizeProjectCode(projectCode, config, opts.defaultProjectCode);
    const activeConfig = registry.switchProject(projectCode);
    const idbState = await ensureProjectStorage(projectCode, opts);

    return {
      activeCode: projectCode,
      activeConfig: activeConfig,
      usedDefault: usedDefault,
      restoredFromStorage: restoredFromStorage,
      idb: idbState,
    };
  }

  async function init(options) {
    const opts = normalizeOptions(options);
    const result = {
      project: false,
      idb: false,
      schema: false,
      repo: typeof root.G281Repo !== 'undefined' ? root.G281Repo : null,
      activeCode: null,
      activeConfig: null,
      usedDefault: false,
      restoredFromStorage: false,
    };

    try {
      const projectState = await ensureActiveProject(opts);
      result.project = Boolean(projectState.activeCode && projectState.activeConfig);
      result.activeCode = projectState.activeCode;
      result.activeConfig = projectState.activeConfig;
      result.usedDefault = projectState.usedDefault;
      result.restoredFromStorage = projectState.restoredFromStorage;
      result.idb = Boolean(projectState.idb);
      result.schema = Boolean(projectState.idb && root.G281SchemaMigrator && typeof root.G281SchemaMigrator.runPending === 'function');

      if (root.G281Nav && typeof root.G281Nav.mountNavBar === 'function' && opts.mountNav) {
        root.G281Nav.mountNavBar(Object.assign({}, opts.navOptions, {
          projectName: projectState.activeConfig && projectState.activeConfig.projectName,
        }));
      }
    } catch (error) {
      console.warn('[Bootstrap] init failed:', error);

      if (root.G281Nav && typeof root.G281Nav.mountNavBar === 'function' && opts.mountNav) {
        root.G281Nav.mountNavBar(opts.navOptions);
      }
    }

    result.repo = typeof root.G281Repo !== 'undefined' ? root.G281Repo : null;
    return result;
  }

  async function bootstrapPage(options) {
    const pageOpts = normalizePageOptions(options);
    const boot = await init(pageOpts.initOptions);

    if (!boot.project) {
      applyFailureStatus(pageOpts.statusElement, pageOpts.failureHtml);
    }

    return {
      boot: boot,
      statusElement: pageOpts.statusElement,
      repo: typeof root.G281Repo !== 'undefined' ? root.G281Repo : null,
      activeCode: boot.activeCode || null,
      activeConfig: boot.activeConfig || null,
    };
  }

  const bootstrapApi = {
    init: init,
    bootstrapPage: bootstrapPage,
    mountPageChrome: mountPageChrome,
    loadJson: loadJson,
    ensureActiveProject: ensureActiveProject,
    ensureProjectReady: ensureActiveProject,
  };

  root.G281Bootstrap = bootstrapApi;
  root.G281ProjectBootstrap = bootstrapApi;
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this);
