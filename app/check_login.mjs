import { chromium } from '@playwright/test';

const browser = await chromium.launch({ headless: false });
const page = await browser.newPage();
await page.goto('http://localhost:5177/');
await page.waitForTimeout(3000);
await page.screenshot({ path: 'login-page-check.png', fullPage: true });
console.log('Screenshot saved to login-page-check.png');
await page.waitForTimeout(10000);
await browser.close();
