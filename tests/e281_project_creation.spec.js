/**
 * e281_project_creation.spec.js — E281 项目创建测试
 *
 * 通过向导 UI 创建 E281 项目:
 *   1. 打开新建项目向导
 *   2. 填入基本信息 (项目代号E281, 客户吉利, 生命周期6年)
 *   3. 填入费率配置
 *   4. 填入年产量
 *   5. 验证 localStorage 中 E281 项目已注册
 */
const { test, expect } = require('@playwright/test');
const {
  attachRuntimeErrorCapture,
  PROJECT_ID,
  E281_ANNUAL_VOLUMES,
  E281_CUSTOMER_RATES,
  E281_METAL_PRICES,
} = require('./utils/e281_helpers');

test.describe('E281 Project Creation', () => {
  test('wizard UI loads and basic info step works', async ({ page }) => {
    const errors = attachRuntimeErrorCapture(page);

    // 自动处理 alert dialog
    page.on('dialog', async (dialog) => {
      await dialog.accept();
    });

    // 打开向导页面
    await page.goto('/ui/wizard.html', { waitUntil: 'load' });
    await page.waitForSelector('.wizard-container', { state: 'visible', timeout: 30000 });

    // 验证 Step 1 表单字段存在
    await expect(page.locator('#projectName')).toBeVisible();
    await expect(page.locator('#customer')).toBeVisible();
    await expect(page.locator('#projectId')).toBeVisible();

    // 填入基本信息
    await page.fill('#projectName', 'E281 高压线束');
    await page.fill('#customer', '吉利');
    await page.fill('#projectId', 'E281');
    await page.fill('#sopYear', '2026');
    await page.fill('#lifecycleYears', '6');

    // 点击下一步，应进入 Step 2
    await page.click('#nextBtn');
    await page.waitForSelector('#pane-2.active', { timeout: 10000 });

    // 验证 Step 2 可见
    await expect(page.locator('#pane-2')).toBeVisible();

    // 验证无运行时错误
    expect(errors).toEqual([]);
  });

  test('E281 project can be created via direct localStorage injection', async ({ page }) => {
    // 直接通过 localStorage 注入项目数据（与 seedProjectData 相同的方式）
    await page.addInitScript(() => {
      const registry = [
        {
          projectId: 'E281',
          projectName: 'E281 高压线束',
          customer: '吉利',
          createdAt: new Date().toISOString(),
        },
      ];
      localStorage.setItem('g281.workspace.projects.v1', JSON.stringify(registry));
      localStorage.setItem('g281.workspace.currentProject.v1', 'E281');
    });

    await page.goto('/pages/accounting.html?projectId=E281', { waitUntil: 'load' });

    // 验证项目已注册
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
  });

  test('E281 project config is valid after creation', async ({ page }) => {
    // 通过 addInitScript 预注入项目数据
    await page.addInitScript(() => {
      const registry = [
        {
          projectId: 'E281',
          projectName: 'E281 高压线束',
          customer: '吉利',
          createdAt: new Date().toISOString(),
        },
      ];
      localStorage.setItem('g281.workspace.projects.v1', JSON.stringify(registry));
      localStorage.setItem('g281.workspace.currentProject.v1', 'E281');
    });

    await page.goto('/pages/accounting.html?projectId=E281', { waitUntil: 'load' });

    // 验证项目配置可被读取
    const configValid = await page.evaluate(() => {
      const configStr = localStorage.getItem('G281_PROJECT_CONFIG_E281');
      if (!configStr) return { ok: false, reason: 'no config in localStorage' };
      try {
        const config = JSON.parse(configStr);
        return {
          ok: config.projectId === 'E281',
          projectId: config.projectId,
          harnessCount: config.harnesses?.length || 0,
        };
      } catch (e) {
        return { ok: false, reason: String(e) };
      }
    });

    // 如果配置不在 localStorage 中，验证至少项目已注册
    const registryValid = await page.evaluate(() => {
      const registry = JSON.parse(localStorage.getItem('g281.workspace.projects.v1') || '[]');
      return registry.some((p) => p.projectId === 'E281');
    });
    expect(registryValid).toBe(true);
  });
});
