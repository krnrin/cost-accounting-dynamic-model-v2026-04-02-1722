import { describe, expect, it } from 'vitest';
import {
  EMPTY_FREIGHT_COST,
  EMPTY_PACKAGING_COST,
  createMinimalHarnessInput,
  normalizeHarnessRecordInput,
} from '@/lib/harnessInputDefaults';

describe('harnessInputDefaults', () => {
  it('creates a minimal valid harness input', () => {
    const input = createMinimalHarnessInput({
      harnessId: 'H-001',
      harnessName: 'Harness 001',
    });

    expect(input).toMatchObject({
      harnessId: 'H-001',
      harnessName: 'Harness 001',
      vehicleRatio: 0,
      frontHours: 0,
      backHours: 0,
      bom: [],
      packaging: EMPTY_PACKAGING_COST,
      freight: EMPTY_FREIGHT_COST,
    });
  });

  it('normalizes partial persisted input with fallback identity', () => {
    const input = normalizeHarnessRecordInput(
      {
        vehicleRatio: 0.15,
        bom: undefined,
      },
      {
        harnessId: 'H-002',
        harnessName: 'Harness 002',
      },
    );

    expect(input.harnessId).toBe('H-002');
    expect(input.harnessName).toBe('Harness 002');
    expect(input.vehicleRatio).toBe(0.15);
    expect(input.bom).toEqual([]);
    expect(input.packaging).toEqual(EMPTY_PACKAGING_COST);
    expect(input.freight).toEqual(EMPTY_FREIGHT_COST);
  });
});
