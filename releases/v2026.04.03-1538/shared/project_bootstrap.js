;(function (root) {
  'use strict';

  async function loadJson(path) {
    if (root.G281Bootstrap && typeof root.G281Bootstrap.loadJson === 'function') {
      return root.G281Bootstrap.loadJson(path);
    }

    const response = await fetch(path, { cache: 'no-store' });
    if (!response.ok) {
      throw new Error('[ProjectBootstrap] Failed to load ' + path);
    }
    return response.json();
  }

  async function ensureActiveProject(options) {
    if (root.G281Bootstrap && typeof root.G281Bootstrap.ensureActiveProject === 'function') {
      return root.G281Bootstrap.ensureActiveProject(options || {});
    }
    throw new Error('[ProjectBootstrap] G281Bootstrap.ensureActiveProject is unavailable');
  }

  async function init(options) {
    if (root.G281Bootstrap && typeof root.G281Bootstrap.init === 'function') {
      return root.G281Bootstrap.init(options || {});
    }
    throw new Error('[ProjectBootstrap] G281Bootstrap.init is unavailable');
  }

  const compatApi = {
    init: init,
    loadJson: loadJson,
    ensureActiveProject: ensureActiveProject,
    ensureProjectReady: ensureActiveProject,
  };

  if (root.G281Bootstrap && typeof root.G281Bootstrap === 'object') {
    Object.keys(root.G281Bootstrap).forEach(function (key) {
      if (compatApi[key] === undefined) {
        compatApi[key] = root.G281Bootstrap[key];
      }
    });
  }

  root.G281ProjectBootstrap = compatApi;
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this);
