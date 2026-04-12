/**
 * B5: 客户模板映射
 * 内部字段 → 客户字段的映射、导出列顺序、小数位数、隐藏字段
 */

export interface CustomerTemplate {
  id: string;
  customerName: string;
  version: number;
  fieldMapping: Record<string, string>;
  exportColumns: string[];
  decimalPlaces: Record<string, number>;
  hiddenFields: string[];
  computedColumns?: Array<{
    name: string;
    formula: string;
  }>;
  headerFormat?: {
    row: number;
    style?: Record<string, unknown>;
  };
}

export const DEFAULT_TEMPLATE: CustomerTemplate = {
  id: 'default',
  customerName: '默认',
  version: 1,
  fieldMapping: {
    partNo: '物料编号',
    partName: '物料名称',
    itemCategory: '物料分类',
    qty: '用量',
    unit: '单位',
    unitPrice: '单价',
    amount: '金额',
  },
  exportColumns: ['partNo', 'partName', 'itemCategory', 'qty', 'unit', 'unitPrice', 'amount'],
  decimalPlaces: { unitPrice: 4, amount: 2, qty: 2 },
  hiddenFields: ['supplier', 'copperWeightPerUnit', 'aluminumWeightPerUnit'],
};

export const VW_TEMPLATE: CustomerTemplate = {
  id: 'vw',
  customerName: '大众',
  version: 1,
  fieldMapping: {
    partNo: 'Teilenummer',
    partName: 'Benennung',
    itemCategory: 'Materialgruppe',
    qty: 'Menge',
    unit: 'ME',
    unitPrice: 'Einzelpreis',
    amount: 'Gesamtpreis',
    sapNo: 'SAP-Nr.',
  },
  exportColumns: ['sapNo', 'partNo', 'partName', 'itemCategory', 'qty', 'unit', 'unitPrice', 'amount'],
  decimalPlaces: { unitPrice: 4, amount: 2 },
  hiddenFields: ['supplier', 'copperWeightPerUnit', 'aluminumWeightPerUnit', 'endGroup'],
};

export function applyTemplate(
  data: Array<Record<string, unknown>>,
  template: CustomerTemplate
): Array<Record<string, unknown>> {
  return data.map(row => {
    const mapped: Record<string, unknown> = {};
    for (const col of template.exportColumns) {
      if (template.hiddenFields.includes(col)) continue;
      const targetKey = template.fieldMapping[col] || col;
      let value = row[col];
      if (typeof value === 'number' && template.decimalPlaces[col] !== undefined) {
        value = Number(value.toFixed(template.decimalPlaces[col]));
      }
      mapped[targetKey] = value;
    }
    return mapped;
  });
}
