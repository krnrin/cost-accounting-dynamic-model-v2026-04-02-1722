/**
 * EngineContext — 依赖注入容器
 *
 * 替代 compute_model.js 中的 global.* 引用，
 * 提供可测试、可替换的依赖注入层。
 *
 * 用法:
 *   const ctx = G281EngineContext.create({ progressTracker, configBridge, ... });
 *   // 或从 global 自动解析 (向后兼容):
 *   const ctx = G281EngineContext.create();
 */
(function (global) {
  'use strict';

  /**
   * 创建引擎上下文
   * @param {Object} [overrides] - 可选依赖覆盖
   * @returns {Object} 引擎上下文对象
   */
  function create(overrides) {
    var o = overrides || {};
    return {
      progressTracker:  o.progressTracker  || global.G281ProgressPriceTracker || null,
      configBridge:     o.configBridge     || global.ConfigBridge             || null,
      harnessCosting:   o.harnessCosting   || global.G281HarnessCosting       || null,
      harnessProfit:    o.harnessProfit    || global.G281HarnessProfit        || null,
      computationPath:  o.computationPath  || global.ComputationPath          || null,
    };
  }

  /** ConfigBridge helpers with safe fallbacks */
  function stateDefaults(ctx) {
    var cb = ctx && ctx.configBridge;
    if (cb && typeof cb.stateDefaults === 'function') return cb.stateDefaults();
    return {
      bom: 'freeze', metal: 'quote', connector: 'quote', labor: 'base',
      equipment: 'base', packaging: 'base', sales: 'quote', mix: 'quote',
      annualDrop: 'quote', oneTimeCustomer: 'quote', rebate: 'quote', vave: 'none',
    };
  }

  function metalSensitivity(ctx) {
    var cb = ctx && ctx.configBridge;
    if (cb && typeof cb.metalSensitivity === 'function') return cb.metalSensitivity();
    return { copper: 0.65, aluminum: 0.45 };
  }

  function materialComposition(ctx) {
    var cb = ctx && ctx.configBridge;
    if (cb && typeof cb.materialComposition === 'function') return cb.materialComposition();
    return { connector: 0.24, copper: 0.38, aluminum: 0.18, other: 0.20 };
  }

  function projectConfig(ctx, runtime) {
    var cb = ctx && ctx.configBridge;
    if (cb && typeof cb.raw === 'function') return cb.raw();
    return (runtime && runtime.projectConfig) || {};
  }

  function detectPath(ctx, result) {
    var cp = ctx && ctx.computationPath;
    if (cp && typeof cp.detect === 'function') return cp.detect(result);
    return { path: 'unknown', label: '未知' };
  }

  global.G281EngineContext = {
    create: create,
    stateDefaults: stateDefaults,
    metalSensitivity: metalSensitivity,
    materialComposition: materialComposition,
    projectConfig: projectConfig,
    detectPath: detectPath,
  };
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : {});
