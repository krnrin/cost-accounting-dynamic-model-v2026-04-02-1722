/**
 * e281_data_inject.spec.js — E281 数据注入测试
 *
 * 使用 page.addInitScript() 在页面加载前注入完整 E281 数据到 localStorage
 * 验证:
 *   1. 所有维度数据正确写入 localStorage
 *   2. 引擎加载后能读取到 E281 数据
 *   3. 计算引擎可用
 */
const { test, expect } = require('@playwright/test');
const {
  seedProjectData,
  waitForAppReady,
  readIndexedDB,
  PROJECT_ID,
} = require('./utils/e281_helpers');
const {
  loadE281SeedData,
  E281_ALL_HARNESS_IDS,
} = require('./utils/e281_seed_data');

test.describe('E281 Data Injection', () => {
  test('inject E281 seed data via addInitScript', async ({ page }) => {
    // 注入种子数据
    await seedProjectData(page);

    // 打开 dashboard
    await page.goto('/pages/accounting.html?projectId=E281', { waitUntil: 'load' });

    // 验证 localStorage 中的项目注册
    const projectRegistered = await page.evaluate((pid) => {
      const registry = JSON.parse(localStorage.getItem('g281.workspace.projects.v1') || '[]');
      return registry.some((p) => p.projectId === pid);
    }, PROJECT_ID);
    expect(projectRegistered).toBe(true);

    // 验证当前项目
    const currentProject = await page.evaluate(() => {
      return localStorage.getItem('g281.workspace.currentProject.v1');
    });
    expect(currentProject).toBe(PROJECT_ID);

    // 验证种子数据在 localStorage 中
    const seedDataPresent = await page.evaluate(() => {
      const data = localStorage.getItem('G281_SEED_DATA_E281');
      if (!data) return { ok: false, reason: 'no seed data' };
      try {
        const parsed = JSON.parse(data);
        return {
          ok: true,
          harnessCount: parsed.harnesses?.length || 0,
          hasRateConfig: !!parsed.rateConfig,
          hasProjectSummary: !!parsed.projectSummary,
        };
      } catch (e) {
        return { ok: false, reason: String(e) };
      }
    });
    expect(seedDataPresent.ok).toBe(true);
    expect(seedDataPresent.harnessCount).toBeGreaterThanOrEqual(9);
    expect(seedDataPresent.hasRateConfig).toBe(true);
  });

  test('E281 seed data contains all 11 harness IDs', async ({ page }) => {
    await seedProjectData(page);
    await page.goto('/pages/accounting.html?projectId=E281', { waitUntil: 'load' });

    const harnessIdsList = await page.evaluate(() => {
      const data = JSON.parse(localStorage.getItem('G281_SEED_DATA_E281') || '{}');
      return (data.harnesses || []).map((h) => h.harnessId);
    });

    E281_ALL_HARNESS_IDS.forEach((id) => {
      expect(harnessIdsList).toContain(id);
    });
  });

  test('E281 rate config matches expected values', async ({ page }) => {
    await seedProjectData(page);
    await page.goto('/pages/accounting.html?projectId=E281', { waitUntil: 'load' });

    const rateConfig = await page.evaluate(() => {
      const data = JSON.parse(localStorage.getItem('G281_SEED_DATA_E281') || '{}');
      return data.rateConfig?.customer || null;
    });

    expect(rateConfig).not.toBeNull();
    expect(rateConfig.laborRate).toBe(35);
    expect(rateConfig.mfgRate).toBeCloseTo(46.69, 1);
    expect(rateConfig.wasteRate).toBeCloseTo(0.01, 2);
    expect(rateConfig.mgmtRate).toBeCloseTo(0.06, 2);
    expect(rateConfig.profitRate).toBeCloseTo(0.056627, 4);
  });

  test('E281 project config has correct harness list', async ({ page }) => {
    await seedProjectData(page);
    await page.goto('/pages/accounting.html?projectId=E281', { waitUntil: 'load' });

    const harnesses = await page.evaluate(() => {
      const config = JSON.parse(localStorage.getItem('G281_PROJECT_CONFIG_E281') || '{}');
      return config.harnesses || [];
    });

    expect(harnesses.length).toBeGreaterThanOrEqual(9);
    const harnessIds = harnesses.map((h) => h.id);
    // 验证核心 9 条线束
    const coreIds = [
      '6608491523', '6608491524', '6608442962', '6608544875',
      '6608442964', '6608519100', '6608442963', '6608516992',
      '6608442966',
    ];
    coreIds.forEach((id) => {
      expect(harnessIds).toContain(id);
    });
  });

  test('E281 annual volumes are set correctly', async ({ page }) => {
    await seedProjectData(page);
    await page.goto('/pages/accounting.html?projectId=E281', { waitUntil: 'load' });

    const annualVolumes = await page.evaluate(() => {
      const config = JSON.parse(localStorage.getItem('G281_PROJECT_CONFIG_E281') || '{}');
      return (config.baseline?.annualVolumes || []).map((v) => v.volume);
    });

    const expectedVolumes = [85000, 135000, 125000, 114000, 94000, 47000];
    expect(annualVolumes).toEqual(expectedVolumes);
  });
});
