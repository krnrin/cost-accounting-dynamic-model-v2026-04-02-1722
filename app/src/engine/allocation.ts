import type { AllocationDriver, AllocationConfig } from '@/types/project';
import type { HarnessResult } from '@/types/harness';
import { numberOr, resolveEffectiveRatio, safeArray } from './shared_utils';

/** 默认分摊配置 */
export const DEFAULT_ALLOCATION: AllocationConfig = {
  equipment: 'hours',
  rnd: 'revenue',
  indirectLabor: 'hours',
  management: 'direct',  // 特殊处理: 各线束独立计算，不做总额分配
};

/**
 * 计算各线束的分摊权重
 *
 * @param harnesses - 各线束核算结果
 * @param driver - 分摊驱动因子
 * @returns 权重数组 (index 对应 harnesses 的 index)，和为 1
 * @throws Error 当 driver='direct' 时，因为 direct 不支持归一化分摊
 */
export function computeAllocationWeights(
  harnesses: HarnessResult[],
  driver: AllocationDriver
): number[] {
  const items = safeArray(harnesses);
  const n = items.length;
  if (n === 0) return [];

  if (driver === 'equal') {
    return items.map(() => 1 / n);
  }

  if (driver === 'direct') {
    // 'direct' 驱动因子表示"不分摊，各线束独立计算"
    // 这意味着不能用于归一化权重计算，因为会导致总分摊 = 原总额 × N
    // 调用方应该特殊处理 'direct' 情况，而不是调用此函数
    throw new Error(
      "[allocation] 'direct' driver cannot be used for normalized allocation weights. " +
      "Caller should handle 'direct' case separately (e.g., use harness's own cost)."
    );
  }

  let values: number[];
  switch (driver) {
    case 'hours':
      values = items.map(h => numberOr(h.processHours, 0));
      break;
    case 'revenue':
      values = items.map(h => numberOr(h.deliveredPrice, 0));
      break;
    case 'material_cost':
      values = items.map(h => numberOr(h.materialCost, 0));
      break;
    case 'volume':
      values = items.map(h => resolveEffectiveRatio((h as any).installationRatio, h.vehicleRatio));
      break;
    default:
      return items.map(() => 1 / n);
  }

  const total = values.reduce((s, v) => s + v, 0);
  if (total === 0) return items.map(() => 1 / n);
  return values.map(v => v / total);
}

/** 间接费用分配结果 (每线束) */
export interface AllocationResult {
  harnessId: string;
  /** 设备分摊额 */
  equipmentAllocation: number;
  /** 研发分摊额 */
  rndAllocation: number;
  /** 间接人工分摊额 */
  indirectLaborAllocation: number;
  /** 管理费分摊额 (如果按驱动因子分配) */
  managementAllocation: number;
  /** 总分摊额 */
  totalAllocation: number;
  /** 分摊后单件总成本 */
  totalCostWithAllocation: number;
}

/**
 * allocateIndirectCosts — 按配置分摊间接费用到各线束
 *
 * @param harnesses - 各线束核算结果
 * @param config - 分摊配置
 * @param totals - 项目级间接费用总额
 */
export function allocateIndirectCosts(
  harnesses: HarnessResult[],
  config: AllocationConfig,
  totals: {
    equipmentTotal?: number;
    rndTotal?: number;
    indirectLaborTotal?: number;
    managementTotal?: number;
  }
): AllocationResult[] {
  const items = safeArray(harnesses);
  
  const eqWeights = computeAllocationWeights(items, config.equipment);
  const rndWeights = computeAllocationWeights(items, config.rnd);
  const ilWeights = computeAllocationWeights(items, config.indirectLabor);
  const mgmtWeights = computeAllocationWeights(items, config.management);

  const eqTotal = numberOr(totals.equipmentTotal, 0);
  const rndTotal = numberOr(totals.rndTotal, 0);
  const ilTotal = numberOr(totals.indirectLaborTotal, 0);
  const mgmtTotal = numberOr(totals.managementTotal, 0);

  return items.map((h, i) => {
    const eqAlloc = eqTotal * (eqWeights[i] ?? 0);
    const rndAlloc = rndTotal * (rndWeights[i] ?? 0);
    const ilAlloc = ilTotal * (ilWeights[i] ?? 0);
    // For 'direct' driver, management uses the harness's own mgmtFee
    const mgmtAlloc = config.management === 'direct' 
      ? numberOr(h.mgmtFee, 0) 
      : mgmtTotal * (mgmtWeights[i] ?? 0);
    const totalAlloc = eqAlloc + rndAlloc + ilAlloc + (config.management === 'direct' ? 0 : mgmtAlloc);

    return {
      harnessId: h.harnessId,
      equipmentAllocation: eqAlloc,
      rndAllocation: rndAlloc,
      indirectLaborAllocation: ilAlloc,
      managementAllocation: mgmtAlloc,
      totalAllocation: totalAlloc,
      totalCostWithAllocation: numberOr(h.deliveredPrice, 0) + totalAlloc,
    };
  });
}
