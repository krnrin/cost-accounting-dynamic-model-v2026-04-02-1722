/**
 * shared/page_router.js
 * Issue #13: 页面路由 + 共享状态桥接
 * 处理跨页面状态传递（通过 URL params / sessionStorage）
 *
 * @namespace G281PageRouter
 */
(function (global) {
  'use strict';

  var STORAGE_KEY = 'g281_page_state';

  // ── URL Params ────────────────────────────────────

  /** @returns {Object<string,string>} 当前 URL 参数对象 */
  function readUrlParams() {
    var params = new URLSearchParams(location.search);
    var state = {};
    for (var entry of params.entries()) {
      state[entry[0]] = entry[1];
    }
    return state;
  }

  /** 写入 URL 参数（不刷新页面） */
  function writeUrlParams(state) {
    var params = new URLSearchParams();
    Object.entries(state || {}).forEach(function (pair) {
      if (pair[1] !== null && pair[1] !== undefined && pair[1] !== '') {
        params.set(pair[0], String(pair[1]));
      }
    });
    var newUrl = location.pathname + '?' + params.toString();
    history.replaceState(null, '', newUrl);
  }

  // ── Session Storage ──────────────────────────────

  function saveState(state) {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (_) { /* quota exceeded or private mode */ }
  }

  function loadState() {
    try {
      var raw = sessionStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (_) {
      return {};
    }
  }

  // ── State Resolution ─────────────────────────────

  /** 合并 URL 参数 + sessionStorage（URL 优先） */
  function resolveState() {
    var stored = loadState();
    var urlState = readUrlParams();
    return Object.assign({}, stored, urlState);
  }

  // ── Navigation ───────────────────────────────────

  /**
   * 导航到另一个页面并携带状态
   * @param {string} pageFile  目标页面文件名 (e.g. 'preview.html')
   * @param {Object} [extraState]  额外状态参数
   */
  function navigateTo(pageFile, extraState) {
    var currentState = resolveState();
    var mergedState = Object.assign({}, currentState, extraState);
    saveState(mergedState);

    var params = new URLSearchParams();
    Object.entries(mergedState).forEach(function (pair) {
      if (pair[1] !== null && pair[1] !== undefined && pair[1] !== '') {
        params.set(pair[0], String(pair[1]));
      }
    });

    // 归一化：去掉可能已存在的 pages/ 前缀，防止 double prefix
    var normalizedFile = pageFile.replace(/^pages\//, '');
    var prefix = location.pathname.includes('/pages/') ? '' : 'pages/';
    location.href = prefix + normalizedFile + '?' + params.toString();
  }

  // ── BroadcastChannel ─────────────────────────────

  /** @type {BroadcastChannel|null} */
  var channel = null;

  /**
   * 初始化跨页面消息管道
   * @param {function} [onMessage]  收到消息时的回调
   */
  function initBroadcast(onMessage) {
    destroyBroadcast(); // 防止重复初始化
    if (typeof BroadcastChannel !== 'undefined') {
      channel = new BroadcastChannel('g281_page_sync');
      channel.onmessage = function (event) {
        if (typeof onMessage === 'function') onMessage(event.data);
      };
    }
  }

  /** 广播数据到所有同源页面 */
  function broadcast(data) {
    if (channel) channel.postMessage(data);
  }

  /** 清理 BroadcastChannel 防止内存泄漏 */
  function destroyBroadcast() {
    if (channel) {
      channel.close();
      channel = null;
    }
  }

  // 页面卸载时自动清理
  if (typeof window !== 'undefined') {
    window.addEventListener('pagehide', destroyBroadcast);
  }

  // ── Public API ───────────────────────────────────

  var api = {
    readUrlParams: readUrlParams,
    writeUrlParams: writeUrlParams,
    saveState: saveState,
    loadState: loadState,
    resolveState: resolveState,
    navigateTo: navigateTo,
    initBroadcast: initBroadcast,
    broadcast: broadcast,
    destroyBroadcast: destroyBroadcast,
  };

  global.G281PageRouter = api;

  // G281UI 命名空间别名
  if (!global.G281UI) global.G281UI = {};
  global.G281UI.PageRouter = api;

})(globalThis);
