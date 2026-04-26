import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from '@testing-library/react';
import { usePackagingStore } from './packagingStore';
import type { PackagingSchemeRecord, PackagingLogisticsRecord, HarnessRecord } from '@/data/db';

// Mock db
vi.mock('@/data/db', () => ({
  db: {
    packagingSchemes: {
      where: vi.fn(() => ({
        equals: vi.fn(() => ({
          toArray: vi.fn(() => Promise.resolve([])),
        })),
      })),
      put: vi.fn(),
      bulkPut: vi.fn(),
      delete: vi.fn(),
    },
    packagingLogistics: {
      where: vi.fn(() => ({
        equals: vi.fn(() => ({
          toArray: vi.fn(() => Promise.resolve([])),
        })),
      })),
      put: vi.fn(),
      bulkPut: vi.fn(),
      delete: vi.fn(),
    },
    harnesses: {
      where: vi.fn(() => ({
        equals: vi.fn(() => ({
          toArray: vi.fn(() => Promise.resolve([])),
        })),
      })),
      update: vi.fn(),
    },
    transaction: vi.fn((_mode, _tables, callback) => callback()),
  },
}));

// Mock packaging types
vi.mock('@/types/packaging', () => ({
  createEmptyPackagingScheme: vi.fn((harnessId, harnessName) => ({
    harnessId,
    harnessName,
    boxType: '纸箱',
    totalPerBox: 0,
    unitsPerBox: 0,
    boxCount: 0,
  })),
  createEmptyPackagingLogisticsCost: vi.fn((harnessId, harnessName) => ({
    harnessId,
    harnessName,
    innerPackaging: 0,
    outerPackaging: 0,
    freight: 0,
    excessFreight: 0,
    shortHaul: 0,
    thirdPartyWarehouse: 0,
    storage: 0,
  })),
  calculatePackagingLogisticsTotals: vi.fn((cost) => ({
    ...cost,
    totalPackaging: cost.innerPackaging + cost.outerPackaging,
    totalLogistics: cost.freight + cost.excessFreight + cost.shortHaul + cost.thirdPartyWarehouse + cost.storage,
    grandTotal: cost.innerPackaging + cost.outerPackaging + cost.freight,
  })),
}));

const mockSchemeRecord = (overrides: Partial<PackagingSchemeRecord> = {}): PackagingSchemeRecord => ({
  id: 'project-1::H001',
  projectId: 'project-1',
  harnessId: 'H001',
  scheme: {
    harnessId: 'H001',
    harnessName: 'Test Harness',
    boxType: '纸箱',
    totalPerBox: 100,
    unitsPerBox: 10,
    boxCount: 10,
  },
  updatedAt: '2026-04-01T00:00:00.000Z',
  ...overrides,
});

const mockLogisticsRecord = (overrides: Partial<PackagingLogisticsRecord> = {}): PackagingLogisticsRecord => ({
  id: 'project-1::H001',
  projectId: 'project-1',
  harnessId: 'H001',
  cost: {
    harnessId: 'H001',
    harnessName: 'Test Harness',
    innerPackaging: 100,
    outerPackaging: 50,
    freight: 200,
    excessFreight: 0,
    shortHaul: 0,
    thirdPartyWarehouse: 0,
    storage: 0,
    totalPackaging: 150,
    totalLogistics: 200,
    grandTotal: 350,
  },
  updatedAt: '2026-04-01T00:00:00.000Z',
  ...overrides,
});

const mockHarness = (overrides: Partial<HarnessRecord> = {}): HarnessRecord => ({
  id: 'harness-1',
  projectId: 'project-1',
  scenarioId: 'scenario-1',
  harnessId: 'H001',
  harnessName: 'Test Harness',
  input: {
    harnessId: 'H001',
    harnessName: 'Test Harness',
    vehicleRatio: 1.0,
    materials: [],
    labor: { standardMinutes: 0, processes: {} },
  } as any,
  updatedAt: '2026-04-01T00:00:00.000Z',
  ...overrides,
});

describe('packagingStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset store state
    usePackagingStore.setState({
      schemeRecords: [],
      schemeSummary: null,
      logisticsRecords: [],
      logisticsSummary: null,
      loading: false,
      error: null,
      currentProjectId: null,
    });
  });

  describe('clear', () => {
    it('should reset all state to initial values', () => {
      // Set some state
      usePackagingStore.setState({
        currentProjectId: 'project-1',
        schemeRecords: [mockSchemeRecord()],
        logisticsRecords: [mockLogisticsRecord()],
        loading: true,
      });

      // Clear
      act(() => {
        usePackagingStore.getState().clear();
      });

      const state = usePackagingStore.getState();
      expect(state.currentProjectId).toBeNull();
      expect(state.schemeRecords).toEqual([]);
      expect(state.logisticsRecords).toEqual([]);
      expect(state.loading).toBe(false);
    });
  });

  describe('loadPackagingSchemes', () => {
    it('should load scheme records and compute summary', async () => {
      const { db } = await import('@/data/db');
      const schemes = [mockSchemeRecord(), mockSchemeRecord({ harnessId: 'H002', boxType: '围板箱' })];
      vi.mocked(db.packagingSchemes.where).mockReturnValue({
        equals: vi.fn(() => ({
          toArray: vi.fn(() => Promise.resolve(schemes)),
        })),
      } as any);

      await act(async () => {
        await usePackagingStore.getState().loadPackagingSchemes('project-1');
      });

      const state = usePackagingStore.getState();
      expect(state.currentProjectId).toBe('project-1');
      expect(state.schemeRecords).toHaveLength(2);
      expect(state.schemeSummary).not.toBeNull();
      expect(state.schemeSummary?.totalHarnesses).toBe(2);
    });
  });

  describe('loadPackagingLogistics', () => {
    it('should load logistics records and compute summary with weighted per unit', async () => {
      const { db } = await import('@/data/db');
      const logistics = [mockLogisticsRecord()];
      const harnesses = [mockHarness({ input: { ...mockHarness().input, vehicleRatio: 0.5 } as any })];

      vi.mocked(db.packagingLogistics.where).mockReturnValue({
        equals: vi.fn(() => ({
          toArray: vi.fn(() => Promise.resolve(logistics)),
        })),
      } as any);

      vi.mocked(db.harnesses.where).mockReturnValue({
        equals: vi.fn(() => ({
          toArray: vi.fn(() => Promise.resolve(harnesses)),
        })),
      } as any);

      await act(async () => {
        await usePackagingStore.getState().loadPackagingLogistics('project-1');
      });

      const state = usePackagingStore.getState();
      expect(state.logisticsRecords).toHaveLength(1);
      expect(state.logisticsSummary).not.toBeNull();
      expect(state.logisticsSummary?.totalPackaging).toBe(150);
      expect(state.logisticsSummary?.totalLogistics).toBe(200);
    });
  });

  describe('composite key handling', () => {
    it('should use scenarioId::harnessId composite key for vehicleRatioMap', async () => {
      const { db } = await import('@/data/db');
      const logistics = [
        mockLogisticsRecord({ scenarioId: 'scenario-1', harnessId: 'H001' }),
        mockLogisticsRecord({ id: 'project-1::scenario-2::H001', scenarioId: 'scenario-2', harnessId: 'H001' }),
      ];
      const harnesses = [
        mockHarness({ scenarioId: 'scenario-1', harnessId: 'H001', input: { ...mockHarness().input, vehicleRatio: 1.0 } as any }),
        mockHarness({ scenarioId: 'scenario-2', harnessId: 'H001', input: { ...mockHarness().input, vehicleRatio: 0.5 } as any }),
      ];

      vi.mocked(db.packagingLogistics.where).mockReturnValue({
        equals: vi.fn(() => ({
          toArray: vi.fn(() => Promise.resolve(logistics)),
        })),
      } as any);

      vi.mocked(db.harnesses.where).mockReturnValue({
        equals: vi.fn(() => ({
          toArray: vi.fn(() => Promise.resolve(harnesses)),
        })),
      } as any);

      await act(async () => {
        await usePackagingStore.getState().loadPackagingLogistics('project-1');
      });

      const state = usePackagingStore.getState();
      // Should not throw and should correctly compute weighted per unit
      expect(state.logisticsSummary).not.toBeNull();
    });
  });
});
