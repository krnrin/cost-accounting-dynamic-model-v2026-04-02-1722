import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import AlertBanner from './AlertBanner';

describe('AlertBanner', () => {
  const base = {
    projectId: 'p1',
    basePrices: { copper: 68400, aluminum: 18200 },
  };

  it('renders nothing when thresholds disabled', () => {
    const { container } = render(
      <MemoryRouter>
        <AlertBanner
          {...base}
          currentPrices={{ copper: 80000, aluminum: 20000 }}
          thresholds={{ copperPercent: 5, aluminumPercent: 5, enabled: false }}
        />
      </MemoryRouter>
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when within thresholds', () => {
    const { container } = render(
      <MemoryRouter>
        <AlertBanner
          {...base}
          currentPrices={{ copper: 69000, aluminum: 18300 }}
          thresholds={{ copperPercent: 5, aluminumPercent: 5, enabled: true }}
        />
      </MemoryRouter>
    );
    expect(container.firstChild).toBeNull();
  });

  it('shows copper alert when copper exceeds threshold', () => {
    render(
      <MemoryRouter>
        <AlertBanner
          {...base}
          currentPrices={{ copper: 80000, aluminum: 18200 }}
          thresholds={{ copperPercent: 5, aluminumPercent: 5, enabled: true }}
        />
      </MemoryRouter>
    );
    expect(screen.getByText(/铜价变动/)).toBeInTheDocument();
    expect(screen.getByText(/查看影响分析/)).toBeInTheDocument();
  });

  it('shows aluminum alert when aluminum exceeds threshold', () => {
    render(
      <MemoryRouter>
        <AlertBanner
          {...base}
          currentPrices={{ copper: 68400, aluminum: 22000 }}
          thresholds={{ copperPercent: 5, aluminumPercent: 5, enabled: true }}
        />
      </MemoryRouter>
    );
    expect(screen.getByText(/铝价变动/)).toBeInTheDocument();
  });

  it('shows both alerts when both exceed', () => {
    render(
      <MemoryRouter>
        <AlertBanner
          {...base}
          currentPrices={{ copper: 80000, aluminum: 22000 }}
          thresholds={{ copperPercent: 5, aluminumPercent: 5, enabled: true }}
        />
      </MemoryRouter>
    );
    expect(screen.getByText(/铜价变动.*铝价变动/)).toBeInTheDocument();
  });
});
