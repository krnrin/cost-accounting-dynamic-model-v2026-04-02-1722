/**
 * D2: 界面术语本地化映射
 * 
 * 将代码中的英文字段名映射为用户友好的中文术语
 * 用法: import { t, tField } from '@/lib/i18n';
 *       <th>{tField('harnessId')}</th>
 */

/** 字段名 → 中文术语 */
const FIELD_LABELS: Record<string, string> = {
  // ── 线束/BOM 核心字段 ──
  harnessId: '零件号',
  harnessName: '线束名称',
  partNo: '物料编号',
  partName: '物料名称',
  itemCategory: '物料分类',
  qty: '用量',
  unit: '单位',
  unitPrice: '单价(元)',
  amount: '金额(元)',
  sapNo: 'SAP物料号',
  spec: '规格描述',
  endGroup: '端组',
  functionText: '功能描述',
  supplier: '供应商',
  isSemiFinished: '半成品',
  vehicleRatio: '装车比',
  configType: '标配/选配',
  functionalSlot: '功能位置',

  // ── 导线特有字段 ──
  copperWeightPerUnit: '铜重(kg/根)',
  aluminumWeightPerUnit: '铝重(kg/根)',
  nonMetalCostPerUnit: '非金属成本(元/根)',
  crossSection: '截面积(mm²)',

  // ── 成本字段 ──
  materialCost: '材料成本',
  wasteCost: '废品成本',
  directLabor: '直接人工',
  manufacturing: '制造费',
  laborPlusMfg: '人工+制造',
  mgmtFee: '管理费',
  profit: '利润',
  exFactoryPrice: '出厂价',
  packSubtotal: '包装费',
  freightSubtotal: '运输费',
  packTotal: '包装+运输',
  deliveredPrice: '到厂价',
  copperWeight: '铜重(kg)',
  aluminumWeight: '铝重(kg)',
  processHours: '总工时(h)',
  frontHours: '前工序工时(h)',
  backHours: '后工序工时(h)',

  // ── 费率字段 ──
  laborRate: '人工费率(元/h)',
  mfgRate: '制造费率(元/h)',
  wasteRate: '废品率',
  mgmtRate: '管理费率',
  profitRate: '利润率',

  // ── 金属价格 ──
  copper: '铜价(元/吨)',
  aluminum: '铝价(元/吨)',

  // ── 项目字段 ──
  projectCode: '项目编号',
  projectName: '项目名称',
  customer: '客户名称',
  platform: '平台/车型',
  lifecycleYears: '生命周期(年)',
  status: '状态',
  annualDropRate: '年降率',

  // ── 场景字段 ──
  scenarioName: '场景名称',
  scenarioId: '场景ID',
  parentScenarioId: '父场景ID',

  // ── 包装运输明细 ──
  innerBoxCost: '内箱费',
  outerBoxCost: '外箱费',
  palletCost: '托盘费',
  trayDividerCost: '隔板费',
  bubbleWrapCost: '缓冲材料费',
  labelCost: '标签费',
  freight: '运费',
  excessFreight: '超额运费',
  shortHaul: '短驳费',
  thirdPartyWarehouse: '三方仓费',
  storage: '仓储费',

  // ── 内部核算 ──
  indirectLabor: '间接人工',
  lowValueConsumables: '低值易耗品',
  materialConsumption: '机物料消耗',
  factoryAmortization: '厂房分摊',
  automationAmortization: '自动化分摊',
  otherOverhead: '其他制造费',
  materialWaste: '材料损耗',
  mfgOverheadTotal: '制造费小计',
  internalCost: '内部实绩成本',

  // ── 版本/审计 ──
  versionId: '版本ID',
  versionLabel: '版本标签',
  createdAt: '创建时间',
  updatedAt: '更新时间',

  // ── 预警 ──
  alertType: '预警类型',
  threshold: '阈值',
  severity: '严重度',
};

/** 物料分类 → 中文 */
const CATEGORY_LABELS: Record<string, string> = {
  wire: '导线',
  connector: '连接器',
  terminal: '端子',
  ipt_terminal: 'IPT端子',
  bracket_rubber: '支架/橡胶件',
  tape_tube: '胶带/波纹管',
  other: '其他',
};

/** 项目状态 → 中文 */
const STATUS_LABELS: Record<string, string> = {
  draft: '草稿',
  quoted: '已报价',
  awarded: '已定点',
  production: '量产中',
  eol: '停产',
};

/** 场景状态 → 中文 */
const SCENARIO_STATUS_LABELS: Record<string, string> = {
  draft: '草稿',
  frozen: '已冻结',
  published: '已发布',
  archived: '已归档',
};

/** 预警严重度 → 中文 */
const SEVERITY_LABELS: Record<string, string> = {
  info: '信息',
  warning: '警告',
  critical: '严重',
};

/**
 * 翻译字段名
 * @example tField('harnessId') => '零件号'
 */
export function tField(field: string): string {
  return FIELD_LABELS[field] || field;
}

/**
 * 翻译物料分类
 * @example tCategory('wire') => '导线'
 */
export function tCategory(category: string): string {
  return CATEGORY_LABELS[category] || category;
}

/**
 * 翻译项目状态
 */
export function tStatus(status: string): string {
  return STATUS_LABELS[status] || status;
}

/**
 * 翻译场景状态
 */
export function tScenarioStatus(status: string): string {
  return SCENARIO_STATUS_LABELS[status] || status;
}

/**
 * 翻译严重度
 */
export function tSeverity(severity: string): string {
  return SEVERITY_LABELS[severity] || severity;
}

/**
 * 通用翻译 (按优先级查找所有映射表)
 */
export function t(key: string): string {
  return (
    FIELD_LABELS[key] ||
    CATEGORY_LABELS[key] ||
    STATUS_LABELS[key] ||
    SCENARIO_STATUS_LABELS[key] ||
    SEVERITY_LABELS[key] ||
    key
  );
}

export { FIELD_LABELS, CATEGORY_LABELS, STATUS_LABELS, SCENARIO_STATUS_LABELS, SEVERITY_LABELS };
