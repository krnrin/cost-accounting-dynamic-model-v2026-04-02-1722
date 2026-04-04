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

  function resolveConfig(explicitConfig) {
    if (explicitConfig) return explicitConfig;
    return global.ConfigLoader && typeof global.ConfigLoader.active === 'function'
      ? global.ConfigLoader.active()
      : null;
  }

  function resolveStageKey(stageKey, config, fallback) {
    if (global.ConfigLoader && typeof global.ConfigLoader.canonicalStageKey === 'function') {
      return global.ConfigLoader.canonicalStageKey(stageKey, config) || toText(stageKey, fallback);
    }
    return toText(stageKey, fallback);
  }

  function defaultTemplateKey(config) {
    if (global.ConfigLoader && typeof global.ConfigLoader.defaultCustomerTemplateKey === 'function') {
      return toText(global.ConfigLoader.defaultCustomerTemplateKey(config), 'customer_quote_standard');
    }
    return toText(
      config && (config.defaultCustomerTemplateKey || config.defaultCustomerTemplateId || config.defaultQuoteTemplateKey),
      'customer_quote_standard'
    );
  }

  function resolveStageMeta(runtimeInput, stageKey, options) {
    if (global.G281BomWorkbookAdapter && typeof global.G281BomWorkbookAdapter.resolveStageMeta === 'function') {
      return global.G281BomWorkbookAdapter.resolveStageMeta(runtimeInput, stageKey, options);
    }
    const config = resolveConfig(options && options.config);
    const requested = resolveStageKey(
      stageKey || (options && options.stageKey) || (options && options.baselineKey),
      config,
      'quotation'
    );
    return {
      stageKey: requested,
      requestedStageKey: requested,
      financialKey: toText(options && options.baselineKey, requested),
      comparisonKey: toText(options && options.comparisonKey, requested === 'quotation' ? 'fixed' : 'quotation'),
      mode: requested === 'quotation' || requested === 'fixed' ? 'baseline' : 'delta',
      hasComparison: true,
      usesDelta: requested !== 'quotation' && requested !== 'fixed',
    };
  }

  function valuesDiffer(left, right) {
    const leftNumeric = Number(left);
    const rightNumeric = Number(right);
    if (Number.isFinite(leftNumeric) && Number.isFinite(rightNumeric)) {
      return Math.abs(leftNumeric - rightNumeric) > 1e-9;
    }
    return left !== right;
  }

  function templateBuildCompat(runtimeInput, templateKey, baselineKey, options) {
    const adapter = global.G281CustomerQuoteTemplateAdapter;
    if (!adapter) return { fields: [] };

    if (typeof adapter.buildPreview === 'function') {
      const runtime = resolveRuntime(runtimeInput);
      const config = resolveConfig(options && options.config);
      return adapter.buildPreview({
        config,
        runtime,
        templateKey: toText(templateKey, defaultTemplateKey(config)),
        baselineKey,
        stageKey: resolveStageKey(options && options.stageKey, config, baselineKey || 'quotation'),
        projectRollup: options && options.projectRollup,
      }) || { fields: [] };
    }

    return { fields: [] };
  }

  function ensureTemplateAdapterCompat() {
    const adapter = global.G281CustomerQuoteTemplateAdapter;
    if (!adapter || typeof adapter.build === 'function' || typeof adapter.buildPreview !== 'function') return;
    adapter.build = function buildCompat(runtimeInput, templateKey, baselineKey, options) {
      return templateBuildCompat(runtimeInput, templateKey, baselineKey, options);
    };
  }

  function extractRowMetrics(row) {
    return {
      quantityFactor: numberOr(row && row.quantityFactor, 0),
      usageRatio: numberOr(row && row.usageRatio, 0),
      totalCost: numberOr(row && row.totalCostPerSet, 0),
      material: numberOr(row && row.materialPerSet, 0),
      directLabor: numberOr(row && row.directLaborPerSet, 0),
      manufacturing: numberOr(row && row.manufacturingPerSet, 0),
      equipment: numberOr(row && row.equipmentPerSet, 0),
      rnd: numberOr(row && row.rndPerSet, 0),
      packaging: numberOr(row && row.packagingPerSet, 0),
    };
  }

  function diffMetrics(current, compare) {
    return {
      quantityFactor: numberOr(current && current.quantityFactor, 0) - numberOr(compare && compare.quantityFactor, 0),
      usageRatio: numberOr(current && current.usageRatio, 0) - numberOr(compare && compare.usageRatio, 0),
      totalCost: numberOr(current && current.totalCost, 0) - numberOr(compare && compare.totalCost, 0),
      material: numberOr(current && current.material, 0) - numberOr(compare && compare.material, 0),
      directLabor: numberOr(current && current.directLabor, 0) - numberOr(compare && compare.directLabor, 0),
      manufacturing: numberOr(current && current.manufacturing, 0) - numberOr(compare && compare.manufacturing, 0),
      equipment: numberOr(current && current.equipment, 0) - numberOr(compare && compare.equipment, 0),
      rnd: numberOr(current && current.rnd, 0) - numberOr(compare && compare.rnd, 0),
      packaging: numberOr(current && current.packaging, 0) - numberOr(compare && compare.packaging, 0),
    };
  }

  function hasMeaningfulDiff(delta) {
    return Math.abs(numberOr(delta && delta.totalCost, 0)) > 1e-9
      || Math.abs(numberOr(delta && delta.material, 0)) > 1e-9
      || Math.abs(numberOr(delta && delta.directLabor, 0)) > 1e-9
      || Math.abs(numberOr(delta && delta.packaging, 0)) > 1e-9
      || Math.abs(numberOr(delta && delta.equipment, 0)) > 1e-9
      || Math.abs(numberOr(delta && delta.rnd, 0)) > 1e-9
      || Math.abs(numberOr(delta && delta.usageRatio, 0)) > 1e-9
      || Math.abs(numberOr(delta && delta.quantityFactor, 0)) > 1e-9;
  }

  function buildSourceSummary(row, compareRow) {
    const current = safeObject(row && row.sourceSummary);
    const compare = safeObject(compareRow && compareRow.sourceSummary);
    return {
      detailGroupCount: numberOr(current.detailGroupCount, 0),
      detailEntryCount: numberOr(current.detailEntryCount, 0),
      sourceSheetCount: numberOr(current.sourceSheetCount, 0),
      sourceSheets: safeArray(current.sourceSheets),
      compareDetailGroupCount: numberOr(compare.detailGroupCount, 0),
      compareDetailEntryCount: numberOr(compare.detailEntryCount, 0),
      compareSourceSheetCount: numberOr(compare.sourceSheetCount, 0),
      compareSourceSheets: safeArray(compare.sourceSheets),
    };
  }

  function buildProjectMetricEntries(primaryRollup, compareRollup) {
    return PER_SET_KEYS.reduce((accumulator, key) => {
      accumulator[key] = {
        from: numberOr(compareRollup && compareRollup.perSet && compareRollup.perSet[key], 0),
        to: numberOr(primaryRollup && primaryRollup.perSet && primaryRollup.perSet[key], 0),
        delta: numberOr(primaryRollup && primaryRollup.perSet && primaryRollup.perSet[key], 0)
          - numberOr(compareRollup && compareRollup.perSet && compareRollup.perSet[key], 0),
      };
      return accumulator;
    }, {});
  }

  function buildMetricEntries(current, compare, keys) {
    return safeArray(keys).reduce((accumulator, key) => {
      accumulator[key] = {
        from: numberOr(compare && compare[key], 0),
        to: numberOr(current && current[key], 0),
        delta: numberOr(current && current[key], 0) - numberOr(compare && compare[key], 0),
      };
      return accumulator;
    }, {});
  }

  function resolveProjectSurface(rollup) {
    const project = safeObject(rollup && (rollup.perProject || rollup.projectSummary));
    return {
      perSet: safeObject(project.perSet || (rollup && rollup.perSet)),
      totals: safeObject(project.totals || (rollup && rollup.totals)),
      sourceSummary: safeObject(project.sourceSummary || (rollup && rollup.sourceSummary)),
      stageMeta: safeObject(project.stageMeta || (rollup && rollup.stageMeta)),
    };
  }

  function buildProjectSummaryDiff(primaryRollup, compareRollup, stageMeta, primaryKey, comparisonKey) {
    const primarySurface = resolveProjectSurface(primaryRollup);
    const compareSurface = resolveProjectSurface(compareRollup);
    const perSetMetrics = buildMetricEntries(primarySurface.perSet, compareSurface.perSet, PER_SET_KEYS);
    const totalMetrics = buildMetricEntries(primarySurface.totals, compareSurface.totals, TOTAL_KEYS);
    return {
      stageMeta: {
        stageKey: stageMeta.stageKey,
        financialKey: primaryKey,
        comparisonKey,
        mode: stageMeta.mode,
      },
      from: {
        perSet: compareSurface.perSet,
        totals: compareSurface.totals,
        sourceSummary: compareSurface.sourceSummary,
      },
      to: {
        perSet: primarySurface.perSet,
        totals: primarySurface.totals,
        sourceSummary: primarySurface.sourceSummary,
      },
      delta: {
        perSet: PER_SET_KEYS.reduce((accumulator, key) => {
          accumulator[key] = perSetMetrics[key].delta;
          return accumulator;
        }, {}),
        totals: TOTAL_KEYS.reduce((accumulator, key) => {
          accumulator[key] = totalMetrics[key].delta;
          return accumulator;
        }, {}),
      },
      perSetMetrics,
      totalsMetrics: totalMetrics,
      costPerSetDelta: numberOr(primarySurface.perSet.cost, 0) - numberOr(compareSurface.perSet.cost, 0),
      profitPerSetDelta: numberOr(primarySurface.perSet.profit, 0) - numberOr(compareSurface.perSet.profit, 0),
      revenuePerSetDelta: numberOr(primarySurface.perSet.revenue, 0) - numberOr(compareSurface.perSet.revenue, 0),
      marginDelta: numberOr(primarySurface.perSet.margin, 0) - numberOr(compareSurface.perSet.margin, 0),
    };
  }

  function matchesRollup(rollup, financialKey) {
    if (!rollup || !rollup.perSet) return false;
    if (toText(rollup.financialKey, '') === toText(financialKey, '')) return true;
    return toText(rollup.baselineKey, '') === toText(financialKey, '');
  }

  function buildRecoveryImpact(bomChanges) {
    const rows = safeArray(bomChanges).map((change, index) => ({
      changeId: toText(change && (change.changeId || change.id), `change-${index + 1}`),
      harnessId: toText(change && (change.harnessId || change.customerPartNumber), ''),
      partNumber: toText(change && change.partNumber, ''),
      obsoleteValue: numberOr(change && change.obsoleteValue, 0),
      equipmentDelta: numberOr(change && change.equipmentDelta, 0),
      laborDelta: numberOr(change && change.laborDelta, 0),
      packagingDelta: numberOr(change && change.packagingDelta, 0),
      note: toText(change && (change.note || change.reason), ''),
      raw: change || {},
    }));
    return {
      obsoleteValue: rows.reduce((sum, row) => sum + numberOr(row.obsoleteValue, 0), 0),
      equipmentDelta: rows.reduce((sum, row) => sum + numberOr(row.equipmentDelta, 0), 0),
      laborDelta: rows.reduce((sum, row) => sum + numberOr(row.laborDelta, 0), 0),
      packagingDelta: rows.reduce((sum, row) => sum + numberOr(row.packagingDelta, 0), 0),
      rowCount: rows.length,
      rows,
    };
  }

  function build(runtimeInput, stageKey, options) {
    ensureTemplateAdapterCompat();

    const runtime = resolveRuntime(runtimeInput);
    const safeOptions = options || {};
    const config = resolveConfig(safeOptions.config);
    const stageMeta = resolveStageMeta(
      runtimeInput,
      stageKey || safeOptions.stageKey || safeOptions.baselineKey,
      Object.assign({}, safeOptions, { config: config })
    );
    const primaryKey = toText(safeOptions.baselineKey, stageMeta.financialKey || stageMeta.stageKey);
    const comparisonKey = toText(
      safeOptions.comparisonKey,
      stageMeta.comparisonKey || (primaryKey === 'quotation' ? 'fixed' : 'quotation')
    );
    const templateKey = toText(safeOptions.templateKey, defaultTemplateKey(config));

    const primaryStage = global.G281HarnessStageCostBuilder
      ? global.G281HarnessStageCostBuilder.build(runtime, primaryKey, safeOptions)
      : { rows: [] };
    const comparisonStage = global.G281HarnessStageCostBuilder
      ? global.G281HarnessStageCostBuilder.build(runtime, comparisonKey, safeOptions)
      : { rows: [] };

    const primaryMap = new Map(safeArray(primaryStage.rows).map((row) => [row.harnessId, row]));
    const comparisonMap = new Map(safeArray(comparisonStage.rows).map((row) => [row.harnessId, row]));
    const harnessIds = Array.from(new Set(
      safeArray(primaryStage.rows).map((row) => row.harnessId)
        .concat(safeArray(comparisonStage.rows).map((row) => row.harnessId))
    ));

    const harnessDiffs = harnessIds.map((harnessId) => {
      const currentRow = primaryMap.get(harnessId) || null;
      const compareRow = comparisonMap.get(harnessId) || null;
      const toMetrics = extractRowMetrics(currentRow);
      const fromMetrics = extractRowMetrics(compareRow);
      const delta = diffMetrics(toMetrics, fromMetrics);
      return {
        harnessId,
        harnessName: toText(currentRow && currentRow.harnessName, compareRow && compareRow.harnessName || harnessId),
        stageMeta: {
          stageKey: stageMeta.stageKey,
          financialKey: primaryKey,
          comparisonKey,
          mode: stageMeta.mode,
        },
        from: fromMetrics,
        to: toMetrics,
        delta,
        totalCostDelta: delta.totalCost,
        materialDelta: delta.material,
        laborDelta: delta.directLabor,
        packagingDelta: delta.packaging,
        equipmentDelta: delta.equipment + delta.rnd,
        quantityFactorDelta: delta.quantityFactor,
        usageRatioDelta: delta.usageRatio,
        sourceSummary: buildSourceSummary(currentRow, compareRow),
      };
    }).filter((row) => hasMeaningfulDiff(row.delta))
      .sort((left, right) => Math.abs(numberOr(right.totalCostDelta, 0)) - Math.abs(numberOr(left.totalCostDelta, 0)));

    const primaryRollup = matchesRollup(safeOptions.projectRollup, primaryKey)
      ? safeOptions.projectRollup
      : (global.G281ProjectRollupBuilder ? global.G281ProjectRollupBuilder.build(primaryStage.rows || [], runtime, { baselineKey: primaryKey }) : { perSet: {} });
    const comparisonRollup = matchesRollup(safeOptions.compareProjectRollup, comparisonKey)
      ? safeOptions.compareProjectRollup
      : (global.G281ProjectRollupBuilder ? global.G281ProjectRollupBuilder.build(comparisonStage.rows || [], runtime, { baselineKey: comparisonKey }) : { perSet: {} });
    const projectSummaryDiff = buildProjectSummaryDiff(primaryRollup, comparisonRollup, stageMeta, primaryKey, comparisonKey);

    const templateAdapter = global.G281CustomerQuoteTemplateAdapter;
    const primaryTemplate = templateAdapter && typeof templateAdapter.build === 'function'
      ? templateAdapter.build(runtime, templateKey, primaryKey, {
        config,
        projectRollup: primaryRollup,
        stageKey: stageMeta.stageKey,
        baselineKey: primaryKey,
      })
      : { fields: [] };
    const comparisonTemplate = templateAdapter && typeof templateAdapter.build === 'function'
      ? templateAdapter.build(runtime, templateKey, comparisonKey, {
        config,
        projectRollup: comparisonRollup,
        stageKey: comparisonKey,
        baselineKey: comparisonKey,
      })
      : { fields: [] };
    const primaryTemplateMap = new Map(safeArray(primaryTemplate.fields).map((field) => [field.cellKey, field]));
    const compareTemplateMap = new Map(safeArray(comparisonTemplate.fields).map((field) => [field.cellKey, field]));
    const templateKeys = Array.from(new Set(
      safeArray(primaryTemplate.fields).map((field) => field.cellKey)
        .concat(safeArray(comparisonTemplate.fields).map((field) => field.cellKey))
    ));
    const customerTemplateDiffs = templateKeys.map((cellKey) => {
      const field = primaryTemplateMap.get(cellKey) || {};
      const other = compareTemplateMap.get(cellKey) || {};
      const numericDelta = Number(field.value) - Number(other.value);
      return {
        cellKey: toText(field.cellKey, other.cellKey),
        label: toText(field.label, other.label),
        valueKey: toText(field.valueKey, other.valueKey),
        value: field.value,
        compareValue: other.value,
        fromValue: other.value,
        toValue: field.value,
        delta: Number.isFinite(numericDelta) ? numericDelta : null,
      };
    }).filter((field) => valuesDiffer(field.value, field.compareValue));

    const bomChanges = safeArray(runtime && runtime.bomChanges);
    const recoveryImpactDiff = Object.assign({
      stageMeta: {
        stageKey: stageMeta.stageKey,
        financialKey: primaryKey,
        comparisonKey,
        mode: stageMeta.mode,
      },
    }, buildRecoveryImpact(bomChanges));
    const projectDiffs = {
      summary: projectSummaryDiff,
      perSet: safeObject(projectSummaryDiff.delta && projectSummaryDiff.delta.perSet),
      totals: safeObject(projectSummaryDiff.delta && projectSummaryDiff.delta.totals),
    };
    const recoveryDiffs = {
      summary: recoveryImpactDiff,
      rows: safeArray(recoveryImpactDiff.rows),
    };

    return {
      status: 'ready',
      stageKey: stageMeta.stageKey,
      financialKey: primaryKey,
      comparisonKey,
      stageMeta,
      templateKey,
      singleHarnessDiffs: harnessDiffs,
      harnessDiffs,
      projectSummaryDiff,
      projectDiff: projectSummaryDiff,
      projectDiffs,
      customerTemplateDiffs,
      templateDiffs: customerTemplateDiffs,
      recoveryImpactDiff,
      recoveryImpact: recoveryImpactDiff,
      recoveryDiffs,
      bomChanges,
      summary: {
        harnessDiffCount: harnessDiffs.length,
        templateDiffCount: customerTemplateDiffs.length,
        obsoleteValue: recoveryImpactDiff.obsoleteValue,
        projectCostPerSetDelta: projectSummaryDiff.costPerSetDelta,
        projectProfitPerSetDelta: projectSummaryDiff.profitPerSetDelta,
      },
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
            Labor delta ${escapeHtml(numberOr(result.recoveryImpact && result.recoveryImpact.laborDelta, 0).toFixed(2))}
          </div>
        </section>
      </div>
      <div style="overflow:auto;margin-top:12px;">
        <table style="width:100%;border-collapse:collapse;font-size:12px;">
          <thead><tr><th>Harness</th><th>Total</th><th>Material</th><th>Labor</th></tr></thead>
          <tbody>${harnessRows}</tbody>
        </table>
      </div>
      <ul style="margin-top:12px;padding-left:18px;">${templateRows || '<li>No template delta.</li>'}</ul>
    `;
  }

  ensureTemplateAdapterCompat();

  global.G281ChangeImpactBuilder = {
    build,
    render,
  };
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this);
