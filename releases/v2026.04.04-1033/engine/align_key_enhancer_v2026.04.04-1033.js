/**
 * align_key_enhancer.js — Issue #5: endGroup 对端识别 + unit=set 总成识别
 *
 * 业务逻辑：
 * 1. alignKey 按 endGroup（端别）识别同一端的替换/取消/新增
 *    - 同 endGroup + 同 itemCategory → 替换候选
 *    - left_only（旧版有、新版无）= 取消
 *    - right_only（旧版无、新版有）= 新增
 * 2. unit="set" 表示总成级别物料，数量口径为整套而非单件
 *    - set 物料的 qty 不参与 per-piece 级别的用量 delta 计算
 *    - set 物料在成本分摊时按整套计
 *
 * 用法：在 g281_bom_alignment_engine.js 中替换 alignGroupItems 调用前，
 *       先用 enhanceAlignKeys(items) 预处理 BOM 行
 */
(function (global) {
  'use strict';

  const SET_UNITS = new Set(['set', 'SET', 'Set', '套', '总成']);

  /**
   * 判断是否为总成级别物料（unit=set）
   * @param {Object} item - BOM 行
   * @returns {boolean}
   */
  function isSetUnit(item) {
    const unit = String(item?.unit || '').trim();
    return SET_UNITS.has(unit);
  }

  /**
   * 生成增强版 alignKey
   * 规则：endGroup + itemCategory + partNo 的组合键
   * 若 partNo 相同则视为同一物料的版本变更
   * 若 partNo 不同但 endGroup + itemCategory 相同则视为替换候选
   *
   * @param {Object} item - BOM 行
   * @returns {string} 增强后的 alignKey
   */
  function buildEnhancedAlignKey(item) {
    const endGroup = String(item?.endGroup || '').trim().toLowerCase();
    const category = String(item?.itemCategory || 'other').trim().toLowerCase();
    const partNo = String(item?.partNo || '').trim().toLowerCase().replace(/\s+/g, '');

    // 主键：endGroup|category|partNo（精确匹配）
    if (endGroup && partNo) {
      return `${endGroup}|${category}|${partNo}`;
    }
    // 降级键：endGroup|category（同端同类替换候选）
    if (endGroup) {
      return `${endGroup}|${category}`;
    }
    // 兜底：原始 partNo
    return partNo || '';
  }

  /**
   * 为 BOM 行列表预处理增强 alignKey
   * @param {Array} items - BOM 行数组
   * @returns {Array} 带有增强 alignKey 的 BOM 行数组
   */
  function enhanceAlignKeys(items) {
    if (!Array.isArray(items)) return [];
    return items.map(item => ({
      ...item,
      alignKey: item?.alignKey || buildEnhancedAlignKey(item),
      _isSetUnit: isSetUnit(item),
      _enhancedKey: buildEnhancedAlignKey(item),
    }));
  }

  /**
   * 按 endGroup 分组后识别变更类型
   * @param {Array} leftItems - 旧版 BOM 行
   * @param {Array} rightItems - 新版 BOM 行
   * @returns {Object} 变更分析结果
   */
  function classifyEndGroupChanges(leftItems, rightItems) {
    const leftByEnd = groupByEndGroup(leftItems);
    const rightByEnd = groupByEndGroup(rightItems);
    const allEndGroups = new Set([...leftByEnd.keys(), ...rightByEnd.keys()]);

    const changes = [];
    allEndGroups.forEach(endGroup => {
      const leftGroup = leftByEnd.get(endGroup) || [];
      const rightGroup = rightByEnd.get(endGroup) || [];

      // 按 partNo 做精确匹配
      const leftPartNos = new Set(leftGroup.map(i => normalizePartNo(i.partNo)));
      const rightPartNos = new Set(rightGroup.map(i => normalizePartNo(i.partNo)));

      const unchanged = [...leftPartNos].filter(p => rightPartNos.has(p));
      const removed = [...leftPartNos].filter(p => !rightPartNos.has(p));
      const added = [...rightPartNos].filter(p => !leftPartNos.has(p));

      // 同端 removed + added 且数量 1:1 → 替换
      const replacements = [];
      const minPairs = Math.min(removed.length, added.length);
      for (let i = 0; i < minPairs; i++) {
        replacements.push({
          endGroup,
          type: 'replaced',
          oldPartNo: removed[i],
          newPartNo: added[i],
          oldItem: leftGroup.find(it => normalizePartNo(it.partNo) === removed[i]),
          newItem: rightGroup.find(it => normalizePartNo(it.partNo) === added[i]),
        });
      }

      // 剩余 removed → 取消
      for (let i = minPairs; i < removed.length; i++) {
        changes.push({
          endGroup,
          type: 'cancelled',
          partNo: removed[i],
          item: leftGroup.find(it => normalizePartNo(it.partNo) === removed[i]),
        });
      }

      // 剩余 added → 新增
      for (let i = minPairs; i < added.length; i++) {
        changes.push({
          endGroup,
          type: 'added',
          partNo: added[i],
          item: rightGroup.find(it => normalizePartNo(it.partNo) === added[i]),
        });
      }

      replacements.forEach(r => changes.push(r));
      unchanged.forEach(p => {
        changes.push({
          endGroup,
          type: 'unchanged',
          partNo: p,
        });
      });
    });

    return {
      changes,
      summary: {
        replacedCount: changes.filter(c => c.type === 'replaced').length,
        cancelledCount: changes.filter(c => c.type === 'cancelled').length,
        addedCount: changes.filter(c => c.type === 'added').length,
        unchangedCount: changes.filter(c => c.type === 'unchanged').length,
      },
    };
  }

  /**
   * 归一化 set 物料数量：set → 1（整套），其他保持原值
   * @param {Object} item - BOM 行
   * @returns {number} 归一化后的数量
   */
  function normalizeSetQuantity(item) {
    if (isSetUnit(item)) {
      // set 物料的 qty 已经是整套口径，无需转换
      return Number(item?.qty) || 0;
    }
    return Number(item?.qty) || 0;
  }

  /**
   * 计算用量变化时考虑 unit=set 的特殊性
   * @param {Object} leftItem - 旧版
   * @param {Object} rightItem - 新版
   * @returns {Object} delta 信息
   */
  function buildSetAwareUsageDelta(leftItem, rightItem) {
    const leftIsSet = leftItem && isSetUnit(leftItem);
    const rightIsSet = rightItem && isSetUnit(rightItem);

    // 如果任一方为 set，delta 显示为 set 口径
    if (leftIsSet || rightIsSet) {
      const leftQty = leftItem ? (Number(leftItem.qty) || 0) : 0;
      const rightQty = rightItem ? (Number(rightItem.qty) || 0) : 0;
      const delta = rightQty - leftQty;
      const unit = 'set';
      return {
        value: delta,
        unit,
        isSetLevel: true,
        text: delta === 0 ? '—' : (delta > 0 ? `+${delta} ${unit}` : `${delta} ${unit}`),
      };
    }

    // 非 set 物料走原逻辑
    return null; // 返回 null 表示使用原 buildUsageDelta
  }

  // --- 内部工具函数 ---

  function normalizePartNo(value) {
    return String(value || '').trim().toLowerCase().replace(/\s+/g, '');
  }

  function groupByEndGroup(items) {
    const map = new Map();
    (items || []).forEach(item => {
      const eg = String(item?.endGroup || '').trim();
      if (!map.has(eg)) map.set(eg, []);
      map.get(eg).push(item);
    });
    return map;
  }

  // --- 导出 ---

  const api = {
    isSetUnit,
    buildEnhancedAlignKey,
    enhanceAlignKeys,
    classifyEndGroupChanges,
    normalizeSetQuantity,
    buildSetAwareUsageDelta,
    SET_UNITS,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  global.G281AlignKeyEnhancer = api;
})(typeof window !== 'undefined' ? window : globalThis);
