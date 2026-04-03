/**
 * shared/app_bootstrap.js
 * 四页共享初始化逻辑 — 消除重复的项目注册 + IDB + Schema 迁移代码
 *
 * 用法:
 *   const ctx = await G281Bootstrap.init({ initIdb: true });
 *   // ctx.project  — boolean 项目注册是否成功
 *   // ctx.idb      — boolean IDB 是否初始化
 *   // ctx.schema   — boolean Schema 迁移是否完成
 *   // ctx.repo     — G281Repo 引用或 null
 */
(function (global) {
  'use strict';

  async function init(options) {
    if (!options) options = {};
    var result = { project: false, idb: false, schema: false, repo: null };

    // ── 1. 导航栏 ──
    if (typeof G281Nav !== 'undefined' && G281Nav.mountNavBar) {
      G281Nav.mountNavBar();
    }

    // ── 2. 项目注册 ──
    try {
      var configPath = options.configPath || '../config/g281.project.json';
      var projectId = options.projectId || 'G281';
      var resp = await fetch(configPath);
      var config = await resp.json();
      if (typeof G281ProjectRegistry !== 'undefined') {
        G281ProjectRegistry.registerProject(projectId, config);
        G281ProjectRegistry.switchProject(projectId);
        G281ProjectRegistry.lockProject(projectId);
        result.project = true;
      }
    } catch (e) {
      console.warn('[Bootstrap] 项目注册:', e);
    }

    // ── 3. IDB + Schema 迁移 (可选) ──
    if (options.initIdb && typeof G281BomDb !== 'undefined') {
      try {
        await G281BomDb.init();
        result.idb = true;
        if (typeof G281SchemaMigrator !== 'undefined') {
          await G281SchemaMigrator.runPending(G281BomDb);
          result.schema = true;
        }
      } catch (e) {
        console.warn('[Bootstrap] IDB/Schema:', e);
      }
    }

    // ── 4. Repo 引用 ──
    result.repo = typeof G281Repo !== 'undefined' ? G281Repo : null;
    return result;
  }

  global.G281Bootstrap = { init: init };
})(globalThis);
