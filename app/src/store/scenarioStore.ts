/**
 * 场景 Zustand Store
 * 缓存当前场景配置 + 线束列表，避免页面重复查 Dexie
 */
import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { db } from '@/data/db';
import type { ScenarioRecord, HarnessRecord } from '@/data/db';

interface ScenarioState {
  scenario: ScenarioRecord | null;
  harnesses: HarnessRecord[];
  loading: boolean;

  loadScenario: (scenarioId: string) => Promise<void>;
  reload: () => Promise<void>;
  clear: () => void;
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
    }),
    { name: 'scenario-store' }
  )
);
