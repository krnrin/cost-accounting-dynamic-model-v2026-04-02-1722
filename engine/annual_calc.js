/**
 * engine/annual_calc.js
 * Issue #9: 年度行计算 + 对比行 + 组合摘要 + 精确财务模型构建
 * 依赖: shared_utils.js, snapshot_resolver.js, state_normalizer.js
 */
(function (global) {
  'use strict';

  // P0#1: 防御性解构
  const { numberOr, safeArray } = global.G281SharedUtils || {};

  // ── 年度值访问 ────────────────────────────
  function annualValueAt(version, key, index, fallback) {
    const series = version && version.annual && Array.isArray(version.annual[key]) ? version.annual[key] : null;
    if (!series) return fallback;
    const value = Number(series[index]);
    return Number.isFinite(value) ? value : fallback;
  }

  // ── 从 financialVersion 构建年度行 ──────────
  function buildAnnualRowsFromFinancial(version, fallbackYears) {
    const years = safeArray(version && version.years).length ? safeArray(version.years) : safeArray(fallbackYears);
    const volumes = safeArray(version && version.volumes);
    const aspSeries = safeArray(version && version.asp);
    return years.map((year, index) => {
      const volume = numberOr(volumes[index], 0);
      const asp = numberOr(aspSeries[index], volume ? annualValueAt(version, 'revenue', index, 0) / volume : 0);
      const revenue = annualValueAt(version, 'revenue', index, volume * asp);
      const cost = annualValueAt(version, 'cost', index, 0);
      const profit = annualValueAt(version, 'profit', index, revenue - cost);
      const margin = annualValueAt(version, 'margin', index, revenue ? profit / revenue : 0);
      return {
        year, volume, asp, revenue, cost, profit, margin,
        costPerSet: annualValueAt(version, 'costPerSet', index, volume ? cost / volume : 0),
        materialPerSet: annualValueAt(version, 'materialPerSet', index, numberOr(version && version.perSet && version.perSet.material, 0)),
        directLaborPerSet: annualValueAt(version, 'directLaborPerSet', index, numberOr(version && version.perSet && version.perSet.directLabor, 0)),
        equipmentPerSet: annualValueAt(version, 'equipmentPerSet', index, numberOr(version && version.perSet && version.perSet.equipment, 0)),
        manufacturingPerSet: annualValueAt(version, 'manufacturingPerSet', index, numberOr(version && version.perSet && version.perSet.manufacturing, 0)),
        rndPerSet: annualValueAt(version, 'rndPerSet', index, numberOr(version && version.perSet && version.perSet.rnd, 0)),
        packagingPerSet: annualValueAt(version, 'packagingPerSet', index, numberOr(version && version.perSet && version.perSet.packaging, 0)),
      };
    });
  }

  // ── 从计算结果构建年度行 ───────────────
  function buildAnnualRowsFromComputed(years, draft, operating, material, directLabor, equipment, manufacturing, rnd, packaging, mixPrice) {
    return safeArray(years).map((year, index) => {
      const volume = numberOr(draft && draft.volumes && draft.volumes[index], 0);
      const asp = numberOr(draft && draft.asp && draft.asp[index], 0) * mixPrice;
      const revenue = volume * asp;
      const cost = volume * operating;
      const profit = revenue - cost;
      const margin = revenue ? profit / revenue : 0;
      return { year, volume, asp, revenue, cost, profit, margin,
               costPerSet: volume ? cost / volume : operating,
               materialPerSet: material, directLaborPerSet: directLabor, equipmentPerSet: equipment,
               manufacturingPerSet: manufacturing, rndPerSet: rnd, packagingPerSet: packaging };
    });
  }

  // ── 丰富计算年度行 ──────────────────────
  function enrichComputedAnnualRows(model) {
    return safeArray(model && model.annual).map((row) => ({
      ...row,
      costPerSet: numberOr(row && row.volume, 0) ? numberOr(row.cost, 0) / numberOr(row.volume, 1) : numberOr(model && model.operating, 0),
      materialPerSet: numberOr(model && model.material, 0),
      directLaborPerSet: numberOr(model && model.directLabor, 0),
      equipmentPerSet: numberOr(model && model.equipment, 0),
      manufacturingPerSet: numberOr(model && model.manufacturing, 0),
      rndPerSet: numberOr(model && model.rnd, 0),
      packagingPerSet: numberOr(model && model.packaging, 0),
    }));
  }

  // ── 报价基线对比 ──────────────────────────
  function quoteCompareBase(runtime, base) {
    const SR = global.G281SnapshotResolver;
    const quoteFinancial = SR.financialVersionData(runtime, 'quote');
    const revenuePerSet = numberOr(quoteFinancial && quoteFinancial.perSet && quoteFinancial.perSet.revenue,
      numberOr(base && base.baseRevenuePerSet, 0));
    const costPerSet = numberOr(quoteFinancial && quoteFinancial.perSet && quoteFinancial.perSet.cost,
      numberOr(base && base.baseCostPerSet, 0));
    return {
      revenuePerSet, costPerSet, profitPerSet: revenuePerSet - costPerSet,
      materialPerSet: numberOr(quoteFinancial && quoteFinancial.perSet && quoteFinancial.perSet.material, numberOr(base && base.baseMaterial, 0)),
      rndPerSet: numberOr(quoteFinancial && quoteFinancial.perSet && quoteFinancial.perSet.rnd, numberOr(base && base.baseRndPerSet, 0)),
      laborPerSet: numberOr(quoteFinancial && quoteFinancial.perSet && quoteFinancial.perSet.directLabor, 0)
        + numberOr(quoteFinancial && quoteFinancial.perSet && quoteFinancial.perSet.manufacturing, 0),
      packagingPerSet: numberOr(quoteFinancial && quoteFinancial.perSet && quoteFinancial.perSet.packaging, 0),
      equipmentPerSet: numberOr(quoteFinancial && quoteFinancial.perSet && quoteFinancial.perSet.equipment, 0),
    };
  }

  // ── 对比行 ────────────────────────────────
  function buildCompareRows(baseRevenuePerSet, baseCostPerSet, basePaybackVolume,
    currentRevenuePerSet, totalVolume, totalRevenue, totalCost, totalProfit, margin, paybackVolume) {
    return [
      ['单套收入', baseRevenuePerSet, currentRevenuePerSet],
      ['单套成本', baseCostPerSet, totalVolume ? totalCost / totalVolume : 0],
      ['单套利润', baseRevenuePerSet - baseCostPerSet, totalVolume ? totalProfit / totalVolume : 0],
      ['生命周期收入', baseRevenuePerSet * totalVolume, totalRevenue],
      ['生命周期成本', baseCostPerSet * totalVolume, totalCost],
      ['生命周期利润', (baseRevenuePerSet - baseCostPerSet) * totalVolume, totalProfit],
      ['毛利率', baseRevenuePerSet ? (baseRevenuePerSet - baseCostPerSet) / baseRevenuePerSet : 0, margin],
      ['回收销量', basePaybackVolume, paybackVolume],
    ];
  }

  // ── 组合摘要 ──────────────────────────────
  function buildPortfolioSummary(mode, financialVersionKey, financialVersionLabel, warnings, totals, annualRows) {
    return {
      mode,
      financialVersionKey: financialVersionKey || '',
      financialVersionLabel: financialVersionLabel || '',
      isExact: mode === 'financial_exact',
      warnings: safeArray(warnings),
      unit: {
        revenue: numberOr(totals.revenue, 0), cost: numberOr(totals.cost, 0),
        profit: numberOr(totals.profit, 0), margin: numberOr(totals.margin, 0),
        material: numberOr(totals.material, 0), directLabor: numberOr(totals.directLabor, 0),
        manufacturing: numberOr(totals.manufacturing, 0), packaging: numberOr(totals.packaging, 0),
        equipment: numberOr(totals.equipment, 0), rnd: numberOr(totals.rnd, 0),
      },
      lifecycle: {
        volume: numberOr(totals.totalVolume, 0), revenue: numberOr(totals.totalRevenue, 0),
        cost: numberOr(totals.totalCost, 0), profit: numberOr(totals.totalProfit, 0),
        margin: numberOr(totals.margin, 0),
      },
      annual: safeArray(annualRows).map((row) => ({ ...row })),
    };
  }

  // ── 精确财务模型构建 ────────────────────
  function buildExactFinancialModel(options) {
    const financial = options.exactFinancial.financial || {};
    const qBase = quoteCompareBase(options.runtime, options.base);
    const SN = global.G281StateNormalizer;
    const years = Array.isArray(financial.years) && financial.years.length ? financial.years
      : (options.base && options.base.years ? options.base.years : []);
    const annualRevenue = financial.annual && Array.isArray(financial.annual.revenue) ? financial.annual.revenue : [];
    const annualCost = financial.annual && Array.isArray(financial.annual.cost) ? financial.annual.cost : [];
    const annualProfit = financial.annual && Array.isArray(financial.annual.profit) ? financial.annual.profit : [];
    const annualMargin = financial.annual && Array.isArray(financial.annual.margin) ? financial.annual.margin : [];
    const annual = years.map((year, i) => {
      const volume = numberOr(financial.volumes && financial.volumes[i], 0);
      const asp = numberOr(financial.asp && financial.asp[i], volume ? numberOr(annualRevenue[i], 0) / volume : 0);
      const revenue = numberOr(annualRevenue[i], volume * asp);
      const cost = numberOr(annualCost[i], volume ? numberOr(financial.perSet && financial.perSet.cost, 0) * volume : 0);
      const profit = numberOr(annualProfit[i], revenue - cost);
      const margin = numberOr(annualMargin[i], revenue ? profit / revenue : 0);
      return { year, volume, asp, revenue, cost, profit, margin };
    });
    const totalVolume = numberOr(financial.totals && financial.totals.volume, annual.reduce((s, r) => s + r.volume, 0));
    const totalRevenue = numberOr(financial.totals && financial.totals.revenue, annual.reduce((s, r) => s + r.revenue, 0));
    const totalCost = numberOr(financial.totals && financial.totals.cost, annual.reduce((s, r) => s + r.cost, 0));
    const totalProfit = numberOr(financial.totals && financial.totals.profit, totalRevenue - totalCost);
    const margin = numberOr(financial.totals && financial.totals.margin, totalRevenue ? totalProfit / totalRevenue : 0);
    const material = numberOr(financial.perSet && financial.perSet.material, qBase.materialPerSet);
    const directLabor = numberOr(financial.perSet && financial.perSet.directLabor, 0);
    const manufacturing = numberOr(financial.perSet && financial.perSet.manufacturing, 0);
    const packaging = numberOr(financial.perSet && financial.perSet.packaging, 0);
    const equipment = numberOr(financial.perSet && financial.perSet.equipment, totalVolume ? numberOr(financial.totals && financial.totals.equipment, 0) / totalVolume : 0);
    const rnd = numberOr(financial.perSet && financial.perSet.rnd, qBase.rndPerSet);
    const operating = numberOr(financial.perSet && financial.perSet.cost, totalVolume ? totalCost / totalVolume : 0);
    const avgProfit = numberOr(financial.perSet && financial.perSet.profit, totalVolume ? totalProfit / totalVolume : 0);
    const capitalTotal = options.currentCapitalSnapshot.equipment + options.currentCapitalSnapshot.tooling
      + options.currentCapitalSnapshot.fixtures + options.currentCapitalSnapshot.rnd;
    const capitalPerSet = totalVolume ? capitalTotal / totalVolume : 0;
    const paybackVolume = avgProfit > 0 ? capitalTotal / avgProfit : Infinity;
    const quoteCapitalTotal = options.quoteCapitalSnapshot.equipment + options.quoteCapitalSnapshot.tooling
      + options.quoteCapitalSnapshot.fixtures + options.quoteCapitalSnapshot.rnd;
    const basePaybackVolume = qBase.profitPerSet > 0 ? quoteCapitalTotal / qBase.profitPerSet : Infinity;
    const avgAsp = annual.length ? annual.reduce((s, r) => s + r.asp, 0) / annual.length : 0;
    const bomSummary = SN.summarizeBomChanges(options.bomChanges);
    bomSummary.configList = [...bomSummary.configs]; bomSummary.configCount = bomSummary.configList.length;

    return {
      d: options.draft,
      bom: { ...options.bom, factor: qBase.materialPerSet ? material / qBase.materialPerSet : options.bom.factor,
             sourceKind: options.bomSnapshot.kind, snapshot: options.bomSnapshot.snapshot },
      metal: options.metal,
      conn: { ...options.conn, effectiveFactor: options.connectorScenario.factor || options.conn.factor,
              defaultKey: options.currentState.connector, overrideCount: options.connectorScenario.overrideCount,
              followCount: options.connectorScenario.followCount },
      labor: { ...options.labor, factor: qBase.laborPerSet ? (directLabor + manufacturing) / qBase.laborPerSet : options.labor.factor },
      equip: { ...options.equip, factor: qBase.equipmentPerSet ? equipment / qBase.equipmentPerSet : options.equip.factor },
      pack: { ...options.pack, factor: qBase.packagingPerSet ? packaging / qBase.packagingPerSet : options.pack.factor },
      sales: options.sales, mix: options.mix,
      annualDrop: { ...options.annualDrop, annualRate: 0 },
      oneTimeCustomer: { ...options.oneTimeCustomer, amountTotal: 0, amountPerSet: 0 },
      rebate: { ...options.rebate, amountPerSet: 0 },
      vave: options.vave,
      connectorItems: options.connectorScenario.items,
      connectorSummary: { ...options.connectorScenario, defaultKey: options.currentState.connector, defaultLabel: options.conn.label },
      bomCalc: { ...options.wireCalc }, bomSummary,
      mixPrice: options.mixPrice, mixCost: options.mixCost,
      material, directLabor, manufacturing, packaging, equipment, rnd, operating, annual,
      totalVolume, totalRevenue, totalCost, totalProfit, margin, avgProfit,
      capitalTotal, capitalPerSet,
      capitalBreakdown: { equipment: options.currentCapitalSnapshot.equipment, tooling: options.currentCapitalSnapshot.tooling,
                          fixtures: options.currentCapitalSnapshot.fixtures, rnd: options.currentCapitalSnapshot.rnd },
      paybackVolume,
      paybackYears: totalProfit > 0 && annual.length ? capitalTotal / (totalProfit / annual.length) : Infinity,
      compare: buildCompareRows(qBase.revenuePerSet, qBase.costPerSet, basePaybackVolume,
        avgAsp, totalVolume, totalRevenue, totalCost, totalProfit, margin, paybackVolume),
      currentMix: options.draft.mix,
      stateSnapshot: { ...options.currentState },
      dataLayer: 'JSON 数据层 + financialVersions',
      engineLayer: '计算引擎 (financial exact)',
      exactFinancialVersionKey: options.exactFinancial.key,
    };
  }

  // ── 导出 ────────────────────────────────────
  global.G281AnnualCalc = {
    annualValueAt,
    buildAnnualRowsFromFinancial,
    buildAnnualRowsFromComputed,
    enrichComputedAnnualRows,
    quoteCompareBase,
    buildCompareRows,
    buildPortfolioSummary,
    buildExactFinancialModel,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = global.G281AnnualCalc;
  }
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this);
