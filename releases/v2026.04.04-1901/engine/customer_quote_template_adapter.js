(function (global) {
  'use strict';

  const Shared = global.G281Shared || {};
  const numberOr = Shared.numberOr || ((value, fallback) => {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : fallback;
  });
  const safeArray = Shared.safeArray || ((value) => (Array.isArray(value) ? value : []));
  const toText = Shared.toText || ((value, fallback) => {
    const text = String(value == null ? '' : value).trim();
    return text || (fallback == null ? '' : fallback);
  });

  const DEFAULT_TEMPLATE_KEY = 'customer_quote_standard';
  const DEFAULT_TEMPLATE_CELLS = [
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

  function escapeHtml(value) {
    return toText(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function normalizeKey(value) {
    return toText(value, '').toLowerCase();
  }

  function resolveRuntime(runtimeInput) {
    if (runtimeInput && runtimeInput.master) return runtimeInput;
    if (runtimeInput && typeof runtimeInput.getRuntime === 'function') return runtimeInput.getRuntime() || {};
    return global.G281_RUNTIME || {};
  }

  function resolveConfig(explicitConfig) {
    if (explicitConfig) return explicitConfig;
    return global.ConfigLoader && typeof global.ConfigLoader.active === 'function'
      ? global.ConfigLoader.active()
      : null;
  }

  function resolveStageKey(stageKey, config, fallback) {
    if (global.ConfigLoader && typeof global.ConfigLoader.canonicalStageKey === 'function') {
      return global.ConfigLoader.canonicalStageKey(stageKey, config) || toText(stageKey, fallback);
    }
    return toText(stageKey, fallback);
  }

  function resolveStageAliases(stageKey, config) {
    if (global.ConfigLoader && typeof global.ConfigLoader.stageAliases === 'function') {
      return safeArray(global.ConfigLoader.stageAliases(stageKey, config));
    }
    const canonical = resolveStageKey(stageKey, config, stageKey);
    return canonical === 'quotation' ? [canonical, 'quote'] : [canonical];
  }

  function defaultTemplateKey(config) {
    if (global.ConfigLoader && typeof global.ConfigLoader.defaultCustomerTemplateKey === 'function') {
      return toText(global.ConfigLoader.defaultCustomerTemplateKey(config), DEFAULT_TEMPLATE_KEY);
    }
    return toText(
      config && (config.defaultCustomerTemplateKey || config.defaultCustomerTemplateId || config.defaultQuoteTemplateKey),
      DEFAULT_TEMPLATE_KEY
    );
  }

  function templateAliases(template) {
    return [
      toText(template && template.key, ''),
      toText(template && template.id, ''),
      toText(template && template.legacyKey, ''),
      toText(template && template.name, ''),
    ].concat(safeArray(template && template.aliases)).map((value) => normalizeKey(value)).filter(Boolean);
  }

  function templateMatches(template, templateKey) {
    return templateAliases(template).includes(normalizeKey(templateKey || DEFAULT_TEMPLATE_KEY));
  }

  function listTemplates(config) {
    const activeConfig = resolveConfig(config);
    return safeArray(activeConfig && activeConfig.customerTemplates);
  }

  function defaultTemplate() {
    return {
      id: DEFAULT_TEMPLATE_KEY,
      key: DEFAULT_TEMPLATE_KEY,
      label: 'Customer quote template',
      name: 'Customer quote template',
      channel: 'customer',
      cells: DEFAULT_TEMPLATE_CELLS,
      stageMapping: {},
    };
  }

  function templateSupportsStage(template, stageKey, config) {
    const stageAliases = new Set(resolveStageAliases(stageKey, config).map((value) => normalizeKey(value)));
    const templateStageKeys = safeArray(template && template.stageKeys)
      .map((value) => normalizeKey(resolveStageKey(value, config, value)))
      .filter(Boolean);
    if (templateStageKeys.length && templateStageKeys.some((value) => stageAliases.has(value))) {
      return true;
    }
    const mappingKeys = Object.keys((template && template.stageMapping) || {})
      .map((value) => normalizeKey(resolveStageKey(value, config, value)))
      .filter(Boolean);
    if (mappingKeys.length) {
      return mappingKeys.some((value) => stageAliases.has(value));
    }
    return !templateStageKeys.length && !mappingKeys.length;
  }

  function resolveTemplate(config, templateKey, stageKey) {
    const activeConfig = resolveConfig(config);
    const templates = listTemplates(activeConfig);
    if (!templates.length) return defaultTemplate();

    const configuredDefault = defaultTemplateKey(activeConfig);
    const requestedKey = toText(templateKey, configuredDefault || DEFAULT_TEMPLATE_KEY);
    const requestedStageKey = resolveStageKey(stageKey, activeConfig, '');

    return templates.find((template) => templateMatches(template, requestedKey) && templateSupportsStage(template, requestedStageKey, activeConfig))
      || templates.find((template) => templateMatches(template, requestedKey))
      || templates.find((template) => templateMatches(template, configuredDefault) && templateSupportsStage(template, requestedStageKey, activeConfig))
      || templates.find((template) => templateSupportsStage(template, requestedStageKey, activeConfig) && toText(template && template.channel, '') === 'customer')
      || templates.find((template) => templateSupportsStage(template, requestedStageKey, activeConfig))
      || templates.find((template) => templateMatches(template, configuredDefault))
      || templates.find((template) => toText(template && template.channel, '') === 'customer')
      || templates[0]
      || defaultTemplate();
  }

  function resolveRollup(runtimeInput, baselineKey, options) {
    if (options && options.projectRollup) return options.projectRollup;
    return global.G281ProjectRollupBuilder
      ? global.G281ProjectRollupBuilder.build(resolveRuntime(runtimeInput), null, { baselineKey: baselineKey || 'quote' })
      : null;
  }

  function resolveStageLabel(template, stageKey, config) {
    const canonicalStageKey = resolveStageKey(stageKey, config, stageKey);
    const mapping = template && typeof template.stageMapping === 'object' ? template.stageMapping : null;
    const aliases = resolveStageAliases(canonicalStageKey, config);
    for (let index = 0; index < aliases.length; index += 1) {
      const alias = aliases[index];
      if (mapping && mapping[alias] != null) return toText(mapping[alias], canonicalStageKey);
    }
    if (global.ConfigLoader && typeof global.ConfigLoader.stageLabel === 'function') {
      return toText(global.ConfigLoader.stageLabel(canonicalStageKey, config, canonicalStageKey), canonicalStageKey);
    }
    return canonicalStageKey;
  }

  function resolveStageMeta(runtimeInput, stageKey, options) {
    if (global.G281BomWorkbookAdapter && typeof global.G281BomWorkbookAdapter.resolveStageMeta === 'function') {
      return global.G281BomWorkbookAdapter.resolveStageMeta(runtimeInput, stageKey, options);
    }
    const config = resolveConfig(options && options.config);
    const requestedStageKey = resolveStageKey(
      stageKey || (options && (options.stageKey || options.baselineKey)),
      config,
      'quotation'
    );
    return {
      stageKey: requestedStageKey,
      requestedStageKey,
      financialKey: toText(options && options.baselineKey, requestedStageKey),
      comparisonKey: requestedStageKey === 'quotation' ? 'fixed' : 'quotation',
      mode: requestedStageKey === 'fixed' ? 'baseline' : 'delta',
      hasComparison: true,
      usesDelta: requestedStageKey !== 'fixed' && requestedStageKey !== 'quotation',
    };
  }

  function formatValue(valueKey, rollup, context) {
    switch (valueKey) {
      case 'projectCode': return toText(context.projectCode, '');
      case 'projectName': return toText(context.projectName, '');
      case 'customer': return toText(context.customer, '');
      case 'stageKey': return toText(context.stageKey, '');
      case 'baselineKey': return toText(context.baselineKey, '');
      case 'lifecycleYears': return numberOr(context.lifecycleYears, 0);
      case 'revenuePerSet': return numberOr(rollup && rollup.perSet && rollup.perSet.revenue, 0);
      case 'costPerSet': return numberOr(rollup && rollup.perSet && rollup.perSet.cost, 0);
      case 'profitPerSet': return numberOr(rollup && rollup.perSet && rollup.perSet.profit, 0);
      case 'margin': return numberOr(rollup && rollup.perSet && rollup.perSet.margin, 0);
      case 'materialPerSet': return numberOr(rollup && rollup.perSet && rollup.perSet.material, 0);
      case 'directLaborPerSet': return numberOr(rollup && rollup.perSet && rollup.perSet.directLabor, 0);
      case 'packagingPerSet': return numberOr(rollup && rollup.perSet && rollup.perSet.packaging, 0);
      case 'lifecycleRevenue': return numberOr(rollup && rollup.lifecycleSummary && rollup.lifecycleSummary.revenue, 0);
      case 'lifecycleCost': return numberOr(rollup && rollup.lifecycleSummary && rollup.lifecycleSummary.cost, 0);
      case 'lifecycleProfit': return numberOr(rollup && rollup.lifecycleSummary && rollup.lifecycleSummary.profit, 0);
      default: return context[valueKey];
    }
  }

  function build(runtimeInput, templateKey, stageKey, options) {
    const runtime = resolveRuntime(runtimeInput);
    const safeOptions = options || {};
    const activeConfig = resolveConfig(safeOptions.config);
    const stageMeta = resolveStageMeta(runtimeInput, stageKey, Object.assign({}, safeOptions, { config: activeConfig }));
    const requestedStageKey = resolveStageKey(stageMeta && stageMeta.stageKey, activeConfig, 'quotation');
    const baselineKey = toText(
      safeOptions.baselineKey,
      toText(stageMeta && stageMeta.financialKey, requestedStageKey || 'quotation')
    );
    const resolvedTemplateKey = toText(templateKey, defaultTemplateKey(activeConfig));
    const template = resolveTemplate(activeConfig, resolvedTemplateKey, requestedStageKey);
    const rollup = resolveRollup(runtime, baselineKey, safeOptions);
    const projectCode = toText(
      activeConfig && (activeConfig.projectCode || activeConfig.projectId),
      runtime && runtime.master && (runtime.master.projectCode || runtime.master.projectId)
    );
    const projectName = toText(activeConfig && activeConfig.projectName, runtime && runtime.master && runtime.master.name);
    const lifecycleYears = safeArray(rollup && rollup.lifecycle).length;
    const context = {
      projectCode,
      projectName,
      customer: toText(activeConfig && activeConfig.customer, runtime && runtime.master && runtime.master.customer),
      stageKey: resolveStageLabel(template, requestedStageKey, activeConfig),
      baselineKey,
      lifecycleYears,
    };
    const templateCells = safeArray(template && template.cells).length
      ? safeArray(template.cells)
      : DEFAULT_TEMPLATE_CELLS;
    const fields = templateCells.map((entry) => ({
      cellKey: toText(entry.cellKey, ''),
      label: toText(entry.label, entry.cellKey),
      valueKey: toText(entry.valueKey, ''),
      value: formatValue(toText(entry.valueKey, ''), rollup, context),
    }));

    return {
      status: 'ready',
      templateKey: toText(template && (template.key || template.id), resolvedTemplateKey || DEFAULT_TEMPLATE_KEY),
      templateId: toText(template && template.id, resolvedTemplateKey || DEFAULT_TEMPLATE_KEY),
      label: toText(template && (template.name || template.label), 'Customer quote template'),
      stageKey: requestedStageKey,
      baselineKey,
      context,
      fields,
      exportSeed: fields.reduce((accumulator, field) => {
        accumulator[field.cellKey] = field.value;
        return accumulator;
      }, {}),
    };
  }

  function buildPreview(options) {
    const safeOptions = options || {};
    return build(
      safeOptions.runtime,
      safeOptions.templateKey,
      safeOptions.stageKey || safeOptions.baselineKey,
      safeOptions
    );
  }

  function renderPreview(container, preview, options) {
    if (!container) return;
    const result = preview && preview.fields ? preview : buildPreview(options);
    if (!result || result.status !== 'ready') {
      container.innerHTML = '<div class="template-preview-empty">No customer template data.</div>';
      return;
    }

    const rows = result.fields.map((field) => {
      const renderedValue = typeof field.value === 'number' && field.valueKey === 'margin'
        ? `${(field.value * 100).toFixed(2)}%`
        : field.value;
      return `<tr><th>${escapeHtml(field.cellKey)}</th><td>${escapeHtml(field.label)}</td><td>${escapeHtml(renderedValue)}</td></tr>`;
    }).join('');

    container.innerHTML = `
      <div style="margin-bottom:8px;font-size:12px;color:#9ca3af;">
        Template ${escapeHtml(result.label)} / baseline ${escapeHtml(result.baselineKey)}
      </div>
      <div style="overflow:auto;">
        <table style="width:100%;border-collapse:collapse;font-size:12px;">
          <thead><tr><th>Cell</th><th>Meaning</th><th>Value</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;
  }

  global.G281CustomerQuoteTemplateAdapter = {
    DEFAULT_GEELY_CELLS: DEFAULT_TEMPLATE_CELLS,
    DEFAULT_TEMPLATE_CELLS,
    build,
    buildPreview,
    renderPreview,
    resolveTemplate,
    listTemplates,
    resolveStageLabel,
  };
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this);
