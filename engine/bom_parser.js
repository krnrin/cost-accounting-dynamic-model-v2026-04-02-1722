(function (global) {
  'use strict';

  const PARSER_VERSION = '2026.03.31-b';

  const SHEET_ROLE_MAP = [
    { role: 'change_history', match: (name) => name.includes('变更履历') },
    { role: 'assembly_parts', match: (name) => name.includes('总成散件清单') },
    { role: 'secondary_materials', match: (name) => name.includes('二次物料明细') },
    { role: 'ksk_bom_detail', match: (name) => name.includes('KSK线束BOM明细') },
    { role: 'harness', match: (name) => /^\d{6,}/.test(name) },
  ];

  const CONNECTOR_KEYWORDS = ['连接器', '护套', '主体组合件', '尾盖', '密封圈', '挡板', '插头', '插座', '屏蔽环', '线卡'];
  const TERMINAL_KEYWORDS = ['端子'];
  const IPT_TERMINAL_KEYWORDS = ['ipt', '压接端子', '焊接端子'];
  const WIRE_KEYWORDS = ['导线', '电缆', 'cable'];
  const BRACKET_RUBBER_KEYWORDS = ['支架', '橡胶'];
  const TAPE_TUBE_KEYWORDS = ['胶带', '套管', '热缩管', '编织套管'];

  // P2#9: 委托给 G281Shared，消除重复 clonePlain
  const clonePlain = (global.G281Shared && global.G281Shared.clonePlain)
    || function (value, fallback) {
      if (fallback === undefined) fallback = null;
      try { return JSON.parse(JSON.stringify(value)); } catch (error) { return fallback; }
    };

  const toText = (value, fallback = '') => {
    const text = String(value ?? '').trim();
    return text || fallback;
  };

  const toNumber = (value, fallback = 0) => {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    const normalized = String(value ?? '').replace(/,/g, '').trim();
    if (!normalized) return fallback;
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : fallback;
  };

  const ensureObject = (value) => (value && typeof value === 'object' ? value : {});
  const ensureArray = (value) => (Array.isArray(value) ? value : []);
  const collapseText = (value) =>
    toText(value, '')
      .replace(/[\s\-_/\\()（）【】\[\]·•,.，。:：]/g, '')
      .toLowerCase();

  const normalizeKey = (value) =>
    toText(value, '')
      .replace(/\s+/g, '')
      .replace(/[（(].*?[）)]/g, '')
      .toLowerCase();

  const splitLines = (value) =>
    toText(value, '')
      .split(/\r?\n/)
      .map((item) => item.trim())
      .filter(Boolean);

  const getSheetEntries = (snapshot) =>
    ensureArray(snapshot?.sheetOrder).map((sheetId, index) => ({
      sheetId,
      sheetOrderKey: index + 1,
      sheet: ensureObject(snapshot?.sheets?.[sheetId]),
      sheetName: toText(snapshot?.sheets?.[sheetId]?.name, sheetId),
    }));

  const getCellEntry = (sheet, rowNo, columnNo) => {
    const row = ensureObject(sheet?.cellData?.[String(rowNo - 1)]);
    return ensureObject(row?.[String(columnNo - 1)]);
  };

  const getCellValue = (sheet, rowNo, columnNo) => {
    const cell = getCellEntry(sheet, rowNo, columnNo);
    const raw = Object.prototype.hasOwnProperty.call(cell, 'v') ? cell.v : null;
    if (raw === null || raw === undefined) return '';
    if (typeof raw === 'string' || typeof raw === 'number' || typeof raw === 'boolean') {
      return raw;
    }
    if (typeof raw === 'object') {
      if (typeof raw.v === 'string' || typeof raw.v === 'number' || typeof raw.v === 'boolean') {
        return raw.v;
      }
      if (typeof raw.body?.dataStream === 'string') {
        return raw.body.dataStream;
      }
    }
    return '';
  };

  const readRowValues = (sheet, rowNo, maxColumn = 17) => {
    const values = {};
    for (let columnNo = 1; columnNo <= maxColumn; columnNo += 1) {
      values[columnNo] = getCellValue(sheet, rowNo, columnNo);
    }
    return values;
  };

  const resolveSheetRole = (sheetName) => {
    const name = toText(sheetName, '');
    const matched = SHEET_ROLE_MAP.find((item) => item.match(name));
    return matched?.role || 'other';
  };

  const buildHeaderMeta = (sheet) => ({
    versionText: toText(getCellValue(sheet, 2, 1), ''),
    projectName: toText(getCellValue(sheet, 2, 3), ''),
    harnessNo: toText(getCellValue(sheet, 2, 4), ''),
    harnessName: toText(getCellValue(sheet, 2, 5), ''),
    drawVersion: toText(getCellValue(sheet, 2, 6), ''),
    quoteDate: toText(getCellValue(sheet, 2, 7), ''),
  });

  const normalizeEndGroupLabel = (value, fallback = '') => {
    const source = toText(value, fallback);
    const normalized = collapseText(source);
    if (!normalized) return toText(fallback, '');
    const aliases = [
      ['接电池端', ['接电池端', '接电池', '电池端']],
      ['接电驱端', ['接电驱端', '接电驱', '电驱端', '电驱']],
      ['接ACCM端', ['接accm端', '接accm', 'accm端', 'accm']],
      ['接PTC端', ['接ptc端', '接ptc', 'ptc端', 'ptc']],
      ['二分四分线器', ['二分四分线器', '分线器']],
      ['组合式充电插座', ['组合式充电插座', '充电插座']],
      ['快充端', ['快充连接器', '快充端', '直流充电', 'dc充电', 'dc端', '直流端', '快充']],
      ['慢充端', ['慢充连接器', '慢充端', '交流充电', 'ac充电', 'ac端', '交流端', '慢充']],
      ['电子锁', ['电子锁']],
      ['低压INLINE', ['低压inline', 'inline']],
      ['DC接地端子', ['dc接地', '直流接地']],
      ['AC接地端子', ['ac接地', '交流接地']],
    ];
    const matched = aliases.find((entry) => entry[1].some((token) => normalized.includes(collapseText(token))));
    return matched ? matched[0] : source;
  };

  const inferEndGroupFromFunction = (value, previous = '') => {
    const lines = splitLines(value);
    if (!lines.length) return previous;
    const preferred = lines.find((line) => /端|接|充电|锁|电池|电驱/.test(line)) || lines[1] || lines[0];
    return normalizeEndGroupLabel(preferred, previous);
  };

  const classifyBomItem = (item = {}) => {
    const primary = `${toText(item.partName)} ${toText(item.partNo)}`.toLowerCase();
    const secondary = `${toText(item.functionText)} ${toText(item.spec)}`.toLowerCase();
    if (IPT_TERMINAL_KEYWORDS.some((keyword) => primary.includes(keyword) || secondary.includes(keyword))) return 'ipt_terminal';
    if (TERMINAL_KEYWORDS.some((keyword) => primary.includes(keyword))) return 'terminal';
    if (CONNECTOR_KEYWORDS.some((keyword) => primary.includes(keyword))) return 'connector';
    if (BRACKET_RUBBER_KEYWORDS.some((keyword) => primary.includes(keyword))) return 'bracket_rubber';
    if (TAPE_TUBE_KEYWORDS.some((keyword) => primary.includes(keyword))) return 'tape_tube';
    if (WIRE_KEYWORDS.some((keyword) => primary.includes(keyword))) return 'wire';
    return 'other';
  };

  const buildAlignKey = (item = {}) => {
    const partNo = normalizeKey(item.partNo);
    const sapNo = normalizeKey(item.sapNo);
    return [
      toText(item.itemCategory, 'other'),
      toText(item.endGroup, ''),
      partNo,
      sapNo,
    ].join('|');
  };

  const parseHarnessSheet = (sheetEntry, context = {}) => {
    const sheet = sheetEntry.sheet;
    const headerMeta = buildHeaderMeta(sheet);
    const harnessNo = toText(headerMeta.harnessNo, sheetEntry.sheetName);
    const headerId = `${context.releaseId}::header::${harnessNo}`;
    const header = {
      headerId,
      releaseId: context.releaseId,
      harnessNo,
      assemblyNo: harnessNo,
      harnessName: headerMeta.harnessName,
      sheetName: sheetEntry.sheetName,
      originSheetName: sheetEntry.sheetName,
      configCode: '',
      sortIndex: sheetEntry.sheetOrderKey,
      meta: {
        role: 'harness',
        sheetOrderKey: sheetEntry.sheetOrderKey,
        versionText: headerMeta.versionText,
        projectName: headerMeta.projectName,
        drawVersion: headerMeta.drawVersion,
        quoteDate: headerMeta.quoteDate,
      },
    };

    const items = [];
    let currentEndGroup = '';
    const rowCount = Number(sheet.rowCount) || 2000;

    for (let rowNo = 5; rowNo <= rowCount; rowNo += 1) {
      const row = readRowValues(sheet, rowNo, 17);
      const partNo = toText(row[3], '');
      const partName = toText(row[4], '');
      const quantityText = toText(row[10], '');
      const unit = toText(row[11], '');
      const hasCoreValues = Boolean(partNo || partName || quantityText || unit);
      if (!hasCoreValues) {
        continue;
      }
      const quantityValue = toNumber(quantityText, NaN);
      const hasMeaningfulPartName = /[A-Za-z\u4e00-\u9fff]/.test(partName);
      const hasMeaningfulUnit = /[A-Za-z\u4e00-\u9fff]/.test(unit);
      if (!partNo && !hasMeaningfulPartName && !(Number.isFinite(quantityValue) && quantityValue > 0) && !hasMeaningfulUnit) {
        continue;
      }

      const functionText = toText(row[2], '');
      currentEndGroup = inferEndGroupFromFunction(functionText, currentEndGroup);
      const item = {
        itemId: `${headerId}::item::${String(rowNo).padStart(4, '0')}`,
        headerId,
        releaseId: context.releaseId,
        harnessNo,
        displayNo: toText(row[1], ''),
        functionText,
        partNo,
        partName,
        semiFinishedFlag: toText(row[5], ''),
        sapNo: toText(row[6], ''),
        pin: toText(row[7], ''),
        optionCode: toText(row[8], ''),
        spec: toText(row[9], ''),
        qty: Number.isFinite(quantityValue) ? quantityValue : 0,
        unit,
        supplier: toText(row[12], ''),
        remark: toText(row[12], ''),
        otherRemark: toText(row[13], ''),
        subPartNo: toText(row[14], ''),
        subPartName: toText(row[15], ''),
        subPartQty: toNumber(row[16], 0),
        subPartUnit: toText(row[17], ''),
        endGroup: currentEndGroup,
        itemCategory: 'other',
        alignKey: '',
        displayOrder: toNumber(row[1], rowNo),
        sourceSheet: sheetEntry.sheetName,
        sourceRow: rowNo,
        bundleRelation: '',
        meta: {
          sheetRole: 'harness',
        },
      };

      item.itemCategory = classifyBomItem(item);
      item.alignKey = buildAlignKey(item);
      if (item.itemCategory === 'connector' && item.subPartNo) {
        item.bundleRelation = 'assembly_component';
      }
      items.push(item);
    }

    return { header, items, effectivities: [] };
  };

  const parseBomWorkbookSnapshot = (snapshot, options = {}) => {
    const releaseId = toText(options.releaseId, `bom-release-${Date.now().toString(36)}`);
    const projectCode = toText(options.projectCode, 'default-project');
    const releaseLabel = toText(options.releaseLabel, releaseId);
    const sheetEntries = getSheetEntries(snapshot);
    const headers = [];
    const items = [];
    const effectivities = [];
    const sheetCatalog = [];
    const parseWarnings = [];

    sheetEntries.forEach((sheetEntry) => {
      const sheetRole = resolveSheetRole(sheetEntry.sheetName);
      sheetCatalog.push({
        sheetName: sheetEntry.sheetName,
        sheetRole,
        sortIndex: sheetEntry.sheetOrderKey,
      });
      if (sheetRole !== 'harness') {
        return;
      }
      try {
        const parsed = parseHarnessSheet(sheetEntry, { releaseId, projectCode });
        if (parsed?.header) headers.push(parsed.header);
        items.push(...ensureArray(parsed?.items));
        effectivities.push(...ensureArray(parsed?.effectivities));
      } catch (error) {
        parseWarnings.push({
          sheetName: sheetEntry.sheetName,
          message: error?.message || 'Harness sheet parse failed',
        });
      }
    });

    const releaseMeta = {
      releaseId,
      projectCode,
      releaseLabel,
      workbookName: toText(snapshot?.name, releaseLabel),
      sheetCount: sheetEntries.length,
      harnessCount: headers.length,
      itemCount: items.length,
      parserVersion: PARSER_VERSION,
      parsedAt: new Date().toISOString(),
    };

    return {
      releaseMeta,
      headers,
      items,
      effectivities,
      sheetCatalog,
      parseWarnings,
      sourceSnapshot: clonePlain(snapshot, null),
    };
  };

  global.G281BomParser = {
    PARSER_VERSION,
    parseBomWorkbookSnapshot,
    resolveSheetRole,
    classifyBomItem,
    buildAlignKey,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = global.G281BomParser;
  }
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this);
