import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from './db';
import { forkScenario } from './scenarioFork';

const now = '2026-04-10T00:00:00.000Z';

describe('scenarioFork', () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
  });

  it('throws when parent scenario has no stored onetime costs', async () => {
    await db.projects.put({
      id: 'e281-quote',
      meta: {
        projectCode: 'E281',
        projectName: 'Geely E281 HV Harness',
        customer: 'Geely',
        platform: 'E281',
        lifecycleYears: 6,
        createdAt: now,
        updatedAt: now,
        status: 'quoted',
      },
      config: {
        costRates: { laborRate: 35, mfgRate: 46.69, wasteRate: 0.01, mgmtRate: 0.06, profitRate: 0.056627 },
        metalPrices: { copper: 76450, aluminum: 18910 },
        volumes: [],
        annualDropRate: 0.02,
      } as any,
    });

    await db.scenarios.put({
      id: 'e281-legacy',
      projectId: 'e281-quote',
      scenarioCode: 'SCN-001',
      scenarioName: 'Legacy baseline',
      scenarioType: 'final_quote',
      parentScenarioId: null,
      isBaseline: true,
      lifecycleYears: 6,
      config: {
        costRates: { laborRate: 35, mfgRate: 46.69, wasteRate: 0.01, mgmtRate: 0.06, profitRate: 0.056627 },
        metalPrices: { copper: 76450, aluminum: 18910 },
        volumes: [],
        annualDropRate: 0.02,
      } as any,
      note: '',
      createdAt: now,
      updatedAt: now,
    });

    await expect(
      forkScenario('e281-legacy', {
        name: 'Legacy child',
        type: 'custom',
        inheritAllocProgress: true,
      }),
    ).rejects.toThrow(/no persisted one-time cost data/);
  });

  it('fork keeps vehicle configs and copies stored onetime costs', async () => {
    await db.projects.put({
      id: 'p1',
      meta: {
        projectCode: 'P1',
        projectName: 'Test Project',
        customer: 'Test Customer',
        platform: 'P1',
        lifecycleYears: 6,
        createdAt: now,
        updatedAt: now,
        status: 'quoted',
      },
      config: {
        costRates: { laborRate: 35, mfgRate: 46.69, wasteRate: 0.01, mgmtRate: 0.06, profitRate: 0.056627 },
        metalPrices: { copper: 76450, aluminum: 18910 },
        volumes: [],
        annualDropRate: 0.02,
      } as any,
    });

    await db.scenarios.put({
      id: 's1',
      projectId: 'p1',
      scenarioCode: 'SCN-001',
      scenarioName: 'Baseline',
      scenarioType: 'final_quote',
      parentScenarioId: null,
      isBaseline: true,
      lifecycleYears: 6,
      config: {
        costRates: { laborRate: 35, mfgRate: 46.69, wasteRate: 0.01, mgmtRate: 0.06, profitRate: 0.056627 },
        metalPrices: { copper: 76450, aluminum: 18910 },
        volumes: [],
        annualDropRate: 0.02,
      } as any,
      note: '',
      vehicleConfigs: [
        { configId: 'cfg-1', configName: 'Config 1', salesRatio: 0.6, harnessIds: ['6601', '6602'] },
        { configId: 'cfg-2', configName: 'Config 2', salesRatio: 0.4, harnessIds: ['6603'] },
      ],
      configSkus: [
        {
          skuId: 'sku-1',
          cmCode: 'CM001',
          skuName: 'Test SKU',
          mixRatio: 1,
          drivetrain: 'rwd',
          ptcAvailable: false,
          ptcOptionalRatio: 0,
        },
      ],
      harnessConfigMappings: [
        { harnessId: '6601', skuId: 'sku-1', sliceType: 'standard', installationRatio: 1 },
      ],
      vehicleConfigMeta: {
        publishState: 'sales_published',
        engineerPublishedAt: now,
        salesPublishedAt: now,
      },
      createdAt: now,
      updatedAt: now,
    });

    await db.harnesses.put({
      id: 'h1',
      projectId: 'p1',
      scenarioId: 's1',
      harnessId: '6601',
      harnessName: 'Test Harness',
      eopYear: null,
      updatedAt: now,
      input: {
        harnessId: '6601',
        harnessName: 'Test Harness',
        vehicleRatio: 0.6,
        bom: [],
        frontHours: 0,
        backHours: 0,
        packaging: { innerBoxCost: 0, outerBoxCost: 0, palletCost: 0, trayDividerCost: 0, bubbleWrapCost: 0, labelCost: 0, subtotal: 0 },
        freight: { freight: 0, excessFreight: 0, shortHaul: 0, thirdPartyWarehouse: 0, storage: 0, subtotal: 0 },
      },
    });

    await db.onetimeCosts.put({
      id: 's1::6601',
      projectId: 'p1',
      scenarioId: 's1',
      harnessId: '6601',
      harnessName: 'Test Harness',
      vehicleRatio: 0.6,
      input: {
        harnessId: '6601',
        harnessName: 'Test Harness',
        vehicleRatio: 0.6,
        toolingCost: 1000,
        testingCost: 2000,
        allocBase: 5000,
        paymentMode: 'amortized',
      },
      updatedAt: now,
    });

    const newId = await forkScenario('s1', {
      name: 'Child Scenario',
      type: 'custom',
      inheritAllocProgress: true,
    });

    const forked = await db.scenarios.get(newId);
    expect(forked?.vehicleConfigs).toEqual([
      { configId: 'cfg-1', configName: 'Config 1', salesRatio: 0.6, harnessIds: ['6601', '6602'] },
      { configId: 'cfg-2', configName: 'Config 2', salesRatio: 0.4, harnessIds: ['6603'] },
    ]);
    expect(forked?.configSkus).toEqual([
      {
        skuId: 'sku-1',
        cmCode: 'CM001',
        skuName: 'Test SKU',
        mixRatio: 1,
        drivetrain: 'rwd',
        ptcAvailable: false,
        ptcOptionalRatio: 0,
      },
    ]);
    expect(forked?.harnessConfigMappings).toEqual([
      { harnessId: '6601', skuId: 'sku-1', sliceType: 'standard', installationRatio: 1 },
    ]);
    expect(forked?.vehicleConfigMeta).toEqual({
      publishState: 'sales_published',
      engineerPublishedAt: now,
      salesPublishedAt: now,
    });

    const forkedCosts = await db.onetimeCosts.where('scenarioId').equals(newId).toArray();
    expect(forkedCosts).toHaveLength(1);
    expect(forkedCosts[0]?.input.toolingCost).toBe(1000);
  });
});
