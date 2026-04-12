import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '../test/test-utils';
import NotFoundPage from './NotFoundPage';
import React from 'react';

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe('NotFoundPage', () => {
  it('renders 404 title and description', () => {
    render(<NotFoundPage />);
    expect(screen.getByText(/404 — 页面未找到/i)).toBeInTheDocument();
    expect(screen.getByText(/您访问的页面不存在或已被移除/i)).toBeInTheDocument();
  });

  it('navigates to home when button clicked', () => {
    render(<NotFoundPage />);
    const button = screen.getByRole('button', { name: /返回首页/i });
    fireEvent.click(button);
    
    expect(mockNavigate).toHaveBeenCalledWith('/');
  });
});
