import { numberOr } from './shared_utils';

/**
 * quote_template.ts — 报价模块
 *
 * 唯一功能: 根据内部成本 + 目标毛利率，计算建议售价。
 *
 * 使用场景:
 *   1. 销售上传报价资料
 *   2. 程序从成本核算模块取到内部成本总额
 *   3. 销售手动输入目标毛利率（如 15%）
 *   4. 程序输出建议售价
 *   5. 销售拿建议价按商务策略自行调整后报给客户
 */

/**
 * computeSuggestedPrice — 计算建议售价
 *
 * 公式: 建议售价 = 内部成本 / (1 - 毛利率)
 *
 * 例子:
 *   成本 100，毛利 15% → 售价 = 100 / (1 - 0.15) = 100 / 0.85 ≈ 117.65
 *   成本 200，毛利 20% → 售价 = 200 / (1 - 0.20) = 200 / 0.80 = 250.00
 *
 * 边界处理:
 *   - 毛利率 ≤ 0% 或 ≥ 100% → 返回成本价（无效输入保护）
 *   - 成本为 0 或负数 → 返回 0
 *
 * @param internalCost - 内部实际成本 (元)
 * @param targetMarginPercent - 目标毛利率 (如 15 表示 15%)
 * @returns 建议售价 (元)
 */
export function computeSuggestedPrice(
  internalCost: number,
  targetMarginPercent: number,
): number {
  const cost = numberOr(internalCost, 0);
  if (cost <= 0) return 0;

  const margin = numberOr(targetMarginPercent, 0) / 100;
  if (margin <= 0 || margin >= 1) return cost;

  return cost / (1 - margin);
}
