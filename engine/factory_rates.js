/**
 * engine/factory_rates.js
 * 运营工时费报价基准模块 v1.0
 *
 * 数据来源: 财务定期发布的运营工时费报价基准 (25年1-6月基准)
 * 系统默认工厂: K3
 * 用途: 制造费用 = 工时 × 费率合计
 *
 * 费率构成:
 *   直接人工 + 间接人工 + 低值易耗 + 机物料 + 厂房分摊 + 自动化分摊 + 其他制费
 *   材料损耗 = 材料成本 × 0.5% (独立计算, 不含在费率合计中)
 */
(function (global) {
  'use strict';

  var U = global.G281SharedUtils || {};
  var numberOr = U.numberOr || function (v, f) { var n = Number(v); return Number.isFinite(n) ? n : f; };

  /**
   * 运营工时费报价基准 — 25年1-6月
   * 单位: 元/h
   */
  var FACTORY_RATES = {
    K1K2: {
      id: 'K1K2',
      name: 'K1K2工厂',
      directLabor: 28.61,
      indirectLabor: 8.50,
      consumables: 0.88,
      machineSupplies: 1.86,
      plantAmortization: 1.45,
      automationAmortization: 2.03,
      otherMfgExpense: 1.42,
      total: 44.75  // 合计(不含材料损耗)
    },
    K3: {
      id: 'K3',
      name: 'K3工厂',
      directLabor: 26.27,
      indirectLabor: 6.47,
      consumables: 0.51,
      machineSupplies: 2.41,
      plantAmortization: 3.86,
      automationAmortization: 0.24,
      otherMfgExpense: 1.67,
      total: 41.43
    },
    NB: {
      id: 'NB',
      name: '宁波工厂',
      directLabor: 26.77,
      indirectLabor: 9.45,
      consumables: 0.41,
      machineSupplies: 1.09,
      plantAmortization: 3.26,
      automationAmortization: 2.44,
      otherMfgExpense: 3.66,
      total: 47.08
    },
    YZ: {
      id: 'YZ',
      name: '仪征工厂',
      directLabor: 28.17,
      indirectLabor: 10.39,
      consumables: 0.80,
      machineSupplies: 0.69,
      plantAmortization: 0.61,
      automationAmortization: 0.52,
      otherMfgExpense: 2.13,
      total: 43.31
    },
    CQLV: {
      id: 'CQLV',
      name: '重庆低压',
      directLabor: 31.18,
      indirectLabor: 9.75,
      consumables: 2.13,
      machineSupplies: 0.98,
      plantAmortization: 1.01,
      automationAmortization: 0.89,
      otherMfgExpense: 1.05,
      total: 46.99
    },
    CQHV: {
      id: 'CQHV',
      name: '重庆高压',
      directLabor: 32.03,
      indirectLabor: 11.16,
      consumables: 2.81,
      machineSupplies: 4.97,
      plantAmortization: 2.78,
      automationAmortization: 0.90,
      otherMfgExpense: 0.84,
      total: 55.49
    },
    TJ: {
      id: 'TJ',
      name: '天津工厂',
      directLabor: 27.71,
      indirectLabor: 8.82,
      consumables: 0.51,
      machineSupplies: 2.41,
      plantAmortization: 2.98,
      automationAmortization: 0,
      otherMfgExpense: 1.50,
      total: 43.93
    }
  };

  /** 默认工厂 */
  var DEFAULT_FACTORY = 'K3';

  /** 材料损耗率 (所有工厂统一) */
  var MATERIAL_LOSS_RATE = 0.005; // 0.5%

  /**
   * getFactoryRate — 获取工厂费率配置
   *
   * @param {string} factoryId — 工厂ID (K1K2, K3, NB, YZ, CQLV, CQHV, TJ)
   * @returns {Object} 工厂费率对象
   */
  function getFactoryRate(factoryId) {
    var id = String(factoryId || DEFAULT_FACTORY).toUpperCase();
    return FACTORY_RATES[id] || FACTORY_RATES[DEFAULT_FACTORY];
  }

  /**
   * computeManufacturingCost — 计算制造费用
   *
   * @param {number} processHours — 工时(h)
   * @param {number} materialCost — 材料成本(元), 用于计算材料损耗
   * @param {string} factoryId — 工厂ID (默认K3)
   * @returns {Object} { hourlyRate, laborCost, materialLoss, totalMfgCost, breakdown }
   */
  function computeManufacturingCost(processHours, materialCost, factoryId) {
    var hours = numberOr(processHours, 0);
    var matCost = numberOr(materialCost, 0);
    var factory = getFactoryRate(factoryId);

    var laborCost = hours * factory.total;
    var materialLoss = matCost * MATERIAL_LOSS_RATE;
    var totalMfgCost = laborCost + materialLoss;

    return {
      factoryId: factory.id,
      factoryName: factory.name,
      processHours: hours,
      hourlyRate: factory.total,
      laborCost: laborCost,
      materialLoss: materialLoss,
      materialLossRate: MATERIAL_LOSS_RATE,
      totalMfgCost: totalMfgCost,
      breakdown: {
        directLabor: hours * factory.directLabor,
        indirectLabor: hours * factory.indirectLabor,
        consumables: hours * factory.consumables,
        machineSupplies: hours * factory.machineSupplies,
        plantAmortization: hours * factory.plantAmortization,
        automationAmortization: hours * factory.automationAmortization,
        otherMfgExpense: hours * factory.otherMfgExpense,
        materialLoss: materialLoss
      }
    };
  }

  /**
   * listFactories — 列出所有可用工厂
   * @returns {Array} [{id, name, total}, ...]
   */
  function listFactories() {
    return Object.keys(FACTORY_RATES).map(function (key) {
      var f = FACTORY_RATES[key];
      return { id: f.id, name: f.name, total: f.total };
    });
  }

  // ── 导出 ──
  var api = {
    FACTORY_RATES: FACTORY_RATES,
    DEFAULT_FACTORY: DEFAULT_FACTORY,
    MATERIAL_LOSS_RATE: MATERIAL_LOSS_RATE,
    getFactoryRate: getFactoryRate,
    computeManufacturingCost: computeManufacturingCost,
    listFactories: listFactories,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  global.G281FactoryRates = api;
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this);
