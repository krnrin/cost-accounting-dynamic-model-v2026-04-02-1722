/**
 * B7: 废料回收 → 到厂价联动调整
 * 
 * 废料回收金额变动 → 自动调整材料净成本 → 逐级联动到出厂价/到厂价
 * 确保价格体系的一致性和自洽
 */
import type { WireItem, HarnessResult } from '@/types/harness';
import type { CostRates } from '@/types/project';

export interface RecycleConfig {
  /** 铜废料回收比例 (0~1) */
  copperRecycleRatio: number;
  /** 铝废料回收比例 (0~1) */
  aluminumRecycleRatio: number;
  /** 铜废料单价 (元/吨) — 通常低于铜价 */
  copperRecyclePrice: number;
  /** 铝废料单价 (元/吨) */
  aluminumRecyclePrice: number;
  /** 其他废料回收金额 (元/套) */
  otherRecycleAmount?: number;
}

export interface RecycleResult {
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
  /** 调整前出厂价 */
  exFactoryPriceBefore: number;
  /** 调整后出厂价 */
  exFactoryPriceAfter: number;
  /** 调整前到厂价 */
  deliveredPriceBefore: number;
  /** 调整后到厂价 */
  deliveredPriceAfter: number;
  /** 价格变动金额 */
  priceImpact: number;
  /** 价格变动率 */
  priceImpactRate: number;
}

/**
 * 计算废料回收对价格的联动影响
 */
export function computeRecycleImpact(
  harnessResult: HarnessResult,
  wires: WireItem[],
  recycleConfig: RecycleConfig,
  costRates: CostRates
): RecycleResult {
  // 1. 计算废料产生量 (废品率 × 用量)
  const wasteRate = costRates.wasteRate;

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
  const copperRecycleAmount = copperWasteKg * recycleConfig.copperRecyclePrice / 1000; // 价格是元/吨
  const aluminumRecycleAmount = aluminumWasteKg * recycleConfig.aluminumRecyclePrice / 1000;
  const otherRecycleAmount = recycleConfig.otherRecycleAmount || 0;
  const totalRecycleAmount = copperRecycleAmount + aluminumRecycleAmount + otherRecycleAmount;

  // 3. 计算调整后的材料净成本
  const materialCostBefore = harnessResult.materialCost;
  const materialCostAfter = materialCostBefore - totalRecycleAmount;

  // 4. 逐级联动计算出厂价
  const wasteCostAfter = materialCostAfter * wasteRate;
  const directLabor = harnessResult.directLabor;
  const manufacturing = harnessResult.manufacturing;
  const laborPlusMfg = directLabor + manufacturing;
  const mgmtFee = (materialCostAfter + wasteCostAfter + laborPlusMfg) * costRates.mgmtRate;
  const subtotal = materialCostAfter + wasteCostAfter + laborPlusMfg + mgmtFee;
  const profit = subtotal * costRates.profitRate;
  const exFactoryPriceAfter = subtotal + profit;

  // 5. 到厂价 = 出厂价 + 包装运输
  const packTotal = harnessResult.packTotal || 0;
  const deliveredPriceAfter = exFactoryPriceAfter + packTotal;

  const exFactoryPriceBefore = harnessResult.exFactoryPrice;
  const deliveredPriceBefore = harnessResult.deliveredPrice;
  const priceImpact = deliveredPriceAfter - deliveredPriceBefore;
  const priceImpactRate = deliveredPriceBefore > 0 ? priceImpact / deliveredPriceBefore : 0;

  return {
    copperRecycleAmount,
    aluminumRecycleAmount,
    otherRecycleAmount,
    totalRecycleAmount,
    materialCostBefore,
    materialCostAfter,
    exFactoryPriceBefore,
    exFactoryPriceAfter,
    deliveredPriceBefore,
    deliveredPriceAfter,
    priceImpact,
    priceImpactRate,
  };
}

/**
 * 批量计算所有线束的回收联动
 */
export function computeBatchRecycleImpact(
  results: Array<{ harnessResult: HarnessResult; wires: WireItem[] }>,
  recycleConfig: RecycleConfig,
  costRates: CostRates
): { details: RecycleResult[]; totalImpact: number; avgImpactRate: number } {
  const details = results.map(({ harnessResult, wires }) =>
    computeRecycleImpact(harnessResult, wires, recycleConfig, costRates)
  );

  const totalImpact = details.reduce((sum, d) => sum + d.priceImpact, 0);
  const avgImpactRate = details.length > 0
    ? details.reduce((sum, d) => sum + d.priceImpactRate, 0) / details.length
    : 0;

  return { details, totalImpact, avgImpactRate };
}
