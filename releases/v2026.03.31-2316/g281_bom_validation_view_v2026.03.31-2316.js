(function () {
  const runtime = window.G281_RUNTIME || {};
  let bomValidation = runtime.bomValidation;
  let versionOrder = Array.isArray(bomValidation?.meta?.versionOrder) ? bomValidation.meta.versionOrder.slice() : [];
  if (!bomValidation || !Array.isArray(bomValidation?.harnessOrder) || !bomValidation.harnessOrder.length || !versionOrder.length) {
    return;
  }

  const STORAGE_KEY = 'g281.bomManualAlign.v6';
  const WORKBENCH_VIEW_STORAGE_KEY = 'g281.bomWorkbenchView.v1';
  const REVIEW_STORAGE_KEY = 'g281.bomReviewFields.v1';
  const SEMANTIC_DICTIONARY_STORAGE_KEY = 'g281.bomSemanticDictionary.v1';
  const DIFF_FILTER_STORAGE_KEY = 'g281.bomSemanticDiffFilters.v1';
  const WORKBENCH_VIEWS = [
    { key: 'raw', label: '原始 BOM' },
    { key: 'standardized', label: '标准化 BOM' },
    { key: 'diff', label: '差异结果' },
    { key: 'dictionary', label: '词典与规则' },
    { key: 'review', label: '人工复核' },
  ];
  const DEFAULT_DIFF_FILTER_STATE = {
    businessCategory: 'ALL',
    diffType: 'ALL',
    riskLevel: 'ALL',
    pendingOnly: false,
  };
  const DICTIONARY_SECTION_SPECS = [
    {
      key: 'configColumns',
      title: 'CONFIG_COLUMNS',
      note: '导入列映射预置',
      columns: [
        { key: 'logicalField', label: '逻辑字段' },
        { key: 'sourceHint', label: '当前映射说明' },
      ],
      createRow: () => ({ logicalField: '', sourceHint: '' }),
    },
    {
      key: 'normalizeRows',
      title: 'DICT_NORMALIZE',
      note: '名称标准化规则',
      columns: [
        { key: 'originalName', label: '原始名称' },
        { key: 'normalizedName', label: '标准化名称' },
        { key: 'category', label: '分类' },
      ],
      createRow: () => ({ originalName: '', normalizedName: '', category: '' }),
    },
    {
      key: 'supplierRows',
      title: 'DICT_SUPPLIER',
      note: '供应商别名规则',
      columns: [
        { key: 'sourceSupplier', label: '源供应商' },
        { key: 'normalizedSupplier', label: '标准供应商' },
      ],
      createRow: () => ({ sourceSupplier: '', normalizedSupplier: '' }),
    },
    {
      key: 'seriesRows',
      title: 'DICT_SERIES',
      note: '系列抽取规则',
      columns: [
        { key: 'sourceText', label: '源文本' },
        { key: 'series', label: 'Series' },
      ],
      createRow: () => ({ sourceText: '', series: '' }),
    },
    {
      key: 'stopwordRows',
      title: 'DICT_STOPWORDS',
      note: '标准化剔除词',
      columns: [{ key: 'stopword', label: 'Stopword' }],
      createRow: () => ({ stopword: '' }),
    },
    {
      key: 'substituteRows',
      title: 'DICT_SUBSTITUTE',
      note: '替代件映射规则',
      columns: [
        { key: 'oldChildPn', label: '旧料号' },
        { key: 'oldChildName', label: '旧名称' },
        { key: 'newChildPn', label: '新料号' },
        { key: 'newChildName', label: '新名称' },
        { key: 'note', label: '备注' },
      ],
      createRow: () => ({ oldChildPn: '', oldChildName: '', newChildPn: '', newChildName: '', note: '' }),
    },
  ];
  const openBtn = document.getElementById('openBomValidationBtn');
  const closeBtn = document.getElementById('closeBomValidationBtn');
  const resetBtn = document.getElementById('resetBomValidationBtn');
  const modal = document.getElementById('bomValidationModal');
  const modalPanel = modal?.querySelector('.bom-modal-panel');
  const select = document.getElementById('bomValidationHarness');
  const leftVersionSelect = document.getElementById('bomValidationLeftVersion');
  const rightVersionSelect = document.getElementById('bomValidationRightVersion');
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
  let selectedBomVersionPair = {
    leftBomKey: '',
    rightBomKey: '',
  };
  let bomVersionPairDirty = false;

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
  const DEFAULT_HEADER_COLUMN_MAP = Object.freeze(Object.fromEntries(HEADER_KEYS.map((key, index) => [key, index])));
  const LOGICAL_FIELD_TO_PARSER_FIELD = Object.freeze({
    Child_PN: 'partNumber',
    Child_Name: 'partName',
    Qty: 'quantity',
    Unit: 'unit',
    SAP: 'wireNo',
    Supplier: 'remark',
    Function: 'function',
    Spec: 'spec',
  });
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

  STATIC_STATUS_MAP.full_match.label = '多版本匹配';
  STATIC_STATUS_MAP.partial_match.label = '双版本对齐';
  STATIC_STATUS_MAP.assembly_bundle.label = '总成映射';
  STATIC_STATUS_MAP.assembly_part.label = '散件展开';

  function fullMatchLabel() {
    return versionOrder.length <= 2 ? '双版一致' : '多版本匹配';
  }

  function partialMatchLabel() {
    return versionOrder.length <= 2 ? '单侧占位' : '双版本对齐';
  }

  function rebuildStatusMap() {
    statusMap = {
      ...STATIC_STATUS_MAP,
      full_match: { ...STATIC_STATUS_MAP.full_match, label: fullMatchLabel() },
      partial_match: { ...STATIC_STATUS_MAP.partial_match, label: partialMatchLabel() },
      replacement: { label: '替换', className: 'matched-partial' },
    };
    versionOrder.forEach((version) => {
    statusMap[`${version}_only`] = {
      label: versionOrder.length === 2
        ? (version === baseVersion ? '取消' : '新增')
        : `${shortLabel(version)}独有`,
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

  function relationOnlyLabel(version) {
    if (versionOrder.length === 2) {
      return version === baseVersion ? '取消' : '新增';
    }
    return sourceOnlyLabel(version);
  }

  function replacementLabel() {
    return '替换';
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
  let activeWorkbenchView = hasLocalStorage ? (window.localStorage.getItem(WORKBENCH_VIEW_STORAGE_KEY) || 'review') : 'review';
  let reviewFieldState = hasLocalStorage ? safeParse(window.localStorage.getItem(REVIEW_STORAGE_KEY), {}) : {};
  let semanticDictionaryState = hasLocalStorage ? safeParse(window.localStorage.getItem(SEMANTIC_DICTIONARY_STORAGE_KEY), null) : null;
  let diffFilterState = {
    ...DEFAULT_DIFF_FILTER_STATE,
    ...(hasLocalStorage ? safeParse(window.localStorage.getItem(DIFF_FILTER_STORAGE_KEY), {}) : {}),
  };
  let dictionaryDraftState = null;
  let dictionaryDraftDirty = false;
  let activeWorkbookMappingState = {};
  let semanticWorkbenchState = null;
  let workbenchTabs = null;
  let rawViewMount = null;
  let standardizedViewMount = null;
  let diffViewMount = null;
  let dictionaryViewMount = null;
  let reviewTableMount = null;
  let reviewAlignMount = null;

  const NATIVE_BOM_PROJECT_ID = 'g281-native-bom';
  const BUILTIN_BOM_KEY_BY_WORKBOOK_KEY = {
    quote: 'freeze',
    fixed: 'light',
    tt: 'regress',
  };

  function persistWorkbenchView() {
    if (!hasLocalStorage) return;
    window.localStorage.setItem(WORKBENCH_VIEW_STORAGE_KEY, activeWorkbenchView);
  }

  function persistReviewFieldState() {
    if (!hasLocalStorage) return;
    window.localStorage.setItem(REVIEW_STORAGE_KEY, JSON.stringify(reviewFieldState));
  }

  function persistSemanticDictionaryState() {
    if (!hasLocalStorage) return;
    if (!semanticDictionaryState) {
      window.localStorage.removeItem(SEMANTIC_DICTIONARY_STORAGE_KEY);
      return;
    }
    window.localStorage.setItem(SEMANTIC_DICTIONARY_STORAGE_KEY, JSON.stringify(semanticDictionaryState));
  }

  function persistDiffFilterState() {
    if (!hasLocalStorage) return;
    window.localStorage.setItem(DIFF_FILTER_STORAGE_KEY, JSON.stringify(diffFilterState));
  }

  function clonePlain(value) {
    if (value === null || value === undefined) return value;
    return JSON.parse(JSON.stringify(value));
  }

  function normalizeBoolean(value) {
    return value === true || value === 'true' || value === 1 || value === '1';
  }

  function dictionarySectionSpec(sectionKey) {
    return DICTIONARY_SECTION_SPECS.find((section) => section.key === sectionKey) || null;
  }

  function sanitizeDiffFilterState(value) {
    return {
      businessCategory: collapseText(value?.businessCategory) || 'ALL',
      diffType: collapseText(value?.diffType) || 'ALL',
      riskLevel: collapseText(value?.riskLevel) || 'ALL',
      pendingOnly: normalizeBoolean(value?.pendingOnly),
    };
  }

  diffFilterState = sanitizeDiffFilterState(diffFilterState);

  function sanitizeDictionaryRows(sectionKey, rows) {
    const spec = dictionarySectionSpec(sectionKey);
    if (!spec) return [];
    return (Array.isArray(rows) ? rows : []).map((row) => spec.columns.reduce((acc, column) => {
      acc[column.key] = collapseText(row?.[column.key]);
      return acc;
    }, {})).filter((row) => spec.columns.some((column) => collapseText(row[column.key])));
  }

  function sanitizeSemanticDictionaryState(value) {
    if (!value || typeof value !== 'object') return null;
    const next = {};
    DICTIONARY_SECTION_SPECS.forEach((section) => {
      if (Array.isArray(value[section.key])) {
        next[section.key] = sanitizeDictionaryRows(section.key, value[section.key]);
      }
    });
    return Object.keys(next).length ? next : null;
  }

  semanticDictionaryState = sanitizeSemanticDictionaryState(semanticDictionaryState);

  function buildDefaultStopwordRows() {
    return ['总成', '组件', '线束', '零件', '物料', '护套', '保护件', '材料'].map((word) => ({ stopword: word }));
  }

  function buildDefaultConfigColumns() {
    return [
      { logicalField: 'Child_PN', sourceHint: '料号 / 子件号 / Part Number' },
      { logicalField: 'Child_Name', sourceHint: '零件名称 / 子件名称' },
      { logicalField: 'Qty', sourceHint: '数量 / 单耗' },
      { logicalField: 'Unit', sourceHint: '单位' },
      { logicalField: 'SAP', sourceHint: 'SAP / 物料号' },
      { logicalField: 'Supplier', sourceHint: '供应商' },
      { logicalField: 'Function', sourceHint: '功能 / 端别 / 回路说明' },
      { logicalField: 'Spec', sourceHint: '规格 / 备注 / 线径长度描述' },
    ];
  }

  function normalizeHeaderToken(value) {
    return collapseText(value)
      .replace(/[|,:;]+/g, '')
      .toLowerCase();
  }

  function splitConfigHintTokens(value) {
    return String(value ?? '')
      .split(/[\/|,，;；\n]+/)
      .map((item) => normalizeHeaderToken(item))
      .filter(Boolean);
  }

  function parserColumnRules(dictionaryState) {
    const configRows = dictionaryRows(dictionaryState, 'configColumns').length
      ? dictionaryRows(dictionaryState, 'configColumns')
      : buildDefaultConfigColumns();
    return configRows
      .map((row) => {
        const logicalField = String(row.logicalField || '').trim();
        const parserField = LOGICAL_FIELD_TO_PARSER_FIELD[logicalField];
        if (!parserField) return null;
        const aliases = uniqueOrdered([
          normalizeHeaderToken(logicalField),
          ...splitConfigHintTokens(row.sourceHint),
        ]);
        return aliases.length ? { parserField, logicalField, aliases } : null;
      })
      .filter(Boolean);
  }

  function buildDefaultSheetColumnMap() {
    return { ...DEFAULT_HEADER_COLUMN_MAP };
  }

  function scoreHeaderCellMatch(cellToken, aliasToken) {
    if (!cellToken || !aliasToken) return 0;
    if (cellToken === aliasToken) return 4;
    if (cellToken.includes(aliasToken) || aliasToken.includes(cellToken)) return 2;
    return 0;
  }

  function resolveSheetColumnMap(sheetAccessor, dictionaryState) {
    const fallbackMap = buildDefaultSheetColumnMap();
    const rules = parserColumnRules(dictionaryState);
    if (!rules.length) {
      return {
        headerRowIndex: Number(sheetAccessor?.headerRows) || guessHeaderRows(sheetAccessor?.sheetName),
        columnMap: fallbackMap,
        matchedByRule: false,
      };
    }

    const candidateRowEnd = Math.max(
      1,
      Math.min(
        Number(sheetAccessor?.maxRow) || 0,
        (Number(sheetAccessor?.headerRows) || guessHeaderRows(sheetAccessor?.sheetName) || 4) + 4,
      ),
    );
    let bestCandidate = null;
    for (let rowIndex = 1; rowIndex <= candidateRowEnd; rowIndex += 1) {
      const rowValues = Array.isArray(sheetAccessor?.rowValues?.(rowIndex)) ? sheetAccessor.rowValues(rowIndex) : [];
      if (!rowValues.length) continue;
      const candidateMap = {};
      let matchedCount = 0;
      rules.forEach((rule) => {
        let bestScore = 0;
        let bestColumnIndex = -1;
        rowValues.forEach((value, columnIndex) => {
          const cellToken = normalizeHeaderToken(value);
          if (!cellToken) return;
          rule.aliases.forEach((aliasToken) => {
            const score = scoreHeaderCellMatch(cellToken, aliasToken);
            if (score > bestScore) {
              bestScore = score;
              bestColumnIndex = columnIndex;
            }
          });
        });
        if (bestColumnIndex >= 0) {
          candidateMap[rule.parserField] = bestColumnIndex;
          matchedCount += 1;
        }
      });
      if (!bestCandidate || matchedCount > bestCandidate.matchedCount) {
        bestCandidate = {
          rowIndex,
          columnMap: { ...fallbackMap, ...candidateMap },
          matchedCount,
        };
      }
    }

    if (!bestCandidate || bestCandidate.matchedCount < 4) {
      return {
        headerRowIndex: Number(sheetAccessor?.headerRows) || guessHeaderRows(sheetAccessor?.sheetName),
        columnMap: fallbackMap,
        matchedByRule: false,
      };
    }

    return {
      headerRowIndex: bestCandidate.rowIndex,
      columnMap: bestCandidate.columnMap,
      matchedByRule: true,
    };
  }

  function columnIndexToName(columnIndex) {
    const index = Number(columnIndex);
    if (!Number.isFinite(index) || index < 0) return '';
    let current = index + 1;
    let label = '';
    while (current > 0) {
      const remainder = (current - 1) % 26;
      label = String.fromCharCode(65 + remainder) + label;
      current = Math.floor((current - 1) / 26);
    }
    return label;
  }

  function dictionaryRows(dictionaryState, sectionKey) {
    return Array.isArray(dictionaryState?.[sectionKey]) ? dictionaryState[sectionKey] : [];
  }

  function effectiveDictionaryState(defaultDictionary) {
    const fallback = defaultDictionary || {};
    if (!semanticDictionaryState) return fallback;
    return DICTIONARY_SECTION_SPECS.reduce((acc, section) => {
      if (Object.prototype.hasOwnProperty.call(semanticDictionaryState, section.key)) {
        acc[section.key] = sanitizeDictionaryRows(section.key, semanticDictionaryState[section.key]);
      } else {
        acc[section.key] = sanitizeDictionaryRows(section.key, fallback[section.key]);
      }
      return acc;
    }, {});
  }

  function shouldResetDictionaryDraft(nextDictionaryState) {
    if (!dictionaryDraftDirty) return true;
    if (!dictionaryDraftState) return true;
    try {
      return JSON.stringify(dictionaryDraftState) !== JSON.stringify(nextDictionaryState);
    } catch (error) {
      return true;
    }
  }

  function buildWorkbenchMeta() {
    return {
      activeKey: versionOrder[0] || '',
      baseKey: baseVersion || '',
      activeLabel: versionLabels?.[versionOrder[0]] || versionOrder[0] || '',
      baseLabel: versionLabels?.[baseVersion] || baseVersion || '',
      activeWorkbook: workbookLabels?.[versionOrder[0]] || '',
      baseWorkbook: workbookLabels?.[baseVersion] || '',
    };
  }

  function rebuildSemanticWorkbenchState() {
    semanticWorkbenchState = buildSemanticWorkbenchStateFromComparisons(
      bomValidation?.comparisons || {},
      buildWorkbenchMeta(),
      semanticDictionaryState,
    );
    if (shouldResetDictionaryDraft(semanticWorkbenchState?.dictionaries || {})) {
      dictionaryDraftState = clonePlain(semanticWorkbenchState?.dictionaries || {});
      dictionaryDraftDirty = false;
    }
  }

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
      headerRows: Number.isFinite(rawSheet?.headerRows) ? rawSheet.headerRows : guessHeaderRows(sheetName || rawSheet?.sheetName || rawSheet?.name || ''),
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

  function parseSheetAccessor(sheetAccessor, dictionaryState = null) {
    const harnessId = firstDigits(sheetAccessor.sheetName) || sheetAccessor.sheetName;
    const harnessName = collapseText(sheetAccessor.rowValues(2)[4]) || harnessId;
    const resolvedColumnMap = resolveSheetColumnMap(sheetAccessor, dictionaryState);
    const columnMap = resolvedColumnMap.columnMap || buildDefaultSheetColumnMap();
    const items = [];
    let currentConnectorGroup = '';
    let blankStreak = 0;

    for (let rowIndex = Math.max((resolvedColumnMap.headerRowIndex || Number(sheetAccessor.headerRows) || 4) + 1, 5); rowIndex <= sheetAccessor.maxRow; rowIndex += 1) {
      const sourceRow = sheetAccessor.rowValues(rowIndex);
      const values = HEADER_KEYS.map((key) => sourceRow[columnMap[key] ?? DEFAULT_HEADER_COLUMN_MAP[key]] ?? null);
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
      headerRowIndex: resolvedColumnMap.headerRowIndex,
      matchedByRule: resolvedColumnMap.matchedByRule,
      columnMap,
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

  function parseWorkbookHarnesses(workbookSource, dictionaryState = null) {
    const sheetAccessors = listWorkbookSheetAccessors(workbookSource);
    if (!sheetAccessors.length) {
      return { harnessOrder: [], harnesses: {} };
    }
    const kskLookupByHarness = readKskLookupFromSheets(sheetAccessors);
    const harnesses = {};
    sheetAccessors.forEach((sheetAccessor) => {
      const harnessId = firstDigits(sheetAccessor.sheetName);
      if (!harnessId) return;
      const parsedSheet = parseSheetAccessor(sheetAccessor, dictionaryState);
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
        headerRowIndex: parsedSheet.headerRowIndex,
        matchedByRule: parsedSheet.matchedByRule,
        columnMap: parsedSheet.columnMap,
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
    const replacement = buildReplacementInfo(versions[baseKey], versions[activeKey], groupKey);
    const row = {
      itemKey: collapseText(diffRow.rowId) || `${groupKey}::${Math.random().toString(36).slice(2, 8)}`,
      rowType: diffRow.rowType === 'assembly_to_parts' ? 'assembly_bundle' : 'standard',
      versions,
      partLists,
      relationType: replacement?.type || '',
      relationSummary: replacement?.detail || '',
      relationTitle: replacement?.title || '',
      relationDeltaText: replacement?.deltaText || '',
    };
    row.matchState = rowMatchStateDynamic(row, sourceKeys);
    row.sourceCount = rowSourceCountDynamic(row, sourceKeys);
    return row;
  }

  function buildSemanticGroup(group = {}, activeKey, baseKey) {
    const sourceKeys = [activeKey, baseKey];
    const groupKey = semanticGroupKey(group, group.rows?.[0] || {});
    const rows = pairPotentialReplacementRows(
      (group.rows || []).map((row) => buildSemanticAlignedRow(row, activeKey, baseKey, groupKey)),
      sourceKeys,
      baseKey,
      groupKey,
    );
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
      key: groupKey,
      label: collapseText(group.label) || resolveGroupLabel(groupKey),
      section: groupSection(groupKey),
      itemCounts,
      matchedCount: stats.matched,
      fullMatchCount: stats.fullMatch,
      partialMatchCount: stats.partialMatch,
      replacementCount: stats.replacementCount,
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
      grouped[normalized.key].replacementCount += normalized.replacementCount || 0;
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
          sheet: harness.rightHeader?.originSheetName || harness.rightHeader?.sheetName || '-',
          itemCount: groups.reduce((sum, group) => sum + (Number(group.itemCounts?.[activeKey]) || 0), 0),
        },
        [baseKey]: {
          label: baseLabel,
          sheet: harness.leftHeader?.originSheetName || harness.leftHeader?.sheetName || '-',
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

  function listAvailableBomVersions() {
    const bridge = window.G281DashboardBridge;
    const versionEntries = bridge?.listBomVersions?.();
    return Array.isArray(versionEntries)
      ? versionEntries.filter((entry) => entry?.key)
      : [];
  }

  function bomVersionSelectLabel(entry = {}) {
    return collapseText(entry.label)
      || collapseText(versionLabels[entry.key])
      || collapseText(entry.key);
  }

  function defaultBomVersionPair(versionEntries = listAvailableBomVersions()) {
    const bridge = window.G281DashboardBridge;
    const validKeys = versionEntries.map((entry) => entry.key).filter(Boolean);
    if (!validKeys.length) {
      return { leftBomKey: '', rightBomKey: '' };
    }

    const activeBomKey = bridge?.getActiveBomVersionKey?.() || bridge?.getStateSnapshot?.()?.bom || validKeys[0];
    const activeOption = bridge?.getBomVersionOption?.(activeBomKey) || null;
    const inferredBaseBomKey = inferBaseBomKey(activeBomKey, activeOption, versionEntries, bridge);
    const leftBomKey = validKeys.includes(activeBomKey) ? activeBomKey : validKeys[0];
    let rightBomKey = validKeys.includes(inferredBaseBomKey) ? inferredBaseBomKey : '';
    if (!rightBomKey || rightBomKey === leftBomKey) {
      rightBomKey = validKeys.find((key) => key !== leftBomKey) || leftBomKey;
    }

    return { leftBomKey, rightBomKey };
  }

  function resolveBomVersionPair(requestedPair = {}, versionEntries = listAvailableBomVersions()) {
    const validKeys = versionEntries.map((entry) => entry.key).filter(Boolean);
    if (!validKeys.length) {
      return { leftBomKey: '', rightBomKey: '' };
    }

    const defaultPair = defaultBomVersionPair(versionEntries);
    const basePair = bomVersionPairDirty ? selectedBomVersionPair : defaultPair;
    let leftBomKey = validKeys.includes(requestedPair.leftBomKey)
      ? requestedPair.leftBomKey
      : (validKeys.includes(basePair.leftBomKey) ? basePair.leftBomKey : defaultPair.leftBomKey);
    let rightBomKey = validKeys.includes(requestedPair.rightBomKey)
      ? requestedPair.rightBomKey
      : (validKeys.includes(basePair.rightBomKey) ? basePair.rightBomKey : defaultPair.rightBomKey);

    if (!leftBomKey) {
      leftBomKey = defaultPair.leftBomKey || validKeys[0];
    }
    if (!rightBomKey) {
      rightBomKey = defaultPair.rightBomKey || validKeys.find((key) => key !== leftBomKey) || leftBomKey;
    }
    if (validKeys.length > 1 && leftBomKey === rightBomKey) {
      rightBomKey = validKeys.find((key) => key !== leftBomKey) || rightBomKey;
    }

    return { leftBomKey, rightBomKey };
  }

  function syncBomVersionSelectors(versionEntries = listAvailableBomVersions()) {
    if (!leftVersionSelect || !rightVersionSelect) {
      return selectedBomVersionPair;
    }

    const nextPair = resolveBomVersionPair({}, versionEntries);
    const optionMarkup = versionEntries.map((entry) => {
      const label = bomVersionSelectLabel(entry);
      return `<option value="${escapeHtml(entry.key)}">${escapeHtml(label || entry.key)}</option>`;
    }).join('');

    leftVersionSelect.innerHTML = optionMarkup;
    rightVersionSelect.innerHTML = optionMarkup;
    leftVersionSelect.disabled = versionEntries.length <= 1;
    rightVersionSelect.disabled = versionEntries.length <= 1;
    if (nextPair.leftBomKey) {
      leftVersionSelect.value = nextPair.leftBomKey;
    }
    if (nextPair.rightBomKey) {
      rightVersionSelect.value = nextPair.rightBomKey;
    }
    selectedBomVersionPair = nextPair;
    return nextPair;
  }

  function updateSelectedBomVersionPair(changedSide, nextKey) {
    const versionEntries = listAvailableBomVersions();
    const previousPair = resolveBomVersionPair({}, versionEntries);
    const nextPair = {
      leftBomKey: changedSide === 'leftBomKey' ? nextKey : previousPair.leftBomKey,
      rightBomKey: changedSide === 'rightBomKey' ? nextKey : previousPair.rightBomKey,
    };

    if (versionEntries.length > 1 && nextPair.leftBomKey === nextPair.rightBomKey) {
      const oppositeSide = changedSide === 'leftBomKey' ? 'rightBomKey' : 'leftBomKey';
      const swapKey = previousPair[changedSide];
      nextPair[oppositeSide] = swapKey && swapKey !== nextKey
        ? swapKey
        : (versionEntries.find((entry) => entry.key !== nextKey)?.key || nextKey);
    }

    bomVersionPairDirty = true;
    selectedBomVersionPair = resolveBomVersionPair(nextPair, versionEntries);
    syncBomVersionSelectors(versionEntries);
    return selectedBomVersionPair;
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

  function joinedValues(values = []) {
    return uniqueStrings(values).map((value) => collapseText(value)).filter(Boolean).join(' / ');
  }

  function joinedIdentity(values = []) {
    return uniqueStrings(values).map((value) => normalizeKey(value)).filter(Boolean).join('|');
  }

  function itemTextPool(item = {}) {
    return [
      item?.partNumber,
      item?.partName,
      ...(Array.isArray(item?.functions) ? item.functions : []),
      ...(Array.isArray(item?.remarks) ? item.remarks : []),
      ...(Array.isArray(item?.otherRemarks) ? item.otherRemarks : []),
    ].map((value) => collapseText(value)).filter(Boolean).join(' | ').replace(/²/g, '2').toUpperCase();
  }

  function normalizeGauge(raw = '') {
    const number = Number(String(raw).replace(/[^0-9.]/g, ''));
    if (!Number.isFinite(number)) return '';
    return `${Math.abs(number - Math.round(number)) < 1e-9 ? Math.round(number) : number}平方`;
  }

  function detectWireGauge(text) {
    const match = /(\d+(?:\.\d+)?)\s*(?:MM2|MM²|㎟|平方|方|SQ(?:MM)?)/i.exec(text || '');
    return match ? normalizeGauge(match[1]) : '';
  }

  function detectWireConductor(text) {
    const source = String(text || '');
    if (/(?:导体|CONDUCTOR).{0,8}(?:铜包铝|CCA)|(?:铜包铝|CCA).{0,8}(?:导体|CONDUCTOR)/i.test(source)) return '铜包铝';
    if (/(?:导体|CONDUCTOR).{0,8}铜|镀锡铜|裸铜/i.test(source)) return '铜';
    if (/(?:导体|CONDUCTOR).{0,8}铝|铝导体/i.test(source)) return '铝';
    if (/铜包铝|CCA/i.test(source)) return '铜包铝';
    if (/镀锡铜|铜/i.test(source)) return '铜';
    if (/铝/i.test(source)) return '铝';
    return '';
  }

  function detectShielding(text) {
    const source = String(text || '');
    if (/无屏蔽|非屏蔽|UNSHIELDED/i.test(source)) return '无屏蔽';
    if (/屏蔽|SHIELD/i.test(source)) return '屏蔽';
    return '';
  }

  function detectShieldMaterial(text) {
    const source = String(text || '');
    if (/屏蔽.{0,8}(?:铜包铝|CCA)|(?:铜包铝|CCA).{0,8}屏蔽/i.test(source)) return '铜包铝';
    if (/屏蔽.{0,8}(?:镀锡铜|铜)|(?:镀锡铜|铜).{0,8}屏蔽/i.test(source)) return '铜';
    if (/屏蔽.{0,8}铝|铝.{0,8}屏蔽/i.test(source)) return '铝';
    return '';
  }

  function detectSheathMaterial(text) {
    const source = String(text || '').toUpperCase();
    const candidates = [
      ['XLPE', 'XLPE'],
      ['PVC', 'PVC'],
      ['TPE', 'TPE'],
      ['TPU', 'TPU'],
      ['PE', 'PE'],
      ['PP', 'PP'],
      ['PUR', 'PUR'],
      ['交联聚乙烯', '交联聚乙烯'],
      ['聚氯乙烯', '聚氯乙烯'],
      ['聚烯烃', '聚烯烃'],
      ['硅胶', '硅胶'],
    ];
    const matched = candidates.find(([token]) => source.includes(token));
    return matched ? matched[1] : '';
  }

  function detectCoreSpec(text) {
    const source = String(text || '');
    if (/单芯|(^|[^0-9])1芯/i.test(source)) return '单芯';
    const match = /(\d+)\s*芯/.exec(source);
    if (match) {
      return Number(match[1]) === 1 ? '单芯' : `${match[1]}芯`;
    }
    if (/多芯/i.test(source)) return '多芯';
    return '';
  }

  function buildWireTraits(item = {}) {
    const text = itemTextPool(item);
    return {
      gauge: detectWireGauge(text),
      conductor: detectWireConductor(text),
      shielding: detectShielding(text),
      shieldMaterial: detectShieldMaterial(text),
      sheath: detectSheathMaterial(text),
      core: detectCoreSpec(text),
    };
  }

  function appendChange(changes, label, leftValue, rightValue) {
    const leftText = collapseText(leftValue);
    const rightText = collapseText(rightValue);
    if ((leftText || '') === (rightText || '')) return;
    changes.push(`${label}:${leftText || '-'}→${rightText || '-'}`);
  }

  function buildReplacementInfo(baseItem, activeItem, groupKey) {
    if (!baseItem || !activeItem) return null;
    const changes = [];
    const basePart = normalizeKey(baseItem.partNumber);
    const activePart = normalizeKey(activeItem.partNumber);
    const baseSap = joinedIdentity(baseItem.sapNos);
    const activeSap = joinedIdentity(activeItem.sapNos);
    const isWire = groupKey === 'wires' || baseItem.kind === 'wire' || activeItem.kind === 'wire';

    if (isWire) {
      const baseTraits = buildWireTraits(baseItem);
      const activeTraits = buildWireTraits(activeItem);
      appendChange(changes, '线径', baseTraits.gauge, activeTraits.gauge);
      appendChange(changes, '导体', baseTraits.conductor, activeTraits.conductor);
      appendChange(changes, '屏蔽', baseTraits.shielding, activeTraits.shielding);
      appendChange(changes, '屏蔽材质', baseTraits.shieldMaterial, activeTraits.shieldMaterial);
      appendChange(changes, '外皮', baseTraits.sheath, activeTraits.sheath);
      appendChange(changes, '芯数', baseTraits.core, activeTraits.core);
    }

    if (basePart && activePart && basePart !== activePart) {
      changes.push(`料号:${baseItem.partNumber || '-'}→${activeItem.partNumber || '-'}`);
    }
    if (baseSap && activeSap && baseSap !== activeSap) {
      changes.push(`SAP:${joinedValues(baseItem.sapNos)}→${joinedValues(activeItem.sapNos)}`);
    }
    if (!changes.length) {
      return null;
    }

    const detail = changes.slice(0, 3).join(' / ');
    const shortText = (changes[0] || '').replace(/^[^:：]+[:：]/, '') || '替换';
    return {
      type: 'replacement',
      detail,
      title: `替换差异：${changes.join('；')}`,
      deltaText: shortText.length > 18 ? '替换' : shortText,
    };
  }

  function escapeRegExpLiteral(value) {
    return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function onlySourceKeyForRow(row, sourceKeys) {
    const presentSources = sourceKeys.filter((sourceKey) => rowPresenceForSource(row, sourceKey));
    return presentSources.length === 1 ? presentSources[0] : '';
  }

  function overlapCount(leftValues = [], rightValues = []) {
    const rightSet = new Set(uniqueStrings(rightValues).map((value) => normalizeKey(value)).filter(Boolean));
    return uniqueStrings(leftValues).reduce((count, value) => (
      rightSet.has(normalizeKey(value)) ? count + 1 : count
    ), 0);
  }

  function normalizeReplacementDescriptor(item = {}) {
    let text = itemTextPool(item);
    [
      item.partNumber,
      ...(Array.isArray(item.sapNos) ? item.sapNos : []),
      ...(Array.isArray(item.wireNos) ? item.wireNos : []),
    ].forEach((value) => {
      const token = collapseText(value);
      if (!token) return;
      text = text.replace(new RegExp(escapeRegExpLiteral(token), 'ig'), ' ');
    });
    return normalizeKey(
      text
        .replace(/(\d+(?:\.\d+)?)\s*(?:MM2|MM²|㎟|平方|方|SQ(?:MM)?|AWG)/gi, ' ')
        .replace(/(\d+)\s*(?:P|PIN|WAY|孔|芯)/gi, ' ')
        .replace(/(?:L\s*=)?(\d+(?:\.\d+)?)\s*(?:MM|CM|M)/gi, ' ')
        .replace(/[×*]/g, 'X')
        .replace(/[^0-9A-Z\u4E00-\u9FFF]+/gi, ' ')
    );
  }

  function descriptorAffinity(leftItem, rightItem) {
    const left = normalizeReplacementDescriptor(leftItem);
    const right = normalizeReplacementDescriptor(rightItem);
    if (!left || !right) return 0;
    if (left === right) return 24;
    if (left.includes(right) || right.includes(left)) return 18;
    const prefixLength = sharedPrefixLength(left, right);
    if (prefixLength >= 18) return 18;
    if (prefixLength >= 12) return 12;
    if (prefixLength >= 8) return 6;
    return 0;
  }

  function partNumberAffinity(leftValue, rightValue) {
    const left = cleanedPartCode(leftValue);
    const right = cleanedPartCode(rightValue);
    if (!left || !right) return 0;
    if (left === right) return 20;
    if (left.includes(right) || right.includes(left)) return 8;
    const prefixLength = sharedPrefixLength(left, right);
    if (prefixLength >= 8) return 14;
    if (prefixLength >= 6) return 10;
    if (prefixLength >= 4) return 6;
    return 0;
  }

  function scoreWireReplacement(baseItem, activeItem, groupKey) {
    const isWire = groupKey === 'wires' || baseItem?.kind === 'wire' || activeItem?.kind === 'wire';
    if (!isWire || !baseItem || !activeItem) return null;
    const replacement = buildReplacementInfo(baseItem, activeItem, groupKey);
    if (!replacement) return null;

    const baseTraits = buildWireTraits(baseItem);
    const activeTraits = buildWireTraits(activeItem);
    let score = 0;
    let conflictCount = 0;

    const compareTrait = (leftValue, rightValue, matchScore, diffPenalty = matchScore) => {
      const left = normalizeKey(leftValue);
      const right = normalizeKey(rightValue);
      if (!left || !right) return;
      if (left === right) {
        score += matchScore;
      } else {
        score -= diffPenalty;
        conflictCount += 1;
      }
    };

    compareTrait(baseTraits.conductor, activeTraits.conductor, 20, 16);
    compareTrait(baseTraits.shielding, activeTraits.shielding, 18, 20);
    compareTrait(baseTraits.shieldMaterial, activeTraits.shieldMaterial, 14, 12);
    compareTrait(baseTraits.sheath, activeTraits.sheath, 12, 10);
    compareTrait(baseTraits.core, activeTraits.core, 12, 10);

    const baseGauge = normalizeKey(baseTraits.gauge);
    const activeGauge = normalizeKey(activeTraits.gauge);
    if (baseGauge && activeGauge) {
      score += baseGauge === activeGauge ? 12 : 6;
    }

    const wireNoMatches = overlapCount(baseItem.wireNos, activeItem.wireNos);
    const functionMatches = overlapCount(baseItem.functions, activeItem.functions);
    const supplierMatches = overlapCount(baseItem.suppliers, activeItem.suppliers);
    const assemblyMatches = overlapCount(baseItem.assemblyRefs, activeItem.assemblyRefs);
    const descriptorScore = descriptorAffinity(baseItem, activeItem);
    const partScore = partNumberAffinity(baseItem.partNumber, activeItem.partNumber);

    score += wireNoMatches ? 30 : 0;
    score += Math.min(functionMatches, 2) * 8;
    score += Math.min(supplierMatches, 1) * 6;
    score += Math.min(assemblyMatches, 1) * 8;
    score += descriptorScore + partScore;

    const baseQty = numericValue(baseItem.quantity);
    const activeQty = numericValue(activeItem.quantity);
    if (baseQty !== null && activeQty !== null && baseQty === activeQty) {
      score += 4;
    }

    const anchorScore = (wireNoMatches ? 30 : 0)
      + (Math.min(functionMatches, 2) * 8)
      + (Math.min(assemblyMatches, 1) * 8)
      + descriptorScore
      + partScore;

    if (anchorScore < 12) return null;
    if (conflictCount >= 2 && anchorScore < 24) return null;
    if (score < 28) return null;

    return {
      score,
      replacement,
    };
  }

  function buildReplacementRow(baseRow, activeRow, sourceKeys, replacementInfo) {
    const versions = initVersionDict(sourceKeys, null);
    const partLists = initVersionDict(sourceKeys, []);
    sourceKeys.forEach((sourceKey) => {
      versions[sourceKey] = rowItem(baseRow, sourceKey) || rowItem(activeRow, sourceKey) || null;
      partLists[sourceKey] = [
        ...rowParts(baseRow, sourceKey),
        ...rowParts(activeRow, sourceKey),
      ];
    });
    const nextRow = {
      itemKey: `${baseRow.itemKey || 'base'}::${activeRow.itemKey || 'active'}`,
      rowType: 'standard',
      versions,
      partLists,
      relationType: replacementInfo?.type || '',
      relationSummary: replacementInfo?.detail || '',
      relationTitle: replacementInfo?.title || '',
      relationDeltaText: replacementInfo?.deltaText || '',
    };
    nextRow.matchState = rowMatchStateDynamic(nextRow, sourceKeys);
    nextRow.sourceCount = rowSourceCountDynamic(nextRow, sourceKeys);
    return nextRow;
  }

  function pairPotentialReplacementRows(rows, sourceKeys, baseSourceKey, groupKey) {
    if (!Array.isArray(rows) || rows.length < 2 || sourceKeys.length !== 2 || groupKey !== 'wires') {
      return Array.isArray(rows) ? rows : [];
    }

    const activeSourceKey = sourceKeys.find((sourceKey) => sourceKey !== baseSourceKey);
    if (!activeSourceKey) return rows;

    const baseCandidates = [];
    const activeCandidates = [];
    rows.forEach((row, index) => {
      if (!row || row.rowType !== 'standard') return;
      const onlySourceKey = onlySourceKeyForRow(row, sourceKeys);
      if (onlySourceKey === baseSourceKey && rowItem(row, baseSourceKey)) {
        baseCandidates.push({ index, row });
      } else if (onlySourceKey === activeSourceKey && rowItem(row, activeSourceKey)) {
        activeCandidates.push({ index, row });
      }
    });

    if (!baseCandidates.length || !activeCandidates.length) {
      return rows;
    }

    const scoreMatrix = [];
    const scoresByBase = new Map();
    const scoresByActive = new Map();

    baseCandidates.forEach((baseEntry) => {
      activeCandidates.forEach((activeEntry) => {
        const scored = scoreWireReplacement(
          rowItem(baseEntry.row, baseSourceKey),
          rowItem(activeEntry.row, activeSourceKey),
          groupKey,
        );
        if (!scored) return;
        scoreMatrix.push({
          baseIndex: baseEntry.index,
          activeIndex: activeEntry.index,
          score: scored.score,
          replacement: scored.replacement,
        });
        if (!scoresByBase.has(baseEntry.index)) scoresByBase.set(baseEntry.index, []);
        if (!scoresByActive.has(activeEntry.index)) scoresByActive.set(activeEntry.index, []);
        scoresByBase.get(baseEntry.index).push(scored.score);
        scoresByActive.get(activeEntry.index).push(scored.score);
      });
    });

    if (!scoreMatrix.length) {
      return rows;
    }

    scoreMatrix.sort((left, right) => right.score - left.score || left.baseIndex - right.baseIndex || left.activeIndex - right.activeIndex);
    scoresByBase.forEach((scores) => scores.sort((left, right) => right - left));
    scoresByActive.forEach((scores) => scores.sort((left, right) => right - left));

    const usedBase = new Set();
    const usedActive = new Set();
    const pairedRows = new Map();
    const consumedIndexes = new Set();

    scoreMatrix.forEach((candidate) => {
      if (usedBase.has(candidate.baseIndex) || usedActive.has(candidate.activeIndex)) return;
      const baseScores = scoresByBase.get(candidate.baseIndex) || [];
      const activeScores = scoresByActive.get(candidate.activeIndex) || [];
      const baseMargin = baseScores.length > 1 ? candidate.score - baseScores[1] : candidate.score;
      const activeMargin = activeScores.length > 1 ? candidate.score - activeScores[1] : candidate.score;
      if (baseMargin < 4 && activeMargin < 4) return;

      pairedRows.set(
        candidate.baseIndex,
        buildReplacementRow(rows[candidate.baseIndex], rows[candidate.activeIndex], sourceKeys, candidate.replacement),
      );
      consumedIndexes.add(candidate.baseIndex);
      consumedIndexes.add(candidate.activeIndex);
      usedBase.add(candidate.baseIndex);
      usedActive.add(candidate.activeIndex);
    });

    if (!pairedRows.size) {
      return rows;
    }

    return rows.reduce((acc, row, index) => {
      if (pairedRows.has(index)) {
        acc.push(pairedRows.get(index));
      }
      if (!consumedIndexes.has(index)) {
        acc.push(row);
      }
      return acc;
    }, []);
  }

  function rowMatchStateDynamic(row, sourceKeys) {
    const sourceCount = rowSourceCountDynamic(row, sourceKeys);
    if (row?.rowType === 'assembly_bundle') return 'assembly_bundle';
    if (row?.relationType === 'replacement') return 'replacement';
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
      } else if (stateKey === 'replacement') {
        stats.replacementCount += 1;
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
      replacementCount: 0,
      onlyCounts: sourceKeys.reduce((acc, sourceKey) => ({ ...acc, [sourceKey]: 0 }), {}),
      assemblyToParts: 0,
      assemblyPartCount: 0,
    });
  }

  function buildDynamicGroupView(groupKey, groupItems, sourceKeys, baseSourceKey) {
    const initialRows = pairPotentialReplacementRows(
      buildInitialRows(groupItems, sourceKeys, baseSourceKey),
      sourceKeys,
      baseSourceKey,
      groupKey,
    );
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
      replacementCount: stats.replacementCount,
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
      replacementCount: groups.reduce((sum, group) => sum + (Number(group.replacementCount) || 0), 0),
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
      activeWorkbookMappingState: {},
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
    if (versionOrder.length === 2) {
      selectedBomVersionPair = {
        leftBomKey: versionOrder[0] || '',
        rightBomKey: baseVersion || versionOrder[1] || '',
      };
    }
    bomViewSyncHint = viewState.syncHint || '';
    activeWorkbookMappingState = viewState.activeWorkbookMappingState || {};
    rebuildSemanticWorkbenchState();
    rebuildStatusMap();
    ensureWorkbenchShell();
    activeWorkbenchView = sanitizeWorkbenchView(activeWorkbenchView);
    renderActiveWorkbenchPanel();
    syncHarnessSelect(preferredHarnessId);
    syncBomVersionSelectors();
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

  async function buildRuntimeBomValidationView(options = {}) {
    const bridge = window.G281DashboardBridge;
    const versionEntries = listAvailableBomVersions();
    const resolvedPair = resolveBomVersionPair(options, versionEntries);
    const activeBomKey = resolvedPair.leftBomKey;
    const baseBomKey = resolvedPair.rightBomKey;
    const activeOption = bridge?.getBomVersionOption?.(activeBomKey) || null;
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
          const parsedActiveWorkbook = activeWorkbookSource?.workbookSource
            ? parseWorkbookHarnesses(activeWorkbookSource.workbookSource, semanticDictionaryState)
            : { harnessOrder: [], harnesses: {} };
          const semanticActiveWorkbookMappingState = Object.fromEntries(
            Object.entries(parsedActiveWorkbook.harnesses || {}).map(([harnessId, harness]) => [harnessId, {
              label: activeOption?.label || activeBomKey,
              sheetName: harness?.sheetName || '',
              headerRowIndex: harness?.headerRowIndex || null,
              matchedByRule: Boolean(harness?.matchedByRule),
              columnMap: harness?.columnMap || null,
            }]),
          );
          const semanticViewState = buildSemanticBomValidationViewState(diffPayload, {
            activeKey: activeBomKey,
            baseKey: baseBomKey,
            activeLabel: activeOption?.label || activeBomKey,
            baseLabel: baseOption?.label || baseBomKey,
            activeWorkbook: activeOption?.source || activeOption?.workbook || activeWorkbookSource?.workbookName || activeBomKey,
            baseWorkbook: baseOption?.source || baseOption?.workbook || baseWorkbookSource?.workbookName || baseBomKey,
          });
          semanticViewState.activeWorkbookMappingState = semanticActiveWorkbookMappingState;
          semanticViewState.syncHint = `BOM 管理已切换为语义 diff 对比，当前显示 ${activeOption?.label || activeBomKey} vs ${baseOption?.label || baseBomKey}。`;
          semanticViewState.syncHint = `BOM 管理已切换为语义 diff 对比，当前显示 ${activeOption?.label || activeBomKey} vs ${baseOption?.label || baseBomKey}。`;
          return semanticViewState;
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

    const parsed = parseWorkbookHarnesses(resolvedSource.workbookSource, semanticDictionaryState);
    if (!parsed.harnessOrder.length) {
      return buildSeedViewState(`当前 BOM 版本 ${activeOption.label || activeBomKey} 未解析到线束页签，BOM 管理暂时继续按内置 ${shortLabel(activeWorkbookVersionKey)} 对比视图显示。`);
    }

    const activeWorkbookMappingState = Object.fromEntries(
      Object.entries(parsed.harnesses || {}).map(([harnessId, harness]) => [harnessId, {
        label: activeLaneLabel,
        sheetName: harness?.sheetName || '',
        headerRowIndex: harness?.headerRowIndex || null,
        matchedByRule: Boolean(harness?.matchedByRule),
        columnMap: harness?.columnMap || null,
      }]),
    );

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
            headerRowIndex: sourceKey === activeLaneKey
              ? (activeHarness?.headerRowIndex || null)
              : (seedComparison?.sources?.[sourceKey]?.headerRowIndex || null),
            matchedByRule: sourceKey === activeLaneKey
              ? Boolean(activeHarness?.matchedByRule)
              : Boolean(seedComparison?.sources?.[sourceKey]?.matchedByRule),
            columnMap: sourceKey === activeLaneKey
              ? (activeHarness?.columnMap || null)
              : (seedComparison?.sources?.[sourceKey]?.columnMap || null),
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
      activeWorkbookMappingState,
      syncHint: `BOM 管理已同步到当前左侧 BOM 版本：${activeOption.label || activeBomKey}。`,
    };
  }

  async function syncBomValidationView(options = {}) {
    const token = ++bomSyncToken;
    const preferredHarnessId = options.preserveSelection ? (options.harnessId || select.value) : '';
    const versionEntries = listAvailableBomVersions();
    selectedBomVersionPair = resolveBomVersionPair({
      leftBomKey: options.leftBomKey,
      rightBomKey: options.rightBomKey,
    }, versionEntries);
    try {
      const nextView = await buildRuntimeBomValidationView(selectedBomVersionPair);
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
      modal.classList.add('is-window-maximized');
      modalPanel?.classList.add('is-window-maximized');
      window.requestAnimationFrame(() => select.focus());
      return;
    }

    modal.hidden = true;
    modal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('bom-modal-open');
    modal.classList.remove('is-window-maximized');
    modalPanel?.classList.remove('is-window-maximized');
    if (lastFocused && typeof lastFocused.focus === 'function') {
      lastFocused.focus();
    }
  }

  function getComparison(harnessId) {
    return bomValidation.comparisons[harnessId] || null;
  }

  function sanitizeWorkbenchView(viewKey) {
    return WORKBENCH_VIEWS.some((view) => view.key === viewKey) ? viewKey : 'review';
  }

  function normalizeSemanticKeyText(value) {
    return collapseText(value)
      .replace(/[\s\-_/\\()（）【】[\]，,。.;；:：]/g, '')
      .toUpperCase();
  }

  function normalizeSemanticDisplayName(value) {
    const source = collapseText(value);
    if (!source) return '';
    return source
      .replace(/\bASSY\b/gi, '总成')
      .replace(/\bCONN(?:ECTOR)?\b/gi, '连接器')
      .replace(/\bTERM(?:INAL)?\b/gi, '端子')
      .replace(/\bWIRE\b/gi, '导线')
      .replace(/\bCABLE\b/gi, '电缆');
  }

  function buildNormalizedName(value) {
    const stopWords = ['总成', '组件', '线束', '零件', '物料', '护套', '保护件', '材料'];
    let text = normalizeSemanticKeyText(value);
    stopWords.forEach((word) => {
      text = text.replace(new RegExp(normalizeSemanticKeyText(word), 'g'), '');
    });
    return text || normalizeSemanticDisplayName(value);
  }

  function extractFirstMatch(text, expression, groupIndex = 1) {
    const match = expression.exec(String(text || ''));
    return match?.[groupIndex] ? collapseText(match[groupIndex]) : '';
  }

  function detectWorkbenchWireSize(text) {
    const match = /(\d+(?:\.\d+)?)\s*(?:MM2|MM²|SQMM|SQ|平方)/i.exec(String(text || ''));
    return match ? `${match[1]}mm²` : '';
  }

  function detectWorkbenchPoleCount(text) {
    const match = /(\d+)\s*(?:P|PIN|WAY|孔位|孔)/i.exec(String(text || ''));
    return match ? `${match[1]}P` : '';
  }

  function detectWorkbenchLength(text, quantity, unit) {
    const inline = /(?:L\s*=\s*)?(\d+(?:\.\d+)?)\s*(MM|CM|M)\b/i.exec(String(text || ''));
    if (inline) return `${inline[1]}${String(inline[2]).toUpperCase()}`;
    const qtyValue = numericValue(quantity);
    const qtyUnit = collapseText(unit).toUpperCase();
    if (qtyValue !== null && ['MM', 'CM', 'M'].includes(qtyUnit)) {
      return `${qtyValue}${qtyUnit}`;
    }
    return '';
  }

  function detectWorkbenchShielding(text) {
    const source = String(text || '').toUpperCase();
    if (/UNSHIELD|非屏蔽|无屏蔽/.test(source)) return '非屏蔽';
    if (/SHIELD|屏蔽/.test(source)) return '屏蔽';
    return '';
  }

  function detectWorkbenchWaterproof(text) {
    const source = String(text || '').toUpperCase();
    if (/UNSEALED|非防水|非密封/.test(source)) return '非防水';
    if (/SEALED|WATERPROOF|防水|密封/.test(source)) return '防水';
    return '';
  }

  function detectWorkbenchAngle(text) {
    return extractFirstMatch(text, /(180°|90°|45°|直角|弯头)/i, 1);
  }

  function detectWorkbenchVoltage(text) {
    return extractFirstMatch(text, /(\d+(?:\.\d+)?)\s*(?:V|KV)\b/i, 0).toUpperCase();
  }

  function detectWorkbenchTemperature(text) {
    return extractFirstMatch(text, /(-?\d+(?:\.\d+)?)\s*°?\s*C/i, 0).toUpperCase();
  }

  function detectWorkbenchColor(text) {
    return extractFirstMatch(text, /(黑|白|灰|红|黄|蓝|绿|棕|橙|紫|粉|BLACK|WHITE|GRAY|GREY|RED|YELLOW|BLUE|GREEN|BROWN|ORANGE|PURPLE|PINK)/i, 1);
  }

  function detectWorkbenchSeries(partNumber, name) {
    return extractFirstMatch(`${partNumber || ''} ${name || ''}`, /([A-Z]{1,5}[-_]?\d{2,})/i, 1)
      || extractFirstMatch(partNumber, /^([A-Z]{2,}[-_]?[A-Z0-9]+)/i, 1)
      || '';
  }

  function buildNormalizedName(value, dictionaryState) {
    const normalizedSource = normalizeSemanticKeyText(value);
    const explicitRule = dictionaryRows(dictionaryState, 'normalizeRows').find((row) => (
      normalizedSource && normalizeSemanticKeyText(row.originalName) === normalizedSource
    ));
    if (explicitRule?.normalizedName) {
      return collapseText(explicitRule.normalizedName);
    }

    let text = normalizedSource;
    const stopWords = dictionaryRows(dictionaryState, 'stopwordRows').length
      ? dictionaryRows(dictionaryState, 'stopwordRows').map((row) => row.stopword)
      : buildDefaultStopwordRows().map((row) => row.stopword);
    stopWords.forEach((word) => {
      const normalizedWord = normalizeSemanticKeyText(word);
      if (!normalizedWord) return;
      text = text.replace(new RegExp(escapeRegExpLiteral(normalizedWord), 'g'), '');
    });
    return text || normalizeSemanticDisplayName(value);
  }

  function resolveWorkbenchSupplier(value, dictionaryState) {
    const normalizedSource = normalizeSemanticKeyText(value);
    const explicitRule = dictionaryRows(dictionaryState, 'supplierRows').find((row) => (
      normalizedSource && normalizeSemanticKeyText(row.sourceSupplier || row.supplier) === normalizedSource
    ));
    return collapseText(explicitRule?.normalizedSupplier || explicitRule?.supplier || value);
  }

  function resolveWorkbenchSeries(partNumber, name, dictionaryState) {
    const composed = joinedValues([partNumber, name]);
    const normalizedSource = normalizeSemanticKeyText(composed);
    const explicitRule = dictionaryRows(dictionaryState, 'seriesRows').find((row) => {
      const sourceToken = normalizeSemanticKeyText(row.sourceText || row.series);
      return sourceToken && (normalizedSource.includes(sourceToken) || normalizeSemanticKeyText(partNumber).includes(sourceToken));
    });
    return collapseText(explicitRule?.series) || detectWorkbenchSeries(partNumber, name);
  }

  function matchWorkbenchSubstituteRule(baseItem, activeItem, dictionaryState) {
    const leftPn = normalizeSemanticKeyText(baseItem?.partNumber);
    const leftName = normalizeSemanticKeyText(baseItem?.partName);
    const rightPn = normalizeSemanticKeyText(activeItem?.partNumber);
    const rightName = normalizeSemanticKeyText(activeItem?.partName);
    return dictionaryRows(dictionaryState, 'substituteRows').find((row) => {
      const oldPn = normalizeSemanticKeyText(row.oldChildPn);
      const oldName = normalizeSemanticKeyText(row.oldChildName);
      const newPn = normalizeSemanticKeyText(row.newChildPn);
      const newName = normalizeSemanticKeyText(row.newChildName);
      const leftMatched = (oldPn && oldPn === leftPn) || (!oldPn && oldName && oldName === leftName);
      const rightMatched = (newPn && newPn === rightPn) || (!newPn && newName && newName === rightName);
      return leftMatched && rightMatched;
    }) || null;
  }

  function resolveBusinessCategory(kind, groupKey) {
    if (kind === 'wire' || groupKey === 'wires') return 'CABLE';
    if (kind === 'connector' || groupSection(groupKey) === 'connector') return 'CONNECTOR';
    if (groupKey === 'sync_brackets') return 'FASTENER';
    if (groupKey === 'sync_rubber' || groupKey === 'materials') return 'PROTECTION';
    return 'OTHER';
  }

  function buildWorkbenchReviewKey(row, index) {
    return [
      collapseText(row.harnessNo),
      collapseText(row.groupKey),
      collapseText(row.diffType),
      normalizeKey(row.oldChildPn || row.leftPartNo || ''),
      normalizeKey(row.newChildPn || row.rightPartNo || ''),
      String(index),
    ].join('::');
  }

  function estimateWorkbenchSimilarity(leftText, rightText) {
    const left = normalizeSemanticKeyText(leftText);
    const right = normalizeSemanticKeyText(rightText);
    if (!left && !right) return 1;
    if (!left || !right) return 0;
    if (left === right) return 1;
    const leftSet = new Set(left.split(''));
    const rightSet = new Set(right.split(''));
    const union = new Set([...leftSet, ...rightSet]);
    let overlap = 0;
    leftSet.forEach((token) => {
      if (rightSet.has(token)) overlap += 1;
    });
    return union.size ? Number((overlap / union.size).toFixed(2)) : 0;
  }

  function buildWorkbenchRawRow(comparison, group, sourceKey, item, row, rowIndex, partIndex = -1) {
    const sheetLabel = comparison.sources?.[sourceKey]?.sheet || '-';
    return {
      harnessId: comparison.harnessId,
      harnessName: comparison.harnessName,
      sourceKey,
      sourceLabel: shortLabel(sourceKey),
      sourceSheet: sheetLabel,
      groupKey: group.key,
      groupLabel: group.label,
      rowType: row.rowType || 'standard',
      rowIndex,
      isAssemblyPart: partIndex >= 0,
      partNumber: collapseText(item.partNumber),
      partName: collapseText(item.partName),
      sapNo: displayList(item.sapNos),
      quantity: item.quantity,
      unit: collapseText(item.unit),
      functionText: displayList(item.functions),
      specText: displayList(item.remarks),
      otherRemark: displayList(item.otherRemarks),
      supplier: displayList(item.suppliers),
      assemblyRef: displayList(item.assemblyRefs),
      itemKey: item.itemKey,
    };
  }

  function buildWorkbenchStandardizedRow(comparison, group, sourceKey, item, row, rowIndex, partIndex = -1, dictionaryState = null) {
    const composedText = joinedValues(
      item.partNumber,
      item.partName,
      item.sapNos,
      item.functions,
      item.remarks,
      item.otherRemarks,
      item.assemblyRefs,
    );
    const normalizedName = buildNormalizedName(item.partName || item.partNumber, dictionaryState);
    const wireSize = detectWorkbenchWireSize(composedText);
    const poleCount = detectWorkbenchPoleCount(composedText);
    const length = detectWorkbenchLength(composedText, item.quantity, item.unit);
    const supplier = resolveWorkbenchSupplier(displayList(item.suppliers), dictionaryState);
    const series = resolveWorkbenchSeries(item.partNumber, item.partName, dictionaryState);
    const category = String(item.kind || group.section || 'other').toUpperCase();
    return {
      harnessId: comparison.harnessId,
      harnessName: comparison.harnessName,
      sourceKey,
      sourceLabel: shortLabel(sourceKey),
      groupKey: group.key,
      groupLabel: group.label,
      rowType: row.rowType || 'standard',
      rowIndex,
      isAssemblyPart: partIndex >= 0,
      originalName: collapseText(item.partName),
      partNumber: collapseText(item.partNumber),
      sapNo: displayList(item.sapNos),
      normalizedName,
      category,
      businessCategory: resolveBusinessCategory(item.kind, group.key),
      supplier,
      series,
      poleCount,
      wireSize,
      length,
      angle: detectWorkbenchAngle(composedText),
      shielding: detectWorkbenchShielding(composedText),
      waterproof: detectWorkbenchWaterproof(composedText),
      color: detectWorkbenchColor(composedText),
      voltage: detectWorkbenchVoltage(composedText),
      temperature: detectWorkbenchTemperature(composedText),
      mainKey: [
        normalizeKey(group.key),
        normalizeKey(normalizedName),
        normalizeKey(wireSize),
        normalizeKey(poleCount),
        normalizeKey(length),
        normalizeKey(displayList(item.sapNos)),
      ].filter(Boolean).join('|'),
      backupKey: [
        normalizeKey(group.key),
        normalizeKey(item.partNumber),
        normalizeKey(series),
        normalizeKey(supplier),
      ].filter(Boolean).join('|'),
    };
  }

  function flattenWorkbenchRows(comparisons = {}, dictionaryState = null) {
    const rawRows = [];
    const standardizedRows = [];
    Object.values(comparisons).forEach((comparison) => {
      (comparison.groups || []).forEach((group) => {
        (group.aligned || []).forEach((row, rowIndex) => {
          (comparison.versionOrder || []).forEach((sourceKey) => {
            const directItem = row.versions?.[sourceKey];
            if (directItem) {
              rawRows.push(buildWorkbenchRawRow(comparison, group, sourceKey, directItem, row, rowIndex));
              standardizedRows.push(buildWorkbenchStandardizedRow(comparison, group, sourceKey, directItem, row, rowIndex, -1, dictionaryState));
            }
            rowParts(row, sourceKey).forEach((partItem, partIndex) => {
              rawRows.push(buildWorkbenchRawRow(comparison, group, sourceKey, partItem, row, rowIndex, partIndex));
              standardizedRows.push(buildWorkbenchStandardizedRow(comparison, group, sourceKey, partItem, row, rowIndex, partIndex, dictionaryState));
            });
          });
        });
      });
    });
    return { rawRows, standardizedRows };
  }

  function inferWorkbenchDiffType(row, sourceKeys, groupKey, dictionaryState = null) {
    const baseKey = sourceKeys[1] || sourceKeys[0];
    const activeKey = sourceKeys[0];
    const baseItem = rowItem(row, baseKey);
    const activeItem = rowItem(row, activeKey);
    const baseParts = rowParts(row, baseKey);
    const activeParts = rowParts(row, activeKey);
    if (row.rowType === 'assembly_bundle' || baseParts.length || activeParts.length) return 'ASSEMBLY_TO_PARTS';
    if (!baseItem && activeItem) return 'ADDED';
    if (baseItem && !activeItem) return 'REMOVED';
    if (!baseItem || !activeItem) return 'POSSIBLE_SUBSTITUTE';
    if (matchWorkbenchSubstituteRule(baseItem, activeItem, dictionaryState)) return 'POSSIBLE_SUBSTITUTE';
    const baseQty = numericValue(baseItem.quantity);
    const activeQty = numericValue(activeItem.quantity);
    if (baseQty !== null && activeQty !== null && baseQty !== activeQty) return 'QTY_CHANGED';
    const relation = collapseText(row.relationSummary);
    if (/线径/.test(relation)) return 'WIRE_SIZE_CHANGED';
    if (/长度/.test(relation)) return 'LENGTH_CHANGED';
    if (/孔位/.test(relation)) return 'POLE_COUNT_CHANGED';
    if (/屏蔽/.test(relation)) return 'SHIELDING_CHANGED';
    if (normalizeKey(baseItem.partNumber) === normalizeKey(activeItem.partNumber) || normalizeKey(displayList(baseItem.sapNos)) === normalizeKey(displayList(activeItem.sapNos))) {
      if (normalizeSemanticKeyText(baseItem.partName) !== normalizeSemanticKeyText(activeItem.partName)) return 'SAME_SPEC_RENAMED';
      return 'SAME';
    }
    if (buildNormalizedName(baseItem.partName || baseItem.partNumber, dictionaryState)
      && buildNormalizedName(baseItem.partName || baseItem.partNumber, dictionaryState) === buildNormalizedName(activeItem.partName || activeItem.partNumber, dictionaryState)) {
      return 'SAME_SPEC_RENAMED';
    }
    return groupKey === 'wires' ? 'POSSIBLE_SUBSTITUTE' : 'SPEC_CHANGED';
  }

  function inferWorkbenchRiskLevel(diffType) {
    if (['WIRE_SIZE_CHANGED', 'LENGTH_CHANGED', 'POLE_COUNT_CHANGED', 'SHIELDING_CHANGED', 'SPEC_CHANGED'].includes(diffType)) return 'High';
    if (['POSSIBLE_SUBSTITUTE', 'ASSEMBLY_TO_PARTS', 'ADDED', 'REMOVED'].includes(diffType)) return 'Medium';
    return 'Low';
  }

  function buildWorkbenchDiffRows(comparisons = {}, dictionaryState = null) {
    const rows = [];
    Object.values(comparisons).forEach((comparison) => {
      const sourceKeys = comparison.versionOrder || [];
      (comparison.groups || []).forEach((group) => {
        (group.aligned || []).forEach((row, rowIndex) => {
          const baseItem = rowItem(row, sourceKeys[1] || sourceKeys[0]);
          const activeItem = rowItem(row, sourceKeys[0]);
          const substituteRule = matchWorkbenchSubstituteRule(baseItem, activeItem, dictionaryState);
          const diffType = inferWorkbenchDiffType(row, sourceKeys, group.key, dictionaryState);
          const diffRow = {
            harnessNo: comparison.harnessId,
            harnessName: comparison.harnessName,
            groupKey: group.key,
            groupLabel: group.label,
            businessCategory: resolveBusinessCategory(baseItem?.kind || activeItem?.kind, group.key),
            diffType,
            changeDetail: [
              collapseText(row.relationSummary || row.relationTitle || row.relationDeltaText || ''),
              substituteRule?.note ? `替代件规则：${collapseText(substituteRule.note)}` : '',
            ].filter(Boolean).join(' | '),
            oldChildPn: collapseText(baseItem?.partNumber),
            oldChildName: collapseText(baseItem?.partName),
            oldQty: baseItem?.quantity ?? null,
            oldMainKey: collapseText(baseItem?.itemKey),
            oldNormalizedName: buildNormalizedName(baseItem?.partName || baseItem?.partNumber, dictionaryState),
            newChildPn: collapseText(activeItem?.partNumber),
            newChildName: collapseText(activeItem?.partName),
            newQty: activeItem?.quantity ?? null,
            newMainKey: collapseText(activeItem?.itemKey),
            newNormalizedName: buildNormalizedName(activeItem?.partName || activeItem?.partNumber, dictionaryState),
            similarity: estimateWorkbenchSimilarity(
              `${baseItem?.partNumber || ''} ${baseItem?.partName || ''}`,
              `${activeItem?.partNumber || ''} ${activeItem?.partName || ''}`,
            ),
            riskLevel: inferWorkbenchRiskLevel(diffType),
            matchBasis: substituteRule ? 'DICT_SUBSTITUTE' : 'AUTO',
            rowIndex,
          };
          diffRow.reviewKey = buildWorkbenchReviewKey(diffRow, rows.length);
          rows.push(diffRow);
        });
      });
    });
    return rows;
  }

  function buildWorkbenchDictionaries(standardizedRows = [], diffRows = []) {
    const normalizeRows = [];
    const seenNormalize = new Set();
    standardizedRows.forEach((row) => {
      const key = `${normalizeKey(row.originalName)}::${normalizeKey(row.normalizedName)}`;
      if (!row.originalName || !row.normalizedName || seenNormalize.has(key)) return;
      seenNormalize.add(key);
      normalizeRows.push({
        originalName: row.originalName,
        normalizedName: row.normalizedName,
        category: row.category,
      });
    });

    const supplierRows = uniqueOrdered(standardizedRows.map((row) => collapseText(row.supplier)).filter(Boolean)).map((supplier) => ({
      sourceSupplier: supplier,
      normalizedSupplier: supplier,
    }));
    const seriesRows = uniqueOrdered(standardizedRows.map((row) => `${collapseText(row.partNumber)}|${collapseText(row.series)}`).filter((value) => /\|/.test(value))).map((value) => {
      const [sourceText, series] = value.split('|');
      return {
        sourceText,
        series,
      };
    }).filter((row) => row.sourceText || row.series);
    const substituteRows = diffRows
      .filter((row) => ['POSSIBLE_SUBSTITUTE', 'SPEC_CHANGED', 'SAME_SPEC_RENAMED'].includes(row.diffType))
      .map((row) => ({
        oldChildPn: row.oldChildPn,
        oldChildName: row.oldChildName,
        newChildPn: row.newChildPn,
        newChildName: row.newChildName,
        note: row.diffType,
      }));

    return {
      configColumns: [
        { logicalField: 'Child_PN', sourceHint: '料号 / 子件号 / Part Number' },
        { logicalField: 'Child_Name', sourceHint: '零件名称 / 子件名称' },
        { logicalField: 'Qty', sourceHint: '数量 / 单耗' },
        { logicalField: 'Unit', sourceHint: '单位' },
        { logicalField: 'SAP', sourceHint: 'SAP / 物料号' },
        { logicalField: 'Supplier', sourceHint: '供应商' },
        { logicalField: 'Function', sourceHint: '功能 / 端别 / 回路说明' },
        { logicalField: 'Spec', sourceHint: '规格 / 备注 / 线径长度描述' },
      ],
      normalizeRows,
      supplierRows,
      seriesRows,
      stopwordRows: ['总成', '组件', '线束', '零件', '物料', '护套', '保护件', '材料'].map((word) => ({ stopword: word })),
      substituteRows,
    };
  }

  function buildSemanticWorkbenchStateFromComparisons(comparisons = {}, meta = {}, dictionaryState = null) {
    const { rawRows, standardizedRows } = flattenWorkbenchRows(comparisons, dictionaryState);
    const diffRows = buildWorkbenchDiffRows(comparisons, dictionaryState);
    const defaultDictionaries = buildWorkbenchDictionaries(standardizedRows, diffRows);
    return {
      meta,
      rawRows,
      standardizedRows,
      diffRows,
      dictionaries: effectiveDictionaryState(defaultDictionaries),
    };
  }

  function applyReviewStateToRows(rows = []) {
    return rows.map((row) => ({
      ...row,
      ...(reviewFieldState[row.reviewKey] || {}),
    }));
  }

  function ensureWorkbenchShell() {
    if (workbenchTabs && rawViewMount && diffViewMount && reviewAlignMount) return;
    const shell = document.createElement('section');
    shell.className = 'bom-workbench-shell';
    shell.innerHTML = `
      <div class="bom-workbench-tabs" id="bomWorkbenchTabs" role="tablist" aria-label="BOM 管理视图切换">
        ${WORKBENCH_VIEWS.map((view) => `
          <button type="button" class="bom-workbench-tab" data-bom-view="${view.key}" role="tab" aria-selected="false">
            ${view.label}
          </button>
        `).join('')}
      </div>
      <div class="bom-workbench-panels">
        <section class="bom-workbench-panel" data-bom-view-panel="raw" hidden><div class="bom-workbench-view" id="bomRawView"></div></section>
        <section class="bom-workbench-panel" data-bom-view-panel="standardized" hidden><div class="bom-workbench-view" id="bomStandardizedView"></div></section>
        <section class="bom-workbench-panel" data-bom-view-panel="diff" hidden><div class="bom-workbench-view" id="bomDiffView"></div></section>
        <section class="bom-workbench-panel" data-bom-view-panel="dictionary" hidden><div class="bom-workbench-view" id="bomDictionaryView"></div></section>
        <section class="bom-workbench-panel" data-bom-view-panel="review" hidden>
          <div class="bom-workbench-view bom-review-view">
            <div class="bom-review-align-wrap">
              <div class="bom-review-align-head">
                <div>
                  <strong>手工对位覆盖层</strong>
                  <span>拖动只作为人工复核覆盖，不再作为主语义对齐机制。</span>
                </div>
              </div>
              <div class="bom-review-align-mount" id="bomReviewAlignMount"></div>
            </div>
            <div class="bom-review-table-wrap" id="bomReviewTable"></div>
          </div>
        </section>
      </div>
    `.trim();
    groups.parentElement.insertBefore(shell, groups);
    workbenchTabs = shell.querySelector('#bomWorkbenchTabs');
    rawViewMount = shell.querySelector('#bomRawView');
    standardizedViewMount = shell.querySelector('#bomStandardizedView');
    diffViewMount = shell.querySelector('#bomDiffView');
    dictionaryViewMount = shell.querySelector('#bomDictionaryView');
    reviewTableMount = shell.querySelector('#bomReviewTable');
    reviewAlignMount = shell.querySelector('#bomReviewAlignMount');
    reviewAlignMount.appendChild(groups);

    workbenchTabs.addEventListener('click', (event) => {
      const button = event.target.closest('[data-bom-view]');
      if (!button) return;
      activeWorkbenchView = sanitizeWorkbenchView(button.dataset.bomView);
      persistWorkbenchView();
      renderActiveWorkbenchPanel();
    });
    diffViewMount.addEventListener('change', handleDiffFilterInput);
    diffViewMount.addEventListener('click', handleDiffWorkbenchAction);
    dictionaryViewMount.addEventListener('input', handleDictionaryDraftInput);
    dictionaryViewMount.addEventListener('click', handleDictionaryWorkbenchAction);
    reviewTableMount.addEventListener('input', handleReviewFieldInput);
    reviewTableMount.addEventListener('change', handleReviewFieldInput);
  }

  function renderSimpleWorkbenchTable(columns, rows, emptyText = '当前无数据。') {
    if (!rows.length) {
      return `<div class="bom-workbench-empty">${escapeHtml(emptyText)}</div>`;
    }
    return `
      <div class="bom-workbench-table-wrap">
        <table class="bom-workbench-table">
          <thead>
            <tr>${columns.map((column) => `<th>${escapeHtml(column.label)}</th>`).join('')}</tr>
          </thead>
          <tbody>
            ${rows.map((row) => `
              <tr>
                ${columns.map((column) => `<td>${escapeHtml(String(typeof column.render === 'function' ? column.render(row) : (row[column.key] ?? '-')))}</td>`).join('')}
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  function buildReviewInputValue(row, field) {
    const value = row[field];
    return value === null || value === undefined ? '' : String(value);
  }

  function handleReviewFieldInput(event) {
    const field = event.target?.dataset?.reviewField;
    const reviewKey = event.target?.dataset?.reviewKey;
    if (!field || !reviewKey) return;
    if (!reviewFieldState[reviewKey]) reviewFieldState[reviewKey] = {};
    reviewFieldState[reviewKey][field] = event.target.value;
    persistReviewFieldState();
    if (activeWorkbenchView === 'diff') {
      renderDiffWorkbenchView(select.value);
    }
  }

  function isPendingReviewRow(row) {
    const result = collapseText(row.reviewResult);
    return !result || result === '待复核';
  }

  function collectDiffFilterOptions(rows = []) {
    return {
      businessCategories: uniqueOrdered(rows.map((row) => collapseText(row.businessCategory)).filter(Boolean)),
      diffTypes: uniqueOrdered(rows.map((row) => collapseText(row.diffType)).filter(Boolean)),
      riskLevels: uniqueOrdered(rows.map((row) => collapseText(row.riskLevel)).filter(Boolean)),
    };
  }

  function filterWorkbenchDiffRows(rows = []) {
    const filters = sanitizeDiffFilterState(diffFilterState);
    return rows.filter((row) => row.diffType !== 'SAME').filter((row) => {
      if (filters.businessCategory !== 'ALL' && collapseText(row.businessCategory) !== filters.businessCategory) return false;
      if (filters.diffType !== 'ALL' && collapseText(row.diffType) !== filters.diffType) return false;
      if (filters.riskLevel !== 'ALL' && collapseText(row.riskLevel) !== filters.riskLevel) return false;
      if (filters.pendingOnly && !isPendingReviewRow(row)) return false;
      return true;
    });
  }

  function handleDiffFilterInput(event) {
    const field = event.target?.dataset?.diffFilter;
    if (!field) return;
    diffFilterState = sanitizeDiffFilterState({
      ...diffFilterState,
      [field]: field === 'pendingOnly' ? event.target.checked : event.target.value,
    });
    persistDiffFilterState();
    renderDiffWorkbenchView(select.value);
  }

  function classifyDiffExportSheet(row) {
    const namePool = `${row.oldChildName || ''} ${row.newChildName || ''}`;
    if (/端子|TERMINAL/i.test(namePool)) return 'TERMINAL_DIFF';
    if (row.businessCategory === 'CONNECTOR') return 'CONNECTOR_DIFF';
    if (row.businessCategory === 'CABLE') return 'CABLE_DIFF';
    if (row.businessCategory === 'PROTECTION') return 'PROTECTION_DIFF';
    if (row.businessCategory === 'FASTENER') return 'FASTENER_DIFF';
    return 'OTHER_DIFF';
  }

  function buildDiffExportRow(row) {
    return {
      Harness_No: row.harnessNo,
      Harness_Name: row.harnessName,
      Group_Key: row.groupKey,
      Group_Label: row.groupLabel,
      Business_Category: row.businessCategory,
      Diff_Type: row.diffType,
      Change_Detail: row.changeDetail,
      Old_Child_PN: row.oldChildPn,
      Old_Child_Name: row.oldChildName,
      Old_Normalized_Name: row.oldNormalizedName,
      Old_Qty: row.oldQty,
      New_Child_PN: row.newChildPn,
      New_Child_Name: row.newChildName,
      New_Normalized_Name: row.newNormalizedName,
      New_Qty: row.newQty,
      Similarity: row.similarity,
      Match_Basis: row.matchBasis,
      Risk_Level: row.riskLevel,
      Review_Result: row.reviewResult || '',
      Final_Judgement: row.finalJudgement || '',
      Owner: row.owner || '',
      Due_Date: row.dueDate || '',
      Comment: row.comment || '',
    };
  }

  function exportCurrentWorkbenchDiff(harnessId) {
    const rawRows = applyReviewStateToRows(rowsForHarness(semanticWorkbenchState?.diffRows || [], harnessId));
    const diffRows = filterWorkbenchDiffRows(rawRows);
    const activeLabel = semanticWorkbenchState?.meta?.activeLabel || shortLabel(versionOrder[0] || '');
    const baseLabel = semanticWorkbenchState?.meta?.baseLabel || shortLabel(baseVersion || '');
    const summaryRows = [
      { Metric: 'Harness_No', Value: harnessId },
      { Metric: 'Harness_Name', Value: getComparison(harnessId)?.harnessName || '' },
      { Metric: 'Active_Version', Value: activeLabel },
      { Metric: 'Base_Version', Value: baseLabel },
      { Metric: 'Diff_Total', Value: diffRows.length },
      { Metric: 'High_Risk', Value: diffRows.filter((row) => row.riskLevel === 'High').length },
      { Metric: 'Pending_Review', Value: diffRows.filter((row) => isPendingReviewRow(row)).length },
      { Metric: 'Exported_At', Value: new Date().toISOString() },
    ];
    const exportRows = diffRows.map(buildDiffExportRow);
    const groupedRows = exportRows.reduce((acc, row, index) => {
      const sheetName = classifyDiffExportSheet(diffRows[index]);
      if (!acc[sheetName]) acc[sheetName] = [];
      acc[sheetName].push(row);
      return acc;
    }, {});
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filenameBase = `bom_semantic_diff_${harnessId}_${stamp}`;

    if (window.XLSX?.utils?.book_new) {
      const workbook = window.XLSX.utils.book_new();
      window.XLSX.utils.book_append_sheet(workbook, window.XLSX.utils.json_to_sheet(summaryRows), 'SUMMARY');
      window.XLSX.utils.book_append_sheet(workbook, window.XLSX.utils.json_to_sheet(exportRows), 'DIFF_RESULT');
      ['CONNECTOR_DIFF', 'TERMINAL_DIFF', 'CABLE_DIFF', 'PROTECTION_DIFF', 'FASTENER_DIFF', 'OTHER_DIFF'].forEach((sheetName) => {
        const rows = groupedRows[sheetName] || [];
        window.XLSX.utils.book_append_sheet(workbook, window.XLSX.utils.json_to_sheet(rows), sheetName);
      });
      const payload = window.XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
      triggerDownload(`${filenameBase}.xlsx`, payload, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      return;
    }

    triggerDownload(`${filenameBase}.json`, JSON.stringify({
      summary: summaryRows,
      diffResult: exportRows,
      categorized: groupedRows,
    }, null, 2), 'application/json');
  }

  function handleDiffWorkbenchAction(event) {
    const resetButton = event.target.closest('[data-diff-filter-reset]');
    if (resetButton) {
      diffFilterState = { ...DEFAULT_DIFF_FILTER_STATE };
      persistDiffFilterState();
      renderDiffWorkbenchView(select.value);
      return;
    }
    const exportButton = event.target.closest('[data-diff-export]');
    if (exportButton) {
      exportCurrentWorkbenchDiff(select.value);
    }
  }

  function ensureDictionaryDraftState() {
    if (!dictionaryDraftState) {
      dictionaryDraftState = clonePlain(semanticWorkbenchState?.dictionaries || {});
      dictionaryDraftDirty = false;
    }
    DICTIONARY_SECTION_SPECS.forEach((section) => {
      if (!Array.isArray(dictionaryDraftState[section.key])) {
        dictionaryDraftState[section.key] = [];
      }
    });
  }

  function handleDictionaryDraftInput(event) {
    const sectionKey = event.target?.dataset?.dictSection;
    const rowIndex = Number(event.target?.dataset?.dictRowIndex);
    const field = event.target?.dataset?.dictField;
    if (!sectionKey || !field || !Number.isInteger(rowIndex) || rowIndex < 0) return;
    ensureDictionaryDraftState();
    if (!dictionaryDraftState[sectionKey]?.[rowIndex]) return;
    dictionaryDraftState[sectionKey][rowIndex][field] = event.target.value;
    dictionaryDraftDirty = true;
  }

  async function applyDictionaryDraftState() {
    ensureDictionaryDraftState();
    semanticDictionaryState = sanitizeSemanticDictionaryState(dictionaryDraftState);
    persistSemanticDictionaryState();
    dictionaryDraftState = clonePlain(semanticDictionaryState || {});
    dictionaryDraftDirty = false;
    await refreshViewAndRender({ preserveSelection: true, harnessId: select.value });
  }

  async function resetDictionaryDraftState() {
    semanticDictionaryState = null;
    persistSemanticDictionaryState();
    dictionaryDraftState = null;
    dictionaryDraftDirty = false;
    await refreshViewAndRender({ preserveSelection: true, harnessId: select.value });
  }

  function handleDictionaryWorkbenchAction(event) {
    const addButton = event.target.closest('[data-dict-add-row]');
    if (addButton) {
      ensureDictionaryDraftState();
      const sectionKey = addButton.dataset.dictAddRow;
      const spec = dictionarySectionSpec(sectionKey);
      if (!spec) return;
      dictionaryDraftState[sectionKey].push(spec.createRow());
      dictionaryDraftDirty = true;
      renderDictionaryWorkbenchView();
      return;
    }

    const deleteButton = event.target.closest('[data-dict-delete-row]');
    if (deleteButton) {
      ensureDictionaryDraftState();
      const sectionKey = deleteButton.dataset.dictDeleteRow;
      const rowIndex = Number(deleteButton.dataset.dictRowIndex);
      if (!Number.isInteger(rowIndex) || rowIndex < 0) return;
      dictionaryDraftState[sectionKey] = (dictionaryDraftState[sectionKey] || []).filter((_, index) => index !== rowIndex);
      dictionaryDraftDirty = true;
      renderDictionaryWorkbenchView();
      return;
    }

    if (event.target.closest('[data-dict-apply]')) {
      applyDictionaryDraftState();
      return;
    }

    if (event.target.closest('[data-dict-reset]')) {
      resetDictionaryDraftState();
    }
  }

  function renderDictionaryTable(section, rows) {
    return `
      <div class="bom-workbench-table-wrap">
        <table class="bom-workbench-table bom-dictionary-table">
          <thead>
            <tr>
              ${section.columns.map((column) => `<th>${escapeHtml(column.label)}</th>`).join('')}
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            ${rows.length ? rows.map((row, rowIndex) => `
              <tr>
                ${section.columns.map((column) => `
                  <td>
                    <input
                      type="text"
                      value="${escapeHtml(row[column.key] || '')}"
                      data-dict-section="${escapeHtml(section.key)}"
                      data-dict-row-index="${rowIndex}"
                      data-dict-field="${escapeHtml(column.key)}"
                    />
                  </td>
                `).join('')}
                <td class="bom-dictionary-row-action-cell">
                  <button type="button" class="bom-inline-button danger" data-dict-delete-row="${escapeHtml(section.key)}" data-dict-row-index="${rowIndex}">删除</button>
                </td>
              </tr>
            `).join('') : `
              <tr>
                <td colspan="${section.columns.length + 1}">
                  <div class="bom-workbench-empty">当前没有规则，可直接新增行。</div>
                </td>
              </tr>
            `}
          </tbody>
        </table>
      </div>
    `;
  }

  function renderActiveColumnMappingCard(harnessId) {
    const comparison = getComparison(harnessId);
    const activeKey = semanticWorkbenchState?.meta?.activeKey || versionOrder[0] || '';
    const source = activeWorkbookMappingState?.[harnessId]
      || comparison?.sources?.[activeKey]
      || Object.values(comparison?.sources || {}).find((item) => item?.columnMap)
      || null;
    if (!source?.columnMap) return '';

    const fieldOrder = ['function', 'partNumber', 'partName', 'wireNo', 'spec', 'quantity', 'unit', 'remark'];
    const logicalLabelByField = {
      function: 'Function',
      partNumber: 'Child_PN',
      partName: 'Child_Name',
      wireNo: 'SAP',
      spec: 'Spec',
      quantity: 'Qty',
      unit: 'Unit',
      remark: 'Supplier',
    };

    return `
      <article class="bom-dictionary-card bom-column-map-card">
        <div class="bom-dictionary-card-head">
          <div>
            <strong>当前线束列映射</strong>
            <span>${escapeHtml(source.label || activeKey || '')} · 表头行 ${source.headerRowIndex || '-'} · ${source.matchedByRule ? '已按 CONFIG_COLUMNS 命中' : '未命中规则，回退固定列位'}</span>
          </div>
        </div>
        <div class="bom-column-map-grid">
          ${fieldOrder.map((fieldKey) => `
            <div class="bom-column-map-item">
              <span>${escapeHtml(logicalLabelByField[fieldKey] || fieldKey)}</span>
              <strong>${escapeHtml(columnIndexToName(source.columnMap[fieldKey]))}</strong>
            </div>
          `).join('')}
        </div>
      </article>
    `;
  }

  function renderActiveWorkbenchPanel() {
    const nextView = sanitizeWorkbenchView(activeWorkbenchView);
    if (workbenchTabs) {
      workbenchTabs.querySelectorAll('[data-bom-view]').forEach((button) => {
        const isActive = button.dataset.bomView === nextView;
        button.classList.toggle('is-active', isActive);
        button.setAttribute('aria-selected', isActive ? 'true' : 'false');
      });
    }
    modal.querySelectorAll('[data-bom-view-panel]').forEach((panel) => {
      const isActive = panel.dataset.bomViewPanel === nextView;
      panel.hidden = !isActive;
      panel.classList.toggle('is-active', isActive);
    });
  }

  function rowsForHarness(rows, harnessId) {
    return (Array.isArray(rows) ? rows : []).filter((row) => collapseText(row.harnessId || row.harnessNo) === collapseText(harnessId));
  }

  function renderWorkbenchSummaryCards(diffRows) {
    const changedRows = diffRows.filter((row) => row.diffType !== 'SAME');
    const specChangedCount = changedRows.filter((row) => ['SPEC_CHANGED', 'WIRE_SIZE_CHANGED', 'LENGTH_CHANGED', 'POLE_COUNT_CHANGED', 'SHIELDING_CHANGED'].includes(row.diffType)).length;
    const qtyChangedCount = changedRows.filter((row) => row.diffType === 'QTY_CHANGED').length;
    const substituteCount = changedRows.filter((row) => row.diffType === 'POSSIBLE_SUBSTITUTE').length;
    const highRiskCount = changedRows.filter((row) => row.riskLevel === 'High').length;
    return `
      <div class="bom-workbench-summary-cards">
        <article class="bom-workbench-summary-card"><span>总差异数</span><strong>${changedRows.length}</strong></article>
        <article class="bom-workbench-summary-card"><span>规格变化</span><strong>${specChangedCount}</strong></article>
        <article class="bom-workbench-summary-card"><span>数量变化</span><strong>${qtyChangedCount}</strong></article>
        <article class="bom-workbench-summary-card"><span>替代件候选</span><strong>${substituteCount}</strong></article>
        <article class="bom-workbench-summary-card"><span>高风险</span><strong>${highRiskCount}</strong></article>
      </div>
    `;
  }

  function renderRawWorkbenchView(harnessId) {
    if (!rawViewMount) return;
    const rawRows = rowsForHarness(semanticWorkbenchState?.rawRows || [], harnessId);
    const columns = [
      { label: '版本', key: 'sourceLabel' },
      { label: '组别', key: 'groupLabel' },
      { label: '料号', key: 'partNumber' },
      { label: '名称', key: 'partName' },
      { label: 'SAP', key: 'sapNo' },
      { label: '数量', render: (row) => row.quantity === null || row.quantity === undefined ? '-' : String(row.quantity) },
      { label: '单位', key: 'unit' },
      { label: '供应商', key: 'supplier' },
      { label: '功能/端别', key: 'functionText' },
      { label: '规格/备注', render: (row) => [row.specText, row.otherRemark].filter(Boolean).join(' | ') || '-' },
      { label: 'Sheet', key: 'sourceSheet' },
    ];
    rawViewMount.innerHTML = renderSimpleWorkbenchTable(columns, rawRows, '当前线束暂无原始 BOM 行。');
  }

  function renderStandardizedWorkbenchView(harnessId) {
    if (!standardizedViewMount) return;
    const standardizedRows = rowsForHarness(semanticWorkbenchState?.standardizedRows || [], harnessId);
    const columns = [
      { label: '版本', key: 'sourceLabel' },
      { label: '业务分类', key: 'businessCategory' },
      { label: '原始名称', key: 'originalName' },
      { label: 'Normalized_Name', key: 'normalizedName' },
      { label: 'Category', key: 'category' },
      { label: 'Supplier', key: 'supplier' },
      { label: 'Series', key: 'series' },
      { label: 'Pole_Count', key: 'poleCount' },
      { label: 'Wire_Size', key: 'wireSize' },
      { label: 'Length', key: 'length' },
      { label: 'Shielding', key: 'shielding' },
      { label: 'Waterproof', key: 'waterproof' },
      { label: 'Main_Key', key: 'mainKey' },
      { label: 'Backup_Key', key: 'backupKey' },
    ];
    standardizedViewMount.innerHTML = renderSimpleWorkbenchTable(columns, standardizedRows, '当前线束暂无标准化 BOM 行。');
  }

  function renderDiffWorkbenchView(harnessId) {
    if (!diffViewMount) return;
    const diffRows = applyReviewStateToRows(rowsForHarness(semanticWorkbenchState?.diffRows || [], harnessId));
    const columns = [
      { label: 'Diff_Type', key: 'diffType' },
      { label: 'Change_Detail', key: 'changeDetail' },
      { label: 'Old_Child_PN', key: 'oldChildPn' },
      { label: 'Old_Child_Name', key: 'oldChildName' },
      { label: 'Old_Qty', render: (row) => row.oldQty ?? '-' },
      { label: 'New_Child_PN', key: 'newChildPn' },
      { label: 'New_Child_Name', key: 'newChildName' },
      { label: 'New_Qty', render: (row) => row.newQty ?? '-' },
      { label: 'Similarity', render: (row) => row.similarity === null || row.similarity === undefined ? '-' : String(row.similarity) },
      { label: 'Risk_Level', key: 'riskLevel' },
      { label: 'Review_Result', key: 'reviewResult' },
      { label: 'Final_Judgement', key: 'finalJudgement' },
    ];
    diffViewMount.innerHTML = `
      ${renderWorkbenchSummaryCards(diffRows)}
      ${renderSimpleWorkbenchTable(columns, diffRows, '当前线束暂无差异结果。')}
    `;
  }

  function renderDictionaryWorkbenchView() {
    if (!dictionaryViewMount) return;
    const dictionaries = semanticWorkbenchState?.dictionaries || {};
    const sections = [
      {
        title: 'CONFIG_COLUMNS',
        rows: dictionaries.configColumns || [],
        columns: [
          { label: '逻辑字段', key: 'logicalField' },
          { label: '当前映射说明', key: 'sourceHint' },
        ],
      },
      {
        title: 'DICT_NORMALIZE',
        rows: (dictionaries.normalizeRows || []).slice(0, 60),
        columns: [
          { label: '原始名称', key: 'originalName' },
          { label: '标准化名称', key: 'normalizedName' },
          { label: '分类', key: 'category' },
        ],
      },
      {
        title: 'DICT_SUPPLIER',
        rows: (dictionaries.supplierRows || []).slice(0, 40),
        columns: [{ label: 'Supplier', key: 'supplier' }],
      },
      {
        title: 'DICT_SERIES',
        rows: (dictionaries.seriesRows || []).slice(0, 40),
        columns: [{ label: 'Series', key: 'series' }],
      },
      {
        title: 'DICT_STOPWORDS',
        rows: dictionaries.stopwordRows || [],
        columns: [{ label: 'Stopword', key: 'stopword' }],
      },
      {
        title: 'DICT_SUBSTITUTE',
        rows: (dictionaries.substituteRows || []).slice(0, 60),
        columns: [
          { label: '线束号', key: 'harnessNo' },
          { label: '旧料号', key: 'oldChildPn' },
          { label: '旧名称', key: 'oldChildName' },
          { label: '新料号', key: 'newChildPn' },
          { label: '新名称', key: 'newChildName' },
          { label: '差异类型', key: 'diffType' },
        ],
      },
    ];
    dictionaryViewMount.innerHTML = sections.map((section) => `
      <article class="bom-dictionary-card">
        <div class="bom-dictionary-card-head">
          <strong>${escapeHtml(section.title)}</strong>
          <span>${section.rows.length} 行</span>
        </div>
        ${renderSimpleWorkbenchTable(section.columns, section.rows, `${section.title} 当前无数据。`)}
      </article>
    `).join('');
  }

  function renderReviewWorkbenchView(harnessId) {
    if (!reviewTableMount) return;
    const reviewRows = applyReviewStateToRows(rowsForHarness(semanticWorkbenchState?.diffRows || [], harnessId))
      .filter((row) => row.diffType !== 'SAME');
    if (!reviewRows.length) {
      reviewTableMount.innerHTML = '<div class="bom-workbench-empty">当前线束暂无待复核差异。</div>';
      return;
    }
    reviewTableMount.innerHTML = `
      <div class="bom-review-head">
        <div>
          <strong>人工复核表</strong>
          <span>复核字段会写入本地浏览器存储，重新打开仍会保留。</span>
        </div>
      </div>
      <div class="bom-workbench-table-wrap">
        <table class="bom-workbench-table bom-review-table">
          <thead>
            <tr>
              <th>Diff_Type</th>
              <th>Change_Detail</th>
              <th>Old / New</th>
              <th>Risk_Level</th>
              <th>Review_Result</th>
              <th>Final_Judgement</th>
              <th>Owner</th>
              <th>Due_Date</th>
              <th>Comment</th>
            </tr>
          </thead>
          <tbody>
            ${reviewRows.map((row) => `
              <tr>
                <td>${escapeHtml(row.diffType)}</td>
                <td>${escapeHtml(row.changeDetail || '-')}</td>
                <td>${escapeHtml([`${row.oldChildPn || '-'} ${row.oldChildName || ''}`.trim(), `${row.newChildPn || '-'} ${row.newChildName || ''}`.trim()].join(' -> '))}</td>
                <td>
                  <select data-review-key="${escapeHtml(row.reviewKey)}" data-review-field="riskLevel">
                    ${['High', 'Medium', 'Low'].map((option) => `<option value="${option}"${buildReviewInputValue(row, 'riskLevel') === option ? ' selected' : ''}>${option}</option>`).join('')}
                  </select>
                </td>
                <td>
                  <select data-review-key="${escapeHtml(row.reviewKey)}" data-review-field="reviewResult">
                    ${['', '待复核', '已确认', '驳回'].map((option) => `<option value="${escapeHtml(option)}"${buildReviewInputValue(row, 'reviewResult') === option ? ' selected' : ''}>${escapeHtml(option || '未填写')}</option>`).join('')}
                  </select>
                </td>
                <td>
                  <select data-review-key="${escapeHtml(row.reviewKey)}" data-review-field="finalJudgement">
                    ${['', '接受变更', '保持旧件', '待商务确认', '待工程确认'].map((option) => `<option value="${escapeHtml(option)}"${buildReviewInputValue(row, 'finalJudgement') === option ? ' selected' : ''}>${escapeHtml(option || '未填写')}</option>`).join('')}
                  </select>
                </td>
                <td><input type="text" value="${escapeHtml(buildReviewInputValue(row, 'owner'))}" data-review-key="${escapeHtml(row.reviewKey)}" data-review-field="owner" /></td>
                <td><input type="date" value="${escapeHtml(buildReviewInputValue(row, 'dueDate'))}" data-review-key="${escapeHtml(row.reviewKey)}" data-review-field="dueDate" /></td>
                <td><input type="text" value="${escapeHtml(buildReviewInputValue(row, 'comment'))}" data-review-key="${escapeHtml(row.reviewKey)}" data-review-field="comment" /></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  function renderDiffWorkbenchView(harnessId) {
    if (!diffViewMount) return;
    const allDiffRows = applyReviewStateToRows(rowsForHarness(semanticWorkbenchState?.diffRows || [], harnessId));
    const diffRows = filterWorkbenchDiffRows(allDiffRows);
    const filterOptions = collectDiffFilterOptions(allDiffRows.filter((row) => row.diffType !== 'SAME'));
    const columns = [
      { label: 'Diff_Type', key: 'diffType' },
      { label: 'Change_Detail', key: 'changeDetail' },
      { label: 'Old_Child_PN', key: 'oldChildPn' },
      { label: 'Old_Child_Name', key: 'oldChildName' },
      { label: 'Old_Qty', render: (row) => row.oldQty ?? '-' },
      { label: 'New_Child_PN', key: 'newChildPn' },
      { label: 'New_Child_Name', key: 'newChildName' },
      { label: 'New_Qty', render: (row) => row.newQty ?? '-' },
      { label: 'Similarity', render: (row) => row.similarity === null || row.similarity === undefined ? '-' : String(row.similarity) },
      { label: 'Match_Basis', key: 'matchBasis' },
      { label: 'Risk_Level', key: 'riskLevel' },
      { label: 'Review_Result', key: 'reviewResult' },
      { label: 'Final_Judgement', key: 'finalJudgement' },
    ];
    diffViewMount.innerHTML = `
      ${renderWorkbenchSummaryCards(diffRows)}
      <div class="bom-diff-layout">
        <div class="bom-diff-main">
          ${renderSimpleWorkbenchTable(columns, diffRows, '当前线束暂无差异结果。')}
        </div>
        <aside class="bom-diff-filter-card">
          <div class="bom-diff-filter-head">
            <div>
              <strong>筛选</strong>
              <span>${diffRows.length} / ${allDiffRows.filter((row) => row.diffType !== 'SAME').length} 条</span>
            </div>
            <button type="button" class="bom-inline-button" data-diff-filter-reset>重置</button>
          </div>
          <label class="bom-filter-field">
            <span>Business_Category</span>
            <select data-diff-filter="businessCategory">
              <option value="ALL">全部</option>
              ${filterOptions.businessCategories.map((value) => `<option value="${escapeHtml(value)}"${diffFilterState.businessCategory === value ? ' selected' : ''}>${escapeHtml(value)}</option>`).join('')}
            </select>
          </label>
          <label class="bom-filter-field">
            <span>Diff_Type</span>
            <select data-diff-filter="diffType">
              <option value="ALL">全部</option>
              ${filterOptions.diffTypes.map((value) => `<option value="${escapeHtml(value)}"${diffFilterState.diffType === value ? ' selected' : ''}>${escapeHtml(value)}</option>`).join('')}
            </select>
          </label>
          <label class="bom-filter-field">
            <span>Risk_Level</span>
            <select data-diff-filter="riskLevel">
              <option value="ALL">全部</option>
              ${filterOptions.riskLevels.map((value) => `<option value="${escapeHtml(value)}"${diffFilterState.riskLevel === value ? ' selected' : ''}>${escapeHtml(value)}</option>`).join('')}
            </select>
          </label>
          <label class="bom-filter-check">
            <input type="checkbox" data-diff-filter="pendingOnly"${diffFilterState.pendingOnly ? ' checked' : ''} />
            <span>仅看待复核</span>
          </label>
          <button type="button" class="bom-inline-button primary" data-diff-export>导出差异</button>
        </aside>
      </div>
    `;
  }

  function renderDictionaryWorkbenchView() {
    if (!dictionaryViewMount) return;
    ensureDictionaryDraftState();
    dictionaryViewMount.innerHTML = `
      <div class="bom-dictionary-toolbar">
        <div>
          <strong>词典与规则</strong>
          <span>${dictionaryDraftDirty ? '存在未应用修改' : '当前规则已生效'}</span>
        </div>
        <div class="bom-dictionary-toolbar-actions">
          <button type="button" class="bom-inline-button" data-dict-reset>恢复程序建议</button>
          <button type="button" class="bom-inline-button primary" data-dict-apply>保存并应用</button>
        </div>
      </div>
      ${renderActiveColumnMappingCard(select.value)}
      ${DICTIONARY_SECTION_SPECS.map((section) => {
        const rows = Array.isArray(dictionaryDraftState?.[section.key]) ? dictionaryDraftState[section.key] : [];
        return `
          <article class="bom-dictionary-card">
            <div class="bom-dictionary-card-head">
              <div>
                <strong>${escapeHtml(section.title)}</strong>
                <span>${escapeHtml(section.note)} · ${rows.length} 行</span>
              </div>
              <button type="button" class="bom-inline-button" data-dict-add-row="${escapeHtml(section.key)}">新增行</button>
            </div>
            ${renderDictionaryTable(section, rows)}
          </article>
        `;
      }).join('')}
    `;
  }

  function renderSemanticWorkbenchHarness(harnessId) {
    const comparison = getComparison(harnessId);
    if (!comparison) {
      summary.innerHTML = '';
      hint.textContent = '未找到该线束的 BOM 管理数据。';
      if (rawViewMount) rawViewMount.innerHTML = '<div class="bom-workbench-empty">未找到该线束的原始 BOM 数据。</div>';
      if (standardizedViewMount) standardizedViewMount.innerHTML = '<div class="bom-workbench-empty">未找到该线束的标准化 BOM 数据。</div>';
      if (diffViewMount) diffViewMount.innerHTML = '<div class="bom-workbench-empty">未找到该线束的差异结果。</div>';
      if (dictionaryViewMount) dictionaryViewMount.innerHTML = '<div class="bom-workbench-empty">未找到词典与规则数据。</div>';
      if (reviewTableMount) reviewTableMount.innerHTML = '<div class="bom-workbench-empty">未找到人工复核数据。</div>';
      groups.innerHTML = '<div class="bom-compare-empty-state">未找到该线束的 BOM 管理数据。</div>';
      return;
    }

    const diffRows = rowsForHarness(semanticWorkbenchState?.diffRows || [], harnessId);
    const summaryItems = [
      `线束 <strong>${escapeHtml(comparison.harnessId)}</strong>`,
      ...versionOrder.map((version) => `${escapeHtml(shortLabel(version))} Sheet <strong>${escapeHtml(comparison.sources?.[version]?.sheet || '-')}</strong>`),
      `差异行 <strong>${diffRows.filter((row) => row.diffType !== 'SAME').length}</strong>`,
      `高风险 <strong>${diffRows.filter((row) => row.riskLevel === 'High').length}</strong>`,
      `${fullMatchLabel()} <strong>${comparison.summary.fullMatchCount || 0}</strong>`,
      ...(versionOrder.length > 2
        ? [`${partialMatchLabel()} <strong>${comparison.summary.partialMatchCount || 0}</strong>`]
        : [`${replacementLabel()} <strong>${comparison.summary.replacementCount || 0}</strong>`]),
    ];
    summary.innerHTML = summaryItems.map((text) => `<span class="stat-pill">${text}</span>`).join('');
    hint.textContent = [
      `当前工作台已按 5 层拆开：原始 BOM、标准化 BOM、差异结果、词典与规则、人工复核。`,
      `当前基准：${shortLabel(baseVersion)}；当前比较：${versionOrder.map((version) => shortLabel(version)).join(' vs ')}。`,
      '点击小锁可解锁当前已对齐行，解锁后允许手动拖动对齐。',
      bomViewSyncHint,
      nativeBomHintText(),
    ].filter(Boolean).join(' ');

    renderRawWorkbenchView(harnessId);
    renderStandardizedWorkbenchView(harnessId);
    renderDiffWorkbenchView(harnessId);
    renderDictionaryWorkbenchView();
    renderReviewWorkbenchView(harnessId);

    groups.classList.toggle('is-bom-multi-way', versionOrder.length > 2);
    groups.innerHTML = comparison.groups.map((group) => renderGroup(harnessId, group)).join('');
    renderActiveWorkbenchPanel();
  }

  function getHarnessState(harnessId) {
    if (!manualAlignState[harnessId]) {
      manualAlignState[harnessId] = {};
    }
    return manualAlignState[harnessId];
  }

  function unlockedRowsForVersion(groupState, version) {
    const unlockedRows = Array.isArray(groupState?.[`${version}UnlockedRows`])
      ? groupState[`${version}UnlockedRows`]
      : [];
    return new Set(
      unlockedRows
        .map((value) => Number(value))
        .filter((value) => Number.isInteger(value) && value >= 0),
    );
  }

  function persistUnlockedRows(harnessId, groupKey, version, unlockedRows) {
    const harnessState = getHarnessState(harnessId);
    if (!harnessState[groupKey]) {
      harnessState[groupKey] = {};
    }
    harnessState[groupKey][`${version}UnlockedRows`] = Array.from(unlockedRows)
      .filter((value) => Number.isInteger(value) && value >= 0)
      .sort((left, right) => left - right);
    saveAlignState();
  }

  function toggleRowLockState(harnessId, groupKey, version, rowIndex) {
    const harnessState = getHarnessState(harnessId);
    const groupState = harnessState[groupKey] || {};
    const unlockedRows = unlockedRowsForVersion(groupState, version);
    if (unlockedRows.has(rowIndex)) {
      unlockedRows.delete(rowIndex);
    } else {
      unlockedRows.add(rowIndex);
    }
    persistUnlockedRows(harnessId, groupKey, version, unlockedRows);
  }

  function editableRowIndexesForVersion(model, version) {
    return model.rows.reduce((indexes, row, index) => {
      if (!row?.versions?.[version]) return indexes;
      if (!row.lockable?.[version]) return indexes;
      if (row.rowType === 'assembly_bundle') return indexes;
      indexes.push(index);
      return indexes;
    }, []);
  }

  function isLaneEditEnabled(model, version, editableIndexes = editableRowIndexesForVersion(model, version)) {
    return editableIndexes.some((index) => !model.lockedRows[version].has(index));
  }

  function setLaneEditState(harnessId, groupKey, version, editable) {
    const comparison = getComparison(harnessId);
    if (!comparison) return;
    const group = comparison.groups.find((item) => item.key === groupKey);
    if (!group) return;
    const model = buildGroupModel(harnessId, group);
    const editableIndexes = editableRowIndexesForVersion(model, version);
    if (!editableIndexes.length) return;
    const unlockedRows = new Set(model.unlockedRows[version]);
    editableIndexes.forEach((index) => {
      if (editable) {
        unlockedRows.add(index);
      } else {
        unlockedRows.delete(index);
      }
    });
    persistUnlockedRows(harnessId, groupKey, version, unlockedRows);
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
    if (row.matchState === 'replacement') {
      return 'replacement';
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
    const baseLockedRows = Object.fromEntries(versionOrder.map((version) => [version, new Set()]));
    const unlockedRows = Object.fromEntries(versionOrder.map((version) => [version, unlockedRowsForVersion(groupState, version)]));
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
        relationType: row.relationType || '',
        relationSummary: row.relationSummary || '',
        relationTitle: row.relationTitle || '',
        relationDeltaText: row.relationDeltaText || '',
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
          baseLockedRows[version].add(index);
        }
      });
    });

    const lockedRows = Object.fromEntries(versionOrder.map((version) => [version, new Set(
      [...baseLockedRows[version]].filter((index) => !unlockedRows[version].has(index)),
    )]));

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
        relationType: '',
        relationSummary: '',
        relationTitle: '',
        relationDeltaText: '',
        directKeys: Object.fromEntries(versionOrder.map((version) => [version, null])),
        partLists: Object.fromEntries(versionOrder.map((version) => [version, []])),
      };
      const versions = {};
      const rowStatuses = {};
      const rowLocked = {};
      const rowLockable = {};
      const parts = {};
      versionOrder.forEach((version) => {
        const itemKey = laneRows[version][index] || null;
        versions[version] = itemKey ? itemMaps[version].get(itemKey) || null : null;
        rowStatuses[version] = itemKey ? statuses[version][itemKey] : '';
        rowLocked[version] = lockedRows[version].has(index);
        rowLockable[version] = baseLockedRows[version].has(index);
        parts[version] = blueprint.partLists[version] || [];
      });
      return {
        rowType: blueprint.rowType,
        matchState: blueprint.matchState,
        sourceCount: blueprint.sourceCount,
        relationType: blueprint.relationType,
        relationSummary: blueprint.relationSummary,
        relationTitle: blueprint.relationTitle,
        relationDeltaText: blueprint.relationDeltaText,
        versions,
        partLists: parts,
        statuses: rowStatuses,
        locked: rowLocked,
        lockable: rowLockable,
      };
    });

    return {
      ...group,
      rows,
      laneRows,
      baseLockedRows,
      lockedRows,
      unlockedRows,
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

    if (row?.relationType === 'replacement') {
      return createDelta(
        row.relationDeltaText || replacementLabel(),
        'delta-neutral',
        row.relationTitle || replacementLabel(),
      );
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
      return '导线按关键规格判定：线径、导体材质、屏蔽、屏蔽材质、外皮材质、芯数；替换、新增、取消与总成展开分开统计。';
    }
    if (model.section === 'sync') {
      return '支架类与橡胶件类独立归入同步开发件分组，便于专项核对与后续版本扩展。';
    }
    return '其他物料按零件直接对齐；当前视图由版本列表驱动，后续新增 BOM 版本可继续接入同一套对齐机制。';
  }

  function buildCardTitle(version, item, consumption, assemblyText, noteText, relationText, delta, titleNote) {
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
    if (relationText) {
      titleParts.push(`差异: ${relationText}`);
    }
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
    const canDrag = Boolean(item) && !locked && !options.disableDrag;
    const functions = uniqueStrings(item.functions);
    const notes = uniqueStrings([...(item.remarks || []), ...(item.otherRemarks || [])]);
    const consumption = `${fmtQty(item.quantity)} ${item.unit || ''}`.trim();
    const assemblyText = displayList(item.assemblyRefs);
    const noteText = [...functions, ...notes].filter(Boolean).join(' | ') || '-';
    const detailParts = [];
    if (options.detailPrefix) {
      detailParts.push(options.detailPrefix);
    }
    if (row?.relationSummary) {
      detailParts.unshift(row.relationSummary);
    }
    if (assemblyText !== '-') {
      detailParts.push(assemblyText);
    }
    if (noteText !== '-') {
      detailParts.push(noteText);
    }
    const detailText = detailParts.length ? detailParts.join(' | ') : '-';
    const delta = options.deltaOverride || buildLaneDelta(version, row);
    const titleText = buildCardTitle(version, item, consumption, assemblyText, noteText, row?.relationTitle || '', delta, options.titleNote);
    const cardClassName = options.cardClassName ? ` ${options.cardClassName}` : '';
    const lockLabel = '锁';
    const lockTitle = '点击解锁后允许手动拖动对齐';

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

  function renderLaneColumns(model, version) {
    const editableIndexes = editableRowIndexesForVersion(model, version);
    const canEdit = editableIndexes.length > 0;
    const editing = canEdit && isLaneEditEnabled(model, version, editableIndexes);
    const toggleTitle = editing ? '关闭编辑' : '打开编辑';
    return `
      <div class="bom-lane-panel">
        <div class="bom-lane-title">
          <span>${escapeHtml(versionLabels[version] || version)}</span>
          <div class="bom-lane-title-meta">
            <button
              class="bom-lane-lock${editing ? ' is-editing' : ''}"
              type="button"
              title="${escapeHtml(toggleTitle)}"
              aria-label="${escapeHtml(toggleTitle)}"
              aria-pressed="${editing ? 'true' : 'false'}"
              data-lane-edit-toggle="true"
              data-group-key="${escapeHtml(model.key)}"
              data-side="${escapeHtml(version)}"
              data-editing="${editing ? 'true' : 'false'}"
              ${canEdit ? '' : 'disabled'}
            >
              <span class="bom-lane-lock-icon" aria-hidden="true">${editing ? '&#128275;' : '&#128274;'}</span>
            </button>
            <em>${escapeHtml(laneDeltaHint(version))}</em>
          </div>
        </div>
        <div class="bom-lane-columns">
          <span>状态</span>
          <span>料号</span>
          <span>名称</span>
          <span>单位</span>
          <span>SAP</span>
          <span>供应商</span>
          <span>总成/备注</span>
          <span>差异</span>
        </div>
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
            ${versionOrder.map((version) => renderLaneColumns(model, version)).join('')}
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
      ...(versionOrder.length > 2
        ? [`${partialMatchLabel()} <strong>${model.partialMatchCount || 0}</strong>`]
        : [`${replacementLabel()} <strong>${model.replacementCount || 0}</strong>`]),
      ...versionOrder.map((version) => `${relationOnlyLabel(version)} <strong>${model.onlyCounts?.[version] || 0}</strong>`),
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
            ${versionOrder.map((version) => renderLaneColumns(model, version)).join('')}
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
      ...(versionOrder.length > 2
        ? [`${partialMatchLabel()} <strong>${comparison.summary.partialMatchCount || 0}</strong>`]
        : [`${replacementLabel()} <strong>${comparison.summary.replacementCount || 0}</strong>`]),
      ...versionOrder.map((version) => `${relationOnlyLabel(version)} <strong>${comparison.summary.onlyCounts?.[version] || 0}</strong>`),
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

  function renderAssemblyRootCell(model, row, index, rootVersion) {
    const mappedSummary = versionOrder
      .filter((version) => version !== rootVersion && row.partLists?.[version]?.length)
      .map((version) => `${shortLabel(version)} ${row.partLists[version].length}`)
      .join(' / ');
    const assemblyNote = `${shortLabel(rootVersion)} 该端为连接器总成，后续版本按对应端散件清单展开`;
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
          mappedSummary ? `散件展开 ${mappedSummary}` : '总成映射',
          'delta-neutral',
          assemblyNote,
        ),
        titleNote: assemblyNote,
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
      ...(versionOrder.length > 2
        ? [`${partialMatchLabel()} <strong>${model.partialMatchCount || 0}</strong>`]
        : [`${replacementLabel()} <strong>${model.replacementCount || 0}</strong>`]),
      ...versionOrder.map((version) => `${relationOnlyLabel(version)} <strong>${model.onlyCounts?.[version] || 0}</strong>`),
    ];
    if (model.assemblyToPartsCount) {
      statPills.push(`总成映射 <strong>${model.assemblyToPartsCount}</strong>`);
      statPills.push(`散件展开 <strong>${model.assemblyPartCount}</strong>`);
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
            ${versionOrder.map((version) => renderLaneColumns(model, version)).join('')}
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
      summaryItems.push(`散件展开 <strong>${comparison.summary.assemblyPartCount}</strong>`);
    }

    summary.innerHTML = summaryItems.map((text) => `<span class="stat-pill">${text}</span>`).join('');

    const sourceText = versionOrder
      .map((version) => `${shortLabel(version)}：${workbookLabels[version] || bomValidation.meta?.[`${version}Workbook`] || '-'}`)
      .join('；');
    hint.textContent = [
      `来源：${sourceText}。`,
      '已对齐零件锁定在同一行，独有零件可在本版本列内上下拖动，并借助空白行人工对位。',
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
      leftBomKey: options.leftBomKey,
      rightBomKey: options.rightBomKey,
    });
    if (select.value) {
      renderSemanticWorkbenchHarness(select.value);
    }
  }

  function renderSeedViewImmediately(preferredHarnessId = '') {
    applyBomValidationViewState(
      buildSeedViewState('运行时 BOM 同步中，先显示内置对比视图。'),
      preferredHarnessId || select.value,
    );
    if (select.value) {
      renderSemanticWorkbenchHarness(select.value);
    }
  }

  syncHarnessSelect(bomValidation.harnessOrder[0]);
  syncBomVersionSelectors();

  openBtn.addEventListener('click', async () => {
    activeWorkbenchView = 'review';
    persistWorkbenchView();
    setModalOpen(true);
    const preferredHarnessId = select.value || bomValidation.harnessOrder[0] || '';
    let runtimeSettled = false;
    let fallbackRendered = false;
    const fallbackTimer = window.setTimeout(() => {
      if (!runtimeSettled) {
        renderSeedViewImmediately(preferredHarnessId);
        fallbackRendered = true;
      }
    }, 350);
    const runtimePromise = refreshViewAndRender({
      preserveSelection: true,
      harnessId: preferredHarnessId,
    }).catch(() => {
      if (!fallbackRendered) {
        renderSeedViewImmediately(preferredHarnessId);
        fallbackRendered = true;
      }
    }).finally(() => {
      runtimeSettled = true;
      window.clearTimeout(fallbackTimer);
    });
    try {
      await runtimePromise;
    } catch (error) {
      nativeBomStatus = `原生 BOM 库初始化失败：${error.message}`;
      if (!fallbackRendered) {
        renderSeedViewImmediately(preferredHarnessId);
      }
      if (select.value) {
        renderSemanticWorkbenchHarness(select.value);
      }
    }
    void (async () => {
      try {
        await seedNativeBomStore();
        await refreshNativeBomStatus();
      } catch (error) {
        nativeBomStatus = `原生 BOM 库初始化失败：${error.message}`;
      }
      if (select.value) {
        renderSemanticWorkbenchHarness(select.value);
      }
    })();
  });
  closeBtn.addEventListener('click', () => setModalOpen(false));
  resetBtn.addEventListener('click', () => {
    delete manualAlignState[select.value];
    saveAlignState();
    renderSemanticWorkbenchHarness(select.value);
  });
  if (importBtn && importInput) {
    importBtn.addEventListener('click', async () => {
      try {
        await initNativeBomStore();
        importInput.click();
      } catch (error) {
        nativeBomStatus = `无法启动原生 BOM 库：${error.message}`;
        renderSemanticWorkbenchHarness(select.value);
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
  if (leftVersionSelect) {
    leftVersionSelect.addEventListener('change', async () => {
      const nextPair = updateSelectedBomVersionPair('leftBomKey', leftVersionSelect.value);
      await refreshViewAndRender({
        preserveSelection: true,
        harnessId: select.value,
        leftBomKey: nextPair.leftBomKey,
        rightBomKey: nextPair.rightBomKey,
      });
    });
  }
  if (rightVersionSelect) {
    rightVersionSelect.addEventListener('change', async () => {
      const nextPair = updateSelectedBomVersionPair('rightBomKey', rightVersionSelect.value);
      await refreshViewAndRender({
        preserveSelection: true,
        harnessId: select.value,
        leftBomKey: nextPair.leftBomKey,
        rightBomKey: nextPair.rightBomKey,
      });
    });
  }
  select.addEventListener('change', () => renderSemanticWorkbenchHarness(select.value));
  const dashboardVersionEventName = window.G281DashboardBridge?.getDashboardEventNames?.().versionChange || 'g281:dashboard-version-change';
  window.addEventListener(dashboardVersionEventName, (event) => {
    if (event?.detail?.group && event.detail.group !== 'bom') return;
    void refreshViewAndRender({ preserveSelection: true });
  });
  groups.addEventListener('click', (event) => {
    const laneEditButton = event.target.closest('[data-lane-edit-toggle="true"]');
    if (!laneEditButton) return;
    event.preventDefault();
    event.stopPropagation();
    setLaneEditState(
      select.value,
      laneEditButton.dataset.groupKey || '',
      laneEditButton.dataset.side || '',
      laneEditButton.dataset.editing !== 'true',
    );
    renderSemanticWorkbenchHarness(select.value);
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
    if (event.target.closest('[data-lane-edit-toggle="true"]')) {
      event.preventDefault();
      return;
    }
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
    renderSemanticWorkbenchHarness(dragState.harnessId);
    dragState = null;
    clearDropTargets();
  });

  void refreshViewAndRender({ preserveSelection: true });
})();
