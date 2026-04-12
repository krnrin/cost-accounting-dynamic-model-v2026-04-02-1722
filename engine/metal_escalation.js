/**
 * engine/metal_escalation.js
 * 金属联动计算模块 v1.0
 *
 * 专门处理铜价/铝价变化对高压线束成本的联动影响。
 *
 * 联动规则:
 *   1. 只有导线中的金属部分跟随联动
 *   2. 非金属部分(绝缘层、编织、护套)不受影响
 *   3. 连接器/端子/辅料的价格不受金属联动影响
 *   4. 废品/管理费/利润按比率自动联动
 *   5. 每个零件号独立计算 (因为铜铝占比不同)
 *
 * 合同联动条款模型 (可配置):
 *   - 基准价: 合同约定的基准铜价/铝价
 *   - 联动阈值: 超出基准 ±X% 才触发联动 (如 ±5%)
 *   - 联动比例: 超出阈值的部分按 Y% 联动 (如 100%)
 *   - 联动周期: 季度/半年/年度
 *
 * 依赖: G281SharedUtils, G281HarnessCosting
 */
(function (global) {
  'use strict';

  var U = global.G281SharedUtils || {};
  var numberOr = U.numberOr || function (v, f) { var n = Number(v); return Number.isFinite(n) ? n : f; };
  var safeArray = U.safeArray || function (v) { return Array.isArray(v) ? v : []; };

  /**
   * 默认联动合同条款
   */
  var DEFAULT_CONTRACT = {
    baseCopperPrice: 68400,    // 基准铜价 (元/吨)
    baseAluminumPrice: 18200,  // 基准铝价 (元/吨)
    thresholdPercent: 0,       // 联动阈值 (0 = 无阈值, 0.05 = ±5%)
    escalationRatio: 1.0,      // 联动比例 (1.0 = 100%)
    period: 'quarterly',       // 联动周期: quarterly/semiannual/annual
  };

  /**
   * computeMetalDelta — 计算单个零件号的金属联动影响
   *
   * @param {Object} harness - 线束核算结果 (computeHarnessCost的输出)
   * @param {Object} baseMetal - 基准金属价格 {copper, aluminum}
   * @param {Object} newMetal  - 新金属价格 {copper, aluminum}
   * @param {Object} contract  - 联动合同条款
   * @returns {Object} 联动影响明细
   */
  function computeMetalDelta(harness, baseMetal, newMetal, contract) {
    var ct = contract || DEFAULT_CONTRACT;
    var cuWeight = numberOr(harness.copperWeight, 0);   // kg
    var alWeight = numberOr(harness.aluminumWeight, 0);  // kg

    var baseCuPrice = numberOr(baseMetal.copper, ct.baseCopperPrice);
    var baseAlPrice = numberOr(baseMetal.aluminum, ct.baseAluminumPrice);
    var newCuPrice = numberOr(newMetal.copper, baseCuPrice);
    var newAlPrice = numberOr(newMetal.aluminum, baseAlPrice);

    // 应用联动阈值和比例
    var effectiveCuDelta = applyThreshold(baseCuPrice, newCuPrice, ct.thresholdPercent, ct.escalationRatio);
    var effectiveAlDelta = applyThreshold(baseAlPrice, newAlPrice, ct.thresholdPercent, ct.escalationRatio);

    // 金属成本变化 (kg × 元/吨 ÷ 1000 = 元)
    var deltaCuCost = cuWeight * effectiveCuDelta / 1000;
    var deltaAlCost = alWeight * effectiveAlDelta / 1000;
    var deltaMaterialCost = deltaCuCost + deltaAlCost;

    // 联动: 废品率
    var wasteRate = (harness._params && harness._params.wasteRate) || 0.01;
    var deltaWaste = deltaMaterialCost * wasteRate;

    // 联动: 管理费率 — 管理费基数不含废品!
    var mgmtRate = (harness._params && harness._params.mgmtRate) || 0.06;
    var deltaMgmt = deltaMaterialCost * mgmtRate;  // 只有材料变化影响管理费 (工时未变)

    // 联动: 利润率 — 利润基数含废品
    var profitRate = (harness._params && harness._params.profitRate) || 0.056627;
    var deltaProfit = (deltaMaterialCost + deltaWaste + deltaMgmt) * profitRate;

    // 总到厂价变化 (包装/运输不受金属联动影响)
    var deltaDeliveredPrice = deltaMaterialCost + deltaWaste + deltaMgmt + deltaProfit;

    return {
      harnessId: harness.harnessId,
      harnessName: harness.harnessName,
      vehicleRatio: numberOr(harness.vehicleRatio, 0),
      copperWeight: cuWeight,
      aluminumWeight: alWeight,

      // 价格变化
      copperPriceDelta: effectiveCuDelta,
      aluminumPriceDelta: effectiveAlDelta,

      // 成本变化
      deltaCopperCost: deltaCuCost,
      deltaAluminumCost: deltaAlCost,
      deltaMaterialCost: deltaMaterialCost,
      deltaWasteCost: deltaWaste,
      deltaMgmtFee: deltaMgmt,
      deltaProfit: deltaProfit,
      deltaDeliveredPrice: deltaDeliveredPrice,

      // 原始到厂价
      baseDeliveredPrice: numberOr(harness.deliveredPrice, 0),
      newDeliveredPrice: numberOr(harness.deliveredPrice, 0) + deltaDeliveredPrice,

      // 加权影响
      weightedDelta: deltaDeliveredPrice * numberOr(harness.vehicleRatio, 0),
    };
  }

  /**
   * 应用联动阈值和比例
   * @returns {number} 生效的价格变化 (元/吨)
   */
  function applyThreshold(basePrice, newPrice, thresholdPercent, ratio) {
    var threshold = numberOr(thresholdPercent, 0);
    var escalationRatio = numberOr(ratio, 1.0);
    var delta = newPrice - basePrice;

    if (threshold <= 0) {
      // 无阈值，全部联动
      return delta * escalationRatio;
    }

    var thresholdAmount = basePrice * threshold;
    if (Math.abs(delta) <= thresholdAmount) {
      return 0; // 在阈值范围内，不联动
    }

    // 超出阈值部分联动
    var sign = delta > 0 ? 1 : -1;
    var excess = Math.abs(delta) - thresholdAmount;
    return sign * excess * escalationRatio;
  }

  /**
   * computeProjectMetalEscalation — 项目级金属联动计算
   *
   * @param {Array} harnessResults - 所有线束的核算结果
   * @param {Object} baseMetal - 基准金属价格
   * @param {Object} newMetal  - 新金属价格
   * @param {Object} contract  - 联动合同条款
   * @param {Object} options   - {annualVolumes}
   * @returns {Object} 项目级联动结果
   */
  function computeProjectMetalEscalation(harnessResults, baseMetal, newMetal, contract, options) {
    var harnesses = safeArray(harnessResults);
    var opts = options || {};
    var deltas = [];
    var totalWeightedDelta = 0;

    for (var i = 0; i < harnesses.length; i++) {
      var d = computeMetalDelta(harnesses[i], baseMetal, newMetal, contract);
      deltas.push(d);
      totalWeightedDelta += d.weightedDelta;
    }

    // 年度影响
    var annualImpact = null;
    if (opts.annualVolumes) {
      var volumes = safeArray(opts.annualVolumes);
      var years = [];
      var cumulative = 0;
      for (var j = 0; j < volumes.length; j++) {
        var vol = numberOr(volumes[j], 0);
        var impact = totalWeightedDelta * vol;
        cumulative += impact;
        years.push({
          year: j + 1,
          volume: vol,
          annualImpact: impact,
          cumulativeImpact: cumulative,
        });
      }
      annualImpact = {
        years: years,
        totalLifecycleImpact: cumulative,
      };
    }

    return {
      metalPrices: {
        before: baseMetal,
        after: newMetal,
        delta: {
          copper: numberOr(newMetal.copper, 0) - numberOr(baseMetal.copper, 0),
          aluminum: numberOr(newMetal.aluminum, 0) - numberOr(baseMetal.aluminum, 0),
        },
      },
      harnesses: deltas,
      summary: {
        totalWeightedDelta: totalWeightedDelta,
        affectedCount: deltas.filter(function (d) { return Math.abs(d.deltaDeliveredPrice) > 0.001; }).length,
        totalCopperWeight: deltas.reduce(function (s, d) { return s + d.copperWeight; }, 0),
        totalAluminumWeight: deltas.reduce(function (s, d) { return s + d.aluminumWeight; }, 0),
      },
      annualImpact: annualImpact,
    };
  }

  /**
   * buildMetalSensitivityMatrix — 金属价格敏感度矩阵
   * 展示不同铜价/铝价组合下的单车成本
   *
   * @param {Array} harnessResults - 线束核算结果
   * @param {Object} baseMetal - 基准金属价格
   * @param {Array} copperPriceRange - 铜价范围 [60000, 65000, 70000, 75000, 80000]
   * @param {Array} aluminumPriceRange - 铝价范围 (可选)
   * @returns {Object} 敏感度矩阵
   */
  function buildMetalSensitivityMatrix(harnessResults, baseMetal, copperPriceRange, aluminumPriceRange) {
    var cuRange = safeArray(copperPriceRange);
    var alRange = safeArray(aluminumPriceRange);
    if (alRange.length === 0) alRange = [numberOr(baseMetal.aluminum, 18200)];

    var matrix = [];

    for (var i = 0; i < cuRange.length; i++) {
      var row = [];
      for (var j = 0; j < alRange.length; j++) {
        var escalation = computeProjectMetalEscalation(
          harnessResults, baseMetal,
          { copper: cuRange[i], aluminum: alRange[j] },
          null, null
        );
        row.push({
          copper: cuRange[i],
          aluminum: alRange[j],
          deltaPerVehicle: escalation.summary.totalWeightedDelta,
        });
      }
      matrix.push(row);
    }

    return {
      baseMetal: baseMetal,
      copperRange: cuRange,
      aluminumRange: alRange,
      matrix: matrix,
    };
  }

  // ── 导出 ──
  var api = {
    computeMetalDelta: computeMetalDelta,
    computeProjectMetalEscalation: computeProjectMetalEscalation,
    buildMetalSensitivityMatrix: buildMetalSensitivityMatrix,
    applyThreshold: applyThreshold,
    DEFAULT_CONTRACT: DEFAULT_CONTRACT,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  global.G281MetalEscalation = api;
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this);
