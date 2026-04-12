/**
 * 场景 Zustand Store
 * 缓存当前场景配置 + 线束列表，避免页面重复查 Dexie
 * 集成 B1 场景生命周期状态管理
 */
import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { db } from '@/data/db';
import type { ScenarioRecord, HarnessRecord } from '@/data/db';
import {
  type ScenarioStatus,
  isEditable,
  getAvailableTransitions,
  transitionScenario,
  getStatusColor,
  getStatusIcon,
} from '@/engine/scenario_lifecycle';

interface ScenarioState {
  scenario: ScenarioRecord | null;
  harnesses: HarnessRecord[];
  loading: boolean;

  loadScenario: (scenarioId: string) => Promise<void>;
  reload: () => Promise<void>;
  clear: () => void;

  // B1 lifecycle methods
  /** 获取当前场景状态 */
  getScenarioStatus: () => ScenarioStatus;
  /** 当前场景是否可编辑 */
  canEdit: () => boolean;
  /** 执行状态转换 */
  transition: (targetStatus: ScenarioStatus, options?: { userId?: string; note?: string }) => Promise<void>;
  /** 获取可用的状态转换 */
  getAvailableActions: () => ReturnType<typeof getAvailableTransitions>;
  /** 获取状态颜色 */
  getStatusColor: () => string;
  /** 获取状态图标 */
  getStatusIcon: () => string;
}

export const useScenarioStore = create<ScenarioState>()(
  devtools(
    (set, get) => ({
      scenario: null,
      harnesses: [],
      loading: false,

      loadScenario: async (scenarioId: string) => {
        set({ loading: true });
        try {
          const scenario = await db.scenarios.get(scenarioId);
          const harnesses = scenario
            ? await db.harnesses.where('scenarioId').equals(scenarioId).toArray()
            : [];
          set({ scenario: scenario ?? null, harnesses, loading: false });
        } catch (err) {
          console.error('Failed to load scenario:', err);
          set({ loading: false });
        }
      },

      reload: async () => {
        const { scenario } = get();
        if (scenario?.id) {
          await get().loadScenario(scenario.id);
        }
      },

      clear: () => {
        set({ scenario: null, harnesses: [], loading: false });
      },

      // B1 lifecycle
      getScenarioStatus: () => {
        const { scenario } = get();
        return (scenario as any)?.status as ScenarioStatus || 'draft';
      },

      canEdit: () => {
        return isEditable(get().getScenarioStatus());
      },

      transition: async (targetStatus, options) => {
        const { scenario } = get();
        if (!scenario) throw new Error('No scenario loaded');
        await transitionScenario(scenario.id, targetStatus, options);
        await get().reload();
      },

      getAvailableActions: () => {
        return getAvailableTransitions(get().getScenarioStatus());
      },

      getStatusColor: () => {
        return getStatusColor(get().getScenarioStatus());
      },

      getStatusIcon: () => {
        return getStatusIcon(get().getScenarioStatus());
      },
    }),
    { name: 'scenario-store' }
  )
);
