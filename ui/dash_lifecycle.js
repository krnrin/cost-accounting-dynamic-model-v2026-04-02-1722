/**
 * dash_lifecycle.js
 * 年降/一次性费用/工作簿解析/版本时间线
 * Extracted from dashboard.js — do not edit both files simultaneously.
 */

function lifecycleTemplateYears() {
  return Array.isArray(BASE?.years) && BASE.years.length
    ? BASE.years.map((year) => Number(year)).filter((year) => Number.isFinite(year))
    : [];
}

function lifecycleTemplateVolumes() {
  return Array.isArray(BASE?.volumes) && BASE.volumes.length
    ? BASE.volumes.map((value) => Math.max(0, Number(value) || 0))
    : lifecycleTemplateYears().map(() => 0);
}

function normalizeTemplateYear(value, fallback = null) {
  const numeric = Number(value);
  if (Number.isFinite(numeric) && numeric >= 1900 && numeric <= 3000) {
    return Math.round(numeric);
  }
  const match = String(value ?? '').match(/\b(20\d{2}|19\d{2})\b/);
  return match ? Number(match[1]) : fallback;
}

function parseLifecycleRate(value) {
  if (value === null || value === undefined || value === '') return 0;
  if (typeof value === 'number' && Number.isFinite(value)) {
    if (value > 1 && value <= 100) return Math.max(0, value / 100);
    return Math.max(0, value);
  }
  const text = String(value).trim();
  if (!text) return 0;
  const numeric = parseNumericCellValue(text);
  if (numeric === null) return 0;
  if (text.includes('%')) return Math.max(0, numeric / 100);
  if (numeric > 1 && numeric <= 100) return Math.max(0, numeric / 100);
  return Math.max(0, numeric);
}

function parseLifecycleMoney(value) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  const numeric = parseNumericCellValue(value);
  return numeric === null ? 0 : numeric;
}

function lifecycleVolumeTotal() {
  return lifecycleTemplateVolumes().reduce((sum, value) => sum + value, 0);
}

function legacyAnnualDropYearRows(years, annualRate) {
  const list = Array.isArray(years) ? years : [];
  const rate = Math.max(0, Number(annualRate) || 0);
  return list.map((year, index) => {
    if (index === 0 || rate <= 0) {
      return { year, rate: 0, note: index === 0 ? '首年基准' : '' };
    }
    const prevFactor = Math.max(0, 1 - rate * (index - 1));
    const nextFactor = Math.max(0, 1 - rate * index);
    const derivedRate = prevFactor > 0 ? Math.max(0, 1 - (nextFactor / prevFactor)) : 0;
    return {
      year,
      rate: derivedRate,
      note: '旧版线性年降迁移',
    };
  });
}

function normalizeAnnualDropYearRows(rawRows, years = lifecycleTemplateYears(), legacyAnnualRate = 0) {
  const yearList = Array.isArray(years) ? years : [];
  const rowMap = new Map();
  (Array.isArray(rawRows) ? rawRows : []).forEach((row) => {
    const year = normalizeTemplateYear(row?.year);
    if (!Number.isFinite(year)) return;
    rowMap.set(year, {
      year,
      rate: parseLifecycleRate(row?.rate),
      note: toText(row?.note, ''),
    });
  });
  if (!rowMap.size && Number(legacyAnnualRate)) {
    legacyAnnualDropYearRows(yearList, legacyAnnualRate).forEach((row) => rowMap.set(row.year, row));
  }
  return yearList.map((year, index) => rowMap.get(year) || {
    year,
    rate: 0,
    note: index === 0 ? '首年基准' : '',
  });
}

function normalizeOneTimeCustomerEntries(rawEntries, years = lifecycleTemplateYears(), legacyAmountTotal = 0) {
  const yearList = Array.isArray(years) ? years : [];
  const firstYear = yearList[0] || new Date().getFullYear();
  const lifecycleVolume = lifecycleVolumeTotal();
  const entries = (Array.isArray(rawEntries) ? rawEntries : []).reduce((acc, entry, index) => {
    const amount = Math.max(0, parseLifecycleMoney(entry?.amount));
    if (!amount) return acc;
    const modeText = toText(entry?.mode, '').toLowerCase();
    const mode = modeText.includes('直付') || modeText.includes('direct')
      ? 'direct'
      : (modeText.includes('摊') || modeText.includes('alloc') ? 'allocate' : 'allocate');
    acc.push({
      category: toText(entry?.category, `其他${index + 1}`),
      mode,
      amount,
      recognitionYear: normalizeTemplateYear(entry?.recognitionYear, firstYear),
      allocationStartYear: normalizeTemplateYear(entry?.allocationStartYear, firstYear),
      allocationVolume: Math.max(0, parseLifecycleMoney(entry?.allocationVolume || lifecycleVolume)),
      note: toText(entry?.note, ''),
    });
    return acc;
  }, []);
  if (entries.length) {
    return entries;
  }
  const legacyAmount = Math.max(0, Number(legacyAmountTotal) || 0);
  if (!legacyAmount) {
    return [];
  }
  return [{
    category: '其他',
    mode: 'allocate',
    amount: legacyAmount,
    recognitionYear: firstYear,
    allocationStartYear: firstYear,
    allocationVolume: lifecycleVolume,
    note: '旧版一次性费用迁移',
  }];
}

function normalizeRebateYearRows(rawRows, years = lifecycleTemplateYears(), volumes = lifecycleTemplateVolumes(), legacyAmountPerSet = 0) {
  const yearList = Array.isArray(years) ? years : [];
  const rowMap = new Map();
  (Array.isArray(rawRows) ? rawRows : []).forEach((row) => {
    const year = normalizeTemplateYear(row?.year);
    if (!Number.isFinite(year)) return;
    rowMap.set(year, {
      year,
      amountTotal: Math.max(0, parseLifecycleMoney(row?.amountTotal)),
      note: toText(row?.note, ''),
    });
  });
  if (!rowMap.size && Number(legacyAmountPerSet)) {
    yearList.forEach((year, index) => {
      rowMap.set(year, {
        year,
        amountTotal: Math.max(0, (Number(volumes[index]) || 0) * (Number(legacyAmountPerSet) || 0)),
        note: '旧版返点迁移',
      });
    });
  }
  return yearList.map((year) => rowMap.get(year) || {
    year,
    amountTotal: 0,
    note: '',
  });
}

function workbookTemplateSheetByName(workbookSnapshot, sheetName) {
  if (!isUniverWorkbookSnapshot(workbookSnapshot)) return null;
  return Object.values(workbookSnapshot.sheets || {}).find((sheet) => sheet?.name === sheetName) || null;
}

function workbookTemplateRows(workbookSnapshot, sheetName) {
  const sheet = workbookTemplateSheetByName(workbookSnapshot, sheetName);
  return sheet ? buildUniverWorkbookRowMap(sheet) : new Map();
}

function workbookTemplateCellValue(rowMap, rowIndex, columnIndex) {
  const row = rowMap instanceof Map ? rowMap.get(rowIndex) : null;
  return row ? row[columnIndex] : null;
}

function findWorkbookHeaderRow(rowMap, expectedHeaders = []) {
  const headers = Array.isArray(expectedHeaders) ? expectedHeaders : [];
  const rowIndexes = Array.from(rowMap.keys()).sort((left, right) => left - right);
  return rowIndexes.find((rowIndex) => {
    const row = rowMap.get(rowIndex) || {};
    const cells = Object.values(row).map((value) => toText(value, ''));
    return headers.every((header) => cells.some((value) => value.includes(header)));
  }) || 0;
}

function parseAnnualDropWorkbookRows(workbookSnapshot, fallbackRows = [], fallbackAnnualRate = 0) {
  const rowMap = workbookTemplateRows(workbookSnapshot, '版本录入');
  const years = lifecycleTemplateYears();
  const headerRow = findWorkbookHeaderRow(rowMap, ['年份', '年降率']);
  if (!headerRow) {
    return normalizeAnnualDropYearRows(fallbackRows, years, fallbackAnnualRate);
  }
  const parsedRows = [];
  for (let rowIndex = headerRow + 1; rowIndex <= headerRow + years.length + 16; rowIndex += 1) {
    const year = normalizeTemplateYear(workbookTemplateCellValue(rowMap, rowIndex, 1));
    if (!Number.isFinite(year)) continue;
    parsedRows.push({
      year,
      rate: parseLifecycleRate(workbookTemplateCellValue(rowMap, rowIndex, 2)),
      note: toText(workbookTemplateCellValue(rowMap, rowIndex, 4), ''),
    });
  }
  return normalizeAnnualDropYearRows(parsedRows, years, fallbackAnnualRate);
}

function parseOneTimeCustomerWorkbookEntries(workbookSnapshot, fallbackEntries = [], fallbackAmountTotal = 0) {
  const rowMap = workbookTemplateRows(workbookSnapshot, '版本录入');
  const years = lifecycleTemplateYears();
  const headerRow = findWorkbookHeaderRow(rowMap, ['类别', '金额', '方式']);
  if (headerRow) {
    const parsed = [];
    const rowIndexes = Array.from(rowMap.keys()).sort((left, right) => left - right);
    rowIndexes
      .filter((rowIndex) => rowIndex > headerRow)
      .forEach((rowIndex) => {
        const category = toText(workbookTemplateCellValue(rowMap, rowIndex, 1), '');
        const amount = Math.max(0, parseLifecycleMoney(workbookTemplateCellValue(rowMap, rowIndex, 2)));
        if (!category && !amount) return;
        parsed.push({
          category: category || `其他${rowIndex - headerRow}`,
          amount,
          mode: toText(workbookTemplateCellValue(rowMap, rowIndex, 3), '按量分摊'),
          recognitionYear: normalizeTemplateYear(workbookTemplateCellValue(rowMap, rowIndex, 4), years[0] || new Date().getFullYear()),
          allocationStartYear: normalizeTemplateYear(workbookTemplateCellValue(rowMap, rowIndex, 5), years[0] || new Date().getFullYear()),
          allocationVolume: Math.max(0, parseLifecycleMoney(workbookTemplateCellValue(rowMap, rowIndex, 6))),
          note: toText(workbookTemplateCellValue(rowMap, rowIndex, 7), ''),
        });
      });
    if (parsed.length) {
      return normalizeOneTimeCustomerEntries(parsed, years, 0);
    }
  }
  const legacyAmount = Math.max(
    0,
    parseLifecycleMoney(workbookTemplateCellValue(rowMap, 2, 2))
      || Number(fallbackAmountTotal)
      || 0,
  );
  return normalizeOneTimeCustomerEntries(fallbackEntries, years, legacyAmount);
}

function parseRebateWorkbookRows(workbookSnapshot, fallbackRows = [], fallbackAmountPerSet = 0) {
  const rowMap = workbookTemplateRows(workbookSnapshot, '版本录入');
  const years = lifecycleTemplateYears();
  const volumes = lifecycleTemplateVolumes();
  const headerRow = findWorkbookHeaderRow(rowMap, ['年份', '返点']);
  if (!headerRow) {
    return normalizeRebateYearRows(fallbackRows, years, volumes, fallbackAmountPerSet);
  }
  const parsedRows = [];
  for (let rowIndex = headerRow + 1; rowIndex <= headerRow + years.length + 16; rowIndex += 1) {
    const year = normalizeTemplateYear(workbookTemplateCellValue(rowMap, rowIndex, 1));
    if (!Number.isFinite(year)) continue;
    parsedRows.push({
      year,
      amountTotal: Math.max(0, parseLifecycleMoney(workbookTemplateCellValue(rowMap, rowIndex, 2))),
      note: toText(workbookTemplateCellValue(rowMap, rowIndex, 3), ''),
    });
  }
  return normalizeRebateYearRows(parsedRows, years, volumes, fallbackAmountPerSet);
}

function workbookSeedCell(address, value, options = {}) {
  return {
    address,
    row: Number(options.row) || Number(String(address).replace(/^[A-Z]+/, '')),
    column: Number(options.column) || excelColumnLabelToNumber(String(address).replace(/\d+/g, '')),
    value,
    formula: options.formula || null,
    dataType: options.dataType || (options.formula ? 'f' : null),
    styleId: Number.isFinite(Number(options.styleId)) ? Number(options.styleId) : null,
  };
}

function workbookSeedFromSheets(workbookName, sourceFileName, sourcePath, sheetDefs = []) {
  return {
    workbookName,
    sourceFileName: sourceFileName || workbookName,
    sourcePath: sourcePath || '',
    versionKey: 'manual-seed',
    versionLabel: workbookName,
    sheetOrder: sheetDefs.map((sheet) => sheet.sheetName),
    hiddenSheets: [],
    styleTable: {},
    sheets: sheetDefs,
  };
}

function annualDropWorkbookSeed(versionKey = state.annualDrop, option = BASE.versions?.annualDrop?.[versionKey] || {}) {
  const snapshot = annualDropVersionSnapshot(versionKey);
  const cells = [
    workbookSeedCell('A1', '年份'),
    workbookSeedCell('B1', '年降率'),
    workbookSeedCell('C1', '当年ASP系数'),
    workbookSeedCell('D1', '说明'),
  ];
  snapshot.yearRows.forEach((row, index) => {
    const line = index + 2;
    cells.push(workbookSeedCell(`A${line}`, row.year));
    cells.push(workbookSeedCell(`B${line}`, row.rate));
    if (index === 0) {
      cells.push(workbookSeedCell(`C${line}`, 1));
    } else {
      cells.push(workbookSeedCell(`C${line}`, null, { formula: `=C${line - 1}*(1-B${line})` }));
    }
    cells.push(workbookSeedCell(`D${line}`, row.note || (index === 0 ? '首年基准，默认不降价' : '')));
  });
  const sheet = {
    sheetName: '版本录入',
    sheetState: 'visible',
    maxRow: Math.max(snapshot.yearRows.length + 2, 16),
    maxColumn: 4,
    freezePane: 'A2',
    mergedRanges: [],
    rowDimensions: [],
    columnDimensions: [
      { index: 1, min: 1, max: 1, width: 88 },
      { index: 2, min: 2, max: 2, width: 88 },
      { index: 3, min: 3, max: 3, width: 110 },
      { index: 4, min: 4, max: 4, width: 220 },
    ],
    hiddenRows: [],
    hiddenColumns: [],
    cells,
  };
  return workbookSeedFromSheets(
    toText(option?.workbook, `${snapshot.label || versionKey}年降模板`),
    toText(option?.templateSource, `${snapshot.label || versionKey}年降模板`),
    '',
    [sheet],
  );
}

function oneTimeCustomerWorkbookSeed(versionKey = state.oneTimeCustomer, option = BASE.versions?.oneTimeCustomer?.[versionKey] || {}) {
  const snapshot = oneTimeCustomerVersionSnapshot(versionKey);
  const cells = [
    workbookSeedCell('A1', '类别'),
    workbookSeedCell('B1', '金额'),
    workbookSeedCell('C1', '方式'),
    workbookSeedCell('D1', '确认年份'),
    workbookSeedCell('E1', '分摊起始年'),
    workbookSeedCell('F1', '分摊总量'),
    workbookSeedCell('G1', '备注'),
  ];
  snapshot.entries.forEach((entry, index) => {
    const line = index + 2;
    cells.push(workbookSeedCell(`A${line}`, entry.category));
    cells.push(workbookSeedCell(`B${line}`, entry.amount));
    cells.push(workbookSeedCell(`C${line}`, entry.mode === 'direct' ? '客户直付' : '按量分摊'));
    cells.push(workbookSeedCell(`D${line}`, entry.recognitionYear));
    cells.push(workbookSeedCell(`E${line}`, entry.allocationStartYear));
    cells.push(workbookSeedCell(`F${line}`, entry.allocationVolume));
    cells.push(workbookSeedCell(`G${line}`, entry.note));
  });
  const sheetDefs = [
    {
      sheetName: '版本录入',
      sheetState: 'visible',
      maxRow: Math.max(snapshot.entries.length + 6, 24),
      maxColumn: 7,
      freezePane: 'A2',
      mergedRanges: [],
      rowDimensions: [],
      columnDimensions: [
        { index: 1, min: 1, max: 1, width: 120 },
        { index: 2, min: 2, max: 2, width: 100 },
        { index: 3, min: 3, max: 3, width: 100 },
        { index: 4, min: 4, max: 4, width: 88 },
        { index: 5, min: 5, max: 5, width: 110 },
        { index: 6, min: 6, max: 6, width: 100 },
        { index: 7, min: 7, max: 7, width: 220 },
      ],
      hiddenRows: [],
      hiddenColumns: [],
      cells,
    },
    { sheetName: '工装费', sheetState: 'visible', maxRow: 200, maxColumn: 26, freezePane: null, mergedRanges: [], rowDimensions: [], columnDimensions: [], hiddenRows: [], hiddenColumns: [], cells: [] },
    { sheetName: '试验费', sheetState: 'visible', maxRow: 200, maxColumn: 26, freezePane: null, mergedRanges: [], rowDimensions: [], columnDimensions: [], hiddenRows: [], hiddenColumns: [], cells: [] },
    { sheetName: '研发费', sheetState: 'visible', maxRow: 200, maxColumn: 26, freezePane: null, mergedRanges: [], rowDimensions: [], columnDimensions: [], hiddenRows: [], hiddenColumns: [], cells: [] },
  ];
  return workbookSeedFromSheets(
    toText(option?.workbook, `${snapshot.label || versionKey}一次性费用模板`),
    toText(option?.templateSource, `${snapshot.label || versionKey}一次性费用模板`),
    '',
    sheetDefs,
  );
}

function rebateWorkbookSeed(versionKey = state.rebate, option = BASE.versions?.rebate?.[versionKey] || {}) {
  const snapshot = rebateVersionSnapshot(versionKey);
  const cells = [
    workbookSeedCell('A1', '年份'),
    workbookSeedCell('B1', '年度返点总额'),
    workbookSeedCell('C1', '备注'),
  ];
  snapshot.yearRows.forEach((row, index) => {
    const line = index + 2;
    cells.push(workbookSeedCell(`A${line}`, row.year));
    cells.push(workbookSeedCell(`B${line}`, row.amountTotal));
    cells.push(workbookSeedCell(`C${line}`, row.note));
  });
  const sheet = {
    sheetName: '版本录入',
    sheetState: 'visible',
    maxRow: Math.max(snapshot.yearRows.length + 4, 16),
    maxColumn: 3,
    freezePane: 'A2',
    mergedRanges: [],
    rowDimensions: [],
    columnDimensions: [
      { index: 1, min: 1, max: 1, width: 88 },
      { index: 2, min: 2, max: 2, width: 120 },
      { index: 3, min: 3, max: 3, width: 220 },
    ],
    hiddenRows: [],
    hiddenColumns: [],
    cells,
  };
  return workbookSeedFromSheets(
    toText(option?.workbook, `${snapshot.label || versionKey}返点模板`),
    toText(option?.templateSource, `${snapshot.label || versionKey}返点模板`),
    '',
    [sheet],
  );
}

function buildLifecycleWorkbookSnapshotFromSeed(seed, fallbackName) {
  if (!seed) return null;
  const runtimeHelper = window.G281BomTemplateRuntime || null;
  if (!runtimeHelper?.buildWorkbookSnapshotFromSeed) return null;
  try {
    return runtimeHelper.buildWorkbookSnapshotFromSeed(seed, {
      workbookName: seed.workbookName || fallbackName || '版本模板',
    });
  } catch (error) {
    console.warn('[G281Dashboard] Failed to build lifecycle workbook snapshot', error);
    return null;
  }
}

function annualDropVersionSnapshot(versionKey) {
  const option = BASE.versions?.annualDrop?.[versionKey] || {};
  const workbookSnapshot = isUniverWorkbookSnapshot(option?.templateWorkbookSnapshot)
    ? option.templateWorkbookSnapshot
    : buildLifecycleWorkbookSnapshotFromSeed(option?.templateWorkbookSeed, '年降模板');
  const yearRows = workbookSnapshot
    ? parseAnnualDropWorkbookRows(workbookSnapshot, option?.yearRows, option?.annualRate)
    : normalizeAnnualDropYearRows(option?.yearRows, lifecycleTemplateYears(), option?.annualRate);
  const annualRate = yearRows.find((row, index) => index > 0 && Number(row?.rate) > 0)?.rate
    ?? yearRows.find((row) => Number(row?.rate) > 0)?.rate
    ?? 0;
  return {
    label: option.label || versionKey,
    annualRate: coerceNumber(annualRate, 0),
    yearRows,
    templateWorkbookSeed: clonePlain(option?.templateWorkbookSeed, null),
    sourceNote: option.sourceNote || option.note || '',
  };
}

function oneTimeCustomerVersionSnapshot(versionKey) {
  const option = BASE.versions?.oneTimeCustomer?.[versionKey] || {};
  const workbookSnapshot = isUniverWorkbookSnapshot(option?.templateWorkbookSnapshot)
    ? option.templateWorkbookSnapshot
    : buildLifecycleWorkbookSnapshotFromSeed(option?.templateWorkbookSeed, '一次性费用模板');
  const entries = workbookSnapshot
    ? parseOneTimeCustomerWorkbookEntries(workbookSnapshot, option?.entries, option?.amountTotal)
    : normalizeOneTimeCustomerEntries(option?.entries, lifecycleTemplateYears(), option?.amountTotal);
  const amountTotal = entries.reduce((sum, entry) => sum + Math.max(0, Number(entry?.amount) || 0), 0);
  return {
    label: option.label || versionKey,
    amountTotal: coerceNumber(amountTotal, 0),
    entries,
    templateWorkbookSeed: clonePlain(option?.templateWorkbookSeed, null),
    sourceNote: option.sourceNote || option.note || '',
  };
}

function rebateVersionSnapshot(versionKey) {
  const option = BASE.versions?.rebate?.[versionKey] || {};
  const workbookSnapshot = isUniverWorkbookSnapshot(option?.templateWorkbookSnapshot)
    ? option.templateWorkbookSnapshot
    : buildLifecycleWorkbookSnapshotFromSeed(option?.templateWorkbookSeed, '返点模板');
  const yearRows = workbookSnapshot
    ? parseRebateWorkbookRows(workbookSnapshot, option?.yearRows, option?.amountPerSet)
    : normalizeRebateYearRows(option?.yearRows, lifecycleTemplateYears(), lifecycleTemplateVolumes(), option?.amountPerSet);
  const amountTotal = yearRows.reduce((sum, row) => sum + Math.max(0, Number(row?.amountTotal) || 0), 0);
  const amountPerSet = lifecycleVolumeTotal() ? amountTotal / lifecycleVolumeTotal() : 0;
  return {
    label: option.label || versionKey,
    amountPerSet: coerceNumber(amountPerSet, 0),
    amountTotal: coerceNumber(amountTotal, 0),
    yearRows,
    templateWorkbookSeed: clonePlain(option?.templateWorkbookSeed, null),
    sourceNote: option.sourceNote || option.note || '',
  };
}

function currentScenarioStateSnapshot() {
  return { ...state };
}

const DASHBOARD_VERSION_CHANGE_EVENT = 'g281:dashboard-version-change';

function dispatchDashboardVersionChange(group, key, extra = {}) {
  window.dispatchEvent(new CustomEvent(DASHBOARD_VERSION_CHANGE_EVENT, {
    detail: {
      group,
      key,
      state: currentScenarioStateSnapshot(),
      timestamp: new Date().toISOString(),
      ...extra,
    },
  }));
}

function resolveWorkbookVersionKeyFromBomState(bomKey = state.bom) {
  const bomOption = BASE.versions?.bom?.[bomKey] || {};
  const candidate = bomOption.workbookVersionKeyFallback || WORKBOOK_VERSION_FALLBACKS[bomKey] || bomKey || 'quote';
  if (RUNTIME.bomWorkbookCopies?.versions?.[candidate] || RUNTIME.configSheetCopies?.versions?.[candidate]) {
    return candidate;
  }
  const available = Object.keys(RUNTIME.bomWorkbookCopies?.versions || RUNTIME.configSheetCopies?.versions || {});
  return available[0] || 'quote';
}

function averageAsp(model) {
  const totalRevenue = Number(model?.totalRevenue) || 0;
  const totalVolume = Number(model?.totalVolume) || 0;
  return totalVolume ? totalRevenue / totalVolume : 0;
}

function ensureVersionTimelineAssets() {
  if (window.G281VersionTimeline) {
    return Promise.resolve(window.G281VersionTimeline);
  }
  if (versionTimelineLoader) {
    return versionTimelineLoader;
  }
  versionTimelineLoader = new Promise((resolve, reject) => {
    let script = document.querySelector('script[data-g281-version-timeline]');
    if (!script) {
      script = document.createElement('script');
      script.src = './g281_version_timeline.js?v=20260329a';
      script.dataset.g281VersionTimeline = 'true';
      document.body.appendChild(script);
    }
    script.addEventListener('load', () => resolve(window.G281VersionTimeline || null), { once: true });
    script.addEventListener('error', (error) => reject(error), { once: true });
    if (window.G281VersionTimeline) {
      resolve(window.G281VersionTimeline);
    }
  });
  return versionTimelineLoader;
}

function versionTimelineOptionDate(group, key, option = {}) {
  return option.updatedAt || option.importedAt || option.createdAt
    || seededVersionRecord(group, key)?.createdAt
    || FINANCIAL_VERSIONS?.meta?.generatedAt
    || HISTORY_SEED[0]?.createdAt
    || new Date().toISOString();
}

function buildVersionTimelineEvents() {
  const timelineGroups = [
    ['bom', 'BOM'],
    ['metal', '铜铝基价'],
    ['connector', '连接器'],
    ['labor', '工时'],
    ['equipment', '资源投入'],
    ['packaging', '包装物流'],
    ['annualDrop', '年降'],
    ['oneTimeCustomer', '一次性费用'],
    ['rebate', '返点'],
    ['vave', 'VAVE'],
  ];

  const visibleTimelineGroups = timelineGroups.filter(([group]) => group !== 'vave');
  return visibleTimelineGroups.flatMap(([group, label]) => orderedVersionEntries(group, BASE.versions?.[group] || {}).map(([key, option]) => {
    const createdAt = versionTimelineOptionDate(group, key, option);
    return {
      id: `${group}:${key}`,
      name: option?.label || key,
      group: label,
      createdAt,
      updatedAt: option?.updatedAt || option?.importedAt || option?.createdAt || createdAt,
      meta: {
        group,
        key,
      },
    };
  }));
}

function renderVersionTimelineWithPlugin() {
  if (!el.versionTimelineMount) return;
  ensureVersionTimelineAssets()
    .then((timeline) => {
      if (!timeline?.renderTimeline) return;
      versionTimelineHandle?.destroy?.();
      versionTimelineHandle = timeline.renderTimeline(el.versionTimelineMount, buildVersionTimelineEvents(), {
        title: '成本要素版本时间线',
        subtitle: '显示各版本的发布时间与最近更新时间',
      });
    })
    .catch(() => {});
}

function insightPayloadKey(draft = {}, scenarioState = {}) {
  return JSON.stringify({
    state: scenarioState,
    targetMarginPercent: customTargetMarginPercent,
    draft: {
      copperPrice: Number(draft.copperPrice) || 0,
      aluminumPrice: Number(draft.aluminumPrice) || 0,
      directHours: Number(draft.directHours) || 0,
      directRate: Number(draft.directRate) || 0,
      manufacturingHours: Number(draft.manufacturingHours) || 0,
      manufacturingRate: Number(draft.manufacturingRate) || 0,
      packInner: Number(draft.packInner) || 0,
      packFreight: Number(draft.packFreight) || 0,
      packWarehouse: Number(draft.packWarehouse) || 0,
      packOther: Number(draft.packOther) || 0,
      bomWireDrawing: Number(draft.bomWireDrawing) || 0,
      bomWireEat: Number(draft.bomWireEat) || 0,
      bomWireHidden: Number(draft.bomWireHidden) || 0,
      bomTapeDiameter: Number(draft.bomTapeDiameter) || 0,
      bomTapeWidth: Number(draft.bomTapeWidth) || 0,
      bomTapeOverlap: Number(draft.bomTapeOverlap) || 0,
      mix: Array.isArray(draft.mix) ? draft.mix : [],
      volumes: Array.isArray(draft.volumes) ? draft.volumes : [],
      asp: Array.isArray(draft.asp) ? draft.asp : [],
      connectorPricing: draft.connectorPricing || {},
    },
  });
}
