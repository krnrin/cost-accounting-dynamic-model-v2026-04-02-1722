/**
 * B7-B: 废料回收 → 内部成本联动调整 (Model B)
 *
 * 废料回收金额变动 → 自动调整材料净成本 → 内部核算成本
 * 用于内部成本核算，不含利润和管理费分摊
 */
import type { WireItem, InternalHarnessResult } from '@/types/harness';
// CostRates type imported for future extension; currently not used directly
// import type { CostRates } from '@/types/project';

export interface InternalRecycleConfig {
  /** 铜废料回收比例 (0~1) */
  copperRecycleRatio: number;
  /** 铝废料回收比例 (0~1) */
  aluminumRecycleRatio: number;
  /** 铜废料单价 (元/吨) */
  copperRecyclePrice: number;
  /** 铝废料单价 (元/吨) */
  aluminumRecyclePrice: number;
  /** 其他废料回收金额 (元/套) */
  otherRecycleAmount?: number;
}

export interface InternalRecycleResult {
  /** 单套铜废料回收金额 */
  copperRecycleAmount: number;
  /** 单套铝废料回收金额 */
  aluminumRecycleAmount: number;
  /** 其他废料回收金额 */
  otherRecycleAmount: number;
  /** 废料回收合计 (元/套) */
  totalRecycleAmount: number;
  /** 调整前材料成本 (元/套) */
  materialCostBefore: number;
  /** 调整后材料净成本 (元/套) */
  materialCostAfter: number;
  /** 调整前内部成本 */
  internalCostBefore: number;
  /** 调整后内部成本 */
  internalCostAfter: number;
  /** 成本变动金额 */
  costImpact: number;
  /** 成本变动率 */
  costImpactRate: number;
}

/**
 * 计算废料回收对内部成本的联动影响 (Model B)
 *
 * 内部成本 = 材料 + 材料损耗 + 直接人工 + 制造费 + 包装运输
 * 不含管理费和利润
 */
export function computeInternalRecycleImpact(
  internalResult: InternalHarnessResult,
  wires: WireItem[],
  recycleConfig: InternalRecycleConfig,
  wasteRate: number
): InternalRecycleResult {
  // 1. 计算废料产生量
  let totalCopperWeight = 0;
  let totalAluminumWeight = 0;
  for (const wire of wires) {
    totalCopperWeight += (wire.copperWeightPerUnit || 0) * (wire.qty || 0);
    totalAluminumWeight += (wire.aluminumWeightPerUnit || 0) * (wire.qty || 0);
  }

  // 废料重量 = 用量 × 废品率 × 回收比例
  const copperWasteKg = totalCopperWeight * wasteRate * recycleConfig.copperRecycleRatio;
  const aluminumWasteKg = totalAluminumWeight * wasteRate * recycleConfig.aluminumRecycleRatio;

  // 2. 计算回收金额
  const copperRecycleAmount = copperWasteKg * recycleConfig.copperRecyclePrice / 1000;
  const aluminumRecycleAmount = aluminumWasteKg * recycleConfig.aluminumRecyclePrice / 1000;
  const otherRecycleAmount = recycleConfig.otherRecycleAmount || 0;
  const totalRecycleAmount = copperRecycleAmount + aluminumRecycleAmount + otherRecycleAmount;

  // 3. 调整材料净成本
  const materialCostBefore = internalResult.materialCost;
  const materialCostAfter = materialCostBefore - totalRecycleAmount;

  // 4. 内部成本联动 (不含管理费和利润)
  const materialWasteAfter = materialCostAfter * wasteRate;
  const directLabor = internalResult.directLabor;
  const mfgOverheadTotal = internalResult.mfgOverheadTotal;
  const packTotal = internalResult.packTotal || 0;
  const internalCostAfter = materialCostAfter + materialWasteAfter + directLabor + mfgOverheadTotal + packTotal;

  const internalCostBefore = internalResult.internalCost;
  const costImpact = internalCostAfter - internalCostBefore;
  const costImpactRate = internalCostBefore > 0 ? costImpact / internalCostBefore : 0;

  return {
    copperRecycleAmount,
    aluminumRecycleAmount,
    otherRecycleAmount,
    totalRecycleAmount,
    materialCostBefore,
    materialCostAfter,
    internalCostBefore,
    internalCostAfter,
    costImpact,
    costImpactRate,
  };
}

/**
 * 批量计算所有线束的内部回收联动
 */
export function computeBatchInternalRecycleImpact(
  results: Array<{ internalResult: InternalHarnessResult; wires: WireItem[] }>,
  recycleConfig: InternalRecycleConfig,
  wasteRate: number
): { details: InternalRecycleResult[]; totalImpact: number; avgImpactRate: number } {
  const details = results.map(({ internalResult, wires }) =>
    computeInternalRecycleImpact(internalResult, wires, recycleConfig, wasteRate)
  );

  const totalImpact = details.reduce((sum, d) => sum + d.costImpact, 0);
  const avgImpactRate = details.length > 0
    ? details.reduce((sum, d) => sum + d.costImpactRate, 0) / details.length
    : 0;

  return { details, totalImpact, avgImpactRate };
}