import { resolveEffectiveRatio } from './shared_utils';

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

/** 单个费用项在单条线束上的分摊配置 */
export interface OnetimeAllocationParticipant {
  harnessId: string;
  harnessName: string;
  vehicleRatio: number;
  installationRatio?: number;
  quantity: number;
  latestCumulativeVolume?: number;
}

/** 单个一次性费用项（矩阵的一行） */
export interface OnetimeCostItem {
  feeId: string;
  feeName: string;
  feeCategory: 'tooling' | 'testing' | 'rnd';
  unitPrice: number;
  allocBase: number;
  paymentMode?: PaymentMode;
  recoveryCompletionBehavior?: 'trigger_price_adjust' | 'notify_only' | 'archive' | string;
  priceAdjustReminder?: boolean;
  targetRecoveryDate?: string | null;
  completedAt?: string | null;
  status?: string;
  participants: OnetimeAllocationParticipant[];
}

/** 单条线束的一次性费用输入（兼容旧模型：每线束一条） */
export interface OnetimeCostInput {
  /** 零件号 */
  harnessId: string;
  /** 线束名称 */
  harnessName: string;
  /** 装车比 (0~1) */
  vehicleRatio: number;
  installationRatio?: number;
  /** 工装费用 (元) — 新制 */
  toolingCost: number;
  /** 试验费用 (元) — 新制 */
  testingCost: number;
  /** 研发费用 (元) */
  rndCost?: number;
  /** 分摊基数 (根)，默认 50,000 */
  allocBase: number;
  /** 支付模式：amortized=分摊, lumpsum=一次性付清, mixed=混合 */
  paymentMode?: PaymentMode;
  /** 可选：矩阵来源费用项明细 */
  feeItems?: OnetimeCostItem[];
}

/** 单条线束的分摊计算结果 */
export interface OnetimeCostAllocation {
  /** 零件号 */
  harnessId: string;
  /** 线束名称 */
  harnessName: string;
  /** 装车比 */
  vehicleRatio: number;
  installationRatio: number;

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
  rndPerUnit?: number;
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
  installationRatio: number;
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
  /** 目标回收日期 */
  targetRecoveryDate?: string | null;
  /** 是否开启调价提醒 */
  priceAdjustReminder?: boolean;
  /** 费用项完成行为 */
  recoveryCompletionBehavior?: 'trigger_price_adjust' | 'notify_only' | 'archive' | string;
  /** 支付模式 */
  paymentMode: PaymentMode;
}

export interface MatrixRecoveryContext {
  targetRecoveryDate?: string | null;
  priceAdjustReminder?: boolean;
  recoveryCompletionBehavior?: 'trigger_price_adjust' | 'notify_only' | 'archive' | string;
}

function parseTargetRecoveryYears(targetRecoveryDate?: string | null): number | null {
  if (!targetRecoveryDate) return null;
  const target = new Date(targetRecoveryDate);
  if (Number.isNaN(target.getTime())) return null;
  const now = new Date();
  const diffMs = target.getTime() - now.getTime();
  if (diffMs <= 0) return 0;
  const yearMs = 365 * 24 * 60 * 60 * 1000;
  return Math.ceil(diffMs / yearMs);
}

function resolveTrackerStatus(
  fullyRecovered: boolean,
  estimatedRecoveryYear: number | null,
  lifecycleYears?: number,
  context?: MatrixRecoveryContext,
): RecoveryStatus {
  if (fullyRecovered) return 'recovered';

  const targetRecoveryYears = parseTargetRecoveryYears(context?.targetRecoveryDate);
  if (targetRecoveryYears !== null && estimatedRecoveryYear !== null && estimatedRecoveryYear > targetRecoveryYears) {
    return 'overdue';
  }

  if (lifecycleYears && estimatedRecoveryYear !== null && estimatedRecoveryYear > lifecycleYears) {
    return 'overdue';
  }

  return 'recovering';
}

function shouldTriggerPriceAdjustment(
  fullyRecovered: boolean,
  context?: MatrixRecoveryContext,
): boolean {
  if (!fullyRecovered) return false;
  if (context?.recoveryCompletionBehavior === 'notify_only' || context?.recoveryCompletionBehavior === 'archive') {
    return false;
  }
  return context?.priceAdjustReminder !== false;
}

function buildHarnessMatrixContext(items: OnetimeCostItem[]): Record<string, MatrixRecoveryContext> {
  const contexts = new Map<string, MatrixRecoveryContext>();

  for (const item of items) {
    for (const participant of item.participants) {
      if (participant.quantity <= 0) continue;
      const current = contexts.get(participant.harnessId) ?? {};
      contexts.set(participant.harnessId, {
        priceAdjustReminder: current.priceAdjustReminder || Boolean(item.priceAdjustReminder),
        targetRecoveryDate: current.targetRecoveryDate ?? item.targetRecoveryDate ?? null,
        recoveryCompletionBehavior: current.recoveryCompletionBehavior ?? item.recoveryCompletionBehavior,
      });
    }
  }

  return Object.fromEntries(contexts.entries());
}

function buildCumProducedMapFromItems(items: OnetimeCostItem[]): Record<string, number> {
  const produced = new Map<string, number>();

  for (const item of items) {
    for (const participant of item.participants) {
      const current = produced.get(participant.harnessId) ?? 0;
      produced.set(
        participant.harnessId,
        Math.max(current, Math.max(0, Number(participant.latestCumulativeVolume || 0))),
      );
    }
  }

  return Object.fromEntries(produced.entries());
}

export function computeProjectRecoveryFromItems(
  items: OnetimeCostItem[],
  annualCapacity: number,
  lifecycleYears?: number,
): ProjectRecoverySummary {
  const allocSummary = computeProjectAllocFromItems(items);
  const cumProducedMap = buildCumProducedMapFromItems(items);
  const matrixContext = buildHarnessMatrixContext(items);
  return computeProjectRecovery(
    allocSummary.allocations,
    cumProducedMap,
    annualCapacity,
    lifecycleYears,
    matrixContext,
  );
}

export function simulateRecoveryTimelineFromItems(
  items: OnetimeCostItem[],
  annualCapacity: number,
  years: number,
  lifecycleYears?: number,
): ProjectRecoverySummary[] {
  const allocSummary = computeProjectAllocFromItems(items);
  const matrixContext = buildHarnessMatrixContext(items);
  const timeline: ProjectRecoverySummary[] = [];

  for (let y = 1; y <= years; y++) {
    const cumProducedMap: Record<string, number> = {};
    for (const alloc of allocSummary.allocations) {
      cumProducedMap[alloc.harnessId] = annualCapacity * alloc.installationRatio * y;
    }
    timeline.push(computeProjectRecovery(allocSummary.allocations, cumProducedMap, annualCapacity, lifecycleYears, matrixContext));
  }

  return timeline;
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
  totalRnd?: number;
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
  priceAdjustmentAlerts: AllocationRecoveryAlert[];
}

export interface AllocationRecoveryAlert {
  harnessId: string;
  harnessName: string;
  severity: 'info' | 'warning' | 'critical';
  message: string;
  recoveredAmount: number;
  remainingAmount: number;
  needsPriceAdjustment: boolean;
}

// ═══════════════════════════════════════════
// 核心计算函数
// ═══════════════════════════════════════════

export function computeHarnessAllocationFromItems(
  harnessId: string,
  harnessName: string,
  vehicleRatio: number,
  installationRatio: number | undefined,
  items: OnetimeCostItem[],
): OnetimeCostAllocation {
  const relevant = items.filter((item) =>
    item.participants.some((p) => p.harnessId === harnessId && p.quantity > 0),
  );

  let toolingCost = 0;
  let testingCost = 0;
  let rndCost = 0;
  let allocBase = 50000;
  let paymentMode: PaymentMode = 'amortized';

  for (const item of relevant) {
    const participant = item.participants.find((p) => p.harnessId === harnessId);
    if (!participant || participant.quantity <= 0) continue;
    const amount = item.unitPrice * participant.quantity;
    allocBase = item.allocBase || allocBase;
    paymentMode = item.paymentMode ?? paymentMode;
    if (item.feeCategory === 'tooling') toolingCost += amount;
    else if (item.feeCategory === 'testing') testingCost += amount;
    else if (item.feeCategory === 'rnd') rndCost += amount;
    else {
      // 未知类别处理：记录日志并跳过
      console.warn(`[onetime_alloc] Unknown feeCategory "${item.feeCategory}" for item ${item.feeId} (${item.feeName}). Expected one of: tooling, testing, rnd. Item skipped.`);
    }
  }

  return computeOnetimeAlloc({
    harnessId,
    harnessName,
    vehicleRatio,
    installationRatio,
    toolingCost,
    testingCost,
    rndCost,
    allocBase,
    paymentMode,
    feeItems: relevant,
  });
}

export function computeProjectAllocFromItems(items: OnetimeCostItem[]): ProjectAllocSummary {
  const harnessMap = new Map<string, { harnessName: string; vehicleRatio: number; installationRatio?: number }>();
  for (const item of items) {
    for (const p of item.participants) {
      if (p.quantity > 0 && !harnessMap.has(p.harnessId)) {
        harnessMap.set(p.harnessId, {
          harnessName: p.harnessName,
          vehicleRatio: p.vehicleRatio,
          installationRatio: resolveEffectiveRatio(p.installationRatio, p.vehicleRatio),
        });
      }
    }
  }

  const allocations = Array.from(harnessMap.entries()).map(([harnessId, meta]) =>
    computeHarnessAllocationFromItems(
      harnessId,
      meta.harnessName,
      meta.vehicleRatio,
      meta.installationRatio,
      items,
    ),
  );

  const participating = allocations.filter(a => a.participates);
  const totalTooling = allocations.reduce((sum, a) => sum + a.toolingCost, 0);
  const totalTesting = allocations.reduce((sum, a) => sum + a.testingCost, 0);
  const totalRnd = allocations.reduce((sum, a) => sum + (a.rndCost ?? 0), 0);
  const weightedAllocPerVehicle = allocations.reduce(
    (sum, a) => sum + a.totalPerUnit * a.installationRatio,
    0,
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

/** 兼容旧模型输入与矩阵输入 */
export function normalizeOnetimeInputs(inputs: OnetimeCostInput[]): ProjectAllocSummary {
  const itemBased = inputs.flatMap((input) => input.feeItems || []);
  if (itemBased.length > 0) {
    return computeProjectAllocFromItems(itemBased);
  }
  return computeProjectAlloc(inputs);
}

/**
 * 计算单条线束的一次性费用分摊
 *
 * @param input 一次性费用输入
 * @returns 分摊计算结果
 */
export function computeOnetimeAlloc(input: OnetimeCostInput): OnetimeCostAllocation {
  const rndCost = input.rndCost ?? 0;
  const totalOnetimeCost = input.toolingCost + input.testingCost + rndCost;
  const paymentMode = input.paymentMode ?? 'amortized';
  // lumpsum: 一次性付清，不参与分摊
  const participates = totalOnetimeCost > 0 && paymentMode !== 'lumpsum';
  const allocBase = input.allocBase || 50000;
  const installationRatio = resolveEffectiveRatio(input.installationRatio, input.vehicleRatio);

  const toolingPerUnit = allocBase > 0 ? input.toolingCost / allocBase : 0;
  const testingPerUnit = allocBase > 0 ? input.testingCost / allocBase : 0;
  const rndPerUnit = allocBase > 0 ? rndCost / allocBase : 0;
  const totalPerUnit = toolingPerUnit + testingPerUnit + rndPerUnit;

  return {
    harnessId: input.harnessId,
    harnessName: input.harnessName,
    vehicleRatio: input.vehicleRatio,
    installationRatio,
    toolingCost: input.toolingCost,
    testingCost: input.testingCost,
    rndCost,
    totalOnetimeCost,
    allocBase,
    participates,
    toolingPerUnit,
    testingPerUnit,
    rndPerUnit,
    totalPerUnit,
    // lumpsum项不进入到厂价，只有参与分摊的费用才计入
    priceAddon: participates ? totalPerUnit : 0,
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
  matrixContext?: MatrixRecoveryContext,
): AllocRecoveryTracker {
  const paymentMode: PaymentMode = alloc.paymentMode ?? 'amortized';

  if (!alloc.participates) {
    return {
      harnessId: alloc.harnessId,
      harnessName: alloc.harnessName,
      vehicleRatio: alloc.vehicleRatio,
      installationRatio: alloc.installationRatio,
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
      targetRecoveryDate: matrixContext?.targetRecoveryDate ?? null,
      priceAdjustReminder: matrixContext?.priceAdjustReminder ?? false,
      recoveryCompletionBehavior: matrixContext?.recoveryCompletionBehavior,
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
  const annualProduction = annualCapacity * alloc.installationRatio;
  let estimatedRecoveryYear: number | null = null;
  if (annualProduction > 0 && !fullyRecovered) {
    const remainingUnits = alloc.allocBase - cumProduced;
    estimatedRecoveryYear = Math.ceil(remainingUnits / annualProduction);
  } else if (fullyRecovered) {
    estimatedRecoveryYear = null; // 已回收完毕
  }

  // 判断回收状态
  const status = resolveTrackerStatus(fullyRecovered, estimatedRecoveryYear, lifecycleYears, matrixContext);
  let recoveredDate: string | undefined;
  if (fullyRecovered) {
    recoveredDate = matrixContext?.targetRecoveryDate ?? undefined;
  }

  return {
    harnessId: alloc.harnessId,
    harnessName: alloc.harnessName,
    vehicleRatio: alloc.vehicleRatio,
    installationRatio: alloc.installationRatio,
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
    needsPriceAdjustment: shouldTriggerPriceAdjustment(fullyRecovered, matrixContext),
    targetRecoveryDate: matrixContext?.targetRecoveryDate ?? null,
    priceAdjustReminder: matrixContext?.priceAdjustReminder ?? false,
    recoveryCompletionBehavior: matrixContext?.recoveryCompletionBehavior,
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
  const totalRnd = allocations.reduce((sum, a) => sum + (a.rndCost ?? 0), 0);

  // 加权分摊 = Σ(单根分摊 × 装车比)
  const weightedAllocPerVehicle = allocations.reduce(
    (sum, a) => sum + a.totalPerUnit * a.installationRatio,
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
  matrixContextMap?: Record<string, MatrixRecoveryContext>,
): ProjectRecoverySummary {
  const trackers = allocations.map(a =>
    computeAllocRecovery(
      a,
      cumProducedMap[a.harnessId] || 0,
      annualCapacity,
      lifecycleYears,
      matrixContextMap?.[a.harnessId],
    )
  );

  const participatingTrackers = trackers.filter(t => t.totalOnetimeCost > 0);
  const fullyRecoveredCount = participatingTrackers.filter(t => t.fullyRecovered).length;
  const totalRecovered = participatingTrackers.reduce((s, t) => s + t.recoveredAmount, 0);
  const totalRemaining = participatingTrackers.reduce((s, t) => s + t.remainingAmount, 0);
  const totalAmount = totalRecovered + totalRemaining;

  const overallRecoveryProgress = totalAmount > 0 ? totalRecovered / totalAmount : 1;

  const priceAdjustmentAlerts = participatingTrackers
    .filter((tracker) => tracker.needsPriceAdjustment)
    .map<AllocationRecoveryAlert>((tracker) => ({
      harnessId: tracker.harnessId,
      harnessName: tracker.harnessName,
      severity: tracker.status === 'overdue' ? 'critical' : 'warning',
      message: tracker.remainingAmount > 0
        ? `${tracker.harnessName || tracker.harnessId} completed recovery with outstanding adjustments`
        : `${tracker.harnessName || tracker.harnessId} completed recovery and should be repriced`,
      recoveredAmount: tracker.recoveredAmount,
      remainingAmount: tracker.remainingAmount,
      needsPriceAdjustment: tracker.needsPriceAdjustment,
    }));

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
      cumProducedMap[a.harnessId] = annualCapacity * a.installationRatio * y;
    }
    timeline.push(computeProjectRecovery(allocations, cumProducedMap, annualCapacity));
  }

  return timeline;
}
