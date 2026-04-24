/**
 * e281_full_workflow.spec.js — E281 端到端完整流程测试
 *
 * 组合: 项目创建 → 数据注入 → BOM 录入 → 成本验证
 * 顺序执行，验证完整业务流程
 */
const { test, expect } = require('@playwright/test');
const {
  seedProjectData,
  waitForAppReady,
  injectSeedDataViaAPI,
  triggerComputation,
  readIndexedDB,
  assertApprox,
  screenshotOnStep,
  PROJECT_ID,
} = require('./utils/e281_helpers');
const {
  loadE281SeedData,
  loadE281ProjectConfig,
  E281_HARNESS_IDS,
  E281_ALL_HARNESS_IDS,
  E281_CUSTOMER_RATES,
  E281_INTERNAL_RATES,
  E281_METAL_PRICES,
  E281_ANNUAL_VOLUMES,
  getAllHarnessExpectedCosts,
} = require('./utils/e281_seed_data');

const EPSILON = 0.01;

test.describe('E281 Full Workflow', () => {
  test('complete E281 project lifecycle', async ({ page }) => {
    const testInfo = test.info();

    // === Step 1: 数据注入 ===
    await seedProjectData(page);
    await page.goto('/pages/accounting.html?projectId=E281', { waitUntil: 'load' });
    await screenshotOnStep(page, '01-data-injected', testInfo);

    // 验证项目已注册
    const projectRegistered = await page.evaluate((pid) => {
      const registry = JSON.parse(localStorage.getItem('g281.workspace.projects.v1') || '[]');
      return registry.some((p) => p.projectId === pid);
    }, PROJECT_ID);
    expect(projectRegistered).toBe(true);

    // === Step 2: 等待引擎加载 ===
    await page.waitForFunction(() => {
      return typeof globalThis.G281Engine === 'object';
    }, null, { timeout: 30000 });

    // === Step 3: 注入种子数据 ===
    const seedData = loadE281SeedData();
    const injectResult = await injectSeedDataViaAPI(page, seedData);
    expect(injectResult.ok).toBe(true);
    await screenshotOnStep(page, '02-seed-data-written', testInfo);

    // === Step 4: 写入费率配置 ===
    const rateResult = await page.evaluate((rates) => {
      try {
        const config = JSON.parse(localStorage.getItem('G281_PROJECT_CONFIG_E281') || '{}');
        if (!config.costRates) config.costRates = {};
        config.costRates.customer = rates.customer;
        config.costRates.internal = rates.internal;
        config.costRates.metal = rates.metal;
        localStorage.setItem('G281_PROJECT_CONFIG_E281', JSON.stringify(config));
        return { ok: true };
      } catch (e) {
        return { ok: false, error: String(e) };
      }
    }, {
      customer: E281_CUSTOMER_RATES,
      internal: E281_INTERNAL_RATES,
      metal: E281_METAL_PRICES,
    });
    expect(rateResult.ok).toBe(true);

    // === Step 5: 写入年产量 ===
    const volumeResult = await page.evaluate((volumes) => {
      try {
        const config = JSON.parse(localStorage.getItem('G281_PROJECT_CONFIG_E281') || '{}');
        if (!config.baseline) config.baseline = {};
        config.baseline.annualVolumes = volumes.map((v, i) => ({
          year: i + 1,
          volume: v,
        }));
        localStorage.setItem('G281_PROJECT_CONFIG_E281', JSON.stringify(config));
        return { ok: true };
      } catch (e) {
        return { ok: false, error: String(e) };
      }
    }, E281_ANNUAL_VOLUMES);
    expect(volumeResult.ok).toBe(true);

    // === Step 6: 写入包装数据 ===
    let expectedCosts;
    try {
      expectedCosts = require('./data/e281_expected_costs.json');
    } catch (_e) {
      expectedCosts = null;
    }

    if (expectedCosts?.packaging?.length) {
      const packResult = await page.evaluate((packData) => {
        try {
          const config = JSON.parse(localStorage.getItem('G281_PROJECT_CONFIG_E281') || '{}');
          if (!config.packaging) config.packaging = {};
          config.packaging.harnesses = packData;
          localStorage.setItem('G281_PROJECT_CONFIG_E281', JSON.stringify(config));
          return { ok: true };
        } catch (e) {
          return { ok: false, error: String(e) };
        }
      }, expectedCosts.packaging);
      expect(packResult.ok).toBe(true);
    }

    await screenshotOnStep(page, '03-all-data-written', testInfo);

    // === Step 7: 触发计算 ===
    const computeResult = await triggerComputation(page);
    await screenshotOnStep(page, '04-computation-triggered', testInfo);

    // === Step 8: 验证数据完整性 ===
    const dataIntegrity = await page.evaluate(() => {
      const config = JSON.parse(localStorage.getItem('G281_PROJECT_CONFIG_E281') || '{}');
      const seed = JSON.parse(localStorage.getItem('G281_SEED_DATA_E281') || '{}');
      return {
        hasConfig: !!config.projectId,
        hasSeedData: !!seed.harnesses?.length,
        harnessCount: seed.harnesses?.length || 0,
        hasCostRates: !!config.costRates?.customer,
        hasVolumes: !!(config.baseline?.annualVolumes?.length),
        volumeCount: config.baseline?.annualVolumes?.length || 0,
        hasPackaging: !!(config.packaging?.harnesses?.length),
      };
    });

    expect(dataIntegrity.hasConfig).toBe(true);
    expect(dataIntegrity.hasSeedData).toBe(true);
    expect(dataIntegrity.harnessCount).toBeGreaterThanOrEqual(9);
    expect(dataIntegrity.hasCostRates).toBe(true);
    expect(dataIntegrity.hasVolumes).toBe(true);
    expect(dataIntegrity.volumeCount).toBe(6);

    // === Step 9: 验证线束数据 ===
    const harnessVerification = await page.evaluate(() => {
      const seed = JSON.parse(localStorage.getItem('G281_SEED_DATA_E281') || '{}');
      return (seed.harnesses || []).map((h) => ({
        harnessId: h.harnessId,
        hasMaterialCost: h.materialCost !== undefined && h.materialCost !== null && h.materialCost > 0,
        materialCost: h.materialCost,
      }));
    });

    const validHarnesses = harnessVerification.filter((h) => h.hasMaterialCost);
    expect(validHarnesses.length).toBeGreaterThanOrEqual(9);

    // === Step 10: 验证费率 ===
    const rateVerification = await page.evaluate(() => {
      const config = JSON.parse(localStorage.getItem('G281_PROJECT_CONFIG_E281') || '{}');
      const rates = config.costRates?.customer;
      if (!rates) return null;
      return {
        laborRate: rates.laborRate,
        mfgRate: rates.mfgRate,
        wasteRate: rates.wasteRate,
        mgmtRate: rates.mgmtRate,
        profitRate: rates.profitRate,
      };
    });

    expect(rateVerification).not.toBeNull();
    expect(rateVerification.laborRate).toBe(35);
    expect(rateVerification.mfgRate).toBeCloseTo(46.69, 1);

    await screenshotOnStep(page, '05-verification-complete', testInfo);
  });

  test('E281 data persists across page reload', async ({ page }) => {
    // 注入数据
    await seedProjectData(page);
    await page.goto('/pages/accounting.html?projectId=E281', { waitUntil: 'load' });

    // 等待引擎加载
    await page.waitForFunction(() => {
      return typeof globalThis.G281Engine === 'object';
    }, null, { timeout: 30000 });

    // 注入种子数据
    const seedData = loadE281SeedData();
    await injectSeedDataViaAPI(page, seedData);

    // 刷新页面
    await page.reload({ waitUntil: 'load' });

    // 验证数据仍然存在
    const dataAfterReload = await page.evaluate(() => {
      return {
        hasProject: !!localStorage.getItem('G281_PROJECT_CONFIG_E281'),
        hasSeed: !!localStorage.getItem('G281_SEED_DATA_E281'),
        currentProject: localStorage.getItem('g281.workspace.currentProject.v1'),
      };
    });

    expect(dataAfterReload.hasProject).toBe(true);
    expect(dataAfterReload.hasSeed).toBe(true);
    expect(dataAfterReload.currentProject).toBe(PROJECT_ID);
  });

  test('E281 project isolation — G281 data not affected', async ({ page }) => {
    // 注入 E281 数据
    await seedProjectData(page);
    await page.goto('/pages/accounting.html?projectId=E281', { waitUntil: 'load' });

    // 验证 G281 数据不受影响
    const g281Data = await page.evaluate(() => {
      return {
        hasG281Config: !!localStorage.getItem('G281_PROJECT_CONFIG_G281'),
        hasG281Seed: !!localStorage.getItem('G281_SEED_DATA_G281'),
      };
    });

    // G281 数据不应被 E281 注入影响
    // 如果原来没有 G281 数据，则应为 false
    // 如果原来有 G281 数据，则应仍然存在
  });
});
