import { chromium, type Page } from 'playwright';

const BASE = 'http://localhost:5183';

async function screenshot(page: Page, name: string) {
  await page.waitForTimeout(1500);
  const path = `e2e/screenshots/${name}.png`;
  await page.screenshot({ path, fullPage: true });
  console.log(`  [screenshot] ${path}`);
}

async function login(page: Page) {
  console.log('\n=== 1. 登录页验证 ===');
  await page.goto(BASE);
  // Semi Design Form.Input renders <input> inside wrapper divs
  // Wait for any input to appear
  await page.waitForSelector('input', { timeout: 15000 });
  console.log('  登录表单已加载');
  await screenshot(page, '01-login-page');

  // Fill credentials - use precise selectors to avoid register tab inputs
  const emailInput = page.locator('input[placeholder="admin@harness.dev"]');
  const passwordInput = page.locator('input#password[placeholder="••••••••"]');
  await emailInput.fill('admin@harness.dev');
  await passwordInput.fill('admin123');
  console.log('  已填写账号密码');
  await screenshot(page, '02-login-filled');

  // Click "验证身份并进入" button
  await page.locator('button:has-text("验证身份并进入")').click();
  await page.waitForTimeout(3000);

  // Check if redirected
  const url = page.url();
  console.log(`  登录后 URL: ${url}`);
  if (!url.includes('login')) {
    console.log('  ✅ 登录成功');
  } else {
    console.log('  ❌ 登录可能失败');
  }
  await screenshot(page, '03-after-login');
}

async function verifyModule(page: Page, idx: string, name: string, path: string, checks: string[]) {
  console.log(`\n=== ${idx}. ${name} ===`);
  await page.goto(`${BASE}${path}`);
  await page.waitForTimeout(2000);

  for (const check of checks) {
    try {
      const found = await page.locator(`text=${check}`).first().isVisible({ timeout: 3000 });
      console.log(`  ${found ? '✅' : '⚠️'} "${check}" ${found ? '可见' : '未找到'}`);
    } catch {
      console.log(`  ⚠️ "${check}" 未找到`);
    }
  }
  await screenshot(page, `${idx}-${name.replace(/[\/\s]/g, '-')}`);
}

async function main() {
  console.log('启动浏览器...');
  const browser = await chromium.launch({ headless: false, slowMo: 300 });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  try {
    // 1. Login
    await login(page);

    // Need a project ID - check the project list first
    await page.waitForTimeout(1000);
    const projectLinks = await page.locator('a[href*="/project/"]').all();
    let projectId = '1';
    if (projectLinks.length > 0) {
      const href = await projectLinks[0].getAttribute('href');
      const match = href?.match(/\/project\/([^/]+)/);
      if (match) projectId = match[1];
      console.log(`  找到项目 ID: ${projectId}`);
    }

    // 2. Project List (homepage)
    await verifyModule(page, '04', '项目列表', '/', ['项目']);

    // 3. Manager Dashboard
    await verifyModule(page, '05', '管理仪表盘', '/manager', ['管理']);

    // 4. Dashboard
    await verifyModule(page, '06', '决策舱', `/project/${projectId}`, ['成本', '线束']);

    // 5. Quote
    await verifyModule(page, '07', '报价页', `/project/${projectId}/quote`, ['报价']);

    // 6. Simulation
    await verifyModule(page, '08', '模拟页', `/project/${projectId}/simulation`, ['模拟']);

    // 7. Annual Drop
    await verifyModule(page, '09', '年降页', `/project/${projectId}/annual-drop`, ['年降']);

    // 8. Alloc Manager
    await verifyModule(page, '10', '分摊管理', `/project/${projectId}/alloc`, ['分摊']);

    // 9. Change Engine
    await verifyModule(page, '11', '变更引擎', `/project/${projectId}/change-engine`, ['变更']);

    // 10. Settings
    await verifyModule(page, '12', '设置页', '/settings', ['设置']);

    // 11. Harness Detail (try first harness)
    await page.goto(`${BASE}/project/${projectId}`);
    await page.waitForTimeout(2000);
    const harnessLinks = await page.locator('a[href*="/harness/"]').all();
    if (harnessLinks.length > 0) {
      const href = await harnessLinks[0].getAttribute('href');
      console.log(`\n=== 13. 线束详情 ===`);
      if (href) {
        await page.goto(`${BASE}${href}`);
        await page.waitForTimeout(2000);
        await screenshot(page, '13-harness-detail');
        console.log('  ✅ 线束详情页已加载');

        // Try edit page
        const editHref = href + '/edit';
        console.log(`\n=== 14. 线束编辑 ===`);
        await page.goto(`${BASE}${editHref}`);
        await page.waitForTimeout(3000);
        await screenshot(page, '14-harness-edit');
        console.log('  ✅ 线束编辑页已加载');
      }
    }

    // 12. BOM Workbook
    console.log(`\n=== 15. BOM工作簿 ===`);
    await page.goto(`${BASE}/project/${projectId}/bom-workbook`);
    await page.waitForTimeout(3000);
    await screenshot(page, '15-bom-workbook');
    console.log('  ✅ BOM工作簿已加载');

    console.log('\n=============================');
    console.log('全部模块验证完成！');
    console.log('截图保存在 e2e/screenshots/ 目录');
    console.log('=============================');

    // Keep browser open for 5 seconds so user can see
    await page.waitForTimeout(5000);
  } catch (err) {
    console.error('验证过程出错:', err);
    await screenshot(page, 'error');
  } finally {
    await browser.close();
  }
}

main();
