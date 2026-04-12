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

  function metric(matrix, harnessId, rowKey) {
    const row = safeArray(matrix && matrix.harnessCostMatrix).find((item) => item.rowKey === rowKey);
    const cell = row && row.cells ? row.cells[harnessId] : null;
    return numberOr(cell && cell.value, 0);
  }

  function build(runtimeInput, stageKey, options) {
    const runtime = resolveRuntime(runtimeInput);
    const safeOptions = options || {};
    const baselineKey = stageKey || safeOptions.baselineKey || 'quote';
    const matrix = global.G281FinancialWorkbookAdapter
      ? global.G281FinancialWorkbookAdapter.load(runtimeInput, baselineKey, safeOptions)
      : null;
    if (!matrix || matrix.status !== 'ready') {
      return { status: 'missing', stageKey: baselineKey, baselineKey, rows: [], summary: {}, matrix: null };
    }

    const bomSnapshot = global.G281BomWorkbookAdapter
      ? global.G281BomWorkbookAdapter.load(runtimeInput, baselineKey, safeOptions)
      : { harnessMap: {} };

    const rows = matrix.harnessColumns.map((column) => {
      const sourceDetails = matrix.harnessSourceDetails[column.harnessId] || {};
      const bomSection = bomSnapshot.harnessMap[column.harnessId] || null;
      const totalCostPerSet = metric(matrix, column.harnessId, 'totalCost');
      const materialPerSet = metric(matrix, column.harnessId, 'material');
      const directLaborPerSet = metric(matrix, column.harnessId, 'directLabor');
      const equipmentPerSet = metric(matrix, column.harnessId, 'equipment');
      const manufacturingPerSet = metric(matrix, column.harnessId, 'manufacturing');
      const rndPerSet = metric(matrix, column.harnessId, 'rnd');
      const packagingPerSet = metric(matrix, column.harnessId, 'packaging');
      const quantityFactor = numberOr(column.quantityFactor, 0);
      const usageRatio = numberOr(column.usageRatio, 0);
      return {
        harnessId: column.harnessId,
        harnessName: column.harnessName || column.harnessId,
        quantityFactor,
        usageRatio,
        totalCostPerSet,
        materialPerSet,
        directLaborPerSet,
        equipmentPerSet,
        manufacturingPerSet,
        rndPerSet,
        packagingPerSet,
        weightedContribution: totalCostPerSet * usageRatio,
        directLaborDetails: [
          sourceDetails.directLabor,
          sourceDetails.directLaborOpen,
          sourceDetails.directLaborAssembly,
          sourceDetails.directLaborOther,
        ].filter(Boolean),
        equipmentDetails: [
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
        sourceDetails,
        bomSummary: bomSection ? {
          sheetName: bomSection.sheetName,
          role: bomSection.role,
          rowCount: bomSection.rowCount,
          columnCount: bomSection.columnCount,
          previewRows: safeArray(bomSection.previewRows).slice(0, 3),
        } : null,
      };
    });

    const summary = {
      harnessCount: rows.length,
      weightedTotalCostPerSet: rows.reduce((sum, row) => sum + numberOr(row.weightedContribution, 0), 0),
      materialPerSet: rows.reduce((sum, row) => sum + numberOr(row.materialPerSet, 0) * numberOr(row.usageRatio, 0), 0),
      directLaborPerSet: rows.reduce((sum, row) => sum + numberOr(row.directLaborPerSet, 0) * numberOr(row.usageRatio, 0), 0),
      manufacturingPerSet: rows.reduce((sum, row) => sum + numberOr(row.manufacturingPerSet, 0) * numberOr(row.usageRatio, 0), 0),
      equipmentPerSet: rows.reduce((sum, row) => sum + numberOr(row.equipmentPerSet, 0) * numberOr(row.usageRatio, 0), 0),
      rndPerSet: rows.reduce((sum, row) => sum + numberOr(row.rndPerSet, 0) * numberOr(row.usageRatio, 0), 0),
      packagingPerSet: rows.reduce((sum, row) => sum + numberOr(row.packagingPerSet, 0) * numberOr(row.usageRatio, 0), 0),
    };

    return {
      status: 'ready',
      stageKey: baselineKey,
      baselineKey,
      matrix,
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
        Harness-first baseline ${escapeHtml(result.baselineKey)} / rows ${result.rows.length}
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
              <th>Capex+R&D</th>
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
  };
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this);
