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

  const DEFAULT_NODES = [
    { key: 'harness', label: 'Harness', artifactType: 'harness', scope: 'harness', sequence: 10, ownerRoles: [] },
    { key: 'bom', label: 'BOM', artifactType: 'bom', scope: 'harness', sequence: 20, ownerRoles: [] },
    { key: 'quotation', label: 'Quotation', artifactType: 'quotation', scope: 'harness', sequence: 30, ownerRoles: [] },
    { key: 'labor', label: 'Labor', artifactType: 'labor', scope: 'harness', sequence: 40, ownerRoles: [] },
    { key: 'packaging', label: 'Packaging', artifactType: 'packaging', scope: 'harness', sequence: 50, ownerRoles: [] },
    { key: 'capital', label: 'Capital', artifactType: 'capital', scope: 'harness', sequence: 60, ownerRoles: [] },
    { key: 'approval', label: 'Approval', artifactType: 'approval', scope: 'project', sequence: 70, ownerRoles: [] },
  ];

  function resolveRuntime(runtimeInput) {
    if (runtimeInput && runtimeInput.master) return runtimeInput;
    if (runtimeInput && typeof runtimeInput.getRuntime === 'function') return runtimeInput.getRuntime() || {};
    return global.G281_RUNTIME || {};
  }

  function resolveRepo(runtimeInput) {
    if (runtimeInput && typeof runtimeInput.getArtifactPublishStates === 'function') return runtimeInput;
    return global.G281Repo && typeof global.G281Repo.current === 'function'
      ? global.G281Repo.current(runtimeInput)
      : null;
  }

  function resolveConfig(explicitConfig) {
    if (explicitConfig) return explicitConfig;
    return global.ConfigLoader && typeof global.ConfigLoader.active === 'function'
      ? global.ConfigLoader.active()
      : null;
  }

  function countExceptions(scope) {
    return safeArray(scope && scope.groups).reduce((sum, group) => {
      return sum + safeArray(group && group.aligned)
        .filter((item) => toText(item && item.status, 'matched') !== 'matched').length;
    }, 0);
  }

  function normalizeStageDefinition(node) {
    const rawKey = toText(node && (node.id || node.key), '');
    const key = rawKey === 'quote' ? 'quotation' : rawKey;
    const artifactType = toText(node && node.artifactType, key);
    return {
      key,
      rawKey,
      label: toText(node && (node.displayName || node.name || node.label), key),
      artifactType,
      scope: toText(node && node.scope, artifactType === 'approval' ? 'project' : 'harness'),
      sequence: numberOr(node && node.sequence, 999),
      category: toText(node && node.category, 'workflow'),
      ownerRoles: safeArray(node && node.ownerRoles),
      page: toText(node && node.page, ''),
      supportsPartialPublish: Boolean(node && node.supportsPartialPublish),
    };
  }

  function stageDefinitions(config) {
    const configured = safeArray(config && config.stageDefinitions)
      .map(normalizeStageDefinition)
      .filter((node) => node.key);
    if (!configured.length) return DEFAULT_NODES.slice();
    return configured.sort((left, right) => left.sequence - right.sequence);
  }

  function workflowNodeMap(config) {
    return safeArray(config && config.workflowNodes).reduce((accumulator, node) => {
      safeArray(node && node.stageIds).forEach((stageId) => {
        const key = toText(stageId, stageId === 'quote' ? 'quotation' : '').replace(/^quote$/, 'quotation');
        if (!key) return;
        if (!accumulator[key]) accumulator[key] = [];
        accumulator[key].push({
          id: toText(node && node.id, ''),
          page: toText(node && node.page, ''),
          next: safeArray(node && node.next),
        });
      });
      return accumulator;
    }, {});
  }

  function aliasValues(value) {
    const aliases = new Set([toText(value, '')].filter(Boolean));
    if (aliases.has('quotation')) aliases.add('quote');
    if (aliases.has('quote')) aliases.add('quotation');
    return Array.from(aliases);
  }

  function recordsForStage(artifactStates, key, artifactType) {
    const aliases = new Set([].concat(aliasValues(key), aliasValues(artifactType)));
    return safeArray(artifactStates).filter((record) => aliases.has(toText(record && record.artifactType, '')));
  }

  function publishedCount(records, scope) {
    if (scope === 'project') {
      return records.some((record) => toText(record && record.status, 'draft') === 'published') ? 1 : 0;
    }
    const ids = new Set(records
      .filter((record) => toText(record && record.status, 'draft') === 'published')
      .map((record) => toText(record && record.harnessId, ''))
      .filter(Boolean));
    return ids.size;
  }

  function exceptionStats(stageKey, runtime, harnessIds, connectorRows, approvals) {
    if (stageKey === 'harness') {
      return {
        blockedCount: 0,
        exceptionCount: safeArray(harnessIds).filter((harnessId) => {
          const summary = runtime && runtime.bomValidation && runtime.bomValidation.comparisons && runtime.bomValidation.comparisons[harnessId]
            ? runtime.bomValidation.comparisons[harnessId].summary
            : null;
          return numberOr(summary && summary.onlyCounts && summary.onlyCounts.quote, 0) > 0;
        }).length,
      };
    }
    if (stageKey === 'bom') {
      return {
        blockedCount: 0,
        exceptionCount: safeArray(harnessIds).filter((harnessId) => {
          const summary = runtime && runtime.bomValidation && runtime.bomValidation.comparisons && runtime.bomValidation.comparisons[harnessId]
            ? runtime.bomValidation.comparisons[harnessId].summary
            : null;
          return numberOr(summary && summary.partialMatchCount, 0) > 0;
        }).length,
      };
    }
    if (stageKey === 'quotation') {
      const blockedCount = connectorRows.filter((row) => {
        const statusKey = toText(row && row.statusKey, '').toLowerCase();
        return !toText(row && row.replyPrice, '') && !['confirmed', 'done', 'ok'].includes(statusKey);
      }).length;
      return {
        blockedCount,
        exceptionCount: connectorRows.filter((row) => numberOr(row && row.difference, 0) > 0).length,
      };
    }
    if (stageKey === 'labor') {
      const scope = runtime && runtime.laborValidation && runtime.laborValidation.comparisons
        ? runtime.laborValidation.comparisons.scenario
        : null;
      return { blockedCount: 0, exceptionCount: countExceptions(scope) };
    }
    if (stageKey === 'packaging') {
      const scope = runtime && runtime.packagingValidation && runtime.packagingValidation.comparisons
        ? runtime.packagingValidation.comparisons.scenario
        : null;
      return { blockedCount: 0, exceptionCount: countExceptions(scope) };
    }
    if (stageKey === 'capital') {
      const comparisons = runtime && runtime.capitalValidation && runtime.capitalValidation.comparisons
        ? runtime.capitalValidation.comparisons
        : {};
      const scopes = [comparisons.equipment, comparisons.tooling, comparisons.fixtures].filter(Boolean);
      const exceptionCount = scopes.reduce((sum, scope) => sum + numberOr(scope && scope.summary && scope.summary.quoteOnlyCount, 0), 0);
      return { blockedCount: 0, exceptionCount };
    }
    if (stageKey === 'approval') {
      const pending = approvals.filter((record) => toText(record && record.status, '').toUpperCase() === 'PENDING').length;
      return { blockedCount: pending, exceptionCount: pending };
    }
    return { blockedCount: 0, exceptionCount: 0 };
  }

  function build(runtimeInput, options) {
    const runtime = resolveRuntime(runtimeInput);
    const repo = resolveRepo(runtimeInput);
    const safeOptions = options || {};
    const baselineKey = safeOptions.baselineKey || 'quote';
    const config = resolveConfig(safeOptions.config);
    const pageMap = workflowNodeMap(config);
    const artifactStates = repo && typeof repo.getArtifactPublishStates === 'function'
      ? repo.getArtifactPublishStates({ versionKey: baselineKey })
      : [];
    const harnessIds = safeArray(runtime && runtime.bomValidation && runtime.bomValidation.harnessOrder);
    const connectorRows = safeArray(runtime && runtime.connectorProtocolStatus && runtime.connectorProtocolStatus.rows);
    const approvals = repo && typeof repo.getApprovals === 'function' ? repo.getApprovals() : [];

    const nodes = stageDefinitions(config).map((node) => {
      const totalCount = node.scope === 'project' ? 1 : Math.max(harnessIds.length, 1);
      const records = recordsForStage(artifactStates, node.key, node.artifactType);
      const published = publishedCount(records, node.scope);
      const pendingCount = Math.max(totalCount - published, 0);
      const stats = exceptionStats(node.key, runtime, harnessIds, connectorRows, approvals);
      const completionRate = totalCount ? published / totalCount : 0;
      return {
        key: node.key,
        label: node.label,
        artifactType: node.artifactType,
        scope: node.scope,
        totalCount,
        publishedCount: published,
        completionRate,
        blockedCount: stats.blockedCount,
        pendingCount,
        exceptionCount: stats.exceptionCount,
        ownerRoles: node.ownerRoles,
        category: node.category,
        page: node.page,
        workflowPages: safeArray(pageMap[node.key]),
        supportsPartialPublish: node.supportsPartialPublish,
        statusText: `${Math.round(numberOr(completionRate, 0) * 100)}% / published ${published}/${totalCount} / pending ${pendingCount} / exceptions ${stats.exceptionCount}`,
      };
    });

    return { status: 'ready', baselineKey, nodes };
  }

  function attach(elements, options) {
    const runtimeOrRepo = (options && options.runtime) || null;
    const result = build(runtimeOrRepo, options);
    const nodeMap = result.nodes.reduce((accumulator, node) => {
      accumulator[node.key] = node;
      if (node.key === 'quotation') accumulator.quote = node;
      return accumulator;
    }, {});

    if (elements && elements.harnessStatusEl) elements.harnessStatusEl.textContent = nodeMap.harness ? nodeMap.harness.statusText : '--';
    if (elements && elements.bomStatusEl) elements.bomStatusEl.textContent = nodeMap.bom ? nodeMap.bom.statusText : '--';
    if (elements && elements.quoteStatusEl) elements.quoteStatusEl.textContent = nodeMap.quote ? nodeMap.quote.statusText : '--';
    if (elements && elements.laborStatusEl) elements.laborStatusEl.textContent = nodeMap.labor ? nodeMap.labor.statusText : '--';
    if (elements && elements.packagingStatusEl) elements.packagingStatusEl.textContent = nodeMap.packaging ? nodeMap.packaging.statusText : '--';
    if (elements && elements.capitalStatusEl) elements.capitalStatusEl.textContent = nodeMap.capital ? nodeMap.capital.statusText : '--';
    if (elements && elements.approvalStatusEl) elements.approvalStatusEl.textContent = nodeMap.approval ? nodeMap.approval.statusText : '--';
    if (elements && elements.boardMount) {
      elements.boardMount.innerHTML = result.nodes.map((node) => {
        const ownerText = safeArray(node.ownerRoles).length
          ? `<div style="margin-top:4px;font-size:11px;color:#64748b;">owners: ${node.ownerRoles.join(', ')}</div>`
          : '';
        return `<article style="border:1px solid #2a2a3e;border-radius:8px;padding:10px;background:#111125;">
          <strong>${node.label}</strong>
          <div style="margin-top:6px;font-size:12px;color:#9ca3af;">${node.statusText}</div>
          ${ownerText}
        </article>`;
      }).join('');
    }
    return result;
  }

  global.G281WorkflowStageBoardBuilder = { build };
  global.G281WorkflowStageBoard = { build, attach };
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this);
