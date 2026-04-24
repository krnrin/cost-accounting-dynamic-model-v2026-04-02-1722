/**
 * e281_seed_data.js — E281 种子数据模块
 *
 * 从 data/_e281_harness_seed_data.json 导入，供 Playwright 测试使用
 * 包含 9 条线束的成本明细 + 项目汇总 + 费率配置
 */
const fs = require('fs');
const path = require('path');

function loadE281SeedData() {
  const root = path.resolve(__dirname, '..', '..');
  const filePath = path.resolve(root, 'data', '_e281_harness_seed_data.json');
  const raw = fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '');
  return JSON.parse(raw);
}

function loadE281ProjectConfig() {
  const root = path.resolve(__dirname, '..', '..');
  const filePath = path.resolve(root, 'config', 'g281.project.json');
  const raw = fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '');
  const config = JSON.parse(raw);
  // 覆盖为 E281 项目标识
  config.projectId = 'E281';
  config.projectName = 'E281 高压线束';
  config.projectCode = 'E281';
  return config;
}

// 9 条线束 ID
const E281_HARNESS_IDS = [
  '6608491523',
  '6608491524',
  '6608442962',
  '6608544875',
  '6608442964',
  '6608519100',
  '6608442963',
  '6608516992',
  '6608442966',
];

// 11 条线束 ID（含 6608442965 和 6608507680）
const E281_ALL_HARNESS_IDS = [
  ...E281_HARNESS_IDS,
  '6608442965',
  '6608507680',
];

// 生命周期年产量
const E281_ANNUAL_VOLUMES = [85000, 135000, 125000, 114000, 94000, 47000];

// 车型配置
const E281_VEHICLE_CONFIGS = [
  { name: '高配', ratio: 0.3 },
  { name: '低配', ratio: 0.5 },
  { name: '出口', ratio: 0.2 },
];

// 客户费率
const E281_CUSTOMER_RATES = {
  laborRate: 35,
  mfgRate: 46.69,
  wasteRate: 0.01,
  mgmtRate: 0.06,
  profitRate: 0.056627,
};

// 内部费率
const E281_INTERNAL_RATES = {
  laborRate: 29.19,
  mfgRateTotal: 19.74,
  wasteRate: 0.005,
};

// 金属基价
const E281_METAL_PRICES = {
  copper: 68400,
  aluminum: 18200,
};

/**
 * 从种子数据中提取单条线束的期望成本
 * @param {object} seedData
 * @param {string} harnessId
 * @returns {object|null}
 */
function getHarnessExpectedCost(seedData, harnessId) {
  const harnesses = seedData?.harnesses || [];
  return harnesses.find((h) => h.harnessId === harnessId) || null;
}

/**
 * 提取所有线束的期望成本映射
 * @param {object} seedData
 * @returns {Object<string, object>}
 */
function getAllHarnessExpectedCosts(seedData) {
  const result = {};
  (seedData?.harnesses || []).forEach((h) => {
    result[h.harnessId] = h;
  });
  return result;
}

module.exports = {
  loadE281SeedData,
  loadE281ProjectConfig,
  E281_HARNESS_IDS,
  E281_ALL_HARNESS_IDS,
  E281_ANNUAL_VOLUMES,
  E281_VEHICLE_CONFIGS,
  E281_CUSTOMER_RATES,
  E281_INTERNAL_RATES,
  E281_METAL_PRICES,
  getHarnessExpectedCost,
  getAllHarnessExpectedCosts,
};
