import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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

const snapshot = {
  harnesses: [],
  config: {
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
  },
  summary: {
    vehicleCost: 100,
    totalMaterial: 60,
    totalLabor: 20,
    harnessCount: 1,
  },
};

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/project/p1/s/s1/change-engine']}>
      <Routes>
        <Route path="/project/:id/s/:sid/change-engine" element={<ChangeEnginePage />} />
      </Routes>
    </MemoryRouter>,
  );
}

function mockBaseRequests() {
  apiClientMock.mockImplementation((path: string, options?: { method?: string; body?: any }) => {
    if (path === '/versions/project/p1') {
      return Promise.resolve([
        {
          id: 'v1',
          projectId: 'p1',
          versionNumber: 1,
          label: '初版',
          status: 'draft',
          snapshot,
          createdAt: '2026-04-12T00:00:00.000Z',
          notes: '',
        },
      ]);
    }

    if (path === '/projects/p1') {
      return Promise.resolve({
        id: 'p1',
        projectCode: 'P1',
        projectName: '测试项目',
        costRates: snapshot.config.costRates,
        metalPrices: snapshot.config.metalPrices,
        volumes: [],
      });
    }

    if (path === '/projects/p1/harnesses') {
      return Promise.resolve([
        {
          id: 'h1',
          harnessId: 'H1',
          harnessName: 'Harness 1',
          input: {
            bom: [],
            process: [],
            packaging: { inner: [], outer: [], returnableShare: 0, logisticsCost: 0 },
          },
        },
      ]);
    }

    if (path === '/versions' && options?.method === 'POST') {
      return Promise.resolve({
        id: 'v2',
        projectId: 'p1',
        versionNumber: 2,
        label: options.body.label,
        status: 'draft',
        snapshot: options.body.snapshot,
        createdAt: '2026-04-12T01:00:00.000Z',
        notes: options.body.notes,
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

  it('renders versions from server source', async () => {
    renderPage();

    expect(await screen.findByText('版本管理')).toBeInTheDocument();
    expect(await screen.findByText('初版')).toBeInTheDocument();
    expect(screen.getByText('草稿')).toBeInTheDocument();
  });

  it('creates a snapshot through server api', async () => {
    renderPage();

    await screen.findByText('初版');

    fireEvent.click(screen.getByRole('button', { name: /创建快照/ }));
    fireEvent.change(screen.getByPlaceholderText('v2'), { target: { value: '设变 v2' } });
    fireEvent.change(
      screen.getByPlaceholderText('如：定点版本 / BOM设变-增加充电插座线束 / 铜价联动Q2'),
      { target: { value: '用于回归测试' } },
    );
    fireEvent.click(screen.getByRole('button', { name: 'confirm' }));

    await waitFor(() => {
      expect(apiClientMock).toHaveBeenCalledWith('/versions', {
        method: 'POST',
        body: expect.objectContaining({
          projectId: 'p1',
          versionNumber: 2,
          label: '设变 v2',
          status: 'draft',
          notes: '用于回归测试',
        }),
      });
    });
  });
});
