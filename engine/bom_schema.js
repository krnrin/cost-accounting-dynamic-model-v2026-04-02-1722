(function (global) {
  'use strict';

  const DEFAULT_PROJECT = 'default-bom';
  const columnToLabel = (column) => {
    let next = Number(column) || 1;
    let label = '';
    while (next > 0) {
      const offset = (next - 1) % 26;
      label = String.fromCharCode(65 + offset) + label;
      next = Math.floor((next - 1) / 26);
    }
    return label || 'A';
  };

  const ensureString = (value, fallback = '') => (typeof value === 'string' ? value : fallback);
  const ensureNumber = (value, fallback = 0) => (Number.isFinite(value) ? value : fallback);
  const ensureArray = (value) => (Array.isArray(value) ? value : []);
  const ensureObject = (value) => (value && typeof value === 'object' ? value : {});

  const normalizeColumn = (column = {}) => {
    const index = Number.isFinite(column.index) ? column.index : null;
    const fallbackIndex = index !== null && index !== undefined ? index : '0';
    const baseLabel = column.label || column.key || `Column ${fallbackIndex}`;
    const safeLabel = ensureString(baseLabel, `Column${fallbackIndex}`);
    return {
      index,
      key: ensureString(
        column.key,
        safeLabel.toLowerCase().replace(/[^a-z0-9]+/gi, '_') || `col_${fallbackIndex}`,
      ),
      label: safeLabel,
      dataType: ensureString(column.dataType, column.type || 'string'),
      width: Number.isFinite(column.width) ? column.width : null,
      hidden: Boolean(column.hidden),
      meta: ensureObject(column.meta),
    };
  };

  const normalizeCell = (cell = {}) => {
    const row = Number.isFinite(cell.row) ? cell.row : (Number.isFinite(cell.rowIndex) ? cell.rowIndex : 1);
    const column = Number.isFinite(cell.column) ? cell.column : (Number.isFinite(cell.columnIndex) ? cell.columnIndex : 1);
    const fallbackAddress = `${columnToLabel(column)}${row}`;
    const mergeRef = ensureString(cell.mergedRange, null);
    return {
      address: ensureString(cell.address, fallbackAddress),
      row,
      column,
      value: cell.value !== undefined ? cell.value : null,
      formula: ensureString(cell.formula, null),
      display: ensureString(cell.display || cell.text, null),
      dataType: ensureString(cell.dataType, cell.type || (cell.formula ? 'formula' : typeof cell.value)),
      styleId: Number.isFinite(cell.styleId) ? cell.styleId : null,
      numberFormat: ensureString(cell.numberFormat, null),
      hyperlink: ensureObject(cell.hyperlink),
      comment: ensureObject(cell.comment),
      mergedRange: mergeRef,
      mergeId: ensureString(cell.mergeId, mergeRef ? mergeRef.replace(/[^A-Za-z0-9]/g, '_') : null),
      lineBreaks: ensureArray(cell.lineBreaks),
      meta: ensureObject(cell.meta),
    };
  };

  const normalizeRow = (row = {}) => ({
    rowIndex: Number.isFinite(row.rowIndex) ? row.rowIndex : (Number.isFinite(row.index) ? row.index : 0),
    rowType: ensureString(row.rowType, 'standard'),
    isHeader: Boolean(row.isHeader),
    height: Number.isFinite(row.height) ? row.height : null,
    locked: Boolean(row.locked),
    cells: ensureArray(row.cells).map(normalizeCell),
    spanCount: Number.isFinite(row.spanCount) ? row.spanCount : null,
    meta: ensureObject(row.meta),
  });

  const normalizeSheet = (sheet = {}) => {
    const cells = ensureArray(sheet.cells).map(normalizeCell);
    const rawColumns = ensureArray(sheet.columns).map(normalizeColumn);
    const fallbackColumnCount = Math.max(
      rawColumns.length,
      ...cells.map((cell) => cell.column + 1),
      0,
    );
    const normalizedColumns = rawColumns.length
      ? rawColumns
      : Array.from({ length: fallbackColumnCount }, (_, index) => normalizeColumn({ index }));

    const rowsMap = new Map();
    cells.forEach((cell) => {
      if (!rowsMap.has(cell.row)) {
        rowsMap.set(cell.row, { rowIndex: cell.row, isHeader: cell.row <= (sheet.headerRows || 1), cells: [] });
      }
      rowsMap.get(cell.row).cells.push(cell);
    });

    const rows = Array.from(rowsMap.keys())
      .sort((a, b) => a - b)
      .map((rowIndex) => normalizeRow(rowsMap.get(rowIndex)));

    return {
      sheetName: ensureString(sheet.sheetName, 'Sheet1'),
      sheetState: ensureString(sheet.sheetState, sheet.state || 'visible'),
      headerRows: Number.isFinite(sheet.headerRows) ? sheet.headerRows : 1,
      columnCount: fallbackColumnCount,
      rowCount: rows.length,
      freezePane: ensureString(sheet.freezePane, null),
      mergedRanges: ensureArray(sheet.mergedRanges),
      hiddenRows: ensureArray(sheet.hiddenRows),
      hiddenColumns: ensureArray(sheet.hiddenColumns),
      columnDimensions: ensureArray(sheet.columnDimensions),
      rowDimensions: ensureArray(sheet.rowDimensions),
      columns: normalizedColumns,
      rows,
      meta: ensureObject(sheet.meta),
    };
  };

  const normalizeWorkbook = (payload = {}) => {
    const sheets = ensureArray(payload.sheets);
    const normalizedSheets = sheets.length ? sheets.map(normalizeSheet) : [normalizeSheet(payload.sheet || {})];
    return {
      generatedAt: ensureString(payload.generatedAt, new Date().toISOString()),
      generator: ensureString(payload.generator, 'g281-bom-native'),
      sourceFileName: ensureString(payload.sourceFileName, payload.workbookName),
      sourcePath: ensureString(payload.sourcePath, null),
      workbookName: ensureString(payload.workbookName, normalizedSheets[0].sheetName),
      sheetOrder: ensureArray(payload.sheetOrder).length ? ensureArray(payload.sheetOrder) : normalizedSheets.map((sheet) => sheet.sheetName),
      sheetCount: normalizedSheets.length,
      hiddenSheets: ensureArray(payload.hiddenSheets),
      workbookMeta: ensureObject(payload.workbookMeta),
      sheets: normalizedSheets,
    };
  };

  const ensureProjectId = (payload = {}) => ensureString(payload.projectId, DEFAULT_PROJECT);
  const ensureVersionId = (payload = {}, fallbackTimestamp) => ensureString(payload.versionId, `${ensureProjectId(payload)}-${fallbackTimestamp || Date.now()}`);
  const ensureSourceType = (payload = {}) => ensureString(payload.sourceType, payload.kind || 'bom');

  const createVersionRecord = (payload = {}) => {
    const workbook = normalizeWorkbook(payload.workbook || payload.payload || {});
    const primarySheet = workbook.sheets[0];
    const now = new Date().toISOString();
    const versionId = ensureVersionId(payload, now.replace(/[^a-zA-Z0-9]/g, ''));
    const versionLabel = ensureString(payload.versionLabel, primarySheet.sheetName);
    const workbookMeta = {
      ...workbook.workbookMeta,
      workbookName: workbook.workbookName,
      sheetCount: workbook.sheetCount,
      sheetOrder: workbook.sheetOrder,
      hiddenSheets: workbook.hiddenSheets,
      freezePane: primarySheet.freezePane,
      mergedRanges: primarySheet.mergedRanges,
      sourceFileName: workbook.sourceFileName,
      sourcePath: workbook.sourcePath,
      sheetState: primarySheet.sheetState,
      generatedAt: workbook.generatedAt,
      generator: workbook.generator,
    };

    return {
      projectId: ensureProjectId(payload),
      versionId,
      versionLabel,
      versionKey: ensureString(payload.versionKey, null),
      sourceType: ensureSourceType(payload),
      sheetName: primarySheet.sheetName,
      headerRows: primarySheet.headerRows,
      columns: primarySheet.columns,
      rows: primarySheet.rows,
      sheets: workbook.sheets,
      workbook,
      workbookMeta,
      createdAt: ensureString(payload.createdAt, now),
      updatedAt: ensureString(payload.updatedAt, now),
      meta: ensureObject(payload.meta),
    };
  };

  global.G281BomSchema = {
    normalizeCell,
    normalizeRow,
    normalizeSheet,
    normalizeWorkbook,
    createVersionRecord,
    defaults: {
      projectId: DEFAULT_PROJECT,
      sourceType: 'bom',
    },
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = global.G281BomSchema;
  }
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this);
