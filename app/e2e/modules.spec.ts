import { test, expect, Page } from '@playwright/test';

const PROJECT_ID = 'g281-demo';
const HARNESS_ID = 'g281-6608491523'; // 第一条线束

async function login(page: Page) {
  await page.goto('/');
  await page.getByPlaceholder('admin@harness.dev').fill('admin@harness.dev');
  await page.getByPlaceholder('••••••••').fill('admin123');
  await page.locator('button:has-text("验证身份并进入")').click();
  await expect(page.locator('text=COST ENGINE')).toBeHidden({ timeout: 10000 });
}

async function seedE281(page: Page) {
  // 在浏览器中调用种子函数，通过动态 import
  const seeded = await page.evaluate(async () => {
    try {
      const { seedG281Project } = await import('/src/data/seeds/g281.ts');
      const id = await seedG281Project();
      return id;
    } catch (e) {
      return (e as Error).message;
    }
  });
  return seeded;
}

async function loginAndSeed(page: Page) {
  await login(page);
  await page.waitForLoadState('networkidle');

  // 检查项目是否已存在
  const exists = await page.evaluate(async (pid) => {
    return new Promise<boolean>((resolve) => {
      const req = indexedDB.open('HarnessCostDB');
      req.onsuccess = () => {
        const db = req.result;
        const tx = db.transaction('projects', 'readonly');
        const store = tx.objectStore('projects');
        const get = store.get(pid);
        get.onsuccess = () => resolve(!!get.result);
        get.onerror = () => resolve(false);
      };
      req.onerror = () => resolve(false);
    });
  }, PROJECT_ID);

  if (!exists) {
    await seedE281(page);
    // 刷新让应用读取新数据
    await page.reload();
    await login(page);
  }
}
