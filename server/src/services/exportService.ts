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

type FactoryRateSource = {
  factoryId: string | null;
  factoryName: string | null;
  laborRate: number | null;
  manufacturingRate: number | null;
  sourceNote: string | null;
};

type HarnessInput = {
  bom?: Array<{ amount?: number; qty?: number; unitPrice?: number; itemCategory?: string }>;
};

function sanitizeFileName(value: string) {
  return value.replace(/[\\/:*?"<>|\s]+/g, '_');
}

function formatCurrency(value: number) {
  return `\u00a5${Number(value || 0).toFixed(2)}`;
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

function parseFactoryRateSource(value: unknown): FactoryRateSource {
  const source = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  return {
    factoryId: typeof source.factoryId === 'string' ? source.factoryId : null,
    factoryName: typeof source.factoryName === 'string' ? source.factoryName : null,
    laborRate: typeof source.laborRate === 'number' ? source.laborRate : null,
    manufacturingRate: typeof source.manufacturingRate === 'number' ? source.manufacturingRate : null,
    sourceNote: typeof source.sourceNote === 'string' ? source.sourceNote : null,
  };
}

function factoryRateRows(source: FactoryRateSource): Array<Array<string | number>> {
  return [
    ['基准工厂ID', source.factoryId ?? '-'],
    ['基准工厂名称', source.factoryName ?? '-'],
    ['人工费率', source.laborRate ?? '-'],
    ['制造费率', source.manufacturingRate ?? '-'],
    ['来源说明', source.sourceNote ?? '-'],
  ];
}

function factoryRatePdfLines(source: FactoryRateSource): string[] {
  return [
    `基准工厂ID: ${source.factoryId ?? '-'}`,
    `基准工厂名称: ${source.factoryName ?? '-'}`,
    `人工费率: ${source.laborRate ?? '-'}`,
    `制造费率: ${source.manufacturingRate ?? '-'}`,
    `来源说明: ${source.sourceNote ?? '-'}`,
  ];
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
    ? await prisma.harness.findFirst({
        where: quote.scenarioId
          ? { scenarioId: quote.scenarioId, harnessId: quote.harnessId }
          : { projectId: quote.projectId, harnessId: quote.harnessId },
      })
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
  const factoryRateSource = parseFactoryRateSource(quoteParams.factoryRateSource);

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
    customerAccepted: quote.customerAccepted ? '\u662f' : '\u5426',
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
    factoryRateSource,
    summary,
  };
}

function createProjectExcel(bundle: Awaited<ReturnType<typeof loadProjectBundle>>): ExportFile {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheetFromRows([
    ['\u9879\u76ee\u7f16\u53f7', '\u9879\u76ee\u540d\u79f0', '\u5ba2\u6237', '\u5e73\u53f0', '\u72b6\u6001', '\u7ebf\u675f\u6570', '\u573a\u666f\u6570', '\u62a5\u4ef7\u6570', '\u5206\u644a\u9879\u6570', '\u7248\u672c\u6570', 'BOM\u603b\u6210\u672c', '\u6700\u65b0\u6709\u6548\u6267\u884c\u4ef7', '\u6700\u65b0\u5229\u6da6\u5dee', '\u66f4\u65b0\u65f6\u95f4'],
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
  ]), '\u9879\u76ee\u603b\u89c8');

  XLSX.utils.book_append_sheet(workbook, worksheetFromRows([
    ['\u7ebf\u675f\u53f7', '\u7ebf\u675f\u540d\u79f0', '\u573a\u666fID', 'BOM\u884c\u6570', 'BOM\u6210\u672c', '\u66f4\u65b0\u65f6\u95f4'],
    ...bundle.harnessRows.map((row) => [row.harnessId, row.harnessName, row.scenarioId, row.bomCount, Number(row.bomCost.toFixed(2)), formatDate(row.updatedAt)]),
  ]), '\u7ebf\u675f\u6e05\u5355');

  XLSX.utils.book_append_sheet(workbook, worksheetFromRows([
    ['\u62a5\u4ef7ID', '\u7248\u672c', '\u573a\u666fID', '\u7ebf\u675f\u53f7', '\u72b6\u6001', '\u6a21\u677f', 'L1\u5185\u90e8\u6210\u672c', '\u51fa\u5382\u4ef7', '\u5230\u5382\u4ef7', 'L3\u6709\u6548\u4ef7', '\u5229\u6da6\u5dee', '\u66f4\u65b0\u65f6\u95f4'],
    ...bundle.quoteRows.map((row) => [row.id, row.version, row.scenarioId, row.harnessId, row.status, row.template, row.internalCostBaseline, row.exWorksPrice, row.arrivalPrice, row.effectivePrice, row.profitGap, formatDate(row.updatedAt)]),
  ]), '\u62a5\u4ef7\u6e05\u5355');

  XLSX.utils.book_append_sheet(workbook, worksheetFromRows([
    ['\u5206\u644aID', '\u573a\u666fID', '\u7ebf\u675f\u53f7', '\u8d39\u7528\u540d\u79f0', '\u627f\u62c5\u65b9', '\u5b9a\u4ef7\u5f71\u54cd', '\u603b\u91d1\u989d', '\u5355\u6839\u5206\u644a', '\u56de\u6536\u8fdb\u5ea6%', '\u72b6\u6001'],
    ...bundle.allocationRows.map((row) => [row.id, row.scenarioId, row.harnessId, row.expenseName, row.burdenSide, row.pricingEffect, row.totalAmount, row.unitAllocation, Number(row.recoveryProgress.toFixed(2)), row.status]),
  ]), '\u5206\u644a\u56de\u6536');

  XLSX.utils.book_append_sheet(workbook, worksheetFromRows([
    ['costRates', jsonText(bundle.costRates)],
    ['metalPrices', jsonText(bundle.metalPrices)],
    ['volumes', jsonText(bundle.volumes)],
  ]), '\u53c2\u6570\u5feb\u7167');

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
    ['\u9879\u76ee', '\u5ba2\u6237', '\u573a\u666f', '\u7ebf\u675f\u53f7', '\u7ebf\u675f\u540d\u79f0', '\u7248\u672c', '\u72b6\u6001', '\u6a21\u677f', 'L1\u5185\u90e8\u6210\u672c', '\u51fa\u5382\u4ef7', '\u5230\u5382\u4ef7', 'L3\u6709\u6548\u4ef7', '\u6709\u6548\u4ef7\u6a21\u5f0f', '\u5229\u6da6\u5dee', '\u5ba2\u6237\u786e\u8ba4', '\u66f4\u65b0\u65f6\u95f4'],
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
  ]), '\u62a5\u4ef7\u603b\u89c8');

  XLSX.utils.book_append_sheet(workbook, worksheetFromRows([
    ['\u5b57\u6bb5', '\u5185\u5bb9'],
    ['quoteParams', jsonText(bundle.quoteParams)],
    ['quoteResult', jsonText(bundle.quoteResult)],
    ['lockedFields', jsonText(bundle.lockedFields)],
    ['editableFields', jsonText(bundle.editableFields)],
    ['approvalFields', jsonText(bundle.approvalFields)],
  ]), '\u62a5\u4ef7\u53c2\u6570');

  XLSX.utils.book_append_sheet(workbook, worksheetFromRows([
    ['\u5de5\u5382\u8d39\u7387\u8ffd\u6eaf\u9879', '\u5185\u5bb9'],
    ...factoryRateRows(bundle.factoryRateSource),
  ]), '\u5de5\u5382\u8d39\u7387\u8ffd\u6eaf');

  XLSX.utils.book_append_sheet(workbook, worksheetFromRows([
    ['\u5e8f\u53f7', '\u5206\u7c7b', '\u6570\u91cf', '\u5355\u4ef7', '\u91d1\u989d'],
    ...bundle.bomRows.map((row, index) => [
      index + 1,
      row.itemCategory ?? '-',
      Number(row.qty ?? 0),
      Number(row.unitPrice ?? 0),
      Number(Number(row.amount ?? 0).toFixed(2)),
    ]),
  ]), 'BOM\u6458\u8981');

  XLSX.utils.book_append_sheet(workbook, worksheetFromRows([
    ['\u5206\u644aID', '\u8d39\u7528\u540d\u79f0', '\u627f\u62c5\u65b9', '\u5b9a\u4ef7\u5f71\u54cd', '\u603b\u91d1\u989d', '\u5355\u6839\u5206\u644a', '\u56de\u6536\u8fdb\u5ea6%', '\u72b6\u6001'],
    ...bundle.allocations.map((allocation) => [allocation.id, allocation.expenseName, allocation.burdenSide, allocation.pricingEffect, allocation.totalAmount, allocation.unitAllocation, Number(allocation.recoveryProgress.toFixed(2)), allocation.status]),
  ]), '\u5206\u644a\u56de\u6536');

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
    doc.fontSize(18).text(`\u9879\u76ee\u5bfc\u51fa\u62a5\u544a - ${bundle.project.projectCode}`);
    doc.moveDown();
    doc.fontSize(11);
    [
      `\u9879\u76ee\u540d\u79f0: ${bundle.project.projectName}`,
      `\u5ba2\u6237: ${bundle.project.customer}`,
      `\u5e73\u53f0: ${bundle.project.platform ?? '-'}`,
      `\u72b6\u6001: ${bundle.project.status}`,
      `\u7ebf\u675f\u6570: ${bundle.summary.harnessCount}`,
      `\u573a\u666f\u6570: ${bundle.summary.scenarioCount}`,
      `\u62a5\u4ef7\u6570: ${bundle.summary.quoteCount}`,
      `BOM\u603b\u6210\u672c: ${formatCurrency(bundle.summary.totalBomCost)}`,
      `\u6700\u65b0\u6709\u6548\u6267\u884c\u4ef7: ${formatCurrency(bundle.summary.latestEffectivePrice)}`,
      `\u6700\u65b0\u5229\u6da6\u5dee: ${formatCurrency(bundle.summary.latestProfitGap)}`,
      `\u66f4\u65b0\u65f6\u95f4: ${formatDate(bundle.project.updatedAt)}`,
    ].forEach((line) => doc.text(line));

    doc.moveDown().fontSize(14).text('\u7ebf\u675f\u6e05\u5355');
    bundle.harnessRows.slice(0, 20).forEach((row, index) => {
      doc.fontSize(10).text(`${index + 1}. ${row.harnessId} ${row.harnessName} | BOM ${row.bomCount} \u884c | \u6210\u672c ${formatCurrency(row.bomCost)}`);
    });

    doc.moveDown().fontSize(14).text('\u6700\u8fd1\u62a5\u4ef7');
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
    doc.fontSize(18).text(`\u62a5\u4ef7\u5bfc\u51fa\u62a5\u544a - ${bundle.summary.version}`);
    doc.moveDown();
    doc.fontSize(11);
    [
      `\u9879\u76ee: ${bundle.project.projectName}`,
      `\u5ba2\u6237: ${bundle.project.customer}`,
      `\u573a\u666f: ${bundle.summary.scenarioName}`,
      `\u7ebf\u675f: ${bundle.summary.harnessId} ${bundle.summary.harnessName}`,
      `\u72b6\u6001: ${bundle.summary.status}`,
      `\u6a21\u677f: ${bundle.summary.template}`,
      `L1\u5185\u90e8\u6210\u672c: ${formatCurrency(bundle.summary.internalCostBaseline)}`,
      `\u51fa\u5382\u4ef7: ${formatCurrency(bundle.summary.exWorksPrice)}`,
      `\u5230\u5382\u4ef7: ${formatCurrency(bundle.summary.arrivalPrice)}`,
      `L3\u6709\u6548\u6267\u884c\u4ef7: ${formatCurrency(bundle.summary.effectivePrice)}`,
      `\u5229\u6da6\u5dee: ${formatCurrency(bundle.summary.profitGap)}`,
      `\u6709\u6548\u4ef7\u6a21\u5f0f: ${bundle.summary.effectivePriceMode}`,
      `\u5ba2\u6237\u786e\u8ba4: ${bundle.summary.customerAccepted}`,
      `\u66f4\u65b0\u65f6\u95f4: ${formatDate(bundle.summary.updatedAt)}`,
    ].forEach((line) => doc.text(line));

    doc.moveDown().fontSize(14).text('BOM\u6458\u8981');
    doc.fontSize(10).text(`BOM\u884c\u6570: ${bundle.summary.bomCount}`);
    bundle.bomRows.slice(0, 20).forEach((row, index) => {
      doc.text(`${index + 1}. ${row.itemCategory ?? '-'} | \u6570\u91cf ${Number(row.qty ?? 0)} | \u5355\u4ef7 ${formatCurrency(Number(row.unitPrice ?? 0))} | \u91d1\u989d ${formatCurrency(Number(row.amount ?? 0))}`);
    });

    doc.moveDown().fontSize(14).text('工厂费率追溯');
    factoryRatePdfLines(bundle.factoryRateSource).forEach((line) => {
      doc.fontSize(10).text(line);
    });

    if (bundle.allocations.length > 0) {
      doc.moveDown().fontSize(14).text('\u5206\u644a\u56de\u6536');
      bundle.allocations.slice(0, 10).forEach((allocation, index) => {
        doc.fontSize(10).text(`${index + 1}. ${allocation.expenseName} | ${allocation.burdenSide}/${allocation.pricingEffect} | \u5355\u6839 ${formatCurrency(allocation.unitAllocation)} | \u8fdb\u5ea6 ${allocation.recoveryProgress.toFixed(2)}%`);
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
