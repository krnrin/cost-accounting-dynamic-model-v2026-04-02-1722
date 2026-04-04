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
  const DEFAULT_GEELY_CELLS = [
    { cellKey: 'A1', label: '项目号', valueKey: 'projectCode' },
    { cellKey: 'A2', label: '项目名称', valueKey: 'projectName' },
    { cellKey: 'B1', label: '阶段', valueKey: 'stageKey' },
    { cellKey: 'B2', label: '基线版本', valueKey: 'baselineKey' },
    { cellKey: 'C1', label: '单套收入', valueKey: 'revenuePerSet' },
    { cellKey: 'C2', label: '单套成本', valueKey: 'costPerSet' },
    { cellKey: 'C3', label: '毛利率', valueKey: 'margin' },
    { cellKey: 'D', label: '材料', valueKey: 'materialPerSet' },
    { cellKey: 'E', label: '直接人工', valueKey: 'directLaborPerSet' },
    { cellKey: 'F', label: '包装物流', valueKey: 'packagingPerSet' },
    { cellKey: 'G', label: '单套利润', valueKey: 'profitPerSet' },
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
      key: DEFAULT_TEMPLATE_KEY,
      label: 'Customer quote template',
      cells: DEFAULT_GEELY_CELLS,
    };
  }

  function resolveTemplate(config, templateKey) {
    const activeConfig = resolveConfig(config);
    const templates = listTemplates(activeConfig);
    if (!templates.length) return defaultTemplate();

    const configuredDefault = toText(
      activeConfig && (activeConfig.defaultCustomerTemplateKey || activeConfig.defaultCustomerTemplateId || activeConfig.defaultQuoteTemplateKey),
      DEFAULT_TEMPLATE_KEY
    );
    const requestedKey = toText(templateKey, configuredDefault || DEFAULT_TEMPLATE_KEY);

    return templates.find((template) => templateMatches(template, requestedKey))
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

  function resolveStageLabel(template, stageKey) {
    const mapping = template && typeof template.stageMapping === 'object' ? template.stageMapping : null;
    return toText(mapping && mapping[stageKey], stageKey);
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
    const activeConfig = resolveConfig(options && options.config);
    const template = resolveTemplate(activeConfig, templateKey || DEFAULT_TEMPLATE_KEY);
    const requestedStageKey = toText((options && options.stageKey) || stageKey, 'quote');
    const baselineKey = toText((options && options.baselineKey) || stageKey, requestedStageKey || 'quote');
    const rollup = resolveRollup(runtime, baselineKey, options || {});
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
      stageKey: resolveStageLabel(template, requestedStageKey),
      baselineKey,
      lifecycleYears,
    };
    const fields = safeArray(template && template.cells || DEFAULT_GEELY_CELLS).map((entry) => ({
      cellKey: toText(entry.cellKey, ''),
      label: toText(entry.label, entry.cellKey),
      valueKey: toText(entry.valueKey, ''),
      value: formatValue(toText(entry.valueKey, ''), rollup, context),
    }));

    return {
      status: 'ready',
      templateKey: toText(template && (template.key || template.id), templateKey || DEFAULT_TEMPLATE_KEY),
      templateId: toText(template && template.id, templateKey || DEFAULT_TEMPLATE_KEY),
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
    DEFAULT_GEELY_CELLS,
    build,
    buildPreview,
    renderPreview,
    resolveTemplate,
    listTemplates,
  };
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this);
