/**
 * ui/utils/dom.js
 * 统一 DOM 工具函数 — 消除 version_timeline.js / logic_drawer.js 等模块中的重复定义
 */
(function (global) {
  'use strict';

  /**
   * 创建 DOM 元素并设置 className 和 textContent
   */
  function createNode(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  /**
   * 清空 DOM 子节点
   */
  function clearElement(node) {
    while (node.firstChild) node.removeChild(node.firstChild);
  }

  /**
   * 安全数组：非数组返回空数组
   */
  function safeArray(value) {
    return Array.isArray(value) ? value : [];
  }

  /**
   * 安全对象：非对象返回空对象
   */
  function safeObject(value) {
    return value && typeof value === 'object' ? value : {};
  }

  global.G281UI = global.G281UI || {};
  global.G281UI.Dom = {
    createNode: createNode,
    clearElement: clearElement,
    safeArray: safeArray,
    safeObject: safeObject,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = global.G281UI.Dom;
  }
})(globalThis);
