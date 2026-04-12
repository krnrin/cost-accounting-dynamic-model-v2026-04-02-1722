import React from 'react';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { render } from '@/test/test-utils';
import { VersionPanel } from './VersionPanel';

const apiClientMock = vi.fn();

vi.mock('@/lib/apiClient', () => ({
  apiClient: (...args: unknown[]) => apiClientMock(...args),
}));

vi.mock('@/engine/harness_costing', () => ({
  DEFAULTS: {
    laborRate: 35,
    mfgRate: 46.69,
    wasteRate: 0.01,
    mgmtRate: 0.06,
    profitRate: 0.056627,
  },
  computeHarnessCost: vi.fn(() => ({ harnessId: 'H1' })),
  computeProjectFromHarnesses: vi.fn(() => ({
    vehicleCost: 100,
    weightedMaterial: 60,
    weightedLabor: 20,
  })),
}));

vi.mock('./VersionDiffView', () => ({
  VersionDiffView: () => <div>VersionDiffView</div>,
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

function mockBaseRequests() {
  apiClientMock.mockImplementation((path: string) => {
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
          input: {},
        },
      ]);
    }
    return Promise.resolve(undefined);
  });
}

describe('VersionPanel', () => {
  beforeEach(() => {
    apiClientMock.mockReset();
    mockBaseRequests();
  });

  it('renders versions from server source', async () => {
    render(<VersionPanel projectId="p1" />);

    expect(await screen.findByText('初版')).toBeInTheDocument();
    expect(screen.getByText('草稿')).toBeInTheDocument();
  });

  it('updates version status through api', async () => {
    render(<VersionPanel projectId="p1" />);

    const button = await screen.findByRole('button', { name: '转为 BOM就绪' });
    fireEvent.click(button);

    await waitFor(() => {
      expect(apiClientMock).toHaveBeenCalledWith('/versions/v1/status', {
        method: 'PATCH',
        body: { status: 'bom_ready' },
      });
    });
  });
});
