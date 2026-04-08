/**
 * API integration test script.
 * Starts server, runs all endpoint tests, then exits.
 */
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BASE = 'http://localhost:3001';

// Random suffixes for idempotency
const suffix = Math.floor(Math.random() * 1000000);
const TEST_USER = {
  email: `test_${suffix}@harness.dev`,
  password: 'test123',
  name: '测试用户',
  role: 'VIEWER',
};
const TEST_PROJECT = {
  projectCode: `E${suffix}`.substring(0, 10),
  projectName: `Project ${suffix}`,
  customer: '吉利汽车',
  platform: 'CMA',
  costRates: { laborRate: 35, mfgRate: 46.69 },
  metalPrices: { copper: 72.5, aluminum: 20.8 },
};
const TEST_HARNESS = {
  harnessId: `H${suffix}`.substring(0, 10),
  harnessName: '压缩机线束',
  input: { copperWeight: 0.5, processHours: 0.06 },
};
const TEST_VERSION_NUM = Math.floor(Math.random() * 1000) + 10;

// Start server
const server = spawn(process.execPath, ['--import', 'tsx', 'src/index.ts'], {
  cwd: __dirname,
  stdio: 'pipe',
  env: { ...process.env },
});

let serverReady = false;
server.stdout.on('data', (d) => {
  if (d.toString().includes('Server running')) serverReady = true;
});
server.stderr.on('data', (d) => process.stderr.write(d));

async function waitReady(ms = 8000) {
  const start = Date.now();
  while (!serverReady && Date.now() - start < ms) {
    await new Promise((r) => setTimeout(r, 200));
  }
  if (!serverReady) throw new Error('Server did not start in time');
}

async function api(method, path, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const opts = { method, headers };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${BASE}${path}`, opts);
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = text; }
  return { status: res.status, json };
}

let passed = 0;
let failed = 0;

function assert(name, condition, detail) {
  if (condition) {
    console.log(`  ✅ ${name}`);
    passed++;
  } else {
    console.log(`  ❌ ${name} — ${detail || 'failed'}`);
    failed++;
  }
}

async function runTests() {
  await waitReady();
  console.log('\n📋 API Integration Tests\n');

  // 1. Health check
  const h = await api('GET', '/health');
  assert('GET /health', h.status === 200 && h.json.status === 'ok');

  // 2. Login
  const login = await api('POST', '/api/auth/login', {
    email: 'admin@harness.dev',
    password: 'admin123',
  });
  assert('POST /api/auth/login (admin)', login.status === 200 && login.json.data?.token);
  const token = login.json.data?.token;

  // 3. Auth /me
  const me = await api('GET', '/api/auth/me', null, token);
  assert('GET /api/auth/me', me.status === 200 && me.json.data?.email === 'admin@harness.dev');

  // 4. Register new user
  const reg = await api('POST', '/api/auth/register', TEST_USER);
  assert('POST /api/auth/register', reg.status === 201 && reg.json.data?.user?.email === TEST_USER.email);

  // 5. List projects
  const projList = await api('GET', '/api/projects', null, token);
  assert('GET /api/projects', projList.status === 200 && Array.isArray(projList.json.data));
  const g281 = projList.json.data?.find(p => p.projectCode === 'G281');
  assert('  → G281 project exists', !!g281);
  const projectId = g281?.id;

  // 6. Get project by ID
  const projGet = await api('GET', `/api/projects/${projectId}`, null, token);
  assert('GET /api/projects/:id', projGet.status === 200 && projGet.json.data?.projectCode === 'G281');

  // 7. Create new project
  const projCreate = await api('POST', '/api/projects', TEST_PROJECT, token);
  assert(`POST /api/projects (create ${TEST_PROJECT.projectCode})`, projCreate.status === 201 && projCreate.json.data?.projectCode === TEST_PROJECT.projectCode);
  const e281Id = projCreate.json.data?.id;

  // 7b. Audit log test (added)
  const auditLogs = await api('GET', `/api/projects/${e281Id}/audit-logs`, null, token);
  assert('GET /api/projects/:id/audit-logs', auditLogs.status === 200 && auditLogs.json.data?.length >= 1);
  const createLog = auditLogs.json.data?.find(l => l.action === 'CREATE' && l.entity === 'project');
  assert('  → Audit log for project creation exists', !!createLog);

  // 8. Update project
  const projUp = await api('PUT', `/api/projects/${e281Id}`, {
    projectName: TEST_PROJECT.projectName + '-更新',
  }, token);
  assert('PUT /api/projects/:id', projUp.status === 200 && projUp.json.data?.projectName?.includes('更新'));

  // 9. List harnesses
  const hList = await api('GET', `/api/projects/${projectId}/harnesses`, null, token);
  assert('GET /api/projects/:pid/harnesses', hList.status === 200 && Array.isArray(hList.json.data));
  assert('  → 2 seeded harnesses', hList.json.data?.length === 2);

  // 10. Create harness
  const hCreate = await api('POST', `/api/projects/${projectId}/harnesses`, TEST_HARNESS, token);
  assert(`POST harness (create ${TEST_HARNESS.harnessId})`, hCreate.status === 201 && hCreate.json.data?.harnessId === TEST_HARNESS.harnessId);
  const newHarnessId = hCreate.json.data?.id;

  // 11. Update harness
  const hUp = await api('PUT', `/api/projects/${projectId}/harnesses/${newHarnessId}`, {
    harnessName: '压缩机线束-V2',
  }, token);
  assert('PUT harness (update)', hUp.status === 200 && hUp.json.data?.harnessName === '压缩机线束-V2');

  // 12. Delete harness
  const hDel = await api('DELETE', `/api/projects/${projectId}/harnesses/${newHarnessId}`, null, token);
  assert('DELETE harness', hDel.status === 204);

  // 13. Create quote
  const qCreate = await api('POST', '/api/quotes', {
    projectId,
    version: 'v1.0',
    template: 'geely',
    data: { items: [{ name: '总价', value: 526.63 }] },
  }, token);
  assert('POST /api/quotes (create)', qCreate.status === 201);
  const quoteId = qCreate.json.data?.id;

  // 14. List quotes
  const qList = await api('GET', `/api/quotes/project/${projectId}`, null, token);
  assert('GET /api/quotes/project/:pid', qList.status === 200 && qList.json.data?.length >= 1);

  // 15. Update quote
  const qUp = await api('PUT', `/api/quotes/${quoteId}`, {
    status: 'approved',
  }, token);
  assert('PUT /api/quotes/:id', qUp.status === 200 && qUp.json.data?.status === 'approved');

  // 16. Create version
  const vCreate = await api('POST', '/api/versions', {
    projectId,
    versionNumber: TEST_VERSION_NUM,
    label: 'v1.0-定点',
    snapshot: { costPerVehicle: 526.63, harnesses: 11 },
  }, token);
  assert('POST /api/versions (create)', vCreate.status === 201);
  const versionId = vCreate.json.data?.id;

  // 17. List versions
  const vList = await api('GET', `/api/versions/project/${projectId}`, null, token);
  assert('GET /api/versions/project/:pid', vList.status === 200 && vList.json.data?.length >= 1);

  // 18. Update version status
  const vPatch = await api('PATCH', `/api/versions/${versionId}/status`, {
    status: 'reviewed',
  }, token);
  assert('PATCH /api/versions/:id/status', vPatch.status === 200 && vPatch.json.data?.status === 'reviewed');

  // 19. Sync push
  const syncPush = await api('POST', '/api/sync/push', {
    changes: [{
      id: `change-${suffix}`,
      entity: 'project',
      operation: 'upsert',
      entityId: e281Id,
      payload: {
        projectCode: TEST_PROJECT.projectCode,
        projectName: TEST_PROJECT.projectName + '-Synced',
        customer: '吉利汽车',
        costRates: {},
        metalPrices: {},
      },
    }],
  }, token);
  assert('POST /api/sync/push', syncPush.status === 200 && syncPush.json.accepted?.length === 1);

  // 20. Sync pull
  const syncPull = await api('GET', '/api/sync/pull?since=2020-01-01T00:00:00Z', null, token);
  assert('GET /api/sync/pull', syncPull.status === 200 && syncPull.json.projects?.length >= 1);

  // 21. RBAC test: viewer cannot create project
  const viewerLogin = await api('POST', '/api/auth/login', {
    email: TEST_USER.email,
    password: TEST_USER.password,
  });
  const viewerToken = viewerLogin.json.data?.token;
  const rbacTest = await api('POST', '/api/projects', {
    projectCode: `X${suffix}`.substring(0, 10),
    projectName: 'Should Fail',
    customer: 'Test',
    costRates: {},
    metalPrices: {},
  }, viewerToken);
  assert('RBAC: VIEWER cannot POST /api/projects', rbacTest.status === 403);

  // 22. Unauth test
  const noAuth = await api('GET', '/api/projects');
  assert('Unauth: GET /api/projects returns 401', noAuth.status === 401);

  // Cleanup: delete test project
  if (e281Id) {
    await api('DELETE', `/api/projects/${e281Id}`, null, token);
  }
  // Delete created quote and version from step 13/16 (though they should cascade if we deleted their project, but they were on projectId which is G281)
  if (quoteId) await api('DELETE', `/api/quotes/${quoteId}`, null, token);
  if (versionId) await api('DELETE', `/api/versions/${versionId}`, null, token);

  // Summary
  console.log(`\n📊 Results: ${passed} passed, ${failed} failed (${passed + failed} total)\n`);

  return failed;
}

runTests()
  .then((fails) => {
    server.kill();
    process.exit(fails > 0 ? 1 : 0);
  })
  .catch((err) => {
    console.error('Test error:', err);
    server.kill();
    process.exit(1);
  });
