(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory(root);
    return;
  }
  root.G281BomTemplateRuntime = factory(root);
})(typeof globalThis !== 'undefined' ? globalThis : this, function (global) {
  'use strict';

  const DEFAULT_TARGET_SHEETS = [
    { key: 'assemblyParts', label: '总成散件清单', matchers: ['总成散件清单'] },
    { key: 'secondaryMaterials', label: '二次物料明细', matchers: ['二次物料明细'] },
    { key: 'kskHarnessBom', label: 'KSK线束BOM明细', matchers: ['KSK线束BOM明细'] },
  ];

  const DEFAULT_VERSION_KEYS = ['quote', 'fixed'];
  const DEFAULT_SNAPSHOT_ROW_COUNT = 1000;
  const DEFAULT_SNAPSHOT_COLUMN_COUNT = 26;
  const DEFAULT_ROW_HEIGHT = 24;
  const DEFAULT_COLUMN_WIDTH = 88;

  function clonePlain(value, fallback) {
    if (value === undefined || value === null) {
      return fallback;
    }
    return JSON.parse(JSON.stringify(value));
  }

  function ensureObject(value) {
    return value && typeof value === 'object' ? value : {};
  }

  function ensureArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function ensureString(value, fallback) {
    return typeof value === 'string' ? value : (fallback || '');
  }

  function normalizeTargetSheetConfig(targetSheets) {
    const candidates = Array.isArray(targetSheets) && targetSheets.length ? targetSheets : DEFAULT_TARGET_SHEETS;
    return candidates.map((item, index) => {
      if (typeof item === 'string') {
        return { key: `sheet_${index + 1}`, label: item, matchers: [item] };
      }
      return {
        key: ensureString(item.key, `sheet_${index + 1}`),
        label: ensureString(item.label, ensureString(item.name, `Sheet ${index + 1}`)),
        matchers: ensureArray(item.matchers).length ? ensureArray(item.matchers) : [ensureString(item.label, '')].filter(Boolean),
      };
    });
  }

  function inferSource(explicitSource) {
    if (explicitSource) {
      return explicitSource;
    }
    if (global?.G281_RUNTIME?.bomWorkbookCopies) {
      return global.G281_RUNTIME.bomWorkbookCopies;
    }
    return null;
  }

  function normalizeRuntimeWorkbookSource(source) {
    const payload = ensureObject(source);
    return {
      contract: clonePlain(ensureObject(payload.contract), {}),
      generatedAt: ensureString(payload.generatedAt, null),
      generator: ensureString(payload.generator, 'g281-bom-template-runtime'),
      sourceDirectory: ensureString(payload.sourceDirectory, null),
      versionOrder: clonePlain(ensureArray(payload.versionOrder), []),
      versions: clonePlain(ensureObject(payload.versions), {}),
    };
  }

  function normalizeSheet(sheet, styleTable) {
    const safeSheet = ensureObject(sheet);
    return {
      workbookSheetIndex: Number.isFinite(Number(safeSheet.workbookSheetIndex)) ? Number(safeSheet.workbookSheetIndex) : null,
      sheetName: ensureString(safeSheet.sheetName, 'Sheet1'),
      sheetState: ensureString(safeSheet.sheetState, safeSheet.isHidden ? 'hidden' : 'visible'),
      isHidden: Boolean(safeSheet.isHidden),
      sheetOrderKey: ensureString(safeSheet.sheetOrderKey, safeSheet.sheetName),
      dimensionRef: ensureString(safeSheet.dimensionRef, null),
      maxRow: Number(safeSheet.maxRow) || 0,
      maxColumn: Number(safeSheet.maxColumn) || 0,
      sheetFormat: clonePlain(ensureObject(safeSheet.sheetFormat), {}),
      sheetView: clonePlain(ensureObject(safeSheet.sheetView), {}),
      freezePane: ensureString(safeSheet.freezePane, null),
      mergedRanges: clonePlain(ensureArray(safeSheet.mergedRanges), []),
      rowDimensions: clonePlain(ensureArray(safeSheet.rowDimensions), []),
      columnDimensions: clonePlain(ensureArray(safeSheet.columnDimensions), []),
      hiddenRows: clonePlain(ensureArray(safeSheet.hiddenRows), []),
      hiddenColumns: clonePlain(ensureArray(safeSheet.hiddenColumns), []),
      cells: clonePlain(ensureArray(safeSheet.cells), []),
      styleTable: clonePlain(ensureObject(styleTable), {}),
    };
  }

  function sheetMatches(sheetName, matchers) {
    return ensureArray(matchers).some((matcher) => {
      if (matcher instanceof RegExp) {
        return matcher.test(sheetName);
      }
      const text = ensureString(matcher, '').trim();
      return text ? sheetName === text || sheetName.includes(text) : false;
    });
  }

  function indexTemplateSheets(sheets, targetSheetConfig) {
    return targetSheetConfig.reduce((acc, target) => {
      acc[target.key] = sheets.find((sheet) => sheetMatches(sheet.sheetName, target.matchers)) || null;
      return acc;
    }, {});
  }

  function extractSheetOrder(version, selectedSheets) {
    const sourceOrder = ensureArray(version.sheetOrder);
    const selectedNames = new Set(selectedSheets.map((sheet) => sheet.sheetName));
    const ordered = sourceOrder.filter((sheetName) => selectedNames.has(sheetName));
    const missing = selectedSheets
      .map((sheet) => sheet.sheetName)
      .filter((sheetName) => !ordered.includes(sheetName));
    return ordered.concat(missing);
  }

  function buildWorkbookIntermediate(version, selectedSheets) {
    return {
      workbookName: ensureString(version.sourceFileName, ensureString(version.versionLabel, 'BOM Workbook')).replace(/\.[^.]+$/, ''),
      sourceFileName: ensureString(version.sourceFileName, null),
      sourcePath: ensureString(version.sourcePath, null),
      versionKey: ensureString(version.versionKey, null),
      versionLabel: ensureString(version.versionLabel, null),
      sheetOrder: extractSheetOrder(version, selectedSheets),
      hiddenSheets: ensureArray(version.hiddenSheets).filter((sheetName) => selectedSheets.some((sheet) => sheet.sheetName === sheetName)),
      styleTable: clonePlain(ensureObject(version.styleTable), {}),
      sheets: clonePlain(selectedSheets, []),
    };
  }

  function decodeCell(ref) {
    const match = /^([A-Z]+)(\d+)$/.exec(String(ref || '').trim().toUpperCase());
    if (!match) {
      return null;
    }
    const [, colLabel, rowText] = match;
    let column = 0;
    for (let index = 0; index < colLabel.length; index += 1) {
      column = column * 26 + (colLabel.charCodeAt(index) - 64);
    }
    return {
      c: column - 1,
      r: Math.max(0, Number(rowText) - 1),
    };
  }

  function decodeRange(ref) {
    const text = String(ref || '').trim().toUpperCase();
    if (!text) return null;
    const parts = text.split(':');
    if (parts.length === 1) {
      const cell = decodeCell(parts[0]);
      return cell ? { s: cell, e: cell } : null;
    }
    const start = decodeCell(parts[0]);
    const end = decodeCell(parts[1]);
    if (!start || !end) return null;
    return { s: start, e: end };
  }

  function toHexColor(color) {
    if (!color || typeof color !== 'object') return '';
    const rgb = String(color.rgb || '').trim();
    if (rgb.length === 8) return `#${rgb.slice(2)}`;
    if (rgb.length === 6) return `#${rgb}`;
    return '';
  }

  function mapHorizontalAlign(value) {
    const normalized = String(value || '').toLowerCase();
    if (normalized === 'left') return 1;
    if (normalized === 'center' || normalized === 'centercontinuous') return 2;
    if (normalized === 'right') return 3;
    if (normalized === 'justify') return 4;
    if (normalized === 'distributed') return 5;
    return 0;
  }

  function mapVerticalAlign(value) {
    const normalized = String(value || '').toLowerCase();
    if (normalized === 'top') return 1;
    if (normalized === 'center') return 2;
    if (normalized === 'bottom') return 3;
    if (normalized === 'justify') return 4;
    if (normalized === 'distributed') return 5;
    return 0;
  }

  function normalizeCellValueType(value) {
    if (typeof value === 'number') return 2;
    if (typeof value === 'string') return 1;
    if (typeof value === 'boolean') return 3;
    return null;
  }

  function convertStyleTable(styleTable) {
    const styleKeys = {};
    const styles = {};
    Object.entries(ensureObject(styleTable)).forEach(([styleId, definition]) => {
      const safeDefinition = ensureObject(definition);
      const next = {};
      const font = ensureObject(safeDefinition.font);
      const fill = ensureObject(safeDefinition.fill);
      const alignment = ensureObject(safeDefinition.alignment);
      const fillColor = toHexColor(fill.fgColor) || toHexColor(fill.bgColor);
      const fontColor = toHexColor(font.color);

      if (font.name) next.ff = font.name;
      if (Number.isFinite(Number(font.size))) next.fs = Math.round(Number(font.size));
      if (font.bold) next.bl = 1;
      if (font.italic) next.it = 1;
      if (font.underline) next.ul = 1;
      if (font.strike) next.st = 1;
      if (fillColor && fillColor !== '#000000') next.bg = { rgb: fillColor };
      if (fontColor && fontColor !== '#000000') next.cl = { rgb: fontColor };

      const horizontal = mapHorizontalAlign(alignment.horizontal);
      const vertical = mapVerticalAlign(alignment.vertical);
      if (horizontal) next.ht = horizontal;
      if (vertical) next.vt = vertical;
      if (alignment.wrapText) next.tb = 3;

      if (!Object.keys(next).length) return;
      const key = `rt_${styleId}`;
      styles[key] = next;
      styleKeys[styleId] = key;
    });
    return { styleKeys, styles };
  }

  function buildFreezeSnapshot(topLeftCell) {
    const decoded = decodeCell(topLeftCell);
    if (!decoded) {
      return { startRow: -1, startColumn: -1, ySplit: 0, xSplit: 0 };
    }
    return {
      startRow: decoded.r,
      startColumn: decoded.c,
      ySplit: decoded.r,
      xSplit: decoded.c,
    };
  }

  function buildMergeSnapshot(mergedRanges) {
    return ensureArray(mergedRanges).reduce((acc, rangeRef) => {
      const decoded = decodeRange(rangeRef);
      if (!decoded) return acc;
      acc.push({
        startRow: decoded.s.r,
        startColumn: decoded.s.c,
        endRow: decoded.e.r,
        endColumn: decoded.e.c,
      });
      return acc;
    }, []);
  }

  function toPixelHeight(row) {
    const pixelHeight = Number(row?.hpx);
    if (Number.isFinite(pixelHeight) && pixelHeight > 0) {
      return pixelHeight;
    }
    const pointHeight = Number(row?.hpt || row?.height);
    if (Number.isFinite(pointHeight) && pointHeight > 0) {
      return Math.max(18, Math.round(pointHeight * (96 / 72)));
    }
    return null;
  }

  function toPixelWidth(column) {
    const pixelWidth = Number(column?.wpx);
    if (Number.isFinite(pixelWidth) && pixelWidth > 0) {
      return pixelWidth;
    }
    const excelWidth = Number(column?.wch || column?.width);
    if (Number.isFinite(excelWidth) && excelWidth > 0) {
      return Math.max(24, Math.round(excelWidth * 7 + 5));
    }
    return null;
  }

  function buildRowSnapshot(rowDimensions) {
    return ensureArray(rowDimensions).reduce((acc, row) => {
      const rowIndex = Number(row?.row);
      if (!Number.isFinite(rowIndex) || rowIndex < 1) return acc;
      const entry = {};
      const height = toPixelHeight(row);
      if (Number.isFinite(height) && height > 0) {
        entry.h = height;
      }
      if (row?.hidden) {
        entry.hd = 1;
      }
      if (Object.keys(entry).length) {
        acc[rowIndex - 1] = entry;
      }
      return acc;
    }, {});
  }

  function buildColumnSnapshot(columnDimensions) {
    return ensureArray(columnDimensions).reduce((acc, column) => {
      const start = Number(column?.min || column?.index);
      const end = Number(column?.max || start);
      if (!Number.isFinite(start) || start < 1 || !Number.isFinite(end) || end < start) return acc;
      for (let current = start; current <= end; current += 1) {
        const entry = {};
        const width = toPixelWidth(column);
        if (Number.isFinite(width) && width > 0) {
          entry.w = width;
        }
        if (column?.hidden) {
          entry.hd = 1;
        }
        if (Object.keys(entry).length) {
          acc[current - 1] = entry;
        }
      }
      return acc;
    }, {});
  }

  function buildCellSnapshot(cells, styleKeys) {
    return ensureArray(cells).reduce((acc, cell) => {
      const rowIndex = Number(cell?.row);
      const columnIndex = Number(cell?.column);
      if (!Number.isFinite(rowIndex) || rowIndex < 1 || !Number.isFinite(columnIndex) || columnIndex < 1) {
        return acc;
      }
      const entry = {};
      const styleKey = styleKeys[String(cell?.styleId)] || null;
      if (styleKey) entry.s = styleKey;
      if (cell?.formula) {
        entry.f = String(cell.formula).startsWith('=') ? String(cell.formula) : `=${cell.formula}`;
        if (cell.value !== null && cell.value !== undefined && cell.value !== '') {
          entry.v = cell.value;
        }
      } else if (cell?.value !== null && cell?.value !== undefined && cell?.value !== '') {
        entry.v = cell.value;
        const valueType = normalizeCellValueType(cell.value);
        if (valueType !== null) entry.t = valueType;
      }
      if (!Object.keys(entry).length) return acc;
      const rowKey = rowIndex - 1;
      const columnKey = columnIndex - 1;
      acc[rowKey] = acc[rowKey] || {};
      acc[rowKey][columnKey] = entry;
      return acc;
    }, {});
  }

  function toUniverSheetIntermediate(sheet) {
    return {
      name: sheet.sheetName,
      state: sheet.sheetState,
      rowCount: Number(sheet.maxRow) || 0,
      columnCount: Number(sheet.maxColumn) || 0,
      freeze: buildFreezeSnapshot(sheet.freezePane),
      merges: clonePlain(ensureArray(sheet.mergedRanges), []),
      hiddenRows: clonePlain(ensureArray(sheet.hiddenRows), []),
      hiddenColumns: clonePlain(ensureArray(sheet.hiddenColumns), []),
      rowDimensions: clonePlain(ensureArray(sheet.rowDimensions), []),
      columnDimensions: clonePlain(ensureArray(sheet.columnDimensions), []),
      cells: ensureArray(sheet.cells).map((cell) => ({
        address: ensureString(cell.address, ''),
        row: Number(cell.row) || 1,
        column: Number(cell.column) || 1,
        value: Object.prototype.hasOwnProperty.call(cell, 'value') ? cell.value : null,
        formula: ensureString(cell.formula, null),
        display: ensureString(cell.display, null),
        dataType: ensureString(cell.dataType, null),
        styleId: Number.isFinite(cell.styleId) ? cell.styleId : null,
        numberFormat: ensureString(cell.numberFormat, null),
      })),
    };
  }

  function toUniverWorkbookIntermediate(context) {
    const workbook = ensureObject(context?.workbook);
    return {
      kind: 'g281-univer-workbook-intermediate',
      workbookName: ensureString(workbook.workbookName, 'BOM Workbook'),
      sourceFileName: ensureString(workbook.sourceFileName, null),
      sourcePath: ensureString(workbook.sourcePath, null),
      versionKey: ensureString(context?.versionKey, null),
      versionLabel: ensureString(context?.versionLabel, null),
      sheetOrder: clonePlain(ensureArray(workbook.sheetOrder), []),
      hiddenSheets: clonePlain(ensureArray(workbook.hiddenSheets), []),
      styleTable: clonePlain(ensureObject(workbook.styleTable), {}),
      sheets: ensureArray(workbook.sheets).map(toUniverSheetIntermediate),
    };
  }

  function convertIntermediateWorkbookToUniverSnapshot(workbookIntermediate, options) {
    const settings = ensureObject(options);
    const workbook = ensureObject(workbookIntermediate);
    const { styleKeys, styles } = convertStyleTable(workbook.styleTable);
    const sheets = {};
    const sheetOrder = [];
    const sheetList = ensureArray(workbook.sheets);

    sheetList.forEach((sheet, index) => {
      const sheetId = `runtime_sheet_${index + 1}_${Date.now().toString(36)}`;
      const rowCount = Math.max(Number(sheet?.maxRow || sheet?.rowCount) || 0, Number(settings.defaultRowCount) || DEFAULT_SNAPSHOT_ROW_COUNT);
      const columnCount = Math.max(Number(sheet?.maxColumn || sheet?.columnCount) || 0, Number(settings.defaultColumnCount) || DEFAULT_SNAPSHOT_COLUMN_COUNT);
      const snapshot = {
        id: sheetId,
        name: ensureString(sheet?.sheetName || sheet?.name, `Sheet${index + 1}`),
        tabColor: '',
        hidden: sheet?.sheetState === 'veryHidden' || sheet?.state === 'veryHidden' ? 2 : (sheet?.sheetState === 'hidden' || sheet?.state === 'hidden' ? 1 : 0),
        rowCount,
        columnCount,
        zoomRatio: 1,
        freeze: buildFreezeSnapshot(sheet?.freezePane || sheet?.freeze),
        scrollTop: 0,
        scrollLeft: 0,
        defaultColumnWidth: Number(settings.defaultColumnWidth) || DEFAULT_COLUMN_WIDTH,
        defaultRowHeight: Number(settings.defaultRowHeight) || DEFAULT_ROW_HEIGHT,
        mergeData: buildMergeSnapshot(sheet?.mergedRanges || sheet?.merges),
        cellData: buildCellSnapshot(sheet?.cells, styleKeys),
        rowData: buildRowSnapshot(sheet?.rowDimensions),
        columnData: buildColumnSnapshot(sheet?.columnDimensions),
        showGridlines: 1,
        rowHeader: { width: 46, hidden: 0 },
        columnHeader: { height: 24, hidden: 0 },
        rightToLeft: 0,
      };
      sheets[sheetId] = snapshot;
      sheetOrder.push(sheetId);
    });

    return {
      id: `runtime_workbook_${Date.now().toString(36)}`,
      name: ensureString(settings.workbookName, ensureString(workbook.workbookName, 'BOM Template')),
      appVersion: '0.18.0',
      locale: 'zhCN',
      sheetOrder,
      styles,
      sheets,
      resources: [],
    };
  }

  function toTemplateSheetPayload(context, sheetKey) {
    const sheet = context?.templates?.[sheetKey] || null;
    if (!sheet) {
      return null;
    }
    return {
      kind: 'g281-bom-template-sheet',
      projectId: context.projectId,
      versionKey: context.versionKey,
      versionLabel: context.versionLabel,
      workbookName: context.workbook.workbookName,
      sourceFileName: context.workbook.sourceFileName,
      sourcePath: context.workbook.sourcePath,
      styleTable: clonePlain(context.workbook.styleTable, {}),
      sheet: clonePlain(sheet, null),
      univerSheet: toUniverSheetIntermediate(sheet),
    };
  }

  function buildVersionTemplateContext(versionKey, options) {
    const normalizedOptions = ensureObject(options);
    const source = normalizeRuntimeWorkbookSource(inferSource(normalizedOptions.source));
    const targetSheetConfig = normalizeTargetSheetConfig(normalizedOptions.targetSheets);
    const projectId = ensureString(normalizedOptions.projectId, ensureString(source.contract?.projectId, 'default-bom'));
    const version = ensureObject(source.versions?.[versionKey]);
    if (!Object.keys(version).length) {
      throw new Error(`[G281BomTemplateRuntime] Workbook copy version not found: ${versionKey}`);
    }

    const styleTable = clonePlain(ensureObject(version.styleTable), {});
    const normalizedSheets = ensureArray(version.sheets).map((sheet) => normalizeSheet(sheet, styleTable));
    const indexedTemplates = indexTemplateSheets(normalizedSheets, targetSheetConfig);
    const selectedSheets = Object.values(indexedTemplates).filter(Boolean);

    if (!selectedSheets.length) {
      throw new Error(`[G281BomTemplateRuntime] No target BOM template sheets found for version: ${versionKey}`);
    }

    const workbook = buildWorkbookIntermediate(version, selectedSheets);
    return {
      kind: 'g281-bom-template-context',
      projectId,
      versionKey,
      versionLabel: ensureString(version.versionLabel, versionKey),
      generatedAt: source.generatedAt,
      sourceDirectory: source.sourceDirectory,
      contract: clonePlain(source.contract, {}),
      targetSheetConfig,
      workbook,
      templates: indexedTemplates,
    };
  }

  function buildVersionWorkbookSnapshot(versionKey, options) {
    const context = buildVersionTemplateContext(versionKey, options);
    return convertIntermediateWorkbookToUniverSnapshot(context.workbook, options);
  }

  function buildVersionTemplateContextWithUniver(options) {
    const versionKey = ensureString(options?.versionKey, 'quote');
    const context = buildVersionTemplateContext(versionKey, options);
    return {
      ...context,
      univerWorkbook: toUniverWorkbookIntermediate(context),
      workbookSnapshot: convertIntermediateWorkbookToUniverSnapshot(context.workbook, options),
    };
  }

  function buildTemplateContexts(options) {
    const normalizedOptions = ensureObject(options);
    const versionKeys = ensureArray(normalizedOptions.versionKeys).length ? ensureArray(normalizedOptions.versionKeys) : DEFAULT_VERSION_KEYS;
    return versionKeys.reduce((acc, versionKey) => {
      acc[versionKey] = buildVersionTemplateContextWithUniver({ ...normalizedOptions, versionKey });
      return acc;
    }, {});
  }

  return {
    DEFAULT_TARGET_SHEETS: clonePlain(DEFAULT_TARGET_SHEETS, []),
    normalizeRuntimeWorkbookSource,
    buildVersionTemplateContext,
    buildVersionTemplateContextWithUniver,
    buildVersionWorkbookSnapshot,
    buildTemplateContexts,
    toTemplateSheetPayload,
    toUniverSheetIntermediate,
    toUniverWorkbookIntermediate,
    convertIntermediateWorkbookToUniverSnapshot,
  };
});
