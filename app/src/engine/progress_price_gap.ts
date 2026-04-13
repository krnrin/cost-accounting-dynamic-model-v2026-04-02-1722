/**
 * 进度价差跟踪引擎 (Issue #73)
 *
 * 跟踪“进度价”与“目标价”之间的差距，
 * 用于监控报价谈判进度和费用回收状态。
 */
import { numberOr } from './shared_utils';
import type { HarnessResult } from '@/types/harness';

/** 价差记录 */
export interface PriceGapRecord {
  harnessId: string;
  harnessName: string;
  vehicleRatio: number;
  /** 目标到厂价 (客户定点价) */
  targetPrice: number;
  /** 当前计算到厂价 */
  currentPrice: number;
  /** 价差 = current - target */
  gap: number;
  /** 价差率 */
  gapRate: number;
  /** 加权价差 */
  weightedGap: number;
  /** 状态 */
  status: 'within_target' | 'slight_over' | 'significant_over' | 'under_target';
}

/** 项目级价差汇总 */
export interface PriceGapSummary {
  records: PriceGapRecord[];
  /** 单车加权总价差 */
  totalWeightedGap: number;
  /** 超目标线束数 */
  overTargetCount: number;
  /** 低于目标线束数 */
  underTargetCount: number;
  /** 达标率 */
  onTargetRate: number;
  /** 风险等级 */
  riskLevel: 'low' | 'medium' | 'high';
}

/** 价差阈值配置 */
export interface GapThresholds {
  /** 轻微超标率 (default: 2%) */
  slightOverRate: number;
  /** 显著超标率 (default: 5%) */
  significantOverRate: number;
  /** 风险等级阈值: medium (单车加权价差) */
  mediumRiskGap: number;
  /** 风险等级阈值: high */
  highRiskGap: number;
}

const DEFAULT_THRESHOLDS: GapThresholds = {
  slightOverRate: 0.02,
  significantOverRate: 0.05,
  mediumRiskGap: 2,
  highRiskGap: 5,
};

/**
 * 计算价差汇总
 */
export function computePriceGapSummary(
  harnesses: Array<{
    harnessId: string;
    harnessName: string;
    result: HarnessResult;
    targetPrice: number;
  }>,
  thresholds?: Partial<GapThresholds>
): PriceGapSummary {
  const t = { ...DEFAULT_THRESHOLDS, ...thresholds };
  const records: PriceGapRecord[] = [];
  let totalWeightedGap = 0;
  let overTargetCount = 0;
  let underTargetCount = 0;

  for (const h of harnesses) {
    const currentPrice = numberOr(h.result.deliveredPrice, 0);
    const targetPrice = numberOr(h.targetPrice, 0);
    const vehicleRatio = numberOr(h.result.vehicleRatio, 0);
    const gap = currentPrice - targetPrice;
    const gapRate = targetPrice !== 0 ? gap / targetPrice : 0;
    const weightedGap = gap * vehicleRatio;

    let status: PriceGapRecord['status'];
    if (gapRate <= 0) {
      status = 'under_target';
      underTargetCount++;
    } else if (gapRate <= t.slightOverRate) {
      status = 'within_target';
    } else if (gapRate <= t.significantOverRate) {
      status = 'slight_over';
      overTargetCount++;
    } else {
      status = 'significant_over';
      overTargetCount++;
    }

    totalWeightedGap += weightedGap;

    records.push({
      harnessId: h.harnessId,
      harnessName: h.harnessName,
      vehicleRatio,
      targetPrice,
      currentPrice,
      gap,
      gapRate,
      weightedGap,
      status,
    });
  }

  const onTargetCount = harnesses.length - overTargetCount;
  const onTargetRate = harnesses.length > 0 ? onTargetCount / harnesses.length : 1;

  let riskLevel: PriceGapSummary['riskLevel'];
  if (Math.abs(totalWeightedGap) >= t.highRiskGap) {
    riskLevel = 'high';
  } else if (Math.abs(totalWeightedGap) >= t.mediumRiskGap) {
    riskLevel = 'medium';
  } else {
    riskLevel = 'low';
  }

  return {
    records,
    totalWeightedGap,
    overTargetCount,
    underTargetCount,
    onTargetRate,
    riskLevel,
  };
}
