/**
 * engine/tooling_allocation.js
 * 一次性费用分摊模块 v1.0
 *
 * 一次性费用包括: 工装夹具、试验费、研发费 等
 * 分摊逻辑:
 *   - 分摊矩阵: 行=费用项, 列=线束号
 *   - 每行有: 费用项名称, 单价, 每条线束的需求数量
 *   - 某线束某费用项的分摊额 = 单价 × 该线束需求数量 ÷ 分摊基数
 *   - 某线束的一次性费用总分摊 = Σ(所有费用项的分摊额)
 *   - 累计产量达到分摊基数后, 该线束售价降价(去掉分摊额)
 *
 * 数据结构:
 *   allocationMatrix = [
 *     {
 *       itemName: '气动辅助工装',
 *       unitPrice: 40000,
 *       allocations: {
 *         '6608491523': 0.65,   // 该线束需要0.65个
 *         '6608442966': 3,      // 该线束需要3个
 *         // 未列出的线束 = 0, 不参与此项分摊
 *       }
 *     },
 *     ...
 *   ]
 *
 * 依赖: G281SharedUtils
 */
(function (global) {
  'use strict';

  var U = global.G281SharedUtils || {};
  var numberOr = U.numberOr || function (v, f) { var n = Number(v); return Number.isFinite(n) ? n : f; };
  var safeArray = U.safeArray || function (v) { return Array.isArray(v) ? v : []; };

  /** 默认分摊基数 */
  var DEFAULT_AMORTIZATION_BASE = 50000;

  /**
   * computeHarnessAllocation — 计算单条线束的一次性费用分摊
   *
   * @param {string} harnessId — 线束号
   * @param {Array} allocationMatrix — 分摊矩阵
   * @param {number} amortizationBase — 分摊基数 (默认50000)
   * @returns {Object} { totalCost, perUnitCost, items[] }
   */
  function computeHarnessAllocation(harnessId, allocationMatrix, amortizationBase) {
    var matrix = safeArray(allocationMatrix);
    var base = numberOr(amortizationBase, DEFAULT_AMORTIZATION_BASE);
    var items = [];
    var totalCost = 0;

    for (var i = 0; i < matrix.length; i++) {
      var row = matrix[i];
      var unitPrice = numberOr(row.unitPrice, 0);
      var qty = numberOr(row.allocations && row.allocations[harnessId], 0);

      if (qty === 0) continue; // 该线束不参与此项分摊

      var itemTotal = unitPrice * qty;
      var perUnit = base > 0 ? itemTotal / base : 0;

      items.push({
        itemName: row.itemName || '',
        category: row.category || 'tooling',
        unitPrice: unitPrice,
        quantity: qty,
        itemTotal: itemTotal,
        perUnit: perUnit
      });

      totalCost += itemTotal;
    }

    var perUnitCost = base > 0 ? totalCost / base : 0;

    return {
      harnessId: harnessId,
      amortizationBase: base,
      totalCost: totalCost,
      perUnitCost: perUnitCost,
      items: items,
      itemCount: items.length
    };
  }

  /**
   * computeProjectAllocations — 计算所有线束的一次性费用分摊
   *
   * @param {Array} harnessIds — 所有线束号
   * @param {Array} allocationMatrix — 分摊矩阵
   * @param {number} amortizationBase — 分摊基数
   * @returns {Object} { byHarness: {harnessId: result}, summary }
   */
  function computeProjectAllocations(harnessIds, allocationMatrix, amortizationBase) {
    var ids = safeArray(harnessIds);
    var byHarness = {};
    var projectTotal = 0;

    for (var i = 0; i < ids.length; i++) {
      var result = computeHarnessAllocation(ids[i], allocationMatrix, amortizationBase);
      byHarness[ids[i]] = result;
      projectTotal += result.totalCost;
    }

    return {
      byHarness: byHarness,
      summary: {
        projectTotalCost: projectTotal,
        amortizationBase: numberOr(amortizationBase, DEFAULT_AMORTIZATION_BASE),
        harnessCount: ids.length,
        matrixItemCount: safeArray(allocationMatrix).length
      }
    };
  }

  /**
   * computePriceReduction — 计算降价后的成本
   * 当累计产量达到分摊基数后, 去掉一次性费用分摊
   *
   * @param {number} baseCost — 含分摊的线束成本
   * @param {number} allocationPerUnit — 每根分摊额
   * @param {number} cumulativeProduction — 累计产量
   * @param {number} amortizationBase — 分摊基数
   * @returns {Object} { currentCost, isAmortized, reductionAmount }
   */
  function computePriceReduction(baseCost, allocationPerUnit, cumulativeProduction, amortizationBase) {
    var base = numberOr(amortizationBase, DEFAULT_AMORTIZATION_BASE);
    var cumProd = numberOr(cumulativeProduction, 0);
    var perUnit = numberOr(allocationPerUnit, 0);
    var cost = numberOr(baseCost, 0);

    var isAmortized = cumProd >= base;
    var currentCost = isAmortized ? (cost - perUnit) : cost;
    var reductionAmount = isAmortized ? perUnit : 0;

    return {
      currentCost: currentCost,
      isAmortized: isAmortized,
      reductionAmount: reductionAmount,
      cumulativeProduction: cumProd,
      amortizationBase: base,
      progress: base > 0 ? Math.min(cumProd / base, 1) : 0
    };
  }

  /**
   * buildAllocationMatrixSummary — 生成分摊矩阵摘要表 (用于UI展示)
   *
   * @param {Array} harnessIds — 线束号列表
   * @param {Array} allocationMatrix — 分摊矩阵
   * @param {number} amortizationBase — 分摊基数
   * @returns {Object} { rows, columns, totals }
   */
  function buildAllocationMatrixSummary(harnessIds, allocationMatrix, amortizationBase) {
    var ids = safeArray(harnessIds);
    var matrix = safeArray(allocationMatrix);
    var base = numberOr(amortizationBase, DEFAULT_AMORTIZATION_BASE);

    var rows = matrix.map(function (row) {
      var rowData = {
        itemName: row.itemName || '',
        category: row.category || 'tooling',
        unitPrice: numberOr(row.unitPrice, 0)
      };
      var rowTotal = 0;
      ids.forEach(function (id) {
        var qty = numberOr(row.allocations && row.allocations[id], 0);
        rowData[id] = qty;
        rowTotal += numberOr(row.unitPrice, 0) * qty;
      });
      rowData._rowTotal = rowTotal;
      return rowData;
    });

    // 每条线束的列合计
    var columnTotals = {};
    ids.forEach(function (id) {
      var total = 0;
      matrix.forEach(function (row) {
        total += numberOr(row.unitPrice, 0) * numberOr(row.allocations && row.allocations[id], 0);
      });
      columnTotals[id] = {
        totalCost: total,
        perUnit: base > 0 ? total / base : 0
      };
    });

    return {
      rows: rows,
      harnessIds: ids,
      columnTotals: columnTotals,
      amortizationBase: base
    };
  }

  // ── 导出 ──
  var api = {
    DEFAULT_AMORTIZATION_BASE: DEFAULT_AMORTIZATION_BASE,
    computeHarnessAllocation: computeHarnessAllocation,
    computeProjectAllocations: computeProjectAllocations,
    computePriceReduction: computePriceReduction,
    buildAllocationMatrixSummary: buildAllocationMatrixSummary,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  global.G281ToolingAllocation = api;
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this);
