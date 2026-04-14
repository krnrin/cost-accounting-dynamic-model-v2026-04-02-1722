import { chromium } from '@playwright/test';

const browser = await chromium.launch({ headless: false });
const page = await browser.newPage();
await page.goto('http://localhost:5179/');
console.log('浏览器已打开，按 Ctrl+C 关闭');
await page.waitForTimeout(300000); // 等待 5 分钟
await browser.close();
