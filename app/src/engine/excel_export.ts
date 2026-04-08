/**
 * Excel 报价导出模块 (SheetJS)
 *
 * 功能:
 *   1. 导出吉利报价模板格式 Excel
 *   2. 导出内部核算明细 Excel
 *   3. 导出设变报价对比 Excel
 */

import * as XLSX from 'xlsx';
import type { HarnessResult, ProjectHarnessResult, InternalHarnessResult } from '@/types/harness';
import type {
  GeelyTemplateResult,
  BydTemplateResult,
  GenericTemplateResult,
  TemplateType,
  ChangePricingResult,
  MetalEscalationResult as MetalEscalationResultType,
  AnnualDropResult,
} from '@/types/quote';
import { mapToGeelyTemplate, mapToBydTemplate, mapToGenericTemplate, mapInternalToOem } from './quote_template';
import { numberOr } from './shared_utils';

// ── 通用工具 ──

function fmtCurrency(val: number): string {
  return `¥${val.toFixed(2)}`;
}

function toFixed2(val: number): number {
  return Math.round(val * 100) / 100;
}

/**
 * 触发浏览器下载
 */
function downloadWorkbook(wb: XLSX.WorkBook, filename: string): void {
  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 200);
}

// ── 1. 吉利报价模板导出 ──

const GEELY_HEADERS = [
  '零件号', '名称', '装车比',
  'A1 原材料', 'A2 外购件',
  'B1 加工费', 'B2 废品',
  'C1 管理费', 'C2 财务费', 'C3 销售费',
  'D 利润',
  '出厂价',
  'E 工装分摊', 'F 试验分摊', 'G 研发分摊',
  '到厂价',
];

function geelyToRow(g: GeelyTemplateResult): (string | number)[] {
  return [
    g.harnessId,
    g.harnessName,
    numberOr(g.rates?.wasteRate, 0), // placeholder — vehicleRatio not on GeelyTemplateResult
    toFixed2(g.A1_rawMaterial),
    toFixed2(g.A2_purchasedParts),
    toFixed2(g.B1_processingFee),
    toFixed2(g.B2_wasteLoss),
    toFixed2(g.C1_managementFee),
    toFixed2(g.C2_financeFee),
    toFixed2(g.C3_salesFee),
    toFixed2(g.D_profit),
    toFixed2(g.exFactoryPrice),
    toFixed2(g.E1_borrowedTooling + g.E2_newTooling),
    toFixed2(g.F1_borrowedTesting + g.F2_newTesting),
    toFixed2(g.G1_borrowedRnd + g.G2_newRnd),
    toFixed2(g.deliveredPrice),
  ];
}

/**
 * 导出吉利报价模板 Excel
 */
export function exportGeelyQuoteExcel(
  harnessResults: HarnessResult[],
  projectName: string,
  customer: string,
): void {
  const geelyResults = harnessResults.map(h => mapToGeelyTemplate(h));

  const rows: (string | number)[][] = [];

  // 标题行
  rows.push([`${customer} — ${projectName} — 高压线束报价明细`]);
  rows.push([]);

  // 费率说明
  rows.push(['费率说明:', '管理费4%', '财务费4%', '销售费4%', '利润4%', '废品率1%']);
  rows.push([]);

  // 表头
  rows.push(GEELY_HEADERS);

  // 数据行 — 用 vehicleRatio 替换 wasteRate 占位
  for (let i = 0; i < harnessResults.length; i++) {
    const row = geelyToRow(geelyResults[i]!);
    // 替换第3列为 vehicleRatio
    row[2] = harnessResults[i]!.vehicleRatio;
    rows.push(row);
  }

  // 合计行
  const totals: (string | number)[] = ['合计', '', '—'];
  const numCols = GEELY_HEADERS.length;
  for (let c = 3; c < numCols; c++) {
    let sum = 0;
    for (let r = 0; r < geelyResults.length; r++) {
      const row = geelyToRow(geelyResults[r]!);
      row[2] = harnessResults[r]!.vehicleRatio;
      sum += numberOr(row[c] as number, 0);
    }
    totals.push(toFixed2(sum));
  }
  rows.push(totals);

  // 生成工作表
  const ws = XLSX.utils.aoa_to_sheet(rows);

  // 设置列宽
  ws['!cols'] = [
    { wch: 14 }, // 零件号
    { wch: 24 }, // 名称
    { wch: 8 },  // 装车比
    { wch: 12 }, { wch: 12 }, // A1, A2
    { wch: 12 }, { wch: 10 }, // B1, B2
    { wch: 10 }, { wch: 10 }, { wch: 10 }, // C1, C2, C3
    { wch: 10 }, // D
    { wch: 12 }, // 出厂价
    { wch: 12 }, { wch: 12 }, { wch: 12 }, // E, F, G
    { wch: 12 }, // 到厂价
  ];

  // 合并标题行
  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: numCols - 1 } },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '报价模板');

  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  downloadWorkbook(wb, `${projectName}_吉利报价模板_${date}.xlsx`);
}

// ── 1.1 比亚迪报价模板导出 ──

const BYD_HEADERS = [
  '零件号', '名称', '直接材料', '加工费', '废品', '管理费(6%)', '利润(5%)', '出厂价', '包装费', '运输费', '到厂价'
];

function bydToRow(b: BydTemplateResult): (string | number)[] {
  return [
    b.harnessId,
    b.harnessName,
    toFixed2(b.directMaterial),
    toFixed2(b.processingFee),
    toFixed2(b.wasteLoss),
    toFixed2(b.managementFee),
    toFixed2(b.profit),
    toFixed2(b.exFactoryPrice),
    toFixed2(b.packagingCost),
    toFixed2(b.freightCost),
    toFixed2(b.deliveredPrice),
  ];
}

export function exportBydQuoteExcel(
  harnessResults: HarnessResult[],
  projectName: string,
  customer: string,
): void {
  const bydResults = harnessResults.map(h => mapToBydTemplate(h));
  const rows: (string | number)[][] = [];

  rows.push([`${customer} — ${projectName} — 比亚迪报价明细`]);
  rows.push([]);
  rows.push(['结构: 直接材料 + 加工费 + 废品 + 管理费(6%) + 利润(5%)']);
  rows.push([]);
  rows.push(BYD_HEADERS);

  for (const b of bydResults) {
    rows.push(bydToRow(b));
  }

  const totals: (string | number)[] = ['合计', ''];
  for (let c = 2; c < BYD_HEADERS.length; c++) {
    let sum = 0;
    for (const b of bydResults) {
      const r = bydToRow(b);
      sum += numberOr(r[c] as number, 0);
    }
    totals.push(toFixed2(sum));
  }
  rows.push(totals);

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = BYD_HEADERS.map(() => ({ wch: 14 }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'BYD报价');

  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  downloadWorkbook(wb, `${projectName}_BYD报价模板_${date}.xlsx`);
}

// ── 1.2 通用报价模板导出 ──

const GENERIC_HEADERS = [
  '零件号', '名称', '材料成本', '人工', '制造', '废品', '管理费', '利润', '出厂价', '包装费', '运输费', '到厂价'
];

function genericToRow(g: GenericTemplateResult): (string | number)[] {
  return [
    g.harnessId,
    g.harnessName,
    toFixed2(g.materialCost),
    toFixed2(g.laborCost),
    toFixed2(g.mfgCost),
    toFixed2(g.wasteCost),
    toFixed2(g.mgmtFee),
    toFixed2(g.profit),
    toFixed2(g.exFactoryPrice),
    toFixed2(g.packagingCost),
    toFixed2(g.freightCost),
    toFixed2(g.deliveredPrice),
  ];
}

export function exportGenericQuoteExcel(
  harnessResults: HarnessResult[],
  projectName: string,
  customer: string,
): void {
  const genericResults = harnessResults.map(h => mapToGenericTemplate(h));
  const rows: (string | number)[][] = [];

  rows.push([`${customer} — ${projectName} — 通用报价明细`]);
  rows.push([]);
  rows.push(GENERIC_HEADERS);

  for (const g of genericResults) {
    rows.push(genericToRow(g));
  }

  const totals: (string | number)[] = ['合计', ''];
  for (let c = 2; c < GENERIC_HEADERS.length; c++) {
    let sum = 0;
    for (const g of genericResults) {
      const r = genericToRow(g);
      sum += numberOr(r[c] as number, 0);
    }
    totals.push(toFixed2(sum));
  }
  rows.push(totals);

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = GENERIC_HEADERS.map(() => ({ wch: 14 }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '通用报价');

  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  downloadWorkbook(wb, `${projectName}_通用报价模板_${date}.xlsx`);
}

// ── 2. 内部核算明细导出 ──

const INTERNAL_HEADERS = [
  '零件号', '名称', '装车比',
  '铜重(kg)', '铝重(kg)', '工时(h)',
  '材料成本', '废品', '直接人工', '制造费',
  '管理费', '利润', '出厂价',
  '包装费', '运输费', '到厂价',
];

/**
 * 导出内部核算明细 Excel
 */
export function exportInternalCostExcel(
  harnessResults: HarnessResult[],
  projectSummary: ProjectHarnessResult,
  projectName: string,
): void {
  const rows: (string | number)[][] = [];

  // 标题
  rows.push([`${projectName} — 内部核算明细`]);
  rows.push([]);

  // KPI
  rows.push([
    '单车成本:', fmtCurrency(projectSummary.vehicleCost),
    '', '线束数:', projectSummary.harnessCount,
    '', '总铜重:', `${projectSummary.totalCopperWeight.toFixed(4)} kg`,
  ]);
  rows.push([]);

  // 表头
  rows.push(INTERNAL_HEADERS);

  // 数据行
  for (const h of harnessResults) {
    rows.push([
      h.harnessId,
      h.harnessName,
      h.vehicleRatio,
      toFixed2(h.copperWeight * 1000) / 1000, // 保留3位
      toFixed2(h.aluminumWeight * 1000) / 1000,
      toFixed2(h.processHours * 10000) / 10000,
      toFixed2(h.materialCost),
      toFixed2(h.wasteCost),
      toFixed2(h.directLabor),
      toFixed2(h.manufacturing),
      toFixed2(h.mgmtFee),
      toFixed2(h.profit),
      toFixed2(h.exFactoryPrice),
      toFixed2(h.packSubtotal),
      toFixed2(h.freightSubtotal),
      toFixed2(h.deliveredPrice),
    ]);
  }

  // 合计行 (加权汇总)
  rows.push([
    '加权合计', '', '—',
    '', '', '',
    toFixed2(projectSummary.weightedMaterial),
    toFixed2(projectSummary.weightedWaste),
    toFixed2(projectSummary.weightedLabor),
    toFixed2(projectSummary.weightedMfg),
    toFixed2(projectSummary.weightedMgmtFee),
    toFixed2(projectSummary.weightedProfit),
    toFixed2(projectSummary.weightedExFactory),
    toFixed2(projectSummary.weightedPack),
    toFixed2(projectSummary.weightedFreight),
    toFixed2(projectSummary.vehicleCost),
  ]);

  // 生成工作表
  const ws = XLSX.utils.aoa_to_sheet(rows);

  ws['!cols'] = [
    { wch: 14 }, { wch: 24 }, { wch: 8 },
    { wch: 10 }, { wch: 10 }, { wch: 10 },
    { wch: 12 }, { wch: 10 }, { wch: 12 }, { wch: 12 },
    { wch: 10 }, { wch: 10 }, { wch: 12 },
    { wch: 10 }, { wch: 10 }, { wch: 12 },
  ];

  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: INTERNAL_HEADERS.length - 1 } },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '核算明细');

  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  downloadWorkbook(wb, `${projectName}_核算明细_${date}.xlsx`);
}

// ── 3. 设变报价导出 ──

const CHANGE_HEADERS = [
  '零件号', '名称', '变更类型',
  '定点价', '变更后', '差异', '差异%',
];

/**
 * 导出设变报价对比 Excel
 */
export function exportChangeComparisonExcel(
  changeData: {
    rows: Array<{
      harnessId: string;
      harnessName: string;
      changeCategory: string;
      beforePrice: number;
      afterPrice: number;
      deltaPrice: number;
      deltaPercent: number;
    }>;
    totals: {
      beforePrice: number;
      afterPrice: number;
      deltaPrice: number;
      deltaPercent: number;
    };
  },
  changeType: string,
  projectName: string,
): void {
  const rows: (string | number)[][] = [];

  rows.push([`${projectName} — 设变报价对比 (${changeType})`]);
  rows.push([]);

  rows.push(CHANGE_HEADERS);

  for (const row of changeData.rows) {
    rows.push([
      row.harnessId,
      row.harnessName,
      row.changeCategory,
      toFixed2(row.beforePrice),
      toFixed2(row.afterPrice),
      toFixed2(row.deltaPrice),
      `${row.deltaPercent.toFixed(2)}%`,
    ]);
  }

  // 合计
  rows.push([
    '单车影响', '', '',
    toFixed2(changeData.totals.beforePrice),
    toFixed2(changeData.totals.afterPrice),
    toFixed2(changeData.totals.deltaPrice),
    `${changeData.totals.deltaPercent.toFixed(2)}%`,
  ]);

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [
    { wch: 14 }, { wch: 24 }, { wch: 10 },
    { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 10 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '设变对比');

  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  downloadWorkbook(wb, `${projectName}_设变报价_${changeType}_${date}.xlsx`);
}

// ── 4. 综合报价导出 (多Sheet) ──

/**
 * 导出综合报价 Excel (含报价模板 + 核算明细两个Sheet)
 */
export function exportFullQuoteExcel(
  harnessResults: HarnessResult[],
  projectSummary: ProjectHarnessResult,
  projectName: string,
  customer: string,
  templateType: TemplateType = 'geely',
): void {
  const wb = XLSX.utils.book_new();

  // Sheet 1: 报价模板 (根据类型)
  let ws1;
  if (templateType === 'byd') {
    const bydResults = harnessResults.map(h => mapToBydTemplate(h));
    const rows: (string | number)[][] = [];
    rows.push([`${customer} — ${projectName} — 比亚迪报价明细`]);
    rows.push([]);
    rows.push(BYD_HEADERS);
    for (const b of bydResults) rows.push(bydToRow(b));
    ws1 = XLSX.utils.aoa_to_sheet(rows);
    ws1['!cols'] = BYD_HEADERS.map(() => ({ wch: 13 }));
  } else if (templateType === 'generic') {
    const genericResults = harnessResults.map(h => mapToGenericTemplate(h));
    const rows: (string | number)[][] = [];
    rows.push([`${customer} — ${projectName} — 通用报价明细`]);
    rows.push([]);
    rows.push(GENERIC_HEADERS);
    for (const g of genericResults) rows.push(genericToRow(g));
    ws1 = XLSX.utils.aoa_to_sheet(rows);
    ws1['!cols'] = GENERIC_HEADERS.map(() => ({ wch: 13 }));
  } else {
    // Default: Geely
    const geelyResults = harnessResults.map(h => mapToGeelyTemplate(h));
    const geelyRows: (string | number)[][] = [];
    geelyRows.push([`${customer} — ${projectName} — 高压线束报价明细`]);
    geelyRows.push([]);
    geelyRows.push(GEELY_HEADERS);
    for (let i = 0; i < harnessResults.length; i++) {
      const row = geelyToRow(geelyResults[i]!);
      row[2] = harnessResults[i]!.vehicleRatio;
      geelyRows.push(row);
    }
    ws1 = XLSX.utils.aoa_to_sheet(geelyRows);
    ws1['!cols'] = GEELY_HEADERS.map(() => ({ wch: 13 }));
  }
  
  XLSX.utils.book_append_sheet(wb, ws1, '报价模板');

  // Sheet 2: 内部核算
  const internalRows: (string | number)[][] = [];
  internalRows.push([`${projectName} — 核算明细`]);
  internalRows.push([]);
  internalRows.push(INTERNAL_HEADERS);
  for (const h of harnessResults) {
    internalRows.push([
      h.harnessId, h.harnessName, h.vehicleRatio,
      h.copperWeight, h.aluminumWeight, h.processHours,
      toFixed2(h.materialCost), toFixed2(h.wasteCost),
      toFixed2(h.directLabor), toFixed2(h.manufacturing),
      toFixed2(h.mgmtFee), toFixed2(h.profit), toFixed2(h.exFactoryPrice),
      toFixed2(h.packSubtotal), toFixed2(h.freightSubtotal), toFixed2(h.deliveredPrice),
    ]);
  }
  internalRows.push([
    '单车合计', '', '',
    '', '', '',
    toFixed2(projectSummary.weightedMaterial),
    toFixed2(projectSummary.weightedWaste),
    toFixed2(projectSummary.weightedLabor),
    toFixed2(projectSummary.weightedMfg),
    toFixed2(projectSummary.weightedMgmtFee),
    toFixed2(projectSummary.weightedProfit),
    toFixed2(projectSummary.weightedExFactory),
    toFixed2(projectSummary.weightedPack),
    toFixed2(projectSummary.weightedFreight),
    toFixed2(projectSummary.vehicleCost),
  ]);
  const ws2 = XLSX.utils.aoa_to_sheet(internalRows);
  ws2['!cols'] = INTERNAL_HEADERS.map(() => ({ wch: 13 }));
  XLSX.utils.book_append_sheet(wb, ws2, '核算明细');

  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  downloadWorkbook(wb, `${projectName}_综合报价_${date}.xlsx`);
}

/**
 * 导出年降与联动分析 Excel
 */
export function exportAnnualDropExcel(
  projectName: string,
  annualDropData: Array<{
    year: number;
    dropRate: number;
    deliveredPrice: number;
    cumulativeDropPercent: number;
  }>,
  combinedData: Array<{
    year: number;
    annualDropPrice: number;
    metalAdjustment: number;
    finalDeliveredPrice: number;
    totalDeltaAmount: number;
  }>,
  harnessResults: HarnessResult[],
  baseDeliveredPrice: number
): void {
  const wb = XLSX.utils.book_new();

  // Sheet 1: 年降合同
  const sheet1Rows: (string | number)[][] = [
    ['年度', '年降率 (%)', '累计降幅 (%)', '年降后单车到厂价 (元)']
  ];
  annualDropData.forEach(row => {
    sheet1Rows.push([
      `Year ${row.year}`,
      row.year === 1 ? '—' : row.dropRate,
      toFixed2(row.cumulativeDropPercent),
      toFixed2(row.deliveredPrice)
    ]);
  });
  const ws1 = XLSX.utils.aoa_to_sheet(sheet1Rows);
  ws1['!cols'] = [{ wch: 12 }, { wch: 15 }, { wch: 15 }, { wch: 25 }];
  XLSX.utils.book_append_sheet(wb, ws1, '年降合同');

  // Sheet 2: 综合影响
  const sheet2Rows: (string | number)[][] = [
    ['年度', '年降到厂价 (元)', '金属联动调整 (元)', '综合到厂价 (元)', '综合变化金额 (元)']
  ];
  combinedData.forEach(row => {
    sheet2Rows.push([
      `Year ${row.year}`,
      toFixed2(row.annualDropPrice),
      toFixed2(row.metalAdjustment),
      toFixed2(row.finalDeliveredPrice),
      toFixed2(row.totalDeltaAmount)
    ]);
  });
  const ws2 = XLSX.utils.aoa_to_sheet(sheet2Rows);
  ws2['!cols'] = [{ wch: 12 }, { wch: 20 }, { wch: 20 }, { wch: 20 }, { wch: 20 }];
  XLSX.utils.book_append_sheet(wb, ws2, '综合影响');

  // Sheet 3: 线束明细
  const yearHeaders = annualDropData.map(d => `Year ${d.year} 价格`);
  const sheet3Headers = ['零件号', '名称', '基准到厂价 (元)', ...yearHeaders];
  const sheet3Rows: (string | number)[][] = [sheet3Headers];

  harnessResults.forEach(h => {
    const row: (string | number)[] = [h.harnessId, h.harnessName, h.deliveredPrice];
    annualDropData.forEach(d => {
      const yearFactor = d.deliveredPrice / baseDeliveredPrice;
      row.push(toFixed2(h.deliveredPrice * yearFactor));
    });
    sheet3Rows.push(row);
  });
  const ws3 = XLSX.utils.aoa_to_sheet(sheet3Rows);
  ws3['!cols'] = [
    { wch: 15 }, 
    { wch: 25 }, 
    { wch: 15 }, 
    ...annualDropData.map(() => ({ wch: 15 }))
  ];
  XLSX.utils.book_append_sheet(wb, ws3, '线束明细');

  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  downloadWorkbook(wb, `${projectName}_年降分析_${date}.xlsx`);
}

/**
 * 导出设变报价对比 Excel
 */
export function exportChangePricingExcel(
  changePricingResult: ChangePricingResult,
  _baselineResults: HarnessResult[],
  projectName: string,
  customer: string,
  annualDropData?: AnnualDropResult[]
): void {
  const wb = XLSX.utils.book_new();

  // Sheet 1: 变更摘要
  const summaryRows: (string | number)[][] = [
    ["设变报价摘要"],
    [],
    ["项目名称", projectName],
    ["客户名称", customer],
    ["变更类型", changePricingResult.changeType],
    ["时间戳", changePricingResult.timestamp],
    [],
    ["定点单车总价", toFixed2(changePricingResult.summary.totalBefore)],
    ["变更后单车总价", toFixed2(changePricingResult.summary.totalAfter)],
    ["差异金额", toFixed2(changePricingResult.summary.totalDelta)],
    ["差异比例", `${changePricingResult.summary.deltaPercent.toFixed(2)}%`],
    ["受影响线束数量", changePricingResult.summary.affectedCount],
  ];
  const ws1 = XLSX.utils.aoa_to_sheet(summaryRows);
  ws1["!cols"] = [{ wch: 15 }, { wch: 25 }];
  XLSX.utils.book_append_sheet(wb, ws1, "变更摘要");

  // Sheet 2: 逐件对比
  const comparisonHeaders = [
    "零件号", "名称", "变更类型", 
    "定点材料", "变更材料", "Δ材料", 
    "定点废品", "变更废品", "Δ废品", 
    "定点人工", "变更人工", "Δ人工", 
    "定点制造", "变更制造", "Δ制造", 
    "定点管理", "变更管理", "Δ管理", 
    "定点利润", "变更利润", "Δ利润", 
    "定点出厂", "变更出厂", "Δ出厂", 
    "定点到厂", "变更到厂", "Δ到厂", 
    "差异%"
  ];
  const comparisonRows: (string | number)[][] = [comparisonHeaders];
  
  changePricingResult.changes.forEach(item => {
    const before = item.before || ({} as Partial<HarnessResult>);
    const after = item.after || ({} as Partial<HarnessResult>);
    const delta = item.delta;
    
    const row = [
      item.harnessId,
      item.harnessName,
      item.changeCategory === 'add' ? '新增' : item.changeCategory === 'remove' ? '删除' : '变更',
      
      toFixed2(before.materialCost || 0), toFixed2(after.materialCost || 0), toFixed2(delta.materialCost),
      toFixed2(before.wasteCost || 0), toFixed2(after.wasteCost || 0), toFixed2(delta.wasteCost),
      toFixed2(before.directLabor || 0), toFixed2(after.directLabor || 0), toFixed2(delta.directLabor),
      toFixed2(before.manufacturing || 0), toFixed2(after.manufacturing || 0), toFixed2(delta.manufacturing),
      toFixed2(before.mgmtFee || 0), toFixed2(after.mgmtFee || 0), toFixed2(delta.mgmtFee),
      toFixed2(before.profit || 0), toFixed2(after.profit || 0), toFixed2(delta.profit),
      toFixed2(before.exFactoryPrice || 0), toFixed2(after.exFactoryPrice || 0), toFixed2(delta.exFactoryPrice),
      toFixed2(before.deliveredPrice || 0), toFixed2(after.deliveredPrice || 0), toFixed2(delta.deliveredPrice),
      
      before.deliveredPrice ? `${((delta.deliveredPrice / before.deliveredPrice) * 100).toFixed(2)}%` : 'N/A'
    ];
    comparisonRows.push(row);
  });
  
  const ws2 = XLSX.utils.aoa_to_sheet(comparisonRows);
  ws2["!cols"] = comparisonHeaders.map((_, i) => ({ wch: i === 0 ? 15 : i === 1 ? 20 : 12 }));
  XLSX.utils.book_append_sheet(wb, ws2, "逐件对比");

  // Sheet 3: 年度影响
  if (annualDropData && annualDropData.length > 0) {
    const annualHeaders = ["年度", "到厂价", "降幅", "累计降幅%"];
    const annualRows: (string | number)[][] = [annualHeaders];
    annualDropData.forEach(d => {
      annualRows.push([
        `Year ${d.year}`,
        toFixed2(d.deliveredPrice),
        toFixed2(d.dropFromBase),
        `${d.dropPercent.toFixed(2)}%`
      ]);
    });
    const ws3 = XLSX.utils.aoa_to_sheet(annualRows);
    ws3["!cols"] = annualHeaders.map(() => ({ wch: 15 }));
    XLSX.utils.book_append_sheet(wb, ws3, "年度影响");
  }

  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  downloadWorkbook(wb, `${projectName}_设变报价_${date}.xlsx`);
}

/**
 * exportOemQuoteFromInternal — 内部实绩映射至 OEM 报价单 (吉利/比亚迪/长城等)
 * 集成了 @翁骏 (销售) 提供的 V3.0 映射逻辑
 */
export function exportOemQuoteFromInternal(
  internalResults: InternalHarnessResult[],
  oemType: 'Geely' | 'BYD' | 'GreatWall',
  projectName: string
): void {
  const oemRows = internalResults.map(h => mapInternalToOem(h, oemType));
  const wb = XLSX.utils.book_new();

  // 映射逻辑字段定义
  let headers: string[] = [];
  let rows: any[][] = [];

  if (oemType === 'Geely') {
    headers = ['零件号', '名称', '原材料(A1)', '外购件(A2)', '加工费(B1)', '废品损失(B2)', '管理费(C1)', '利润(D)', '出厂价', '到厂价', 'Audit_Trace_ID'];
    rows = oemRows.map(r => [
      r.harnessId, r.harnessName, 
      toFixed2(r.A1_rawMaterial), toFixed2(r.A2_purchasedParts), 
      toFixed2(r.B1_processingFee), toFixed2(r.B2_wasteLoss), 
      toFixed2(r.C1_managementFee), toFixed2(r.D_profit), 
      toFixed2(r.exFactoryPrice), toFixed2(r.deliveredPrice), 
      r.auditTraceId || 'N/A'
    ]);
  } else if (oemType === 'BYD') {
    headers = ['零件号', '名称', '直接材料(All-in)', '加工费', '管理费', '利润', '出厂价', '到厂价', 'Audit_Trace_ID'];
    rows = oemRows.map(r => [
      r.harnessId, r.harnessName, 
      toFixed2(r.directMaterial), toFixed2(r.processingFee), 
      toFixed2(r.managementFee), toFixed2(r.profit), 
      toFixed2(r.exFactoryPrice), toFixed2(r.deliveredPrice), 
      r.auditTraceId || 'N/A'
    ]);
  } else {
    // 通用逻辑
    headers = ['零件号', '名称', '实绩总成本', '建议报价(实绩*1.1)', '备注'];
    rows = internalResults.map(h => [
      h.harnessId, h.harnessName, toFixed2(h.internalCost), toFixed2(h.internalCost * 1.1), h.deviationAnalysis || ''
    ]);
  }

  const metaRows = [
    ['[CONFIDENTIAL] 内部秘密 - G281 汽车线束精算模型'],
    [`项目: ${projectName}`, `导出日期: ${new Date().toLocaleDateString()}`],
    [`审计 Trace ID: ${internalResults[0]?.auditTraceId || 'N/A'}`],
    []
  ];

  const ws = XLSX.utils.aoa_to_sheet([...metaRows, headers, ...rows]);
  XLSX.utils.book_append_sheet(wb, ws, `${oemType} V3.0 映射`);
  
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  downloadWorkbook(wb, `${projectName}_${oemType}_V3.0_Quote_${date}.xlsx`);
}

/**
 * 导出金属联动分析 Excel
 */
export function exportMetalEscalationExcel(
  _result: MetalEscalationResultType,
  _projectName: string,
  _customer: string,
) {
  // Placeholder for metal escalation export logic
  console.log("Metal escalation export not yet implemented.");
}