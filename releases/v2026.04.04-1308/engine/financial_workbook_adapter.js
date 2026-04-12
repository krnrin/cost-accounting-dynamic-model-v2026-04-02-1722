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

  const DEFAULT_SUMMARY_SHEET = '项目评估汇总（昆山90%）';
  const FIXED_ROW_SPECS = [
    { key: 'customerPartNumber', rowNumber: 3, label: '线束号', kind: 'meta' },
    { key: 'quantityFactor', rowNumber: 4, label: '单套数量', kind: 'meta' },
    { key: 'totalCost', rowNumber: 14, label: '单套总成本', kind: 'metric' },
    { key: 'material', rowNumber: 15, label: '材料成本', kind: 'metric' },
    { key: 'directLabor', rowNumber: 16, label: '直接人工', kind: 'metric', detailKind: 'labor' },
    { key: 'directLaborOpen', rowNumber: 17, label: '前工程', kind: 'metric', detailKind: 'labor' },
    { key: 'directLaborAssembly', rowNumber: 18, label: '后工程', kind: 'metric', detailKind: 'labor' },
    { key: 'directLaborOther', rowNumber: 19, label: '其他人工', kind: 'metric', detailKind: 'labor' },
    { key: 'equipment', rowNumber: 20, label: '设备折旧', kind: 'metric', detailKind: 'capitalEquipment' },
    { key: 'equipmentOwned', rowNumber: 21, label: '设备投入', kind: 'metric', detailKind: 'capitalEquipment' },
    { key: 'toolingAndFixtures', rowNumber: 22, label: '模具/工装', kind: 'metric', detailKind: 'capitalTooling' },
    { key: 'manufacturing', rowNumber: 23, label: '制造费用', kind: 'metric', detailKind: 'manufacturing' },
    { key: 'manufacturingEnergy', rowNumber: 24, label: '动力', kind: 'metric', detailKind: 'manufacturing' },
    { key: 'manufacturingRepair', rowNumber: 25, label: '修理', kind: 'metric', detailKind: 'manufacturing' },
    { key: 'manufacturingLowValue', rowNumber: 26, label: '低值易耗', kind: 'metric', detailKind: 'manufacturing' },
    { key: 'manufacturingIndirectLabor', rowNumber: 27, label: '间接人工', kind: 'metric', detailKind: 'manufacturing' },
    { key: 'manufacturingWelfare', rowNumber: 28, label: '福利', kind: 'metric', detailKind: 'manufacturing' },
    { key: 'manufacturingManagement', rowNumber: 29, label: '管理费用', kind: 'metric', detailKind: 'manufacturing' },
    { key: 'manufacturingOther', rowNumber: 30, label: '其他制造费', kind: 'metric', detailKind: 'manufacturing' },
    { key: 'rnd', rowNumber: 31, label: '研发费用', kind: 'metric', detailKind: 'rnd' },
    { key: 'packaging', rowNumber: 32, label: '包装物流', kind: 'metric', detailKind: 'packaging' },
    { key: 'usageRatio', rowNumber: 35, label: '装车比', kind: 'meta' },
  ];

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

  function resolveAssessmentWorkbook(runtimeInput, baselineKey) {
    const runtime = resolveRuntime(runtimeInput);
    const repoWorkbook = runtimeInput && typeof runtimeInput.getAssessmentWorkbookSeed === 'function'
      ? runtimeInput.getAssessmentWorkbookSeed(baselineKey || 'quote')
      : null;
    if (repoWorkbook) return repoWorkbook;
    const versions = runtime && runtime.financialVersions && runtime.financialVersions.versions
      ? runtime.financialVersions.versions
      : {};
    const version = versions[baselineKey || 'quote'] || versions.quote || null;
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

  function pickSummarySheet(workbook, preferredName) {
    const sheets = safeArray(workbook && workbook.sheets);
    if (!sheets.length) return null;
    return sheets.find((sheet) => toText(sheet && sheet.sheetName) === preferredName)
      || sheets.find((sheet) => toText(sheet && sheet.sheetName).includes('项目评估汇总'))
      || sheets[0];
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

  function flattenCapitalDetails(runtime, keys) {
    const comparisons = runtime && runtime.capitalValidation && runtime.capitalValidation.comparisons
      ? runtime.capitalValidation.comparisons
      : {};
    return safeArray(keys).flatMap((key) => {
      const scope = comparisons[key];
      if (!scope) return [];
      return safeArray(scope.groups).flatMap((group) => {
        return safeArray(group && group.aligned).map((item) => {
          const quote = item && item.quote ? item.quote : {};
          return {
            sourceScope: key,
            sectionLabel: toText(group && group.label, scope.scopeLabel || key),
            itemName: toText(quote.itemName || quote.investmentName, ''),
            spec: toText(quote.spec, ''),
            demandQty: numberOr(quote.demandQty, null),
            newAmount: numberOr(quote.newAmount, null),
            unitPrice: numberOr(quote.unitPrice, null),
            sourceSheet: toText(quote.sheetName, scope.quoteSheet || ''),
            sourceCell: toText(quote.sourceCell, ''),
            raw: clonePlain(quote, {}),
          };
        });
      });
    });
  }

  function flattenAlignedScope(scope) {
    return safeArray(scope && scope.groups).flatMap((group) => {
      return safeArray(group && group.aligned).map((item) => {
        const quote = item && item.quote ? item.quote : {};
        return {
          sectionLabel: toText(group && group.label, scope && scope.scopeLabel),
          itemKey: toText(quote.itemKey, ''),
          label: toText(quote.displayLabel || quote.label, ''),
          value: numberOr(quote.numericValue, numberOr(quote.value, null)),
          sourceSheet: toText(quote.sourceSheet, ''),
          sourceCell: toText(quote.sourceCell, ''),
          source: toText(quote.source, ''),
          note: toText(quote.note, ''),
          formula: toText(quote.formula, ''),
          raw: clonePlain(quote, {}),
        };
      });
    });
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
        sourceRow: rowNumber,
      });
    });
    return lookup;
  }

  function buildSourceDetail(runtime, rowSpec, harnessColumn, cell, sheetLookup, packagingLookup) {
    const detail = {
      rowKey: rowSpec.key,
      label: rowSpec.label,
      value: numericCellValue(cell),
      displayValue: displayCellValue(cell),
      formula: toText(cell && cell.formula, ''),
      references: [],
      details: [],
    };
    detail.references = parseFormulaReferences(detail.formula).map((ref) => {
      const refSheet = sheetLookup.get(ref.sheetName);
      const refCell = refSheet ? buildSheetMaps(refSheet).byAddress.get(ref.address.toUpperCase()) : null;
      return {
        sheetName: ref.sheetName,
        address: ref.address,
        value: displayCellValue(refCell),
      };
    });

    if (rowSpec.detailKind === 'labor') {
      const comparisons = runtime && runtime.laborValidation && runtime.laborValidation.comparisons
        ? runtime.laborValidation.comparisons
        : {};
      const scopes = rowSpec.key === 'manufacturing' ? [comparisons.manufacturing] : [comparisons.directLabor, comparisons.scenario];
      detail.details = scopes.flatMap((scope) => flattenAlignedScope(scope)).filter(Boolean);
    } else if (rowSpec.detailKind === 'manufacturing') {
      const scope = runtime && runtime.laborValidation && runtime.laborValidation.comparisons
        ? runtime.laborValidation.comparisons.manufacturing
        : null;
      detail.details = flattenAlignedScope(scope);
    } else if (rowSpec.detailKind === 'capitalEquipment') {
      detail.details = flattenCapitalDetails(runtime, ['equipment']);
    } else if (rowSpec.detailKind === 'capitalTooling') {
      detail.details = flattenCapitalDetails(runtime, ['tooling', 'fixtures']);
    } else if (rowSpec.detailKind === 'packaging') {
      const packagingItem = packagingLookup.get(harnessColumn.harnessId);
      if (packagingItem) {
        detail.details = [packagingItem];
      } else {
        const scope = runtime && runtime.packagingValidation && runtime.packagingValidation.comparisons
          ? runtime.packagingValidation.comparisons.breakdown
          : null;
        detail.details = flattenAlignedScope(scope);
      }
    }

    return detail;
  }

  function load(runtimeInput, baselineKey, options) {
    const runtime = resolveRuntime(runtimeInput);
    const safeOptions = options || {};
    const workbook = resolveAssessmentWorkbook(runtimeInput, baselineKey || safeOptions.baselineKey || 'quote');
    if (!workbook) {
      return {
        status: 'missing',
        baselineKey: baselineKey || safeOptions.baselineKey || 'quote',
        summaryRows: [],
        harnessColumns: [],
        harnessCostMatrix: [],
        harnessSourceDetails: {},
        rowMetaMap: {},
      };
    }

    const sheetLookup = buildSheetLookup(workbook);
    const summarySheet = pickSummarySheet(workbook, safeOptions.summarySheetName || DEFAULT_SUMMARY_SHEET);
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

    const summaryRows = FIXED_ROW_SPECS.map((rowSpec) => ({
      key: rowSpec.key,
      rowNumber: rowSpec.rowNumber,
      label: rowLabel(summaryMaps, rowSpec),
      kind: rowSpec.kind,
      detailKind: rowSpec.detailKind || '',
    }));
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
        cells: {},
      };
      harnessColumns.forEach((harnessColumn) => {
        const cell = summaryMaps.byAddress.get(`${harnessColumn.columnLetter}${row.rowNumber}`);
        const detail = buildSourceDetail(runtime, row, harnessColumn, cell, sheetLookup, packagingLookup);
        if (!harnessSourceDetails[harnessColumn.harnessId]) harnessSourceDetails[harnessColumn.harnessId] = {};
        harnessSourceDetails[harnessColumn.harnessId][row.key] = detail;
        matrixRow.cells[harnessColumn.harnessId] = {
          value: detail.value,
          displayValue: detail.displayValue,
          formula: detail.formula,
          references: detail.references,
        };
      });
      return matrixRow;
    });

    const keyCells = {};
    ['P3', 'P4', 'P14', 'P16', 'P20', 'P21', 'P22', 'P23', 'P31', 'P32'].forEach((address) => {
      const cell = summaryMaps.byAddress.get(address);
      keyCells[address] = {
        value: displayCellValue(cell),
        formula: toText(cell && cell.formula, ''),
      };
    });

    return {
      status: 'ready',
      baselineKey: baselineKey || safeOptions.baselineKey || 'quote',
      workbookName: toText(workbook && workbook.workbookName, ''),
      summarySheetName: toText(summarySheet && summarySheet.sheetName, DEFAULT_SUMMARY_SHEET),
      summaryRows,
      harnessColumns,
      harnessCostMatrix,
      harnessSourceDetails,
      rowMetaMap,
      keyCells,
      sheetNames: safeArray(workbook && workbook.sheets).map((sheet) => toText(sheet && sheet.sheetName, '')),
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
        Baseline: ${escapeHtml(result.baselineKey)} / Sheet: ${escapeHtml(result.summarySheetName)}
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
