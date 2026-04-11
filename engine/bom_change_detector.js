(function (global) {
  'use strict';

  const Shared = global.G281Shared || {};
  const numberOr = Shared.numberOr || ((value, fallback) => {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : fallback;
  });
  const toText = Shared.toText || ((value, fallback) => {
    const text = String(value == null ? '' : value).trim();
    return text || (fallback == null ? '' : fallback);
  });
  const safeObject = Shared.safeObject || ((value) => (value && typeof value === 'object' ? value : {}));

  function readCellFromData(sheet, rowNumber, columnNumber) {
    const data = sheet && sheet.cellData ? safeObject(sheet.cellData[String(rowNumber - 1)]) : null;
    if (!data) return null;
    const cell = data[String(columnNumber - 1)] || data[columnNumber - 1];
    if (!cell) return null;
    if ('value' in cell && cell.value != null) return cell.value;
    if ('v' in cell && cell.v != null) return cell.v;
    if ('text' in cell && cell.text != null) return cell.text;
    if ('formattedValue' in cell && cell.formattedValue != null) return cell.formattedValue;
    if ('numericValue' in cell && cell.numericValue != null) return cell.numericValue;
    return null;
  }

  function readCellFromArray(sheet, rowNumber, columnNumber) {
    if (!sheet || !Array.isArray(sheet.cells)) return null;
    for (let index = 0; index < sheet.cells.length; index += 1) {
      const cell = sheet.cells[index];
      if (!cell) continue;
      if (numberOr(cell.row, 0) === rowNumber && numberOr(cell.column, 0) === columnNumber) {
        if ('value' in cell && cell.value != null) return cell.value;
        if ('formattedValue' in cell && cell.formattedValue != null) return cell.formattedValue;
        if ('formula' in cell && cell.formula != null) return cell.formula;
        if ('numericValue' in cell && cell.numericValue != null) return cell.numericValue;
      }
    }
    return null;
  }

  function readCellValue(sheet, rowNumber, columnNumber) {
    const fromData = readCellFromData(sheet, rowNumber, columnNumber);
    if (fromData != null && fromData !== undefined) return fromData;
    return readCellFromArray(sheet, rowNumber, columnNumber);
  }

  function readRowValues(sheet, rowNumber, maxColumn) {
    const values = {};
    const columnLimit = numberOr(maxColumn, 17);
    for (let columnIndex = 1; columnIndex <= columnLimit; columnIndex += 1) {
      const raw = readCellValue(sheet, rowNumber, columnIndex);
      values[columnIndex] = raw == null ? '' : raw;
    }
    return values;
  }

  function extractHarnessRows(sheet, options) {
    if (!sheet) return [];
    const maxRows = Math.max(numberOr(sheet.rowCount, 0), numberOr(sheet.maxRow, 0), 2000);
    const startRow = numberOr(options && options.startRow, 5);
    const columnLimit = numberOr(options && options.columnLimit, 17);
    const rows = [];

    for (let rowNumber = startRow; rowNumber <= maxRows; rowNumber += 1) {
      const cells = readRowValues(sheet, rowNumber, columnLimit);
      const partNo = toText(cells[3], '');
      const partName = toText(cells[4], '');
      const functionText = toText(cells[2], '');
      const quantity = numberOr(cells[10], null);
      const unit = toText(cells[11], '');
      const hasValue = Boolean(partNo || partName || functionText || unit || Number.isFinite(quantity));
      if (!hasValue) continue;
      const displayNo = toText(cells[1], '');
      const remark = toText(cells[12], '');
      rows.push({
        rowNumber,
        displayNo,
        functionText,
        partNo,
        partName,
        unit,
        quantity: Number.isFinite(quantity) ? quantity : null,
        remark,
      });
    }
    return rows;
  }

  function buildRowKey(row) {
    const tokens = [row.partNo, row.functionText, row.displayNo].map((value) => toText(value, '').toLowerCase().replace(/\s+/g, ''));
    const filtered = tokens.filter(Boolean);
    return filtered.length ? filtered.join('|') : `row-${row.rowNumber}`;
  }

  function createRowMap(rows) {
    const map = new Map();
    rows.forEach((row) => {
      map.set(buildRowKey(row), row);
    });
    return map;
  }

  function summariseChanges(changes) {
    return {
      added: changes.added.length,
      removed: changes.removed.length,
      quantityChanges: changes.quantityChanges.length,
      fieldChanges: changes.fieldChanges.length,
    };
  }

  function detectChangeSet(options = {}) {
    const currentSheet = safeObject(options.currentSheet);
    if (!currentSheet.sheetName) {
      return { status: 'missing', reason: 'missingSheet' };
    }
    const priorSheet = safeObject(options.priorSheet);
    const harnessId = toText(options.harnessId, currentSheet.sheetName);
    const currentRows = extractHarnessRows(currentSheet, options);
    const priorRows = priorSheet.sheetName ? extractHarnessRows(priorSheet, options) : [];
    const currentMap = createRowMap(currentRows);
    const priorMap = createRowMap(priorRows);
    const added = [];
    const removed = [];
    const quantityChanges = [];
    const fieldChanges = [];
    const matchedKeys = new Set();

    currentMap.forEach((currentRow, key) => {
      const previousRow = priorMap.get(key);
      if (!previousRow) {
        added.push(currentRow);
        return;
      }
      matchedKeys.add(key);
      if (Number.isFinite(currentRow.quantity) && Number.isFinite(previousRow.quantity) && currentRow.quantity !== previousRow.quantity) {
        quantityChanges.push({ before: previousRow.quantity, after: currentRow.quantity, row: currentRow });
      }
      const partChanged = toText(currentRow.partName, '') !== toText(previousRow.partName, '');
      const functionChanged = toText(currentRow.functionText, '') !== toText(previousRow.functionText, '');
      const unitChanged = toText(currentRow.unit, '') !== toText(previousRow.unit, '');
      if (partChanged || functionChanged || unitChanged) {
        fieldChanges.push({ before: previousRow, after: currentRow });
      }
    });

    priorMap.forEach((previousRow, key) => {
      if (!matchedKeys.has(key)) {
        removed.push(previousRow);
      }
    });

    const changes = { added, removed, quantityChanges, fieldChanges };
    return {
      status: 'ready',
      sheetName: currentSheet.sheetName,
      harnessId,
      changes,
      summary: summariseChanges(changes),
      hasChanges: Object.values(summariseChanges(changes)).some((value) => value > 0),
    };
  }

  global.G281BomChangeDetector = {
    detectChangeSet,
  };
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this);
