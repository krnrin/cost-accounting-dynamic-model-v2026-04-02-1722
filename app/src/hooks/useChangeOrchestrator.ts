/**
 * C11: 设变传导链 React Hook
 *
 * 提供设变确认后的完整传导流程：
 * - 阶段追踪 (stage)
 * - 传导结果
 * - 确认/取消/重试
 *
 * 对应 Issue #60
 */

import { useState, useCallback } from 'react';
import {
  orchestrate,
  type OrchestrationResult,
  type OrchestrationConfig,
  type PropagationStage,
  DEFAULT_ORCHESTRATION_CONFIG,
} from '@/engine/change_orchestrator';

export interface UseChangeOrchestratorReturn {
  /** 当前阶段 */
  stage: PropagationStage;
  /** 传导结果 */
  result: OrchestrationResult | null;
  /** 是否在执行中 */
  running: boolean;
  /** 错误信息 */
  error: string | null;
  /** 配置 */
  config: OrchestrationConfig;

  /** 执行传导管道 */
  run: (
    changeId: string,
    scenarioId: string,
    projectId: string,
    scenarioName: string,
    rawChangeItems: Array<{
      partNo: string;
      partName?: string;
      action: string;
      oldQty?: number;
      newQty?: number;
      oldPrice?: number;
      newPrice?: number;
      semanticMode?: string;
    }>,
    harnessData: Array<{
      harnessId: string;
      harnessName: string;
      deliveredPrice: number;
      affectedPartRatio: number;
    }>,
    sheetCounts: { assembly: number; secondary: number; ksk: number }
  ) => OrchestrationResult;

  /** 更新配置 */
  updateConfig: (partial: Partial<OrchestrationConfig>) => void;
  /** 重置 */
  reset: () => void;
}

export function useChangeOrchestrator(
  initialConfig?: Partial<OrchestrationConfig>
): UseChangeOrchestratorReturn {
  const [stage, setStage] = useState<PropagationStage>('idle');
  const [result, setResult] = useState<OrchestrationResult | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [config, setConfig] = useState<OrchestrationConfig>({
    ...DEFAULT_ORCHESTRATION_CONFIG,
    ...initialConfig,
  });

  const run = useCallback((
    changeId: string,
    scenarioId: string,
    projectId: string,
    scenarioName: string,
    rawChangeItems: Parameters<typeof orchestrate>[4],
    harnessData: Parameters<typeof orchestrate>[5],
    sheetCounts: Parameters<typeof orchestrate>[6]
  ) => {
    setRunning(true);
    setError(null);
    setStage('extracting_changes');

    try {
      const res = orchestrate(
        changeId,
        scenarioId,
        projectId,
        scenarioName,
        rawChangeItems,
        harnessData,
        sheetCounts,
        config
      );
      setResult(res);
      setStage(res.stage);
      if (res.error) setError(res.error);
      return res;
    } catch (e) {
      const msg = e instanceof Error ? e.message : '传导执行失败';
      setError(msg);
      setStage('failed');
      throw e;
    } finally {
      setRunning(false);
    }
  }, [config]);

  const updateConfig = useCallback((partial: Partial<OrchestrationConfig>) => {
    setConfig(prev => ({ ...prev, ...partial }));
  }, []);

  const reset = useCallback(() => {
    setStage('idle');
    setResult(null);
    setRunning(false);
    setError(null);
  }, []);

  return { stage, result, running, error, config, run, updateConfig, reset };
}
