/**
 * engine/change_pricing.js
 * 变更报价(设变)引擎 v1.0
 *
 * 支持5种变更场景:
 *   1. bom_change    — BOM变更: 物料增减/替代/单价变化
 *   2. metal_change  — 金属联动: 铜价/铝价变化 (只影响导线金属部分)
 *   3. hours_change  — 工时变更: 工艺改进/自动化升级
 *   4. config_change — 配置变更: 装车比调整
 *   5. annual_drop   — 年降: 年度降价率
 *
 * 核心原则:
 *   - 变更基于「定点版」(baseline) 数据
 *   - 逐零件号独立计算变更影响
 *   - 管理费/利润等比率项自动联动
 *   - 输出: 逐零件号变更明细 + 项目级影响 + 年度影响
 *
 * 变更影响链:
 *   BOM变更 → 材料成本变化 → 废品联动 → 管理费联动 → 利润联动 → 出厂价 → 到厂价
 *   金属联动 → 导线金属部分成本变化 → 废品联动 → 管理费联动 → 利润联动
 *   工时变更 → 人工变化 + 制造费变化 → 管理费联动 → 利润联动
 *   配置变更 → 装车比变化 → 单车加权成本变化 (单件价格不变)
 *   年降 → 逐年到厂价 = 基准 × (1 - 年降率)^(N-1)
 *
 * 依赖: G281SharedUtils, G281HarnessCosting
 */
(function (global) {
  'use strict';

  var U = global.G281SharedUtils || {};
  var numberOr = U.numberOr || function (v, f) { var n = Number(v); return Number.isFinite(n) ? n : f; };
  var safeArray = U.safeArray || function (v) { return Array.isArray(v) ? v : []; };

  var HarnessCosting = global.G281HarnessCosting || {};
  var computeHarnessCost = HarnessCosting.computeHarnessCost || function () { return {}; };
  var computeProjectFromHarnesses = HarnessCosting.computeProjectFromHarnesses || function () { return {}; };

  // ── 空成本对象 (用于delta计算) ──
  function zeroCost() {
    return {
      materialCost: 0, wasteCost: 0, directLabor: 0, manufacturing: 0,
      laborPlusMfg: 0, mgmtFee: 0, profit: 0, exFactoryPrice: 0,
      packSubtotal: 0, freightSubtotal: 0, packTotal: 0, deliveredPrice: 0,
      copperWeight: 0, aluminumWeight: 0, processHours: 0,
    };
  }

  /**
   * 计算两个版本之间的成本差异 (逐项)
   */
  function buildDelta(before, after) {
    var b = before || zeroCost();
    var a = after || zeroCost();

    return {
      materialCost: numberOr(a.materialCost, 0) - numberOr(b.materialCost, 0),
      wasteCost: numberOr(a.wasteCost, 0) - numberOr(b.wasteCost, 0),
      directLabor: numberOr(a.directLabor, 0) - numberOr(b.directLabor, 0),
      manufacturing: numberOr(a.manufacturing, 0) - numberOr(b.manufacturing, 0),
      laborPlusMfg: numberOr(a.laborPlusMfg, 0) - numberOr(b.laborPlusMfg, 0),
      mgmtFee: numberOr(a.mgmtFee, 0) - numberOr(b.mgmtFee, 0),
      profit: numberOr(a.profit, 0) - numberOr(b.profit, 0),
      exFactoryPrice: numberOr(a.exFactoryPrice, 0) - numberOr(b.exFactoryPrice, 0),
      packSubtotal: numberOr(a.packSubtotal, 0) - numberOr(b.packSubtotal, 0),
      freightSubtotal: numberOr(a.freightSubtotal, 0) - numberOr(b.freightSubtotal, 0),
      packTotal: numberOr(a.packTotal, 0) - numberOr(b.packTotal, 0),
      deliveredPrice: numberOr(a.deliveredPrice, 0) - numberOr(b.deliveredPrice, 0),
      copperWeight: numberOr(a.copperWeight, 0) - numberOr(b.copperWeight, 0),
      aluminumWeight: numberOr(a.aluminumWeight, 0) - numberOr(b.aluminumWeight, 0),
      processHours: numberOr(a.processHours, 0) - numberOr(b.processHours, 0),
    };
  }

  /**
   * 检测变更类型的细分
   */
  function detectDetailedChangeType(before, after) {
    if (!before) return 'add';
    if (!after) return 'remove';
    var d = buildDelta(before, after);
    var types = [];
    if (Math.abs(d.materialCost) > 0.001) types.push('material');
    if (Math.abs(d.processHours) > 0.0001) types.push('hours');
    if (Math.abs(d.packTotal) > 0.001) types.push('packaging');
    return types.length > 0 ? types.join('+') : 'no_change';
  }

  /**
   * computeChangePricing — 对比两个版本，生成变更报价明细
   *
   * @param {Object} baseProject - 基准版本 (computeProjectFromHarnesses的结果)
   * @param {Object} newProject  - 变更版本
   * @param {string} changeType  - 变更类型标记
   * @param {Object} options     - 可选参数
   *   - annualVolumes {Array} 年度产量 (用于计算年度影响)
   *   - lifecycleYears {number} 生命周期年数
   * @returns {Object} 变更报价结果
   */
  function computeChangePricing(baseProject, newProject, changeType, options) {
    var opts = options || {};
    var baseHarnesses = safeArray(baseProject.harnesses);
    var newHarnesses = safeArray(newProject.harnesses);

    // 找出所有涉及的零件号
    var allIds = new Set();
    baseHarnesses.forEach(function (h) { allIds.add(h.harnessId); });
    newHarnesses.forEach(function (h) { allIds.add(h.harnessId); });

    var baseMap = {};
    baseHarnesses.forEach(function (h) { baseMap[h.harnessId] = h; });
    var newMap = {};
    newHarnesses.forEach(function (h) { newMap[h.harnessId] = h; });

    var changes = [];
    var unchangedCount = 0;

    allIds.forEach(function (id) {
      var base = baseMap[id] || null;
      var curr = newMap[id] || null;

      if (!base && curr) {
        // 新增零件号
        changes.push({
          harnessId: id,
          harnessName: curr.harnessName || '',
          changeCategory: 'add',
          detailedType: 'add',
          before: null,
          after: curr,
          delta: buildDelta(null, curr),
        });
      } else if (base && !curr) {
        // 删除零件号
        changes.push({
          harnessId: id,
          harnessName: base.harnessName || '',
          changeCategory: 'remove',
          detailedType: 'remove',
          before: base,
          after: null,
          delta: buildDelta(base, null),
        });
      } else if (base && curr) {
        var delta = buildDelta(base, curr);
        if (Math.abs(delta.deliveredPrice) > 0.001) {
          changes.push({
            harnessId: id,
            harnessName: curr.harnessName || base.harnessName || '',
            changeCategory: 'modify',
            detailedType: detectDetailedChangeType(base, curr),
            before: base,
            after: curr,
            delta: delta,
          });
        } else {
          unchangedCount++;
        }
      }
    });

    // 项目级汇总
    var totalBefore = numberOr(baseProject.vehicleCost, 0);
    var totalAfter = numberOr(newProject.vehicleCost, 0);
    var totalDelta = totalAfter - totalBefore;

    // 年度影响
    var annualImpact = null;
    if (opts.annualVolumes && opts.annualVolumes.length > 0) {
      annualImpact = computeAnnualImpact(totalDelta, opts.annualVolumes);
    }

    return {
      changeType: changeType || 'unspecified',
      timestamp: new Date().toISOString(),
      changes: changes,
      summary: {
        totalBefore: totalBefore,
        totalAfter: totalAfter,
        totalDelta: totalDelta,
        deltaPercent: totalBefore > 0 ? (totalDelta / totalBefore * 100) : 0,
        affectedCount: changes.length,
        unchangedCount: unchangedCount,
        addedCount: changes.filter(function (c) { return c.changeCategory === 'add'; }).length,
        removedCount: changes.filter(function (c) { return c.changeCategory === 'remove'; }).length,
        modifiedCount: changes.filter(function (c) { return c.changeCategory === 'modify'; }).length,
      },
      annualImpact: annualImpact,
    };
  }

  /**
   * 计算年度影响金额
   */
  function computeAnnualImpact(deltaPerVehicle, annualVolumes) {
    var volumes = safeArray(annualVolumes);
    var years = [];
    var totalImpact = 0;

    for (var i = 0; i < volumes.length; i++) {
      var vol = numberOr(volumes[i], 0);
      var impact = deltaPerVehicle * vol;
      totalImpact += impact;
      years.push({
        year: i + 1,
        volume: vol,
        deltaPerVehicle: deltaPerVehicle,
        annualImpact: impact,
        cumulativeImpact: totalImpact,
      });
    }

    return {
      years: years,
      totalLifecycleImpact: totalImpact,
      totalLifecycleVolume: volumes.reduce(function (s, v) { return s + numberOr(v, 0); }, 0),
    };
  }

  /**
   * computeMetalEscalation — 金属联动专用
   *
   * 只替换金属价格重算，所有其他参数(BOM/工时/包装等)保持不变
   * 只有导线中的金属部分跟随联动:
   *   - 连接器/端子/辅料: 不受影响
   *   - 非金属部分(绝缘层): 不受影响
   *
   * @param {Array} baseHarnessConfigs - 原始线束配置 (含BOM/工时/包装)
   * @param {Object} baseMetalPrices - 基准金属价格 {copper, aluminum}
   * @param {Object} newMetalPrices  - 新金属价格 {copper, aluminum}
   * @param {Object} params - 核算参数 (不含metalPrices)
   * @returns {Object} 变更报价结果
   */
  function computeMetalEscalation(baseHarnessConfigs, baseMetalPrices, newMetalPrices, params) {
    var configs = safeArray(baseHarnessConfigs);
    var baseParams = Object.assign({}, params, { metalPrices: baseMetalPrices });
    var newParams = Object.assign({}, params, { metalPrices: newMetalPrices });

    var baseResults = configs.map(function (c) { return computeHarnessCost(c, baseParams); });
    var newResults = configs.map(function (c) { return computeHarnessCost(c, newParams); });

    var baseProject = computeProjectFromHarnesses(baseResults);
    var newProject = computeProjectFromHarnesses(newResults);

    var result = computeChangePricing(baseProject, newProject, 'metal_escalation', params);

    // 追加金属价格信息
    result.metalPrices = {
      before: baseMetalPrices,
      after: newMetalPrices,
      delta: {
        copper: numberOr(newMetalPrices.copper, 0) - numberOr(baseMetalPrices.copper, 0),
        aluminum: numberOr(newMetalPrices.aluminum, 0) - numberOr(baseMetalPrices.aluminum, 0),
      },
    };

    return result;
  }

  /**
   * computeAnnualDrop — 年降计算
   *
   * @param {number} baseDeliveredPrice - 基准到厂价
   * @param {number} annualDropRate - 年降率 (如 0.03 = 3%)
   * @param {number} years - 年数
   * @returns {Array} 逐年到厂价
   */
  function computeAnnualDrop(baseDeliveredPrice, annualDropRate, years) {
    var base = numberOr(baseDeliveredPrice, 0);
    var rate = numberOr(annualDropRate, 0);
    var n = Math.max(1, numberOr(years, 6));
    var result = [];

    for (var y = 1; y <= n; y++) {
      var factor = Math.pow(1 - rate, y - 1);
      result.push({
        year: y,
        factor: factor,
        deliveredPrice: base * factor,
        dropFromBase: base * (1 - factor),
        dropPercent: (1 - factor) * 100,
      });
    }

    return result;
  }

  /**
   * buildChangeComparisonTable — 生成变更对比表 (用于UI展示)
   */
  function buildChangeComparisonTable(changePricingResult) {
    var changes = safeArray(changePricingResult.changes);
    var columns = [
      { key: 'harnessId', label: '零件号' },
      { key: 'harnessName', label: '名称' },
      { key: 'changeCategory', label: '变更类型' },
      { key: 'beforePrice', label: '定点价', unit: '元' },
      { key: 'afterPrice', label: '变更后', unit: '元' },
      { key: 'deltaPrice', label: '差异', unit: '元' },
      { key: 'deltaPercent', label: '差异%', unit: '%' },
    ];

    var rows = changes.map(function (c) {
      var beforePrice = c.before ? c.before.deliveredPrice : 0;
      var afterPrice = c.after ? c.after.deliveredPrice : 0;
      return {
        harnessId: c.harnessId,
        harnessName: c.harnessName,
        changeCategory: c.changeCategory === 'add' ? '新增' : c.changeCategory === 'remove' ? '删除' : '变更',
        beforePrice: beforePrice,
        afterPrice: afterPrice,
        deltaPrice: c.delta.deliveredPrice,
        deltaPercent: beforePrice > 0 ? (c.delta.deliveredPrice / beforePrice * 100) : 0,
      };
    });

    var summary = changePricingResult.summary;
    var totals = {
      harnessId: '单车影响',
      harnessName: '',
      changeCategory: '',
      beforePrice: summary.totalBefore,
      afterPrice: summary.totalAfter,
      deltaPrice: summary.totalDelta,
      deltaPercent: summary.deltaPercent,
    };

    return { columns: columns, rows: rows, totals: totals };
  }

  // ── 导出 ──
  var api = {
    computeChangePricing: computeChangePricing,
    computeMetalEscalation: computeMetalEscalation,
    computeAnnualDrop: computeAnnualDrop,
    computeAnnualImpact: computeAnnualImpact,
    buildChangeComparisonTable: buildChangeComparisonTable,
    buildDelta: buildDelta,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  global.G281ChangePricing = api;
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this);
