/**
 * 变更传播 React Hook (Issue #60)
 *
 * 封装 change_propagation 引擎，提供：
 * - 创建变更事件
 * - 计算级联影响预览
 * - 确认并应用变更
 * - 变更历史记录
 */
import { useState, useCallback } from 'react';
import {
  computePropagation,
  createChangeEvent,
  type ChangeEvent,
  type ChangeEventType,
  type PropagationResult,
} from '@/engine/change_propagation';
import { createAuditRecord } from '@/engine/audit_trace';
import type { HarnessInput, HarnessResult } from '@/types/harness';
import type { CostRates } from '@/types/project';

export interface UseChangePropagationReturn {
  /** 当前变更事件 */
  currentEvent: ChangeEvent | null;
  /** 传播影响预览 */
  preview: PropagationResult | null;
  /** 是否正在计算 */
  isComputing: boolean;
  /** 变更历史 */
  history: PropagationResult[];

  /** 创建变更事件并计算影响 */
  createAndPreview: (
    type: ChangeEventType,
    scenarioId: string,
    projectId: string,
    before: Record<string, unknown>,
    after: Record<string, unknown>,
    harnesses: Array<{ harnessId: string; harnessName: string; input: HarnessInput; result: HarnessResult }>,
    currentRates: CostRates,
    options?: { affectedHarnessIds?: string[]; userId?: string; note?: string }
  ) => PropagationResult;

  /** 确认应用变更 */
  confirmApply: (result: PropagationResult) => void;

  /** 清除当前预览 */
  clearPreview: () => void;
}

export function useChangePropagation(): UseChangePropagationReturn {
  const [currentEvent, setCurrentEvent] = useState<ChangeEvent | null>(null);
  const [preview, setPreview] = useState<PropagationResult | null>(null);
  const [isComputing, setIsComputing] = useState(false);
  const [history, setHistory] = useState<PropagationResult[]>([]);

  const createAndPreview = useCallback(
    (
      type: ChangeEventType,
      scenarioId: string,
      projectId: string,
      before: Record<string, unknown>,
      after: Record<string, unknown>,
      harnesses: Array<{ harnessId: string; harnessName: string; input: HarnessInput; result: HarnessResult }>,
      currentRates: CostRates,
      options?: { affectedHarnessIds?: string[]; userId?: string; note?: string }
    ): PropagationResult => {
      setIsComputing(true);
      try {
        const event = createChangeEvent(type, scenarioId, projectId, before, after, options);
        setCurrentEvent(event);

        const result = computePropagation(event, harnesses, currentRates);
        setPreview(result);

        // 记录审计
        createAuditRecord('ECN', `变更传播预览: ${type}`, {
          projectId,
          scenarioId,
          before,
          after,
          note: `影响 ${result.affectedCount} 条线束, WVCP: ¥${result.totalWeightedImpact.toFixed(2)}`,
        });

        return result;
      } finally {
        setIsComputing(false);
      }
    },
    []
  );

  const confirmApply = useCallback((result: PropagationResult) => {
    setHistory((prev) => [result, ...prev].slice(0, 100));

    createAuditRecord('ECN', `变更传播已确认: ${result.event.type}`, {
      projectId: result.event.projectId,
      scenarioId: result.event.scenarioId,
      after: {
        affectedCount: result.affectedCount,
        totalWeightedImpact: result.totalWeightedImpact,
      },
    });

    setPreview(null);
    setCurrentEvent(null);
  }, []);

  const clearPreview = useCallback(() => {
    setPreview(null);
    setCurrentEvent(null);
  }, []);

  return {
    currentEvent,
    preview,
    isComputing,
    history,
    createAndPreview,
    confirmApply,
    clearPreview,
  };
}
