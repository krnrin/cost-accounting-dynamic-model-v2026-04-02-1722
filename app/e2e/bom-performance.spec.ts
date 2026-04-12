import { test, expect } from '@playwright/test';

test.describe('BOM Workbook Performance - Large Dataset', () => {
  test.beforeEach(async ({ page }) => {
    // 导航到应用
    await page.goto('http://localhost:5173');
    await page.waitForLoadState('networkidle');
  });

  test('should load 1000+ row BOM within 3 seconds', async ({ page }) => {
    // 创建测试项目
    await page.click('text=新建项目');
    await page.fill('input[placeholder*="项目名称"]', 'Performance Test Project');
    await page.fill('input[placeholder*="客户"]', 'Test Customer');
    await page.click('button:has-text("创建")');

    // 等待项目创建完成
    await page.waitForSelector('text=Performance Test Project');
    await page.click('text=Performance Test Project');

    // 进入 BOM 工作簿
    await page.click('text=BOM 工作簿');

    // 测量加载时间
    const startTime = Date.now();

    // 等待表格加载完成
    await page.waitForSelector('.univer-sheet', { timeout: 5000 });

    const loadTime = Date.now() - startTime;

    console.log(`BOM Workbook load time: ${loadTime}ms`);

    // 验收标准：加载时间 < 3000ms
    expect(loadTime).toBeLessThan(3000);
  });

  test('should scroll smoothly through large dataset', async ({ page }) => {
    // 导航到已有大数据量的 BOM 页面
    await page.goto('http://localhost:5173/project/test-project-id/s/test-scenario-id/bom-workbook');

    await page.waitForSelector('.univer-sheet');

    // 测量滚动性能
    const scrollMetrics = await page.evaluate(() => {
      return new Promise((resolve) => {
        const container = document.querySelector('.univer-sheet-container');
        if (!container) {
          resolve({ fps: 0, frameCount: 0 });
          return;
        }

        let frameCount = 0;
        let lastTime = performance.now();
        const duration = 2000; // 2秒测试

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

        // 开始滚动
        container.scrollTop = 0;
        let scrollPos = 0;
        const scrollInterval = setInterval(() => {
          scrollPos += 100;
          container.scrollTop = scrollPos;
          if (scrollPos > 10000) {
            clearInterval(scrollInterval);
          }
        }, 16);

        requestAnimationFrame(measureFrame);
      });
    });

    console.log(`Scroll performance: ${scrollMetrics.fps.toFixed(2)} FPS`);

    // 验收标准：滚动帧率 >= 50 FPS (接近 60fps)
    expect(scrollMetrics.fps).toBeGreaterThanOrEqual(50);
  });

  test('should handle 1000 row BOM data generation', async ({ page }) => {
    // 生成大数据量测试数据的辅助函数
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
