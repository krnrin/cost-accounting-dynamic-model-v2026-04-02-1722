import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from './db';
import {
  buildRemoteHarnessPayload,
  buildRemoteScenarioUpdatePayload,
  syncScenarioWorkspaceToDexie,
  type ScenarioWorkspaceBundle,
} from './serverScenarioSync';

describe('serverScenarioSync', () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
  });

  it('syncs server scenario workspace into Dexie and rebuilds onetime costs from allocation items', async () => {
    const bundle: ScenarioWorkspaceBundle = {
      project: {
        id: 'p-sync',
        projectCode: 'E281',
        projectName: 'E281',
        customer: 'Geely',
        platform: 'E281',
        status: 'quoted',
        costRates: { laborRate: 35, mfgRate: 46.69, wasteRate: 0.01, mgmtRate: 0.06, profitRate: 0.056627 },
        metalPrices: { copper: 76450, aluminum: 18910 },
        volumes: [{ year: 1, volume: 85000 }],
        createdAt: '2026-04-20T00:00:00.000Z',
        updatedAt: '2026-04-20T00:00:00.000Z',
      },
      scenario: {
        id: 's-sync',
        projectId: 'p-sync',
        type: 'initial_quote',
        name: 'Baseline',
        status: 'draft',
        lifecycleYears: 6,
        volume: 600000,
        installRatio: 1,
        config: {
          costRates: { laborRate: 35, mfgRate: 46.69, wasteRate: 0.01, mgmtRate: 0.06, profitRate: 0.056627 },
          metalPrices: { copper: 76450, aluminum: 18910 },
          volumes: [{ year: 1, volume: 85000 }],
          annualDropRate: 0.02,
        },
        vehicleConfigs: [],
        configSkus: [],
        harnessConfigMappings: [],
        vehicleConfigMeta: { publishState: 'sales_published' },
        rateSnapshot: {},
        quoteParamSnapshot: {},
        createdAt: '2026-04-20T00:00:00.000Z',
        updatedAt: '2026-04-20T00:00:00.000Z',
      },
      harnesses: [
        {
          id: 'h-1',
          projectId: 'p-sync',
          scenarioId: 's-sync',
          harnessId: '6608491523',
          harnessName: 'HV Harness 1',
          input: {
            harnessId: '6608491523',
            harnessName: 'HV Harness 1',
            vehicleRatio: 0.525,
            bom: [],
            frontHours: 0,
            backHours: 0,
            packaging: { innerBoxCost: 0, outerBoxCost: 0, palletCost: 0, trayDividerCost: 0, bubbleWrapCost: 0, labelCost: 0, subtotal: 0 },
            freight: { freight: 0, excessFreight: 0, shortHaul: 0, thirdPartyWarehouse: 0, storage: 0, subtotal: 0 },
          } as any,
          updatedAt: '2026-04-20T00:00:00.000Z',
        },
      ],
      allocationItems: [
        {
          id: 'alloc-tooling',
          projectId: 'p-sync',
          scenarioId: 's-sync',
          harnessId: '6608491523',
          expenseType: 'tooling',
          expenseName: 'tooling',
          totalAmount: 88000,
          allocationBasis: 'amortized',
          baselineVolume: 50000,
          unitAllocation: 1.76,
          plannedRecovery: 88000,
          actualRecovered: 0,
          remainingRecovery: 88000,
          recoveryProgress: 0,
          burdenSide: 'supplier',
          pricingEffect: 'included_in_price',
          recoveryCompletionBehavior: 'notify_only',
          priceAdjustReminder: false,
          status: 'pending',
          latestCumulativeVolume: 0,
          latestInstallRatioSnapshot: 0.525,
          latestRecoveryPeriod: null,
          createdAt: '2026-04-20T00:00:00.000Z',
          updatedAt: '2026-04-20T00:00:00.000Z',
        },
        {
          id: 'alloc-testing',
          projectId: 'p-sync',
          scenarioId: 's-sync',
          harnessId: '6608491523',
          expenseType: 'testing',
          expenseName: 'testing',
          totalAmount: 222000,
          allocationBasis: 'amortized',
          baselineVolume: 50000,
          unitAllocation: 4.44,
          plannedRecovery: 222000,
          actualRecovered: 0,
          remainingRecovery: 222000,
          recoveryProgress: 0,
          burdenSide: 'supplier',
          pricingEffect: 'included_in_price',
          recoveryCompletionBehavior: 'notify_only',
          priceAdjustReminder: false,
          status: 'pending',
          latestCumulativeVolume: 0,
          latestInstallRatioSnapshot: 0.525,
          latestRecoveryPeriod: null,
          createdAt: '2026-04-20T00:00:00.000Z',
          updatedAt: '2026-04-20T00:00:00.000Z',
        },
      ],
    };

    await syncScenarioWorkspaceToDexie(bundle);

    const project = await db.projects.get('p-sync');
    const scenario = await db.scenarios.get('s-sync');
    const harnesses = await db.harnesses.where('scenarioId').equals('s-sync').toArray();
    const onetimeCosts = await db.onetimeCosts.where('scenarioId').equals('s-sync').toArray();

    expect(project?.meta.projectCode).toBe('E281');
    expect(scenario?.config.metalPrices.copper).toBe(76450);
    expect(harnesses).toHaveLength(1);
    expect(onetimeCosts).toHaveLength(1);
    expect(onetimeCosts[0]?.input.toolingCost).toBe(88000);
    expect(onetimeCosts[0]?.input.testingCost).toBe(222000);
    expect(onetimeCosts[0]?.vehicleRatio).toBe(0.525);
  });

  it('maps local scenario and harness workspace back to the server payload shape', () => {
    const scenarioPayload = buildRemoteScenarioUpdatePayload({
      id: 's-sync',
      projectId: 'p-sync',
      scenarioCode: 'SCN-001',
      scenarioName: 'Quote raw workbook',
      scenarioType: 'customer_award',
      parentScenarioId: null,
      isBaseline: false,
      lifecycleYears: 6,
      config: {
        costRates: { laborRate: 35, mfgRate: 46.69, wasteRate: 0.01, mgmtRate: 0.06, profitRate: 0.056627 },
        metalPrices: { copper: 76450, aluminum: 18910 },
        volumes: [{ year: 1, volume: 85000 }, { year: 2, volume: 135000 }],
        annualDropRate: 0.03,
      },
      note: 'Award scenario corrected from audit result',
      vehicleConfigs: [],
      configSkus: [],
      harnessConfigMappings: [],
      vehicleConfigMeta: { publishState: 'sales_published' },
      status: 'published',
      createdAt: '2026-04-20T00:00:00.000Z',
      updatedAt: '2026-04-20T00:00:00.000Z',
    });

    const harnessPayload = buildRemoteHarnessPayload({
      id: 'h-sync',
      projectId: 'p-sync',
      scenarioId: 's-sync',
      harnessId: '6608491523',
      harnessName: 'HV Harness 1',
      input: {
        harnessId: '6608491523',
        harnessName: 'HV Harness 1',
        vehicleRatio: 0.525,
        bom: [],
        frontHours: 0.1,
        backHours: 0.2,
        packaging: { innerBoxCost: 0, outerBoxCost: 0, palletCost: 0, trayDividerCost: 0, bubbleWrapCost: 0, labelCost: 0, subtotal: 0 },
        freight: { freight: 0, excessFreight: 0, shortHaul: 0, thirdPartyWarehouse: 0, storage: 0, subtotal: 0 },
      } as any,
      updatedAt: '2026-04-20T00:00:00.000Z',
    });

    expect(scenarioPayload.type).toBe('fixed_point');
    expect(scenarioPayload.volume).toBe(220000);
    expect(scenarioPayload.vehicleConfigMeta.publishState).toBe('sales_published');
    expect(harnessPayload.scenarioId).toBe('s-sync');
    expect(harnessPayload.input.harnessId).toBe('6608491523');
  });
});
