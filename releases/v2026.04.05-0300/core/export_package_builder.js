(function (global) {
  'use strict';

  const STORAGE_KEY = 'g281.export.packages';
  const SHEET_NAMES = {
    cover: 'Cover',
    matrix: 'QuoteBaselineMatrix',
    harness: 'HarnessCost',
    rollup: 'ProjectRollup',
    template: 'TemplatePreview',
    approval: 'ApprovalPublish',
  };

  function toText(value, fallback) {
    if (value == null) return fallback == null ? '' : fallback;
    const text = String(value).trim();
    return text || (fallback == null ? '' : fallback);
  }

  function numberOf(value, fallback) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : fallback;
  }

  function formatNumber(value) {
    if (value == null || value === '') return '--';
    const numeric = Number(value);
    if (Number.isFinite(numeric)) return numeric.toFixed(4);
    return String(value);
  }

  function uniqueId(prefix) {
    const stamp = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);
    return `${prefix}-${stamp}-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;
  }

  function getBaselineLabel(context) {
    if (!context) return 'quote';
    return toText(context.baselineKey || (context.model && context.model.financialKey), 'quote');
  }

  function buildCoverRows(context) {
    const projectName = toText(context.config && context.config.projectName, '成本核算项目');
    const projectCode = toText(context.config && (context.config.projectCode || context.config.projectId), 'UNKNOWN');
    const baseline = getBaselineLabel(context);
    const template = toText(context.templateKey, 'customer_quote_standard');
    const createdAt = new Date().toISOString();
    return [
      ['项目信息', '值'],
      ['项目名称', projectName],
      ['项目编号', projectCode],
      ['Baseline', baseline],
      ['阶段/模板', template],
      ['导出时间', createdAt],
      ['作者', toText(context.session && context.session.displayName, 'local-user')],
    ];
  }

  function buildQuoteBaselineMatrixRows(context) {
    const matrix = context.matrix || {};
    const columns = Array.isArray(matrix.harnessColumns) ? matrix.harnessColumns : [];
    const header = ['Cost Row'].concat(columns.map((column) => toText(column.harnessId, column.harnessName || 'Harness')));
    const rows = Array.isArray(matrix.harnessCostMatrix) ? matrix.harnessCostMatrix : [];
    const body = rows.map((row) => {
      const rowCells = columns.map((column) => formatNumber(row.cells && row.cells[column.harnessId] && row.cells[column.harnessId].value));
      return [toText(row.label, row.rowKey), ...rowCells];
    });
    return [header, ...body];
  }

  function buildHarnessCostRows(context) {
    const headers = [
      'Harness',
      'Usage Ratio',
      'Material',
      'Direct Labor',
      'Manufacturing',
      'Equipment',
      'Packaging',
      'R&D',
      'Total',
      'Source Sheets',
      'Detail Entries',
    ];
    const rows = Array.isArray(context.stageCost && context.stageCost.rows) ? context.stageCost.rows : [];
    return [headers].concat(rows.map((row) => {
      const summary = row.sourceSummary || {};
      return [
        toText(row.harnessId, '--'),
        formatNumber(row.usageRatio),
        formatNumber(row.materialPerSet),
        formatNumber(row.directLaborPerSet),
        formatNumber(row.manufacturingPerSet),
        formatNumber(row.equipmentPerSet),
        formatNumber(row.packagingPerSet),
        formatNumber(row.rndPerSet),
        formatNumber(row.totalCostPerSet),
        (summary.sourceSheets || []).join(' / ') || '--',
        numberOf(summary.detailEntryCount, 0),
      ];
    }));
  }

  function buildProjectRollupRows(context) {
    const headers = ['Year', 'Volume', 'Revenue', 'Cost', 'Profit', 'Margin'];
    const lifecycle = Array.isArray(context.rollup && context.rollup.lifecycle) ? context.rollup.lifecycle : [];
    const rows = lifecycle.map((row) => [
      toText(row.year, '--'),
      formatNumber(row.volume),
      formatNumber(row.revenue),
      formatNumber(row.cost),
      formatNumber(row.profit),
      formatNumber(row.margin),
    ]);
    const perSet = context.rollup && context.rollup.perSet ? context.rollup.perSet : {};
    if (rows.length && perSet) {
      rows.push([
        'Per Set',
        '--',
        formatNumber(perSet.revenue),
        formatNumber(perSet.cost),
        formatNumber(perSet.profit),
        formatNumber(perSet.margin),
      ]);
    }
    return [headers, ...rows];
  }

  function buildTemplatePreviewRows(context) {
    const headers = ['Cell Key', 'Label', 'Value', 'Source'];
    const fields = Array.isArray(context.template && context.template.fields) ? context.template.fields : [];
    const rows = fields.map((field) => [
      toText(field.cellKey, '--'),
      toText(field.label, '--'),
      toText(field.value, '--'),
      toText(field.source || field.sourceSheet || field.origin, '--'),
    ]);
    return [headers, ...rows];
  }

  function summarizeApprovals(repo) {
    const approvals = typeof repo.getApprovals === 'function' ? repo.getApprovals() : [];
    return approvals.map((record) => ({
      type: 'Approval',
      id: toText(record.id, 'unknown'),
      target: toText(record.title, record.relatedVersionId || record.id),
      status: toText(record.status, '--'),
      time: toText(record.approvedAt || record.submittedAt || record.createdAt, '--'),
      note: toText(record.comment, ''),
    }));
  }

  function summarizePublishes(repo) {
    const publishes = typeof repo.getArtifactPublishStates === 'function'
      ? repo.getArtifactPublishStates({ versionKey: 'quote' })
      : [];
    return (Array.isArray(publishes) ? publishes : []).map((state) => ({
      type: 'Artifact',
      id: `${toText(state.artifactType)}:${toText(state.harnessId, '*')}`,
      target: toText(state.artifactType, '--'),
      status: toText(state.status, '--'),
      time: toText(state.publishedAt || state.updatedAt, '--'),
      note: toText(state.note, ''),
    }));
  }

  function summarizeExports(repo) {
    const list = listHistory(repo);
    return list.map((record) => ({
      type: 'Export Package',
      id: toText(record.id, 'export'),
      target: toText(record.projectId || record.baselineKey, '--'),
      status: 'completed',
      time: toText(record.createdAt, '--'),
      note: toText(record.fileName || record.filename, ''),
    }));
  }

  function buildApprovalRows(context) {
    const headers = ['Type', 'Record ID', 'Target', 'Status', 'Time', 'Note'];
    const repo = context.repo || {};
    const rows = [].concat(summarizeApprovals(repo), summarizePublishes(repo), summarizeExports(repo));
    return [headers].concat(rows.map((row) => [
      row.type,
      row.id,
      row.target,
      row.status,
      row.time,
      row.note,
    ]));
  }

  function buildSheets(context) {
    return [
      { name: SHEET_NAMES.cover, rows: buildCoverRows(context) },
      { name: SHEET_NAMES.matrix, rows: buildQuoteBaselineMatrixRows(context) },
      { name: SHEET_NAMES.harness, rows: buildHarnessCostRows(context) },
      { name: SHEET_NAMES.rollup, rows: buildProjectRollupRows(context) },
      { name: SHEET_NAMES.template, rows: buildTemplatePreviewRows(context) },
      { name: SHEET_NAMES.approval, rows: buildApprovalRows(context) },
    ];
  }

  function buildWorkbookPayload(sheets) {
    const xlsx = global.XLSX;
    if (!xlsx || typeof xlsx.utils?.book_new !== 'function') {
      throw new Error('[G281ExportPackageBuilder] XLSX utils not available');
    }
    const workbook = xlsx.utils.book_new();
    sheets.forEach((sheet) => {
      const sanitized = Array.isArray(sheet.rows) ? sheet.rows : [];
      const worksheet = xlsx.utils.aoa_to_sheet(sanitized);
      xlsx.utils.book_append_sheet(workbook, worksheet, sheet.name);
    });
    return xlsx.write(workbook, { bookType: 'xlsx', type: 'array' });
  }

  function downloadWorkbook(filename, arrayBuffer) {
    if (!global.document || !global.Blob) return;
    const blob = new Blob([arrayBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function readLocalHistory() {
    if (!global.localStorage) return [];
    try {
      const raw = global.localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      return JSON.parse(raw);
    } catch (error) {
      return [];
    }
  }

  function writeLocalHistory(records) {
    if (!global.localStorage) return;
    try {
      global.localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
    } catch (error) {
      // ignore
    }
  }

  function listHistory(repo) {
    if (repo && typeof repo.listExportPackages === 'function') {
      try {
        const packages = repo.listExportPackages() || [];
        if (Array.isArray(packages)) return packages;
      } catch (error) {
        // ignore
      }
    }
    return readLocalHistory();
  }

  function persistRecord(context, record) {
    const repo = context.repo;
    if (repo && typeof repo.saveExportPackage === 'function') {
      try {
        repo.saveExportPackage(record);
      } catch (error) {
        // fallback
        const fallback = readLocalHistory();
        fallback.unshift(record);
        writeLocalHistory(fallback);
      }
      return;
    }
    const history = readLocalHistory();
    history.unshift(record);
    writeLocalHistory(history);
  }

  function exportPackage(context, options) {
    const safeOptions = options || {};
    const sheets = buildSheets(context);
    const stageKey = getBaselineLabel(context);
    const projectId = toText(context.config && context.config.projectCode, context.config && context.config.projectId);
    const templateKey = toText(context.templateKey, 'customer_quote_standard');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = toText(safeOptions.filename, `cost-package-${projectId || 'project'}-${stageKey}-${timestamp}.xlsx`);
    const payload = buildWorkbookPayload(sheets);
    downloadWorkbook(filename, payload);
    const record = {
      id: uniqueId('EXP'),
      fileName: filename,
      baselineKey: stageKey,
      stageKey,
      templateKey,
      projectId: projectId || 'project',
      createdAt: new Date().toISOString(),
      sheetNames: sheets.map((sheet) => sheet.name),
      releaseVersionTag: toText(
        safeOptions.releaseVersionTag,
        context && context.routerState ? context.routerState.releaseVersionTag : ''
      ),
      summary: {
        baselineKey: stageKey,
        templateKey,
        sheetCount: sheets.length,
        harnessCount: Array.isArray(context && context.stageCost && context.stageCost.rows) ? context.stageCost.rows.length : 0,
      },
      meta: {
        note: toText(safeOptions.note, 'exported from accounting workbench'),
      },
    };
    persistRecord(context, record);
    return Promise.resolve({
      filename,
      record,
      sheetCount: sheets.length,
    });
  }

  global.G281ExportPackageBuilder = {
    buildSheets,
    exportPackage,
    getHistory: listHistory,
  };
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this);
