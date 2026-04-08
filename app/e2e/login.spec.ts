import { test, expect } from '@playwright/test';

const BASE = 'http://localhost:5179';

test.describe('登录页', () => {
  test('页面加载并显示登录表单', async ({ page }) => {
    await page.goto(BASE);
    await expect(page.locator('text=COST ENGINE')).toBeVisible();
    await expect(page.locator('text=高压线束精算与决策引擎')).toBeVisible();
    await expect(page.getByPlaceholder('admin@harness.dev')).toBeVisible();
    await expect(page.getByPlaceholder('••••••••')).toBeVisible();
    await expect(page.locator('text=验证身份并进入')).toBeVisible();
  });

  test('默认账号登录成功', async ({ page }) => {
    await page.goto(BASE);
    await page.getByPlaceholder('admin@harness.dev').fill('admin@harness.dev');
    await page.getByPlaceholder('••••••••').fill('admin123');
    await page.locator('button:has-text("验证身份并进入")').click();
    // 登录成功后应跳转离开登录页
    await expect(page.locator('text=COST ENGINE')).toBeHidden({ timeout: 10000 });
  });

  test('错误密码显示错误提示', async ({ page }) => {
    await page.goto(BASE);
    await page.getByPlaceholder('admin@harness.dev').fill('admin@harness.dev');
    await page.getByPlaceholder('••••••••').fill('wrongpassword');
    await page.locator('button:has-text("验证身份并进入")').click();
    // 应显示错误 toast
    await expect(page.locator('.semi-toast')).toBeVisible({ timeout: 5000 });
  });

  test('切换到注册 tab', async ({ page }) => {
    await page.goto(BASE);
    await page.locator('text=申请权限').click();
    await expect(page.getByPlaceholder('如：张三')).toBeVisible();
    await expect(page.getByPlaceholder('zhangsan@company.com')).toBeVisible();
    await expect(page.locator('text=提交开通申请')).toBeVisible();
  });
});
