(function (global) {
  'use strict';

  function txt(value, fallback) {
    var text = String(value == null ? '' : value).trim();
    if (text) return text;
    return String(fallback == null ? '' : fallback).trim();
  }

  function arr(value) {
    return Array.isArray(value) ? value : [];
  }

  function obj(value) {
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  }

  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (char) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char];
    });
  }

  function roleLabel(payload) {
    var current = txt(payload.currentRole, '');
    var match = arr(payload.roles).find(function (item) { return txt(item.roleCode || item.id, '') === current; });
    return txt(match && (match.roleLabel || match.roleName || match.role), current || 'sales');
  }

  function statusLabel(value) {
    var map = {
      not_started: '未开始',
      draft: '草稿',
      in_progress: '进行中',
      pending_review: '待评审',
      submitted: '待评审',
      approved: '已通过',
      returned: '已退回',
      rejected: '已退回',
      active: '执行中',
      closed: '已关闭',
    };
    return map[txt(value, '')] || txt(value, '未开始');
  }

  function creatorHtml(payload) {
    var draft = obj(payload.createDraft);
    var errors = arr(payload.errors);
    var currentType = txt(draft.quoteType || payload.quoteContext && payload.quoteContext.quoteType, 'project');
    var harnessList = arr(payload.availableHarnesses).map(function (item) {
      var harnessId = txt(item.harnessId || item.id, '');
      var harnessName = txt(item.harnessName || item.name, '');
      return '<option value="' + esc(harnessId) + '">' + esc(harnessId + (harnessName ? ' · ' + harnessName : '')) + '</option>';
    }).join('');
    return [
      '<section class="workflow-panel workflow-creator-panel">',
      '  <div class="workflow-panel-head">',
      '    <div>',
      '      <h4>工作流记录创建器</h4>',
      '      <p class="section-note">主记录固定为 单线束号 × 报价版本。变更报价必须绑定基线版本与影响模块。</p>',
      '    </div>',
      '    <div class="workflow-role-switch">',
      '      <label class="field quote-inline-field">',
      '        <span>当前角色</span>',
      '        <select data-qwf-role>',
      arr(payload.roles).map(function (role) {
        var code = txt(role.roleCode || role.id, '');
        return '<option value="' + esc(code) + '"' + (code === txt(payload.currentRole, '') ? ' selected' : '') + '>' + esc(txt(role.roleLabel || role.roleName || role.role, code)) + '</option>';
      }).join(''),
      '        </select>',
      '      </label>',
      '    </div>',
      '  </div>',
      errors.length ? ('<div class="workflow-inline-error">' + esc(errors.join('；')) + '</div>') : '',
      '  <div class="workflow-create-grid">',
      '    <label class="field"><span>报价版本</span><input type="text" data-qwf-draft="quoteVersionId" value="' + esc(txt(draft.quoteVersionId, '')) + '" placeholder="例如：v2026.04.01-1404" /></label>',
      '    <label class="field"><span>线束号</span><input type="text" list="workflowHarnessCandidates" data-qwf-draft="harnessId" value="' + esc(txt(draft.harnessId, '')) + '" placeholder="输入或选择线束号" /></label>',
      '    <label class="field"><span>线束名称</span><input type="text" data-qwf-draft="harnessName" value="' + esc(txt(draft.harnessName, '')) + '" placeholder="线束名称" /></label>',
      '    <label class="field"><span>场景名称</span><input type="text" data-qwf-draft="scenarioName" value="' + esc(txt(draft.scenarioName || payload.quoteContext && payload.quoteContext.quoteName, '')) + '" placeholder="当前场景名称" /></label>',
      '    <label class="field"><span>基线报价版本</span><input type="text" data-qwf-draft="baselineQuoteVersion" value="' + esc(txt(draft.baselineQuoteVersion || payload.quoteContext && payload.quoteContext.baselineQuoteVersion, '')) + '" placeholder="变更报价必填" /></label>',
      '    <label class="field"><span>报价类型</span><select data-qwf-draft="quoteType"><option value="project"' + (currentType === 'project' ? ' selected' : '') + '>项目报价</option><option value="change"' + (currentType === 'change' ? ' selected' : '') + '>变更报价</option></select></label>',
      '  </div>',
      '  <datalist id="workflowHarnessCandidates">' + harnessList + '</datalist>',
      '  <div class="workflow-impact-wrap">',
      '    <div class="workflow-impact-label">影响模块</div>',
      '    <div class="workflow-impact-list">',
      arr(payload.impactModuleOptions).map(function (item) {
        var code = txt(item.code || item.value, '');
        var selected = arr(draft.impactedModules).indexOf(code) >= 0;
        return '<button type="button" class="workflow-impact-chip' + (selected ? ' is-active' : '') + '" data-qwf-impact-module="' + esc(code) + '">' + esc(txt(item.label || code, code)) + '</button>';
      }).join(''),
      '    </div>',
      '  </div>',
      '  <div class="workflow-create-actions">',
      '    <button class="button primary" type="button" data-qwf-create="project">新建项目报价记录</button>',
      '    <button class="button ghost" type="button" data-qwf-create="change">新建变更报价记录</button>',
      '    <button class="button ghost" type="button" data-qwf-open-role-guide>查看角色边界</button>',
      '  </div>',
      '</section>',
    ].join('');
  }

  function filtersHtml(payload) {
    var filters = obj(payload.filters);
    return [
      '<section class="workflow-panel workflow-record-panel">',
      '  <div class="workflow-panel-head">',
      '    <div>',
      '      <h4>工作流记录</h4>',
      '      <p class="section-note">筛选当前报价记录，并切换到指定线束号的阶段详情。</p>',
      '    </div>',
      '    <div class="workflow-panel-meta">当前角色：' + esc(roleLabel(payload)) + '</div>',
      '  </div>',
      '  <div class="workflow-filter-grid">',
      '    <label class="field quote-inline-field"><span>报价类型</span><select data-qwf-filter="quoteType"><option value="">全部</option><option value="project"' + (txt(filters.quoteType, '') === 'project' ? ' selected' : '') + '>项目报价</option><option value="change"' + (txt(filters.quoteType, '') === 'change' ? ' selected' : '') + '>变更报价</option></select></label>',
      '    <label class="field quote-inline-field"><span>报价版本</span><input type="text" data-qwf-filter="quoteVersionId" value="' + esc(txt(filters.quoteVersionId, '')) + '" placeholder="版本筛选" /></label>',
      '    <label class="field quote-inline-field"><span>线束号</span><input type="text" data-qwf-filter="harnessId" value="' + esc(txt(filters.harnessId, '')) + '" placeholder="线束号筛选" /></label>',
      '    <label class="field quote-inline-field"><span>阶段</span><select data-qwf-filter="currentStageCode"><option value="">全部</option>',
      arr(payload.stages).map(function (stage) {
        var code = txt(stage.stageCode, '');
        return '<option value="' + esc(code) + '"' + (txt(filters.currentStageCode, '') === code ? ' selected' : '') + '>' + esc(txt(stage.stageLabel || stage.stageName, code)) + '</option>';
      }).join(''),
      '    </select></label>',
      '    <label class="field quote-inline-field"><span>状态</span><select data-qwf-filter="overallStatus"><option value="">全部</option><option value="draft"' + (txt(filters.overallStatus, '') === 'draft' ? ' selected' : '') + '>草稿</option><option value="review_pending"' + (txt(filters.overallStatus, '') === 'review_pending' ? ' selected' : '') + '>待评审</option><option value="returned"' + (txt(filters.overallStatus, '') === 'returned' ? ' selected' : '') + '>已退回</option><option value="active"' + (txt(filters.overallStatus, '') === 'active' ? ' selected' : '') + '>执行中</option><option value="closed"' + (txt(filters.overallStatus, '') === 'closed' ? ' selected' : '') + '>已关闭</option></select></label>',
      '  </div>',
      '  <div class="workflow-record-list">',
      arr(payload.records).length ? arr(payload.records).map(function (record) {
        var selected = txt(payload.selectedRecord && payload.selectedRecord.recordId, '') === txt(record.recordId, '');
        return [
          '<button type="button" class="workflow-record-card' + (selected ? ' is-active' : '') + '" data-qwf-record="' + esc(txt(record.recordId, '')) + '">',
          '  <div class="workflow-record-main">',
          '    <strong>' + esc(txt(record.harnessId, '-')) + '</strong>',
          '    <span>' + esc(txt(record.harnessName, '未命名线束')) + '</span>',
          '  </div>',
          '  <div class="workflow-record-meta">',
          '    <span>' + esc(txt(record.quoteType === 'change' ? '变更报价' : '项目报价', '项目报价')) + '</span>',
          '    <span>' + esc(txt(record.quoteVersionId, '-')) + '</span>',
          '    <span>' + esc(txt(record.displayStageLabel || record.currentStageLabel || record.currentStageCode, '-')) + '</span>',
          '    <span>' + esc(statusLabel(record.displayStatus || record.overallStatus)) + '</span>',
          '  </div>',
          '  <div class="workflow-record-foot">',
          '    <span>基线：' + esc(txt(record.baselineQuoteVersion, '无')) + '</span>',
          '    <span>模块：' + esc(arr(record.impactedModules).join(' / ') || '项目初始') + '</span>',
          '  </div>',
          '</button>',
        ].join('');
      }).join('') : '<div class="workflow-empty">当前没有符合筛选条件的记录</div>',
      '  </div>',
      '</section>',
    ].join('');
  }

  function summaryHtml(payload) {
    var record = obj(payload.selectedRecord);
    if (!txt(record.recordId, '')) {
      return '<section class="workflow-panel workflow-summary-panel"><div class="workflow-empty">请选择一条工作流记录查看摘要</div></section>';
    }
    var owner = arr(record.currentOwnerRoles || []).join(' / ');
    var visibleFields = arr(payload.fieldDefinitions).filter(function (field) {
      return txt(field.stageCode, '') === txt(record.displayStageCode || record.currentStageCode, '');
    }).map(function (field) { return txt(field.fieldLabel || field.label, field.fieldCode); });
    return [
      '<section class="workflow-panel workflow-summary-panel">',
      '  <div class="workflow-panel-head">',
      '    <div>',
      '      <h4>当前记录摘要</h4>',
      '      <p class="section-note">在工作流页继续做阶段提报、项目经理评审与执行跟踪。</p>',
      '    </div>',
      '    <div class="workflow-panel-meta">' + esc(txt(record.displayStageLabel || record.currentStageLabel || record.currentStageCode, '-')) + '</div>',
      '  </div>',
      '  <div class="workflow-summary-kv">',
      '    <div><span>记录ID</span><strong>' + esc(txt(record.recordId, '-')) + '</strong></div>',
      '    <div><span>当前责任</span><strong>' + esc(owner || '-') + '</strong></div>',
      '    <div><span>整体状态</span><strong>' + esc(statusLabel(record.displayStatus || record.overallStatus)) + '</strong></div>',
      '    <div><span>影响模块</span><strong>' + esc(arr(record.impactedModules).join(' / ') || '项目初始') + '</strong></div>',
      '  </div>',
      '  <div class="workflow-role-boundary">',
      '    <div class="workflow-role-boundary-title">当前阶段可见字段</div>',
      '    <div class="workflow-role-boundary-list">' + (visibleFields.length ? visibleFields.map(function (item) { return '<span>' + esc(item) + '</span>'; }).join('') : '<span>当前阶段暂无字段定义</span>') + '</div>',
      '  </div>',
      '</section>',
    ].join('');
  }

  function bindMount(container, payloadProvider, actions) {
    if (!container || container.dataset.qwfBound === 'true') return;
    container.dataset.qwfBound = 'true';
    container.addEventListener('click', function (event) {
      var roleGuide = event.target.closest('[data-qwf-open-role-guide]');
      if (roleGuide && typeof actions.onOpenRoleGuide === 'function') {
        actions.onOpenRoleGuide();
        return;
      }
      var impact = event.target.closest('[data-qwf-impact-module]');
      if (impact && typeof actions.onDraftChange === 'function') {
        actions.onDraftChange('toggleImpactModule', impact.getAttribute('data-qwf-impact-module'));
        return;
      }
      var create = event.target.closest('[data-qwf-create]');
      if (create) {
        var type = create.getAttribute('data-qwf-create');
        if (type === 'change' && typeof actions.onCreateChangeRecord === 'function') actions.onCreateChangeRecord();
        if (type === 'project' && typeof actions.onCreateProjectRecord === 'function') actions.onCreateProjectRecord();
        return;
      }
      var record = event.target.closest('[data-qwf-record]');
      if (record && typeof actions.onSelectRecord === 'function') {
        actions.onSelectRecord(record.getAttribute('data-qwf-record'));
      }
    });
    container.addEventListener('change', function (event) {
      var role = event.target.closest('[data-qwf-role]');
      if (role && typeof actions.onRoleChange === 'function') {
        actions.onRoleChange(role.value);
        return;
      }
      var draft = event.target.closest('[data-qwf-draft]');
      if (draft && typeof actions.onDraftChange === 'function') {
        actions.onDraftChange(draft.getAttribute('data-qwf-draft'), draft.value);
        return;
      }
      var filter = event.target.closest('[data-qwf-filter]');
      if (filter && typeof actions.onFilterChange === 'function') {
        actions.onFilterChange(filter.getAttribute('data-qwf-filter'), filter.value);
      }
    });
  }

  function render(mounts, payload, actions) {
    var refs = obj(mounts);
    var view = obj(payload);
    if (refs.quoteWorkflowMount) {
      refs.quoteWorkflowMount.innerHTML = creatorHtml(view);
      bindMount(refs.quoteWorkflowMount, function () { return view; }, obj(actions));
    }
    if (refs.salesRuleMount) {
      refs.salesRuleMount.innerHTML = filtersHtml(view) + summaryHtml(view);
      bindMount(refs.salesRuleMount, function () { return view; }, obj(actions));
    }
    return true;
  }

  global.G281QuoteWorkflow = {
    render: render,
    mount: render,
  };
}(window));
