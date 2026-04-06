import { numberOr, safeArray } from './shared_utils';
import type { VolumeSchedule, EquipmentConfig } from '@/types/project';
import type { HarnessResult, AnnualCostBreakdown, AnnualizedCostResult } from '@/types/harness';

/**
 * computeAnnualizedCost — 按年度计算设备分摊和总成本
 * 
 * @param harness - 线束核算结果 (variableCost = deliveredPrice)
 * @param equipment - 设备投资配置
 * @param volumes - 年度产量计划
 * @param options - 可选: fixedMfgAnnual (固定制造费年额)
 * @returns 年度差异化计算结果
 */
export function computeAnnualizedCost(
  harness: HarnessResult,
  equipment: EquipmentConfig,
  volumes: VolumeSchedule[],
  options?: { fixedMfgAnnual?: number }
): AnnualizedCostResult {
  const variableCostPerUnit = harness.deliveredPrice;
  const annualBreakdown: AnnualCostBreakdown[] = [];
  const fixedMfgAnnual = numberOr(options?.fixedMfgAnnual, 0);

  const safeVolumes = safeArray(volumes);
  
  let totalLifecycleVolume = 0;
  let totalLifecycleCost = 0;

  for (const vol of safeVolumes) {
    const volume = numberOr(vol.volume, 0);
    if (volume <= 0) {
      // Avoid division by zero, though in practice volume should be > 0
      continue;
    }

    // 设备分摊 (仅在折旧年限内)
    const equipmentPerUnit = vol.year <= equipment.depreciationYears 
      ? equipment.annualDepreciation / volume 
      : 0;
    
    // 固定制造费分摊
    const fixedMfgPerUnit = fixedMfgAnnual / volume;
    
    const totalCostPerUnit = variableCostPerUnit + equipmentPerUnit + fixedMfgPerUnit;
    
    annualBreakdown.push({
      year: vol.year,
      volume: volume,
      equipmentPerUnit,
      fixedMfgPerUnit,
      totalCostPerUnit,
      deltaFromBase: 0, // Will compute after first pass
      deltaPercent: 0  // Will compute after first pass
    });

    totalLifecycleVolume += volume;
    totalLifecycleCost += totalCostPerUnit * volume;
  }

  const lifecycleWeightedAvg = totalLifecycleVolume > 0 
    ? totalLifecycleCost / totalLifecycleVolume 
    : totalCostPerUnit_safe(variableCostPerUnit, annualBreakdown);

  function totalCostPerUnit_safe(v: number, b: AnnualCostBreakdown[]) {
    return b.length > 0 ? b[0]!.totalCostPerUnit : v;
  }

  let maxDeviation = 0;
  
  // Base year is defined as the first entry in annualBreakdown
  const firstYearCost = annualBreakdown[0]?.totalCostPerUnit ?? 0;

  for (const item of annualBreakdown) {
    item.deltaFromBase = item.totalCostPerUnit - firstYearCost;
    item.deltaPercent = firstYearCost !== 0 ? (item.deltaFromBase / firstYearCost) * 100 : 0;
    
    const deviation = Math.abs(item.totalCostPerUnit - lifecycleWeightedAvg);
    if (deviation > maxDeviation) {
      maxDeviation = deviation;
    }
  }

  const maxDeviationPercent = lifecycleWeightedAvg !== 0 
    ? (maxDeviation / lifecycleWeightedAvg) * 100 
    : 0;

  return {
    harnessId: harness.harnessId,
    variableCostPerUnit,
    annualBreakdown,
    lifecycleWeightedAvg,
    maxDeviation,
    maxDeviationPercent
  };
}

/**
 * computeProjectAnnualizedCost — 项目级年度差异化计算
 * 
 * @param harnesses - 所有线束结果
 * @param equipment - 设备配置
 * @param volumes - 产量计划
 * @returns 各线束的年度差异化 + 项目级汇总
 */
export function computeProjectAnnualizedCost(
  harnesses: HarnessResult[],
  equipment: EquipmentConfig,
  volumes: VolumeSchedule[],
  options?: { fixedMfgAnnual?: number }
): {
  harnesses: AnnualizedCostResult[];
  projectAnnualBreakdown: AnnualCostBreakdown[];
  lifecycleWeightedAvg: number;
} {
  const safeHarnesses = safeArray(harnesses);
  const annualizedHarnesses = safeHarnesses.map(h => 
    computeAnnualizedCost(h, equipment, volumes, options)
  );

  const projectAnnualBreakdown: AnnualCostBreakdown[] = [];
  const safeVolumes = safeArray(volumes);
  
  let totalProjectLifecycleVolume = 0;
  let totalProjectLifecycleCost = 0;

  for (let i = 0; i < safeVolumes.length; i++) {
    const vol = safeVolumes[i]!;
    const year = vol.year;
    const volume = vol.volume;
    
    // Project per unit cost = Σ(harness.totalCostPerUnit * harness.vehicleRatio)
    let projectYearTotalCostPerUnit = 0;
    let projectYearEquipmentPerUnit = 0;
    let projectYearFixedMfgPerUnit = 0;

    for (let j = 0; j < annualizedHarnesses.length; j++) {
      const ah = annualizedHarnesses[j]!;
      const hSource = safeHarnesses[j]!;
      const ratio = hSource.vehicleRatio;
      
      // Find the breakdown for this year in this harness
      const yearData = ah.annualBreakdown.find(b => b.year === year);
      if (yearData) {
        projectYearTotalCostPerUnit += yearData.totalCostPerUnit * ratio;
        projectYearEquipmentPerUnit += yearData.equipmentPerUnit * ratio;
        projectYearFixedMfgPerUnit += yearData.fixedMfgPerUnit * ratio;
      }
    }

    projectAnnualBreakdown.push({
      year,
      volume,
      equipmentPerUnit: projectYearEquipmentPerUnit,
      fixedMfgPerUnit: projectYearFixedMfgPerUnit,
      totalCostPerUnit: projectYearTotalCostPerUnit,
      deltaFromBase: 0, // To be filled
      deltaPercent: 0  // To be filled
    });

    totalProjectLifecycleVolume += volume;
    totalProjectLifecycleCost += projectYearTotalCostPerUnit * volume;
  }

  // Finalize project breakdown
  const projectLifecycleWeightedAvg = totalProjectLifecycleVolume > 0 
    ? totalProjectLifecycleCost / totalProjectLifecycleVolume 
    : 0;

  const firstYearProjectCost = projectAnnualBreakdown[0]?.totalCostPerUnit ?? 0;
  for (const item of projectAnnualBreakdown) {
    item.deltaFromBase = item.totalCostPerUnit - firstYearProjectCost;
    item.deltaPercent = firstYearProjectCost !== 0 ? (item.deltaFromBase / firstYearProjectCost) * 100 : 0;
  }

  return {
    harnesses: annualizedHarnesses,
    projectAnnualBreakdown,
    lifecycleWeightedAvg: projectLifecycleWeightedAvg
  };
}
