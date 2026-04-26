/**
 * B13: 参数快照化 — 设置变更自动留痕
 * 
 * 每次 settingsStore 发生关键配置变更时，自动保存快照到 IndexedDB。
 * 支持查看历史快照、对比差异、回滚。
 */
import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { db } from '@/data/db';
import type { CostRates, MetalPrices, CostStructureSchema, FactoryConfig, AllocationConfig, BomClassificationRule } from '@/types';

/** 快照记录 */
export interface SettingsSnapshot {
  id: string;
  /** 快照时间 */
  timestamp: string;
  /** 触发原因 */
  reason: 'manual' | 'rate_change' | 'metal_change' | 'structure_change' | 'factory_change' | 'allocation_change' | 'rule_change' | 'pre_quote';
  /** 操作用户 (若有认证) */
  userId?: string;
  /** 快照内容 */
  data: {
    costRates: CostRates;
    metalPrices: MetalPrices;
    costStructure?: CostStructureSchema;
    factories?: FactoryConfig[];
    allocationConfig?: AllocationConfig;
    bomClassificationRules?: BomClassificationRule[];
    annualDropRate?: number;
  };
  /** 变更摘要 (自动生成) */
  summary: string;
  /** 关联项目ID (可选) */
  projectId?: string;
  /** 关联场景ID (可选) */
  scenarioId?: string;
}

/** 差异项 */
export interface SnapshotDiff {
  field: string;
  oldValue: unknown;
  newValue: unknown;
  label: string;
  section?: string;  // [PR-065] 用于复合 rowKey
}

interface SettingsSnapshotState {
  snapshots: SettingsSnapshot[];
  isLoading: boolean;

  /** 创建快照 */
  createSnapshot: (params: {
    reason: SettingsSnapshot['reason'];
    data: SettingsSnapshot['data'];
    projectId?: string;
    scenarioId?: string;
    userId?: string;
  }) => Promise<SettingsSnapshot>;

  /** 加载快照历史 */
  loadSnapshots: (opts?: { projectId?: string; limit?: number }) => Promise<void>;

  /** 对比两个快照 */
  compareSnapshots: (snapshotA: SettingsSnapshot, snapshotB: SettingsSnapshot) => SnapshotDiff[];

  /** 恢复快照 */
  getSnapshotById: (id: string) => SettingsSnapshot | undefined;
}

/** 生成变更摘要 */
function generateSummary(reason: SettingsSnapshot['reason'], data: SettingsSnapshot['data']): string {
  const parts: string[] = [];
  switch (reason) {
    case 'rate_change':
      parts.push(`费率变更: 人工${data.costRates.laborRate}元/h, 制造${data.costRates.mfgRate}元/h`);
      break;
    case 'metal_change':
      parts.push(`金属价格变更: 铜${data.metalPrices.copper}元/吨, 铝${data.metalPrices.aluminum}元/吨`);
      break;
    case 'structure_change':
      parts.push(`成本结构变更: ${data.costStructure?.name || '默认'}`);
      break;
    case 'factory_change':
      parts.push(`工厂配置变更: ${data.factories?.length || 0}个工厂`);
      break;
    case 'allocation_change':
      parts.push('分摊配置变更');
      break;
    case 'rule_change':
      parts.push(`BOM分类规则变更: ${data.bomClassificationRules?.length || 0}条规则`);
      break;
    case 'pre_quote':
      parts.push('报价前参数快照');
      break;
    case 'manual':
      parts.push('手动保存快照');
      break;
  }
  return parts.join('; ');
}

/** 对比两个快照的差异 */
function diffSnapshots(a: SettingsSnapshot['data'], b: SettingsSnapshot['data']): SnapshotDiff[] {
  const diffs: SnapshotDiff[] = [];

  // 对比费率
  const rateFields: Array<keyof CostRates> = ['laborRate', 'mfgRate', 'wasteRate', 'mgmtRate', 'profitRate'];
  const rateLabels: Record<string, string> = {
    laborRate: '人工费率', mfgRate: '制造费率', wasteRate: '废品率', mgmtRate: '管理费率', profitRate: '利润率',
  };
  for (const field of rateFields) {
    if (a.costRates[field] !== b.costRates[field]) {
      diffs.push({ field: `costRates.${field}`, oldValue: a.costRates[field], newValue: b.costRates[field], label: rateLabels[field] ?? field });
    }
  }

  // 对比金属价格
  if (a.metalPrices.copper !== b.metalPrices.copper) {
    diffs.push({ field: 'metalPrices.copper', oldValue: a.metalPrices.copper, newValue: b.metalPrices.copper, label: '铜价(元/吨)' });
  }
  if (a.metalPrices.aluminum !== b.metalPrices.aluminum) {
    diffs.push({ field: 'metalPrices.aluminum', oldValue: a.metalPrices.aluminum, newValue: b.metalPrices.aluminum, label: '铝价(元/吨)' });
  }

  // 对比年降率
  if (a.annualDropRate !== b.annualDropRate) {
    diffs.push({ field: 'annualDropRate', oldValue: a.annualDropRate, newValue: b.annualDropRate, label: '年降率' });
  }

  // 对比工厂数量
  if ((a.factories?.length || 0) !== (b.factories?.length || 0)) {
    diffs.push({ field: 'factories.length', oldValue: a.factories?.length || 0, newValue: b.factories?.length || 0, label: '工厂数量' });
  }

  return diffs;
}

export const useSettingsSnapshotStore = create<SettingsSnapshotState>()(
  devtools(
    (set, get) => ({
      snapshots: [],
      isLoading: false,

      createSnapshot: async ({ reason, data, projectId, scenarioId, userId }) => {
        const snapshot: SettingsSnapshot = {
          id: `snap-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          timestamp: new Date().toISOString(),
          reason,
          userId,
          data,
          summary: generateSummary(reason, data),
          projectId,
          scenarioId,
        };

        // 持久化到 IndexedDB
        try {
          await db.table('settingsSnapshots').add(snapshot);
        } catch {
          // 表不存在时降级到内存
          console.warn('settingsSnapshots table not found, storing in memory only');
        }

        set((state) => ({
          snapshots: [snapshot, ...state.snapshots].slice(0, 200), // 最多保留200条
        }));

        return snapshot;
      },

      loadSnapshots: async (opts) => {
        set({ isLoading: true });
        try {
          let query = db.table('settingsSnapshots').orderBy('timestamp').reverse();
          if (opts?.projectId) {
            query = db.table('settingsSnapshots')
              .where('projectId').equals(opts.projectId!) as any;
          }
          const limit = opts?.limit || 100;
          const snapshots = await query.limit(limit).toArray();
          set({ snapshots, isLoading: false });
        } catch {
          set({ isLoading: false });
        }
      },

      compareSnapshots: (snapshotA, snapshotB) => {
        return diffSnapshots(snapshotA.data, snapshotB.data);
      },

      getSnapshotById: (id) => {
        return get().snapshots.find((s) => s.id === id);
      },
    }),
    { name: 'settings-snapshot-store' }
  )
);
