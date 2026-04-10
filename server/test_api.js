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
const TEST_SCENARIO = {
  type: 'initial_quote',
  name: `Scenario ${suffix}`,
  lifecycleYears: 5,
  volume: 100000,
  installRatio: 1,
  rateSnapshot: { laborRate: 35, mfgRate: 46.69 },
  quoteParamSnapshot: { source: 'api-test' },
};
const TEST_VERSION_NUM = Math.floor(Math.random() * 1000) + 10;

let server;
let serverReady = false;

async function pingHealth() {
  try {
    const res = await fetch(`${BASE}/health`);
    return res.ok;
  } catch {
    return false;
  }
}

async function ensureServer() {
  if (await pingHealth()) {
    serverReady = true;
    return;
  }

  server = spawn(process.execPath, ['--import', 'tsx', 'src/index.ts'], {
    cwd: __dirname,
    stdio: 'pipe',
    env: { ...process.env },
  });

  server.stdout.on('data', (d) => {
    if (d.toString().includes('Server running')) serverReady = true;
  });
  server.stderr.on('data', (d) => process.stderr.write(d));
}

async function waitReady(ms = 8000) {
  await ensureServer();
  const start = Date.now();
  while (!serverReady && Date.now() - start < ms) {
    if (await pingHealth()) {
      serverReady = true;
      break;
    }
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

  // 6b. Project dashboard summary
  const projDash = await api('GET', `/api/projects/${projectId}/dashboard`, null, token);
  assert('GET /api/projects/:id/dashboard', projDash.status === 200 && projDash.json.data?.projectCode === 'G281');
  assert('  → dashboard contains harness count', typeof projDash.json.data?.harnessCount === 'number');

  // 7. Create new project
  const projCreate = await api('POST', '/api/projects', TEST_PROJECT, token);
  assert(`POST /api/projects (create ${TEST_PROJECT.projectCode})`, projCreate.status === 201 && projCreate.json.data?.projectCode === TEST_PROJECT.projectCode);
  const e281Id = projCreate.json.data?.id;

  // 7a. Create and list scenarios
  const scenarioCreate = await api('POST', `/api/projects/${e281Id}/scenarios`, TEST_SCENARIO, token);
  assert('POST /api/projects/:id/scenarios', scenarioCreate.status === 201 && scenarioCreate.json.data?.name === TEST_SCENARIO.name);
  const scenarioId = scenarioCreate.json.data?.id;
  const scenarioList = await api('GET', `/api/projects/${e281Id}/scenarios`, null, token);
  assert('GET /api/projects/:id/scenarios', scenarioList.status === 200 && Array.isArray(scenarioList.json.data));
  const scenarioGet = await api('GET', `/api/projects/${e281Id}/scenarios/${scenarioId}`, null, token);
  assert('GET /api/projects/:id/scenarios/:sid', scenarioGet.status === 200 && scenarioGet.json.data?.id === scenarioId);
  const scenarioUpdate = await api('PUT', `/api/projects/${e281Id}/scenarios/${scenarioId}`, { name: TEST_SCENARIO.name + '-更新' }, token);
  assert('PUT /api/projects/:id/scenarios/:sid', scenarioUpdate.status === 200 && scenarioUpdate.json.data?.name?.includes('更新'));
  const scenarioFreeze = await api('POST', `/api/projects/${e281Id}/scenarios/${scenarioId}/freeze`, {}, token);
  assert('POST /api/projects/:id/scenarios/:sid/freeze', scenarioFreeze.status === 200 && scenarioFreeze.json.data?.status === 'frozen');
  const scenarioRelease = await api('POST', `/api/projects/${e281Id}/scenarios/${scenarioId}/release`, {}, token);
  assert('POST /api/projects/:id/scenarios/:sid/release', scenarioRelease.status === 200 && scenarioRelease.json.data?.status === 'released');
  const scenarioSummary = await api('GET', `/api/projects/${e281Id}/scenarios/${scenarioId}/summary`, null, token);
  assert('GET /api/projects/:id/scenarios/:sid/summary', scenarioSummary.status === 200 && scenarioSummary.json.data?.id === scenarioId);
  const scenarioClone = await api('POST', `/api/projects/${e281Id}/scenarios/${scenarioId}/clone`, {}, token);
  assert('POST /api/projects/:id/scenarios/:sid/clone', scenarioClone.status === 201 && scenarioClone.json.data?.sourceScenarioId === scenarioId);
  const clonedScenarioId = scenarioClone.json.data?.id;
  const scenarioCompare = await api('GET', `/api/scenarios/compare?ids=${scenarioId},${clonedScenarioId}`, null, token);
  assert('GET /api/scenarios/compare?ids=a,b', scenarioCompare.status === 200 && scenarioCompare.json.data?.length === 2);

  // 7b. Change events CRUD + impact
  const changeCreate = await api('POST', `/api/projects/${e281Id}/scenarios/${scenarioId}/changes`, {
    projectId: e281Id,
    changeType: 'replace',
    reason: '端子替代',
    affectedHarnessIds: [TEST_HARNESS.harnessId],
    affectedBomRows: [{ rowId: 'r1', changeType: 'cancelled', deltaAmount: 12.5 }, { rowId: 'r2', changeType: 'added', deltaAmount: 8.2 }],
    baselineVersionId: 'v1',
    compareVersionId: 'v2'
  }, token);
  assert('POST /api/projects/:id/scenarios/:sid/changes', changeCreate.status === 201 && changeCreate.json.data?.id);
  const changeId = changeCreate.json.data?.id;
  const changeList = await api('GET', `/api/projects/${e281Id}/scenarios/${scenarioId}/changes`, null, token);
  assert('GET /api/projects/:id/scenarios/:sid/changes', changeList.status === 200 && Array.isArray(changeList.json.data));
  const changeGet = await api('GET', `/api/changes/${changeId}`, null, token);
  assert('GET /api/changes/:cid', changeGet.status === 200 && changeGet.json.data?.id === changeId);
  const changeCalc = await api('POST', `/api/changes/${changeId}/calculate-impact`, {}, token);
  assert('POST /api/changes/:cid/calculate-impact', changeCalc.status === 200 && changeCalc.json.data?.status === 'calculated');
  const changeImpact = await api('GET', `/api/changes/${changeId}/impact`, null, token);
  assert('GET /api/changes/:cid/impact', changeImpact.status === 200 && typeof changeImpact.json.data?.costImpact === 'number');
  const changeUpdate = await api('PUT', `/api/changes/${changeId}`, { status: 'confirmed' }, token);
  assert('PUT /api/changes/:cid', changeUpdate.status === 200 && changeUpdate.json.data?.status === 'confirmed');

  // 7c. Audit log test (added)
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
  assert('  → seeded harnesses exist', (hList.json.data?.length || 0) >= 1);

  // 9b. Scenario BOM list/summary
  const bomList = await api('GET', `/api/scenarios/${scenarioId}/bom`, null, token);
  assert('GET /api/scenarios/:sid/bom', bomList.status === 200 && Array.isArray(bomList.json.data));
  const bomSummary = await api('GET', `/api/scenarios/${scenarioId}/bom/summary`, null, token);
  assert('GET /api/scenarios/:sid/bom/summary', bomSummary.status === 200 && typeof bomSummary.json.data?.rowCount === 'number');
  const bomDiff = await api('GET', `/api/scenarios/${scenarioId}/bom/diff?base=${scenarioId}`, null, token);
  assert('GET /api/scenarios/:sid/bom/diff?base=:sid2', bomDiff.status === 200 && Array.isArray(bomDiff.json.data));

  // 10. Create harness
  const hCreate = await api('POST', `/api/projects/${projectId}/harnesses`, { ...TEST_HARNESS, scenarioId }, token);
  assert(`POST harness (create ${TEST_HARNESS.harnessId})`, hCreate.status === 201 && hCreate.json.data?.harnessId === TEST_HARNESS.harnessId);
  const newHarnessId = hCreate.json.data?.id;

  // 10a. Allocation CRUD
  const allocCreate = await api('POST', `/api/scenarios/${scenarioId}/allocations`, {
    projectId,
    harnessId: TEST_HARNESS.harnessId,
    expenseType: 'tooling',
    expenseName: '压接工装',
    totalAmount: 50000,
    allocationBasis: '按根分摊',
    baselineVolume: 50000,
    burdenSide: 'customer',
    pricingEffect: 'included_in_price',
    recoveryCompletionBehavior: 'trigger_price_adjust'
  }, token);
  assert('POST /api/scenarios/:sid/allocations', allocCreate.status === 201 && allocCreate.json.data?.id);
  const allocId = allocCreate.json.data?.id;
  const allocList = await api('GET', `/api/scenarios/${scenarioId}/allocations?burden_side=customer`, null, token);
  assert('GET /api/scenarios/:sid/allocations', allocList.status === 200 && Array.isArray(allocList.json.data));
  const allocGet = await api('GET', `/api/allocations/${allocId}`, null, token);
  assert('GET /api/allocations/:aid', allocGet.status === 200 && allocGet.json.data?.id === allocId);
  const allocUpdate = await api('PUT', `/api/allocations/${allocId}`, { actualRecovered: 1000, status: 'recovering' }, token);
  assert('PUT /api/allocations/:aid', allocUpdate.status === 200 && allocUpdate.json.data?.status === 'recovering');
  const recoveryCreate = await api('POST', `/api/allocations/${allocId}/recovery-records`, {
    period: '2026-Q3',
    cumulativeVolume: 1000,
    installRatioSnapshot: 1,
    recoveredAmount: 1000,
    status: 'normal'
  }, token);
  assert('POST /api/allocations/:aid/recovery-records', recoveryCreate.status === 201 && recoveryCreate.json.data?.allocationItemId === allocId);
  const recoveryHistory = await api('GET', `/api/allocations/${allocId}/recovery-history`, null, token);
  assert('GET /api/allocations/:aid/recovery-history', recoveryHistory.status === 200 && Array.isArray(recoveryHistory.json.data));
  const recoveryForecast = await api('GET', `/api/allocations/${allocId}/recovery-forecast`, null, token);
  assert('GET /api/allocations/:aid/recovery-forecast', recoveryForecast.status === 200 && typeof recoveryForecast.json.data?.recoveryProgress === 'number');
  const recoveryComplete = await api('POST', `/api/allocations/${allocId}/complete`, {}, token);
  assert('POST /api/allocations/:aid/complete', recoveryComplete.status === 200 && recoveryComplete.json.data?.status === 'completed');

  // 10b. BOM row create/update/import/delete
  const bomCreate = await api('POST', `/api/scenarios/${scenarioId}/bom`, {
    harnessId: TEST_HARNESS.harnessId,
    bomRow: { partNo: 'P-001', partName: '端子', itemCategory: 'terminal', qty: 2, unit: '个', unitPrice: 3.5, amount: 7 }
  }, token);
  assert('POST /api/scenarios/:sid/bom', bomCreate.status === 201 && bomCreate.json.data?.rowId);
  const bomRowId = bomCreate.json.data?.rowId;
  const bomUpdate = await api('PUT', `/api/bom/${encodeURIComponent(bomRowId)}?projectId=${projectId}`, {
    patch: { partName: '端子-V2', amount: 8 }
  }, token);
  assert('PUT /api/bom/:rowId', bomUpdate.status === 200 && bomUpdate.json.data?.partName === '端子-V2');
  const bomImport = await api('POST', `/api/scenarios/${scenarioId}/bom/import`, {
    harnessId: TEST_HARNESS.harnessId,
    rows: [{ partNo: 'P-002', partName: '护套', itemCategory: 'connector', qty: 1, unit: '个', unitPrice: 5, amount: 5 }]
  }, token);
  assert('POST /api/scenarios/:sid/bom/import', bomImport.status === 201 && bomImport.json.data?.importedCount === 1);
  const bomDelete = await api('DELETE', `/api/bom/${encodeURIComponent(bomRowId)}?projectId=${projectId}`, null, token);
  assert('DELETE /api/bom/:rowId', bomDelete.status === 204);

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
    scenarioId,
    harnessId: TEST_HARNESS.harnessId,
    version: 'v1.0',
    template: 'geely',
    data: { items: [{ name: '总价', value: 526.63 }] },
    quoteParams: { source: 'api-test' },
    quoteResult: { arrivalPrice: 526.63 },
    internalCostBaseline: 500,
    exWorksPrice: 520,
    arrivalPrice: 526.63,
    effectivePrice: 526.63,
    effectivePriceMode: 'arrival',
    customerBurdenMode: 'customer_full',
    recoveryCompletionBehavior: 'auto_switch_price',
    lockedFields: ['arrivalPrice'],
    editableFields: ['effectivePrice'],
    approvalFields: ['exWorksPrice']
  }, token);
  assert('POST /api/quotes (create)', qCreate.status === 201);
  const quoteId = qCreate.json.data?.id;

  // 14. List / get / compare quotes
  const qList = await api('GET', `/api/quotes/project/${projectId}`, null, token);
  assert('GET /api/quotes/project/:pid', qList.status === 200 && qList.json.data?.length >= 1);
  const qScenarioList = await api('GET', `/api/quotes/scenario/${scenarioId}`, null, token);
  assert('GET /api/quotes/scenario/:sid', qScenarioList.status === 200 && qScenarioList.json.data?.length >= 1);
  const qGet = await api('GET', `/api/quotes/${quoteId}`, null, token);
  assert('GET /api/quotes/:id', qGet.status === 200 && qGet.json.data?.id === quoteId);
  const qCompare = await api('GET', `/api/quotes/${quoteId}/compare`, null, token);
  assert('GET /api/quotes/:id/compare', qCompare.status === 200 && typeof qCompare.json.data?.profitGap === 'number');
  const qEffective = await api('GET', `/api/quotes/${quoteId}/effective-price`, null, token);
  assert('GET /api/quotes/:id/effective-price', qEffective.status === 200 && qEffective.json.data?.effectivePriceMode === 'ex_works');
  const qCompareAfterAlloc = await api('GET', `/api/quotes/${quoteId}/compare`, null, token);
  assert('effective price follows allocation state', qCompareAfterAlloc.status === 200 && qCompareAfterAlloc.json.data?.effectivePriceMode === 'ex_works');
  const qCompareMulti = await api('GET', `/api/quotes/compare?ids=${quoteId},${quoteId}`, null, token);
  assert('GET /api/quotes/compare?ids=a,b', qCompareMulti.status === 200 && Array.isArray(qCompareMulti.json.data));

  // 15. Update quote
  const qUp = await api('PUT', `/api/quotes/${quoteId}`, {
    status: 'approved',
    effectivePriceMode: 'custom',
    effectivePrice: 530,
  }, token);
  assert('PUT /api/quotes/:id', qUp.status === 200 && qUp.json.data?.status === 'approved');

  // 15b. Confirm quote and enforce lock
  const qConfirm = await api('POST', `/api/quotes/${quoteId}/confirm`, null, token);
  assert('POST /api/quotes/:id/confirm', qConfirm.status === 200 && qConfirm.json.data?.customerAccepted === true);
  const qLockedUpdate = await api('PUT', `/api/quotes/${quoteId}`, {
    arrivalPrice: 999,
  }, token);
  assert('locked_fields enforced after confirm', qLockedUpdate.status === 400);

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
    if (server) server.kill();
    process.exit(fails > 0 ? 1 : 0);
  })
  .catch((err) => {
    console.error('Test error:', err);
    if (server) server.kill();
    process.exit(1);
  });
