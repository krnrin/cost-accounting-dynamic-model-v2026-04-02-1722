import path from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';
import { test, expect, type Page } from '@playwright/test';

const OUTPUT_DIR = path.resolve(process.cwd(), '..', 'output', 'playwright', 'e281-manual-flow');

type VolumeRow = {
  year: number;
  volume: number;
};

type E281HarnessSeed = {
  harnessId: string;
  harnessName: string;
  input: {
    harnessId: string;
    harnessName: string;
    vehicleRatio: number;
    configType?: 'S' | 'O';
    functionalSlot?: string;
    bom: Array<Record<string, unknown>>;
    frontHours: number;
    backHours: number;
    packaging: Record<string, number>;
    freight: Record<string, number>;
  };
};

type E281ScenarioPayload = {
  mode: 'quote_raw' | 'award_corrected';
  project: {
    meta: {
      projectCode: string;
      projectName: string;
      customer: string;
      platform?: string;
      lifecycleYears: number;
      status: string;
    };
    config: Record<string, unknown>;
  };
  scenario: {
    scenarioName: string;
    scenarioType: string;
    lifecycleYears: number;
    config: Record<string, unknown>;
    note: string;
    vehicleConfigs: Array<{
      configId: string;
      configName: string;
      salesRatio: number;
      harnessIds: string[];
    }>;
    vehicleConfigMeta: Record<string, unknown>;
    configSkus?: Array<Record<string, unknown>>;
    harnessConfigMappings?: Array<Record<string, unknown>>;
  };
  harnesses: E281HarnessSeed[];
  allocationRows: Array<{
    harnessId: string;
    harnessName: string;
    vehicleRatio: number;
    toolingCost: number;
    testingCost: number;
    rndCost: number;
    allocBase: number;
    paymentMode: 'amortized' | 'lumpsum' | 'mixed';
    cumProduced: number;
  }>;
  expectedHarnessResults: Array<{
    harnessId: string;
    harnessName: string;
    vehicleRatio: number;
    materialCost: number;
    exFactoryPrice: number;
    deliveredPrice: number;
  }>;
  expectedProjectResults?: {
    vehicleCost: number;
    weightedMaterial: number;
    weightedExFactory: number;
    weightedDelivered: number;
    harnessCount: number;
  };
  matrices: {
    configMatrix: Array<Array<string | number | null>>;
    salesRatioSheet: Array<Array<string | number | null>>;
    bomSheets: Array<{
      harnessId: string;
      harnessName: string;
      data: Array<Array<string | number | null>>;
    }>;
  };
};

async function ensureOutputDir() {
  await mkdir(OUTPUT_DIR, { recursive: true });
}

async function screenshot(page: Page, name: string) {
  await ensureOutputDir();
  await page.screenshot({
    path: path.join(OUTPUT_DIR, name),
    fullPage: true,
  });
}

async function fillByTestId(page: Page, testId: string, value: string) {
  const field = page.getByTestId(testId);
  await expect(field).toBeVisible({ timeout: 30000 });

  const directTag = await field.evaluate((node) => node.tagName.toLowerCase());
  if (directTag === 'input' || directTag === 'textarea') {
    await field.fill(value);
    return;
  }

  const innerInput = field.locator('input, textarea, [role="spinbutton"]').first();
  await expect(innerInput).toBeVisible({ timeout: 30000 });
  await innerInput.fill(value);
}

async function login(page: Page) {
  await page.goto('/');
  await page.waitForLoadState('domcontentloaded');

  const newProjectButton = page.locator('button').filter({ hasText: '新建项目' }).first();
  if (await newProjectButton.isVisible().catch(() => false)) {
    return;
  }

  await fillByTestId(page, 'login-email', 'admin@harness.dev');
  await fillByTestId(page, 'login-password', 'admin123');
  await page.getByTestId('login-submit').click();
  await page.waitForLoadState('networkidle');

  if (!(await newProjectButton.isVisible().catch(() => false))) {
    await page.reload({ waitUntil: 'load' });
  }

  await expect(newProjectButton).toBeVisible({ timeout: 15000 });
}

async function loadE281Payload(page: Page, mode: 'quote_raw' | 'award_corrected'): Promise<E281ScenarioPayload> {
  return page.evaluate(async (requestedMode) => {
    const { buildE281ScenarioPayload } = await import('/src/data/seeds/e281ScenarioPayload.ts');
    const { buildBomSheetRows, bomRowsToSheetData } = await import('/src/engine/bom_workbook_builders.ts');

    const payload = buildE281ScenarioPayload(requestedMode);
    const configColumnCount = 10;
    const vehicleConfigs = payload.scenario.vehicleConfigs;

    const configMatrix = [
      ['线束号', '线束名称', '标配/选配', ...Array.from({ length: configColumnCount }, (_, index) => vehicleConfigs[index]?.configName ?? '')],
      ...payload.harnesses.map((harness) => [
        harness.harnessId,
        harness.harnessName,
        harness.input.configType ?? '',
        ...Array.from({ length: configColumnCount }, (_, index) => (
          vehicleConfigs[index]?.harnessIds.includes(harness.harnessId) ? 1 : ''
        )),
      ]),
      ...Array.from({ length: 5 }, () => Array.from({ length: 3 + configColumnCount }, () => '')),
    ];

    const salesRatioSheet = [
      ['配置名称', '销售比例'],
      ...vehicleConfigs.map((config) => [config.configName, config.salesRatio]),
    ];

    const bomSheets = payload.harnesses.map((harness) => ({
      harnessId: harness.harnessId,
      harnessName: harness.harnessName,
      data: bomRowsToSheetData(
        buildBomSheetRows(harness.harnessId, harness.harnessName, harness.input.bom),
      ),
    }));

    return {
      ...payload,
      matrices: {
        configMatrix,
        salesRatioSheet,
        bomSheets,
      },
    };
  }, mode);
}

async function pasteIntoUniver(
  page: Page,
  testId: string,
  rows: Array<Array<string | number | null>>,
  sheetId?: string
) {
  const wrapper = page.getByTestId(testId);
  await expect(wrapper).toBeVisible({ timeout: 30000 });
  await page.evaluate(({ targetTestId, data, targetSheetId }) => {
    const api = (window as Window & {
      __UNIVER_TEST_API__?: Record<string, {
        setActiveSheet?: (sheetId: string) => void;
        getActiveSheetId?: () => string | undefined;
        listSheetIds?: () => string[];
        replaceSheetData?: (sheetId: string, rows: (string | number | null)[][]) => void;
      }>;
    }).__UNIVER_TEST_API__?.[targetTestId];

    if (!api?.replaceSheetData) {
      throw new Error(`Univer test API unavailable for ${targetTestId}`);
    }

    if (targetSheetId) {
      api.setActiveSheet?.(targetSheetId);
    }

    const activeSheetId = targetSheetId ?? api.getActiveSheetId?.() ?? api.listSheetIds?.()[0];
    if (!activeSheetId) {
      throw new Error(`No active sheet found for ${targetTestId}`);
    }

    api.replaceSheetData(activeSheetId, data);
  }, { targetTestId: testId, data: rows, targetSheetId: sheetId });
  await page.waitForTimeout(1200);
}

async function dismissWorkbookWorkflow(page: Page) {
  const dismissLocal = page.getByTestId('workbook-dismiss-local-change');
  if (await dismissLocal.isVisible().catch(() => false)) {
    await dismissLocal.click();
    await page.waitForTimeout(200);
  }

  const dismissIncoming = page.getByTestId('workbook-dismiss-incoming-change');
  for (let i = 0; i < 4; i += 1) {
    if (!(await dismissIncoming.first().isVisible().catch(() => false))) {
      break;
    }
    await dismissIncoming.first().click();
    await page.waitForTimeout(150);
  }
}

async function syncQuoteScenarioConfig(page: Page, projectId: string, scenarioId: string, payload: E281ScenarioPayload) {
  await page.evaluate(async ({ projectId, scenarioId, payload }) => {
    const { db } = await import('/src/data/db.ts');
    const now = new Date().toISOString();

    const project = await db.projects.get(projectId);
    if (project) {
      await db.projects.put({
        ...project,
        meta: {
          ...project.meta,
          projectCode: payload.project.meta.projectCode,
          projectName: payload.project.meta.projectName,
          customer: payload.project.meta.customer,
          platform: payload.project.meta.platform,
          lifecycleYears: payload.project.meta.lifecycleYears,
          status: payload.project.meta.status,
          updatedAt: now,
        },
        config: payload.project.config as any,
      });
    }

    const scenario = await db.scenarios.get(scenarioId);
    if (scenario) {
      await db.scenarios.update(scenarioId, {
        scenarioName: payload.scenario.scenarioName,
        scenarioType: payload.scenario.scenarioType as any,
        lifecycleYears: payload.scenario.lifecycleYears,
        config: payload.scenario.config as any,
        note: payload.scenario.note,
        vehicleConfigMeta: {
          ...(scenario.vehicleConfigMeta || {}),
          ...(payload.scenario.vehicleConfigMeta || {}),
          publishState: 'sales_published',
        },
        updatedAt: now,
      });
    }
  }, { projectId, scenarioId, payload });
}

async function hydrateHarnessMetadata(page: Page, scenarioId: string, payload: E281ScenarioPayload) {
  await page.evaluate(async ({ scenarioId, payload }) => {
    const { db } = await import('/src/data/db.ts');
    const now = new Date().toISOString();
    const records = await db.harnesses.where('scenarioId').equals(scenarioId).toArray();
    const inputById = new Map(payload.harnesses.map((harness) => [harness.harnessId, harness.input]));

    for (const record of records) {
      const nextInput = inputById.get(record.harnessId);
      if (!nextInput) continue;

      await db.harnesses.update(record.id, {
        harnessName: nextInput.harnessName,
        input: {
          ...record.input,
          harnessId: nextInput.harnessId,
          harnessName: nextInput.harnessName,
          configType: nextInput.configType,
          functionalSlot: nextInput.functionalSlot,
          vehicleRatio: nextInput.vehicleRatio,
          frontHours: nextInput.frontHours,
          backHours: nextInput.backHours,
          packaging: nextInput.packaging,
          freight: nextInput.freight,
        },
        updatedAt: now,
      });
    }
  }, { scenarioId, payload });
}

async function seedOnetimeCosts(page: Page, projectId: string, scenarioId: string, payload: E281ScenarioPayload) {
  await page.evaluate(async ({ projectId, scenarioId, payload }) => {
    const { db } = await import('/src/data/db.ts');
    const now = new Date().toISOString();

    const existingCosts = await db.onetimeCosts.where('scenarioId').equals(scenarioId).toArray();
    await Promise.all(existingCosts.map((item) => db.onetimeCosts.delete(item.id)));
    const existingTrackers = await db.allocTrackers.where('scenarioId').equals(scenarioId).toArray();
    await Promise.all(existingTrackers.map((item) => db.allocTrackers.delete(item.id)));

    for (const row of payload.allocationRows) {
      await db.onetimeCosts.put({
        id: `${scenarioId}::${row.harnessId}`,
        projectId,
        scenarioId,
        harnessId: row.harnessId,
        harnessName: row.harnessName,
        vehicleRatio: row.vehicleRatio,
        input: {
          harnessId: row.harnessId,
          harnessName: row.harnessName,
          vehicleRatio: row.vehicleRatio,
          toolingCost: row.toolingCost,
          testingCost: row.testingCost,
          rndCost: row.rndCost,
          allocBase: row.allocBase,
          paymentMode: row.paymentMode,
        },
        updatedAt: now,
      });

      await db.allocTrackers.put({
        id: `${scenarioId}::${row.harnessId}`,
        projectId,
        scenarioId,
        harnessId: row.harnessId,
        cumProduced: 0,
        inheritedFromScenarioId: null,
        updatedAt: now,
      });
    }
  }, { projectId, scenarioId, payload });
}

async function createAwardScenario(page: Page, projectId: string, sourceScenarioId: string, payload: E281ScenarioPayload) {
  return page.evaluate(async ({ projectId, sourceScenarioId, payload }) => {
    const { db } = await import('/src/data/db.ts');
    const now = new Date().toISOString();
    const newScenarioId = `award-${Date.now()}`;

    await db.scenarios.put({
      id: newScenarioId,
      projectId,
      scenarioCode: 'SCN-002',
      scenarioName: payload.scenario.scenarioName,
      scenarioType: payload.scenario.scenarioType as any,
      parentScenarioId: sourceScenarioId,
      isBaseline: false,
      lifecycleYears: payload.scenario.lifecycleYears,
      config: payload.scenario.config as any,
      note: payload.scenario.note,
      vehicleConfigs: payload.scenario.vehicleConfigs as any,
      configSkus: payload.scenario.configSkus as any,
      harnessConfigMappings: payload.scenario.harnessConfigMappings as any,
      vehicleConfigMeta: payload.scenario.vehicleConfigMeta as any,
      status: 'draft',
      createdAt: now,
      updatedAt: now,
    });

    for (const harness of payload.harnesses) {
      await db.harnesses.put({
        id: crypto.randomUUID(),
        projectId,
        scenarioId: newScenarioId,
        harnessId: harness.harnessId,
        harnessName: harness.harnessName,
        input: harness.input as any,
        result: harness.result as any,
        eopYear: harness.eopYear,
        updatedAt: now,
      });
    }

    for (const row of payload.allocationRows) {
      await db.onetimeCosts.put({
        id: `${newScenarioId}::${row.harnessId}`,
        projectId,
        scenarioId: newScenarioId,
        harnessId: row.harnessId,
        harnessName: row.harnessName,
        vehicleRatio: row.vehicleRatio,
        input: {
          harnessId: row.harnessId,
          harnessName: row.harnessName,
          vehicleRatio: row.vehicleRatio,
          toolingCost: row.toolingCost,
          testingCost: row.testingCost,
          rndCost: row.rndCost,
          allocBase: row.allocBase,
          paymentMode: row.paymentMode,
        },
        updatedAt: now,
      });

      await db.allocTrackers.put({
        id: `${newScenarioId}::${row.harnessId}`,
        projectId,
        scenarioId: newScenarioId,
        harnessId: row.harnessId,
        cumProduced: 0,
        inheritedFromScenarioId: sourceScenarioId,
        updatedAt: now,
      });
    }

    return newScenarioId;
  }, { projectId, sourceScenarioId, payload });
}

async function verifyQuoteScenario(page: Page, scenarioId: string, payload: E281ScenarioPayload) {
  return page.evaluate(async ({ scenarioId, payload }) => {
    const { db } = await import('/src/data/db.ts');
    const { computeHarnessCost, computeProjectFromHarnesses } = await import('/src/engine/harness_costing.ts');

    const scenario = await db.scenarios.get(scenarioId);
    const harnesses = await db.harnesses.where('scenarioId').equals(scenarioId).toArray();
    if (!scenario) {
      throw new Error(`Scenario ${scenarioId} not found`);
    }

    const results = harnesses
      .map((harness) => computeHarnessCost(harness.input, (scenario.config as any).costRates, (scenario.config as any).metalPrices))
      .sort((left, right) => left.harnessId.localeCompare(right.harnessId));
    const resultById = new Map(results.map((result) => [result.harnessId, result]));

    const harnessChecks = payload.expectedHarnessResults.map((expected) => {
      const actual = resultById.get(expected.harnessId);
      return {
        harnessId: expected.harnessId,
        expectedMaterialCost: expected.materialCost,
        actualMaterialCost: actual?.materialCost ?? null,
        materialDelta: actual ? Number((actual.materialCost - expected.materialCost).toFixed(6)) : null,
        expectedDeliveredPrice: expected.deliveredPrice,
        actualDeliveredPrice: actual?.deliveredPrice ?? null,
        deliveredDelta: actual ? Number((actual.deliveredPrice - expected.deliveredPrice).toFixed(6)) : null,
      };
    });

    const debugHarnessId = '6608516992';
    const actualHarness = harnesses.find((item) => item.harnessId === debugHarnessId);
    const expectedHarness = payload.harnesses.find((item) => item.harnessId === debugHarnessId);
    const actualBom = Array.isArray(actualHarness?.input?.bom) ? actualHarness.input.bom : [];
    const expectedBom = Array.isArray(expectedHarness?.input?.bom) ? expectedHarness.input.bom : [];
    const actualPartNos = actualBom.map((item: any) => String(item.partNo || ''));
    const expectedPartNos = expectedBom.map((item: any) => String(item.partNo || ''));
    const extraPartNos = actualPartNos.filter((partNo) => !expectedPartNos.includes(partNo));
    const missingPartNos = expectedPartNos.filter((partNo) => !actualPartNos.includes(partNo));

    const project = computeProjectFromHarnesses(results);
    return {
      harnessChecks,
      project: {
        vehicleCost: project.vehicleCost,
        weightedMaterial: project.weightedMaterial,
        weightedExFactory: project.weightedExFactory,
        weightedDelivered: project.weightedDelivered,
        harnessCount: project.harnessCount,
      },
      bomDebug: {
        harnessId: debugHarnessId,
        actualRowCount: actualBom.length,
        expectedRowCount: expectedBom.length,
        extraPartNos,
        missingPartNos,
        actualBom,
        expectedBom,
      },
    };
  }, { scenarioId, payload });
}

test.describe('E281 manual flow', () => {
  test.setTimeout(10 * 60 * 1000);

  test('creates quote_raw manually, derives award_corrected, and captures release screenshots', async ({ page, context }) => {
    await ensureOutputDir();
    await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: 'http://localhost:5173' });
    await login(page);

    const quotePayload = await loadE281Payload(page, 'quote_raw');
    const awardPayload = await loadE281Payload(page, 'award_corrected');

    const uniqueSuffix = Date.now().toString().slice(-6);
    const projectCode = `${quotePayload.project.meta.projectCode}-UI-${uniqueSuffix}`;
    const projectName = `${quotePayload.project.meta.projectName}-UI录入`;

    await page.locator('button').filter({ hasText: '新建项目' }).first().click();
    await expect(page.getByTestId('new-project-wizard')).toBeVisible({ timeout: 15000 });

    await fillByTestId(page, 'wizard-project-code', projectCode);
    await fillByTestId(page, 'wizard-project-name', projectName);
    await fillByTestId(page, 'wizard-customer', quotePayload.project.meta.customer);
    await fillByTestId(page, 'wizard-platform', quotePayload.project.meta.platform || '');

    await page.getByTestId('wizard-next').click();
    for (const volume of quotePayload.project.config.volumes as unknown as VolumeRow[]) {
      await fillByTestId(page, `wizard-volume-year-${volume.year}`, String(volume.volume));
    }
    await page.getByTestId('wizard-next').click();
    await page.getByTestId('wizard-create').click();

    await page.waitForURL(/\/project\/[^/]+\/s\/[^/]+\/config/, { timeout: 30000 });
    const currentUrl = page.url();
    const projectId = currentUrl.match(/\/project\/([^/]+)\/s\//)?.[1];
    const scenarioId = currentUrl.match(/\/s\/([^/]+)\/config/)?.[1];
    expect(projectId).toBeTruthy();
    expect(scenarioId).toBeTruthy();

    await pasteIntoUniver(page, 'config-matrix-entry-sheet', quotePayload.matrices.configMatrix);
    await expect.poll(
      async () => page.evaluate(async (sid) => {
        const { db } = await import('/src/data/db.ts');
        return db.harnesses.where('scenarioId').equals(sid).count();
      }, scenarioId!),
      { timeout: 20000 },
    ).toBe(quotePayload.harnesses.length);
    await expect.poll(
      async () => page.evaluate(async (sid) => {
        const { db } = await import('/src/data/db.ts');
        const scenario = await db.scenarios.get(sid);
        const configs = (scenario?.vehicleConfigs || []).filter((config) => String(config.configName || '').trim().length > 0);
        return JSON.stringify({
          count: configs.length,
          emptyHarnessConfigs: configs.filter((config) => !config.harnessIds?.length).length,
          publishState: scenario?.vehicleConfigMeta?.publishState ?? 'draft',
        });
      }, scenarioId!),
      { timeout: 20000 },
    ).toBe(JSON.stringify({
      count: quotePayload.scenario.vehicleConfigs.length,
      emptyHarnessConfigs: quotePayload.scenario.vehicleConfigs.filter((config) => config.harnessIds.length === 0).length,
      publishState: 'draft',
    }));
    await screenshot(page, '01-config-matrix-filled.png');

    await page.getByTestId('publish-engineering-config').click({ force: true });
    await expect.poll(
      async () => page.evaluate(async (sid) => {
        const { db } = await import('/src/data/db.ts');
        const scenario = await db.scenarios.get(sid);
        return scenario?.vehicleConfigMeta?.publishState ?? '';
      }, scenarioId!),
      { timeout: 20000 },
    ).toBe('engineer_published');
    await expect(page.getByTestId('config-sales-ratio-sheet')).toBeVisible({ timeout: 15000 });
    await pasteIntoUniver(page, 'config-sales-ratio-sheet', quotePayload.matrices.salesRatioSheet);
    await expect.poll(
      async () => page.evaluate(async (sid) => {
        const { db } = await import('/src/data/db.ts');
        const scenario = await db.scenarios.get(sid);
        const configs = (scenario?.vehicleConfigs || []).filter((config) => String(config.configName || '').trim().length > 0);
        return Number(configs.reduce((sum, config) => sum + Number(config.salesRatio || 0), 0).toFixed(6));
      }, scenarioId!),
      { timeout: 20000 },
    ).toBe(1);
    await page.getByTestId('publish-sales-config').click({ force: true });
    await expect.poll(
      async () => page.evaluate(async (sid) => {
        const { db } = await import('/src/data/db.ts');
        const scenario = await db.scenarios.get(sid);
        return scenario?.vehicleConfigMeta?.publishState ?? '';
      }, scenarioId!),
      { timeout: 20000 },
    ).toBe('sales_published');
    await screenshot(page, '02-config-sales-published.png');

    await syncQuoteScenarioConfig(page, projectId!, scenarioId!, quotePayload);
    await hydrateHarnessMetadata(page, scenarioId!, quotePayload);

    await page.goto(`/project/${projectId}/s/${scenarioId}/bom-workbook`);
    await expect(page.getByTestId('bom-workbook-sheet')).toBeVisible({ timeout: 30000 });

    for (const bomSheet of quotePayload.matrices.bomSheets) {
      await page.evaluate(({ sheetId }) => {
        (window as Window & {
          __UNIVER_TEST_API__?: Record<string, { setActiveSheet: (id: string) => void }>;
        }).__UNIVER_TEST_API__?.['bom-workbook-sheet']?.setActiveSheet(sheetId);
      }, { sheetId: `bom-${bomSheet.harnessId}` });

      await page.waitForTimeout(250);
      await pasteIntoUniver(page, 'bom-workbook-sheet', bomSheet.data, `bom-${bomSheet.harnessId}`);
      await dismissWorkbookWorkflow(page);
    }

    await screenshot(page, '03-bom-workbook-filled.png');
    await page.getByTestId('bom-workbook-save-all').click();
    await page.waitForTimeout(3000);

    await seedOnetimeCosts(page, projectId!, scenarioId!, quotePayload);
    await page.goto(`/project/${projectId}/s/${scenarioId}/alloc`);
    await expect(page.getByTestId('alloc-manager-page')).toBeVisible({ timeout: 20000 });
    await screenshot(page, '04-allocation-matrix.png');

    await page.goto(`/project/${projectId}/s/${scenarioId}/quote`);
    await expect(page.getByTestId('quote-page')).toBeVisible({ timeout: 20000 });
    await screenshot(page, '05-quote-page.png');

    await page.goto(`/project/${projectId}/s/${scenarioId}/annual-drop`);
    await expect(page.getByTestId('annual-drop-page')).toBeVisible({ timeout: 20000 });
    await screenshot(page, '06-annual-drop-page.png');

    const awardScenarioId = await createAwardScenario(page, projectId!, scenarioId!, awardPayload);
    await page.goto(`/project/${projectId}/compare`);
    await expect(page.getByTestId('scenario-compare-page')).toBeVisible({ timeout: 20000 });
    await screenshot(page, '07-scenario-compare-page.png');

    const manualVerification = await verifyQuoteScenario(page, scenarioId!, quotePayload);
    await writeFile(
      path.join(OUTPUT_DIR, 'manual-quote-ui-verification.json'),
      `${JSON.stringify({
        projectId,
        quoteScenarioId: scenarioId,
        awardScenarioId,
        verification: manualVerification,
      }, null, 2)}\n`,
      'utf8',
    );

    await writeFile(
      path.join(OUTPUT_DIR, 'manual-quote-ui-bom-debug-6608516992.json'),
      `${JSON.stringify(manualVerification.bomDebug, null, 2)}\n`,
      'utf8',
    );

    expect(manualVerification.project.harnessCount).toBe(quotePayload.harnesses.length);
    expect(Math.abs(manualVerification.project.vehicleCost - (quotePayload.expectedProjectResults?.vehicleCost ?? 0))).toBeLessThan(0.05);
    expect(
      manualVerification.harnessChecks.every((item) =>
        Math.abs(item.materialDelta ?? 0) < 0.05 && Math.abs(item.deliveredDelta ?? 0) < 0.05,
      ),
    ).toBe(true);
  });
});
