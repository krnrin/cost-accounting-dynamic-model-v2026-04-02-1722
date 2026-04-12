/**
 * config_loader.js — 项目配置加载器
 *
 * 职责：
 * 1. 加载 projectConfig JSON（从文件或 localStorage）
 * 2. 验证必填字段
 * 3. 填充默认值
 * 4. 缓存当前活动配置
 * 5. 提供统一访问接口
 *
 * 依赖：无（纯工具模块）
 *
 * Issue #14 — 多项目可复用架构 ① 层
 */
;(function (global) {
  'use strict';

  // ============================================================
  // 默认值
  // ============================================================
  var DEFAULTS = {
    dimensions: {
      currency: 'CNY',
      currencySymbol: '\u00a5',
      lengthUnit: 'mm',
      weightUnit: 'g',
      volumeUnit: '\u5957',
      priceDecimalPlaces: 4,
      ratioDecimalPlaces: 2,
    },
    stateDefaults: {
      bom: 'freeze',
      metal: 'quote',
      connector: 'quote',
      labor: 'base',
      equipment: 'base',
      packaging: 'base',
      sales: 'quote',
      mix: 'quote',
      annualDrop: 'quote',
      oneTimeCustomer: 'quote',
      rebate: 'quote',
      vave: 'none',
    },
    bom: {
      dataStartRow: 5,
      maxColumns: 17,
      fallbackRowCount: 2000,
      assemblyUnitKeyword: 'set',
    },
  };

  // ============================================================
  // 必填字段检查
  // ============================================================
  var REQUIRED_FIELDS = [
    'projectId',
    'projectName',
    'baseline',
    'baseline.lifecycle',
    'baseline.lifecycle.years',
    'baseline.vehicleConfigs',
    'harnesses',
    'materialComposition',
    'metalSensitivity',
  ];

  function getNestedValue(obj, path) {
    var keys = path.split('.');
    var current = obj;
    for (var i = 0; i < keys.length; i++) {
      if (current == null) return undefined;
      current = current[keys[i]];
    }
    return current;
  }

  function validate(config) {
    var errors = [];
    REQUIRED_FIELDS.forEach(function (field) {
      var val = getNestedValue(config, field);
      if (val === undefined || val === null || val === '') {
        errors.push('Missing required field: ' + field);
      }
    });

    // materialComposition 之和应为 1.0
    if (config.materialComposition) {
      var mc = config.materialComposition;
      var sum = (mc.connector || 0) + (mc.copper || 0) + (mc.aluminum || 0) + (mc.other || 0);
      if (Math.abs(sum - 1.0) > 0.01) {
        errors.push('materialComposition sum = ' + sum.toFixed(4) + ', expected 1.00');
      }
    }

    // vehicleConfigs ratio 之和应为 1.0
    if (config.baseline && Array.isArray(config.baseline.vehicleConfigs)) {
      var ratioSum = config.baseline.vehicleConfigs.reduce(function (s, vc) {
        return s + (vc.ratio || 0);
      }, 0);
      if (Math.abs(ratioSum - 1.0) > 0.01) {
        errors.push('vehicleConfigs ratio sum = ' + ratioSum.toFixed(4) + ', expected 1.00');
      }
    }

    return errors;
  }

  // ============================================================
  // 深度合并默认值
  // ============================================================
  function deepMergeDefaults(target, defaults) {
    if (!defaults || typeof defaults !== 'object') return target;
    if (!target || typeof target !== 'object') return JSON.parse(JSON.stringify(defaults));

    var result = JSON.parse(JSON.stringify(target));
    Object.keys(defaults).forEach(function (key) {
      if (result[key] === undefined) {
        result[key] = JSON.parse(JSON.stringify(defaults[key]));
      } else if (
        typeof defaults[key] === 'object' &&
        defaults[key] !== null &&
        !Array.isArray(defaults[key])
      ) {
        result[key] = deepMergeDefaults(result[key], defaults[key]);
      }
    });
    return result;
  }

  // ============================================================
  // 缓存
  // ============================================================
  var _cache = {};
  var _activeProjectId = null;

  function inferFromRuntime(runtime) {
    var safeRuntime = runtime && runtime.master ? runtime : (global.G281_RUNTIME || {});
    var master = safeRuntime.master || {};
    var years = Array.isArray(master.years) ? master.years : [];
    var volumes = Array.isArray(master.volumes) ? master.volumes : [];
    var baselineMix = Array.isArray(master.baselineMix) ? master.baselineMix : [];
    var configNames = Array.isArray(master.configNames) ? master.configNames : [];
    var mixTotal = baselineMix.reduce(function (sum, value) {
      return sum + (Number(value) || 0);
    }, 0);
    var normalizedMix = baselineMix.length
      ? baselineMix.map(function (value) {
          var numeric = Number(value) || 0;
          if (mixTotal > 1.01) return numeric / (mixTotal || 1);
          return numeric;
        })
      : [1];
    var normalizedNames = configNames.length ? configNames : ['default'];

    return {
      projectId: master.projectId || master.projectCode || 'G281',
      projectCode: master.projectCode || master.projectId || 'G281',
      projectName: master.name || 'Lifecycle Cost Platform Seed',
      customer: master.customer || '',
      baseline: {
        lifecycle: {
          years: years.length || 6,
        },
        vehicleConfigs: normalizedNames.map(function (name, index) {
          return {
            name: name,
            ratio: Number(normalizedMix[index]) || (index === 0 ? 1 : 0),
            harnesses: [],
          };
        }),
        annualVolumes: years.map(function (year, index) {
          return { year: year, volume: Number(volumes[index]) || 0 };
        }),
      },
      harnesses: [],
      materialComposition: {
        connector: 0.24,
        copper: 0.38,
        aluminum: 0.18,
        other: 0.20,
      },
      metalSensitivity: {
        copper: 0.65,
        aluminum: 0.45,
      },
    };
  }

  // ============================================================
  // 公开 API
  // ============================================================
  var ConfigLoader = {
    /**
     * 从 JSON 对象加载配置
     * @param {Object} rawConfig - 原始配置对象
     * @returns  config: Object, errors: string[] 
     */
    load: function (rawConfig) {
      if (!rawConfig || typeof rawConfig !== 'object') {
        return { config: null, errors: ['Invalid config: not an object'] };
      }

      // 填充默认值
      var config = deepMergeDefaults(rawConfig, DEFAULTS);

      // 验证
      var errors = validate(config);
      if (errors.length > 0) {
        return { config: config, errors: errors };
      }

      // 缓存
      var pid = config.projectId;
      _cache[pid] = Object.freeze(config);
      _activeProjectId = pid;

      return { config: _cache[pid], errors: [] };
    },

    /**
     * 从 JSON 字符串加载
     * @param {string} jsonString
     * @returns  config: Object, errors: string[] 
     */
    loadFromString: function (jsonString) {
      try {
        var parsed = JSON.parse(jsonString);
        return ConfigLoader.load(parsed);
      } catch (e) {
        return { config: null, errors: ['JSON parse error: ' + e.message] };
      }
    },

    /**
     * 从 localStorage 加载
     * @param {string} projectId
     * @returns  config: Object, errors: string[] 
     */
    loadFromStorage: function (projectId) {
      var key = projectId + '.projectConfig';
      var raw = null;
      try {
        raw = localStorage.getItem(key);
      } catch (e) {
        return { config: null, errors: ['localStorage read error: ' + e.message] };
      }
      if (!raw) {
        return { config: null, errors: ['No config found in localStorage for key: ' + key] };
      }
      return ConfigLoader.loadFromString(raw);
    },

    loadFromJSON: function (rawConfig) {
      return ConfigLoader.load(rawConfig);
    },

    inferFromRuntime: function (runtime) {
      return deepMergeDefaults(inferFromRuntime(runtime), DEFAULTS);
    },

    loadProjectConfig: async function (pathOrRuntime) {
      if (_activeProjectId && _cache[_activeProjectId]) {
        return _cache[_activeProjectId];
      }
      if (pathOrRuntime && pathOrRuntime.projectId) {
        return ConfigLoader.load(pathOrRuntime).config;
      }
      if (typeof pathOrRuntime === 'string' && typeof fetch === 'function') {
        try {
          var response = await fetch(pathOrRuntime);
          var json = await response.json();
          return ConfigLoader.load(json).config;
        } catch (error) {
          // Fall through to runtime inference.
        }
      }
      if (typeof fetch === 'function') {
        try {
          var defaultResponse = await fetch('../config/g281.project.json');
          var defaultJson = await defaultResponse.json();
          return ConfigLoader.load(defaultJson).config;
        } catch (error) {
          // Fall through to runtime inference for offline file:// mode.
        }
      }
      return ConfigLoader.load(inferFromRuntime(pathOrRuntime)).config;
    },

    /**
     * 保存配置到 localStorage
     * @param {Object} config
     */
    saveToStorage: function (config) {
      if (!config || !config.projectId) return;
      var key = config.projectId + '.projectConfig';
      try {
        localStorage.setItem(key, JSON.stringify(config));
      } catch (e) {
        console.error('[ConfigLoader] saveToStorage failed:', e);
      }
    },

    /**
     * 获取当前活动项目配置
     * @returns {Object|null}
     */
    active: function () {
      return _activeProjectId ? _cache[_activeProjectId] || null : null;
    },

    /**
     * 获取指定项目配置
     * @param {string} projectId
     * @returns {Object|null}
     */
    get: function (projectId) {
      return _cache[projectId] || null;
    },

    /**
     * 切换活动项目
     * @param {string} projectId
     * @returns {boolean}
     */
    setActive: function (projectId) {
      if (_cache[projectId]) {
        _activeProjectId = projectId;
        return true;
      }
      return false;
    },

    /**
     * 列出所有已缓存的项目 ID
     * @returns {string[]}
     */
    listProjects: function () {
      return Object.keys(_cache);
    },

    /**
     * 清除缓存
     */
    clearCache: function () {
      _cache = {};
      _activeProjectId = null;
    },

    /** 导出默认值（供测试使用） */
    _DEFAULTS: DEFAULTS,
    _validate: validate,
  };

  // ============================================================
  // 导出
  // ============================================================
  global.ConfigLoader = ConfigLoader;
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this);
