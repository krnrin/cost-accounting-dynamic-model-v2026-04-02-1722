import { test, expect, Page } from '@playwright/test';

/**
 * P0 主链路 E2E 测试 - 分摊与回收
 * 流程：录入分摊 → 查看单根分摊 → 添加回收记录 → 回收完成触发行为
 */

async function login(page: Page) {
  await page.goto('/');
  await page.getByPlaceholder('admin@harness.dev').fill('admin@harness.dev');
  await page.getByPlaceholder('••••••••').fill('admin123');
  await page.locator('button:has-text("验证身份并进入")').click();
  await expect(page.locator('text=COST ENGINE')).toBeHidden({ timeout: 10000 });
}

test.describe('P0 主链路 - 分摊与回收', () => {
  const PROJECT_ID = 'g281-demo'; // 使用已有的测试项目
  const HARNESS_ID = '6608442966'; // 使用已有的线束

  test('1. 录入分摊计划', async ({ page }) => {
    await login(page);

    // 导航到分摊管理页面
    await page.goto(`/project/${PROJECT_ID}/allocation`);
    await page.waitForLoadState('networkidle');

    // 点击新建分摊
    await page.locator('button:has-text("新建分摊")').click();

    // 填写分摊信息
    await page.getByLabel('分摊名称').fill('E2E测试分摊');
    await page.getByLabel('总金额').fill('500000');
    await page.getByLabel('分摊周期').fill('12');

    // 选择线束
    await page.locator(`input[value="${HARNESS_ID}"]`).check();

    // 提交
    await page.locator('button:has-text("创建分摊")').click();

    // 验证分摊创建成功
    await expect(page.locator('text=E2E测试分摊')).toBeVisible({ timeout: 5000 });

    console.log('✓ 分摊计划录入成功');
  });

  test('2. 查看单根线束分摊详情', async ({ page }) => {
    await login(page);

    // 导航到分摊详情页
    await page.goto(`/project/${PROJECT_ID}/allocation`);
    await page.waitForLoadState('networkidle');

    // 点击查看详情
    await page.locator('text=E2E测试分摊').click();

    // 验证分摊详情显示
    await expect(page.locator('text=分摊明细')).toBeVisible();
    await expect(page.locator(`text=${HARNESS_ID}`)).toBeVisible();
    await expect(page.locator('text=已分摊')).toBeVisible();
    await expect(page.locator('text=待回收')).toBeVisible();

    console.log('✓ 单根分摊详情查看成功');
  });

  test('3. 添加回收记录', async ({ page }) => {
    await login(page);

    // 导航到回收管理页面
    await page.goto(`/project/${PROJECT_ID}/recovery`);
    await page.waitForLoadState('networkidle');

    // 点击添加回收
    await page.locator('button:has-text("添加回收")').click();

    // 填写回收信息
    await page.getByLabel('回收金额').fill('50000');
    await page.getByLabel('回收日期').fill('2026-04-13');
    await page.getByLabel('备注').fill('E2E测试回收');

    // 选择分摊项
    await page.locator('input[type="checkbox"]').first().check();

    // 提交
    await page.locator('button:has-text("确认回收")').click();

    // 验证回收记录添加成功
    await expect(page.locator('text=E2E测试回收')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=50000')).toBeVisible();

    console.log('✓ 回收记录添加成功');
  });

  test('4. 回收完成触发行为', async ({ page }) => {
    await login(page);

    // 导航到回收管理页面
    await page.goto(`/project/${PROJECT_ID}/recovery`);
    await page.waitForLoadState('networkidle');

    // 继续添加回收直到完成（假设总额 500000）
    const remainingAmount = 450000; // 500000 - 50000

    await page.locator('button:has-text("添加回收")').click();
    await page.getByLabel('回收金额').fill(remainingAmount.toString());
    await page.getByLabel('回收日期').fill('2026-04-13');
    await page.getByLabel('备注').fill('E2E测试完成回收');
    await page.locator('input[type="checkbox"]').first().check();
    await page.locator('button:has-text("确认回收")').click();

    // 验证回收完成状态
    await expect(page.locator('text=已完成')).toBeVisible({ timeout: 5000 });

    // 验证触发的行为（如通知、状态更新等）
    const completionBadge = page.locator('.semi-tag:has-text("已完成")');
    await expect(completionBadge).toBeVisible();

    // 检查是否有完成通知
    const notification = page.locator('.semi-toast:has-text("回收完成")');
    if (await notification.isVisible()) {
      console.log('✓ 回收完成通知已触发');
    }

    console.log('✓ 回收完成行为验证通过');
  });

  test('5. 验证分摊回收统计', async ({ page }) => {
    await login(page);

    // 导航到项目 Dashboard
    await page.goto(`/project/${PROJECT_ID}`);
    await page.waitForLoadState('networkidle');

    // 验证统计卡片显示
    await expect(page.locator('text=分摊总额')).toBeVisible();
    await expect(page.locator('text=已回收')).toBeVisible();
    await expect(page.locator('text=回收率')).toBeVisible();

    // 验证回收率为 100%
    const recoveryRate = await page.locator('text=100%').count();
    expect(recoveryRate).toBeGreaterThan(0);

    console.log('✓ 分摊回收统计验证通过');
  });
});
