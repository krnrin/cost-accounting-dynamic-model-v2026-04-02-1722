/**
 * 一次性费用分摊引擎 (One-time Cost Amortization Engine)
 * 
 * 核心规则（来源：吉利总报价模板(定点版)）：
 * 1. 按「根」独立分摊，每条线束有独立的分摊基数（默认 50,000 根）
 * 2. 费用类别：工装(tooling)、试验(testing)、研发(rnd)
 * 3. 单根分摊 = 总费用 ÷ 分摊基数
 * 4. 部分线束不参与分摊（工装=0 且 试验=0 且 研发=0）
 * 5. 回收进度因装车比不同而不同（装车比高的线束先达到分摊基数）
 */

// ═══════════════════════════════════════════
// 类型定义
// ═══════════════════════════════════════════

/** 支付模式 */
export type PaymentMode = 'amortized' | 'lumpsum' | 'mixed';

/** 回收状态 */
export type RecoveryStatus = 'recovering' | 'recovered' | 'overdue';

/** 单条线束的一次性费用输入 */
export interface OnetimeCostInput {
  /** 零件号 */
  harnessId: string;
  /** 线束名称 */
  harnessName: string;
  /** 装车比 (0~1) */
  vehicleRatio: number;
  /** 工装费用 (元) — 新制 */
  toolingCost: number;
  /** 试验费用 (元) — 新制 */
  testingCost: number;
  /** 研发费用 (元) — 通常为 0 */
  rndCost: number;
  /** 分摊基数 (根)，默认 50,000 */
  allocBase: number;
  /** 支付模式：amortized=分摊, lumpsum=一次性付清, mixed=混合 */
  paymentMode?: PaymentMode;
}

/** 单条线束的分摊计算结果 */
export interface OnetimeCostAllocation {
  /** 零件号 */
  harnessId: string;
  /** 线束名称 */
  harnessName: string;
  /** 装车比 */
  vehicleRatio: number;

  /** 工装总费用 */
  toolingCost: number;
  /** 试验总费用 */
  testingCost: number;
  /** 研发总费用 */
  rndCost: number;
  /** 一次性费用合计 = 工装 + 试验 + 研发 */
  totalOnetimeCost: number;

  /** 分摊基数 (根) */
  allocBase: number;
  /** 是否参与分摊 (totalOnetimeCost > 0) */
  participates: boolean;

  /** 单根工装分摊 = toolingCost / allocBase */
  toolingPerUnit: number;
  /** 单根试验分摊 = testingCost / allocBase */
  testingPerUnit: number;
  /** 单根研发分摊 = rndCost / allocBase */
  rndPerUnit: number;
  /** 单根总分摊 = totalOnetimeCost / allocBase */
  totalPerUnit: number;

  /** 含分摊的到厂价增量 (= totalPerUnit，直接加到到厂价上) */
  priceAddon: number;
  /** 支付模式 */
  paymentMode: PaymentMode;
}

/** 分摊回收跟踪器 */
export interface AllocRecoveryTracker {
  /** 零件号 */
  harnessId: string;
  /** 线束名称 */
  harnessName: string;
  /** 装车比 */
  vehicleRatio: number;
  /** 分摊基数 */
  allocBase: number;

  /** 已生产数量 (根) — 累计 */
  cumProduced: number;
  /** 回收进度 (0~1) = min(cumProduced / allocBase, 1.0) */
  recoveryProgress: number;
  /** 是否已回收完毕 */
  fullyRecovered: boolean;
  /** 回收状态 */
  status: RecoveryStatus;
  /** 回收完成日期 */
  recoveredDate?: string;

  /** 一次性费用总额 */
  totalOnetimeCost: number;
  /** 已回收金额 = totalPerUnit × min(cumProduced, allocBase) */
  recoveredAmount: number;
  /** 未回收金额 = totalOnetimeCost - recoveredAmount */
  remainingAmount: number;

  /** 预估回收完成时间点（年）— 基于年产能和装车比推算 */
  estimatedRecoveryYear: number | null;
  /** 回收完成后是否需要调价 */
  needsPriceAdjustment: boolean;
  /** 支付模式 */
  paymentMode: PaymentMode;
}

/** 项目级分摊汇总 */
export interface ProjectAllocSummary {
  /** 所有线束的分摊明细 */
  allocations: OnetimeCostAllocation[];
  /** 参与分摊的线束数量 */
  participatingCount: number;
  /** 不参与分摊的线束数量 */
  nonParticipatingCount: number;

  /** 工装费合计 */
  totalTooling: number;
  /** 试验费合计 */
  totalTesting: number;
  /** 研发费合计 */
  totalRnd: number;
  /** 一次性费用总计 */
  grandTotal: number;

  /** 加权分摊 (按装车比加权的单根分摊) = Σ(totalPerUnit × vehicleRatio) */
  weightedAllocPerVehicle: number;
}

/** 项目级回收进度汇总 */
export interface ProjectRecoverySummary {
  /** 各线束回收跟踪 */
  trackers: AllocRecoveryTracker[];
  /** 已全部回收的线束数 */
  fullyRecoveredCount: number;
  /** 总回收进度 (加权) */
  overallRecoveryProgress: number;
  /** 总已回收金额 */
  totalRecovered: number;
  /** 总未回收金额 */
  totalRemaining: number;
  /** 需要调价提醒的线束列表 */
  priceAdjustmentAlerts: string[];
}

// ═══════════════════════════════════════════
// 核心计算函数
// ═══════════════════════════════════════════

/**
 * 计算单条线束的一次性费用分摊
 * 
 * @param input 一次性费用输入
 * @returns 分摊计算结果
 */
export function computeOnetimeAlloc(input: OnetimeCostInput): OnetimeCostAllocation {
  const totalOnetimeCost = input.toolingCost + input.testingCost + input.rndCost;
  const paymentMode = input.paymentMode ?? 'amortized';
  // lumpsum: 一次性付清，不参与分摊
  const participates = totalOnetimeCost > 0 && paymentMode !== 'lumpsum';
  const allocBase = input.allocBase || 50000;

  const toolingPerUnit = allocBase > 0 ? input.toolingCost / allocBase : 0;
  const testingPerUnit = allocBase > 0 ? input.testingCost / allocBase : 0;
  const rndPerUnit = allocBase > 0 ? input.rndCost / allocBase : 0;
  const totalPerUnit = toolingPerUnit + testingPerUnit + rndPerUnit;

  return {
    harnessId: input.harnessId,
    harnessName: input.harnessName,
    vehicleRatio: input.vehicleRatio,
    toolingCost: input.toolingCost,
    testingCost: input.testingCost,
    rndCost: input.rndCost,
    totalOnetimeCost,
    allocBase,
    participates,
    toolingPerUnit,
    testingPerUnit,
    rndPerUnit,
    totalPerUnit,
    priceAddon: totalPerUnit,
    paymentMode,
  };
}

/**
 * 计算分摊回收跟踪
 *
 * @param alloc 分摊结果
 * @param cumProduced 已生产累计数量 (根)
 * @param annualCapacity 年产能 (台/年)
 * @param lifecycleYears 项目生命周期年数（用于判断 overdue）
 * @returns 回收跟踪器
 */
export function computeAllocRecovery(
  alloc: OnetimeCostAllocation,
  cumProduced: number,
  annualCapacity: number,
  lifecycleYears?: number,
): AllocRecoveryTracker {
  const paymentMode: PaymentMode = alloc.paymentMode ?? 'amortized';

  if (!alloc.participates) {
    return {
      harnessId: alloc.harnessId,
      harnessName: alloc.harnessName,
      vehicleRatio: alloc.vehicleRatio,
      allocBase: alloc.allocBase,
      cumProduced: 0,
      recoveryProgress: 1,
      fullyRecovered: true,
      status: 'recovered',
      totalOnetimeCost: 0,
      recoveredAmount: 0,
      remainingAmount: 0,
      estimatedRecoveryYear: null,
      needsPriceAdjustment: false,
      paymentMode,
    };
  }

  const progress = Math.min(cumProduced / alloc.allocBase, 1.0);
  const fullyRecovered = cumProduced >= alloc.allocBase;
  const effectiveProduced = Math.min(cumProduced, alloc.allocBase);
  const recoveredAmount = alloc.totalPerUnit * effectiveProduced;
  const remainingAmount = alloc.totalOnetimeCost - recoveredAmount;

  // 估算回收完成年份
  // 每年该线束产量 = annualCapacity × vehicleRatio
  const annualProduction = annualCapacity * alloc.vehicleRatio;
  let estimatedRecoveryYear: number | null = null;
  if (annualProduction > 0 && !fullyRecovered) {
    const remainingUnits = alloc.allocBase - cumProduced;
    estimatedRecoveryYear = Math.ceil(remainingUnits / annualProduction);
  } else if (fullyRecovered) {
    estimatedRecoveryYear = null; // 已回收完毕
  }

  // 判断回收状态
  let status: RecoveryStatus = 'recovering';
  let recoveredDate: string | undefined;
  if (fullyRecovered) {
    status = 'recovered';
  } else if (lifecycleYears && estimatedRecoveryYear !== null && estimatedRecoveryYear > lifecycleYears) {
    status = 'overdue';
  }

  return {
    harnessId: alloc.harnessId,
    harnessName: alloc.harnessName,
    vehicleRatio: alloc.vehicleRatio,
    allocBase: alloc.allocBase,
    cumProduced,
    recoveryProgress: progress,
    fullyRecovered,
    status,
    recoveredDate,
    totalOnetimeCost: alloc.totalOnetimeCost,
    recoveredAmount,
    remainingAmount: Math.max(0, remainingAmount),
    estimatedRecoveryYear,
    needsPriceAdjustment: fullyRecovered,
    paymentMode,
  };
}

/**
 * 批量计算项目级分摊汇总
 * 
 * @param inputs 所有线束的一次性费用输入
 * @returns 项目级分摊汇总
 */
export function computeProjectAlloc(inputs: OnetimeCostInput[]): ProjectAllocSummary {
  const allocations = inputs.map(computeOnetimeAlloc);
  const participating = allocations.filter(a => a.participates);

  const totalTooling = allocations.reduce((sum, a) => sum + a.toolingCost, 0);
  const totalTesting = allocations.reduce((sum, a) => sum + a.testingCost, 0);
  const totalRnd = allocations.reduce((sum, a) => sum + a.rndCost, 0);

  // 加权分摊 = Σ(单根分摊 × 装车比)
  const weightedAllocPerVehicle = allocations.reduce(
    (sum, a) => sum + a.totalPerUnit * a.vehicleRatio,
    0
  );

  return {
    allocations,
    participatingCount: participating.length,
    nonParticipatingCount: allocations.length - participating.length,
    totalTooling,
    totalTesting,
    totalRnd,
    grandTotal: totalTooling + totalTesting + totalRnd,
    weightedAllocPerVehicle,
  };
}

/**
 * 批量计算项目级回收进度
 *
 * @param allocations 所有线束的分摊结果
 * @param cumProducedMap 已生产数量映射 { harnessId: cumProduced }
 * @param annualCapacity 年产能 (台/年)
 * @param lifecycleYears 项目生命周期年数（用于判断 overdue）
 * @returns 项目级回收汇总
 */
export function computeProjectRecovery(
  allocations: OnetimeCostAllocation[],
  cumProducedMap: Record<string, number>,
  annualCapacity: number,
  lifecycleYears?: number,
): ProjectRecoverySummary {
  const trackers = allocations.map(a =>
    computeAllocRecovery(a, cumProducedMap[a.harnessId] || 0, annualCapacity, lifecycleYears)
  );

  const participatingTrackers = trackers.filter(t => t.totalOnetimeCost > 0);
  const fullyRecoveredCount = participatingTrackers.filter(t => t.fullyRecovered).length;
  const totalRecovered = participatingTrackers.reduce((s, t) => s + t.recoveredAmount, 0);
  const totalRemaining = participatingTrackers.reduce((s, t) => s + t.remainingAmount, 0);
  const totalAmount = totalRecovered + totalRemaining;

  const overallRecoveryProgress = totalAmount > 0 ? totalRecovered / totalAmount : 1;

  const priceAdjustmentAlerts = participatingTrackers
    .filter(t => t.needsPriceAdjustment)
    .map(t => t.harnessId);

  return {
    trackers,
    fullyRecoveredCount,
    overallRecoveryProgress,
    totalRecovered,
    totalRemaining,
    priceAdjustmentAlerts,
  };
}

/**
 * 模拟多年回收进度
 * 按年模拟累计生产量和回收进度
 * 
 * @param allocations 分摊结果
 * @param annualCapacity 年产能 (台/年)
 * @param years 模拟年数
 * @returns 每年的回收快照
 */
export function simulateRecoveryTimeline(
  allocations: OnetimeCostAllocation[],
  annualCapacity: number,
  years: number,
): ProjectRecoverySummary[] {
  const timeline: ProjectRecoverySummary[] = [];

  for (let y = 1; y <= years; y++) {
    const cumProducedMap: Record<string, number> = {};
    for (const a of allocations) {
      // 累计产量 = 年产能 × 装车比 × 年数
      cumProducedMap[a.harnessId] = annualCapacity * a.vehicleRatio * y;
    }
    timeline.push(computeProjectRecovery(allocations, cumProducedMap, annualCapacity));
  }

  return timeline;
}
