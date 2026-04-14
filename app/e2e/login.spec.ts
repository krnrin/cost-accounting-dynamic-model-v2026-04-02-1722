import { test, expect } from '@playwright/test';

test.describe('\u767B\u5F55\u9875', () => {
  test('\u9875\u9762\u52A0\u8F7D\u5E76\u663E\u793A\u767B\u5F55\u8868\u5355', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('text=COST ENGINE')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('text=\u9AD8\u538B\u7EBF\u675F\u7CBE\u7B97\u4E0E\u51B3\u7B56\u5F15\u64CE')).toBeVisible();
    await expect(page.getByPlaceholder('your@company.com')).toBeVisible();
    await expect(page.getByPlaceholder('\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022')).toBeVisible();
    await expect(page.locator('text=\u9A8C\u8BC1\u8EAB\u4EFD\u5E76\u8FDB\u5165')).toBeVisible();
  });

  test('\u9ED8\u8BA4\u8D26\u53F7\u767B\u5F55\u6210\u529F', async ({ page }) => {
    await page.goto('/');
    const emailInput = page.getByPlaceholder('your@company.com');
    await emailInput.clear();
    await emailInput.fill('admin@harness.dev');
    const pwdInput = page.getByPlaceholder('\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022');
    await pwdInput.clear();
    await pwdInput.fill('admin123');
    await page.locator('button:has-text("\u9A8C\u8BC1\u8EAB\u4EFD\u5E76\u8FDB\u5165")').click();
    // \u767B\u5F55\u6210\u529F\u540E\u5E94\u8DF3\u8F6C\u79BB\u5F00\u767B\u5F55\u9875
    await expect(page.locator('text=COST ENGINE')).toBeHidden({ timeout: 10000 });
  });

  test('\u9519\u8BEF\u5BC6\u7801\u663E\u793A\u9519\u8BEF\u63D0\u793A', async ({ page }) => {
    await page.goto('/');
    const emailInput = page.getByPlaceholder('your@company.com');
    await emailInput.clear();
    await emailInput.fill('admin@harness.dev');
    const pwdInput = page.getByPlaceholder('\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022');
    await pwdInput.clear();
    await pwdInput.fill('wrongpassword');
    await page.locator('button:has-text("\u9A8C\u8BC1\u8EAB\u4EFD\u5E76\u8FDB\u5165")').click();
    await expect(page.locator('.semi-toast-error').first()).toBeVisible({ timeout: 5000 });
  });

  test('\u5207\u6362\u5230\u6CE8\u518C tab', async ({ page }) => {
    await page.goto('/');
    await page.locator('text=\u7533\u8BF7\u6743\u9650').click();
    await expect(page.getByPlaceholder('\u5982\uFF1A\u5F20\u4E09')).toBeVisible();
    await expect(page.getByPlaceholder('zhangsan@company.com')).toBeVisible();
    await expect(page.locator('text=\u63D0\u4EA4\u5F00\u901A\u7533\u8BF7')).toBeVisible();
  });
});
