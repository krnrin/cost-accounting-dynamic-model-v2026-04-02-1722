import { test, expect } from '@playwright/test';

async function login(page: import('@playwright/test').Page) {
  await page.goto('/');
  await page.getByPlaceholder('admin@harness.dev').fill('admin@harness.dev');
  await page.getByPlaceholder('••••••••').fill('admin123');
  await page.locator('button:has-text("验证身份并进入")').click();
  await expect(page.locator('text=COST ENGINE')).toBeHidden({ timeout: 10000 });
}

test('抓取项目和线束 ID', async ({ page }) => {
  await login(page);
  await page.waitForLoadState('networkidle');

  // 获取所有项目链接
  const links = await page.locator('a[href*="/project/"]').all();
  const hrefs: string[] = [];
  for (const link of links) {
    const href = await link.getAttribute('href');
    if (href) hrefs.push(href);
  }
  console.log('=== PROJECT LINKS ===');
  console.log(JSON.stringify([...new Set(hrefs)], null, 2));

  // 如果有项目，点进第一个看线束
  const projectLinks = hrefs.filter(h => /^\/project\/[^/]+$/.test(h));
  if (projectLinks.length > 0) {
    await page.goto(projectLinks[0]);
    await page.waitForLoadState('networkidle');
    const harnessLinks = await page.locator('a[href*="/harness/"]').all();
    const harnessHrefs: string[] = [];
    for (const link of harnessLinks) {
      const href = await link.getAttribute('href');
      if (href) harnessHrefs.push(href);
    }
    console.log('=== HARNESS LINKS ===');
    console.log(JSON.stringify([...new Set(harnessHrefs)], null, 2));
  }

  // 也尝试从 IndexedDB/localStorage 获取数据
  const storageData = await page.evaluate(() => {
    const keys = Object.keys(localStorage);
    const result: Record<string, string> = {};
    for (const k of keys) {
      if (k.includes('project') || k.includes('harness') || k.includes('auth')) {
        result[k] = localStorage.getItem(k)?.substring(0, 200) || '';
      }
    }
    return result;
  });
  console.log('=== STORAGE ===');
  console.log(JSON.stringify(storageData, null, 2));
});
