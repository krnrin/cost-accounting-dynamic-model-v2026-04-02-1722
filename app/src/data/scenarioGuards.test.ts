import { describe, expect, it } from 'vitest';
import {
  hasScenarioVehicleConfigModel,
  requireScenarioConfig,
  requireScenarioOnetimeCosts,
  requireScenarioRecord,
} from './scenarioGuards';

describe('scenarioGuards', () => {
  it('returns scenario record when present', () => {
    const scenario = requireScenarioRecord(
      {
        id: 's1',
        scenarioCode: 'SCN-001',
        scenarioName: 'baseline',
      } as any,
      'test',
    );

    expect(scenario.id).toBe('s1');
  });

  it('returns config when scenario config is complete', () => {
    const config = requireScenarioConfig(
      {
        id: 's1',
        scenarioCode: 'SCN-001',
        scenarioName: 'baseline',
        config: {
          costRates: { laborRate: 35, mfgRate: 46.69, wasteRate: 0.01, mgmtRate: 0.06, profitRate: 0.05 },
          metalPrices: { copper: 76000, aluminum: 19000 },
          volumes: [{ year: 1, volume: 1000 }],
          annualDropRate: 0.02,
        },
      } as any,
      'test',
    );

    expect(config.metalPrices.copper).toBe(76000);
  });

  it('throws when scenario is missing', () => {
    expect(() => requireScenarioRecord(null, 'dashboard')).toThrow(/scenario not found/);
  });

  it('throws when scenario config is incomplete', () => {
    expect(() =>
      requireScenarioConfig(
        {
          id: 's1',
          scenarioCode: 'SCN-001',
          scenarioName: 'baseline',
          config: {
            costRates: { laborRate: 35, mfgRate: 46.69, wasteRate: 0.01, mgmtRate: 0.06, profitRate: 0.05 },
          },
        } as any,
        'dashboard',
      ),
    ).toThrow(/missing required config/);
  });

  it('throws when onetime costs are missing', () => {
    expect(() => requireScenarioOnetimeCosts([], 'scn-1')).toThrow(/no persisted one-time cost data/);
  });

  it('returns false when scenario has no vehicle configuration model', () => {
    expect(
      hasScenarioVehicleConfigModel({
        vehicleConfigs: [],
        configSkus: [],
      } as any),
    ).toBe(false);
  });

  it('returns true when scenario has config skus', () => {
    expect(
      hasScenarioVehicleConfigModel({
        configSkus: [{ skuId: 'cm010' }],
      } as any),
    ).toBe(true);
  });
});
