(function (global) {
  'use strict';

  const Shared = global.G281Shared || {};
  const numberOr = Shared.numberOr || ((value, fallback) => {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : fallback;
  });
  const safeArray = Shared.safeArray || ((value) => (Array.isArray(value) ? value : []));
  const toText = Shared.toText || ((value, fallback) => {
    const text = String(value == null ? '' : value).trim();
    return text || (fallback == null ? '' : fallback);
  });
  const safeObject = Shared.safeObject || ((value) => (value && typeof value === 'object' ? value : {}));

  const PER_SET_KEYS = ['revenue', 'cost', 'profit', 'margin', 'material', 'directLabor', 'equipment', 'manufacturing', 'rnd', 'packaging'];
  const TOTAL_KEYS = ['volume', 'revenue', 'cost', 'profit', 'margin'];
  const LIFECYCLE_KEYS = ['revenue', 'cost', 'profit', 'margin', 'costPerSet', 'materialPerSet', 'directLaborPerSet', 'equipmentPerSet', 'manufacturingPerSet', 'rndPerSet', 'packagingPerSet'];

  function escapeHtml(value) {
    return toText(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function resolveRuntime(runtimeInput) {
    if (runtimeInput && runtimeInput.master) return runtimeInput;
    if (runtimeInput && typeof runtimeInput.getRuntime === 'function') return runtimeInput.getRuntime() || {};
    return global.G281_RUNTIME || {};
  }

  function resolveLifecycleStageCandidate(stageKeyCandidate, options) {
    const candidate = (options && options.lifecycleStageKey)
      || stageKeyCandidate
      || (options && options.stageKey)
      || (options && options.baselineKey);
    return toText(candidate, 'quote');
  }

  function resolveConfig(runtimeInput, options) {
    const runtime = resolveRuntime(runtimeInput);
    if (options && options.config) return options.config;
    return (global.ConfigLoader && typeof global.ConfigLoader.active === 'function'
      ? global.ConfigLoader.active()
      : null)
      || runtime.projectConfig
      || null;
  }

  function resolveStageMeta(runtimeInput, baselineKey, options) {
    if (global.G281BomWorkbookAdapter && typeof global.G281BomWorkbookAdapter.resolveStageMeta === 'function') {
      return global.G281BomWorkbookAdapter.resolveStageMeta(runtimeInput, baselineKey, options);
    }
    const requested = resolveLifecycleStageCandidate(baselineKey, options);
    return {
      stageKey: requested,
      requestedStageKey: requested,
      lifecycleStageKey: requested,
      baselineKey: requested,
      financialKey: requested,
      bomWorkbookKey: requested,
      comparisonKey: requested === 'quote' ? 'fixed' : 'quote',
      mode: requested === 'quote' || requested === 'fixed' ? 'baseline' : 'delta',
      hasComparison: true,
      usesDelta: requested !== 'quote' && requested !== 'fixed',
    };
  }

  function resolveVersion(runtime, baselineKey) {
    const versions = runtime && runtime.financialVersions && runtime.financialVersions.versions
      ? runtime.financialVersions.versions
      : {};
    return versions[baselineKey || 'quote'] || versions.quote || null;
  }

  function emptyPerSet() {
    return {
      revenue: 0,
      cost: 0,
      profit: 0,
      margin: 0,
      material: 0,
      directLabor: 0,
      equipment: 0,
      manufacturing: 0,
      rnd: 0,
      packaging: 0,
    };
  }

  function emptyTotals() {
    return {
      volume: 0,
      revenue: 0,
      cost: 0,
      profit: 0,
      margin: 0,
    };
  }

  function buildWeightedPerSetFromRows(rows) {
    const result = emptyPerSet();
    safeArray(rows).forEach((row) => {
      const ratio = numberOr(row && row.usageRatio, 0);
      result.cost += numberOr(row && row.totalCostPerSet, 0) * ratio;
      result.material += numberOr(row && row.materialPerSet, 0) * ratio;
      result.directLabor += numberOr(row && row.directLaborPerSet, 0) * ratio;
      result.equipment += numberOr(row && row.equipmentPerSet, 0) * ratio;
      result.manufacturing += numberOr(row && row.manufacturingPerSet, 0) * ratio;
      result.rnd += numberOr(row && row.rndPerSet, 0) * ratio;
      result.packaging += numberOr(row && row.packagingPerSet, 0) * ratio;
    });
    return result;
  }

  function buildPerSetFromVersion(version, fallbackRows) {
    const weighted = buildWeightedPerSetFromRows(fallbackRows);
    const perSet = safeObject(version && version.perSet);
    return {
      revenue: numberOr(perSet.revenue, 0),
      cost: numberOr(perSet.cost, weighted.cost),
      profit: numberOr(perSet.profit, numberOr(perSet.revenue, 0) - weighted.cost),
      margin: numberOr(perSet.margin, numberOr(perSet.revenue, 0) ? (numberOr(perSet.profit, 0) / numberOr(perSet.revenue, 1)) : 0),
      material: numberOr(perSet.material, weighted.material),
      directLabor: numberOr(perSet.directLabor, weighted.directLabor),
      equipment: numberOr(perSet.equipment, weighted.equipment),
      manufacturing: numberOr(perSet.manufacturing, weighted.manufacturing),
      rnd: numberOr(perSet.rnd, weighted.rnd),
      packaging: numberOr(perSet.packaging, weighted.packaging),
    };
  }

  function buildTotalsFromVersion(runtime, version, perSet) {
    const totals = safeObject(version && version.totals);
    const lifecycleVolume = numberOr(runtime && runtime.master && safeArray(runtime.master.volumes).reduce((sum, value) => sum + numberOr(value, 0), 0), 0);
    const resolvedVolume = numberOr(totals.volume, lifecycleVolume);
    const revenueTotal = numberOr(totals.revenue, numberOr(perSet.revenue, 0) * resolvedVolume);
    const costTotal = numberOr(totals.cost, numberOr(perSet.cost, 0) * resolvedVolume);
    const profitTotal = numberOr(totals.profit, numberOr(perSet.profit, 0) * resolvedVolume);
    return {
      volume: resolvedVolume,
      revenue: revenueTotal,
      cost: costTotal,
      profit: profitTotal,
      margin: numberOr(totals.margin, revenueTotal ? profitTotal / revenueTotal : 0),
    };
  }

  function buildLifecycleFromVersion(version) {
    const years = safeArray(version && version.years);
    const annual = safeObject(version && version.annual);
    return years.map((year, index) => {
      const row = { year, volume: numberOr(version && version.volumes && version.volumes[index], 0) };
      LIFECYCLE_KEYS.forEach((key) => {
        row[key] = numberOr(annual[key] && annual[key][index], 0);
      });
      return row;
    });
  }

  function diffObject(current, compare, keys) {
    const result = {};
    safeArray(keys).forEach((key) => {
      result[key] = numberOr(current && current[key], 0) - numberOr(compare && compare[key], 0);
    });
    return result;
  }

  function diffLifecycle(currentRows, compareRows) {
    const compareMap = new Map(safeArray(compareRows).map((row) => [row.year, row]));
    return safeArray(currentRows).map((row) => {
      const compare = compareMap.get(row.year) || {};
      const delta = {
        year: row.year,
        volume: numberOr(row.volume, 0) - numberOr(compare.volume, 0),
      };
      LIFECYCLE_KEYS.forEach((key) => {
        delta[key] = numberOr(row[key], 0) - numberOr(compare[key], 0);
      });
      return delta;
    });
  }

  function buildWeightedCheck(rows) {
    return {
      totalCostPerSet: safeArray(rows).reduce((sum, row) => sum + numberOr(row && row.totalCostPerSet, 0) * numberOr(row && row.usageRatio, 0), 0),
      materialPerSet: safeArray(rows).reduce((sum, row) => sum + numberOr(row && row.materialPerSet, 0) * numberOr(row && row.usageRatio, 0), 0),
      directLaborPerSet: safeArray(rows).reduce((sum, row) => sum + numberOr(row && row.directLaborPerSet, 0) * numberOr(row && row.usageRatio, 0), 0),
      manufacturingPerSet: safeArray(rows).reduce((sum, row) => sum + numberOr(row && row.manufacturingPerSet, 0) * numberOr(row && row.usageRatio, 0), 0),
      equipmentPerSet: safeArray(rows).reduce((sum, row) => sum + numberOr(row && row.equipmentPerSet, 0) * numberOr(row && row.usageRatio, 0), 0),
      rndPerSet: safeArray(rows).reduce((sum, row) => sum + numberOr(row && row.rndPerSet, 0) * numberOr(row && row.usageRatio, 0), 0),
      packagingPerSet: safeArray(rows).reduce((sum, row) => sum + numberOr(row && row.packagingPerSet, 0) * numberOr(row && row.usageRatio, 0), 0),
    };
  }

  function buildSourceSummary(rows) {
    const sourceSheets = new Set();
    const allocationModes = new Set();
    const allocationProfileIds = new Set();
    let detailGroups = 0;
    let detailEntries = 0;
    let missingSourceCount = 0;
    safeArray(rows).forEach((row) => {
      const summary = safeObject(row && row.sourceSummary);
      detailGroups += numberOr(summary.detailGroupCount, 0);
      detailEntries += numberOr(summary.detailEntryCount, 0);
      missingSourceCount += numberOr(summary.missingSourceCount, 0);
      safeArray(summary.sourceSheets).forEach((sheetName) => sourceSheets.add(sheetName));
      safeArray(summary.allocationModes).forEach((mode) => allocationModes.add(mode));
      safeArray(row && row.allocationSummary && row.allocationSummary.profileIds).forEach((profileId) => allocationProfileIds.add(profileId));
    });
    return {
      harnessCount: safeArray(rows).length,
      detailGroupCount: detailGroups,
      detailEntryCount: detailEntries,
      missingSourceCount,
      sourceSheetCount: sourceSheets.size,
      sourceSheets: Array.from(sourceSheets),
      allocationModes: Array.from(allocationModes),
      allocationProfileIds: Array.from(allocationProfileIds),
    };
  }

  function buildLifecycleSummary(rows) {
    return safeArray(rows).reduce((summary, row) => {
      summary.volume += numberOr(row && row.volume, 0);
      summary.revenue += numberOr(row && row.revenue, 0);
      summary.cost += numberOr(row && row.cost, 0);
      summary.profit += numberOr(row && row.profit, 0);
      return summary;
    }, {
      yearCount: safeArray(rows).length,
      volume: 0,
      revenue: 0,
      cost: 0,
      profit: 0,
      margin: 0,
    });
  }

  function buildPerHarness(rows, stageMeta) {
    return safeArray(rows).map((row) => ({
      harnessId: toText(row && row.harnessId, ''),
      harnessName: toText(row && row.harnessName, toText(row && row.harnessId, '')),
      quantityFactor: numberOr(row && row.quantityFactor, 0),
      usageRatio: numberOr(row && row.usageRatio, 0),
      weightedContribution: numberOr(row && row.weightedContribution, 0),
      stageMeta: Object.assign({}, row && row.stageMeta ? row.stageMeta : stageMeta),
      perSet: {
        revenue: 0,
        cost: numberOr(row && row.totalCostPerSet, 0),
        profit: 0,
        margin: 0,
        material: numberOr(row && row.materialPerSet, 0),
        directLabor: numberOr(row && row.directLaborPerSet, 0),
        equipment: numberOr(row && row.equipmentPerSet, 0),
        manufacturing: numberOr(row && row.manufacturingPerSet, 0),
        rnd: numberOr(row && row.rndPerSet, 0),
        packaging: numberOr(row && row.packagingPerSet, 0),
      },
      sourceSummary: safeObject(row && row.sourceSummary),
      allocationSummary: safeObject(row && row.allocationSummary),
      sourceBreakdown: safeArray(row && row.sourceBreakdown),
      raw: row || {},
    }));
  }

  function resolveVehicleConfigs(runtime, config) {
    const configured = safeArray(config && config.baseline && config.baseline.vehicleConfigs).map((entry, index) => ({
      configKey: toText(entry && (entry.key || entry.id || entry.name), `config-${index + 1}`),
      configName: toText(entry && entry.name, toText(entry && (entry.key || entry.id), `Config ${index + 1}`)),
      ratio: numberOr(entry && entry.ratio, 0),
      harnessIds: uniqueHarnessIds(entry && entry.harnesses),
    }));
    if (configured.length) return normalizeVehicleConfigRatios(configured);

    const names = safeArray(runtime && runtime.master && runtime.master.configNames);
    const mix = safeArray(runtime && runtime.master && runtime.master.baselineMix);
    const fallback = names.map((name, index) => ({
      configKey: toText(name, `config-${index + 1}`),
      configName: toText(name, `Config ${index + 1}`),
      ratio: numberOr(mix[index], 0),
      harnessIds: [],
    }));
    return normalizeVehicleConfigRatios(fallback);
  }

  function uniqueHarnessIds(values) {
    return Array.from(new Set(safeArray(values).map((value) => toText(value, '')).filter(Boolean)));
  }

  function normalizeVehicleConfigRatios(configs) {
    const safeConfigs = safeArray(configs);
    const total = safeConfigs.reduce((sum, entry) => sum + Math.max(0, numberOr(entry && entry.ratio, 0)), 0);
    return safeConfigs.map((entry, index) => ({
      configKey: toText(entry && entry.configKey, `config-${index + 1}`),
      configName: toText(entry && entry.configName, `Config ${index + 1}`),
      ratio: total > 0 ? Math.max(0, numberOr(entry && entry.ratio, 0)) / total : (safeConfigs.length ? 1 / safeConfigs.length : 0),
      harnessIds: uniqueHarnessIds(entry && entry.harnessIds),
    }));
  }

  function sumPerSet(rows) {
    return safeArray(rows).reduce((result, row) => {
      const metrics = safeObject(row && row.perSet);
      result.revenue += numberOr(metrics.revenue, 0);
      result.cost += numberOr(metrics.cost, 0);
      result.material += numberOr(metrics.material, 0);
      result.directLabor += numberOr(metrics.directLabor, 0);
      result.equipment += numberOr(metrics.equipment, 0);
      result.manufacturing += numberOr(metrics.manufacturing, 0);
      result.rnd += numberOr(metrics.rnd, 0);
      result.packaging += numberOr(metrics.packaging, 0);
      return result;
    }, emptyPerSet());
  }

  function buildPerConfig(configRows, perHarness, perProject) {
    return safeArray(configRows).map((configRow) => {
      const includedHarnesses = safeArray(configRow && configRow.harnessIds).length
        ? safeArray(perHarness).filter((row) => safeArray(configRow.harnessIds).includes(toText(row && row.harnessId, '')))
        : [];
      const derivedPerSet = includedHarnesses.length ? sumPerSet(includedHarnesses) : Object.assign({}, safeObject(perProject && perProject.perSet));
      const revenue = numberOr(perProject && perProject.perSet && perProject.perSet.revenue, 0);
      const perSet = Object.assign({}, derivedPerSet, {
        revenue,
      });
      perSet.profit = numberOr(perSet.revenue, 0) - numberOr(perSet.cost, 0);
      perSet.margin = numberOr(perSet.revenue, 0) ? perSet.profit / perSet.revenue : 0;

      const volume = numberOr(perProject && perProject.totals && perProject.totals.volume, 0) * numberOr(configRow && configRow.ratio, 0);
      const totals = {
        volume,
        revenue: numberOr(perSet.revenue, 0) * volume,
        cost: numberOr(perSet.cost, 0) * volume,
        profit: numberOr(perSet.profit, 0) * volume,
        margin: numberOr(perSet.margin, 0),
      };

      return {
        configKey: toText(configRow && configRow.configKey, ''),
        configName: toText(configRow && configRow.configName, ''),
        ratio: numberOr(configRow && configRow.ratio, 0),
        harnessIds: safeArray(configRow && configRow.harnessIds),
        harnessCount: includedHarnesses.length,
        perSet,
        totals,
        sourceSummary: buildSourceSummary(includedHarnesses),
        derivedFrom: includedHarnesses.length ? 'configHarnesses' : 'projectFallback',
      };
    });
  }

  function shouldRebuildRows(rows, stageMeta) {
    if (!Array.isArray(rows)) return true;
    if (!rows.length) return false;
    if (global.G281HarnessStageCostBuilder && typeof global.G281HarnessStageCostBuilder.rowsMatchStage === 'function') {
      return !global.G281HarnessStageCostBuilder.rowsMatchStage(rows, stageMeta);
    }
    const sample = rows[0];
    if (!sample || !sample.stageMeta) return true;
    const sampleKey = toText(sample.stageMeta.lifecycleStageKey || sample.stageMeta.stageKey, '');
    const targetKey = toText(stageMeta.lifecycleStageKey || stageMeta.stageKey, '');
    if (sampleKey && targetKey) {
      return sampleKey !== targetKey;
    }
    if (stageMeta.mode === 'baseline') {
      return toText(sample.stageMeta.financialKey, '') !== toText(stageMeta.financialKey, '');
    }
    return true;
  }

  function build(harnessRowsOrRuntime, runtimeMaybe, options) {
    const safeOptions = options || {};
    const providedRows = Array.isArray(harnessRowsOrRuntime) ? harnessRowsOrRuntime : null;
    const runtime = providedRows ? resolveRuntime(runtimeMaybe) : resolveRuntime(harnessRowsOrRuntime);
    const config = resolveConfig(providedRows ? runtimeMaybe : harnessRowsOrRuntime, safeOptions);
    const stageMeta = resolveStageMeta(runtime, safeOptions.baselineKey || safeOptions.stageKey || 'quote', safeOptions);

    let effectiveRows = providedRows;
    if ((effectiveRows == null || shouldRebuildRows(effectiveRows, stageMeta)) && global.G281HarnessStageCostBuilder) {
      const stageOptions = Object.assign({}, safeOptions, { lifecycleStageKey: stageMeta.stageKey });
      effectiveRows = global.G281HarnessStageCostBuilder.build(runtime, stageMeta.stageKey, stageOptions).rows || [];
    }
    effectiveRows = safeArray(effectiveRows);

    const primaryVersion = resolveVersion(runtime, stageMeta.financialKey);
    const compareVersion = stageMeta.hasComparison ? resolveVersion(runtime, stageMeta.comparisonKey) : null;
    const primaryPerSet = buildPerSetFromVersion(primaryVersion, effectiveRows);
    const comparePerSet = stageMeta.hasComparison ? buildPerSetFromVersion(compareVersion, []) : emptyPerSet();
    const primaryTotals = buildTotalsFromVersion(runtime, primaryVersion, primaryPerSet);
    const compareTotals = stageMeta.hasComparison ? buildTotalsFromVersion(runtime, compareVersion, comparePerSet) : emptyTotals();
    const primaryLifecycle = buildLifecycleFromVersion(primaryVersion);
    const compareLifecycle = stageMeta.hasComparison ? buildLifecycleFromVersion(compareVersion) : [];

    const perSet = stageMeta.usesDelta
      ? diffObject(primaryPerSet, comparePerSet, PER_SET_KEYS)
      : primaryPerSet;
    const totals = stageMeta.usesDelta
      ? diffObject(primaryTotals, compareTotals, TOTAL_KEYS)
      : primaryTotals;
    const lifecycle = stageMeta.usesDelta
      ? diffLifecycle(primaryLifecycle, compareLifecycle)
      : primaryLifecycle;

    const weightedCheck = buildWeightedCheck(effectiveRows);
    const deltas = {
      costPerSet: numberOr(perSet.cost, 0) - numberOr(weightedCheck.totalCostPerSet, 0),
      materialPerSet: numberOr(perSet.material, 0) - numberOr(weightedCheck.materialPerSet, 0),
      laborPerSet: numberOr(perSet.directLabor, 0) - numberOr(weightedCheck.directLaborPerSet, 0),
      packagingPerSet: numberOr(perSet.packaging, 0) - numberOr(weightedCheck.packagingPerSet, 0),
      capitalPerSet: (numberOr(perSet.equipment, 0) + numberOr(perSet.rnd, 0))
        - (numberOr(weightedCheck.equipmentPerSet, 0) + numberOr(weightedCheck.rndPerSet, 0)),
    };

    const sourceSummary = buildSourceSummary(effectiveRows);
    const perHarness = buildPerHarness(effectiveRows, stageMeta);
    const lifecycleSummary = buildLifecycleSummary(lifecycle);
    lifecycleSummary.margin = lifecycleSummary.revenue ? lifecycleSummary.profit / lifecycleSummary.revenue : 0;
    const costBreakdown = {
      perSet: {
        material: numberOr(perSet.material, 0),
        directLabor: numberOr(perSet.directLabor, 0),
        manufacturing: numberOr(perSet.manufacturing, 0),
        equipment: numberOr(perSet.equipment, 0),
        rnd: numberOr(perSet.rnd, 0),
        packaging: numberOr(perSet.packaging, 0),
        totalCost: numberOr(perSet.cost, 0),
      },
      weightedCheck,
      deltas,
    };
    const perProject = {
      baselineKey: stageMeta.stageKey,
      financialKey: stageMeta.financialKey,
      comparisonKey: stageMeta.comparisonKey,
      stageMeta: Object.assign({}, stageMeta),
      harnessCount: perHarness.length,
      perSet,
      totals,
      weightedCheck,
      deltas,
      costBreakdown,
      sourceSummary,
      lifecycleCount: lifecycle.length,
      lifecycleSummary,
    };
    const perConfig = buildPerConfig(resolveVehicleConfigs(runtime, config), perHarness, perProject);
    perProject.configCount = perConfig.length;

    return {
      status: 'ready',
      baselineKey: stageMeta.stageKey,
      financialKey: stageMeta.financialKey,
      stageMeta,
      perHarness,
      perProject,
      perConfig,
      perSet,
      totals,
      lifecycle,
      lifecycleSummary,
      weightedCheck,
      deltas,
      rows: effectiveRows,
      harnessRows: effectiveRows,
      sourceSummary,
      costBreakdown,
      comparison: {
        stageKey: stageMeta.comparisonKey,
        perSet: comparePerSet,
        totals: compareTotals,
        lifecycle: compareLifecycle,
      },
      projectSummary: perProject,
    };
  }

  function render(container, rollup, options) {
    if (!container) return;
    const result = rollup && rollup.perSet ? rollup : build(options && options.runtime, null, options);
    if (!result || result.status !== 'ready') {
      container.innerHTML = '<div class="project-rollup-empty">No project rollup data.</div>';
      return;
    }

    const lifecycleRows = safeArray(result.lifecycle).map((row) => {
      return `<tr><th>${escapeHtml(row.year)}</th><td>${escapeHtml(row.volume)}</td><td>${escapeHtml(row.revenue.toFixed(2))}</td><td>${escapeHtml(row.cost.toFixed(2))}</td><td>${escapeHtml(row.profit.toFixed(2))}</td></tr>`;
    }).join('');

    container.innerHTML = `
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:10px;margin-bottom:12px;">
        <div><strong>Revenue / set</strong><div>${escapeHtml(numberOr(result.perSet.revenue, 0).toFixed(4))}</div></div>
        <div><strong>Cost / set</strong><div>${escapeHtml(numberOr(result.perSet.cost, 0).toFixed(4))}</div></div>
        <div><strong>Profit / set</strong><div>${escapeHtml(numberOr(result.perSet.profit, 0).toFixed(4))}</div></div>
        <div><strong>Margin</strong><div>${escapeHtml((numberOr(result.perSet.margin, 0) * 100).toFixed(2))}%</div></div>
      </div>
      <div style="font-size:12px;color:#9ca3af;margin-bottom:8px;">
        Stage ${escapeHtml(result.stageMeta && result.stageMeta.stageKey)} / weighted delta ${escapeHtml(numberOr(result.deltas.costPerSet, 0).toFixed(6))}
      </div>
      <div style="overflow:auto;">
        <table style="width:100%;border-collapse:collapse;font-size:12px;">
          <thead>
            <tr><th>Year</th><th>Volume</th><th>Revenue</th><th>Cost</th><th>Profit</th></tr>
          </thead>
          <tbody>${lifecycleRows}</tbody>
        </table>
      </div>
    `;
  }

  global.G281ProjectRollupBuilder = {
    build,
    render,
  };
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this);
