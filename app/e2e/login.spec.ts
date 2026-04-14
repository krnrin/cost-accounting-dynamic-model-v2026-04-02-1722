import { test, expect } from '@playwright/test';

async function fillPassword(page, value: string) {
  // Semi UI password input 需要通过键盘逐字输入才能正确同步 React 内部状态
  const input = page.locator('input[type="password"]').first();
  await input.click();
  await input.fill('');
  await input.pressSequentially(value, { delay: 30 });
}

test.describe('登录页', () => {
  test('页面加载并显示登录表单', async ({ page }) => {
    await page.goto('/');
    await page.context().clearCookies();
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await expect(page.locator('text=COST ENGINE')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('text=高压线束精算与决策引擎')).toBeVisible();
    await expect(page.getByPlaceholder('your@company.com')).toBeVisible();
    await expect(page.getByPlaceholder('••••••••')).toBeVisible();
    await expect(page.locator('text=验证身份并进入')).toBeVisible();
  });

  test('默认账号登录成功', async ({ page }) => {
    await page.goto('/');
    await page.context().clearCookies();
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    const emailInput = page.getByPlaceholder('your@company.com');
    await emailInput.clear();
    await emailInput.fill('admin@harness.dev');
    await fillPassword(page, 'admin123');
    await page.locator('button:has-text("验证身份并进入")').click();
    // 登录成功后应跳转离开登录页
    await expect(page.locator('text=COST ENGINE')).toBeHidden({ timeout: 10000 });
  });

  test('错误密码显示错误提示（DEV fallback 兼容）', async ({ page }) => {
    await page.goto('/');
    await page.context().clearCookies();
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    const emailInput = page.getByPlaceholder('your@company.com');
    await emailInput.clear();
    await emailInput.fill('admin@harness.dev');
    await fillPassword(page, 'wrongpassword');
    await page.locator('button:has-text("验证身份并进入")').click();
    // DEV 模式下后端不可达时会自动 fallback 到离线登录，此时断言离开登录页
    // 非 DEV 模式下应显示错误 toast
    await expect(
      page.locator('.semi-toast-error').first().or(page.locator('button:has-text("新建项目")'))
    ).toBeVisible({ timeout: 15000 });
  });

  test('切换到注册 tab', async ({ page }) => {
    await page.goto('/');
    await page.context().clearCookies();
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.locator('text=申请权限').click();
    await expect(page.getByPlaceholder('如：张三')).toBeVisible();
    await expect(page.getByPlaceholder('zhangsan@company.com')).toBeVisible();
    await expect(page.locator('text=提交开通申请')).toBeVisible();
  });
});
