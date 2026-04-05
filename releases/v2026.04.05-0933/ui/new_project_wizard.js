;(function (root) {
  'use strict';

  var DEFAULTS = {
    mountId: 'newProjectWizardRoot',
    baseConfigPath: '',
    redirectTo: 'preview.html',
  };

  var STEPS = [
    { id: 1, title: '基础信息', desc: '项目编号、名称、客户、生命周期与年度产量。' },
    { id: 2, title: '线束与配置', desc: '维护线束清单和车型配置映射。' },
    { id: 3, title: '确认创建', desc: '预览 JSON 并执行项目创建。' },
  ];

  var state = {
    step: 1,
    mountId: DEFAULTS.mountId,
    redirectTo: DEFAULTS.redirectTo,
    template: null,
    baseLoadError: '',
    message: null,
    submitting: false,
    form: null,
  };

  function text(value, fallback) {
    var output = String(value == null ? '' : value).trim();
    return output || (fallback || '');
  }

  function numberOf(value, fallback) {
    var numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : fallback;
  }

  function clonePlain(value, fallback) {
    try {
      return JSON.parse(JSON.stringify(value));
    } catch (error) {
      return fallback;
    }
  }

  function resolveDefaultTemplateKey(config) {
    if (root.ConfigLoader && typeof root.ConfigLoader.defaultCustomerTemplateKey === 'function') {
      return text(root.ConfigLoader.defaultCustomerTemplateKey(config), '');
    }
    return text(config && config.defaultCustomerTemplateKey, '');
  }

  function resolveBaseConfigPath(path) {
    if (text(path, '')) return text(path, '');
    if (root.G281ProjectBootstrap && typeof root.G281ProjectBootstrap.defaultConfigPath === 'function') {
      return text(root.G281ProjectBootstrap.defaultConfigPath(), '');
    }
    if (root.ConfigLoader && typeof root.ConfigLoader.defaultConfigPath === 'function') {
      return text(root.ConfigLoader.defaultConfigPath(), '');
    }
    return '';
  }

  function toProjectId(value) {
    return text(value).replace(/[^A-Za-z0-9_-]+/g, '').toUpperCase();
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function uid(prefix) {
    return prefix + '-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7);
  }

  function harnessRow(seed) {
    var input = seed || {};
    return {
      uid: input.uid || uid('h'),
      id: toProjectId(input.id),
      name: text(input.name),
      partNumber: text(input.partNumber),
      unit: text(input.unit, 'set'),
    };
  }

  function configRow(seed) {
    var input = seed || {};
    return {
      uid: input.uid || uid('c'),
      name: text(input.name),
      ratioPercent: numberOf(input.ratioPercent, 0),
      harnessText: text(input.harnessText),
    };
  }

  function buildAnnualVolumes(startYear, years, existing) {
    var safeStartYear = Math.max(2000, Math.round(numberOf(startYear, new Date().getFullYear())));
    var safeYears = Math.max(1, Math.round(numberOf(years, 1)));
    var previous = Array.isArray(existing) ? existing : [];
    var rows = [];
    for (var index = 0; index < safeYears; index += 1) {
      var year = safeStartYear + index;
      var hit = previous[index] || previous.find(function (row) {
        return numberOf(row && row.year, NaN) === year;
      });
      rows.push({
        year: year,
        volume: Math.max(0, Math.round(numberOf(hit && hit.volume, 0))),
      });
    }
    return rows;
  }

  function parseHarnessIds(value) {
    return text(value)
      .split(/[ ,\n，、;；]+/)
      .map(toProjectId)
      .filter(Boolean);
  }

  function emptyForm() {
    var currentYear = new Date().getFullYear();
    return {
      projectId: '',
      projectName: '',
      customer: '',
      startYear: currentYear,
      years: 6,
      annualVolumes: buildAnnualVolumes(currentYear, 6, []),
      harnessPaste: '',
      harnesses: [harnessRow({ id: 'H1', name: '线束 1' })],
      vehicleConfigs: [configRow({ name: '配置 1', ratioPercent: 100, harnessText: 'H1' })],
    };
  }

  function fallbackTemplate() {
    var currentYear = new Date().getFullYear();
    return {
      $schema: './project-config.schema.md',
      projectId: 'TEMPLATE',
      projectCode: 'TEMPLATE',
      projectName: '模板项目',
      customer: '',
      defaultCustomerTemplateKey: resolveDefaultTemplateKey(null),
      baseline: {
        version: 1,
        lifecycle: { startYear: currentYear, years: 6 },
        annualVolumes: buildAnnualVolumes(currentYear, 6, []),
        vehicleConfigs: [],
      },
      harnesses: [],
      dimensions: {
        currency: 'CNY',
        currencySymbol: '¥',
        lengthUnit: 'mm',
        weightUnit: 'g',
        volumeUnit: 'set',
        priceDecimalPlaces: 4,
        ratioDecimalPlaces: 2,
      },
      materialComposition: { connector: 0.24, copper: 0.38, aluminum: 0.18, other: 0.20 },
      metalSensitivity: { copper: 0.65, aluminum: 0.45 },
      stateDefaults: {},
      customerTemplates: [],
      stageDefinitions: [],
      lifecycleStages: [],
      workflowNodes: [],
      allocationProfiles: [],
      workbookRoles: [],
      sheetMappings: [],
      financialWorkbook: {},
      bom: {},
      costElements: [],
      nreCostTypes: [],
      changeHistory: [],
    };
  }

  function sanitizeTemplate(template) {
    var raw = clonePlain(template, fallbackTemplate()) || fallbackTemplate();
    var base = fallbackTemplate();
    var lifecycle = raw.baseline && raw.baseline.lifecycle ? raw.baseline.lifecycle : {};
    var startYear = Math.max(2000, Math.round(numberOf(lifecycle.startYear, base.baseline.lifecycle.startYear)));
    var years = Math.max(1, Math.round(numberOf(lifecycle.years, base.baseline.lifecycle.years)));
    raw.baseline = raw.baseline || {};
    raw.baseline.lifecycle = { startYear: startYear, years: years };
    raw.baseline.annualVolumes = buildAnnualVolumes(startYear, years, raw.baseline.annualVolumes);
    raw.baseline.vehicleConfigs = [];
    raw.harnesses = [];
    raw.customer = '';
    raw.projectId = 'TEMPLATE';
    raw.projectCode = 'TEMPLATE';
    raw.projectName = '模板项目';
    raw.changeHistory = [];
    return Object.assign({}, base, raw);
  }

  function seedForm(template) {
    var base = sanitizeTemplate(template);
    var lifecycle = base.baseline.lifecycle || {};
    state.form = {
      projectId: '',
      projectName: '',
      customer: text(base.customer),
      startYear: numberOf(lifecycle.startYear, new Date().getFullYear()),
      years: Math.max(1, Math.round(numberOf(lifecycle.years, 6))),
      annualVolumes: buildAnnualVolumes(lifecycle.startYear, lifecycle.years, base.baseline.annualVolumes),
      harnessPaste: '',
      harnesses: [harnessRow({ id: 'H1', name: '线束 1' })],
      vehicleConfigs: [configRow({ name: '配置 1', ratioPercent: 100, harnessText: 'H1' })],
    };
  }

  function parseHarnessPaste(raw) {
    return text(raw).split(/\r?\n/).map(function (line) {
      var cells = line.split(/\t|,|，/).map(function (cell) { return cell.trim(); }).filter(Boolean);
      return harnessRow({
        id: cells[0],
        name: cells[1],
        partNumber: cells[2],
        unit: cells[3] || 'set',
      });
    }).filter(function (row) {
      return row.id;
    });
  }

  function validateForm(form) {
    var errors = [];
    var warnings = [];
    var projectId = toProjectId(form.projectId);
    var harnesses = (form.harnesses || []).map(harnessRow).filter(function (row) { return row.id || row.name; });
    var configs = (form.vehicleConfigs || []).map(function (row, index) {
      return {
        name: text(row.name, '配置 ' + (index + 1)),
        ratioPercent: Math.max(0, numberOf(row.ratioPercent, 0)),
        harnessIds: parseHarnessIds(row.harnessText),
      };
    }).filter(function (row) {
      return row.name || row.ratioPercent || row.harnessIds.length;
    });
    var harnessMap = {};
    harnesses.forEach(function (row) {
      if (row.id) harnessMap[row.id] = (harnessMap[row.id] || 0) + 1;
    });

    if (!projectId) errors.push('项目编号不能为空。');
    if (!text(form.projectName)) errors.push('项目名称不能为空。');
    if (!harnesses.length) errors.push('至少需要 1 条线束。');
    if (!configs.length) errors.push('至少需要 1 条车型配置。');
    if (!Array.isArray(form.annualVolumes) || form.annualVolumes.length !== Math.max(1, Math.round(numberOf(form.years, 1)))) {
      errors.push('年度产量行数与生命周期年数不一致。');
    }
    Object.keys(harnessMap).forEach(function (key) {
      if (harnessMap[key] > 1) errors.push('线束号重复：' + key);
    });

    var ratioSum = 0;
    var referenced = {};
    var unknown = {};
    configs.forEach(function (row) {
      ratioSum += row.ratioPercent;
      if (!row.harnessIds.length) warnings.push('车型配置 "' + row.name + '" 尚未绑定线束。');
      row.harnessIds.forEach(function (harnessId) {
        referenced[harnessId] = true;
        if (!harnessMap[harnessId]) unknown[harnessId] = true;
      });
    });

    if (Math.abs(ratioSum - 100) > 0.05) {
      errors.push('车型配置占比合计必须为 100%，当前为 ' + ratioSum.toFixed(2) + '%。');
    }
    Object.keys(unknown).forEach(function (key) {
      errors.push('车型配置引用了不存在的线束号：' + key);
    });

    var registry = root.G281ProjectRegistry;
    if (projectId && registry && typeof registry.getProject === 'function' && registry.getProject(projectId)) {
      errors.push('项目编号 ' + projectId + ' 已存在。');
    }

    return {
      errors: errors,
      warnings: warnings,
      stats: {
        harnessCount: harnesses.length,
        configCount: configs.length,
        ratioPercentText: ratioSum.toFixed(2) + '%',
        unusedHarnessCount: Object.keys(harnessMap).filter(function (key) { return !referenced[key]; }).length,
      },
    };
  }

  function buildProjectConfig(form, template, preview) {
    var base = sanitizeTemplate(template);
    var projectId = toProjectId(form.projectId);
    var now = new Date().toISOString();
    return Object.assign({}, base, {
      projectId: projectId,
      projectCode: projectId,
      projectName: text(form.projectName),
      customer: text(form.customer),
      createdAt: preview ? null : now,
      storageKeyPrefix: projectId.toLowerCase(),
      globalNamespacePrefix: projectId,
      changeHistory: [],
      baseline: {
        version: numberOf(base.baseline && base.baseline.version, 1),
        lockedAt: preview ? null : now,
        lifecycle: {
          startYear: Math.round(numberOf(form.startYear, new Date().getFullYear())),
          years: Math.max(1, Math.round(numberOf(form.years, 1))),
        },
        annualVolumes: buildAnnualVolumes(form.startYear, form.years, form.annualVolumes),
        vehicleConfigs: (form.vehicleConfigs || []).map(function (row, index) {
          return {
            name: text(row.name, '配置 ' + (index + 1)),
            ratio: Number((Math.max(0, numberOf(row.ratioPercent, 0)) / 100).toFixed(6)),
            harnesses: parseHarnessIds(row.harnessText),
          };
        }).filter(function (row) { return row.name; }),
      },
      harnesses: (form.harnesses || []).map(function (row) {
        return {
          id: toProjectId(row.id),
          name: text(row.name),
          partNumber: text(row.partNumber),
          unit: text(row.unit, 'set'),
        };
      }).filter(function (row) { return row.id; }),
    });
  }

  function renderField(label, name, value, help, type, readonly) {
    return '<div class="wizard-field"><label for="' + escapeHtml(name) + '">' + escapeHtml(label) + '</label>'
      + '<input id="' + escapeHtml(name) + '" data-field="' + escapeHtml(name) + '" type="' + escapeHtml(type || 'text') + '" value="' + escapeHtml(String(value == null ? '' : value)) + '"' + (readonly ? ' readonly' : '') + '>'
      + '<div class="wizard-field__help">' + escapeHtml(help || '') + '</div></div>';
  }

  function renderStepContent(validation, previewConfig) {
    if (state.step === 1) {
      return '<div class="wizard-grid wizard-grid--basic">'
        + renderField('项目编号', 'projectId', state.form.projectId, '例如 G281、E281B。会同时写入 projectCode。')
        + renderField('项目名称', 'projectName', state.form.projectName, '建议包含车型或项目阶段。')
        + renderField('客户', 'customer', state.form.customer, '例如 吉利、比亚迪、上汽。')
        + renderField('生命周期起始年', 'startYear', state.form.startYear, '会同步生成年度产量年份列。', 'number')
        + renderField('生命周期年数', 'years', state.form.years, '修改后会自动重建年度产量行。', 'number')
        + renderField('配置存储前缀', 'storagePreview', toProjectId(state.form.projectId).toLowerCase() || 'project', '创建后写入 storageKeyPrefix。', 'text', true)
        + '</div><section class="wizard-card"><h3>年度产量</h3><p class="wizard-card__hint">年份按生命周期自动生成，只维护各年产量。</p><table class="wizard-table"><thead><tr><th>年份</th><th>年产量</th></tr></thead><tbody>'
        + state.form.annualVolumes.map(function (row, index) {
          return '<tr><td><input type="number" data-annual-year="' + index + '" value="' + escapeHtml(String(row.year)) + '" readonly></td>'
            + '<td><input type="number" min="0" step="1" data-annual-volume="' + index + '" value="' + escapeHtml(String(row.volume)) + '"></td></tr>';
        }).join('')
        + '</tbody></table></section>';
    }

    if (state.step === 2) {
      return '<div class="wizard-grid wizard-grid--double"><section class="wizard-card"><h3>线束清单</h3><p class="wizard-card__hint">至少保留 1 条线束。支持手工维护或批量粘贴导入。</p><table class="wizard-table"><thead><tr><th>线束号</th><th>线束名称</th><th>料号</th><th>单位</th><th class="wizard-table__actions">操作</th></tr></thead><tbody>'
        + state.form.harnesses.map(function (row) {
          return '<tr><td><input type="text" data-harness-id="' + escapeHtml(row.uid) + '" value="' + escapeHtml(row.id) + '"></td>'
            + '<td><input type="text" data-harness-name="' + escapeHtml(row.uid) + '" value="' + escapeHtml(row.name) + '"></td>'
            + '<td><input type="text" data-harness-part="' + escapeHtml(row.uid) + '" value="' + escapeHtml(row.partNumber) + '"></td>'
            + '<td><input type="text" data-harness-unit="' + escapeHtml(row.uid) + '" value="' + escapeHtml(row.unit) + '"></td>'
            + '<td><button type="button" class="wizard-button wizard-button--danger" data-remove-harness="' + escapeHtml(row.uid) + '">删除</button></td></tr>';
        }).join('')
        + '</tbody></table><div class="wizard-inline" style="margin-top:12px;"><button type="button" class="wizard-button" data-action="add-harness-row">新增线束</button></div><div class="wizard-field" style="margin-top:12px;"><label for="harnessPaste">批量粘贴</label><textarea id="harnessPaste" data-field="harnessPaste" placeholder="每行: 线束号, 名称, 料号">'
        + escapeHtml(state.form.harnessPaste) + '</textarea><div class="wizard-inline"><button type="button" class="wizard-button" data-action="apply-harness-paste">导入粘贴内容</button></div></div></section>'
        + '<section class="wizard-card"><h3>车型配置</h3><p class="wizard-card__hint">占比合计必须为 100%，线束引用必须存在。</p><table class="wizard-table"><thead><tr><th>配置名称</th><th>占比 %</th><th>线束号列表</th><th class="wizard-table__actions">操作</th></tr></thead><tbody>'
        + state.form.vehicleConfigs.map(function (row) {
          return '<tr><td><input type="text" data-config-name="' + escapeHtml(row.uid) + '" value="' + escapeHtml(row.name) + '"></td>'
            + '<td><input type="number" min="0" max="100" step="0.01" data-config-ratio="' + escapeHtml(row.uid) + '" value="' + escapeHtml(String(row.ratioPercent)) + '"></td>'
            + '<td><textarea data-config-harnesses="' + escapeHtml(row.uid) + '">' + escapeHtml(row.harnessText) + '</textarea></td>'
            + '<td><button type="button" class="wizard-button wizard-button--danger" data-remove-config="' + escapeHtml(row.uid) + '">删除</button></td></tr>';
        }).join('')
        + '</tbody></table><div class="wizard-inline" style="margin-top:12px;"><button type="button" class="wizard-button" data-action="add-config-row">新增配置</button></div></section></div>'
        + '<section class="wizard-card"><h3>实时校验</h3><div class="wizard-kpi-grid"><div class="wizard-kpi"><div class="wizard-kpi__label">线束数</div><div class="wizard-kpi__value">' + validation.stats.harnessCount + '</div></div><div class="wizard-kpi"><div class="wizard-kpi__label">配置数</div><div class="wizard-kpi__value">' + validation.stats.configCount + '</div></div><div class="wizard-kpi"><div class="wizard-kpi__label">占比合计</div><div class="wizard-kpi__value">' + escapeHtml(validation.stats.ratioPercentText) + '</div></div><div class="wizard-kpi"><div class="wizard-kpi__label">未引用线束</div><div class="wizard-kpi__value">' + validation.stats.unusedHarnessCount + '</div></div></div></section>';
    }

    return '<div class="wizard-preview"><section class="wizard-card"><h3>JSON 预览</h3><p class="wizard-card__hint">以下内容会写入本地项目配置与项目注册表。</p><pre class="wizard-preview__json">'
      + escapeHtml(JSON.stringify(previewConfig, null, 2))
      + '</pre></section><aside class="wizard-summary"><section class="wizard-summary__card"><h4>项目摘要</h4><div class="wizard-summary__list"><div class="wizard-summary__item"><span>projectId</span><strong>'
      + escapeHtml(previewConfig.projectId || '--')
      + '</strong></div><div class="wizard-summary__item"><span>projectName</span><strong>'
      + escapeHtml(previewConfig.projectName || '--')
      + '</strong></div><div class="wizard-summary__item"><span>customer</span><strong>'
      + escapeHtml(previewConfig.customer || '--')
      + '</strong></div><div class="wizard-summary__item"><span>线束数</span><strong>'
      + previewConfig.harnesses.length
      + '</strong></div><div class="wizard-summary__item"><span>配置数</span><strong>'
      + previewConfig.baseline.vehicleConfigs.length
      + '</strong></div></div></section><section class="wizard-summary__card"><h4>年度产量</h4><div class="wizard-pill-row">'
      + previewConfig.baseline.annualVolumes.map(function (row) {
        return '<span class="wizard-pill">' + escapeHtml(String(row.year)) + ': ' + escapeHtml(String(row.volume)) + '</span>';
      }).join('')
      + '</div></section></aside></div>';
  }

  function renderIssues(validation) {
    var html = [];
    if (validation.errors.length) {
      html.push('<section class="wizard-card"><h3>阻断项</h3><ul class="wizard-list">' + validation.errors.map(function (item) {
        return '<li>' + escapeHtml(item) + '</li>';
      }).join('') + '</ul></section>');
    }
    if (validation.warnings.length) {
      html.push('<section class="wizard-card"><h3>提示项</h3><ul class="wizard-list">' + validation.warnings.map(function (item) {
        return '<li>' + escapeHtml(item) + '</li>';
      }).join('') + '</ul></section>');
    }
    return html.join('');
  }

  function render() {
    var mount = root.document.getElementById(state.mountId || DEFAULTS.mountId);
    if (!mount) return;
    var validation = validateForm(state.form || emptyForm());
    var previewConfig = buildProjectConfig(state.form || emptyForm(), state.template, true);
    var step = STEPS[state.step - 1];
    var notices = [];
    if (state.message && state.message.text) {
      notices.push('<div class="wizard-alert wizard-alert--' + escapeHtml(state.message.type || 'info') + '">' + escapeHtml(state.message.text) + '</div>');
    }
    if (state.baseLoadError) {
      notices.push('<div class="wizard-alert wizard-alert--warning">模板加载失败，当前使用兜底模板。详情: ' + escapeHtml(state.baseLoadError) + '</div>');
    }
    if (validation.errors.length) {
      notices.push('<div class="wizard-alert wizard-alert--error">' + escapeHtml(validation.errors[0]) + '</div>');
    }
    mount.innerHTML = '<section class="project-wizard">'
      + (notices.length ? '<div class="project-wizard__status">' + notices.join('') + '</div>' : '')
      + '<div class="project-wizard__shell"><aside class="project-wizard__rail"><h3 class="project-wizard__rail-title">创建向导</h3><p class="project-wizard__rail-subtitle">完成 projectConfig 生成、项目创建、活动项目切换和独立项目库初始化。</p><div class="project-wizard__steps">'
      + STEPS.map(function (item) {
        var classes = ['project-wizard__step'];
        if (item.id === state.step) classes.push('is-active');
        if (item.id < state.step) classes.push('is-complete');
        return '<div class="' + classes.join(' ') + '"><span class="project-wizard__step-index">' + item.id + '</span><div class="project-wizard__step-title">' + escapeHtml(item.title) + '</div><p class="project-wizard__step-desc">' + escapeHtml(item.desc) + '</p></div>';
      }).join('')
      + '</div></aside><section class="project-wizard__panel"><header class="project-wizard__header"><div><h2>' + escapeHtml(step.title) + '</h2><p>' + escapeHtml(step.desc) + '</p></div><span class="project-wizard__tag">Step ' + step.id + ' / ' + STEPS.length + '</span></header>'
      + renderStepContent(validation, previewConfig)
      + renderIssues(validation)
      + '<footer class="project-wizard__footer"><div class="project-wizard__footer-note">创建动作会先初始化项目库，再执行 registerNewProject / switchProject，并跳转到预演页。</div><div class="wizard-inline"><button type="button" class="wizard-button" data-action="prev-step"' + (state.step > 1 ? '' : ' disabled') + '>上一步</button><button type="button" class="wizard-button" data-action="next-step"' + (state.step < 3 ? '' : ' disabled') + '>下一步</button><button type="button" class="wizard-button wizard-button--primary" data-action="create-project"' + (state.step === 3 && !validation.errors.length && !state.submitting ? '' : ' disabled') + '>' + (state.submitting ? '创建中...' : '创建项目') + '</button></div></footer></section></div></section>';
    bind();
  }

  function findHarnessRow(attr, value) {
    return state.form.harnesses.find(function (row) { return row[attr] === value; }) || state.form.harnesses[0];
  }

  function findConfigRow(attr, value) {
    return state.form.vehicleConfigs.find(function (row) { return row[attr] === value; }) || state.form.vehicleConfigs[0];
  }

  function bindInputs(selector, handler) {
    root.document.querySelectorAll(selector).forEach(function (node) {
      node.addEventListener('input', function () {
        handler(node);
        render();
      });
    });
  }

  function bind() {
    bindInputs('[data-field]', function (node) {
      var field = node.getAttribute('data-field');
      if (field === 'startYear') {
        state.form.startYear = Math.round(numberOf(node.value, state.form.startYear));
        state.form.annualVolumes = buildAnnualVolumes(state.form.startYear, state.form.years, state.form.annualVolumes);
      } else if (field === 'years') {
        state.form.years = Math.max(1, Math.round(numberOf(node.value, state.form.years)));
        state.form.annualVolumes = buildAnnualVolumes(state.form.startYear, state.form.years, state.form.annualVolumes);
      } else {
        state.form[field] = node.value;
      }
    });

    var projectIdInput = root.document.getElementById('projectId');
    if (projectIdInput) {
      projectIdInput.addEventListener('blur', function () {
        state.form.projectId = toProjectId(projectIdInput.value);
        root.setTimeout(render, 0);
      });
    }

    bindInputs('[data-annual-volume]', function (node) {
      var index = Number(node.getAttribute('data-annual-volume'));
      if (state.form.annualVolumes[index]) state.form.annualVolumes[index].volume = Math.max(0, Math.round(numberOf(node.value, 0)));
    });
    bindInputs('[data-harness-id]', function (node) { findHarnessRow('uid', node.getAttribute('data-harness-id')).id = toProjectId(node.value); });
    bindInputs('[data-harness-name]', function (node) { findHarnessRow('uid', node.getAttribute('data-harness-name')).name = node.value; });
    bindInputs('[data-harness-part]', function (node) { findHarnessRow('uid', node.getAttribute('data-harness-part')).partNumber = node.value; });
    bindInputs('[data-harness-unit]', function (node) { findHarnessRow('uid', node.getAttribute('data-harness-unit')).unit = text(node.value, 'set'); });
    bindInputs('[data-config-name]', function (node) { findConfigRow('uid', node.getAttribute('data-config-name')).name = node.value; });
    bindInputs('[data-config-ratio]', function (node) { findConfigRow('uid', node.getAttribute('data-config-ratio')).ratioPercent = Math.max(0, numberOf(node.value, 0)); });
    bindInputs('[data-config-harnesses]', function (node) { findConfigRow('uid', node.getAttribute('data-config-harnesses')).harnessText = node.value; });

    root.document.querySelectorAll('[data-remove-harness]').forEach(function (node) {
      node.addEventListener('click', function () {
        var key = node.getAttribute('data-remove-harness');
        state.form.harnesses = state.form.harnesses.filter(function (row) { return row.uid !== key; });
        if (!state.form.harnesses.length) state.form.harnesses = [harnessRow({ id: 'H1', name: '线束 1' })];
        render();
      });
    });

    root.document.querySelectorAll('[data-remove-config]').forEach(function (node) {
      node.addEventListener('click', function () {
        var key = node.getAttribute('data-remove-config');
        state.form.vehicleConfigs = state.form.vehicleConfigs.filter(function (row) { return row.uid !== key; });
        if (!state.form.vehicleConfigs.length) state.form.vehicleConfigs = [configRow({ name: '配置 1', ratioPercent: 100, harnessText: 'H1' })];
        render();
      });
    });

    root.document.querySelectorAll('[data-action]').forEach(function (node) {
      node.addEventListener('click', function () {
        handleAction(node.getAttribute('data-action'));
      });
    });
  }

  function resolveRedirectTarget(target) {
    var normalized = text(target, DEFAULTS.redirectTo).replace(/^\.?\//, '').replace(/^pages\//, '');
    return String(root.location && root.location.pathname || '').indexOf('/pages/') !== -1 ? normalized : 'pages/' + normalized;
  }

  function handleAction(action) {
    if (action === 'prev-step' && state.step > 1) {
      state.step -= 1;
      render();
      return;
    }
    if (action === 'next-step' && state.step < 3) {
      state.step += 1;
      render();
      return;
    }
    if (action === 'add-harness-row') {
      state.form.harnesses = state.form.harnesses.concat([harnessRow({})]);
      render();
      return;
    }
    if (action === 'add-config-row') {
      state.form.vehicleConfigs = state.form.vehicleConfigs.concat([configRow({ name: '配置 ' + (state.form.vehicleConfigs.length + 1) })]);
      render();
      return;
    }
    if (action === 'apply-harness-paste') {
      var rows = parseHarnessPaste(state.form.harnessPaste);
      if (!rows.length) {
        state.message = { type: 'warning', text: '粘贴区没有解析出有效线束，请至少提供线束号。' };
      } else {
        var map = {};
        state.form.harnesses.forEach(function (row) { if (row.id) map[row.id] = harnessRow(row); });
        rows.forEach(function (row) { map[row.id] = map[row.id] || harnessRow(row); });
        state.form.harnesses = Object.keys(map).sort().map(function (key) { return map[key]; });
        state.message = { type: 'success', text: '已导入 ' + rows.length + ' 条线束记录。' };
      }
      render();
      return;
    }
    if (action === 'create-project') {
      createProject();
    }
  }

  async function createProject() {
    var validation = validateForm(state.form);
    if (validation.errors.length) {
      state.message = { type: 'error', text: validation.errors[0] };
      render();
      return;
    }

    var registry = root.G281ProjectRegistry;
    if (!registry || typeof registry.registerNewProject !== 'function' || typeof registry.switchProject !== 'function') {
      state.message = { type: 'error', text: 'ProjectRegistry 未就绪，缺少严格新建接口。' };
      render();
      return;
    }

    var config = buildProjectConfig(state.form, state.template, false);
    state.submitting = true;
    state.message = { type: 'info', text: '正在创建项目并初始化独立项目库。' };
    render();

    try {
      var registered = registry.registerNewProject(config.projectId, config);
      if (root.G281BomDb && typeof root.G281BomDb.init === 'function') {
        await root.G281BomDb.init({ dbName: registry.getDbName(registered.projectCode || registered.projectId) });
      }
      if (root.G281SchemaMigrator && typeof root.G281SchemaMigrator.runPending === 'function') {
        await root.G281SchemaMigrator.runPending(root.G281BomDb);
      }
      registry.switchProject(registered.projectCode || registered.projectId);

      state.submitting = false;
      state.message = { type: 'success', text: '项目创建完成，正在跳转到预演页。' };
      render();

      var nextState = {
        projectId: registered.projectId || registered.projectCode,
        projectCode: registered.projectCode || registered.projectId,
        baselineKey: 'quote',
        versionKey: 'quote',
        lifecycleStageKey: 'quote',
      };
      var target = resolveRedirectTarget(state.redirectTo);
      root.setTimeout(function () {
        if (root.G281PageRouter && typeof root.G281PageRouter.navigateTo === 'function') {
          root.G281PageRouter.navigateTo(target, nextState);
        } else {
          root.location.href = target + '?projectId=' + encodeURIComponent(nextState.projectId) + '&baselineKey=quote&versionKey=quote&lifecycleStageKey=quote';
        }
      }, 120);
    } catch (error) {
      state.submitting = false;
      state.message = { type: 'error', text: String(error && error.message ? error.message : error) };
      render();
    }
  }

  async function init(options) {
    var opts = Object.assign({}, DEFAULTS, options || {});
    state.mountId = opts.mountId;
    state.redirectTo = opts.redirectTo;
    state.step = 1;
    state.submitting = false;
    state.baseLoadError = '';
    state.message = { type: 'info', text: '正在读取默认项目模板。' };
    state.form = emptyForm();
    render();

    try {
      var baseConfigPath = resolveBaseConfigPath(opts.baseConfigPath);
      var loadJson = root.G281ProjectBootstrap && typeof root.G281ProjectBootstrap.loadJson === 'function'
        ? root.G281ProjectBootstrap.loadJson
        : function (path) { return fetch(path, { cache: 'no-store' }).then(function (response) { return response.json(); }); };
      state.template = await loadJson(baseConfigPath);
      seedForm(state.template);
      state.message = { type: 'success', text: '默认模板已加载，可以开始创建新项目。' };
    } catch (error) {
      state.baseLoadError = String(error && error.message ? error.message : error);
      state.template = fallbackTemplate();
      seedForm(state.template);
      state.message = { type: 'warning', text: '默认模板加载失败，当前使用兜底模板。' };
    }
    render();
  }

  root.G281NewProjectWizard = {
    init: init,
    validateForm: validateForm,
    buildProjectConfig: function (form) { return buildProjectConfig(form || state.form, state.template, false); },
    parseHarnessPaste: parseHarnessPaste,
  };
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this);
