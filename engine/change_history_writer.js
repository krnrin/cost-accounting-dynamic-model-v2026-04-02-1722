(() => {
  'use strict';

  const globalScope = typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this;
  const Shared = globalScope.G281Shared || {};
  const toText = Shared.toText || ((value, fallback) => {
    const text = String(value == null ? '' : value).trim();
    return text || (fallback == null ? '' : fallback);
  });
  const numberOr = Shared.numberOr || ((value, fallback) => {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : fallback;
  });
  const toISO = Shared.toISO || ((value) => {
    const candidate = value instanceof Date ? value : new Date(value);
    return Number.isFinite(candidate.valueOf()) ? candidate.toISOString() : new Date().toISOString();
  });

  const HISTORY_TEMPLATE = ['序号', '零件包名称', '线束零件号', '零件名称', '变更履历', '更改时间', '备注'];

  function buildCell(value) {
    const normalized = value == null ? '' : value;
    const isNumber = typeof normalized === 'number' && Number.isFinite(normalized);
    return {
      v: normalized,
      value: normalized,
      t: isNumber ? 'n' : 's',
    };
  }

  function summaryText(changeSummary) {
    if (!changeSummary) return '';
    const fragments = [];
    if (changeSummary.added) fragments.push(`新增 ${changeSummary.added} 项`);
    if (changeSummary.removed) fragments.push(`删除 ${changeSummary.removed} 项`);
    if (changeSummary.quantityChanges) fragments.push(`数量变更 ${changeSummary.quantityChanges} 项`);
    if (changeSummary.fieldChanges) fragments.push(`字段变更 ${changeSummary.fieldChanges} 项`);
    return fragments.join(' / ') || '变更已确认';
  }

  function detectNextSequence(sheet) {
    const rowLookup = sheet && sheet.cellData ? sheet.cellData : {};
    let maxSeq = 0;
    Object.keys(rowLookup).forEach((rowKey) => {
      const row = rowLookup[rowKey];
      const cell = row && (row['0'] || row[0]);
      if (!cell) return;
      const raw = cell.v ?? cell.value;
      const numeric = Number(raw);
      if (Number.isFinite(numeric)) {
        maxSeq = Math.max(maxSeq, numeric);
      }
    });
    return maxSeq + 1;
  }

  function ensureRowSlot(sheet, rowIndex) {
    if (!sheet.cellData) sheet.cellData = {};
    const rowKey = String(rowIndex);
    if (!sheet.cellData[rowKey]) sheet.cellData[rowKey] = {};
    return sheet.cellData[rowKey];
  }

  function buildEntry(options = {}) {
    const summary = options.changeSummary || {};
    return {
      packageName: toText(options.packageName, toText(options.workbookName, '')),
      harnessPartNo: toText(options.harnessPartNo, toText(options.harnessId, '')),
      harnessName: toText(options.harnessName, ''),
      description: summaryText(summary),
      timestamp: toISO(options.timestamp || new Date()),
      remark: toText(options.remark, options.impacts ? `影响: ${options.impacts.join(', ')}` : ''),
    };
  }

  function appendEntry(sheet, entry, options = {}) {
    if (!sheet) return null;
    const index = detectNextSequence(sheet);
    const rowNumber = Math.max(numberOr(sheet.maxRow, 0) + 1, Math.max(...Object.keys(sheet.cellData || {}).map((key) => numberOr(key, 0) + 1), 1));
    const rowIndex = rowNumber - 1;
    const rowSlot = ensureRowSlot(sheet, rowIndex);
    const payload = [
      index,
      entry.packageName,
      entry.harnessPartNo,
      entry.harnessName,
      entry.description,
      entry.timestamp,
      entry.remark,
    ];
    payload.forEach((value, columnIndex) => {
      rowSlot[String(columnIndex)] = buildCell(value);
      rowSlot[columnIndex] = rowSlot[String(columnIndex)];
    });
    sheet.maxRow = Math.max(numberOr(sheet.maxRow, 0), rowNumber);
    sheet.rowCount = sheet.maxRow;
    return {
      status: 'appended',
      rowNumber,
      entryNumber: index,
      entry,
      sheetName: sheet.sheetName,
    };
  }

  globalScope.G281ChangeHistoryWriter = {
    HISTORY_TEMPLATE,
    buildEntry,
    appendEntry,
    summaryText,
    detectNextSequence,
  };
})();
