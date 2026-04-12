/**
 * ui/state/scenario_state.js
 * Issue #6: 场景状态管理模块
 * 从 dashboard.js 提取状态下拉框、draft 读写、计算触发逻辑
 */
(function (global) {
  'use strict';

  // 状态维度配置
  const STATE_DIMENSIONS = [
    { key: 'bom',       label: 'BOM',    options: ['freeze', 'light', 'regress'] },
    { key: 'metal',     label: '金属',   options: ['quote', 'fixed', 'tt'] },
    { key: 'connector', label: '连接器', options: ['quote', 'fixed'] },
    { key: 'sales',     label: '销售',   options: ['quote', 'fixed', 'tt'] },
    { key: 'labor',     label: '工时',   options: ['base', 'optimize', 'ramp'] },
    { key: 'equipment', label: '设备',   options: ['base', 'shared', 'dedicated'] },
    { key: 'packaging', label: '包装',   options: ['base', 'optimize', 'longhaul'] },
    { key: 'mix',       label: '混合',   options: ['quote', 'fixed', 'tt'] },
  ];

  const VAVE_OPTIONS = ['none', 'optimize', 'redesign'];

  let currentState = null;
  let currentDraft = null;
  let eventBus = null;

  function init(bus) {
    eventBus = bus;
    // TODO: 从 dashboard.js 提取状态初始化逻辑
    console.log('[ScenarioState] 初始化');
  }

  function getState() { return currentState; }
  function getDraft() { return currentDraft; }

  function setState(newState) {
    currentState = { ...currentState, ...newState };
    if (eventBus) {
      eventBus.dispatchEvent(new CustomEvent('state:changed', {
        detail: { state: currentState, draft: currentDraft }
      }));
    }
  }

  function updateDraft(changes) {
    currentDraft = { ...currentDraft, ...changes };
    if (eventBus) {
      eventBus.dispatchEvent(new CustomEvent('draft:updated', {
        detail: { draft: currentDraft }
      }));
    }
  }

  // 渲染状态控制面板
  function renderStatePanel(container) {
    // TODO: 从 dashboard.js 提取状态下拉框渲染逻辑
    console.log('[ScenarioState] renderStatePanel 待实现');
  }

  global.G281UI = global.G281UI || {};
  global.G281UI.ScenarioState = {
    STATE_DIMENSIONS, VAVE_OPTIONS,
    init, getState, getDraft, setState, updateDraft, renderStatePanel,
  };
})(typeof window !== 'undefined' ? window : globalThis);
