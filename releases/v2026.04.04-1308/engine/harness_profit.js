(function (global) {
  'use strict';

  var U = global.G281SharedUtils || {};
  var numberOr = U.numberOr || function (value, fallback) {
    var numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : fallback;
  };
  var safeArray = U.safeArray || function (value) { return Array.isArray(value) ? value : []; };
  var toText = (global.G281Shared && global.G281Shared.toText) || function (value, fallback) {
    var text = String(value == null ? '' : value).trim();
    return text || (fallback == null ? '' : fallback);
  };

  function resolveRuntime(runtimeInput) {
    if (runtimeInput && runtimeInput.master) return runtimeInput;
    if (runtimeInput && typeof runtimeInput.getRuntime === 'function') return runtimeInput.getRuntime() || {};
    return global.G281_RUNTIME || {};
  }

  function resolveVersionLabel(runtime, versionKey) {
    var versions = runtime && runtime.financialVersions && runtime.financialVersions.versions
      ? runtime.financialVersions.versions
      : {};
    var version = versions[versionKey] || versions.quote || null;
    return toText(version && version.label, versionKey || 'quote');
  }

  function buildFromHarnessStage(runtimeInput, model, options) {
    if (!global.G281HarnessStageCostBuilder || typeof global.G281HarnessStageCostBuilder.build !== 'function') {
      return null;
    }
    var runtime = resolveRuntime(runtimeInput);
    var safeOptions = options || {};
    var versionKey = toText(safeOptions.versionKey, '') || 'quote';
    var stageCost = global.G281HarnessStageCostBuilder.build(runtime, versionKey, safeOptions);
    if (!stageCost || stageCost.status !== 'ready' || !safeArray(stageCost.rows).length) {
      return null;
    }

    var unitRevenue = numberOr(model && model.totalVolume, 0)
      ? numberOr(model && model.totalRevenue, 0) / numberOr(model && model.totalVolume, 1)
      : numberOr(model && model.revenue, 0);
    var unitCost = numberOr(model && model.operating, numberOr(model && model.totalCost, 0));
    var unitProfit = numberOr(model && model.avgProfit, unitRevenue - unitCost);
    var margin = numberOr(model && model.margin, unitRevenue ? unitProfit / unitRevenue : 0);
    var totalUsage = safeArray(stageCost.rows).reduce(function (sum, row) {
      return sum + numberOr(row && row.usageRatio, 0);
    }, 0) || 1;

    var harnesses = safeArray(stageCost.rows).map(function (row) {
      var revenueShare = numberOr(row && row.usageRatio, 0) / totalUsage;
      var harnessRevenue = unitRevenue * revenueShare;
      var harnessCost = numberOr(row && row.totalCostPerSet, 0);
      var harnessProfit = harnessRevenue - harnessCost;
      var harnessMargin = harnessRevenue ? harnessProfit / harnessRevenue : 0;
      return {
        harnessId: toText(row && row.harnessId, ''),
        harnessName: toText(row && row.harnessName, row && row.harnessId),
        revenue: harnessRevenue,
        totalCost: harnessCost,
        profit: harnessProfit,
        profitMargin: harnessMargin,
        materialCost: numberOr(row && row.materialPerSet, 0),
        harnessMaterialCost: numberOr(row && row.materialPerSet, 0),
        matchedWireCount: 0,
        unmatchedWireCount: 0,
        unmatchedWireAllocatedMaterial: 0,
        nonWireAllocatedMaterial: 0,
        residualMaterialShare: 0,
        overheadCost: numberOr(row && row.directLaborPerSet, 0)
          + numberOr(row && row.manufacturingPerSet, 0)
          + numberOr(row && row.packagingPerSet, 0)
          + numberOr(row && row.equipmentPerSet, 0)
          + numberOr(row && row.rndPerSet, 0),
        overheadItems: {
          labor: numberOr(row && row.directLaborPerSet, 0),
          equipment: numberOr(row && row.equipmentPerSet, 0),
          packaging: numberOr(row && row.packagingPerSet, 0),
          rd: numberOr(row && row.rndPerSet, 0)
        },
        revenueShare: revenueShare,
        costShare: 0,
        matchedWireDetail: [],
        unitRevenueEstimated: harnessRevenue,
        unitCostEstimated: harnessCost,
        unitProfitEstimated: harnessProfit,
        marginEstimated: harnessMargin,
        unitMaterialCost: numberOr(row && row.materialPerSet, 0),
        unitDirectLaborCost: numberOr(row && row.directLaborPerSet, 0),
        unitManufacturingCost: numberOr(row && row.manufacturingPerSet, 0),
        unitPackagingCost: numberOr(row && row.packagingPerSet, 0),
        unitEquipmentCost: numberOr(row && row.equipmentPerSet, 0),
        unitRndCost: numberOr(row && row.rndPerSet, 0),
        basis: 'Harness-first workbook matrix',
        counts: {
          selectedItemCount: numberOr(row && row.bomSummary && row.bomSummary.rowCount, 0),
          wireLineCount: 0
        },
        sourceDetails: row && row.sourceDetails ? row.sourceDetails : {},
        bomSummary: row && row.bomSummary ? row.bomSummary : null,
        notes: ['Harness-first cost uses workbook matrix, no revenueShare overhead fallback.']
      };
    });

    var totalCost = harnesses.reduce(function (sum, row) { return sum + numberOr(row && row.totalCost, 0); }, 0);
    harnesses.forEach(function (row) {
      row.costShare = totalCost > 0 ? numberOr(row.totalCost, 0) / totalCost : 0;
    });

    return {
      totalRevenue: unitRevenue,
      totalCost: unitCost,
      totalProfit: unitProfit,
      totalMargin: margin,
      harnesses: harnesses,
      wireLines: [],
      perSetSummary: harnesses.map(function (row) {
        return {
          harnessId: row.harnessId,
          revenuePerSet: row.revenue,
          costPerSet: row.totalCost,
          profitPerSet: row.profit,
          marginPerSet: row.profitMargin
        };
      }),
      stagnantPool: {
        amount: 0,
        note: 'Harness-first path does not allocate residual material by revenue share.'
      },
      allocationBasis: {
        material: 'Workbook source rows first',
        overhead: 'Workbook source rows first'
      },
      portfolio: {
        unitRevenue: unitRevenue,
        unitCost: unitCost,
        unitProfit: unitProfit,
        margin: margin
      },
      totals: {
        wireLineCount: 0,
        matchedWireLineCount: 0,
        unmatchedWireLineCount: 0
      },
      meta: {
        selectedBomVersionKey: versionKey,
        selectedBomVersionLabel: resolveVersionLabel(runtime, versionKey),
        warnings: []
      }
    };
  }

  function buildHarnessProfitBreakdown(runtimeInput, model, options) {
    return buildFromHarnessStage(runtimeInput, model, options) || {
      totalRevenue: 0,
      totalCost: 0,
      totalProfit: 0,
      totalMargin: 0,
      harnesses: [],
      wireLines: [],
      perSetSummary: [],
      stagnantPool: {
        amount: 0,
        note: 'No harness-stage cost rows available.'
      },
      allocationBasis: {
        material: 'missing',
        overhead: 'missing'
      },
      portfolio: {
        unitRevenue: numberOr(model && model.totalVolume, 0)
          ? numberOr(model && model.totalRevenue, 0) / numberOr(model && model.totalVolume, 1)
          : 0,
        unitCost: numberOr(model && model.operating, 0),
        unitProfit: numberOr(model && model.avgProfit, 0),
        margin: numberOr(model && model.margin, 0)
      },
      totals: {
        wireLineCount: 0,
        matchedWireLineCount: 0,
        unmatchedWireLineCount: 0
      },
      meta: {
        selectedBomVersionKey: toText(options && options.versionKey, 'quote'),
        selectedBomVersionLabel: toText(options && options.versionKey, 'quote'),
        warnings: ['Harness-first stage cost data missing.']
      }
    };
  }

  var api = { buildHarnessProfitBreakdown: buildHarnessProfitBreakdown };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  global.G281HarnessProfit = api;
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this);
