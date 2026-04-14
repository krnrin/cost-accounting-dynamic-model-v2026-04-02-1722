/**
 * Excel 导出模块 (SheetJS)
 *
 * 功能:
 *   1. 导出内部核算明细 Excel
 *   2. 导出设变报价对比 Excel
 *   3. 导出年降分析 Excel
 */

import * as XLSX from 'xlsx';
import type { HarnessResult, ProjectHarnessResult } from '@/types/harness';
import type {
  ChangePricingResult,
  AnnualDropResult,
} from '@/types/quote';
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

// ── 1. 内部核算明细导出 ──

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
      toFixed2(h.copperWeight * 1000) / 1000,
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

  // 合计行
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

// ── 2. 设变报价对比导出 ──

const CHANGE_HEADERS = [
  '零件号', '名称', '变更类型',
  '定点价', '变更后', '差异', '差异%',
];

/**
 * 导出设变报价对比 Excel (简版)
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

// ── 3. 年降分析导出 ──

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
      const yearFactor = baseDeliveredPrice > 0 ? d.deliveredPrice / baseDeliveredPrice : 1;
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

// ── 4. 设变报价详细导出 ──

/**
 * 导出设变报价对比 Excel (详版，含多Sheet)
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
    ['设变报价摘要'],
    [],
    ['项目名称', projectName],
    ['客户名称', customer],
    ['变更类型', changePricingResult.changeType],
    ['时间戳', changePricingResult.timestamp],
    [],
    ['定点单车总价', toFixed2(changePricingResult.summary.totalBefore)],
    ['变更后单车总价', toFixed2(changePricingResult.summary.totalAfter)],
    ['差异金额', toFixed2(changePricingResult.summary.totalDelta)],
    ['差异比例', `${changePricingResult.summary.deltaPercent.toFixed(2)}%`],
    ['受影响线束数量', changePricingResult.summary.affectedCount],
  ];
  const ws1 = XLSX.utils.aoa_to_sheet(summaryRows);
  ws1['!cols'] = [{ wch: 15 }, { wch: 25 }];
  XLSX.utils.book_append_sheet(wb, ws1, '变更摘要');

  // Sheet 2: 逐件对比
  const comparisonHeaders = [
    '零件号', '名称', '变更类型',
    '定点材料', '变更材料', 'Δ材料',
    '定点废品', '变更废品', 'Δ废品',
    '定点人工', '变更人工', 'Δ人工',
    '定点制造', '变更制造', 'Δ制造',
    '定点管理', '变更管理', 'Δ管理',
    '定点利润', '变更利润', 'Δ利润',
    '定点出厂', '变更出厂', 'Δ出厂',
    '定点到厂', '变更到厂', 'Δ到厂',
    '差异%'
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
  ws2['!cols'] = comparisonHeaders.map((_, i) => ({ wch: i === 0 ? 15 : i === 1 ? 20 : 12 }));
  XLSX.utils.book_append_sheet(wb, ws2, '逐件对比');

  // Sheet 3: 年度影响
  if (annualDropData && annualDropData.length > 0) {
    const annualHeaders = ['年度', '到厂价', '降幅', '累计降幅%'];
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
    ws3['!cols'] = annualHeaders.map(() => ({ wch: 15 }));
    XLSX.utils.book_append_sheet(wb, ws3, '年度影响');
  }

  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  downloadWorkbook(wb, `${projectName}_设变报价_${date}.xlsx`);
}
