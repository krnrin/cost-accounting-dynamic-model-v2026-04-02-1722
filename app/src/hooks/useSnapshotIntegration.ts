/**
 * C6: 快照集成 React Hook
 *
 * 为页面组件提供快照操作的统一接口：
 * - 冻结时自动创建快照
 * - 加载快照历史
 * - 对比快照差异
 * - 从快照恢复参数
 */
import { useState, useCallback, useEffect } from 'react';
import {
  createFreezeSnapshot,
  getSnapshotChain,
  restoreFromSnapshot,
  getScenarioSnapshotHistory,
  type SnapshotChain,
} from '@/engine/snapshot_integration';
import { compareQuoteSnapshots, type QuoteSnapshot } from '@/engine/quote_snapshot';
import { useSettingsSnapshotStore, type SettingsSnapshot, type SnapshotDiff } from '@/store/settingsSnapshotStore';
import { useSettingsStore } from '@/store/settingsStore';
import type { CostRates, MetalPrices } from '@/types/project';

export interface UseSnapshotIntegrationReturn {
  /** 当前场景的快照链 */
  snapshotChain: SnapshotChain | null;
  /** 参数快照历史 */
  settingsHistory: SettingsSnapshot[];
  /** 报价快照历史 */
  quoteHistory: QuoteSnapshot[];
  /** 加载状态 */
  isLoading: boolean;
  /** 错误信息 */
  error: string | null;

  /** 执行冻结快照（在场景冻结时调用） */
  performFreezeSnapshot: (scenarioId: string, opts?: { userId?: string; note?: string }) => Promise<SnapshotChain>;
  /** 加载场景快照历史 */
  loadHistory: (scenarioId: string) => Promise<void>;
  /** 对比两个参数快照 */
  compareSettings: (a: SettingsSnapshot, b: SettingsSnapshot) => SnapshotDiff[];
  /** 对比两个报价快照 */
  compareQuotes: (a: QuoteSnapshot, b: QuoteSnapshot) => ReturnType<typeof compareQuoteSnapshots>;
  /** 从快照恢复参数 */
  restore: (snapshotId: string) => Promise<boolean>;
}

export function useSnapshotIntegration(): UseSnapshotIntegrationReturn {
  const [snapshotChain, setSnapshotChain] = useState<SnapshotChain | null>(null);
  const [settingsHistory, setSettingsHistory] = useState<SettingsSnapshot[]>([]);
  const [quoteHistory, setQuoteHistory] = useState<QuoteSnapshot[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { compareSnapshots } = useSettingsSnapshotStore();
  const settingsStore = useSettingsStore();

  const performFreezeSnapshot = useCallback(
    async (scenarioId: string, opts?: { userId?: string; note?: string }) => {
      setIsLoading(true);
      setError(null);
      try {
        // 从 settingsStore 获取当前参数
        const state = settingsStore as any;
        const settingsData = {
          costRates: (state.costRates ?? state.getCostRates?.() ?? {}) as CostRates,
          metalPrices: (state.metalPrices ?? state.getMetalPrices?.() ?? {}) as MetalPrices,
          annualDropRate: state.annualDropRate ?? 0,
        };

        const chain = await createFreezeSnapshot(scenarioId, settingsData, opts);
        setSnapshotChain(chain);
        return chain;
      } catch (err) {
        const msg = err instanceof Error ? err.message : '快照创建失败';
        setError(msg);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [settingsStore]
  );

  const loadHistory = useCallback(async (scenarioId: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const [chain, history] = await Promise.all([
        getSnapshotChain(scenarioId),
        getScenarioSnapshotHistory(scenarioId),
      ]);
      setSnapshotChain(chain);
      setSettingsHistory(history.settings);
      setQuoteHistory(history.quotes);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载快照历史失败');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const compareSettings = useCallback(
    (a: SettingsSnapshot, b: SettingsSnapshot) => compareSnapshots(a, b),
    [compareSnapshots]
  );

  const compareQuotes = useCallback(
    (a: QuoteSnapshot, b: QuoteSnapshot) => compareQuoteSnapshots(a, b),
    []
  );

  const restore = useCallback(async (snapshotId: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await restoreFromSnapshot(snapshotId);
      if (!data) {
        setError('快照数据不存在');
        return false;
      }
      // 通知 settingsStore 应用恢复的参数
      const store = settingsStore as any;
      if (store.applyCostRates) {
        store.applyCostRates(data.costRates);
      }
      if (store.applyMetalPrices) {
        store.applyMetalPrices(data.metalPrices);
      }
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : '恢复失败');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [settingsStore]);

  return {
    snapshotChain,
    settingsHistory,
    quoteHistory,
    isLoading,
    error,
    performFreezeSnapshot,
    loadHistory,
    compareSettings,
    compareQuotes,
    restore,
  };
}
