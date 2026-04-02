(function () {
  const runtime = window.G281_RUNTIME || {};
  let bomValidation = runtime.bomValidation;
  let versionOrder = Array.isArray(bomValidation?.meta?.versionOrder) ? bomValidation.meta.versionOrder.slice() : [];
  if (!bomValidation || !Array.isArray(bomValidation?.harnessOrder) || !bomValidation.harnessOrder.length || !versionOrder.length) {
    return;
  }

  const STORAGE_KEY = 'g281.bomManualAlign.v6';
  const openBtn = document.getElementById('openBomValidationBtn');
  const closeBtn = document.getElementById('closeBomValidationBtn');
  const resetBtn = document.getElementById('resetBomValidationBtn');
  const modal = document.getElementById('bomValidationModal');
  const select = document.getElementById('bomValidationHarness');
  const summary = document.getElementById('bomValidationSummary');
  const groups = document.getElementById('bomValidationGroups');
  const hint = document.getElementById('bomValidationHint');
  const importInput = document.getElementById('importBomValidationFile');
  const importBtn = document.getElementById('importBomValidationBtn');
  const exportBtn = document.getElementById('exportBomValidationBtn');
  const clearImportBtn = document.getElementById('clearBomValidationImportBtn');

  if (!openBtn || !closeBtn || !resetBtn || !modal || !select || !summary || !groups || !hint) {
    return;
  }

  let versionLabels = { ...(bomValidation.meta.versionLabels || {}) };
  let workbookLabels = { ...(bomValidation.meta.workbooks || {}) };
  let baseVersion = bomValidation.meta?.baseSource || versionOrder[versionOrder.length - 1] || versionOrder[0];
  let compareOrder = Array.isArray(bomValidation?.meta?.compareOrder) ? bomValidation.meta.compareOrder.slice() : versionOrder.slice().reverse();

  const hasLocalStorage = (() => {
    try {
      return typeof window.localStorage !== 'undefined';
    } catch (error) {
      return false;
    }
  })();

  const DEFAULT_GROUP_ORDER = [
    'battery_end',
    'edrive_end',
    'accm_end',
    'ptc_end',
    'branch_splitter',
    'charge_socket',
    'dc_charge_end',
    'ac_charge_end',
    'electronic_lock',
    'low_voltage_inline',
    'dc_ground',
    'ac_ground',
    'connector_misc',
    'wires',
    'sync_brackets',
    'sync_rubber',
    'materials',
  ];
  const GROUP_SECTIONS = {
    wires: 'wire',
    sync_brackets: 'sync',
    sync_rubber: 'sync',
    materials: 'material',
  };
  const HEADER_KEYS = [
    'no',
    'function',
    'partNumber',
    'partName',
    'semiFinished',
    'wireNo',
    'pin',
    'option',
    'spec',
    'quantity',
    'unit',
    'remark',
    'otherRemark',
    'subPartNumber',
    'subPartName',
    'subPartQuantity',
    'subPartUnit',
  ];
  const END_GROUP_RULES = [
    ['battery_end', ['接电池端', '电池端']],
    ['edrive_end', ['接电驱端', '接电驱', '电驱端']],
    ['accm_end', ['接ACCM端', 'ACCM端']],
    ['ptc_end', ['接PTC', 'PTC端']],
    ['branch_splitter', ['二分四分线器', '分线器']],
    ['charge_socket', ['组合式充电插座', '充电插座']],
    ['dc_charge_end', ['快充连接器（直流）', '快充端连接器', 'DC 10PIN低压信号连接器', 'DC 8PIN低压信号连接器']],
    ['ac_charge_end', ['慢充端连接器（交流）', '慢充连接器（交流）', 'AC 5PIN低压信号连接器', 'AC 6PIN低压信号连接器']],
    ['electronic_lock', ['电子锁低压连接器总成', '电子锁低压连接器', '电子锁']],
    ['low_voltage_inline', ['低压INLINE连接器总成', '低压inline连接器总成', '低压连接器总成']],
    ['dc_ground', ['DC接地端子']],
    ['ac_ground', ['AC接地端子']],
  ];
  const CONNECTOR_KEYWORDS = [
    '连接器',
    '护套',
    '端子',
    '屏蔽',
    '挡板',
    '尾盖',
    '密封圈',
    '线卡',
    '插头',
    '插座',
    '主体',
    '组合件',
    '固定件',
    '线密封圈',
    '电子锁',
    '低压',
    '壳体',
  ];
  const SYNC_BRACKET_KEYWORDS = ['支架', '安装支架', '金属支架', '塑料支架'];
  const SYNC_RUBBER_KEYWORDS = ['橡胶件', '橡胶', '胶件'];
  const ASSEMBLY_MAPPING_KEYWORDS = [
    '低压',
    '高压',
    '直流',
    '交流',
    'ODP',
    'AC',
    'DC',
    '电池',
    '电驱',
    '充电',
    '插件',
    '插头',
    '插座',
    '互锁',
    '屏蔽',
    '防水',
    '端子',
  ];

  const STATIC_STATUS_MAP = {
    full_match: { label: '三版匹配', className: 'matched' },
    partial_match: { label: '双版对齐', className: 'matched-partial' },
    assembly_bundle: { label: '总成映射', className: 'assembly-map' },
    assembly_part: { label: '散件展开', className: 'assembly-part' },
  };
  let statusMap = {};

  function fullMatchLabel() {
    return versionOrder.length <= 2 ? '鍙岀増瀵归綈' : '涓夌増鍖归厤';
  }

  function partialMatchLabel() {
    return versionOrder.length <= 2 ? '閮ㄥ垎瀵归綈' : '鍙岀増瀵归綈';
  }

  function rebuildStatusMap() {
    statusMap = {
      ...STATIC_STATUS_MAP,
      full_match: { ...STATIC_STATUS_MAP.full_match, label: fullMatchLabel() },
      partial_match: { ...STATIC_STATUS_MAP.partial_match, label: partialMatchLabel() },
    };
    versionOrder.forEach((version) => {
    statusMap[`${version}_only`] = {
      label: `${shortLabel(version)}独有`,
      className: `source-only source-${version}`,
    };
    });
  }

  const escapeHtml = (value) => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

  const safeParse = (value, fallback) => {
    if (!value) return fallback;
    try {
      return JSON.parse(value);
    } catch (error) {
      return fallback;
    }
  };

  const fmtQty = (value) => {
    const number = Number(value);
    if (!Number.isFinite(number)) return '-';
    if (Math.abs(number - Math.round(number)) < 1e-9) {
      return String(Math.round(number));
    }
    return number.toLocaleString('zh-CN', { minimumFractionDigits: 0, maximumFractionDigits: 4 });
  };

  const uniqueStrings = (values) => {
    const seen = new Set();
    return (Array.isArray(values) ? values : [])
      .map((value) => String(value ?? '').trim())
      .filter((value) => value && !seen.has(value) && seen.add(value));
  };

  const displayList = (values) => {
    const list = uniqueStrings(values).filter((value) => value !== '/');
    return list.length ? list.join(' / ') : '-';
  };

  function triggerDownload(filename, content, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function guessHeaderRows(sheetName) {
    return /^\d{8,}$/.test(String(sheetName || '')) || /BOM/i.test(String(sheetName || '')) ? 4 : 1;
  }

  function buildRuntimeWorkbookPayload(versionKey, workbookPayload) {
    return {
      versionKey,
      versionLabel: workbookPayload.versionLabel || versionLabels[versionKey] || versionKey,
      workbookName: workbookPayload.sourceFileName || workbookPayload.versionLabel || versionKey,
      sourceFileName: workbookPayload.sourceFileName || '',
      sourcePath: workbookPayload.sourcePath || '',
      generatedAt: runtime.bomWorkbookCopies?.generatedAt || new Date().toISOString(),
      generator: runtime.bomWorkbookCopies?.generator || 'g281-runtime-seed',
      sheetOrder: workbookPayload.sheetOrder || [],
      hiddenSheets: workbookPayload.hiddenSheets || [],
      workbookMeta: {
        styleTable: workbookPayload.styleTable || {},
      },
      sheets: (workbookPayload.sheets || []).map((sheet) => ({
        ...sheet,
        headerRows: Number.isFinite(sheet.headerRows) ? sheet.headerRows : guessHeaderRows(sheet.sheetName),
      })),
    };
  }

  async function initNativeBomStore() {
    if (!window.G281BomDb?.init || !window.G281BomIO?.init) return false;
    await window.G281BomDb.init();
    window.G281BomIO.init({ defaultFormat: window.XLSX ? 'xlsx' : 'json' });
    return true;
  }

  async function seedNativeBomStore() {
    if (!runtime.bomWorkbookCopies?.versions || !window.G281BomDb?.saveVersion) return;
    await initNativeBomStore();
    await Promise.all(Object.entries(runtime.bomWorkbookCopies.versions).map(([versionKey, workbookPayload]) => (
      window.G281BomDb.saveVersion({
        projectId: NATIVE_BOM_PROJECT_ID,
        versionId: `runtime-${versionKey}`,
        versionKey,
        versionLabel: workbookPayload.versionLabel || versionLabels[versionKey] || versionKey,
        sourceType: 'runtime-seed',
        workbook: buildRuntimeWorkbookPayload(versionKey, workbookPayload),
        meta: {
          runtimeVersionKey: versionKey,
          sourceFileName: workbookPayload.sourceFileName || '',
        },
      })
    )));
  }

  async function refreshNativeBomStatus(message = '') {
    if (!window.G281BomDb?.listVersions) {
      nativeBomVersionCount = 0;
      nativeBomStatus = '原生 BOM 库未启用';
      return;
    }
    await initNativeBomStore();
    const versions = await window.G281BomDb.listVersions(NATIVE_BOM_PROJECT_ID);
    nativeBomVersionCount = versions.length;
    const versionNames = Array.from(new Set(
      versions
        .map((record) => collapseText(
          record?.workbook?.sourceFileName
          || record?.workbookMeta?.sourceFileName
          || record?.meta?.sourceFileName
          || record?.workbook?.workbookName
          || record?.workbookMeta?.workbookName
          || record?.versionLabel
          || record?.versionId
        ))
        .filter(Boolean)
    ));
    const summaryText = `原生 BOM 库已入库 ${nativeBomVersionCount} 个版本${versionNames.length ? `：${versionNames.join('、')}` : ''}，支持 ${window.XLSX ? 'XLSX / JSON' : 'JSON'} 导入导出`;
    nativeBomStatus = message ? `${message}；${summaryText}` : summaryText;
  }

  function nativeBomHintText() {
    return nativeBomStatus || '原生 BOM 库会把整本 BOM 工作簿写入 IndexedDB，后续导入的新版本也会按整本表保存。';
  }

  async function resolveExportVersionChoice() {
    await initNativeBomStore();
    const versions = await (window.G281BomDb?.listVersions?.(NATIVE_BOM_PROJECT_ID) || Promise.resolve([]));
    const availableVersionIds = new Set(versions.map((record) => record.versionId));
    if (!availableVersionIds.size) {
      throw new Error('原生 BOM 库中没有可导出的版本');
    }

    if (lastImportedVersionId) {
      if (availableVersionIds.has(lastImportedVersionId)) {
        return {
          versionId: lastImportedVersionId,
          requestedVersionKey: null,
          resolvedVersionKey: null,
          usedFallback: false,
          sourceType: 'imported',
        };
      }
      lastImportedVersionId = '';
    }

    const requestedVersionKey = window.G281DashboardBridge?.getStateSnapshot?.()?.bom
      || window.G281DashboardBridge?.getWorkbookVersionKey?.()
      || 'quote';
    const linkedNativeVersionId = window.G281DashboardBridge?.getBomNativeVersionId?.(requestedVersionKey);
    if (linkedNativeVersionId && availableVersionIds.has(linkedNativeVersionId)) {
      return {
        versionId: linkedNativeVersionId,
        requestedVersionKey,
        resolvedVersionKey: requestedVersionKey,
        usedFallback: false,
        sourceType: 'linked-import',
      };
    }

    const requestedIndex = versionOrder.indexOf(requestedVersionKey);
    const orderedVersionKeys = [
      requestedVersionKey,
      ...(requestedIndex >= 0 ? versionOrder.slice(requestedIndex + 1) : versionOrder),
      ...(requestedIndex >= 0 ? versionOrder.slice(0, requestedIndex) : []),
      ...((runtime.bomWorkbookCopies?.versionOrder || []).filter((key) => !versionOrder.includes(key))),
    ];
    const fallbackVersionKey = orderedVersionKeys.find((versionKey) => availableVersionIds.has(`runtime-${versionKey}`));
    if (fallbackVersionKey) {
      return {
        versionId: `runtime-${fallbackVersionKey}`,
        requestedVersionKey,
        resolvedVersionKey: fallbackVersionKey,
        usedFallback: fallbackVersionKey !== requestedVersionKey,
        sourceType: 'runtime',
      };
    }

    const latestRecord = versions[0];
    return {
      versionId: latestRecord.versionId,
      requestedVersionKey,
      resolvedVersionKey: latestRecord.versionKey || latestRecord.meta?.runtimeVersionKey || null,
      usedFallback: true,
      sourceType: latestRecord.sourceType || 'runtime',
    };
  }

  function shortLabel(version) {
    const text = String(versionLabels[version] || version || '').trim();
    return text.replace(/\s*BOM$/i, '').trim() || version;
  }

  function sourceOnlyLabel(version) {
    return `${shortLabel(version)}独有`;
  }

  const seedGroupLabelMap = Object.values(bomValidation?.comparisons || {}).reduce((acc, comparison) => {
    (comparison?.groups || []).forEach((group) => {
      if (!acc[group.key] && group.label) {
        acc[group.key] = group.label;
      }
    });
    return acc;
  }, {});

  let bomViewSyncHint = '';
  let bomSyncToken = 0;

  rebuildStatusMap();

  let manualAlignState = hasLocalStorage ? safeParse(window.localStorage.getItem(STORAGE_KEY), {}) : {};
  let dragState = null;
  let lastFocused = null;
  let nativeBomVersionCount = 0;
  let lastImportedVersionId = '';
  let nativeBomStatus = '';

  const NATIVE_BOM_PROJECT_ID = 'g281-native-bom';
  const BUILTIN_BOM_KEY_BY_WORKBOOK_KEY = {
    quote: 'freeze',
    fixed: 'light',
    tt: 'regress',
  };

  function collapseText(value) {
    if (value === null || value === undefined) return '';
    return String(value).replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/\s+/g, ' ').trim();
  }

  function normalizeKey(value) {
    return collapseText(value).replace(/\s+/g, '').toUpperCase();
  }

  function numericValue(value) {
    if (value === null || value === undefined || value === '') return null;
    const normalized = typeof value === 'string' ? value.replace(/,/g, '').trim() : value;
    const number = Number(normalized);
    if (!Number.isFinite(number)) return null;
    return Math.abs(number - Math.round(number)) < 1e-9 ? Math.round(number) : Number(number.toFixed(6));
  }

  function firstDigits(value) {
    const match = /^(\d{10})/.exec(String(value || '').trim());
    return match ? match[1] : '';
  }

  function uniqueOrdered(values) {
    const seen = new Set();
    return (Array.isArray(values) ? values : []).filter((value) => {
      const key = String(value ?? '');
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function groupSection(groupKey) {
    return GROUP_SECTIONS[groupKey] || 'connector';
  }

  function resolveGroupLabel(groupKey) {
    return seedGroupLabelMap[groupKey] || groupKey;
  }

  function detectEndGroup(functionText) {
    const haystack = collapseText(functionText).toUpperCase();
    if (!haystack) return '';
    const match = END_GROUP_RULES.find(([, keywords]) => keywords.some((keyword) => haystack.includes(String(keyword).toUpperCase())));
    return match ? match[0] : '';
  }

  function isWireRow(partNumber, partName, unit) {
    const haystack = [partNumber, partName].filter(Boolean).join(' ').toUpperCase();
    if (haystack.includes('导线')) return true;
    if (partNumber && /\/\d+(?:\.\d+)?\//.test(String(partNumber))) return true;
    return String(unit || '').toUpperCase() === 'M' && (haystack.includes('屏蔽') || haystack.includes('导线'));
  }

  function isConnectorRow(functionText, partNumber, partName, unit) {
    if (detectEndGroup(functionText)) return true;
    const haystack = [functionText, partNumber, partName].filter(Boolean).join(' ').toUpperCase();
    if (String(unit || '').toUpperCase() === 'SET') return true;
    return CONNECTOR_KEYWORDS.some((keyword) => haystack.includes(String(keyword).toUpperCase()));
  }

  function classifyRow(functionText, partNumber, partName, unit) {
    if (isWireRow(partNumber, partName, unit)) return 'wire';
    if (isConnectorRow(functionText, partNumber, partName, unit)) return 'connector';
    return 'material';
  }

  function detectMaterialGroup(partNumber, partName) {
    const partCode = collapseText(partNumber).toUpperCase();
    const haystack = [partCode, collapseText(partName)].filter(Boolean).join(' ');
    if (SYNC_BRACKET_KEYWORDS.some((keyword) => haystack.includes(keyword)) || /(?:^|[-_/])(HB|ZJ)(?:[-_/]|$)/.test(partCode)) {
      return 'sync_brackets';
    }
    if (SYNC_RUBBER_KEYWORDS.some((keyword) => haystack.includes(keyword)) || /(?:^|[-_/])XJ(?:[-_/]|$)/.test(partCode)) {
      return 'sync_rubber';
    }
    return 'materials';
  }

  function itemKeyForRow(partNumber, partName) {
    return normalizeKey(partNumber) || normalizeKey(partName);
  }

  function workbookCellValue(cell) {
    if (!cell || typeof cell !== 'object') return '';
    if (cell.display !== undefined && cell.display !== null && cell.display !== '') return cell.display;
    if (cell.value !== undefined && cell.value !== null && cell.value !== '') return cell.value;
    if (cell.v !== undefined && cell.v !== null && cell.v !== '') return cell.v;
    if (cell.formula) return cell.formula;
    if (cell.f) return cell.f;
    return '';
  }

  function createSheetAccessor(rawSheet, sheetName) {
    const rowsByIndex = new Map();
    if (Array.isArray(rawSheet?.rows) && rawSheet.rows.length) {
      rawSheet.rows.forEach((row) => {
        const rowIndex = Number(row?.rowIndex);
        if (!Number.isFinite(rowIndex) || rowIndex < 1) return;
        const values = [];
        (row.cells || []).forEach((cell) => {
          const columnIndex = Number(cell?.column);
          if (!Number.isFinite(columnIndex) || columnIndex < 1) return;
          values[columnIndex - 1] = workbookCellValue(cell);
        });
        rowsByIndex.set(rowIndex, values);
      });
    } else if (rawSheet?.cellData && typeof rawSheet.cellData === 'object') {
      Object.entries(rawSheet.cellData).forEach(([rowKey, columnMap]) => {
        const rowIndex = Number(rowKey) + 1;
        if (!Number.isFinite(rowIndex) || rowIndex < 1) return;
        const values = [];
        Object.entries(columnMap || {}).forEach(([columnKey, cell]) => {
          const columnIndex = Number(columnKey) + 1;
          if (!Number.isFinite(columnIndex) || columnIndex < 1) return;
          values[columnIndex - 1] = workbookCellValue(cell);
        });
        rowsByIndex.set(rowIndex, values);
      });
    }

    const rowIndexes = Array.from(rowsByIndex.keys());
    return {
      sheetName: sheetName || rawSheet?.sheetName || rawSheet?.name || '',
      maxRow: rowIndexes.length ? Math.max(...rowIndexes) : 0,
      rowValues(rowIndex) {
        return rowsByIndex.get(rowIndex) || [];
      },
    };
  }

  function listWorkbookSheetAccessors(workbookSource) {
    if (!workbookSource || typeof workbookSource !== 'object') return [];
    if (Array.isArray(workbookSource.sheets)) {
      return workbookSource.sheets.map((sheet) => createSheetAccessor(sheet, sheet?.sheetName)).filter((sheet) => sheet.sheetName);
    }
    if (workbookSource.sheetOrder && workbookSource.sheets && typeof workbookSource.sheets === 'object') {
      return (workbookSource.sheetOrder || [])
        .map((sheetId) => {
          const sheet = workbookSource.sheets?.[sheetId];
          return sheet ? createSheetAccessor(sheet, sheet.name || sheet.sheetName || sheetId) : null;
        })
        .filter(Boolean);
    }
    return [];
  }

  function readKskLookupFromSheets(sheetAccessors) {
    const lookup = {};
    const kskSheet = (sheetAccessors || []).find((sheet) => String(sheet.sheetName || '').includes('KSK'));
    if (!kskSheet) return lookup;
    for (let rowIndex = 2; rowIndex <= kskSheet.maxRow; rowIndex += 1) {
      const row = kskSheet.rowValues(rowIndex);
      const harnessId = firstDigits(row[0]);
      if (!harnessId) continue;
      const partNumber = collapseText(row[3]);
      const partName = collapseText(row[4]);
      const itemKey = itemKeyForRow(partNumber, partName);
      if (!itemKey) continue;
      const record = {
        assemblyRef: collapseText(row[2]),
        sapNo: collapseText(row[6]),
        supplier: collapseText(row[12]),
        otherRemark: collapseText(row[13]),
      };
      if (!lookup[harnessId]) lookup[harnessId] = {};
      if (!lookup[harnessId][itemKey]) lookup[harnessId][itemKey] = [];
      lookup[harnessId][itemKey].push(record);
    }
    return lookup;
  }

  function parseSheetAccessor(sheetAccessor) {
    const harnessId = firstDigits(sheetAccessor.sheetName) || sheetAccessor.sheetName;
    const harnessName = collapseText(sheetAccessor.rowValues(2)[4]) || harnessId;
    const items = [];
    let currentConnectorGroup = '';
    let blankStreak = 0;

    for (let rowIndex = 5; rowIndex <= sheetAccessor.maxRow; rowIndex += 1) {
      const sourceRow = sheetAccessor.rowValues(rowIndex);
      const values = sourceRow.slice(0, HEADER_KEYS.length);
      while (values.length < HEADER_KEYS.length) {
        values.push(null);
      }
      const hasValue = values.some((value) => value !== null && value !== undefined && value !== '');
      if (!hasValue) {
        blankStreak += 1;
        if (items.length && blankStreak >= 20) break;
        continue;
      }
      blankStreak = 0;

      const rowMap = Object.fromEntries(HEADER_KEYS.map((key, index) => [key, values[index]]));
      const functionText = rowMap.function === null || rowMap.function === undefined ? '' : String(rowMap.function).replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
      const partNumber = collapseText(rowMap.partNumber);
      const partName = collapseText(rowMap.partName);
      const unit = collapseText(rowMap.unit).toUpperCase();
      if (!functionText && !partNumber && !partName) continue;

      const kind = classifyRow(functionText, partNumber, partName, unit);
      const detectedGroup = detectEndGroup(functionText);
      let groupKey = '';
      if (kind === 'connector') {
        if (detectedGroup) {
          groupKey = detectedGroup;
          currentConnectorGroup = detectedGroup;
        } else if (!functionText && currentConnectorGroup) {
          groupKey = currentConnectorGroup;
        } else {
          groupKey = 'connector_misc';
        }
      } else {
        groupKey = kind === 'wire' ? 'wires' : detectMaterialGroup(partNumber, partName);
      }

      items.push({
        rowNumber: rowIndex,
        sequence: numericValue(rowMap.no),
        kind,
        groupKey,
        functionRaw: functionText,
        functionBrief: collapseText(functionText.includes('\n') ? functionText.split('\n')[1] || functionText : functionText),
        partNumber,
        partName,
        quantity: numericValue(rowMap.quantity),
        unit,
        remark: collapseText(rowMap.remark),
        otherRemark: collapseText(rowMap.otherRemark),
        wireNo: collapseText(rowMap.wireNo),
        spec: collapseText(rowMap.spec),
        itemKey: itemKeyForRow(partNumber, partName),
      });
    }

    return {
      harnessId,
      harnessName,
      sheetName: sheetAccessor.sheetName,
      items,
    };
  }

  function aggregateItems(items, kskLookup = {}) {
    const ordered = new Map();
    (items || []).forEach((item) => {
      const key = item.itemKey || `${item.groupKey}::${item.rowNumber}`;
      if (!ordered.has(key)) {
        ordered.set(key, {
          itemKey: key,
          partNumber: item.partNumber,
          partName: item.partName,
          unit: item.unit,
          quantity: 0,
          rowNumbers: [],
          functions: [],
          remarks: [],
          otherRemarks: [],
          wireNos: [],
          suppliers: [],
          sapNos: [],
          assemblyRefs: [],
          kind: item.kind,
          groupKey: item.groupKey,
        });
      }
      const bucket = ordered.get(key);
      bucket.rowNumbers.push(item.rowNumber);
      if (item.quantity !== null && item.quantity !== undefined) {
        bucket.quantity = Number((Number(bucket.quantity || 0) + Number(item.quantity || 0)).toFixed(6));
      }
      [
        ['functionBrief', 'functions'],
        ['remark', 'remarks'],
        ['otherRemark', 'otherRemarks'],
        ['wireNo', 'wireNos'],
      ].forEach(([sourceKey, targetKey]) => {
        const value = item[sourceKey];
        if (value && !bucket[targetKey].includes(value)) {
          bucket[targetKey].push(value);
        }
      });
      (kskLookup[key] || []).forEach((match) => {
        [
          ['supplier', 'suppliers'],
          ['sapNo', 'sapNos'],
          ['assemblyRef', 'assemblyRefs'],
          ['otherRemark', 'otherRemarks'],
        ].forEach(([sourceKey, targetKey]) => {
          const value = match[sourceKey];
          if (value && !bucket[targetKey].includes(value)) {
            bucket[targetKey].push(value);
          }
        });
      });
      if (item.remark && !bucket.suppliers.includes(item.remark)) {
        bucket.suppliers.push(item.remark);
      }
    });

    return Array.from(ordered.values()).map((item) => {
      const quantity = Number(item.quantity || 0);
      return {
        ...item,
        quantity: Math.abs(quantity - Math.round(quantity)) < 1e-9 ? Math.round(quantity) : Number(quantity.toFixed(4)),
      };
    });
  }

  function parseWorkbookHarnesses(workbookSource) {
    const sheetAccessors = listWorkbookSheetAccessors(workbookSource);
    if (!sheetAccessors.length) {
      return { harnessOrder: [], harnesses: {} };
    }
    const kskLookupByHarness = readKskLookupFromSheets(sheetAccessors);
    const harnesses = {};
    sheetAccessors.forEach((sheetAccessor) => {
      const harnessId = firstDigits(sheetAccessor.sheetName);
      if (!harnessId) return;
      const parsedSheet = parseSheetAccessor(sheetAccessor);
      const aggregated = aggregateItems(parsedSheet.items, kskLookupByHarness[harnessId] || {});
      const groupMaps = aggregated.reduce((acc, item) => {
        if (!acc[item.groupKey]) acc[item.groupKey] = [];
        acc[item.groupKey].push(item);
        return acc;
      }, {});
      harnesses[harnessId] = {
        harnessId,
        harnessName: parsedSheet.harnessName,
        sheetName: parsedSheet.sheetName,
        itemCount: aggregated.length,
        groupMaps,
      };
    });
    return {
      harnessOrder: Object.keys(harnesses).sort(),
      harnesses,
    };
  }

  function inferBomKeyFromWorkbookVersion(workbookVersionKey = '') {
    return BUILTIN_BOM_KEY_BY_WORKBOOK_KEY[String(workbookVersionKey || '').trim().toLowerCase()] || '';
  }

  function semanticGroupKey(group = {}, row = {}) {
    const itemCategory = collapseText(group?.itemCategory).toLowerCase();
    const endGroup = collapseText(group?.endGroup);
    if (itemCategory === 'wire') return 'wires';
    if (['connector', 'terminal', 'ipt_terminal'].includes(itemCategory)) {
      return endGroup || 'connector_misc';
    }

    const sampleItem = row?.left || row?.right || (Array.isArray(row?.leftParts) ? row.leftParts[0] : null) || (Array.isArray(row?.rightParts) ? row.rightParts[0] : null) || {};
    return detectMaterialGroup(sampleItem.partNo, sampleItem.partName);
  }

  function semanticItemKind(groupKey) {
    if (groupKey === 'wires') return 'wire';
    if (groupSection(groupKey) === 'connector') return 'connector';
    return 'material';
  }

  function semanticItemKey(item = {}) {
    return itemKeyForRow(item.partNo, item.partName)
      || normalizeKey(item.sapNo)
      || normalizeKey(item.itemId)
      || `${collapseText(item.releaseId)}::${collapseText(item.headerId)}::${collapseText(item.displayOrder)}`;
  }

  function semanticItemToViewItem(item = {}, groupKey = '') {
    if (!item || typeof item !== 'object') return null;
    return {
      itemKey: semanticItemKey(item),
      partNumber: collapseText(item.partNo),
      partName: collapseText(item.partName),
      unit: collapseText(item.unit).toUpperCase(),
      quantity: numericValue(item.qty),
      rowNumbers: [],
      functions: uniqueStrings([item.functionName].filter(Boolean)),
      remarks: uniqueStrings([item.spec].filter(Boolean)),
      otherRemarks: uniqueStrings([item.endGroup].filter(Boolean)),
      wireNos: uniqueStrings([item.alignKey].filter(Boolean)),
      suppliers: uniqueStrings([item.supplier].filter(Boolean)),
      sapNos: uniqueStrings([item.sapNo].filter(Boolean)),
      assemblyRefs: uniqueStrings([item.semiFinishedPartNo].filter(Boolean)),
      kind: semanticItemKind(groupKey),
      groupKey,
    };
  }

  function buildSemanticAlignedRow(diffRow, activeKey, baseKey, groupKey) {
    const sourceKeys = [activeKey, baseKey];
    const versions = initVersionDict(sourceKeys, null);
    const partLists = initVersionDict(sourceKeys, []);
    versions[baseKey] = semanticItemToViewItem(diffRow.left, groupKey);
    versions[activeKey] = semanticItemToViewItem(diffRow.right, groupKey);
    partLists[baseKey] = (diffRow.leftParts || []).map((item) => semanticItemToViewItem(item, groupKey)).filter(Boolean);
    partLists[activeKey] = (diffRow.rightParts || []).map((item) => semanticItemToViewItem(item, groupKey)).filter(Boolean);
    const row = {
      itemKey: collapseText(diffRow.rowId) || `${groupKey}::${Math.random().toString(36).slice(2, 8)}`,
      rowType: diffRow.rowType === 'assembly_to_parts' ? 'assembly_bundle' : 'standard',
      versions,
      partLists,
    };
    row.matchState = rowMatchStateDynamic(row, sourceKeys);
    row.sourceCount = rowSourceCountDynamic(row, sourceKeys);
    return row;
  }

  function buildSemanticGroup(group = {}, activeKey, baseKey) {
    const sourceKeys = [activeKey, baseKey];
    const rows = (group.rows || []).map((row) => buildSemanticAlignedRow(row, activeKey, baseKey, semanticGroupKey(group, row)));
    const stats = summarizeAlignment(rows, sourceKeys, baseKey);
    const itemCounts = sourceKeys.reduce((acc, sourceKey) => {
      acc[sourceKey] = rows.reduce((sum, row) => (
        sum
        + (row.versions?.[sourceKey] ? 1 : 0)
        + ((row.partLists?.[sourceKey] || []).length)
      ), 0);
      return acc;
    }, {});
    return {
      key: semanticGroupKey(group, group.rows?.[0] || {}),
      label: collapseText(group.label) || resolveGroupLabel(semanticGroupKey(group, group.rows?.[0] || {})),
      section: groupSection(semanticGroupKey(group, group.rows?.[0] || {})),
      itemCounts,
      matchedCount: stats.matched,
      fullMatchCount: stats.fullMatch,
      partialMatchCount: stats.partialMatch,
      onlyCounts: stats.onlyCounts,
      assemblyToPartsCount: stats.assemblyToParts,
      assemblyPartCount: stats.assemblyPartCount,
      aligned: rows,
    };
  }

  function buildSemanticComparison(harness = {}, activeKey, baseKey, activeLabel, baseLabel, activeWorkbook, baseWorkbook) {
    const grouped = {};
    (harness.groups || []).forEach((group) => {
      const normalized = buildSemanticGroup(group, activeKey, baseKey);
      if (!grouped[normalized.key]) {
        grouped[normalized.key] = normalized;
        return;
      }
      grouped[normalized.key].itemCounts[activeKey] += normalized.itemCounts[activeKey] || 0;
      grouped[normalized.key].itemCounts[baseKey] += normalized.itemCounts[baseKey] || 0;
      grouped[normalized.key].matchedCount += normalized.matchedCount || 0;
      grouped[normalized.key].fullMatchCount += normalized.fullMatchCount || 0;
      grouped[normalized.key].partialMatchCount += normalized.partialMatchCount || 0;
      grouped[normalized.key].onlyCounts[activeKey] += normalized.onlyCounts?.[activeKey] || 0;
      grouped[normalized.key].onlyCounts[baseKey] += normalized.onlyCounts?.[baseKey] || 0;
      grouped[normalized.key].assemblyToPartsCount += normalized.assemblyToPartsCount || 0;
      grouped[normalized.key].assemblyPartCount += normalized.assemblyPartCount || 0;
      grouped[normalized.key].aligned.push(...normalized.aligned);
    });
    const groupOrder = uniqueOrdered([
      ...DEFAULT_GROUP_ORDER,
      ...Object.keys(grouped),
    ]).filter((groupKey) => grouped[groupKey]);
    const groups = groupOrder.map((groupKey) => grouped[groupKey]);
    return {
      harnessId: harness.harnessNo || '',
      harnessName: harness.rightHeader?.harnessName || harness.leftHeader?.harnessName || harness.harnessNo || '',
      versionOrder: [activeKey, baseKey],
      compareOrder: [activeKey, baseKey],
      baseSource: baseKey,
      sources: {
        [activeKey]: {
          label: activeLabel,
          sheet: harness.rightHeader?.originSheetName || '-',
          itemCount: groups.reduce((sum, group) => sum + (Number(group.itemCounts?.[activeKey]) || 0), 0),
        },
        [baseKey]: {
          label: baseLabel,
          sheet: harness.leftHeader?.originSheetName || '-',
          itemCount: groups.reduce((sum, group) => sum + (Number(group.itemCounts?.[baseKey]) || 0), 0),
        },
      },
      summary: buildDynamicComparisonSummary(groups, [activeKey, baseKey]),
      groups,
      activeWorkbook,
      baseWorkbook,
    };
  }

  function buildSemanticBomValidationViewState(diffPayload, context = {}) {
    const activeKey = context.activeKey;
    const baseKey = context.baseKey;
    const activeLabel = context.activeLabel || shortLabel(activeKey);
    const baseLabel = context.baseLabel || shortLabel(baseKey);
    const comparisons = {};
    const harnessOrder = (diffPayload?.harnesses || []).map((harness) => {
      const comparison = buildSemanticComparison(
        harness,
        activeKey,
        baseKey,
        activeLabel,
        baseLabel,
        context.activeWorkbook,
        context.baseWorkbook,
      );
      comparisons[comparison.harnessId] = comparison;
      return comparison.harnessId;
    }).filter(Boolean);

    return {
      bomValidation: {
        ...(runtime.bomValidation || {}),
        meta: {
          ...(runtime.bomValidation?.meta || {}),
          versionOrder: [activeKey, baseKey],
          compareOrder: [activeKey, baseKey],
          baseSource: baseKey,
          versionLabels: {
            ...(runtime.bomValidation?.meta?.versionLabels || {}),
            [activeKey]: activeLabel,
            [baseKey]: baseLabel,
          },
          workbooks: {
            ...(runtime.bomValidation?.meta?.workbooks || {}),
            [activeKey]: context.activeWorkbook || activeLabel,
            [baseKey]: context.baseWorkbook || baseLabel,
          },
        },
        harnessOrder,
        comparisons,
      },
      versionOrder: [activeKey, baseKey],
      compareOrder: [activeKey, baseKey],
      versionLabels: {
        ...(runtime.bomValidation?.meta?.versionLabels || {}),
        [activeKey]: activeLabel,
        [baseKey]: baseLabel,
      },
      workbookLabels: {
        ...(runtime.bomValidation?.meta?.workbooks || {}),
        [activeKey]: context.activeWorkbook || activeLabel,
        [baseKey]: context.baseWorkbook || baseLabel,
      },
      baseVersion: baseKey,
      syncHint: `BOM 绠＄悊宸叉敼涓鸿涔? diff 瀵规瘮锛屽綋鍓嶅睍绀?${activeLabel} vs ${baseLabel}銆?`,
    };
  }

  function inferBaseBomKey(activeBomKey, activeOption, versionEntries, bridge) {
    const explicitReleaseId = collapseText(activeOption?.baseSemanticReleaseId);
    if (explicitReleaseId) {
      const matched = versionEntries.find((entry) => collapseText(bridge?.getBomSemanticReleaseId?.(entry.key)) === explicitReleaseId);
      if (matched?.key && matched.key !== activeBomKey) {
        return matched.key;
      }
    }

    const fallbackKey = inferBomKeyFromWorkbookVersion(activeOption?.workbookVersionKeyFallback);
    if (fallbackKey && fallbackKey !== activeBomKey && versionEntries.some((entry) => entry.key === fallbackKey)) {
      return fallbackKey;
    }

    const preferredMap = {
      regress: ['light', 'freeze'],
      light: ['freeze', 'regress'],
      freeze: ['light', 'regress'],
    };
    const preferred = preferredMap[activeBomKey] || [];
    const matchedPreferred = preferred.find((candidate) => candidate !== activeBomKey && versionEntries.some((entry) => entry.key === candidate));
    if (matchedPreferred) {
      return matchedPreferred;
    }

    return versionEntries.find((entry) => entry.key !== activeBomKey)?.key || '';
  }

  function initVersionDict(sourceKeys, defaultValue) {
    return sourceKeys.reduce((acc, sourceKey) => {
      acc[sourceKey] = typeof defaultValue === 'function' ? defaultValue() : defaultValue;
      return acc;
    }, {});
  }

  function rowItem(row, sourceKey) {
    return row?.versions?.[sourceKey] || null;
  }

  function rowParts(row, sourceKey) {
    return Array.isArray(row?.partLists?.[sourceKey]) ? row.partLists[sourceKey] : [];
  }

  function rowPresenceForSource(row, sourceKey) {
    return Boolean(rowItem(row, sourceKey) || rowParts(row, sourceKey).length);
  }

  function rowSourceCountDynamic(row, sourceKeys) {
    return sourceKeys.reduce((count, sourceKey) => count + (rowPresenceForSource(row, sourceKey) ? 1 : 0), 0);
  }

  function rowMatchStateDynamic(row, sourceKeys) {
    const sourceCount = rowSourceCountDynamic(row, sourceKeys);
    if (row?.rowType === 'assembly_bundle') return 'assembly_bundle';
    if (sourceCount > 1 && sourceCount === sourceKeys.length) return 'full_match';
    if (sourceCount >= 2) return 'partial_match';
    const onlySource = sourceKeys.find((sourceKey) => rowPresenceForSource(row, sourceKey));
    return onlySource ? `${onlySource}_only` : 'empty';
  }

  function buildInitialRows(groupItems, sourceKeys, baseSourceKey) {
    const rows = new Map();
    sourceKeys.forEach((sourceKey) => {
      (groupItems[sourceKey] || []).forEach((item) => {
        const itemKey = item?.itemKey || `${sourceKey}-${rows.size + 1}`;
        if (!rows.has(itemKey)) {
          rows.set(itemKey, {
            itemKey,
            rowType: 'standard',
            versions: initVersionDict(sourceKeys, null),
            partLists: sourceKeys.reduce((acc, key) => {
              if (key !== baseSourceKey) acc[key] = [];
              return acc;
            }, {}),
          });
        }
        rows.get(itemKey).versions[sourceKey] = item;
      });
    });
    return Array.from(rows.values());
  }

  function cleanedPartCode(value) {
    return collapseText(value).toUpperCase().replace(/[^A-Z0-9]/g, '');
  }

  function partCodeChunks(value) {
    const text = collapseText(value).toUpperCase();
    const tokens = text.match(/[A-Z]+\d+[A-Z\d]*|\d+[A-Z]+[A-Z\d]*|[A-Z]{2,}|\d{2,}/g) || [];
    const chunks = new Set();
    tokens.forEach((token) => {
      chunks.add(token);
      if (token.length >= 6) chunks.add(token.slice(0, 6));
      if (token.length >= 8) chunks.add(token.slice(0, 8));
    });
    return chunks;
  }

  function sharedPrefixLength(left, right) {
    const limit = Math.min(left.length, right.length);
    let size = 0;
    while (size < limit && left[size] === right[size]) size += 1;
    return size;
  }

  function itemKeywords(item) {
    const haystack = [
      collapseText(item?.partName),
      displayList(item?.functions || []),
      displayList(item?.remarks || []),
    ].filter(Boolean).join(' ').toUpperCase();
    return new Set(ASSEMBLY_MAPPING_KEYWORDS.filter((keyword) => haystack.includes(String(keyword).toUpperCase())).map((keyword) => String(keyword).toUpperCase()));
  }

  function isConnectorAssemblyItem(item) {
    const unit = collapseText(item?.unit).toUpperCase();
    const haystack = [
      collapseText(item?.partNumber),
      collapseText(item?.partName),
      displayList(item?.functions || []),
    ].filter(Boolean).join(' ').toUpperCase();
    if (unit === 'SET') return true;
    return ['总成', '连接器', '插座', '插件'].some((keyword) => haystack.includes(keyword));
  }

  function assemblyMappingScore(assemblyItem, targetItem) {
    const assemblyCode = cleanedPartCode(assemblyItem?.partNumber);
    const targetCode = cleanedPartCode(targetItem?.partNumber);
    let score = 0;
    const prefixLength = sharedPrefixLength(assemblyCode, targetCode);
    if (prefixLength >= 10) score += 100;
    else if (prefixLength >= 8) score += 75;
    else if (prefixLength >= 6) score += 45;
    else if (prefixLength >= 4) score += 20;
    if (assemblyCode && targetCode && (assemblyCode.includes(targetCode) || targetCode.includes(assemblyCode))) {
      score += 60;
    }
    const targetChunks = partCodeChunks(targetItem?.partNumber);
    const sharedChunks = [...partCodeChunks(assemblyItem?.partNumber)].filter((chunk) => targetChunks.has(chunk));
    score += Math.min(sharedChunks.length, 4) * 12;
    const assemblyKeywords = itemKeywords(assemblyItem);
    const targetKeywords = itemKeywords(targetItem);
    score += [...assemblyKeywords].filter((keyword) => targetKeywords.has(keyword)).length * 10;
    if (collapseText(assemblyItem?.partName) === '连接器总成' && score < 30) {
      return 0;
    }
    return score;
  }

  function assignConnectorAssemblyParts(assemblyItems, targetItems) {
    if (!assemblyItems.length || !targetItems.length) {
      return { mapped: {}, usedTargetKeys: new Set() };
    }

    const assignments = [];
    if (assemblyItems.length === 1) {
      targetItems.forEach(() => assignments.push(0));
    } else {
      targetItems.forEach((targetItem) => {
        const scores = assemblyItems.map((assemblyItem) => assemblyMappingScore(assemblyItem, targetItem));
        const bestScore = scores.length ? Math.max(...scores) : 0;
        if (bestScore >= 15 && scores.filter((score) => score === bestScore).length === 1) {
          assignments.push(scores.indexOf(bestScore));
        } else {
          assignments.push(null);
        }
      });

      let cursor = 0;
      while (cursor < assignments.length) {
        if (assignments[cursor] !== null) {
          cursor += 1;
          continue;
        }
        const gapStart = cursor;
        while (cursor < assignments.length && assignments[cursor] === null) cursor += 1;
        const gapEnd = cursor - 1;
        const previousAssignment = gapStart > 0 ? assignments[gapStart - 1] : null;
        const nextAssignment = cursor < assignments.length ? assignments[cursor] : null;
        const fillValue = previousAssignment !== null && previousAssignment === nextAssignment
          ? previousAssignment
          : (previousAssignment !== null && nextAssignment === null ? previousAssignment : (previousAssignment === null ? nextAssignment : null));
        if (fillValue !== null) {
          for (let index = gapStart; index <= gapEnd; index += 1) {
            assignments[index] = fillValue;
          }
        }
      }
    }

    const mapped = {};
    const usedTargetKeys = new Set();
    targetItems.forEach((targetItem, index) => {
      const assignment = assignments[index];
      if (assignment === null || assignment === undefined) return;
      const assemblyItem = assemblyItems[assignment];
      if (!assemblyItem) return;
      if (!mapped[assemblyItem.itemKey]) mapped[assemblyItem.itemKey] = [];
      mapped[assemblyItem.itemKey].push(targetItem);
      usedTargetKeys.add(targetItem.itemKey);
    });
    return { mapped, usedTargetKeys };
  }

  function mergeConnectorAssemblyRows(alignedRows, sourceKeys, baseSourceKey) {
    const assemblyRows = alignedRows.filter((row) => {
      const baseItem = rowItem(row, baseSourceKey);
      return baseItem
        && isConnectorAssemblyItem(baseItem)
        && sourceKeys.some((sourceKey) => sourceKey !== baseSourceKey && !rowItem(row, sourceKey));
    });

    const partsMapBySource = {};
    const usedKeysBySource = {};
    sourceKeys.forEach((sourceKey) => {
      if (sourceKey === baseSourceKey) return;
      const targetItems = alignedRows
        .map((row, index) => (!rowItem(row, baseSourceKey) ? rowItem(alignedRows[index], sourceKey) : null))
        .filter(Boolean);
      const candidateItems = assemblyRows
        .map((row) => (rowItem(row, sourceKey) ? null : rowItem(row, baseSourceKey)))
        .filter(Boolean);
      const assignment = assignConnectorAssemblyParts(candidateItems, targetItems);
      partsMapBySource[sourceKey] = assignment.mapped;
      usedKeysBySource[sourceKey] = assignment.usedTargetKeys;
    });

    if (!Object.values(partsMapBySource).some((map) => Object.keys(map).length)) {
      return alignedRows.map((row) => ({
        ...row,
        matchState: rowMatchStateDynamic(row, sourceKeys),
        sourceCount: rowSourceCountDynamic(row, sourceKeys),
      }));
    }

    return alignedRows.reduce((acc, row) => {
      const baseItem = rowItem(row, baseSourceKey);
      const mappedPartLists = sourceKeys.reduce((bucket, sourceKey) => {
        if (sourceKey !== baseSourceKey) {
          bucket[sourceKey] = baseItem ? (partsMapBySource[sourceKey]?.[baseItem.itemKey] || []) : [];
        }
        return bucket;
      }, {});

      if (baseItem && Object.values(mappedPartLists).some((items) => items.length)) {
        const versions = initVersionDict(sourceKeys, null);
        sourceKeys.forEach((sourceKey) => {
          versions[sourceKey] = rowItem(row, sourceKey);
        });
        const assemblyRow = {
          itemKey: row.itemKey,
          rowType: 'assembly_bundle',
          versions,
          partLists: mappedPartLists,
        };
        assemblyRow.matchState = rowMatchStateDynamic(assemblyRow, sourceKeys);
        assemblyRow.sourceCount = rowSourceCountDynamic(assemblyRow, sourceKeys);
        acc.push(assemblyRow);
        return acc;
      }

      const versions = initVersionDict(sourceKeys, null);
      sourceKeys.forEach((sourceKey) => {
        const item = rowItem(row, sourceKey);
        if (sourceKey !== baseSourceKey && item && usedKeysBySource[sourceKey]?.has(item.itemKey) && !baseItem) {
          versions[sourceKey] = null;
        } else {
          versions[sourceKey] = item;
        }
      });
      if (!Object.values(versions).some(Boolean)) {
        return acc;
      }
      const nextRow = {
        itemKey: row.itemKey,
        rowType: 'standard',
        versions,
        partLists: sourceKeys.reduce((bucket, sourceKey) => {
          if (sourceKey !== baseSourceKey) bucket[sourceKey] = [];
          return bucket;
        }, {}),
      };
      nextRow.matchState = rowMatchStateDynamic(nextRow, sourceKeys);
      nextRow.sourceCount = rowSourceCountDynamic(nextRow, sourceKeys);
      acc.push(nextRow);
      return acc;
    }, []);
  }

  function summarizeAlignment(alignedRows, sourceKeys, baseSourceKey) {
    return alignedRows.reduce((stats, row) => {
      const stateKey = row.matchState || rowMatchStateDynamic(row, sourceKeys);
      if (stateKey === 'full_match') {
        stats.matched += 1;
        stats.fullMatch += 1;
      } else if (stateKey === 'partial_match') {
        stats.matched += 1;
        stats.partialMatch += 1;
      } else if (stateKey === 'assembly_bundle') {
        stats.matched += 1;
        const sourceCount = rowSourceCountDynamic(row, sourceKeys);
        if (sourceCount >= 3) stats.fullMatch += 1;
        else if (sourceCount === 2) stats.partialMatch += 1;
        stats.assemblyToParts += 1;
        stats.assemblyPartCount += sourceKeys.reduce((count, sourceKey) => count + (sourceKey === baseSourceKey ? 0 : rowParts(row, sourceKey).length), 0);
      } else if (stateKey.endsWith('_only')) {
        const sourceKey = stateKey.slice(0, -5);
        if (Object.prototype.hasOwnProperty.call(stats.onlyCounts, sourceKey)) {
          stats.onlyCounts[sourceKey] += 1;
        }
      }
      return stats;
    }, {
      matched: 0,
      fullMatch: 0,
      partialMatch: 0,
      onlyCounts: sourceKeys.reduce((acc, sourceKey) => ({ ...acc, [sourceKey]: 0 }), {}),
      assemblyToParts: 0,
      assemblyPartCount: 0,
    });
  }

  function buildDynamicGroupView(groupKey, groupItems, sourceKeys, baseSourceKey) {
    const initialRows = buildInitialRows(groupItems, sourceKeys, baseSourceKey);
    const alignedRows = groupSection(groupKey) === 'connector'
      ? mergeConnectorAssemblyRows(initialRows, sourceKeys, baseSourceKey)
      : initialRows.map((row) => ({
          ...row,
          matchState: rowMatchStateDynamic(row, sourceKeys),
          sourceCount: rowSourceCountDynamic(row, sourceKeys),
        }));
    const stats = summarizeAlignment(alignedRows, sourceKeys, baseSourceKey);
    return {
      key: groupKey,
      label: resolveGroupLabel(groupKey),
      section: groupSection(groupKey),
      itemCounts: sourceKeys.reduce((acc, sourceKey) => {
        acc[sourceKey] = (groupItems[sourceKey] || []).length;
        return acc;
      }, {}),
      matchedCount: stats.matched,
      fullMatchCount: stats.fullMatch,
      partialMatchCount: stats.partialMatch,
      onlyCounts: stats.onlyCounts,
      assemblyToPartsCount: stats.assemblyToParts,
      assemblyPartCount: stats.assemblyPartCount,
      aligned: alignedRows,
    };
  }

  function buildDynamicComparisonSummary(groups, sourceKeys) {
    const connectorGroups = groups.filter((group) => group.section === 'connector');
    const wireGroup = groups.find((group) => group.section === 'wire') || null;
    const syncGroups = groups.filter((group) => group.section === 'sync');
    const materialGroups = groups.filter((group) => group.section === 'material' || group.section === 'sync');
    return {
      groupCount: groups.length,
      connectorGroupCount: connectorGroups.length,
      syncGroupCount: syncGroups.length,
      itemCounts: sourceKeys.reduce((acc, sourceKey) => {
        acc[sourceKey] = groups.reduce((sum, group) => sum + (Number(group.itemCounts?.[sourceKey]) || 0), 0);
        return acc;
      }, {}),
      matchedCount: groups.reduce((sum, group) => sum + (Number(group.matchedCount) || 0), 0),
      fullMatchCount: groups.reduce((sum, group) => sum + (Number(group.fullMatchCount) || 0), 0),
      partialMatchCount: groups.reduce((sum, group) => sum + (Number(group.partialMatchCount) || 0), 0),
      onlyCounts: sourceKeys.reduce((acc, sourceKey) => {
        acc[sourceKey] = groups.reduce((sum, group) => sum + (Number(group.onlyCounts?.[sourceKey]) || 0), 0);
        return acc;
      }, {}),
      assemblyToPartsCount: groups.reduce((sum, group) => sum + (Number(group.assemblyToPartsCount) || 0), 0),
      assemblyPartCount: groups.reduce((sum, group) => sum + (Number(group.assemblyPartCount) || 0), 0),
      wireMatchedCount: Number(wireGroup?.matchedCount) || 0,
      syncMatchedCount: syncGroups.reduce((sum, group) => sum + (Number(group.matchedCount) || 0), 0),
      materialMatchedCount: materialGroups.reduce((sum, group) => sum + (Number(group.matchedCount) || 0), 0),
    };
  }

  function extractSeedItemsByGroup(comparison, sourceKey) {
    const groupMaps = {};
    (comparison?.groups || []).forEach((group) => {
      const items = [];
      (group.aligned || []).forEach((row) => {
        if (row?.versions?.[sourceKey]) items.push(row.versions[sourceKey]);
        (row?.partLists?.[sourceKey] || []).forEach((item) => items.push(item));
      });
      if (items.length) {
        groupMaps[group.key] = items;
      }
    });
    return groupMaps;
  }

  function buildSeedViewState(syncHint = '') {
    return {
      bomValidation: runtime.bomValidation,
      versionOrder: Array.isArray(runtime.bomValidation?.meta?.versionOrder) ? runtime.bomValidation.meta.versionOrder.slice() : [],
      compareOrder: Array.isArray(runtime.bomValidation?.meta?.compareOrder) ? runtime.bomValidation.meta.compareOrder.slice() : [],
      versionLabels: { ...(runtime.bomValidation?.meta?.versionLabels || {}) },
      workbookLabels: { ...(runtime.bomValidation?.meta?.workbooks || {}) },
      baseVersion: runtime.bomValidation?.meta?.baseSource || 'quote',
      syncHint,
    };
  }

  function syncHarnessSelect(preferredHarnessId = '') {
    const harnessOrder = Array.isArray(bomValidation?.harnessOrder) ? bomValidation.harnessOrder : [];
    openBtn.textContent = `BOM 管理 (${harnessOrder.length})`;
    const previousValue = preferredHarnessId || select.value;
    select.innerHTML = harnessOrder.map((harnessId) => {
      const comparison = getComparison(harnessId);
      const label = comparison ? `${comparison.harnessId} | ${comparison.harnessName}` : harnessId;
      return `<option value="${escapeHtml(harnessId)}">${escapeHtml(label)}</option>`;
    }).join('');
    if (previousValue && harnessOrder.includes(previousValue)) {
      select.value = previousValue;
      return;
    }
    if (harnessOrder[0]) {
      select.value = harnessOrder[0];
    }
  }

  function applyBomValidationViewState(viewState, preferredHarnessId = '') {
    bomValidation = viewState.bomValidation || runtime.bomValidation;
    versionOrder = Array.isArray(viewState.versionOrder) && viewState.versionOrder.length
      ? viewState.versionOrder.slice()
      : (runtime.bomValidation?.meta?.versionOrder || []).slice();
    compareOrder = Array.isArray(viewState.compareOrder) && viewState.compareOrder.length
      ? viewState.compareOrder.slice()
      : (runtime.bomValidation?.meta?.compareOrder || []).slice();
    versionLabels = { ...(viewState.versionLabels || runtime.bomValidation?.meta?.versionLabels || {}) };
    workbookLabels = { ...(viewState.workbookLabels || runtime.bomValidation?.meta?.workbooks || {}) };
    baseVersion = viewState.baseVersion || runtime.bomValidation?.meta?.baseSource || versionOrder[versionOrder.length - 1] || versionOrder[0];
    bomViewSyncHint = viewState.syncHint || '';
    rebuildStatusMap();
    syncHarnessSelect(preferredHarnessId);
  }

  async function resolveActiveWorkbookSource(option, fallbackVersionId = '') {
    if (option?.templateWorkbookSnapshot && option.templateWorkbookSnapshot.sheetOrder && option.templateWorkbookSnapshot.sheets) {
      return {
        workbookSource: option.templateWorkbookSnapshot,
        workbookName: option.label || '',
      };
    }
    const nativeVersionId = option?.nativeWorkbookVersionId || fallbackVersionId;
    if (nativeVersionId && window.G281BomDb?.getVersion) {
      await initNativeBomStore();
      const record = await window.G281BomDb.getVersion(nativeVersionId);
      if (record?.workbook) {
        return {
          workbookSource: record.workbook,
          workbookName: record.workbook?.workbookName || record.versionLabel || option.label || '',
        };
      }
    }
    return null;
  }

  async function buildRuntimeBomValidationView() {
    const bridge = window.G281DashboardBridge;
    const activeBomKey = bridge?.getActiveBomVersionKey?.() || bridge?.getStateSnapshot?.()?.bom || '';
    const activeOption = bridge?.getBomVersionOption?.(activeBomKey) || null;
    const versionEntries = bridge?.listBomVersions?.() || [];
    const activeVersionEntry = versionEntries.find((entry) => entry.key === activeBomKey) || null;
    const activeWorkbookVersionKey = activeOption?.workbookVersionKeyFallback
      || activeVersionEntry?.workbookVersionKey
      || bridge?.getWorkbookVersionKey?.()
      || '';
    const isUserCreatedActive = Boolean(activeOption?.userCreated);
    const activeLaneKey = isUserCreatedActive ? activeBomKey : activeWorkbookVersionKey;
    const activeLaneLabel = activeOption?.label || runtime.bomValidation?.meta?.versionLabels?.[activeLaneKey] || activeLaneKey;

    if (!activeBomKey || !activeWorkbookVersionKey || !activeLaneKey) {
      return buildSeedViewState('');
    }

    const baseBomKey = inferBaseBomKey(activeBomKey, activeOption, versionEntries, bridge);
    if (baseBomKey && baseBomKey !== activeBomKey && bridge?.compareBomVersions) {
      try {
        const [activeWorkbookSource, baseOption] = await Promise.all([
          resolveActiveWorkbookSource(
            activeOption,
            activeVersionEntry?.nativeWorkbookVersionId || `runtime-${activeWorkbookVersionKey}`,
          ),
          Promise.resolve(bridge.getBomVersionOption?.(baseBomKey) || null),
        ]);
        const baseVersionEntry = versionEntries.find((entry) => entry.key === baseBomKey) || null;
        const baseWorkbookVersionKey = baseOption?.workbookVersionKeyFallback
          || baseVersionEntry?.workbookVersionKey
          || '';
        const baseWorkbookSource = await resolveActiveWorkbookSource(
          baseOption,
          baseVersionEntry?.nativeWorkbookVersionId || (baseWorkbookVersionKey ? `runtime-${baseWorkbookVersionKey}` : ''),
        );
        const diffPayload = await bridge.compareBomVersions(baseBomKey, activeBomKey);
        if (diffPayload?.harnesses?.length) {
          return buildSemanticBomValidationViewState(diffPayload, {
            activeKey: activeBomKey,
            baseKey: baseBomKey,
            activeLabel: activeOption?.label || activeBomKey,
            baseLabel: baseOption?.label || baseBomKey,
            activeWorkbook: activeOption?.source || activeOption?.workbook || activeWorkbookSource?.workbookName || activeBomKey,
            baseWorkbook: baseOption?.source || baseOption?.workbook || baseWorkbookSource?.workbookName || baseBomKey,
          });
        }
      } catch (semanticError) {
        bomViewSyncHint = `BOM 绠＄悊璇箟瀵规瘮鍚屾澶辫触锛?{semanticError.message}`;
      }
    }

    const resolvedSource = await resolveActiveWorkbookSource(
      activeOption,
      activeVersionEntry?.nativeWorkbookVersionId || `runtime-${activeWorkbookVersionKey}`,
    );
    if (!resolvedSource?.workbookSource) {
      return buildSeedViewState(`当前 BOM 版本 ${activeOption.label || activeBomKey} 未包含可用的线束明细工作表，BOM 管理暂时继续按内置 ${shortLabel(activeWorkbookVersionKey)} 对比视图显示。`);
    }

    const parsed = parseWorkbookHarnesses(resolvedSource.workbookSource);
    if (!parsed.harnessOrder.length) {
      return buildSeedViewState(`当前 BOM 版本 ${activeOption.label || activeBomKey} 未解析到线束页签，BOM 管理暂时继续按内置 ${shortLabel(activeWorkbookVersionKey)} 对比视图显示。`);
    }

    const seedVersionOrder = Array.isArray(runtime.bomValidation?.meta?.versionOrder) ? runtime.bomValidation.meta.versionOrder.slice() : [];
    const seedCompareOrder = Array.isArray(runtime.bomValidation?.meta?.compareOrder) ? runtime.bomValidation.meta.compareOrder.slice() : seedVersionOrder.slice().reverse();
    const displayOrder = isUserCreatedActive ? uniqueOrdered([activeLaneKey, ...seedVersionOrder]) : seedVersionOrder.slice();
    const sourceKeys = isUserCreatedActive ? uniqueOrdered([...seedCompareOrder, activeLaneKey]) : uniqueOrdered(seedCompareOrder);
    const harnessOrder = uniqueOrdered([...(runtime.bomValidation?.harnessOrder || []), ...parsed.harnessOrder]);
    const comparisons = {};

    harnessOrder.forEach((harnessId) => {
      const seedComparison = runtime.bomValidation?.comparisons?.[harnessId] || null;
      const activeHarness = parsed.harnesses?.[harnessId] || null;
      const groupMapsBySource = sourceKeys.reduce((acc, sourceKey) => {
        acc[sourceKey] = sourceKey === activeLaneKey
          ? (activeHarness?.groupMaps || {})
          : extractSeedItemsByGroup(seedComparison, sourceKey);
        return acc;
      }, {});
      const extraGroupKeys = sourceKeys.flatMap((sourceKey) => Object.keys(groupMapsBySource[sourceKey] || {}));
      const groupKeys = uniqueOrdered([...DEFAULT_GROUP_ORDER, ...extraGroupKeys]).filter((groupKey) => (
        sourceKeys.some((sourceKey) => (groupMapsBySource[sourceKey]?.[groupKey] || []).length)
      ));
      const groups = groupKeys.map((groupKey) => buildDynamicGroupView(
        groupKey,
        sourceKeys.reduce((bucket, sourceKey) => {
          bucket[sourceKey] = groupMapsBySource[sourceKey]?.[groupKey] || [];
          return bucket;
        }, {}),
        sourceKeys,
        baseVersion,
      ));
      comparisons[harnessId] = {
        harnessId,
        harnessName: activeHarness?.harnessName || seedComparison?.harnessName || harnessId,
        versionOrder: displayOrder,
        compareOrder: sourceKeys,
        baseSource: baseVersion,
        sources: sourceKeys.reduce((acc, sourceKey) => {
          acc[sourceKey] = {
            label: versionLabels[sourceKey] || sourceKey,
            sheet: sourceKey === activeLaneKey ? (activeHarness?.sheetName || '-') : (seedComparison?.sources?.[sourceKey]?.sheet || '-'),
            itemCount: sourceKey === activeLaneKey
              ? (activeHarness?.itemCount || 0)
              : (seedComparison?.sources?.[sourceKey]?.itemCount || 0),
          };
          return acc;
        }, {}),
        summary: buildDynamicComparisonSummary(groups, sourceKeys),
        groups,
      };
    });

    return {
      bomValidation: {
        ...runtime.bomValidation,
        meta: {
          ...(runtime.bomValidation?.meta || {}),
          versionOrder: displayOrder,
          compareOrder: sourceKeys,
          versionLabels: {
            ...(runtime.bomValidation?.meta?.versionLabels || {}),
            [activeLaneKey]: activeLaneLabel,
          },
          workbooks: {
            ...(runtime.bomValidation?.meta?.workbooks || {}),
            [activeLaneKey]: activeOption.source || activeOption.workbook || resolvedSource.workbookName || activeLaneLabel,
          },
        },
        harnessOrder,
        comparisons,
      },
      versionOrder: displayOrder,
      compareOrder: sourceKeys,
      versionLabels: {
        ...(runtime.bomValidation?.meta?.versionLabels || {}),
        [activeLaneKey]: activeLaneLabel,
      },
      workbookLabels: {
        ...(runtime.bomValidation?.meta?.workbooks || {}),
        [activeLaneKey]: activeOption.source || activeOption.workbook || resolvedSource.workbookName || activeLaneLabel,
      },
      baseVersion,
      syncHint: `BOM 管理已同步到当前左侧 BOM 版本：${activeOption.label || activeBomKey}。`,
    };
  }

  async function syncBomValidationView(options = {}) {
    const token = ++bomSyncToken;
    const preferredHarnessId = options.preserveSelection ? (options.harnessId || select.value) : '';
    try {
      const nextView = await buildRuntimeBomValidationView();
      if (token !== bomSyncToken) return;
      applyBomValidationViewState(nextView, preferredHarnessId);
    } catch (error) {
      if (token !== bomSyncToken) return;
      applyBomValidationViewState(
        buildSeedViewState(`BOM 管理同步失败：${error.message}`),
        preferredHarnessId,
      );
    }
  }

  function saveAlignState() {
    if (!hasLocalStorage) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(manualAlignState));
  }

  function setModalOpen(open) {
    if (open) {
      lastFocused = document.activeElement;
      modal.hidden = false;
      modal.setAttribute('aria-hidden', 'false');
      document.body.classList.add('bom-modal-open');
      window.requestAnimationFrame(() => select.focus());
      return;
    }

    modal.hidden = true;
    modal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('bom-modal-open');
    if (lastFocused && typeof lastFocused.focus === 'function') {
      lastFocused.focus();
    }
  }

  function getComparison(harnessId) {
    return bomValidation.comparisons[harnessId] || null;
  }

  function getHarnessState(harnessId) {
    if (!manualAlignState[harnessId]) {
      manualAlignState[harnessId] = {};
    }
    return manualAlignState[harnessId];
  }

  function trimTrailingRows(rows, lockedRows) {
    const next = Array.isArray(rows) ? rows.slice() : [];
    while (next.length) {
      const lastIndex = next.length - 1;
      if (next[lastIndex] || lockedRows.has(lastIndex)) {
        break;
      }
      next.pop();
    }
    return next;
  }

  function normalizeRowState(storedRows, baseRows, itemMap, lockedRows) {
    const normalized = [];
    const sourceRows = Array.isArray(storedRows) && storedRows.length ? storedRows : baseRows;
    const rowCount = Math.max(sourceRows.length, baseRows.length);
    const used = new Set();

    for (let index = 0; index < rowCount; index += 1) {
      if (lockedRows.has(index)) {
        normalized[index] = baseRows[index] || null;
        continue;
      }

      const itemKey = sourceRows[index];
      if (itemKey && itemMap.has(itemKey) && !used.has(itemKey)) {
        normalized[index] = itemKey;
        used.add(itemKey);
      } else {
        normalized[index] = null;
      }
    }

    baseRows.forEach((itemKey, index) => {
      if (!itemKey || lockedRows.has(index) || !itemMap.has(itemKey) || used.has(itemKey)) {
        groups.innerHTML = '<div class="bom-compare-empty-state">\u672a\u627e\u5230\u8be5\u7ebf\u675f\u7684 BOM \u7ba1\u7406\u6570\u636e\u3002</div>';
        return;
      }

      while (normalized.length <= index) {
        normalized.push(null);
      }

      if (!normalized[index]) {
        normalized[index] = itemKey;
        used.add(itemKey);
        return;
      }

      let targetIndex = normalized.findIndex((value, rowIndex) => rowIndex > index && !lockedRows.has(rowIndex) && !value);
      if (targetIndex === -1) {
        targetIndex = normalized.findIndex((value, rowIndex) => !lockedRows.has(rowIndex) && !value);
      }
      if (targetIndex === -1) {
        normalized.push(itemKey);
      } else {
        normalized[targetIndex] = itemKey;
      }
      used.add(itemKey);
    });

    return trimTrailingRows(normalized, lockedRows);
  }

  function laneStatusForRow(row, version) {
    const item = row.versions?.[version];
    if (!item) return '';
    if (row.rowType === 'assembly_bundle' && version === baseVersion) {
      return 'assembly_bundle';
    }
    if (row.matchState === 'full_match') {
      return 'full_match';
    }
    if (row.matchState === 'partial_match') {
      return 'partial_match';
    }
    return `${version}_only`;
  }

  function buildGroupModel(harnessId, group) {
    const harnessState = getHarnessState(harnessId);
    const groupState = harnessState[group.key] || {};
    const itemMaps = Object.fromEntries(versionOrder.map((version) => [version, new Map()]));
    const baseRows = Object.fromEntries(versionOrder.map((version) => [version, []]));
    const lockedRows = Object.fromEntries(versionOrder.map((version) => [version, new Set()]));
    const statuses = Object.fromEntries(versionOrder.map((version) => [version, {}]));

    const rowBlueprints = (group.aligned || []).map((row) => {
      const directKeys = {};
      const partLists = {};
      versionOrder.forEach((version) => {
        const item = row.versions?.[version] || null;
        if (item) {
          itemMaps[version].set(item.itemKey, item);
          directKeys[version] = item.itemKey;
        } else {
          directKeys[version] = null;
        }
        partLists[version] = Array.isArray(row.partLists?.[version]) ? row.partLists[version] : [];
      });
      return {
        rowType: row.rowType || 'standard',
        matchState: row.matchState || '',
        sourceCount: Number(row.sourceCount) || 0,
        directKeys,
        partLists,
      };
    });

    rowBlueprints.forEach((row, index) => {
      versionOrder.forEach((version) => {
        baseRows[version][index] = row.directKeys[version];
        if (row.directKeys[version]) {
          statuses[version][row.directKeys[version]] = laneStatusForRow(row, version);
        }
        if (row.partLists[version]?.length || (row.directKeys[version] && row.sourceCount >= 2)) {
          lockedRows[version].add(index);
        }
      });
    });

    const laneRows = Object.fromEntries(versionOrder.map((version) => [
      version,
      normalizeRowState(groupState[`${version}Rows`], baseRows[version], itemMaps[version], lockedRows[version]),
    ]));

    const rowCount = Math.max(
      group.aligned.length,
      ...versionOrder.map((version) => laneRows[version].length),
      1,
    ) + 1;

    const rows = Array.from({ length: rowCount }, (_, index) => {
      const blueprint = rowBlueprints[index] || {
        rowType: 'standard',
        matchState: '',
        sourceCount: 0,
        directKeys: Object.fromEntries(versionOrder.map((version) => [version, null])),
        partLists: Object.fromEntries(versionOrder.map((version) => [version, []])),
      };
      const versions = {};
      const rowStatuses = {};
      const rowLocked = {};
      const parts = {};
      versionOrder.forEach((version) => {
        const itemKey = laneRows[version][index] || null;
        versions[version] = itemKey ? itemMaps[version].get(itemKey) || null : null;
        rowStatuses[version] = itemKey ? statuses[version][itemKey] : '';
        rowLocked[version] = lockedRows[version].has(index);
        parts[version] = blueprint.partLists[version] || [];
      });
      return {
        rowType: blueprint.rowType,
        matchState: blueprint.matchState,
        sourceCount: blueprint.sourceCount,
        versions,
        partLists: parts,
        statuses: rowStatuses,
        locked: rowLocked,
      };
    });

    return {
      ...group,
      rows,
      laneRows,
      lockedRows,
      rowCount,
    };
  }

  function persistGroupRows(harnessId, groupKey, version, rows, lockedRows) {
    const harnessState = getHarnessState(harnessId);
    if (!harnessState[groupKey]) {
      harnessState[groupKey] = {};
    }
    harnessState[groupKey][`${version}Rows`] = trimTrailingRows(rows, lockedRows);
    saveAlignState();
  }

  function moveUnlockedRowItem(rows, fromIndex, toIndex, lockedRows) {
    const next = Array.isArray(rows) ? rows.slice() : [];
    const rowCount = Math.max(next.length, fromIndex + 1, toIndex + 1);
    while (next.length < rowCount) {
      next.push(null);
    }
    if (lockedRows.has(fromIndex) || lockedRows.has(toIndex)) {
      return trimTrailingRows(next, lockedRows);
    }

    const movableIndexes = [];
    for (let index = 0; index < next.length; index += 1) {
      if (!lockedRows.has(index)) {
        movableIndexes.push(index);
      }
    }

    const fromSlot = movableIndexes.indexOf(fromIndex);
    const toSlot = movableIndexes.indexOf(toIndex);
    if (fromSlot === -1 || toSlot === -1) {
      return trimTrailingRows(next, lockedRows);
    }

    const movableRows = movableIndexes.map((index) => next[index] || null);
    const [itemKey] = movableRows.splice(fromSlot, 1);
    if (!itemKey) {
      return trimTrailingRows(next, lockedRows);
    }

    movableRows.splice(toSlot, 0, itemKey);
    movableRows.length = movableIndexes.length;
    movableIndexes.forEach((rowIndex, slotIndex) => {
      next[rowIndex] = movableRows[slotIndex] || null;
    });
    return trimTrailingRows(next, lockedRows);
  }

  function signedQuantity(value, unit) {
    return `${value > 0 ? '+' : ''}${fmtQty(value)}${unit ? ` ${unit}` : ''}`.trim();
  }

  function createDelta(text, className, title) {
    return { text, className, title };
  }

  function buildUsageDelta(baseItem, compareItem, baseLabel, compareLabel) {
    const baseUnit = String(baseItem?.unit || '').trim();
    const compareUnit = String(compareItem?.unit || '').trim();
    const baseQty = Number(baseItem?.quantity);
    const compareQty = Number(compareItem?.quantity);

    if (baseItem && !compareItem && Number.isFinite(baseQty)) {
      return createDelta(
        signedQuantity(-baseQty, baseUnit),
        'delta-down',
        `${compareLabel} 相比 ${baseLabel} 删除该项，差异 ${signedQuantity(-baseQty, baseUnit)}`,
      );
    }

    if (!baseItem && compareItem && Number.isFinite(compareQty)) {
      return createDelta(
        signedQuantity(compareQty, compareUnit),
        'delta-up',
        `${compareLabel} 相比 ${baseLabel} 新增该项，差异 ${signedQuantity(compareQty, compareUnit)}`,
      );
    }

    if (!baseItem || !compareItem || !Number.isFinite(baseQty) || !Number.isFinite(compareQty)) {
      return createDelta('-', 'delta-neutral', '缺少可比的用量数据');
    }

    if (baseUnit && compareUnit && baseUnit !== compareUnit) {
      return createDelta(
        `${fmtQty(baseQty)} ${baseUnit} -> ${fmtQty(compareQty)} ${compareUnit}`,
        'delta-neutral',
        `${baseLabel} ${fmtQty(baseQty)} ${baseUnit}，${compareLabel} ${fmtQty(compareQty)} ${compareUnit}`,
      );
    }

    const diff = compareQty - baseQty;
    const unit = compareUnit || baseUnit;
    if (Math.abs(diff) < 1e-9) {
      return createDelta(
        '一致',
        'delta-same',
        `${baseLabel} ${fmtQty(baseQty)} ${unit}，${compareLabel} ${fmtQty(compareQty)} ${unit}`,
      );
    }

    return createDelta(
      signedQuantity(diff, unit),
      diff > 0 ? 'delta-up' : 'delta-down',
      `${baseLabel} ${fmtQty(baseQty)} ${unit}，${compareLabel} ${fmtQty(compareQty)} ${unit}，差异 ${signedQuantity(diff, unit)}`,
    );
  }

  function buildLaneDelta(version, row) {
    const item = row.versions?.[version] || null;
    if (!item) {
      return createDelta('-', 'delta-neutral', '当前栏位没有直接零件数据');
    }

    if (version === baseVersion) {
      return createDelta('基准', 'delta-neutral', `${versionLabels[version] || version} 作为当前锚点版本`);
    }

    const previousVersion = versionOrder
      .slice(versionOrder.indexOf(version) + 1)
      .find((candidate) => row.versions?.[candidate]);

    if (!previousVersion) {
      return createDelta('基准', 'delta-neutral', `${versionLabels[version] || version} 当前作为本行对照基准`);
    }

    return buildUsageDelta(
      row.versions[previousVersion],
      item,
      versionLabels[previousVersion] || previousVersion,
      versionLabels[version] || version,
    );
  }

  function buildGroupMeta(model) {
    if (model.section === 'connector' && model.assemblyToPartsCount) {
      return `${shortLabel(baseVersion)} 端若为连接器总成，后续版本若为散件清单会自动按端展开；已对齐行锁定，独有行仍可通过空白行人工对位。`;
    }
    if (model.section === 'connector') {
      return '连接器按端别分组，对齐成功的零件锁定显示，独有零件可在各自版本栏内上下拖动。';
    }
    if (model.section === 'wire') {
      return '导线按零件直接对齐，未匹配项可在本版本栏内拖到空白行，方便人工精调。';
    }
    if (model.section === 'sync') {
      return '支架类与橡胶件类独立归入同步开发件分组，便于专项核对与后续版本扩展。';
    }
    return '其他物料按零件直接对齐；当前视图由版本列表驱动，后续新增 BOM 版本可继续接入同一套对齐机制。';
  }

  function buildCardTitle(version, item, consumption, assemblyText, noteText, delta, titleNote) {
    const titleParts = [
      `版本: ${versionLabels[version] || version}`,
      `料号: ${item.partNumber || '-'}`,
      `名称: ${item.partName || '-'}`,
      `单耗: ${consumption || '-'}`,
      `SAP: ${displayList(item.sapNos)}`,
      `供应商: ${displayList(item.suppliers)}`,
      `总成号: ${assemblyText}`,
      `备注: ${noteText}`,
      `用量差异: ${delta.text}`,
    ];
    if (titleNote) {
      titleParts.push(`说明: ${titleNote}`);
    }
    return titleParts.join('\n');
  }

  function renderCard(item, row, version, statusKey, groupKey, rowIndex, locked, options = {}) {
    if (!item) {
      return '<div class="bom-align-empty" aria-hidden="true"></div>';
    }

    const status = statusMap[statusKey] || statusMap[`${version}_only`];
    const canDrag = Boolean(item) && !locked && statusKey === `${version}_only` && !options.disableDrag;
    const functions = uniqueStrings(item.functions);
    const notes = uniqueStrings([...(item.remarks || []), ...(item.otherRemarks || [])]);
    const consumption = `${fmtQty(item.quantity)} ${item.unit || ''}`.trim();
    const assemblyText = displayList(item.assemblyRefs);
    const noteText = [...functions, ...notes].filter(Boolean).join(' | ') || '-';
    const detailParts = [];
    if (options.detailPrefix) {
      detailParts.push(options.detailPrefix);
    }
    if (assemblyText !== '-') {
      detailParts.push(assemblyText);
    }
    if (noteText !== '-') {
      detailParts.push(noteText);
    }
    const detailText = detailParts.length ? detailParts.join(' | ') : '-';
    const delta = options.deltaOverride || buildLaneDelta(version, row);
    const titleText = buildCardTitle(version, item, consumption, assemblyText, noteText, delta, options.titleNote);
    const cardClassName = options.cardClassName ? ` ${options.cardClassName}` : '';

    return `
      <article class="bom-card${canDrag ? '' : ' is-locked'}${cardClassName}" ${canDrag ? 'draggable="true"' : ''} title="${escapeHtml(titleText)}" data-item-key="${escapeHtml(item.itemKey)}" data-side="${escapeHtml(version)}" data-group-key="${escapeHtml(groupKey)}" data-index="${escapeHtml(String(rowIndex))}">
        <span class="status-pill bom-status ${status.className}">${escapeHtml(status.label)}</span>
        <span class="bom-inline-field bom-code" title="${escapeHtml(item.partNumber || '-')}">${escapeHtml(item.partNumber || '-')}</span>
        <span class="bom-inline-field bom-name" title="${escapeHtml(item.partName || '-')}">${escapeHtml(item.partName || '-')}</span>
        <span class="bom-inline-field bom-consumption" title="${escapeHtml(consumption || '-')}">${escapeHtml(consumption || '-')}</span>
        <span class="bom-inline-field" title="${escapeHtml(displayList(item.sapNos))}">${escapeHtml(displayList(item.sapNos))}</span>
        <span class="bom-inline-field" title="${escapeHtml(displayList(item.suppliers))}">${escapeHtml(displayList(item.suppliers))}</span>
        <span class="bom-inline-field bom-detail" title="${escapeHtml(detailText)}">${escapeHtml(detailText)}</span>
        <span class="bom-inline-field bom-delta ${delta.className}" title="${escapeHtml(delta.title)}">${escapeHtml(delta.text)}</span>
      </article>
    `;
  }

  function laneDeltaHint(version) {
    if (version === baseVersion) return '基准';
    return 'vs 右侧版';
  }

  function renderLaneColumns(version) {
    return `
      <div class="bom-lane-panel">
        <div class="bom-lane-title">
          <span>${escapeHtml(versionLabels[version] || version)}</span>
          <em>${escapeHtml(laneDeltaHint(version))}</em>
        </div>
        <div class="bom-lane-columns">
          <span>状态</span>
          <span>料号</span>
          <span>名称</span>
          <span>单耗</span>
          <span>SAP</span>
          <span>供应商</span>
          <span>总成/备注</span>
          <span>差异</span>
        </div>
      </div>
    `;
  }

  function renderLaneCell(groupKey, version, item, row, statusKey, index, locked, cardOptions = {}, cellClassName = '') {
    const isDropZone = !locked;
    return `
      <div class="bom-align-cell${locked ? ' is-locked' : ''}${cellClassName ? ` ${cellClassName}` : ''}" ${isDropZone ? 'data-drop-zone="true"' : ''} data-group-key="${escapeHtml(groupKey)}" data-side="${escapeHtml(version)}" data-drop-index="${escapeHtml(String(index))}">
        ${renderCard(item, row, version, statusKey, groupKey, index, locked, cardOptions)}
      </div>
    `;
  }

  function renderPartsCell(version, groupKey, partItems, index) {
    if (!Array.isArray(partItems) || !partItems.length) {
      return `
        <div class="bom-align-cell is-locked bom-align-cell-stack">
          <div class="bom-align-empty" aria-hidden="true"></div>
        </div>
      `;
    }

    const stackCards = partItems.map((item, partIndex) => renderCard(
      item,
      { versions: { [version]: item } },
      version,
      'assembly_part',
      groupKey,
      `${index}-${partIndex}`,
      true,
      {
        disableDrag: true,
        deltaOverride: createDelta('散件', 'delta-neutral', `${versionLabels[version] || version} 在该端按散件清单展开显示`),
        titleNote: `${versionLabels[version] || version} 在该端按散件清单展开显示`,
        cardClassName: 'is-stack-item',
      },
    )).join('');

    return `
      <div class="bom-align-cell is-locked bom-align-cell-stack">
        <div class="bom-stack-note">${escapeHtml(shortLabel(version))}散件清单 <strong>${partItems.length}</strong></div>
        <div class="bom-stack-list">
          ${stackCards}
        </div>
      </div>
    `;
  }

  function renderAssemblyRootCellLegacy(model, row, index, rootVersion) {
    const mappedSummary = versionOrder
      .filter((version) => version !== rootVersion && row.partLists?.[version]?.length)
      .map((version) => `${shortLabel(version)} ${row.partLists[version].length}`)
      .join(' / ');
    return renderLaneCell(
      model.key,
      rootVersion,
      row.versions?.[rootVersion] || null,
      row,
      'assembly_bundle',
      index,
      true,
      {
        disableDrag: true,
        deltaOverride: createDelta(
          mappedSummary ? `展开 ${mappedSummary}` : '总成映射',
          'delta-neutral',
          `${shortLabel(rootVersion)} 该端为连接器总成，后续版本按对应端散件清单展开`,
        ),
        titleNote: `${shortLabel(rootVersion)} 该端为连接器总成，后续版本按对应端散件清单展开`,
        detailPrefix: `${shortLabel(rootVersion)}总成`,
        cardClassName: 'is-assembly-root',
      },
    );
  }

  function renderRowLegacy(model, row, index) {
    const cells = versionOrder.map((version) => {
      const parts = row.partLists?.[version] || [];
      if (parts.length) {
        return renderPartsCell(version, model.key, parts, index);
      }
      if (row.rowType === 'assembly_bundle' && row.versions?.[version]) {
        return renderAssemblyRootCell(model, row, index, version);
      }
      return renderLaneCell(
        model.key,
        version,
        row.versions?.[version] || null,
        row,
        row.statuses?.[version] || '',
        index,
        Boolean(row.locked?.[version]),
      );
    });
    return `<div class="bom-align-row${row.rowType === 'assembly_bundle' ? ' bom-align-row-assembly' : ''}">${cells.join('')}</div>`;
  }

  function renderGroupLegacy(harnessId, group) {
    const model = buildGroupModel(harnessId, group);
    const statPills = [
      ...versionOrder.map((version) => `${shortLabel(version)} <strong>${model.itemCounts?.[version] || 0}</strong>`),
      `三版匹配 <strong>${model.fullMatchCount || 0}</strong>`,
      `双版对齐 <strong>${model.partialMatchCount || 0}</strong>`,
      ...versionOrder.map((version) => `${sourceOnlyLabel(version)} <strong>${model.onlyCounts?.[version] || 0}</strong>`),
    ];
    if (model.assemblyToPartsCount) {
      statPills.push(`总成映射 <strong>${model.assemblyToPartsCount}</strong>`);
      statPills.push(`展开散件 <strong>${model.assemblyPartCount}</strong>`);
    }

    return `
      <article class="bom-compare-group ${versionOrder.length > 2 ? 'is-bom-multi-way' : ''}" data-group-key="${escapeHtml(model.key)}">
        <div class="bom-compare-group-head">
          <div>
            <div class="bom-compare-group-label">${escapeHtml(model.label)}</div>
            <div class="bom-compare-group-meta">${escapeHtml(buildGroupMeta(model))}</div>
          </div>
          <div class="bom-compare-group-stats">
            ${statPills.map((text) => `<span class="stat-pill">${text}</span>`).join('')}
          </div>
        </div>
        <div class="bom-compare-body">
          <div class="bom-lane-header">
            ${versionOrder.map((version) => renderLaneColumns(version)).join('')}
          </div>
          <div class="bom-align-board">
            ${model.rows.map((row, index) => renderRow(model, row, index)).join('')}
          </div>
        </div>
      </article>
    `;
  }

  function renderHarnessLegacy(harnessId) {
    const comparison = getComparison(harnessId);
    if (!comparison) {
      summary.innerHTML = '';
      groups.innerHTML = '<div class="bom-compare-empty-state">未找到该线束的 BOM 管理数据。</div>';
      return;
    }

    const summaryItems = [
      `线束 <strong>${escapeHtml(comparison.harnessId)}</strong>`,
      ...versionOrder.map((version) => `${escapeHtml(shortLabel(version))} Sheet <strong>${escapeHtml(comparison.sources?.[version]?.sheet || '-')}</strong>`),
      `连接器组 <strong>${comparison.summary.connectorGroupCount}</strong>`,
      `三版匹配 <strong>${comparison.summary.fullMatchCount || 0}</strong>`,
      `双版对齐 <strong>${comparison.summary.partialMatchCount || 0}</strong>`,
      ...versionOrder.map((version) => `${sourceOnlyLabel(version)} <strong>${comparison.summary.onlyCounts?.[version] || 0}</strong>`),
    ];
    if (comparison.summary.assemblyToPartsCount) {
      summaryItems.push(`总成映射 <strong>${comparison.summary.assemblyToPartsCount}</strong>`);
      summaryItems.push(`展开散件 <strong>${comparison.summary.assemblyPartCount}</strong>`);
    }

    summary.innerHTML = summaryItems.map((text) => `<span class="stat-pill">${text}</span>`).join('');

    const sourceText = versionOrder
      .map((version) => `${shortLabel(version)}：${workbookLabels[version] || bomValidation.meta?.[`${version}Workbook`] || '-'}`)
      .join('；');
    hint.textContent = [
      `来源：${sourceText}。`,
      '已对齐零件锁定在同一行，独有零件可在本版本栏内上下拖动，并借助空白行人工对位。',
      `${shortLabel(baseVersion)} 作为当前锚点版本；若后续版本同端为散件清单，会自动按该端展开映射。`,
      '当前视图按左新右旧展示，后续新增 BOM 版本会自动插到更左侧，并沿用同一套对齐机制。',
      '点击“重置对齐”可恢复系统初始排序。',
      bomViewSyncHint,
      nativeBomHintText(),
    ].join(' ');

    groups.classList.toggle('is-bom-multi-way', versionOrder.length > 2);
    groups.innerHTML = comparison.groups.map((group) => renderGroup(harnessId, group)).join('');
  }

  function renderAssemblyRootCell(model, row, index, rootVersion) {
    const mappedSummary = versionOrder
      .filter((version) => version !== rootVersion && row.partLists?.[version]?.length)
      .map((version) => `${shortLabel(version)} ${row.partLists[version].length}`)
      .join(' / ');
    return renderLaneCell(
      model.key,
      rootVersion,
      row.versions?.[rootVersion] || null,
      row,
      'assembly_bundle',
      index,
      true,
      {
        disableDrag: true,
        deltaOverride: createDelta(
          mappedSummary ? `灞曞紑 ${mappedSummary}` : '鎬绘垚鏄犲皠',
          'delta-neutral',
          `${shortLabel(rootVersion)} 该端为连接器总成，后续版本按对应端散件清单展开`,
        ),
        titleNote: `${shortLabel(rootVersion)} 该端为连接器总成，后续版本按对应端散件清单展开`,
        detailPrefix: `${shortLabel(rootVersion)}总成`,
        cardClassName: 'is-assembly-root',
      },
    );
  }

  function renderRow(model, row, index) {
    const cells = versionOrder.map((version) => {
      const parts = row.partLists?.[version] || [];
      if (parts.length) {
        return renderPartsCell(version, model.key, parts, index);
      }
      if (row.rowType === 'assembly_bundle' && row.versions?.[version]) {
        return renderAssemblyRootCell(model, row, index, version);
      }
      return renderLaneCell(
        model.key,
        version,
        row.versions?.[version] || null,
        row,
        row.statuses?.[version] || '',
        index,
        Boolean(row.locked?.[version]),
      );
    });
    return `<div class="bom-align-row${row.rowType === 'assembly_bundle' ? ' bom-align-row-assembly' : ''}">${cells.join('')}</div>`;
  }

  function renderGroup(harnessId, group) {
    const model = buildGroupModel(harnessId, group);
    const statPills = [
      ...versionOrder.map((version) => `${shortLabel(version)} <strong>${model.itemCounts?.[version] || 0}</strong>`),
      `${fullMatchLabel()} <strong>${model.fullMatchCount || 0}</strong>`,
      `${partialMatchLabel()} <strong>${model.partialMatchCount || 0}</strong>`,
      ...versionOrder.map((version) => `${sourceOnlyLabel(version)} <strong>${model.onlyCounts?.[version] || 0}</strong>`),
    ];
    if (model.assemblyToPartsCount) {
      statPills.push(`鎬绘垚鏄犲皠 <strong>${model.assemblyToPartsCount}</strong>`);
      statPills.push(`灞曞紑鏁ｄ欢 <strong>${model.assemblyPartCount}</strong>`);
    }

    return `
      <article class="bom-compare-group ${versionOrder.length > 2 ? 'is-bom-multi-way' : ''}" data-group-key="${escapeHtml(model.key)}">
        <div class="bom-compare-group-head">
          <div>
            <div class="bom-compare-group-label">${escapeHtml(model.label)}</div>
            <div class="bom-compare-group-meta">${escapeHtml(buildGroupMeta(model))}</div>
          </div>
          <div class="bom-compare-group-stats">
            ${statPills.map((text) => `<span class="stat-pill">${text}</span>`).join('')}
          </div>
        </div>
        <div class="bom-compare-body">
          <div class="bom-lane-header">
            ${versionOrder.map((version) => renderLaneColumns(version)).join('')}
          </div>
          <div class="bom-align-board">
            ${model.rows.map((row, rowIndex) => renderRow(model, row, rowIndex)).join('')}
          </div>
        </div>
      </article>
    `;
  }

  function renderHarness(harnessId) {
    const comparison = getComparison(harnessId);
    if (!comparison) {
      summary.innerHTML = '';
      groups.innerHTML = '<div class="bom-compare-empty-state">未找到该线束的 BOM 管理数据。</div>';
      return;
    }

    const summaryItems = [
      `线束 <strong>${escapeHtml(comparison.harnessId)}</strong>`,
      ...versionOrder.map((version) => `${escapeHtml(shortLabel(version))} Sheet <strong>${escapeHtml(comparison.sources?.[version]?.sheet || '-')}</strong>`),
      `连接器组 <strong>${comparison.summary.connectorGroupCount}</strong>`,
      `${fullMatchLabel()} <strong>${comparison.summary.fullMatchCount || 0}</strong>`,
      `${partialMatchLabel()} <strong>${comparison.summary.partialMatchCount || 0}</strong>`,
      ...versionOrder.map((version) => `${sourceOnlyLabel(version)} <strong>${comparison.summary.onlyCounts?.[version] || 0}</strong>`),
    ];
    if (comparison.summary.assemblyToPartsCount) {
      summaryItems.push(`总成映射 <strong>${comparison.summary.assemblyToPartsCount}</strong>`);
      summaryItems.push(`展开散件 <strong>${comparison.summary.assemblyPartCount}</strong>`);
    }

    summary.innerHTML = summaryItems.map((text) => `<span class="stat-pill">${text}</span>`).join('');

    const sourceText = versionOrder
      .map((version) => `${shortLabel(version)}：${workbookLabels[version] || bomValidation.meta?.[`${version}Workbook`] || '-'}`)
      .join('；');
    hint.textContent = [
      `来源：${sourceText}。`,
      '已对齐零件锁定在同一行，独有零件可在本版本栏内上下拖动，并借助空白行人工对位。',
      `${shortLabel(baseVersion)} 作为当前锚点版本；若任一版本同端为散件清单，会自动按该端展开映射。`,
      '当前视图按左新右旧展示，后续新增 BOM 版本会优先进入语义对比链路。',
      '点击“重置对齐”可恢复系统初始排序。',
      bomViewSyncHint,
      nativeBomHintText(),
    ].filter(Boolean).join(' ');

    groups.classList.toggle('is-bom-multi-way', versionOrder.length > 2);
    groups.innerHTML = comparison.groups.map((group) => renderGroup(harnessId, group)).join('');
  }

  function clearDropTargets() {
    groups.querySelectorAll('.is-drop-target').forEach((node) => node.classList.remove('is-drop-target'));
  }

  async function refreshViewAndRender(options = {}) {
    await syncBomValidationView({
      preserveSelection: options.preserveSelection !== false,
      harnessId: options.harnessId || select.value,
    });
    if (select.value) {
      renderHarness(select.value);
    }
  }

  syncHarnessSelect(bomValidation.harnessOrder[0]);

  openBtn.addEventListener('click', async () => {
    setModalOpen(true);
    try {
      await seedNativeBomStore();
      await refreshNativeBomStatus();
      await refreshViewAndRender({ preserveSelection: true });
    } catch (error) {
      nativeBomStatus = `原生 BOM 库初始化失败：${error.message}`;
      await refreshViewAndRender({ preserveSelection: true });
    }
  });
  closeBtn.addEventListener('click', () => setModalOpen(false));
  resetBtn.addEventListener('click', () => {
    delete manualAlignState[select.value];
    saveAlignState();
    renderHarness(select.value);
  });
  if (importBtn && importInput) {
    importBtn.addEventListener('click', async () => {
      try {
        await initNativeBomStore();
        importInput.click();
      } catch (error) {
        nativeBomStatus = `无法启动原生 BOM 库：${error.message}`;
        renderHarness(select.value);
      }
    });
    importInput.addEventListener('change', async () => {
      const file = importInput.files?.[0];
      if (!file) return;
      try {
        await seedNativeBomStore();
        const record = await window.G281BomIO.importWorkbook(file, {
          projectId: NATIVE_BOM_PROJECT_ID,
          versionId: `import-${Date.now()}`,
          versionLabel: file.name.replace(/\.[^.]+$/, ''),
          sourceType: 'uploaded-bom',
          fileName: file.name,
          workbookName: file.name.replace(/\.[^.]+$/, ''),
        });
        lastImportedVersionId = record.versionId;
        let bridgeResult = null;
        let bridgeError = null;
        try {
          bridgeResult = window.G281DashboardBridge?.importNativeBomVersion?.(record) || null;
        } catch (error) {
          bridgeError = error;
          console.error('[G281BomValidationView] Failed to mirror imported BOM into dashboard versions.', error);
        }
        const statusMessage = bridgeError
          ? `已导入 BOM：${record.versionLabel}，但加入左侧 BOM 版本失败：${bridgeError.message}`
          : bridgeResult?.versionKey
            ? `已导入 BOM：${record.versionLabel}，已加入左侧 BOM 版本并切换为当前版本`
            : `已导入 BOM：${record.versionLabel}`;
        await refreshNativeBomStatus(statusMessage);
      } catch (error) {
        nativeBomStatus = `导入失败：${error.message}`;
      } finally {
        importInput.value = '';
        await refreshViewAndRender({ preserveSelection: true });
      }
    });
  }
  if (exportBtn) {
    exportBtn.addEventListener('click', async () => {
      try {
        await seedNativeBomStore();
        await refreshNativeBomStatus();
        const exportChoice = await resolveExportVersionChoice();
        const versionId = exportChoice.versionId;
        const wantsXlsx = Boolean(window.XLSX);
        const payload = await window.G281BomIO.exportWorkbook(versionId, { format: wantsXlsx ? 'xlsx' : 'json' });
        const stamp = new Date().toISOString().replace(/[:.]/g, '-');
        if (wantsXlsx) {
          triggerDownload(`harness_bom_${versionId}_${stamp}.xlsx`, payload, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
          nativeBomStatus = exportChoice.usedFallback
            ? `已导出原生 BOM：${versionId} (XLSX)，当前版本无副本，已自动回退到 ${shortLabel(exportChoice.resolvedVersionKey || versionId)}`
            : `已导出原生 BOM：${versionId} (XLSX)`;
        } else {
          triggerDownload(`harness_bom_${versionId}_${stamp}.json`, JSON.stringify(payload, null, 2), 'application/json');
          nativeBomStatus = exportChoice.usedFallback
            ? `已导出原生 BOM：${versionId} (JSON)，当前版本无副本，已自动回退到 ${shortLabel(exportChoice.resolvedVersionKey || versionId)}`
            : `已导出原生 BOM：${versionId} (JSON)`;
        }
      } catch (error) {
        nativeBomStatus = `导出失败：${error.message}`;
      } finally {
        await refreshViewAndRender({ preserveSelection: true });
      }
    });
  }
  if (clearImportBtn) {
    clearImportBtn.addEventListener('click', async () => {
      try {
        lastImportedVersionId = '';
        await seedNativeBomStore();
        await refreshNativeBomStatus('已重新写入内置 BOM 版本，额外导入版本仍保留在原生库中');
      } catch (error) {
        nativeBomStatus = `恢复内置版本失败：${error.message}`;
      } finally {
        await refreshViewAndRender({ preserveSelection: true });
      }
    });
  }
  select.addEventListener('change', () => renderHarness(select.value));
  const dashboardVersionEventName = window.G281DashboardBridge?.getDashboardEventNames?.().versionChange || 'g281:dashboard-version-change';
  window.addEventListener(dashboardVersionEventName, (event) => {
    if (event?.detail?.group && event.detail.group !== 'bom') return;
    void refreshViewAndRender({ preserveSelection: true });
  });
  modal.addEventListener('click', (event) => {
    if (event.target && event.target.closest('[data-bom-close]')) {
      setModalOpen(false);
    }
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !modal.hidden) {
      setModalOpen(false);
    }
  });

  groups.addEventListener('dragstart', (event) => {
    const card = event.target.closest('.bom-card');
    if (!card) return;
    dragState = {
      harnessId: select.value,
      groupKey: card.dataset.groupKey,
      side: card.dataset.side,
      fromIndex: Number(card.dataset.index),
      itemKey: card.dataset.itemKey,
    };
    card.classList.add('is-dragging');
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', card.dataset.itemKey || '');
    }
  });

  groups.addEventListener('dragend', () => {
    groups.querySelectorAll('.is-dragging').forEach((node) => node.classList.remove('is-dragging'));
    dragState = null;
    clearDropTargets();
  });

  groups.addEventListener('dragover', (event) => {
    const dropZone = event.target.closest('.bom-align-cell[data-drop-zone="true"]');
    if (!dropZone || !dragState) return;
    if (dropZone.dataset.groupKey !== dragState.groupKey || dropZone.dataset.side !== dragState.side) {
      return;
    }
    event.preventDefault();
    clearDropTargets();
    dropZone.classList.add('is-drop-target');
  });

  groups.addEventListener('drop', (event) => {
    const dropZone = event.target.closest('.bom-align-cell[data-drop-zone="true"]');
    if (!dropZone || !dragState) return;
    if (dropZone.dataset.groupKey !== dragState.groupKey || dropZone.dataset.side !== dragState.side) {
      return;
    }

    event.preventDefault();
    const comparison = getComparison(dragState.harnessId);
    if (!comparison) return;
    const group = comparison.groups.find((item) => item.key === dragState.groupKey);
    if (!group) return;

    const model = buildGroupModel(dragState.harnessId, group);
    const sourceRows = dragState.side === 'quote' ? model.laneRows.quote : model.laneRows[dragState.side];
    const lockedRows = model.lockedRows[dragState.side];
    const nextRows = moveUnlockedRowItem(sourceRows, dragState.fromIndex, Number(dropZone.dataset.dropIndex), lockedRows);
    persistGroupRows(dragState.harnessId, dragState.groupKey, dragState.side, nextRows, lockedRows);
    renderHarness(dragState.harnessId);
    dragState = null;
    clearDropTargets();
  });

  void refreshViewAndRender({ preserveSelection: true });
})();
