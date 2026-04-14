/**
 * useBomNormalizer — BOM 标准化匹配 hook
 *
 * 桥接 engine/bom_normalizer 到 BomDiffPage
 * 提供增强的 BOM 对比功能：
 *   - 当前 BomDiffPage 使用 partNo 精确匹配（简单但不精确）
 *   - bom_normalizer 提供 5 级匹配：
 *     1. partNo 精确匹配
 *     2. backup key 匹配
 *     3. 特征核心匹配（13 类特征提取）
 *     4. 文本相似度匹配（≥ 0.78）
 *     5. 替代规则匹配
 *
 * 集成方式（BomDiffPage.tsx）：
 *   import { enhancedBomCompare } from '@/hooks/useBomNormalizer';
 *   // 替换 detectBomChanges 中的简单 partNo 匹配：
 *   const matchResult = enhancedBomCompare(baseBom, currentBom);
 */
import { useCallback } from 'react';
import {
  normalizeBomItem,
  compareItems,
  compareBomLists,
  textSimilarity,
  DEFAULT_NORMALIZATION_CONFIG,
  DEFAULT_SUBSTITUTE_RULES,
} from '@/engine/bom_normalizer';
import type { BomItem } from '@/types/harness';

/**
 * 使用 bom_normalizer 引擎进行增强的 BOM 对比
 * 替代 BomDiffPage 中的简单 partNo 精确匹配
 *
 * @param baseBom 基线 BOM 列表
 * @param currentBom 当前 BOM 列表
 * @param config 标准化配置（可选，默认使用 DEFAULT_NORMALIZATION_CONFIG）
 */
export function enhancedBomCompare(
  baseBom: BomItem[],
  currentBom: BomItem[],
  substituteRules?: Parameters<typeof compareBomLists>[2],
) {
  return compareBomLists(baseBom as any, currentBom as any, substituteRules || DEFAULT_SUBSTITUTE_RULES);
}

/**
 * 标准化单个 BOM 条目（名称清洗 + 特征提取）
 */
export function normalizeSingleItem(
  item: BomItem,
  config?: Parameters<typeof normalizeBomItem>[1],
) {
  return normalizeBomItem(item, config || DEFAULT_NORMALIZATION_CONFIG);
}

/**
 * 比较两个 BOM 条目的相似度
 */
export function compareTwo(
  a: BomItem,
  b: BomItem,
  substituteRules?: Parameters<typeof compareItems>[2],
) {
  return compareItems(a as any, b as any, substituteRules || DEFAULT_SUBSTITUTE_RULES);
}

/**
 * 计算两个文本的相似度（0~1）
 */
export { textSimilarity };

/**
 * React hook 版本：缓存 compare 函数
 */
export function useBomNormalizer() {
  const compare = useCallback(
    (baseBom: BomItem[], currentBom: BomItem[]) => {
      return enhancedBomCompare(baseBom, currentBom);
    },
    [],
  );

  const normalize = useCallback(
    (item: BomItem) => {
      return normalizeSingleItem(item);
    },
    [],
  );

  return {
    /** 增强版 BOM 对比（5 级模糊匹配） */
    compare,
    /** 标准化单个条目 */
    normalize,
    /** 文本相似度计算 */
    textSimilarity,
    /** 默认标准化配置 */
    defaultConfig: DEFAULT_NORMALIZATION_CONFIG,
    /** 默认替代规则 */
    defaultSubstituteRules: DEFAULT_SUBSTITUTE_RULES,
  };
}
