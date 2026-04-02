/**
 * engine/computation_cache.js
 * Issue #12: 计算结果缓存层
 *
 * 职责：
 * 1. 基于 draft+state 的 JSON hash 做 memoize
 * 2. wireCatalog 索引缓存（避免重复遍历）
 * 3. LRU 淘汰策略，防止内存泄漏
 */
;(function (root) {
  'use strict';

  // ── LRU Cache ─────────────────────────────────

  function createLRU(maxSize) {
    const cache = new Map();
    const limit = maxSize || 50;

    return {
      get(key) {
        if (!cache.has(key)) return undefined;
        const value = cache.get(key);
        // Move to end (most recently used)
        cache.delete(key);
        cache.set(key, value);
        return value;
      },

      set(key, value) {
        if (cache.has(key)) {
          cache.delete(key);
        } else if (cache.size >= limit) {
          // Evict oldest
          const firstKey = cache.keys().next().value;
          cache.delete(firstKey);
        }
        cache.set(key, value);
      },

      has(key) {
        return cache.has(key);
      },

      clear() {
        cache.clear();
      },

      get size() {
        return cache.size;
      },
    };
  }

  // ── 计算 Hash ─────────────────────────────────

  function hashInputs(draft, state) {
    try {
      // 稳定序列化：排序 key
      const draftStr = JSON.stringify(draft, Object.keys(draft || {}).sort());
      const stateStr = JSON.stringify(state, Object.keys(state || {}).sort());
      return simpleHash(draftStr + '||' + stateStr);
    } catch (_) {
      return null; // 无法 hash，不缓存
    }
  }

  function simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const chr = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + chr;
      hash |= 0;
    }
    return 'h' + (hash >>> 0).toString(36);
  }

  // ── 模型计算缓存 ──────────────────────────────

  const modelCache = createLRU(30);

  /**
   * 带缓存的 computeModel 包装
   * @param {Function} computeFn  原始 engine.computeModel
   * @param {Object} runtime
   * @param {Object} draft
   * @param {Object} state
   * @returns {Object} model result
   */
  function cachedCompute(computeFn, runtime, draft, state) {
    const key = hashInputs(draft, state);
    if (key) {
      const cached = modelCache.get(key);
      if (cached !== undefined) return cached;
    }
    const result = computeFn(runtime, draft, state);
    if (key && result) {
      modelCache.set(key, result);
    }
    return result;
  }

  // ── Wire Catalog 索引缓存 ─────────────────────

  let wireCatalogIndex = null;
  let wireCatalogSource = null;

  /**
   * 获取或构建 wireCatalog 按料号索引
   * @param {Array} catalog  wire catalog 数组
   * @returns {Map} partNo → catalog entry
   */
  function getWireCatalogIndex(catalog) {
    if (!Array.isArray(catalog)) return new Map();

    // 如果源数组引用相同，直接返回缓存
    if (wireCatalogSource === catalog && wireCatalogIndex) {
      return wireCatalogIndex;
    }

    const index = new Map();
    for (let i = 0; i < catalog.length; i++) {
      const entry = catalog[i];
      if (entry && entry.partNo) {
        index.set(entry.partNo, entry);
      }
      // 备用键
      if (entry && entry.materialNo && !index.has(entry.materialNo)) {
        index.set(entry.materialNo, entry);
      }
    }

    wireCatalogSource = catalog;
    wireCatalogIndex = index;
    return index;
  }

  /**
   * 清除所有缓存
   */
  function invalidateAll() {
    modelCache.clear();
    wireCatalogIndex = null;
    wireCatalogSource = null;
  }

  root.G281ComputationCache = {
    createLRU,
    cachedCompute,
    getWireCatalogIndex,
    invalidateAll,
    hashInputs,
    _modelCache: modelCache,  // 测试用
  };
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this);
