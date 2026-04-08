/**
 * engine/harness_costing.js
 * 单线束号级成本核算引擎 v1.0
 *
 * 核算粒度: 零件号（线束号）
 * 核算方向: 自底向上 — 每个零件号独立核算 → 加权汇总到项目级
 *
 * 与旧 harness_profit.js 的根本区别:
 *   旧: 项目总成本 → 按 revenueShare 反向拆分 → 线束"分摊成本" (错误方向)
 *   新: BOM逐行 → 线束独立核算全部成本项 → 汇总到项目 (正确方向)
 *
 * 成本公式链 (每个零件号独立):
 *   材料 = BOM逐行(导线: 铜重×铜价 + 铝重×铝价 + 非金属; 连接器/端子: 单价×用量)
 *   废品 = 材料 × wasteRate (1%)
 *   人工 = 工时 × laborRate (35元/h)
 *   制造 = 工时 × mfgRate (46.69元/h)
 *   管理 = (材料+人工+制造) × mgmtRate (6%) ← 注意: 不含废品!
 *   利润 = (材料+废品+人工+制造+管理) × profitRate (~5.66%)
 *   出厂价 = 材料+废品+人工+制造+管理+利润
 *   包装费 = 内包装+外包装
 *   运输费 = 运费+超额运费+短驳+三方仓+仓储
 *   到厂价 = 出厂价+包装费+运输费
 *
 * 项目汇总:
 *   单车成本 = Σ(到厂价 × 装车比)
 *
 * 依赖: G281SharedUtils (engine/shared_utils.js)
 */
(function (global) {
  'use strict';

  var U = global.G281SharedUtils || {};
  var numberOr = U.numberOr || function (v, f) { var n = Number(v); return Number.isFinite(n) ? n : f; };
  var safeArray = U.safeArray || function (v) { return Array.isArray(v) ? v : []; };

  // ── 默认参数 (从 定点核算.xlsx 验证) ──
  var DEFAULTS = {
    laborRate: 35,         // 客户报价: 直接人工费率 (元/h)
    mfgRate: 46.69,        // 客户报价: 制造费率 (元/h)  — Excel精确值
    wasteRate: 0.01,       // 废品率 1% — Excel验证: wasteCost/materialCost = 0.01
    mgmtRate: 0.06,        // 管理费率 6%  — 注意: 基数不含废品
    profitRate: 0.056627,  // 利润率 ~5.6627% (从Excel11个零件号倒推, 一致±0.0001%)
    // 吉利模板的管理/财务/销售/利润费率均为4%
  };

  // ── 材料分类关键字 ──
  var WIRE_TYPES = new Set(['wire', '导线', 'cable', '电缆']);
  var CONNECTOR_TYPES = new Set(['connector', '连接器', '护套', '插头', '插座']);
  var TERMINAL_TYPES = new Set(['terminal', '端子']);
  var AUXILIARY_TYPES = new Set(['auxiliary', '辅料', '胶带', '套管', '支架', '橡胶']);

  /**
   * 判断BOM行的物料类型
   */
  function classifyBomItem(item) {
    var type = String(item.type || item.category || '').toLowerCase();
    if (WIRE_TYPES.has(type)) return 'wire';
    if (CONNECTOR_TYPES.has(type)) return 'connector';
    if (TERMINAL_TYPES.has(type)) return 'terminal';
    if (AUXILIARY_TYPES.has(type)) return 'auxiliary';
    // 通过名称关键字兜底
    var name = String(item.name || item.description || '').toLowerCase();
    if (/导线|cable|电缆/.test(name)) return 'wire';
    if (/连接器|护套|插头|插座|屏蔽环/.test(name)) return 'connector';
    if (/端子/.test(name)) return 'terminal';
    return 'other';
  }

  /**
   * 计算单条BOM行的材料成本
   *
   * 导线类:
   *   成本 = (铜重/km × 长度m/1000 × 铜价/吨÷1000 + 铝重/km × 长度m/1000 × 铝价/吨÷1000 + 非金属单价/m × 长度m) × 数量
   *   注意: wire catalog 的 copperWeight/aluminumWeight 单位是 g/km，金属价格是 元/吨
   *
   * 非导线类:
   *   成本 = 单价 × 数量
   */
  function computeBomLineCost(item, wireCatalog, metalPrices) {
    var partNo = String(item.partNo || '').trim();
    var qty = numberOr(item.qty, 1);

    // 尝试匹配导线目录
    var wireEntry = wireCatalog ? wireCatalog.get(partNo) : null;

    if (wireEntry || classifyBomItem(item) === 'wire') {
      // ── 导线类 ──
      var lengthM = numberOr(item.lengthM, 0);
      var cuWeightPerKm = numberOr(wireEntry && wireEntry.copperWeightPerKm, item.copperWeightPerKm || 0);
      var alWeightPerKm = numberOr(wireEntry && wireEntry.aluminumWeightPerKm, item.aluminumWeightPerKm || 0);
      var nonMetalPerM = numberOr(wireEntry && wireEntry.nonMetalPricePerM, item.nonMetalPricePerM || 0);

      // 金属重量 (kg) — wire catalog: g/km → kg = g/km × m / 1000 / 1000 = g/km × m / 1e6
      // 但实际上 Excel 中的铜重/铝重是 kg 总重，不需要再换算
      // 这里兼容两种模式:
      //   模式A: item.copperWeight (kg 总重, 已计算好)
      //   模式B: wireEntry.copperWeightPerKm (g/km) × 长度
      var cuWeight, alWeight;
      if (item.copperWeight !== undefined) {
        // 模式A: 直接使用总重
        cuWeight = numberOr(item.copperWeight, 0);
        alWeight = numberOr(item.aluminumWeight, 0);
      } else {
        // 模式B: 从 wire catalog 计算
        cuWeight = cuWeightPerKm * lengthM / 1000 / 1000; // g/km → kg
        alWeight = alWeightPerKm * lengthM / 1000 / 1000;
      }

      var cuPrice = numberOr(metalPrices.copper, 68400);   // 元/吨
      var alPrice = numberOr(metalPrices.aluminum, 18200);  // 元/吨

      var cuCost = cuWeight * cuPrice / 1000;   // kg × 元/吨 ÷ 1000 = 元 (因为 1吨=1000kg)
      var alCost = alWeight * alPrice / 1000;
      var nonMetalCost = nonMetalPerM * lengthM;

      // 如果有直接指定的 unitPrice 且没有 wire catalog，回退到 unitPrice
      if (!wireEntry && cuWeightPerKm === 0 && alWeightPerKm === 0 && item.unitPrice) {
        var lineCost = numberOr(item.unitPrice, 0) * qty;
        return {
          partNo: partNo,
          type: 'wire',
          cuWeight: 0, alWeight: 0,
          cuCost: 0, alCost: 0, nonMetalCost: 0,
          lineCost: lineCost,
          qty: qty
        };
      }

      var wireCost = (cuCost + alCost + nonMetalCost) * qty;

      return {
        partNo: partNo,
        type: 'wire',
        cuWeight: cuWeight * qty,
        alWeight: alWeight * qty,
        cuCost: cuCost * qty,
        alCost: alCost * qty,
        nonMetalCost: nonMetalCost * qty,
        lineCost: wireCost,
        qty: qty
      };
    } else {
      // ── 连接器/端子/辅料 ──
      var unitPrice = numberOr(item.unitPrice, 0);
      var lineCost = unitPrice * qty;
      var itemType = classifyBomItem(item);

      return {
        partNo: partNo,
        type: itemType,
        cuWeight: 0, alWeight: 0,
        cuCost: 0, alCost: 0, nonMetalCost: 0,
        lineCost: lineCost,
        qty: qty
      };
    }
  }

  /**
   * computeHarnessCost — 单线束号完整成本核算
   *
   * @param {Object} harnessConfig - 线束配置
   *   - harnessId {string} 零件号
   *   - harnessName {string} 名称
   *   - vehicleRatio {number} 装车比
   *   - processHours {number} 实际总工时(h)
   *   - processBreakdown {Object} 可选: {wireCut, frontProcess, assembly}
   *   - bomItems {Array} BOM明细行
   *   - packaging {Object} 包装数据 {innerPack, outerPack, freight, excessFreight, shortHaul, thirdPartyWarehouse, storage}
   *
   * @param {Object} params - 核算参数
   *   - metalPrices {Object} {copper, aluminum} 元/吨
   *   - laborRate {number} 直接人工费率 元/h (默认35)
   *   - mfgRate {number} 制造费率 元/h (默认47)
   *   - wasteRate {number} 废品率 (默认0.009)
   *   - mgmtRate {number} 管理费率 (默认0.06)
   *   - profitRate {number} 利润率 (默认0.0566)
   *   - wireCatalog {Map} 导线目录 partNo → entry
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
    var laborRate = numberOr(p.laborRate, DEFAULTS.laborRate);
    var mfgRate = numberOr(p.mfgRate, DEFAULTS.mfgRate);
    var wasteRate = numberOr(p.wasteRate, DEFAULTS.wasteRate);
    var mgmtRate = numberOr(p.mgmtRate, DEFAULTS.mgmtRate);
    var profitRate = numberOr(p.profitRate, DEFAULTS.profitRate);
    var wireCatalog = p.wireCatalog || null;

    // ── 1. 材料成本: BOM逐行 ──
    var materialCost = 0;
    var totalCuWeight = 0, totalAlWeight = 0;
    var totalCuCost = 0, totalAlCost = 0, totalNonMetalCost = 0;
    var totalComponentCost = 0;
    var bomDetails = [];
    var materialByType = { wire: 0, connector: 0, terminal: 0, auxiliary: 0, other: 0 };

    if (bomItems.length > 0) {
      for (var i = 0; i < bomItems.length; i++) {
        var result = computeBomLineCost(bomItems[i], wireCatalog, metalPrices);
        materialCost += result.lineCost;
        totalCuWeight += result.cuWeight;
        totalAlWeight += result.alWeight;
        totalCuCost += result.cuCost;
        totalAlCost += result.alCost;
        totalNonMetalCost += result.nonMetalCost;
        if (result.type === 'wire') {
          materialByType.wire += result.lineCost;
        } else {
          totalComponentCost += result.lineCost;
          materialByType[result.type] = (materialByType[result.type] || 0) + result.lineCost;
        }
        bomDetails.push(result);
      }
    } else if (harnessConfig.materialCost !== undefined) {
      // 无BOM明细时使用直接提供的材料成本 (用于种子数据验证)
      materialCost = numberOr(harnessConfig.materialCost, 0);
      totalCuWeight = numberOr(harnessConfig.copperWeight, 0);
      totalAlWeight = numberOr(harnessConfig.aluminumWeight, 0);
    }

    // ── 2. 废品 ──
    var wasteCost = materialCost * wasteRate;

    // ── 3. 直接人工 ──
    var directLabor = processHours * laborRate;

    // ── 4. 制造费 ──
    var manufacturing = processHours * mfgRate;

    // ── 5. 管理费 ──
    // 注意: 管理费基数 = 材料+人工+制造 (不含废品!) — 经Excel验证
    var mgmtBase = materialCost + directLabor + manufacturing;
    var mgmtFee = mgmtBase * mgmtRate;

    // ── 6. 利润 ──
    // 利润基数 = 材料+废品+人工+制造+管理费 (含废品!) — 经Excel验证
    var subtotalBeforeProfit = materialCost + wasteCost + directLabor + manufacturing + mgmtFee;
    var profit = subtotalBeforeProfit * profitRate;

    // ── 7. 出厂价 ──
    var exFactoryPrice = subtotalBeforeProfit + profit;

    // ── 8. 包装 + 运输 ──
    var innerPack = numberOr(pack.innerPack, 0);
    var outerPack = numberOr(pack.outerPack, 0);
    var freight = numberOr(pack.freight, 0);
    var excessFreight = numberOr(pack.excessFreight, 0);
    var shortHaul = numberOr(pack.shortHaul, 0);
    var thirdParty = numberOr(pack.thirdPartyWarehouse, numberOr(pack.thirdParty, 0));
    var storage = numberOr(pack.storage, 0);

    var packSubtotal = innerPack + outerPack;              // 包装费 (P列)
    var freightSubtotal = freight + excessFreight + shortHaul + thirdParty + storage;  // 运输费 (Q列)
    var packTotal = packSubtotal + freightSubtotal;

    // ── 9. 到厂价 ──
    var deliveredPrice = exFactoryPrice + packTotal;

    return {
      // 标识
      harnessId: harnessId,
      harnessName: harnessName,
      vehicleRatio: vehicleRatio,

      // 材料
      materialCost: materialCost,
      materialBreakdown: {
        cuCost: totalCuCost,
        alCost: totalAlCost,
        nonMetalCost: totalNonMetalCost,
        componentCost: totalComponentCost,
        byType: materialByType
      },
      copperWeight: totalCuWeight,
      aluminumWeight: totalAlWeight,

      // 废品
      wasteCost: wasteCost,

      // 人工
      processHours: processHours,
      directLabor: directLabor,

      // 制造
      manufacturing: manufacturing,

      // 人工+制造
      laborPlusMfg: directLabor + manufacturing,

      // 管理
      mgmtFee: mgmtFee,

      // 利润
      profit: profit,

      // 出厂价
      exFactoryPrice: exFactoryPrice,

      // 包装
      packSubtotal: packSubtotal,
      freightSubtotal: freightSubtotal,
      packTotal: packTotal,
      packBreakdown: {
        innerPack: innerPack,
        outerPack: outerPack,
        freight: freight,
        excessFreight: excessFreight,
        shortHaul: shortHaul,
        thirdPartyWarehouse: thirdParty,
        storage: storage
      },

      // 到厂价
      deliveredPrice: deliveredPrice,

      // 加权贡献
      weightedDeliveredPrice: deliveredPrice * vehicleRatio,

      // BOM明细
      bomDetails: bomDetails,

      // 核算参数 (用于追溯)
      _params: {
        laborRate: laborRate,
        mfgRate: mfgRate,
        wasteRate: wasteRate,
        mgmtRate: mgmtRate,
        profitRate: profitRate,
        metalPrices: metalPrices
      }
    };
  }

  /**
   * computeProjectFromHarnesses — 从线束号汇总到项目级
   *
   * @param {Array} harnessResults - computeHarnessCost() 的结果数组
   * @returns {Object} 项目级汇总
   */
  function computeProjectFromHarnesses(harnessResults) {
    var harnesses = safeArray(harnessResults);
    var project = {
      harnesses: harnesses,
      vehicleCost: 0,
      // 加权汇总 (× 装车比)
      weightedMaterial: 0,
      weightedWaste: 0,
      weightedLabor: 0,
      weightedMfg: 0,
      weightedLaborPlusMfg: 0,
      weightedMgmtFee: 0,
      weightedProfit: 0,
      weightedExFactory: 0,
      weightedPack: 0,
      weightedFreight: 0,
      weightedCopperWeight: 0,
      weightedAluminumWeight: 0,
      weightedProcessHours: 0,
      // 总量 (不加权, 用于设备分摊等)
      totalCopperWeight: 0,
      totalAluminumWeight: 0,
      totalProcessHours: 0,
      // 统计
      harnessCount: harnesses.length,
      familyCount: 0,
    };

    var families = new Set();

    for (var i = 0; i < harnesses.length; i++) {
      var h = harnesses[i];
      var ratio = numberOr(h.vehicleRatio, 0);

      project.vehicleCost += numberOr(h.deliveredPrice, 0) * ratio;
      project.weightedMaterial += numberOr(h.materialCost, 0) * ratio;
      project.weightedWaste += numberOr(h.wasteCost, 0) * ratio;
      project.weightedLabor += numberOr(h.directLabor, 0) * ratio;
      project.weightedMfg += numberOr(h.manufacturing, 0) * ratio;
      project.weightedLaborPlusMfg += numberOr(h.laborPlusMfg, 0) * ratio;
      project.weightedMgmtFee += numberOr(h.mgmtFee, 0) * ratio;
      project.weightedProfit += numberOr(h.profit, 0) * ratio;
      project.weightedExFactory += numberOr(h.exFactoryPrice, 0) * ratio;
      project.weightedPack += numberOr(h.packSubtotal, 0) * ratio;
      project.weightedFreight += numberOr(h.freightSubtotal, 0) * ratio;
      project.weightedCopperWeight += numberOr(h.copperWeight, 0) * ratio;
      project.weightedAluminumWeight += numberOr(h.aluminumWeight, 0) * ratio;
      project.weightedProcessHours += numberOr(h.processHours, 0) * ratio;

      project.totalCopperWeight += numberOr(h.copperWeight, 0);
      project.totalAluminumWeight += numberOr(h.aluminumWeight, 0);
      project.totalProcessHours += numberOr(h.processHours, 0);

      if (h.family) families.add(h.family);
    }

    project.familyCount = families.size;

    return project;
  }

  /**
   * computeHarnessesFromSeedData — 从种子数据批量核算
   * 当有完整BOM时走BOM精算，否则用种子数据中的材料成本直接核算
   *
   * @param {Array} seedHarnesses - 种子数据中的 harnesses 数组
   * @param {Object} params - 核算参数
   * @returns {Object} { harnesses: [...results], project: {...summary} }
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
        // 无BOM时直接使用种子数据的材料成本
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
   *
   * @param {Array} harnessResults - computeHarnessCost() 的结果数组
   * @returns {Object} { columns, rows, totals }
   */
  function buildHarnessCostTable(harnessResults) {
    var columns = [
      { key: 'harnessId', label: '零件号' },
      { key: 'harnessName', label: '名称' },
      { key: 'vehicleRatio', label: '装车比' },
      { key: 'materialCost', label: '材料成本', unit: '元' },
      { key: 'wasteCost', label: '废品', unit: '元' },
      { key: 'directLabor', label: '直接人工', unit: '元' },
      { key: 'manufacturing', label: '制造费', unit: '元' },
      { key: 'mgmtFee', label: '管理费', unit: '元' },
      { key: 'profit', label: '利润', unit: '元' },
      { key: 'exFactoryPrice', label: '出厂价', unit: '元' },
      { key: 'packSubtotal', label: '包装费', unit: '元' },
      { key: 'freightSubtotal', label: '运输费', unit: '元' },
      { key: 'deliveredPrice', label: '到厂价', unit: '元' },
    ];

    var rows = safeArray(harnessResults).map(function (h) {
      return {
        harnessId: h.harnessId,
        harnessName: h.harnessName,
        vehicleRatio: h.vehicleRatio,
        materialCost: h.materialCost,
        wasteCost: h.wasteCost,
        directLabor: h.directLabor,
        manufacturing: h.manufacturing,
        mgmtFee: h.mgmtFee,
        profit: h.profit,
        exFactoryPrice: h.exFactoryPrice,
        packSubtotal: h.packSubtotal,
        freightSubtotal: h.freightSubtotal,
        deliveredPrice: h.deliveredPrice,
      };
    });

    var project = computeProjectFromHarnesses(harnessResults);
    var totals = {
      harnessId: '加权合计',
      harnessName: '',
      vehicleRatio: '',
      materialCost: project.weightedMaterial,
      wasteCost: project.weightedWaste,
      directLabor: project.weightedLabor,
      manufacturing: project.weightedMfg,
      mgmtFee: project.weightedMgmtFee,
      profit: project.weightedProfit,
      exFactoryPrice: project.weightedExFactory,
      packSubtotal: project.weightedPack,
      freightSubtotal: project.weightedFreight,
      deliveredPrice: project.vehicleCost,
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
    DEFAULTS: DEFAULTS,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  global.G281HarnessCosting = api;
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this);
