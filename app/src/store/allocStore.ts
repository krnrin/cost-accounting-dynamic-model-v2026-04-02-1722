import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { db } from '@/data/db';
import type { OnetimeCostRecord } from '@/data/db';
import { getScenarioOnetimeCostFallback } from '@/utils/e281Fallback';
import {
  computeProjectAlloc,
  computeProjectRecovery,
  type OnetimeCostInput,
  type PaymentMode,
  type ProjectAllocSummary,
  type ProjectRecoverySummary,
} from '@/engine/onetime_alloc';
import {
  bulkSyncScenarioAllocations,
  fetchScenarioAllocations,
  type ScenarioAllocationItem,
  type ScenarioAllocationSyncRow,
} from '@/lib/allocationApi';

export interface ScenarioAllocRow extends ScenarioAllocationSyncRow {}

interface AllocState {
  costRecords: OnetimeCostRecord[];
  scenarioRows: ScenarioAllocRow[];
  allocSummary: ProjectAllocSummary | null;
  recoverySummary: ProjectRecoverySummary | null;
  loading: boolean;

  loadProjectAlloc: (projectId: string) => Promise<void>;
  loadScenarioAlloc: (scenarioId: string) => Promise<void>;
  syncScenarioAllocRows: (projectId: string, rows: ScenarioAllocRow[], scenarioId: string) => Promise<void>;
  saveOnetimeCost: (projectId: string, input: OnetimeCostInput, scenarioId?: string) => Promise<void>;
  batchSaveOnetimeCosts: (projectId: string, inputs: OnetimeCostInput[], scenarioId?: string) => Promise<void>;
  deleteOnetimeCost: (projectId: string, harnessId: string, scenarioId?: string) => Promise<void>;
  updateCumProduced: (projectId: string, harnessId: string, cumProduced: number, scenarioId?: string) => Promise<void>;
  recompute: (annualCapacity: number) => void;
  clear: () => void;
}

function normalizePaymentMode(value?: string | null): PaymentMode {
  if (value === 'lumpsum' || value === 'mixed') {
    return value;
  }
  return 'amortized';
}

function createEmptySummary() {
  return {
    costRecords: [],
    scenarioRows: [],
    allocSummary: null,
    recoverySummary: null,
  };
}

function buildFallbackRows(_scenarioId: string, scenario: any): ScenarioAllocRow[] {
  return getScenarioOnetimeCostFallback(scenario).map((record) => ({
    harnessId: record.harnessId,
    harnessName: record.harnessName,
    vehicleRatio: record.vehicleRatio,
    toolingCost: record.input.toolingCost,
    testingCost: record.input.testingCost,
    rndCost: record.input.rndCost,
    allocBase: record.input.allocBase,
    paymentMode: record.input.paymentMode ?? 'amortized',
    cumProduced: 0,
  }));
}

function aggregateScenarioRows(items: ScenarioAllocationItem[]): ScenarioAllocRow[] {
  const rowMap = new Map<string, ScenarioAllocRow>();

  for (const item of items) {
    const current = rowMap.get(item.harnessId) ?? {
      harnessId: item.harnessId,
      harnessName: item.harnessId,
      vehicleRatio: Number(item.latestInstallRatioSnapshot || 1) || 1,
      toolingCost: 0,
      testingCost: 0,
      rndCost: 0,
      allocBase: Math.max(1, Number(item.baselineVolume || 50000)),
      paymentMode: normalizePaymentMode(item.allocationBasis),
      cumProduced: Math.max(0, Number(item.latestCumulativeVolume || 0)),
    };

    current.allocBase = Math.max(current.allocBase, Number(item.baselineVolume || current.allocBase));
    current.paymentMode = normalizePaymentMode(item.allocationBasis) || current.paymentMode;
    current.vehicleRatio = Number(item.latestInstallRatioSnapshot || current.vehicleRatio || 1) || 1;
    current.cumProduced = Math.max(current.cumProduced, Number(item.latestCumulativeVolume || 0));

    if (item.expenseType === 'tooling') {
      current.toolingCost += Number(item.totalAmount || 0);
    } else if (item.expenseType === 'testing') {
      current.testingCost += Number(item.totalAmount || 0);
    } else if (item.expenseType === 'rnd') {
      current.rndCost += Number(item.totalAmount || 0);
    }

    rowMap.set(item.harnessId, current);
  }

  return Array.from(rowMap.values()).sort((a, b) => a.harnessId.localeCompare(b.harnessId));
}

function toOnetimeCostInputs(rows: ScenarioAllocRow[]): OnetimeCostInput[] {
  return rows.map((row) => ({
    harnessId: row.harnessId,
    harnessName: row.harnessName,
    vehicleRatio: row.vehicleRatio,
    toolingCost: Number(row.toolingCost || 0),
    testingCost: Number(row.testingCost || 0),
    rndCost: Number(row.rndCost || 0),
    allocBase: Math.max(1, Number(row.allocBase || 1)),
    paymentMode: row.paymentMode,
  }));
}

function toCostRecords(projectId: string, scenarioId: string, rows: ScenarioAllocRow[]): OnetimeCostRecord[] {
  const now = new Date().toISOString();
  return rows.map((row) => ({
    id: `${scenarioId || projectId}::${row.harnessId}`,
    projectId,
    scenarioId,
    harnessId: row.harnessId,
    harnessName: row.harnessName,
    vehicleRatio: row.vehicleRatio,
    input: {
      harnessId: row.harnessId,
      harnessName: row.harnessName,
      vehicleRatio: row.vehicleRatio,
      toolingCost: row.toolingCost,
      testingCost: row.testingCost,
      rndCost: row.rndCost,
      allocBase: row.allocBase,
      paymentMode: row.paymentMode,
    },
    updatedAt: now,
  }));
}

async function buildStateFromRows(projectId: string, scenarioId: string, rows: ScenarioAllocRow[]) {
  const inputs = toOnetimeCostInputs(rows);
  const allocSummary = inputs.length > 0 ? computeProjectAlloc(inputs) : null;
  const scenario = scenarioId ? await db.scenarios.get(scenarioId) : null;
  const project = projectId ? await db.projects.get(projectId) : null;
  const annualCapacity = (scenario?.config as any)?.annualCapacity
    || (scenario?.config as any)?.volumes?.[0]?.volume
    || (project?.config as any)?.volumes?.[0]?.volume
    || 100000;
  const lifecycleYears = scenario?.lifecycleYears || project?.meta?.lifecycleYears || undefined;
  const cumProducedMap = Object.fromEntries(rows.map((row) => [row.harnessId, Math.max(0, Number(row.cumProduced || 0))]));
  const recoverySummary = allocSummary
    ? computeProjectRecovery(allocSummary.allocations, cumProducedMap, annualCapacity, lifecycleYears)
    : null;

  return {
    costRecords: toCostRecords(projectId, scenarioId, rows),
    scenarioRows: rows,
    allocSummary,
    recoverySummary,
  };
}

async function buildLocalFallbackState(projectId: string, scenarioId: string) {
  const scenario = await db.scenarios.get(scenarioId);
  const rows = buildFallbackRows(scenarioId, scenario);
  return buildStateFromRows(projectId, scenarioId, rows);
}

export const useAllocStore = create<AllocState>()(
  devtools(
    (set, get) => ({
      ...createEmptySummary(),
      loading: false,

      loadProjectAlloc: async (projectId: string) => {
        const scenarios = await db.scenarios.where('projectId').equals(projectId).toArray();
        const baseline = scenarios.find((scenario) => scenario.isBaseline) || scenarios[0];
        if (baseline) {
          await get().loadScenarioAlloc(baseline.id);
          return;
        }
        set({ ...createEmptySummary(), loading: false });
      },

      loadScenarioAlloc: async (scenarioId: string) => {
        set({ loading: true });
        try {
          const remoteItems = await fetchScenarioAllocations(scenarioId);
          const scenario = await db.scenarios.get(scenarioId);
          const projectId = remoteItems[0]?.projectId || scenario?.projectId || '';
          const rows = remoteItems.length > 0
            ? aggregateScenarioRows(remoteItems)
            : buildFallbackRows(scenarioId, scenario);
          const nextState = await buildStateFromRows(projectId, scenarioId, rows);
          set({ ...nextState, loading: false });
        } catch (error) {
          console.error('Failed to load scenario allocation from server:', error);
          try {
            const scenario = await db.scenarios.get(scenarioId);
            const projectId = scenario?.projectId || '';
            const fallbackState = await buildLocalFallbackState(projectId, scenarioId);
            set({ ...fallbackState, loading: false });
          } catch (fallbackError) {
            console.error('Failed to build local allocation fallback:', fallbackError);
            set({ ...createEmptySummary(), loading: false });
          }
        }
      },

      syncScenarioAllocRows: async (projectId: string, rows: ScenarioAllocRow[], scenarioId: string) => {
        set({ loading: true });
        const payloadRows = rows.map((row) => ({
          harnessId: row.harnessId,
          harnessName: row.harnessName,
          vehicleRatio: Number(row.vehicleRatio || 0),
          toolingCost: Number(row.toolingCost || 0),
          testingCost: Number(row.testingCost || 0),
          rndCost: Number(row.rndCost || 0),
          allocBase: Math.max(1, Number(row.allocBase || 1)),
          paymentMode: row.paymentMode ?? 'amortized',
          cumProduced: Math.max(0, Number(row.cumProduced || 0)),
        }));

        const remoteItems = await bulkSyncScenarioAllocations(scenarioId, {
          projectId,
          rows: payloadRows,
        });
        const nextRows = remoteItems.length > 0 ? aggregateScenarioRows(remoteItems) : payloadRows;
        const nextState = await buildStateFromRows(projectId, scenarioId, nextRows);
        set({ ...nextState, loading: false });
      },

      saveOnetimeCost: async (projectId: string, input: OnetimeCostInput, scenarioId?: string) => {
        const currentRows = get().scenarioRows;
        const rowMap = new Map(currentRows.map((row) => [row.harnessId, row]));
        const current = rowMap.get(input.harnessId);
        rowMap.set(input.harnessId, {
          harnessId: input.harnessId,
          harnessName: input.harnessName,
          vehicleRatio: input.vehicleRatio,
          toolingCost: input.toolingCost,
          testingCost: input.testingCost,
          rndCost: input.rndCost,
          allocBase: input.allocBase,
          paymentMode: input.paymentMode ?? current?.paymentMode ?? 'amortized',
          cumProduced: current?.cumProduced ?? 0,
        });

        if (scenarioId) {
          await get().syncScenarioAllocRows(projectId, Array.from(rowMap.values()), scenarioId);
          return;
        }

        const nextState = await buildStateFromRows(projectId, '', Array.from(rowMap.values()));
        set({ ...nextState, loading: false });
      },

      batchSaveOnetimeCosts: async (projectId: string, inputs: OnetimeCostInput[], scenarioId?: string) => {
        const currentRows = new Map(get().scenarioRows.map((row) => [row.harnessId, row]));
        for (const input of inputs) {
          const current = currentRows.get(input.harnessId);
          currentRows.set(input.harnessId, {
            harnessId: input.harnessId,
            harnessName: input.harnessName,
            vehicleRatio: input.vehicleRatio,
            toolingCost: input.toolingCost,
            testingCost: input.testingCost,
            rndCost: input.rndCost,
            allocBase: input.allocBase,
            paymentMode: input.paymentMode ?? current?.paymentMode ?? 'amortized',
            cumProduced: current?.cumProduced ?? 0,
          });
        }

        const rows = Array.from(currentRows.values());
        if (scenarioId) {
          await get().syncScenarioAllocRows(projectId, rows, scenarioId);
          return;
        }

        const nextState = await buildStateFromRows(projectId, '', rows);
        set({ ...nextState, loading: false });
      },

      deleteOnetimeCost: async (projectId: string, harnessId: string, scenarioId?: string) => {
        const rows = get().scenarioRows
          .filter((row) => row.harnessId !== harnessId)
          .map((row) => ({ ...row }));

        if (scenarioId) {
          await get().syncScenarioAllocRows(projectId, rows, scenarioId);
          return;
        }

        const nextState = await buildStateFromRows(projectId, '', rows);
        set({ ...nextState, loading: false });
      },

      updateCumProduced: async (projectId: string, harnessId: string, cumProduced: number, scenarioId?: string) => {
        const rows = get().scenarioRows.map((row) => (
          row.harnessId === harnessId ? { ...row, cumProduced } : row
        ));

        if (scenarioId) {
          await get().syncScenarioAllocRows(projectId, rows, scenarioId);
          return;
        }

        const nextState = await buildStateFromRows(projectId, '', rows);
        set({ ...nextState, loading: false });
      },

      recompute: (annualCapacity: number) => {
        const rows = get().scenarioRows;
        const inputs = toOnetimeCostInputs(rows);
        if (inputs.length === 0) {
          set({ allocSummary: null, recoverySummary: null });
          return;
        }
        const allocSummary = computeProjectAlloc(inputs);
        const cumProducedMap = Object.fromEntries(rows.map((row) => [row.harnessId, Math.max(0, Number(row.cumProduced || 0))]));
        const recoverySummary = computeProjectRecovery(allocSummary.allocations, cumProducedMap, annualCapacity);
        set({ allocSummary, recoverySummary });
      },

      clear: () => {
        set({
          ...createEmptySummary(),
          loading: false,
        });
      },
    }),
    { name: 'alloc-store' },
  ),
);
