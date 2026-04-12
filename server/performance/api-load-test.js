import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

// 自定义指标
const errorRate = new Rate('errors');

// 测试配置
export const options = {
  stages: [
    { duration: '30s', target: 5 },   // 预热：5个并发用户
    { duration: '1m', target: 10 },   // 负载测试：10个并发用户
    { duration: '30s', target: 20 },  // 压力测试：20个并发用户
    { duration: '30s', target: 0 },   // 冷却
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95% 请求延迟 < 500ms
    errors: ['rate<0.1'],              // 错误率 < 10%
  },
};

const BASE_URL = __ENV.API_URL || 'http://localhost:3000';

// 测试数据
const TEST_PROJECT_ID = 'test-project-001';
const TEST_SCENARIO_ID = 'test-scenario-001';

export default function () {
  // 测试 1: Dashboard 数据聚合
  const dashboardRes = http.get(`${BASE_URL}/api/projects/${TEST_PROJECT_ID}/dashboard`);
  check(dashboardRes, {
    'dashboard status is 200': (r) => r.status === 200,
    'dashboard response time < 500ms': (r) => r.timings.duration < 500,
  }) || errorRate.add(1);

  sleep(1);

  // 测试 2: 场景列表
  const scenariosRes = http.get(`${BASE_URL}/api/projects/${TEST_PROJECT_ID}/scenarios`);
  check(scenariosRes, {
    'scenarios status is 200': (r) => r.status === 200,
    'scenarios response time < 300ms': (r) => r.timings.duration < 300,
  }) || errorRate.add(1);

  sleep(1);

  // 测试 3: 线束成本计算
  const calculatePayload = JSON.stringify({
    harnessId: 'H001',
    bom: [
      { partNumber: 'CONN-001', quantity: 2, unitPrice: 15.5, category: 'connector' },
      { partNumber: 'WIRE-001', quantity: 100, unitPrice: 0.5, category: 'wire' },
    ],
    config: {
      laborRate: 50,
      manufacturingOverhead: 0.15,
    },
  });

  const calculateRes = http.post(
    `${BASE_URL}/api/harness/calculate`,
    calculatePayload,
    {
      headers: { 'Content-Type': 'application/json' },
    }
  );

  check(calculateRes, {
    'calculate status is 200': (r) => r.status === 200,
    'calculate response time < 500ms': (r) => r.timings.duration < 500,
    'calculate returns valid data': (r) => {
      try {
        const data = JSON.parse(r.body);
        return data.totalCost !== undefined;
      } catch {
        return false;
      }
    },
  }) || errorRate.add(1);

  sleep(2);

  // 测试 4: BOM 数据查询
  const bomRes = http.get(`${BASE_URL}/api/projects/${TEST_PROJECT_ID}/scenarios/${TEST_SCENARIO_ID}/bom`);
  check(bomRes, {
    'bom status is 200': (r) => r.status === 200,
    'bom response time < 400ms': (r) => r.timings.duration < 400,
  }) || errorRate.add(1);

  sleep(1);
}

export function handleSummary(data) {
  return {
    'performance-summary.json': JSON.stringify(data, null, 2),
    stdout: textSummary(data, { indent: ' ', enableColors: true }),
  };
}

function textSummary(data, options) {
  const indent = options.indent || '';
  const enableColors = options.enableColors || false;

  let summary = `\n${indent}Performance Test Summary\n`;
  summary += `${indent}========================\n\n`;

  // HTTP 请求统计
  const httpReqs = data.metrics.http_reqs;
  if (httpReqs) {
    summary += `${indent}Total Requests: ${httpReqs.values.count}\n`;
    summary += `${indent}Request Rate: ${httpReqs.values.rate.toFixed(2)}/s\n\n`;
  }

  // 响应时间统计
  const httpDuration = data.metrics.http_req_duration;
  if (httpDuration) {
    summary += `${indent}Response Time:\n`;
    summary += `${indent}  avg: ${httpDuration.values.avg.toFixed(2)}ms\n`;
    summary += `${indent}  min: ${httpDuration.values.min.toFixed(2)}ms\n`;
    summary += `${indent}  max: ${httpDuration.values.max.toFixed(2)}ms\n`;
    summary += `${indent}  p(50): ${httpDuration.values['p(50)'].toFixed(2)}ms\n`;
    summary += `${indent}  p(95): ${httpDuration.values['p(95)'].toFixed(2)}ms\n`;
    summary += `${indent}  p(99): ${httpDuration.values['p(99)'].toFixed(2)}ms\n\n`;
  }

  // 错误率
  const errors = data.metrics.errors;
  if (errors) {
    const errorRate = (errors.values.rate * 100).toFixed(2);
    summary += `${indent}Error Rate: ${errorRate}%\n\n`;
  }

  // 检查阈值
  const thresholds = data.root_group.checks;
  if (thresholds) {
    summary += `${indent}Checks:\n`;
    for (const [name, result] of Object.entries(thresholds)) {
      const status = result.passes === result.fails + result.passes ? '✓' : '✗';
      summary += `${indent}  ${status} ${name}: ${result.passes}/${result.passes + result.fails}\n`;
    }
  }

  return summary;
}
