/**
 * storage_adapter.js — 项目隔离存储适配器
 *
 * 职责：
 * 1. 将 localStorage key 加上项目前缀，实现完全隔离
 * 2. 提供 schema version 迁移机制 (Issue #11)
 * 3. 提供 JSON 导入/导出接口
 *
 * 使用方式：
 *   var store = StorageAdapter.forProject('G281');
 *   store.set('history', data);
 *   var data = store.get('history');
 *
 * 依赖：ConfigLoader（可选，用于 storageKeyPrefix）
 *
 * Issue #14 — 多项目可复用架构 ② 层
 */
;(function (root) {
  'use strict';

  // ============================================================
  // 内部常量
  // ============================================================
  var SCHEMA_VERSION_KEY_SUFFIX = '.__schema_version__';
  var CURRENT_SCHEMA_VERSION = 1;

  // ============================================================
  // 迁移注册表
  // ============================================================
  var _migrations = {};

  /**
   * 注册一个迁移
   * @param {number} fromVersion
   * @param {number} toVersion
   * @param {function(projectPrefix: string)} migrateFn
   */
  function registerMigration(fromVersion, toVersion, migrateFn) {
    _migrations[fromVersion + '->' + toVersion] = migrateFn;
  }

  // ============================================================
  // ProjectStore 实例
  // ============================================================
  function ProjectStore(projectId, prefix) {
    this.projectId = projectId;
    this.prefix = prefix || projectId.toLowerCase();
  }

  ProjectStore.prototype = {
    /**
     * 生成带前缀的完整 key
     * @param {string} key
     * @returns {string}
     */
    _fullKey: function (key) {
      return this.prefix + '.' + key;
    },

    /**
     * 读取值
     * @param {string} key
     * @param {*} defaultValue
     * @returns {*}
     */
    get: function (key, defaultValue) {
      try {
        var raw = localStorage.getItem(this._fullKey(key));
        if (raw === null) return defaultValue !== undefined ? defaultValue : null;
        return JSON.parse(raw);
      } catch (e) {
        console.warn('[StorageAdapter] get failed for key:', key, e);
        return defaultValue !== undefined ? defaultValue : null;
      }
    },

    /**
     * 写入值
     * @param {string} key
     * @param {*} value
     * @returns {boolean}
     */
    set: function (key, value) {
      try {
        localStorage.setItem(this._fullKey(key), JSON.stringify(value));
        return true;
      } catch (e) {
        console.error('[StorageAdapter] set failed for key:', key, e);
        return false;
      }
    },

    /**
     * 删除值
     * @param {string} key
     */
    remove: function (key) {
      try {
        localStorage.removeItem(this._fullKey(key));
      } catch (e) {
        console.warn('[StorageAdapter] remove failed for key:', key, e);
      }
    },

    /**
     * 列出该项目下所有 key
     * @returns {string[]}
     */
    keys: function () {
      var result = [];
      var prefixDot = this.prefix + '.';
      try {
        for (var i = 0; i < localStorage.length; i++) {
          var fullKey = localStorage.key(i);
          if (fullKey && fullKey.indexOf(prefixDot) === 0) {
            result.push(fullKey.substring(prefixDot.length));
          }
        }
      } catch (e) {
        console.warn('[StorageAdapter] keys enumeration failed:', e);
      }
      return result;
    },

    /**
     * 导出该项目所有数据
     * @returns {Object}
     */
    exportAll: function () {
      var data = {};
      var allKeys = this.keys();
      for (var i = 0; i < allKeys.length; i++) {
        data[allKeys[i]] = this.get(allKeys[i]);
      }
      data.__projectId__ = this.projectId;
      data.__schemaVersion__ = this.getSchemaVersion();
      data.__exportedAt__ = new Date().toISOString();
      return data;
    },

    /**
     * 导入数据（覆盖式）
     * @param {Object} data
     * @param  overwrite?: boolean  options
     * @returns  imported: number, skipped: number, errors: string[] 
     */
    importAll: function (data, options) {
      options = options || {};
      var result = { imported: 0, skipped: 0, errors: [] };

      if (!data || typeof data !== 'object') {
        result.errors.push('Invalid import data');
        return result;
      }

      var reservedKeys = ['__projectId__', '__schemaVersion__', '__exportedAt__'];

      Object.keys(data).forEach(function (key) {
        if (reservedKeys.indexOf(key) >= 0) return;

        if (!options.overwrite && this.get(key) !== null) {
          result.skipped++;
          return;
        }

        if (this.set(key, data[key])) {
          result.imported++;
        } else {
          result.errors.push('Failed to import key: ' + key);
        }
      }.bind(this));

      return result;
    },

    /**
     * 清除该项目所有数据
     * @returns {number} 删除数量
     */
    clearAll: function () {
      var allKeys = this.keys();
      for (var i = 0; i < allKeys.length; i++) {
        this.remove(allKeys[i]);
      }
      return allKeys.length;
    },

    /**
     * 获取 schema 版本号
     * @returns {number}
     */
    getSchemaVersion: function () {
      var v = this.get('__schema_version__');
      return typeof v === 'number' ? v : 0;
    },

    /**
     * 设置 schema 版本号
     * @param {number} version
     */
    setSchemaVersion: function (version) {
      this.set('__schema_version__', version);
    },

    /**
     * 执行所有待定迁移
     * @returns  from: number, to: number, applied: string[] 
     */
    runMigrations: function () {
      var currentVersion = this.getSchemaVersion();
      var applied = [];

      while (currentVersion < CURRENT_SCHEMA_VERSION) {
        var nextVersion = currentVersion + 1;
        var migrationKey = currentVersion + '->' + nextVersion;
        var migrateFn = _migrations[migrationKey];

        if (migrateFn) {
          try {
            migrateFn(this.prefix);
            applied.push(migrationKey);
          } catch (e) {
            console.error('[StorageAdapter] Migration failed:', migrationKey, e);
            break;
          }
        }

        currentVersion = nextVersion;
        this.setSchemaVersion(currentVersion);
      }

      return { from: this.getSchemaVersion() - applied.length, to: currentVersion, applied: applied };
    },
  };

  // ============================================================
  // 工厂 + 静态方法
  // ============================================================
  var _stores = {};

  var StorageAdapter = {
    /**
     * 获取或创建项目存储实例
     * @param {string} projectId
     * @param {string} [prefix] - 自定义前缀，默认为 projectId.toLowerCase()
     * @returns {ProjectStore}
     */
    forProject: function (projectId, prefix) {
      var cacheKey = projectId + ':' + (prefix || '');
      if (!_stores[cacheKey]) {
        _stores[cacheKey] = new ProjectStore(projectId, prefix);
      }
      return _stores[cacheKey];
    },

    /**
     * 从当前活动配置创建 store（依赖 ConfigLoader）
     * @returns {ProjectStore|null}
     */
    forActiveProject: function () {
      var CL = root.ConfigLoader;
      if (!CL) return null;
      var config = CL.active();
      if (!config) return null;
      return StorageAdapter.forProject(
        config.projectId,
        config.storageKeyPrefix || config.projectId.toLowerCase()
      );
    },

    /**
     * 迁移旧版 g281.* key 到新前缀
     * 用于从当前硬编码版迁移到配置驱动版
     *
     * @param {string} oldPrefix - 旧前缀，如 'g281'
     * @param {string} newProjectId - 新项目 ID
     * @param {string} [newPrefix] - 新前缀
     * @returns  migrated: number, keys: string[] 
     */
    migrateFromLegacy: function (oldPrefix, newProjectId, newPrefix) {
      var result = { migrated: 0, keys: [] };
      var oldPrefixDot = oldPrefix + '.';
      var newStore = StorageAdapter.forProject(newProjectId, newPrefix);

      try {
        for (var i = 0; i < localStorage.length; i++) {
          var fullKey = localStorage.key(i);
          if (fullKey && fullKey.indexOf(oldPrefixDot) === 0) {
            var shortKey = fullKey.substring(oldPrefixDot.length);
            var value = localStorage.getItem(fullKey);
            try {
              newStore.set(shortKey, JSON.parse(value));
            } catch (_) {
              // 保存原始字符串
              newStore.set(shortKey, value);
            }
            result.migrated++;
            result.keys.push(shortKey);
          }
        }
      } catch (e) {
        console.error('[StorageAdapter] migrateFromLegacy failed:', e);
      }

      return result;
    },

    /** 注册迁移 */
    registerMigration: registerMigration,

    /** 当前 schema 版本 */
    CURRENT_SCHEMA_VERSION: CURRENT_SCHEMA_VERSION,
  };

  // ============================================================
  // 导出
  // ============================================================
  root.StorageAdapter = StorageAdapter;
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this);
