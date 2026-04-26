/**
 * Marginal Attribution (C21 — Issue #75)
 *
 * [PR-102] 重命名说明：
 * 原名称 "Shapley Attribution" 具有误导性 — 当前实现并非真正的 Shapley 值。
 * Shapley 值需要计算所有排列组合的边际贡献，复杂度为 O(n!)，
 * 对于制造业成本模型不切实际。
 *
 * 当前实现为「边际贡献归因」：contribution = delta_i
 * 贡献率 = delta_i / Σ|delta_j|
 *
 * 若未来需要真正的 Shapley 值，可使用 Shapley-SV 或 KernelSHAP 近似算法。
 * 参见：https://arxiv.org/abs/1705.07374
 *
 * 管理决策舱增强 — 成本因素边际贡献归因
 * - 基于成本因素变动量计算边际贡献度
 * - 生成管理层可执行的决策建议
 * - 多维成本洞察汇总
 */

// ─── Types ───

export interface CostFactor {
  id: string;
  name: string;
  category: 'material' | 'labor' | 'overhead' | 'metal' | 'nre' | 'management' | 'packaging' | 'scrap';
  baseValue: number;
  currentValue: number;
  delta: number;
  deltaPercent: number;
}

export interface ShapleyResult {
  factorId: string;
  factorName: string;
  category: string;
  contribution: number;        // absolute contribution to total cost change
  contributionRate: number;    // percentage of total change
  rank: number;
}

export interface ManagerInsight {
  type: 'risk' | 'opportunity' | 'action' | 'info';
  severity: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  relatedFactors: string[];
  suggestedAction: string;
}

export interface DecisionSummary {
  totalCostChange: number;
  totalCostChangePercent: number;
  shapleyResults: ShapleyResult[];
  topContributor: ShapleyResult | null;
  insights: ManagerInsight[];
  categoryBreakdown: Array<{ category: string; totalContribution: number; factorCount: number }>;
}

// ─── Core Functions ───

/** [PR-102] Compute marginal attribution for cost factors (not true Shapley) */
export function computeMarginalAttribution(factors: CostFactor[]): ShapleyResult[] {
  const totalDelta = factors.reduce((sum, f) => sum + f.delta, 0);
  if (Math.abs(totalDelta) < 0.001) {
    return factors.map((f, i) => ({
      factorId: f.id,
      factorName: f.name,
      category: f.category,
      contribution: 0,
      contributionRate: 0,
      rank: i + 1,
    }));
  }

  // Simplified Shapley: proportional allocation based on marginal contribution
  // For manufacturing cost models, this is a pragmatic approximation
  const results: ShapleyResult[] = factors.map(f => {
    const contribution = f.delta;
    const contributionRate = totalDelta !== 0
      ? Math.round((f.delta / Math.abs(totalDelta)) * 10000) / 100
      : 0;
    return {
      factorId: f.id,
      factorName: f.name,
      category: f.category,
      contribution: Math.round(contribution * 100) / 100,
      contributionRate,
      rank: 0,
    };
  });

  // Rank by absolute contribution
  results.sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution));
  results.forEach((r, i) => { r.rank = i + 1; });

  return results;
}

/** Generate management insights from factors and Shapley results */
export function generateInsights(
  factors: CostFactor[],
  shapleyResults: ShapleyResult[],
): ManagerInsight[] {
  const insights: ManagerInsight[] = [];
  const totalDelta = factors.reduce((sum, f) => sum + f.delta, 0);

  // Top contributor insight
  if (shapleyResults.length > 0) {
    const top = shapleyResults[0]!;
    if (Math.abs(top.contributionRate) > 30) {
      insights.push({
        type: top.contribution > 0 ? 'risk' : 'opportunity',
        severity: Math.abs(top.contributionRate) > 50 ? 'high' : 'medium',
        title: `${top.factorName} 是成本变动主因`,
        description: `${top.factorName} 贡献了 ${Math.abs(top.contributionRate)}% 的成本变动（${top.contribution > 0 ? '增加' : '降低'} ¥${Math.abs(top.contribution).toLocaleString()}）`,
        relatedFactors: [top.factorId],
        suggestedAction: top.contribution > 0
          ? `建议优先审查 ${top.factorName} 的控制措施`
          : `${top.factorName} 降本效果显著，建议固化并推广`,
      });
    }
  }

  // Metal price sensitivity
  const metalFactors = factors.filter(f => f.category === 'metal');
  const metalDelta = metalFactors.reduce((s, f) => s + Math.abs(f.delta), 0);
  if (metalDelta > 0 && totalDelta !== 0 && (metalDelta / Math.abs(totalDelta)) > 0.2) {
    insights.push({
      type: 'risk',
      severity: 'medium',
      title: '金属价格波动影响显著',
      description: `金属成本变动占总变动的 ${Math.round((metalDelta / Math.abs(totalDelta)) * 100)}%，建议关注套期保值策略`,
      relatedFactors: metalFactors.map(f => f.id),
      suggestedAction: '建议与采购部门讨论金属价格锁定或套期保值方案',
    });
  }

  // Overall direction
  if (totalDelta > 0) {
    insights.push({
      type: 'action',
      severity: totalDelta / factors.reduce((s, f) => s + f.baseValue, 0) > 0.05 ? 'high' : 'medium',
      title: '总成本上升',
      description: `总成本增加 ¥${Math.abs(totalDelta).toLocaleString()}，需关注利润率影响`,
      relatedFactors: shapleyResults.filter(r => r.contribution > 0).map(r => r.factorId),
      suggestedAction: '建议评估是否需要调整报价或启动降本项目',
    });
  } else if (totalDelta < 0) {
    insights.push({
      type: 'opportunity',
      severity: 'low',
      title: '总成本下降',
      description: `总成本降低 ¥${Math.abs(totalDelta).toLocaleString()}，利润率改善`,
      relatedFactors: shapleyResults.filter(r => r.contribution < 0).map(r => r.factorId),
      suggestedAction: '建议评估是否可以通过降价提升竞争力，或保留利润改善',
    });
  }

  return insights;
}

/** Build full decision summary */
export function buildDecisionSummary(factors: CostFactor[]): DecisionSummary {
  const totalCostChange = Math.round(factors.reduce((s, f) => s + f.delta, 0) * 100) / 100;
  const totalBase = factors.reduce((s, f) => s + f.baseValue, 0);
  const totalCostChangePercent = totalBase !== 0
    ? Math.round((totalCostChange / totalBase) * 10000) / 100
    : 0;

  // [PR-102] 使用重命名后的函数
  const shapleyResults = computeMarginalAttribution(factors);
  const insights = generateInsights(factors, shapleyResults);

  // Category breakdown
  const catMap = new Map<string, { totalContribution: number; factorCount: number }>();
  for (const r of shapleyResults) {
    const existing = catMap.get(r.category) || { totalContribution: 0, factorCount: 0 };
    existing.totalContribution += r.contribution;
    existing.factorCount++;
    catMap.set(r.category, existing);
  }

  return {
    totalCostChange,
    totalCostChangePercent,
    shapleyResults,
    topContributor: shapleyResults[0] || null,
    insights,
    categoryBreakdown: Array.from(catMap.entries()).map(([category, data]) => ({
      category,
      totalContribution: Math.round(data.totalContribution * 100) / 100,
      factorCount: data.factorCount,
    })).sort((a, b) => Math.abs(b.totalContribution) - Math.abs(a.totalContribution)),
  };
}

// [PR-102] 向后兼容别名（deprecated）
/** @deprecated Use computeMarginalAttribution instead */
export const computeShapleyAttribution = computeMarginalAttribution;
