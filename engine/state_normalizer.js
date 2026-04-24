/**
 * engine/state_normalizer.js
 * Issue #9: 状态归一化 + 连接器场景构建 + 生命周期版本模板
 * 依赖: shared_utils.js
 */
(function (global) {
  'use strict';

  // P0#1: 防御性解构 — 提供内联 fallback
  const U = global.G281SharedUtils || {};
  const numberOr = U.numberOr || function (v, fb) { var n = Number(v); return Number.isFinite(n) ? n : fb; };
  const safeArray = U.safeArray || function (v) { return Array.isArray(v) ? v : []; };
  const clamp = U.clamp || function (v, lo, hi) { return Math.max(lo, Math.min(hi, v)); };
  const normalizeMix = U.normalizeMix || function (m) { return Array.isArray(m) ? m : []; };
  const FINANCIAL_VERSION_KEYS = U.FINANCIAL_VERSION_KEYS || [];
  const STATE_FINANCIAL_VERSION_MAP = U.STATE_FINANCIAL_VERSION_MAP || {};

  // ── 状态-财务版本映射 ─────────────────────
  function stateFinancialVersionKey(group, key) {
    return STATE_FINANCIAL_VERSION_MAP[group] && STATE_FINANCIAL_VERSION_MAP[group][key]
      ? STATE_FINANCIAL_VERSION_MAP[group][key] : '';
  }

  function resolvePureFinancialVersionKey(currentState, draft) {
    if (!currentState || currentState.vave !== 'none') return '';
    if (draft && draft.connectorPricing && Object.keys(draft.connectorPricing).length) return '';
    const groups = ['bom', 'metal', 'connector', 'sales', 'labor', 'equipment', 'packaging', 'mix'];
    let resolved = '';
    for (const group of groups) {
      const mapped = stateFinancialVersionKey(group, currentState[group]);
      if (!mapped) return '';
      if (!resolved) { resolved = mapped; continue; }
      if (resolved !== mapped) return '';
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
      'fixed', 'quote',
    ];
    return candidates.find((k) => FINANCIAL_VERSION_KEYS.has(k)) || '';
  }

  // ── 生命周期年度 ────────────────────────────
  function normalizeLifecycleYear(value, fallback) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }

  function lifecycleYears(base) {
    return safeArray(base && base.years)
      .map((y, i) => normalizeLifecycleYear(y, new Date().getFullYear() + i));
  }

  // ── 年降 ────────────────────────────────────
  function legacyAnnualDropRows(years, annualRate) {
    const rate = Math.max(0, numberOr(annualRate, 0));
    return safeArray(years).map((year, index) => {
      if (index === 0 || rate <= 0) return { year, rate: 0, note: index === 0 ? '基准年' : '' };
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
      rowMap.set(year, { year, rate: Math.max(0, numberOr(row && row.rate, 0)), note: row && row.note ? String(row.note) : '' });
    });
    if (!rowMap.size) {
      legacyAnnualDropRows(years, version && version.annualRate).forEach((r) => rowMap.set(r.year, r));
    }
    let factor = 1;
    const yearRows = safeArray(years).map((year, index) => {
      const fallback = { year, rate: 0, note: index === 0 ? '基准年' : '' };
      const baseRow = rowMap.get(year) || fallback;
      const rate = index === 0 ? 0 : Math.max(0, numberOr(baseRow.rate, 0));
      factor = index === 0 ? 1 : Math.max(0, factor * (1 - rate));
      return { year, rate, factor, note: baseRow.note || (index === 0 ? '基准年' : '') };
    });
    const annualRate = yearRows.find((r, i) => i > 0 && numberOr(r.rate, 0) > 0)?.rate
      ?? yearRows.find((r) => numberOr(r.rate, 0) > 0)?.rate ?? 0;
    return { ...(version || {}), yearRows, annualRate: Math.max(0, numberOr(annualRate, 0)) };
  }

  // ── 一次性客户收入 ───────────────────────
  function normalizeOneTimeCustomerEntries(version, years, volumes) {
    const firstYear = years[0] || new Date().getFullYear();
    const lifecycleVolume = safeArray(volumes).reduce((s, v) => s + Math.max(0, numberOr(v, 0)), 0);
    const entries = safeArray(version && version.entries).reduce((acc, entry, index) => {
      const amount = Math.max(0, numberOr(entry && entry.amount, 0));
      if (!amount) return acc;
      const modeText = String(entry && entry.mode ? entry.mode : '').toLowerCase();
      const mode = modeText.includes('direct') || String(entry && entry.mode ? entry.mode : '').includes('直接') ? 'direct' : 'allocate';
      acc.push({
        category: entry && entry.category ? String(entry.category) : `一次性${index + 1}`,
        mode, amount,
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
    return [{ category: '??', mode: 'allocate', amount: legacyAmount, recognitionYear: firstYear,
              allocationStartYear: firstYear, allocationVolume: lifecycleVolume, note: '一次性客户收入' }];
  }

  function normalizeOneTimeCustomerVersion(version, years, volumes) {
    const entries = normalizeOneTimeCustomerEntries(version, years, volumes);
    const totalVolume = safeArray(volumes).reduce((s, v) => s + Math.max(0, numberOr(v, 0)), 0);
    const firstYear = years[0] || new Date().getFullYear();
    const yearIndexMap = new Map(safeArray(years).map((y, i) => [y, i]));
    const revenueByYear = safeArray(years).map(() => 0);
    let directTotal = 0, allocateTotal = 0, unallocatedTotal = 0;
    entries.forEach((entry) => {
      const amount = Math.max(0, numberOr(entry && entry.amount, 0));
      if (!amount) return;
      if (entry.mode === 'direct') {
        const rYear = normalizeLifecycleYear(entry && entry.recognitionYear, firstYear);
        const yi = yearIndexMap.has(rYear) ? yearIndexMap.get(rYear) : 0;
        revenueByYear[yi] += amount;
        directTotal += amount;
        return;
      }
      allocateTotal += amount;
      let allocVol = Math.max(0, numberOr(entry && entry.allocationVolume, totalVolume));
      if (allocVol <= 0 || totalVolume <= 0) { unallocatedTotal += amount; return; }
      const unitAmount = amount / allocVol;
      const startYear = normalizeLifecycleYear(entry && entry.allocationStartYear, firstYear);
      const startIndex = yearIndexMap.has(startYear) ? yearIndexMap.get(startYear) : 0;
      for (let i = startIndex; i < years.length && allocVol > 1e-6; i += 1) {
        const yv = Math.max(0, numberOr(volumes[i], 0));
        if (!yv) continue;
        const av = Math.min(yv, allocVol);
        revenueByYear[i] += av * unitAmount;
        allocVol -= av;
      }
      if (allocVol > 1e-6) unallocatedTotal += allocVol * unitAmount;
    });
    const recognizedTotal = revenueByYear.reduce((s, v) => s + v, 0);
    return {
      ...(version || {}), entries,
      amountTotal: directTotal + allocateTotal,
      amountPerSet: totalVolume ? recognizedTotal / totalVolume : 0,
      directTotal, allocateTotal, recognizedTotal, unallocatedTotal, revenueByYear,
      yearRows: safeArray(years).map((year, i) => ({
        year, amountTotal: revenueByYear[i],
        perSet: numberOr(volumes[i], 0) > 0 ? revenueByYear[i] / numberOr(volumes[i], 1) : 0,
      })),
    };
  }

  // ── 返利 ────────────────────────────────────
  function normalizeRebateVersion(version, years, volumes) {
    const rowMap = new Map();
    safeArray(version && version.yearRows).forEach((row) => {
      const year = normalizeLifecycleYear(row && row.year, NaN);
      if (!Number.isFinite(year)) return;
      rowMap.set(year, { year, amountTotal: Math.max(0, numberOr(row && row.amountTotal, 0)), note: row && row.note ? String(row.note) : '' });
    });
    if (!rowMap.size) {
      const aps = Math.max(0, numberOr(version && version.amountPerSet, 0));
      safeArray(years).forEach((year, i) => {
        rowMap.set(year, { year, amountTotal: Math.max(0, numberOr(volumes[i], 0)) * aps, note: aps > 0 ? '返利' : '' });
      });
    }
    const yearRows = safeArray(years).map((year, i) => {
      const row = rowMap.get(year) || { year, amountTotal: 0, note: '' };
      const vol = Math.max(0, numberOr(volumes[i], 0));
      const at = Math.max(0, numberOr(row.amountTotal, 0));
      return { year, amountTotal: at, amountPerSet: vol > 0 ? at / vol : 0, note: row.note || '' };
    });
    const amountTotal = yearRows.reduce((s, r) => s + r.amountTotal, 0);
    const totalVolume = safeArray(volumes).reduce((s, v) => s + Math.max(0, numberOr(v, 0)), 0);
    const unallocatedTotal = yearRows.reduce((s, r, i) => s + (numberOr(volumes[i], 0) > 0 ? 0 : r.amountTotal), 0);
    return { ...(version || {}), yearRows, amountTotal, amountPerSet: totalVolume ? amountTotal / totalVolume : 0, unallocatedTotal };
  }

  function hasLifecycleBusinessEffect(model) {
    return safeArray(model && model.annualDrop && model.annualDrop.yearRows).some((r, i) => i > 0 && numberOr(r && r.rate, 0) > 0)
      || numberOr(model && model.oneTimeCustomer && model.oneTimeCustomer.amountTotal, 0) > 0
      || numberOr(model && model.rebate && model.rebate.amountTotal, 0) > 0;
  }

  // ── 连接器场景 ────────────────────────────
  const connectorBaseCostDefault = (base) => numberOr(base && base.baseMaterial, 0) * 0.24;
  const connectorVersionKey = (versions, key, fallback) => (key && versions[key] ? key : fallback);
  const specialConnectorStages = {
    progress: { label: '进度价', note: '已达成部分按定点版执行，未达成部分按报价版执行。' },
  };

  function connectorStageSet(versions) {
    return new Set([...Object.keys(versions || {}), ...Object.keys(specialConnectorStages)]);
  }
  function connectorProtocolRows(protocolStatus, itemId) {
    const rows = protocolStatus && Array.isArray(protocolStatus.rows) ? protocolStatus.rows : [];
    return rows.filter((r) => r && r.portfolioId === itemId);
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
    const totalWeight = rows.reduce((s, r) => s + connectorProtocolWeight(r), 0) || 1;
    const confirmedWeight = rows.reduce((s, r) => s + (r.statusKey === 'confirmed' ? connectorProtocolWeight(r) : 0), 0);
    const confirmedShare = clamp(confirmedWeight / totalWeight, 0, 1);
    const quoteShare = clamp(1 - confirmedShare, 0, 1);
    const fixedFactor = versions.fixed ? numberOr(versions.fixed.factor, 1) : 1;
    const quoteFactor = versions.quote ? numberOr(versions.quote.factor, 1) : 1;
    return { rowCount: rows.length, confirmedShare, quoteShare, factor: confirmedShare * fixedFactor + quoteShare * quoteFactor };
  }
  function connectorStageMeta(versions, stageKey, progressMeta) {
    if (stageKey === 'progress') {
      const baseMeta = specialConnectorStages.progress;
      if (!progressMeta) return { ...baseMeta, factor: 1 };
      return { ...baseMeta, factor: progressMeta.factor };
    }
    return versions[stageKey] || versions.quote || { label: stageKey || '', note: '', factor: 1 };
  }
  function normalizeConnectorPricing(rawPricing, items, versions) {
    const validIds = new Set((items || []).map((item) => item.id));
    const validStages = connectorStageSet(versions);
    return Object.entries(rawPricing || {}).reduce((acc, [itemId, versionKey]) => {
      if (validIds.has(itemId) && validStages.has(versionKey)) acc[itemId] = versionKey;
      return acc;
    }, {});
  }

  function buildConnectorScenario(base, versions, defaultKey, draftPricing, protocolStatus) {
    const portfolio = base && base.connectorPortfolio ? base.connectorPortfolio : {};
    const items = Array.isArray(portfolio.items) ? portfolio.items : [];
    const baseCostPerSet = numberOr(portfolio.baseCostPerSet, 0) || connectorBaseCostDefault(base);
    const pricing = normalizeConnectorPricing(draftPricing, items, versions);
    if (!items.length || !baseCostPerSet) {
      return { items: [], pricing, factor: versions[defaultKey] ? versions[defaultKey].factor : 1,
               totalBaseCost: baseCostPerSet, totalCurrentCost: baseCostPerSet, deltaCost: 0,
               overrideCount: 0, followCount: 0, stageCounts: { quote: 0, fixed: 0, progress: 0 } };
    }
    const stageCounts = { quote: 0, fixed: 0, progress: 0 };
    let totalBaseCost = 0, totalCurrentCost = 0, overrideCount = 0, followCount = 0;
    const connectorItems = items.map((item) => {
      const share = numberOr(item.share, 0);
      const baseCost = numberOr(item.baseCost, baseCostPerSet * share);
      const progressMeta = buildConnectorProgressMeta(protocolStatus, item.id, versions);
      const rawExplicitKey = pricing[item.id] || '';
      const explicitKey = rawExplicitKey && rawExplicitKey !== defaultKey ? rawExplicitKey : '';
      const selectionKey = explicitKey === 'progress' ? 'progress' : connectorVersionKey(versions, explicitKey, defaultKey);
      const selection = connectorStageMeta(versions, selectionKey, progressMeta);
      const currentCost = baseCost * (selection ? selection.factor : 1);
      const followsDefault = !explicitKey;
      const currentShare = baseCostPerSet ? currentCost / baseCostPerSet : 0;
      totalBaseCost += baseCost; totalCurrentCost += currentCost;
      if (followsDefault) followCount += 1; else overrideCount += 1;
      if (stageCounts[selectionKey] !== undefined) stageCounts[selectionKey] += 1;
      return { ...item, share, baseCost, currentCost, deltaCost: currentCost - baseCost, currentShare,
               followsDefault, selectionKey, selectionLabel: selection ? selection.label : '',
               selectionNote: selection ? selection.note : '', overrideKey: explicitKey, progressMeta };
    });

    // Issue #1: 进度价 = 协议价差距追踪
    let progressPriceGap = 0, progressPriceDetail = null;
    const progressTracker = global.G281ProgressPriceTracker;
    if (progressTracker) {
      const progressItems = connectorItems.map(item => ({
        partNo: item.partNo, agreedPrice: item.agreedPrice || item.protocolPrice || 0,
        batchPrice: item.batchPrice || item.currentPrice || 0, quotePrice: item.quotePrice || 0,
        quantity: item.lifecycleQty || item.qty || 0, supplier: item.supplier || '',
        harnessId: item.harnessId || '', category: item.category || 'connector',
      }));
      const progressResult = progressTracker.trackBatch(progressItems);
      progressPriceGap = progressResult.summary.netGap;
      progressPriceDetail = progressResult;
    }
    return { items: connectorItems, pricing,
             factor: baseCostPerSet ? totalCurrentCost / baseCostPerSet : 1,
             totalBaseCost, totalCurrentCost, deltaCost: totalCurrentCost - totalBaseCost,
             overrideCount, followCount, stageCounts, progressPriceGap, progressPriceDetail };
  }

  // ── BOM 变更汇总 ────────────────────────────
  function summarizeBomChanges(bomChanges) {
    return (bomChanges || []).reduce((acc, row) => {
      if (row.action === '替换') acc.replaceCount += 1;
      else if (row.action === '新增') acc.addCount += 1;
      else if (row.action === '取消') acc.cancelCount += 1;
      acc.obsoleteQty += numberOr(row.obsoleteQty, 0);
      acc.obsoleteValue += numberOr(row.obsoleteValue, 0);
      acc.equipmentDelta += numberOr(row.equipmentDelta, 0);
      acc.laborDelta += numberOr(row.laborDelta, 0);
      acc.packagingDelta += numberOr(row.packagingDelta, 0);
      (row.configs || []).forEach((cfg) => acc.configs.add(cfg));
      return acc;
    }, { replaceCount: 0, addCount: 0, cancelCount: 0, obsoleteQty: 0, obsoleteValue: 0,
         equipmentDelta: 0, laborDelta: 0, packagingDelta: 0, configs: new Set() });
  }

  // ── 导出 ────────────────────────────────────
  global.G281StateNormalizer = {
    stateFinancialVersionKey,
    resolvePureFinancialVersionKey,
    resolveReferenceFinancialVersionKey,
    normalizeLifecycleYear,
    lifecycleYears,
    legacyAnnualDropRows,
    normalizeAnnualDropVersion,
    normalizeOneTimeCustomerEntries,
    normalizeOneTimeCustomerVersion,
    normalizeRebateVersion,
    hasLifecycleBusinessEffect,
    connectorBaseCostDefault,
    connectorVersionKey,
    specialConnectorStages,
    connectorStageSet,
    connectorProtocolRows,
    connectorProtocolWeight,
    buildConnectorProgressMeta,
    connectorStageMeta,
    normalizeConnectorPricing,
    buildConnectorScenario,
    summarizeBomChanges,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = global.G281StateNormalizer;
  }
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this);
