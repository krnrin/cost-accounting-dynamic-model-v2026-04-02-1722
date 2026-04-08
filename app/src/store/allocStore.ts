/**
 * 一次性费用分摊 Zustand Store
 * 管理一次性费用录入、分摊计算、回收跟踪
 */
import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { db } from '@/data/db';
import type { OnetimeCostRecord, AllocTrackerRecord } from '@/data/db';
import {
  computeProjectAlloc,
  computeProjectRecovery,
  type OnetimeCostInput,
  type ProjectAllocSummary,
  type ProjectRecoverySummary,
} from '@/engine/onetime_alloc';

interface AllocState {
  /** 当前场景的一次性费用记录 */
  costRecords: OnetimeCostRecord[];
  /** 当前场景的分摊计算汇总 */
  allocSummary: ProjectAllocSummary | null;
  /** 当前场景的回收进度汇总 */
  recoverySummary: ProjectRecoverySummary | null;
  /** 加载中标志 */
  loading: boolean;

  // ─── Actions ───
  /** @deprecated 使用 loadScenarioAlloc 替代 */
  loadProjectAlloc: (projectId: string) => Promise<void>;
  /** 加载场景的一次性费用数据 */
  loadScenarioAlloc: (scenarioId: string) => Promise<void>;
  /** 保存/更新单条线束的一次性费用 */
  saveOnetimeCost: (projectId: string, input: OnetimeCostInput, scenarioId?: string) => Promise<void>;
  /** 批量保存一次性费用 */
  batchSaveOnetimeCosts: (projectId: string, inputs: OnetimeCostInput[], scenarioId?: string) => Promise<void>;
  /** 删除单条线束的一次性费用 */
  deleteOnetimeCost: (projectId: string, harnessId: string, scenarioId?: string) => Promise<void>;
  /** 更新回收跟踪（已生产数量） */
  updateCumProduced: (projectId: string, harnessId: string, cumProduced: number, scenarioId?: string) => Promise<void>;
  /** 重新计算分摊汇总 */
  recompute: (annualCapacity: number) => void;
  /** 清空状态 */
  clear: () => void;
}

export const useAllocStore = create<AllocState>()(
  devtools(
    (set, get) => ({
      costRecords: [],
      allocSummary: null,
      recoverySummary: null,
      loading: false,

      loadProjectAlloc: async (projectId: string) => {
        // 兼容旧调用：尝试找到该项目的基准场景，委托给 loadScenarioAlloc
        const scenarios = await db.scenarios
          .where('projectId').equals(projectId).toArray();
        const baseline = scenarios.find(s => s.isBaseline) || scenarios[0];
        if (baseline) {
          await get().loadScenarioAlloc(baseline.id);
        } else {
          // 降级：直接按 projectId 查（迁移前数据）
          set({ loading: true });
          try {
            const costRecords = await db.onetimeCosts
              .where('projectId').equals(projectId).toArray();
            const inputs = costRecords.map(r => r.input);
            const allocSummary = inputs.length > 0 ? computeProjectAlloc(inputs) : null;
            const trackerRecords = await db.allocTrackers
              .where('projectId').equals(projectId).toArray();
            const cumProducedMap: Record<string, number> = {};
            for (const t of trackerRecords) cumProducedMap[t.harnessId] = t.cumProduced;
            const project = await db.projects.get(projectId);
            const annualCapacity = (project?.meta as any)?.annualCapacity || 100000;
            const lifecycleYears = project?.meta?.lifecycleYears || undefined;
            let recoverySummary: ProjectRecoverySummary | null = null;
            if (allocSummary) {
              recoverySummary = computeProjectRecovery(allocSummary.allocations, cumProducedMap, annualCapacity, lifecycleYears);
            }
            set({ costRecords, allocSummary, recoverySummary, loading: false });
          } catch (err) {
            console.error('Failed to load alloc data:', err);
            set({ loading: false });
          }
        }
      },

      loadScenarioAlloc: async (scenarioId: string) => {
        set({ loading: true });
        try {
          const costRecords = await db.onetimeCosts
            .where('scenarioId').equals(scenarioId).toArray();
          const inputs = costRecords.map(r => r.input);
          const allocSummary = inputs.length > 0 ? computeProjectAlloc(inputs) : null;

          const trackerRecords = await db.allocTrackers
            .where('scenarioId').equals(scenarioId).toArray();
          const cumProducedMap: Record<string, number> = {};
          for (const t of trackerRecords) cumProducedMap[t.harnessId] = t.cumProduced;

          const scenario = await db.scenarios.get(scenarioId);
          const annualCapacity = (scenario?.config as any)?.annualCapacity || 100000;
          const lifecycleYears = scenario?.lifecycleYears || undefined;

          let recoverySummary: ProjectRecoverySummary | null = null;
          if (allocSummary) {
            recoverySummary = computeProjectRecovery(allocSummary.allocations, cumProducedMap, annualCapacity, lifecycleYears);
          }
          set({ costRecords, allocSummary, recoverySummary, loading: false });
        } catch (err) {
          console.error('Failed to load scenario alloc data:', err);
          set({ loading: false });
        }
      },

      saveOnetimeCost: async (projectId: string, input: OnetimeCostInput, scenarioId?: string) => {
        const now = new Date().toISOString();
        const keyPrefix = scenarioId || projectId;
        const record: OnetimeCostRecord = {
          id: `${keyPrefix}::${input.harnessId}`,
          projectId,
          scenarioId: scenarioId || '',
          harnessId: input.harnessId,
          harnessName: input.harnessName,
          vehicleRatio: input.vehicleRatio,
          input,
          updatedAt: now,
        };
        await db.onetimeCosts.put(record);
        if (scenarioId) await get().loadScenarioAlloc(scenarioId);
        else await get().loadProjectAlloc(projectId);
      },

      batchSaveOnetimeCosts: async (projectId: string, inputs: OnetimeCostInput[], scenarioId?: string) => {
        const now = new Date().toISOString();
        const keyPrefix = scenarioId || projectId;
        const records: OnetimeCostRecord[] = inputs.map(input => ({
          id: `${keyPrefix}::${input.harnessId}`,
          projectId,
          scenarioId: scenarioId || '',
          harnessId: input.harnessId,
          harnessName: input.harnessName,
          vehicleRatio: input.vehicleRatio,
          input,
          updatedAt: now,
        }));
        await db.onetimeCosts.bulkPut(records);
        if (scenarioId) await get().loadScenarioAlloc(scenarioId);
        else await get().loadProjectAlloc(projectId);
      },

      deleteOnetimeCost: async (projectId: string, harnessId: string, scenarioId?: string) => {
        const keyPrefix = scenarioId || projectId;
        const id = `${keyPrefix}::${harnessId}`;
        await db.onetimeCosts.delete(id);
        if (scenarioId) await get().loadScenarioAlloc(scenarioId);
        else await get().loadProjectAlloc(projectId);
      },

      updateCumProduced: async (projectId: string, harnessId: string, cumProduced: number, scenarioId?: string) => {
        const now = new Date().toISOString();
        const keyPrefix = scenarioId || projectId;
        const record: AllocTrackerRecord = {
          id: `${keyPrefix}::${harnessId}`,
          projectId,
          scenarioId: scenarioId || '',
          harnessId,
          cumProduced,
          inheritedFromScenarioId: null,
          updatedAt: now,
        };
        await db.allocTrackers.put(record);
        if (scenarioId) await get().loadScenarioAlloc(scenarioId);
        else await get().loadProjectAlloc(projectId);
      },

      recompute: (annualCapacity: number) => {
        const { costRecords } = get();
        const inputs = costRecords.map(r => r.input);
        if (inputs.length === 0) {
          set({ allocSummary: null, recoverySummary: null });
          return;
        }
        const allocSummary = computeProjectAlloc(inputs);
        // 同步更新回收进度
        const recoverySummary = computeProjectRecovery(
          allocSummary.allocations,
          {},
          annualCapacity
        );
        set({ allocSummary, recoverySummary });
      },

      clear: () => {
        set({
          costRecords: [],
          allocSummary: null,
          recoverySummary: null,
          loading: false,
        });
      },
    }),
    { name: 'alloc-store' }
  )
);
