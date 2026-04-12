import PDFDocument from 'pdfkit';
import * as XLSX from 'xlsx';
import prisma from '../lib/prisma.js';
import { fromJson } from '../lib/json.js';

type ExportType = 'excel' | 'pdf';
type ResourceType = 'project' | 'quote';

type ExportPayload = {
  projectId?: string;
  quoteId?: string;
};

type ExportFile = {
  buffer: Buffer;
  filename: string;
  contentType: string;
};

type JsonObject = Record<string, any>;

type HarnessInput = {
  bom?: Array<{ amount?: number; qty?: number; unitPrice?: number; itemCategory?: string }>;
};

function sanitizeFileName(value: string) {
  return value.replace(/[\\/:*?"<>|\s]+/g, '_');
}

function formatCurrency(value: number) {
  return `¥${Number(value || 0).toFixed(2)}`;
}

function formatDate(value?: Date | string | null) {
  if (!value) return '-';
  return new Date(value).toLocaleString('zh-CN', { hour12: false });
}

function buildFilename(baseName: string, extension: string) {
  const date = new Date().toISOString().slice(0, 10);
  return `${sanitizeFileName(baseName)}_${date}.${extension}`;
}

function jsonText(value: unknown) {
  return JSON.stringify(value ?? {}, null, 2);
}

function worksheetFromRows(rows: Array<Array<string | number>>) {
  const sheet = XLSX.utils.aoa_to_sheet(rows);
  sheet['!cols'] = rows[0]?.map((cell) => ({ wch: Math.max(String(cell).length + 4, 14) })) ?? [];
  return sheet;
}

async function loadProjectBundle(projectId: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      harnesses: { orderBy: { harnessId: 'asc' } },
      scenarios: { orderBy: { createdAt: 'asc' } },
      quotes: { orderBy: { createdAt: 'desc' } },
      allocations: { orderBy: { createdAt: 'asc' } },
      versions: { orderBy: { versionNumber: 'desc' } },
    },
  });

  if (!project) {
    const err: any = new Error('Project not found');
    err.status = 404;
    throw err;
  }

  const costRates = fromJson<JsonObject>(project.costRates, {});
  const metalPrices = fromJson<JsonObject>(project.metalPrices, {});
  const volumes = fromJson<JsonObject>(project.volumes, {});

  const harnessRows = project.harnesses.map((harness) => {
    const input = fromJson<HarnessInput>(harness.input, {});
    const bom = Array.isArray(input.bom) ? input.bom : [];
    const bomCost = bom.reduce((sum, row) => sum + Number(row.amount ?? Number(row.qty || 0) * Number(row.unitPrice || 0)), 0);
    return {
      harnessId: harness.harnessId,
      harnessName: harness.harnessName,
      scenarioId: harness.scenarioId ?? '-',
      bomCount: bom.length,
      bomCost,
      updatedAt: harness.updatedAt,
    };
  });

  const quoteRows = project.quotes.map((quote) => ({
    id: quote.id,
    version: quote.version,
    scenarioId: quote.scenarioId ?? '-',
    harnessId: quote.harnessId ?? '-',
    status: quote.status,
    template: quote.template,
    internalCostBaseline: quote.internalCostBaseline,
    exWorksPrice: quote.exWorksPrice,
    arrivalPrice: quote.arrivalPrice,
    effectivePrice: quote.effectivePrice,
    profitGap: quote.profitGap,
    updatedAt: quote.updatedAt,
  }));

  const allocationRows = project.allocations.map((allocation) => ({
    id: allocation.id,
    scenarioId: allocation.scenarioId,
    harnessId: allocation.harnessId,
    expenseName: allocation.expenseName,
    burdenSide: allocation.burdenSide,
    pricingEffect: allocation.pricingEffect,
    totalAmount: allocation.totalAmount,
    unitAllocation: allocation.unitAllocation,
    recoveryProgress: allocation.recoveryProgress,
    status: allocation.status,
  }));

  const summary = {
    projectId: project.id,
    projectCode: project.projectCode,
    projectName: project.projectName,
    customer: project.customer,
    platform: project.platform ?? '-',
    status: project.status,
    harnessCount: harnessRows.length,
    scenarioCount: project.scenarios.length,
    quoteCount: quoteRows.length,
    allocationCount: allocationRows.length,
    versionCount: project.versions.length,
    totalBomCost: harnessRows.reduce((sum, row) => sum + row.bomCost, 0),
    latestEffectivePrice: quoteRows[0]?.effectivePrice ?? 0,
    latestProfitGap: quoteRows[0]?.profitGap ?? 0,
    updatedAt: project.updatedAt,
  };

  return { project, costRates, metalPrices, volumes, harnessRows, quoteRows, allocationRows, summary };
}

async function loadQuoteBundle(quoteId: string) {
  const quote = await prisma.quote.findUnique({ where: { id: quoteId } });
  if (!quote) {
    const err: any = new Error('Quote not found');
    err.status = 404;
    throw err;
  }

  const project = await prisma.project.findUnique({ where: { id: quote.projectId } });
  if (!project) {
    const err: any = new Error('Project not found');
    err.status = 404;
    throw err;
  }

  const harness = quote.harnessId
    ? await prisma.harness.findFirst({ where: { projectId: quote.projectId, harnessId: quote.harnessId } })
    : null;
  const scenario = quote.scenarioId
    ? await prisma.scenario.findUnique({ where: { id: quote.scenarioId } })
    : null;
  const allocations = quote.scenarioId && quote.harnessId
    ? await prisma.allocationItem.findMany({ where: { scenarioId: quote.scenarioId, harnessId: quote.harnessId } })
    : [];

  const quoteData = fromJson<JsonObject>(quote.data, {});
  const quoteParams = fromJson<JsonObject>(quote.quoteParams, {});
  const quoteResult = fromJson<JsonObject>(quote.quoteResult, {});
  const lockedFields = fromJson<string[]>(quote.lockedFields, []);
  const editableFields = fromJson<string[]>(quote.editableFields, []);
  const approvalFields = fromJson<string[]>(quote.approvalFields, []);
  const harnessInput = harness ? fromJson<HarnessInput>(harness.input, {}) : null;
  const bomRows = Array.isArray(harnessInput?.bom) ? harnessInput!.bom! : [];

  const summary = {
    quoteId: quote.id,
    version: quote.version,
    status: quote.status,
    template: quote.template,
    projectCode: project.projectCode,
    projectName: project.projectName,
    customer: project.customer,
    scenarioName: scenario?.name ?? '-',
    harnessId: quote.harnessId ?? '-',
    harnessName: harness?.harnessName ?? '-',
    bomCount: bomRows.length,
    internalCostBaseline: quote.internalCostBaseline,
    exWorksPrice: quote.exWorksPrice,
    arrivalPrice: quote.arrivalPrice,
    effectivePrice: quote.effectivePrice,
    profitGap: quote.profitGap,
    effectivePriceMode: quote.effectivePriceMode,
    customerAccepted: quote.customerAccepted ? '是' : '否',
    updatedAt: quote.updatedAt,
  };

  return {
    quote,
    project,
    scenario,
    harness,
    allocations,
    quoteData,
    quoteParams,
    quoteResult,
    lockedFields,
    editableFields,
    approvalFields,
    bomRows,
    summary,
  };
}

function createProjectExcel(bundle: Awaited<ReturnType<typeof loadProjectBundle>>): ExportFile {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheetFromRows([
    ['项目编号', '项目名称', '客户', '平台', '状态', '线束数', '场景数', '报价数', '分摊项数', '版本数', 'BOM总成本', '最新有效执行价', '最新利润差', '更新时间'],
    [
      bundle.summary.projectCode,
      bundle.summary.projectName,
      bundle.summary.customer,
      bundle.summary.platform,
      bundle.summary.status,
      bundle.summary.harnessCount,
      bundle.summary.scenarioCount,
      bundle.summary.quoteCount,
      bundle.summary.allocationCount,
      bundle.summary.versionCount,
      Number(bundle.summary.totalBomCost.toFixed(2)),
      Number(bundle.summary.latestEffectivePrice.toFixed(2)),
      Number(bundle.summary.latestProfitGap.toFixed(2)),
      formatDate(bundle.summary.updatedAt),
    ],
  ]), '项目总览');

  XLSX.utils.book_append_sheet(workbook, worksheetFromRows([
    ['线束号', '线束名称', '场景ID', 'BOM行数', 'BOM成本', '更新时间'],
    ...bundle.harnessRows.map((row) => [row.harnessId, row.harnessName, row.scenarioId, row.bomCount, Number(row.bomCost.toFixed(2)), formatDate(row.updatedAt)]),
  ]), '线束清单');

  XLSX.utils.book_append_sheet(workbook, worksheetFromRows([
    ['报价ID', '版本', '场景ID', '线束号', '状态', '模板', 'L1内部成本', '出厂价', '到厂价', 'L3有效价', '利润差', '更新时间'],
    ...bundle.quoteRows.map((row) => [row.id, row.version, row.scenarioId, row.harnessId, row.status, row.template, row.internalCostBaseline, row.exWorksPrice, row.arrivalPrice, row.effectivePrice, row.profitGap, formatDate(row.updatedAt)]),
  ]), '报价清单');

  XLSX.utils.book_append_sheet(workbook, worksheetFromRows([
    ['分摊ID', '场景ID', '线束号', '费用名称', '承担方', '定价影响', '总金额', '单根分摊', '回收进度%', '状态'],
    ...bundle.allocationRows.map((row) => [row.id, row.scenarioId, row.harnessId, row.expenseName, row.burdenSide, row.pricingEffect, row.totalAmount, row.unitAllocation, Number(row.recoveryProgress.toFixed(2)), row.status]),
  ]), '分摊回收');

  XLSX.utils.book_append_sheet(workbook, worksheetFromRows([
    ['costRates', jsonText(bundle.costRates)],
    ['metalPrices', jsonText(bundle.metalPrices)],
    ['volumes', jsonText(bundle.volumes)],
  ]), '参数快照');

  const buffer = Buffer.from(XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }));
  return {
    buffer,
    filename: buildFilename(`${bundle.project.projectCode}_project_export`, 'xlsx'),
    contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  };
}

function createQuoteExcel(bundle: Awaited<ReturnType<typeof loadQuoteBundle>>): ExportFile {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheetFromRows([
    ['项目', '客户', '场景', '线束号', '线束名称', '版本', '状态', '模板', 'L1内部成本', '出厂价', '到厂价', 'L3有效价', '有效价模式', '利润差', '客户确认', '更新时间'],
    [
      bundle.project.projectName,
      bundle.project.customer,
      bundle.summary.scenarioName,
      bundle.summary.harnessId,
      bundle.summary.harnessName,
      bundle.summary.version,
      bundle.summary.status,
      bundle.summary.template,
      bundle.summary.internalCostBaseline,
      bundle.summary.exWorksPrice,
      bundle.summary.arrivalPrice,
      bundle.summary.effectivePrice,
      bundle.summary.effectivePriceMode,
      bundle.summary.profitGap,
      bundle.summary.customerAccepted,
      formatDate(bundle.summary.updatedAt),
    ],
  ]), '报价总览');

  XLSX.utils.book_append_sheet(workbook, worksheetFromRows([
    ['字段', '内容'],
    ['quoteParams', jsonText(bundle.quoteParams)],
    ['quoteResult', jsonText(bundle.quoteResult)],
    ['lockedFields', jsonText(bundle.lockedFields)],
    ['editableFields', jsonText(bundle.editableFields)],
    ['approvalFields', jsonText(bundle.approvalFields)],
  ]), '报价参数');

  XLSX.utils.book_append_sheet(workbook, worksheetFromRows([
    ['序号', '分类', '数量', '单价', '金额'],
    ...bundle.bomRows.map((row, index) => [
      index + 1,
      row.itemCategory ?? '-',
      Number(row.qty ?? 0),
      Number(row.unitPrice ?? 0),
      Number(Number(row.amount ?? 0).toFixed(2)),
    ]),
  ]), 'BOM摘要');

  XLSX.utils.book_append_sheet(workbook, worksheetFromRows([
    ['分摊ID', '费用名称', '承担方', '定价影响', '总金额', '单根分摊', '回收进度%', '状态'],
    ...bundle.allocations.map((allocation) => [allocation.id, allocation.expenseName, allocation.burdenSide, allocation.pricingEffect, allocation.totalAmount, allocation.unitAllocation, Number(allocation.recoveryProgress.toFixed(2)), allocation.status]),
  ]), '分摊回收');

  const buffer = Buffer.from(XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }));
  return {
    buffer,
    filename: buildFilename(`${bundle.project.projectCode}_${bundle.summary.version}_quote_export`, 'xlsx'),
    contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  };
}

async function pdfBuffer(render: (doc: PDFKit.PDFDocument) => void) {
  const doc = new PDFDocument({ margin: 40, size: 'A4' });
  const chunks: Buffer[] = [];
  return await new Promise<Buffer>((resolve, reject) => {
    doc.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    render(doc);
    doc.end();
  });
}

async function createProjectPdf(bundle: Awaited<ReturnType<typeof loadProjectBundle>>): Promise<ExportFile> {
  const buffer = await pdfBuffer((doc) => {
    doc.fontSize(18).text(`项目导出报告 - ${bundle.project.projectCode}`);
    doc.moveDown();
    doc.fontSize(11);
    [
      `项目名称: ${bundle.project.projectName}`,
      `客户: ${bundle.project.customer}`,
      `平台: ${bundle.project.platform ?? '-'}`,
      `状态: ${bundle.project.status}`,
      `线束数: ${bundle.summary.harnessCount}`,
      `场景数: ${bundle.summary.scenarioCount}`,
      `报价数: ${bundle.summary.quoteCount}`,
      `BOM总成本: ${formatCurrency(bundle.summary.totalBomCost)}`,
      `最新有效执行价: ${formatCurrency(bundle.summary.latestEffectivePrice)}`,
      `最新利润差: ${formatCurrency(bundle.summary.latestProfitGap)}`,
      `更新时间: ${formatDate(bundle.project.updatedAt)}`,
    ].forEach((line) => doc.text(line));

    doc.moveDown().fontSize(14).text('线束清单');
    bundle.harnessRows.slice(0, 20).forEach((row, index) => {
      doc.fontSize(10).text(`${index + 1}. ${row.harnessId} ${row.harnessName} | BOM ${row.bomCount} 行 | 成本 ${formatCurrency(row.bomCost)}`);
    });

    doc.moveDown().fontSize(14).text('最近报价');
    bundle.quoteRows.slice(0, 10).forEach((row, index) => {
      doc.fontSize(10).text(`${index + 1}. ${row.version} | ${row.harnessId} | ${row.status} | L3 ${formatCurrency(row.effectivePrice)} | Gap ${formatCurrency(row.profitGap)}`);
    });
  });

  return {
    buffer,
    filename: buildFilename(`${bundle.project.projectCode}_project_report`, 'pdf'),
    contentType: 'application/pdf',
  };
}

async function createQuotePdf(bundle: Awaited<ReturnType<typeof loadQuoteBundle>>): Promise<ExportFile> {
  const buffer = await pdfBuffer((doc) => {
    doc.fontSize(18).text(`报价导出报告 - ${bundle.summary.version}`);
    doc.moveDown();
    doc.fontSize(11);
    [
      `项目: ${bundle.project.projectName}`,
      `客户: ${bundle.project.customer}`,
      `场景: ${bundle.summary.scenarioName}`,
      `线束: ${bundle.summary.harnessId} ${bundle.summary.harnessName}`,
      `状态: ${bundle.summary.status}`,
      `模板: ${bundle.summary.template}`,
      `L1内部成本: ${formatCurrency(bundle.summary.internalCostBaseline)}`,
      `出厂价: ${formatCurrency(bundle.summary.exWorksPrice)}`,
      `到厂价: ${formatCurrency(bundle.summary.arrivalPrice)}`,
      `L3有效执行价: ${formatCurrency(bundle.summary.effectivePrice)}`,
      `利润差: ${formatCurrency(bundle.summary.profitGap)}`,
      `有效价模式: ${bundle.summary.effectivePriceMode}`,
      `客户确认: ${bundle.summary.customerAccepted}`,
      `更新时间: ${formatDate(bundle.summary.updatedAt)}`,
    ].forEach((line) => doc.text(line));

    doc.moveDown().fontSize(14).text('BOM摘要');
    doc.fontSize(10).text(`BOM行数: ${bundle.summary.bomCount}`);
    bundle.bomRows.slice(0, 20).forEach((row, index) => {
      doc.text(`${index + 1}. ${row.itemCategory ?? '-'} | 数量 ${Number(row.qty ?? 0)} | 单价 ${formatCurrency(Number(row.unitPrice ?? 0))} | 金额 ${formatCurrency(Number(row.amount ?? 0))}`);
    });

    if (bundle.allocations.length > 0) {
      doc.moveDown().fontSize(14).text('分摊回收');
      bundle.allocations.slice(0, 10).forEach((allocation, index) => {
        doc.fontSize(10).text(`${index + 1}. ${allocation.expenseName} | ${allocation.burdenSide}/${allocation.pricingEffect} | 单根 ${formatCurrency(allocation.unitAllocation)} | 进度 ${allocation.recoveryProgress.toFixed(2)}%`);
      });
    }
  });

  return {
    buffer,
    filename: buildFilename(`${bundle.project.projectCode}_${bundle.summary.version}_quote_report`, 'pdf'),
    contentType: 'application/pdf',
  };
}

export class ExportService {
  static async export(type: ExportType, payload: ExportPayload): Promise<ExportFile> {
    const resourceType: ResourceType = payload.quoteId ? 'quote' : 'project';

    if (resourceType === 'project') {
      if (!payload.projectId) {
        const err: any = new Error('projectId is required');
        err.status = 400;
        throw err;
      }
      const bundle = await loadProjectBundle(payload.projectId);
      return type === 'excel' ? createProjectExcel(bundle) : createProjectPdf(bundle);
    }

    if (!payload.quoteId) {
      const err: any = new Error('quoteId is required');
      err.status = 400;
      throw err;
    }
    const bundle = await loadQuoteBundle(payload.quoteId);
    return type === 'excel' ? createQuoteExcel(bundle) : createQuotePdf(bundle);
  }
}
