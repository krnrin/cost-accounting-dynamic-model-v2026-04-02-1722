import { describe, it, expect } from 'vitest';
import { render, screen } from '../test/test-utils';
import KpiCard from './KpiCard';
import React from 'react';

describe('KpiCard', () => {
  it('renders label and value correctly', () => {
    render(<KpiCard label="Total Cost" value="1000" />);
    expect(screen.getByText('Total Cost')).toBeInTheDocument();
    expect(screen.getByText('1000')).toBeInTheDocument();
  });

  it('renders with prefix', () => {
    render(<KpiCard label="Revenue" value="500" prefix="$" />);
    expect(screen.getByText('$500')).toBeInTheDocument();
  });

  it('renders with unit (suffix)', () => {
    render(<KpiCard label="Margin" value="20" unit="%" />);
    expect(screen.getByText('20%')).toBeInTheDocument();
  });

  it('handles numeric values with fixed precision', () => {
    render(<KpiCard label="Average" value={123.456} prefix="¥" unit="k" />);
    // toFixed(2) makes it 123.46
    expect(screen.getByText('¥123.46k')).toBeInTheDocument();
  });
});
