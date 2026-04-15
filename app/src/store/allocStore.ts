import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { db } from '@/data/db';
import type { OnetimeCostRecord } from '@/data/db';
import { getScenarioOnetimeCostFallback } from '@/utils/e281Fallback';
import {
  computeProjectAllocFromItems,
  computeProjectRecovery,
  normalizeOnetimeInputs,
  type OnetimeCostInput,
  type OnetimeCostItem,
  type PaymentMode,
  type ProjectAllocSummary,
  type ProjectRecoverySummary,
} from '@/engine/onetime_alloc';
import {
  bulkSyncScenarioAllocations,
  fetchScenarioAllocations,
  mapAllocationItemsToFeeItems,
  replaceScenarioAllocationFeeItems,
  type ScenarioAllocationFeeItem,
  type ScenarioAllocationFeeItemInput,
  type ScenarioAllocationItem,
  type ScenarioAllocationParticipant,
  type ScenarioAllocationSyncRow,
} from '@/lib/allocationApi';

export interface ScenarioAllocRow extends ScenarioAllocationSyncRow {}

export interface ScenarioFeeItem extends ScenarioAllocationFeeItem {}

export interface ScenarioFeeItemInput extends ScenarioAllocationFeeItemInput {}

interface AllocState {
  costRecords: OnetimeCostRecord[];
  scenarioRows: ScenarioAllocRow[];
  feeItems: ScenarioFeeItem[];
  rawScenarioItems: ScenarioAllocationItem[];
  allocSummary: ProjectAllocSummary | null;
  recoverySummary: ProjectRecoverySummary | null;
  loading: boolean;

  loadProjectAlloc: (projectId: string) => Promise<void>;
  loadScenarioAlloc: (scenarioId: string) => Promise<void>;
  syncScenarioAllocRows: (projectId: string, rows: ScenarioAllocRow[], scenarioId: string) => Promise<void>;
  saveFeeItem: (projectId: string, feeItem: ScenarioFeeItemInput, scenarioId: string) => Promise<void>;
  updateFeeItem: (projectId: string, feeId: string, feeItem: ScenarioFeeItemInput, scenarioId: string) => Promise<void>;
  deleteFeeItem: (projectId: string, feeId: string, scenarioId: string) => Promise<void>;
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
    feeItems: [],
    rawScenarioItems: [],
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
    rndCost: record.input.rndCost ?? 0,
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

function normalizeFeeCategory(feeCategory: ScenarioFeeItem['feeCategory']): OnetimeCostItem['feeCategory'] {
  if (feeCategory === 'testing' || feeCategory === 'rnd') {
    return feeCategory;
  }
  return 'tooling';
}

function toOnetimeCostItems(feeItems: ScenarioFeeItem[]): OnetimeCostItem[] {
  return feeItems.map((feeItem) => ({
    feeId: feeItem.feeId,
    feeName: feeItem.feeName,
    feeCategory: normalizeFeeCategory(feeItem.feeCategory),
    unitPrice: Number(feeItem.unitPrice || 0),
    allocBase: Math.max(1, Number(feeItem.allocBase || 1)),
    paymentMode: feeItem.paymentMode ?? 'amortized',
    participants: feeItem.participants.map((participant) => ({
      harnessId: participant.harnessId,
      harnessName: participant.harnessName,
      vehicleRatio: Number(participant.vehicleRatio || 0),
      quantity: Number(participant.quantity || 0),
    })),
  }));
}

function cloneParticipants(participants: ScenarioAllocationParticipant[]) {
  return participants.map((participant) => ({ ...participant }));
}

function cloneFeeItems(feeItems: ScenarioFeeItem[]) {
  return feeItems.map((feeItem) => ({
    ...feeItem,
    participants: feeItem.participants.map((participant) => ({ ...participant })),
  }));
}

function toFeeItemRows(feeItems: ScenarioFeeItem[]): ScenarioAllocRow[] {
  const rowMap = new Map<string, ScenarioAllocRow>();

  for (const feeItem of feeItems) {
    for (const participant of feeItem.participants) {
      const current = rowMap.get(participant.harnessId) ?? {
        harnessId: participant.harnessId,
        harnessName: participant.harnessName,
        vehicleRatio: Number(participant.vehicleRatio || 0),
        toolingCost: 0,
        testingCost: 0,
        rndCost: 0,
        allocBase: Math.max(1, Number(feeItem.allocBase || 1)),
        paymentMode: feeItem.paymentMode ?? 'amortized',
        cumProduced: Math.max(0, Number(participant.latestCumulativeVolume || 0)),
      };

      const amount = Number(feeItem.unitPrice || 0) * Number(participant.quantity || 0);
      current.harnessName = participant.harnessName || current.harnessName;
      current.vehicleRatio = Number(participant.vehicleRatio || current.vehicleRatio || 0);
      current.allocBase = Math.max(current.allocBase, Number(feeItem.allocBase || current.allocBase || 1));
      current.paymentMode = feeItem.paymentMode ?? current.paymentMode;
      current.cumProduced = Math.max(current.cumProduced, Number(participant.latestCumulativeVolume || 0));

      if (feeItem.feeCategory === 'tooling') {
        current.toolingCost += amount;
      } else if (feeItem.feeCategory === 'testing') {
        current.testingCost += amount;
      } else if (feeItem.feeCategory === 'rnd') {
        current.rndCost += amount;
      }

      rowMap.set(participant.harnessId, current);
    }
  }

  return Array.from(rowMap.values()).sort((a, b) => a.harnessId.localeCompare(b.harnessId));
}

function mergeHarnessIntoFeeItems(
  currentFeeItems: ScenarioFeeItem[],
  input: OnetimeCostInput,
  currentCumProduced = 0,
): ScenarioFeeItem[] {
  const nextFeeItems = cloneFeeItems(currentFeeItems).filter(
    (feeItem) => !feeItem.participants.some((participant) => participant.harnessId === input.harnessId),
  );

  const baseParticipant = {
    harnessId: input.harnessId,
    harnessName: input.harnessName,
    vehicleRatio: input.vehicleRatio,
    latestCumulativeVolume: Math.max(0, Number(currentCumProduced || 0)),
  };

  const definitions = [
    { feeCategory: 'tooling' as const, feeName: '工装费', quantity: Number(input.toolingCost || 0) },
    { feeCategory: 'testing' as const, feeName: '试验费', quantity: Number(input.testingCost || 0) },
    { feeCategory: 'rnd' as const, feeName: '研发费', quantity: Number(input.rndCost || 0) },
  ];

  for (const definition of definitions) {
    if (definition.quantity <= 0) continue;
    nextFeeItems.push({
      feeId: `${input.harnessId}-${definition.feeCategory}`,
      projectId: '',
      scenarioId: '',
      feeName: definition.feeName,
      feeCategory: definition.feeCategory,
      unitPrice: 1,
      allocBase: Math.max(1, Number(input.allocBase || 1)),
      paymentMode: input.paymentMode ?? 'amortized',
      burdenSide: 'customer',
      pricingEffect: 'included_in_price',
      recoveryCompletionBehavior: 'trigger_price_adjust',
      priceAdjustReminder: false,
      targetRecoveryDate: null,
      completedAt: null,
      status: 'allocated',
      sourceVersionId: null,
      participants: [
        {
          ...baseParticipant,
          quantity: definition.quantity,
        },
      ],
    });
  }

  return nextFeeItems;
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

async function buildStateFromRows(
  projectId: string,
  scenarioId: string,
  rows: ScenarioAllocRow[],
  rawScenarioItems: ScenarioAllocationItem[] = [],
  feeItems?: ScenarioFeeItem[],
) {
  const normalizedFeeItems = feeItems ? cloneFeeItems(feeItems) : mapAllocationItemsToFeeItems(rawScenarioItems);
  const itemRows = normalizedFeeItems.length > 0 ? toFeeItemRows(normalizedFeeItems) : rows;
  const inputs = normalizedFeeItems.length > 0
    ? itemRows.map((row) => {
      const feeItemsForHarness = normalizedFeeItems.filter((feeItem) =>
        feeItem.participants.some((participant) => participant.harnessId === row.harnessId && Number(participant.quantity || 0) > 0),
      );
      return {
        harnessId: row.harnessId,
        harnessName: row.harnessName,
        vehicleRatio: row.vehicleRatio,
        toolingCost: Number(row.toolingCost || 0),
        testingCost: Number(row.testingCost || 0),
        rndCost: Number(row.rndCost || 0),
        allocBase: Math.max(1, Number(row.allocBase || 1)),
        paymentMode: row.paymentMode,
        feeItems: toOnetimeCostItems(feeItemsForHarness),
      } satisfies OnetimeCostInput;
    })
    : toOnetimeCostInputs(itemRows);
  const allocSummary = inputs.length > 0
    ? normalizedFeeItems.length > 0
      ? computeProjectAllocFromItems(toOnetimeCostItems(normalizedFeeItems))
      : normalizeOnetimeInputs(inputs)
    : null;
  const scenario = scenarioId ? await db.scenarios.get(scenarioId) : null;
  const project = projectId ? await db.projects.get(projectId) : null;
  const annualCapacity = (scenario?.config as any)?.annualCapacity
    || (scenario?.config as any)?.volumes?.[0]?.volume
    || (project?.config as any)?.volumes?.[0]?.volume
    || 100000;
  const lifecycleYears = scenario?.lifecycleYears || project?.meta?.lifecycleYears || undefined;
  const cumProducedMap = Object.fromEntries(itemRows.map((row) => [row.harnessId, Math.max(0, Number(row.cumProduced || 0))]));
  const recoverySummary = allocSummary
    ? computeProjectRecovery(allocSummary.allocations, cumProducedMap, annualCapacity, lifecycleYears)
    : null;

  return {
    costRecords: toCostRecords(projectId, scenarioId, itemRows),
    scenarioRows: itemRows,
    feeItems: normalizedFeeItems,
    rawScenarioItems,
    allocSummary,
    recoverySummary,
  };
}

async function buildLocalFallbackState(projectId: string, scenarioId: string) {
  const scenario = await db.scenarios.get(scenarioId);
  const rows = buildFallbackRows(scenarioId, scenario);
  const feeItems = rows.flatMap((row) => mergeHarnessIntoFeeItems([], {
    harnessId: row.harnessId,
    harnessName: row.harnessName,
    vehicleRatio: row.vehicleRatio,
    toolingCost: row.toolingCost,
    testingCost: row.testingCost,
    rndCost: row.rndCost,
    allocBase: row.allocBase,
    paymentMode: row.paymentMode,
  }, row.cumProduced));
  return buildStateFromRows(projectId, scenarioId, rows, [], feeItems);
}

async function persistFeeItems(projectId: string, scenarioId: string, feeItems: ScenarioFeeItem[]) {
  const savedFeeItems = await replaceScenarioAllocationFeeItems(scenarioId, {
    projectId,
    feeItems: feeItems.map((feeItem) => ({
      feeId: feeItem.feeId,
      feeName: feeItem.feeName,
      feeCategory: feeItem.feeCategory,
      unitPrice: Number(feeItem.unitPrice || 0),
      allocBase: Math.max(1, Number(feeItem.allocBase || 1)),
      paymentMode: feeItem.paymentMode ?? 'amortized',
      burdenSide: feeItem.burdenSide,
      pricingEffect: feeItem.pricingEffect,
      recoveryCompletionBehavior: feeItem.recoveryCompletionBehavior,
      priceAdjustReminder: Boolean(feeItem.priceAdjustReminder),
      targetRecoveryDate: feeItem.targetRecoveryDate ?? null,
      completedAt: feeItem.completedAt ?? null,
      status: feeItem.status,
      sourceVersionId: feeItem.sourceVersionId ?? null,
      participants: feeItem.participants.map((participant) => ({
        harnessId: participant.harnessId,
        harnessName: participant.harnessName,
        vehicleRatio: Number(participant.vehicleRatio || 0),
        quantity: Number(participant.quantity || 0),
        allocationItemId: participant.allocationItemId,
        latestCumulativeVolume: Math.max(0, Number(participant.latestCumulativeVolume || 0)),
        latestInstallRatioSnapshot: Number(participant.latestInstallRatioSnapshot || 0),
        latestRecoveryPeriod: participant.latestRecoveryPeriod ?? null,
      })),
    })),
  });
  const rawScenarioItems = await fetchScenarioAllocations(scenarioId);
  return buildStateFromRows(projectId, scenarioId, toFeeItemRows(savedFeeItems), rawScenarioItems, savedFeeItems);
}

function updateParticipantCumProduced(
  feeItems: ScenarioFeeItem[],
  harnessId: string,
  cumProduced: number,
): ScenarioFeeItem[] {
  return cloneFeeItems(feeItems).map((feeItem) => ({
    ...feeItem,
    participants: feeItem.participants.map((participant) => (
      participant.harnessId === harnessId
        ? { ...participant, latestCumulativeVolume: Math.max(0, Number(cumProduced || 0)) }
        : participant
    )),
  }));
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
          const feeItems = remoteItems.length > 0 ? mapAllocationItemsToFeeItems(remoteItems) : [];
          const rows = feeItems.length > 0
            ? toFeeItemRows(feeItems)
            : buildFallbackRows(scenarioId, scenario);
          const nextState = await buildStateFromRows(projectId, scenarioId, rows, remoteItems, feeItems);
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

      saveFeeItem: async (projectId: string, feeItem: ScenarioFeeItemInput, scenarioId: string) => {
        set({ loading: true });
        const currentState = get();
        const scenario = await db.scenarios.get(scenarioId);
        const nextFeeItem: ScenarioFeeItem = {
          feeId: feeItem.feeId ?? crypto.randomUUID(),
          projectId,
          scenarioId,
          feeName: feeItem.feeName,
          feeCategory: feeItem.feeCategory,
          unitPrice: Number(feeItem.unitPrice || 0),
          allocBase: Math.max(1, Number(feeItem.allocBase || 1)),
          paymentMode: feeItem.paymentMode ?? 'amortized',
          burdenSide: feeItem.burdenSide ?? 'customer',
          pricingEffect: feeItem.pricingEffect ?? 'included_in_price',
          recoveryCompletionBehavior: feeItem.recoveryCompletionBehavior ?? 'trigger_price_adjust',
          priceAdjustReminder: Boolean(feeItem.priceAdjustReminder),
          targetRecoveryDate: feeItem.targetRecoveryDate ?? null,
          completedAt: feeItem.completedAt ?? null,
          status: feeItem.status ?? 'allocated',
          sourceVersionId: feeItem.sourceVersionId ?? null,
          participants: cloneParticipants(feeItem.participants),
        };
        const feeItems = [...cloneFeeItems(currentState.feeItems), nextFeeItem];
        const nextState = await persistFeeItems(projectId, scenarioId, feeItems);
        set({ ...nextState, loading: false });
        if (!scenario) return;
        const annualCapacity = (scenario.config as any)?.annualCapacity
          || (scenario.config as any)?.volumes?.[0]?.volume
          || 100000;
        get().recompute(annualCapacity);
      },

      updateFeeItem: async (projectId: string, feeId: string, feeItem: ScenarioFeeItemInput, scenarioId: string) => {
        set({ loading: true });
        const currentState = get();
        const scenario = await db.scenarios.get(scenarioId);
        const feeItems = cloneFeeItems(currentState.feeItems).map((current) => (
          current.feeId === feeId
            ? {
              ...current,
              ...feeItem,
              feeId,
              projectId: current.projectId || projectId,
              scenarioId: current.scenarioId || scenarioId,
              unitPrice: Number(feeItem.unitPrice || 0),
              allocBase: Math.max(1, Number(feeItem.allocBase || 1)),
              paymentMode: feeItem.paymentMode ?? current.paymentMode ?? 'amortized',
              burdenSide: feeItem.burdenSide ?? current.burdenSide ?? 'customer',
              pricingEffect: feeItem.pricingEffect ?? current.pricingEffect ?? 'included_in_price',
              recoveryCompletionBehavior: feeItem.recoveryCompletionBehavior ?? current.recoveryCompletionBehavior ?? 'trigger_price_adjust',
              priceAdjustReminder: feeItem.priceAdjustReminder ?? current.priceAdjustReminder ?? false,
              targetRecoveryDate: feeItem.targetRecoveryDate ?? current.targetRecoveryDate ?? null,
              completedAt: feeItem.completedAt ?? current.completedAt ?? null,
              status: feeItem.status ?? current.status ?? 'allocated',
              sourceVersionId: feeItem.sourceVersionId ?? current.sourceVersionId ?? null,
              participants: cloneParticipants(feeItem.participants),
            }
            : current
        ));
        const nextState = await persistFeeItems(projectId, scenarioId, feeItems);
        set({ ...nextState, loading: false });
        if (!scenario) return;
        const annualCapacity = (scenario.config as any)?.annualCapacity
          || (scenario.config as any)?.volumes?.[0]?.volume
          || 100000;
        get().recompute(annualCapacity);
      },

      deleteFeeItem: async (projectId: string, feeId: string, scenarioId: string) => {
        set({ loading: true });
        const scenario = await db.scenarios.get(scenarioId);
        const feeItems = cloneFeeItems(get().feeItems).filter((feeItem) => feeItem.feeId !== feeId);
        const nextState = await persistFeeItems(projectId, scenarioId, feeItems);
        set({ ...nextState, loading: false });
        if (!scenario) return;
        const annualCapacity = (scenario.config as any)?.annualCapacity
          || (scenario.config as any)?.volumes?.[0]?.volume
          || 100000;
        get().recompute(annualCapacity);
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
        const nextState = await buildStateFromRows(projectId, scenarioId, nextRows, remoteItems);
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
          rndCost: input.rndCost ?? 0,
          allocBase: input.allocBase,
          paymentMode: input.paymentMode ?? current?.paymentMode ?? 'amortized',
          cumProduced: current?.cumProduced ?? 0,
        });

        if (scenarioId) {
          const feeItems = mergeHarnessIntoFeeItems(get().feeItems, input, current?.cumProduced ?? 0);
          const nextState = await persistFeeItems(projectId, scenarioId, feeItems);
          set({ ...nextState, loading: false });
          return;
        }

        const nextState = await buildStateFromRows(projectId, '', Array.from(rowMap.values()));
        set({ ...nextState, loading: false });
      },

      batchSaveOnetimeCosts: async (projectId: string, inputs: OnetimeCostInput[], scenarioId?: string) => {
        const currentRows = new Map(get().scenarioRows.map((row) => [row.harnessId, row]));
        let feeItems = cloneFeeItems(get().feeItems);
        for (const input of inputs) {
          const current = currentRows.get(input.harnessId);
          currentRows.set(input.harnessId, {
            harnessId: input.harnessId,
            harnessName: input.harnessName,
            vehicleRatio: input.vehicleRatio,
            toolingCost: input.toolingCost,
            testingCost: input.testingCost,
            rndCost: input.rndCost ?? 0,
            allocBase: input.allocBase,
            paymentMode: input.paymentMode ?? current?.paymentMode ?? 'amortized',
            cumProduced: current?.cumProduced ?? 0,
          });
          feeItems = mergeHarnessIntoFeeItems(feeItems, input, current?.cumProduced ?? 0);
        }

        const rows = Array.from(currentRows.values());
        if (scenarioId) {
          const nextState = await persistFeeItems(projectId, scenarioId, feeItems);
          set({ ...nextState, loading: false });
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
          const feeItems = cloneFeeItems(get().feeItems).filter(
            (feeItem) => !feeItem.participants.some((participant) => participant.harnessId === harnessId),
          );
          const nextState = await persistFeeItems(projectId, scenarioId, feeItems);
          set({ ...nextState, loading: false });
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
          const feeItems = updateParticipantCumProduced(get().feeItems, harnessId, cumProduced);
          const nextState = await persistFeeItems(projectId, scenarioId, feeItems);
          set({ ...nextState, loading: false });
          return;
        }

        const nextState = await buildStateFromRows(projectId, '', rows);
        set({ ...nextState, loading: false });
      },

      recompute: (annualCapacity: number) => {
        const rows = get().scenarioRows;
        const feeItems = get().feeItems;
        const inputs = feeItems.length > 0 ? [] : toOnetimeCostInputs(rows);
        if (rows.length === 0 && feeItems.length === 0) {
          set({ allocSummary: null, recoverySummary: null });
          return;
        }
        const allocSummary = feeItems.length > 0
          ? computeProjectAllocFromItems(toOnetimeCostItems(feeItems))
          : normalizeOnetimeInputs(inputs);
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
