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

  const DEFAULT_TEMPLATE_KEY = 'geely';
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

  function resolveRuntime(runtimeInput) {
    if (runtimeInput && runtimeInput.master) return runtimeInput;
    if (runtimeInput && typeof runtimeInput.getRuntime === 'function') return runtimeInput.getRuntime() || {};
    return global.G281_RUNTIME || {};
  }

  function resolveConfig() {
    return global.ConfigLoader && typeof global.ConfigLoader.active === 'function'
      ? global.ConfigLoader.active()
      : null;
  }

  function templateSpec(templateKey, config) {
    const templates = config && config.customerTemplates ? config.customerTemplates : {};
    if (Array.isArray(templates)) {
      const match = templates.find((template) => toText(template && (template.key || template.id), '') === templateKey);
      if (match && Array.isArray(match.cells)) return match;
    } else {
      if (templates[templateKey]) return templates[templateKey];
      if (templates[DEFAULT_TEMPLATE_KEY]) return templates[DEFAULT_TEMPLATE_KEY];
    }
    return {
      key: DEFAULT_TEMPLATE_KEY,
      label: 'Geely quote template',
      cells: DEFAULT_GEELY_CELLS,
    };
  }

  function resolveRollup(runtimeInput, stageKey, options) {
    if (options && options.projectRollup) return options.projectRollup;
    return global.G281ProjectRollupBuilder
      ? global.G281ProjectRollupBuilder.build(resolveRuntime(runtimeInput), null, { baselineKey: stageKey || 'quote' })
      : null;
  }

  function formatValue(valueKey, rollup, context) {
    switch (valueKey) {
      case 'projectCode': return toText(context.projectCode, '');
      case 'projectName': return toText(context.projectName, '');
      case 'stageKey': return toText(context.stageKey, '');
      case 'baselineKey': return toText(context.baselineKey, '');
      case 'revenuePerSet': return numberOr(rollup && rollup.perSet && rollup.perSet.revenue, 0);
      case 'costPerSet': return numberOr(rollup && rollup.perSet && rollup.perSet.cost, 0);
      case 'profitPerSet': return numberOr(rollup && rollup.perSet && rollup.perSet.profit, 0);
      case 'margin': return numberOr(rollup && rollup.perSet && rollup.perSet.margin, 0);
      case 'materialPerSet': return numberOr(rollup && rollup.perSet && rollup.perSet.material, 0);
      case 'directLaborPerSet': return numberOr(rollup && rollup.perSet && rollup.perSet.directLabor, 0);
      case 'packagingPerSet': return numberOr(rollup && rollup.perSet && rollup.perSet.packaging, 0);
      default: return context[valueKey];
    }
  }

  function build(runtimeInput, templateKey, stageKey, options) {
    const runtime = resolveRuntime(runtimeInput);
    const config = resolveConfig();
    const effectiveTemplate = templateSpec(templateKey || DEFAULT_TEMPLATE_KEY, config);
    const effectiveStageKey = stageKey || (options && options.stageKey) || 'quote';
    const rollup = resolveRollup(runtime, effectiveStageKey, options || {});
    const projectCode = toText(config && (config.projectCode || config.projectId), runtime && runtime.master && (runtime.master.projectCode || runtime.master.projectId));
    const projectName = toText(config && config.projectName, runtime && runtime.master && runtime.master.name);
    const context = {
      projectCode,
      projectName,
      stageKey: effectiveStageKey,
      baselineKey: effectiveStageKey,
    };
    const fields = safeArray(effectiveTemplate.cells || DEFAULT_GEELY_CELLS).map((entry) => {
      return {
        cellKey: toText(entry.cellKey, ''),
        label: toText(entry.label, entry.cellKey),
        valueKey: toText(entry.valueKey, ''),
        value: formatValue(toText(entry.valueKey, ''), rollup, context),
      };
    });

    return {
      status: 'ready',
      templateKey: toText(effectiveTemplate.key, templateKey || DEFAULT_TEMPLATE_KEY),
      label: toText(effectiveTemplate.label, 'Customer quote template'),
      stageKey: effectiveStageKey,
      context,
      fields,
      exportSeed: fields.reduce((accumulator, field) => {
        accumulator[field.cellKey] = field.value;
        return accumulator;
      }, {}),
    };
  }

  function renderPreview(container, preview, options) {
    if (!container) return;
    const result = preview && preview.fields ? preview : build(options && options.runtime, options && options.templateKey, options && options.stageKey, options);
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
        Template ${escapeHtml(result.label)} / stage ${escapeHtml(result.stageKey)}
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
    renderPreview,
  };
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this);
