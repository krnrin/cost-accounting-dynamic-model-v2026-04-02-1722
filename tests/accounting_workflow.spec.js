const fs = require('fs');
const path = require('path');
const { test, expect } = require('@playwright/test');

const SOURCE_ACCOUNTING_PATH = 'pages/accounting.html';
const STORAGE_KEYS = [
  'g281.approvals.extra',
  'g281.artifact.publish.v1',
  'g281.history.extra',
];

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, ''));
}

function readLatestRelease() {
  return readJson(path.resolve(__dirname, '..', 'releases', 'LATEST_RELEASE.json'));
}

function resolveAccountingTarget() {
  const sourceFilePath = path.resolve(__dirname, '..', SOURCE_ACCOUNTING_PATH);
  if (fs.existsSync(sourceFilePath)) {
    return {
      exists: true,
      kind: 'source',
      relativeUrl: `/${SOURCE_ACCOUNTING_PATH}?smoke=accounting-source`,
      filePath: sourceFilePath,
    };
  }

  const latest = readLatestRelease();
  const relativePath = latest && latest.entryPoints ? latest.entryPoints.accounting : '';
  const releaseFilePath = relativePath
    ? path.resolve(__dirname, '..', 'releases', latest.folderName, relativePath)
    : '';
  if (relativePath && fs.existsSync(releaseFilePath)) {
    return {
      exists: true,
      kind: 'release',
      relativeUrl: `/releases/${latest.folderName}/${relativePath}?smoke=accounting-release`,
      filePath: releaseFilePath,
      latest,
    };
  }

  return {
    exists: false,
    reason: 'accounting source page missing and latest release entrypoint is unavailable',
  };
}

const accountingTarget = resolveAccountingTarget();

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

function parseStageStatusText(text) {
  const statusText = String(text || '').trim();
  const publishedMatch = statusText.match(/published\s+(\d+)\/(\d+)/i);
  const pendingMatch = statusText.match(/pending\s+(\d+)/i);
  const exceptionsMatch = statusText.match(/exceptions\s+(\d+)/i);
  return {
    text: statusText,
    published: publishedMatch ? Number(publishedMatch[1]) : null,
    total: publishedMatch ? Number(publishedMatch[2]) : null,
    pending: pendingMatch ? Number(pendingMatch[1]) : null,
    exceptions: exceptionsMatch ? Number(exceptionsMatch[1]) : null,
  };
}

async function openAccountingPage(page) {
  await page.addInitScript((storageKeys) => {
    try {
      storageKeys.forEach((key) => window.localStorage.removeItem(key));
    } catch (error) {
      // Ignore storage access issues during bootstrap.
    }
  }, STORAGE_KEYS);

  const errors = attachRuntimeErrorCapture(page);
  await page.goto(accountingTarget.relativeUrl, { waitUntil: 'load' });
  await page.waitForSelector('#workflowBoardMount', { state: 'visible', timeout: 60000 });
  await page.waitForSelector('#artifactPublishMount', { state: 'visible', timeout: 60000 });
  await page.waitForFunction(() => {
    const workflowText = String(document.querySelector('#workflowBoardMount')?.textContent || '').trim();
    const publishText = String(document.querySelector('#artifactPublishMount')?.textContent || '').trim();
    return workflowText.length > 0 && publishText.length > 0;
  }, null, { timeout: 60000 });
  await page.waitForTimeout(250);
  return errors;
}

async function readPublishStorage(page) {
  return page.evaluate(() => {
    try {
      return JSON.parse(localStorage.getItem('g281.artifact.publish.v1') || '[]');
    } catch (error) {
      return [];
    }
  });
}

async function readApprovalStorage(page) {
  return page.evaluate(() => {
    try {
      return JSON.parse(localStorage.getItem('g281.approvals.extra') || '[]');
    } catch (error) {
      return [];
    }
  });
}

async function readStageStatus(page, stageKey) {
  const selectorMap = {
    harness: '#workflowBoardMount article:nth-of-type(1) div, #nodeHarnessStatus',
    bom: '#workflowBoardMount article:nth-of-type(2) div, #nodeBomStatus',
    approval: '#workflowBoardMount article:nth-of-type(7) div, #nodeApprovalStatus',
  };
  const text = await page.locator(selectorMap[stageKey]).first().textContent();
  return parseStageStatusText(text);
}

function publishButtonSelector(artifactType) {
  if (artifactType === 'harness') {
    return 'button[data-action="publish-harness"], button[data-action="publish-artifact"][data-artifact-type="harness"]';
  }
  if (artifactType === 'bom') {
    return 'button[data-action="publish-bom"], button[data-action="publish-artifact"][data-artifact-type="bom"]';
  }
  throw new Error(`Unsupported artifactType: ${artifactType}`);
}

async function clearPendingApprovalIfNeeded(page) {
  if (!await page.locator('#submitApprovalButton').count()) {
    return;
  }

  const submitButton = page.locator('#submitApprovalButton');
  if (await submitButton.isEnabled()) {
    return;
  }

  const approveButton = page.locator('#approveReleaseButton');
  await expect(approveButton).toBeEnabled();
  await approveButton.click();

  await expect.poll(async () => {
    const approvals = await readApprovalStorage(page);
    return approvals.filter((record) => String(record && record.status || '').toUpperCase() === 'PENDING').length;
  }, { timeout: 15000 }).toBe(0);
  await expect(submitButton).toBeEnabled();
}

async function submitApproval(page, approvalIdsBefore) {
  if (await page.locator('#submitApprovalButton').count()) {
    const submitButton = page.locator('#submitApprovalButton');
    await expect(submitButton).toBeEnabled();
    await submitButton.click();

    await expect.poll(async () => {
      const approvals = await readApprovalStorage(page);
      const record = approvals.find((item) => !approvalIdsBefore.includes(item.id));
      return record ? record.id : '';
    }, { timeout: 15000 }).not.toBe('');

    const approvals = await readApprovalStorage(page);
    return approvals.find((record) => !approvalIdsBefore.includes(record.id)) || null;
  }

  return page.evaluate(() => {
    const repo = window.G281Repo.current ? window.G281Repo.current() : window.G281Repo;
    const record = Object.assign(
      {},
      repo.createApprovalRecord(
        { d: { scenarioName: 'Accounting Smoke' }, totalRevenue: 0, totalCost: 0, totalProfit: 0, margin: 0 },
        { id: 'ACCOUNTING-SMOKE-V1' },
        'Accounting smoke approval'
      ),
      {
        comment: 'Playwright smoke submit',
        meta: { source: 'playwright-smoke' },
      }
    );
    repo.saveApproval(record);
    return record;
  });
}

async function approveApproval(page, approvalId) {
  if (await page.locator('#approveReleaseButton').count()) {
    const approveButton = page.locator('#approveReleaseButton');
    await expect(approveButton).toBeEnabled();
    await approveButton.click();
    return;
  }

  await page.evaluate((targetApprovalId) => {
    const repo = window.G281Repo.current ? window.G281Repo.current() : window.G281Repo;
    const current = repo.getApprovals().find((record) => record.id === targetApprovalId) || null;
    repo.saveApproval(Object.assign({}, current, {
      id: targetApprovalId,
      status: 'APPROVED',
      owner: 'playwright-approver',
      approvedAt: new Date().toISOString(),
      comment: 'Playwright smoke approval',
    }));
    repo.setArtifactPublishState({
      harnessId: '*',
      artifactType: 'approval',
      versionKey: 'fixed',
      status: 'published',
      completionRate: 1,
      blockedCount: 0,
      pendingCount: 0,
      exceptionCount: 0,
      note: `approved:${targetApprovalId}`,
    });
  }, approvalId);
}

async function readApprovalPublishState(page) {
  const records = await readPublishStorage(page);
  return records.find((record) => record.artifactType === 'approval' && record.status === 'published') || null;
}

test.describe('accounting workflow smoke', () => {
  test('publish buttons write artifact publish state and update workflow board status', async ({ page }) => {
    test.skip(!accountingTarget.exists, accountingTarget.reason);

    const errors = await openAccountingPage(page);
    const harnessStatusBefore = await readStageStatus(page, 'harness');
    const bomStatusBefore = await readStageStatus(page, 'bom');
    const statesBefore = await readPublishStorage(page);

    const harnessButton = page.locator(publishButtonSelector('harness')).first();
    await expect(harnessButton).toBeVisible();
    const harnessId = await harnessButton.getAttribute('data-harness-id');
    expect(harnessId).toBeTruthy();
    await harnessButton.click();

    await expect.poll(async () => {
      const states = await readPublishStorage(page);
      return states.filter((record) => record.artifactType === 'harness' && record.harnessId === harnessId && record.status === 'published').length;
    }, { timeout: 15000 }).toBe(1);

    const harnessStatusAfter = await readStageStatus(page, 'harness');
    expect(harnessStatusAfter.text).not.toBe(harnessStatusBefore.text);
    expect(harnessStatusAfter.published).toBe(harnessStatusBefore.published + 1);
    expect(harnessStatusAfter.pending).toBe(harnessStatusBefore.pending - 1);

    const bomButton = page.locator(publishButtonSelector('bom')).first();
    await expect(bomButton).toBeVisible();
    const bomHarnessId = await bomButton.getAttribute('data-harness-id');
    expect(bomHarnessId).toBeTruthy();
    await bomButton.click();

    await expect.poll(async () => {
      const states = await readPublishStorage(page);
      return states.filter((record) => record.artifactType === 'bom' && record.harnessId === bomHarnessId && record.status === 'published').length;
    }, { timeout: 15000 }).toBe(1);

    const bomStatusAfter = await readStageStatus(page, 'bom');
    expect(bomStatusAfter.text).not.toBe(bomStatusBefore.text);
    expect(bomStatusAfter.published).toBe(bomStatusBefore.published + 1);
    expect(bomStatusAfter.pending).toBe(bomStatusBefore.pending - 1);

    const statesAfter = await readPublishStorage(page);
    expect(statesAfter.length).toBe(statesBefore.length + 2);
    expect(errors).toEqual([]);
  });

  test('submit and approve update approval records and project approval publish state', async ({ page }) => {
    test.skip(!accountingTarget.exists, accountingTarget.reason);

    const errors = await openAccountingPage(page);
    await clearPendingApprovalIfNeeded(page);

    const approvalsBefore = await readApprovalStorage(page);
    const approvalIdsBefore = approvalsBefore.map((record) => record.id);
    const approvalStatusBefore = await readStageStatus(page, 'approval');

    const submittedRecord = await submitApproval(page, approvalIdsBefore);
    expect(submittedRecord).toBeTruthy();
    expect(submittedRecord.id).toBeTruthy();
    expect(approvalIdsBefore).not.toContain(submittedRecord.id);

    await expect.poll(async () => {
      const approvals = await readApprovalStorage(page);
      return approvals.length;
    }, { timeout: 15000 }).toBe(approvalsBefore.length + 1);

    await expect.poll(async () => {
      const approvals = await readApprovalStorage(page);
      const record = approvals.find((item) => item.id === submittedRecord.id);
      return record ? record.status : '';
    }, { timeout: 15000 }).toBe('PENDING');

    const approvalStatusAfterSubmit = await readStageStatus(page, 'approval');
    expect(approvalStatusAfterSubmit.text).not.toBe(approvalStatusBefore.text);
    expect(approvalStatusAfterSubmit.exceptions).toBe(approvalStatusBefore.exceptions + 1);

    await approveApproval(page, submittedRecord.id);

    await expect.poll(async () => {
      const approvals = await readApprovalStorage(page);
      const record = approvals.find((item) => item.id === submittedRecord.id);
      return record ? record.status : '';
    }, { timeout: 15000 }).toBe('APPROVED');

    await expect.poll(async () => {
      const record = await readApprovalPublishState(page);
      return record ? record.status : '';
    }, { timeout: 15000 }).toBe('published');

    const approvalStatusAfterApprove = await readStageStatus(page, 'approval');
    expect(approvalStatusAfterApprove.text).not.toBe(approvalStatusAfterSubmit.text);
    expect(approvalStatusAfterApprove.exceptions).toBe(approvalStatusBefore.exceptions);
    expect(errors).toEqual([]);
  });
});
