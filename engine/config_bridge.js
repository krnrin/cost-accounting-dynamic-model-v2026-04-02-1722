/**
 * config_bridge.js — 配置桥接模块
 *
 * 职责：
 * 1. 从 ConfigLoader 读取 materialComposition 和 metalSensitivity
 * 2. 提供带回退的系数访问接口
 * 3. 当 ConfigLoader 未加载时回退到硬编码默认值（兼容旧版）
 *
 * Issue #4 — 计算路径系数配置化
 */
;(function (global) {
  'use strict';

  // ============================================================
  // 硬编码回退值（与 g281.project.json 一致）
  // ============================================================
  var FALLBACK_MATERIAL_COMPOSITION = {
    connector: 0.24,
    copper: 0.38,
    aluminum: 0.18,
    other: 0.20,
  };

  var FALLBACK_METAL_SENSITIVITY = {
    copper: 0.65,
    aluminum: 0.45,
  };

  // ============================================================
  // 公开 API
  // ============================================================
  var ConfigBridge = {
    /**
     * 获取材料成本组成系数
     * @returns  connector: number, copper: number, aluminum: number, other: number
     */
    materialComposition: function () {
      var config = global.ConfigLoader && global.ConfigLoader.active
        ? global.ConfigLoader.active()
        : null;
      if (config && config.materialComposition) {
        return {
          connector: Number(config.materialComposition.connector) || FALLBACK_MATERIAL_COMPOSITION.connector,
          copper: Number(config.materialComposition.copper) || FALLBACK_MATERIAL_COMPOSITION.copper,
          aluminum: Number(config.materialComposition.aluminum) || FALLBACK_MATERIAL_COMPOSITION.aluminum,
          other: Number(config.materialComposition.other) || FALLBACK_MATERIAL_COMPOSITION.other,
        };
      }
      return { ...FALLBACK_MATERIAL_COMPOSITION };
    },

    /**
     * 获取金属价格敏感度系数
     * @returns  copper: number, aluminum: number
     */
    metalSensitivity: function () {
      var config = global.ConfigLoader && global.ConfigLoader.active
        ? global.ConfigLoader.active()
        : null;
      if (config && config.metalSensitivity) {
        return {
          copper: Number(config.metalSensitivity.copper) || FALLBACK_METAL_SENSITIVITY.copper,
          aluminum: Number(config.metalSensitivity.aluminum) || FALLBACK_METAL_SENSITIVITY.aluminum,
        };
      }
      return { ...FALLBACK_METAL_SENSITIVITY };
    },

    /**
     * 获取状态默认值
     * @returns {Object}
     */
    stateDefaults: function () {
      var config = global.ConfigLoader && global.ConfigLoader.active
        ? global.ConfigLoader.active()
        : null;
      if (config && config.stateDefaults) {
        return { ...config.stateDefaults };
      }
      return {
        bom: 'freeze', metal: 'quote', connector: 'quote',
        labor: 'base', equipment: 'base', packaging: 'base',
        sales: 'quote', mix: 'quote', annualDrop: 'quote',
        oneTimeCustomer: 'quote', rebate: 'quote', vave: 'none',
      };
    },

    /**
     * 检查是否已加载项目配置
     * @returns {boolean}
     */
    hasConfig: function () {
      return !!(global.ConfigLoader && global.ConfigLoader.active && global.ConfigLoader.active());
    },

    /** 导出回退值（供测试使用） */
    _FALLBACK_MATERIAL: FALLBACK_MATERIAL_COMPOSITION,
    _FALLBACK_METAL: FALLBACK_METAL_SENSITIVITY,
  };

  // P2#7: 统一 G281 前缀，保留旧名向后兼容
  global.G281ConfigBridge = ConfigBridge;
  global.ConfigBridge = ConfigBridge;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ConfigBridge;
  }
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this);
