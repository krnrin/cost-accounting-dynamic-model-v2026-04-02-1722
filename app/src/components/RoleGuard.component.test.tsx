import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import RoleGuard from './RoleGuard';

// Mock usePermission hook
const mockCan = vi.fn();
vi.mock('@/hooks/usePermission', () => ({
  usePermission: () => ({ can: mockCan, role: 'ENGINEER', isOffline: false }),
}));

describe('RoleGuard', () => {
  it('renders children when permission granted', () => {
    mockCan.mockReturnValue(true);
    render(
      <RoleGuard field="metalPrice">
        <span>Visible</span>
      </RoleGuard>
    );
    expect(screen.getByText('Visible')).toBeInTheDocument();
  });

  it('renders nothing when permission denied (default fallback)', () => {
    mockCan.mockReturnValue(false);
    const { container } = render(
      <RoleGuard field="profit">
        <span>Hidden</span>
      </RoleGuard>
    );
    expect(container.textContent).toBe('');
  });

  it('renders custom fallback when denied', () => {
    mockCan.mockReturnValue(false);
    render(
      <RoleGuard field="costRates" fallback={<span>无权限</span>}>
        <span>Admin Panel</span>
      </RoleGuard>
    );
    expect(screen.getByText('无权限')).toBeInTheDocument();
    expect(screen.queryByText('Admin Panel')).not.toBeInTheDocument();
  });

  it('renders read-only wrapper when readOnlyFallback', () => {
    mockCan.mockReturnValue(false);
    render(
      <RoleGuard field="bomEdit" readOnlyFallback>
        <span>Editable Content</span>
      </RoleGuard>
    );
    expect(screen.getByText('Editable Content')).toBeInTheDocument();
    const wrapper = screen.getByText('Editable Content').parentElement!;
    expect(wrapper.style.pointerEvents).toBe('none');
    expect(wrapper.style.opacity).toBe('0.5');
    expect(wrapper.getAttribute('aria-disabled')).toBe('true');
  });
});
