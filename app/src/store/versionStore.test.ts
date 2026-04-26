import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from '@testing-library/react';
import { useVersionStore } from './versionStore';
import type { VersionRecord } from '@/types/version';

// Mock db
vi.mock('@/data/db', () => ({
  db: {
    versions: {
      where: vi.fn(() => ({
        equals: vi.fn(() => ({
          toArray: vi.fn(() => Promise.resolve([])),
        })),
      })),
      get: vi.fn(),
      put: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    scenarios: {
      get: vi.fn(),
      update: vi.fn(),
    },
    harnesses: {
      where: vi.fn(() => ({
        equals: vi.fn(() => ({
          toArray: vi.fn(() => Promise.resolve([])),
          sortBy: vi.fn(() => Promise.resolve([])),
        })),
      })),
      update: vi.fn(),
      add: vi.fn(),
      bulkDelete: vi.fn(),
    },
    transaction: vi.fn((_mode, _tables, callback) => callback()),
  },
}));

// Mock scenario guards
vi.mock('@/data/scenarioGuards', () => ({
  requireScenarioConfig: vi.fn(() => ({
    costRates: { laborRate: 50, overheadRate: 0.15 },
    metalPrices: { copper: 70000, aluminum: 20000 },
  })),
  requireScenarioRecord: vi.fn((record) => record),
}));

// Mock engine functions
vi.mock('@/engine/configuration_model', () => ({
  applyInstallationRatiosToHarnessInputs: vi.fn(() => []),
  resolveScenarioVehicleConfigs: vi.fn(() => []),
}));

vi.mock('@/engine/harness_costing', () => ({
  computeHarnessCost: vi.fn(() => ({ totalCost: 100 })),
  computeProjectFromHarnesses: vi.fn(() => ({
    vehicleCost: 100,
    weightedMaterial: 50,
    weightedLabor: 30,
    harnessCount: 1,
  })),
}));

vi.mock('@/engine/change_pricing', () => ({
  computeChangePricing: vi.fn(() => ({
    totalDelta: 0,
    lineItems: [],
  })),
  buildChangeComparisonTable: vi.fn(() => []),
}));

vi.mock('@/engine/version_diff', () => ({
  computeVersionDiff: vi.fn(() => ({
    sections: [],
    beforeVersion: '',
    afterVersion: '',
  })),
}));

const mockVersion = (overrides: Partial<VersionRecord> = {}): VersionRecord => ({
  id: 'version-1',
  projectId: 'project-1',
  scenarioId: 'scenario-1',
  versionNumber: 1,
  label: 'v1',
  status: 'draft',
  snapshot: {
    scenario: {
      id: 'scenario-1',
      scenarioCode: 'SCN-001',
      scenarioName: 'Test Scenario',
    },
    harnesses: [],
    config: {
      costRates: { laborRate: 50, overheadRate: 0.15 },
      metalPrices: { copper: 70000, aluminum: 20000 },
    },
    summary: {
      vehicleCost: 100,
      totalMaterial: 50,
      totalLabor: 30,
      harnessCount: 1,
    },
  },
  createdBy: 'user-1',
  createdAt: '2026-04-01T00:00:00.000Z',
  lockInfo: { locked: false },
  approvalInfo: { status: 'not_submitted' },
  ...overrides,
});

describe('versionStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset store state
    useVersionStore.setState({
      projectId: null,
      scenarioId: null,
      versions: [],
      loading: false,
      error: null,
      baseVersionId: null,
      compareVersionId: null,
      changePricingResult: null,
      versionDiffResult: null,
      comparisonTable: null,
      _requestId: 0,
    });
  });

  describe('clear', () => {
    it('should reset all state to initial values', () => {
      // Set some state
      useVersionStore.setState({
        projectId: 'project-1',
        versions: [mockVersion()],
        loading: true,
        baseVersionId: 'version-1',
      });

      // Clear
      act(() => {
        useVersionStore.getState().clear();
      });

      const state = useVersionStore.getState();
      expect(state.projectId).toBeNull();
      expect(state.versions).toEqual([]);
      expect(state.loading).toBe(false);
      expect(state.baseVersionId).toBeNull();
    });
  });

  describe('setCompareVersions', () => {
    it('should set base and compare version IDs', () => {
      act(() => {
        useVersionStore.getState().setCompareVersions('base-1', 'compare-1');
      });

      const state = useVersionStore.getState();
      expect(state.baseVersionId).toBe('base-1');
      expect(state.compareVersionId).toBe('compare-1');
    });

    it('should clear comparison results when versions change', () => {
      // Set some comparison results
      useVersionStore.setState({
        changePricingResult: {} as any,
        versionDiffResult: {} as any,
        comparisonTable: [] as any,
      });

      act(() => {
        useVersionStore.getState().setCompareVersions('base-1', 'compare-1');
      });

      const state = useVersionStore.getState();
      expect(state.changePricingResult).toBeNull();
      expect(state.versionDiffResult).toBeNull();
      expect(state.comparisonTable).toBeNull();
    });
  });

  describe('validateTransition integration', () => {
    it('should prevent invalid status transitions in updateStatus', async () => {
      const version = mockVersion({ status: 'draft' });
      const { db } = await import('@/data/db');
      vi.mocked(db.versions.get).mockResolvedValue(version);

      // Try to transition from draft to published (invalid - should go through reviewed first)
      await expect(
        useVersionStore.getState().updateStatus('version-1', 'published')
      ).rejects.toThrow();
    });
  });
});
