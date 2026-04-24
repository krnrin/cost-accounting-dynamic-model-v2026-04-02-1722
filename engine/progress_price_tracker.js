/**
 * progress_price_tracker.js — Issue #1: 进度价 = 协议价差距追踪
 *
 * 业务逻辑：
 * 进度价不是「加权混合价」，而是「协议价与实际批量价之间的差距追踪」。
 *
 * 例：
 *   协议价（签约时客户承诺的目标价）= 20 元/件
 *   当前批量采购价 = 22 元/件
 *   缺口 = 22 - 20 = +2 元/件（需要采购持续降价或商务谈判补回）
 *
 * 进度价状态：
 *   - GAP = 0  → ✅ 已落实（批量价 = 协议价）
 *   - GAP > 0  → ⚠️ 超标（批量价高于协议价，需降价或索赔）
 *   - GAP < 0  → 🎉 优于目标（批量价低于协议价，利润空间增加）
 *
 * 每个料号独立追踪，支持按线束/品类/供应商汇总。
 */
(function (global) {
  'use strict';

  // P0#1: 防御性解构 — 提供内联 fallback
  const U = global.G281SharedUtils || {};
  const numberOr = U.numberOr || function (v, fb) { var n = Number(v); return Number.isFinite(n) ? n : fb; };

  /**
   * 单料号进度价追踪
   * @param {Object} params
   * @param {string} params.partNo - 料号
   * @param {number} params.agreedPrice - 协议价（签约时锁定的目标价）
   * @param {number} params.batchPrice - 当前批量采购价（最新一次采购实际价格）
   * @param {number} [params.quotePrice] - 报价时价格（可选，用于 baseline 对比）
   * @param {number} [params.quantity] - 生命周期用量（用于计算总金额缺口）
   * @param {string} [params.supplier] - 供应商
   * @param {string} [params.harnessId] - 所属线束
   * @param {string} [params.category] - 品类（connector/wire/other）
   * @returns {Object} 追踪结果
   */
  function trackPartProgress(params) {
    const agreedPrice = numberOr(params?.agreedPrice, 0);
    const batchPrice = numberOr(params?.batchPrice, 0);
    const quotePrice = numberOr(params?.quotePrice, null);
    const quantity = numberOr(params?.quantity, 0);

    const gap = batchPrice - agreedPrice;
    const gapPct = agreedPrice !== 0 ? gap / agreedPrice : (gap !== 0 ? Infinity : 0);
    const totalGap = gap * quantity;

    let status;
    if (Math.abs(gap) < 0.001) {
      status = 'achieved'; // 已落实
    } else if (gap > 0) {
      status = 'over';     // 超标
    } else {
      status = 'under';    // 优于目标
    }

    const result = {
      partNo: params?.partNo || '',
      supplier: params?.supplier || '',
      harnessId: params?.harnessId || '',
      category: params?.category || '',
      agreedPrice,
      batchPrice,
      gap,           // 单件缺口（正=超标，负=优于目标）
      gapPct,        // 缺口百分比
      totalGap,      // 生命周期总金额缺口
      quantity,
      status,
      statusLabel: STATUS_LABELS[status],
      statusIcon: STATUS_ICONS[status],
    };

    // 可选：与报价时的偏移
    if (quotePrice !== null) {
      result.quotePrice = quotePrice;
      result.quoteToAgreedGap = agreedPrice - quotePrice;   // 报价→协议的变化
      result.quoteToBatchGap = batchPrice - quotePrice;     // 报价→批量的变化
    }

    return result;
  }

  const STATUS_LABELS = {
    achieved: '✅ 已落实',
    over: '⚠️ 超标',
    under: '🎉 优于目标',
  };

  const STATUS_ICONS = {
    achieved: '✅',
    over: '⚠️',
    under: '🎉',
  };

  /**
   * 批量追踪：对所有料号计算进度价
   * @param {Array} items - 料号列表，每个元素包含 { partNo, agreedPrice, batchPrice, quantity, ... }
   * @returns {Object} 汇总结果
   */
  function trackBatch(items) {
    if (!Array.isArray(items)) return { items: [], summary: emptySummary() };

    const tracked = items.map(item => trackPartProgress(item));

    const summary = {
      totalParts: tracked.length,
      achievedCount: tracked.filter(t => t.status === 'achieved').length,
      overCount: tracked.filter(t => t.status === 'over').length,
      underCount: tracked.filter(t => t.status === 'under').length,
      totalPositiveGap: tracked.filter(t => t.gap > 0).reduce((s, t) => s + t.totalGap, 0),
      totalNegativeGap: tracked.filter(t => t.gap < 0).reduce((s, t) => s + t.totalGap, 0),
      netGap: tracked.reduce((s, t) => s + t.totalGap, 0),
      achievedRate: tracked.length > 0
        ? tracked.filter(t => t.status === 'achieved').length / tracked.length
        : 0,
    };

    return { items: tracked, summary };
  }

  /**
   * 按维度汇总
   * @param {Array} trackedItems - trackBatch 输出的 items
   * @param {string} groupBy - 分组维度: 'supplier' | 'harnessId' | 'category'
   * @returns {Array} 分组汇总
   */
  function groupSummary(trackedItems, groupBy) {
    const groups = new Map();
    (trackedItems || []).forEach(item => {
      const key = item[groupBy] || '(未分类)';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(item);
    });

    return Array.from(groups.entries()).map(([key, items]) => ({
      groupKey: key,
      partCount: items.length,
      achievedCount: items.filter(i => i.status === 'achieved').length,
      overCount: items.filter(i => i.status === 'over').length,
      underCount: items.filter(i => i.status === 'under').length,
      netGap: items.reduce((s, i) => s + i.totalGap, 0),
      avgGapPct: items.length > 0
        ? items.reduce((s, i) => s + (Number.isFinite(i.gapPct) ? i.gapPct : 0), 0) / items.length
        : 0,
      topOverParts: items
        .filter(i => i.gap > 0)
        .sort((a, b) => b.totalGap - a.totalGap)
        .slice(0, 5)
        .map(i => ({ partNo: i.partNo, gap: i.gap, totalGap: i.totalGap })),
    }));
  }

  function emptySummary() {
    return {
      totalParts: 0, achievedCount: 0, overCount: 0, underCount: 0,
      totalPositiveGap: 0, totalNegativeGap: 0, netGap: 0, achievedRate: 0,
    };
  }

  // --- 导出 ---
  const api = {
    trackPartProgress,
    trackBatch,
    groupSummary,
    STATUS_LABELS,
    STATUS_ICONS,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  global.G281ProgressPriceTracker = api;
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this);
