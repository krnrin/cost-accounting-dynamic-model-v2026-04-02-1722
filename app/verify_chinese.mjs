import { chromium } from '@playwright/test';

const browser = await chromium.launch({ headless: false });
const page = await browser.newPage();
await page.goto('http://localhost:5179/');
await page.waitForTimeout(2000);

const bodyText = await page.locator('body').textContent();
console.log('=== 页面文本前 200 字符 ===');
console.log(bodyText.substring(0, 200));

await page.screenshot({ path: 'chinese-fixed.png', fullPage: true });
console.log('\n截图已保存: chinese-fixed.png');

await page.waitForTimeout(10000);
await browser.close();
