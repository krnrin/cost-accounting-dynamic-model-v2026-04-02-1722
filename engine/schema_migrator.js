/**
 * engine/schema_migrator.js
 * Issue #11: IndexedDB schema 版本迁移框架
 *
 * 职责：
 * 1. 跟踪 localStorage 中的应用层 schema 版本（区别于 IDB 的 dbVersion）
 * 2. 按序执行迁移函数
 * 3. 提供回滚元数据（不自动回滚，但记录足够信息便于手动处理）
 *
 * 与 bom_db.js 配合使用：
 *   bom_db.js 管理 IndexedDB 的物理 store 结构
 *   schema_migrator.js 管理 store 内的数据格式/字段级迁移
 */
;(function (root) {
  'use strict';

  const STORAGE_KEY = 'g281_schema_version';
  const MIGRATION_LOG_KEY = 'g281_migration_log';

  // ── 迁移注册表 ────────────────────────────────
  // 每个迁移是一个 { version, label, up } 对象
  // version: 目标版本号（整数，从 1 开始递增）
  // label:   人类可读描述
  // up:      async (db) => void  迁移函数，db 是 G281BomDb 实例
  const migrations = [];

  /**
   * 注册一个迁移步骤
   * @param {number} version  目标版本（必须 > 上一个注册版本）
   * @param {string} label    描述
   * @param {Function} up     迁移函数 async (db) => void
   */
  function register(version, label, up) {
    if (typeof version !== 'number' || version < 1) {
      throw new Error(`[SchemaMigrator] version must be a positive integer, got ${version}`);
    }
    if (migrations.length && version <= migrations[migrations.length - 1].version) {
      throw new Error(`[SchemaMigrator] version ${version} must be greater than ${migrations[migrations.length - 1].version}`);
    }
    if (typeof up !== 'function') {
      throw new Error(`[SchemaMigrator] up must be a function for version ${version}`);
    }
    migrations.push({ version, label: label || `Migration to v${version}`, up });
  }

  // ── 版本读写 ──────────────────────────────────

  function getCurrentVersion() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      const parsed = Number(stored);
      return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
    } catch (_) {
      return 0;
    }
  }

  function setCurrentVersion(version) {
    try {
      localStorage.setItem(STORAGE_KEY, String(version));
    } catch (_) {
      console.warn('[SchemaMigrator] Failed to persist schema version to localStorage');
    }
  }

  function getLatestVersion() {
    return migrations.length ? migrations[migrations.length - 1].version : 0;
  }

  // ── 迁移日志 ──────────────────────────────────

  function getMigrationLog() {
    try {
      const raw = localStorage.getItem(MIGRATION_LOG_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (_) {
      return [];
    }
  }

  function appendMigrationLog(entry) {
    try {
      const log = getMigrationLog();
      log.push(entry);
      // 只保留最近 50 条
      const trimmed = log.slice(-50);
      localStorage.setItem(MIGRATION_LOG_KEY, JSON.stringify(trimmed));
    } catch (_) {
      // 静默失败
    }
  }

  // ── 迁移执行 ──────────────────────────────────

  /**
   * 执行所有待运行的迁移
   * @param {Object} db  G281BomDb 实例（已 init）
   * @returns {Object} { fromVersion, toVersion, applied: [...] }
   */
  async function runPending(db) {
    const currentVersion = getCurrentVersion();
    const pending = migrations.filter((m) => m.version > currentVersion);

    if (!pending.length) {
      return {
        fromVersion: currentVersion,
        toVersion: currentVersion,
        applied: [],
        skipped: true,
      };
    }

    const applied = [];
    let lastVersion = currentVersion;

    for (const migration of pending) {
      const startTime = Date.now();
      try {
        await migration.up(db);
        lastVersion = migration.version;
        setCurrentVersion(lastVersion);

        const logEntry = {
          version: migration.version,
          label: migration.label,
          status: 'success',
          timestamp: new Date().toISOString(),
          durationMs: Date.now() - startTime,
        };
        applied.push(logEntry);
        appendMigrationLog(logEntry);

        console.log(`[SchemaMigrator] ✅ v${migration.version}: ${migration.label} (${logEntry.durationMs}ms)`);
      } catch (error) {
        const logEntry = {
          version: migration.version,
          label: migration.label,
          status: 'failed',
          error: String(error?.message || error),
          timestamp: new Date().toISOString(),
          durationMs: Date.now() - startTime,
          stoppedAt: lastVersion,
        };
        applied.push(logEntry);
        appendMigrationLog(logEntry);

        console.error(`[SchemaMigrator] ❌ v${migration.version}: ${migration.label}`, error);
        // 停止后续迁移
        break;
      }
    }

    return {
      fromVersion: currentVersion,
      toVersion: lastVersion,
      applied,
      skipped: false,
    };
  }

  /**
   * 强制重置版本号（危险操作，仅用于开发调试）
   */
  function forceResetVersion(version) {
    setCurrentVersion(version || 0);
    appendMigrationLog({
      action: 'force_reset',
      toVersion: version || 0,
      timestamp: new Date().toISOString(),
    });
  }

  // ── 内置迁移 ──────────────────────────────────
  // v1: 为现有 factorVersions 记录补充缺失的 projectCode 字段
  register(1, '补充 factorVersions.projectCode 缺失值', async function (db) {
    const records = await db.getAllRecords('factorVersions');
    const needsUpdate = records.filter((r) => !r.projectCode);
    if (!needsUpdate.length) return;

    const updated = needsUpdate.map((r) => ({
      ...r,
      projectCode: r.projectCode || 'G281',
      updatedAt: r.updatedAt || new Date().toISOString(),
    }));
    await db.putMany('factorVersions', updated);
    console.log(`[SchemaMigrator] v1: patched ${updated.length} factorVersions records`);
  });

  // v2: 为 workbookSnapshots 补充 projectCode
  register(2, '补充 workbookSnapshots.projectCode 缺失值', async function (db) {
    const records = await db.getAllRecords('workbookSnapshots');
    const needsUpdate = records.filter((r) => !r.projectCode);
    if (!needsUpdate.length) return;

    const updated = needsUpdate.map((r) => ({
      ...r,
      projectCode: r.projectCode || 'G281',
      updatedAt: r.updatedAt || new Date().toISOString(),
    }));
    await db.putMany('workbookSnapshots', updated);
    console.log(`[SchemaMigrator] v2: patched ${updated.length} workbookSnapshots records`);
  });

  // v3: 为 scenarios 补充 schemaVersion 标记
  register(3, '为 scenarios 添加 schemaVersion 标记', async function (db) {
    const records = await db.getAllRecords('scenarios');
    const needsUpdate = records.filter((r) => !r.schemaVersion);
    if (!needsUpdate.length) return;

    const updated = needsUpdate.map((r) => ({
      ...r,
      schemaVersion: 3,
      updatedAt: r.updatedAt || new Date().toISOString(),
    }));
    await db.putMany('scenarios', updated);
    console.log(`[SchemaMigrator] v3: patched ${updated.length} scenarios records`);
  });

  // ── 导出 ──────────────────────────────────────

  root.G281SchemaMigrator = {
    register,
    runPending,
    getCurrentVersion,
    getLatestVersion,
    getMigrationLog,
    forceResetVersion,
    _migrations: migrations,  // 仅供测试
  };
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this);
