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
  const clonePlain = Shared.clonePlain || ((value, fallback) => {
    try {
      return JSON.parse(JSON.stringify(value));
    } catch (error) {
      return fallback;
    }
  });

  const COST_LABELS = {
    material: '材料',
    directLabor: '直接人工',
    manufacturing: '制造费用',
    equipment: '设备/折旧',
    rnd: '研发',
    packaging: '包装物流',
  };

  const TYPE_LABELS = {
    approval: '审批',
    publish: '发布',
  };

  const STAGE_LABELS = {
    protocol: '协议价',
    quote: '报价',
    quotation: '报价',
    fixed: '定点',
    labor: '工时',
    packaging: '包装',
    capital: '设备/模具/工装',
    harness: '线束',
    bom: 'BOM',
  };

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

  function sumBy(rows, getter) {
    return safeArray(rows).reduce((total, row) => total + numberOr(getter(row), 0), 0);
  }

  function abs(value) {
    return Math.abs(numberOr(value, 0));
  }

  function severityOf(delta, mediumThreshold, highThreshold) {
    const magnitude = abs(delta);
    if (magnitude >= numberOr(highThreshold, 0)) return 'high';
    if (magnitude >= numberOr(mediumThreshold, 0)) return 'medium';
    return 'low';
  }

  function buildProtocolSection(runtime) {
    const connectorRows = safeArray(runtime && runtime.connectorProtocolStatus && runtime.connectorProtocolStatus.rows);
    const rows = connectorRows.map((row) => {
      const targetProtocolPrice = numberOr(row && row.targetProtocolPrice, 0);
      const replyPrice = row && row.replyPrice == null ? null : numberOr(row && row.replyPrice, 0);
      const initialQuote = row && row.initialQuote == null ? null : numberOr(row && row.initialQuote, 0);
      const rawDifference = row && row.difference == null ? null : numberOr(row && row.difference, 0);
      const difference = rawDifference == null && replyPrice != null
        ? replyPrice - targetProtocolPrice
        : rawDifference;
      const statusKey = toText(row && row.statusKey, '').toLowerCase();
      const recommendedStage = toText(row && row.recommendedStage, '');

      let statusCategory = 'watch';
      if (replyPrice == null || ['pending', 'quoted_pending', 'quote_pending', 'negotiating'].includes(statusKey)) {
        statusCategory = 'pending';
      } else if (numberOr(difference, 0) > 0) {
        statusCategory = 'over';
      } else if (numberOr(difference, 0) < 0) {
        statusCategory = 'under';
      } else {
        statusCategory = 'aligned';
      }

      return {
        rowKey: toText(row && row.rowKey, ''),
        partNumber: toText(row && row.partNumber, ''),
        partName: toText(row && row.partNameRaw, toText(row && row.partName, '')),
        supplier: toText(row && row.supplierRaw, toText(row && row.supplier, '--')),
        groupLabel: toText(row && row.groupLabel, ''),
        targetProtocolPrice,
        replyPrice,
        initialQuote,
        difference,
        supplierReply: toText(row && row.supplierReply, '--'),
        statusKey,
        statusLabel: toText(row && row.statusLabel, row && row.statusKey),
        statusCategory,
        severity: statusCategory === 'pending'
          ? 'medium'
          : severityOf(difference, 1, 5),
        recommendedStage,
        recommendedStageLabel: toText(STAGE_LABELS[recommendedStage], recommendedStage || '--'),
        assemblyRemark: toText(row && row.assemblyRemark, ''),
        customerRemark: toText(row && row.customerRemark, ''),
      };
    }).filter((row) => !['confirmed', 'done', 'ok'].includes(row.statusKey) || numberOr(row.difference, 0) > 0);

    rows.sort((left, right) => {
      const severityRank = { high: 3, medium: 2, low: 1 };
      const bySeverity = numberOr(severityRank[right.severity], 0) - numberOr(severityRank[left.severity], 0);
      if (bySeverity !== 0) return bySeverity;
      return abs(right.difference) - abs(left.difference);
    });

    const supplierMap = new Map();
    rows.forEach((row) => {
      const key = row.supplier || '--';
      const current = supplierMap.get(key) || {
        supplier: key,
        issueCount: 0,
        pendingCount: 0,
        positiveGapTotal: 0,
        partNumbers: [],
      };
      current.issueCount += 1;
      if (row.statusCategory === 'pending') current.pendingCount += 1;
      if (numberOr(row.difference, 0) > 0) current.positiveGapTotal += numberOr(row.difference, 0);
      current.partNumbers.push(row.partNumber);
      supplierMap.set(key, current);
    });

    const supplierRisks = [...supplierMap.values()]
      .map((row) => Object.assign({}, row, {
        partNumbers: row.partNumbers.slice(0, 4),
      }))
      .sort((left, right) => {
        if (right.positiveGapTotal !== left.positiveGapTotal) return right.positiveGapTotal - left.positiveGapTotal;
        if (right.pendingCount !== left.pendingCount) return right.pendingCount - left.pendingCount;
        return right.issueCount - left.issueCount;
      });

    const summary = {
      openCount: rows.length,
      pendingCount: rows.filter((row) => row.statusCategory === 'pending').length,
      supplierCount: supplierRisks.length,
      positiveGapTotal: sumBy(rows.filter((row) => numberOr(row.difference, 0) > 0), (row) => row.difference),
    };

    return { rows, supplierRisks, summary };
  }

  function buildAnnualDropSection(runtime) {
    const versions = runtime && runtime.financialVersions && runtime.financialVersions.versions
      ? runtime.financialVersions.versions
      : {};
    const quoteVersion = versions.quote || null;
    const fixedVersion = versions.fixed || null;
    const years = safeArray(quoteVersion && quoteVersion.years);

    const rows = years.map((year, index) => {
      const quoteRevenue = numberOr(quoteVersion && quoteVersion.annual && quoteVersion.annual.revenue && quoteVersion.annual.revenue[index], 0);
      const fixedRevenue = numberOr(fixedVersion && fixedVersion.annual && fixedVersion.annual.revenue && fixedVersion.annual.revenue[index], 0);
      const deltaRevenue = fixedRevenue - quoteRevenue;
      return {
        year,
        quoteRevenue,
        fixedRevenue,
        deltaRevenue,
        deltaPct: quoteRevenue !== 0 ? deltaRevenue / quoteRevenue : 0,
        statusLabel: deltaRevenue < 0 ? '低于报价基线' : (deltaRevenue > 0 ? '高于报价基线' : '基线一致'),
        severity: severityOf(deltaRevenue, 100000, 500000),
      };
    }).filter((row) => row.deltaRevenue !== 0);

    return {
      rows,
      summary: {
        riskCount: rows.filter((row) => row.deltaRevenue < 0).length,
        opportunityCount: rows.filter((row) => row.deltaRevenue > 0).length,
        netDeltaRevenue: sumBy(rows, (row) => row.deltaRevenue),
      },
    };
  }

  function buildOneTimeRecoverySection(runtime) {
    const comparisons = runtime && runtime.capitalValidation && runtime.capitalValidation.comparisons
      ? runtime.capitalValidation.comparisons
      : {};

    const rows = ['equipment', 'tooling', 'fixtures']
      .map((scopeKey) => comparisons[scopeKey])
      .filter(Boolean)
      .map((scope) => {
        const summary = scope.summary || {};
        const deltaAmount = numberOr(summary.deltaAmount, 0);
        const groupHighlights = safeArray(scope.groups)
          .filter((group) =>
            numberOr(group && group.quoteOnlyCount, 0) > 0 ||
            numberOr(group && group.fixedOnlyCount, 0) > 0 ||
            numberOr(group && group.quoteAmount, 0) !== numberOr(group && group.fixedAmount, 0)
          )
          .slice(0, 3)
          .map((group) => ({
            label: toText(group && group.label, group && group.key),
            quoteAmount: numberOr(group && group.quoteAmount, 0),
            fixedAmount: numberOr(group && group.fixedAmount, 0),
          }));

        const aligned = deltaAmount === 0 &&
          numberOr(summary.quoteOnlyCount, 0) === 0 &&
          numberOr(summary.fixedOnlyCount, 0) === 0;

        return {
          scopeKey: toText(scope && scope.scopeId, ''),
          label: toText(scope && scope.scopeLabel, scope && scope.scopeId),
          quoteAmount: numberOr(summary.quoteAmount, 0),
          fixedAmount: numberOr(summary.fixedAmount, 0),
          deltaAmount,
          quoteCount: numberOr(summary.quoteCount, 0),
          fixedCount: numberOr(summary.fixedCount, 0),
          statusLabel: aligned ? '基线一致' : '需回收/校核',
          statusCategory: aligned ? 'aligned' : 'gap',
          severity: aligned ? 'low' : severityOf(deltaAmount, 10000, 100000),
          nextAction: aligned ? '继续跟踪回收执行' : '核对需求行并确认回收路径',
          groupHighlights,
        };
      });

    return {
      rows,
      summary: {
        scopeCount: rows.length,
        openCount: rows.filter((row) => row.statusCategory !== 'aligned').length,
        totalDeltaAmount: sumBy(rows, (row) => row.deltaAmount),
        totalQuoteAmount: sumBy(rows, (row) => row.quoteAmount),
      },
    };
  }

  function buildCostDeviationSection(runtime) {
    const versions = runtime && runtime.financialVersions && runtime.financialVersions.versions
      ? runtime.financialVersions.versions
      : {};
    const quoteVersion = versions.quote || null;
    const fixedVersion = versions.fixed || null;

    const rows = Object.keys(COST_LABELS).map((key) => {
      const quote = numberOr(quoteVersion && quoteVersion.perSet && quoteVersion.perSet[key], 0);
      const fixed = numberOr(fixedVersion && fixedVersion.perSet && fixedVersion.perSet[key], 0);
      const delta = fixed - quote;
      return {
        key,
        label: COST_LABELS[key],
        quote,
        fixed,
        delta,
        deltaPct: quote !== 0 ? delta / quote : 0,
        severity: severityOf(delta, 1, 5),
        statusLabel: delta > 0 ? '定点高于报价' : (delta < 0 ? '定点低于报价' : '基线一致'),
      };
    }).filter((row) => row.delta !== 0);

    rows.sort((left, right) => abs(right.delta) - abs(left.delta));

    return {
      rows,
      summary: {
        nonZeroCount: rows.length,
        totalAbsDelta: sumBy(rows, (row) => abs(row.delta)),
      },
    };
  }

  function buildResidualSection(runtime) {
    const harnessOrder = safeArray(runtime && runtime.bomValidation && runtime.bomValidation.harnessOrder);
    const comparisons = runtime && runtime.bomValidation && runtime.bomValidation.comparisons
      ? runtime.bomValidation.comparisons
      : {};

    const rows = harnessOrder.map((harnessId) => {
      const summary = comparisons[harnessId] && comparisons[harnessId].summary
        ? comparisons[harnessId].summary
        : {};
      const onlyQuoteCount = numberOr(summary && summary.onlyCounts && summary.onlyCounts.quote, 0);
      const partialMatchCount = numberOr(summary && summary.partialMatchCount, 0);
      return {
        harnessId,
        groupCount: numberOr(summary && summary.groupCount, 0),
        onlyQuoteCount,
        partialMatchCount,
        assemblyPartCount: numberOr(summary && summary.assemblyPartCount, 0),
        materialMatchedCount: numberOr(summary && summary.materialMatchedCount, 0),
        severity: severityOf((onlyQuoteCount * 10) + partialMatchCount, 10, 30),
        statusLabel: onlyQuoteCount > 0 ? '报价独有待闭环' : '局部差异待校核',
        nextAction: onlyQuoteCount > 0
          ? '确认取消料并进入残余/呆滞处理'
          : '继续校核总成与散件对齐',
      };
    }).filter((row) => row.onlyQuoteCount > 0 || row.partialMatchCount > 0);

    rows.sort((left, right) => {
      const leftScore = (left.onlyQuoteCount * 10) + left.partialMatchCount;
      const rightScore = (right.onlyQuoteCount * 10) + right.partialMatchCount;
      return rightScore - leftScore;
    });

    return {
      rows,
      summary: {
        harnessCount: rows.length,
        totalQuoteOnly: sumBy(rows, (row) => row.onlyQuoteCount),
        totalPartial: sumBy(rows, (row) => row.partialMatchCount),
      },
    };
  }

  function buildUnfinishedSection(repo, baselineKey) {
    const approvals = repo && typeof repo.getApprovals === 'function' ? repo.getApprovals() : [];
    const publishStates = repo && typeof repo.getArtifactPublishStates === 'function'
      ? repo.getArtifactPublishStates({ versionKey: baselineKey })
      : [];

    const approvalRows = approvals
      .filter((record) => toText(record && record.status, '').toUpperCase() === 'PENDING')
      .map((record) => ({
        type: 'approval',
        typeLabel: TYPE_LABELS.approval,
        label: toText(record && record.title, record && record.id),
        statusLabel: '待审批',
        nextAction: '完成审批并同步发布项目级状态',
        priority: 100,
      }));

    const publishRows = publishStates
      .filter((record) => toText(record && record.status, 'published') !== 'published')
      .map((record) => ({
        type: 'publish',
        typeLabel: TYPE_LABELS.publish,
        label: `${toText(STAGE_LABELS[toText(record && record.artifactType, '')], toText(record && record.artifactType, ''))} / ${toText(record && record.harnessId, '*')}`,
        statusLabel: toText(record && record.status, 'draft'),
        nextAction: '补齐节点发布后再继续下游流转',
        priority: 90,
      }));

    const rows = approvalRows.concat(publishRows);

    return {
      rows,
      summary: {
        count: rows.length,
      },
    };
  }

  function buildFocusQueue(sections) {
    const queue = [];

    safeArray(sections.protocol.rows).forEach((row) => {
      queue.push({
        category: '协议价',
        label: `${row.partNumber} / ${row.supplier}`,
        detail: row.replyPrice == null
          ? '供应商尚未回复价格'
          : `单件差额 ${numberOr(row.difference, 0).toFixed(2)}`,
        severity: row.severity,
        priority: row.statusCategory === 'pending' ? 75 : (numberOr(row.difference, 0) > 0 ? 85 : 60),
        magnitude: abs(row.difference),
      });
    });

    safeArray(sections.annualDrop.rows)
      .filter((row) => row.deltaRevenue < 0)
      .forEach((row) => {
        queue.push({
          category: '年降',
          label: `${row.year} 年收入差异`,
          detail: `定点较报价减少 ${abs(row.deltaRevenue).toFixed(2)}`,
          severity: row.severity,
          priority: 80,
          magnitude: abs(row.deltaRevenue),
        });
      });

    safeArray(sections.oneTimeRecovery.rows)
      .filter((row) => row.statusCategory !== 'aligned')
      .forEach((row) => {
        queue.push({
          category: '一次性费用',
          label: row.label,
          detail: `差额 ${abs(row.deltaAmount).toFixed(2)}`,
          severity: row.severity,
          priority: 70,
          magnitude: abs(row.deltaAmount),
        });
      });

    safeArray(sections.costDeviation.rows).forEach((row) => {
      queue.push({
        category: '成本偏差',
        label: row.label,
        detail: `定点 vs 报价偏差 ${row.delta.toFixed(4)}`,
        severity: row.severity,
        priority: 65,
        magnitude: abs(row.delta),
      });
    });

    safeArray(sections.residual.rows).forEach((row) => {
      queue.push({
        category: '残余料',
        label: row.harnessId,
        detail: `报价独有 ${row.onlyQuoteCount} / 部分匹配 ${row.partialMatchCount}`,
        severity: row.severity,
        priority: 60,
        magnitude: (row.onlyQuoteCount * 10) + row.partialMatchCount,
      });
    });

    safeArray(sections.unfinished.rows).forEach((row) => {
      queue.push({
        category: row.typeLabel,
        label: row.label,
        detail: row.nextAction,
        severity: 'high',
        priority: numberOr(row.priority, 95),
        magnitude: 1,
      });
    });

    queue.sort((left, right) => {
      if (right.priority !== left.priority) return right.priority - left.priority;
      return right.magnitude - left.magnitude;
    });

    return queue.slice(0, 12).map((item) => clonePlain(item, item));
  }

  function buildOverview(sections) {
    return [
      {
        key: 'protocol',
        label: '协议价异常',
        value: sections.protocol.summary.openCount,
        detail: `供应商 ${sections.protocol.summary.supplierCount} / 正差额 ${sections.protocol.summary.positiveGapTotal.toFixed(2)}`,
      },
      {
        key: 'annualDrop',
        label: '年降风险年份',
        value: sections.annualDrop.summary.riskCount,
        detail: `净差额 ${sections.annualDrop.summary.netDeltaRevenue.toFixed(2)}`,
      },
      {
        key: 'oneTime',
        label: '一次性费用项',
        value: sections.oneTimeRecovery.summary.scopeCount,
        detail: `差额 ${sections.oneTimeRecovery.summary.totalDeltaAmount.toFixed(2)}`,
      },
      {
        key: 'deviation',
        label: '成本偏差项',
        value: sections.costDeviation.summary.nonZeroCount,
        detail: `偏差绝对值 ${sections.costDeviation.summary.totalAbsDelta.toFixed(4)}`,
      },
      {
        key: 'residual',
        label: '残余料线束',
        value: sections.residual.summary.harnessCount,
        detail: `报价独有 ${sections.residual.summary.totalQuoteOnly} / 部分匹配 ${sections.residual.summary.totalPartial}`,
      },
      {
        key: 'unfinished',
        label: '未闭环事项',
        value: sections.unfinished.summary.count,
        detail: '审批与发布异常需要闭环',
      },
    ];
  }

  function build(runtimeInput, options) {
    const runtime = resolveRuntime(runtimeInput);
    const repo = resolveRepo(runtimeInput);
    const safeOptions = options || {};
    const baselineKey = safeOptions.baselineKey || 'quote';

    const protocol = buildProtocolSection(runtime);
    const annualDrop = buildAnnualDropSection(runtime);
    const oneTimeRecovery = buildOneTimeRecoverySection(runtime);
    const costDeviation = buildCostDeviationSection(runtime);
    const residual = buildResidualSection(runtime);
    const unfinished = buildUnfinishedSection(repo, baselineKey);

    const sections = {
      protocol,
      annualDrop,
      oneTimeRecovery,
      costDeviation,
      residual,
      unfinished,
    };

    return {
      status: 'ready',
      baselineKey,
      protocol: protocol.rows,
      protocolBySupplier: protocol.supplierRisks,
      annualDrop: annualDrop.rows,
      oneTimeRecovery: oneTimeRecovery.rows,
      costDeviation: costDeviation.rows,
      residual: residual.rows,
      unfinished: unfinished.rows,
      focusQueue: buildFocusQueue(sections),
      overview: buildOverview(sections),
      summaries: {
        protocol: protocol.summary,
        annualDrop: annualDrop.summary,
        oneTimeRecovery: oneTimeRecovery.summary,
        costDeviation: costDeviation.summary,
        residual: residual.summary,
        unfinished: unfinished.summary,
      },
    };
  }

  global.G281CostExceptionTrackerBuilder = { build };
  global.G281CostExceptionTracker = { build };
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this);
