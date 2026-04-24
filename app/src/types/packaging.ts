/**
 * 包装方案与包装物流费用类型定义
 *
 * F09 包装方案 - 工艺工程师录入
 * F10 包装物流费用 - 包装物流工程师录入
 */

/** 包装箱类型 */
export type BoxType = '围板箱' | '塑料箱' | '纸箱' | '铁箱';

/** 包装方案信息（工艺工程师录入） */
export interface PackagingScheme {
  /** 线束零件号 */
  harnessId: string;
  /** 线束名称 */
  harnessName: string;

  // ── 产品信息 ──
  /** 线径 (如 "50mm²") */
  wireDiameter: string;
  /** 线束长度 (mm) */
  wireLength: number;
  /** 护套数 */
  connectorCount: number;

  // ── 包装规格 ──
  /** 包装箱类型 */
  boxType: BoxType;
  /** 包装箱规格 (如 "1200*1000*1100mm") */
  boxSpec: string;
  /** 每层数量 */
  perLayer: number;
  /** 层数 */
  layers: number;
  /** 每箱总数 */
  totalPerBox: number;

  // ── 辅材 ──
  /** 隔板型号 */
  dividerModel: string;
  /** 隔板数量 */
  dividerQty: number;

  // ── 备注 ──
  remark?: string;
}

/** 包装物流费用（包装物流工程师录入） */
export interface PackagingLogisticsCost {
  /** 线束零件号 */
  harnessId: string;
  /** 线束名称 */
  harnessName: string;

  // ── 包装费用明细 ──
  /** 内包装费 */
  innerPackaging: number;
  /** 外包装费 */
  outerPackaging: number;

  // ── 物流费用明细 ──
  /** 运费 */
  freight: number;
  /** 超额运费 */
  excessFreight: number;
  /** 短驳费 */
  shortHaul: number;
  /** 三方仓费用 */
  thirdPartyWarehouse: number;
  /** 仓储费 */
  storage: number;

  // ── 计算字段 ──
  /** 包装费小计 = 内包装 + 外包装 */
  totalPackaging: number;
  /** 物流费小计 = 运费 + 超额运费 + 短驳 + 三方仓 + 仓储 */
  totalLogistics: number;
  /** 合计 = 包装费小计 + 物流费小计 */
  grandTotal: number;
}

/** 创建空的包装方案 */
export function createEmptyPackagingScheme(harnessId: string, harnessName: string): PackagingScheme {
  return {
    harnessId,
    harnessName,
    wireDiameter: '',
    wireLength: 0,
    connectorCount: 0,
    boxType: '围板箱',
    boxSpec: '',
    perLayer: 0,
    layers: 0,
    totalPerBox: 0,
    dividerModel: '',
    dividerQty: 0,
    remark: '',
  };
}

/** 创建空的包装物流费用 */
export function createEmptyPackagingLogisticsCost(harnessId: string, harnessName: string): PackagingLogisticsCost {
  return {
    harnessId,
    harnessName,
    innerPackaging: 0,
    outerPackaging: 0,
    freight: 0,
    excessFreight: 0,
    shortHaul: 0,
    thirdPartyWarehouse: 0,
    storage: 0,
    totalPackaging: 0,
    totalLogistics: 0,
    grandTotal: 0,
  };
}

/** 计算包装物流费用的小计 */
export function calculatePackagingLogisticsTotals(cost: Partial<PackagingLogisticsCost>): {
  totalPackaging: number;
  totalLogistics: number;
  grandTotal: number;
} {
  const innerPackaging = cost.innerPackaging ?? 0;
  const outerPackaging = cost.outerPackaging ?? 0;
  const freight = cost.freight ?? 0;
  const excessFreight = cost.excessFreight ?? 0;
  const shortHaul = cost.shortHaul ?? 0;
  const thirdPartyWarehouse = cost.thirdPartyWarehouse ?? 0;
  const storage = cost.storage ?? 0;

  const totalPackaging = innerPackaging + outerPackaging;
  const totalLogistics = freight + excessFreight + shortHaul + thirdPartyWarehouse + storage;
  const grandTotal = totalPackaging + totalLogistics;

  return {
    totalPackaging: Math.round(totalPackaging * 10000) / 10000,
    totalLogistics: Math.round(totalLogistics * 10000) / 10000,
    grandTotal: Math.round(grandTotal * 10000) / 10000,
  };
}

/** 包装方案汇总统计 */
export interface PackagingSchemeSummary {
  /** 线束总数 */
  totalHarnesses: number;
  /** 已录入包装方案的线束数 */
  recordedCount: number;
  /** 各包装箱类型数量 */
  boxTypeCounts: Record<BoxType, number>;
}

/** 包装物流费用汇总统计 */
export interface PackagingLogisticsSummary {
  /** 线束总数 */
  totalHarnesses: number;
  /** 已录入费用的线束数 */
  recordedCount: number;
  /** 内包装费合计 */
  totalInnerPackaging: number;
  /** 外包装费合计 */
  totalOuterPackaging: number;
  /** 运费合计 */
  totalFreight: number;
  /** 超额运费合计 */
  totalExcessFreight: number;
  /** 短驳费合计 */
  totalShortHaul: number;
  /** 三方仓费用合计 */
  totalThirdPartyWarehouse: number;
  /** 仓储费合计 */
  totalStorage: number;
  /** 包装费小计 */
  totalPackaging: number;
  /** 物流费小计 */
  totalLogistics: number;
  /** 总计 */
  grandTotal: number;
  /** 按装车比加权后的单套费用 */
  weightedPerUnit: number;
}
