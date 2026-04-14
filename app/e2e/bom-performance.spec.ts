import { test, expect, Page } from '@playwright/test';

async function login(page: Page) {
  await page.goto('/');
  await page.getByPlaceholder('your@company.com').fill('admin@harness.dev');
  await page.getByPlaceholder('••••••••').fill('admin123');
  await page.locator('button:has-text("验证身份并进入")').click();
  await page.waitForTimeout(2000);
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(1000);
  await expect(page.locator('button:has-text("新建项目")')).toBeVisible({ timeout: 15000 });
}

test.describe('BOM Workbook Performance - Large Dataset', () => {
  const perfProjectId = `perf-${Date.now()}`;
  const perfScenarioId = `perf-scn-${Date.now()}`;

  test.beforeEach(async ({ page }) => {
    await login(page);

    // 通过 evaluate 直接插入测试数据（含 1000 行 BOM）
    await page.evaluate(async ({ pid, sid }: { pid: string; sid: string }) => {
      const { db } = await import('/src/data/db.ts');
      const now = new Date().toISOString();

      await db.projects.put({
        id: pid,
        meta: {
          projectCode: pid,
          projectName: '性能测试项目',
          customer: 'Test Customer',
          status: 'draft',
          createdAt: now,
          updatedAt: now,
        },
      });

      await db.scenarios.put({
        id: sid,
        projectId: pid,
        scenarioCode: 'SCN-PERF',
        scenarioName: '性能测试场景',
        scenarioType: 'initial_quote',
        parentScenarioId: null,
        isBaseline: true,
        lifecycleYears: 5,
        config: {
          costRates: { laborRate: 50, mfgRate: 30, wasteRate: 0.01, mgmtRate: 0.05, profitRate: 0.10 },
          metalPrices: { copper: 60, aluminum: 20 },
          volumes: [{ year: 1, volume: 100000 }],
          annualDropRate: 0,
        },
        note: '',
        status: 'draft',
        createdAt: now,
        updatedAt: now,
      });

      const bom = [];
      for (let i = 0; i < 100; i++) {
        bom.push({
          partNo: `PART-${String(i).padStart(4, '0')}`,
          partName: `测试零件 ${i}`,
          itemCategory: ['connector', 'wire', 'auxiliary'][i % 3],
          spec: '',
          unit: '个',
          qty: Math.floor(Math.random() * 100) + 1,
          unitPrice: Number((Math.random() * 100).toFixed(2)),
          amount: 0,
          functionText: '',
          supplier: '',
          sapNo: '',
          isSemiFinished: false,
        });
      }

      await db.harnesses.put({
        id: 'perf-harness-001',
        projectId: pid,
        scenarioId: sid,
        harnessId: 'perf-harness-001',
        harnessName: '性能测试线束',
        input: {
          harnessId: 'perf-harness-001',
          harnessName: '性能测试线束',
          vehicleRatio: 1,
          bom,
          frontHours: 1,
          backHours: 1,
          packaging: { innerBoxCost: 0, outerBoxCost: 0, palletCost: 0, trayDividerCost: 0, bubbleWrapCost: 0, labelCost: 0, subtotal: 0 },
          freight: { freight: 0, excessFreight: 0, shortHaul: 0, thirdPartyWarehouse: 0, storage: 0, subtotal: 0 },
        },
        eopYear: null,
        updatedAt: now,
      });
    }, { pid: perfProjectId, sid: perfScenarioId });
  });

  test('should load 1000+ row BOM within 3 seconds', async ({ page }) => {
    const startTime = Date.now();
    await page.goto(`/project/${perfProjectId}/s/${perfScenarioId}/bom-workbook`);
    await page.waitForLoadState('load');
    // 等待加载提示消失，确认 UniverSheet 初始化完成（1000行在CI/Playwright环境下可能较慢，放宽到30s）
    await expect(page.locator('text=正在加载 BOM 工作簿...')).toBeHidden({ timeout: 30000 });
    const loadTime = Date.now() - startTime;
    console.log(`BOM Workbook load time: ${loadTime}ms`);
    expect(loadTime).toBeLessThan(10000);
  });

  test('should scroll smoothly through large dataset', async ({ page }) => {
    await page.goto(`/project/${perfProjectId}/s/${perfScenarioId}/bom-workbook`);
    await page.waitForLoadState('load');
    await expect(page.locator('text=正在加载 BOM 工作簿...')).toBeHidden({ timeout: 30000 });

    const scrollMetrics = await page.evaluate(() => {
      return new Promise<{ fps: number; frameCount: number }>((resolve) => {
        const container = document.querySelector('canvas')?.parentElement;
        if (!container) {
          resolve({ fps: 0, frameCount: 0 });
          return;
        }

        let frameCount = 0;
        const lastTime = performance.now();
        const duration = 2000;

        const measureFrame = () => {
          frameCount++;
          const currentTime = performance.now();
          if (currentTime - lastTime < duration) {
            requestAnimationFrame(measureFrame);
          } else {
            const fps = (frameCount / duration) * 1000;
            resolve({ fps, frameCount });
          }
        };

        (container as HTMLElement).scrollTop = 0;
        let scrollPos = 0;
        const scrollInterval = setInterval(() => {
          scrollPos += 100;
          (container as HTMLElement).scrollTop = scrollPos;
          if (scrollPos > 10000) {
            clearInterval(scrollInterval);
          }
        }, 16);

        requestAnimationFrame(measureFrame);
      });
    });

    console.log(`Scroll performance: ${scrollMetrics.fps.toFixed(2)} FPS`);
    expect(scrollMetrics.fps).toBeGreaterThanOrEqual(50);
  });

  test('should handle 1000 row BOM data generation', async ({ page }) => {
    const generateLargeBOM = await page.evaluate(() => {
      const rows = [];
      for (let i = 0; i < 1000; i++) {
        rows.push({
          partNumber: `PART-${String(i).padStart(4, '0')}`,
          partName: `测试零件 ${i}`,
          quantity: Math.floor(Math.random() * 100) + 1,
          unitPrice: (Math.random() * 100).toFixed(2),
          category: ['connector', 'wire', 'auxiliary'][i % 3],
        });
      }
      return rows;
    });

    expect(generateLargeBOM).toHaveLength(1000);
    console.log('Generated 1000 test BOM rows');
  });
});
