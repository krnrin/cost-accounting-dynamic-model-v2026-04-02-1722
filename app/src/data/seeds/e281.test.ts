import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../db';
import { buildE281BaselineImportPayload, importE281BaselineIntoScenario } from './e281';

const now = '2026-04-20T00:00:00.000Z';

describe('E281 baseline import', () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
  });

  it('imports the E281 baseline into an existing empty scenario', async () => {
    await db.projects.put({
      id: 'p-e281',
      meta: {
        projectCode: 'E281',
        projectName: 'E281 data entry',
        customer: 'Geely',
        platform: 'E281',
        lifecycleYears: 6,
        createdAt: now,
        updatedAt: now,
        status: 'draft',
      },
      config: {
        costRates: { laborRate: 35, mfgRate: 45, wasteRate: 0.01, mgmtRate: 0.06, profitRate: 0.05 },
        metalPrices: { copper: 65000, aluminum: 18000 },
        volumes: [],
        annualDropRate: 0.02,
      },
    });

    await db.scenarios.put({
      id: 's-e281',
      projectId: 'p-e281',
      scenarioCode: 'SCN-001',
      scenarioName: 'Initial',
      scenarioType: 'initial_quote',
      parentScenarioId: null,
      isBaseline: true,
      lifecycleYears: 6,
      config: {
        costRates: { laborRate: 35, mfgRate: 45, wasteRate: 0.01, mgmtRate: 0.06, profitRate: 0.05 },
        metalPrices: { copper: 65000, aluminum: 18000 },
        volumes: [],
        annualDropRate: 0.02,
      },
      note: '',
      createdAt: now,
      updatedAt: now,
    });

    await db.harnesses.put({
      id: 'old-harness',
      projectId: 'p-e281',
      scenarioId: 's-e281',
      harnessId: 'old',
      harnessName: 'old',
      eopYear: null,
      updatedAt: now,
      input: {
        harnessId: 'old',
        harnessName: 'old',
        vehicleRatio: 0,
        bom: [],
        frontHours: 0,
        backHours: 0,
        packaging: { innerBoxCost: 0, outerBoxCost: 0, palletCost: 0, trayDividerCost: 0, bubbleWrapCost: 0, labelCost: 0, subtotal: 0 },
        freight: { freight: 0, excessFreight: 0, shortHaul: 0, thirdPartyWarehouse: 0, storage: 0, subtotal: 0 },
      },
    });

    const result = await importE281BaselineIntoScenario({
      projectId: 'p-e281',
      scenarioId: 's-e281',
    });

    expect(result).toEqual({ harnessCount: 11, onetimeCostCount: 11, configCount: 7 });

    const project = await db.projects.get('p-e281');
    expect(project?.meta.projectCode).toBe('E281');
    expect(project?.config?.metalPrices.copper).toBe(76450);
    expect(project?.config?.volumes.map((item) => item.volume)).toEqual([85000, 135000, 125000, 114000, 94000, 47000]);

    const scenario = await db.scenarios.get('s-e281');
    expect(scenario?.vehicleConfigMeta?.publishState).toBe('sales_published');
    expect(scenario?.configSkus).toHaveLength(4);
    expect(scenario?.configSkus?.find((sku) => sku.skuId === 'cm030')?.ptcOptionalRatio).toBe(0);
    expect(scenario?.vehicleConfigs?.some((config) => config.skuId === 'cm030' && config.sliceType === 'optional')).toBe(false);

    const harnesses = await db.harnesses.where('scenarioId').equals('s-e281').toArray();
    expect(harnesses).toHaveLength(11);
    expect(harnesses.find((item) => item.harnessId === '6608491524')?.input.vehicleRatio).toBe(0.15);
    expect(harnesses.find((item) => item.harnessId === 'old')).toBeUndefined();
    expect(harnesses.every((item) => (item.input.bom?.length ?? 0) > 0)).toBe(true);

    const onetimeCosts = await db.onetimeCosts.where('scenarioId').equals('s-e281').toArray();
    expect(onetimeCosts).toHaveLength(11);
    expect(onetimeCosts.find((item) => item.harnessId === '6608491523')?.input.toolingCost).toBe(88000);

    const trackingItems = await db.trackingItems.where('scenarioId').equals('s-e281').toArray();
    expect(trackingItems).toHaveLength(1);
    expect(trackingItems[0]?.harnessId).toBe('6608516992');
  });

  it('builds a server baseline payload with scenario config, harnesses, and allocation rows', () => {
    const payload = buildE281BaselineImportPayload();

    expect(payload.project.meta.projectCode).toBe('E281');
    expect(payload.scenario.configSkus).toHaveLength(4);
    expect(payload.scenario.vehicleConfigs).toHaveLength(7);
    expect(payload.harnesses).toHaveLength(11);
    expect(payload.allocationRows).toHaveLength(11);
    expect(payload.trackingItems).toHaveLength(1);
    expect(payload.scenario.configSkus.find((item) => item.skuId === 'cm030')?.ptcOptionalRatio).toBe(0);
    expect(payload.allocationRows.find((item) => item.harnessId === '6608491523')?.toolingCost).toBe(88000);
  });
});
