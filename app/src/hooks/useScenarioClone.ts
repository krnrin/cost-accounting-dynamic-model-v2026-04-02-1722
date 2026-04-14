/**
 * C8: 场景复制 React Hook
 *
 * 提供场景克隆功能的 React 接口：
 * - 克隆校验
 * - 全量/选择性克隆
 * - 快速克隆
 * - What-If 场景创建
 * - 加载状态 & 错误处理
 *
 * 对应 Issue #62
 */

import { useState, useCallback } from 'react';
import {
  cloneScenario,
  quickClone,
  createWhatIfScenario,
  validateClone,
  type CloneOptions,
  type CloneResult,
  type CloneValidation,
} from '@/engine/scenario_clone';

export interface UseScenarioCloneReturn {
  /** 当前是否在克隆中 */
  cloning: boolean;
  /** 最近一次克隆结果 */
  result: CloneResult | null;
  /** 错误信息 */
  error: string | null;
  /** 校验结果 */
  validation: CloneValidation | null;

  /** 校验克隆参数（不执行克隆） */
  validate: (sourceId: string, options: CloneOptions) => Promise<CloneValidation>;
  /** 执行完整克隆 */
  clone: (sourceId: string, options: CloneOptions) => Promise<CloneResult | null>;
  /** 快速克隆（自动命名） */
  quickCloneScenario: (sourceId: string) => Promise<CloneResult | null>;
  /** 创建 What-If 场景 */
  createWhatIf: (baselineId: string, name: string) => Promise<CloneResult | null>;
  /** 重置状态 */
  reset: () => void;
}

export function useScenarioClone(userId?: string): UseScenarioCloneReturn {
  const [cloning, setCloning] = useState(false);
  const [result, setResult] = useState<CloneResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [validation, setValidation] = useState<CloneValidation | null>(null);

  const reset = useCallback(() => {
    setCloning(false);
    setResult(null);
    setError(null);
    setValidation(null);
  }, []);

  const validate = useCallback(async (sourceId: string, options: CloneOptions) => {
    try {
      const v = await validateClone(sourceId, options);
      setValidation(v);
      return v;
    } catch (e) {
      const msg = e instanceof Error ? e.message : '校验失败';
      setError(msg);
      const failedValidation: CloneValidation = { valid: false, errors: [msg], warnings: [] };
      setValidation(failedValidation);
      return failedValidation;
    }
  }, []);

  const clone = useCallback(async (sourceId: string, options: CloneOptions) => {
    setCloning(true);
    setError(null);
    setResult(null);
    try {
      const opts = { ...options, userId };
      const res = await cloneScenario(sourceId, opts);
      setResult(res);
      return res;
    } catch (e) {
      const msg = e instanceof Error ? e.message : '克隆失败';
      setError(msg);
      return null;
    } finally {
      setCloning(false);
    }
  }, [userId]);

  const quickCloneScenario = useCallback(async (sourceId: string) => {
    setCloning(true);
    setError(null);
    setResult(null);
    try {
      const res = await quickClone(sourceId, userId);
      setResult(res);
      return res;
    } catch (e) {
      const msg = e instanceof Error ? e.message : '快速克隆失败';
      setError(msg);
      return null;
    } finally {
      setCloning(false);
    }
  }, [userId]);

  const createWhatIf = useCallback(async (baselineId: string, name: string) => {
    setCloning(true);
    setError(null);
    setResult(null);
    try {
      const res = await createWhatIfScenario(baselineId, name, userId);
      setResult(res);
      return res;
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'What-If 场景创建失败';
      setError(msg);
      return null;
    } finally {
      setCloning(false);
    }
  }, [userId]);

  return {
    cloning,
    result,
    error,
    validation,
    validate,
    clone,
    quickCloneScenario,
    createWhatIf,
    reset,
  };
}
