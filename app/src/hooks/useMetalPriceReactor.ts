/**
 * C9: 金属价格联动 React Hook
 *
 * 在 SettingsPage 金属价格编辑时提供：
 * - 即时影响预览（quickEstimate）
 * - 完整反应计划构建
 * - 预警事件生成
 * - 执行状态管理
 *
 * 对应 Issue #61
 */

import { useState, useCallback } from 'react';
import {
  quickEstimate,
  buildReactionPlan,
  type MetalPriceChange,
  type AffectedScenario,
  type ReactionPlan,
} from '@/engine/metal_price_reactor';
import type { MetalPrices } from '@/types/project';
import type { HarnessResult } from '@/types/harness';
import type { MetalAlertThresholds } from '@/engine/metal_alert';

export interface UseMetalPriceReactorReturn {
  /** 即时预览 */
  preview: ReturnType<typeof quickEstimate> | null;
  /** 完整反应计划 */
  plan: ReactionPlan | null;
  /** 是否在构建计划中 */
  building: boolean;
  /** 错误信息 */
  error: string | null;

  /** 更新即时预览（输入框 onChange 时调用） */
  updatePreview: (oldPrices: MetalPrices, newPrices: MetalPrices) => void;
  /** 构建完整反应计划（确认变更前调用） */
  buildPlan: (
    change: MetalPriceChange,
    scenarios: AffectedScenario[],
    getHarnessResults: (scenarioId: string) => Promise<Array<{
      harnessId: string;
      harnessName: string;
      result: HarnessResult;
      copperWeight: number;
      aluminumWeight: number;
    }>>
  ) => Promise<ReactionPlan | null>;
  /** 重置 */
  reset: () => void;
}

export function useMetalPriceReactor(
  totalCopperWeight: number,
  totalAluminumWeight: number,
  thresholds?: MetalAlertThresholds
): UseMetalPriceReactorReturn {
  const [preview, setPreview] = useState<ReturnType<typeof quickEstimate> | null>(null);
  const [plan, setPlan] = useState<ReactionPlan | null>(null);
  const [building, setBuilding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updatePreview = useCallback((oldPrices: MetalPrices, newPrices: MetalPrices) => {
    try {
      const result = quickEstimate(oldPrices, newPrices, totalCopperWeight, totalAluminumWeight);
      setPreview(result);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : '预览计算失败');
    }
  }, [totalCopperWeight, totalAluminumWeight]);

  const buildPlan = useCallback(async (
    change: MetalPriceChange,
    scenarios: AffectedScenario[],
    getHarnessResults: Parameters<typeof buildReactionPlan>[2]
  ) => {
    setBuilding(true);
    setError(null);
    try {
      const result = await buildReactionPlan(change, scenarios, getHarnessResults, thresholds);
      setPlan(result);
      return result;
    } catch (e) {
      const msg = e instanceof Error ? e.message : '反应计划构建失败';
      setError(msg);
      return null;
    } finally {
      setBuilding(false);
    }
  }, [thresholds]);

  const reset = useCallback(() => {
    setPreview(null);
    setPlan(null);
    setBuilding(false);
    setError(null);
  }, []);

  return { preview, plan, building, error, updatePreview, buildPlan, reset };
}
