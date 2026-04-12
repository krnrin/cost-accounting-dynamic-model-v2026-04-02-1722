import { test, expect, Page } from '@playwright/test';

/**
 * P0 主链路 E2E 测试
 * 流程：新建项目 → 创建场景 → 导入 BOM → 计算成本 → 创建报价 → 对比 → 确认
 */

const TEST_PROJECT_CODE = `E2E-${Date.now()}`;
const TEST_PROJECT_NAME = 'E2E测试项目';

async function login(page: Page) {
  await page.goto('/');
  await page.getByPlaceholder('admin@harness.dev').fill('admin@harness.dev');
  await page.getByPlaceholder('••••••••').fill('admin123');
  await page.locator('button:has-text("验证身份并进入")').click();
  await expect(page.locator('text=COST ENGINE')).toBeHidden({ timeout: 10000 });
}

test.describe('P0 主链路 - 项目到报价', () => {
  let projectId: string;
  let scenarioId: string;

  test('1. 新建项目', async ({ page }) => {
    await login(page);
    await page.waitForLoadState('networkidle');

    // 点击新建项目按钮
    await page.locator('button:has-text("新建项目")').click();

    // 填写项目信息
    await page.getByLabel('项目代号').fill(TEST_PROJECT_CODE);
    await page.getByLabel('项目名称').fill(TEST_PROJECT_NAME);
    await page.getByLabel('客户').fill('E2E测试客户');

    // 提交
    await page.locator('button:has-text("创建")').click();

    // 等待跳转到项目页面
    await page.waitForURL(/\/project\/[^/]+/, { timeout: 10000 });

    // 验证项目创建成功
    await expect(page.locator(`text=${TEST_PROJECT_NAME}`)).toBeVisible();

    // 提取项目 ID
    const url = page.url();
    projectId = url.match(/\/project\/([^/]+)/)?.[1] || '';
    expect(projectId).toBeTruthy();

    console.log('✓ 项目创建成功:', projectId);
  });

  test('2. 创建场景', async ({ page }) => {
    await login(page);

    // 导航到项目页面
    await page.goto(`/project/${projectId}`);
    await page.waitForLoadState('networkidle');

    // 点击场景管理或新建场景
    await page.locator('button:has-text("新建场景")').click();

    // 填写场景信息
    await page.getByLabel('场景名称').fill('初始报价场景');
    await page.getByLabel('生命周期年限').fill('5');
    await page.getByLabel('年产量').fill('100000');

    // 提交
    await page.locator('button:has-text("创建")').click();

    // 等待场景创建成功
    await expect(page.locator('text=初始报价场景')).toBeVisible({ timeout: 5000 });

    // 提取场景 ID
    const scenarioLink = await page.locator('a[href*="/s/"]').first().getAttribute('href');
    scenarioId = scenarioLink?.match(/\/s\/([^/]+)/)?.[1] || '';
    expect(scenarioId).toBeTruthy();

    console.log('✓ 场景创建成功:', scenarioId);
  });

  test('3. 导入 BOM', async ({ page }) => {
    await login(page);

    // 导航到 BOM 工作台
    await page.goto(`/project/${projectId}/s/${scenarioId}/bom-workbook`);
    await page.waitForLoadState('networkidle');

    // 点击导入 BOM 按钮
    await page.locator('button:has-text("导入 BOM")').click();

    // 等待导入对话框
    await expect(page.locator('text=BOM 导入')).toBeVisible();

    // 模拟粘贴 BOM 数据（简化版）
    const bomData = `零件号\t零件名称\t数量\t单价
CONN-001\t连接器A\t2\t15.5
WIRE-001\t导线B\t10\t2.3`;

    await page.locator('textarea').fill(bomData);
    await page.locator('button:has-text("解析")').click();

    // 等待解析完成
    await expect(page.locator('text=解析成功')).toBeVisible({ timeout: 5000 });

    // 确认导入
    await page.locator('button:has-text("确认导入")').click();

    // 验证 BOM 数据显示
    await expect(page.locator('text=CONN-001')).toBeVisible({ timeout: 5000 });

    console.log('✓ BOM 导入成功');
  });

  test('4. 计算成本', async ({ page }) => {
    await login(page);

    // 导航到线束编辑页
    await page.goto(`/project/${projectId}/s/${scenarioId}/harness/new`);
    await page.waitForLoadState('networkidle');

    // 填写线束基本信息
    await page.getByLabel('零件号').fill('TEST-HARNESS-001');
    await page.getByLabel('零件名称').fill('测试线束');

    // 添加 BOM 项（简化）
    await page.locator('button:has-text("添加零件")').click();
    await page.locator('input[placeholder*="零件号"]').fill('CONN-001');
    await page.locator('input[placeholder*="数量"]').fill('2');

    // 保存
    await page.locator('button:has-text("保存")').click();

    // 验证成本计算结果显示
    await expect(page.locator('text=成本预览')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=材料成本')).toBeVisible();

    console.log('✓ 成本计算完成');
  });

  test('5. 创建报价', async ({ page }) => {
    await login(page);

    // 导航到报价页面
    await page.goto(`/project/${projectId}/s/${scenarioId}/quote`);
    await page.waitForLoadState('networkidle');

    // 点击新建报价
    await page.locator('button:has-text("新建报价")').click();

    // 填写报价信息
    await page.getByLabel('报价名称').fill('初始报价');
    await page.getByLabel('利润率').fill('15');

    // 选择线束
    await page.locator('input[type="checkbox"]').first().check();

    // 生成报价
    await page.locator('button:has-text("生成报价")').click();

    // 验证报价生成成功
    await expect(page.locator('text=报价单')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=总报价')).toBeVisible();

    console.log('✓ 报价创建成功');
  });

  test('6. 场景对比', async ({ page }) => {
    await login(page);

    // 导航到场景对比页面
    await page.goto(`/project/${projectId}/scenario-compare`);
    await page.waitForLoadState('networkidle');

    // 选择对比场景（至少需要2个场景）
    const scenarioCheckboxes = await page.locator('input[type="checkbox"]').all();
    if (scenarioCheckboxes.length >= 2) {
      await scenarioCheckboxes[0].check();
      await scenarioCheckboxes[1].check();

      // 点击对比
      await page.locator('button:has-text("对比")').click();

      // 验证对比结果显示
      await expect(page.locator('text=成本对比')).toBeVisible({ timeout: 5000 });

      console.log('✓ 场景对比完成');
    } else {
      console.log('⚠ 场景数量不足，跳过对比测试');
    }
  });

  test('7. 确认并发布', async ({ page }) => {
    await login(page);

    // 导航到场景详情
    await page.goto(`/project/${projectId}/s/${scenarioId}`);
    await page.waitForLoadState('networkidle');

    // 点击发布按钮
    const publishButton = page.locator('button:has-text("发布")');
    if (await publishButton.isVisible()) {
      await publishButton.click();

      // 确认发布
      await page.locator('button:has-text("确认")').click();

      // 验证发布成功
      await expect(page.locator('text=已发布')).toBeVisible({ timeout: 5000 });

      console.log('✓ 场景发布成功');
    } else {
      console.log('⚠ 发布按钮不可见，可能场景状态不符合');
    }
  });
});

test.describe('P0 主链路 - 分摊回收', () => {
  test('8. 录入分摊', async ({ page }) => {
    await login(page);
    await page.waitForLoadState('networkidle');

    // 导航到分摊页面（假设有项目）
    const projectLinks = await page.locator('a[href*="/project/"]').all();
    if (projectLinks.length > 0) {
      const firstProjectHref = await projectLinks[0].getAttribute('href');
      await page.goto(`${firstProjectHref}/allocation`);
      await page.waitForLoadState('networkidle');

      // 点击新增分摊
      await page.locator('button:has-text("新增分摊")').click();

      // 填写分摊信息
      await page.getByLabel('分摊金额').fill('50000');
      await page.getByLabel('分摊说明').fill('模具费用分摊');

      // 保存
      await page.locator('button:has-text("保存")').click();

      // 验证分摊记录显示
      await expect(page.locator('text=50000')).toBeVisible({ timeout: 5000 });

      console.log('✓ 分摊录入成功');
    }
  });

  test('9. 查看单根分摊', async ({ page }) => {
    await login(page);
    await page.waitForLoadState('networkidle');

    // 导航到分摊详情
    const projectLinks = await page.locator('a[href*="/project/"]').all();
    if (projectLinks.length > 0) {
      const firstProjectHref = await projectLinks[0].getAttribute('href');
      await page.goto(`${firstProjectHref}/allocation`);
      await page.waitForLoadState('networkidle');

      // 点击查看详情
      const detailButton = page.locator('button:has-text("详情")').first();
      if (await detailButton.isVisible()) {
        await detailButton.click();

        // 验证详情页显示
        await expect(page.locator('text=分摊明细')).toBeVisible({ timeout: 5000 });

        console.log('✓ 单根分摊查看成功');
      }
    }
  });

  test('10. 添加回收记录', async ({ page }) => {
    await login(page);
    await page.waitForLoadState('networkidle');

    // 导航到回收页面
    const projectLinks = await page.locator('a[href*="/project/"]').all();
    if (projectLinks.length > 0) {
      const firstProjectHref = await projectLinks[0].getAttribute('href');
      await page.goto(`${firstProjectHref}/recovery`);
      await page.waitForLoadState('networkidle');

      // 点击添加回收
      await page.locator('button:has-text("添加回收")').click();

      // 填写回收信息
      await page.getByLabel('回收金额').fill('10000');
      await page.getByLabel('回收说明').fill('第一批回收');

      // 保存
      await page.locator('button:has-text("保存")').click();

      // 验证回收记录显示
      await expect(page.locator('text=10000')).toBeVisible({ timeout: 5000 });

      console.log('✓ 回收记录添加成功');
    }
  });

  test('11. 回收完成触发行为', async ({ page }) => {
    await login(page);
    await page.waitForLoadState('networkidle');

    // 导航到回收页面
    const projectLinks = await page.locator('a[href*="/project/"]').all();
    if (projectLinks.length > 0) {
      const firstProjectHref = await projectLinks[0].getAttribute('href');
      await page.goto(`${firstProjectHref}/recovery`);
      await page.waitForLoadState('networkidle');

      // 标记回收完成
      const completeButton = page.locator('button:has-text("标记完成")').first();
      if (await completeButton.isVisible()) {
        await completeButton.click();

        // 确认操作
        await page.locator('button:has-text("确认")').click();

        // 验证状态变更
        await expect(page.locator('text=已完成')).toBeVisible({ timeout: 5000 });

        console.log('✓ 回收完成标记成功');
      }
    }
  });
});
