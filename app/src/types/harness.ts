/**
 * 线束级类型定义
 */

/** BOM 通用物料项 */
export interface BomItem {
  /** 物料编号 */
  partNo: string;
  /** 物料名称 */
  partName: string;
  /** 物料分类 */
  itemCategory: 'wire' | 'connector' | 'terminal' | 'ipt_terminal' | 'bracket_rubber' | 'tape_tube' | 'other';
  /** 用量 */
  qty: number;
  /** 单位 (m/个/根/…) */
  unit: string;
  /** 单价 (元) */
  unitPrice: number;
  /** 小计金额 (元) */
  amount: number;
  /** SAP 物料号 */
  sapNo?: string;
  /** 规格描述 */
  spec?: string;
  /** 端组标记 */
  endGroup?: string;
  /** 功能描述（端组功能，如"接ACCM端"） */
  functionText?: string;
  /** 供应商 */
  supplier?: string;
  /** 是否半成品 */
  isSemiFinished?: boolean;
}

/** 导线型 BOM 物料 (扩展) */
export interface WireItem extends BomItem {
  itemCategory: 'wire';
  /** 铜重 (kg/根) */
  copperWeightPerUnit: number;
  /** 铝重 (kg/根) */
  aluminumWeightPerUnit: number;
  /** 非金属成本 (元/根) — 绝缘层等 */
  nonMetalCostPerUnit: number;
  /** 截面积 (mm²) */
  crossSection?: number;
}

/** 包装费明细 */
export interface PackagingCost {
  /** 内盒/内箱 */
  innerBoxCost: number;
  /** 外箱/纸箱 */
  outerBoxCost: number;
  /** 托盘/栈板 */
  palletCost: number;
  /** 隔板/隔片 */
  trayDividerCost: number;
  /** 气泡膜/缓冲 */
  bubbleWrapCost: number;
  /** 标签 */
  labelCost: number;
  /** 包装小计 */
  subtotal: number;
}

/** 运输费明细 */
export interface FreightCost {
  /** 运费 */
  freight: number;
  /** 超额运费 */
  excessFreight: number;
  /** 短驳费 */
  shortHaul: number;
  /** 三方仓费 */
  thirdPartyWarehouse: number;
  /** 仓储费 */
  storage: number;
  /** 运输小计 */
  subtotal: number;
}

/** 线束核算输入参数 */
export interface HarnessInput {
  /** 零件号 (如 6608442966) */
  harnessId: string;
  /** 线束名称 */
  harnessName: string;
  /** 装车比 (0~1) */
  vehicleRatio: number;
  /** BOM 物料清单 */
  bom: (BomItem | WireItem)[];
  /** 前工序工时 (小时) */
  frontHours: number;
  /** 后工序工时 (小时) */
  backHours: number;
  /** 包装费 */
  packaging: PackagingCost;
  /** 运输费 */
  freight: FreightCost;
}

/** 材料成本拆分 */
export interface MaterialBreakdown {
  /** 铜成本 (元) */
  cuCost: number;
  /** 铝成本 (元) */
  alCost: number;
  /** 非金属成本 (元) — 绝缘层等 */
  nonMetalCost: number;
  /** 按分类汇总 */
  byType: {
    wire: number;
    connector: number;
    terminal: number;
    ipt_terminal: number;
    bracket_rubber: number;
    tape_tube: number;
    other: number;
  };
  /** 总金属成本 */
  totalMetalCost: number;
  /** 总非导线成本 */
  totalNonWireCost: number;
}

/** 线束核算结果 */
export interface HarnessResult {
  /** 零件号 */
  harnessId: string;
  /** 线束名称 */
  harnessName: string;
  /** 装车比 */
  vehicleRatio: number;
  /** 铜重合计 (kg) */
  copperWeight: number;
  /** 铝重合计 (kg) */
  aluminumWeight: number;
  /** 总工时 (小时) */
  processHours: number;

  /** 材料成本 (元) */
  materialCost: number;
  /** 废品成本 = 材料 × 废品率 */
  wasteCost: number;
  /** 直接人工 = 工时 × 人工费率 */
  directLabor: number;
  /** 制造费 = 工时 × 制造费率 */
  manufacturing: number;
  /** 人工+制造 */
  laborPlusMfg: number;
  /** 管理费 = (材料+人工+制造) × 管理费率 */
  mgmtFee: number;
  /** 利润 = (材料+废品+人工+制造+管理费) × 利润率 */
  profit: number;
  /** 出厂价 = 材料+废品+人工+制造+管理费+利润 */
  exFactoryPrice: number;

  /** 包装费小计 */
  packSubtotal: number;
  /** 运输费小计 */
  freightSubtotal: number;
  /** 包装+运输 */
  packTotal: number;
  /** 到厂价 = 出厂价+包装+运输 */
  deliveredPrice: number;

  /** 材料拆分明细 */
  materialBreakdown: MaterialBreakdown;
  /** 包装明细 */
  packagingDetail: PackagingCost;
  /** 运输明细 */
  freightDetail: FreightCost;
  /** 计算精度等级 (1=系数近似, 2=线束级, 3=BOM行级) */
  precisionLevel?: PrecisionLevel;

  /** 核算参数快照 (用于联动计算) */
  _params: {
    wasteRate: number;
    mgmtRate: number;
    profitRate: number;
    laborRate: number;
    mfgRate: number;
  };
}

/** 项目级汇总结果 (从各线束加权汇总) */
export interface ProjectHarnessResult {
  /** 线束明细 */
  harnesses: HarnessResult[];
  /** 项目单车成本 = Σ(到厂价 × 装车比) */
  vehicleCost: number;
  /** 线束数量 */
  harnessCount: number;
  /** 总铜重 */
  totalCopperWeight: number;
  /** 总铝重 */
  totalAluminumWeight: number;
  /** 总工时 */
  totalProcessHours: number;

  // ── 加权汇总字段 (按装车比加权) ──
  /** 加权材料成本 */
  weightedMaterial: number;
  /** 加权废品 */
  weightedWaste: number;
  /** 加权人工 */
  weightedLabor: number;
  /** 加权制造费 */
  weightedMfg: number;
  /** 加权人工+制造 */
  weightedLaborPlusMfg: number;
  /** 加权管理费 */
  weightedMgmtFee: number;
  /** 加权利润 */
  weightedProfit: number;
  /** 加权出厂价 */
  weightedExFactory: number;
  /** 加权包装费 */
  weightedPack: number;
  /** 加权运输费 */
  weightedFreight: number;
  /** 加权铜重 */
  weightedCopperWeight: number;
  /** 加权铝重 */
  weightedAluminumWeight: number;
  /** 加权工时 */
  weightedProcessHours: number;
}

import { GapStatus } from './financial_schema';

/** 内部核算结果 (对内) */
export interface InternalHarnessResult {
  harnessId: string;
  harnessName: string;
  vehicleRatio: number;
  materialCost: number;        // 与客户报价相同
  directLabor: number;         // 直接人工 (元)
  
  // 6D MOH 制造费分解
  indirectLabor: number;       // 间接人工
  lowValueConsumables: number; // 低值易耗
  materialConsumption: number; // 机物料消耗
  factoryAmortization: number; // 厂房分摊
  automationAmortization: number; // 自动化分摊
  otherOverhead: number;       // 其他制造费
  
  materialWaste: number;       // 材料损耗 (元)
  
  mfgOverheadTotal: number;    // 制造费小计
  packTotal: number;           // 包装+运输
  internalCost: number;        // 内部实绩总成本
  
  processHours: number;
  copperWeight: number;
  aluminumWeight: number;
  
  // 流程合规位 (由张滔滔定义)
  gapStatus: GapStatus;
  auditTraceId?: string;
  /** 偏差分析 (如实绩损耗与 0.5% 标杆的差异) */
  deviationAnalysis?: string;
  /** 管理 Gap 绝对值 (元) = (实绩损耗率 - 0.5% 标杆) * 裸材成本 */
  managementGapAmount: number;
  /** 商务策略调节项 (对冲 Gap) */
  salesAdjustmentBuffer: number;
}

/** 内部项目级汇总结果 */
export interface InternalProjectResult {
  /** 线束明细 */
  harnesses: InternalHarnessResult[];
  /** 项目单车内部成本 */
  vehicleCost: number;
  /** 加权材料 */
  weightedMaterial: number;
  /** 加权直接人工 */
  weightedDirectLabor: number;
  /** 加权间接人工 */
  weightedIndirectLabor: number;
  /** 加权厂房分摊 */
  weightedFactoryAmortization: number;
  /** 加权机物料 */
  weightedMaterialConsumption: number;
  /** 加权其他制造 */
  weightedOtherOverhead: number;
  /** 加权材料损耗 */
  weightedMaterialWaste: number;
  /** 加权低值易耗品 */
  weightedLowValueConsumables: number;
  /** 加权自动化仓 */
  weightedAutomationAmortization: number;
  /** 加权制造费小计 */
  weightedMfgOverheadTotal: number;
  /** 加权包装运输 */
  weightedPack: number;
  /** 总商务调节项 (加权后) */
  totalSalesAdjustmentBuffer: number;
  
  // 全局流程状态
  projectGapStatus: GapStatus;
  /** 项目级偏差分析汇总 */
  deviationAnalysis?: string;
}

/** 年度成本明细 */
export interface AnnualCostBreakdown {
  /** 年度序号 (1-based) */
  year: number;
  /** 年产量 */
  volume: number;
  /** 设备分摊 (元/件) = annualDepreciation / volume */
  equipmentPerUnit: number;
  /** 固定制造费分摊 (元/件) — 与产量相关的间接费 */
  fixedMfgPerUnit: number;
  /** 该年度单件总成本 = 变动成本 + 设备分摊 + 固定制造费分摊 */
  totalCostPerUnit: number;
  /** 与基准年差异 */
  deltaFromBase: number;
  /** 差异率 (%) */
  deltaPercent: number;
}

/** 年度差异化计算结果 */
export interface AnnualizedCostResult {
  /** 线束ID */
  harnessId: string;
  /** 变动成本 (不含设备分摊的单件成本) */
  variableCostPerUnit: number;
  /** 各年度成本明细 */
  annualBreakdown: AnnualCostBreakdown[];
  /** 生命周期加权平均成本 */
  lifecycleWeightedAvg: number;
  /** 最大偏差 (相对加权平均) */
  maxDeviation: number;
  /** 最大偏差率 (%) */
  maxDeviationPercent: number;
}

/** 成本 Schema 核算结果 */
export interface SchemaComputeResult {
  harnessId: string;
  harnessName: string;
  vehicleRatio: number;
  /** 各成本项计算值 */
  items: Record<string, number>;
  /** 出厂价 */
  exFactoryPrice: number;
  /** 到厂价 */
  deliveredPrice: number;
  /** 使用的 schema */
  schemaName: string;
  /** 材料明细 (如果有bom_sum项) */
  materialBreakdown?: MaterialBreakdown;
  /** 工时 */
  processHours: number;
  copperWeight: number;
  aluminumWeight: number;
}

/** 计算精度等级 */
export type PrecisionLevel = 1 | 2 | 3;

/** 精度元信息 */
export interface PrecisionMeta {
  /** 精度等级 */
  level: PrecisionLevel;
  /** 精度描述 */
  description: string;
  /** 缺失数据项 */
  missingData: string[];
  /** 数据完整度 (0~1) */
  completeness: number;
}
