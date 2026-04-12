/**
 * engine/quote_template.js
 * 客户报价模板映射引擎 v1.0
 *
 * 将内部核算结果映射到不同客户的标准报价格式。
 *
 * 吉利模板 (高压线束包总报价模板):
 *   到厂价 = 出厂价(不含分摊) + 分摊费用
 *         = [A1+A2+B1+B2+C1+C2+C3+D] + [E1+E2+F1+F2+G1+G2]
 *
 *   A1 = 原材料 (导线类BOM行: 铜+铝+非金属)
 *   A2 = 外购件 (连接器+端子+辅料)
 *   B1 = 加工费(制造费) = 工时 × 制造费率
 *   B2 = 废品损失 = (A1+A2) × 废品率
 *   C1 = 管理费 = (A1+A2+B1+B2) × 管理费率
 *   C2 = 财务费 = (A1+A2+B1+B2) × 财务费率
 *   C3 = 销售费 = (A1+A2+B1+B2) × 销售费率
 *   D  = 利润   = (A1+A2+B1+B2) × 利润率
 *   E1 = 借用工装费用(分摊) = 借用工装总额 / 分摊量
 *   E2 = 新开工装费用(分摊) = 新开工装总额 / 分摊量
 *   F1 = 借用试验费用(分摊)
 *   F2 = 新开试验费用(分摊)
 *   G1 = 借用研发费用(分摊)
 *   G2 = 新开研发费用(分摊)
 *
 * 依赖: G281SharedUtils
 */
(function (global) {
  'use strict';

  var U = global.G281SharedUtils || {};
  var numberOr = U.numberOr || function (v, f) { var n = Number(v); return Number.isFinite(n) ? n : f; };

  // ── 吉利标准费率 ──
  var GEELY_RATES = {
    mgmtRate: 0.04,      // 管理费 4%
    financeRate: 0.04,    // 财务费 4%
    salesRate: 0.04,      // 销售费 4%
    profitRate: 0.04,     // 利润 4%
    wasteRate: 0.01,      // 废品率 1%
  };

  /**
   * 预定义的客户模板配置
   */
  var TEMPLATE_PRESETS = {
    geely: {
      name: '吉利',
      structure: 'A1+A2+B1+B2+C1+C2+C3+D+E+F+G',
      rates: GEELY_RATES,
      amortizationFields: ['tooling', 'testing', 'rnd'],
    },
    internal: {
      name: '内部核算',
      structure: '材料+废品+人工+制造+管理+利润',
      rates: {
        wasteRate: 0.009,
        mgmtRate: 0.06,
        profitRate: 0.0566,
      },
      amortizationFields: [],
    },
  };

  /**
   * mapToGeelyTemplate — 映射到吉利报价模板
   *
   * @param {Object} harnessResult - computeHarnessCost() 的结果
   * @param {Object} nreData - NRE(一次性费用)数据 {tooling, testing, rnd, amortizationVolume}
   * @param {Object} overrideRates - 覆盖默认费率 (可选)
   * @returns {Object} 吉利模板格式的报价明细
   */
  function mapToGeelyTemplate(harnessResult, nreData, overrideRates) {
    var h = harnessResult || {};
    var nre = nreData || {};
    var rates = Object.assign({}, GEELY_RATES, overrideRates || {});

    // A1 = 原材料 (导线类)
    var A1 = 0;
    // A2 = 外购件 (连接器+端子+辅料)
    var A2 = 0;

    if (h.materialBreakdown) {
      A1 = numberOr(h.materialBreakdown.byType && h.materialBreakdown.byType.wire, 0);
      A2 = numberOr(h.materialCost, 0) - A1;
    } else {
      // 如果没有 byType 数据，使用金属/非金属拆分近似
      var cuAlCost = numberOr(h.materialBreakdown && h.materialBreakdown.cuCost, 0)
        + numberOr(h.materialBreakdown && h.materialBreakdown.alCost, 0)
        + numberOr(h.materialBreakdown && h.materialBreakdown.nonMetalCost, 0);
      A1 = cuAlCost;
      A2 = numberOr(h.materialCost, 0) - A1;
    }

    // B1 = 加工费 (这里用制造费，不是直接人工+制造费)
    var B1 = numberOr(h.manufacturing, 0);

    // B2 = 废品损失 = (A1+A2) × 废品率
    var B2 = (A1 + A2) * rates.wasteRate;

    // 基数 = A1+A2+B1+B2
    var base = A1 + A2 + B1 + B2;

    // C1 = 管理费
    var C1 = base * rates.mgmtRate;
    // C2 = 财务费
    var C2 = base * rates.financeRate;
    // C3 = 销售费
    var C3 = base * rates.salesRate;
    // D = 利润
    var D = base * rates.profitRate;

    // 出厂价 (不含分摊)
    var exFactoryPrice = A1 + A2 + B1 + B2 + C1 + C2 + C3 + D;

    // 分摊费用
    var amortVol = numberOr(nre.amortizationVolume, 1);
    var E1 = numberOr(nre.borrowedTooling, 0) / amortVol;
    var E2 = numberOr(nre.newTooling, 0) / amortVol;
    var F1 = numberOr(nre.borrowedTesting, 0) / amortVol;
    var F2 = numberOr(nre.newTesting, 0) / amortVol;
    var G1 = numberOr(nre.borrowedRnd, 0) / amortVol;
    var G2 = numberOr(nre.newRnd, 0) / amortVol;

    var amortTotal = E1 + E2 + F1 + F2 + G1 + G2;

    // 到厂价
    var deliveredPrice = exFactoryPrice + amortTotal;

    return {
      templateName: '吉利高压线束报价',
      harnessId: h.harnessId,
      harnessName: h.harnessName,

      // 直接成本
      A1_rawMaterial: A1,
      A2_purchasedParts: A2,
      B1_processingFee: B1,
      B2_wasteLoss: B2,

      // 期间费用
      C1_managementFee: C1,
      C2_financeFee: C2,
      C3_salesFee: C3,
      D_profit: D,

      // 分摊费用
      E1_borrowedTooling: E1,
      E2_newTooling: E2,
      F1_borrowedTesting: F1,
      F2_newTesting: F2,
      G1_borrowedRnd: G1,
      G2_newRnd: G2,

      // 小计
      directMaterial: A1 + A2,
      manufacturingCost: B1 + B2,
      periodExpense: C1 + C2 + C3,
      amortization: amortTotal,

      // 总价
      exFactoryPrice: exFactoryPrice,
      deliveredPrice: deliveredPrice,

      // 费率
      rates: rates,
    };
  }

  /**
   * mapToInternalTemplate — 映射到内部核算格式
   * (与客户报价逻辑表对应)
   */
  function mapToInternalTemplate(harnessResult) {
    var h = harnessResult || {};
    return {
      templateName: '内部核算',
      harnessId: h.harnessId,
      harnessName: h.harnessName,
      vehicleRatio: h.vehicleRatio,
      copperWeight: h.copperWeight,
      aluminumWeight: h.aluminumWeight,
      materialCost: h.materialCost,
      wasteCost: h.wasteCost,
      processHours: h.processHours,
      directLabor: h.directLabor,
      manufacturing: h.manufacturing,
      laborPlusMfg: h.laborPlusMfg,
      mgmtFee: h.mgmtFee,
      profit: h.profit,
      exFactoryPrice: h.exFactoryPrice,
      packSubtotal: h.packSubtotal,
      freightSubtotal: h.freightSubtotal,
      deliveredPrice: h.deliveredPrice,
    };
  }

  /**
   * mapToTemplate — 通用模板映射入口
   *
   * @param {Object} harnessResult - 核算结果
   * @param {string} templateName - 模板名称 ('geely' | 'internal')
   * @param {Object} templateConfig - 模板配置 (覆盖预设)
   * @param {Object} nreData - NRE数据 (仅 geely 模板需要)
   * @returns {Object} 映射后的报价结构
   */
  function mapToTemplate(harnessResult, templateName, templateConfig, nreData) {
    var name = (templateName || 'internal').toLowerCase();

    if (name === 'geely' || name === '吉利') {
      return mapToGeelyTemplate(harnessResult, nreData, templateConfig);
    }

    return mapToInternalTemplate(harnessResult);
  }

  /**
   * buildQuoteSheet — 生成报价单数据 (多零件号)
   *
   * @param {Array} harnessResults - 多个零件号的核算结果
   * @param {string} templateName - 模板名称
   * @param {Object} projectMeta - 项目元信息 {projectName, customer, quotePerson, quoteDate}
   * @param {Object} nreData - NRE数据
   * @returns {Object} 完整的报价单数据
   */
  function buildQuoteSheet(harnessResults, templateName, projectMeta, nreData) {
    var meta = projectMeta || {};
    var harnesses = (harnessResults || []).map(function (h) {
      return mapToTemplate(h, templateName, null, nreData);
    });

    // 计算合计
    var totals = {};
    if (harnesses.length > 0) {
      var keys = Object.keys(harnesses[0]).filter(function (k) {
        return typeof harnesses[0][k] === 'number' && k !== 'vehicleRatio';
      });
      keys.forEach(function (key) {
        totals[key] = harnesses.reduce(function (sum, h) {
          return sum + numberOr(h[key], 0);
        }, 0);
      });
    }

    return {
      meta: {
        projectName: meta.projectName || '',
        customer: meta.customer || '',
        quotePerson: meta.quotePerson || '',
        quoteDate: meta.quoteDate || new Date().toISOString().slice(0, 10),
        templateName: templateName,
        version: meta.version || 'v1',
        status: meta.status || 'draft',
      },
      harnesses: harnesses,
      totals: totals,
      harnessCount: harnesses.length,
    };
  }

  // ── 导出 ──
  var api = {
    mapToGeelyTemplate: mapToGeelyTemplate,
    mapToInternalTemplate: mapToInternalTemplate,
    mapToTemplate: mapToTemplate,
    buildQuoteSheet: buildQuoteSheet,
    GEELY_RATES: GEELY_RATES,
    TEMPLATE_PRESETS: TEMPLATE_PRESETS,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  global.G281QuoteTemplate = api;
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this);
