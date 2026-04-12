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

  const METRIC_KEYS = ['totalCost', 'material', 'directLabor', 'equipment', 'manufacturing', 'rnd', 'packaging'];

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

  function resolveStageMeta(runtimeInput, stageKey, options) {
    if (global.G281BomWorkbookAdapter && typeof global.G281BomWorkbookAdapter.resolveStageMeta === 'function') {
      return global.G281BomWorkbookAdapter.resolveStageMeta(runtimeInput, stageKey, options);
    }
    const requested = toText(stageKey || (options && options.baselineKey), 'quote');
    return {
      stageKey: requested,
      requestedStageKey: requested,
      financialKey: requested,
      bomWorkbookKey: requested,
      comparisonKey: requested === 'quote' ? 'fixed' : 'quote',
      mode: requested === 'quote' || requested === 'fixed' ? 'baseline' : 'delta',
      hasComparison: requested === 'quote' || requested === 'fixed',
      usesDelta: requested !== 'quote' && requested !== 'fixed',
    };
  }

  function emptyMetrics() {
    return {
      totalCost: 0,
      material: 0,
      directLabor: 0,
      equipment: 0,
      manufacturing: 0,
      rnd: 0,
      packaging: 0,
    };
  }

  function buildMatrixAccessor(matrix) {
    const rows = safeArray(matrix && (matrix.workbookMatrix || matrix.harnessCostMatrix));
    const byRowKey = new Map(rows.map((row) => [row.rowKey, row]));
    return {
      byRowKey,
      metric(harnessId, rowKey) {
        const row = byRowKey.get(rowKey);
        const cell = row && row.cells ? row.cells[harnessId] : null;
        return numberOr(cell && cell.value, 0);
      },
      metricsFor(harnessId) {
        return {
          totalCost: this.metric(harnessId, 'totalCost'),
          material: this.metric(harnessId, 'material'),
          directLabor: this.metric(harnessId, 'directLabor'),
          equipment: this.metric(harnessId, 'equipment'),
          manufacturing: this.metric(harnessId, 'manufacturing'),
          rnd: this.metric(harnessId, 'rnd'),
          packaging: this.metric(harnessId, 'packaging'),
        };
      },
    };
  }

  function diffMetrics(primaryMetrics, compareMetrics) {
    const delta = {};
    METRIC_KEYS.forEach((key) => {
      delta[key] = numberOr(primaryMetrics && primaryMetrics[key], 0) - numberOr(compareMetrics && compareMetrics[key], 0);
    });
    return delta;
  }

  function summarizeSourceDetails(sourceDetails, compareSourceDetails) {
    const summary = {
      detailGroupCount: 0,
      detailEntryCount: 0,
      referenceCount: 0,
      sourceSheetCount: 0,
      sourceSheets: [],
      compareDetailGroupCount: 0,
      compareDetailEntryCount: 0,
      compareReferenceCount: 0,
      compareSourceSheetCount: 0,
      compareSourceSheets: [],
      hasCapitalSource: false,
      hasPackagingSource: false,
      hasRndSource: false,
    };
    const sourceSheets = new Set();
    const compareSheets = new Set();

    Object.keys(safeObject(sourceDetails)).forEach((rowKey) => {
      const detail = sourceDetails[rowKey];
      if (!detail) return;
      summary.detailGroupCount += 1;
      summary.detailEntryCount += numberOr(detail.sourceSummary && detail.sourceSummary.detailCount, 0);
      summary.referenceCount += numberOr(detail.sourceSummary && detail.sourceSummary.referenceCount, 0);
      safeArray(detail.sourceSummary && detail.sourceSummary.sourceSheets).forEach((sheetName) => sourceSheets.add(sheetName));
      if (rowKey === 'equipment' || rowKey === 'equipmentOwned' || rowKey === 'toolingAndFixtures') summary.hasCapitalSource = true;
      if (rowKey === 'packaging') summary.hasPackagingSource = true;
      if (rowKey === 'rnd') summary.hasRndSource = true;
    });

    Object.keys(safeObject(compareSourceDetails)).forEach((rowKey) => {
      const detail = compareSourceDetails[rowKey];
      if (!detail) return;
      summary.compareDetailGroupCount += 1;
      summary.compareDetailEntryCount += numberOr(detail.sourceSummary && detail.sourceSummary.detailCount, 0);
      summary.compareReferenceCount += numberOr(detail.sourceSummary && detail.sourceSummary.referenceCount, 0);
      safeArray(detail.sourceSummary && detail.sourceSummary.sourceSheets).forEach((sheetName) => compareSheets.add(sheetName));
    });

    summary.sourceSheets = Array.from(sourceSheets);
    summary.sourceSheetCount = summary.sourceSheets.length;
    summary.compareSourceSheets = Array.from(compareSheets);
    summary.compareSourceSheetCount = summary.compareSourceSheets.length;
    return summary;
  }

  function buildBomSummary(section) {
    if (!section) return null;
    return {
      sheetName: section.sheetName,
      role: section.role,
      rowCount: numberOr(section.rowCount, 0),
      columnCount: numberOr(section.columnCount, 0),
      previewRows: safeArray(section.previewRows).slice(0, 3),
    };
  }

  function rowsMatchStage(rows, stageMeta) {
    const sample = safeArray(rows)[0];
    if (!sample || !sample.stageMeta) return false;
    return toText(sample.stageMeta.stageKey, '') === toText(stageMeta.stageKey, '')
      || (
        stageMeta.mode === 'baseline'
        && toText(sample.stageMeta.financialKey, '') === toText(stageMeta.financialKey, '')
      );
  }

  function build(runtimeInput, stageKey, options) {
    const runtime = resolveRuntime(runtimeInput);
    const safeOptions = options || {};
    const stageMeta = resolveStageMeta(runtimeInput, stageKey || safeOptions.baselineKey || safeOptions.stageKey, safeOptions);
    const primaryMatrix = global.G281FinancialWorkbookAdapter
      ? global.G281FinancialWorkbookAdapter.load(runtimeInput, stageMeta.stageKey, safeOptions)
      : null;
    if (!primaryMatrix || primaryMatrix.status !== 'ready') {
      return {
        status: 'missing',
        stageKey: stageMeta.stageKey,
        baselineKey: stageMeta.stageKey,
        stageMeta,
        rows: [],
        summary: {},
        matrix: null,
      };
    }

    const compareMatrix = stageMeta.hasComparison && stageMeta.usesDelta && global.G281FinancialWorkbookAdapter
      ? global.G281FinancialWorkbookAdapter.load(runtimeInput, stageMeta.comparisonKey, safeOptions)
      : null;

    const bomSnapshot = global.G281BomWorkbookAdapter
      ? global.G281BomWorkbookAdapter.load(runtimeInput, stageMeta.stageKey, safeOptions)
      : { harnessMap: {} };
    const compareBomSnapshot = stageMeta.hasComparison && stageMeta.usesDelta && global.G281BomWorkbookAdapter
      ? global.G281BomWorkbookAdapter.load(runtimeInput, stageMeta.comparisonKey, safeOptions)
      : { harnessMap: {} };

    const primaryAccessor = buildMatrixAccessor(primaryMatrix);
    const compareAccessor = compareMatrix && compareMatrix.status === 'ready' ? buildMatrixAccessor(compareMatrix) : null;
    const primaryColumnMap = new Map(safeArray(primaryMatrix.harnessColumns).map((column) => [column.harnessId, column]));
    const compareColumnMap = new Map(safeArray(compareMatrix && compareMatrix.harnessColumns).map((column) => [column.harnessId, column]));
    const harnessIds = Array.from(new Set(
      safeArray(primaryMatrix.harnessColumns).map((column) => column.harnessId)
        .concat(safeArray(compareMatrix && compareMatrix.harnessColumns).map((column) => column.harnessId))
    ));

    const rows = harnessIds.map((harnessId) => {
      const primaryColumn = primaryColumnMap.get(harnessId) || compareColumnMap.get(harnessId) || {};
      const compareColumn = compareColumnMap.get(harnessId) || {};
      const sourceDetails = safeObject(primaryMatrix.harnessSourceDetails && primaryMatrix.harnessSourceDetails[harnessId]);
      const compareSourceDetails = safeObject(compareMatrix && compareMatrix.harnessSourceDetails && compareMatrix.harnessSourceDetails[harnessId]);
      const primaryMetrics = primaryAccessor.metricsFor(harnessId);
      const compareMetrics = compareAccessor ? compareAccessor.metricsFor(harnessId) : emptyMetrics();
      const deltaMetrics = diffMetrics(primaryMetrics, compareMetrics);
      const stageMetrics = stageMeta.usesDelta ? deltaMetrics : primaryMetrics;
      const bomSection = safeObject(bomSnapshot.harnessMap && bomSnapshot.harnessMap[harnessId]);
      const compareBomSection = safeObject(compareBomSnapshot.harnessMap && compareBomSnapshot.harnessMap[harnessId]);

      const row = {
        harnessId,
        harnessName: primaryColumn.harnessName || primaryColumn.harnessId || harnessId,
        quantityFactor: numberOr(primaryColumn.quantityFactor, numberOr(compareColumn.quantityFactor, 0)),
        quantityFactorCompare: numberOr(compareColumn.quantityFactor, 0),
        quantityFactorDelta: numberOr(primaryColumn.quantityFactor, 0) - numberOr(compareColumn.quantityFactor, 0),
        usageRatio: numberOr(primaryColumn.usageRatio, numberOr(compareColumn.usageRatio, 0)),
        usageRatioCompare: numberOr(compareColumn.usageRatio, 0),
        usageRatioDelta: numberOr(primaryColumn.usageRatio, 0) - numberOr(compareColumn.usageRatio, 0),
        totalCostPerSet: numberOr(stageMetrics.totalCost, 0),
        materialPerSet: numberOr(stageMetrics.material, 0),
        directLaborPerSet: numberOr(stageMetrics.directLabor, 0),
        equipmentPerSet: numberOr(stageMetrics.equipment, 0),
        manufacturingPerSet: numberOr(stageMetrics.manufacturing, 0),
        rndPerSet: numberOr(stageMetrics.rnd, 0),
        packagingPerSet: numberOr(stageMetrics.packaging, 0),
        weightedContribution: numberOr(stageMetrics.totalCost, 0) * numberOr(primaryColumn.usageRatio, numberOr(compareColumn.usageRatio, 0)),
        stageMeta: {
          stageKey: stageMeta.stageKey,
          financialKey: stageMeta.financialKey,
          comparisonKey: stageMeta.comparisonKey,
          mode: stageMeta.mode,
        },
        costBreakdown: {
          totalCost: numberOr(stageMetrics.totalCost, 0),
          material: numberOr(stageMetrics.material, 0),
          directLabor: numberOr(stageMetrics.directLabor, 0),
          equipment: numberOr(stageMetrics.equipment, 0),
          manufacturing: numberOr(stageMetrics.manufacturing, 0),
          rnd: numberOr(stageMetrics.rnd, 0),
          packaging: numberOr(stageMetrics.packaging, 0),
        },
        actualMetrics: primaryMetrics,
        compareMetrics,
        deltaMetrics,
        directLaborDetails: [
          sourceDetails.directLabor,
          sourceDetails.directLaborOpen,
          sourceDetails.directLaborAssembly,
          sourceDetails.directLaborOther,
        ].filter(Boolean),
        equipmentDetails: [
          sourceDetails.equipment,
          sourceDetails.equipmentOwned,
        ].filter(Boolean),
        toolingDetails: [
          sourceDetails.toolingAndFixtures,
        ].filter(Boolean),
        capitalDetails: [
          sourceDetails.equipment,
          sourceDetails.equipmentOwned,
          sourceDetails.toolingAndFixtures,
        ].filter(Boolean),
        manufacturingDetails: [
          sourceDetails.manufacturing,
          sourceDetails.manufacturingEnergy,
          sourceDetails.manufacturingRepair,
          sourceDetails.manufacturingLowValue,
          sourceDetails.manufacturingIndirectLabor,
          sourceDetails.manufacturingWelfare,
          sourceDetails.manufacturingManagement,
          sourceDetails.manufacturingOther,
        ].filter(Boolean),
        rndDetails: [
          sourceDetails.rnd,
        ].filter(Boolean),
        packagingDetails: [
          sourceDetails.packaging,
        ].filter(Boolean),
        sourceSummary: summarizeSourceDetails(sourceDetails, compareSourceDetails),
        sourceDetails,
        compareSourceDetails,
        bomSummary: buildBomSummary(bomSection.sheetName ? bomSection : null),
        compareBomSummary: buildBomSummary(compareBomSection.sheetName ? compareBomSection : null),
      };
      return row;
    });

    const weightedBreakdown = rows.reduce((accumulator, row) => {
      const ratio = numberOr(row.usageRatio, 0);
      accumulator.totalCost += numberOr(row.totalCostPerSet, 0) * ratio;
      accumulator.material += numberOr(row.materialPerSet, 0) * ratio;
      accumulator.directLabor += numberOr(row.directLaborPerSet, 0) * ratio;
      accumulator.equipment += numberOr(row.equipmentPerSet, 0) * ratio;
      accumulator.manufacturing += numberOr(row.manufacturingPerSet, 0) * ratio;
      accumulator.rnd += numberOr(row.rndPerSet, 0) * ratio;
      accumulator.packaging += numberOr(row.packagingPerSet, 0) * ratio;
      return accumulator;
    }, emptyMetrics());

    const summary = {
      stageMeta: {
        stageKey: stageMeta.stageKey,
        financialKey: stageMeta.financialKey,
        comparisonKey: stageMeta.comparisonKey,
        mode: stageMeta.mode,
      },
      harnessCount: rows.length,
      weightedUsageRatio: rows.reduce((sum, row) => sum + numberOr(row.usageRatio, 0), 0),
      weightedTotalCostPerSet: weightedBreakdown.totalCost,
      materialPerSet: weightedBreakdown.material,
      directLaborPerSet: weightedBreakdown.directLabor,
      manufacturingPerSet: weightedBreakdown.manufacturing,
      equipmentPerSet: weightedBreakdown.equipment,
      rndPerSet: weightedBreakdown.rnd,
      packagingPerSet: weightedBreakdown.packaging,
      weightedBreakdown,
      sourceCoverage: {
        harnessCount: rows.length,
        withCapitalSource: rows.filter((row) => row.sourceSummary && row.sourceSummary.hasCapitalSource).length,
        withPackagingSource: rows.filter((row) => row.sourceSummary && row.sourceSummary.hasPackagingSource).length,
        withRndSource: rows.filter((row) => row.sourceSummary && row.sourceSummary.hasRndSource).length,
        totalDetailGroups: rows.reduce((sum, row) => sum + numberOr(row.sourceSummary && row.sourceSummary.detailGroupCount, 0), 0),
        totalDetailEntries: rows.reduce((sum, row) => sum + numberOr(row.sourceSummary && row.sourceSummary.detailEntryCount, 0), 0),
      },
    };

    return {
      status: 'ready',
      stageKey: stageMeta.stageKey,
      baselineKey: stageMeta.stageKey,
      financialKey: stageMeta.financialKey,
      stageMeta,
      matrix: Object.assign({}, primaryMatrix, {
        stageMeta,
        comparisonMatrix: compareMatrix && compareMatrix.status === 'ready' ? compareMatrix : null,
      }),
      rows,
      summary,
    };
  }

  function render(container, stageCost, options) {
    if (!container) return;
    const result = stageCost && stageCost.rows ? stageCost : build(options && options.runtime, options && options.stageKey, options);
    if (!result || result.status !== 'ready') {
      container.innerHTML = '<div class="harness-stage-empty">No harness-stage cost data.</div>';
      return;
    }

    const rows = result.rows.map((row) => {
      return `
        <tr>
          <th>${escapeHtml(row.harnessId)}</th>
          <td>${escapeHtml(row.quantityFactor)}</td>
          <td>${escapeHtml(row.usageRatio)}</td>
          <td>${escapeHtml(row.materialPerSet.toFixed(4))}</td>
          <td>${escapeHtml(row.directLaborPerSet.toFixed(4))}</td>
          <td>${escapeHtml(row.manufacturingPerSet.toFixed(4))}</td>
          <td>${escapeHtml((row.equipmentPerSet + row.rndPerSet).toFixed(4))}</td>
          <td>${escapeHtml(row.packagingPerSet.toFixed(4))}</td>
          <td>${escapeHtml(row.totalCostPerSet.toFixed(4))}</td>
        </tr>
      `;
    }).join('');

    container.innerHTML = `
      <div style="margin-bottom:8px;font-size:12px;color:#9ca3af;">
        Harness-first stage ${escapeHtml(result.stageKey)} / workbook ${escapeHtml(result.financialKey || result.stageKey)} / rows ${result.rows.length}
      </div>
      <div style="overflow:auto;">
        <table style="width:100%;border-collapse:collapse;font-size:12px;">
          <thead>
            <tr>
              <th style="text-align:left;">Harness</th>
              <th>Qty</th>
              <th>Mix</th>
              <th>Material</th>
              <th>Labor</th>
              <th>Mfg</th>
              <th>Capex+R&amp;D</th>
              <th>Packaging</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;
  }

  global.G281HarnessStageCostBuilder = {
    build,
    render,
    rowsMatchStage,
  };
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this);
