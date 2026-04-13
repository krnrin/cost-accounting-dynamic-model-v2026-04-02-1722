/**
 * app/src/engine/gap_analysis.ts
 * 报价 vs 实绩 Gap 分析引擎
 *
 * 核心逻辑：
 * 1. 材料层 Gap 拆解为「金属价格效应」+「用量效应」
 * 2. 加工层 Gap 拆解为「人工差异」+「制造费差异」+「损耗差异」
 * 3. 报价独有层 = 管理费 + 利润
 * 4. 瀑布图校验: 各项之和 === totalGap
 */

import { numberOr } from './shared_utils';
import type { HarnessResult, InternalHarnessResult } from '@/types/harness';
import type {
  DualMetalPrices,
  GapAnalysis,
  GapAlignedSnapshot,
  GapWaterfallItem,
  ProjectGapSummary,
} from '@/types/gap_analysis';

// ════════════════════════════════════════════
// 单线束 Gap 分析
// ════════════════════════════════════════════

/**
 * computeGapAnalysis — 计算单个线束的报价 vs 实绩 Gap
 *
 * @param quote    客户报价结果
 * @param internal 内部实绩结果
 * @param metalPrices 双口径金属价格
 * @returns Gap 分析结果
 */
export function computeGapAnalysis(
  quote: HarnessResult,
  internal: InternalHarnessResult,
  metalPrices: DualMetalPrices
): GapAnalysis {
  // ── 总价级 ──
  const quoteTotal = numberOr(quote.deliveredPrice, 0);
  const internalTotal = numberOr(internal.internalCost, 0);
  const totalGap = quoteTotal - internalTotal;
  const totalGapRate = internalTotal !== 0 ? totalGap / internalTotal : 0;

  // ── 材料层拆解 ──
  const quoteMaterial = numberOr(quote.materialCost, 0);
  const internalMaterial = numberOr(internal.materialCost, 0);
  const materialGap = quoteMaterial - internalMaterial;

  // 金属价格效应: weight(kg) × priceSpread(元/吨) / 1000
  const cuWeight = numberOr(quote.copperWeight, 0);
  const alWeight = numberOr(quote.aluminumWeight, 0);
  const copperPriceEffect = cuWeight * metalPrices.copperSpread / 1000;
  const aluminumPriceEffect = alWeight * metalPrices.aluminumSpread / 1000;
  const metalPriceEffect = copperPriceEffect + aluminumPriceEffect;

  // 用量效应 = 材料Gap - 价格效应 (理论上趋近零)
  const volumeEffect = materialGap - metalPriceEffect;

  // ── 加工层 ──
  const wasteGap = numberOr(quote.wasteCost, 0) - numberOr(internal.materialWaste, 0);
  const laborGap = numberOr(quote.directLabor, 0) - numberOr(internal.directLabor, 0);
  const mfgGap = numberOr(quote.manufacturing, 0) - numberOr(internal.mfgOverheadTotal, 0);
  const processingGap = laborGap + mfgGap;

  // ── 报价独有层 ──
  const mgmtFee = numberOr(quote.mgmtFee, 0);
  const profit = numberOr(quote.profit, 0);
  const grossMarginDesigned = mgmtFee + profit;

  // ── 物流层 ──
  const logisticsGap = numberOr(quote.packTotal, 0) - numberOr(internal.packTotal, 0);

  // ── 瀑布图 ──
  const waterfall: GapWaterfallItem[] = [
    { key: 'cu_price',    label: '铜价效应',       value: copperPriceEffect,   category: 'metal_price' },
    { key: 'al_price',    label: '铝价效应',       value: aluminumPriceEffect, category: 'metal_price' },
    { key: 'volume',      label: 'BOM用量差异',    value: volumeEffect,        category: 'material' },
    { key: 'waste',       label: '损耗差异',       value: wasteGap,            category: 'processing' },
    { key: 'labor',       label: '人工差异',       value: laborGap,            category: 'processing' },
    { key: 'mfg',         label: '制造费差异',     value: mfgGap,              category: 'processing' },
    { key: 'mgmt_fee',    label: '管理费(报价)',   value: mgmtFee,             category: 'margin' },
    { key: 'profit',      label: '利润(报价)',     value: profit,              category: 'margin' },
    { key: 'logistics',   label: '包装运输差异',   value: logisticsGap,        category: 'logistics' },
  ].filter(item => Math.abs(item.value) > 0.001);

  // ── 校验: 瀑布图各项之和 === totalGap ──
  const waterfallSum = waterfall.reduce((s, item) => s + item.value, 0);
  const waterfallBalanced = Math.abs(waterfallSum - totalGap) < 0.01;

  // ── 风险判定 ──
  let riskLevel: GapAnalysis['riskLevel'] = 'safe';
  let riskReason: string | undefined;

  if (totalGap < 0) {
    riskLevel = 'danger';
    riskReason = `报价低于实绩成本 ¥${Math.abs(totalGap).toFixed(2)}，实际亏损`;
  } else if (totalGapRate < 0.03) {
    riskLevel = 'watch';
    riskReason = `毛利空间仅 ${(totalGapRate * 100).toFixed(1)}%，低于3%安全线`;
  } else if (metalPriceEffect < 0 && Math.abs(metalPriceEffect) > grossMarginDesigned * 0.5) {
    // 金属价格反向侵蚀超过毛利空间 50%
    riskLevel = 'watch';
    riskReason = `金属价格效应 ¥${metalPriceEffect.toFixed(2)} 侵蚀毛利空间 ${((Math.abs(metalPriceEffect) / grossMarginDesigned) * 100).toFixed(0)}%`;
  }

  return {
    totalGap,
    totalGapRate,
    materialGap,
    copperPriceEffect,
    aluminumPriceEffect,
    metalPriceEffect,
    volumeEffect,
    wasteGap,
    laborGap,
    mfgGap,
    processingGap,
    mgmtFee,
    profit,
    grossMarginDesigned,
    logisticsGap,
    waterfall,
    riskLevel,
    riskReason,
    waterfallBalanced,
  };
}

// ════════════════════════════════════════════
// Gap 对齐快照构建
// ════════════════════════════════════════════

/**
 * createGapAlignedSnapshot — 构建一个 Gap 对齐快照
 */
export function createGapAlignedSnapshot(
  params: Omit<GapAlignedSnapshot, 'id' | 'createdAt' | 'gap'>
): GapAlignedSnapshot {
  const gap = computeGapAnalysis(
    params.quote.result,
    params.internal.result,
    params.metalPrices
  );

  return {
    ...params,
    id: generateSnapshotId(),
    createdAt: new Date().toISOString(),
    gap,
  };
}

// ════════════════════════════════════════════
// 项目级 Gap 汇总
// ════════════════════════════════════════════

/**
 * computeProjectGapSummary — 按装车比加权汇总所有线束的 Gap
 */
export function computeProjectGapSummary(
  snapshots: GapAlignedSnapshot[]
): ProjectGapSummary {
  if (snapshots.length === 0) {
    return {
      snapshots: [],
      weightedTotalGap: 0,
      weightedGrossMarginRate: 0,
      weightedWaterfall: [],
      dangerHarnesses: [],
      projectRiskLevel: 'safe',
      metalPriceSource: {
        customer: '',
        internal: '',
        copperSpread: 0,
        aluminumSpread: 0,
      },
    };
  }

  let weightedTotalGap = 0;
  let weightedInternalCost = 0;

  // 按 waterfall key 聚合
  const waterfallMap = new Map<string, { label: string; value: number; category: GapWaterfallItem['category'] }>();
  const dangerHarnesses: ProjectGapSummary['dangerHarnesses'] = [];

  for (const snap of snapshots) {
    const ratio = numberOr(snap.quote.result.vehicleRatio, 0);
    const gap = snap.gap;

    weightedTotalGap += gap.totalGap * ratio;
    weightedInternalCost += numberOr(snap.internal.result.internalCost, 0) * ratio;

    // 聚合瀑布图
    for (const item of gap.waterfall) {
      const existing = waterfallMap.get(item.key);
      if (existing) {
        existing.value += item.value * ratio;
      } else {
        waterfallMap.set(item.key, {
          label: item.label,
          value: item.value * ratio,
          category: item.category,
        });
      }
    }

    // 标记亏损线束
    if (gap.riskLevel === 'danger') {
      dangerHarnesses.push({
        harnessId: snap.quote.result.harnessId,
        harnessName: snap.quote.result.harnessName,
        gap: gap.totalGap,
        gapRate: gap.totalGapRate,
      });
    }
  }

  const weightedGrossMarginRate = weightedInternalCost !== 0
    ? weightedTotalGap / weightedInternalCost
    : 0;

  const weightedWaterfall: GapWaterfallItem[] = Array.from(waterfallMap.entries())
    .filter(([, v]) => Math.abs(v.value) > 0.001)
    .map(([key, v]) => ({ key, ...v }));

  // 项目风险
  let projectRiskLevel: ProjectGapSummary['projectRiskLevel'] = 'safe';
  if (weightedTotalGap < 0) {
    projectRiskLevel = 'danger';
  } else if (weightedGrossMarginRate < 0.03) {
    projectRiskLevel = 'watch';
  } else if (dangerHarnesses.length > 0) {
    projectRiskLevel = 'watch';
  }

  // 取第一个快照的金属价格源信息
  const firstSnap = snapshots[0];

  return {
    snapshots,
    weightedTotalGap,
    weightedGrossMarginRate,
    weightedWaterfall,
    dangerHarnesses,
    projectRiskLevel,
    metalPriceSource: {
      customer: firstSnap.metalPrices.customer.label,
      internal: firstSnap.metalPrices.internal.label,
      copperSpread: firstSnap.metalPrices.copperSpread,
      aluminumSpread: firstSnap.metalPrices.aluminumSpread,
    },
  };
}

// ════════════════════════════════════════════
// 工具函数
// ════════════════════════════════════════════

/**
 * buildDualMetalPrices — 构建双口径金属价格对象
 */
export function buildDualMetalPrices(
  customerCopper: number,
  customerAluminum: number,
  internalCopper: number,
  internalAluminum: number,
  internalSource: DualMetalPrices['internal']['source'],
  internalLabel: string
): DualMetalPrices {
  return {
    customer: {
      copper: customerCopper,
      aluminum: customerAluminum,
      source: 'sales_input',
      label: '客户口径',
      effectiveDate: new Date().toISOString(),
    },
    internal: {
      copper: internalCopper,
      aluminum: internalAluminum,
      source: internalSource,
      label: internalLabel,
      effectiveDate: new Date().toISOString(),
    },
    copperSpread: customerCopper - internalCopper,
    aluminumSpread: customerAluminum - internalAluminum,
  };
}

function generateSnapshotId(): string {
  return `gap-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
