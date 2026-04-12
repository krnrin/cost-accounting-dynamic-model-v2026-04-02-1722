import { describe, it, expect, vi } from 'vitest';
import { render as renderWithProviders } from '../test/test-utils';
import { render, screen } from '@testing-library/react';
import Breadcrumb from './Breadcrumb';
import React from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

// Mock the stores and hooks
vi.mock('@/store/projectStore', () => ({
  useProjectStore: vi.fn(() => ({
    projectName: 'Test Project',
    currentProjectId: '123',
  })),
}));

vi.mock('dexie-react-hooks', () => ({
  useLiveQuery: vi.fn(() => ({ meta: { projectName: 'Fetched Project' } })),
}));

vi.mock('@/data/db', () => ({
  db: {
    projects: {
      get: vi.fn(),
    },
  },
}));

describe('Breadcrumb', () => {
  it('renders nothing at root path', () => {
    const { container } = renderWithProviders(<Breadcrumb />);
    expect(container.firstChild).toBeNull();
  });

  it('renders system settings breadcrumb', () => {
    render(
      <MemoryRouter initialEntries={['/settings']}>
        <Breadcrumb />
      </MemoryRouter>
    );
    expect(screen.getByText('系统设置')).toBeInTheDocument();
  });

  it('renders project list and project name', () => {
    render(
      <MemoryRouter initialEntries={['/project/123']}>
        <Routes>
          <Route path="/project/:id" element={<Breadcrumb />} />
        </Routes>
      </MemoryRouter>
    );
    expect(screen.getByText('项目列表')).toBeInTheDocument();
    expect(screen.getByText('Test Project')).toBeInTheDocument();
  });

  it('renders harness details breadcrumb', () => {
    render(
      <MemoryRouter initialEntries={['/project/123/harness/h1']}>
        <Routes>
          <Route path="/project/:id/harness/:harnessId" element={<Breadcrumb />} />
        </Routes>
      </MemoryRouter>
    );
    expect(screen.getByText('线束详情')).toBeInTheDocument();
    expect(screen.getByText('h1')).toBeInTheDocument();
  });
});
