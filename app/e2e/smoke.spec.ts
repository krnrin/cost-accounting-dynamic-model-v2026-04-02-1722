import { test, expect, Page } from '@playwright/test';

/**
 * Smoke test \u2014 \u9A8C\u8BC1\u5E94\u7528\u542F\u52A8 + \u767B\u5F55 + \u4E3B\u8981\u8DEF\u7531\u53EF\u8BBF\u95EE
 */

async function doLogin(page: Page) {
  await page.goto('/');
  await page.waitForLoadState('domcontentloaded');
  await expect(page.locator('text=COST ENGINE')).toBeVisible({ timeout: 15000 });

  // 使用 first() 选择第一个（登录 tab 的输入框）
  await page.locator('input[type="text"]').first().fill('admin@harness.dev');
  await page.locator('input[type="password"]').first().fill('admin123');

  // 使用 CSS class 选择器定位提交按钮
  await page.locator('button.btn-gradient[type="submit"]').first().click();

  await expect(page.locator('text=COST ENGINE')).toBeHidden({ timeout: 15000 });
  await page.waitForLoadState('networkidle');
}

test.describe('\u5192\u70DF\u6D4B\u8BD5', () => {
  test('\u767B\u5F55\u5E76\u9A8C\u8BC1\u4E3B\u9875\u52A0\u8F7D', async ({ page }) => {
    await doLogin(page);
    // \u9879\u76EE\u5217\u8868\u9875\u5E94\u8BE5\u53EF\u89C1
    await expect(page.locator('body')).not.toBeEmpty();
    console.log('\u2705 \u767B\u5F55\u6210\u529F\uFF0C\u4E3B\u9875\u5DF2\u52A0\u8F7D');
    console.log('\u5F53\u524D URL:', page.url());
  });

  test('\u8DEF\u7531\u53EF\u8BBF\u95EE\u6027\u68C0\u67E5', async ({ page }) => {
    await doLogin(page);

    const routes = [
      { path: '/settings', label: '\u8BBE\u7F6E' },
      { path: '/manager', label: '\u7BA1\u7406\u4EEA\u8868\u76D8' },
    ];

    for (const route of routes) {
      await page.goto(route.path);
      await page.waitForLoadState('networkidle');
      const hasError = await page.locator('text=Something went wrong').isVisible().catch(() => false);
      if (hasError) {
        console.log(`\u274C ${route.label} (${route.path}) \u2014 \u6E32\u67D3\u9519\u8BEF`);
      } else {
        console.log(`\u2705 ${route.label} (${route.path}) \u2014 \u53EF\u8BBF\u95EE`);
      }
      expect(hasError).toBe(false);
    }
  });

  test('\u68C0\u67E5\u9879\u76EE\u8DEF\u7531', async ({ page }) => {
    await doLogin(page);

    // \u5C1D\u8BD5\u53D1\u73B0\u9879\u76EE\u94FE\u63A5
    const projectLinks = await page.locator('a[href*="/project/"]').all();
    console.log(`\u627E\u5230 ${projectLinks.length} \u4E2A\u9879\u76EE\u94FE\u63A5`);

    if (projectLinks.length > 0) {
      const href = await projectLinks[0].getAttribute('href');
      if (href) {
        await page.goto(href);
        await page.waitForLoadState('networkidle');
        const hasError = await page.locator('text=Something went wrong').isVisible().catch(() => false);
        expect(hasError).toBe(false);
        console.log(`\u2705 \u9879\u76EE\u9875 ${href} \u53EF\u8BBF\u95EE`);

        // \u68C0\u67E5\u9879\u76EE\u4E0B\u7684\u5B50\u8DEF\u7531
        const subRoutes = ['quote', 'simulation', 'annual-drop', 'alloc', 'change-engine', 'bom-workbook'];
        for (const sub of subRoutes) {
          await page.goto(`${href}/${sub}`);
          await page.waitForLoadState('networkidle');
          const subError = await page.locator('text=Something went wrong').isVisible().catch(() => false);
          const status = subError ? '\u274C' : '\u2705';
          console.log(`  ${status} ${sub}`);
        }
      }
    } else {
      console.log('\u26A0\uFE0F \u65E0\u9879\u76EE\u6570\u636E\uFF0C\u8DF3\u8FC7\u9879\u76EE\u8DEF\u7531\u68C0\u67E5');
    }
  });
});
