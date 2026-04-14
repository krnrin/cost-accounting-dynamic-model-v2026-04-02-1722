import { chromium } from '@playwright/test';

const browser = await chromium.launch({ headless: false });
const page = await browser.newPage();
await page.goto('http://localhost:5179/');
await page.waitForTimeout(2000);

// 截图
await page.screenshot({ path: 'current-state.png', fullPage: true });

// 获取页面文本内容
const bodyText = await page.locator('body').textContent();
console.log('=== 页面文本内容前 500 字符 ===');
console.log(bodyText.substring(0, 500));

await page.waitForTimeout(10000);
await browser.close();
