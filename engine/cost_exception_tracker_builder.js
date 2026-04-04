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

  function resolveRuntime(runtimeInput) {
    if (runtimeInput && runtimeInput.master) return runtimeInput;
    if (runtimeInput && typeof runtimeInput.getRuntime === 'function') return runtimeInput.getRuntime() || {};
    return global.G281_RUNTIME || {};
  }

  function resolveRepo(runtimeInput) {
    if (runtimeInput && typeof runtimeInput.getApprovals === 'function') return runtimeInput;
    return global.G281Repo && typeof global.G281Repo.current === 'function'
      ? global.G281Repo.current(runtimeInput)
      : null;
  }

  function build(runtimeInput, options) {
    const runtime = resolveRuntime(runtimeInput);
    const repo = resolveRepo(runtimeInput);
    const safeOptions = options || {};
    const baselineKey = safeOptions.baselineKey || 'quote';
    const connectorRows = safeArray(runtime && runtime.connectorProtocolStatus && runtime.connectorProtocolStatus.rows);
    const protocol = connectorRows.filter((row) => {
      const statusKey = toText(row && row.statusKey, '').toLowerCase();
      return !['confirmed', 'done', 'ok'].includes(statusKey) || numberOr(row && row.difference, 0) > 0;
    }).map((row) => ({
      partNumber: toText(row && row.partNumber, ''),
      supplier: toText(row && row.supplier, ''),
      statusLabel: toText(row && row.statusLabel, row && row.statusKey),
      difference: numberOr(row && row.difference, 0),
    }));

    const quoteVersion = runtime && runtime.financialVersions && runtime.financialVersions.versions
      ? runtime.financialVersions.versions.quote
      : null;
    const fixedVersion = runtime && runtime.financialVersions && runtime.financialVersions.versions
      ? runtime.financialVersions.versions.fixed
      : null;
    const annualDrop = safeArray(quoteVersion && quoteVersion.years).map((year, index) => {
      const quoteRevenue = numberOr(quoteVersion && quoteVersion.annual && quoteVersion.annual.revenue && quoteVersion.annual.revenue[index], 0);
      const fixedRevenue = numberOr(fixedVersion && fixedVersion.annual && fixedVersion.annual.revenue && fixedVersion.annual.revenue[index], 0);
      return {
        year,
        deltaRevenue: fixedRevenue - quoteRevenue,
      };
    }).filter((row) => row.deltaRevenue !== 0);

    const capitalComparisons = runtime && runtime.capitalValidation && runtime.capitalValidation.comparisons
      ? runtime.capitalValidation.comparisons
      : {};
    const oneTimeRecovery = ['equipment', 'tooling', 'fixtures'].map((key) => {
      const scope = capitalComparisons[key];
      return {
        scopeKey: key,
        label: toText(scope && scope.scopeLabel, key),
        quoteAmount: numberOr(scope && scope.summary && scope.summary.quoteAmount, 0),
        deltaAmount: numberOr(scope && scope.summary && scope.summary.deltaAmount, 0),
      };
    }).filter((item) => item.quoteAmount || item.deltaAmount);

    const costDeviation = [];
    if (quoteVersion && fixedVersion) {
      ['material', 'directLabor', 'manufacturing', 'equipment', 'packaging'].forEach((key) => {
        costDeviation.push({
          key,
          quote: numberOr(quoteVersion.perSet && quoteVersion.perSet[key], 0),
          fixed: numberOr(fixedVersion.perSet && fixedVersion.perSet[key], 0),
          delta: numberOr(fixedVersion.perSet && fixedVersion.perSet[key], 0) - numberOr(quoteVersion.perSet && quoteVersion.perSet[key], 0),
        });
      });
    }

    const residual = safeArray(runtime && runtime.bomValidation && runtime.bomValidation.harnessOrder).map((harnessId) => {
      const summary = runtime && runtime.bomValidation && runtime.bomValidation.comparisons && runtime.bomValidation.comparisons[harnessId]
        ? runtime.bomValidation.comparisons[harnessId].summary
        : null;
      return {
        harnessId,
        onlyQuoteCount: numberOr(summary && summary.onlyCounts && summary.onlyCounts.quote, 0),
        partialMatchCount: numberOr(summary && summary.partialMatchCount, 0),
      };
    }).filter((row) => row.onlyQuoteCount > 0 || row.partialMatchCount > 0);

    const approvals = repo && typeof repo.getApprovals === 'function' ? repo.getApprovals() : [];
    const publishStates = repo && typeof repo.getArtifactPublishStates === 'function'
      ? repo.getArtifactPublishStates({ versionKey: baselineKey })
      : [];
    const unfinished = []
      .concat(approvals.filter((record) => toText(record && record.status, '').toUpperCase() === 'PENDING').map((record) => ({
        type: 'approval',
        label: toText(record && record.title, record && record.id),
      })))
      .concat(publishStates.filter((record) => toText(record && record.status, 'published') !== 'published').map((record) => ({
        type: 'publish',
        label: `${toText(record && record.artifactType, '')}:${toText(record && record.harnessId, '*')}`,
      })));

    return {
      status: 'ready',
      protocol,
      annualDrop,
      oneTimeRecovery,
      costDeviation,
      residual,
      unfinished,
    };
  }

  function renderList(mount, items, renderer) {
    if (!mount) return;
    if (!safeArray(items).length) {
      mount.innerHTML = '<div style="color:#9ca3af;font-size:12px;">No issues.</div>';
      return;
    }
    mount.innerHTML = `<ul style="margin:0;padding-left:18px;">${items.map(renderer).join('')}</ul>`;
  }

  function render(mounts, options) {
    const result = build(options && options.runtime, options);
    renderList(mounts && mounts.progressMount, result.protocol.slice(0, 5), (item) => `<li>${item.partNumber} / ${item.supplier} / ${item.statusLabel}</li>`);
    renderList(mounts && mounts.connectorMount, result.protocol.slice(0, 8), (item) => `<li>${item.partNumber} delta ${item.difference.toFixed(2)}</li>`);
    renderList(mounts && mounts.annualMount, result.annualDrop.slice(0, 6), (item) => `<li>${item.year}: ${item.deltaRevenue.toFixed(2)}</li>`);
    renderList(mounts && mounts.oneTimeMount, result.oneTimeRecovery, (item) => `<li>${item.label}: ${item.quoteAmount.toFixed(2)}</li>`);
    renderList(mounts && mounts.deviationMount, result.costDeviation.filter((item) => item.delta !== 0), (item) => `<li>${item.key}: ${item.delta.toFixed(4)}</li>`);
    renderList(mounts && mounts.residualMount, result.residual.slice(0, 8), (item) => `<li>${item.harnessId}: quote-only ${item.onlyQuoteCount}, partial ${item.partialMatchCount}</li>`);
    renderList(mounts && mounts.unfinishedMount, result.unfinished.slice(0, 8), (item) => `<li>${item.type}: ${item.label}</li>`);
    return result;
  }

  global.G281CostExceptionTrackerBuilder = { build };
  global.G281CostExceptionTracker = { build, render };
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this);
