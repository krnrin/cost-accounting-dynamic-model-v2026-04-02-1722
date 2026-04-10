import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from './db';
import { forkScenario } from './scenarioFork';
import { applyE281ScenarioFallback, getScenarioOnetimeCostFallback } from './e281Fallback';

const now = '2026-04-10T00:00:00.000Z';

describe('scenarioFork', () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
  });

  it('旧 E281 场景会自动补 customerQuoteSnapshots、vehicleConfigs 和 onetimeCosts', async () => {
    const scenario = applyE281ScenarioFallback({
      id: 'e281-scn-legacy',
      projectId: 'e281-quote',
      scenarioCode: 'SCN-999',
      scenarioName: 'Legacy E281',
      scenarioType: 'final_quote',
      parentScenarioId: null,
      isBaseline: true,
      lifecycleYears: 6,
      config: {
        costRates: { laborRate: 35, mfgRate: 46.69, wasteRate: 0.01, mgmtRate: 0.06, profitRate: 0.056627 },
        metalPrices: { copper: 76450, aluminum: 18910 },
        volumes: [],
      } as any,
      note: '',
      createdAt: now,
      updatedAt: now,
    });
    const onetimeCosts = getScenarioOnetimeCostFallback(scenario);

    expect(scenario.config.customerQuoteSnapshots?.['6608516992']?.deliveredPrice).toBeCloseTo(101.26720536438722);
    expect(scenario.vehicleConfigs?.some(cfg => cfg.harnessIds.includes('6608516992'))).toBe(true);
    expect(scenario.vehicleConfigMeta?.publishState).toBe('sales_published');
    expect(onetimeCosts.find(r => r.harnessId === '6608491523')?.input.toolingCost).toBe(88000);
  });

  it('旧 E281 场景派生后也会带上回退的 customerQuoteSnapshots、vehicleConfigs 和 onetimeCosts', async () => {
    await db.projects.put({
      id: 'e281-quote',
      meta: {
        projectCode: 'E281',
        projectName: '吉利E281高压线束',
        customer: '吉利汽车',
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
      } as any,
    });

    await db.scenarios.put({
      id: 'e281-legacy',
      projectId: 'e281-quote',
      scenarioCode: 'SCN-001',
      scenarioName: 'Legacy 基准',
      scenarioType: 'final_quote',
      parentScenarioId: null,
      isBaseline: true,
      lifecycleYears: 6,
      config: {
        costRates: { laborRate: 35, mfgRate: 46.69, wasteRate: 0.01, mgmtRate: 0.06, profitRate: 0.056627 },
        metalPrices: { copper: 76450, aluminum: 18910 },
        volumes: [],
      } as any,
      note: '',
      createdAt: now,
      updatedAt: now,
    });

    await db.harnesses.put({
      id: 'e281-h1',
      projectId: 'e281-quote',
      scenarioId: 'e281-legacy',
      harnessId: '6608516992',
      harnessName: '测试线束',
      eopYear: null,
      updatedAt: now,
      input: {
        harnessId: '6608516992',
        harnessName: '测试线束',
        vehicleRatio: 0.225,
        bom: [],
        frontHours: 0,
        backHours: 0,
        packaging: { innerBoxCost: 0, outerBoxCost: 0, palletCost: 0, trayDividerCost: 0, bubbleWrapCost: 0, labelCost: 0, subtotal: 0 },
        freight: { freight: 0, excessFreight: 0, shortHaul: 0, thirdPartyWarehouse: 0, storage: 0, subtotal: 0 },
      },
    });

    const newId = await forkScenario('e281-legacy', {
      name: 'Legacy 派生',
      type: 'custom',
      inheritAllocProgress: true,
    });

    const forked = await db.scenarios.get(newId);
    const forkedCosts = await db.onetimeCosts.where('scenarioId').equals(newId).toArray();

    expect(forked?.config.customerQuoteSnapshots?.['6608516992']?.deliveredPrice).toBeCloseTo(101.26720536438722);
    expect(forked?.vehicleConfigs?.some(cfg => cfg.harnessIds.includes('6608516992'))).toBe(true);
    expect(forked?.vehicleConfigMeta?.publishState).toBe('sales_published');
    expect(forkedCosts.find(c => c.harnessId === '6608491523')?.input.toolingCost).toBe(88000);
    expect(forkedCosts.find(c => c.harnessId === '6608516992')?.input.allocBase).toBe(50000);
  });

  it('fork 时保留 vehicleConfigs 和 vehicleConfigMeta', async () => {
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
      } as any,
    });

    await db.scenarios.put({
      id: 's1',
      projectId: 'p1',
      scenarioCode: 'SCN-001',
      scenarioName: '基准',
      scenarioType: 'final_quote',
      parentScenarioId: null,
      isBaseline: true,
      lifecycleYears: 6,
      config: {
        costRates: { laborRate: 35, mfgRate: 46.69, wasteRate: 0.01, mgmtRate: 0.06, profitRate: 0.056627 },
        metalPrices: { copper: 76450, aluminum: 18910 },
        volumes: [],
      } as any,
      note: '',
      vehicleConfigs: [
        { configId: 'cfg-1', configName: '配置1', salesRatio: 0.6, harnessIds: ['6601', '6602'] },
        { configId: 'cfg-2', configName: '配置2', salesRatio: 0.4, harnessIds: ['6603'] },
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
      harnessName: '测试线束',
      eopYear: null,
      updatedAt: now,
      input: {
        harnessId: '6601',
        harnessName: '测试线束',
        vehicleRatio: 0.6,
        bom: [],
        frontHours: 0,
        backHours: 0,
        packaging: { innerBoxCost: 0, outerBoxCost: 0, palletCost: 0, trayDividerCost: 0, bubbleWrapCost: 0, labelCost: 0, subtotal: 0 },
        freight: { freight: 0, excessFreight: 0, shortHaul: 0, thirdPartyWarehouse: 0, storage: 0, subtotal: 0 },
      },
    });

    const newId = await forkScenario('s1', {
      name: '派生场景',
      type: 'custom',
      inheritAllocProgress: true,
    });

    const forked = await db.scenarios.get(newId);
    expect(forked?.vehicleConfigs).toEqual([
      { configId: 'cfg-1', configName: '配置1', salesRatio: 0.6, harnessIds: ['6601', '6602'] },
      { configId: 'cfg-2', configName: '配置2', salesRatio: 0.4, harnessIds: ['6603'] },
    ]);
    expect(forked?.vehicleConfigMeta).toEqual({
      publishState: 'sales_published',
      engineerPublishedAt: now,
      salesPublishedAt: now,
    });
  });
});
