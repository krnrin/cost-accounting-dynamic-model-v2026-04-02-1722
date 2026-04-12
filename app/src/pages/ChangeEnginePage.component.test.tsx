import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ChangeEnginePage from './ChangeEnginePage';

const apiClientMock = vi.fn();

vi.mock('@/lib/apiClient', () => ({
  apiClient: (...args: unknown[]) => apiClientMock(...args),
}));

vi.mock('@/components/ScenarioSelector', () => ({
  default: () => <div>ScenarioSelector</div>,
}));

vi.mock('echarts-for-react/lib/core', () => ({
  default: () => <div data-testid="change-chart" />,
}));

vi.mock('@/lib/echarts', () => ({
  default: {},
}));

const config = {
  costRates: {
    laborRate: 35,
    mfgRate: 46.69,
    wasteRate: 0.01,
    mgmtRate: 0.06,
    profitRate: 0.056627,
  },
  metalPrices: {
    copper: 65000,
    aluminum: 18000,
  },
  volumes: [],
  annualDropRate: 0,
};

function makeHarnessInput(qty: number, unitPrice: number) {
  return {
    harnessId: 'H1',
    harnessName: 'Harness 1',
    vehicleRatio: 1,
    bom: [
      {
        partNo: 'P-001',
        partName: 'Part 001',
        itemCategory: 'other' as const,
        qty,
        unit: 'EA',
        unitPrice,
        amount: qty * unitPrice,
      },
    ],
    frontHours: 0.2,
    backHours: 0.1,
    packaging: {
      innerBoxCost: 0,
      outerBoxCost: 0,
      palletCost: 0,
      trayDividerCost: 0,
      bubbleWrapCost: 0,
      labelCost: 0,
      subtotal: 0,
    },
    freight: {
      freight: 0,
      excessFreight: 0,
      shortHaul: 0,
      thirdPartyWarehouse: 0,
      storage: 0,
      subtotal: 0,
    },
  };
}

function makeSnapshot(versionLabel: string, qty: number, unitPrice: number, vehicleCost: number) {
  return {
    harnesses: [
      {
        harnessId: 'H1',
        harnessName: `Harness ${versionLabel}`,
        input: makeHarnessInput(qty, unitPrice),
      },
    ],
    config,
    summary: {
      vehicleCost,
      totalMaterial: vehicleCost * 0.6,
      totalLabor: vehicleCost * 0.2,
      harnessCount: 1,
    },
  };
}

const snapshotV1 = makeSnapshot('V1', 1, 10, 100);
const snapshotV2 = makeSnapshot('V2', 2, 10, 120);

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/project/p1/s/s1/change-engine']}>
      <Routes>
        <Route path="/project/:id/s/:sid/change-engine" element={<ChangeEnginePage />} />
      </Routes>
    </MemoryRouter>,
  );
}

function mockBaseRequests(options?: {
  versions?: any[];
  changeEvents?: any[];
}) {
  const versions = options?.versions ?? [
    {
      id: 'v1',
      projectId: 'p1',
      versionNumber: 1,
      label: 'V1',
      status: 'draft',
      snapshot: snapshotV1,
      createdAt: '2026-04-12T00:00:00.000Z',
      notes: '',
    },
  ];
  const changeEvents = options?.changeEvents ?? [];

  apiClientMock.mockImplementation((path: string, request?: { method?: string; body?: any }) => {
    if (path === '/versions/project/p1') {
      return Promise.resolve(versions);
    }

    if (path === '/projects/p1') {
      return Promise.resolve({
        id: 'p1',
        projectCode: 'P1',
        projectName: 'Project P1',
        costRates: config.costRates,
        metalPrices: config.metalPrices,
        volumes: [],
      });
    }

    if (path === '/projects/p1/harnesses') {
      return Promise.resolve([
        {
          id: 'h1',
          harnessId: 'H1',
          harnessName: 'Harness 1',
          input: makeHarnessInput(1, 10),
        },
      ]);
    }

    if (path === '/projects/p1/scenarios/s1/changes' && !request?.method) {
      return Promise.resolve(changeEvents);
    }

    if (path === '/projects/p1/scenarios/s1/changes' && request?.method === 'POST') {
      return Promise.resolve({
        id: 'change-1',
        projectId: 'p1',
        scenarioId: 's1',
        changeType: request.body.changeType,
        reason: request.body.reason,
        affectedHarnessIds: request.body.affectedHarnessIds,
        affectedBomRows: request.body.affectedBomRows,
        costImpact: 0,
        quoteImpact: 0,
        residualImpact: 0,
        baselineVersionId: request.body.baselineVersionId,
        compareVersionId: request.body.compareVersionId,
        status: 'draft',
        createdAt: '2026-04-12T01:00:00.000Z',
      });
    }

    if (path === '/changes/change-1/calculate-impact' && request?.method === 'POST') {
      return Promise.resolve({
        id: 'change-1',
        projectId: 'p1',
        scenarioId: 's1',
        changeType: 'adjust',
        reason: 'V1 -> V2',
        affectedHarnessIds: ['H1'],
        affectedBomRows: [
          {
            harnessId: 'H1',
            harnessName: 'Harness V2',
            partNo: 'P-001',
            partName: 'Part 001',
            changeType: 'qty_changed',
            beforeQty: 1,
            afterQty: 2,
            beforePrice: 10,
            afterPrice: 10,
            deltaAmount: 10,
          },
        ],
        costImpact: 10,
        quoteImpact: 10,
        residualImpact: 0,
        baselineVersionId: 'v1',
        compareVersionId: 'v2',
        status: 'calculated',
        createdAt: '2026-04-12T01:00:00.000Z',
      });
    }

    if (path === '/versions' && request?.method === 'POST') {
      return Promise.resolve({
        id: 'v2',
        projectId: 'p1',
        versionNumber: 2,
        label: request.body.label,
        status: 'draft',
        snapshot: request.body.snapshot,
        createdAt: '2026-04-12T01:00:00.000Z',
        notes: request.body.notes,
      });
    }

    return Promise.resolve(undefined);
  });
}

describe('ChangeEnginePage', () => {
  beforeEach(() => {
    apiClientMock.mockReset();
    mockBaseRequests();
  });

  it('renders versions and loads change events from server source', async () => {
    mockBaseRequests({
      changeEvents: [
        {
          id: 'change-existing',
          projectId: 'p1',
          scenarioId: 's1',
          changeType: 'adjust',
          reason: 'existing server change',
          affectedHarnessIds: ['H1'],
          affectedBomRows: [],
          costImpact: 12.5,
          quoteImpact: 12.5,
          residualImpact: 0,
          status: 'calculated',
          createdAt: '2026-04-12T02:00:00.000Z',
        },
      ],
    });

    renderPage();

    expect(await screen.findByText('V1')).toBeInTheDocument();
    await waitFor(() => {
      expect(apiClientMock).toHaveBeenCalledWith('/projects/p1/scenarios/s1/changes');
    });
    expect((await screen.findAllByText('existing server change')).length).toBeGreaterThan(0);
    expect(screen.getAllByText('calculated').length).toBeGreaterThan(0);
  });

  it('creates a snapshot through server api', async () => {
    renderPage();

    await screen.findByText('V1');

    fireEvent.click(screen.getByLabelText('create-snapshot'));
    fireEvent.change(screen.getByPlaceholderText('v2'), { target: { value: 'change-v2' } });
    const textboxes = within(document.body).getAllByRole('textbox');
    fireEvent.change(textboxes[textboxes.length - 1]!, { target: { value: 'test snapshot notes' } });
    fireEvent.click(screen.getByRole('button', { name: 'confirm' }));

    await waitFor(() => {
      expect(apiClientMock).toHaveBeenCalledWith('/versions', {
        method: 'POST',
        body: expect.objectContaining({
          projectId: 'p1',
          versionNumber: 2,
          label: 'change-v2',
          status: 'draft',
          notes: 'test snapshot notes',
        }),
      });
    });
  });

  it('creates and calculates a persisted change event after comparison', async () => {
    mockBaseRequests({
      versions: [
        {
          id: 'v2',
          projectId: 'p1',
          versionNumber: 2,
          label: 'V2',
          status: 'draft',
          snapshot: snapshotV2,
          createdAt: '2026-04-12T01:00:00.000Z',
          notes: '',
        },
        {
          id: 'v1',
          projectId: 'p1',
          versionNumber: 1,
          label: 'V1',
          status: 'draft',
          snapshot: snapshotV1,
          createdAt: '2026-04-12T00:00:00.000Z',
          notes: '',
        },
      ],
    });

    renderPage();

    expect(await screen.findByText('V2')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByLabelText('run-version-compare')).not.toBeDisabled();
    });

    fireEvent.click(screen.getByLabelText('run-version-compare'));

    await waitFor(() => {
      expect(screen.getByLabelText('create-change-event')).not.toBeDisabled();
    });

    fireEvent.click(screen.getByLabelText('create-change-event'));

    await waitFor(() => {
      expect(apiClientMock).toHaveBeenCalledWith('/projects/p1/scenarios/s1/changes', {
        method: 'POST',
        body: expect.objectContaining({
          projectId: 'p1',
          baselineVersionId: 'v1',
          compareVersionId: 'v2',
        }),
      });
    });
    await waitFor(() => {
      expect(apiClientMock).toHaveBeenCalledWith('/changes/change-1/calculate-impact', {
        method: 'POST',
      });
    });
  });
});
