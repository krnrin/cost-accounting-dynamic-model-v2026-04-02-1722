/**
 * 变更传播引擎 (Issue #60)
 *
 * 实现 ECN/金属联动/年降 → BOM → 报价的自动级联传播。
 * 核心流程:
 *   1. 变更事件识别 (参数变更 / BOM变更 / 金属价格变更)
 *   2. 影响范围计算 (哪些线束受影响)
 *   3. 成本重算 (调用 harness_costing / metal_escalation)
 *   4. 报价单更新 (级联更新报价单中的受影响行)
 */
import type { HarnessResult, HarnessInput } from '@/types/harness';
import type { MetalPrices, CostRates } from '@/types/project';
import { computeMetalDelta } from './metal_escalation';
import { numberOr } from './shared_utils';

/** 变更事件类型 */
export type ChangeEventType =
  | 'ecn'               // 设变通知
  | 'metal_price'       // 金属价格变动
  | 'annual_drop'       // 年降触发
  | 'rate_change'       // 费率变更 (人工/制造/废品/管理/利润)
  | 'bom_update'        // BOM数据更新
  | 'volume_change';    // 销量变更

/** 变更事件 */
export interface ChangeEvent {
  id: string;
  type: ChangeEventType;
  timestamp: string;
  scenarioId: string;
  projectId: string;
  /** 变更前值 */
  before: Record<string, unknown>;
  /** 变更后值 */
  after: Record<string, unknown>;
  /** 受影响的线束ID列表 (null = 全部) */
  affectedHarnessIds: string[] | null;
  /** 操作人 */
  userId?: string;
  /** 备注 */
  note?: string;
}

/** 传播影响结果 */
export interface PropagationResult {
  event: ChangeEvent;
  /** 受影响的线束数 */
  affectedCount: number;
  /** 各线束的成本影响 */
  impacts: PropagationImpact[];
  /** 总影响 (WVCP: 加权单车成本影响) */
  totalWeightedImpact: number;
  /** 是否需要人工确认 */
  requiresConfirmation: boolean;
  /** 确认原因 */
  confirmReason?: string;
}

/** 单线束影响 */
export interface PropagationImpact {
  harnessId: string;
  harnessName: string;
  vehicleRatio: number;
  /** 原到厂价 */
  baseDeliveredPrice: number;
  /** 新到厂价 */
  newDeliveredPrice: number;
  /** 到厂价变化 */
  deltaDeliveredPrice: number;
  /** 加权影响 */
  weightedDelta: number;
  /** 影响明细 */
  breakdown: {
    deltaMaterialCost: number;
    deltaProcessCost: number;
    deltaWasteCost: number;
    deltaMgmtFee: number;
    deltaProfit: number;
  };
}

/** 确认阈值：超过此值需人工确认 */
const CONFIRM_THRESHOLD_RATE = 0.05; // 5%
const CONFIRM_THRESHOLD_ABSOLUTE = 5; // ¥5

/**
 * 计算变更传播影响
 *
 * @param event - 变更事件
 * @param harnesses - 场景下所有线束的当前结果
 * @param currentRates - 当前费率
 * @returns 传播结果
 */
export function computePropagation(
  event: ChangeEvent,
  harnesses: Array<{ harnessId: string; harnessName: string; input: HarnessInput; result: HarnessResult }>,
  currentRates: CostRates
): PropagationResult {
  const affected = event.affectedHarnessIds
    ? harnesses.filter((h) => event.affectedHarnessIds!.includes(h.harnessId))
    : harnesses;

  const impacts: PropagationImpact[] = [];
  let totalWeightedImpact = 0;

  for (const harness of affected) {
    const impact = computeSingleImpact(event, harness, currentRates);
    impacts.push(impact);
    totalWeightedImpact += impact.weightedDelta;
  }

  // 判断是否需要人工确认
  const maxRate = impacts.reduce((max, i) => {
    const rate = i.baseDeliveredPrice !== 0
      ? Math.abs(i.deltaDeliveredPrice / i.baseDeliveredPrice)
      : 0;
    return Math.max(max, rate);
  }, 0);

  const requiresConfirmation =
    maxRate > CONFIRM_THRESHOLD_RATE ||
    Math.abs(totalWeightedImpact) > CONFIRM_THRESHOLD_ABSOLUTE;

  let confirmReason: string | undefined;
  if (requiresConfirmation) {
    const reasons: string[] = [];
    if (maxRate > CONFIRM_THRESHOLD_RATE) {
      reasons.push(`单线束最大变化率 ${(maxRate * 100).toFixed(1)}% 超过阈值`);
    }
    if (Math.abs(totalWeightedImpact) > CONFIRM_THRESHOLD_ABSOLUTE) {
      reasons.push(`加权总影响 ¥${totalWeightedImpact.toFixed(2)} 超过阈值`);
    }
    confirmReason = reasons.join('; ');
  }

  return {
    event,
    affectedCount: affected.length,
    impacts,
    totalWeightedImpact,
    requiresConfirmation,
    confirmReason,
  };
}

/**
 * 计算单线束的变更影响
 */
function computeSingleImpact(
  event: ChangeEvent,
  harness: { harnessId: string; harnessName: string; input: HarnessInput; result: HarnessResult },
  currentRates: CostRates
): PropagationImpact {
  const { result } = harness;
  const baseDelivered = numberOr(result.deliveredPrice, 0);
  const vehicleRatio = numberOr(result.vehicleRatio, 0);

  let deltaMaterial = 0;
  let deltaProcess = 0;
  let deltaWaste = 0;
  let deltaMgmt = 0;
  let deltaProfit = 0;

  switch (event.type) {
    case 'metal_price': {
      const baseMetal = event.before as Partial<MetalPrices>;
      const newMetal = event.after as Partial<MetalPrices>;
      const delta = computeMetalDelta(result, baseMetal, newMetal);
      deltaMaterial = delta.deltaMaterialCost;
      deltaWaste = delta.deltaWasteCost;
      deltaMgmt = delta.deltaMgmtFee;
      deltaProfit = delta.deltaProfit;
      break;
    }

    case 'rate_change': {
      const materialCost = numberOr(result.materialCost, 0);
      const processCost = numberOr((result as any).processCost, result.laborPlusMfg);
      const oldRates = event.before as Partial<CostRates>;
      const newRates = event.after as Partial<CostRates>;

      // 废品率变化
      const oldWaste = numberOr(oldRates.wasteRate, currentRates.wasteRate);
      const newWaste = numberOr(newRates.wasteRate, currentRates.wasteRate);
      deltaWaste = materialCost * (newWaste - oldWaste);

      // 管理费率变化
      const oldMgmt = numberOr(oldRates.mgmtRate, currentRates.mgmtRate);
      const newMgmt = numberOr(newRates.mgmtRate, currentRates.mgmtRate);
      deltaMgmt = (materialCost + processCost) * (newMgmt - oldMgmt);

      // 利润率变化
      const oldProfit = numberOr(oldRates.profitRate, currentRates.profitRate);
      const newProfit = numberOr(newRates.profitRate, currentRates.profitRate);
      const costBase = materialCost + processCost + (materialCost * newWaste) + ((materialCost + processCost) * newMgmt);
      deltaProfit = costBase * (newProfit - oldProfit);
      break;
    }

    case 'ecn':
    case 'bom_update': {
      // BOM变更时，由调用方提供新旧材料成本差异
      const oldMaterialCost = numberOr((event.before as any).materialCost, result.materialCost);
      const newMaterialCost = numberOr((event.after as any).materialCost, result.materialCost);
      deltaMaterial = newMaterialCost - oldMaterialCost;

      // 级联重算废品/管理/利润
      const wasteRate = numberOr(currentRates.wasteRate, 0.01);
      const mgmtRate = numberOr(currentRates.mgmtRate, 0.06);
      const profitRate = numberOr(currentRates.profitRate, 0.056627);
      deltaWaste = deltaMaterial * wasteRate;
      deltaMgmt = deltaMaterial * mgmtRate;
      deltaProfit = (deltaMaterial + deltaWaste + deltaMgmt) * profitRate;
      break;
    }

    case 'annual_drop':
    case 'volume_change':
    default:
      // 这些类型的影响需要完整重算，这里只做粗略估算
      break;
  }

  const deltaDelivered = deltaMaterial + deltaProcess + deltaWaste + deltaMgmt + deltaProfit;

  return {
    harnessId: harness.harnessId,
    harnessName: harness.harnessName,
    vehicleRatio,
    baseDeliveredPrice: baseDelivered,
    newDeliveredPrice: baseDelivered + deltaDelivered,
    deltaDeliveredPrice: deltaDelivered,
    weightedDelta: deltaDelivered * vehicleRatio,
    breakdown: {
      deltaMaterialCost: deltaMaterial,
      deltaProcessCost: deltaProcess,
      deltaWasteCost: deltaWaste,
      deltaMgmtFee: deltaMgmt,
      deltaProfit: deltaProfit,
    },
  };
}

/**
 * 创建变更事件工厂方法
 */
export function createChangeEvent(
  type: ChangeEventType,
  scenarioId: string,
  projectId: string,
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  options?: { affectedHarnessIds?: string[]; userId?: string; note?: string }
): ChangeEvent {
  return {
    id: `ce-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    type,
    timestamp: new Date().toISOString(),
    scenarioId,
    projectId,
    before,
    after,
    affectedHarnessIds: options?.affectedHarnessIds ?? null,
    userId: options?.userId,
    note: options?.note,
  };
}
