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

  var DEFAULT_STAGE_DEFINITIONS = [
    {
      id: 'harness',
      name: 'Harness intake',
      sequence: 10,
      category: 'workflow',
      page: 'pages/accounting.html',
      ownerRoles: ['program', 'costing'],
      artifactType: 'harness',
      scope: 'harness',
      supportsPartialPublish: true,
      aliases: ['wireHarness'],
    },
    {
      id: 'bom',
      name: 'BOM review',
      sequence: 20,
      category: 'workflow',
      page: 'pages/accounting.html',
      ownerRoles: ['engineering', 'costing'],
      artifactType: 'bom',
      scope: 'harness',
      supportsPartialPublish: true,
      aliases: ['billOfMaterial'],
    },
    {
      id: 'quotation',
      name: 'Quotation baseline',
      sequence: 30,
      category: 'workflow',
      page: 'pages/accounting.html',
      ownerRoles: ['sales', 'finance'],
      artifactType: 'quotation',
      scope: 'harness',
      supportsPartialPublish: true,
      aliases: ['quote', 'quoteBaseline'],
    },
    {
      id: 'labor',
      name: 'Labor validation',
      sequence: 40,
      category: 'workflow',
      page: 'pages/accounting.html',
      ownerRoles: ['manufacturing', 'finance'],
      artifactType: 'labor',
      scope: 'harness',
      supportsPartialPublish: true,
      aliases: ['manhour'],
    },
    {
      id: 'packaging',
      name: 'Packaging validation',
      sequence: 50,
      category: 'workflow',
      page: 'pages/accounting.html',
      ownerRoles: ['logistics', 'finance'],
      artifactType: 'packaging',
      scope: 'harness',
      supportsPartialPublish: true,
      aliases: ['package', 'logistics'],
    },
    {
      id: 'capital',
      name: 'Equipment tooling fixture',
      sequence: 60,
      category: 'workflow',
      page: 'pages/accounting.html',
      ownerRoles: ['industrialization', 'finance'],
      artifactType: 'capital',
      scope: 'harness',
      supportsPartialPublish: true,
      aliases: ['equipment', 'tooling', 'fixture'],
    },
    {
      id: 'approval',
      name: 'Approval release',
      sequence: 70,
      category: 'workflow',
      page: 'pages/archive.html',
      ownerRoles: ['management', 'finance'],
      artifactType: 'approval',
      scope: 'project',
      supportsPartialPublish: false,
      aliases: ['publish', 'release'],
    },
  ];

  var DEFAULT_WORKFLOW_NODES = [
    {
      id: 'preview_page',
      nodeType: 'page',
      page: 'pages/preview.html',
      stageIds: ['quotation'],
      next: ['accounting_page'],
    },
    {
      id: 'accounting_page',
      nodeType: 'page',
      page: 'pages/accounting.html',
      stageIds: ['harness', 'bom', 'quotation', 'labor', 'packaging', 'capital', 'approval'],
      next: ['tracking_page', 'archive_page'],
    },
    {
      id: 'tracking_page',
      nodeType: 'page',
      page: 'pages/tracking.html',
      stageIds: ['quotation', 'labor', 'packaging', 'capital'],
      next: ['archive_page'],
    },
    {
      id: 'archive_page',
      nodeType: 'page',
      page: 'pages/archive.html',
      stageIds: ['approval'],
      next: [],
    },
  ];

  var DEFAULT_WORKBOOK_ROLES = [
    {
      id: 'bom_source',
      name: 'BOM source workbook',
      scope: 'harness',
      allowMultiple: true,
    },
    {
      id: 'financial_quote_baseline',
      name: 'Financial baseline workbook',
      scope: 'project',
      allowMultiple: true,
    },
    {
      id: 'customer_quote_template',
      name: 'Customer quote template workbook',
      scope: 'project',
      allowMultiple: true,
    },
    {
      id: 'project_rollup_pack',
      name: 'Project rollup workbook pack',
      scope: 'project',
      allowMultiple: false,
    },
    {
      id: 'release_archive_pack',
      name: 'Release archive workbook pack',
      scope: 'release',
      allowMultiple: true,
    },
  ];

  var DEFAULT_SHEET_MAPPINGS = [
    {
      id: 'bom_change_history',
      workbookRole: 'bom_source',
      sheetRole: 'change_history',
      matchStrategy: 'keyword',
    },
    {
      id: 'bom_assembly_parts',
      workbookRole: 'bom_source',
      sheetRole: 'assembly_parts',
      matchStrategy: 'keyword',
    },
    {
      id: 'bom_secondary_materials',
      workbookRole: 'bom_source',
      sheetRole: 'secondary_materials',
      matchStrategy: 'keyword',
    },
    {
      id: 'bom_harness_detail',
      workbookRole: 'bom_source',
      sheetRole: 'harness',
      matchStrategy: 'pattern',
    },
    {
      id: 'finance_quote_baseline',
      workbookRole: 'financial_quote_baseline',
      sheetRole: 'quote_baseline',
      matchStrategy: 'exact',
    },
    {
      id: 'template_rollup_summary',
      workbookRole: 'customer_quote_template',
      sheetRole: 'project_rollup',
      matchStrategy: 'exact',
    },
  ];

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
    {
      id: 'customer_quote_standard',
      key: 'customer_quote_standard',
      aliases: ['standardQuote', 'defaultCustomerTemplate'],
      name: 'Customer quote standard',
      channel: 'customer',
      output: 'xlsx',
      stageMapping: {
        quotation: 'quotation',
        fixed: 'quotation',
        change: 'quotation',
        annualDrop: 'quotation',
      },
      cells: DEFAULT_TEMPLATE_CELLS,
    },
    {
      id: 'internal_project_rollup',
      key: 'internal_project_rollup',
      aliases: ['internalRollup'],
      name: 'Internal project rollup',
      channel: 'internal',
      output: 'xlsx',
      cells: [
        { cellKey: 'A1', label: 'Project code', valueKey: 'projectCode' },
        { cellKey: 'A2', label: 'Project name', valueKey: 'projectName' },
        { cellKey: 'B1', label: 'Baseline key', valueKey: 'baselineKey' },
        { cellKey: 'B2', label: 'Lifecycle years', valueKey: 'lifecycleYears' },
        { cellKey: 'C1', label: 'Revenue per set', valueKey: 'revenuePerSet' },
        { cellKey: 'C2', label: 'Cost per set', valueKey: 'costPerSet' },
        { cellKey: 'C3', label: 'Profit per set', valueKey: 'profitPerSet' },
        { cellKey: 'D1', label: 'Material per set', valueKey: 'materialPerSet' },
        { cellKey: 'D2', label: 'Direct labor per set', valueKey: 'directLaborPerSet' },
        { cellKey: 'D3', label: 'Packaging per set', valueKey: 'packagingPerSet' },
        { cellKey: 'E1', label: 'Lifecycle revenue', valueKey: 'lifecycleRevenue' },
        { cellKey: 'E2', label: 'Lifecycle cost', valueKey: 'lifecycleCost' },
        { cellKey: 'E3', label: 'Lifecycle profit', valueKey: 'lifecycleProfit' },
      ],
    },
  ];

  var DEFAULT_ALLOCATION_PROFILES = [
    {
      id: 'perSetWorkbook',
      name: 'Workbook per-set value',
      costBuckets: ['packaging', 'logistics'],
      defaultDriver: 'workbook_per_set',
      supportedDrivers: ['workbook_per_set'],
    },
    {
      id: 'lifecycleAmortized',
      name: 'Lifecycle amortized',
      costBuckets: ['equipment', 'tooling', 'fixture'],
      defaultDriver: 'lifecycle_volume',
      supportedDrivers: ['lifecycle_volume', 'vehicle_mix', 'harness_share'],
    },
    {
      id: 'customerRecoverable',
      name: 'Customer recoverable',
      costBuckets: ['tooling', 'fixture', 'rnd'],
      defaultDriver: 'customer_recoverable',
      supportedDrivers: ['customer_recoverable', 'lifecycle_volume'],
    },
    {
      id: 'directExpense',
      name: 'Direct expense',
      costBuckets: ['commercial', 'nre'],
      defaultDriver: 'direct_expense',
      supportedDrivers: ['direct_expense'],
    },
  ];

  var DEFAULT_STAGE_MAPPING = {
    quote: 'quotation',
    quotation: 'quotation',
    quotebaseline: 'quotation',
    quotationbaseline: 'quotation',
    fixed: 'fixed',
    fixedbaseline: 'fixed',
    target: 'fixed',
    fixedpoint: 'fixed',
    change: 'change',
    changes: 'change',
    delta: 'change',
    diff: 'change',
    annualdrop: 'annualDrop',
    annualreduce: 'annualDrop',
    annualreduction: 'annualDrop',
    rfq: 'rfq',
    sop: 'sop',
    massproduction: 'massProduction',
    eol: 'eol',
  };

  // ============================================================
  // 默认值
  // ============================================================
  var DEFAULTS = {
    dimensions: {
      currency: 'CNY',
      currencySymbol: '\u00a5',
      lengthUnit: 'mm',
      weightUnit: 'g',
      volumeUnit: '\u5957',
      priceDecimalPlaces: 4,
      ratioDecimalPlaces: 2,
    },
    stateDefaults: {
      bom: 'freeze',
      metal: 'quote',
      connector: 'quote',
      labor: 'base',
      equipment: 'base',
      packaging: 'base',
      sales: 'quote',
      mix: 'quote',
      annualDrop: 'quote',
      oneTimeCustomer: 'quote',
      rebate: 'quote',
      vave: 'none',
    },
    bom: {
      dataStartRow: 5,
      maxColumns: 17,
      fallbackRowCount: 2000,
      assemblyUnitKeyword: 'set',
    },
    stageDefinitions: DEFAULT_STAGE_DEFINITIONS,
    workflowNodes: DEFAULT_WORKFLOW_NODES,
    customerTemplates: DEFAULT_CUSTOMER_TEMPLATES,
    allocationProfiles: DEFAULT_ALLOCATION_PROFILES,
    sheetMappings: DEFAULT_SHEET_MAPPINGS,
    workbookRoles: DEFAULT_WORKBOOK_ROLES,
    stageMapping: DEFAULT_STAGE_MAPPING,
  };

  // ============================================================
  // 必填字段检查
  // ============================================================
  var REQUIRED_FIELDS = [
    'projectId',
    'projectName',
    'baseline',
    'baseline.lifecycle',
    'baseline.lifecycle.years',
    'baseline.vehicleConfigs',
    'harnesses',
    'materialComposition',
    'metalSensitivity',
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

    // materialComposition 之和应为 1.0
    if (config.materialComposition) {
      var mc = config.materialComposition;
      var sum = (mc.connector || 0) + (mc.copper || 0) + (mc.aluminum || 0) + (mc.other || 0);
      if (Math.abs(sum - 1.0) > 0.01) {
        errors.push('materialComposition sum = ' + sum.toFixed(4) + ', expected 1.00');
      }
    }

    // vehicleConfigs ratio 之和应为 1.0
    if (config.baseline && Array.isArray(config.baseline.vehicleConfigs)) {
      var ratioSum = config.baseline.vehicleConfigs.reduce(function (s, vc) {
        return s + (vc.ratio || 0);
      }, 0);
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
      } else if (
        typeof defaults[key] === 'object' &&
        defaults[key] !== null &&
        !Array.isArray(defaults[key])
      ) {
        result[key] = deepMergeDefaults(result[key], defaults[key]);
      }
    });
    return result;
  }

  function ensureArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function ensureObject(value) {
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  }

  function clonePlain(value, fallback) {
    try {
      return JSON.parse(JSON.stringify(value));
    } catch (error) {
      return fallback;
    }
  }

  function normalizeLookupKey(value) {
    return toText(value, '')
      .toLowerCase()
      .replace(/[\s_\-()（）[\]{}]+/g, '');
  }

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
      id: canonicalKey,
      key: canonicalKey,
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
      aliases: uniqueText(
        []
          .concat(stage && stage.aliases)
          .concat([stage && stage.id, stage && stage.key, stage && stage.stageKey, stage && stage.artifactType])
      ),
    };
  }

  function normalizeStageMapping(mapping) {
    var normalized = {};
    var source = ensureObject(mapping);
    Object.keys(source).forEach(function (key) {
      var normalizedKey = normalizeLookupKey(key);
      if (!normalizedKey) return;
      normalized[normalizedKey] = toText(source[key], '');
    });
    return normalized;
  }

  function buildStageAliasMap(config) {
    var aliasMap = {};
    var definitions = ensureArray(config && config.stageDefinitions);
    definitions.forEach(function (stage) {
      var canonicalKey = toText(stage && (stage.id || stage.key || stage.stageKey), '');
      if (!canonicalKey) return;
      var aliases = []
        .concat(stage && stage.aliases)
        .concat([canonicalKey, stage && stage.key, stage && stage.id, stage && stage.stageKey, stage && stage.artifactType]);
      if (canonicalKey === 'quotation') aliases.push('quote');
      if (canonicalKey === 'quote') aliases.push('quotation');
      aliases.forEach(function (alias) {
        var normalizedAlias = normalizeLookupKey(alias);
        if (!normalizedAlias) return;
        aliasMap[normalizedAlias] = canonicalKey;
      });
    });

    Object.keys(ensureObject(config && config.stageMapping)).forEach(function (alias) {
      var normalizedAlias = normalizeLookupKey(alias);
      var target = toText(config.stageMapping[alias], '');
      if (!normalizedAlias || !target) return;
      var targetKey = aliasMap[normalizeLookupKey(target)] || target;
      aliasMap[normalizedAlias] = targetKey;
    });
    return aliasMap;
  }

  function defaultStageKey(explicitConfig) {
    var config = explicitConfig || null;
    var aliasMap = buildStageAliasMap(config || {});
    return aliasMap.quote || aliasMap.quotation || 'quotation';
  }

  function canonicalStageKey(stageKey, explicitConfig) {
    var raw = toText(stageKey, '');
    if (!raw) return '';
    var config = explicitConfig || activeConfig() || null;
    var aliasMap = buildStageAliasMap(config || {});
    var normalized = normalizeLookupKey(raw);
    if (aliasMap[normalized]) return aliasMap[normalized];
    if (normalized === 'quote' || normalized === 'quotation' || normalized === 'quotebaseline' || normalized === 'quotationbaseline') {
      return defaultStageKey(config);
    }
    if (normalized === 'fixed' || normalized === 'fixedbaseline' || normalized === 'target' || normalized === 'fixedpoint') {
      return 'fixed';
    }
    if (normalized === 'change' || normalized === 'changes' || normalized === 'delta' || normalized === 'diff') {
      return 'change';
    }
    if (normalized === 'annualdrop' || normalized === 'annualreduce' || normalized === 'annualreduction') {
      return 'annualDrop';
    }
    return raw;
  }

  function stageAliases(stageKey, explicitConfig) {
    var config = explicitConfig || activeConfig() || null;
    var canonicalKey = canonicalStageKey(stageKey, config) || toText(stageKey, '');
    var aliases = [canonicalKey, toText(stageKey, '')];
    ensureArray(config && config.stageDefinitions).forEach(function (stage) {
      var key = toText(stage && (stage.id || stage.key || stage.stageKey), '');
      if (key !== canonicalKey) return;
      aliases = aliases
        .concat(stage && stage.aliases)
        .concat([stage && stage.id, stage && stage.key, stage && stage.stageKey, stage && stage.artifactType]);
    });
    Object.keys(ensureObject(config && config.stageMapping)).forEach(function (alias) {
      var target = toText(config.stageMapping[alias], '');
      if (canonicalStageKey(target, config) === canonicalKey) aliases.push(alias);
    });
    if (canonicalKey === 'quotation') aliases.push('quote');
    if (canonicalKey === 'quote') aliases.push('quotation');
    return uniqueText(aliases);
  }

  function stageLabel(stageKey, explicitConfig, fallback) {
    var config = explicitConfig || activeConfig() || null;
    var canonicalKey = canonicalStageKey(stageKey, config) || toText(stageKey, fallback);
    var definition = ensureArray(config && config.stageDefinitions).find(function (stage) {
      return toText(stage && (stage.id || stage.key || stage.stageKey), '') === canonicalKey;
    });
    return toText(
      definition && (definition.displayName || definition.name || definition.label),
      fallback || canonicalKey
    );
  }

  function normalizeWorkflowNodes(workflowNodes, config) {
    return ensureArray(workflowNodes).map(function (node, index) {
      var nodeId = toText(node && node.id, 'workflow-node-' + (index + 1));
      var stageIds = uniqueText(ensureArray(node && node.stageIds).map(function (stageId) {
        return canonicalStageKey(stageId, config) || toText(stageId, '');
      }).filter(Boolean));
      return {
        id: nodeId,
        nodeType: toText(node && node.nodeType, 'page'),
        page: toText(node && node.page, ''),
        stageIds: stageIds,
        next: uniqueText(node && node.next),
      };
    });
  }

  function normalizeTemplateCells(cells) {
    return ensureArray(cells).map(function (cell, index) {
      var cellKey = toText(cell && cell.cellKey, 'CELL_' + (index + 1));
      return {
        cellKey: cellKey,
        label: toText(cell && cell.label, cellKey),
        valueKey: toText(cell && cell.valueKey, ''),
      };
    }).filter(function (cell) {
      return cell.cellKey;
    });
  }

  function normalizeCustomerTemplates(templates, config) {
    return ensureArray(templates).map(function (template, index) {
      var templateId = toText(template && (template.id || template.key), 'template-' + (index + 1));
      var stageMapping = {};
      Object.keys(ensureObject(template && template.stageMapping)).forEach(function (key) {
        var canonicalKey = canonicalStageKey(key, config) || toText(key, '');
        if (!canonicalKey) return;
        stageMapping[canonicalKey] = toText(template.stageMapping[key], canonicalKey);
      });
      return {
        id: templateId,
        key: toText(template && template.key, templateId),
        legacyKey: toText(template && template.legacyKey, ''),
        aliases: uniqueText([].concat(template && template.aliases).concat([template && template.id, template && template.key, template && template.legacyKey])),
        name: toText(template && template.name, templateId),
        label: toText(template && template.label, template && template.name),
        channel: toText(template && template.channel, 'customer'),
        output: toText(template && template.output, 'xlsx'),
        stageKeys: uniqueText(ensureArray(template && template.stageKeys).map(function (stageKey) {
          return canonicalStageKey(stageKey, config) || toText(stageKey, '');
        }).filter(Boolean)),
        stageMapping: stageMapping,
        seedProjectCodes: uniqueText(template && template.seedProjectCodes),
        cells: normalizeTemplateCells(template && template.cells),
      };
    });
  }

  function normalizeAllocationProfiles(profiles) {
    return ensureArray(profiles).map(function (profile, index) {
      var profileId = toText(profile && profile.id, 'allocation-profile-' + (index + 1));
      return {
        id: profileId,
        name: toText(profile && profile.name, profileId),
        costBuckets: uniqueText(profile && profile.costBuckets),
        defaultDriver: toText(profile && profile.defaultDriver, ''),
        supportedDrivers: uniqueText(profile && profile.supportedDrivers),
        seedProjectCodes: uniqueText(profile && profile.seedProjectCodes),
      };
    });
  }

  function normalizeSheetMappings(mappings) {
    return ensureArray(mappings).map(function (mapping, index) {
      var mappingId = toText(mapping && mapping.id, 'sheet-mapping-' + (index + 1));
      return {
        id: mappingId,
        workbookRole: toText(mapping && mapping.workbookRole, ''),
        sheetRole: toText(mapping && mapping.sheetRole, ''),
        matchStrategy: toText(mapping && mapping.matchStrategy, 'keyword'),
        matchValue: toText(mapping && mapping.matchValue, ''),
        matchText: toText(mapping && mapping.matchText, ''),
        sheetName: toText(mapping && mapping.sheetName, ''),
      };
    });
  }

  function normalizeWorkbookRoles(workbookRoles) {
    return ensureArray(workbookRoles).map(function (role, index) {
      var roleId = toText(role && role.id, 'workbook-role-' + (index + 1));
      return {
        id: roleId,
        name: toText(role && role.name, roleId),
        scope: toText(role && role.scope, 'project'),
        allowMultiple: Boolean(role && role.allowMultiple),
      };
    });
  }

  function defaultCustomerTemplateKey(explicitConfig) {
    var config = explicitConfig || activeConfig() || null;
    var configured = toText(
      config && (config.defaultCustomerTemplateKey || config.defaultCustomerTemplateId || config.defaultQuoteTemplateKey),
      ''
    );
    if (configured) return configured;
    var customerTemplate = ensureArray(config && config.customerTemplates).find(function (template) {
      return toText(template && template.channel, 'customer') === 'customer';
    });
    if (customerTemplate) return toText(customerTemplate.key || customerTemplate.id, DEFAULT_CUSTOMER_TEMPLATES[0].key);
    var firstTemplate = ensureArray(config && config.customerTemplates)[0];
    return toText(firstTemplate && (firstTemplate.key || firstTemplate.id), DEFAULT_CUSTOMER_TEMPLATES[0].key);
  }

  function normalizeStructure(config) {
    if (!config || typeof config !== 'object') return config;
    config.stageMapping = normalizeStageMapping(config.stageMapping);
    config.stageDefinitions = ensureArray(config.stageDefinitions)
      .map(normalizeStageDefinition)
      .filter(Boolean)
      .sort(function (left, right) {
        return (left.sequence || 999) - (right.sequence || 999);
      });
    config.workflowNodes = normalizeWorkflowNodes(config.workflowNodes, config);
    config.customerTemplates = normalizeCustomerTemplates(config.customerTemplates, config);
    config.allocationProfiles = normalizeAllocationProfiles(config.allocationProfiles);
    config.sheetMappings = normalizeSheetMappings(config.sheetMappings);
    config.workbookRoles = normalizeWorkbookRoles(config.workbookRoles);
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

  function inferFromRuntime(runtime) {
    var safeRuntime = runtime && runtime.master ? runtime : (global.G281_RUNTIME || {});
    var master = safeRuntime.master || {};
    var years = Array.isArray(master.years) ? master.years : [];
    var volumes = Array.isArray(master.volumes) ? master.volumes : [];
    var baselineMix = Array.isArray(master.baselineMix) ? master.baselineMix : [];
    var configNames = Array.isArray(master.configNames) ? master.configNames : [];
    var mixTotal = baselineMix.reduce(function (sum, value) {
      return sum + (Number(value) || 0);
    }, 0);
    var normalizedMix = baselineMix.length
      ? baselineMix.map(function (value) {
          var numeric = Number(value) || 0;
          if (mixTotal > 1.01) return numeric / (mixTotal || 1);
          return numeric;
        })
      : [1];
    var normalizedNames = configNames.length ? configNames : ['default'];

    return {
      projectId: master.projectId || master.projectCode || 'G281',
      projectCode: master.projectCode || master.projectId || 'G281',
      projectName: master.name || 'Lifecycle Cost Platform Seed',
      customer: master.customer || '',
      baseline: {
        lifecycle: {
          years: years.length || 6,
        },
        vehicleConfigs: normalizedNames.map(function (name, index) {
          return {
            name: name,
            ratio: Number(normalizedMix[index]) || (index === 0 ? 1 : 0),
            harnesses: [],
          };
        }),
        annualVolumes: years.map(function (year, index) {
          return { year: year, volume: Number(volumes[index]) || 0 };
        }),
      },
      harnesses: [],
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
    };
  }

  // ============================================================
  // 公开 API
  // ============================================================
  var ConfigLoader = {
    /**
     * 从 JSON 对象加载配置
     * @param {Object} rawConfig - 原始配置对象
     * @returns  config: Object, errors: string[] 
     */
    load: function (rawConfig) {
      if (!rawConfig || typeof rawConfig !== 'object') {
        return { config: null, errors: ['Invalid config: not an object'] };
      }

      // 填充默认值
      var config = deepMergeDefaults(rawConfig, DEFAULTS);
      config = normalizeStructure(config);

      // 验证
      var errors = validate(config);
      if (errors.length > 0) {
        return { config: config, errors: errors };
      }

      // 缓存
      var pid = config.projectId;
      _cache[pid] = Object.freeze(config);
      _activeProjectId = pid;

      return { config: _cache[pid], errors: [] };
    },

    /**
     * 从 JSON 字符串加载
     * @param {string} jsonString
     * @returns  config: Object, errors: string[] 
     */
    loadFromString: function (jsonString) {
      try {
        var parsed = JSON.parse(jsonString);
        return ConfigLoader.load(parsed);
      } catch (e) {
        return { config: null, errors: ['JSON parse error: ' + e.message] };
      }
    },

    /**
     * 从 localStorage 加载
     * @param {string} projectId
     * @returns  config: Object, errors: string[] 
     */
    loadFromStorage: function (projectId) {
      var key = projectId + '.projectConfig';
      var raw = null;
      try {
        raw = localStorage.getItem(key);
      } catch (e) {
        return { config: null, errors: ['localStorage read error: ' + e.message] };
      }
      if (!raw) {
        return { config: null, errors: ['No config found in localStorage for key: ' + key] };
      }
      return ConfigLoader.loadFromString(raw);
    },

    loadFromJSON: function (rawConfig) {
      return ConfigLoader.load(rawConfig);
    },

    inferFromRuntime: function (runtime) {
      return deepMergeDefaults(inferFromRuntime(runtime), DEFAULTS);
    },

    canonicalStageKey: function (stageKey, explicitConfig) {
      return canonicalStageKey(stageKey, explicitConfig);
    },

    stageAliases: function (stageKey, explicitConfig) {
      return stageAliases(stageKey, explicitConfig);
    },

    stageLabel: function (stageKey, explicitConfig, fallback) {
      return stageLabel(stageKey, explicitConfig, fallback);
    },

    defaultCustomerTemplateKey: function (explicitConfig) {
      return defaultCustomerTemplateKey(explicitConfig);
    },

    loadProjectConfig: async function (pathOrRuntime) {
      if (_activeProjectId && _cache[_activeProjectId]) {
        return _cache[_activeProjectId];
      }
      if (pathOrRuntime && pathOrRuntime.projectId) {
        return ConfigLoader.load(pathOrRuntime).config;
      }
      if (typeof pathOrRuntime === 'string' && typeof fetch === 'function') {
        try {
          var response = await fetch(pathOrRuntime);
          var json = await response.json();
          return ConfigLoader.load(json).config;
        } catch (error) {
          // Fall through to runtime inference.
        }
      }
      if (typeof fetch === 'function') {
        try {
          var defaultResponse = await fetch('../config/g281.project.json');
          var defaultJson = await defaultResponse.json();
          return ConfigLoader.load(defaultJson).config;
        } catch (error) {
          // Fall through to runtime inference for offline file:// mode.
        }
      }
      return ConfigLoader.load(inferFromRuntime(pathOrRuntime)).config;
    },

    /**
     * 保存配置到 localStorage
     * @param {Object} config
     */
    saveToStorage: function (config) {
      if (!config || !config.projectId) return;
      var key = config.projectId + '.projectConfig';
      try {
        localStorage.setItem(key, JSON.stringify(config));
      } catch (e) {
        console.error('[ConfigLoader] saveToStorage failed:', e);
      }
    },

    /**
     * 获取当前活动项目配置
     * @returns {Object|null}
     */
    active: function () {
      return activeConfig();
    },

    /**
     * 获取指定项目配置
     * @param {string} projectId
     * @returns {Object|null}
     */
    get: function (projectId) {
      return _cache[projectId] || null;
    },

    /**
     * 切换活动项目
     * @param {string} projectId
     * @returns {boolean}
     */
    setActive: function (projectId) {
      if (_cache[projectId]) {
        _activeProjectId = projectId;
        return true;
      }
      return false;
    },

    /**
     * 列出所有已缓存的项目 ID
     * @returns {string[]}
     */
    listProjects: function () {
      return Object.keys(_cache);
    },

    /**
     * 清除缓存
     */
    clearCache: function () {
      _cache = {};
      _activeProjectId = null;
    },

    /** 导出默认值（供测试使用） */
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
