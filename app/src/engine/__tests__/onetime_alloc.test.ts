import { describe, it, expect } from 'vitest';
import {
  computeOnetimeAlloc,
  computeAllocRecovery,
  computeProjectAlloc,
  computeProjectAllocFromItems,
  computeHarnessAllocationFromItems,
  normalizeOnetimeInputs,
  computeProjectRecovery,
  computeProjectRecoveryFromItems,
  simulateRecoveryTimeline,
  simulateRecoveryTimelineFromItems,
} from '../onetime_alloc';
import type { OnetimeCostInput } from '../onetime_alloc';

const makeInput = (overrides: Partial<OnetimeCostInput> = {}): OnetimeCostInput => ({
  harnessId: 'H001',
  harnessName: '测试线束',
  vehicleRatio: 1.0,
  toolingCost: 100000,
  testingCost: 50000,
  allocBase: 50000,
  ...overrides,
});

describe('computeOnetimeAlloc', () => {
  it('computes per-unit amortization', () => {
    const r = computeOnetimeAlloc(makeInput());
    expect(r.totalOnetimeCost).toBe(150000);
    expect(r.participates).toBe(true);
    expect(r.toolingPerUnit).toBeCloseTo(2); // 100000/50000
    expect(r.testingPerUnit).toBeCloseTo(1); // 50000/50000
    expect(r.totalPerUnit).toBeCloseTo(3);
    expect(r.priceAddon).toBeCloseTo(3);
  });

  it('marks non-participating when all costs zero', () => {
    const r = computeOnetimeAlloc(makeInput({
      toolingCost: 0, testingCost: 0,
    }));
    expect(r.participates).toBe(false);
    expect(r.totalPerUnit).toBe(0);
  });

  it('defaults allocBase to 50000', () => {
    const r = computeOnetimeAlloc(makeInput({ allocBase: 0 }));
    expect(r.allocBase).toBe(50000);
  });
});

describe('computeAllocRecovery', () => {
  const alloc = computeOnetimeAlloc(makeInput());

  it('tracks partial recovery', () => {
    const r = computeAllocRecovery(alloc, 25000, 100000);
    expect(r.recoveryProgress).toBeCloseTo(0.5);
    expect(r.fullyRecovered).toBe(false);
    expect(r.recoveredAmount).toBeCloseTo(75000); // 3 * 25000
    expect(r.remainingAmount).toBeCloseTo(75000);
  });

  it('caps at full recovery', () => {
    const r = computeAllocRecovery(alloc, 60000, 100000);
    expect(r.recoveryProgress).toBe(1.0);
    expect(r.fullyRecovered).toBe(true);
    expect(r.recoveredAmount).toBeCloseTo(150000);
    expect(r.remainingAmount).toBe(0);
    expect(r.needsPriceAdjustment).toBe(true);
  });

  it('non-participating returns fully recovered', () => {
    const zeroAlloc = computeOnetimeAlloc(makeInput({
      toolingCost: 0, testingCost: 0,
    }));
    const r = computeAllocRecovery(zeroAlloc, 0, 100000);
    expect(r.fullyRecovered).toBe(true);
    expect(r.recoveryProgress).toBe(1);
  });
});

describe('computeProjectAlloc', () => {
  it('summarizes multiple harnesses', () => {
    const inputs = [
      makeInput({ harnessId: 'A', toolingCost: 100000, testingCost: 50000, vehicleRatio: 1.0 }),
      makeInput({ harnessId: 'B', toolingCost: 0, testingCost: 0, vehicleRatio: 0.5 }),
    ];
    const r = computeProjectAlloc(inputs);
    expect(r.participatingCount).toBe(1);
    expect(r.nonParticipatingCount).toBe(1);
    expect(r.totalTooling).toBe(100000);
    expect(r.grandTotal).toBe(150000);
    expect(r.weightedAllocPerVehicle).toBeCloseTo(3);
  });

  it('supports matrix-based allocation items', () => {
    const items = [
      {
        feeId: 'tool-1',
        feeName: '电脑',
        feeCategory: 'tooling' as const,
        unitPrice: 4200,
        allocBase: 50000,
        participants: [
          { harnessId: 'A', harnessName: 'A线束', vehicleRatio: 1, quantity: 2 },
          { harnessId: 'B', harnessName: 'B线束', vehicleRatio: 0.5, quantity: 1 },
        ],
      },
      {
        feeId: 'test-1',
        feeName: '试验',
        feeCategory: 'testing' as const,
        unitPrice: 10000,
        allocBase: 50000,
        participants: [
          { harnessId: 'A', harnessName: 'A线束', vehicleRatio: 1, quantity: 1 },
          { harnessId: 'B', harnessName: 'B线束', vehicleRatio: 0.5, quantity: 0 },
        ],
      },
      {
        feeId: 'rnd-1',
        feeName: '研发治具验证',
        feeCategory: 'rnd' as const,
        unitPrice: 6000,
        allocBase: 50000,
        participants: [
          { harnessId: 'A', harnessName: 'A线束', vehicleRatio: 1, quantity: 1 },
          { harnessId: 'B', harnessName: 'B线束', vehicleRatio: 0.5, quantity: 2 },
        ],
      },
    ];

    const single = computeHarnessAllocationFromItems('A', 'A线束', 1, items);
    expect(single.toolingCost).toBe(8400);
    expect(single.testingCost).toBe(10000);
    expect(single.rndCost).toBe(6000);
    expect(single.totalPerUnit).toBeCloseTo((8400 + 10000 + 6000) / 50000);

    const summary = computeProjectAllocFromItems(items);
    expect(summary.participatingCount).toBe(2);
    expect(summary.totalTooling).toBe(12600);
    expect(summary.totalTesting).toBe(10000);
    expect(summary.totalRnd).toBe(18000);
    expect(summary.grandTotal).toBe(40600);

    const normalized = normalizeOnetimeInputs([
      makeInput({ harnessId: 'A', harnessName: 'A线束', feeItems: items as any }),
    ]);
    expect(normalized.totalRnd).toBe(18000);
    expect(normalized.grandTotal).toBe(40600);
  });
});

describe('simulateRecoveryTimeline', () => {
  it('simulates multi-year recovery', () => {
    const alloc = computeOnetimeAlloc(makeInput({ vehicleRatio: 1.0 }));
    const timeline = simulateRecoveryTimeline([alloc], 20000, 3);
    expect(timeline).toHaveLength(3);
    // Year 1: 20000 produced, progress = 20000/50000 = 0.4
    expect(timeline[0].overallRecoveryProgress).toBeCloseTo(0.4);
    // Year 2: 40000 produced, progress = 0.8
    expect(timeline[1].overallRecoveryProgress).toBeCloseTo(0.8);
    // Year 3: 60000 produced, capped at 1.0
    expect(timeline[2].overallRecoveryProgress).toBe(1);
    expect(timeline[2].fullyRecoveredCount).toBe(1);
  });

  it('supports matrix recovery alerts, overdue status, and timeline behavior', () => {
    const futureDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
    const items = [
      {
        feeId: 'fee-1',
        feeName: '工装投入',
        feeCategory: 'tooling' as const,
        unitPrice: 50000,
        allocBase: 50000,
        paymentMode: 'amortized' as const,
        recoveryCompletionBehavior: 'trigger_price_adjust' as const,
        priceAdjustReminder: true,
        targetRecoveryDate: futureDate,
        participants: [
          { harnessId: 'A', harnessName: 'A线束', vehicleRatio: 1, quantity: 1, latestCumulativeVolume: 50000 },
          { harnessId: 'B', harnessName: 'B线束', vehicleRatio: 0.2, quantity: 1, latestCumulativeVolume: 0 },
        ],
      },
    ];

    const recovery = computeProjectRecoveryFromItems(items, 10000, 1);
    const recovered = recovery.trackers.find((tracker) => tracker.harnessId === 'A');
    const overdue = recovery.trackers.find((tracker) => tracker.harnessId === 'B');

    expect(recovery.priceAdjustmentAlerts).toContain('A');
    expect(recovered?.needsPriceAdjustment).toBe(true);
    expect(recovered?.status).toBe('recovered');
    expect(overdue?.status).toBe('overdue');

    const timeline = simulateRecoveryTimelineFromItems(items, 10000, 2, 1);
    expect(timeline).toHaveLength(2);
    expect(timeline[0].trackers.find((tracker) => tracker.harnessId === 'B')?.status).toBe('overdue');
    expect(timeline[1].trackers.find((tracker) => tracker.harnessId === 'A')?.recoveryProgress).toBeCloseTo(0.4);
  });

  it('does not raise price adjustment alerts for notify-only items', () => {
    const items = [
      {
        feeId: 'fee-2',
        feeName: '试验验证',
        feeCategory: 'testing' as const,
        unitPrice: 12000,
        allocBase: 12000,
        paymentMode: 'amortized' as const,
        recoveryCompletionBehavior: 'notify_only' as const,
        priceAdjustReminder: true,
        participants: [
          { harnessId: 'C', harnessName: 'C线束', vehicleRatio: 1, quantity: 1, latestCumulativeVolume: 12000 },
        ],
      },
    ];

    const recovery = computeProjectRecoveryFromItems(items, 12000, 2);
    expect(recovery.priceAdjustmentAlerts).toEqual([]);
    expect(recovery.trackers[0].needsPriceAdjustment).toBe(false);
  });
});
