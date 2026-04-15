(function (global) {
  'use strict';

  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const weighted = (shares, indexes) => shares.reduce((sum, value, index) => sum + (Number(value) || 0) / 100 * indexes[index], 0);
  const normalizeMix = (values) => {
    const series = values.map((value) => Math.max(0, Number(value) || 0));
    const total = series.reduce((sum, value) => sum + value, 0) || 1;
    return series.map((value) => value / total * 100);
  };
  const FINANCIAL_VERSION_KEYS = new Set(['quote', 'fixed']);
  const STATE_FINANCIAL_VERSION_MAP = {
    bom: { freeze: 'quote', light: 'fixed' },
    metal: { quote: 'quote', fixed: 'fixed' },
    connector: { quote: 'quote', fixed: 'fixed' },
    sales: { quote: 'quote', fixed: 'fixed' },
    labor: { base: 'quote', optimize: 'fixed' },
    equipment: { base: 'quote', shared: 'fixed' },
    packaging: { base: 'quote', optimize: 'fixed' },
    mix: { quote: 'quote', fixed: 'fixed' },
  };
  const connectorBaseCostDefault = (base) => Number(base && base.baseMaterial) * 0.24 || 0;
  const connectorVersionKey = (versions, key, fallback) => (key && versions[key] ? key : fallback);
  const specialConnectorStages = {
    progress: {
      label: '进度价',
      note: '已达成部分按定点版执行，未达成部分按报价版执行。',
    },
  };

  function numberOr(value, fallback) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : fallback;
  }

  function safeArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function clonePlain(value, fallback) {
    try {
      return JSON.parse(JSON.stringify(value));
    } catch (error) {
      return fallback;
    }
  }

  function approxEqual(left, right, epsilon) {
    return Math.abs(numberOr(left, 0) - numberOr(right, 0)) <= (epsilon || 1e-6);
  }

  function arraysClose(left, right, epsilon) {
    const a = safeArray(left);
    const b = safeArray(right);
    if (a.length !== b.length) return false;
    return a.every((value, index) => approxEqual(value, b[index], epsilon));
  }

  function financialVersionEntries(runtime) {
    return runtime && runtime.financialVersions && runtime.financialVersions.versions
      ? runtime.financialVersions.versions
      : {};
  }

  function financialVersion(runtime, key) {
    if (!key) return null;
    const version = financialVersionEntries(runtime)[key];
    return version || null;
  }

  function stateFinancialVersionKey(group, key) {
    return STATE_FINANCIAL_VERSION_MAP[group] && STATE_FINANCIAL_VERSION_MAP[group][key]
      ? STATE_FINANCIAL_VERSION_MAP[group][key]
      : '';
  }

  function resolvePureFinancialVersionKey(currentState, draft) {
    if (!currentState || currentState.vave !== 'none') return '';
    if (draft && draft.connectorPricing && Object.keys(draft.connectorPricing).length) return '';

    const groups = ['bom', 'metal', 'connector', 'sales', 'labor', 'equipment', 'packaging', 'mix'];
    let resolved = '';
    for (const group of groups) {
      const mapped = stateFinancialVersionKey(group, currentState[group]);
      if (!mapped) return '';
      if (!resolved) {
        resolved = mapped;
        continue;
      }
      if (resolved !== mapped) {
        return '';
      }
    }
    return FINANCIAL_VERSION_KEYS.has(resolved) ? resolved : '';
  }

  function resolveReferenceFinancialVersionKey(currentState) {
    const candidates = [
      stateFinancialVersionKey('sales', currentState && currentState.sales),
      stateFinancialVersionKey('bom', currentState && currentState.bom),
      stateFinancialVersionKey('metal', currentState && currentState.metal),
      stateFinancialVersionKey('labor', currentState && currentState.labor),
      stateFinancialVersionKey('equipment', currentState && currentState.equipment),
      stateFinancialVersionKey('packaging', currentState && currentState.packaging),
      'fixed',
      'quote',
    ];
    return candidates.find((key) => FINANCIAL_VERSION_KEYS.has(key)) || '';
  }

  function annualValueAt(version, key, index, fallback) {
    const series = version && version.annual && Array.isArray(version.annual[key]) ? version.annual[key] : null;
    if (!series) return fallback;
    const value = Number(series[index]);
    return Number.isFinite(value) ? value : fallback;
  }

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
        year,
        volume,
        asp,
        revenue,
        cost,
        profit,
        margin,
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

  function buildAnnualRowsFromComputed(years, draft, operating, material, directLabor, equipment, manufacturing, rnd, packaging, mixPrice) {
    return safeArray(years).map((year, index) => {
      const volume = numberOr(draft && draft.volumes && draft.volumes[index], 0);
      const asp = numberOr(draft && draft.asp && draft.asp[index], 0) * mixPrice;
      const revenue = volume * asp;
      const cost = volume * operating;
      const profit = revenue - cost;
      const margin = revenue ? profit / revenue : 0;
      return {
        year,
        volume,
        asp,
        revenue,
        cost,
        profit,
        margin,
        costPerSet: volume ? cost / volume : operating,
        materialPerSet: material,
        directLaborPerSet: directLabor,
        equipmentPerSet: equipment,
        manufacturingPerSet: manufacturing,
        rndPerSet: rnd,
        packagingPerSet: packaging,
      };
    });
  }

  function normalizeLifecycleYear(value, fallback) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : fallback;
  }

  function lifecycleYears(base) {
    const years = safeArray(base && base.years);
    return years.map((year, index) => normalizeLifecycleYear(year, new Date().getFullYear() + index));
  }

  function legacyAnnualDropRows(years, annualRate) {
    const rate = Math.max(0, numberOr(annualRate, 0));
    return safeArray(years).map((year, index) => {
      if (index === 0 || rate <= 0) {
        return { year, rate: 0, note: index === 0 ? '基准年' : '' };
      }
      const prevFactor = Math.max(0, 1 - rate * (index - 1));
      const nextFactor = Math.max(0, 1 - rate * index);
      const derivedRate = prevFactor > 0 ? Math.max(0, 1 - (nextFactor / prevFactor)) : 0;
      return { year, rate: derivedRate, note: '由整体年降率换算' };
    });
  }

  function normalizeAnnualDropVersion(version, years) {
    const rowMap = new Map();
    safeArray(version && version.yearRows).forEach((row) => {
      const year = normalizeLifecycleYear(row && row.year, NaN);
      if (!Number.isFinite(year)) return;
      rowMap.set(year, {
        year,
        rate: Math.max(0, numberOr(row && row.rate, 0)),
        note: row && row.note ? String(row.note) : '',
      });
    });
    if (!rowMap.size) {
      legacyAnnualDropRows(years, version && version.annualRate).forEach((row) => rowMap.set(row.year, row));
    }
    let factor = 1;
    const yearRows = safeArray(years).map((year, index) => {
      const fallback = { year, rate: 0, note: index === 0 ? '基准年' : '' };
      const baseRow = rowMap.get(year) || fallback;
      const rate = index === 0 ? 0 : Math.max(0, numberOr(baseRow.rate, 0));
      factor = index === 0 ? 1 : Math.max(0, factor * (1 - rate));
      return {
        year,
        rate,
        factor,
        note: baseRow.note || (index === 0 ? '基准年' : ''),
      };
    });
    const annualRate = yearRows.find((row, index) => index > 0 && numberOr(row.rate, 0) > 0)?.rate
      ?? yearRows.find((row) => numberOr(row.rate, 0) > 0)?.rate
      ?? 0;
    return {
      ...(version || {}),
      yearRows,
      annualRate: Math.max(0, numberOr(annualRate, 0)),
    };
  }

  function normalizeOneTimeCustomerEntries(version, years, volumes) {
    const firstYear = years[0] || new Date().getFullYear();
    const lifecycleVolume = safeArray(volumes).reduce((sum, value) => sum + Math.max(0, numberOr(value, 0)), 0);
    const entries = safeArray(version && version.entries).reduce((acc, entry, index) => {
      const amount = Math.max(0, numberOr(entry && entry.amount, 0));
      if (!amount) return acc;
      const modeText = String(entry && entry.mode ? entry.mode : '').toLowerCase();
      const mode = modeText.includes('direct') || String(entry && entry.mode ? entry.mode : '').includes('直接') ? 'direct' : 'allocate';
      acc.push({
        category: entry && entry.category ? String(entry.category) : `一次性${index + 1}`,
        mode,
        amount,
        recognitionYear: normalizeLifecycleYear(entry && entry.recognitionYear, firstYear),
        allocationStartYear: normalizeLifecycleYear(entry && entry.allocationStartYear, firstYear),
        allocationVolume: Math.max(0, numberOr(entry && entry.allocationVolume, lifecycleVolume)),
        note: entry && entry.note ? String(entry.note) : '',
      });
      return acc;
    }, []);
    if (entries.length) return entries;
    const legacyAmount = Math.max(0, numberOr(version && version.amountTotal, 0));
    if (!legacyAmount) return [];
    return [{
      category: '??',
      mode: 'allocate',
      amount: legacyAmount,
      recognitionYear: firstYear,
      allocationStartYear: firstYear,
      allocationVolume: lifecycleVolume,
      note: '一次性客户收入',
    }];
  }

  function normalizeOneTimeCustomerVersion(version, years, volumes) {
    const entries = normalizeOneTimeCustomerEntries(version, years, volumes);
    const totalVolume = safeArray(volumes).reduce((sum, value) => sum + Math.max(0, numberOr(value, 0)), 0);
    const firstYear = years[0] || new Date().getFullYear();
    const yearIndexMap = new Map(safeArray(years).map((year, index) => [year, index]));
    const revenueByYear = safeArray(years).map(() => 0);
    let directTotal = 0;
    let allocateTotal = 0;
    let unallocatedTotal = 0;
    entries.forEach((entry) => {
      const amount = Math.max(0, numberOr(entry && entry.amount, 0));
      if (!amount) return;
      if (entry.mode === 'direct') {
        const recognitionYear = normalizeLifecycleYear(entry && entry.recognitionYear, firstYear);
        const yearIndex = yearIndexMap.has(recognitionYear) ? yearIndexMap.get(recognitionYear) : 0;
        revenueByYear[yearIndex] += amount;
        directTotal += amount;
        return;
      }
      allocateTotal += amount;
      let allocationVolume = Math.max(0, numberOr(entry && entry.allocationVolume, totalVolume));
      if (allocationVolume <= 0 || totalVolume <= 0) {
        unallocatedTotal += amount;
        return;
      }
      const unitAmount = amount / allocationVolume;
      const startYear = normalizeLifecycleYear(entry && entry.allocationStartYear, firstYear);
      const startIndex = yearIndexMap.has(startYear) ? yearIndexMap.get(startYear) : 0;
      for (let index = startIndex; index < years.length && allocationVolume > 1e-6; index += 1) {
        const yearVolume = Math.max(0, numberOr(volumes[index], 0));
        if (!yearVolume) continue;
        const allocatedVolume = Math.min(yearVolume, allocationVolume);
        revenueByYear[index] += allocatedVolume * unitAmount;
        allocationVolume -= allocatedVolume;
      }
      if (allocationVolume > 1e-6) {
        unallocatedTotal += allocationVolume * unitAmount;
      }
    });
    const recognizedTotal = revenueByYear.reduce((sum, value) => sum + value, 0);
    return {
      ...(version || {}),
      entries,
      amountTotal: directTotal + allocateTotal,
      amountPerSet: totalVolume ? recognizedTotal / totalVolume : 0,
      directTotal,
      allocateTotal,
      recognizedTotal,
      unallocatedTotal,
      revenueByYear,
      yearRows: safeArray(years).map((year, index) => ({
        year,
        amountTotal: revenueByYear[index],
        perSet: numberOr(volumes[index], 0) > 0 ? revenueByYear[index] / numberOr(volumes[index], 1) : 0,
      })),
    };
  }

  function normalizeRebateVersion(version, years, volumes) {
    const rowMap = new Map();
    safeArray(version && version.yearRows).forEach((row) => {
      const year = normalizeLifecycleYear(row && row.year, NaN);
      if (!Number.isFinite(year)) return;
      rowMap.set(year, {
        year,
        amountTotal: Math.max(0, numberOr(row && row.amountTotal, 0)),
        note: row && row.note ? String(row.note) : '',
      });
    });
    if (!rowMap.size) {
      const amountPerSet = Math.max(0, numberOr(version && version.amountPerSet, 0));
      safeArray(years).forEach((year, index) => {
        rowMap.set(year, {
          year,
          amountTotal: Math.max(0, numberOr(volumes[index], 0)) * amountPerSet,
          note: amountPerSet > 0 ? '返利' : '',
        });
      });
    }
    const yearRows = safeArray(years).map((year, index) => {
      const fallback = { year, amountTotal: 0, note: '' };
      const row = rowMap.get(year) || fallback;
      const volume = Math.max(0, numberOr(volumes[index], 0));
      const amountTotal = Math.max(0, numberOr(row.amountTotal, 0));
      return {
        year,
        amountTotal,
        amountPerSet: volume > 0 ? amountTotal / volume : 0,
        note: row.note || '',
      };
    });
    const amountTotal = yearRows.reduce((sum, row) => sum + row.amountTotal, 0);
    const totalVolume = safeArray(volumes).reduce((sum, value) => sum + Math.max(0, numberOr(value, 0)), 0);
    const unallocatedTotal = yearRows.reduce((sum, row, index) => sum + (numberOr(volumes[index], 0) > 0 ? 0 : row.amountTotal), 0);
    return {
      ...(version || {}),
      yearRows,
      amountTotal,
      amountPerSet: totalVolume ? amountTotal / totalVolume : 0,
      unallocatedTotal,
    };
  }

  function hasLifecycleBusinessEffect(model) {
    return safeArray(model && model.annualDrop && model.annualDrop.yearRows).some((row, index) => index > 0 && numberOr(row && row.rate, 0) > 0)
      || numberOr(model && model.oneTimeCustomer && model.oneTimeCustomer.amountTotal, 0) > 0
      || numberOr(model && model.rebate && model.rebate.amountTotal, 0) > 0;
  }

  function detectFinancialDriftWarnings(runtime, base, financialKey, draft) {
    const warnings = [];
    const version = financialVersion(runtime, financialKey);
    if (!version) return warnings;

    if (!arraysClose(draft && draft.volumes, version.volumes, 1e-6)) {
      warnings.push(`当前销量输入与 ${version.label || financialKey} financialVersions 不一致，已按 Excel 精确版口径计算。`);
    }
    if (!arraysClose(draft && draft.asp, version.asp, 1e-6)) {
      warnings.push(`当前 ASP 输入与 ${version.label || financialKey} financialVersions 不一致，已按 Excel 精确版口径计算。`);
    }

    const metal = base && base.versions && base.versions.metal ? base.versions.metal[financialKey] : null;
    if (metal) {
      if (!approxEqual(draft && draft.copperPrice, metal.copperPrice, 1e-3)) {
        warnings.push(`当前铜价输入与 ${version.label || financialKey} 金属基价不一致，已按 financialVersions 精确版口径计算。`);
      }
      if (!approxEqual(draft && draft.aluminumPrice, metal.aluminumPrice, 1e-3)) {
        warnings.push(`当前铝价输入与 ${version.label || financialKey} 金属基价不一致，已按 financialVersions 精确版口径计算。`);
      }
    }

    const labor = runtime && runtime.laborValidation && runtime.laborValidation.versionSnapshots
      ? runtime.laborValidation.versionSnapshots[financialKey]
      : null;
    if (labor) {
      if (
        !approxEqual(draft && draft.directHours, labor.directHours, 1e-3)
        || !approxEqual(draft && draft.directRate, labor.directRate, 1e-2)
        || !approxEqual(draft && draft.manufacturingHours, labor.manufacturingHours, 1e-3)
        || !approxEqual(draft && draft.manufacturingRate, labor.manufacturingRate, 1e-2)
      ) {
        warnings.push(`当前工时输入与 ${version.label || financialKey} 工时版不一致，已按 financialVersions 精确版口径计算。`);
      }
    }

    const packaging = runtime && runtime.packagingValidation && runtime.packagingValidation.versionSnapshots
      ? runtime.packagingValidation.versionSnapshots[financialKey]
      : null;
    if (packaging) {
      if (
        !approxEqual(draft && draft.packInner, packaging.packInner, 1e-3)
        || !approxEqual(draft && draft.packFreight, packaging.packFreight, 1e-3)
        || !approxEqual(draft && draft.packWarehouse, packaging.packWarehouse, 1e-3)
        || !approxEqual(draft && draft.packOther, packaging.packOther, 1e-3)
      ) {
        warnings.push(`当前包装物流输入与 ${version.label || financialKey} 包装版不一致，已按 financialVersions 精确版口径计算。`);
      }
    }

    return warnings;
  }

  function effectiveDraftForFinancial(runtime, base, draft, financialKey) {
    const version = financialVersion(runtime, financialKey);
    if (!version) return draft;
    const labor = runtime && runtime.laborValidation && runtime.laborValidation.versionSnapshots
      ? runtime.laborValidation.versionSnapshots[financialKey]
      : null;
    const packaging = runtime && runtime.packagingValidation && runtime.packagingValidation.versionSnapshots
      ? runtime.packagingValidation.versionSnapshots[financialKey]
      : null;
    const metal = base && base.versions && base.versions.metal ? base.versions.metal[financialKey] : null;

    return {
      ...draft,
      copperPrice: metal ? numberOr(metal.copperPrice, draft.copperPrice) : draft.copperPrice,
      aluminumPrice: metal ? numberOr(metal.aluminumPrice, draft.aluminumPrice) : draft.aluminumPrice,
      directHours: labor ? numberOr(labor.directHours, draft.directHours) : draft.directHours,
      directRate: labor ? numberOr(labor.directRate, draft.directRate) : draft.directRate,
      manufacturingHours: labor ? numberOr(labor.manufacturingHours, draft.manufacturingHours) : draft.manufacturingHours,
      manufacturingRate: labor ? numberOr(labor.manufacturingRate, draft.manufacturingRate) : draft.manufacturingRate,
      packInner: packaging ? numberOr(packaging.packInner, draft.packInner) : draft.packInner,
      packFreight: packaging ? numberOr(packaging.packFreight, draft.packFreight) : draft.packFreight,
      packWarehouse: packaging ? numberOr(packaging.packWarehouse, draft.packWarehouse) : draft.packWarehouse,
      packOther: packaging ? numberOr(packaging.packOther, draft.packOther) : draft.packOther,
      volumes: safeArray(version.volumes).length ? version.volumes.map((value) => numberOr(value, 0)) : draft.volumes,
      asp: safeArray(version.asp).length ? version.asp.map((value) => numberOr(value, 0)) : draft.asp,
    };
  }

  function buildPortfolioSummary(mode, financialVersionKey, financialVersionLabel, warnings, totals, annualRows) {
    return {
      mode,
      financialVersionKey: financialVersionKey || '',
      financialVersionLabel: financialVersionLabel || '',
      isExact: mode === 'financial_exact',
      warnings: safeArray(warnings),
      unit: {
        revenue: numberOr(totals.revenue, 0),
        cost: numberOr(totals.cost, 0),
        profit: numberOr(totals.profit, 0),
        margin: numberOr(totals.margin, 0),
        material: numberOr(totals.material, 0),
        directLabor: numberOr(totals.directLabor, 0),
        manufacturing: numberOr(totals.manufacturing, 0),
        packaging: numberOr(totals.packaging, 0),
        equipment: numberOr(totals.equipment, 0),
        rnd: numberOr(totals.rnd, 0),
      },
      lifecycle: {
        volume: numberOr(totals.totalVolume, 0),
        revenue: numberOr(totals.totalRevenue, 0),
        cost: numberOr(totals.totalCost, 0),
        profit: numberOr(totals.totalProfit, 0),
        margin: numberOr(totals.margin, 0),
      },
      annual: safeArray(annualRows).map((row) => ({ ...row })),
    };
  }

  function connectorStageSet(versions) {
    return new Set([...Object.keys(versions || {}), ...Object.keys(specialConnectorStages)]);
  }

  function connectorProtocolRows(protocolStatus, itemId) {
    const rows = protocolStatus && Array.isArray(protocolStatus.rows) ? protocolStatus.rows : [];
    return rows.filter((row) => row && row.portfolioId === itemId);
  }

  function connectorProtocolWeight(row) {
    const target = Number(row && row.targetProtocolPrice);
    if (Number.isFinite(target) && target > 0) return target;
    const reply = Number(row && row.replyPrice);
    if (Number.isFinite(reply) && reply > 0) return reply;
    return 1;
  }

  function buildConnectorProgressMeta(protocolStatus, itemId, versions) {
    const rows = connectorProtocolRows(protocolStatus, itemId);
    if (!rows.length) return null;
    const totalWeight = rows.reduce((sum, row) => sum + connectorProtocolWeight(row), 0) || 1;
    const confirmedWeight = rows.reduce((sum, row) => sum + (row.statusKey === 'confirmed' ? connectorProtocolWeight(row) : 0), 0);
    const confirmedShare = clamp(confirmedWeight / totalWeight, 0, 1);
    const quoteShare = clamp(1 - confirmedShare, 0, 1);
    const fixedFactor = versions.fixed ? numberOr(versions.fixed.factor, 1) : 1;
    const quoteFactor = versions.quote ? numberOr(versions.quote.factor, 1) : 1;
    return {
      rowCount: rows.length,
      confirmedShare,
      quoteShare,
      factor: confirmedShare * fixedFactor + quoteShare * quoteFactor,
    };
  }

  function connectorStageMeta(versions, stageKey, progressMeta) {
    if (stageKey === 'progress') {
      const baseMeta = specialConnectorStages.progress;
      if (!progressMeta) return { ...baseMeta, factor: 1 };
      return {
        ...baseMeta,
        factor: progressMeta.factor,
      };
    }
    return versions[stageKey] || versions.quote || { label: stageKey || '', note: '', factor: 1 };
  }

  function normalizeConnectorPricing(rawPricing, items, versions) {
    const validIds = new Set((items || []).map((item) => item.id));
    const validStages = connectorStageSet(versions);
    return Object.entries(rawPricing || {}).reduce((acc, [itemId, versionKey]) => {
      if (validIds.has(itemId) && validStages.has(versionKey)) {
        acc[itemId] = versionKey;
      }
      return acc;
    }, {});
  }

  // [DI] ctx parameter added — replaces global.G281ProgressPriceTracker
  function buildConnectorScenario(base, versions, defaultKey, draftPricing, protocolStatus, ctx) {
    const portfolio = base && base.connectorPortfolio ? base.connectorPortfolio : {};
    const items = Array.isArray(portfolio.items) ? portfolio.items : [];
    const baseCostPerSet = Number(portfolio.baseCostPerSet) || connectorBaseCostDefault(base);
    const pricing = normalizeConnectorPricing(draftPricing, items, versions);

    if (!items.length || !baseCostPerSet) {
      return {
        items: [],
        pricing,
        factor: versions[defaultKey] ? versions[defaultKey].factor : 1,
        totalBaseCost: baseCostPerSet,
        totalCurrentCost: baseCostPerSet,
        deltaCost: 0,
        overrideCount: 0,
        followCount: 0,
        stageCounts: { quote: 0, fixed: 0, progress: 0 },
      };
    }

    const stageCounts = { quote: 0, fixed: 0, progress: 0 };
    let totalBaseCost = 0;
    let totalCurrentCost = 0;
    let overrideCount = 0;
    let followCount = 0;

    const connectorItems = items.map((item) => {
      const share = Number(item.share) || 0;
      const baseCost = Number(item.baseCost) || baseCostPerSet * share;
      const progressMeta = buildConnectorProgressMeta(protocolStatus, item.id, versions);
      const rawExplicitKey = pricing[item.id] || '';
      const explicitKey = rawExplicitKey && rawExplicitKey !== defaultKey ? rawExplicitKey : '';
      const selectionKey = explicitKey === 'progress' ? 'progress' : connectorVersionKey(versions, explicitKey, defaultKey);
      const selection = connectorStageMeta(versions, selectionKey, progressMeta);
      const currentCost = baseCost * (selection ? selection.factor : 1);
      const followsDefault = !explicitKey;
      const currentShare = baseCostPerSet ? currentCost / baseCostPerSet : 0;

      totalBaseCost += baseCost;
      totalCurrentCost += currentCost;
      if (followsDefault) {
        followCount += 1;
      } else {
        overrideCount += 1;
      }
      if (stageCounts[selectionKey] !== undefined) {
        stageCounts[selectionKey] += 1;
      }

      return {
        ...item,
        share,
        baseCost,
        currentCost,
        deltaCost: currentCost - baseCost,
        currentShare,
        followsDefault,
        selectionKey,
        selectionLabel: selection ? selection.label : '',
        selectionNote: selection ? selection.note : '',
        overrideKey: explicitKey,
        progressMeta,
      };
    });

    // --- Issue #1: 进度价 = 协议价差距追踪 ---
    let progressPriceGap = 0;
    let progressPriceDetail = null;
    // [DI] ctx.progressTracker replaces global.G281ProgressPriceTracker
    const progressTracker = ctx && ctx.progressTracker;
    if (progressTracker) {
      const progressItems = connectorItems.map(item => ({
        partNo: item.partNo,
        agreedPrice: item.agreedPrice || item.protocolPrice || 0,
        batchPrice: item.batchPrice || item.currentPrice || 0,
        quotePrice: item.quotePrice || 0,
        quantity: item.lifecycleQty || item.qty || 0,
        supplier: item.supplier || '',
        harnessId: item.harnessId || '',
        category: item.category || 'connector',
      }));
      const progressResult = progressTracker.trackBatch(progressItems);
      progressPriceGap = progressResult.summary.netGap;
      progressPriceDetail = progressResult;
    }

    return {
      items: connectorItems,
      pricing,
      factor: baseCostPerSet ? totalCurrentCost / baseCostPerSet : 1,
      totalBaseCost,
      totalCurrentCost,
      deltaCost: totalCurrentCost - totalBaseCost,
      overrideCount,
      followCount,
      stageCounts,
      progressPriceGap,
      progressPriceDetail,
    };
  }

  function summarizeBomChanges(bomChanges) {
    return (bomChanges || []).reduce((acc, row) => {
      if (row.action === '替换') acc.replaceCount += 1;
      else if (row.action === '新增') acc.addCount += 1;
      else if (row.action === '取消') acc.cancelCount += 1;
      acc.obsoleteQty += Number(row.obsoleteQty) || 0;
      acc.obsoleteValue += Number(row.obsoleteValue) || 0;
      acc.equipmentDelta += Number(row.equipmentDelta) || 0;
      acc.laborDelta += Number(row.laborDelta) || 0;
      acc.packagingDelta += Number(row.packagingDelta) || 0;
      (row.configs || []).forEach((cfg) => acc.configs.add(cfg));
      return acc;
    }, {
      replaceCount: 0,
      addCount: 0,
      cancelCount: 0,
      obsoleteQty: 0,
      obsoleteValue: 0,
      equipmentDelta: 0,
      laborDelta: 0,
      packagingDelta: 0,
      configs: new Set(),
    });
  }

  function validationCapitalAmount(validation, scopeId, kind, fallback) {
    const summaryKey = kind === 'quote' ? 'quoteSummary' : 'fixedSummary';
    const amount = Number(validation && validation.comparisons && validation.comparisons[scopeId] && validation.comparisons[scopeId][summaryKey] && validation.comparisons[scopeId][summaryKey].totalNewAmount);
    return Number.isFinite(amount) ? amount : (Number(fallback) || 0);
  }

  function bomVersionSnapshot(runtime, base, versionKey) {
    const keyMap = {
      freeze: 'quote',
      light: 'fixed',
      regress: 'tt',
    };
    const snapshotKey = keyMap[versionKey];
    const runtimeSnapshots = runtime && runtime.bomVersions && runtime.bomVersions.versionSnapshots;
    const snapshot = snapshotKey && runtimeSnapshots ? runtimeSnapshots[snapshotKey] : null;
    const fallbackFactor = Number(base && base.versions && base.versions.bom && base.versions.bom[versionKey] && base.versions.bom[versionKey].factor);
    return {
      kind: snapshot && snapshot.kind ? snapshot.kind : (snapshotKey || versionKey || ''),
      factor: snapshot && Number.isFinite(Number(snapshot.materialFactor))
        ? Number(snapshot.materialFactor)
        : (Number.isFinite(fallbackFactor) ? fallbackFactor : 1),
      snapshot: snapshot || null,
    };
  }

  function capitalVersionSnapshot(runtime, base, versionKey) {
    const quoteSnapshot = {
      equipment: validationCapitalAmount(runtime && runtime.capitalValidation, 'equipment', 'quote', base && base.capital && base.capital.equipment),
      tooling: validationCapitalAmount(runtime && runtime.capitalValidation, 'tooling', 'quote', base && base.capital && base.capital.tooling),
      fixtures: validationCapitalAmount(runtime && runtime.capitalValidation, 'fixtures', 'quote', base && base.capital && base.capital.fixtures),
      rnd: Number(base && base.capital && base.capital.rnd) || 0,
      sourceKind: 'quote',
    };
    const fixedSnapshot = {
      equipment: validationCapitalAmount(runtime && runtime.capitalValidation, 'equipment', 'fixed', base && base.capital && base.capital.equipment),
      tooling: validationCapitalAmount(runtime && runtime.capitalValidation, 'tooling', 'fixed', base && base.capital && base.capital.tooling),
      fixtures: validationCapitalAmount(runtime && runtime.capitalValidation, 'fixtures', 'fixed', base && base.capital && base.capital.fixtures),
      rnd: Number(base && base.capital && base.capital.rnd) || 0,
      sourceKind: 'fixed',
    };
    const option = base && base.versions && base.versions.equipment ? base.versions.equipment[versionKey] || {} : {};
    const hasExplicitCapital = ['equipment', 'tooling', 'fixtures', 'rnd'].some((key) => option && option[key] !== undefined && option[key] !== null && option[key] !== '');
    if (hasExplicitCapital) {
      return {
        equipment: Number(option.equipment) || 0,
        tooling: Number(option.tooling) || 0,
        fixtures: Number(option.fixtures) || 0,
        rnd: Number(option.rnd) || 0,
        sourceKind: 'custom',
      };
    }
    if (versionKey === 'base') return quoteSnapshot;
    if (versionKey === 'shared') return fixedSnapshot;
    const factor = Number(option && option.factor);
    const scale = Number.isFinite(factor) && factor > 0 ? factor : 1;
    return {
      equipment: fixedSnapshot.equipment * scale,
      tooling: fixedSnapshot.tooling * scale,
      fixtures: fixedSnapshot.fixtures * scale,
      rnd: fixedSnapshot.rnd,
      sourceKind: 'tt',
    };
  }

  function lifecycleVersionKey(stateSnapshot) {
    const maps = {
      bom: { freeze: 'quote', light: 'fixed', regress: 'tt' },
      metal: { quote: 'quote', fixed: 'fixed', tt: 'tt' },
      connector: { quote: 'quote', fixed: 'fixed' },
      labor: { base: 'quote', optimize: 'fixed', ramp: 'tt' },
      equipment: { base: 'quote', shared: 'fixed', dedicated: 'tt' },
      packaging: { base: 'quote', optimize: 'fixed', longhaul: 'tt' },
      sales: { quote: 'quote', fixed: 'fixed', tt: 'tt' },
      mix: { quote: 'quote', fixed: 'fixed', tt: 'tt' },
    };
    const versions = Object.keys(maps).map((key) => maps[key][stateSnapshot && stateSnapshot[key]] || null);
    if (!versions.length || versions.some((key) => !key)) {
      return null;
    }
    return versions.every((key) => key === versions[0]) ? versions[0] : null;
  }

  function financialVersionData(runtime, versionKey) {
    return runtime && runtime.financialVersions && runtime.financialVersions.versions
      ? runtime.financialVersions.versions[versionKey] || null
      : null;
  }

  function lifecycleMetalBaseline(base, lifecycleKey) {
    const option = base && base.versions && base.versions.metal ? base.versions.metal[lifecycleKey] || {} : {};
    return {
      copperPrice: numberOr(option.copperPrice, numberOr(base && base.copperPrice, 0)),
      aluminumPrice: numberOr(option.aluminumPrice, numberOr(base && base.aluminumPrice, 0)),
    };
  }

  function lifecycleMixBaseline(base, lifecycleKey) {
    const option = base && base.versions && base.versions.mix ? base.versions.mix[lifecycleKey] || {} : {};
    const source = Array.isArray(option.values) && option.values.length ? option.values : (base && base.baselineMix ? base.baselineMix : []);
    return normalizeMix(source);
  }

  function lifecycleLaborSnapshot(runtime, lifecycleKey) {
    if (lifecycleKey !== 'quote' && lifecycleKey !== 'fixed') return null;
    return runtime && runtime.laborValidation && runtime.laborValidation.versionSnapshots
      ? runtime.laborValidation.versionSnapshots[lifecycleKey] || null
      : null;
  }

  function lifecyclePackagingSnapshot(runtime, lifecycleKey) {
    if (lifecycleKey !== 'quote' && lifecycleKey !== 'fixed') return null;
    return runtime && runtime.packagingValidation && runtime.packagingValidation.versionSnapshots
      ? runtime.packagingValidation.versionSnapshots[lifecycleKey] || null
      : null;
  }

  function bomDraftMatches(draft, snapshotDraft) {
    if (!snapshotDraft) return true;
    const keys = [
      'bomWireDrawing',
      'bomWireEat',
      'bomWireHidden',
      'bomTapeDiameter',
      'bomTapeWidth',
      'bomTapeOverlap',
    ];
    return keys.every((key) => {
      if (snapshotDraft[key] === undefined || snapshotDraft[key] === null || snapshotDraft[key] === '') {
        return true;
      }
      return approxEqual(draft && draft[key], snapshotDraft[key], 1e-6);
    });
  }

  function resolveExactFinancialVersion(runtime, base, currentState, draft, bomSnapshot, connectorScenario) {
    const lifecycleKey = lifecycleVersionKey(currentState);
    if (lifecycleKey !== 'quote' && lifecycleKey !== 'fixed') {
      return null;
    }
    if (stateFinancialVersionKey('connector', currentState && currentState.connector) !== lifecycleKey) {
      return null;
    }
    if ((currentState && currentState.vave) !== 'none') {
      return null;
    }
    if (Number(connectorScenario && connectorScenario.overrideCount) > 0) {
      return null;
    }

    const financial = financialVersionData(runtime, lifecycleKey);
    if (!financial) {
      return null;
    }

    if (!arraysClose(draft && draft.volumes, financial.volumes || [], 1e-6)) {
      return null;
    }
    if (!arraysClose(draft && draft.asp, financial.asp || [], 1e-6)) {
      return null;
    }

    const metalBaseline = lifecycleMetalBaseline(base, lifecycleKey);
    if (!approxEqual(draft && draft.copperPrice, metalBaseline.copperPrice, 1e-6)) return null;
    if (!approxEqual(draft && draft.aluminumPrice, metalBaseline.aluminumPrice, 1e-6)) return null;
    if (!arraysClose(draft && draft.mix, lifecycleMixBaseline(base, lifecycleKey), 1e-6)) return null;

    const laborSnapshot = lifecycleLaborSnapshot(runtime, lifecycleKey);
    if (laborSnapshot) {
      if (!approxEqual(draft && draft.directHours, laborSnapshot.directHours, 1e-6)) return null;
      if (!approxEqual(draft && draft.directRate, laborSnapshot.directRate, 1e-6)) return null;
      if (!approxEqual(draft && draft.manufacturingHours, laborSnapshot.manufacturingHours, 1e-6)) return null;
      if (!approxEqual(draft && draft.manufacturingRate, laborSnapshot.manufacturingRate, 1e-6)) return null;
    }

    const packagingSnapshot = lifecyclePackagingSnapshot(runtime, lifecycleKey);
    if (packagingSnapshot) {
      if (!approxEqual(draft && draft.packInner, packagingSnapshot.packInner, 1e-6)) return null;
      if (!approxEqual(draft && draft.packFreight, packagingSnapshot.packFreight, 1e-6)) return null;
      if (!approxEqual(draft && draft.packWarehouse, packagingSnapshot.packWarehouse, 1e-6)) return null;
      if (!approxEqual(draft && draft.packOther, packagingSnapshot.packOther, 1e-6)) return null;
    }

    if (!bomDraftMatches(draft, bomSnapshot && bomSnapshot.snapshot ? bomSnapshot.snapshot.draft : null)) {
      return null;
    }

    return {
      key: lifecycleKey,
      financial,
    };
  }

  function quoteCompareBase(runtime, base) {
    const quoteFinancial = financialVersionData(runtime, 'quote');
    const revenuePerSet = numberOr(quoteFinancial && quoteFinancial.perSet && quoteFinancial.perSet.revenue, numberOr(base && base.baseRevenuePerSet, 0));
    const costPerSet = numberOr(quoteFinancial && quoteFinancial.perSet && quoteFinancial.perSet.cost, numberOr(base && base.baseCostPerSet, 0));
    return {
      revenuePerSet,
      costPerSet,
      profitPerSet: revenuePerSet - costPerSet,
      materialPerSet: numberOr(quoteFinancial && quoteFinancial.perSet && quoteFinancial.perSet.material, numberOr(base && base.baseMaterial, 0)),
      rndPerSet: numberOr(quoteFinancial && quoteFinancial.perSet && quoteFinancial.perSet.rnd, numberOr(base && base.baseRndPerSet, 0)),
      laborPerSet: numberOr(quoteFinancial && quoteFinancial.perSet && quoteFinancial.perSet.directLabor, 0) + numberOr(quoteFinancial && quoteFinancial.perSet && quoteFinancial.perSet.manufacturing, 0),
      packagingPerSet: numberOr(quoteFinancial && quoteFinancial.perSet && quoteFinancial.perSet.packaging, 0),
      equipmentPerSet: numberOr(quoteFinancial && quoteFinancial.perSet && quoteFinancial.perSet.equipment, 0),
    };
  }

  function buildCompareRows(baseRevenuePerSet, baseCostPerSet, basePaybackVolume, currentRevenuePerSet, totalVolume, totalRevenue, totalCost, totalProfit, margin, paybackVolume) {
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

  function buildExactFinancialModel(options) {
    const financial = options.exactFinancial.financial || {};
    const quoteBase = quoteCompareBase(options.runtime, options.base);
    const years = Array.isArray(financial.years) && financial.years.length ? financial.years : (options.base && options.base.years ? options.base.years : []);
    const annualRevenue = financial.annual && Array.isArray(financial.annual.revenue) ? financial.annual.revenue : [];
    const annualCost = financial.annual && Array.isArray(financial.annual.cost) ? financial.annual.cost : [];
    const annualProfit = financial.annual && Array.isArray(financial.annual.profit) ? financial.annual.profit : [];
    const annualMargin = financial.annual && Array.isArray(financial.annual.margin) ? financial.annual.margin : [];
    const annual = years.map((year, index) => {
      const volume = numberOr(financial.volumes && financial.volumes[index], 0);
      const asp = numberOr(financial.asp && financial.asp[index], volume ? numberOr(annualRevenue[index], 0) / volume : 0);
      const revenue = numberOr(annualRevenue[index], volume * asp);
      const cost = numberOr(annualCost[index], volume ? numberOr(financial.perSet && financial.perSet.cost, 0) * volume : 0);
      const profit = numberOr(annualProfit[index], revenue - cost);
      const margin = numberOr(annualMargin[index], revenue ? profit / revenue : 0);
      return { year, volume, asp, revenue, cost, profit, margin };
    });

    const totalVolume = numberOr(financial.totals && financial.totals.volume, annual.reduce((sum, row) => sum + row.volume, 0));
    const totalRevenue = numberOr(financial.totals && financial.totals.revenue, annual.reduce((sum, row) => sum + row.revenue, 0));
    const totalCost = numberOr(financial.totals && financial.totals.cost, annual.reduce((sum, row) => sum + row.cost, 0));
    const totalProfit = numberOr(financial.totals && financial.totals.profit, totalRevenue - totalCost);
    const margin = numberOr(financial.totals && financial.totals.margin, totalRevenue ? totalProfit / totalRevenue : 0);
    const material = numberOr(financial.perSet && financial.perSet.material, quoteBase.materialPerSet);
    const directLabor = numberOr(financial.perSet && financial.perSet.directLabor, 0);
    const manufacturing = numberOr(financial.perSet && financial.perSet.manufacturing, 0);
    const packaging = numberOr(financial.perSet && financial.perSet.packaging, 0);
    const equipment = numberOr(financial.perSet && financial.perSet.equipment, totalVolume ? numberOr(financial.totals && financial.totals.equipment, 0) / totalVolume : 0);
    const rnd = numberOr(financial.perSet && financial.perSet.rnd, quoteBase.rndPerSet);
    const operating = numberOr(financial.perSet && financial.perSet.cost, totalVolume ? totalCost / totalVolume : 0);
    const avgProfit = numberOr(financial.perSet && financial.perSet.profit, totalVolume ? totalProfit / totalVolume : 0);
    const capitalTotal = options.currentCapitalSnapshot.equipment + options.currentCapitalSnapshot.tooling + options.currentCapitalSnapshot.fixtures + options.currentCapitalSnapshot.rnd;
    const capitalPerSet = totalVolume ? capitalTotal / totalVolume : 0;
    const paybackVolume = avgProfit > 0 ? capitalTotal / avgProfit : Infinity;
    const quoteCapitalTotal = options.quoteCapitalSnapshot.equipment + options.quoteCapitalSnapshot.tooling + options.quoteCapitalSnapshot.fixtures + options.quoteCapitalSnapshot.rnd;
    const basePaybackVolume = quoteBase.profitPerSet > 0 ? quoteCapitalTotal / quoteBase.profitPerSet : Infinity;
    const avgAsp = annual.length ? annual.reduce((sum, row) => sum + row.asp, 0) / annual.length : 0;
    const bomSummary = summarizeBomChanges(options.bomChanges);
    bomSummary.configList = [...bomSummary.configs];
    bomSummary.configCount = bomSummary.configList.length;

    return {
      d: options.draft,
      bom: {
        ...options.bom,
        factor: quoteBase.materialPerSet ? material / quoteBase.materialPerSet : options.bom.factor,
        sourceKind: options.bomSnapshot.kind,
        snapshot: options.bomSnapshot.snapshot,
      },
      metal: options.metal,
      conn: {
        ...options.conn,
        effectiveFactor: options.connectorScenario.factor || options.conn.factor,
        defaultKey: options.currentState.connector,
        overrideCount: options.connectorScenario.overrideCount,
        followCount: options.connectorScenario.followCount,
      },
      labor: {
        ...options.labor,
        factor: quoteBase.laborPerSet ? (directLabor + manufacturing) / quoteBase.laborPerSet : options.labor.factor,
      },
      equip: {
        ...options.equip,
        factor: quoteBase.equipmentPerSet ? equipment / quoteBase.equipmentPerSet : options.equip.factor,
      },
      pack: {
        ...options.pack,
        factor: quoteBase.packagingPerSet ? packaging / quoteBase.packagingPerSet : options.pack.factor,
      },
      sales: options.sales,
      mix: options.mix,
      annualDrop: {
        ...options.annualDrop,
        annualRate: 0,
      },
      oneTimeCustomer: {
        ...options.oneTimeCustomer,
        amountTotal: 0,
        amountPerSet: 0,
      },
      rebate: {
        ...options.rebate,
        amountPerSet: 0,
      },
      vave: options.vave,
      connectorItems: options.connectorScenario.items,
      connectorSummary: {
        ...options.connectorScenario,
        defaultKey: options.currentState.connector,
        defaultLabel: options.conn.label,
      },
      bomCalc: { ...options.wireCalc },
      bomSummary,
      mixPrice: options.mixPrice,
      mixCost: options.mixCost,
      material,
      directLabor,
      manufacturing,
      packaging,
      equipment,
      rnd,
      operating,
      annual,
      totalVolume,
      totalRevenue,
      totalCost,
      totalProfit,
      margin,
      avgProfit,
      capitalTotal,
      capitalPerSet,
      capitalBreakdown: {
        equipment: options.currentCapitalSnapshot.equipment,
        tooling: options.currentCapitalSnapshot.tooling,
        fixtures: options.currentCapitalSnapshot.fixtures,
        rnd: options.currentCapitalSnapshot.rnd,
      },
      paybackVolume,
      paybackYears: totalProfit > 0 && annual.length ? capitalTotal / (totalProfit / annual.length) : Infinity,
      compare: buildCompareRows(
        quoteBase.revenuePerSet,
        quoteBase.costPerSet,
        basePaybackVolume,
        avgAsp,
        totalVolume,
        totalRevenue,
        totalCost,
        totalProfit,
        margin,
        paybackVolume
      ),
      currentMix: options.draft.mix,
      stateSnapshot: { ...options.currentState },
      dataLayer: 'JSON 数据层 + financialVersions',
      engineLayer: '计算引擎 (financial exact)',
      exactFinancialVersionKey: options.exactFinancial.key,
    };
  }

  // [DI] ctx parameter added — auto-created from globals if omitted (backward compatible)
  function computeModel(runtime, draft, state, ctx) {
    var EC = global.G281EngineContext;
    if (!ctx) ctx = EC ? EC.create() : {};

    const BASE = runtime.master;
    const bomChanges = runtime.bomChanges || [];
    // [DI] EC.stateDefaults(ctx) replaces global.ConfigBridge.stateDefaults()
    const sd = EC ? EC.stateDefaults(ctx)
      : { bom: 'freeze', metal: 'quote', connector: 'quote', labor: 'base',
          equipment: 'base', packaging: 'base', sales: 'quote', mix: 'quote',
          annualDrop: 'quote', oneTimeCustomer: 'quote', rebate: 'quote', vave: 'none' };
    const currentState = {
      bom: state && state.bom ? state.bom : sd.bom,
      metal: state && state.metal ? state.metal : sd.metal,
      connector: state && state.connector && BASE.versions.connector[state.connector] ? state.connector : sd.connector,
      labor: state && state.labor ? state.labor : sd.labor,
      equipment: state && state.equipment ? state.equipment : sd.equipment,
      packaging: state && state.packaging ? state.packaging : sd.packaging,
      sales: state && state.sales ? state.sales : sd.sales,
      mix: state && state.mix ? state.mix : sd.mix,
      annualDrop: state && state.annualDrop ? state.annualDrop : sd.annualDrop,
      oneTimeCustomer: state && state.oneTimeCustomer ? state.oneTimeCustomer : sd.oneTimeCustomer,
      rebate: state && state.rebate ? state.rebate : sd.rebate,
      vave: state && state.vave ? state.vave : sd.vave,
    };

    const d = {
      scenarioName: (draft && draft.scenarioName ? String(draft.scenarioName) : BASE.name).trim() || BASE.name,
      copperPrice: Number(draft && draft.copperPrice) || 0,
      aluminumPrice: Number(draft && draft.aluminumPrice) || 0,
      directHours: Number(draft && draft.directHours) || 0,
      directRate: Number(draft && draft.directRate) || 0,
      manufacturingHours: Number(draft && draft.manufacturingHours) || 0,
      manufacturingRate: Number(draft && draft.manufacturingRate) || 0,
      packInner: Number(draft && draft.packInner) || 0,
      packFreight: Number(draft && draft.packFreight) || 0,
      packWarehouse: Number(draft && draft.packWarehouse) || 0,
      packOther: Number(draft && draft.packOther) || 0,
      bomWireDrawing: Number(draft && draft.bomWireDrawing) || 0,
      bomWireEat: Number(draft && draft.bomWireEat) || 0,
      bomWireHidden: Number(draft && draft.bomWireHidden) || 0,
      bomTapeDiameter: Number(draft && draft.bomTapeDiameter) || 0,
      bomTapeWidth: Number(draft && draft.bomTapeWidth) || 0,
      bomTapeOverlap: Number(draft && draft.bomTapeOverlap) || 0,
      mix: normalizeMix((draft && draft.mix) || BASE.baselineMix),
      volumes: Array.isArray(draft && draft.volumes) ? draft.volumes.map((value) => Math.max(0, Number(value) || 0)) : BASE.volumes.slice(),
      asp: Array.isArray(draft && draft.asp) ? draft.asp.map((value) => Number(value) || 0) : BASE.asp.slice(),
      connectorPricing: draft && draft.connectorPricing ? { ...draft.connectorPricing } : {},
    };

    const bomOption = BASE.versions?.bom?.[currentState.bom];
    const metal = BASE.versions?.metal?.[currentState.metal];
    const conn = BASE.versions?.connector?.[currentState.connector]
      || BASE.versions?.connector?.quote
      || BASE.versions?.connector?.fixed
      || { label: currentState.connector || '', factor: 1, note: '' };
    const laborOption = BASE.versions?.labor?.[currentState.labor];
    const equipOption = BASE.versions?.equipment?.[currentState.equipment];
    const packOption = BASE.versions?.packaging?.[currentState.packaging];
    const sales = BASE.versions?.sales?.[currentState.sales];
    const mix = BASE.versions?.mix?.[currentState.mix];
    const annualDropOption = BASE.versions.annualDrop?.[currentState.annualDrop] || { label: currentState.annualDrop, annualRate: 0 };
    const oneTimeCustomerOption = BASE.versions.oneTimeCustomer?.[currentState.oneTimeCustomer] || { label: currentState.oneTimeCustomer, amountTotal: 0 };
    const rebateOption = BASE.versions.rebate?.[currentState.rebate] || { label: currentState.rebate, amountPerSet: 0 };
    const vave = BASE.versions.vave[currentState.vave];
    const lifecycleYearSeries = lifecycleYears(BASE);
    const lifecycleVolumeSeries = d.volumes.map((value) => Math.max(0, numberOr(value, 0)));
    const annualDrop = normalizeAnnualDropVersion(annualDropOption, lifecycleYearSeries);
    const oneTimeCustomer = normalizeOneTimeCustomerVersion(oneTimeCustomerOption, lifecycleYearSeries, lifecycleVolumeSeries);
    const rebate = normalizeRebateVersion(rebateOption, lifecycleYearSeries, lifecycleVolumeSeries);
    // [DI] pass ctx to buildConnectorScenario
    const connectorScenario = buildConnectorScenario(BASE, BASE.versions.connector, currentState.connector, d.connectorPricing, runtime.connectorProtocolStatus || null, ctx);
    const lifecycleVolume = lifecycleVolumeSeries.reduce((sum, value) => sum + value, 0);
    const bomSnapshot = bomVersionSnapshot(runtime, BASE, currentState.bom);
    const quoteBase = quoteCompareBase(runtime, BASE);
    const quoteLaborSnapshot = runtime && runtime.laborValidation && runtime.laborValidation.versionSnapshots ? runtime.laborValidation.versionSnapshots.quote : null;
    const quotePackagingSnapshot = runtime && runtime.packagingValidation && runtime.packagingValidation.versionSnapshots ? runtime.packagingValidation.versionSnapshots.quote : null;
    const currentCapitalSnapshot = capitalVersionSnapshot(runtime, BASE, currentState.equipment);
    const quoteCapitalSnapshot = capitalVersionSnapshot(runtime, BASE, 'base');

    const wireQuoteMm = d.bomWireDrawing + d.bomWireEat + d.bomWireHidden;
    const wireQuoteM = wireQuoteMm / 1000;
    const wireHiddenRate = wireQuoteMm ? d.bomWireHidden / wireQuoteMm : 0;
    const tapeOverlap = clamp(d.bomTapeOverlap, 0, 95) / 100;
    const tapePitch = d.bomTapeWidth * (1 - tapeOverlap);
    const tapeCircumference = Math.PI * d.bomTapeDiameter;
    const tapePerMm = tapePitch > 0 ? Math.sqrt(tapeCircumference * tapeCircumference + tapePitch * tapePitch) / tapePitch : 0;
    const tapeLengthMm = wireQuoteMm * tapePerMm;
    const tapeLengthM = tapeLengthMm / 1000;
    const tapeTurns = tapePitch > 0 ? wireQuoteMm / tapePitch : 0;

    const mixPrice = weighted(BASE.baselineMix, BASE.priceMixIndexes) > 0 ? weighted(d.mix, BASE.priceMixIndexes) / weighted(BASE.baselineMix, BASE.priceMixIndexes) : 1;
    const mixCost = weighted(BASE.baselineMix, BASE.costMixIndexes) > 0 ? weighted(d.mix, BASE.costMixIndexes) / weighted(BASE.baselineMix, BASE.costMixIndexes) : 1;
    // [DI] EC.metalSensitivity(ctx) replaces global.ConfigBridge.metalSensitivity()
    const ms = EC ? EC.metalSensitivity(ctx)
      : { copper: 0.65, aluminum: 0.45 };
    const copperFactor = BASE.copperPrice > 0 ? 1 + ((d.copperPrice - BASE.copperPrice) / BASE.copperPrice) * ms.copper : 1;
    const aluminumFactor = BASE.aluminumPrice > 0 ? 1 + ((d.aluminumPrice - BASE.aluminumPrice) / BASE.aluminumPrice) * ms.aluminum : 1;
    const connectorFactor = connectorScenario.factor || conn.factor;
    const laborBaselinePerSet = quoteLaborSnapshot
      ? (Number(quoteLaborSnapshot.directLaborPerSet) || 0) + (Number(quoteLaborSnapshot.manufacturingPerSet) || 0)
      : (Number(BASE.baseDirectHours) || 0) * (Number(BASE.baseDirectRate) || 0) + (Number(BASE.baseMfgHours) || 0) * (Number(BASE.baseMfgRate) || 0);
    const packagingBaselinePerSet = Number(quotePackagingSnapshot && quotePackagingSnapshot.packTotal) || Number(BASE.basePackagingPerSet) || 0;
    const currentLaborPerSet = d.directHours * d.directRate + d.manufacturingHours * d.manufacturingRate;
    const currentPackagingPerSet = d.packInner + d.packFreight + d.packWarehouse + d.packOther;
    const annualDropRate = Math.max(0, numberOr(annualDrop.annualRate, 0));
    const oneTimeCustomerAmountTotal = Math.max(0, numberOr(oneTimeCustomer.amountTotal, 0));
    const rebateAmountTotal = Math.max(0, numberOr(rebate.amountTotal, 0));
    const rebateAmountPerSet = Math.max(0, numberOr(rebate.amountPerSet, 0));
    const oneTimeCustomerPerSet = lifecycleVolume ? numberOr(oneTimeCustomer.recognizedTotal, 0) / lifecycleVolume : 0;
    const directLabor = d.directHours * d.directRate;
    const manufacturing = d.manufacturingHours * d.manufacturingRate;
    const packaging = currentPackagingPerSet;
    const equipment = lifecycleVolume ? currentCapitalSnapshot.equipment / lifecycleVolume : 0;
    const labor = {
      ...laborOption,
      factor: laborBaselinePerSet ? currentLaborPerSet / laborBaselinePerSet : 1,
    };
    const pack = {
      ...packOption,
      factor: packagingBaselinePerSet ? currentPackagingPerSet / packagingBaselinePerSet : 1,
    };
    const bom = {
      ...bomOption,
      factor: bomSnapshot.factor,
      sourceKind: bomSnapshot.kind,
      snapshot: bomSnapshot.snapshot,
    };
    const equip = {
      ...equipOption,
      factor: quoteCapitalSnapshot.equipment ? currentCapitalSnapshot.equipment / quoteCapitalSnapshot.equipment : 1,
    };
    const exactFinancial = hasLifecycleBusinessEffect({ annualDrop, oneTimeCustomer, rebate })
      ? null
      : resolveExactFinancialVersion(runtime, BASE, currentState, d, bomSnapshot, connectorScenario);
    if (exactFinancial) {
      return buildExactFinancialModel({
        runtime,
        base: BASE,
        currentState,
        draft: d,
        bom,
        metal,
        conn,
        labor,
        equip,
        pack,
        sales,
        mix,
        annualDrop,
        oneTimeCustomer,
        rebate,
        vave,
        connectorScenario,
        bomSnapshot,
        currentCapitalSnapshot,
        quoteCapitalSnapshot,
        mixPrice,
        mixCost,
        wireCalc: {
          wireQuoteMm,
          wireQuoteM,
          wireHiddenRate,
          tapeOverlap,
          tapePitch,
          tapeCircumference,
          tapePerMm,
          tapeLengthMm,
          tapeLengthM,
          tapeTurns,
        },
        bomChanges,
        exactFinancial,
      });
    }

    // [DI] EC.materialComposition(ctx) replaces global.ConfigBridge.materialComposition()
    // ── 估算路径 (Fallback Path) ──
    // 当无种子数据 (seed data) 时，使用系数近似逻辑进行降级估算。
    const mc = EC ? EC.materialComposition(ctx)
      : { connector: 0.24, copper: 0.38, aluminum: 0.18, other: 0.20 };
    const matBase = quoteBase.materialPerSet * (
      mc.connector * connectorFactor +
      mc.copper * copperFactor +
      mc.aluminum * aluminumFactor +
      mc.other
    );
    const material = matBase * bom.factor;
    const rnd = quoteBase.rndPerSet;
    const operating = (material + directLabor + manufacturing + packaging) * mixCost + equipment + rnd - vave.savings;

    const annual = lifecycleYearSeries.map((year, index) => {
      const volume = lifecycleVolumeSeries[index];
      const aspBase = d.asp[index] * mixPrice;
      const annualDropFactor = numberOr(annualDrop.yearRows?.[index]?.factor, 1);
      const rebatePerSet = numberOr(rebate.yearRows?.[index]?.amountPerSet, 0);
      const oneTimeRevenue = numberOr(oneTimeCustomer.revenueByYear?.[index], 0);
      const asp = Math.max(0, aspBase * annualDropFactor - rebatePerSet);
      const revenue = volume * asp + oneTimeRevenue;
      const cost = volume * operating;
      const profit = revenue - cost;
      const margin = revenue ? profit / revenue : 0;
      return { year, volume, asp, revenue, cost, profit, margin, annualDropFactor, rebatePerSet, oneTimeRevenue };
    });

    const totalVolume = annual.reduce((sum, row) => sum + row.volume, 0);
    const totalRevenue = annual.reduce((sum, row) => sum + row.revenue, 0);
    const totalCost = annual.reduce((sum, row) => sum + row.cost, 0);
    const totalProfit = totalRevenue - totalCost;
    const margin = totalRevenue ? totalProfit / totalRevenue : 0;
    const avgProfit = totalVolume ? totalProfit / totalVolume : 0;
    const capitalTotal = currentCapitalSnapshot.equipment + currentCapitalSnapshot.tooling + currentCapitalSnapshot.fixtures + currentCapitalSnapshot.rnd;
    const capitalPerSet = totalVolume ? capitalTotal / totalVolume : 0;
    const paybackVolume = avgProfit > 0 ? capitalTotal / avgProfit : Infinity;
    const paybackYears = totalProfit > 0 ? capitalTotal / (totalProfit / annual.length) : Infinity;
    const baseCapitalTotal = quoteCapitalSnapshot.equipment + quoteCapitalSnapshot.tooling + quoteCapitalSnapshot.fixtures + quoteCapitalSnapshot.rnd;
    const basePaybackVolume = (BASE.baseRevenuePerSet - BASE.baseCostPerSet) > 0 ? baseCapitalTotal / (BASE.baseRevenuePerSet - BASE.baseCostPerSet) : Infinity;
    const avgAsp = annual.reduce((sum, row) => sum + row.asp, 0) / annual.length;
    const bomSummary = summarizeBomChanges(bomChanges);
    bomSummary.configList = [...bomSummary.configs];
    bomSummary.configCount = bomSummary.configList.length;
    const compare = [
      ['单套收入', BASE.baseRevenuePerSet, avgAsp],
      ['单套成本', BASE.baseCostPerSet, operating],
      ['单套利润', BASE.baseRevenuePerSet - BASE.baseCostPerSet, avgAsp - operating],
      ['生命周期收入', BASE.baseRevenuePerSet * totalVolume, totalRevenue],
      ['生命周期成本', BASE.baseCostPerSet * totalVolume, totalCost],
      ['生命周期利润', (BASE.baseRevenuePerSet - BASE.baseCostPerSet) * totalVolume, totalProfit],
      ['毛利率', (BASE.baseRevenuePerSet - BASE.baseCostPerSet) / BASE.baseRevenuePerSet, margin],
      ['回收销量', basePaybackVolume, paybackVolume],
    ];

    return {
      d,
      bom,
      metal,
      conn: {
        ...conn,
        effectiveFactor: connectorFactor,
        defaultKey: currentState.connector,
        overrideCount: connectorScenario.overrideCount,
        followCount: connectorScenario.followCount,
      },
      labor,
      equip,
      pack,
      sales,
      mix,
      annualDrop: {
        ...annualDrop,
        annualRate: annualDropRate,
      },
      oneTimeCustomer: {
        ...oneTimeCustomer,
        amountTotal: oneTimeCustomerAmountTotal,
        amountPerSet: oneTimeCustomerPerSet,
      },
      rebate: {
        ...rebate,
        amountTotal: rebateAmountTotal,
        amountPerSet: rebateAmountPerSet,
      },
      vave,
      connectorItems: connectorScenario.items,
      connectorSummary: {
        ...connectorScenario,
        defaultKey: currentState.connector,
        defaultLabel: conn.label,
      },
      bomCalc: {
        wireQuoteMm,
        wireQuoteM,
        wireHiddenRate,
        tapeOverlap,
        tapePitch,
        tapeCircumference,
        tapePerMm,
        tapeLengthMm,
        tapeLengthM,
        tapeTurns,
      },
      bomSummary,
      mixPrice,
      mixCost,
      material,
      directLabor,
      manufacturing,
      packaging,
      equipment,
      rnd,
      operating,
      annual,
      totalVolume,
      totalRevenue,
      totalCost,
      totalProfit,
      margin,
      avgProfit,
      capitalTotal,
      capitalPerSet,
      capitalBreakdown: {
        equipment: currentCapitalSnapshot.equipment,
        tooling: currentCapitalSnapshot.tooling,
        fixtures: currentCapitalSnapshot.fixtures,
        rnd: currentCapitalSnapshot.rnd,
      },
      paybackVolume,
      paybackYears,
      compare,
      currentMix: d.mix,
      stateSnapshot: { ...currentState },
      dataLayer: 'JSON 数据层',
      engineLayer: '计算引擎',
    };
  }

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

  // [DI] ctx parameter added as first argument
  /** @deprecated Legacy breakdown - superseded by harness_costing.js (harnessDetail) */
  function attachHarnessProfit(ctx, runtime, model, versionKey) {
    var hp = ctx && ctx.harnessProfit;
    if (!hp || typeof hp.buildHarnessProfitBreakdown !== 'function') {
      return null;
    }
    return hp.buildHarnessProfitBreakdown(runtime, model, {
      versionKey: versionKey || stateFinancialVersionKey('bom', model && model.stateSnapshot && model.stateSnapshot.bom) || 'quote',
    });
  }

  // [DI] ctx parameter added — auto-created from globals if omitted (backward compatible)
  function computeModelV2(runtime, draft, state, ctx) {
    var EC = global.G281EngineContext;
    if (!ctx) ctx = EC ? EC.create() : {};

    // [DI] pass ctx to computeModel
    const legacyModel = computeModel(runtime, draft, state, ctx);
    const currentState = legacyModel.stateSnapshot || {};
    const exactFinancialKey = resolvePureFinancialVersionKey(currentState, legacyModel.d || {});
    const exactFinancialVersion = hasLifecycleBusinessEffect(legacyModel) ? null : financialVersion(runtime, exactFinancialKey);
    const referenceFinancialKey = exactFinancialVersion ? exactFinancialKey : resolveReferenceFinancialVersionKey(currentState);
    const referenceFinancial = financialVersion(runtime, referenceFinancialKey);
    const financialWarnings = exactFinancialVersion
      ? detectFinancialDriftWarnings(runtime, runtime.master, exactFinancialKey, legacyModel.d || {})
      : [];
    const result = {
      ...legacyModel,
      financialContext: {
        exactApplied: Boolean(exactFinancialVersion),
        exactKey: exactFinancialKey || '',
        exactLabel: exactFinancialVersion ? exactFinancialVersion.label || exactFinancialKey : '',
        referenceKey: referenceFinancialKey || '',
        referenceLabel: referenceFinancial ? referenceFinancial.label || referenceFinancialKey : '',
        availableKeys: Object.keys(financialVersionEntries(runtime)),
        warnings: clonePlain(financialWarnings, []),
      },
      harnessProfit: null,
    };

    if (exactFinancialVersion) {
      const effectiveDraft = effectiveDraftForFinancial(runtime, runtime.master, legacyModel.d || {}, exactFinancialKey);
      const annual = buildAnnualRowsFromFinancial(exactFinancialVersion, runtime.master && runtime.master.years);
      const totalVolume = numberOr(exactFinancialVersion.totals && exactFinancialVersion.totals.volume, annual.reduce((sum, row) => sum + numberOr(row.volume, 0), 0));
      const totalRevenue = numberOr(exactFinancialVersion.totals && exactFinancialVersion.totals.revenue, annual.reduce((sum, row) => sum + numberOr(row.revenue, 0), 0));
      const totalCost = numberOr(exactFinancialVersion.totals && exactFinancialVersion.totals.cost, annual.reduce((sum, row) => sum + numberOr(row.cost, 0), 0));
      const totalProfit = numberOr(exactFinancialVersion.totals && exactFinancialVersion.totals.profit, totalRevenue - totalCost);
      const margin = numberOr(exactFinancialVersion.totals && exactFinancialVersion.totals.margin, totalRevenue ? totalProfit / totalRevenue : 0);
      const avgProfit = numberOr(exactFinancialVersion.perSet && exactFinancialVersion.perSet.profit, totalVolume ? totalProfit / totalVolume : 0);
      const material = numberOr(exactFinancialVersion.perSet && exactFinancialVersion.perSet.material, legacyModel.material);
      const directLabor = numberOr(exactFinancialVersion.perSet && exactFinancialVersion.perSet.directLabor, legacyModel.directLabor);
      const manufacturing = numberOr(exactFinancialVersion.perSet && exactFinancialVersion.perSet.manufacturing, legacyModel.manufacturing);
      const packaging = numberOr(exactFinancialVersion.perSet && exactFinancialVersion.perSet.packaging, legacyModel.packaging);
      const equipment = numberOr(exactFinancialVersion.perSet && exactFinancialVersion.perSet.equipment, legacyModel.equipment);
      const rnd = numberOr(exactFinancialVersion.perSet && exactFinancialVersion.perSet.rnd, legacyModel.rnd);
      const operating = numberOr(exactFinancialVersion.perSet && exactFinancialVersion.perSet.cost, legacyModel.operating);
      const capitalTotal = numberOr(legacyModel.capitalTotal, 0);
      const capitalPerSet = totalVolume ? capitalTotal / totalVolume : 0;
      const paybackVolume = avgProfit > 0 ? capitalTotal / avgProfit : Infinity;
      const paybackYears = totalProfit > 0 && annual.length ? capitalTotal / (totalProfit / annual.length) : Infinity;
      const referenceCapitalSnapshot = exactFinancialKey === 'fixed'
        ? capitalVersionSnapshot(runtime, runtime.master, 'shared')
        : capitalVersionSnapshot(runtime, runtime.master, 'base');
      const referenceCapitalTotal = numberOr(referenceCapitalSnapshot.equipment, 0)
        + numberOr(referenceCapitalSnapshot.tooling, 0)
        + numberOr(referenceCapitalSnapshot.fixtures, 0)
        + numberOr(referenceCapitalSnapshot.rnd, 0);
      const referenceUnitRevenue = numberOr(exactFinancialVersion.perSet && exactFinancialVersion.perSet.revenue, legacyModel.totalVolume ? legacyModel.totalRevenue / legacyModel.totalVolume : 0);
      const referenceUnitCost = numberOr(exactFinancialVersion.perSet && exactFinancialVersion.perSet.cost, legacyModel.operating);
      const referenceUnitProfit = numberOr(exactFinancialVersion.perSet && exactFinancialVersion.perSet.profit, referenceUnitRevenue - referenceUnitCost);
      const referenceMargin = numberOr(exactFinancialVersion.perSet && exactFinancialVersion.perSet.margin, referenceUnitRevenue ? referenceUnitProfit / referenceUnitRevenue : 0);
      const basePaybackVolume = referenceUnitProfit > 0 ? referenceCapitalTotal / referenceUnitProfit : Infinity;
      const unitRevenue = totalVolume ? totalRevenue / totalVolume : 0;
      result.d = effectiveDraft;
      result.material = material;
      result.directLabor = directLabor;
      result.manufacturing = manufacturing;
      result.packaging = packaging;
      result.equipment = equipment;
      result.rnd = rnd;
      result.operating = operating;
      result.annual = annual;
      result.totalVolume = totalVolume;
      result.totalRevenue = totalRevenue;
      result.totalCost = totalCost;
      result.totalProfit = totalProfit;
      result.margin = margin;
      result.avgProfit = avgProfit;
      result.capitalPerSet = capitalPerSet;
      result.paybackVolume = paybackVolume;
      result.paybackYears = paybackYears;
      result.compare = [
        ['单套收入', referenceUnitRevenue, unitRevenue],
        ['单套成本', referenceUnitCost, operating],
        ['单套利润', referenceUnitProfit, avgProfit],
        ['生命周期收入', referenceUnitRevenue * totalVolume, totalRevenue],
        ['生命周期成本', referenceUnitCost * totalVolume, totalCost],
        ['生命周期利润', referenceUnitProfit * totalVolume, totalProfit],
        ['毛利率', referenceMargin, margin],
        ['回收销量', basePaybackVolume, paybackVolume],
      ];
      result.dataLayer = 'financialVersions + runtime JSON';
      result.engineLayer = 'financial exact engine';
    }

    const annualRows = exactFinancialVersion ? result.annual : enrichComputedAnnualRows(result);
    const unitRevenue = numberOr(result.totalVolume, 0) ? numberOr(result.totalRevenue, 0) / numberOr(result.totalVolume, 1) : 0;
    result.portfolioSummary = buildPortfolioSummary(
      exactFinancialVersion ? 'financial_exact' : 'computed',
      exactFinancialVersion ? exactFinancialKey : referenceFinancialKey,
      exactFinancialVersion
        ? (exactFinancialVersion.label || exactFinancialKey)
        : (referenceFinancial ? referenceFinancial.label || referenceFinancialKey : ''),
      financialWarnings,
      {
        revenue: unitRevenue,
        cost: numberOr(result.operating, 0),
        profit: numberOr(result.avgProfit, 0),
        margin: numberOr(result.margin, 0),
        material: numberOr(result.material, 0),
        directLabor: numberOr(result.directLabor, 0),
        manufacturing: numberOr(result.manufacturing, 0),
        packaging: numberOr(result.packaging, 0),
        equipment: numberOr(result.equipment, 0),
        rnd: numberOr(result.rnd, 0),
        totalVolume: numberOr(result.totalVolume, 0),
        totalRevenue: numberOr(result.totalRevenue, 0),
        totalCost: numberOr(result.totalCost, 0),
        totalProfit: numberOr(result.totalProfit, 0),
      },
      annualRows,
    );

    // ── 单线束号级精算路径 (v2) ──
    // 当 G281HarnessCosting 可用且有 harness seed 数据时，
    // 用自底向上的逐零件号核算替代系数近似
    result.harnessDetail = null;
    try {
      // [DI] ctx.harnessCosting replaces global.G281HarnessCosting
      var HarnessCosting = ctx && ctx.harnessCosting;
      var harnessData = resolveHarnessData(runtime);
      if (HarnessCosting && harnessData && harnessData.length > 0) {
        // [DI] EC.projectConfig(ctx, runtime) replaces global.ConfigBridge.raw()
        var costRates = EC ? EC.projectConfig(ctx, runtime)
          : ((runtime && runtime.projectConfig) || {});
        var customerRates = (costRates.costRates && costRates.costRates.customer) || costRates.costRates || {};
        var internalRates = costRates.internalRates || {};
        var baseFactory = resolveBaseFactory(runtime, costRates);
        var factoryCostRates = baseFactory && baseFactory.costRates ? baseFactory.costRates : {};
        var laborSnapshots = runtime && runtime.laborValidation && runtime.laborValidation.versionSnapshots
          ? runtime.laborValidation.versionSnapshots
          : null;
        var runtimeLaborSnapshot = laborSnapshots && (laborSnapshots.quote || laborSnapshots.fixed || laborSnapshots.baseline)
          ? (laborSnapshots.quote || laborSnapshots.fixed || laborSnapshots.baseline)
          : null;
        var fallbackLaborRate = Number(factoryCostRates.laborRate) > 0
          ? numberOr(factoryCostRates.laborRate, 35)
          : numberOr(customerRates.laborRate, numberOr(internalRates.laborRate, 35));
        var fallbackMfgRate = Number(factoryCostRates.mfgRate) > 0
          ? numberOr(factoryCostRates.mfgRate, 46.69)
          : numberOr(
            customerRates.mfgRate,
            numberOr(customerRates.manufacturingRate, numberOr(internalRates.factoryRate, numberOr(internalRates.otherOverheadRate, 46.69)))
          );
        var harnessParams = {
          laborRate: runtimeLaborSnapshot && runtimeLaborSnapshot.directRate != null
            ? numberOr(runtimeLaborSnapshot.directRate, fallbackLaborRate)
            : fallbackLaborRate,
          mfgRate: runtimeLaborSnapshot && runtimeLaborSnapshot.manufacturingRate != null
            ? numberOr(runtimeLaborSnapshot.manufacturingRate, fallbackMfgRate)
            : fallbackMfgRate,
          wasteRate: numberOr(factoryCostRates.wasteRate, numberOr(customerRates.wasteRate, numberOr(internalRates.materialWasteRate, 0.01))),
          mgmtRate: numberOr(factoryCostRates.mgmtRate, numberOr(customerRates.mgmtRate, 0.06)),
          profitRate: numberOr(factoryCostRates.profitRate, numberOr(customerRates.profitRate, 0.056627)),
          factoryId: baseFactory && baseFactory.factoryId ? baseFactory.factoryId : '',
          factoryName: baseFactory && baseFactory.factoryName ? baseFactory.factoryName : '',
        };

        // 金属价格: 优先用当前模型的金属价格(可能已被用户调整)
        if (result.metal) {
          harnessParams.metalPrices = {
            copper: numberOr(result.metal.copperPrice, 68400),
            aluminum: numberOr(result.metal.aluminumPrice, 18200),
          };
        }

        var harnessResult = HarnessCosting.computeHarnessesFromSeedData(harnessData, harnessParams);
        if (harnessResult && harnessResult.project) {
          var proj = harnessResult.project;
          // 用线束级汇总覆盖系数近似值 (仅在非exact路径时)
          if (!exactFinancialVersion) {
            result.material = proj.weightedMaterial;
            result.directLabor = proj.weightedLabor;
            result.manufacturing = proj.weightedMfg;
            result.packaging = proj.weightedPack;
            // 重算 operating
            var newOperating = proj.vehicleCost
              + numberOr(result.equipment, 0)
              + numberOr(result.rnd, 0)
              - numberOr(result.vave && result.vave.savings, 0);
            result.operating = newOperating;
            result.dataLayer = '线束级种子数据 + runtime JSON';
            result.engineLayer = '单线束号级精算引擎 (harness_costing v1)';
          }
          // 始终附加线束级明细
          result.harnessDetail = {
            harnesses: harnessResult.harnesses,
            project: proj,
            table: HarnessCosting.buildHarnessCostTable(harnessResult.harnesses),
            params: harnessParams,
            source: 'harness_costing_v2',
          };
        }
      }
    } catch (hcError) {
      result.harnessDetail = null;
      result.financialContext.warnings.push(
        '线束级精算引擎异常: ' + (hcError && hcError.message ? hcError.message : String(hcError))
      );
    }

    // Legacy: 仅在无 harnessDetail 时回退到旧模块
    try {
      if (!result.harnessDetail) {
        // [DI] pass ctx to attachHarnessProfit
        result.harnessProfit = attachHarnessProfit(ctx, runtime, result, referenceFinancialKey || exactFinancialKey);
      } else {
        result.harnessProfit = null;
      }
    } catch (error) {
      result.harnessProfit = null;
      result.financialContext.warnings.push('线束利润拆解失败: ' + (error && error.message ? error.message : String(error)));
    }

    // [DI] EC.detectPath(ctx, result) replaces global.ComputationPath.detect()
    result.computationPath = EC ? EC.detectPath(ctx, result)
      : { path: 'unknown', label: '未知' };

    return result;
  }

  /**
   * resolveHarnessData — 查找可用的线束级数据
   * 数据源优先级:
   *   1. runtime.harnessSeedData (直接注入)
   *   2. runtime.master.harnessSeedData (master JSON中)
   *   3. null (无数据 → 回退到legacy)
   */
  function resolveHarnessData(runtime) {
    if (!runtime) return null;
    if (runtime.harnessSeedData && Array.isArray(runtime.harnessSeedData) && runtime.harnessSeedData.length > 0) {
      return runtime.harnessSeedData;
    }
    if (runtime.master && runtime.master.harnessSeedData && Array.isArray(runtime.master.harnessSeedData) && runtime.master.harnessSeedData.length > 0) {
      return runtime.master.harnessSeedData;
    }
    return null;
  }

  function resolveBaseFactory(runtime, costRates) {
    const projectFactories = runtime && runtime.projectConfig && Array.isArray(runtime.projectConfig.factories)
      ? runtime.projectConfig.factories
      : [];
    const masterFactories = runtime && runtime.master && runtime.master.projectConfig && Array.isArray(runtime.master.projectConfig.factories)
      ? runtime.master.projectConfig.factories
      : [];
    const factories = projectFactories.length ? projectFactories : masterFactories;
    if (!factories.length) return null;
    return factories.find((factory) => factory && factory.isBase) || factories[0] || null;
  }

  global.G281Engine = {
    clamp,
    weighted,
    normalizeMix,
    summarizeBomChanges,
    computeModel: computeModelV2,
    computeModelLegacy: computeModel,
    resolvePureFinancialVersionKey,
    resolveReferenceFinancialVersionKey,
  };
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : {});
