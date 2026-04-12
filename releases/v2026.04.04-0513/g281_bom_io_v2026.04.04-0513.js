(function (global) {
  'use strict';

  const DEFAULT_FORMAT = 'json';
  const XLSX_FORMATS = new Set(['xlsx', 'xlsm', 'xlsb', 'xls']);
  let ioConfig = {
    defaultFormat: DEFAULT_FORMAT,
  };

  const ensureString = (value, fallback = '') => (typeof value === 'string' ? value : fallback);
  const ensureObject = (value) => (value && typeof value === 'object' ? value : {});

  const getBomDb = () => {
    if (!global.G281BomDb) {
      throw new Error('[G281BomIO] window.G281BomDb is not initialized');
    }
    return global.G281BomDb;
  };

  const detectFormat = (input, options = {}) => {
    if (options.format) {
      return options.format;
    }
    if (input && typeof input === 'object' && typeof input.arrayBuffer === 'function') {
      const name = ensureString(options.fileName || input.name, '').toLowerCase();
      const extension = name.includes('.') ? name.split('.').pop() : '';
      return XLSX_FORMATS.has(extension) ? 'xlsx' : 'json';
    }
    if (typeof input === 'string') {
      const trimmed = input.trim();
      if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
        return 'json';
      }
      return ioConfig.defaultFormat;
    }
    if (ArrayBuffer.isView(input) || input instanceof ArrayBuffer) {
      return 'xlsx';
    }
    return ioConfig.defaultFormat;
  };

  const readJson = async (candidate) => {
    if (typeof candidate === 'string') {
      return JSON.parse(candidate);
    }
    if (candidate && typeof candidate === 'object') {
      if (typeof candidate.text === 'function') {
        return JSON.parse(await candidate.text());
      }
      return candidate;
    }
    throw new Error('[G281BomIO] Unable to parse JSON workbook payload');
  };

  const readArrayBuffer = async (candidate) => {
    if (candidate instanceof ArrayBuffer) {
      return candidate;
    }
    if (ArrayBuffer.isView(candidate)) {
      return candidate.buffer.slice(candidate.byteOffset, candidate.byteOffset + candidate.byteLength);
    }
    if (candidate && typeof candidate.arrayBuffer === 'function') {
      return candidate.arrayBuffer();
    }
    throw new Error('[G281BomIO] Unable to resolve ArrayBuffer for workbook');
  };

  const parseXlsx = async (arrayBuffer, options = {}) => {
    const xlsx = global.XLSX;
    if (!xlsx || typeof xlsx.read !== 'function') {
      throw new Error('[G281BomIO] XLSX parser not available on window.XLSX');
    }
    const workbook = xlsx.read(arrayBuffer, {
      type: 'array',
      cellFormula: true,
      cellNF: true,
      cellStyles: true,
      sheetStubs: true,
      dense: false,
    });
    const sheetStates = (workbook.Workbook?.Sheets || []).reduce((acc, item) => {
      const hidden = Number(item?.Hidden) || 0;
      acc[item?.name] = hidden === 2 ? 'veryHidden' : hidden === 1 ? 'hidden' : 'visible';
      return acc;
    }, {});
    const hiddenSheets = [];
    const sheets = workbook.SheetNames.map((sheetName) => {
      const worksheet = workbook.Sheets[sheetName] || {};
      const rangeRef = worksheet['!ref'] || null;
      const decodedRange = rangeRef ? xlsx.utils.decode_range(rangeRef) : null;
      const cells = Object.keys(worksheet)
        .filter((key) => !key.startsWith('!'))
        .map((address) => {
          const cell = worksheet[address] || {};
          const decoded = xlsx.utils.decode_cell(address);
          return {
            address,
            row: decoded.r + 1,
            column: decoded.c + 1,
            dataType: cell.t || (cell.f ? 'formula' : typeof cell.v),
            value: cell.f ? null : (cell.v ?? null),
            formula: cell.f ? `=${cell.f}` : null,
            display: cell.w || (cell.v !== undefined && cell.v !== null ? String(cell.v) : null),
            styleId: Number.isFinite(cell.s) ? cell.s : null,
            numberFormat: ensureString(cell.z, null),
          };
        })
        .sort((left, right) => (left.row === right.row ? left.column - right.column : left.row - right.row));
      const maxRow = decodedRange ? decodedRange.e.r + 1 : 0;
      const maxColumn = decodedRange ? decodedRange.e.c + 1 : 0;
      const columnDimensions = (worksheet['!cols'] || []).reduce((acc, column, index) => {
        if (!column) return acc;
        acc.push({
          min: index + 1,
          max: index + 1,
          width: column.wch || column.width || null,
          wpx: column.wpx || null,
          hidden: Boolean(column.hidden),
        });
        return acc;
      }, []);
      const rowDimensions = (worksheet['!rows'] || []).reduce((acc, row, index) => {
        if (!row) return acc;
        acc.push({
          row: index + 1,
          height: row.hpt || row.hpx || null,
          hpt: row.hpt || null,
          hpx: row.hpx || null,
          hidden: Boolean(row.hidden),
        });
        return acc;
      }, []);
      const sheetState = sheetStates[sheetName] || 'visible';
      if (sheetState !== 'visible') {
        hiddenSheets.push(sheetName);
      }
      return {
        sheetName,
        sheetState,
        headerRows: Number.isFinite(options.headerRows)
          ? Number(options.headerRows)
          : (/^\d{8,}$/.test(sheetName) || /BOM/i.test(sheetName) ? 4 : 1),
        columnCount: maxColumn,
        rowCount: maxRow,
        freezePane: ensureString(worksheet['!freeze']?.topLeftCell || worksheet['!freeze'], null),
        mergedRanges: (worksheet['!merges'] || []).map((merge) => xlsx.utils.encode_range(merge)),
        hiddenRows: rowDimensions.filter((row) => row.hidden).map((row) => row.row),
        hiddenColumns: columnDimensions.filter((column) => column.hidden).map((column) => column.min),
        columnDimensions,
        rowDimensions,
        cells,
      };
    });
    return {
      generatedAt: new Date().toISOString(),
      generator: 'g281-bom-io-xlsx',
      sourceFileName: ensureString(options.fileName, null),
      workbookName: ensureString(options.workbookName, ensureString(options.fileName, 'BOM Workbook').replace(/\.[^.]+$/, '')),
      sheetOrder: workbook.SheetNames.slice(),
      hiddenSheets,
      workbookMeta: {
        parser: 'sheetjs/xlsx',
      },
      sheets,
    };
  };

  const cloneWorkbook = (workbook) => JSON.parse(JSON.stringify(workbook || {}));

  const buildWorkbookPayload = (baseWorkbook, options = {}) => {
    const sheet = (baseWorkbook.sheets && baseWorkbook.sheets[0]) || baseWorkbook.sheet || {};
    const workbook = {
      ...baseWorkbook,
      sheetOrder: baseWorkbook.sheetOrder || (sheet.sheetName ? [sheet.sheetName] : []),
      sheets: baseWorkbook.sheets || [sheet],
      generatedAt: baseWorkbook.generatedAt || new Date().toISOString(),
      workbookName: baseWorkbook.workbookName || options.workbookName || sheet.sheetName || 'Sheet1',
    };

    if (options.sheetName) {
      workbook.sheets[0] = {
        ...workbook.sheets[0],
        sheetName: options.sheetName,
      };
      workbook.sheetOrder = [options.sheetName, ...workbook.sheetOrder.filter((name) => name !== options.sheetName)];
    }

    if (options.headerRows) {
      workbook.sheets[0] = {
        ...workbook.sheets[0],
        headerRows: Number.isFinite(options.headerRows)
          ? options.headerRows
          : workbook.sheets[0].headerRows,
      };
    }

    return workbook;
  };

  const buildVersionPayload = (workbook, options = {}) => ({
    projectId: ensureString(options.projectId, workbook.projectId),
    versionId: ensureString(options.versionId, workbook.versionId),
    versionKey: ensureString(options.versionKey, workbook.versionKey),
    versionLabel: ensureString(options.versionLabel, workbook.versionLabel),
    sourceType: ensureString(options.sourceType, workbook.sourceType),
    workbook,
    meta: ensureObject(options.meta || workbook.meta),
  });

  const importWorkbook = async (fileOrArrayBuffer, options = {}) => {
    const format = detectFormat(fileOrArrayBuffer, options);
    let workbookPayload;

    if (format === 'json') {
      const rawWorkbook = await readJson(fileOrArrayBuffer);
      workbookPayload = buildWorkbookPayload(rawWorkbook, options);
    } else if (format === 'xlsx') {
      const arrayBuffer = await readArrayBuffer(fileOrArrayBuffer);
      workbookPayload = await parseXlsx(arrayBuffer, {
        ...options,
        fileName: ensureString(options.fileName, fileOrArrayBuffer?.name),
      });
    } else {
      throw new Error(`[G281BomIO] Unsupported import format: ${format}`);
    }

    const versionPayload = buildVersionPayload(workbookPayload, options);
    const bomDb = getBomDb();
    await bomDb.init(options.db || {});
    return bomDb.saveVersion(versionPayload);
  };

  const convertVersionToWorkbook = (version) => ({
    versionKey: version.versionKey || version.meta?.runtimeVersionKey || null,
    workbookName: version.workbookMeta?.workbookName || version.sheetName,
    sourceFileName: version.workbookMeta?.sourceFileName,
    sourcePath: version.workbookMeta?.sourcePath,
    generatedAt: version.workbookMeta?.generatedAt || version.updatedAt,
    generator: version.workbookMeta?.generator || 'g281-bom-native',
    sheetOrder: version.workbookMeta?.sheetOrder || [version.sheetName],
    hiddenSheets: version.workbookMeta?.hiddenSheets || [],
    sheets: Array.isArray(version.workbook?.sheets) && version.workbook.sheets.length
      ? cloneWorkbook(version.workbook.sheets)
      : [
          {
            sheetName: version.sheetName,
            headerRows: version.headerRows,
            columns: version.columns,
            rows: version.rows,
            freezePane: version.workbookMeta?.freezePane,
            mergedRanges: version.workbookMeta?.mergedRanges,
            sheetState: version.workbookMeta?.sheetState,
            meta: version.workbookMeta?.meta,
          },
        ],
    workbookMeta: version.workbookMeta,
  });

  const normalizeCellType = (cell) => {
    if (cell.formula) return null;
    const value = cell.value;
    if (typeof value === 'number') return 'n';
    if (typeof value === 'boolean') return 'b';
    if (value instanceof Date) return 'd';
    if (value === null || value === undefined || value === '') return 'z';
    return 's';
  };

  const buildWorksheetFromSheet = (xlsx, sheet = {}) => {
    const worksheet = {};
    const rows = Array.isArray(sheet.rows) ? sheet.rows : [];
    const looseCells = Array.isArray(sheet.cells) ? sheet.cells : [];
    const cellList = rows.length ? rows.flatMap((row) => row.cells || []) : looseCells;
    let maxRow = 0;
    let maxColumn = 0;
    cellList.forEach((cell) => {
      const row = Number(cell.row) || Number(cell.rowIndex) || 1;
      const column = Number(cell.column) || Number(cell.columnIndex) || 1;
      const address = ensureString(cell.address, xlsx.utils.encode_cell({ r: row - 1, c: column - 1 }));
      const entry = {};
      if (cell.formula) {
        entry.f = String(cell.formula).replace(/^=/, '');
        if (cell.value !== null && cell.value !== undefined && cell.value !== '') {
          entry.v = cell.value;
        }
      } else {
        entry.v = cell.value;
        entry.t = normalizeCellType(cell);
      }
      if (cell.numberFormat) {
        entry.z = cell.numberFormat;
      }
      worksheet[address] = entry;
      maxRow = Math.max(maxRow, row);
      maxColumn = Math.max(maxColumn, column);
    });
    const merges = Array.isArray(sheet.mergedRanges) ? sheet.mergedRanges : [];
    if (merges.length) {
      worksheet['!merges'] = merges.map((rangeRef) => xlsx.utils.decode_range(rangeRef));
    }
    const columnDimensions = Array.isArray(sheet.columnDimensions) ? sheet.columnDimensions : [];
    if (columnDimensions.length) {
      const columns = [];
      columnDimensions.forEach((column) => {
        const start = Number(column.min) || Number(column.index) || 1;
        const end = Number(column.max) || start;
        for (let current = start; current <= end; current += 1) {
          columns[current - 1] = {
            wch: column.width || null,
            wpx: column.wpx || null,
            hidden: Boolean(column.hidden),
          };
        }
      });
      worksheet['!cols'] = columns;
    }
    const rowDimensions = Array.isArray(sheet.rowDimensions) ? sheet.rowDimensions : [];
    if (rowDimensions.length) {
      const rowsMeta = [];
      rowDimensions.forEach((row) => {
        const index = Number(row.row) || Number(row.r) || 1;
        rowsMeta[index - 1] = {
          hpt: row.hpt || row.height || null,
          hpx: row.hpx || null,
          hidden: Boolean(row.hidden),
        };
      });
      worksheet['!rows'] = rowsMeta;
    }
    worksheet['!ref'] = maxRow && maxColumn
      ? xlsx.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: maxRow - 1, c: maxColumn - 1 } })
      : 'A1';
    return worksheet;
  };

  const exportWorkbook = async (versionId, options = {}) => {
    if (!versionId) {
      throw new Error('[G281BomIO] exportWorkbook requires a versionId');
    }

    const bomDb = getBomDb();
    await bomDb.init(options.db || {});
    const version = await bomDb.getVersion(versionId);
    if (!version) {
      throw new Error(`[G281BomIO] Version ${versionId} not found`);
    }

    const format = options.format || ioConfig.defaultFormat;
    if (format === 'json') {
      return convertVersionToWorkbook(version);
    }
    if (format === 'xlsx') {
      const xlsx = global.XLSX;
      if (!xlsx || typeof xlsx.utils?.book_new !== 'function') {
        throw new Error('[G281BomIO] XLSX writer not available on window.XLSX');
      }
      const workbookData = version.workbook ? cloneWorkbook(version.workbook) : convertVersionToWorkbook(version);
      const workbook = xlsx.utils.book_new();
      const workbookSheets = [];
      (workbookData.sheets || []).forEach((sheet, index) => {
        const sheetName = ensureString(sheet.sheetName, `Sheet${index + 1}`);
        const worksheet = buildWorksheetFromSheet(xlsx, sheet);
        xlsx.utils.book_append_sheet(workbook, worksheet, sheetName);
        const hiddenState = sheet.sheetState === 'veryHidden' ? 2 : sheet.sheetState === 'hidden' ? 1 : 0;
        workbookSheets.push({ name: sheetName, Hidden: hiddenState });
      });
      workbook.Workbook = workbook.Workbook || {};
      workbook.Workbook.Sheets = workbookSheets;
      return xlsx.write(workbook, {
        bookType: options.bookType || 'xlsx',
        type: options.type || 'array',
        compression: true,
      });
    }
    throw new Error(`[G281BomIO] Unsupported export format: ${format}`);
  };

  const init = (options = {}) => {
    ioConfig = {
      defaultFormat: options.defaultFormat || DEFAULT_FORMAT,
    };
  };

  global.G281BomIO = {
    init,
    importWorkbook,
    exportWorkbook,
  };
})(window);
