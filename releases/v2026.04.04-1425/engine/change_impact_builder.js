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

  function build(runtimeInput, stageKey, options) {
    const runtime = resolveRuntime(runtimeInput);
    const safeOptions = options || {};
    const baselineKey = stageKey || safeOptions.stageKey || 'quote';
    const comparisonKey = safeOptions.comparisonKey || (baselineKey === 'quote' ? 'fixed' : 'quote');
    const templateKey = toText(safeOptions.templateKey, 'customer_quote_standard');
    const baselineStage = global.G281HarnessStageCostBuilder
      ? global.G281HarnessStageCostBuilder.build(runtime, baselineKey, safeOptions)
      : { rows: [] };
    const comparisonStage = global.G281HarnessStageCostBuilder
      ? global.G281HarnessStageCostBuilder.build(runtime, comparisonKey, safeOptions)
      : { rows: [] };
    const comparisonMap = new Map(safeArray(comparisonStage.rows).map((row) => [row.harnessId, row]));
    const harnessDiffs = safeArray(baselineStage.rows).map((row) => {
      const other = comparisonMap.get(row.harnessId) || {};
      return {
        harnessId: row.harnessId,
        totalCostDelta: numberOr(row.totalCostPerSet, 0) - numberOr(other.totalCostPerSet, 0),
        materialDelta: numberOr(row.materialPerSet, 0) - numberOr(other.materialPerSet, 0),
        laborDelta: numberOr(row.directLaborPerSet, 0) - numberOr(other.directLaborPerSet, 0),
        packagingDelta: numberOr(row.packagingPerSet, 0) - numberOr(other.packagingPerSet, 0),
        equipmentDelta: (numberOr(row.equipmentPerSet, 0) + numberOr(row.rndPerSet, 0))
          - (numberOr(other.equipmentPerSet, 0) + numberOr(other.rndPerSet, 0)),
      };
    }).filter((row) => row.totalCostDelta !== 0 || row.materialDelta !== 0 || row.laborDelta !== 0 || row.packagingDelta !== 0 || row.equipmentDelta !== 0);

    const quoteVersion = runtime && runtime.financialVersions && runtime.financialVersions.versions
      ? runtime.financialVersions.versions[baselineKey]
      : null;
    const compareVersion = runtime && runtime.financialVersions && runtime.financialVersions.versions
      ? runtime.financialVersions.versions[comparisonKey]
      : null;
    const projectDiff = quoteVersion && compareVersion ? {
      revenuePerSetDelta: numberOr(quoteVersion.perSet && quoteVersion.perSet.revenue, 0) - numberOr(compareVersion.perSet && compareVersion.perSet.revenue, 0),
      costPerSetDelta: numberOr(quoteVersion.perSet && quoteVersion.perSet.cost, 0) - numberOr(compareVersion.perSet && compareVersion.perSet.cost, 0),
      profitPerSetDelta: numberOr(quoteVersion.perSet && quoteVersion.perSet.profit, 0) - numberOr(compareVersion.perSet && compareVersion.perSet.profit, 0),
      marginDelta: numberOr(quoteVersion.perSet && quoteVersion.perSet.margin, 0) - numberOr(compareVersion.perSet && compareVersion.perSet.margin, 0),
    } : null;

    const templateBase = global.G281CustomerQuoteTemplateAdapter
      ? global.G281CustomerQuoteTemplateAdapter.build(runtime, templateKey, baselineKey, safeOptions)
      : { fields: [] };
    const templateCompare = global.G281CustomerQuoteTemplateAdapter
      ? global.G281CustomerQuoteTemplateAdapter.build(runtime, templateKey, comparisonKey, safeOptions)
      : { fields: [] };
    const compareTemplateMap = new Map(safeArray(templateCompare.fields).map((field) => [field.cellKey, field]));
    const templateDiffs = safeArray(templateBase.fields).map((field) => {
      const other = compareTemplateMap.get(field.cellKey) || {};
      return {
        cellKey: field.cellKey,
        label: field.label,
        value: field.value,
        compareValue: other.value,
      };
    }).filter((field) => field.value !== field.compareValue);

    const bomChanges = safeArray(runtime && runtime.bomChanges);
    const recoveryImpact = {
      obsoleteValue: bomChanges.reduce((sum, change) => sum + numberOr(change && change.obsoleteValue, 0), 0),
      equipmentDelta: bomChanges.reduce((sum, change) => sum + numberOr(change && change.equipmentDelta, 0), 0),
      laborDelta: bomChanges.reduce((sum, change) => sum + numberOr(change && change.laborDelta, 0), 0),
      packagingDelta: bomChanges.reduce((sum, change) => sum + numberOr(change && change.packagingDelta, 0), 0),
    };

    return {
      status: 'ready',
      stageKey: baselineKey,
      comparisonKey,
      harnessDiffs,
      projectDiff,
      templateDiffs,
      recoveryImpact,
      bomChanges,
    };
  }

  function render(container, impact, options) {
    if (!container) return;
    const result = impact && impact.stageKey ? impact : build(options && options.runtime, options && options.stageKey, options);
    if (!result || result.status !== 'ready') {
      container.innerHTML = '<div class="change-impact-empty">No change impact data.</div>';
      return;
    }

    const harnessRows = safeArray(result.harnessDiffs).slice(0, 6).map((row) => {
      return `<tr><th>${escapeHtml(row.harnessId)}</th><td>${escapeHtml(row.totalCostDelta.toFixed(4))}</td><td>${escapeHtml(row.materialDelta.toFixed(4))}</td><td>${escapeHtml(row.laborDelta.toFixed(4))}</td></tr>`;
    }).join('');
    const templateRows = safeArray(result.templateDiffs).slice(0, 6).map((row) => {
      return `<li>${escapeHtml(row.cellKey)} ${escapeHtml(row.label)}: ${escapeHtml(row.value)} vs ${escapeHtml(row.compareValue)}</li>`;
    }).join('');

    container.innerHTML = `
      <div style="margin-bottom:8px;font-size:12px;color:#9ca3af;">
        Compare ${escapeHtml(result.stageKey)} vs ${escapeHtml(result.comparisonKey)}
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px;">
        <section>
          <strong>Project diff</strong>
          <div style="font-size:12px;color:#9ca3af;margin-top:6px;">
            Cost/set ${escapeHtml(numberOr(result.projectDiff && result.projectDiff.costPerSetDelta, 0).toFixed(4))}
          </div>
          <div style="font-size:12px;color:#9ca3af;">
            Profit/set ${escapeHtml(numberOr(result.projectDiff && result.projectDiff.profitPerSetDelta, 0).toFixed(4))}
          </div>
        </section>
        <section>
          <strong>Recovery</strong>
          <div style="font-size:12px;color:#9ca3af;margin-top:6px;">
            Obsolete ${escapeHtml(numberOr(result.recoveryImpact && result.recoveryImpact.obsoleteValue, 0).toFixed(2))}
          </div>
          <div style="font-size:12px;color:#9ca3af;">
            Labor Δ ${escapeHtml(numberOr(result.recoveryImpact && result.recoveryImpact.laborDelta, 0).toFixed(2))}
          </div>
        </section>
      </div>
      <div style="overflow:auto;margin-top:12px;">
        <table style="width:100%;border-collapse:collapse;font-size:12px;">
          <thead><tr><th>Harness</th><th>Total Δ</th><th>Material Δ</th><th>Labor Δ</th></tr></thead>
          <tbody>${harnessRows}</tbody>
        </table>
      </div>
      <ul style="margin-top:12px;padding-left:18px;">${templateRows || '<li>No template delta.</li>'}</ul>
    `;
  }

  global.G281ChangeImpactBuilder = {
    build,
    render,
  };
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this);
