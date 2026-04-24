#!/usr/bin/env node
/**
 * extract_e281_from_excel.js — 从 Excel 文件提取 E281 期望成本数据
 *
 * 用法:
 *   node tests/data/extract_e281_from_excel.js
 *
 * 输出:
 *   tests/data/e281_expected_costs.json
 *
 * 数据来源:
 *   1. E281项目 报价BOM V01-11.3.xlsx — BOM 明细、配置清单、二次物料明细
 *   2. 吉利E281报价核算.xlsx — 配置明细、项目评估汇总、包装物流
 *
 * 依赖: xlsx (已在 package.json 中)
 */
'use strict';

const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

const ROOT = path.resolve(__dirname, '..', '..');
const BOM_DIR = path.resolve('C:/Users/lyvee/OneDrive/Desktop/cost-accounting-dynamic-model-v2026-04-02-1722/BOM核对');
const OUTPUT = path.resolve(__dirname, 'e281_expected_costs.json');

// --- Sheet 名称映射 ---

const BOM_SHEET_MAP = {
  configList: '配置清单',
  secondaryMaterials: '二次物料明细',
  kskBom: 'KSK线束BOM明细',
};

const ACCOUNTING_SHEET_MAP = {
  configDetail: '配置明细',
  projectSummary: '项目评估汇总（昆山90%）',
  kskBom: 'KSK线束BOM明细',
  equipment: '设备投资明细',
  tooling: '项目专用模具',
  fixture: '项目工装投入',
  rnd: '研发费用',
  packaging: '包装物流费用',
};

// --- 工具函数 ---

function openWorkbook(fileName) {
  const filePath = path.resolve(BOM_DIR, fileName);
  if (!fs.existsSync(filePath)) {
    console.warn(`[WARN] File not found: ${filePath}`);
    return null;
  }
  console.log(`[INFO] Opening: ${fileName}`);
  return XLSX.readFile(filePath, { cellDates: true, cellNF: true });
}

function getSheet(wb, sheetName) {
  if (!wb) return null;
  // 精确匹配
  if (wb.SheetNames.includes(sheetName)) {
    return wb.Sheets[sheetName];
  }
  // 模糊匹配
  const lower = sheetName.toLowerCase();
  const match = wb.SheetNames.find((n) => n.toLowerCase().includes(lower));
  return match ? wb.Sheets[match] : null;
}

function sheetToJson(sheet, options) {
  if (!sheet) return [];
  return XLSX.utils.sheet_to_json(sheet, {
    defval: '',
    raw: false,
    ...options,
  });
}

function safeNumber(value) {
  if (value === '' || value === null || value === undefined) return null;
  const n = Number(String(value).replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
}

// --- 提取函数 ---

/**
 * 从报价核算.xlsx 提取配置明细（9 线束材料成本/铜重/铝重/工时）
 *
 * 实际列布局 (0-indexed, __EMPTY 系列):
 *   col0=序号, col1=零件号, col2=SAP号, col3=零件名称, col4=数量,
 *   col5=材料成本, col6=VAVE后材料成本, col7=铜重(KG), col8=铝重(KG),
 *   col9=导线成本, col10=开线工时, col11=公共制成工时, col12=后工程工时,
 *   col13=JPH, col14=回路数, ...
 */
function extractConfigDetail(accWb) {
  const sheet = getSheet(accWb, ACCOUNTING_SHEET_MAP.configDetail);
  if (!sheet) {
    console.warn('[WARN] 配置明细 sheet not found');
    return [];
  }
  const rows = sheetToJson(sheet);
  console.log(`[INFO] 配置明细: ${rows.length} rows`);

  // 第一行是表头，数据从第二行开始
  // 列映射: __EMPTY=col1(零件号), __EMPTY_2=col3(零件名称), __EMPTY_3=col4(数量),
  //          __EMPTY_5=col5(材料成本), __EMPTY_7=col7(铜重), __EMPTY_8=col8(铝重)
  const results = [];
  rows.forEach((row) => {
    const id = String(row['__EMPTY'] || '').trim();
    if (/^\d{10}$/.test(id)) {
      results.push({
        harnessId: id,
        name: String(row['__EMPTY_2'] || '').trim(),
        vehicleRatio: safeNumber(row['__EMPTY_3']),
        materialCost: safeNumber(row['__EMPTY_5']),
        copperWeight: (() => { const v = safeNumber(row['__EMPTY_7']); return v !== null ? v / 1000 : null; })(), // Excel 铜重单位为克，转为千克匹配种子数据
        aluminumWeight: safeNumber(row['__EMPTY_8']),
        wireCost: safeNumber(row['__EMPTY_9']),
        processHours: safeNumber(row['__EMPTY_11']),
        postProcessHours: safeNumber(row['__EMPTY_12']),
      });
    }
  });
  return results;
}

/**
 * 从报价核算.xlsx 提取项目评估汇总
 */
function extractProjectSummary(accWb) {
  const sheet = getSheet(accWb, ACCOUNTING_SHEET_MAP.projectSummary);
  if (!sheet) {
    console.warn('[WARN] 项目评估汇总 sheet not found');
    return null;
  }
  const rows = sheetToJson(sheet);
  console.log(`[INFO] 项目评估汇总: ${rows.length} rows`);

  // 提取关键指标
  const summary = {
    totalCostPerSet: null,
    materialPerSet: null,
    laborPerSet: null,
    equipmentPerSet: null,
    manufacturingPerSet: null,
    rndPerSet: null,
    packagingPerSet: null,
    margin: null,
    profitPerSet: null,
  };

  rows.forEach((row) => {
    const label = String(row['__EMPTY'] || row['项目'] || row['指标'] || '').trim();
    const value = safeNumber(row['合计'] || row['金额'] || row['昆山90%'] || '');
    if (!label || value === null) return;

    if (label.includes('总成本') || label.includes('合计成本')) summary.totalCostPerSet = value;
    else if (label.includes('材料')) summary.materialPerSet = value;
    else if (label.includes('人工') || label.includes('直接人工')) summary.laborPerSet = value;
    else if (label.includes('设备')) summary.equipmentPerSet = value;
    else if (label.includes('制造')) summary.manufacturingPerSet = value;
    else if (label.includes('研发')) summary.rndPerSet = value;
    else if (label.includes('包装')) summary.packagingPerSet = value;
    else if (label.includes('利润率') || label.includes('利润')) summary.margin = value;
    else if (label.includes('利润额')) summary.profitPerSet = value;
  });

  return summary;
}

/**
 * 从报价核算.xlsx 提取包装物流费用
 *
 * 实际列布局:
 *   col0(吉利E281高压)=客户零件号, col1=SAP号, col2=物料描述, col3=用量,
 *   col4=内包装, col5(金额单位：元)=外包装, col6=运费, col7=超额运费,
 *   col8=短驳, col9=三方仓费用, col10=仓储费, col11=合计
 */
function extractPackaging(accWb) {
  const sheet = getSheet(accWb, ACCOUNTING_SHEET_MAP.packaging);
  if (!sheet) {
    console.warn('[WARN] 包装物流费用 sheet not found');
    return [];
  }
  const rows = sheetToJson(sheet);
  console.log(`[INFO] 包装物流费用: ${rows.length} rows`);

  const results = [];
  rows.forEach((row) => {
    const id = String(row['吉利E281高压'] || '').trim();
    if (/^\d{10}$/.test(id)) {
      results.push({
        harnessId: id,
        name: String(row['__EMPTY_1'] || '').trim(),
        vehicleRatio: safeNumber(row['__EMPTY_2']),
        innerPack: safeNumber(row['__EMPTY_3']),
        outerPack: safeNumber(row['金额单位：元']),
        freight: safeNumber(row['__EMPTY_4']),
        excessFreight: safeNumber(row['__EMPTY_5']),
        shortHaul: safeNumber(row['__EMPTY_6']),
        thirdPartyWarehouse: safeNumber(row['__EMPTY_7']),
        storage: safeNumber(row['__EMPTY_8']),
        total: safeNumber(row['__EMPTY_9']),
      });
    }
  });
  return results;
}

/**
 * 从报价BOM.xlsx 提取配置清单（4 车型配置用量矩阵）
 */
function extractConfigList(bomWb) {
  const sheet = getSheet(bomWb, BOM_SHEET_MAP.configList);
  if (!sheet) {
    console.warn('[WARN] 配置清单 sheet not found');
    return [];
  }
  const rows = sheetToJson(sheet);
  console.log(`[INFO] 配置清单: ${rows.length} rows`);
  return rows;
}

/**
 * 从报价BOM.xlsx 提取二次物料明细
 */
function extractSecondaryMaterials(bomWb) {
  const sheet = getSheet(bomWb, BOM_SHEET_MAP.secondaryMaterials);
  if (!sheet) {
    console.warn('[WARN] 二次物料明细 sheet not found');
    return [];
  }
  const rows = sheetToJson(sheet);
  console.log(`[INFO] 二次物料明细: ${rows.length} rows`);
  return rows;
}

/**
 * 从报价BOM.xlsx 提取 KSK 线束 BOM 明细
 */
function extractKskBom(bomWb) {
  const sheet = getSheet(bomWb, BOM_SHEET_MAP.kskBom);
  if (!sheet) {
    console.warn('[WARN] KSK线束BOM明细 sheet not found (BOM file)');
    return [];
  }
  const rows = sheetToJson(sheet);
  console.log(`[INFO] KSK线束BOM明细 (BOM): ${rows.length} rows`);
  return rows;
}

/**
 * 从报价核算.xlsx 提取 KSK 线束 BOM 明细
 */
function extractKskBomAccounting(accWb) {
  const sheet = getSheet(accWb, ACCOUNTING_SHEET_MAP.kskBom);
  if (!sheet) {
    console.warn('[WARN] KSK线束BOM明细 sheet not found (Accounting file)');
    return [];
  }
  const rows = sheetToJson(sheet);
  console.log(`[INFO] KSK线束BOM明细 (Accounting): ${rows.length} rows`);
  return rows;
}

/**
 * 从报价核算.xlsx 提取资本投入（设备/模具/工装/研发）
 */
function extractCapital(accWb) {
  const categories = ['equipment', 'tooling', 'fixture', 'rnd'];
  const sheetNames = [
    ACCOUNTING_SHEET_MAP.equipment,
    ACCOUNTING_SHEET_MAP.tooling,
    ACCOUNTING_SHEET_MAP.fixture,
    ACCOUNTING_SHEET_MAP.rnd,
  ];
  const labels = ['设备投资', '模具', '工装', '研发'];
  const result = {};

  categories.forEach((cat, i) => {
    const sheet = getSheet(accWb, sheetNames[i]);
    if (!sheet) {
      console.warn(`[WARN] ${labels[i]} sheet not found`);
      result[cat] = [];
      return;
    }
    const rows = sheetToJson(sheet);
    console.log(`[INFO] ${labels[i]}: ${rows.length} rows`);
    result[cat] = rows;
  });

  return result;
}

// --- 主流程 ---

function main() {
  console.log('=== E281 Excel Data Extraction ===\n');

  const bomWb = openWorkbook('E281项目 报价BOM V01-11.3.xlsx');
  const accWb = openWorkbook('吉利E281报价核算.xlsx');

  const output = {
    meta: {
      extractedAt: new Date().toISOString(),
      sources: {
        bom: bomWb ? 'E281项目 报价BOM V01-11.3.xlsx' : null,
        accounting: accWb ? '吉利E281报价核算.xlsx' : null,
      },
    },
    configDetail: extractConfigDetail(accWb),
    projectSummary: extractProjectSummary(accWb),
    packaging: extractPackaging(accWb),
    configList: extractConfigList(bomWb),
    secondaryMaterials: extractSecondaryMaterials(bomWb),
    kskBomFromBom: extractKskBom(bomWb),
    kskBomFromAccounting: extractKskBomAccounting(accWb),
    capital: extractCapital(accWb),
  };

  // 统计
  const stats = {
    configDetailRows: output.configDetail.length,
    packagingRows: output.packaging.length,
    configListRows: output.configList.length,
    secondaryMaterialsRows: output.secondaryMaterials.length,
    kskBomBomRows: output.kskBomFromBom.length,
    kskBomAccountingRows: output.kskBomFromAccounting.length,
  };
  console.log('\n=== Extraction Stats ===');
  console.log(JSON.stringify(stats, null, 2));

  // 写入
  fs.writeFileSync(OUTPUT, JSON.stringify(output, null, 2), 'utf8');
  console.log(`\n[OK] Written to: ${OUTPUT}`);
}

main();
