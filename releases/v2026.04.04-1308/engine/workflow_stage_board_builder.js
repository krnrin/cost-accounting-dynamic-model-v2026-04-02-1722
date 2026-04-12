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
    { key: 'harness', label: '线束' },
    { key: 'bom', label: 'BOM' },
    { key: 'quotation', label: '询价' },
    { key: 'labor', label: '工时' },
    { key: 'packaging', label: '包装' },
    { key: 'capital', label: '设备/模具/工装' },
    { key: 'approval', label: '审批发布' },
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

  function countAligned(scope) {
    return safeArray(scope && scope.groups).reduce((sum, group) => {
      return sum + safeArray(group && group.aligned).length;
    }, 0);
  }

  function countExceptions(scope) {
    return safeArray(scope && scope.groups).reduce((sum, group) => {
      return sum + safeArray(group && group.aligned).filter((item) => toText(item && item.status, 'matched') !== 'matched').length;
    }, 0);
  }

  function build(runtimeInput, options) {
    const runtime = resolveRuntime(runtimeInput);
    const repo = resolveRepo(runtimeInput);
    const safeOptions = options || {};
    const baselineKey = safeOptions.baselineKey || 'quote';
    const config = global.ConfigLoader && typeof global.ConfigLoader.active === 'function'
      ? global.ConfigLoader.active()
      : null;
    const configuredNodes = safeArray(config && config.stageDefinitions).length
      ? safeArray(config.stageDefinitions).map((node) => ({ key: toText(node.id || node.key, ''), label: toText(node.displayName || node.name || node.label, node.id || node.key) }))
      : DEFAULT_NODES;
    const artifactStates = repo && typeof repo.getArtifactPublishStates === 'function'
      ? repo.getArtifactPublishStates({ versionKey: baselineKey })
      : [];
    const harnessIds = safeArray(runtime && runtime.bomValidation && runtime.bomValidation.harnessOrder);
    const connectorRows = safeArray(runtime && runtime.connectorProtocolStatus && runtime.connectorProtocolStatus.rows);
    const approvals = repo && typeof repo.getApprovals === 'function' ? repo.getApprovals() : [];

    function publishedHarnessCount(artifactType) {
      const matches = safeArray(artifactStates).filter((record) => toText(record.artifactType) === artifactType && toText(record.status, 'published') === 'published');
      const ids = new Set(matches.map((record) => toText(record.harnessId, '')).filter(Boolean));
      return ids.size;
    }

    function findStage(key) {
      if (key === 'harness') {
        const published = publishedHarnessCount('harness');
        return {
          completionRate: harnessIds.length ? published / harnessIds.length : 0,
          blockedCount: 0,
          pendingCount: Math.max(harnessIds.length - published, 0),
          exceptionCount: safeArray(harnessIds).filter((harnessId) => {
            const summary = runtime && runtime.bomValidation && runtime.bomValidation.comparisons && runtime.bomValidation.comparisons[harnessId]
              ? runtime.bomValidation.comparisons[harnessId].summary
              : null;
            return numberOr(summary && summary.onlyCounts && summary.onlyCounts.quote, 0) > 0;
          }).length,
        };
      }
      if (key === 'bom') {
        const published = publishedHarnessCount('bom');
        return {
          completionRate: harnessIds.length ? published / harnessIds.length : 0,
          blockedCount: 0,
          pendingCount: Math.max(harnessIds.length - published, 0),
          exceptionCount: safeArray(harnessIds).filter((harnessId) => {
            const summary = runtime && runtime.bomValidation && runtime.bomValidation.comparisons && runtime.bomValidation.comparisons[harnessId]
              ? runtime.bomValidation.comparisons[harnessId].summary
              : null;
            return numberOr(summary && summary.partialMatchCount, 0) > 0;
          }).length,
        };
      }
      if (key === 'quotation' || key === 'quote') {
        const confirmed = connectorRows.filter((row) => ['confirmed', 'done', 'ok'].includes(toText(row && row.statusKey).toLowerCase())).length;
        return {
          completionRate: connectorRows.length ? confirmed / connectorRows.length : 0,
          blockedCount: connectorRows.filter((row) => !toText(row && row.replyPrice, '') && !['confirmed', 'done', 'ok'].includes(toText(row && row.statusKey).toLowerCase())).length,
          pendingCount: Math.max(connectorRows.length - confirmed, 0),
          exceptionCount: connectorRows.filter((row) => numberOr(row && row.difference, 0) > 0).length,
        };
      }
      if (key === 'labor') {
        const scope = runtime && runtime.laborValidation && runtime.laborValidation.comparisons
          ? runtime.laborValidation.comparisons.scenario
          : null;
        const total = countAligned(scope);
        const exceptions = countExceptions(scope);
        return {
          completionRate: total ? (total - exceptions) / total : 1,
          blockedCount: 0,
          pendingCount: exceptions,
          exceptionCount: exceptions,
        };
      }
      if (key === 'packaging') {
        const scope = runtime && runtime.packagingValidation && runtime.packagingValidation.comparisons
          ? runtime.packagingValidation.comparisons.scenario
          : null;
        const total = countAligned(scope);
        const exceptions = countExceptions(scope);
        return {
          completionRate: total ? (total - exceptions) / total : 1,
          blockedCount: 0,
          pendingCount: exceptions,
          exceptionCount: exceptions,
        };
      }
      if (key === 'capital') {
        const comparisons = runtime && runtime.capitalValidation && runtime.capitalValidation.comparisons
          ? runtime.capitalValidation.comparisons
          : {};
        const scopes = [comparisons.equipment, comparisons.tooling, comparisons.fixtures].filter(Boolean);
        const total = scopes.reduce((sum, scope) => sum + countAligned(scope), 0);
        const exceptions = scopes.reduce((sum, scope) => sum + numberOr(scope && scope.summary && scope.summary.quoteOnlyCount, 0), 0);
        return {
          completionRate: total ? (total - exceptions) / total : 1,
          blockedCount: 0,
          pendingCount: exceptions,
          exceptionCount: exceptions,
        };
      }
      if (key === 'approval') {
        const pending = approvals.filter((record) => toText(record && record.status, '').toUpperCase() === 'PENDING').length;
        return {
          completionRate: approvals.length ? (approvals.length - pending) / approvals.length : 0,
          blockedCount: pending,
          pendingCount: pending,
          exceptionCount: pending,
        };
      }
      return { completionRate: 0, blockedCount: 0, pendingCount: 0, exceptionCount: 0 };
    }

    const nodes = configuredNodes.map((node) => {
      const counts = findStage(node.key);
      return {
        key: node.key,
        label: node.label,
        completionRate: counts.completionRate,
        blockedCount: counts.blockedCount,
        pendingCount: counts.pendingCount,
        exceptionCount: counts.exceptionCount,
        statusText: `${Math.round(numberOr(counts.completionRate, 0) * 100)}% / pending ${counts.pendingCount} / exceptions ${counts.exceptionCount}`,
      };
    });

    return { status: 'ready', baselineKey, nodes };
  }

  function attach(elements, options) {
    const result = build((options && options.runtime) || null, options);
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
        return `<article style="border:1px solid #2a2a3e;border-radius:8px;padding:10px;background:#111125;">
          <strong>${node.label}</strong>
          <div style="margin-top:6px;font-size:12px;color:#9ca3af;">${node.statusText}</div>
        </article>`;
      }).join('');
    }
    return result;
  }

  global.G281WorkflowStageBoardBuilder = { build };
  global.G281WorkflowStageBoard = { build, attach };
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this);
