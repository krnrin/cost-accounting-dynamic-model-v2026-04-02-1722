/**
 * 内部成本核算金属价格 Store
 *
 * 与 pricingStore.metalPrices（客户报价口径）分离，
 * 管理内部实绩侧的金属价格状态：
 *   1. 财务发布基准价（公司内部基准）
 *   2. 上海期货交易所 (SHFE) 现货价
 *   3. 上海有色金属网 (SMM) 现货价
 *
 * Phase 1: 手动录入 + 过期检测
 * Phase 2: SMM API 对接（backlog）
 *
 * 对应 C7 Gap 分析 / Issue #77
 */

import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { db, type MetalPriceHistoryRecord } from '@/data/db';

export type InternalMetalSource = 'benchmark' | 'shfe_spot' | 'smm_spot';

export interface MetalPriceEntry {
  copper: number;   // 元/吨
  aluminum: number; // 元/吨
  timestamp: string;
  note?: string;
}

export interface InternalMetalState {
  /** 当前选中的内部金属价格来源 */
  activeSource: InternalMetalSource;

  /** 各来源的金属价格 */
  prices: Record<InternalMetalSource, MetalPriceEntry>;

  /** 过期阈值（小时），超过此时间显示 stale 警告 */
  stalenessThresholdHours: number;

  /** 是否正在加载 */
  isLoading: boolean;
  error: string | null;

  // ── Actions ──────────────────────────────────────────────

  /** 切换内部金属价格来源 */
  setActiveSource: (source: InternalMetalSource) => void;

  /** 更新指定来源的金属价格（手动录入） */
  updatePrice: (
    source: InternalMetalSource,
    copper: number,
    aluminum: number,
    note?: string
  ) => Promise<void>;

  /** 设置过期阈值 */
  setStalenessThreshold: (hours: number) => void;

  /** 获取当前活跃来源的价格 */
  getActivePrice: () => MetalPriceEntry;

  /** 检查指定来源的价格是否过期 */
  isStale: (source?: InternalMetalSource) => boolean;

  /** 获取过期状态文本 */
  getStalenessLabel: (source?: InternalMetalSource) => string;

  /** 获取所有来源的价格汇总（用于对比） */
  getAllPriceSummary: () => Array<{
    source: InternalMetalSource;
    label: string;
    copper: number;
    aluminum: number;
    timestamp: string;
    isStale: boolean;
  }>;

  /** 重置 */
  reset: () => void;
}

const SOURCE_LABELS: Record<InternalMetalSource, string> = {
  benchmark: '财务发布基准价',
  shfe_spot: 'SHFE 现货价',
  smm_spot: 'SMM 现货价',
};

const defaultEntry = (note?: string): MetalPriceEntry => ({
  copper: 65000,
  aluminum: 18000,
  timestamp: new Date().toISOString(),
  note,
});

const initialState = {
  activeSource: 'benchmark' as InternalMetalSource,
  prices: {
    benchmark: defaultEntry('默认财务基准价'),
    shfe_spot: defaultEntry('待手动录入'),
    smm_spot: defaultEntry('待手动录入'),
  },
  stalenessThresholdHours: 24,
  isLoading: false,
  error: null as string | null,
};

function hoursAgo(isoString: string): number {
  return (Date.now() - new Date(isoString).getTime()) / (1000 * 60 * 60);
}

export const useInternalMetalStore = create<InternalMetalState>()(
  devtools(
    persist(
      (set, get) => ({
        ...initialState,

        setActiveSource: (source) => set({ activeSource: source }),

        updatePrice: async (source, copper, aluminum, note) => {
          const entry: MetalPriceEntry = {
            copper,
            aluminum,
            timestamp: new Date().toISOString(),
            note,
          };

          set((state) => ({
            prices: { ...state.prices, [source]: entry },
            error: null,
          }));

          // 写入 metalPriceHistory 表持久化
          try {
            const record: MetalPriceHistoryRecord = {
              id: crypto.randomUUID(),
              source,
              copper,
              aluminum,
              recordedAt: entry.timestamp,
              note,
            };
            await db.metalPriceHistory.add(record);
          } catch (err) {
            console.warn('[internalMetalStore] 写入历史记录失败:', err);
          }
        },

        setStalenessThreshold: (hours) => set({ stalenessThresholdHours: hours }),

        getActivePrice: () => {
          const { activeSource, prices } = get();
          return prices[activeSource];
        },

        isStale: (source?) => {
          const { activeSource, prices, stalenessThresholdHours } = get();
          const target = source || activeSource;
          const entry = prices[target];
          if (!entry?.timestamp) return true;
          return hoursAgo(entry.timestamp) > stalenessThresholdHours;
        },

        getStalenessLabel: (source?) => {
          const { activeSource, prices, stalenessThresholdHours } = get();
          const target = source || activeSource;
          const entry = prices[target];
          if (!entry?.timestamp) return '未录入';

          const hours = hoursAgo(entry.timestamp);
          if (hours > stalenessThresholdHours) {
            const days = Math.floor(hours / 24);
            if (days > 0) return `${days}天前更新（已过期）`;
            return `${Math.floor(hours)}小时前更新（已过期）`;
          }
          if (hours < 1) return '刚刚更新';
          return `${Math.floor(hours)}小时前更新`;
        },

        getAllPriceSummary: () => {
          const { prices, stalenessThresholdHours } = get();
          return (['benchmark', 'shfe_spot', 'smm_spot'] as InternalMetalSource[]).map(
            (source) => {
              const entry = prices[source];
              return {
                source,
                label: SOURCE_LABELS[source],
                copper: entry.copper,
                aluminum: entry.aluminum,
                timestamp: entry.timestamp,
                isStale: hoursAgo(entry.timestamp) > stalenessThresholdHours,
              };
            }
          );
        },

        reset: () => set({ ...initialState }),
      }),
      {
        name: 'internal-metal-store',
        partialize: (state) => ({
          activeSource: state.activeSource,
          prices: state.prices,
          stalenessThresholdHours: state.stalenessThresholdHours,
        }),
      }
    ),
    { name: 'internal-metal-store' }
  )
);

export { SOURCE_LABELS };
