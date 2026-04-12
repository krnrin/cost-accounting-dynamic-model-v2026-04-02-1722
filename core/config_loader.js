/**
 * config_loader.js — 项目配置加载器
 *
 * 职责：
 * 1. 加载 projectConfig JSON（从文件或 localStorage）
 * 2. 验证必填字段
 * 3. 填充默认值
 * 4. 缓存当前活动配置
 * 5. 提供统一访问接口
 *
 * 依赖：无（纯工具模块）
 *
 * Issue #14 — 多项目可复用架构 ① 层
 */
;(function (global) {
  'use strict';

  var DEFAULT_PROJECT_CONFIG_PATH = '../config/sample-mini.project.json';

  // ── Stage definitions ──────────────────────────────────────
  var DEFAULT_STAGE_DEFINITIONS = [
    { id: 'harness', name: 'Harness intake', sequence: 10, category: 'workflow', page: 'pages/accounting.html', ownerRoles: ['program', 'costing'], artifactType: 'harness', scope: 'harness', supportsPartialPublish: true, aliases: ['wireHarness'] },
    { id: 'bom', name: 'BOM review', sequence: 20, category: 'workflow', page: 'pages/accounting.html', ownerRoles: ['engineering', 'costing'], artifactType: 'bom', scope: 'harness', supportsPartialPublish: true, aliases: ['billOfMaterial'] },
    { id: 'quotation', name: 'Quotation baseline', sequence: 30, category: 'workflow', page: 'pages/accounting.html', ownerRoles: ['sales', 'finance'], artifactType: 'quotation', scope: 'harness', supportsPartialPublish: true, aliases: ['quote', 'quoteBaseline'] },
    { id: 'labor', name: 'Labor validation', sequence: 40, category: 'workflow', page: 'pages/accounting.html', ownerRoles: ['manufacturing', 'finance'], artifactType: 'labor', scope: 'harness', supportsPartialPublish: true, aliases: ['manhour'] },
    { id: 'packaging', name: 'Packaging validation', sequence: 50, category: 'workflow', page: 'pages/accounting.html', ownerRoles: ['logistics', 'finance'], artifactType: 'packaging', scope: 'harness', supportsPartialPublish: true, aliases: ['package', 'logistics'] },
    { id: 'capital', name: 'Equipment tooling fixture', sequence: 60, category: 'workflow', page: 'pages/accounting.html', ownerRoles: ['industrialization', 'finance'], artifactType: 'capital', scope: 'harness', supportsPartialPublish: true, aliases: ['equipment', 'tooling', 'fixture'] },
    { id: 'approval', name: 'Approval release', sequence: 70, category: 'workflow', page: 'pages/archive.html', ownerRoles: ['management', 'finance'], artifactType: 'approval', scope: 'project', supportsPartialPublish: false, aliases: ['publish', 'release'] },
  ];

  // ── Workflow nodes ─────────────────────────────────────────
  var DEFAULT_WORKFLOW_NODES = [
    { id: 'preview_page', nodeType: 'page', page: 'pages/preview.html', stageIds: ['quotation'], next: ['accounting_page'] },
    { id: 'accounting_page', nodeType: 'page', page: 'pages/accounting.html', stageIds: ['harness', 'bom', 'quotation', 'labor', 'packaging', 'capital', 'approval'], next: ['tracking_page', 'archive_page'] },
    { id: 'tracking_page', nodeType: 'page', page: 'pages/tracking.html', stageIds: ['quotation', 'labor', 'packaging', 'capital'], next: ['archive_page'] },
    { id: 'archive_page', nodeType: 'page', page: 'pages/archive.html', stageIds: ['approval'], next: [] },
  ];

  // ── Workbook roles ────────────────────────────────────────
  var DEFAULT_WORKBOOK_ROLES = [
    { id: 'bom_source', name: 'BOM source workbook', scope: 'harness', allowMultiple: true },
    { id: 'financial_quote_baseline', name: 'Financial baseline workbook', scope: 'project', allowMultiple: true },
    { id: 'customer_quote_template', name: 'Customer quote template workbook', scope: 'project', allowMultiple: true },
    { id: 'project_rollup_pack', name: 'Project rollup workbook pack', scope: 'project', allowMultiple: false },
    { id: 'release_archive_pack', name: 'Release archive workbook pack', scope: 'release', allowMultiple: true },
  ];

  // ── Sheet mappings ────────────────────────────────────────
  var DEFAULT_SHEET_MAPPINGS = [
    { id: 'bom_change_history', workbookRole: 'bom_source', sheetRole: 'change_history', matchStrategy: 'keyword' },
    { id: 'bom_assembly_parts', workbookRole: 'bom_source', sheetRole: 'assembly_parts', matchStrategy: 'keyword' },
    { id: 'bom_secondary_materials', workbookRole: 'bom_source', sheetRole: 'secondary_materials', matchStrategy: 'keyword' },
    { id: 'bom_harness_detail', workbookRole: 'bom_source', sheetRole: 'harness', matchStrategy: 'pattern' },
    { id: 'finance_quote_baseline', workbookRole: 'financial_quote_baseline', sheetRole: 'quote_baseline', matchStrategy: 'exact' },
    { id: 'template_rollup_summary', workbookRole: 'customer_quote_template', sheetRole: 'project_rollup', matchStrategy: 'exact' },
  ];

  // ── Financial workbook specs ───────────────────────────────
  var DEFAULT_FINANCIAL_ROW_SPECS = [
    { key: 'totalCost', rowNumber: 14, label: 'Total cost / set', category: 'metric' },
    { key: 'material', rowNumber: 15, label: 'Material / set', category: 'material' },
    { key: 'directLabor', rowNumber: 16, label: 'Direct labor / set', category: 'labor' },
    { key: 'equipment', rowNumber: 20, label: 'Equipment / set', category: 'capital' },
    { key: 'manufacturing', rowNumber: 23, label: 'Manufacturing / set', category: 'manufacturing' },
    { key: 'rnd', rowNumber: 31, label: 'R&D / set', category: 'rnd' },
    { key: 'packaging', rowNumber: 32, label: 'Packaging / set', category: 'packaging' },
  ];
  var DEFAULT_FINANCIAL_KEY_CELLS = [
    { address: 'P3', key: 'harnessId', label: 'Harness / line item' },
    { address: 'P4', key: 'quantityFactor', label: 'Quantity factor' },
    { address: 'P14', key: 'totalCost', label: 'Total cost / set' },
    { address: 'P16', key: 'directLabor', label: 'Direct labor per set' },
    { address: 'P20', key: 'equipment', label: 'Equipment cost' },
    { address: 'P21', key: 'sharedEquipment', label: 'Shared equipment' },
    { address: 'P22', key: 'specialEquipment', label: 'Special equipment' },
    { address: 'P23', key: 'manufacturing', label: 'Manufacturing per set' },
    { address: 'P31', key: 'rnd', label: 'R&D per set' },
    { address: 'P32', key: 'packaging', label: 'Packaging per set' },
  ];
  var DEFAULT_FINANCIAL_DETAIL_BINDINGS = [
    { id: 'packaging_detail', label: 'Packaging detail', matchStrategy: 'keyword', matchValue: 'Packaging detail', previewRows: 6, previewColumns: 6 },
    { id: 'capital_detail', label: 'Capital detail', matchStrategy: 'keyword', matchValue: 'capital', previewRows: 8, previewColumns: 8 },
  ];
  var DEFAULT_FINANCIAL_WORKBOOK = {
    summarySheetAliases: ['Project assessment summary', 'quote baseline', 'cost summary'],
    rowSpecs: DEFAULT_FINANCIAL_ROW_SPECS,
    keyCells: DEFAULT_FINANCIAL_KEY_CELLS,
    keyCellSpecs: DEFAULT_FINANCIAL_KEY_CELLS,
    detailSheetBindings: DEFAULT_FINANCIAL_DETAIL_BINDINGS,
  };

  // ── Customer template cells ───────────────────────────────
  var DEFAULT_TEMPLATE_CELLS = [
    { cellKey: 'A1', label: 'Project code', valueKey: 'projectCode' },
    { cellKey: 'A2', label: 'Project name', valueKey: 'projectName' },
    { cellKey: 'B1', label: 'Stage', valueKey: 'stageKey' },
    { cellKey: 'B2', label: 'Baseline key', valueKey: 'baselineKey' },
    { cellKey: 'C1', label: 'Revenue per set', valueKey: 'revenuePerSet' },
    { cellKey: 'C2', label: 'Cost per set', valueKey: 'costPerSet' },
    { cellKey: 'C3', label: 'Margin', valueKey: 'margin' },
    { cellKey: 'D', label: 'Material per set', valueKey: 'materialPerSet' },
    { cellKey: 'E', label: 'Direct labor per set', valueKey: 'directLaborPerSet' },
    { cellKey: 'F', label: 'Packaging per set', valueKey: 'packagingPerSet' },
    { cellKey: 'G', label: 'Profit per set', valueKey: 'profitPerSet' },
  ];
  var DEFAULT_CUSTOMER_TEMPLATES = [
    { id: 'customer_quote_standard', key: 'customer_quote_standard', aliases: ['standardQuote', 'defaultCustomerTemplate'], name: 'Customer quote standard', channel: 'customer', output: 'xlsx', stageMapping: { quotation: 'quotation', fixed: 'quotation', change: 'quotation', annualDrop: 'quotation' }, cells: DEFAULT_TEMPLATE_CELLS },
    { id: 'internal_project_rollup', key: 'internal_project_rollup', aliases: ['internalRollup'], name: 'Internal project rollup', channel: 'internal', output: 'xlsx', cells: [
      { cellKey: 'A1', label: 'Project code', valueKey: 'projectCode' }, { cellKey: 'A2', label: 'Project name', valueKey: 'projectName' },
      { cellKey: 'B1', label: 'Baseline key', valueKey: 'baselineKey' }, { cellKey: 'B2', label: 'Lifecycle years', valueKey: 'lifecycleYears' },
      { cellKey: 'C1', label: 'Revenue per set', valueKey: 'revenuePerSet' }, { cellKey: 'C2', label: 'Cost per set', valueKey: 'costPerSet' }, { cellKey: 'C3', label: 'Profit per set', valueKey: 'profitPerSet' },
      { cellKey: 'D1', label: 'Material per set', valueKey: 'materialPerSet' }, { cellKey: 'D2', label: 'Direct labor per set', valueKey: 'directLaborPerSet' }, { cellKey: 'D3', label: 'Packaging per set', valueKey: 'packagingPerSet' },
      { cellKey: 'E1', label: 'Lifecycle revenue', valueKey: 'lifecycleRevenue' }, { cellKey: 'E2', label: 'Lifecycle cost', valueKey: 'lifecycleCost' }, { cellKey: 'E3', label: 'Lifecycle profit', valueKey: 'lifecycleProfit' },
    ] },
  ];

  // ── Allocation profiles ───────────────────────────────────
  var DEFAULT_ALLOCATION_PROFILES = [
    { id: 'perSetWorkbook', name: 'Workbook per-set value', costBuckets: ['packaging', 'logistics'], defaultDriver: 'workbook_per_set', supportedDrivers: ['workbook_per_set'] },
    { id: 'lifecycleAmortized', name: 'Lifecycle amortized', costBuckets: ['equipment', 'tooling', 'fixture'], defaultDriver: 'lifecycle_volume', supportedDrivers: ['lifecycle_volume', 'vehicle_mix', 'harness_share'] },
    { id: 'customerRecoverable', name: 'Customer recoverable', costBuckets: ['tooling', 'fixture', 'rnd'], defaultDriver: 'customer_recoverable', supportedDrivers: ['customer_recoverable', 'lifecycle_volume'] },
    { id: 'directExpense', name: 'Direct expense', costBuckets: ['commercial', 'nre'], defaultDriver: 'direct_expense', supportedDrivers: ['direct_expense'] },
  ];

  // ── Lifecycle stages ──────────────────────────────────────
  var DEFAULT_LIFECYCLE_STAGES = [
    { id: 'rfq', name: 'RFQ', sequence: 10, aliases: ['rfq'] },
    { id: 'quote', name: 'Quote', sequence: 20, aliases: ['quotation', 'quoteBaseline'] },
    { id: 'fixed', name: 'Fixed', sequence: 30, aliases: ['fixedBaseline', 'target'] },
    { id: 'sop', name: 'SOP', sequence: 40, aliases: ['sop'] },
    { id: 'massProduction', name: 'Mass Production', sequence: 50, aliases: ['massProduction', 'mp'] },
    { id: 'change', name: 'Change', sequence: 60, aliases: ['delta', 'diff'] },
    { id: 'annualDrop', name: 'Annual Drop', sequence: 70, aliases: ['annualReduction', 'annualReduce'] },
    { id: 'eol', name: 'EOL', sequence: 80, aliases: ['eol'] },
  ];

  // ── Stage mapping ─────────────────────────────────────────
  var DEFAULT_STAGE_MAPPING = {
    quote: 'quotation', quotation: 'quotation', quotebaseline: 'quotation', quotationbaseline: 'quotation',
    fixed: 'fixed', fixedbaseline: 'fixed', target: 'fixed', fixedpoint: 'fixed',
    change: 'change', changes: 'change', delta: 'change', diff: 'change',
    annualdrop: 'annualDrop', annualreduce: 'annualDrop', annualreduction: 'annualDrop',
    rfq: 'rfq', sop: 'sop', massproduction: 'massProduction', eol: 'eol',
  };

  // ============================================================
  // 默认值
  // ============================================================
  var DEFAULTS = {
    defaultCustomerTemplateKey: 'customer_quote_standard',
    dimensions: { currency: 'CNY', currencySymbol: '\u00a5', lengthUnit: 'mm', weightUnit: 'g', volumeUnit: '\u5957', priceDecimalPlaces: 4, ratioDecimalPlaces: 2 },
    stateDefaults: { bom: 'freeze', metal: 'quote', connector: 'quote', labor: 'base', equipment: 'base', packaging: 'base', sales: 'quote', mix: 'quote', annualDrop: 'quote', oneTimeCustomer: 'quote', rebate: 'quote', vave: 'none' },
    bom: { dataStartRow: 5, maxColumns: 17, fallbackRowCount: 2000, assemblyUnitKeyword: 'set' },
    stageDefinitions: DEFAULT_STAGE_DEFINITIONS,
    lifecycleStages: DEFAULT_LIFECYCLE_STAGES,
    workflowNodes: DEFAULT_WORKFLOW_NODES,
    customerTemplates: DEFAULT_CUSTOMER_TEMPLATES,
    allocationProfiles: DEFAULT_ALLOCATION_PROFILES,
    sheetMappings: DEFAULT_SHEET_MAPPINGS,
    workbookRoles: DEFAULT_WORKBOOK_ROLES,
    financialWorkbook: DEFAULT_FINANCIAL_WORKBOOK,
    stageMapping: DEFAULT_STAGE_MAPPING,
  };

  // ============================================================
  // 必填字段检查
  // ============================================================
  var REQUIRED_FIELDS = [
    'projectId', 'projectName', 'baseline', 'baseline.lifecycle',
    'baseline.lifecycle.years', 'baseline.vehicleConfigs',
    'harnesses', 'materialComposition', 'metalSensitivity',
  ];

  function getNestedValue(obj, path) {
    var keys = path.split('.');
    var current = obj;
    for (var i = 0; i < keys.length; i++) {
      if (current == null) return undefined;
      current = current[keys[i]];
    }
    return current;
  }

  function toText(value, fallback) {
    var text = String(value == null ? '' : value).trim();
    return text || (fallback == null ? '' : fallback);
  }

  function validate(config) {
    var errors = [];
    REQUIRED_FIELDS.forEach(function (field) {
      var val = getNestedValue(config, field);
      if (val === undefined || val === null || val === '') {
        errors.push('Missing required field: ' + field);
      }
    });
    if (config.materialComposition) {
      var mc = config.materialComposition;
      var sum = (mc.connector || 0) + (mc.copper || 0) + (mc.aluminum || 0) + (mc.other || 0);
      if (Math.abs(sum - 1.0) > 0.01) {
        errors.push('materialComposition sum = ' + sum.toFixed(4) + ', expected 1.00');
      }
    }
    if (config.baseline && Array.isArray(config.baseline.vehicleConfigs)) {
      var ratioSum = config.baseline.vehicleConfigs.reduce(function (s, vc) { return s + (vc.ratio || 0); }, 0);
      if (Math.abs(ratioSum - 1.0) > 0.01) {
        errors.push('vehicleConfigs ratio sum = ' + ratioSum.toFixed(4) + ', expected 1.00');
      }
    }
    return errors;
  }

  // ============================================================
  // 深度合并默认值
  // ============================================================
  function deepMergeDefaults(target, defaults) {
    if (!defaults || typeof defaults !== 'object') return target;
    if (!target || typeof target !== 'object') return JSON.parse(JSON.stringify(defaults));
    var result = JSON.parse(JSON.stringify(target));
    Object.keys(defaults).forEach(function (key) {
      if (result[key] === undefined) {
        result[key] = JSON.parse(JSON.stringify(defaults[key]));
      } else if (typeof defaults[key] === 'object' && defaults[key] !== null && !Array.isArray(defaults[key])) {
        result[key] = deepMergeDefaults(result[key], defaults[key]);
      }
    });
    return result;
  }

  // ============================================================
  // Normalize helpers
  // ============================================================
  function ensureArray(value) { return Array.isArray(value) ? value : []; }
  function ensureObject(value) { return value && typeof value === 'object' && !Array.isArray(value) ? value : {}; }
  function clonePlain(value, fallback) { try { return JSON.parse(JSON.stringify(value)); } catch (e) { return fallback; } }
  function normalizeLookupKey(value) { return toText(value, '').toLowerCase().replace(/[\s_\-()\uff08\uff09\[\]{}]+/g, ''); }
  function uniqueText(values) {
    var seen = {};
    return ensureArray(values).reduce(function (result, value) {
      var text = toText(value, '');
      if (!text || seen[text]) return result;
      seen[text] = true;
      result.push(text);
      return result;
    }, []);
  }

  function normalizeStageDefinition(stage) {
    var canonicalKey = toText(stage && (stage.id || stage.key || stage.stageKey), '');
    if (!canonicalKey) return null;
    return {
      id: canonicalKey, key: canonicalKey,
      name: toText(stage && (stage.name || stage.label || stage.displayName), canonicalKey),
      label: toText(stage && (stage.label || stage.name || stage.displayName), canonicalKey),
      displayName: toText(stage && (stage.displayName || stage.name || stage.label), canonicalKey),
      sequence: Number(stage && stage.sequence) || 999,
      category: toText(stage && stage.category, 'workflow'),
      page: toText(stage && stage.page, ''),
      ownerRoles: uniqueText(stage && stage.ownerRoles),
      artifactType: toText(stage && stage.artifactType, canonicalKey),
      scope: toText(stage && stage.scope, canonicalKey === 'approval' ? 'project' : 'harness'),
      supportsPartialPublish: Boolean(stage && stage.supportsPartialPublish),
      aliases: uniqueText([].concat(stage && stage.aliases).concat([stage && stage.id, stage && stage.key, stage && stage.stageKey, stage && stage.artifactType])),
    };
  }

  function normalizeLifecycleStage(stage, index) {
    var canonicalKey = toText(stage && (stage.id || stage.key || stage.stageKey), 'lifecycle-' + (index + 1));
    return {
      id: canonicalKey, key: canonicalKey,
      name: toText(stage && (stage.name || stage.label || stage.displayName), canonicalKey),
      label: toText(stage && (stage.label || stage.name || stage.displayName), canonicalKey),
      displayName: toText(stage && (stage.displayName || stage.name || stage.label), canonicalKey),
      sequence: Number(stage && stage.sequence) || ((index + 1) * 10),
      aliases: uniqueText([].concat(stage && stage.aliases).concat([stage && stage.id, stage && stage.key, stage && stage.stageKey])),
    };
  }

  function normalizeLifecycleStages(stages) {
    return ensureArray(stages).map(normalizeLifecycleStage).filter(Boolean).sort(function (a, b) { return (a.sequence || 999) - (b.sequence || 999); });
  }

  function normalizeStageMapping(mapping) {
    var normalized = {};
    var source = ensureObject(mapping);
    Object.keys(source).forEach(function (key) {
      var nk = normalizeLookupKey(key);
      if (!nk) return;
      normalized[nk] = toText(source[key], '');
    });
    return normalized;
  }

  function buildStageAliasMap(config) {
    var aliasMap = {};
    ensureArray(config && config.stageDefinitions).forEach(function (stage) {
      var canonicalKey = toText(stage && (stage.id || stage.key || stage.stageKey), '');
      if (!canonicalKey) return;
      var aliases = [].concat(stage && stage.aliases).concat([canonicalKey, stage && stage.key, stage && stage.id, stage && stage.stageKey, stage && stage.artifactType]);
      if (canonicalKey === 'quotation') aliases.push('quote');
      if (canonicalKey === 'quote') aliases.push('quotation');
      aliases.forEach(function (alias) {
        var na = normalizeLookupKey(alias);
        if (!na) return;
        aliasMap[na] = canonicalKey;
      });
    });
    Object.keys(ensureObject(config && config.stageMapping)).forEach(function (alias) {
      var na = normalizeLookupKey(alias);
      var target = toText(config.stageMapping[alias], '');
      if (!na || !target) return;
      aliasMap[na] = aliasMap[normalizeLookupKey(target)] || target;
    });
    return aliasMap;
  }

  function defaultStageKey(explicitConfig) {
    var aliasMap = buildStageAliasMap(explicitConfig || {});
    return aliasMap.quote || aliasMap.quotation || 'quotation';
  }

  function canonicalStageKey(stageKey, explicitConfig) {
    var raw = toText(stageKey, '');
    if (!raw) return '';
    var config = explicitConfig || activeConfig() || null;
    var aliasMap = buildStageAliasMap(config || {});
    var normalized = normalizeLookupKey(raw);
    if (aliasMap[normalized]) return aliasMap[normalized];
    if (normalized === 'quote' || normalized === 'quotation' || normalized === 'quotebaseline' || normalized === 'quotationbaseline') return defaultStageKey(config);
    if (normalized === 'fixed' || normalized === 'fixedbaseline' || normalized === 'target' || normalized === 'fixedpoint') return 'fixed';
    if (normalized === 'change' || normalized === 'changes' || normalized === 'delta' || normalized === 'diff') return 'change';
    if (normalized === 'annualdrop' || normalized === 'annualreduce' || normalized === 'annualreduction') return 'annualDrop';
    return raw;
  }

  function stageAliases(stageKey, explicitConfig) {
    var config = explicitConfig || activeConfig() || null;
    var ck = canonicalStageKey(stageKey, config) || toText(stageKey, '');
    var aliases = [ck, toText(stageKey, '')];
    ensureArray(config && config.stageDefinitions).forEach(function (stage) {
      var key = toText(stage && (stage.id || stage.key || stage.stageKey), '');
      if (key !== ck) return;
      aliases = aliases.concat(stage && stage.aliases).concat([stage && stage.id, stage && stage.key, stage && stage.stageKey, stage && stage.artifactType]);
    });
    Object.keys(ensureObject(config && config.stageMapping)).forEach(function (alias) {
      var target = toText(config.stageMapping[alias], '');
      if (canonicalStageKey(target, config) === ck) aliases.push(alias);
    });
    if (ck === 'quotation') aliases.push('quote');
    if (ck === 'quote') aliases.push('quotation');
    return uniqueText(aliases);
  }

  function stageLabel(stageKey, explicitConfig, fallback) {
    var config = explicitConfig || activeConfig() || null;
    var ck = canonicalStageKey(stageKey, config) || toText(stageKey, fallback);
    var definition = ensureArray(config && config.stageDefinitions).find(function (stage) {
      return toText(stage && (stage.id || stage.key || stage.stageKey), '') === ck;
    });
    return toText(definition && (definition.displayName || definition.name || definition.label), fallback || ck);
  }

  function normalizeWorkflowNodes(workflowNodes, config) {
    return ensureArray(workflowNodes).map(function (node, index) {
      return {
        id: toText(node && node.id, 'workflow-node-' + (index + 1)),
        nodeType: toText(node && node.nodeType, 'page'),
        page: toText(node && node.page, ''),
        stageIds: uniqueText(ensureArray(node && node.stageIds).map(function (sid) { return canonicalStageKey(sid, config) || toText(sid, ''); }).filter(Boolean)),
        next: uniqueText(node && node.next),
        thresholds: ensureObject(node && node.thresholds),
      };
    });
  }

  function normalizeTemplateCells(cells) {
    return ensureArray(cells).map(function (cell, index) {
      var cellKey = toText(cell && cell.cellKey, 'CELL_' + (index + 1));
      return { cellKey: cellKey, label: toText(cell && cell.label, cellKey), valueKey: toText(cell && cell.valueKey, '') };
    }).filter(function (cell) { return cell.cellKey; });
  }

  function normalizeCustomerTemplates(templates, config) {
    return ensureArray(templates).map(function (template, index) {
      var templateId = toText(template && (template.id || template.key), 'template-' + (index + 1));
      var stageMapping = {};
      Object.keys(ensureObject(template && template.stageMapping)).forEach(function (key) {
        var ck = canonicalStageKey(key, config) || toText(key, '');
        if (!ck) return;
        stageMapping[ck] = toText(template.stageMapping[key], ck);
      });
      return {
        id: templateId, key: toText(template && template.key, templateId),
        legacyKey: toText(template && template.legacyKey, ''),
        aliases: uniqueText([].concat(template && template.aliases).concat([template && template.id, template && template.key, template && template.legacyKey])),
        name: toText(template && template.name, templateId),
        label: toText(template && template.label, template && template.name),
        channel: toText(template && template.channel, 'customer'),
        output: toText(template && template.output, 'xlsx'),
        stageKeys: uniqueText(ensureArray(template && template.stageKeys).map(function (sk) { return canonicalStageKey(sk, config) || toText(sk, ''); }).filter(Boolean)),
        stageMapping: stageMapping,
        seedProjectCodes: uniqueText(template && template.seedProjectCodes),
        cells: normalizeTemplateCells(template && template.cells),
        exportSheets: ensureArray(template && template.exportSheets).map(function (sheet, j) {
          return { id: toText(sheet && sheet.id, 'export-' + (j + 1)), sheetRole: toText(sheet && sheet.sheetRole, ''), fileName: toText(sheet && sheet.fileName, ''), format: toText(sheet && sheet.format, 'xlsx') };
        }).filter(function (entry) { return entry.sheetRole || entry.fileName; }),
      };
    });
  }

  function normalizeAllocationProfiles(profiles) {
    return ensureArray(profiles).map(function (profile, index) {
      var profileId = toText(profile && profile.id, 'allocation-profile-' + (index + 1));
      return { id: profileId, name: toText(profile && profile.name, profileId), costBuckets: uniqueText(profile && profile.costBuckets), defaultDriver: toText(profile && profile.defaultDriver, ''), supportedDrivers: uniqueText(profile && profile.supportedDrivers), seedProjectCodes: uniqueText(profile && profile.seedProjectCodes), mode: toText(profile && profile.mode, '') };
    });
  }

  function normalizeSheetMappings(mappings) {
    return ensureArray(mappings).map(function (mapping, index) {
      var mappingId = toText(mapping && mapping.id, 'sheet-mapping-' + (index + 1));
      return { id: mappingId, workbookRole: toText(mapping && mapping.workbookRole, ''), sheetRole: toText(mapping && mapping.sheetRole, ''), matchStrategy: toText(mapping && mapping.matchStrategy, 'keyword'), matchValue: toText(mapping && mapping.matchValue, ''), matchText: toText(mapping && mapping.matchText, ''), sheetName: toText(mapping && mapping.sheetName, '') };
    });
  }

  function normalizeWorkbookRoles(workbookRoles) {
    return ensureArray(workbookRoles).map(function (role, index) {
      var roleId = toText(role && role.id, 'workbook-role-' + (index + 1));
      return { id: roleId, name: toText(role && role.name, roleId), scope: toText(role && role.scope, 'project'), allowMultiple: Boolean(role && role.allowMultiple) };
    });
  }

  function normalizeFinancialWorkbook(workbook) {
    var safeWb = ensureObject(workbook);
    var rowSpecs = ensureArray(safeWb.rowSpecs).map(function (spec, index) {
      return { key: toText(spec && spec.key, 'row-' + (index + 1)), rowNumber: Number(spec && spec.rowNumber) || 0, label: toText(spec && spec.label, 'Row ' + (index + 1)), category: toText(spec && spec.category, 'metric'), detailKind: toText(spec && spec.detailKind, '') };
    });
    var keyCells = ensureArray(safeWb.keyCellSpecs || safeWb.keyCells).map(function (cell, index) {
      return { address: toText(cell && cell.address, ''), key: toText(cell && cell.key, 'cell-' + (index + 1)), label: toText(cell && cell.label, 'Key cell ' + (index + 1)) };
    });
    var detailBindings = ensureArray(safeWb.detailSheetBindings).map(function (binding, index) {
      return { id: toText(binding && binding.id, 'detail-' + (index + 1)), label: toText(binding && binding.label, binding && binding.id), sheetRole: toText(binding && binding.sheetRole, ''), matchStrategy: toText(binding && binding.matchStrategy, 'keyword'), matchValue: toText(binding && (binding.matchValue || binding.sheetName), ''), previewRows: Number(binding && binding.previewRows) || 6, previewColumns: Number(binding && binding.previewColumns) || 6 };
    });
    return {
      summarySheetAliases: ensureArray(safeWb.summarySheetAliases).length ? ensureArray(safeWb.summarySheetAliases) : DEFAULT_FINANCIAL_WORKBOOK.summarySheetAliases,
      rowSpecs: rowSpecs.length ? rowSpecs : DEFAULT_FINANCIAL_ROW_SPECS,
      keyCells: keyCells.length ? keyCells : DEFAULT_FINANCIAL_KEY_CELLS,
      keyCellSpecs: keyCells.length ? keyCells : DEFAULT_FINANCIAL_KEY_CELLS,
      detailSheetBindings: detailBindings.length ? detailBindings : DEFAULT_FINANCIAL_DETAIL_BINDINGS,
    };
  }

  function defaultCustomerTemplateKey(explicitConfig) {
    var config = explicitConfig || activeConfig() || null;
    var configured = toText(config && (config.defaultCustomerTemplateKey || config.defaultCustomerTemplateId || config.defaultQuoteTemplateKey), '');
    if (configured) return configured;
    var customerTemplate = ensureArray(config && config.customerTemplates).find(function (t) { return toText(t && t.channel, 'customer') === 'customer'; });
    if (customerTemplate) return toText(customerTemplate.key || customerTemplate.id, DEFAULT_CUSTOMER_TEMPLATES[0].key);
    var firstTemplate = ensureArray(config && config.customerTemplates)[0];
    return toText(firstTemplate && (firstTemplate.key || firstTemplate.id), DEFAULT_CUSTOMER_TEMPLATES[0].key);
  }

  function normalizeStructure(config) {
    if (!config || typeof config !== 'object') return config;
    config.stageMapping = normalizeStageMapping(config.stageMapping);
    config.stageDefinitions = ensureArray(config.stageDefinitions).map(normalizeStageDefinition).filter(Boolean).sort(function (a, b) { return (a.sequence || 999) - (b.sequence || 999); });
    config.workflowNodes = normalizeWorkflowNodes(config.workflowNodes, config);
    config.lifecycleStages = normalizeLifecycleStages(config.lifecycleStages);
    config.customerTemplates = normalizeCustomerTemplates(config.customerTemplates, config);
    config.allocationProfiles = normalizeAllocationProfiles(config.allocationProfiles);
    config.sheetMappings = normalizeSheetMappings(config.sheetMappings);
    config.workbookRoles = normalizeWorkbookRoles(config.workbookRoles);
    config.financialWorkbook = normalizeFinancialWorkbook(config.financialWorkbook);
    return config;
  }

  // ============================================================
  // 缓存
  // ============================================================
  var _cache = {};
  var _activeProjectId = null;

  function activeConfig() {
    return _activeProjectId ? _cache[_activeProjectId] || null : null;
  }

  // ============================================================
  // Runtime inference & registry/path loaders
  // ============================================================
  function inferFromRuntime(runtime) {
    var safeRuntime = runtime && runtime.master ? runtime : (global.G281_RUNTIME || {});
    var master = safeRuntime.master || {};
    var years = Array.isArray(master.years) ? master.years : [];
    var volumes = Array.isArray(master.volumes) ? master.volumes : [];
    var baselineMix = Array.isArray(master.baselineMix) ? master.baselineMix : [];
    var configNames = Array.isArray(master.configNames) ? master.configNames : [];
    var mixTotal = baselineMix.reduce(function (sum, value) { return sum + (Number(value) || 0); }, 0);
    var normalizedMix = baselineMix.length ? baselineMix.map(function (value) { var n = Number(value) || 0; return mixTotal > 1.01 ? n / (mixTotal || 1) : n; }) : [1];
    var normalizedNames = configNames.length ? configNames : ['default'];
    return {
      projectId: master.projectId || master.projectCode || 'PROJECT',
      projectCode: master.projectCode || master.projectId || 'PROJECT',
      projectName: master.name || 'Lifecycle Cost Platform Seed',
      customer: master.customer || '',
      baseline: { lifecycle: { years: years.length || 6 }, vehicleConfigs: normalizedNames.map(function (name, index) { return { name: name, ratio: Number(normalizedMix[index]) || (index === 0 ? 1 : 0), harnesses: [] }; }), annualVolumes: years.map(function (year, index) { return { year: year, volume: Number(volumes[index]) || 0 }; }) },
      harnesses: [],
      materialComposition: { connector: 0.24, copper: 0.38, aluminum: 0.18, other: 0.20 },
      metalSensitivity: { copper: 0.65, aluminum: 0.45 },
    };
  }

  function isLikelyConfigObject(value) { return Boolean(value && typeof value === 'object' && !Array.isArray(value) && (value.baseline || value.materialComposition || value.metalSensitivity || value.customerTemplates || value.lifecycleStages || value.stageDefinitions)); }
  function isLikelyRuntimeObject(value) { return Boolean(value && typeof value === 'object' && !Array.isArray(value) && !isLikelyConfigObject(value)); }

  function resolveRouterProjectId() {
    if (!global.G281PageRouter || typeof global.G281PageRouter.resolveState !== 'function') return '';
    var routerState = global.G281PageRouter.resolveState();
    return toText(routerState && (routerState.projectId || routerState.projectCode), '');
  }

  function loadFromRegistry(projectId) {
    var registry = global.G281ProjectRegistry;
    if (!registry) return null;
    var requestedId = toText(projectId, '');
    var registryConfig = null;
    if (requestedId && typeof registry.getProject === 'function') registryConfig = registry.getProject(requestedId);
    if (!registryConfig && typeof registry.getActiveConfig === 'function') registryConfig = registry.getActiveConfig();
    if (!registryConfig) return null;
    var result = ConfigLoader.load(registryConfig);
    return result && result.config ? result.config : null;
  }

  async function loadFromPath(path) {
    if (!path || typeof fetch !== 'function') return null;
    var response = await fetch(path, { cache: 'no-store' });
    if (!response.ok) throw new Error('Failed to load config: ' + path);
    var json = await response.json();
    var result = ConfigLoader.load(json);
    if (result.errors && result.errors.length) throw new Error(result.errors.join('; '));
    return result.config;
  }

  function normalizeLoadProjectOptions(pathOrRuntime, maybeOptions) {
    var options = ensureObject(maybeOptions);
    var configObject = null;
    var runtime = null;
    var defaultConfigPath = '';
    var looksLikeOptionsObject = Boolean(pathOrRuntime && typeof pathOrRuntime === 'object' && !Array.isArray(pathOrRuntime) && (pathOrRuntime.defaultConfigPath != null || pathOrRuntime.configPath != null || pathOrRuntime.requireActiveProject != null || pathOrRuntime.runtime != null || pathOrRuntime.fallbackPaths != null));
    if (typeof pathOrRuntime === 'string') defaultConfigPath = pathOrRuntime;
    else if (!looksLikeOptionsObject && isLikelyConfigObject(pathOrRuntime)) configObject = pathOrRuntime;
    else if (isLikelyRuntimeObject(pathOrRuntime)) runtime = pathOrRuntime;
    else if (pathOrRuntime && typeof pathOrRuntime === 'object') {
      options = Object.assign({}, pathOrRuntime, maybeOptions);
      if (isLikelyConfigObject(options.config)) configObject = options.config;
      if (isLikelyRuntimeObject(options.runtime)) runtime = options.runtime;
      defaultConfigPath = toText(options.defaultConfigPath || options.configPath, '');
    }
    return {
      config: configObject, runtime: runtime,
      projectId: toText(options.projectId || options.projectCode, ''),
      defaultConfigPath: toText(defaultConfigPath || options.defaultConfigPath || options.configPath, DEFAULT_PROJECT_CONFIG_PATH),
      requireActiveProject: Boolean(options.requireActiveProject),
      fallbackPaths: uniqueText([].concat(options.fallbackPaths).concat([defaultConfigPath || options.defaultConfigPath || options.configPath, DEFAULT_PROJECT_CONFIG_PATH, '../config/g281.project.json'])),
    };
  }

  // ============================================================
  // 公开 API
  // ============================================================
  var ConfigLoader = {
    load: function (rawConfig) {
      if (!rawConfig || typeof rawConfig !== 'object') return { config: null, errors: ['Invalid config: not an object'] };
      var config = deepMergeDefaults(rawConfig, DEFAULTS);
      config = normalizeStructure(config);
      var errors = validate(config);
      if (errors.length > 0) return { config: config, errors: errors };
      var pid = config.projectId;
      _cache[pid] = Object.freeze(config);
      _activeProjectId = pid;
      return { config: _cache[pid], errors: [] };
    },

    loadFromString: function (jsonString) {
      try { return ConfigLoader.load(JSON.parse(jsonString)); } catch (e) { return { config: null, errors: ['JSON parse error: ' + e.message] }; }
    },

    loadFromStorage: function (projectId) {
      var key = projectId + '.projectConfig';
      var raw = null;
      try { raw = localStorage.getItem(key); } catch (e) { return { config: null, errors: ['localStorage read error: ' + e.message] }; }
      if (!raw) return { config: null, errors: ['No config found in localStorage for key: ' + key] };
      return ConfigLoader.loadFromString(raw);
    },

    loadFromJSON: function (rawConfig) { return ConfigLoader.load(rawConfig); },
    inferFromRuntime: function (runtime) { return deepMergeDefaults(inferFromRuntime(runtime), DEFAULTS); },
    canonicalStageKey: function (stageKey, explicitConfig) { return canonicalStageKey(stageKey, explicitConfig); },
    stageAliases: function (stageKey, explicitConfig) { return stageAliases(stageKey, explicitConfig); },
    stageLabel: function (stageKey, explicitConfig, fallback) { return stageLabel(stageKey, explicitConfig, fallback); },
    defaultCustomerTemplateKey: function (explicitConfig) { return defaultCustomerTemplateKey(explicitConfig); },

    loadProjectConfig: async function (pathOrRuntime, maybeOptions) {
      var options = normalizeLoadProjectOptions(pathOrRuntime, maybeOptions);
      if (options.config) return ConfigLoader.load(options.config).config;
      var requestedProjectId = options.projectId || resolveRouterProjectId();
      if (requestedProjectId) {
        var registryConfig = loadFromRegistry(requestedProjectId);
        if (registryConfig) return registryConfig;
        var storageResult = ConfigLoader.loadFromStorage(requestedProjectId);
        if (storageResult && storageResult.config) return storageResult.config;
        if (options.requireActiveProject) throw new Error('Active project not found: ' + requestedProjectId);
      }
      if (_activeProjectId && _cache[_activeProjectId]) return _cache[_activeProjectId];
      var activeRegistryConfig = loadFromRegistry('');
      if (activeRegistryConfig) return activeRegistryConfig;
      if (options.requireActiveProject) throw new Error('Active project is required but not available');
      for (var index = 0; index < options.fallbackPaths.length; index += 1) {
        var candidatePath = options.fallbackPaths[index];
        if (!candidatePath) continue;
        try { return await loadFromPath(candidatePath); } catch (error) { /* continue */ }
      }
      return ConfigLoader.load(inferFromRuntime(options.runtime || pathOrRuntime)).config;
    },

    saveToStorage: function (config) {
      if (!config || !config.projectId) return;
      var key = config.projectId + '.projectConfig';
      try { localStorage.setItem(key, JSON.stringify(config)); } catch (e) { console.error('[ConfigLoader] saveToStorage failed:', e); }
    },

    active: function () { return activeConfig(); },
    get: function (projectId) { return _cache[projectId] || null; },
    setActive: function (projectId) { if (_cache[projectId]) { _activeProjectId = projectId; return true; } return false; },
    listProjects: function () { return Object.keys(_cache); },
    defaultConfigPath: function () { return DEFAULT_PROJECT_CONFIG_PATH; },
    clearCache: function () { _cache = {}; _activeProjectId = null; },
    _DEFAULTS: DEFAULTS,
    _validate: validate,
    _normalizeLookupKey: normalizeLookupKey,
    _clonePlain: clonePlain,
  };

  // ============================================================
  // 导出
  // ============================================================
  global.ConfigLoader = ConfigLoader;
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this);
