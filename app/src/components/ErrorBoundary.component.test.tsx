import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '../test/test-utils';
import ErrorBoundary from './ErrorBoundary';
import React from 'react';

const ThrowError = () => {
  throw new Error('Test Error');
};

describe('ErrorBoundary', () => {
  const originalError = console.error;
  
  beforeEach(() => {
    console.error = vi.fn();
  });

  afterEach(() => {
    console.error = originalError;
  });

  it('renders children when no error', () => {
    render(
      <ErrorBoundary>
        <div>Safe Content</div>
      </ErrorBoundary>
    );
    expect(screen.getByText('Safe Content')).toBeInTheDocument();
  });

  it('shows fallback UI when child throws', () => {
    render(
      <ErrorBoundary>
        <ThrowError />
      </ErrorBoundary>
    );
    expect(screen.getByText('页面出错了')).toBeInTheDocument();
    expect(screen.getByText('Test Error')).toBeInTheDocument();
  });

  it('has a functional reset button', () => {
    const { location } = window;
    // @ts-ignore
    delete window.location;
    window.location = { ...location, href: '' } as any;

    render(
      <ErrorBoundary>
        <ThrowError />
      </ErrorBoundary>
    );
    
    const button = screen.getByRole('button', { name: /返回首页/i });
    fireEvent.click(button);
    
    expect(window.location.href).toBe('/');
    
    window.location = location;
  });
});
