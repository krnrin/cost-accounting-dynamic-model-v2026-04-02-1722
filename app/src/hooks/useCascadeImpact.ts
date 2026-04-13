/**
 * useCascadeImpact — 设变级联影响 hook
 *
 * 桥接 engine/cascade_impact 到 ChangeEnginePage
 * 提供：
 *   - 装配件表级联影响计算（computeAssemblyPartsImpact）
 *   - 辅材表级联影响计算（computeSecondaryMaterialImpact）
 *   - KSK 表级联影响计算（computeKskImpact）
 *   - 聚合全部级联影响并输出预览
 *
 * 设变传导链：
 *   BOM 变更 → 语义分类(classifier) → 级联影响(cascade_impact)
 *   支持所有语义模式: replace, merge, split, fixed_length, segmented_length, qty_explode
 *
 * 集成方式（ChangeEnginePage.tsx）：
 *   import { useCascadeImpact } from '@/hooks/useCascadeImpact';
 *   const cascade = useCascadeImpact();
 *   // 当用户提交设变时：
 *   const impact = await cascade.computeAll(bomChanges, semanticChanges, sheetData);
 *   // impact.totalActions → 总影响操作数
 *   // impact.preview      → 级联影响预览数据
 *   // impact.bySheet       → 按 sheet 分组的影响
 */
import { useCallback, useState } from 'react';
import {
  computeAssemblyPartsImpact,
  computeSecondaryMaterialImpact,
  computeKskImpact,
} from '@/engine/cascade_impact';

export interface CascadeImpactResult {
  /** 装配件表影响 */
  assembly: ReturnType<typeof computeAssemblyPartsImpact> | null;
  /** 辅材表影响 */
  secondary: ReturnType<typeof computeSecondaryMaterialImpact> | null;
  /** KSK 表影响 */
  ksk: ReturnType<typeof computeKskImpact> | null;
  /** 总影响操作数 */
  totalActions: number;
  /** 是否有级联影响 */
  hasImpact: boolean;
  /** 计算时间 */
  computedAt: string;
}

/**
 * 封装 cascade_impact 引擎的 React hook
 */
export function useCascadeImpact() {
  const [result, setResult] = useState<CascadeImpactResult | null>(null);
  const [computing, setComputing] = useState(false);

  /**
   * 计算全部级联影响（装配件 + 辅材 + KSK）
   * @param bomChanges BOM 行级变更数据（来自 BomDiffPage 或 detectBomChanges）
   * @param semanticChanges 语义变更分类结果（来自 change_pattern_classifier）
   * @param sheetData 各 sheet 的行数据
   */
  const computeAll = useCallback(
    async (
      bomChanges: Parameters<typeof computeAssemblyPartsImpact>[0],
      semanticChanges: Parameters<typeof computeAssemblyPartsImpact>[1],
      sheetData: {
        assemblyRows?: Parameters<typeof computeAssemblyPartsImpact>[2];
        secondaryRows?: Parameters<typeof computeSecondaryMaterialImpact>[2];
        kskRows?: Parameters<typeof computeKskImpact>[2];
      },
    ): Promise<CascadeImpactResult> => {
      setComputing(true);
      try {
        const assembly = sheetData.assemblyRows
          ? computeAssemblyPartsImpact(bomChanges, semanticChanges, sheetData.assemblyRows)
          : null;

        const secondary = sheetData.secondaryRows
          ? computeSecondaryMaterialImpact(bomChanges, semanticChanges, sheetData.secondaryRows)
          : null;

        const ksk = sheetData.kskRows
          ? computeKskImpact(bomChanges, semanticChanges, sheetData.kskRows)
          : null;

        const countActions = (r: any) => {
          if (!r) return 0;
          if (r.actions && Array.isArray(r.actions)) return r.actions.length;
          return 0;
        };

        const totalActions = countActions(assembly) + countActions(secondary) + countActions(ksk);

        const impact: CascadeImpactResult = {
          assembly,
          secondary,
          ksk,
          totalActions,
          hasImpact: totalActions > 0,
          computedAt: new Date().toISOString(),
        };

        setResult(impact);
        return impact;
      } finally {
        setComputing(false);
      }
    },
    [],
  );

  /**
   * 仅计算装配件表级联影响
   */
  const computeAssembly = useCallback(
    (...args: Parameters<typeof computeAssemblyPartsImpact>) => {
      return computeAssemblyPartsImpact(...args);
    },
    [],
  );

  /**
   * 仅计算辅材表级联影响
   */
  const computeSecondary = useCallback(
    (...args: Parameters<typeof computeSecondaryMaterialImpact>) => {
      return computeSecondaryMaterialImpact(...args);
    },
    [],
  );

  /**
   * 仅计算 KSK 表级联影响
   */
  const computeKsk = useCallback(
    (...args: Parameters<typeof computeKskImpact>) => {
      return computeKskImpact(...args);
    },
    [],
  );

  return {
    /** 计算全部级联影响 */
    computeAll,
    /** 仅计算装配件影响 */
    computeAssembly,
    /** 仅计算辅材影响 */
    computeSecondary,
    /** 仅计算 KSK 影响 */
    computeKsk,
    /** 计算结果 */
    result,
    /** 是否正在计算 */
    computing,
  };
}
