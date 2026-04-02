/**
 * config/project_registry.js
 * Issue #14: 多项目注册表
 *
 * 职责：
 * 1. 管理所有已注册项目的配置 JSON
 * 2. 提供项目切换 API（切换后通知 ConfigLoader 重新加载）
 * 3. 项目列表持久化到 localStorage
 *
 * 设计原则（用户决策）：
 * - 配置存储：JSON 文件（方案 B）
 * - 数据隔离：完全隔离（每个项目独立 IDB 数据库）
 * - 变更管控：生命周期年限和车型配置比例设定后锁定，修改需通过项目变更流程
 */
;(function (root) {
  'use strict';

  const STORAGE_KEY = 'g281_project_registry';
  const ACTIVE_PROJECT_KEY = 'g281_active_project';

  // ── 内部状态 ──────────────────────────────────
  let registry = {};       // { projectCode: configJSON }
  let activeProjectCode = null;
  let changeListeners = [];

  // ── 持久化 ────────────────────────────────────

  function loadRegistry() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      registry = raw ? JSON.parse(raw) : {};
    } catch (_) {
      registry = {};
    }
    try {
      activeProjectCode = localStorage.getItem(ACTIVE_PROJECT_KEY) || null;
    } catch (_) {
      activeProjectCode = null;
    }
  }

  function saveRegistry() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(registry));
      if (activeProjectCode) {
        localStorage.setItem(ACTIVE_PROJECT_KEY, activeProjectCode);
      }
    } catch (_) {
      console.warn('[ProjectRegistry] Failed to persist to localStorage');
    }
  }

  // ── 项目管理 API ──────────────────────────────

  /**
   * 注册一个项目配置
   * @param {string} projectCode  项目代码（如 'G281', 'E281'）
   * @param {Object} config       项目配置 JSON（需符合 project-config.schema.md）
   */
  function registerProject(projectCode, config) {
    if (!projectCode || typeof projectCode !== 'string') {
      throw new Error('[ProjectRegistry] projectCode is required');
    }
    if (!config || typeof config !== 'object') {
      throw new Error('[ProjectRegistry] config must be an object');
    }

    // 验证必要字段
    const required = ['projectCode', 'projectName'];
    for (const field of required) {
      if (!config[field]) {
        throw new Error(`[ProjectRegistry] config.${field} is required`);
      }
    }

    registry[projectCode] = {
      ...config,
      _registeredAt: new Date().toISOString(),
      _locked: false,  // 初始未锁定
    };
    saveRegistry();
    return registry[projectCode];
  }

  /**
   * 获取项目配置
   */
  function getProject(projectCode) {
    return registry[projectCode] || null;
  }

  /**
   * 列出所有已注册项目
   */
  function listProjects() {
    return Object.keys(registry).map((code) => ({
      projectCode: code,
      projectName: registry[code].projectName || code,
      locked: !!registry[code]._locked,
      registeredAt: registry[code]._registeredAt,
    }));
  }

  /**
   * 切换活跃项目
   * @param {string} projectCode
   * @returns {Object} 新活跃项目的配置
   */
  function switchProject(projectCode) {
    const config = registry[projectCode];
    if (!config) {
      throw new Error(`[ProjectRegistry] Project '${projectCode}' not found`);
    }

    const previousCode = activeProjectCode;
    activeProjectCode = projectCode;
    saveRegistry();

    // 通知 ConfigLoader 切换
    if (root.ConfigLoader && root.ConfigLoader.loadFromJSON) {
      root.ConfigLoader.loadFromJSON(config);
    }

    // 通知监听器
    changeListeners.forEach((fn) => {
      try {
        fn({ from: previousCode, to: projectCode, config });
      } catch (e) {
        console.error('[ProjectRegistry] listener error:', e);
      }
    });

    return config;
  }

  /**
   * 获取当前活跃项目代码
   */
  function getActiveCode() {
    return activeProjectCode;
  }

  /**
   * 获取当前活跃项目配置
   */
  function getActiveConfig() {
    return activeProjectCode ? registry[activeProjectCode] || null : null;
  }

  // ── 变更管控 ──────────────────────────────────

  /**
   * 锁定项目配置（设定后不可通过 UI 随意修改）
   */
  function lockProject(projectCode) {
    if (!registry[projectCode]) {
      throw new Error(`[ProjectRegistry] Project '${projectCode}' not found`);
    }
    registry[projectCode]._locked = true;
    registry[projectCode]._lockedAt = new Date().toISOString();
    saveRegistry();
  }

  /**
   * 通过变更流程解锁并更新配置
   * @param {string} projectCode
   * @param {Object} changeRequest  变更请求 { reason, fields, newValues, requestedBy }
   * @returns {Object} 变更记录
   */
  function requestChange(projectCode, changeRequest) {
    if (!registry[projectCode]) {
      throw new Error(`[ProjectRegistry] Project '${projectCode}' not found`);
    }
    if (!changeRequest || !changeRequest.reason) {
      throw new Error('[ProjectRegistry] changeRequest.reason is required');
    }

    // 变更管控：锁定项目必须通过正式变更流程（提供 requestedBy 标识审批责任人）
    if (registry[projectCode]._locked && !changeRequest.requestedBy) {
      throw new Error(
        `[ProjectRegistry] Project '${projectCode}' is locked. ` +
        'Provide changeRequest.requestedBy to proceed through the change management process.'
      );
    }

    const changeLog = registry[projectCode]._changeLog || [];
    const changeRecord = {
      id: `CHG-${Date.now().toString(36)}`,
      timestamp: new Date().toISOString(),
      reason: changeRequest.reason,
      fields: changeRequest.fields || [],
      previousValues: {},
      newValues: changeRequest.newValues || {},
      requestedBy: changeRequest.requestedBy || 'unknown',
      status: 'applied',
      wasLocked: !!registry[projectCode]._locked,
    };

    // 记录旧值
    (changeRequest.fields || []).forEach((field) => {
      changeRecord.previousValues[field] = registry[projectCode][field];
    });

    // 应用新值
    Object.entries(changeRequest.newValues || {}).forEach(([key, value]) => {
      registry[projectCode][key] = value;
    });

    changeLog.push(changeRecord);
    registry[projectCode]._changeLog = changeLog;
    saveRegistry();

    return changeRecord;
  }

  /**
   * 获取变更历史
   */
  function getChangeLog(projectCode) {
    return (registry[projectCode] && registry[projectCode]._changeLog) || [];
  }

  // ── 监听 ──────────────────────────────────────

  function onProjectChange(fn) {
    if (typeof fn === 'function') {
      changeListeners.push(fn);
    }
  }

  function offProjectChange(fn) {
    changeListeners = changeListeners.filter((f) => f !== fn);
  }

  // ── IDB 隔离辅助 ──────────────────────────────

  /**
   * 获取项目专属的 IDB 数据库名称
   * 实现完全隔离：每个项目使用独立的 IndexedDB 数据库
   */
  function getDbName(projectCode) {
    const code = projectCode || activeProjectCode || 'default';
    return `g281-bom-store-${code.toLowerCase()}`;
  }

  // ── 初始化 ────────────────────────────────────
  loadRegistry();

  root.G281ProjectRegistry = {
    registerProject,
    getProject,
    listProjects,
    switchProject,
    getActiveCode,
    getActiveConfig,
    lockProject,
    requestChange,
    getChangeLog,
    onProjectChange,
    offProjectChange,
    getDbName,
  };
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this);
