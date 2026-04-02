/**
 * shared/page_router.js
 * Issue #13: 页面路由 + 共享状态桥接
 * 处理跨页面状态传递（通过 URL params / sessionStorage）
 */
(function (global) {
  'use strict';

  const STORAGE_KEY = 'g281_page_state';

  // 从 URL 参数读取状态
  function readUrlParams() {
    const params = new URLSearchParams(location.search);
    const state = {};
    for (const [key, value] of params.entries()) {
      state[key] = value;
    }
    return state;
  }

  // 写入 URL 参数（不刷新页面）
  function writeUrlParams(state) {
    const params = new URLSearchParams();
    Object.entries(state || {}).forEach(([key, value]) => {
      if (value !== null && value !== undefined && value !== '') {
        params.set(key, String(value));
      }
    });
    const newUrl = `${location.pathname}?${params.toString()}`;
    history.replaceState(null, '', newUrl);
  }

  // sessionStorage 持久化
  function saveState(state) {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (_) {}
  }

  function loadState() {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (_) {
      return {};
    }
  }

  // 合并 URL 参数 + sessionStorage（URL 优先）
  function resolveState() {
    const stored = loadState();
    const urlState = readUrlParams();
    return { ...stored, ...urlState };
  }

  // 导航到另一个页面并携带状态
  function navigateTo(pageFile, extraState) {
    const currentState = resolveState();
    const mergedState = { ...currentState, ...extraState };
    saveState(mergedState);
    const params = new URLSearchParams();
    Object.entries(mergedState).forEach(([key, value]) => {
      if (value !== null && value !== undefined && value !== '') {
        params.set(key, String(value));
      }
    });
    const prefix = location.pathname.includes('/pages/') ? '' : 'pages/';
    location.href = `${prefix}${pageFile}?${params.toString()}`;
  }

  // 注册跨页面消息监听（用于同源 iframe 或 BroadcastChannel）
  let channel = null;
  function initBroadcast(onMessage) {
    if (typeof BroadcastChannel !== 'undefined') {
      channel = new BroadcastChannel('g281_page_sync');
      channel.onmessage = (event) => {
        if (typeof onMessage === 'function') onMessage(event.data);
      };
    }
  }

  function broadcast(data) {
    if (channel) channel.postMessage(data);
  }

  global.G281PageRouter = {
    readUrlParams,
    writeUrlParams,
    saveState,
    loadState,
    resolveState,
    navigateTo,
    initBroadcast,
    broadcast,
  };
})(typeof window !== 'undefined' ? window : globalThis);
