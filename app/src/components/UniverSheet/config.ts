/**
 * D8: UniverSheet BOM 表头列配置
 * 定义 BOM 编辑器的列结构、校验规则和格式化方式
 */
import { tField } from '@/lib/i18n';

export type ColumnDataType = 'string' | 'number' | 'select' | 'boolean';

export interface BomColumnDef {
  /** 字段名 (对应 BomItem/WireItem 属性) */
  field: string;
  /** 显示标题 (国际化) */
  title: string;
  /** 列宽 (px) */
  width: number;
  /** 数据类型 */
  dataType: ColumnDataType;
  /** 是否必填 */
  required?: boolean;
  /** 是否只读 */
  readonly?: boolean;
  /** 是否隐藏 */
  hidden?: boolean;
  /** 小数位数 (number 类型) */
  precision?: number;
  /** 下拉选项 (select 类型) */
  options?: Array<{ value: string; label: string }>;
  /** 列分组 */
  group?: string;
  /** 校验规则 */
  validate?: (value: unknown) => string | null;
}

/** 物料分类选项 */
export const ITEM_CATEGORY_OPTIONS = [
  { value: 'wire', label: '电线' },
  { value: 'terminal', label: '端子' },
  { value: 'connector', label: '护套/连接器' },
  { value: 'tape', label: '胶带' },
  { value: 'tube', label: '波纹管/套管' },
  { value: 'clip', label: '卡扣/固定件' },
  { value: 'fuse', label: '保险丝' },
  { value: 'relay', label: '继电器' },
  { value: 'seal', label: '密封件' },
  { value: 'other', label: '其他' },
];

/** 配置类型选项 */
export const CONFIG_TYPE_OPTIONS = [
  { value: 'standard', label: '标配' },
  { value: 'optional', label: '选配' },
  { value: 'common', label: '通用' },
];

/** 单位选项 */
export const UNIT_OPTIONS = [
  { value: 'PCS', label: 'PCS (个)' },
  { value: 'M', label: 'M (米)' },
  { value: 'SET', label: 'SET (套)' },
  { value: 'KG', label: 'KG (千克)' },
  { value: 'ROLL', label: 'ROLL (卷)' },
];

/** 工程视图列定义 */
export const ENGINEERING_COLUMNS: BomColumnDef[] = [
  { field: 'partNo', title: tField('partNo'), width: 140, dataType: 'string', required: true, group: '基本信息' },
  { field: 'partName', title: tField('partName'), width: 200, dataType: 'string', required: true, group: '基本信息' },
  { field: 'itemCategory', title: tField('itemCategory'), width: 100, dataType: 'select', options: ITEM_CATEGORY_OPTIONS, group: '基本信息' },
  { field: 'spec', title: tField('spec'), width: 120, dataType: 'string', group: '基本信息' },
  { field: 'endGroup', title: tField('endGroup'), width: 100, dataType: 'string', group: '基本信息' },
  { field: 'qty', title: tField('qty'), width: 80, dataType: 'number', required: true, precision: 2, group: '用量',
    validate: (v) => (typeof v === 'number' && v >= 0) ? null : '用量必须 >= 0' },
  { field: 'unit', title: tField('unit'), width: 70, dataType: 'select', options: UNIT_OPTIONS, group: '用量' },
  { field: 'unitPrice', title: tField('unitPrice'), width: 100, dataType: 'number', precision: 4, group: '价格',
    validate: (v) => (typeof v === 'number' && v >= 0) ? null : '单价必须 >= 0' },
  { field: 'amount', title: tField('amount'), width: 100, dataType: 'number', precision: 2, readonly: true, group: '价格' },
  { field: 'supplier', title: tField('supplier'), width: 140, dataType: 'string', group: '供应商' },
  { field: 'sapNo', title: 'SAP号', width: 130, dataType: 'string', group: '编码' },
  { field: 'crossSection', title: tField('crossSection'), width: 90, dataType: 'number', precision: 2, group: '线材参数' },
  { field: 'copperWeightPerUnit', title: tField('copperWeightPerUnit'), width: 110, dataType: 'number', precision: 6, group: '线材参数' },
  { field: 'aluminumWeightPerUnit', title: tField('aluminumWeightPerUnit'), width: 110, dataType: 'number', precision: 6, group: '线材参数' },
  { field: 'vehicleRatio', title: tField('vehicleRatio'), width: 90, dataType: 'number', precision: 2, group: '车型',
    validate: (v) => (typeof v === 'number' && v >= 0 && v <= 1) ? null : '装车比必须在 0-1 之间' },
  { field: 'configType', title: tField('configType'), width: 80, dataType: 'select', options: CONFIG_TYPE_OPTIONS, group: '车型' },
];

/** 成本视图列定义 */
export const COST_COLUMNS: BomColumnDef[] = [
  { field: 'partNo', title: tField('partNo'), width: 140, dataType: 'string', readonly: true, group: '基本' },
  { field: 'partName', title: tField('partName'), width: 160, dataType: 'string', readonly: true, group: '基本' },
  { field: 'itemCategory', title: tField('itemCategory'), width: 80, dataType: 'string', readonly: true, group: '基本' },
  { field: 'qty', title: tField('qty'), width: 70, dataType: 'number', readonly: true, precision: 2, group: '用量' },
  { field: 'unitPrice', title: tField('unitPrice'), width: 90, dataType: 'number', readonly: true, precision: 4, group: '价格' },
  { field: 'amount', title: tField('amount'), width: 100, dataType: 'number', readonly: true, precision: 2, group: '价格' },
  { field: 'copperWeight', title: '铜重(kg)', width: 90, dataType: 'number', readonly: true, precision: 4, group: '金属' },
  { field: 'aluminumWeight', title: '铝重(kg)', width: 90, dataType: 'number', readonly: true, precision: 4, group: '金属' },
  { field: 'materialCost', title: '材料成本', width: 100, dataType: 'number', readonly: true, precision: 2, group: '成本分解' },
  { field: 'wasteCost', title: '废品成本', width: 90, dataType: 'number', readonly: true, precision: 2, group: '成本分解' },
  { field: 'directLabor', title: '直接人工', width: 90, dataType: 'number', readonly: true, precision: 2, group: '成本分解' },
  { field: 'manufacturing', title: '制造费', width: 90, dataType: 'number', readonly: true, precision: 2, group: '成本分解' },
];

/** 客户视图列定义 (脱敏) */
export const CUSTOMER_COLUMNS: BomColumnDef[] = [
  { field: 'partNo', title: tField('partNo'), width: 140, dataType: 'string', readonly: true },
  { field: 'partName', title: tField('partName'), width: 200, dataType: 'string', readonly: true },
  { field: 'itemCategory', title: tField('itemCategory'), width: 100, dataType: 'string', readonly: true },
  { field: 'qty', title: tField('qty'), width: 80, dataType: 'number', readonly: true, precision: 2 },
  { field: 'unit', title: tField('unit'), width: 70, dataType: 'string', readonly: true },
  { field: 'unitPrice', title: tField('unitPrice'), width: 100, dataType: 'number', readonly: true, precision: 4 },
  { field: 'amount', title: tField('amount'), width: 100, dataType: 'number', readonly: true, precision: 2 },
];

/** 根据视图模式获取列配置 */
export function getColumnsForView(mode: 'engineering' | 'cost' | 'customer'): BomColumnDef[] {
  switch (mode) {
    case 'engineering': return ENGINEERING_COLUMNS;
    case 'cost': return COST_COLUMNS;
    case 'customer': return CUSTOMER_COLUMNS;
    default: return ENGINEERING_COLUMNS;
  }
}

/** 将列定义转为 Univer 列配置格式 */
export function toUniverColumns(columns: BomColumnDef[]): Array<{ field: string; name: string; width: number }> {
  return columns
    .filter(c => !c.hidden)
    .map(c => ({ field: c.field, name: c.title, width: c.width }));
}
