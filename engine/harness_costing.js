/**
 * engine/harness_costing.js
 * 单线束号级成本核算引擎 v2.0
 *
 * ⚠️  v2.0 重大重构: 删除所有客户报价逻辑, 只做成本核算
 *
 * 核算粒度: 零件号（线束号）
 * 核算方向: 自底向上 — 每个零件号独立核算 → 加权汇总到项目级
 *
 * 成本公式 (每个零件号独立):
 *   线束成本 = 材料成本 + 制造费用 + 包装物流 + 一次性费用分摊
 *
 *   材料成本 = BOM逐行汇总
 *     导线: 铜重(g)/1000 × 铜价(元/kg) + 铝重(g)/1000 × 铝价(元/kg) + 非铜(元/km)/1000
 *     连接器: 三级价格优先 (最终谈判价 > 客户协议价 > 供应商报价)
 *     同步开发件: 批量价 + 模具费/分摊数量 (分摊期内, 达标后纯批量价)
 *     辅料: 采购询价单价 × 数量
 *
 *   制造费用 = 工时 × 工厂费率合计 + 材料损耗
 *     费率来源: 运营工时费报价基准 (财务发布, 按工厂选择, 默认K3)
 *     费率合计 = 直接人工+间接人工+低值易耗+机物料+厂房分摊+自动化分摊+其他制费
 *     材料损耗 = 材料成本 × 0.5%
 *
 *   包装物流 = 内包装 + 外包装 + 短驳 + 三方仓 + 仓储
 *
 *   一次性费用分摊 = 分摊矩阵逐项逐线束计算
 *     每项: 单价 × 该线束需求数量 ÷ 分摊基数
 *     累计产量达到分摊基数后降价(去掉分摊额)
 *
 * ⛔ 删除项 (v1.0 中的客户报价逻辑):
 *   - 废品率 wasteRate (已改为材料损耗 0.5%, 归入制造费用)
 *   - 管理费 mgmtRate/mgmtFee
 *   - 利润 profitRate/profit
 *   - 出厂价 exFactoryPrice
 *   - 到厂价 deliveredPrice
 *   - DEFAULTS 常量 (laborRate=35, mfgRate=46.69 等)
 *
 * 依赖: G281SharedUtils, G281FactoryRates, G281ToolingAllocation
 */
(function (global) {
  'use strict';

  var U = global.G281SharedUtils || {};
  var numberOr = U.numberOr || function (v, f) { var n = Number(v); return Number.isFinite(n) ? n : f; };
  var safeArray = U.safeArray || function (v) { return Array.isArray(v) ? v : []; };

  // 引用工厂费率和分摊模块
  var FR = global.G281FactoryRates || {};
  var TA = global.G281ToolingAllocation || {};

  // ── 材料分类关键字 ──
  var WIRE_TYPES = new Set(['wire', '导线', 'cable', '电缆']);
  var CONNECTOR_TYPES = new Set(['connector', '连接器', '护套', '插头', '插座']);
  var TERMINAL_TYPES = new Set(['terminal', '端子']);
  var CODEV_TYPES = new Set(['codev', '同步开发件', '合资件']);
  var AUXILIARY_TYPES = new Set(['auxiliary', '辅料', '胶带', '套管', '支架', '橡胶']);

  /**
   * 判断BOM行的物料类型
   */
  function classifyBomItem(item) {
    var type = String(item.type || item.category || '').toLowerCase();
    if (WIRE_TYPES.has(type)) return 'wire';
    if (CONNECTOR_TYPES.has(type)) return 'connector';
    if (TERMINAL_TYPES.has(type)) return 'terminal';
    if (CODEV_TYPES.has(type)) return 'codev';
    if (AUXILIARY_TYPES.has(type)) return 'auxiliary';
    // 通过名称/料号关键字兜底
    var name = String(item.name || item.description || '').toLowerCase();
    if (/导线|cable|电缆/.test(name)) return 'wire';
    if (/连接器|护套|插头|插座|屏蔽环/.test(name)) return 'connector';
    if (/端子/.test(name)) return 'terminal';
    // 同步开发件料号格式: 项目代码-HB/ZJ/XJ-序号
    var partNo = String(item.partNo || '');
    if (/-(HB|ZJ|XJ)-/.test(partNo)) return 'codev';
    return 'other';
  }

  /**
   * resolveConnectorPrice — 连接器三级价格优先
   * 最终谈判价 > 客户协议价 > 供应商报价
   *
   * @param {Object} item — BOM行
   * @returns {Object} { price, source }
   */
  function resolveConnectorPrice(item) {
    // 优先级1: 最终谈判价
    if (item.finalNegotiatedPrice != null && item.finalNegotiatedPrice > 0) {
      return { price: item.finalNegotiatedPrice, source: 'final_negotiated' };
    }
    // 优先级2: 客户协议价
    if (item.customerAgreementPrice != null && item.customerAgreementPrice > 0) {
      return { price: item.customerAgreementPrice, source: 'customer_agreement' };
    }
    // 优先级3: 供应商报价
    if (item.supplierQuotePrice != null && item.supplierQuotePrice > 0) {
      return { price: item.supplierQuotePrice, source: 'supplier_quote' };
    }
    // 兜底: unitPrice
    return { price: numberOr(item.unitPrice, 0), source: 'unit_price' };
  }

  /**
   * resolveCodevPrice — 同步开发件价格 (两阶段模具分摊)
   * 分摊期内: 批量价 + 模具总费 / 分摊数量
   * 分摊后:   纯批量价
   *
   * @param {Object} item — BOM行
   * @returns {Object} { price, batchPrice, moldAmortization, source }
   */
  function resolveCodevPrice(item) {
    var batchPrice = numberOr(item.batchPrice, numberOr(item.unitPrice, 0));
    var moldCost = numberOr(item.moldCost, 0);
    var moldAmortQty = numberOr(item.moldAmortizationQty, 1);
    var cumPurchased = numberOr(item.cumulativePurchased, 0);

    var isAmortized = cumPurchased >= moldAmortQty;
    var moldAmortization = (!isAmortized && moldCost > 0 && moldAmortQty > 0)
      ? moldCost / moldAmortQty : 0;

    return {
      price: batchPrice + moldAmortization,
      batchPrice: batchPrice,
      moldAmortization: moldAmortization,
      isAmortized: isAmortized,
      source: isAmortized ? 'batch_only' : 'batch_plus_mold'
    };
  }

  /**
   * computeBomLineCost — 计算单条BOM行的材料成本
   *
   * 导线类: 铜重×铜价 + 铝重×铝价 + 非铜部分
   * 连接器: 三级价格优先
   * 同步开发件: 批量价+模具分摊
   * 辅料/其他: 单价×数量
   */
  function computeBomLineCost(item, wireCatalog, metalPrices) {
    var partNo = String(item.partNo || '').trim();
    var qty = numberOr(item.qty, 1);
    var itemType = classifyBomItem(item);

    // 尝试匹配导线目录
    var wireEntry = wireCatalog ? wireCatalog.get(partNo) : null;

    if (wireEntry || itemType === 'wire') {
      // ── 导线类: 金属价格自动计算 ──
      var cuWeight, alWeight;
      if (item.copperWeight !== undefined) {
        cuWeight = numberOr(item.copperWeight, 0);
        alWeight = numberOr(item.aluminumWeight, 0);
      } else {
        var lengthM = numberOr(item.lengthM, 0);
        var cuWeightPerKm = numberOr(wireEntry && wireEntry.copperWeightPerKm, item.copperWeightPerKm || 0);
        var alWeightPerKm = numberOr(wireEntry && wireEntry.aluminumWeightPerKm, item.aluminumWeightPerKm || 0);
        cuWeight = cuWeightPerKm * lengthM / 1000 / 1000;
        alWeight = alWeightPerKm * lengthM / 1000 / 1000;
      }

      var nonMetalPerM = numberOr(wireEntry && wireEntry.nonMetalPricePerM, item.nonMetalPricePerM || 0);
      var lengthForNonMetal = numberOr(item.lengthM, 0);

      var cuPrice = numberOr(metalPrices.copper, 68400);
      var alPrice = numberOr(metalPrices.aluminum, 18200);

      var cuCost = cuWeight * cuPrice / 1000;
      var alCost = alWeight * alPrice / 1000;
      var nonMetalCost = nonMetalPerM * lengthForNonMetal;

      // 兜底: 如果没有足够的导线数据, 使用 unitPrice
      if (!wireEntry && cuWeight === 0 && alWeight === 0 && item.unitPrice) {
        return {
          partNo: partNo, type: 'wire', qty: qty,
          cuWeight: 0, alWeight: 0, cuCost: 0, alCost: 0, nonMetalCost: 0,
          lineCost: numberOr(item.unitPrice, 0) * qty,
          priceSource: 'unit_price'
        };
      }

      var wireCost = (cuCost + alCost + nonMetalCost) * qty;
      return {
        partNo: partNo, type: 'wire', qty: qty,
        cuWeight: cuWeight * qty, alWeight: alWeight * qty,
        cuCost: cuCost * qty, alCost: alCost * qty,
        nonMetalCost: nonMetalCost * qty,
        lineCost: wireCost,
        priceSource: 'metal_calc'
      };

    } else if (itemType === 'connector' || itemType === 'terminal') {
      // ── 连接器/端子: 三级价格优先 ──
      var resolved = resolveConnectorPrice(item);
      return {
        partNo: partNo, type: itemType, qty: qty,
        cuWeight: 0, alWeight: 0, cuCost: 0, alCost: 0, nonMetalCost: 0,
        lineCost: resolved.price * qty,
        priceSource: resolved.source
      };

    } else if (itemType === 'codev') {
      // ── 同步开发件: 批量价 + 模具分摊 ──
      var codevPrice = resolveCodevPrice(item);
      return {
        partNo: partNo, type: 'codev', qty: qty,
        cuWeight: 0, alWeight: 0, cuCost: 0, alCost: 0, nonMetalCost: 0,
        lineCost: codevPrice.price * qty,
        batchPrice: codevPrice.batchPrice,
        moldAmortization: codevPrice.moldAmortization,
        isAmortized: codevPrice.isAmortized,
        priceSource: codevPrice.source
      };

    } else {
      // ── 辅料/其他: 采购询价 ──
      return {
        partNo: partNo, type: itemType, qty: qty,
        cuWeight: 0, alWeight: 0, cuCost: 0, alCost: 0, nonMetalCost: 0,
        lineCost: numberOr(item.unitPrice, 0) * qty,
        priceSource: 'unit_price'
      };
    }
  }

  /**
   * computeHarnessCost — 单线束号完整成本核算
   *
   * @param {Object} harnessConfig — 线束配置
   *   - harnessId {string}
   *   - harnessName {string}
   *   - vehicleRatio {number} 装车比
   *   - processHours {number} 总工时(h)
   *   - bomItems {Array} BOM明细行
   *   - packaging {Object} {innerPack, outerPack, shortHaul, thirdPartyWarehouse, storage}
   *
   * @param {Object} params — 核算参数
   *   - metalPrices {Object} {copper, aluminum} 元/吨
   *   - wireCatalog {Map} 导线目录 partNo → entry
   *   - factoryId {string} 工厂ID (默认K3)
   *   - allocationMatrix {Array} 一次性费用分摊矩阵
   *   - amortizationBase {number} 分摊基数 (默认50000)
   *   - cumulativeProduction {number} 累计产量 (用于判断降价)
   *
   * @returns {Object} 完整成本分解
   */
  function computeHarnessCost(harnessConfig, params) {
    var harnessId = harnessConfig.harnessId || '';
    var harnessName = harnessConfig.harnessName || harnessConfig.name || '';
    var vehicleRatio = numberOr(harnessConfig.vehicleRatio, 0);
    var processHours = numberOr(harnessConfig.processHours, 0);
    var bomItems = safeArray(harnessConfig.bomItems);
    var pack = harnessConfig.packaging || {};

    var p = params || {};
    var metalPrices = p.metalPrices || { copper: 68400, aluminum: 18200 };
    var wireCatalog = p.wireCatalog || null;
    var factoryId = p.factoryId || FR.DEFAULT_FACTORY || 'K3';
    var allocationMatrix = p.allocationMatrix || null;
    var amortizationBase = numberOr(p.amortizationBase, 50000);
    var cumulativeProduction = numberOr(p.cumulativeProduction, 0);

    // ══════════════════════════════════════════
    // 1. 材料成本: BOM逐行
    // ══════════════════════════════════════════
    var materialCost = 0;
    var totalCuWeight = 0, totalAlWeight = 0;
    var totalCuCost = 0, totalAlCost = 0, totalNonMetalCost = 0;
    var bomDetails = [];
    var materialByType = { wire: 0, connector: 0, terminal: 0, codev: 0, auxiliary: 0, other: 0 };

    if (bomItems.length > 0) {
      for (var i = 0; i < bomItems.length; i++) {
        var result = computeBomLineCost(bomItems[i], wireCatalog, metalPrices);
        materialCost += result.lineCost;
        totalCuWeight += result.cuWeight;
        totalAlWeight += result.alWeight;
        totalCuCost += result.cuCost;
        totalAlCost += result.alCost;
        totalNonMetalCost += result.nonMetalCost;
        materialByType[result.type] = (materialByType[result.type] || 0) + result.lineCost;
        bomDetails.push(result);
      }
    } else if (harnessConfig.materialCost !== undefined) {
      materialCost = numberOr(harnessConfig.materialCost, 0);
      totalCuWeight = numberOr(harnessConfig.copperWeight, 0);
      totalAlWeight = numberOr(harnessConfig.aluminumWeight, 0);
    }

    // ══════════════════════════════════════════
    // 2. 制造费用: 工时×费率 + 材料损耗
    // ══════════════════════════════════════════
    var computeMfg = (FR.computeManufacturingCost || function (h, m, f) {
      // 内联 fallback: K3 默认费率 41.43
      var rate = 41.43;
      var laborCost = h * rate;
      var materialLoss = m * 0.005;
      return { factoryId: f || 'K3', factoryName: 'K3工厂', processHours: h,
        hourlyRate: rate, laborCost: laborCost, materialLoss: materialLoss,
        materialLossRate: 0.005, totalMfgCost: laborCost + materialLoss, breakdown: {} };
    });

    var mfgResult = computeMfg(processHours, materialCost, factoryId);

    // ══════════════════════════════════════════
    // 3. 包装物流
    // ══════════════════════════════════════════
    var innerPack = numberOr(pack.innerPack, 0);
    var outerPack = numberOr(pack.outerPack, 0);
    var shortHaul = numberOr(pack.shortHaul, 0);
    var thirdParty = numberOr(pack.thirdPartyWarehouse, numberOr(pack.thirdParty, 0));
    var storage = numberOr(pack.storage, 0);
    var packTotal = innerPack + outerPack + shortHaul + thirdParty + storage;

    // ══════════════════════════════════════════
    // 4. 一次性费用分摊
    // ══════════════════════════════════════════
    var allocationResult = null;
    var allocationPerUnit = 0;
    if (allocationMatrix && allocationMatrix.length > 0) {
      var computeAlloc = TA.computeHarnessAllocation || function () {
        return { totalCost: 0, perUnitCost: 0, items: [], itemCount: 0 };
      };
      allocationResult = computeAlloc(harnessId, allocationMatrix, amortizationBase);
      allocationPerUnit = allocationResult.perUnitCost || 0;
    }

    // 判断是否已完成分摊 (降价)
    var isAmortized = cumulativeProduction >= amortizationBase;
    var effectiveAllocation = isAmortized ? 0 : allocationPerUnit;

    // ══════════════════════════════════════════
    // 5. 线束总成本
    // ══════════════════════════════════════════
    var totalCost = materialCost + mfgResult.totalMfgCost + packTotal + effectiveAllocation;

    return {
      // 标识
      harnessId: harnessId,
      harnessName: harnessName,
      vehicleRatio: vehicleRatio,

      // ── 材料成本 ──
      materialCost: materialCost,
      materialBreakdown: {
        cuCost: totalCuCost,
        alCost: totalAlCost,
        nonMetalCost: totalNonMetalCost,
        byType: materialByType
      },
      copperWeight: totalCuWeight,
      aluminumWeight: totalAlWeight,

      // ── 制造费用 ──
      manufacturing: mfgResult,

      // ── 包装物流 ──
      packTotal: packTotal,
      packBreakdown: {
        innerPack: innerPack,
        outerPack: outerPack,
        shortHaul: shortHaul,
        thirdPartyWarehouse: thirdParty,
        storage: storage
      },

      // ── 一次性费用分摊 ──
      allocation: {
        perUnitCost: allocationPerUnit,
        effectiveAllocation: effectiveAllocation,
        isAmortized: isAmortized,
        cumulativeProduction: cumulativeProduction,
        amortizationBase: amortizationBase,
        detail: allocationResult
      },

      // ── 线束总成本 ──
      totalCost: totalCost,
      weightedCost: totalCost * vehicleRatio,

      // ── BOM明细 ──
      bomDetails: bomDetails,

      // ── 核算参数 (追溯) ──
      _params: {
        factoryId: mfgResult.factoryId,
        factoryName: mfgResult.factoryName,
        hourlyRate: mfgResult.hourlyRate,
        materialLossRate: mfgResult.materialLossRate,
        metalPrices: metalPrices,
        amortizationBase: amortizationBase
      }
    };
  }

  /**
   * computeProjectFromHarnesses — 从线束号汇总到项目级
   */
  function computeProjectFromHarnesses(harnessResults) {
    var harnesses = safeArray(harnessResults);
    var project = {
      harnesses: harnesses,
      vehicleCost: 0,
      weightedMaterial: 0,
      weightedMfg: 0,
      weightedPack: 0,
      weightedAllocation: 0,
      weightedCopperWeight: 0,
      weightedAluminumWeight: 0,
      weightedProcessHours: 0,
      totalCopperWeight: 0,
      totalAluminumWeight: 0,
      totalProcessHours: 0,
      harnessCount: harnesses.length,
      familyCount: 0,
    };

    var families = new Set();

    for (var i = 0; i < harnesses.length; i++) {
      var h = harnesses[i];
      var ratio = numberOr(h.vehicleRatio, 0);

      project.vehicleCost += numberOr(h.totalCost, 0) * ratio;
      project.weightedMaterial += numberOr(h.materialCost, 0) * ratio;
      project.weightedMfg += (h.manufacturing ? numberOr(h.manufacturing.totalMfgCost, 0) : 0) * ratio;
      project.weightedPack += numberOr(h.packTotal, 0) * ratio;
      project.weightedAllocation += (h.allocation ? numberOr(h.allocation.effectiveAllocation, 0) : 0) * ratio;
      project.weightedCopperWeight += numberOr(h.copperWeight, 0) * ratio;
      project.weightedAluminumWeight += numberOr(h.aluminumWeight, 0) * ratio;
      project.weightedProcessHours += (h.manufacturing ? numberOr(h.manufacturing.processHours, 0) : 0) * ratio;

      project.totalCopperWeight += numberOr(h.copperWeight, 0);
      project.totalAluminumWeight += numberOr(h.aluminumWeight, 0);
      project.totalProcessHours += (h.manufacturing ? numberOr(h.manufacturing.processHours, 0) : 0);

      if (h.family) families.add(h.family);
    }

    project.familyCount = families.size;
    return project;
  }

  /**
   * computeHarnessesFromSeedData — 从种子数据批量核算
   */
  function computeHarnessesFromSeedData(seedHarnesses, params) {
    var harnesses = safeArray(seedHarnesses);
    var results = [];

    for (var i = 0; i < harnesses.length; i++) {
      var seed = harnesses[i];
      var config = {
        harnessId: seed.harnessId,
        harnessName: seed.name,
        family: seed.family,
        vehicleRatio: seed.vehicleRatio,
        processHours: seed.processHours,
        bomItems: seed.bomItems || [],
        packaging: seed.packaging || {},
        materialCost: seed.materialCost,
        copperWeight: seed.copperWeight,
        aluminumWeight: seed.aluminumWeight,
      };

      var result = computeHarnessCost(config, params);
      result.family = seed.family;
      results.push(result);
    }

    var project = computeProjectFromHarnesses(results);
    return { harnesses: results, project: project };
  }

  /**
   * buildHarnessCostTable — 生成线束号级成本分解表 (用于UI展示)
   */
  function buildHarnessCostTable(harnessResults) {
    var columns = [
      { key: 'harnessId', label: '零件号' },
      { key: 'harnessName', label: '名称' },
      { key: 'vehicleRatio', label: '装车比' },
      { key: 'materialCost', label: '材料成本', unit: '元' },
      { key: 'mfgCost', label: '制造费用', unit: '元' },
      { key: 'packTotal', label: '包装物流', unit: '元' },
      { key: 'allocationPerUnit', label: '一次性分摊', unit: '元' },
      { key: 'totalCost', label: '线束成本', unit: '元' },
    ];

    var rows = safeArray(harnessResults).map(function (h) {
      return {
        harnessId: h.harnessId,
        harnessName: h.harnessName,
        vehicleRatio: h.vehicleRatio,
        materialCost: h.materialCost,
        mfgCost: h.manufacturing ? h.manufacturing.totalMfgCost : 0,
        packTotal: h.packTotal,
        allocationPerUnit: h.allocation ? h.allocation.effectiveAllocation : 0,
        totalCost: h.totalCost,
      };
    });

    var project = computeProjectFromHarnesses(harnessResults);
    var totals = {
      harnessId: '加权合计',
      harnessName: '',
      vehicleRatio: '',
      materialCost: project.weightedMaterial,
      mfgCost: project.weightedMfg,
      packTotal: project.weightedPack,
      allocationPerUnit: project.weightedAllocation,
      totalCost: project.vehicleCost,
    };

    return { columns: columns, rows: rows, totals: totals };
  }

  // ── 导出 ──
  var api = {
    computeHarnessCost: computeHarnessCost,
    computeProjectFromHarnesses: computeProjectFromHarnesses,
    computeHarnessesFromSeedData: computeHarnessesFromSeedData,
    buildHarnessCostTable: buildHarnessCostTable,
    classifyBomItem: classifyBomItem,
    computeBomLineCost: computeBomLineCost,
    resolveConnectorPrice: resolveConnectorPrice,
    resolveCodevPrice: resolveCodevPrice,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  global.G281HarnessCosting = api;
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this);
