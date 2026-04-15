import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import DashboardPage from './DashboardPage';

const useDashboardDataMock = vi.fn();

vi.mock('@/hooks/useDashboardData', () => ({
  useDashboardData: () => useDashboardDataMock(),
}));

vi.mock('@/components/ScenarioSelector', () => ({
  default: () => <div>ScenarioSelector</div>,
}));

vi.mock('@/components/MultiImportDialog', () => ({
  MultiImportDialog: () => null,
}));

vi.mock('@/components/dashboard', () => ({
  KpiSection: () => <div>KpiSection</div>,
  ChartGrid: () => <div>ChartGrid</div>,
  AllocationProgress: () => <div>AllocationProgress</div>,
  LifecyclePnLTable: () => <div>LifecyclePnLTable</div>,
  HarnessProfitTable: () => <div>HarnessProfitTable</div>,
}));

function makeDashboardData(hasAlert: boolean) {
  return {
    loading: false,
    id: 'p1',
    sid: 's1',
    project: { id: 'p1', meta: { projectName: '项目A' } },
    scenario: { config: { metalPrices: { copper: 80000, aluminum: 22000 } } },
    defaultMetalPrices: { copper: 68400, aluminum: 18200 },
    alertThresholds: { copperPercent: 5, aluminumPercent: 5, enabled: true },
    summary: {
      harnesses: [
        {
          harnessId: 'H1',
          harnessName: '线束1',
          copperWeight: 1.2,
          aluminumWeight: 0.3,
          deliveredPrice: 100,
          exFactoryPrice: 90,
          vehicleRatio: 1,
          _params: { wasteRate: 0.01, mgmtRate: 0.06, profitRate: 0.056627 },
        },
      ],
    },
    metalClientCheck: { hasAlert },
    harnessCount: 1,
    totalHours: 1,
    mode: 'internal',
    setMode: vi.fn(),
    vehicleCost: 100,
    snapshotCustomerVehicleCost: 100,
    customerVehicleCost: 100,
    internalVehicleCost: 90,
    grossMargin: 10,
    allocPerVehicle: 0,
    allocSummary: { allocations: [] },
    recoverySummary: { trackers: [] },
    allocRecoveryItems: [],
    effectiveCustomerHarnesses: [],
    internalSummary: null,
    internalHarnesses: [],
    lifecyclePnL: null,
    harnessTableData: [],
    showMohDetail: false,
    setShowMohDetail: vi.fn(),
    setShowMultiImport: vi.fn(),
    showMultiImport: false,
    loadData: vi.fn(),
  };
}

describe('DashboardPage', () => {
  it('shows metal alert banner and impact summary when threshold is exceeded', () => {
    useDashboardDataMock.mockReturnValue(makeDashboardData(true));

    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    );

    expect(screen.getByText(/铜价变动/)).toBeInTheDocument();
    expect(screen.getByText('金属价格联动影响')).toBeInTheDocument();
  });

  it('does not show impact summary when no metal alert is triggered', () => {
    useDashboardDataMock.mockReturnValue(makeDashboardData(false));

    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    );

    expect(screen.queryByText('金属价格联动影响')).not.toBeInTheDocument();
  });
});
