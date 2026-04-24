/**
 * e281_helpers.js — E281 Playwright 测试共享工具
 *
 * 提供:
 *   attachRuntimeErrorCapture — 捕获页面运行时错误
 *   waitForAppReady — 等待应用初始化完成
 *   seedProjectData — 通过 addInitScript 注入 E281 种子数据
 *   readIndexedDB — 读取 IndexedDB 数据
 *   assertApprox — 浮点近似断言
 *   screenshotOnStep — 步骤截图
 */
const fs = require('fs');
const path = require('path');

const PROJECT_ID = 'E281';
const NAMESPACE = 'G281';

/**
 * 捕获页面运行时错误和 console.error
 * @param {import('@playwright/test').Page} page
 * @returns {string[]} 错误收集数组
 */
function attachRuntimeErrorCapture(page) {
  const errors = [];
  page.on('pageerror', (error) => {
    errors.push(String(error && error.message ? error.message : error));
  });
  page.on('console', (message) => {
    if (message.type() === 'error') {
      errors.push(message.text());
    }
  });
  return errors;
}

/**
 * 等待应用初始化完成（引擎加载 + 数据就绪）
 * @param {import('@playwright/test').Page} page
 * @param {object} [options]
 * @param {number} [options.timeout=60000]
 * @param {string} [options.selector='.landing-workbench'] — 等待可见的选择器
 * @returns {Promise<string[]>} 运行时错误列表
 */
async function waitForAppReady(page, options) {
  const timeout = options?.timeout || 60000;
  const selector = options?.selector;
  const errors = attachRuntimeErrorCapture(page);

  // 等待引擎全局对象可用（G281Engine 由 compute_model.js IIFE 设置）
  await page.waitForFunction(() => {
    return typeof globalThis.G281Engine === 'object';
  }, null, { timeout: 30000 });

  // 如果指定了选择器，等待其可见
  if (selector) {
    await page.waitForSelector(selector, { state: 'visible', timeout });
  }

  return errors;
}

/**
 * 读取 JSON 种子数据文件
 * @param {string} relativePath — 相对于项目根目录的路径
 * @returns {object}
 */
function readSeedJson(relativePath) {
  const root = path.resolve(__dirname, '..', '..');
  const fullPath = path.resolve(root, relativePath);
  const raw = fs.readFileSync(fullPath, 'utf8').replace(/^\uFEFF/, '');
  return JSON.parse(raw);
}

/**
 * 通过 page.addInitScript 在页面加载前注入 E281 项目数据到 localStorage
 * @param {import('@playwright/test').Page} page
 * @param {object} [overrides] — 可选覆盖项
 */
async function seedProjectData(page, overrides) {
  const seedData = readSeedJson('data/_e281_harness_seed_data.json');
  const projectConfig = readSeedJson('config/g281.project.json');

  // 修改 projectConfig 为 E281 项目
  const e281Config = { ...projectConfig };
  e281Config.projectId = PROJECT_ID;
  e281Config.projectName = 'E281 高压线束';
  e281Config.projectCode = PROJECT_ID;

  const dataMap = {
    [`${NAMESPACE}_PROJECT_CONFIG_${PROJECT_ID}`]: e281Config,
    [`${NAMESPACE}_SEED_DATA_${PROJECT_ID}`]: seedData,
  };

  // 尝试加载各维度数据
  const dimensionFiles = [
    { key: `${NAMESPACE.toLowerCase()}.bom.changes.v1`, file: 'data/g281_data_bom_changes.json' },
    { key: `${NAMESPACE.toLowerCase()}.bom.versions.v1`, file: 'data/g281_data_bom_versions.json' },
    { key: `${NAMESPACE.toLowerCase()}.financial.versions.v1`, file: 'data/g281_data_financial_versions.json' },
    { key: `${NAMESPACE.toLowerCase()}.bom.validation.v1`, file: 'data/g281_data_bom_validation.json' },
    { key: `${NAMESPACE.toLowerCase()}.labor.validation.v1`, file: 'data/g281_data_labor_validation.json' },
    { key: `${NAMESPACE.toLowerCase()}.packaging.validation.v1`, file: 'data/g281_data_packaging_validation.json' },
    { key: `${NAMESPACE.toLowerCase()}.capital.validation.v1`, file: 'data/g281_data_capital_validation.json' },
    { key: `${NAMESPACE.toLowerCase()}.approvals.v1`, file: 'data/g281_data_approvals.json' },
    { key: `${NAMESPACE.toLowerCase()}.history.v1`, file: 'data/g281_data_history.json' },
    { key: `${NAMESPACE.toLowerCase()}.master.v1`, file: 'data/g281_data_master.json' },
    { key: `${NAMESPACE.toLowerCase()}.wire.catalog.v1`, file: 'data/g281_data_wire_catalog.json' },
    { key: `${NAMESPACE.toLowerCase()}.connector.protocol.v1`, file: 'data/g281_data_connector_protocol_status.json' },
    { key: `${NAMESPACE.toLowerCase()}.config.sheet.copies.v1`, file: 'data/g281_data_config_sheet_copies.json' },
  ];

  dimensionFiles.forEach(({ key, file }) => {
    try {
      dataMap[key] = readSeedJson(file);
    } catch (_e) {
      // 文件不存在则跳过
    }
  });

  // 应用覆盖
  if (overrides) {
    Object.assign(dataMap, overrides);
  }

  // 注入 localStorage
  await page.addInitScript((map) => {
    try {
      // 注册项目到 workspace
      const registryKey = 'g281.workspace.projects.v1';
      const existing = JSON.parse(localStorage.getItem(registryKey) || '[]');
      if (!existing.some((p) => p.projectId === 'E281')) {
        existing.push({
          projectId: 'E281',
          projectName: 'E281 高压线束',
          customer: '吉利',
          createdAt: new Date().toISOString(),
        });
        localStorage.setItem(registryKey, JSON.stringify(existing));
      }

      // 设置当前项目
      localStorage.setItem('g281.workspace.currentProject.v1', 'E281');

      // 写入各维度数据
      Object.keys(map).forEach((k) => {
        localStorage.setItem(k, JSON.stringify(map[k]));
      });
    } catch (_e) {
      // 忽略存储错误
    }
  }, dataMap);
}

/**
 * 读取 IndexedDB 数据
 * @param {import('@playwright/test').Page} page
 * @param {string} dbName
 * @param {string} storeName
 * @returns {Promise<Array>}
 */
async function readIndexedDB(page, dbName, storeName) {
  return page.evaluate(async ({ db, store }) => {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(db);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const database = request.result;
        if (!database.objectStoreNames.contains(store)) {
          resolve([]);
          return;
        }
        const tx = database.transaction(store, 'readonly');
        const objectStore = tx.objectStore(store);
        const allRequest = objectStore.getAll();
        allRequest.onsuccess = () => resolve(allRequest.result);
        allRequest.onerror = () => reject(allRequest.error);
      };
    });
  }, { db: dbName, store: storeName });
}

/**
 * 浮点近似断言
 * @param {number} actual
 * @param {number} expected
 * @param {number} [epsilon=0.01] — 默认精确到分
 * @param {string} [label='']
 */
function assertApprox(actual, expected, epsilon, label) {
  const eps = epsilon !== undefined ? epsilon : 0.01;
  const diff = Math.abs(actual - expected);
  if (diff > eps) {
    throw new Error(
      `assertApprox${label ? ` [${label}]` : ''}: |${actual} - ${expected}| = ${diff} > ε=${eps}`
    );
  }
}

/**
 * 步骤截图
 * @param {import('@playwright/test').Page} page
 * @param {string} stepName
 * @param {object} [testInfo] — test.info() 返回的对象
 */
async function screenshotOnStep(page, stepName, testInfo) {
  if (testInfo) {
    await testInfo.attach(`${stepName}.png`, {
      body: await page.screenshot(),
      contentType: 'image/png',
    });
  }
}

/**
 * 通过 page.evaluate 调用引擎 API 注入数据
 * @param {import('@playwright/test').Page} page
 * @param {object} seedData — _e281_harness_seed_data.json 的内容
 */
async function injectSeedDataViaAPI(page, seedData) {
  return page.evaluate((data) => {
    const ns = globalThis;
    // 尝试通过 G281BomDb API 写入
    if (ns.G281BomDb && typeof ns.G281BomDb.putSeedData === 'function') {
      return ns.G281BomDb.putSeedData('E281', data);
    }
    // 尝试通过 G281Repo API 写入
    if (ns.G281Repo && typeof ns.G281Repo.saveHarnessSeedData === 'function') {
      return ns.G281Repo.saveHarnessSeedData('E281', data);
    }
    // 降级: 写入 localStorage
    try {
      localStorage.setItem('G281_SEED_DATA_E281', JSON.stringify(data));
      return { method: 'localStorage', ok: true };
    } catch (e) {
      return { method: 'none', ok: false, error: String(e) };
    }
  }, seedData);
}

/**
 * 触发引擎计算并返回结果
 * @param {import('@playwright/test').Page} page
 * @param {string} [projectId='E281']
 * @returns {Promise<object>} 计算结果
 */
async function triggerComputation(page, projectId) {
  const pid = projectId || PROJECT_ID;
  return page.evaluate((id) => {
    const ns = globalThis;
    if (ns.G281Engine && typeof ns.G281Engine.computeModel === 'function') {
      const runtime = ns.G281_RUNTIME || ns.G281DashboardBridge?.getRuntime?.();
      if (runtime) {
        const draft = ns.G281TargetPriceSolver?.buildQuoteBaselineDraft?.(runtime) || {};
        const state = ns.G281TargetPriceSolver?.buildQuoteBaselineState?.(runtime) || {};
        return ns.G281Engine.computeModel(runtime, draft, state);
      }
    }
    return null;
  }, pid);
}

module.exports = {
  PROJECT_ID,
  NAMESPACE,
  attachRuntimeErrorCapture,
  waitForAppReady,
  readSeedJson,
  seedProjectData,
  readIndexedDB,
  assertApprox,
  screenshotOnStep,
  injectSeedDataViaAPI,
  triggerComputation,
};
