(function (global) {
  'use strict';

  const DASHBOARD_PACKAGING_FALLBACK = {
    packInner: 3.2,
    packFreight: 4.1,
    packWarehouse: 2.95,
    packOther: 2.3943008441667,
  };

  const STATE_GROUPS = ['bom', 'metal', 'connector', 'labor', 'equipment', 'packaging', 'sales', 'mix', 'vave'];
  const METRIC_KEYS = new Set(['totalProfit', 'margin', 'avgProfit']);
  const BASELINE_KEY_HINTS = {
    bom: ['freeze', 'quote', 'base'],
    metal: ['quote', 'base', 'freeze'],
    connector: ['batch', 'quote', 'base'],
    labor: ['base', 'quote'],
    equipment: ['base', 'quote'],
    packaging: ['base', 'quote'],
    sales: ['quote', 'base'],
    mix: ['quote', 'base'],
    vave: ['none', 'quote', 'base'],
  };

  function isFiniteNumber(value) {
    return Number.isFinite(Number(value));
  }

  function numberOr(value, fallback) {
    return isFiniteNumber(value) ? Number(value) : fallback;
  }

  function clonePlain(value, fallback) {
    try {
      return JSON.parse(JSON.stringify(value));
    } catch (error) {
      return fallback;
    }
  }

  function normalizeMetricKey(metric) {
    return METRIC_KEYS.has(metric) ? metric : 'totalProfit';
  }

  function resolveComputeModel(runtime, options) {
    const computeModel = options && typeof options.computeModel === 'function'
      ? options.computeModel
      : global.G281Engine && typeof global.G281Engine.computeModel === 'function'
        ? global.G281Engine.computeModel
        : null;
    if (!computeModel) {
      throw new Error('G281TargetPriceSolver requires window.G281Engine.computeModel(...) or options.computeModel.');
    }
    if (!runtime || !runtime.master) {
      throw new Error('G281TargetPriceSolver requires a runtime object with runtime.master.');
    }
    return computeModel;
  }

  function getMetricValue(model, metric) {
    const key = normalizeMetricKey(metric);
    return numberOr(model && model[key], 0);
  }

  function versionEntries(master, group) {
    return master && master.versions && master.versions[group] ? master.versions[group] : {};
  }

  function firstVersionKey(entries) {
    const keys = Object.keys(entries || {});
    return keys.length ? keys[0] : '';
  }

  function detectBaselineVersionKey(master, group) {
    const entries = versionEntries(master, group);
    const keys = Object.keys(entries);
    if (!keys.length) return '';

    const explicitHints = BASELINE_KEY_HINTS[group] || [];
    for (let index = 0; index < explicitHints.length; index += 1) {
      const key = explicitHints[index];
      if (entries[key]) return key;
    }

    const textHints = ['报价', 'baseline', 'quote', 'base', '默认', '基准'];
    const labelMatch = keys.find((key) => {
      const option = entries[key] || {};
      const haystack = `${key} ${option.label || ''} ${option.note || ''}`.toLowerCase();
      return textHints.some((hint) => haystack.includes(String(hint).toLowerCase()));
    });
    return labelMatch || firstVersionKey(entries);
  }

  function buildQuoteBaselineState(runtime, overrideState) {
    const master = runtime.master;
    const detected = STATE_GROUPS.reduce((acc, group) => {
      acc[group] = detectBaselineVersionKey(master, group);
      return acc;
    }, {});
    return {
      ...detected,
      ...(overrideState || {}),
    };
  }

  function normalizeState(runtime, state) {
    const baseline = buildQuoteBaselineState(runtime);
    const nextState = { ...baseline };
    STATE_GROUPS.forEach((group) => {
      const candidate = state && state[group];
      const entries = versionEntries(runtime.master, group);
      if (candidate && entries[candidate]) {
        nextState[group] = candidate;
      }
    });
    return nextState;
  }

  function seededHistoryDraft(runtime, group, versionKey) {
    const history = Array.isArray(runtime && runtime.historySeed) ? runtime.historySeed : [];
    const record = history.find((item) => item && item.state && item.state[group] === versionKey && item.draft);
    return record && record.draft ? record.draft : null;
  }

  function metalSnapshot(runtime, versionKey) {
    const master = runtime.master;
    const version = versionEntries(master, 'metal')[versionKey];
    if (!version) return null;
    return {
      copperPrice: numberOr(version.copperPrice, numberOr(master.copperPrice, 0)),
      aluminumPrice: numberOr(version.aluminumPrice, numberOr(master.aluminumPrice, 0)),
    };
  }

  function salesVolumes(runtime, versionKey) {
    const master = runtime.master;
    const version = versionEntries(master, 'sales')[versionKey];
    return Array.isArray(version && version.volumes) && version.volumes.length ? version.volumes.slice() : (master.volumes || []).slice();
  }

  function mixValues(runtime, versionKey) {
    const master = runtime.master;
    const version = versionEntries(master, 'mix')[versionKey];
    const values = Array.isArray(version && version.values) && version.values.length ? version.values.slice() : (master.baselineMix || []).slice();
    if (global.G281Engine && typeof global.G281Engine.normalizeMix === 'function') {
      return global.G281Engine.normalizeMix(values);
    }
    return values;
  }

  function bomDraft(runtime, versionKey) {
    const master = runtime.master;
    const option = versionEntries(master, 'bom')[versionKey] || {};
    if (option.userCreated && option.draft) {
      return clonePlain(option.draft, null);
    }
    const keyMap = {
      freeze: 'quote',
      light: 'fixed',
      regress: 'tt',
    };
    const snapshotKey = keyMap[versionKey] || versionKey;
    const snapshot = runtime && runtime.bomVersions && runtime.bomVersions.versionSnapshots
      ? runtime.bomVersions.versionSnapshots[snapshotKey]
      : null;
    if (snapshot && snapshot.draft) {
      return clonePlain(snapshot.draft, null);
    }
    return null;
  }

  function laborSnapshot(runtime, versionKey) {
    const master = runtime.master;
    const option = versionEntries(master, 'labor')[versionKey] || {};
    if (option.userCreated || Object.prototype.hasOwnProperty.call(option, 'directHours')) {
      return {
        directHours: option.directHours,
        directRate: option.directRate,
        manufacturingHours: option.manufacturingHours,
        manufacturingRate: option.manufacturingRate,
      };
    }
    const snapshots = runtime && runtime.laborValidation && runtime.laborValidation.versionSnapshots;
    if (versionKey === 'base' && snapshots && snapshots.quote) return snapshots.quote;
    if (versionKey === 'optimize' && snapshots && snapshots.fixed) return snapshots.fixed;
    return seededHistoryDraft(runtime, 'labor', versionKey);
  }

  function packagingSnapshot(runtime, versionKey) {
    const master = runtime.master;
    const option = versionEntries(master, 'packaging')[versionKey] || {};
    if (option.userCreated || Object.prototype.hasOwnProperty.call(option, 'packInner')) {
      return {
        packInner: option.packInner,
        packFreight: option.packFreight,
        packWarehouse: option.packWarehouse,
        packOther: option.packOther,
      };
    }
    const snapshots = runtime && runtime.packagingValidation && runtime.packagingValidation.versionSnapshots;
    if (versionKey === 'base' && snapshots && snapshots.quote) return snapshots.quote;
    if (versionKey === 'optimize' && snapshots && snapshots.fixed) return snapshots.fixed;
    return seededHistoryDraft(runtime, 'packaging', versionKey);
  }

  function connectorPricingSnapshot(runtime, versionKey) {
    const master = runtime.master;
    const option = versionEntries(master, 'connector')[versionKey] || {};
    return option && option.userCreated && option.overrides ? clonePlain(option.overrides, {}) : {};
  }

  function baseDraftDefaults(runtime) {
    const master = runtime.master;
    const baselineState = buildQuoteBaselineState(runtime);
    const metal = metalSnapshot(runtime, baselineState.metal) || {};
    const labor = laborSnapshot(runtime, baselineState.labor) || {};
    const packaging = packagingSnapshot(runtime, baselineState.packaging) || {};
    const bom = bomDraft(runtime, baselineState.bom) || {};

    return {
      scenarioName: String(master.name || '').trim() || 'Scenario',
      copperPrice: numberOr(metal.copperPrice, numberOr(master.copperPrice, 0)),
      aluminumPrice: numberOr(metal.aluminumPrice, numberOr(master.aluminumPrice, 0)),
      directHours: numberOr(labor.directHours, numberOr(master.baseDirectHours, 0)),
      directRate: numberOr(labor.directRate, numberOr(master.baseDirectRate, 0)),
      manufacturingHours: numberOr(labor.manufacturingHours, numberOr(master.baseMfgHours, 0)),
      manufacturingRate: numberOr(labor.manufacturingRate, numberOr(master.baseMfgRate, 0)),
      packInner: numberOr(packaging.packInner, DASHBOARD_PACKAGING_FALLBACK.packInner),
      packFreight: numberOr(packaging.packFreight, DASHBOARD_PACKAGING_FALLBACK.packFreight),
      packWarehouse: numberOr(packaging.packWarehouse, DASHBOARD_PACKAGING_FALLBACK.packWarehouse),
      packOther: numberOr(packaging.packOther, DASHBOARD_PACKAGING_FALLBACK.packOther),
      bomWireDrawing: numberOr(bom.bomWireDrawing, numberOr(master.bomDefaults && master.bomDefaults.wireDrawing, 0)),
      bomWireEat: numberOr(bom.bomWireEat, numberOr(master.bomDefaults && master.bomDefaults.wireEat, 0)),
      bomWireHidden: numberOr(bom.bomWireHidden, numberOr(master.bomDefaults && master.bomDefaults.wireHidden, 0)),
      bomTapeDiameter: numberOr(bom.bomTapeDiameter, numberOr(master.bomDefaults && master.bomDefaults.tapeDiameter, 0)),
      bomTapeWidth: numberOr(bom.bomTapeWidth, numberOr(master.bomDefaults && master.bomDefaults.tapeWidth, 0)),
      bomTapeOverlap: numberOr(bom.bomTapeOverlap, numberOr(master.bomDefaults && master.bomDefaults.tapeOverlap, 0)),
      mix: mixValues(runtime, baselineState.mix),
      volumes: salesVolumes(runtime, baselineState.sales),
      asp: Array.isArray(master.asp) ? master.asp.slice() : [],
      connectorPricing: connectorPricingSnapshot(runtime, baselineState.connector),
    };
  }

  function mergeArray(preferred, fallback) {
    if (Array.isArray(preferred) && preferred.length) return preferred.slice();
    return Array.isArray(fallback) ? fallback.slice() : [];
  }

  function mergeObject(preferred, fallback) {
    return {
      ...(fallback || {}),
      ...(preferred || {}),
    };
  }

  function buildScenarioDraft(runtime, draft, state) {
    const normalizedState = normalizeState(runtime, state);
    const baseDraft = baseDraftDefaults(runtime);
    const scenarioDraft = { ...baseDraft };

    const metal = metalSnapshot(runtime, normalizedState.metal);
    if (metal) {
      scenarioDraft.copperPrice = numberOr(metal.copperPrice, scenarioDraft.copperPrice);
      scenarioDraft.aluminumPrice = numberOr(metal.aluminumPrice, scenarioDraft.aluminumPrice);
    }

    const bom = bomDraft(runtime, normalizedState.bom);
    if (bom) {
      ['bomWireDrawing', 'bomWireEat', 'bomWireHidden', 'bomTapeDiameter', 'bomTapeWidth', 'bomTapeOverlap'].forEach((key) => {
        if (isFiniteNumber(bom[key])) scenarioDraft[key] = Number(bom[key]);
      });
    }

    const labor = laborSnapshot(runtime, normalizedState.labor);
    if (labor) {
      ['directHours', 'directRate', 'manufacturingHours', 'manufacturingRate'].forEach((key) => {
        if (isFiniteNumber(labor[key])) scenarioDraft[key] = Number(labor[key]);
      });
    }

    const packaging = packagingSnapshot(runtime, normalizedState.packaging);
    if (packaging) {
      ['packInner', 'packFreight', 'packWarehouse', 'packOther'].forEach((key) => {
        if (isFiniteNumber(packaging[key])) scenarioDraft[key] = Number(packaging[key]);
      });
    }

    scenarioDraft.volumes = salesVolumes(runtime, normalizedState.sales);
    scenarioDraft.mix = mixValues(runtime, normalizedState.mix);
    scenarioDraft.connectorPricing = connectorPricingSnapshot(runtime, normalizedState.connector);

    const nextDraft = { ...scenarioDraft, ...(draft || {}) };
    nextDraft.scenarioName = String(nextDraft.scenarioName || scenarioDraft.scenarioName || runtime.master.name || 'Scenario').trim() || 'Scenario';
    nextDraft.volumes = mergeArray(draft && draft.volumes, scenarioDraft.volumes).map((value) => Math.max(0, numberOr(value, 0)));
    nextDraft.mix = mergeArray(draft && draft.mix, scenarioDraft.mix).map((value) => numberOr(value, 0));
    nextDraft.asp = mergeArray(draft && draft.asp, baseDraft.asp).map((value) => numberOr(value, 0));
    nextDraft.connectorPricing = mergeObject(draft && draft.connectorPricing, scenarioDraft.connectorPricing);
    return nextDraft;
  }

  function buildQuoteBaselineDraft(runtime, overrideDraft) {
    const baselineState = buildQuoteBaselineState(runtime);
    return buildScenarioDraft(runtime, overrideDraft, baselineState);
  }

  function buildVersionScenario(runtime, state, draftOverrides) {
    const normalizedState = normalizeState(runtime, state);
    return {
      state: normalizedState,
      draft: buildScenarioDraft(runtime, draftOverrides, normalizedState),
    };
  }

  function scaleAspSeries(aspSeries, factor) {
    return (Array.isArray(aspSeries) ? aspSeries : []).map((value) => numberOr(value, 0) * factor);
  }

  function diffSeries(targetSeries, baseSeries) {
    const size = Math.max(
      Array.isArray(targetSeries) ? targetSeries.length : 0,
      Array.isArray(baseSeries) ? baseSeries.length : 0,
    );
    const values = [];
    for (let index = 0; index < size; index += 1) {
      values.push(numberOr(targetSeries && targetSeries[index], 0) - numberOr(baseSeries && baseSeries[index], 0));
    }
    return values;
  }

  function averageSeries(series) {
    if (!Array.isArray(series) || !series.length) return 0;
    return series.reduce((sum, value) => sum + numberOr(value, 0), 0) / series.length;
  }

  function buildPriceSummary(currentEvaluation, solvedEvaluation) {
    const currentAspSeries = currentEvaluation && currentEvaluation.draft ? currentEvaluation.draft.asp.slice() : [];
    const targetAspSeries = solvedEvaluation && solvedEvaluation.draft ? solvedEvaluation.draft.asp.slice() : [];
    const currentEffectiveAnnualAspSeries = currentEvaluation && currentEvaluation.model && Array.isArray(currentEvaluation.model.annual)
      ? currentEvaluation.model.annual.map((row) => numberOr(row.asp, 0))
      : [];
    const targetEffectiveAnnualAspSeries = solvedEvaluation && solvedEvaluation.model && Array.isArray(solvedEvaluation.model.annual)
      ? solvedEvaluation.model.annual.map((row) => numberOr(row.asp, 0))
      : [];
    return {
      currentAspSeries,
      targetAspSeries,
      aspDeltaSeries: diffSeries(targetAspSeries, currentAspSeries),
      currentEffectiveAnnualAspSeries,
      targetEffectiveAnnualAspSeries,
      effectiveAnnualAspDeltaSeries: diffSeries(targetEffectiveAnnualAspSeries, currentEffectiveAnnualAspSeries),
      currentAverageAsp: averageSeries(currentAspSeries),
      targetAverageAsp: averageSeries(targetAspSeries),
      averageAspDelta: averageSeries(targetAspSeries) - averageSeries(currentAspSeries),
      currentAverageEffectiveAnnualAsp: averageSeries(currentEffectiveAnnualAspSeries),
      targetAverageEffectiveAnnualAsp: averageSeries(targetEffectiveAnnualAspSeries),
      averageEffectiveAnnualAspDelta: averageSeries(targetEffectiveAnnualAspSeries) - averageSeries(currentEffectiveAnnualAspSeries),
    };
  }

  function analyticalFactor(metric, targetValue, model) {
    const revenue = numberOr(model && model.totalRevenue, 0);
    const cost = numberOr(model && model.totalCost, 0);
    const volume = numberOr(model && model.totalVolume, 0);

    if (metric === 'totalProfit') {
      return revenue > 0 ? (targetValue + cost) / revenue : null;
    }
    if (metric === 'avgProfit') {
      return revenue > 0 && volume > 0 ? (targetValue * volume + cost) / revenue : null;
    }
    if (metric === 'margin') {
      if (targetValue >= 1 || revenue <= 0) return null;
      return cost / (revenue * (1 - targetValue));
    }
    return null;
  }

  function evaluateScenario(runtime, computeModel, draft, state, aspSeries, factor, metric, cache, stats) {
    const roundedFactor = Number(factor.toPrecision(12));
    const cacheKey = `${roundedFactor}`;
    if (cache.has(cacheKey)) {
      return cache.get(cacheKey);
    }
    const nextDraft = {
      ...draft,
      asp: scaleAspSeries(aspSeries, roundedFactor),
    };
    const model = computeModel(runtime, nextDraft, state);
    const metricValue = getMetricValue(model, metric);
    const result = {
      factor: roundedFactor,
      draft: nextDraft,
      model,
      metricValue,
    };
    cache.set(cacheKey, result);
    stats.evaluations += 1;
    return result;
  }

  function closerToTarget(left, right, targetValue) {
    if (!left) return right;
    if (!right) return left;
    return Math.abs(left.metricValue - targetValue) <= Math.abs(right.metricValue - targetValue) ? left : right;
  }

  function solveTargetPrice(runtime, draft, state, options) {
    const opts = options || {};
    const computeModel = resolveComputeModel(runtime, opts);
    const metric = normalizeMetricKey(opts.metric);
    const currentScenario = buildVersionScenario(runtime, state, draft);
    const normalizedState = currentScenario.state;
    const normalizedDraft = currentScenario.draft;
    const baselineState = normalizeState(runtime, opts.baselineState || buildQuoteBaselineState(runtime));
    const baselineDraft = buildScenarioDraft(runtime, opts.baselineDraft, baselineState);
    const baselineModel = computeModel(runtime, baselineDraft, baselineState);
    const currentModel = computeModel(runtime, normalizedDraft, normalizedState);
    const baselineMetric = getMetricValue(baselineModel, metric);
    const currentMetric = getMetricValue(currentModel, metric);
    const targetValue = isFiniteNumber(opts.targetValue) ? Number(opts.targetValue) : baselineMetric;
    const aspSeries = mergeArray(opts.aspSeries, normalizedDraft.asp).map((value) => numberOr(value, 0));
    const tolerance = Math.max(numberOr(opts.tolerance, 1e-7), 0);
    const maxIterations = Math.max(8, Math.floor(numberOr(opts.maxIterations, 60)));
    const minFactor = Math.max(0, numberOr(opts.minFactor, 0));
    const configuredMaxFactor = Math.max(minFactor, numberOr(opts.maxFactor, 64));
    const expansionFactor = Math.max(1.25, numberOr(opts.expansionFactor, 2));
    const stats = {
      evaluations: 0,
      iterations: 0,
      method: 'bisection',
    };
    const cache = new Map();

    const currentEvaluation = evaluateScenario(runtime, computeModel, normalizedDraft, normalizedState, aspSeries, 1, metric, cache, stats);
    const differenceNow = currentEvaluation.metricValue - targetValue;
    if (Math.abs(differenceNow) <= tolerance) {
      const priceSummary = buildPriceSummary(currentEvaluation, currentEvaluation);
      return {
        metric,
        targetValue,
        baselineMetric,
        currentMetric,
        requiredFactor: 1,
        requiredAspSeries: priceSummary.targetAspSeries,
        effectiveAnnualAspSeries: priceSummary.targetEffectiveAnnualAspSeries,
        currentAspSeries: priceSummary.currentAspSeries,
        currentEffectiveAnnualAspSeries: priceSummary.currentEffectiveAnnualAspSeries,
        aspDeltaSeries: priceSummary.aspDeltaSeries,
        effectiveAnnualAspDeltaSeries: priceSummary.effectiveAnnualAspDeltaSeries,
        targetAverageAsp: priceSummary.targetAverageAsp,
        currentAverageAsp: priceSummary.currentAverageAsp,
        averageAspDelta: priceSummary.averageAspDelta,
        targetAverageEffectiveAnnualAsp: priceSummary.targetAverageEffectiveAnnualAsp,
        currentAverageEffectiveAnnualAsp: priceSummary.currentAverageEffectiveAnnualAsp,
        averageEffectiveAnnualAspDelta: priceSummary.averageEffectiveAnnualAspDelta,
        achievedMetric: currentEvaluation.metricValue,
        baselineState,
        baselineDraft,
        currentState: normalizedState,
        currentDraft: normalizedDraft,
        baselineModel,
        currentModel,
        solvedModel: currentEvaluation.model,
        convergence: {
          success: true,
          reason: 'already_at_target',
          tolerance,
          ...stats,
          bracket: { low: 1, high: 1 },
          analyticalFactor: analyticalFactor(metric, targetValue, currentModel),
        },
      };
    }

    const lowerEvaluation = evaluateScenario(runtime, computeModel, normalizedDraft, normalizedState, aspSeries, minFactor, metric, cache, stats);
    let low = lowerEvaluation.factor;
    let lowDiff = lowerEvaluation.metricValue - targetValue;
    let high = Math.max(1, minFactor);
    let highEvaluation = currentEvaluation;
    let highDiff = differenceNow;

    const analyticEstimate = analyticalFactor(metric, targetValue, currentModel);
    if (isFiniteNumber(analyticEstimate) && Number(analyticEstimate) >= minFactor) {
      const boundedAnalytic = Math.min(Math.max(Number(analyticEstimate), minFactor), configuredMaxFactor);
      highEvaluation = evaluateScenario(runtime, computeModel, normalizedDraft, normalizedState, aspSeries, boundedAnalytic, metric, cache, stats);
      high = highEvaluation.factor;
      highDiff = highEvaluation.metricValue - targetValue;
      if (high < low) {
        const tempEvaluation = lowerEvaluation;
        low = high;
        lowDiff = highDiff;
        high = tempEvaluation.factor;
        highDiff = tempEvaluation.metricValue - targetValue;
        highEvaluation = tempEvaluation;
      }
    }

    if (Math.sign(lowDiff) === Math.sign(highDiff)) {
      high = Math.max(high, 1);
      while (Math.sign(lowDiff) === Math.sign(highDiff) && high < configuredMaxFactor) {
        high = Math.min(configuredMaxFactor, high * expansionFactor);
        highEvaluation = evaluateScenario(runtime, computeModel, normalizedDraft, normalizedState, aspSeries, high, metric, cache, stats);
        highDiff = highEvaluation.metricValue - targetValue;
      }
    }

    const analyticEvaluation = isFiniteNumber(analyticEstimate) && Number(analyticEstimate) >= minFactor
      ? evaluateScenario(runtime, computeModel, normalizedDraft, normalizedState, aspSeries, Math.min(Math.max(Number(analyticEstimate), minFactor), configuredMaxFactor), metric, cache, stats)
      : null;

    if (Math.sign(lowDiff) === Math.sign(highDiff)) {
      const failedEvaluation = closerToTarget(closerToTarget(lowerEvaluation, highEvaluation, targetValue), analyticEvaluation, targetValue);
      const priceSummary = buildPriceSummary(currentEvaluation, failedEvaluation);
      return {
        metric,
        targetValue,
        baselineMetric,
        currentMetric,
        requiredFactor: failedEvaluation.factor,
        requiredAspSeries: priceSummary.targetAspSeries,
        effectiveAnnualAspSeries: priceSummary.targetEffectiveAnnualAspSeries,
        currentAspSeries: priceSummary.currentAspSeries,
        currentEffectiveAnnualAspSeries: priceSummary.currentEffectiveAnnualAspSeries,
        aspDeltaSeries: priceSummary.aspDeltaSeries,
        effectiveAnnualAspDeltaSeries: priceSummary.effectiveAnnualAspDeltaSeries,
        targetAverageAsp: priceSummary.targetAverageAsp,
        currentAverageAsp: priceSummary.currentAverageAsp,
        averageAspDelta: priceSummary.averageAspDelta,
        targetAverageEffectiveAnnualAsp: priceSummary.targetAverageEffectiveAnnualAsp,
        currentAverageEffectiveAnnualAsp: priceSummary.currentAverageEffectiveAnnualAsp,
        averageEffectiveAnnualAspDelta: priceSummary.averageEffectiveAnnualAspDelta,
        achievedMetric: failedEvaluation.metricValue,
        baselineState,
        baselineDraft,
        currentState: normalizedState,
        currentDraft: normalizedDraft,
        baselineModel,
        currentModel,
        solvedModel: failedEvaluation.model,
        convergence: {
          success: false,
          reason: 'target_not_bracketed',
          tolerance,
          ...stats,
          bracket: { low, high },
          lowMetric: lowerEvaluation.metricValue,
          highMetric: highEvaluation.metricValue,
          analyticalFactor: analyticEstimate,
        },
      };
    }

    let solvedEvaluation = Math.abs(lowDiff) <= Math.abs(highDiff) ? lowerEvaluation : highEvaluation;
    while (stats.iterations < maxIterations) {
      stats.iterations += 1;
      const middle = (low + high) / 2;
      const middleEvaluation = evaluateScenario(runtime, computeModel, normalizedDraft, normalizedState, aspSeries, middle, metric, cache, stats);
      const middleDiff = middleEvaluation.metricValue - targetValue;
      solvedEvaluation = middleEvaluation;

      if (Math.abs(middleDiff) <= tolerance || Math.abs(high - low) <= tolerance) {
        break;
      }

      if (Math.sign(lowDiff) === Math.sign(middleDiff)) {
        low = middleEvaluation.factor;
        lowDiff = middleDiff;
      } else {
        high = middleEvaluation.factor;
        highDiff = middleDiff;
      }
    }

    const bestEvaluation = closerToTarget(solvedEvaluation, analyticEvaluation, targetValue);
    const priceSummary = buildPriceSummary(currentEvaluation, bestEvaluation);

    return {
      metric,
      targetValue,
      baselineMetric,
      currentMetric,
      requiredFactor: bestEvaluation.factor,
      requiredAspSeries: priceSummary.targetAspSeries,
      effectiveAnnualAspSeries: priceSummary.targetEffectiveAnnualAspSeries,
      currentAspSeries: priceSummary.currentAspSeries,
      currentEffectiveAnnualAspSeries: priceSummary.currentEffectiveAnnualAspSeries,
      aspDeltaSeries: priceSummary.aspDeltaSeries,
      effectiveAnnualAspDeltaSeries: priceSummary.effectiveAnnualAspDeltaSeries,
      targetAverageAsp: priceSummary.targetAverageAsp,
      currentAverageAsp: priceSummary.currentAverageAsp,
      averageAspDelta: priceSummary.averageAspDelta,
      targetAverageEffectiveAnnualAsp: priceSummary.targetAverageEffectiveAnnualAsp,
      currentAverageEffectiveAnnualAsp: priceSummary.currentAverageEffectiveAnnualAsp,
      averageEffectiveAnnualAspDelta: priceSummary.averageEffectiveAnnualAspDelta,
      achievedMetric: bestEvaluation.metricValue,
      baselineState,
      baselineDraft,
      currentState: normalizedState,
      currentDraft: normalizedDraft,
      baselineModel,
      currentModel,
      solvedModel: bestEvaluation.model,
      convergence: {
        success: Math.abs(bestEvaluation.metricValue - targetValue) <= tolerance || Math.abs(high - low) <= tolerance,
        reason: Math.abs(bestEvaluation.metricValue - targetValue) <= tolerance ? 'converged' : 'tolerance_on_factor',
        tolerance,
        ...stats,
        bracket: { low, high },
        analyticalFactor: analyticEstimate,
      },
    };
  }

  const api = {
    buildQuoteBaselineState,
    buildQuoteBaselineDraft,
    buildScenarioDraft,
    buildVersionScenario,
    getMetricValue,
    scaleAspSeries,
    solveTargetPrice,
  };

  global.G281TargetPriceSolver = api;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
