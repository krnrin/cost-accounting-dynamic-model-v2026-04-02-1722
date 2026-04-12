import { numberOr, safeArray } from './shared_utils';
import type { HarnessResult } from '@/types/harness';
import type { 
  MetalContract, 
  MetalDelta, 
  MetalEscalationResult, 
  MetalSensitivityMatrix
} from '@/types/quote';
import type { MetalPrices } from '@/types/project';

/**
 * 默认联动合同条款
 */
export const DEFAULT_CONTRACT: MetalContract = {
  baseCopperPrice: 68400,    // 基准铜价 (元/吨)
  baseAluminumPrice: 18200,  // 基准铝价 (元/吨)
  thresholdPercent: 0,       // 联动阈值 (0 = 无阈值, 0.05 = ±5%)
  escalationRatio: 1.0,      // 联动比例 (1.0 = 100%)
  period: 'quarterly',       // 联动周期: quarterly/semiannual/annual
};

/**
 * 应用联动阈值和比例
 * @returns {number} 生效的价格变化 (元/吨)
 */
export function checkThreshold(basePrice: number, newPrice: number, thresholdPercent: number, ratio: number): number {
  const threshold = numberOr(thresholdPercent, 0);
  const escalationRatio = numberOr(ratio, 1.0);
  const delta = newPrice - basePrice;

  if (threshold <= 0) {
    // 无阈值，全部联动
    return delta * escalationRatio;
  }

  const thresholdAmount = basePrice * threshold;
  if (Math.abs(delta) <= thresholdAmount) {
    return 0; // 在阈值范围内，不联动
  }

  // 超出阈值部分联动
  const sign = delta > 0 ? 1 : -1;
  const excess = Math.abs(delta) - thresholdAmount;
  return sign * excess * escalationRatio;
}

/**
 * computeMetalDelta — 计算单个零件号的金属联动影响
 *
 * @param harness - 线束核算结果
 * @param baseMetal - 基准金属价格
 * @param newMetal  - 新金属价格
 * @param contract  - 联动合同条款
 * @returns 联动影响明细
 */
export function computeMetalDelta(
  harness: HarnessResult, 
  baseMetal: Partial<MetalPrices>, 
  newMetal: Partial<MetalPrices>, 
  contract?: MetalContract
): MetalDelta {
  const ct = contract || DEFAULT_CONTRACT;
  const cuWeight = numberOr(harness.copperWeight, 0);   // kg
  const alWeight = numberOr(harness.aluminumWeight, 0);  // kg

  const baseCuPrice = numberOr(baseMetal.copper, ct.baseCopperPrice);
  const baseAlPrice = numberOr(baseMetal.aluminum, ct.baseAluminumPrice);
  const newCuPrice = numberOr(newMetal.copper, baseCuPrice);
  const newAlPrice = numberOr(newMetal.aluminum, baseAlPrice);

  // 应用联动阈值和比例
  const effectiveCuDelta = checkThreshold(baseCuPrice, newCuPrice, ct.thresholdPercent, ct.escalationRatio);
  const effectiveAlDelta = checkThreshold(baseAlPrice, newAlPrice, ct.thresholdPercent, ct.escalationRatio);

  // 金属成本变化 (kg × 元/吨 ÷ 1000 = 元)
  const deltaCuCost = cuWeight * effectiveCuDelta / 1000;
  const deltaAlCost = alWeight * effectiveAlDelta / 1000;
  const deltaMaterialCost = deltaCuCost + deltaAlCost;

  // 联动: 废品率
  const wasteRate = (harness._params && harness._params.wasteRate) || 0.01;
  const deltaWaste = deltaMaterialCost * wasteRate;

  // 联动: 管理费率 — 管理费基数不含废品!
  const mgmtRate = (harness._params && harness._params.mgmtRate) || 0.06;
  const deltaMgmt = deltaMaterialCost * mgmtRate;  // 只有材料变化影响管理费 (工时未变)

  // 联动: 利润率 — 利润基数含废品
  const profitRate = (harness._params && harness._params.profitRate) || 0.056627;
  const deltaProfit = (deltaMaterialCost + deltaWaste + deltaMgmt) * profitRate;

  // 总到厂价变化 (包装/运输不受金属联动影响)
  const deltaDeliveredPrice = deltaMaterialCost + deltaWaste + deltaMgmt + deltaProfit;

  return {
    harnessId: harness.harnessId,
    harnessName: harness.harnessName,
    vehicleRatio: numberOr(harness.vehicleRatio, 0),
    copperWeight: cuWeight,
    aluminumWeight: alWeight,

    // 价格变化
    copperPriceDelta: effectiveCuDelta,
    aluminumPriceDelta: effectiveAlDelta,

    // 成本变化
    deltaCopperCost: deltaCuCost,
    deltaAluminumCost: deltaAlCost,
    deltaMaterialCost: deltaMaterialCost,
    deltaWasteCost: deltaWaste,
    deltaMgmtFee: deltaMgmt,
    deltaProfit: deltaProfit,
    deltaDeliveredPrice: deltaDeliveredPrice,

    // 原始到厂价
    baseDeliveredPrice: numberOr(harness.deliveredPrice, 0),
    newDeliveredPrice: numberOr(harness.deliveredPrice, 0) + deltaDeliveredPrice,

    // 加权影响
    weightedDelta: deltaDeliveredPrice * numberOr(harness.vehicleRatio, 0),
  };
}

/**
 * computeMetalEscalation — 项目级金属联动计算
 *
 * @param harnessResults - 所有线束的核算结果
 * @param baseMetal - 基准金属价格
 * @param newMetal  - 新金属价格
 * @param contract  - 联动合同条款
 * @param options   - {annualVolumes}
 * @returns 项目级联动结果
 */
export function computeMetalEscalation(
  harnessResults: HarnessResult[], 
  baseMetal: MetalPrices, 
  newMetal: MetalPrices, 
  contract?: MetalContract, 
  options?: { annualVolumes?: number[] }
): MetalEscalationResult {
  const harnesses = safeArray(harnessResults);
  const opts = options || {};
  const deltas: MetalDelta[] = [];
  let totalWeightedDelta = 0;

  for (let i = 0; i < harnesses.length; i++) {
    const d = computeMetalDelta(harnesses[i], baseMetal, newMetal, contract);
    deltas.push(d);
    totalWeightedDelta += d.weightedDelta;
  }

  // 年度影响
  let annualImpact: MetalEscalationResult['annualImpact'] = null;
  if (opts.annualVolumes) {
    const volumes = safeArray(opts.annualVolumes);
    const years: any[] = [];
    let cumulative = 0;
    for (let j = 0; j < volumes.length; j++) {
      const vol = numberOr(volumes[j], 0);
      const impact = totalWeightedDelta * vol;
      cumulative += impact;
      years.push({
        year: j + 1,
        volume: vol,
        annualImpact: impact,
        cumulativeImpact: cumulative,
      });
    }
    annualImpact = {
      years: years,
      totalLifecycleImpact: cumulative,
    };
  }

  return {
    metalPrices: {
      before: baseMetal,
      after: newMetal,
      delta: {
        copper: numberOr(newMetal.copper, 0) - numberOr(baseMetal.copper, 0),
        aluminum: numberOr(newMetal.aluminum, 0) - numberOr(baseMetal.aluminum, 0),
      },
    },
    harnesses: deltas,
    summary: {
      totalWeightedDelta: totalWeightedDelta,
      affectedCount: deltas.filter((d) => Math.abs(d.deltaDeliveredPrice) > 0.001).length,
      totalCopperWeight: deltas.reduce((s, d) => s + d.copperWeight, 0),
      totalAluminumWeight: deltas.reduce((s, d) => s + d.aluminumWeight, 0),
    },
    annualImpact: annualImpact,
  };
}

/**
 * computeSensitivityMatrix — 金属价格敏感度矩阵
 * 展示不同铜价/铝价组合下的单车成本
 *
 * @param harnessResults - 线束核算结果
 * @param baseMetal - 基准金属价格
 * @param copperPriceRange - 铜价范围
 * @param aluminumPriceRange - 铝价范围 (可选)
 * @returns 敏感度矩阵
 */
export function computeSensitivityMatrix(
  harnessResults: HarnessResult[], 
  baseMetal: MetalPrices, 
  copperPriceRange: number[], 
  aluminumPriceRange: number[]
): MetalSensitivityMatrix {
  const cuRange = safeArray(copperPriceRange);
  let alRange = safeArray(aluminumPriceRange);
  if (alRange.length === 0) alRange = [numberOr(baseMetal.aluminum, 18200)];

  const matrix: MetalSensitivityMatrix['matrix'] = [];

  for (let i = 0; i < cuRange.length; i++) {
    const row: any[] = [];
    for (let j = 0; j < alRange.length; j++) {
      const escalation = computeMetalEscalation(
        harnessResults, baseMetal,
        { copper: cuRange[i], aluminum: alRange[j] },
        undefined, undefined
      );
      row.push({
        copper: cuRange[i],
        aluminum: alRange[j],
        deltaPerVehicle: escalation.summary.totalWeightedDelta,
      });
    }
    matrix.push(row);
  }

  return {
    baseMetal: baseMetal,
    copperRange: cuRange,
    aluminumRange: alRange,
    matrix: matrix,
  };
}
