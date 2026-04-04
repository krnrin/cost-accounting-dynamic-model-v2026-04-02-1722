const { test, expect } = require('@playwright/test');

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

test('config loader and template adapter work with a non-G281 sample config', async ({ page }) => {
  const errors = attachRuntimeErrorCapture(page);

  await page.goto('/pages/accounting.html?baselineKey=quote&smoke=multi-project-config', { waitUntil: 'load' });
  await page.waitForFunction(() => {
    return Boolean(window.ConfigLoader) && Boolean(window.G281CustomerQuoteTemplateAdapter);
  }, null, { timeout: 60000 });

  const result = await page.evaluate(() => {
    const customConfig = {
      projectId: 'SAMPLE_MINI',
      projectCode: 'SAMPLE_MINI',
      projectName: 'Sample Mini Program',
      defaultCustomerTemplateKey: 'customer_quote_standard',
      baseline: {
        lifecycle: { years: 2 },
        vehicleConfigs: [{ name: 'STD', ratio: 1, harnesses: ['HX-1'] }],
        annualVolumes: [{ year: 2026, volume: 1200 }, { year: 2027, volume: 900 }],
      },
      harnesses: [{ id: 'HX-1', name: 'Harness X1' }],
      materialComposition: {
        connector: 0.24,
        copper: 0.38,
        aluminum: 0.18,
        other: 0.20,
      },
      metalSensitivity: {
        copper: 0.65,
        aluminum: 0.45,
      },
      customerTemplates: [{
        id: 'customer_quote_standard',
        key: 'customer_quote_standard',
        channel: 'customer',
        output: 'xlsx',
        exportSheets: [{ sheetRole: 'quote_baseline', fileName: 'sample-export', format: 'xlsx' }],
        cells: [
          { cellKey: 'A1', label: 'Project code', valueKey: 'projectCode' },
          { cellKey: 'B1', label: 'Stage', valueKey: 'stageKey' },
          { cellKey: 'C1', label: 'Revenue per set', valueKey: 'revenuePerSet' },
        ],
      }],
      workflowNodes: [{
        id: 'tracking_page',
        nodeType: 'page',
        page: 'pages/tracking.html',
        stageIds: ['quotation'],
        thresholds: { completionRate: 0.5, blockedCount: 1, exceptionCount: 2 },
        next: [],
      }],
      allocationProfiles: [{
        id: 'sample_profile',
        name: 'Sample profile',
        mode: 'perSetWorkbook',
        costBuckets: ['packaging'],
        defaultDriver: 'workbook_per_set',
        supportedDrivers: ['workbook_per_set'],
      }],
      financialWorkbook: {
        rowSpecs: [{ key: 'totalCost', rowNumber: 14, label: 'Total cost / set', category: 'metric' }],
        keyCellSpecs: [{ address: 'P14', key: 'totalCost', label: 'Total cost / set' }],
        detailSheetBindings: [{ id: 'packaging_detail', label: 'Packaging detail', matchStrategy: 'exact', matchValue: 'Packaging detail' }],
      },
    };

    const loaded = window.ConfigLoader.load(customConfig);
    const config = loaded && loaded.config ? loaded.config : null;
    const template = window.G281CustomerQuoteTemplateAdapter.build(window.G281_RUNTIME || {}, 'customer_quote_standard', 'quote', { config });

    return {
      errors: loaded && loaded.errors ? loaded.errors : [],
      projectId: config && config.projectId,
      activeProjectId: window.ConfigLoader.active() && window.ConfigLoader.active().projectId,
      templateKey: template && template.templateKey,
      templateFieldCount: template && Array.isArray(template.fields) ? template.fields.length : 0,
      exportSheetsCount: config && config.customerTemplates && config.customerTemplates[0] && Array.isArray(config.customerTemplates[0].exportSheets)
        ? config.customerTemplates[0].exportSheets.length
        : 0,
      allocationMode: config && config.allocationProfiles && config.allocationProfiles[0]
        ? config.allocationProfiles[0].mode
        : '',
      thresholdKeys: config && config.workflowNodes && config.workflowNodes[0] && config.workflowNodes[0].thresholds
        ? Object.keys(config.workflowNodes[0].thresholds).sort()
        : [],
      keyCellSpecsCount: config && config.financialWorkbook && Array.isArray(config.financialWorkbook.keyCellSpecs)
        ? config.financialWorkbook.keyCellSpecs.length
        : 0,
    };
  });

  expect(result.errors).toEqual([]);
  expect(result.projectId).toBe('SAMPLE_MINI');
  expect(result.activeProjectId).toBe('SAMPLE_MINI');
  expect(result.templateKey).toBe('customer_quote_standard');
  expect(result.templateFieldCount).toBeGreaterThan(0);
  expect(result.exportSheetsCount).toBeGreaterThan(0);
  expect(result.allocationMode).toBe('perSetWorkbook');
  expect(result.thresholdKeys).toEqual(expect.arrayContaining(['blockedCount', 'completionRate', 'exceptionCount']));
  expect(result.keyCellSpecsCount).toBeGreaterThan(0);
  expect(errors).toEqual([]);
});
