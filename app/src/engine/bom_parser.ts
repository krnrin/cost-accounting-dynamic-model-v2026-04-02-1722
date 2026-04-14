/**
 * engine/bom_parser.ts
 *
 * BOM 转换与解析引擎 (TypeScript version)
 *
 * Conversion Rules:
 * 1. Removed IIFE wrapper
 * 2. Removed global attachment
 * 3. ES module with named exports
 * 4. TypeScript type annotations added
 * 5. Logic preserved exactly
 * 6. Import from './shared_utils'
 * 7. Support for both Snapshot and xlsx.WorkBook
 */

import type { WorkBook, WorkSheet } from 'xlsx';
import { utils } from 'xlsx';
import { clonePlain, safeArray } from './shared_utils';
import type { BomItem as HarnessBomItem, WireItem as HarnessWireItem } from '@/types/harness';

// ── 类型定义 ──────────────────────────────────

export type SheetRole = 'change_history' | 'assembly_parts' | 'secondary_materials' | 'ksk_bom_detail' | 'harness' | 'other';

export interface BomParseOptions {
  releaseId?: string;
  projectCode?: string;
  releaseLabel?: string;
}

export interface BomHeader {
  headerId: string;
  releaseId: string;
  harnessNo: string;
  assemblyNo: string;
  harnessName: string;
  sheetName: string;
  originSheetName: string;
  configCode: string;
  sortIndex: number;
  meta: {
    role: string;
    sheetOrderKey: number;
    versionText: string;
    projectName: string;
    drawVersion: string;
    quoteDate: string;
  };
}

export interface BomItem {
  itemId: string;
  headerId: string;
  releaseId: string;
  harnessNo: string;
  displayNo: string;
  functionText: string;
  partNo: string;
  partName: string;
  semiFinishedFlag: string;
  sapNo: string;
  pin: string;
  optionCode: string;
  spec: string;
  qty: number;
  unit: string;
  supplier: string;
  remark: string;
  otherRemark: string;
  subPartNo: string;
  subPartName: string;
  subPartQty: number;
  subPartUnit: string;
  endGroup: string;
  itemCategory: string;
  alignKey: string;
  displayOrder: number;
  sourceSheet: string;
  sourceRow: number;
  bundleRelation: string;
  meta: {
    sheetRole: string;
  };
}

export interface Effectivity {
  // 占位符，目前 JS 版中返回空数组
  [key: string]: any;
}

export interface SheetCatalogEntry {
  sheetName: string;
  sheetRole: SheetRole;
  sortIndex: number;
}

export interface ParseWarning {
  sheetName: string;
  message: string;
}

export interface ParsedBom {
  releaseMeta: {
    releaseId: string;
    projectCode: string;
    releaseLabel: string;
    workbookName: string;
    sheetCount: number;
    harnessCount: number;
    itemCount: number;
    parserVersion: string;
    parsedAt: string;
  };
  headers: BomHeader[];
  items: BomItem[];
  effectivities: Effectivity[];
  sheetCatalog: SheetCatalogEntry[];
  parseWarnings: ParseWarning[];
  sourceSnapshot?: any;
}

interface SheetDataAccessor {
  name: string;
  rowCount: number;
  getCellValue(rowNo: number, columnNo: number): any;
}

// ── 常量 ──────────────────────────────────────

export const PARSER_VERSION = '2026.03.31-b';

const SHEET_ROLE_MAP: { role: SheetRole; match: (name: string) => boolean }[] = [
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

// ── 内部工具函数 ──────────────────────────────

const toText = (value: any, fallback: string = ''): string => {
  const text = String(value ?? '').trim();
  return text || fallback;
};

const toNumber = (value: any, fallback: number = 0): number => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const normalized = String(value ?? '').replace(/,/g, '').trim();
  if (!normalized) return fallback;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const ensureObject = (value: any): Record<string, any> => (value && typeof value === 'object' ? value : {});

const collapseText = (value: any): string =>
  toText(value, '')
    .replace(/[\s\-_/\\()（）【】\[\]·•,.，。:：]/g, '')
    .toLowerCase();

const normalizeKey = (value: any): string =>
  toText(value, '')
    .replace(/\s+/g, '')
    .replace(/[（(].*?[）)]/g, '')
    .toLowerCase();

const splitLines = (value: any): string[] =>
  toText(value, '')
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);

const readRowValues = (sheet: SheetDataAccessor, rowNo: number, maxColumn: number = 17): Record<number, any> => {
  const values: Record<number, any> = {};
  for (let columnNo = 1; columnNo <= maxColumn; columnNo += 1) {
    values[columnNo] = sheet.getCellValue(rowNo, columnNo);
  }
  return values;
};

const buildHeaderMeta = (sheet: SheetDataAccessor) => ({
  versionText: toText(sheet.getCellValue(2, 1), ''),
  projectName: toText(sheet.getCellValue(2, 3), ''),
  harnessNo: toText(sheet.getCellValue(2, 4), ''),
  harnessName: toText(sheet.getCellValue(2, 5), ''),
  drawVersion: toText(sheet.getCellValue(2, 6), ''),
  quoteDate: toText(sheet.getCellValue(2, 7), ''),
});

const normalizeEndGroupLabel = (value: any, fallback: string = ''): string => {
  const source = toText(value, fallback);
  const normalized = collapseText(source);
  if (!normalized) return toText(fallback, '');
  const aliases: [string, string[]][] = [
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

const inferEndGroupFromFunction = (value: any, previous: string = ''): string => {
  const lines = splitLines(value);
  if (!lines.length) return previous;
  const preferred = lines.find((line) => /端|接|充电|锁|电池|电驱/.test(line)) || lines[1] || lines[0];
  return normalizeEndGroupLabel(preferred, previous);
};

// ── 公开转换函数 ──────────────────────────────

export const detectSheetRole = (sheetName: string, _ws?: WorkSheet): SheetRole => {
  const name = toText(sheetName, '');
  const matched = SHEET_ROLE_MAP.find((item) => item.match(name));
  return matched?.role || 'other';
};

/** @deprecated Use detectSheetRole instead */
export const resolveSheetRole = detectSheetRole;

export const classifyItem = (item: Record<string, any> = {}): string => {
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

/** @deprecated Use classifyItem instead */
export const classifyBomItem = classifyItem;

export const buildAlignKey = (item: Record<string, any>): string => {
  const partNo = normalizeKey(item.partNo);
  const sapNo = normalizeKey(item.sapNo);
  return [
    toText(item.itemCategory, 'other'),
    toText(item.endGroup, ''),
    partNo,
    sapNo,
  ].join('|');
};

// ── 核心解析逻辑 ──────────────────────────────

const parseHarnessSheet = (sheet: SheetDataAccessor, context: { releaseId: string; sortIndex: number }) => {
  const headerMeta = buildHeaderMeta(sheet);
  const harnessNo = toText(headerMeta.harnessNo, sheet.name);
  const headerId = `${context.releaseId}::header::${harnessNo}`;
  const header: BomHeader = {
    headerId,
    releaseId: context.releaseId,
    harnessNo,
    assemblyNo: harnessNo,
    harnessName: headerMeta.harnessName,
    sheetName: sheet.name,
    originSheetName: sheet.name,
    configCode: '',
    sortIndex: context.sortIndex,
    meta: {
      role: 'harness',
      sheetOrderKey: context.sortIndex,
      versionText: headerMeta.versionText,
      projectName: headerMeta.projectName,
      drawVersion: headerMeta.drawVersion,
      quoteDate: headerMeta.quoteDate,
    },
  };

  const items: BomItem[] = [];
  let currentEndGroup = '';
  const rowCount = sheet.rowCount;

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
    const hasMeaningfulPartName = /[A-Za-z一-鿿]/.test(partName);
    const hasMeaningfulUnit = /[A-Za-z一-鿿]/.test(unit);
    if (!partNo && !hasMeaningfulPartName && !(Number.isFinite(quantityValue) && quantityValue > 0) && !hasMeaningfulUnit) {
      continue;
    }

    const functionText = toText(row[2], '');
    currentEndGroup = inferEndGroupFromFunction(functionText, currentEndGroup);
    const item: BomItem = {
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
      sourceSheet: sheet.name,
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

const parseCore = (sheetEntries: { accessor: SheetDataAccessor; sortIndex: number }[], options: BomParseOptions): Omit<ParsedBom, 'sourceSnapshot'> => {
  const releaseId = toText(options.releaseId, `bom-release-${Date.now().toString(36)}`);
  const projectCode = toText(options.projectCode, 'default-project');
  const releaseLabel = toText(options.releaseLabel, releaseId);

  const headers: BomHeader[] = [];
  const items: BomItem[] = [];
  const effectivities: Effectivity[] = [];
  const sheetCatalog: SheetCatalogEntry[] = [];
  const parseWarnings: ParseWarning[] = [];

  sheetEntries.forEach((entry) => {
    const sheetRole = detectSheetRole(entry.accessor.name);
    sheetCatalog.push({
      sheetName: entry.accessor.name,
      sheetRole,
      sortIndex: entry.sortIndex,
    });
    if (sheetRole !== 'harness') {
      return;
    }
    try {
      const parsed = parseHarnessSheet(entry.accessor, { releaseId, sortIndex: entry.sortIndex });
      if (parsed?.header) headers.push(parsed.header);
      items.push(...safeArray(parsed?.items));
      effectivities.push(...safeArray(parsed?.effectivities));
    } catch (error: any) {
      parseWarnings.push({
        sheetName: entry.accessor.name,
        message: error?.message || 'Harness sheet parse failed',
      });
    }
  });

  const releaseMeta = {
    releaseId,
    projectCode,
    releaseLabel,
    workbookName: releaseLabel, // Will be overridden by caller if needed
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
  };
};

// ── 公开解析入口 ──────────────────────────────

/**
 * 解析 xlsx.WorkBook 格式的 BOM
 */
export function parseBomWorkbook(wb: WorkBook, options: BomParseOptions = {}): ParsedBom {
  const sheetEntries = wb.SheetNames.map((name, index) => {
    const ws = wb.Sheets[name];
    const range = utils.decode_range(ws?.['!ref'] || 'A1:A1');
    const accessor: SheetDataAccessor = {
      name,
      rowCount: range.e.r + 1,
      getCellValue: (r, c) => {
        const addr = utils.encode_cell({ r: r - 1, c: c - 1 });
        const cell = ws?.[addr];
        return cell ? cell.v : '';
      },
    };
    return { accessor, sortIndex: index + 1 };
  });

  const result = parseCore(sheetEntries, options) as ParsedBom;
  result.releaseMeta.workbookName = toText(options.releaseLabel, 'Uploaded Workbook');
  return result;
}

/**
 * 解析 Snapshot 格式的 BOM (LuckySheet 等 grid 组件导出格式)
 */
export function parseBomWorkbookSnapshot(snapshot: any, options: BomParseOptions = {}): ParsedBom {
  const sheetOrder = safeArray(snapshot?.sheetOrder);
  const sheetEntries = sheetOrder.map((sheetId, index) => {
    const sheetObj = ensureObject(snapshot?.sheets?.[sheetId]);
    const accessor: SheetDataAccessor = {
      name: toText(sheetObj?.name, sheetId),
      rowCount: Number(sheetObj.rowCount) || 2000,
      getCellValue: (r, c) => {
        const row = ensureObject(sheetObj?.cellData?.[String(r - 1)]);
        const cell = ensureObject(row?.[String(c - 1)]);
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
      },
    };
    return { accessor, sortIndex: index + 1 };
  });

  const result = parseCore(sheetEntries, options) as ParsedBom;
  result.releaseMeta.workbookName = toText(snapshot?.name, result.releaseMeta.releaseLabel);
  result.sourceSnapshot = clonePlain(snapshot, null);
  return result;
}

// ── 增强型 BOM 导入解析 ───────────────────────

export type BomFormat = 'geely' | 'byd' | 'generic' | 'unknown';

export interface BomParseResult {
  format: BomFormat;
  items: (HarnessBomItem | HarnessWireItem)[];
  wireItems: HarnessWireItem[];
  totalRows: number;
  successRows: number;
  skippedRows: number;
  errors: string[];
  warnings: string[];
}

export function detectBomFormat(headers: string[]): BomFormat {
  const headStr = headers.join('|');
  if (headStr.includes('零件号') && headStr.includes('用量') && headStr.includes('序号')) {
    return 'geely';
  }
  if (headStr.includes('PartNumber') && headStr.includes('Category') && headStr.includes('Qty')) {
    return 'byd';
  }
  if (headStr.includes('partNo') || (headStr.includes('partName') && headStr.includes('qty'))) {
    return 'generic';
  }
  return 'unknown';
}

export function parseBomFromRows(rows: any[][], options?: { forceFormat?: BomFormat }): BomParseResult {
  if (rows.length === 0 || !rows[0]) {
    return {
      format: 'unknown',
      items: [],
      wireItems: [],
      totalRows: 0,
      successRows: 0,
      skippedRows: 0,
      errors: ['文件内容为空'],
      warnings: [],
    };
  }

  const headers = rows[0].map(h => String(h || '').trim());
  const format = options?.forceFormat || detectBomFormat(headers);
  const dataRows = rows.slice(1);
  
  const result: BomParseResult = {
    format,
    items: [],
    wireItems: [],
    totalRows: dataRows.length,
    successRows: 0,
    skippedRows: 0,
    errors: [],
    warnings: [],
  };

  dataRows.forEach((row, index) => {
    const rowIdx = index + 2; // 1-based, plus header
    try {
      let item: HarnessBomItem | HarnessWireItem | null = null;

      if (format === 'geely') {
        // 序号, 零件号, 零件名称, 材料, 单位, 用量, 单价
        const partNo = String(row[1] || '').trim();
        const partName = String(row[2] || '').trim();
        const unit = String(row[4] || '个').trim();
        const qty = Number(row[5]) || 0;
        const unitPrice = Number(row[6]) || 0;
        
        if (!partNo && !partName) {
          result.skippedRows++;
          return;
        }

        const category = classifyBomItem({ partName, partNo });
        item = {
          partNo,
          partName,
          itemCategory: category as any,
          qty,
          unit,
          unitPrice,
          amount: qty * unitPrice,
        };
      } else if (format === 'byd') {
        // ItemNo, PartNumber, Description, Material, UOM, Qty, UnitPrice, Category
        const partNo = String(row[1] || '').trim();
        const partName = String(row[2] || '').trim();
        const unit = String(row[4] || '个').trim();
        const qty = Number(row[5]) || 0;
        const unitPrice = Number(row[6]) || 0;
        const rawCategory = String(row[7] || '').toUpperCase();
        
        let category: HarnessBomItem['itemCategory'] = 'other';
        if (rawCategory === 'WIRE') category = 'wire';
        else if (rawCategory === 'CONNECTOR') category = 'connector';
        else if (rawCategory === 'TERMINAL') category = 'terminal';
        else if (rawCategory === 'TUBING' || rawCategory === 'TAPE') category = 'tape_tube';
        else if (rawCategory === 'BRACKET') category = 'bracket_rubber';
        else category = classifyBomItem({ partName, partNo }) as any;

        item = {
          partNo,
          partName,
          itemCategory: category,
          qty,
          unit,
          unitPrice,
          amount: qty * unitPrice,
        };
      } else {
        // Generic: partNo, partName, qty, unitPrice, category, copperWeight, aluminumWeight
        // Find columns by name
        const findColIdx = (names: string[]) => headers.findIndex(h => names.some(n => h.toLowerCase() === n.toLowerCase()));
        const pNoIdx = findColIdx(['partno', '零件号', '物料编号']);
        const pNameIdx = findColIdx(['partname', '物料名称', '名称']);
        const qtyIdx = findColIdx(['qty', '用量', '数量']);
        const priceIdx = findColIdx(['unitprice', '单价']);
        const catIdx = findColIdx(['category', '分类', '类别']);
        const cuIdx = findColIdx(['copperweight', '铜重']);
        const alIdx = findColIdx(['aluminumweight', '铝重']);

        const partNo = pNoIdx !== -1 ? String(row[pNoIdx] || '').trim() : '';
        const partName = pNameIdx !== -1 ? String(row[pNameIdx] || '').trim() : '';
        const qty = qtyIdx !== -1 ? Number(row[qtyIdx]) || 0 : 0;
        const unitPrice = priceIdx !== -1 ? Number(row[priceIdx]) || 0 : 0;
        
        if (!partNo && !partName) {
          result.skippedRows++;
          return;
        }

        let category: HarnessBomItem['itemCategory'] = 'other';
        if (catIdx !== -1) {
          const catStr = String(row[catIdx]).toLowerCase();
          if (catStr.includes('wire') || catStr.includes('导线')) category = 'wire';
          else if (catStr.includes('connector') || catStr.includes('护套')) category = 'connector';
          else if (catStr.includes('terminal') || catStr.includes('端子')) category = 'terminal';
        }
        if (category === 'other') category = classifyBomItem({ partName, partNo }) as any;

        item = {
          partNo,
          partName,
          itemCategory: category,
          qty,
          unit: '个',
          unitPrice,
          amount: qty * unitPrice,
        };

        if (category === 'wire') {
          (item as HarnessWireItem).copperWeightPerUnit = cuIdx !== -1 ? Number(row[cuIdx]) || 0 : 0;
          (item as HarnessWireItem).aluminumWeightPerUnit = alIdx !== -1 ? Number(row[alIdx]) || 0 : 0;
          (item as HarnessWireItem).nonMetalCostPerUnit = 0;
        }
      }

      if (item) {
        if (item.itemCategory === 'wire') {
          // If not generic or missing weights, try to ensure fields exist
          const wireItem = item as HarnessWireItem;
          if (wireItem.copperWeightPerUnit === undefined) wireItem.copperWeightPerUnit = 0;
          if (wireItem.aluminumWeightPerUnit === undefined) wireItem.aluminumWeightPerUnit = 0;
          if (wireItem.nonMetalCostPerUnit === undefined) wireItem.nonMetalCostPerUnit = 0;
          result.wireItems.push(wireItem);
        }
        result.items.push(item);
        result.successRows++;
      }
    } catch (err: any) {
      result.errors.push(`第 ${rowIdx} 行解析出错: ${err.message}`);
    }
  });

  return result;
}

export interface PackagingParseResult {
  items: Record<string, { // keyed by harnessId/partNo
    innerBoxCost: number;
    outerBoxCost: number;
    palletCost: number;
    trayDividerCost: number;
    bubbleWrapCost: number;
    labelCost: number;
  }>;
  totalRows: number;
  successRows: number;
  errors: string[];
}

export function parsePackagingFromRows(rows: any[][]): PackagingParseResult {
  const result: PackagingParseResult = {
    items: {},
    totalRows: Math.max(0, rows.length - 1),
    successRows: 0,
    errors: [],
  };

  if (rows.length < 2) return result;

  const headers = rows[0]?.map(h => String(h || '').trim().toLowerCase()) || [];
  const findColIdx = (names: string[]) => headers.findIndex(h => names.some(n => h.includes(n.toLowerCase())));

  const pNoIdx = findColIdx(['零件号', 'partno', '物料编号', '线束号']);
  const innerIdx = findColIdx(['内盒', '内箱', '周转箱', 'innerbox']);
  const outerIdx = findColIdx(['外箱', '纸箱', 'outerbox']);
  const palletIdx = findColIdx(['托盘', '栈板', 'pallet']);
  const dividerIdx = findColIdx(['隔板', '隔片', 'divider']);
  const wrapIdx = findColIdx(['气泡膜', '缓冲', 'wrap']);
  const labelIdx = findColIdx(['标签', 'label']);

  if (pNoIdx === -1) {
    result.errors.push('未识别到“零件号”列');
    return result;
  }

  const dataRows = rows.slice(1);
  dataRows.forEach((row, index) => {
    const rowIdx = index + 2;
    try {
      const partNo = String(row[pNoIdx] || '').trim();
      if (!partNo) return;

      const innerBoxCost = innerIdx !== -1 ? Number(row[innerIdx]) || 0 : 0;
      const outerBoxCost = outerIdx !== -1 ? Number(row[outerIdx]) || 0 : 0;
      const palletCost = palletIdx !== -1 ? Number(row[palletIdx]) || 0 : 0;
      const trayDividerCost = dividerIdx !== -1 ? Number(row[dividerIdx]) || 0 : 0;
      const bubbleWrapCost = wrapIdx !== -1 ? Number(row[wrapIdx]) || 0 : 0;
      const labelCost = labelIdx !== -1 ? Number(row[labelIdx]) || 0 : 0;

      result.items[partNo] = {
        innerBoxCost,
        outerBoxCost,
        palletCost,
        trayDividerCost,
        bubbleWrapCost,
        labelCost,
      };
      result.successRows++;
    } catch (err: any) {
      result.errors.push(`第 ${rowIdx} 行解析出错: ${err.message}`);
    }
  });

  return result;
}

export interface ProcessHoursParseResult {
  items: Record<string, { // keyed by harnessId/partNo
    frontHours: number;
    backHours: number;
  }>;
  totalRows: number;
  successRows: number;
  errors: string[];
}

export function parseProcessHoursFromRows(rows: any[][]): ProcessHoursParseResult {
  const result: ProcessHoursParseResult = {
    items: {},
    totalRows: Math.max(0, rows.length - 1),
    successRows: 0,
    errors: [],
  };

  if (rows.length < 2) return result;

  const headers = rows[0]?.map(h => String(h || '').trim().toLowerCase()) || [];
  const findColIdx = (names: string[]) => headers.findIndex(h => names.some(n => h.includes(n.toLowerCase())));

  const pNoIdx = findColIdx(['零件号', 'partno', '物料编号', '线束号']);
  const frontIdx = findColIdx(['前工序', '前端', 'fronthours']);
  const backIdx = findColIdx(['后工序', '后端', '总装', 'backhours']);

  if (pNoIdx === -1) {
    result.errors.push('未识别到“零件号”列');
    return result;
  }

  const dataRows = rows.slice(1);
  dataRows.forEach((row, index) => {
    const rowIdx = index + 2;
    try {
      const partNo = String(row[pNoIdx] || '').trim();
      if (!partNo) return;

      const frontHours = frontIdx !== -1 ? Number(row[frontIdx]) || 0 : 0;
      const backHours = backIdx !== -1 ? Number(row[backIdx]) || 0 : 0;

      result.items[partNo] = {
        frontHours,
        backHours,
      };
      result.successRows++;
    } catch (err: any) {
      result.errors.push(`第 ${rowIdx} 行解析出错: ${err.message}`);
    }
  });

  return result;
}
