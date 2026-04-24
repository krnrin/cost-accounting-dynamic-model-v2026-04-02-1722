import { describe, expect, it } from 'vitest';
import { checkParamBoundaries } from '../param_boundaries';

describe('param boundaries', () => {
  it('allows cost engineer to edit cost-engineer scoped fields within range', () => {
    const result = checkParamBoundaries(
      {
        laborRate: 35,
        copper: 65000,
      },
      'cost_engineer',
    );

    expect(result.valid).toBe(true);
    expect(result.violations).toEqual([]);
  });

  it('rejects fields that require admin when role is cost engineer', () => {
    const result = checkParamBoundaries(
      {
        profitRate: 0.08,
      },
      'cost_engineer',
    );

    expect(result.valid).toBe(false);
    expect(result.violations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: 'profitRate',
          action: 'rejected',
        }),
      ]),
    );
  });

  it('warns or rejects based on boundary policy', () => {
    const result = checkParamBoundaries(
      {
        laborRate: 300,
        wasteRate: 0.3,
      },
      'admin',
    );

    expect(result.valid).toBe(false);
    expect(result.violations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: 'laborRate',
          action: 'warned',
        }),
        expect.objectContaining({
          field: 'wasteRate',
          action: 'rejected',
        }),
      ]),
    );
  });
});
