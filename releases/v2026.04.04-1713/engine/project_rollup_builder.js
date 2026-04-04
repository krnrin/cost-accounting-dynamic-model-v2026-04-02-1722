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

  function resolveStageMeta(runtimeInput, baselineKey, options) {
    if (global.G281BomWorkbookAdapter && typeof global.G281BomWorkbookAdapter.resolveStageMeta === 'function') {
      return global.G281BomWorkbookAdapter.resolveStageMeta(runtimeInput, baselineKey, options);
    }
    const requested = toText(baselineKey || (options && options.baselineKey), 'quote');
    return {
      stageKey: requested,
      requestedStageKey: requested,
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
    return {
      volume: numberOr(totals.volume, lifecycleVolume),
      revenue: numberOr(totals.revenue, numberOr(perSet.revenue, 0)),
      cost: numberOr(totals.cost, numberOr(perSet.cost, 0)),
      profit: numberOr(totals.profit, numberOr(perSet.profit, 0)),
      margin: numberOr(totals.margin, numberOr(perSet.margin, 0)),
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
    let detailGroups = 0;
    let detailEntries = 0;
    safeArray(rows).forEach((row) => {
      const summary = safeObject(row && row.sourceSummary);
      detailGroups += numberOr(summary.detailGroupCount, 0);
      detailEntries += numberOr(summary.detailEntryCount, 0);
      safeArray(summary.sourceSheets).forEach((sheetName) => sourceSheets.add(sheetName));
    });
    return {
      harnessCount: safeArray(rows).length,
      detailGroupCount: detailGroups,
      detailEntryCount: detailEntries,
      sourceSheetCount: sourceSheets.size,
      sourceSheets: Array.from(sourceSheets),
    };
  }

  function shouldRebuildRows(rows, stageMeta) {
    if (!Array.isArray(rows)) return true;
    if (!rows.length) return false;
    if (global.G281HarnessStageCostBuilder && typeof global.G281HarnessStageCostBuilder.rowsMatchStage === 'function') {
      return !global.G281HarnessStageCostBuilder.rowsMatchStage(rows, stageMeta);
    }
    const sample = rows[0];
    return toText(sample && sample.stageMeta && sample.stageMeta.stageKey, '') !== toText(stageMeta.stageKey, '');
  }

  function build(harnessRowsOrRuntime, runtimeMaybe, options) {
    const safeOptions = options || {};
    const providedRows = Array.isArray(harnessRowsOrRuntime) ? harnessRowsOrRuntime : null;
    const runtime = providedRows ? resolveRuntime(runtimeMaybe) : resolveRuntime(harnessRowsOrRuntime);
    const stageMeta = resolveStageMeta(runtime, safeOptions.baselineKey || safeOptions.stageKey || 'quote', safeOptions);

    let effectiveRows = providedRows;
    if ((effectiveRows == null || shouldRebuildRows(effectiveRows, stageMeta)) && global.G281HarnessStageCostBuilder) {
      effectiveRows = global.G281HarnessStageCostBuilder.build(runtime, stageMeta.stageKey, safeOptions).rows || [];
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

    return {
      status: 'ready',
      baselineKey: stageMeta.stageKey,
      financialKey: stageMeta.financialKey,
      stageMeta,
      perSet,
      totals,
      lifecycle,
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
      projectSummary: {
        stageMeta,
        perSet,
        totals,
        lifecycleCount: lifecycle.length,
        sourceSummary,
        weightedCheck,
      },
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
