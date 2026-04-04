(function (global) {
  'use strict';

  const Shared = global.G281Shared || {};
  const numberOr = Shared.numberOr || ((value, fallback) => {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : fallback;
  });
  const safeArray = Shared.safeArray || ((value) => (Array.isArray(value) ? value : []));
  const clonePlain = Shared.clonePlain || ((value, fallback) => {
    try {
      return JSON.parse(JSON.stringify(value));
    } catch (error) {
      return fallback;
    }
  });
  const toText = Shared.toText || ((value, fallback) => {
    const text = String(value == null ? '' : value).trim();
    return text || (fallback == null ? '' : fallback);
  });
  const safeObject = Shared.safeObject || ((value) => (value && typeof value === 'object' ? value : {}));

  const DEFAULT_SUMMARY_SHEET = '项目评估汇总（昆山90%）';
  const FIXED_ROW_SPECS = [
    { key: 'customerPartNumber', rowNumber: 3, label: 'Customer Part Number', kind: 'meta' },
    { key: 'quantityFactor', rowNumber: 4, label: 'Quantity Factor', kind: 'meta' },
    { key: 'totalCost', rowNumber: 14, label: 'Total Cost / Set', kind: 'metric' },
    { key: 'material', rowNumber: 15, label: 'Material / Set', kind: 'metric' },
    { key: 'directLabor', rowNumber: 16, label: 'Direct Labor / Set', kind: 'metric', detailKind: 'labor' },
    { key: 'directLaborOpen', rowNumber: 17, label: 'Direct Labor Open', kind: 'metric', detailKind: 'labor' },
    { key: 'directLaborAssembly', rowNumber: 18, label: 'Direct Labor Assembly', kind: 'metric', detailKind: 'labor' },
    { key: 'directLaborOther', rowNumber: 19, label: 'Direct Labor Other', kind: 'metric', detailKind: 'labor' },
    { key: 'equipment', rowNumber: 20, label: 'Equipment / Set', kind: 'metric', detailKind: 'capitalEquipment' },
    { key: 'equipmentOwned', rowNumber: 21, label: 'Equipment Owned / Set', kind: 'metric', detailKind: 'capitalEquipment' },
    { key: 'toolingAndFixtures', rowNumber: 22, label: 'Tooling / Fixtures / Set', kind: 'metric', detailKind: 'capitalTooling' },
    { key: 'manufacturing', rowNumber: 23, label: 'Manufacturing / Set', kind: 'metric', detailKind: 'manufacturing' },
    { key: 'manufacturingEnergy', rowNumber: 24, label: 'Manufacturing Energy', kind: 'metric', detailKind: 'manufacturing' },
    { key: 'manufacturingRepair', rowNumber: 25, label: 'Manufacturing Repair', kind: 'metric', detailKind: 'manufacturing' },
    { key: 'manufacturingLowValue', rowNumber: 26, label: 'Manufacturing Low Value', kind: 'metric', detailKind: 'manufacturing' },
    { key: 'manufacturingIndirectLabor', rowNumber: 27, label: 'Manufacturing Indirect Labor', kind: 'metric', detailKind: 'manufacturing' },
    { key: 'manufacturingWelfare', rowNumber: 28, label: 'Manufacturing Welfare', kind: 'metric', detailKind: 'manufacturing' },
    { key: 'manufacturingManagement', rowNumber: 29, label: 'Manufacturing Management', kind: 'metric', detailKind: 'manufacturing' },
    { key: 'manufacturingOther', rowNumber: 30, label: 'Manufacturing Other', kind: 'metric', detailKind: 'manufacturing' },
    { key: 'rnd', rowNumber: 31, label: 'R&D / Set', kind: 'metric', detailKind: 'rnd' },
    { key: 'packaging', rowNumber: 32, label: 'Packaging / Set', kind: 'metric', detailKind: 'packaging' },
    { key: 'usageRatio', rowNumber: 35, label: 'Usage Ratio', kind: 'meta' },
  ];
  const METRIC_ROW_KEYS = ['totalCost', 'material', 'directLabor', 'equipment', 'manufacturing', 'rnd', 'packaging'];
  const GENERIC_SUMMARY_SHEET_ALIASES = [
    'project assessment summary',
    'project rollup',
    'quote baseline',
    'cost summary',
    'summary',
  ];

  const DEFAULT_KEY_CELL_SPECS = [
    { address: 'P3', key: 'harnessId', label: 'Harness / line item' },
    { address: 'P4', key: 'quantityFactor', label: 'Quantity factor' },
    { address: 'P14', key: 'totalCost', label: 'Total cost / set' },
    { address: 'P16', key: 'directLabor', label: 'Direct labor per set' },
    { address: 'P20', key: 'equipment', label: 'Equipment cost' },
    { address: 'P21', key: 'sharedEquipment', label: 'Shared equipment' },
    { address: 'P22', key: 'specialEquipment', label: 'Special equipment' },
    { address: 'P23', key: 'manufacturing', label: 'Manufacturing per set' },
    { address: 'P31', key: 'rnd', label: 'R&D per set' },
    { address: 'P32', key: 'packaging', label: 'Packaging per set' },
  ];

  function resolveProjectConfig(options, runtime) {
    return (options && options.projectConfig)
      || (global.ConfigLoader && typeof global.ConfigLoader.active === 'function' ? global.ConfigLoader.active() : null)
      || (runtime && runtime.projectConfig)
      || {};
  }

  function getFinancialWorkbookConfig(projectConfig) {
    return (projectConfig && projectConfig.financialWorkbook) || {};
  }

  function getRowSpecs(projectConfig) {
    const workbookConfig = getFinancialWorkbookConfig(projectConfig);
    const specs = safeArray(workbookConfig.rowSpecs);
    return specs.length ? specs : FIXED_ROW_SPECS;
  }

  function getKeyCellSpecs(projectConfig) {
    const workbookConfig = getFinancialWorkbookConfig(projectConfig);
    const specs = safeArray(workbookConfig.keyCellSpecs || workbookConfig.keyCells);
    return specs.length ? specs : DEFAULT_KEY_CELL_SPECS;
  }

  function getDetailSheetBindings(projectConfig) {
    const workbookConfig = getFinancialWorkbookConfig(projectConfig);
    return safeArray(workbookConfig.detailSheetBindings);
  }

  function buildSheetPreview(sheet, rowLimit, columnLimit) {
    if (!sheet) return [];
    const grid = new Map();
    safeArray(sheet.cells).forEach((cell) => {
      if (!cell || !cell.row || !cell.column) return;
      const rowNumber = numberOr(cell.row, 0);
      const columnNumber = numberOr(cell.column, 0);
      if (rowNumber < 1 || columnNumber < 1) return;
      if (!grid.has(rowNumber)) grid.set(rowNumber, new Map());
      grid.get(rowNumber).set(columnNumber, displayCellValue(cell));
    });
    const preview = [];
    const maxRows = Math.max(1, Number(rowLimit) || 6);
    const maxColumns = Math.max(1, Number(columnLimit) || 6);
    for (let rowNumber = 1; rowNumber <= maxRows; rowNumber += 1) {
      const values = [];
      let hasValue = false;
      for (let columnNumber = 1; columnNumber <= maxColumns; columnNumber += 1) {
        const value = toText(
          grid.has(rowNumber) ? grid.get(rowNumber).get(columnNumber) : '',
          ''
        );
        if (value !== '') hasValue = true;
        values.push(value);
      }
      if (hasValue) {
        preview.push({ rowNumber, values });
      }
    }
    return preview;
  }

  function bindingMatchesSheet(sheetName, binding) {
    if (!binding) return false;
    const strategy = toText(binding.matchStrategy, 'keyword');
    const value = toText(binding.matchValue || binding.matchText, '');
    if (!value) return false;
    const normalizedSheet = toText(sheetName, '').toLowerCase();
    const normalizedValue = value.toLowerCase();
    if (strategy === 'exact') {
      return normalizedSheet === normalizedValue;
    }
    if (strategy === 'pattern') {
      try {
        const regex = new RegExp(value);
        return regex.test(sheetName || '');
      } catch (error) {
        return false;
      }
    }
    return normalizedValue && normalizedSheet.includes(normalizedValue);
  }

  function buildDetailGroups(bindings, workbook) {
    const sheets = safeArray(workbook && workbook.sheets);
    return bindings.map((binding) => {
      const matches = sheets.filter((sheet) => bindingMatchesSheet(sheet && sheet.sheetName, binding));
      return {
        id: toText(binding && binding.id, binding && binding.sheetRole || 'detail-binding'),
        label: toText(binding && binding.label, binding && binding.sheetRole),
        sheetRole: toText(binding && binding.sheetRole, binding && binding.id),
        matchStrategy: toText(binding && binding.matchStrategy, 'keyword'),
        matchValue: toText(binding && (binding.matchValue || binding.matchText), ''),
        previewRows: Number(binding && binding.previewRows) || 6,
        previewColumns: Number(binding && binding.previewColumns) || 6,
        matches: matches.map((sheet) => ({
          sheetName: toText(sheet && sheet.sheetName, ''),
          rowCount: numberOr(sheet && sheet.maxRow, 0),
          columnCount: numberOr(sheet && sheet.maxColumn, 0),
          previewRows: buildSheetPreview(sheet, Number(binding && binding.previewRows) || 6, Number(binding && binding.previewColumns) || 6),
        })),
        matchCount: matches.length,
        matched: matches.length > 0,
      };
    });
  }

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
    if (runtimeInput && runtimeInput.runtime && runtimeInput.runtime.master) return runtimeInput.runtime;
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
      hasComparison: requested !== 'quote' || requested === 'quote',
      usesDelta: requested !== 'quote' && requested !== 'fixed',
    };
  }

  function resolveAssessmentWorkbook(runtimeInput, baselineKey, options) {
    const runtime = resolveRuntime(runtimeInput);
    const stageMeta = resolveStageMeta(runtimeInput, baselineKey, options);
    const actualKey = stageMeta.financialKey || 'quote';
    const repoWorkbook = runtimeInput && typeof runtimeInput.getAssessmentWorkbookSeed === 'function'
      ? runtimeInput.getAssessmentWorkbookSeed(actualKey)
      : null;
    if (repoWorkbook) return repoWorkbook;
    const versions = runtime && runtime.financialVersions && runtime.financialVersions.versions
      ? runtime.financialVersions.versions
      : {};
    const version = versions[actualKey] || versions.quote || null;
    return version && version.assessmentWorkbookSeed ? version.assessmentWorkbookSeed : null;
  }

  function buildSheetMaps(sheet) {
    const byAddress = new Map();
    const byRow = new Map();
    safeArray(sheet && sheet.cells).forEach((cell) => {
      if (!cell || !cell.address) return;
      byAddress.set(String(cell.address).toUpperCase(), cell);
      const rowKey = Number(cell.row);
      if (!byRow.has(rowKey)) byRow.set(rowKey, []);
      byRow.get(rowKey).push(cell);
    });
    return { byAddress, byRow };
  }

  function columnLetter(columnNumber) {
    let remainder = Number(columnNumber) || 1;
    let result = '';
    while (remainder > 0) {
      const offset = (remainder - 1) % 26;
      result = String.fromCharCode(65 + offset) + result;
      remainder = Math.floor((remainder - 1) / 26);
    }
    return result || 'A';
  }

  function numericCellValue(cell) {
    if (!cell) return null;
    const candidates = [cell.numericValue, cell.value, cell.formulaResult, cell.formattedValue];
    for (let index = 0; index < candidates.length; index += 1) {
      const numeric = Number(candidates[index]);
      if (Number.isFinite(numeric)) return numeric;
    }
    return null;
  }

  function displayCellValue(cell) {
    if (!cell) return '';
    const numeric = numericCellValue(cell);
    if (Number.isFinite(numeric)) return numeric;
    return toText(cell.value || cell.formattedValue || cell.formula || '', '');
  }

  function optionalNumber(value) {
    if (value == null || value === '') return null;
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : null;
  }

  function rowCategory(rowSpec) {
    if (!rowSpec) return 'metric';
    if (rowSpec.category) return rowSpec.category;
    if (rowSpec.kind === 'meta') return 'meta';
    if (rowSpec.key === 'material') return 'material';
    if (rowSpec.detailKind === 'labor') return 'labor';
    if (rowSpec.detailKind === 'manufacturing') return 'manufacturing';
    if (rowSpec.detailKind === 'capitalEquipment' || rowSpec.detailKind === 'capitalTooling') return 'capital';
    if (rowSpec.detailKind === 'rnd') return 'rnd';
    if (rowSpec.detailKind === 'packaging') return 'packaging';
    return 'metric';
  }

  function stageGroupForRow(rowSpec) {
    if (!rowSpec) return '';
    if (rowSpec.stageGroup) return rowSpec.stageGroup;
    if (rowSpec.kind === 'meta') return 'meta';
    if (rowSpec.detailKind) return rowSpec.detailKind;
    return rowSpec.key;
  }

  function rowLabel(summaryMaps, rowSpec) {
    const rowCells = safeArray(summaryMaps.byRow.get(rowSpec.rowNumber)).slice().sort((left, right) => {
      return numberOr(left.column, 0) - numberOr(right.column, 0);
    });
    const candidates = rowCells
      .filter((cell) => numberOr(cell.column, 0) <= 15)
      .map((cell) => toText(cell.value || cell.formattedValue || '', ''))
      .filter((value) => value && !/^\d+(\.\d+)?$/.test(value));
    const best = candidates.sort((left, right) => right.length - left.length)[0];
    return best || rowSpec.label;
  }

  function normalizeSheetName(value) {
    return toText(value, '')
      .toLowerCase()
      .replace(/[\s_\-()（）[\]{}]+/g, '');
  }

  function collectSummarySheetAliases(preferredName, projectConfig) {
    const aliases = new Set();

    function addAlias(value) {
      const text = toText(value, '');
      if (text) aliases.add(text);
    }

    addAlias(preferredName);
    GENERIC_SUMMARY_SHEET_ALIASES.forEach(addAlias);

    safeArray(projectConfig && projectConfig.summarySheetCandidates).forEach(addAlias);
    safeArray(projectConfig && projectConfig.financialWorkbook && projectConfig.financialWorkbook.summarySheetCandidates).forEach(addAlias);
    safeArray(projectConfig && projectConfig.financialWorkbook && projectConfig.financialWorkbook.summarySheetAliases).forEach(addAlias);
    safeArray(projectConfig && projectConfig.assessmentWorkbook && projectConfig.assessmentWorkbook.summarySheetCandidates).forEach(addAlias);
    safeArray(projectConfig && projectConfig.sheetMappings).forEach((mapping) => {
      const sheetRole = toText(mapping && mapping.sheetRole, '');
      if (!['quote_baseline', 'assessment_summary', 'project_rollup'].includes(sheetRole)) return;
      addAlias(mapping && mapping.sheetName);
      addAlias(mapping && mapping.matchValue);
      addAlias(mapping && mapping.matchText);
    });

    return Array.from(aliases);
  }

  function scoreSummarySheet(sheet, aliases) {
    const normalizedName = normalizeSheetName(sheet && sheet.sheetName);
    const maps = buildSheetMaps(sheet);
    let score = 0;

    if (aliases.some((alias) => {
      const normalizedAlias = normalizeSheetName(alias);
      return normalizedAlias && (normalizedName === normalizedAlias || normalizedName.includes(normalizedAlias));
    })) {
      score += 24;
    }

    const structuralRows = [
      { rowNumber: 3, weight: 12, minFilled: 2 },
      { rowNumber: 4, weight: 4, minFilled: 1 },
      { rowNumber: 14, weight: 8, minFilled: 2 },
      { rowNumber: 15, weight: 8, minFilled: 2 },
      { rowNumber: 20, weight: 8, minFilled: 2 },
      { rowNumber: 21, weight: 6, minFilled: 1 },
      { rowNumber: 22, weight: 6, minFilled: 1 },
      { rowNumber: 23, weight: 6, minFilled: 1 },
      { rowNumber: 31, weight: 6, minFilled: 1 },
      { rowNumber: 32, weight: 6, minFilled: 1 },
      { rowNumber: 35, weight: 4, minFilled: 1 },
    ];

    structuralRows.forEach((spec) => {
      const tailCells = safeArray(maps.byRow.get(spec.rowNumber)).filter((cell) => numberOr(cell && cell.column, 0) >= 16);
      if (!tailCells.length) return;
      const filledCount = tailCells.filter((cell) => toText(displayCellValue(cell), '') !== '').length;
      const numericCount = tailCells.filter((cell) => Number.isFinite(numericCellValue(cell))).length;
      if (filledCount >= spec.minFilled) score += spec.weight;
      score += Math.min(numericCount, 3);
    });

    return { score, maps };
  }

  function pickSummarySheet(workbook, preferredName, projectConfig) {
    const sheets = safeArray(workbook && workbook.sheets);
    if (!sheets.length) return null;
    const aliases = collectSummarySheetAliases(preferredName, projectConfig);

    const exactMatch = sheets.find((sheet) => {
      const normalizedName = normalizeSheetName(sheet && sheet.sheetName);
      return aliases.some((alias) => normalizedName && normalizedName === normalizeSheetName(alias));
    });
    if (exactMatch) return exactMatch;

    let bestSheet = sheets[0];
    let bestScore = -1;
    sheets.forEach((sheet) => {
      const candidate = scoreSummarySheet(sheet, aliases);
      if (candidate.score > bestScore) {
        bestScore = candidate.score;
        bestSheet = sheet;
      }
    });
    return bestSheet;
  }
  function buildSheetLookup(workbook) {
    const lookup = new Map();
    safeArray(workbook && workbook.sheets).forEach((sheet) => {
      const key = toText(sheet && sheet.sheetName);
      if (key) lookup.set(key, sheet);
    });
    return lookup;
  }

  function parseFormulaReferences(formula) {
    const raw = toText(formula, '');
    const refs = [];
    const pattern = /(?:'([^']+)'|([A-Za-z0-9_\u4e00-\u9fff\s]+))!\$?([A-Z]{1,3})\$?(\d+)/g;
    let match = pattern.exec(raw);
    while (match) {
      refs.push({
        sheetName: toText(match[1] || match[2], ''),
        address: `${match[3]}${match[4]}`,
      });
      match = pattern.exec(raw);
    }
    return refs;
  }

  function pickStageRecord(item, detailKey) {
    if (!item || typeof item !== 'object') return {};
    if (item[detailKey] && typeof item[detailKey] === 'object') return item[detailKey];
    if (item.quote && typeof item.quote === 'object') return item.quote;
    if (item.fixed && typeof item.fixed === 'object') return item.fixed;
    return item;
  }

  function getSheetMaps(sheetLookup, cache, sheetName) {
    const normalized = toText(sheetName, '');
    if (!normalized) return null;
    if (!cache.has(normalized)) {
      const sheet = sheetLookup.get(normalized);
      cache.set(normalized, sheet ? buildSheetMaps(sheet) : null);
    }
    return cache.get(normalized);
  }

  function buildReferenceDetails(formula, sheetLookup, sheetMapCache) {
    return parseFormulaReferences(formula).map((ref) => {
      const refMaps = getSheetMaps(sheetLookup, sheetMapCache, ref.sheetName);
      const refCell = refMaps && refMaps.byAddress ? refMaps.byAddress.get(ref.address.toUpperCase()) : null;
      return {
        sheetName: ref.sheetName,
        address: ref.address,
        sourceSheet: ref.sheetName,
        sourceCell: ref.address,
        source: ref.sheetName && ref.address ? `${ref.sheetName}!${ref.address}` : '',
        label: toText(
          refCell && (refCell.label || refCell.header || refCell.value || refCell.formattedValue),
          ref.sheetName && ref.address ? `${ref.sheetName}!${ref.address}` : ''
        ),
        value: displayCellValue(refCell),
        formula: toText(refCell && refCell.formula, ''),
        demandQty: optionalNumber(refCell && (refCell.demandQty || refCell.qty || refCell.quantity)),
        newAmount: optionalNumber(refCell && (refCell.newAmount || refCell.amount || refCell.totalAmount)),
        unitPrice: optionalNumber(refCell && (refCell.unitPrice || refCell.price)),
      };
    });
  }

  function flattenCapitalDetails(runtime, keys, detailKey) {
    const comparisons = runtime && runtime.capitalValidation && runtime.capitalValidation.comparisons
      ? runtime.capitalValidation.comparisons
      : {};
    return safeArray(keys).flatMap((key) => {
      const scope = comparisons[key];
      if (!scope) return [];
      return safeArray(scope.groups).flatMap((group) => {
        return safeArray(group && group.aligned).map((item) => {
          const source = pickStageRecord(item, detailKey);
          return {
            sourceScope: key,
            sectionLabel: toText(group && group.label, scope.scopeLabel || key),
            itemKey: toText(source.itemKey || item && item.itemKey, ''),
            itemName: toText(source.itemName || source.investmentName, ''),
            spec: toText(source.spec, ''),
            demandQty: numberOr(source.demandQty, null),
            newAmount: numberOr(source.newAmount, null),
            unitPrice: numberOr(source.unitPrice, null),
            sourceSheet: toText(source.sheetName, scope.quoteSheet || ''),
            sourceCell: toText(source.sourceCell, ''),
            source: toText(source.sheetName, '') ? `${toText(source.sheetName, '')}!${toText(source.sourceCell, '')}` : '',
            qtyLabel: toText(source.qtyLabel, ''),
            amountLabel: toText(source.amountLabel, ''),
            raw: clonePlain(source, {}),
          };
        });
      });
    }).filter((entry) => entry.itemName || Number.isFinite(entry.newAmount) || Number.isFinite(entry.demandQty));
  }

  function flattenAlignedScope(scope, detailKey) {
    return safeArray(scope && scope.groups).flatMap((group) => {
      return safeArray(group && group.aligned).map((item) => {
        const source = pickStageRecord(item, detailKey);
        return {
          sectionLabel: toText(group && group.label, scope && scope.scopeLabel),
          itemKey: toText(source.itemKey || item && item.itemKey, ''),
          label: toText(source.displayLabel || source.label, ''),
          value: numberOr(source.numericValue, numberOr(source.value, null)),
          sourceSheet: toText(source.sourceSheet || source.sheetName, ''),
          sourceCell: toText(source.sourceCell, ''),
          source: toText(source.source, ''),
          note: toText(source.note, ''),
          formula: toText(source.formula, ''),
          demandQty: numberOr(source.demandQty, null),
          newAmount: numberOr(source.newAmount, null),
          unitPrice: numberOr(source.unitPrice, null),
          raw: clonePlain(source, {}),
        };
      });
    }).filter((entry) => entry.label || entry.itemKey || entry.sourceSheet || Number.isFinite(entry.value));
  }

  function buildPackagingLookup(sheet) {
    if (!sheet) return new Map();
    const rows = new Map();
    safeArray(sheet.cells).forEach((cell) => {
      const rowKey = numberOr(cell && cell.row, 0);
      if (!rows.has(rowKey)) rows.set(rowKey, {});
      rows.get(rowKey)[numberOr(cell && cell.column, 0)] = cell;
    });
    const lookup = new Map();
    rows.forEach((row, rowNumber) => {
      if (rowNumber < 3) return;
      const harnessId = toText(row[1] && displayCellValue(row[1]), '');
      if (!harnessId) return;
      lookup.set(harnessId, {
        harnessId,
        customerPartNumber: harnessId,
        innerPack: numberOr(displayCellValue(row[5]), 0),
        outerPack: numberOr(displayCellValue(row[6]), 0),
        freight: numberOr(displayCellValue(row[7]), 0),
        extraFreight: numberOr(displayCellValue(row[8]), 0),
        warehouse: numberOr(displayCellValue(row[9]), 0),
        shuttle: numberOr(displayCellValue(row[10]), 0),
        other: numberOr(displayCellValue(row[11]), 0),
        total: numberOr(displayCellValue(row[12]), 0),
        sourceSheet: toText(sheet.sheetName, ''),
        sourceCell: `L${rowNumber}`,
        sourceRange: `A${rowNumber}:L${rowNumber}`,
        source: `${toText(sheet.sheetName, '')}!L${rowNumber}`,
        sourceRow: rowNumber,
      });
    });
    return lookup;
  }

  function buildRndDetails(referenceDetails) {
    if (referenceDetails.length) {
      return referenceDetails.map((ref, index) => ({
        sectionLabel: 'R&D workbook refs',
        itemKey: `rnd.reference.${index + 1}`,
        label: ref.source,
        value: numberOr(ref.value, null),
        sourceSheet: ref.sourceSheet,
        sourceCell: ref.sourceCell,
        source: ref.source,
        formula: ref.formula,
      }));
    }
    return [];
  }

  function summarizeSourceEntries(referenceDetails, detailEntries) {
    const sourceSheets = new Set();
    let sourceCellCount = 0;
    safeArray(referenceDetails).forEach((ref) => {
      if (ref && ref.sourceSheet) sourceSheets.add(ref.sourceSheet);
      if (ref && ref.sourceCell) sourceCellCount += 1;
    });
    safeArray(detailEntries).forEach((entry) => {
      if (entry && entry.sourceSheet) sourceSheets.add(entry.sourceSheet);
      if (entry && entry.sourceCell) sourceCellCount += 1;
    });
    return {
      referenceCount: safeArray(referenceDetails).length,
      detailCount: safeArray(detailEntries).length,
      sourceSheetCount: sourceSheets.size,
      sourceCellCount,
      sourceSheets: Array.from(sourceSheets),
    };
  }

  function uniqueDetails(entries) {
    const seen = new Set();
    return safeArray(entries).filter((entry) => {
      const key = [
        toText(entry && entry.itemKey, ''),
        toText(entry && entry.label, ''),
        toText(entry && entry.sourceSheet, ''),
        toText(entry && entry.sourceCell, ''),
      ].join('|');
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function buildSourceDetail(runtime, stageMeta, rowSpec, harnessColumn, cell, sheetLookup, sheetMapCache, packagingLookup, summarySheetName) {
    const detailKey = stageMeta.financialKey || 'quote';
    const formula = toText(cell && cell.formula, '');
    const references = buildReferenceDetails(formula, sheetLookup, sheetMapCache);
    let details = [];

    if (rowSpec.detailKind === 'labor') {
      const comparisons = runtime && runtime.laborValidation && runtime.laborValidation.comparisons
        ? runtime.laborValidation.comparisons
        : {};
      const scopes = rowSpec.key === 'manufacturing'
        ? [comparisons.manufacturing]
        : [comparisons.directLabor, comparisons.scenario, comparisons.baseline];
      details = uniqueDetails(scopes.flatMap((scope) => flattenAlignedScope(scope, detailKey)));
    } else if (rowSpec.detailKind === 'manufacturing') {
      const scope = runtime && runtime.laborValidation && runtime.laborValidation.comparisons
        ? runtime.laborValidation.comparisons.manufacturing
        : null;
      details = uniqueDetails(flattenAlignedScope(scope, detailKey));
    } else if (rowSpec.detailKind === 'capitalEquipment') {
      details = uniqueDetails(flattenCapitalDetails(runtime, ['equipment'], detailKey));
    } else if (rowSpec.detailKind === 'capitalTooling') {
      details = uniqueDetails(flattenCapitalDetails(runtime, ['tooling', 'fixtures'], detailKey));
    } else if (rowSpec.detailKind === 'packaging') {
      const packagingItem = packagingLookup.get(harnessColumn.harnessId);
      details = packagingItem
        ? [packagingItem]
        : uniqueDetails(flattenAlignedScope(
          runtime && runtime.packagingValidation && runtime.packagingValidation.comparisons
            ? runtime.packagingValidation.comparisons.breakdown
            : null,
          detailKey
        ));
    } else if (rowSpec.detailKind === 'rnd') {
      details = buildRndDetails(references);
    }

    return {
      rowKey: rowSpec.key,
      label: rowSpec.label,
      category: rowCategory(rowSpec),
      detailKind: rowSpec.detailKind || '',
      stageGroup: stageGroupForRow(rowSpec),
      stageMeta: {
        stageKey: stageMeta.stageKey,
        financialKey: stageMeta.financialKey,
        comparisonKey: stageMeta.comparisonKey,
      },
      harnessId: harnessColumn.harnessId,
      value: numericCellValue(cell),
      displayValue: displayCellValue(cell),
      formula,
      summarySheet: summarySheetName,
      summaryCell: `${harnessColumn.columnLetter}${rowSpec.rowNumber}`,
      sourceSheet: summarySheetName,
      sourceCell: `${harnessColumn.columnLetter}${rowSpec.rowNumber}`,
      references,
      details,
      sourceSummary: summarizeSourceEntries(references, details),
    };
  }

  function metricValue(matrixByRowKey, rowKey, harnessId) {
    const row = matrixByRowKey.get(rowKey);
    const cell = row && row.cells ? row.cells[harnessId] : null;
    return numberOr(cell && cell.value, 0);
  }

  function buildHarnessRecords(summaryRows, harnessColumns, harnessSourceDetails, matrixByRowKey, stageMeta) {
    return harnessColumns.map((column) => {
      const sourceDetails = harnessSourceDetails[column.harnessId] || {};
      const sourceSheets = new Set();
      let detailGroupCount = 0;
      let detailEntryCount = 0;
      let referenceCount = 0;
      Object.keys(sourceDetails).forEach((rowKey) => {
        const detail = sourceDetails[rowKey];
        if (!detail) return;
        detailGroupCount += 1;
        detailEntryCount += numberOr(detail.sourceSummary && detail.sourceSummary.detailCount, 0);
        referenceCount += numberOr(detail.sourceSummary && detail.sourceSummary.referenceCount, 0);
        safeArray(detail.sourceSummary && detail.sourceSummary.sourceSheets).forEach((sheetName) => sourceSheets.add(sheetName));
      });

      const values = summaryRows.reduce((accumulator, row) => {
        accumulator[row.key] = metricValue(matrixByRowKey, row.key, column.harnessId);
        return accumulator;
      }, {});

      return {
        harnessId: column.harnessId,
        harnessName: column.harnessName || column.harnessId,
        quantityFactor: numberOr(column.quantityFactor, 0),
        usageRatio: numberOr(column.usageRatio, 0),
        stageMeta: {
          stageKey: stageMeta.stageKey,
          financialKey: stageMeta.financialKey,
          comparisonKey: stageMeta.comparisonKey,
        },
        values,
        metrics: {
          totalCost: numberOr(values.totalCost, 0),
          material: numberOr(values.material, 0),
          directLabor: numberOr(values.directLabor, 0),
          equipment: numberOr(values.equipment, 0),
          manufacturing: numberOr(values.manufacturing, 0),
          rnd: numberOr(values.rnd, 0),
          packaging: numberOr(values.packaging, 0),
        },
        sourceSummary: {
          detailGroupCount,
          detailEntryCount,
          referenceCount,
          sourceSheetCount: sourceSheets.size,
          sourceSheets: Array.from(sourceSheets),
        },
        sourceDetails,
      };
    });
  }

  function buildProjectSummary(harnessRows) {
    const weighted = {
      usageRatio: 0,
      totalCost: 0,
      material: 0,
      directLabor: 0,
      equipment: 0,
      manufacturing: 0,
      rnd: 0,
      packaging: 0,
    };
    harnessRows.forEach((row) => {
      const ratio = numberOr(row && row.usageRatio, 0);
      const metrics = safeObject(row && row.metrics);
      weighted.usageRatio += ratio;
      weighted.totalCost += numberOr(metrics.totalCost, 0) * ratio;
      weighted.material += numberOr(metrics.material, 0) * ratio;
      weighted.directLabor += numberOr(metrics.directLabor, 0) * ratio;
      weighted.equipment += numberOr(metrics.equipment, 0) * ratio;
      weighted.manufacturing += numberOr(metrics.manufacturing, 0) * ratio;
      weighted.rnd += numberOr(metrics.rnd, 0) * ratio;
      weighted.packaging += numberOr(metrics.packaging, 0) * ratio;
    });
    return {
      harnessCount: harnessRows.length,
      weightedUsageRatio: weighted.usageRatio,
      weightedPerSet: weighted,
    };
  }

  function load(runtimeInput, baselineKey, options) {
    const runtime = resolveRuntime(runtimeInput);
    const safeOptions = options || {};
    const projectConfig = resolveProjectConfig(safeOptions, runtime);
    const stageMeta = resolveStageMeta(runtimeInput, baselineKey || safeOptions.baselineKey || safeOptions.stageKey, safeOptions);
    const workbook = resolveAssessmentWorkbook(runtimeInput, stageMeta.stageKey, safeOptions);
    if (!workbook) {
      return {
        status: 'missing',
        baselineKey: stageMeta.stageKey,
        requestedStageKey: stageMeta.requestedStageKey,
        financialKey: stageMeta.financialKey,
        stageMeta,
        summaryRows: [],
        harnessColumns: [],
        harnessCostMatrix: [],
        workbookMatrix: [],
        harnessRows: [],
        records: [],
        harnessSourceDetails: {},
        rowMetaMap: {},
      };
    }

    const sheetLookup = buildSheetLookup(workbook);
    const sheetMapCache = new Map();
    const summarySheet = pickSummarySheet(workbook, safeOptions.summarySheetName, projectConfig);
    const summaryMaps = buildSheetMaps(summarySheet);
    const packagingSheet = sheetLookup.get('包装物流费用')
      || safeArray(workbook.sheets).find((sheet) => toText(sheet && sheet.sheetName).includes('包装物流费用'))
      || null;
    const packagingLookup = buildPackagingLookup(packagingSheet);

    const harnessColumns = [];
    for (let columnIndex = 16; columnIndex <= 26; columnIndex += 1) {
      const letter = columnLetter(columnIndex);
      const harnessId = toText(displayCellValue(summaryMaps.byAddress.get(`${letter}3`)), '');
      if (!harnessId) continue;
      harnessColumns.push({
        harnessId,
        harnessName: harnessId,
        columnIndex,
        columnLetter: letter,
        quantityFactor: numberOr(displayCellValue(summaryMaps.byAddress.get(`${letter}4`)), 0),
        usageRatio: numberOr(displayCellValue(summaryMaps.byAddress.get(`${letter}35`)), 0),
      });
    }

    const financialRowSpecs = getRowSpecs(projectConfig);
    const summaryRows = financialRowSpecs
      .filter((rowSpec) => Number(rowSpec.rowNumber))
      .map((rowSpec) => {
        const rowNumber = Number(rowSpec.rowNumber);
        const key = toText(rowSpec.key, 'row-' + rowNumber);
        return {
          key,
          rowNumber,
          label: rowLabel(summaryMaps, rowSpec),
          kind: toText(rowSpec.kind, 'metric'),
          category: rowSpec.category || rowCategory(rowSpec),
          detailKind: toText(rowSpec.detailKind, ''),
          stageGroup: rowSpec.stageGroup || stageGroupForRow(rowSpec),
        };
      });
    const rowMetaMap = summaryRows.reduce((accumulator, row) => {
      accumulator[row.key] = row;
      return accumulator;
    }, {});

    const harnessSourceDetails = {};
    const harnessCostMatrix = summaryRows.map((row) => {
      const matrixRow = {
        rowKey: row.key,
        label: row.label,
        rowNumber: row.rowNumber,
        kind: row.kind,
        category: row.category,
        detailKind: row.detailKind,
        stageGroup: row.stageGroup,
        stageMeta: {
          stageKey: stageMeta.stageKey,
          financialKey: stageMeta.financialKey,
          comparisonKey: stageMeta.comparisonKey,
        },
        cells: {},
      };
      harnessColumns.forEach((harnessColumn) => {
        const cell = summaryMaps.byAddress.get(`${harnessColumn.columnLetter}${row.rowNumber}`);
        const detail = buildSourceDetail(
          runtime,
          stageMeta,
          row,
          harnessColumn,
          cell,
          sheetLookup,
          sheetMapCache,
          packagingLookup,
          toText(summarySheet && summarySheet.sheetName, DEFAULT_SUMMARY_SHEET)
        );
        if (!harnessSourceDetails[harnessColumn.harnessId]) harnessSourceDetails[harnessColumn.harnessId] = {};
        harnessSourceDetails[harnessColumn.harnessId][row.key] = detail;
        matrixRow.cells[harnessColumn.harnessId] = {
          value: detail.value,
          displayValue: detail.displayValue,
          formula: detail.formula,
          references: detail.references,
          details: detail.details,
          sourceSummary: detail.sourceSummary,
        };
      });
      return matrixRow;
    });

    const matrixByRowKey = new Map(harnessCostMatrix.map((row) => [row.rowKey, row]));
    const harnessRows = buildHarnessRecords(summaryRows, harnessColumns, harnessSourceDetails, matrixByRowKey, stageMeta);
    const projectSummary = buildProjectSummary(harnessRows);

    const keyCells = {};
    const keyCellSpecs = getKeyCellSpecs(projectConfig);
    keyCellSpecs.forEach((spec) => {
      const address = toText(spec.address, '').toUpperCase();
      if (!address) return;
      const cell = summaryMaps.byAddress.get(address);
      const references = buildReferenceDetails(toText(cell && cell.formula, ''), sheetLookup, sheetMapCache);
      const firstReference = references[0] || {};
      keyCells[address] = {
        key: toText(spec.key, address),
        label: toText(spec.label, spec.key || address),
        address,
        value: displayCellValue(cell),
        numericValue: numericCellValue(cell),
        formula: toText(cell && cell.formula, ''),
        formulaSource: firstReference.source || '',
        sourceSheet: firstReference.sourceSheet || '',
        sourceCell: firstReference.sourceCell || '',
        references,
      };
    });

    const detailBindings = getDetailSheetBindings(projectConfig);
    const detailGroups = buildDetailGroups(detailBindings, workbook);
    const detailCoverage = {
      totalBindings: detailGroups.length,
      matchedBindings: detailGroups.filter((group) => group.matchCount > 0).length,
      unmatchedBindings: detailGroups.filter((group) => group.matchCount === 0).length,
    };

    return {
      status: 'ready',
      baselineKey: stageMeta.stageKey,
      requestedStageKey: stageMeta.requestedStageKey,
      financialKey: stageMeta.financialKey,
      workbookVersionKey: stageMeta.financialKey,
      comparisonKey: stageMeta.comparisonKey,
      stageMeta,
      workbookName: toText(workbook && workbook.workbookName, ''),
      summarySheetName: toText(summarySheet && summarySheet.sheetName, safeOptions.summarySheetName || 'summary'),
      summaryRows,
      harnessColumns,
      harnessCostMatrix,
      workbookMatrix: harnessCostMatrix,
      harnessRows,
      records: harnessRows,
      projectSummary,
      harnessSourceDetails,
      rowMetaMap,
      keyCells,
      sheetNames: safeArray(workbook && workbook.sheets).map((sheet) => toText(sheet && sheet.sheetName, '')),
      detailGroups,
      detailCoverage,
    };
  }

  function renderMatrix(container, matrixResult, options) {
    if (!container) return;
    const result = matrixResult && matrixResult.summaryRows ? matrixResult : load(options && options.runtime, options && options.baselineKey, options);
    if (!result || result.status !== 'ready') {
      container.innerHTML = '<div class="financial-matrix-empty">No workbook baseline available.</div>';
      return;
    }

    const headerCells = result.harnessColumns.map((column) => {
      return `<th>${escapeHtml(column.harnessId)}<div style="font-size:11px;color:#9ca3af;">Q=${escapeHtml(column.quantityFactor)} / Mix=${escapeHtml(column.usageRatio)}</div></th>`;
    }).join('');
    const bodyRows = result.harnessCostMatrix.map((row) => {
      const cells = result.harnessColumns.map((column) => {
        const cell = row.cells[column.harnessId] || {};
        const sourceText = safeArray(cell.references).map((ref) => `${ref.sheetName}!${ref.address}`).join(' + ');
        return `<td><div>${escapeHtml(cell.displayValue)}</div>${sourceText ? `<div style="font-size:11px;color:#9ca3af;">${escapeHtml(sourceText)}</div>` : ''}</td>`;
      }).join('');
      return `<tr><th>${escapeHtml(row.label)}</th>${cells}</tr>`;
    }).join('');

    container.innerHTML = `
      <div class="financial-matrix-meta" style="margin-bottom:8px;font-size:12px;color:#9ca3af;">
        Stage: ${escapeHtml(result.stageMeta && result.stageMeta.stageKey)} / Workbook: ${escapeHtml(result.financialKey)} / Sheet: ${escapeHtml(result.summarySheetName)}
      </div>
      <div style="overflow:auto;">
        <table class="financial-matrix-table" style="width:100%;border-collapse:collapse;font-size:12px;">
          <thead>
            <tr>
              <th style="text-align:left;position:sticky;left:0;background:#111125;">Cost row</th>
              ${headerCells}
            </tr>
          </thead>
          <tbody>${bodyRows}</tbody>
        </table>
      </div>
    `;
  }

  global.G281FinancialWorkbookAdapter = {
    FIXED_ROW_SPECS,
    load,
    renderMatrix,
  };
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this);
