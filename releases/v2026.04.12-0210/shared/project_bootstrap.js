/**
 * shared/project_bootstrap.js
 * Unified project bootstrap for lifecycle workbench pages.
 */
;(function (root) {
  'use strict';

  var DEFAULT_CONFIG_PATH = '../config/sample-mini.project.json';
  var ROUTER_STATE_KEYS = [
    'projectId',
    'projectCode',
    'baselineKey',
    'versionKey',
    'stageKey',
    'lifecycleStageKey',
    'sourcePage',
    'targetPage',
    'comparisonKey',
    'releaseVersionTag',
    'releaseFolder',
    'smoke',
    'mode',
    'view',
  ];

  function text(value, fallback) {
    var output = String(value == null ? '' : value).trim();
    return output || (fallback || '');
  }

  function defaultConfigPath() {
    return DEFAULT_CONFIG_PATH;
  }

  function resolveRouterState() {
    if (!root.G281PageRouter || typeof root.G281PageRouter.resolveState !== 'function') {
      return {};
    }
    return root.G281PageRouter.resolveState();
  }

  function pickRouteState(source) {
    var input = source && typeof source === 'object' ? source : {};
    return ROUTER_STATE_KEYS.reduce(function (accumulator, key) {
      if (Object.prototype.hasOwnProperty.call(input, key) && input[key] != null && input[key] !== '') {
        accumulator[key] = input[key];
      }
      return accumulator;
    }, {});
  }

  function resolveLifecycleStageKey(state, fallback) {
    var input = state && typeof state === 'object' ? state : {};
    return text(
      input.lifecycleStageKey || input.stageKey || input.baselineKey || input.versionKey,
      fallback || ''
    );
  }

  function normalizeRouteState(state) {
    var routeState = pickRouteState(state);
    var baselineKey = text(routeState.baselineKey || routeState.versionKey, '');
    var lifecycleStageKey = resolveLifecycleStageKey(routeState, baselineKey);
    var normalized = Object.assign({}, routeState, {
      projectId: text(routeState.projectId || routeState.projectCode, ''),
      projectCode: text(routeState.projectCode || routeState.projectId, ''),
      baselineKey: baselineKey,
      versionKey: text(routeState.versionKey || baselineKey, baselineKey),
      lifecycleStageKey: lifecycleStageKey,
    });
    delete normalized.stageKey;
    return normalized;
  }

  function buildRouteState(baseState, overrides) {
    var base = normalizeRouteState(baseState == null ? resolveRouterState() : baseState);
    return normalizeRouteState(Object.assign({}, base, overrides || {}));
  }

  async function loadJson(path) {
    var response = await fetch(path, { cache: 'no-store' });
    if (!response.ok) {
      throw new Error('[ProjectBootstrap] Failed to load ' + path);
    }
    return response.json();
  }

  function normalizeOptions(options) {
    var input = options || {};
    return {
      defaultConfigPath: text(input.defaultConfigPath || input.configPath, DEFAULT_CONFIG_PATH),
      requireActiveProject: Boolean(input.requireActiveProject),
      projectId: text(input.projectId || input.projectCode, ''),
      runtime: input.runtime || null,
      activateResolvedProject: input.activateResolvedProject !== false,
      initIdb: input.initIdb !== false,
      runSchema: input.runSchema !== false,
    };
  }

  async function ensureProjectStorage(projectCode, registry, options) {
    if (!projectCode || !registry || !root.G281BomDb || typeof root.G281BomDb.init !== 'function') {
      return null;
    }
    if (options && options.initIdb === false) {
      return null;
    }
    var dbState = await root.G281BomDb.init({
      dbName: registry.getDbName(projectCode),
    });
    if (
      (!options || options.runSchema !== false)
      && root.G281SchemaMigrator
      && typeof root.G281SchemaMigrator.runPending === 'function'
    ) {
      await root.G281SchemaMigrator.runPending(root.G281BomDb);
    }
    return dbState;
  }

  function registerConfigIfNeeded(registry, config) {
    if (!registry || !config) return config;
    var projectCode = text(config.projectCode || config.projectId, '');
    if (!projectCode) return config;
    if (!registry.getProject(projectCode) && typeof registry.registerProject === 'function') {
      try {
        registry.registerProject(projectCode, config);
      } catch (error) {
        if (!registry.getProject(projectCode)) {
          throw error;
        }
      }
    }
    return registry.getProject(projectCode) || config;
  }

  async function resolve(options) {
    var opts = normalizeOptions(options);
    var runtime = opts.runtime || root.G281_RUNTIME || {};
    var routerState = normalizeRouteState(resolveRouterState());
    var requestedProjectId = text(opts.projectId || routerState.projectId || routerState.projectCode, '');
    var registry = root.G281ProjectRegistry || null;
    var config = await root.ConfigLoader.loadProjectConfig({
      projectId: requestedProjectId,
      defaultConfigPath: opts.defaultConfigPath,
      requireActiveProject: opts.requireActiveProject,
      runtime: runtime,
    });
    var projectCode = text(config && (config.projectCode || config.projectId), requestedProjectId || 'PROJECT');
    var activeCode = registry && typeof registry.getActiveCode === 'function'
      ? text(registry.getActiveCode(), '')
      : '';
    var projectSource = requestedProjectId
      ? 'requested-project'
      : (activeCode && activeCode === projectCode ? 'active-project' : 'default-config');

    if (registry && opts.activateResolvedProject) {
      registerConfigIfNeeded(registry, config);
      if (projectCode && typeof registry.switchProject === 'function' && registry.getActiveCode() !== projectCode) {
        try {
          registry.switchProject(projectCode);
        } catch (error) {
          registerConfigIfNeeded(registry, config);
          registry.switchProject(projectCode);
        }
      }
      await ensureProjectStorage(projectCode, registry, opts);
    }

    var repo = root.G281Repo && typeof root.G281Repo.init === 'function'
      ? root.G281Repo.init(runtime)
      : (root.G281Repo || null);

    return {
      runtime: runtime,
      repo: repo,
      config: config,
      projectCode: projectCode,
      projectSource: projectSource,
      routerState: routerState,
      defaultConfigPath: opts.defaultConfigPath,
    };
  }

  function mountPageChrome(options) {
    var opts = options || {};
    var config = opts.config || (root.ConfigLoader && typeof root.ConfigLoader.active === 'function'
      ? root.ConfigLoader.active()
      : null);
    var nav = root.G281Nav && typeof root.G281Nav.mountNavBar === 'function'
      ? root.G281Nav.mountNavBar(config && config.projectName)
      : null;

    if (nav && root.G281ProjectSwitcher && typeof root.G281ProjectSwitcher.render === 'function') {
      var host = nav.querySelector('.g281-nav-meta');
      if (host) {
        var mount = root.document.createElement('div');
        host.appendChild(mount);
        root.G281ProjectSwitcher.render(mount, {
          onSwitch: function () {
            root.location.reload();
          },
        });
      }
    }
    return nav;
  }

  async function ensureActiveProject(options) {
    return resolve(Object.assign({}, options || {}, { requireActiveProject: true }));
  }

  var api = {
    defaultConfigPath: defaultConfigPath,
    loadJson: loadJson,
    buildRouteState: buildRouteState,
    normalizeRouteState: normalizeRouteState,
    resolveLifecycleStageKey: resolveLifecycleStageKey,
    resolve: resolve,
    mountPageChrome: mountPageChrome,
    ensureActiveProject: ensureActiveProject,
    ensureProjectStorage: ensureProjectStorage,
  };

  root.G281ProjectBootstrap = api;
  root.G281Bootstrap = api;
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this);
