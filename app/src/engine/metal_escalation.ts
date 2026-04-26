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
 * [PR-095] 联动模式配置
 * - 'alert_only': 仅报警，超过阈值时触发告警但不联动调价（当前默认行为，已确认）
 * - 'excess_only': 仅超出阈值部分联动（已废弃）
 * - 'full': 超出阈值后全额联动（已废弃）
 */
export type ThresholdMode = 'alert_only' | 'excess_only' | 'full';

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
 * [PR-095] 全局阈值模式配置（可由业务层设置）
 * 业务确认：金属价格超过阈值时仅触发报警，不自动联动调价
 */
let globalThresholdMode: ThresholdMode = 'alert_only';

export function setThresholdMode(mode: ThresholdMode): void {
  globalThresholdMode = mode;
}

export function getThresholdMode(): ThresholdMode {
  return globalThresholdMode;
}

/**
 * 检查金属价格是否超出阈值
 *
 * [PR-095] 业务确认：仅报警，不联动调价
 * - thresholdPercent = 0: 无阈值，不报警
 * - thresholdPercent > 0: 超出阈值时返回报警信息，但联动金额始终为0
 *
 * @returns {exceeded: boolean, thresholdAmount: number, delta: number}
 */
export function checkThreshold(
  basePrice: number,
  newPrice: number,
  thresholdPercent: number,
  ratio: number
): { exceeded: boolean; thresholdAmount: number; delta: number; effectiveDelta: number } {
  const threshold = numberOr(thresholdPercent, 0);
  const delta = newPrice - basePrice;

  if (threshold <= 0) {
    // 无阈值配置，不报警
    return { exceeded: false, thresholdAmount: 0, delta, effectiveDelta: 0 };
  }

  const thresholdAmount = basePrice * threshold;
  const exceeded = Math.abs(delta) > thresholdAmount;

  // [PR-095] 业务确认：仅报警，联动金额始终为0
  // 如需启用联动，修改 globalThresholdMode 为 'excess_only' 或 'full'
  let effectiveDelta = 0;

  if (globalThresholdMode === 'excess_only' && exceeded) {
    // 废弃：仅超出部分联动
    const sign = delta > 0 ? 1 : -1;
    const excess = Math.abs(delta) - thresholdAmount;
    effectiveDelta = sign * excess * ratio;
  } else if (globalThresholdMode === 'full' && exceeded) {
    // 废弃：全额联动
    effectiveDelta = delta * ratio;
  }
  // alert_only 模式下 effectiveDelta 始终为 0

  return { exceeded, thresholdAmount, delta, effectiveDelta };
}

/**
 * computeMetalDelta — 计算单个零件号的金属联动影响
 *
 * @param harness - 线束核算结果
 * @param baseMetal - 基准金属价格
 * @param newMetal  - 新金属价格
 * @param contract  - 联动合同条款
 * @param rates - [PR-096] 公开的费率参数（替代私有 _params）
 * @returns 联动影响明细
 */
export function computeMetalDelta(
  harness: HarnessResult,
  baseMetal: Partial<MetalPrices>,
  newMetal: Partial<MetalPrices>,
  contract?: MetalContract,
  rates?: { wasteRate?: number; mgmtRate?: number; profitRate?: number }
): MetalDelta {
  const ct = contract || DEFAULT_CONTRACT;
  const cuWeight = numberOr(harness.copperWeight, 0);   // kg
  const alWeight = numberOr(harness.aluminumWeight, 0);  // kg

  const baseCuPrice = numberOr(baseMetal.copper, ct.baseCopperPrice);
  const baseAlPrice = numberOr(baseMetal.aluminum, ct.baseAluminumPrice);
  const newCuPrice = numberOr(newMetal.copper, baseCuPrice);
  const newAlPrice = numberOr(newMetal.aluminum, baseAlPrice);

  // 检查阈值并获取报警信息
  const cuThresholdCheck = checkThreshold(baseCuPrice, newCuPrice, ct.thresholdPercent, ct.escalationRatio);
  const alThresholdCheck = checkThreshold(baseAlPrice, newAlPrice, ct.thresholdPercent, ct.escalationRatio);

  // [PR-095] 业务确认：仅报警，联动金额始终为0（alert_only模式）
  const effectiveCuDelta = cuThresholdCheck.effectiveDelta;
  const effectiveAlDelta = alThresholdCheck.effectiveDelta;

  // 金属成本变化 (kg × 元/吨 ÷ 1000 = 元)
  const deltaCuCost = cuWeight * effectiveCuDelta / 1000;
  const deltaAlCost = alWeight * effectiveAlDelta / 1000;
  const deltaMaterialCost = deltaCuCost + deltaAlCost;

  // [PR-096] 费率参数优先从公开参数读取，其次从 _params 兜底
  const wasteRate = rates?.wasteRate ?? (harness._params?.wasteRate ?? 0.01);
  const mgmtRate = rates?.mgmtRate ?? (harness._params?.mgmtRate ?? 0.06);
  const profitRate = rates?.profitRate ?? (harness._params?.profitRate ?? 0.056627);

  // 联动: 废品率
  const deltaWaste = deltaMaterialCost * wasteRate;

  // 联动: 管理费率
  // 金属联动场景下，仅材料差额参与管理费计算 — 金属价格变动不影响工时，
  // 因此管理费增量 = deltaMaterialCost × mgmtRate（与 harness_costing.ts 基数定义一致：
  // 管理费基数 = 材料 + 人工 + 制造，不含废品；此处人工和制造增量为 0）
  const deltaMgmt = deltaMaterialCost * mgmtRate;

  // 联动: 利润率 — 利润基数含废品
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

    // [PR-095] 阈值报警信息
    thresholdAlert: {
      copperExceeded: cuThresholdCheck.exceeded,
      aluminumExceeded: alThresholdCheck.exceeded,
      copperThresholdAmount: cuThresholdCheck.thresholdAmount,
      aluminumThresholdAmount: alThresholdCheck.thresholdAmount,
      copperDelta: cuThresholdCheck.delta,
      aluminumDelta: alThresholdCheck.delta,
    },
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

  // [PR-095] 计算阈值报警汇总
  const copperExceededCount = deltas.filter((d) => d.thresholdAlert?.copperExceeded).length;
  const aluminumExceededCount = deltas.filter((d) => d.thresholdAlert?.aluminumExceeded).length;
  const hasAnyExceeded = copperExceededCount > 0 || aluminumExceededCount > 0;

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
    thresholdAlertSummary: {
      copperExceededCount,
      aluminumExceededCount,
      hasAnyExceeded,
    },
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
