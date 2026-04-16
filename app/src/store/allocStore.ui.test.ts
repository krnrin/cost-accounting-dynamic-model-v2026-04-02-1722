import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useAllocStore } from './allocStore';
import { db } from '@/data/db';
import type { ScenarioAllocationItem } from '@/lib/allocationApi';

vi.mock('@/lib/allocationApi', async () => {
  const actual = await vi.importActual<typeof import('@/lib/allocationApi')>('@/lib/allocationApi');
  return {
    ...actual,
    fetchScenarioAllocations: vi.fn(),
    bulkSyncScenarioAllocations: vi.fn(),
    replaceScenarioAllocationFeeItems: vi.fn(),
  };
});

const allocationApi = await import('@/lib/allocationApi');
const fetchScenarioAllocations = vi.mocked(allocationApi.fetchScenarioAllocations);
const replaceScenarioAllocationFeeItems = vi.mocked(allocationApi.replaceScenarioAllocationFeeItems);

const baseItem = (overrides: Partial<ScenarioAllocationItem> = {}): ScenarioAllocationItem => ({
  id: overrides.id ?? 'alloc-1',
  projectId: overrides.projectId ?? 'project-1',
  scenarioId: overrides.scenarioId ?? 'scenario-1',
  harnessId: overrides.harnessId ?? 'H001',
  expenseType: overrides.expenseType ?? 'tooling',
  expenseName: overrides.expenseName ?? '工装电脑',
  totalAmount: overrides.totalAmount ?? 8000,
  allocationBasis: overrides.allocationBasis ?? 'amortized',
  baselineVolume: overrides.baselineVolume ?? 50000,
  unitAllocation: overrides.unitAllocation ?? 2000,
  plannedRecovery: overrides.plannedRecovery ?? 8000,
  actualRecovered: overrides.actualRecovered ?? 0,
  remainingRecovery: overrides.remainingRecovery ?? 8000,
  recoveryProgress: overrides.recoveryProgress ?? 0,
  burdenSide: overrides.burdenSide ?? 'customer',
  pricingEffect: overrides.pricingEffect ?? 'included_in_price',
  recoveryCompletionBehavior: overrides.recoveryCompletionBehavior ?? 'trigger_price_adjust',
  priceAdjustReminder: overrides.priceAdjustReminder ?? false,
  targetRecoveryDate: overrides.targetRecoveryDate ?? null,
  completedAt: overrides.completedAt ?? null,
  status: overrides.status ?? 'allocated',
  sourceVersionId: overrides.sourceVersionId ?? null,
  latestCumulativeVolume: overrides.latestCumulativeVolume ?? 0,
  latestInstallRatioSnapshot: overrides.latestInstallRatioSnapshot ?? 1,
  latestRecoveryPeriod: overrides.latestRecoveryPeriod ?? null,
  createdAt: overrides.createdAt ?? '2026-04-16T06:00:00.000Z',
  updatedAt: overrides.updatedAt ?? '2026-04-16T06:00:00.000Z',
});

describe('allocStore matrix-first state', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    useAllocStore.getState().clear();
    await db.delete();
    await db.open();
    await db.projects.put({
      id: 'project-1',
      meta: {
        projectCode: 'P1',
        customer: 'Geely',
        productFamily: 'E281',
        lifecycleYears: 5,
        status: 'active',
        createdAt: '2026-04-16T06:00:00.000Z',
        updatedAt: '2026-04-16T06:00:00.000Z',
      },
      config: {
        volumes: [{ year: 1, volume: 120000 }],
        annualCapacity: 120000,
      },
      createdAt: '2026-04-16T06:00:00.000Z',
      updatedAt: '2026-04-16T06:00:00.000Z',
    } as any);
    await db.scenarios.put({
      id: 'scenario-1',
      projectId: 'project-1',
      scenarioCode: 'SCN-001',
      scenarioName: 'Baseline',
      scenarioType: 'initial_quote',
      parentScenarioId: null,
      isBaseline: true,
      lifecycleYears: 5,
      config: {
        volumes: [{ year: 1, volume: 120000 }],
        annualCapacity: 120000,
      },
      note: '',
      createdAt: '2026-04-16T06:00:00.000Z',
      updatedAt: '2026-04-16T06:00:00.000Z',
    });
  });

  it('loads matrix fee items and computes summaries from them', async () => {
    fetchScenarioAllocations.mockResolvedValue([
      baseItem(),
      baseItem({
        id: 'alloc-2',
        harnessId: 'H002',
        totalAmount: 4000,
        latestInstallRatioSnapshot: 0.5,
      }),
      baseItem({
        id: 'alloc-3',
        expenseType: 'testing',
        expenseName: 'DV 试验',
        harnessId: 'H001',
        totalAmount: 10000,
        unitAllocation: 10000,
      }),
    ]);

    const { result } = renderHook(() => useAllocStore());
    await act(async () => {
      await result.current.loadScenarioAlloc('scenario-1');
    });

    expect(result.current.feeItems).toHaveLength(2);
    expect(result.current.feeItems[0].participants).toHaveLength(2);
    expect(result.current.scenarioRows).toHaveLength(2);
    expect(result.current.scenarioRows.find((row) => row.harnessId === 'H001')?.toolingCost).toBe(8000);
    expect(result.current.allocSummary?.grandTotal).toBe(22000);
    expect(result.current.recoverySummary?.trackers).toHaveLength(2);
  });

  it('saves updates and deletes fee items through matrix actions', async () => {
    const savedStateItems = [
      {
        feeId: 'fee-1',
        projectId: 'project-1',
        scenarioId: 'scenario-1',
        feeName: '工装电脑',
        feeCategory: 'tooling',
        unitPrice: 2000,
        allocBase: 50000,
        paymentMode: 'amortized',
        burdenSide: 'customer',
        pricingEffect: 'included_in_price',
        recoveryCompletionBehavior: 'trigger_price_adjust',
        priceAdjustReminder: false,
        targetRecoveryDate: null,
        completedAt: null,
        status: 'allocated',
        sourceVersionId: null,
        participants: [
          { harnessId: 'H001', harnessName: 'A线束', vehicleRatio: 1, quantity: 2, latestCumulativeVolume: 0 },
        ],
      },
    ];

    replaceScenarioAllocationFeeItems.mockResolvedValue(savedStateItems as any);
    fetchScenarioAllocations.mockResolvedValue([
      baseItem({ id: 'alloc-1', harnessId: 'H001', totalAmount: 4000, unitAllocation: 2000 }),
    ]);

    const { result } = renderHook(() => useAllocStore());

    await act(async () => {
      await result.current.saveFeeItem('project-1', {
        feeName: '工装电脑',
        feeCategory: 'tooling',
        unitPrice: 2000,
        allocBase: 50000,
        participants: [
          { harnessId: 'H001', harnessName: 'A线束', vehicleRatio: 1, quantity: 2 },
        ],
      }, 'scenario-1');
    });

    expect(replaceScenarioAllocationFeeItems).toHaveBeenCalledTimes(1);
    expect(result.current.feeItems).toHaveLength(1);
    expect(result.current.allocSummary?.grandTotal).toBe(4000);

    replaceScenarioAllocationFeeItems.mockResolvedValue([
      {
        ...savedStateItems[0],
        unitPrice: 2500,
        participants: [
          { harnessId: 'H001', harnessName: 'A线束', vehicleRatio: 1, quantity: 3, latestCumulativeVolume: 0 },
        ],
      },
    ] as any);
    fetchScenarioAllocations.mockResolvedValue([
      baseItem({ id: 'alloc-1', harnessId: 'H001', totalAmount: 7500, unitAllocation: 2500 }),
    ]);

    await act(async () => {
      await result.current.updateFeeItem('project-1', result.current.feeItems[0].feeId, {
        feeName: '工装电脑升级版',
        feeCategory: 'tooling',
        unitPrice: 2500,
        allocBase: 50000,
        participants: [
          { harnessId: 'H001', harnessName: 'A线束', vehicleRatio: 1, quantity: 3 },
        ],
      }, 'scenario-1');
    });

    const updatePayload = replaceScenarioAllocationFeeItems.mock.calls[1]?.[1];
    expect(updatePayload?.feeItems[0].feeName).toBe('工装电脑升级版');
    expect(result.current.allocSummary?.grandTotal).toBe(7500);

    replaceScenarioAllocationFeeItems.mockResolvedValue([] as any);
    fetchScenarioAllocations.mockResolvedValue([]);

    await act(async () => {
      await result.current.deleteFeeItem('project-1', result.current.feeItems[0].feeId, 'scenario-1');
    });

    expect(replaceScenarioAllocationFeeItems).toHaveBeenCalledTimes(3);
    expect(result.current.feeItems).toHaveLength(0);
    expect(result.current.allocSummary).toBeNull();
  });

  it('recomputes from in-memory fee items without remote calls', async () => {
    useAllocStore.setState({
      feeItems: [
        {
          feeId: 'fee-local',
          projectId: 'project-1',
          scenarioId: 'scenario-1',
          feeName: '研发验证',
          feeCategory: 'rnd',
          unitPrice: 3000,
          allocBase: 60000,
          paymentMode: 'amortized',
          burdenSide: 'customer',
          pricingEffect: 'included_in_price',
          recoveryCompletionBehavior: 'trigger_price_adjust',
          priceAdjustReminder: false,
          targetRecoveryDate: null,
          completedAt: null,
          status: 'allocated',
          sourceVersionId: null,
          participants: [
            { harnessId: 'H010', harnessName: 'H010', vehicleRatio: 1, quantity: 2, latestCumulativeVolume: 0 },
          ],
        },
      ],
      scenarioRows: [
        {
          harnessId: 'H010',
          harnessName: 'H010',
          vehicleRatio: 1,
          toolingCost: 0,
          testingCost: 0,
          rndCost: 6000,
          allocBase: 60000,
          paymentMode: 'amortized',
          cumProduced: 30000,
        },
      ],
    });

    const { result } = renderHook(() => useAllocStore());

    act(() => {
      result.current.recompute(120000);
    });

    expect(result.current.allocSummary?.grandTotal).toBe(6000);
    expect(result.current.recoverySummary?.totalRecovered).toBe(0);
    expect(fetchScenarioAllocations).not.toHaveBeenCalled();
    expect(replaceScenarioAllocationFeeItems).not.toHaveBeenCalled();
  });

  it('keeps matrix recovery summary aligned with fee-item reminder rules', async () => {
    useAllocStore.setState({
      feeItems: [
        {
          feeId: 'fee-alert',
          projectId: 'project-1',
          scenarioId: 'scenario-1',
          feeName: '工装投入',
          feeCategory: 'tooling',
          unitPrice: 50000,
          allocBase: 50000,
          paymentMode: 'amortized',
          burdenSide: 'customer',
          pricingEffect: 'included_in_price',
          recoveryCompletionBehavior: 'trigger_price_adjust',
          priceAdjustReminder: true,
          targetRecoveryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
          completedAt: null,
          status: 'allocated',
          sourceVersionId: null,
          participants: [
            { harnessId: 'H011', harnessName: 'H011', vehicleRatio: 1, quantity: 1, latestCumulativeVolume: 50000 },
          ],
        },
      ],
      scenarioRows: [
        {
          harnessId: 'H011',
          harnessName: 'H011',
          vehicleRatio: 1,
          toolingCost: 50000,
          testingCost: 0,
          rndCost: 0,
          allocBase: 50000,
          paymentMode: 'amortized',
          cumProduced: 50000,
        },
      ],
    });

    const { result } = renderHook(() => useAllocStore());

    act(() => {
      result.current.recompute(120000);
    });

    expect(result.current.recoverySummary?.priceAdjustmentAlerts).toEqual(['H011']);
    expect(result.current.recoverySummary?.trackers[0]?.needsPriceAdjustment).toBe(true);
    expect(result.current.recoverySummary?.trackers[0]?.status).toBe('recovered');
  });
});
