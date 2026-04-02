(function (global) {
  'use strict';

  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const weighted = (shares, indexes) => shares.reduce((sum, value, index) => sum + (Number(value) || 0) / 100 * indexes[index], 0);
  const normalizeMix = (values) => {
    const series = values.map((value) => Math.max(0, Number(value) || 0));
    const total = series.reduce((sum, value) => sum + value, 0) || 1;
    return series.map((value) => value / total * 100);
  };
  const connectorBaseCostDefault = (base) => Number(base && base.baseMaterial) * 0.24 || 0;
  const connectorVersionKey = (versions, key, fallback) => (key && versions[key] ? key : fallback);
  const specialConnectorStages = {
    progress: {
      label: '进度价',
      note: '已达成部分按协议价执行，未达成部分按样品价执行。',
    },
  };

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
    const sampleShare = clamp(1 - confirmedShare, 0, 1);
    const protocolFactor = versions.protocol ? versions.protocol.factor : 1;
    const sampleFactor = versions.sample ? versions.sample.factor : 1;
    return {
      rowCount: rows.length,
      confirmedShare,
      sampleShare,
      factor: confirmedShare * protocolFactor + sampleShare * sampleFactor,
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
    return versions[stageKey] || versions.batch || { label: stageKey || '', note: '', factor: 1 };
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

  function buildConnectorScenario(base, versions, defaultKey, draftPricing, protocolStatus) {
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
        stageCounts: { batch: 0, protocol: 0, sample: 0, progress: 0 },
      };
    }

    const stageCounts = { batch: 0, protocol: 0, sample: 0, progress: 0 };
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
    if (versionKey === 'base') return quoteSnapshot;
    if (versionKey === 'shared') return fixedSnapshot;
    const factor = Number(base && base.versions && base.versions.equipment && base.versions.equipment[versionKey] && base.versions.equipment[versionKey].factor);
    const scale = Number.isFinite(factor) && factor > 0 ? factor : 1;
    return {
      equipment: fixedSnapshot.equipment * scale,
      tooling: fixedSnapshot.tooling * scale,
      fixtures: fixedSnapshot.fixtures * scale,
      rnd: fixedSnapshot.rnd,
      sourceKind: 'tt',
    };
  }

  function computeModel(runtime, draft, state) {
    const BASE = runtime.master;
    const bomChanges = runtime.bomChanges || [];
    const currentState = {
      bom: state && state.bom ? state.bom : 'freeze',
      connector: state && state.connector ? state.connector : 'batch',
      labor: state && state.labor ? state.labor : 'base',
      equipment: state && state.equipment ? state.equipment : 'base',
      packaging: state && state.packaging ? state.packaging : 'base',
      sales: state && state.sales ? state.sales : 'quote',
      mix: state && state.mix ? state.mix : 'quote',
      vave: state && state.vave ? state.vave : 'none',
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

    const bom = BASE.versions.bom[currentState.bom];
    const conn = BASE.versions.connector[currentState.connector];
    const laborOption = BASE.versions.labor[currentState.labor];
    const equipOption = BASE.versions.equipment[currentState.equipment];
    const packOption = BASE.versions.packaging[currentState.packaging];
    const sales = BASE.versions.sales[currentState.sales];
    const mix = BASE.versions.mix[currentState.mix];
    const vave = BASE.versions.vave[currentState.vave];
    const connectorScenario = buildConnectorScenario(BASE, BASE.versions.connector, currentState.connector, d.connectorPricing, runtime.connectorProtocolStatus || null);
    const lifecycleVolume = d.volumes.reduce((sum, value) => sum + value, 0);
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

    const mixPrice = weighted(d.mix, BASE.priceMixIndexes) / weighted(BASE.baselineMix, BASE.priceMixIndexes);
    const mixCost = weighted(d.mix, BASE.costMixIndexes) / weighted(BASE.baselineMix, BASE.costMixIndexes);
    const copperFactor = 1 + ((d.copperPrice - BASE.copperPrice) / BASE.copperPrice) * 0.65;
    const aluminumFactor = 1 + ((d.aluminumPrice - BASE.aluminumPrice) / BASE.aluminumPrice) * 0.45;
    const connectorFactor = connectorScenario.factor || conn.factor;
    const laborBaselinePerSet = quoteLaborSnapshot
      ? (Number(quoteLaborSnapshot.directLaborPerSet) || 0) + (Number(quoteLaborSnapshot.manufacturingPerSet) || 0)
      : (Number(BASE.baseDirectHours) || 0) * (Number(BASE.baseDirectRate) || 0) + (Number(BASE.baseMfgHours) || 0) * (Number(BASE.baseMfgRate) || 0);
    const packagingBaselinePerSet = Number(quotePackagingSnapshot && quotePackagingSnapshot.packTotal) || Number(BASE.basePackagingPerSet) || 0;
    const currentLaborPerSet = d.directHours * d.directRate + d.manufacturingHours * d.manufacturingRate;
    const currentPackagingPerSet = d.packInner + d.packFreight + d.packWarehouse + d.packOther;
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
    const equip = {
      ...equipOption,
      factor: quoteCapitalSnapshot.equipment ? currentCapitalSnapshot.equipment / quoteCapitalSnapshot.equipment : 1,
    };
    const matBase = BASE.baseMaterial * (0.24 * connectorFactor + 0.38 * copperFactor + 0.18 * aluminumFactor + 0.20);
    const material = matBase * bom.factor;
    const rnd = BASE.baseRndPerSet;
    const operating = (material + directLabor + manufacturing + packaging) * mixCost + equipment + rnd - vave.savings;

    const annual = BASE.years.map((year, index) => {
      const volume = d.volumes[index];
      const asp = d.asp[index] * mixPrice;
      const revenue = volume * asp;
      const cost = volume * operating;
      const profit = revenue - cost;
      const margin = revenue ? profit / revenue : 0;
      return { year, volume, asp, revenue, cost, profit, margin };
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

  global.G281Engine = {
    clamp,
    weighted,
    normalizeMix,
    summarizeBomChanges,
    computeModel,
  };
})(window);
