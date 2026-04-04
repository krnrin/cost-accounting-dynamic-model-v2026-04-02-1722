const { test, expect } = require('@playwright/test');

const REQUIRED_KEY_CELLS = ['P3', 'P4', 'P14', 'P16', 'P20', 'P21', 'P22', 'P23', 'P31', 'P32'];
const REQUIRED_REFERENCE_FIELDS = ['sourceSheet', 'sourceCell', 'label', 'value', 'formula', 'demandQty', 'newAmount', 'unitPrice'];

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

async function openAccountingShell(page) {
  const errors = attachRuntimeErrorCapture(page);
  await page.goto('/pages/accounting.html?baselineKey=quote&smoke=financial-adapter-contract', { waitUntil: 'load' });
  await page.waitForSelector('#quoteBaselineDetails', { state: 'visible', timeout: 60000 });
  await page.waitForFunction(() => {
    return Boolean(window.G281FinancialWorkbookAdapter)
      && Boolean(window.ConfigLoader)
      && Boolean(document.querySelector('#quoteBaselineDetails'));
  }, null, { timeout: 60000 });
  return errors;
}

test('financial workbook adapter exposes the locked contract and key-cell source chain', async ({ page }) => {
  const errors = await openAccountingShell(page);

  const contract = await page.evaluate((requiredKeyCells) => {
    const result = window.G281FinancialWorkbookAdapter.load(window.G281_RUNTIME || {}, 'quote');
    const keyCells = {};

    requiredKeyCells.forEach((address) => {
      const item = result && result.keyCells ? result.keyCells[address] : null;
      const firstReference = item && Array.isArray(item.references) && item.references.length ? item.references[0] : null;
      keyCells[address] = {
        exists: Boolean(item),
        fieldNames: item ? Object.keys(item).sort() : [],
        referenceCount: item && Array.isArray(item.references) ? item.references.length : 0,
        referenceFieldNames: firstReference ? Object.keys(firstReference).sort() : [],
      };
    });

    return {
      status: result && result.status,
      hasSummaryRows: Array.isArray(result && result.summaryRows),
      hasHarnessColumns: Array.isArray(result && result.harnessColumns),
      hasHarnessRows: Array.isArray(result && result.harnessRows),
      hasWorkbookMatrix: Array.isArray(result && result.workbookMatrix),
      hasHarnessSourceDetails: Boolean(result && result.harnessSourceDetails && typeof result.harnessSourceDetails === 'object'),
      hasRowMetaMap: Boolean(result && result.rowMetaMap && typeof result.rowMetaMap === 'object'),
      hasKeyCells: Boolean(result && result.keyCells && typeof result.keyCells === 'object'),
      hasDetailGroups: Object.prototype.hasOwnProperty.call(result || {}, 'detailGroups'),
      summaryRowCount: Array.isArray(result && result.summaryRows) ? result.summaryRows.length : 0,
      harnessColumnCount: Array.isArray(result && result.harnessColumns) ? result.harnessColumns.length : 0,
      keyCells,
    };
  }, REQUIRED_KEY_CELLS);

  expect(contract.status).toBe('ready');
  expect(contract.hasSummaryRows).toBe(true);
  expect(contract.hasHarnessColumns).toBe(true);
  expect(contract.hasHarnessRows).toBe(true);
  expect(contract.hasWorkbookMatrix).toBe(true);
  expect(contract.hasHarnessSourceDetails).toBe(true);
  expect(contract.hasRowMetaMap).toBe(true);
  expect(contract.hasKeyCells).toBe(true);
  expect(contract.hasDetailGroups).toBe(true);
  expect(contract.summaryRowCount).toBeGreaterThan(0);
  expect(contract.harnessColumnCount).toBeGreaterThan(0);

  for (const address of REQUIRED_KEY_CELLS) {
    const keyCell = contract.keyCells[address];
    expect(keyCell.exists, `${address} should exist in adapter keyCells`).toBe(true);
    expect(keyCell.fieldNames).toEqual(expect.arrayContaining([
      'formula',
      'formulaSource',
      'references',
      'sourceCell',
      'sourceSheet',
      'value',
    ]));
  }

  for (const address of ['P21', 'P22', 'P31', 'P32']) {
    const keyCell = contract.keyCells[address];
    expect(keyCell.referenceCount, `${address} should expose source references`).toBeGreaterThan(0);
    expect(keyCell.referenceFieldNames).toEqual(expect.arrayContaining(REQUIRED_REFERENCE_FIELDS));
  }

  expect(errors).toEqual([]);
});
