/**
 * 项目级类型定义
 */

import type { NreData } from './quote';

/** 成本费率配置（对外客户报价） */
export interface CostRates {
  /** 直接人工费率 (元/小时) — 默认 35 */
  laborRate: number;
  /** 制造费率 (元/小时) — 默认 46.69 */
  mfgRate: number;
  /** 废品率 — 默认 0.01 (1%) */
  wasteRate: number;
  /** 管理费率 — 默认 0.06 (6%)，基数不含废品 */
  mgmtRate: number;
  /** 利润率 — 默认 0.056627 (5.6627%)，基数含废品 */
  profitRate: number;
}

/** 内部核算费率 (对内实绩精算) */
export interface InternalCostRates {
  /** 直接人工费率 (元/h) */
  laborRate: number;
  
  /** 6D MOH 制造费率分解 (元/h) */
  indirectLaborRate: number;       // 间接人工
  lowValueConsumablesRate: number; // 低值易耗
  materialConsumptionRate: number; // 机物料消耗
  factoryAmortizationRate: number; // 厂房分摊 (Fixed)
  automationAmortizationRate: number; // 自动化分摊 (Fixed)
  otherOverheadRate: number;       // 其他制造费
  
  /** 材料损耗率 (e.g. 0.005) */
  materialWasteRate: number;
}

/** 金属价格 (元/吨) */
export interface MetalPrices {
  /** 铜价 (元/吨) */
  copper: number;
  /** 铝价 (元/吨) */
  aluminum: number;
}

/** 年度产量计划 */
export interface VolumeSchedule {
  /** 年度序号 (1-based) */
  year: number;
  /** 年产量 (台) */
  volume: number;
  /** 备注 */
  remark?: string;
}

/** 项目元信息 */
export interface ProjectMeta {
  /** 项目ID (IndexedDB主键) */
  id?: string;
  /** 项目编号 (如 E281) */
  projectCode: string;
  /** 项目名称 (如 "吉利E281高压线束") */
  projectName: string;
  /** 客户名称 */
  customer: string;
  /** 平台/车型 */
  platform?: string;
  /** @deprecated 已移至 ScenarioRecord.lifecycleYears */
  lifecycleYears?: number;
  /** 创建时间 */
  createdAt: string;
  /** 最后更新时间 */
  updatedAt: string;
  /** 状态 */
  status: 'draft' | 'quoted' | 'awarded' | 'production' | 'eol';
}

/** Level 1 系数近似参数 (成本分解系数) */
export interface Level1Coefficients {
  /** 材料占比 (默认 0.65) */
  materialRatio: number;
  /** 人工占比 (默认 0.09) */
  laborRatio: number;
  /** 制造占比 (默认 0.12) */
  mfgRatio: number;
  /** 包装占比 (默认 0.024) */
  packagingRatio: number;
  /** 运输占比 (默认 0.006) */
  freightRatio: number;
}

/** 项目配置 */
export interface ProjectConfig {
  /** 成本费率 */
  costRates: CostRates;
  /** 内部核算费率 (可选) */
  internalRates?: InternalCostRates;
  /** 基准金属价格 */
  metalPrices: MetalPrices;
  /** 年度产量计划 */
  volumes: VolumeSchedule[];
  /** 年降率 */
  annualDropRate: number;
  /** NRE 一次性费用 (工装/试验/研发) */
  nreData?: NreData;
  /** 物料组成系数 (估算模式 fallback) */
  materialComposition?: {
    connector: number;
    copper: number;
    aluminum: number;
    other: number;
  };
  /** 设备投资配置 */
  equipmentConfig?: EquipmentConfig;
  /** BOM 分类规则 (可选, 无则使用默认规则) */
  bomClassificationRules?: BomClassificationRule[];
  /** 成本结构定义 (可选, 无则使用默认结构) */
  costStructure?: CostStructureSchema;
  /** 多工厂配置 (可选, 无则使用项目级 costRates 作为唯一工厂) */
  factories?: FactoryConfig[];
  /** 间接费用分摊配置 (可选, 无则使用默认) */
  allocationConfig?: AllocationConfig;
  /** Level 1 系数近似参数 (可选, 无则使用引擎默认值) */
  level1Coefficients?: Level1Coefficients;
  /** 返点/返利配置 (如 QS 返点) */
  rebate?: RebateConfig;
}

/** 工厂配置 */
export interface FactoryConfig {
  /** 工厂ID (如 'HQ', 'SZ', 'CS') */
  factoryId: string;
  /** 工厂名称 (如 '总部工厂', '深圳工厂', '长沙工厂') */
  factoryName: string;
  /** 对外客户报价费率 */
  costRates: CostRates;
  /** 对内核算费率 (可选) */
  internalRates?: InternalCostRates;
  /** 效率系数 (1.0 = 基准, 0.9 = 效率高10%, 1.2 = 效率低20%) — 乘以工时 */
  efficiencyFactor: number;
  /** 是否为基准工厂 */
  isBase?: boolean;
  /** 备注 */
  remark?: string;
}

/** 设备投资配置 */
export interface EquipmentConfig {
  /** 共用设备总投资 (元) */
  sharedInvestment: number;
  /** 专用设备总投资 (元) */
  dedicatedInvestment: number;
  /** 设备年折旧额 (元/年) — 通常 = 总投资 / 折旧年限 */
  annualDepreciation: number;
  /** 折旧年限 (年) */
  depreciationYears: number;
  /** 设备残值率 (0~1, 通常 0.05) */
  residualRate?: number;
}

/** 完整项目定义 */
export interface Project {
  meta: ProjectMeta;
  /** @deprecated 已移至 ScenarioRecord.config */
  config?: ProjectConfig;
}

/** BOM 分类规则 */
export interface BomClassificationRule {
  /** 目标分类 */
  category: 'wire' | 'connector' | 'terminal' | 'ipt_terminal' | 'bracket_rubber' | 'tape_tube' | 'other';
  /** 匹配正则表达式列表 (任一匹配即归类) */
  patterns: string[];
  /** 排除正则列表 (匹配则跳过此规则) */
  excludePatterns?: string[];
  /** 匹配字段 (默认 ['partName', 'itemCategory']) */
  matchFields?: ('partName' | 'partNo' | 'spec' | 'itemCategory')[];
  /** 优先级 (数字越大优先级越高，默认 0) */
  priority?: number;
}

/** 成本项计算方式 */
export type CostItemCalcMethod = 
  | 'bom_sum'           // BOM行汇总 (材料)
  | 'rate_x_hours'      // 费率×工时 (人工/制造)
  | 'rate_x_base'       // 费率×基数 (废品/管理费/利润 — 基数由 baseRef 定义)
  | 'direct'            // 直接输入值 (包装/运输)
  | 'fixed_per_unit'    // 固定单件费 (如认证费/样品费分摊)
  | 'custom_formula';   // 自定义公式 (预留扩展)

/** 单个成本项定义 */
export interface CostItemDef {
  /** 成本项唯一标识 (如 'material', 'waste', 'directLabor') */
  key: string;
  /** 显示名称 (如 '材料成本', '废品', '直接人工') */
  label: string;
  /** 计算方式 */
  calcMethod: CostItemCalcMethod;
  /** 费率值 (rate_x_hours/rate_x_base 方式需要) */
  rate?: number;
  /** 基数引用的成本项 key 列表 (rate_x_base 方式: 基数 = sum of referenced items) */
  baseRef?: string[];
  /** 固定金额 (fixed_per_unit / direct 方式的默认值) */
  fixedAmount?: number;
  /** 是否包含在出厂价 (默认 true) */
  inExFactory?: boolean;
  /** 是否为附加费 (包装/运输等，加在出厂价之后) */
  isAddon?: boolean;
  /** 排序权重 (数值越小越靠前) */
  order?: number;
  /** 是否对内可见 (内部核算显示) */
  visibleInternal?: boolean;
  /** 是否对外可见 (客户报价显示) */
  visibleExternal?: boolean;
}

/** 成本结构 Schema */
export interface CostStructureSchema {
  /** Schema 名称 (如 '吉利标准', '比亚迪标准') */
  name: string;
  /** Schema 版本 */
  version?: string;
  /** 成本项列表 (按 order 排序) */
  items: CostItemDef[];
}

/** 返点/返利配置 */
export interface RebateConfig {
  /** 返点总额 (元) */
  totalAmount: number;
  /** 返点类型描述 (如 "QS返点") */
  label: string;
  /** 按年分配金额 (与 volumes 对齐) */
  yearDistribution: number[];
}

/** 间接费用分摊驱动因子 */
export type AllocationDriver = 
  | 'hours'          // 工时占比
  | 'revenue'        // 收入占比 (到厂价)
  | 'material_cost'  // 材料成本占比
  | 'direct'         // 直接归属 (不分摊)
  | 'volume'         // 产量占比
  | 'equal';         // 平均分摊

/** 分摊配置项 */
export interface AllocationConfig {
  /** 设备折旧分摊方式 (默认 'hours') */
  equipment: AllocationDriver;
  /** 研发费分摊方式 (默认 'revenue') */
  rnd: AllocationDriver;
  /** 间接人工分摊方式 (默认 'hours') */
  indirectLabor: AllocationDriver;
  /** 管理费分摊方式 — 'direct' 表示按各线束独立计算; 其他值表示按某驱动因子分配总额 */
  management: AllocationDriver;
}
