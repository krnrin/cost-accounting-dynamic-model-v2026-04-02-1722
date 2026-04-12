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

  function resolveVersion(runtime, baselineKey) {
    const versions = runtime && runtime.financialVersions && runtime.financialVersions.versions
      ? runtime.financialVersions.versions
      : {};
    return versions[baselineKey || 'quote'] || versions.quote || null;
  }

  function build(harnessRowsOrRuntime, runtimeMaybe, options) {
    const safeOptions = options || {};
    const baselineKey = safeOptions.baselineKey || safeOptions.stageKey || 'quote';
    const harnessRows = Array.isArray(harnessRowsOrRuntime) ? harnessRowsOrRuntime : null;
    const runtime = harnessRows ? resolveRuntime(runtimeMaybe) : resolveRuntime(harnessRowsOrRuntime);
    const effectiveRows = harnessRows || (
      global.G281HarnessStageCostBuilder
        ? global.G281HarnessStageCostBuilder.build(runtime, baselineKey, safeOptions).rows
        : []
    );
    const version = resolveVersion(runtime, baselineKey);
    const perSet = version && version.perSet ? version.perSet : {
      revenue: 0,
      cost: effectiveRows.reduce((sum, row) => sum + numberOr(row.totalCostPerSet, 0) * numberOr(row.usageRatio, 0), 0),
      profit: 0,
      margin: 0,
      material: effectiveRows.reduce((sum, row) => sum + numberOr(row.materialPerSet, 0) * numberOr(row.usageRatio, 0), 0),
      directLabor: effectiveRows.reduce((sum, row) => sum + numberOr(row.directLaborPerSet, 0) * numberOr(row.usageRatio, 0), 0),
      equipment: effectiveRows.reduce((sum, row) => sum + numberOr(row.equipmentPerSet, 0) * numberOr(row.usageRatio, 0), 0),
      manufacturing: effectiveRows.reduce((sum, row) => sum + numberOr(row.manufacturingPerSet, 0) * numberOr(row.usageRatio, 0), 0),
      rnd: effectiveRows.reduce((sum, row) => sum + numberOr(row.rndPerSet, 0) * numberOr(row.usageRatio, 0), 0),
      packaging: effectiveRows.reduce((sum, row) => sum + numberOr(row.packagingPerSet, 0) * numberOr(row.usageRatio, 0), 0),
    };
    const totals = version && version.totals ? version.totals : {
      volume: numberOr(runtime && runtime.master && safeArray(runtime.master.volumes).reduce((sum, value) => sum + numberOr(value, 0), 0), 0),
      revenue: numberOr(perSet.revenue, 0),
      cost: numberOr(perSet.cost, 0),
      profit: numberOr(perSet.profit, 0),
      margin: numberOr(perSet.margin, 0),
    };
    const lifecycle = safeArray(version && version.years).map((year, index) => {
      return {
        year,
        volume: numberOr(version && version.volumes && version.volumes[index], 0),
        revenue: numberOr(version && version.annual && version.annual.revenue && version.annual.revenue[index], 0),
        cost: numberOr(version && version.annual && version.annual.cost && version.annual.cost[index], 0),
        profit: numberOr(version && version.annual && version.annual.profit && version.annual.profit[index], 0),
        margin: numberOr(version && version.annual && version.annual.margin && version.annual.margin[index], 0),
      };
    });
    const weightedCheck = {
      totalCostPerSet: effectiveRows.reduce((sum, row) => sum + numberOr(row.totalCostPerSet, 0) * numberOr(row.usageRatio, 0), 0),
      materialPerSet: effectiveRows.reduce((sum, row) => sum + numberOr(row.materialPerSet, 0) * numberOr(row.usageRatio, 0), 0),
      directLaborPerSet: effectiveRows.reduce((sum, row) => sum + numberOr(row.directLaborPerSet, 0) * numberOr(row.usageRatio, 0), 0),
      manufacturingPerSet: effectiveRows.reduce((sum, row) => sum + numberOr(row.manufacturingPerSet, 0) * numberOr(row.usageRatio, 0), 0),
      equipmentPerSet: effectiveRows.reduce((sum, row) => sum + numberOr(row.equipmentPerSet, 0) * numberOr(row.usageRatio, 0), 0),
      rndPerSet: effectiveRows.reduce((sum, row) => sum + numberOr(row.rndPerSet, 0) * numberOr(row.usageRatio, 0), 0),
      packagingPerSet: effectiveRows.reduce((sum, row) => sum + numberOr(row.packagingPerSet, 0) * numberOr(row.usageRatio, 0), 0),
    };
    const deltas = {
      costPerSet: numberOr(perSet.cost, 0) - numberOr(weightedCheck.totalCostPerSet, 0),
      materialPerSet: numberOr(perSet.material, 0) - numberOr(weightedCheck.materialPerSet, 0),
      laborPerSet: numberOr(perSet.directLabor, 0) - numberOr(weightedCheck.directLaborPerSet, 0),
      packagingPerSet: numberOr(perSet.packaging, 0) - numberOr(weightedCheck.packagingPerSet, 0),
      capitalPerSet: (numberOr(perSet.equipment, 0) + numberOr(perSet.rnd, 0))
        - (numberOr(weightedCheck.equipmentPerSet, 0) + numberOr(weightedCheck.rndPerSet, 0)),
    };

    return {
      status: 'ready',
      baselineKey,
      perSet,
      totals,
      lifecycle,
      weightedCheck,
      deltas,
      rows: effectiveRows,
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
        Harness-weighted cost check delta: ${escapeHtml(numberOr(result.deltas.costPerSet, 0).toFixed(6))}
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
