/**
 * engine/harness_profit.js
 * Issue #9: 线束级利润拆分引擎
 * Issue #33: 残余分摊死代码清除（residualMaterialPool 恒 = 0）
 * 职责：
 *  1. 按 BOM 草案行（harnessDrafts）拆分线束级成本
 *  2. 匹配导线目录（wireLineCatalog），计算导线材料成本
 *  3. 将间接费用（人工、设备、包装、R&D等）按收入比例分摊
 *  4. 输出每条线束的收入/成本/利润/利润率
 *
 * 依赖: G281SharedUtils (engine/shared_utils.js)
 */
(function (global) {
  'use strict';

  // Issue #34: 安全降级
  var U = global.G281SharedUtils || {};
  var numberOr = U.numberOr || function (v, f) { var n = Number(v); return Number.isFinite(n) ? n : f; };
  var safeArray = U.safeArray || function (v) { return Array.isArray(v) ? v : []; };
  var clonePlain = U.clonePlain || function (v, f) { try { return JSON.parse(JSON.stringify(v)); } catch (_) { return f; } };

  var DEFAULT_METAL_COST_PER_KG = { copper: 72, aluminum: 22 };
  var DEFAULT_NON_COPPER_FACTOR = 0.18;

  // ── 导线目录匹配 & 材料成本 ──
  function buildMatchedWireCost(wireLineCatalog, bomWireItems, metalPrices) {
    var catalog = safeArray(wireLineCatalog);
    var items = safeArray(bomWireItems);
    var matchedPartNos = new Set();
    var details = [];
    var totalCost = 0;

    if (!catalog.length) {
      return { totalCost: 0, details: [], matchedPartNos: matchedPartNos };
    }

    var catalogMap = new Map();
    catalog.forEach(function (entry) {
      if (entry.partNo) catalogMap.set(String(entry.partNo).trim(), entry);
    });

    items.forEach(function (bomItem) {
      var partNo = String(bomItem.partNo || '').trim();
      var catalogEntry = catalogMap.get(partNo);
      if (!catalogEntry) return;

      matchedPartNos.add(partNo);

      var weight = numberOr(catalogEntry.weight, 0);
      var material = (catalogEntry.material || 'copper').toLowerCase();
      var pricePerKg = numberOr(
        metalPrices[material],
        metalPrices.copper || DEFAULT_METAL_COST_PER_KG.copper
      );
      var metalCost = weight * pricePerKg;
      var nonMetalCost = metalCost * numberOr(catalogEntry.nonCopperFactor, DEFAULT_NON_COPPER_FACTOR);
      var qty = numberOr(bomItem.qty, 1);
      var cost = (metalCost + nonMetalCost) * qty;

      totalCost += cost;
      details.push({
        partNo: partNo,
        harnessId: bomItem.harnessId,
        gauge: catalogEntry.gauge,
        material: material,
        weight: weight,
        metalCost: metalCost,
        nonMetalCost: nonMetalCost,
        cost: cost,
        qty: qty
      });
    });

    return { totalCost: totalCost, details: details, matchedPartNos: matchedPartNos };
  }

  // ── 主入口 ──
  function buildHarnessProfitBreakdown(runtime, model, options) {
    var harnessDrafts = safeArray((runtime || {}).harnessDrafts);
    var wireLineCatalog = safeArray((runtime || {}).wireLineCatalog);
    var safeOpts = options || {};
    var metalPrices = safeOpts.metalPrices || clonePlain(DEFAULT_METAL_COST_PER_KG, DEFAULT_METAL_COST_PER_KG);
    var warnings = [];

    if (!harnessDrafts.length) {
      return {
        totalRevenue: 0, totalCost: 0, totalProfit: 0, totalMargin: 0,
        harnesses: [], wireLines: [], perSetSummary: [],
        stagnantPool: { amount: 0, note: '\u65e0\u8349\u6848\u884c\u6570\u636e' },
        allocationBasis: { material: '\u5bfc\u7ebf\u76ee\u5f55\u4f18\u5148 \u2192 \u6b8b\u4f59\u8d70\u5446\u6ede\u63d0\u62a5', overhead: '\u6309\u6536\u5165\u5360\u6bd4\u5206\u644a' },
        warnings: ['\u65e0\u8349\u6848\u884c\u6570\u636e\uff0c\u65e0\u6cd5\u62c6\u5206\u7ebf\u675f\u5229\u6da6']
      };
    }

    // ── 1. 导线目录匹配 ──
    var allBomWireItems = [];
    harnessDrafts.forEach(function (draft) {
      safeArray(draft.wireItems).forEach(function (item) {
        allBomWireItems.push(Object.assign({}, item, { harnessId: draft.harnessId }));
      });
    });

    var wireResult = buildMatchedWireCost(wireLineCatalog, allBomWireItems, metalPrices);
    var matchedWireTotal = wireResult.totalCost;
    var matchedWireCostMap = {};
    wireResult.details.forEach(function (d) {
      matchedWireCostMap[d.harnessId] = (matchedWireCostMap[d.harnessId] || 0) + d.cost;
    });

    // ── 2. 残余材料池 ──
    var rawResidual = numberOr(model.materialCost, 0) - matchedWireTotal;

    // Issue #2: 残余材料 \u2192 呆滞提报（不分摊到当前产品成本）
    var stagnantPool = Math.max(rawResidual, 0);
    // Issue #33: residualMaterialPool 恒为 0，残余分摊死代码已全部移除
    if (stagnantPool > 0) {
      warnings.push('\u6b8b\u4f59\u6750\u6599\u6c60 \u00a5' + stagnantPool.toFixed(2) + ' \u5df2\u8f6c\u5165\u5446\u6ede\u63d0\u62a5\u6d41\u7a0b\uff0c\u4e0d\u8ba1\u5165\u4ea7\u54c1\u6210\u672c');
    }

    // 材料总额 = 导线匹配总额（残余已走呆滞，不计入）
    var totalHarnessMaterial = matchedWireTotal;

    // ── 3. 收入分摊 ──
    var totalRevenue = numberOr(model.revenue, 0);
    var totalRevenueShares = harnessDrafts.reduce(
      function (sum, row) { return sum + numberOr(row.revenueShare, 0); }, 0
    ) || 1;

    // ── 4. 按线束拆分 ──
    var harnesses = [];
    var wireLines = [];
    var totalCost = 0;

    harnessDrafts.forEach(function (draftRow) {
      var revenueShare = numberOr(draftRow.revenueShare, 0) / totalRevenueShares;
      var harnessRevenue = totalRevenue * revenueShare;

      var scaledMatchedWireCost = matchedWireTotal > 0
        ? (matchedWireCostMap[draftRow.harnessId] || 0)
        : 0;

      // Issue #33: 残余分摊路径已移除，材料成本 = 导线匹配成本
      var harnessMaterialCost = scaledMatchedWireCost;

      // 间接成本分摊
      var overheadItems = {
        labor: numberOr(model.laborCost, 0) * revenueShare,
        equipment: numberOr(model.equipmentCost, 0) * revenueShare,
        packaging: numberOr(model.packagingCost, 0) * revenueShare,
        rd: numberOr(model.rdCost, 0) * revenueShare
      };
      var overheadCost = Object.values(overheadItems).reduce(function (s, v) { return s + v; }, 0);

      var harnessTotal = harnessMaterialCost + overheadCost;
      var profit = harnessRevenue - harnessTotal;
      var profitMargin = harnessRevenue > 0 ? profit / harnessRevenue : 0;
      totalCost += harnessTotal;

      // 导线行明细
      var matchedWireDetail = safeArray(wireResult.details)
        .filter(function (d) { return d.harnessId === draftRow.harnessId; })
        .map(function (d) {
          return {
            partNo: d.partNo, gauge: d.gauge, material: d.material,
            weight: d.weight, metalCost: d.metalCost, nonMetalCost: d.nonMetalCost,
            cost: d.cost, matched: true
          };
        });

      // P1#5: partNo trim 防止空格导致假阴性
      var unmatchedWires = safeArray(draftRow.wireItems)
        .filter(function (w) { return !wireResult.matchedPartNos.has(String(w.partNo || '').trim()); })
        .map(function (w) {
          return {
            partNo: w.partNo, gauge: w.gauge || '--', material: w.material || '--',
            weight: 0, metalCost: 0, nonMetalCost: 0, cost: 0,
            matched: false, unmatchedMaterialCost: 0
          };
        });

      wireLines.push.apply(wireLines, matchedWireDetail.concat(unmatchedWires));

      var itemStats = draftRow.itemStats || {};
      harnesses.push({
        harnessId: draftRow.harnessId,
        revenue: harnessRevenue,
        materialCost: harnessMaterialCost,
        harnessMaterialCost: harnessMaterialCost,
        scaledMatchedWireCost: scaledMatchedWireCost,
        matchedWireCount: matchedWireDetail.length,
        unmatchedWireCount: unmatchedWires.length,
        // Issue #33: 残余分摊字段保留以兼容下游，值恒为 0
        unmatchedWireAllocatedMaterial: 0,
        nonWireAllocatedMaterial: 0,
        residualMaterialShare: 0,
        overheadCost: overheadCost,
        overheadItems: overheadItems,
        totalCost: harnessTotal,
        profit: profit,
        profitMargin: profitMargin,
        revenueShare: revenueShare,
        costShare: 0,
        matchedWireDetail: matchedWireDetail,
        allocationBasis: {
          matchedWire: '\u5bfc\u7ebf\u76ee\u5f55\u91cd\u91cf \u00d7 \u5f53\u524d\u94dc\u94dd\u4ef7 + \u975e\u94dc\u6210\u672c',
          residualMaterial: '\u6b8b\u4f59\u6750\u6599\u8d70\u5446\u6ede\u63d0\u62a5\u6d41\u7a0b\uff0c\u4e0d\u8ba1\u5165\u5f53\u524d\u4ea7\u54c1\u6210\u672c\uff08Issue #2\uff09',
          overhead: '\u6309\u6536\u5165\u5360\u6bd4\u5206\u644a\u4eba\u5de5/\u8bbe\u5907/\u5305\u88c5/R&D'
        },
        notes: [
          '\u5bfc\u7ebf\u76ee\u5f55\u547d\u4e2d ' + matchedWireDetail.length + ' \u6761 (\u5171 ' + safeArray(draftRow.wireItems).length + ' \u6761)',
          itemStats.unmatchedWireCount
            ? '\u5b58\u5728 ' + itemStats.unmatchedWireCount + ' \u6761\u5bfc\u7ebf\u672a\u547d\u4e2d\u5bfc\u7ebf\u76ee\u5f55\uff0c\u6807\u8bb0\u4e3a\u5446\u6ede\u5019\u9009\uff0c\u4e0d\u8ba1\u5165\u4ea7\u54c1\u6210\u672c\u3002'
            : '\u5bfc\u7ebf\u6750\u6599\u6210\u672c\u5df2\u4f18\u5148\u4f7f\u7528\u5bfc\u7ebf\u76ee\u5f55\u4f30\u7b97\u3002',
          '\u95f4\u63a5\u8d39\u7528\u5206\u644a\u6bd4\u4f8b: ' + (revenueShare * 100).toFixed(1) + '%'
        ]
      });
    });

    // ── 5. costShare 回填 ──
    harnesses.forEach(function (h) {
      h.costShare = totalCost > 0 ? h.totalCost / totalCost : 0;
    });

    // ── 6. 每SET汇总 ──
    var perSetSummary = harnesses.map(function (h) {
      return {
        harnessId: h.harnessId,
        revenuePerSet: h.revenue,
        costPerSet: h.totalCost,
        profitPerSet: h.profit,
        marginPerSet: h.profitMargin
      };
    });

    var totalProfit = totalRevenue - totalCost;
    var totalMargin = totalRevenue > 0 ? totalProfit / totalRevenue : 0;

    return {
      totalRevenue: totalRevenue,
      totalCost: totalCost,
      totalProfit: totalProfit,
      totalMargin: totalMargin,
      harnesses: harnesses,
      wireLines: wireLines,
      perSetSummary: perSetSummary,
      stagnantPool: {
        amount: stagnantPool,
        note: stagnantPool > 0
          ? '\u6b8b\u4f59\u6750\u6599\u5df2\u8f6c\u5165\u5446\u6ede\u63d0\u62a5\u6d41\u7a0b\uff0c\u4e0d\u8ba1\u5165\u4ea7\u54c1\u6210\u672c\uff08Issue #2\uff09'
          : '\u65e0\u6b8b\u4f59\u6750\u6599\uff08\u5bfc\u7ebf\u76ee\u5f55\u5df2\u8986\u76d6\u5168\u90e8\u6750\u6599\u6210\u672c\uff09'
      },
      allocationBasis: {
        material: '\u5bfc\u7ebf\u76ee\u5f55\u4f18\u5148 \u2192 \u6b8b\u4f59\u8d70\u5446\u6ede\u63d0\u62a5',
        overhead: '\u6309\u6536\u5165\u5360\u6bd4\u5206\u644a'
      },
      warnings: warnings
    };
  }

  // ── 导出 ──
  var api = { buildHarnessProfitBreakdown: buildHarnessProfitBreakdown };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  global.G281HarnessProfit = api;
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this);
