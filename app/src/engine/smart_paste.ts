/**
 * D3: 智能 BOM 粘贴
 * 解析粘贴板 TSV 数据，自动列映射，转换为 BomItem
 */

import type { BomItem } from '@/types/harness';

export interface ColumnMapping {
  sourceColumn: string;
  targetField: string;
  confidence: number;
}

export interface PasteParseResult {
  rows: Array<Record<string, string>>;
  columnMappings: ColumnMapping[];
  unmappedColumns: string[];
  preview: Array<Partial<BomItem>>;
}

const HEADER_ALIASES: Record<string, string> = {
  '物料编号': 'partNo', '零件号': 'partNo', '料号': 'partNo', 'PartNo': 'partNo',
  '物料名称': 'partName', '零件名': 'partName', '品名': 'partName',
  '分类': 'itemCategory', '物料分类': 'itemCategory', '类别': 'itemCategory',
  '用量': 'qty', '数量': 'qty', '需求量': 'qty', 'Qty': 'qty',
  '单位': 'unit', 'Unit': 'unit',
  '单价': 'unitPrice', '含税单价': 'unitPrice', 'UnitPrice': 'unitPrice',
  '金额': 'amount', '含税金额': 'amount',
  '供应商': 'supplier', '供方': 'supplier',
  '规格': 'spec', '规格描述': 'spec',
  '端组': 'endGroup', '端子组': 'endGroup',
  '截面积': 'crossSection', '线径': 'crossSection',
  '装车比': 'vehicleRatio', '配比': 'vehicleRatio',
  '标配/选配': 'configType', '配置类型': 'configType',
  'SAP号': 'sapNo', 'SAP物料号': 'sapNo',
  // English aliases
  'Part Number': 'partNo', 'Part Name': 'partName', 'Category': 'itemCategory',
  'Quantity': 'qty', 'Unit Price': 'unitPrice', 'Amount': 'amount',
  'Supplier': 'supplier', 'Specification': 'spec',
  'Teilenummer': 'partNo', 'Benennung': 'partName', 'Menge': 'qty',
};

const NUMERIC_FIELDS = new Set(['qty', 'unitPrice', 'amount', 'copperWeightPerUnit', 'aluminumWeightPerUnit', 'crossSection', 'vehicleRatio']);

export function parseClipboardTable(text: string): Array<Record<string, string>> {
  const lines = text.trim().split('\n');
  if (lines.length < 2) return [];

  const firstLine = lines[0];
  if (!firstLine) return [];
  const headers = firstLine.split('\t').map(h => h.trim());
  const rows: Array<Record<string, string>> = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;
    const values = line.split('\t');
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h] = (values[idx] || '').trim();
    });
    rows.push(row);
  }

  return rows;
}

export function guessColumnMappings(headers: string[]): ColumnMapping[] {
  return headers.map(header => {
    const trimmed = header.trim();
    if (HEADER_ALIASES[trimmed]) {
      return { sourceColumn: header, targetField: HEADER_ALIASES[trimmed]!, confidence: 1.0 };
    }
    for (const [alias, field] of Object.entries(HEADER_ALIASES)) {
      if (trimmed.includes(alias) || alias.includes(trimmed)) {
        return { sourceColumn: header, targetField: field, confidence: 0.7 };
      }
    }
    return { sourceColumn: header, targetField: '', confidence: 0 };
  });
}

export function smartPaste(clipboardText: string): PasteParseResult {
  const rows = parseClipboardTable(clipboardText);
  if (rows.length === 0) {
    return { rows: [], columnMappings: [], unmappedColumns: [], preview: [] };
  }

  const firstRow = rows[0]!;
  const headers = Object.keys(firstRow);
  const columnMappings = guessColumnMappings(headers);
  const unmappedColumns = columnMappings.filter(m => !m.targetField).map(m => m.sourceColumn);

  const preview: Array<Partial<BomItem>> = rows.map(row => {
    const item: Record<string, unknown> = {};
    for (const mapping of columnMappings) {
      if (!mapping.targetField) continue;
      let value: unknown = row[mapping.sourceColumn];
      if (NUMERIC_FIELDS.has(mapping.targetField)) {
        value = parseFloat(value as string) || 0;
      }
      item[mapping.targetField] = value;
    }
    return item as Partial<BomItem>;
  });

  return { rows, columnMappings, unmappedColumns, preview };
}
