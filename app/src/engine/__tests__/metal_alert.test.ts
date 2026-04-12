import { describe, it, expect } from 'vitest';
import { computeMetalAlerts, estimateMetalImpact, DEFAULT_METAL_THRESHOLDS } from '../metal_alert';

describe('computeMetalAlerts', () => {
  const base = { copper: 68400, aluminum: 18200 };

  it('returns normal when within thresholds', () => {
    const r = computeMetalAlerts(base, { copper: 69000, aluminum: 18500 });
    expect(r.hasAlert).toBe(false);
    expect(r.maxLevel).toBe('normal');
    expect(r.items).toHaveLength(2);
    expect(r.items[0].level).toBe('normal');
    expect(r.items[1].level).toBe('normal');
  });

  it('returns warn when copper exceeds warn threshold', () => {
    // 5% of 68400 = 3420 → 72000 is ~5.26%
    const r = computeMetalAlerts(base, { copper: 72000, aluminum: 18200 });
    expect(r.hasAlert).toBe(true);
    expect(r.items[0].level).toBe('warn');
    expect(r.items[0].message).toContain('预警');
  });

  it('returns danger when copper exceeds danger threshold', () => {
    // 10% of 68400 = 6840 → 76000 is ~11.1%
    const r = computeMetalAlerts(base, { copper: 76000, aluminum: 18200 });
    expect(r.maxLevel).toBe('danger');
    expect(r.items[0].level).toBe('danger');
    expect(r.items[0].message).toContain('危险');
  });

  it('detects aluminum alert independently', () => {
    // 10% of 18200 = 1820 → 20200 is ~11%
    const r = computeMetalAlerts(base, { copper: 68400, aluminum: 20200 });
    expect(r.hasAlert).toBe(true);
    expect(r.items[1].level).toBe('danger');
  });

  it('maxLevel is danger when any item is danger', () => {
    const r = computeMetalAlerts(base, { copper: 76000, aluminum: 18200 });
    expect(r.maxLevel).toBe('danger');
  });

  it('handles price decrease', () => {
    // -5.3% copper
    const r = computeMetalAlerts(base, { copper: 64800, aluminum: 18200 });
    expect(r.hasAlert).toBe(true);
    expect(r.items[0].deltaPct).toBeLessThan(0);
    expect(r.items[0].message).toContain('下跌');
  });

  it('uses custom thresholds', () => {
    const custom = {
      copper: { warnPct: 20, dangerPct: 30 },
      aluminum: { warnPct: 20, dangerPct: 30 },
    };
    const r = computeMetalAlerts(base, { copper: 76000, aluminum: 18200 }, custom);
    expect(r.hasAlert).toBe(false); // 11% < 20%
  });
});

describe('estimateMetalImpact', () => {
  it('computes impact from price change and weight', () => {
    const base = { copper: 68400, aluminum: 18200 };
    const current = { copper: 70400, aluminum: 18200 };
    const r = estimateMetalImpact(base, current, 2.0, 0.5);
    // cuImpact = (70400-68400)/1000 * 2.0 = 4.0
    expect(r.cuImpact).toBeCloseTo(4.0);
    expect(r.alImpact).toBeCloseTo(0);
    expect(r.totalImpact).toBeCloseTo(4.0);
  });

  it('handles both metals changing', () => {
    const base = { copper: 68400, aluminum: 18200 };
    const current = { copper: 78400, aluminum: 20200 };
    const r = estimateMetalImpact(base, current, 1.0, 1.0);
    // cuImpact = 10000/1000 * 1.0 = 10
    // alImpact = 2000/1000 * 1.0 = 2
    expect(r.cuImpact).toBeCloseTo(10);
    expect(r.alImpact).toBeCloseTo(2);
    expect(r.totalImpact).toBeCloseTo(12);
  });

  it('returns zero when prices unchanged', () => {
    const base = { copper: 68400, aluminum: 18200 };
    const r = estimateMetalImpact(base, base, 5, 3);
    expect(r.totalImpact).toBe(0);
  });
});

describe('DEFAULT_METAL_THRESHOLDS', () => {
  it('has expected defaults', () => {
    expect(DEFAULT_METAL_THRESHOLDS.copper.warnPct).toBe(5);
    expect(DEFAULT_METAL_THRESHOLDS.copper.dangerPct).toBe(10);
    expect(DEFAULT_METAL_THRESHOLDS.aluminum.warnPct).toBe(5);
    expect(DEFAULT_METAL_THRESHOLDS.aluminum.dangerPct).toBe(10);
  });
});
