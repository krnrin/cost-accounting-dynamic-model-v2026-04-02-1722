(function (global) {
  'use strict';

  function numberOr(value, fallback) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : fallback;
  }

  function safeArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function safeObject(value) {
    return value && typeof value === 'object' ? value : {};
  }

  function toText(value, fallback) {
    if (typeof value === 'string') return value;
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
    return fallback;
  }

  function toBool(value, fallback) {
    if (typeof value === 'boolean') return value;
    if (value === '1' || value === 1 || value === 'true') return true;
    if (value === '0' || value === 0 || value === 'false') return false;
    return fallback;
  }

  function clonePlain(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function uniqueStrings(values) {
    const seen = new Set();
    const result = [];
    safeArray(values).forEach((item) => {
      const normalized = toText(item, '').trim();
      if (!normalized || seen.has(normalized)) return;
      seen.add(normalized);
      result.push(normalized);
    });
    return result;
  }

  function annualRowsFromModel(model) {
    const portfolioAnnual = safeArray(model && model.portfolioSummary && model.portfolioSummary.annual);
    if (portfolioAnnual.length) return portfolioAnnual;
    return safeArray(model && model.annual);
  }

  function detectQuoteType(value) {
    const raw = toText(value, '').trim().toLowerCase();
    if (raw === 'change' || raw === '变更报价' || raw === 'change_quote') return 'change';
    return 'project';
  }

  function normalizeQuoteContext(model, snapshot) {
    const modelCtx = safeObject(model && model.quoteContext);
    const snapshotCtx = safeObject(snapshot && snapshot.quoteContext);
    const quoteType = detectQuoteType(
      snapshotCtx.quoteType
        || snapshot && snapshot.quoteType
        || modelCtx.quoteType
        || model && model.quoteType
    );
    const baselineQuoteVersion = toText(
      snapshotCtx.baselineQuoteVersion
        || snapshot && snapshot.baselineQuoteVersion
        || modelCtx.baselineQuoteVersion
        || model && model.baselineQuoteVersion,
      ''
    ).trim();
    return {
      quoteType,
      quoteTypeLabel: quoteType === 'change' ? '变更报价' : '项目报价',
      baselineQuoteVersion,
      hasBaseline: quoteType !== 'change' || Boolean(baselineQuoteVersion),
      source: toText(snapshotCtx.source || snapshot && snapshot.source, 'sales_rule'),
      version: toText(snapshotCtx.version || snapshot && snapshot.version, ''),
    };
  }

  function newRuleId(index) {
    const stamp = Date.now().toString(36);
    return `rule-${stamp}-${index + 1}`;
  }

  function normalizeRuleLoadShares(raw) {
    const source = safeObject(raw);
    return {
      equipment: Math.max(0, numberOr(
        source.equipment
          || source.equipmentShare
          || source.equipment_load_share,
        0
      )),
      tooling: Math.max(0, numberOr(
        source.tooling
          || source.toolingShare
          || source.tooling_load_share,
        0
      )),
      mold: Math.max(0, numberOr(
        source.mold
          || source.moldShare
          || source.mold_load_share
          || source.fixtureShare
          || source.fixtures,
        0
      )),
    };
  }

  function normalizeSalesRules(snapshot) {
    const rawRules = safeArray(
      snapshot && snapshot.rules
        || snapshot && snapshot.ruleRows
        || snapshot && snapshot.items
        || snapshot && snapshot.recoveryRules
    );

    return rawRules.map((raw, index) => {
      const loadShares = normalizeRuleLoadShares(
        raw && raw.loadShares
          || raw && raw.load_share
          || raw
      );
      const lineIds = uniqueStrings(
        safeArray(raw && raw.lineIds)
          .concat(safeArray(raw && raw.harnessIds))
          .concat(safeArray(raw && raw.carrierLineIds))
          .concat(raw && raw.harnessId ? [raw.harnessId] : [])
      );
      const recoverLimitSets = Math.max(0, numberOr(
        raw && raw.recoverLimitSets
          || raw && raw.limitSets
          || raw && raw.maxSets,
        0
      ));
      const singleUnitFee = Math.max(0, numberOr(
        raw && raw.singleUnitFee
          || raw && raw.unitFee
          || raw && raw.perSetFee,
        0
      ));
      const totalAmount = Math.max(0, numberOr(
        raw && raw.totalAmount
          || raw && raw.amount
          || raw && raw.amountTotal,
        0
      ));
      const derivePerSet = recoverLimitSets > 0 ? (totalAmount / recoverLimitSets) : 0;
      const perSetRecoverAmount = singleUnitFee > 0 ? singleUnitFee : derivePerSet;
      const isTemplateRow = toBool(
        raw && (raw.isTemplateRow || raw.templateReserved || raw.templateOnly),
        false
      );
      const isEnabled = toBool(raw && (raw.isEnabled || raw.enabled), true);
      const hasMoney = totalAmount > 0 || perSetRecoverAmount > 0;
      const isEffective = toBool(raw && raw.isEffective, isEnabled && hasMoney && !isTemplateRow);
      return {
        ruleId: toText(raw && (raw.ruleId || raw.id), newRuleId(index)),
        costType: toText(raw && (raw.costType || raw.feeType), 'unknown'),
        lineIds,
        recoverLimitSets,
        singleUnitFee,
        perSetRecoverAmount,
        totalAmount,
        shareMode: toText(raw && (raw.shareMode || raw.settleMode), 'included_in_price'),
        isEnabled,
        isEffective,
        isTemplateRow,
        triggerCondition: toText(raw && (raw.triggerCondition || raw.trigger), ''),
        note: toText(raw && (raw.note || raw.remark), ''),
        deliveredSets: Math.max(0, numberOr(raw && (raw.deliveredSets || raw.shippedSets), 0)),
        loadShares,
        applyToAllHarnesses: toBool(raw && raw.applyToAllHarnesses, false),
        meta: {
          owner: toText(raw && raw.owner, 'sales'),
          updatedAt: toText(raw && raw.updatedAt, ''),
        },
      };
    });
  }

  function buildHarnessBreakdown(runtime, model) {
    if (model && model.harnessProfit && safeArray(model.harnessProfit.harnesses).length) {
      return model.harnessProfit;
    }
    const helper = global.G281HarnessProfit;
    if (!helper || typeof helper.buildHarnessProfitBreakdown !== 'function') {
      return null;
    }
    return helper.buildHarnessProfitBreakdown(runtime, model, {});
  }

  function normalizeHarnessBaseRows(breakdown) {
    const rows = safeArray(breakdown && breakdown.harnesses);
    return rows.map((row) => {
      const baseRevenue = numberOr(
        row && (row.unitRevenueEstimated || row.revenue || row.unitRevenue),
        0
      );
      const baseCost = numberOr(
        row && (row.unitCostEstimated || row.cost || row.unitCost),
        0
      );
      const baseProfit = numberOr(
        row && (row.unitProfitEstimated || row.profit || (baseRevenue - baseCost)),
        baseRevenue - baseCost
      );
      const baseMargin = baseRevenue > 0
        ? baseProfit / baseRevenue
        : numberOr(row && row.marginEstimated, 0);
      const unitDirectLabor = numberOr(row && row.unitDirectLaborCost, 0);
      const unitManufacturing = numberOr(row && row.unitManufacturingCost, 0);
      const lineCount = numberOr(row && row.counts && row.counts.selectedItemCount, 0);
      return {
        harnessId: toText(row && row.harnessId, ''),
        harnessName: toText(row && row.harnessName, ''),
        base: {
          revenuePerSet: baseRevenue,
          costPerSet: baseCost,
          profitPerSet: baseProfit,
          margin: baseMargin,
          materialPerSet: numberOr(row && row.unitMaterialCost, 0),
          laborPerSet: unitDirectLabor + unitManufacturing,
          packagingPerSet: numberOr(row && row.unitPackagingCost, 0),
          equipmentRndPerSet: numberOr(row && row.unitEquipmentCost, 0) + numberOr(row && row.unitRndCost, 0),
          directLaborPerSet: unitDirectLabor,
          manufacturingPerSet: unitManufacturing,
        },
        allocationBasis: {
          selectedItemCount: lineCount,
          wireLineCount: numberOr(row && row.counts && row.counts.wireLineCount, 0),
          residualBasis: numberOr(row && row.residualBasis, 0),
        },
      };
    });
  }

  function ruleMatchesHarness(rule, harnessId) {
    if (!rule) return false;
    if (rule.applyToAllHarnesses) return true;
    if (!safeArray(rule.lineIds).length) return false;
    return rule.lineIds.includes(harnessId);
  }

  function recoveryPerSetFromRule(rule) {
    return Math.max(0, numberOr(rule && rule.perSetRecoverAmount, 0));
  }

  function deliveredSetsFromSnapshot(snapshot, harnessId, fallback) {
    const trackingRows = safeArray(snapshot && snapshot.recoveryTracking)
      .concat(safeArray(snapshot && snapshot.shipments))
      .concat(safeArray(snapshot && snapshot.deliveryRows));
    const matched = trackingRows.find((row) => toText(row && (row.harnessId || row.lineId), '') === harnessId);
    if (!matched) return Math.max(0, numberOr(fallback, 0));
    return Math.max(0, numberOr(
      matched.deliveredSets || matched.deliveredUnits || matched.shippedSets || fallback,
      0
    ));
  }

  function estimateRuleRecoveredAmount(rule, deliveredSets) {
    const perSet = recoveryPerSetFromRule(rule);
    const limit = Math.max(0, numberOr(rule && rule.recoverLimitSets, 0));
    const effectiveSets = limit > 0 ? Math.min(deliveredSets, limit) : deliveredSets;
    return perSet * Math.max(0, effectiveSets);
  }

  function buildHarnessRowsInternal(previewInput) {
    const preview = safeObject(previewInput);
    if (safeArray(preview.harnessRows).length) {
      return safeArray(preview.harnessRows).map((row) => clonePlain(row));
    }

    const harnessBaseRows = safeArray(preview.__harnessBaseRows);
    const rules = safeArray(preview.__rules);
    const salesRuleSnapshot = safeObject(preview.__salesRuleSnapshot);
    const capitalBreakdown = safeObject(preview.__capitalBreakdown);
    const equipmentPool = Math.max(0, numberOr(capitalBreakdown.equipment, 0));
    const toolingPool = Math.max(0, numberOr(capitalBreakdown.tooling, 0));
    const moldPool = Math.max(0, numberOr(capitalBreakdown.fixtures || capitalBreakdown.mold, 0));

    return harnessBaseRows.map((baseRow) => {
      const harnessId = toText(baseRow && baseRow.harnessId, '');
      const harnessRules = rules.filter((rule) => ruleMatchesHarness(rule, harnessId));
      const activeRules = harnessRules.filter((rule) => rule.isEffective && !rule.isTemplateRow);
      const templateRules = harnessRules.filter((rule) => rule.isTemplateRow || !rule.isEffective);
      const recoveredPerSet = activeRules.reduce(
        (sum, rule) => sum + recoveryPerSetFromRule(rule),
        0
      );
      const deliveredSets = deliveredSetsFromSnapshot(
        salesRuleSnapshot,
        harnessId,
        activeRules.reduce((sum, rule) => Math.max(sum, numberOr(rule.deliveredSets, 0)), 0)
      );
      const estimatedRecoveredAmount = activeRules.reduce(
        (sum, rule) => sum + estimateRuleRecoveredAmount(rule, deliveredSets),
        0
      );
      const allocatedLoads = activeRules.reduce((acc, rule) => {
        acc.equipmentShare += Math.max(0, numberOr(rule && rule.loadShares && rule.loadShares.equipment, 0));
        acc.toolingShare += Math.max(0, numberOr(rule && rule.loadShares && rule.loadShares.tooling, 0));
        acc.moldShare += Math.max(0, numberOr(rule && rule.loadShares && rule.loadShares.mold, 0));
        return acc;
      }, { equipmentShare: 0, toolingShare: 0, moldShare: 0 });

      const adjustedProfitPerSet = numberOr(baseRow && baseRow.base && baseRow.base.profitPerSet, 0) + recoveredPerSet;
      const baseRevenuePerSet = numberOr(baseRow && baseRow.base && baseRow.base.revenuePerSet, 0);
      const adjustedMargin = baseRevenuePerSet > 0 ? adjustedProfitPerSet / baseRevenuePerSet : 0;

      const lineNotes = [];
      if (!activeRules.length) lineNotes.push('该线束当前无生效销售回收规则。');
      if (templateRules.length) lineNotes.push(`含 ${templateRules.length} 条模板保留规则。`);

      return {
        harnessId,
        harnessName: toText(baseRow && baseRow.harnessName, ''),
        base: clonePlain(safeObject(baseRow && baseRow.base)),
        oneTimeRules: harnessRules.map((rule) => ({
          ruleId: rule.ruleId,
          costType: rule.costType,
          perSetRecoverAmount: recoveryPerSetFromRule(rule),
          recoverLimitSets: rule.recoverLimitSets,
          isEffective: rule.isEffective,
          isTemplateRow: rule.isTemplateRow,
          shareMode: rule.shareMode,
        })),
        activeRules: activeRules.map((rule) => clonePlain(rule)),
        templateReservedRules: templateRules.map((rule) => clonePlain(rule)),
        projectedRecoveryPerSet: recoveredPerSet,
        deliveredSets,
        estimatedRecoveredAmount,
        adjusted: {
          profitPerSet: adjustedProfitPerSet,
          margin: adjustedMargin,
        },
        loadAllocationPlaceholder: {
          equipmentShare: allocatedLoads.equipmentShare,
          toolingShare: allocatedLoads.toolingShare,
          moldShare: allocatedLoads.moldShare,
          equipmentAmount: equipmentPool * allocatedLoads.equipmentShare,
          toolingAmount: toolingPool * allocatedLoads.toolingShare,
          moldAmount: moldPool * allocatedLoads.moldShare,
          note: '工艺阶段设备/工装/模具负荷占位，待规则侧补齐精确分配来源。',
        },
        notes: lineNotes,
        allocationBasis: clonePlain(safeObject(baseRow && baseRow.allocationBasis)),
      };
    });
  }

  function buildRecoverySummaryInternal(previewInput) {
    const preview = safeObject(previewInput);
    if (preview.recovery && typeof preview.recovery === 'object' && preview.recovery.__built === true) {
      const cloned = clonePlain(preview.recovery);
      delete cloned.__built;
      return cloned;
    }

    const rules = safeArray(preview.__rules);
    const harnessRows = safeArray(preview.harnessRows).length
      ? safeArray(preview.harnessRows)
      : buildHarnessRowsInternal(preview);
    const activeRuleCount = rules.filter((rule) => rule.isEffective && !rule.isTemplateRow).length;
    const templateRuleCount = rules.filter((rule) => rule.isTemplateRow).length;
    const coveredHarnessCount = harnessRows.filter((row) => safeArray(row.activeRules).length).length;

    const totalProjectedRecoveryPerSet = harnessRows.reduce(
      (sum, row) => sum + Math.max(0, numberOr(row.projectedRecoveryPerSet, 0)),
      0
    );
    const totalEstimatedRecoveredAmount = harnessRows.reduce(
      (sum, row) => sum + Math.max(0, numberOr(row.estimatedRecoveredAmount, 0)),
      0
    );

    const byCostType = {};
    rules.forEach((rule) => {
      const key = toText(rule.costType, 'unknown');
      if (!byCostType[key]) {
        byCostType[key] = {
          costType: key,
          ruleCount: 0,
          activeRuleCount: 0,
          templateRuleCount: 0,
          totalAmount: 0,
          projectedPerSet: 0,
        };
      }
      byCostType[key].ruleCount += 1;
      byCostType[key].totalAmount += Math.max(0, numberOr(rule.totalAmount, 0));
      if (rule.isTemplateRow) byCostType[key].templateRuleCount += 1;
      if (rule.isEffective && !rule.isTemplateRow) {
        byCostType[key].activeRuleCount += 1;
        byCostType[key].projectedPerSet += recoveryPerSetFromRule(rule);
      }
    });

    const pendingRuleIds = rules
      .filter((rule) => !rule.isTemplateRow && !rule.isEffective)
      .map((rule) => rule.ruleId);

    return {
      __built: true,
      totalRuleCount: rules.length,
      activeRuleCount,
      templateRuleCount,
      coveredHarnessCount,
      totalProjectedRecoveryPerSet,
      totalEstimatedRecoveredAmount,
      byCostType: Object.keys(byCostType).map((key) => byCostType[key]),
      pendingRuleIds,
    };
  }

  function buildProjectSummaryInternal(previewInput) {
    const preview = safeObject(previewInput);
    const model = safeObject(preview.model);
    const annual = safeArray(preview.annual);
    const harnessRows = safeArray(preview.harnessRows).length
      ? safeArray(preview.harnessRows)
      : buildHarnessRowsInternal(preview);
    const recovery = preview.recovery && typeof preview.recovery === 'object'
      ? preview.recovery
      : buildRecoverySummaryInternal(preview);

    const portfolio = safeObject(model.portfolioSummary);
    const lifecycle = safeObject(portfolio.lifecycle);
    const unit = safeObject(portfolio.unit);
    const volume = Math.max(0, numberOr(lifecycle.volume || model.totalVolume, 0));
    const baseRevenuePerSet = numberOr(unit.revenue || (volume > 0 ? numberOr(lifecycle.revenue, 0) / volume : 0), 0);
    const baseCostPerSet = numberOr(unit.cost || model.operating, 0);
    const baseProfitPerSet = numberOr(unit.profit || model.avgProfit, baseRevenuePerSet - baseCostPerSet);
    const baseMargin = baseRevenuePerSet > 0 ? baseProfitPerSet / baseRevenuePerSet : numberOr(unit.margin || model.margin, 0);
    const recoveryPerSet = Math.max(0, numberOr(recovery.totalProjectedRecoveryPerSet, 0));
    const adjustedProfitPerSet = baseProfitPerSet + recoveryPerSet;
    const adjustedMargin = baseRevenuePerSet > 0 ? adjustedProfitPerSet / baseRevenuePerSet : 0;
    const adjustedLifecycleProfit = adjustedProfitPerSet * volume;

    const worstHarness = harnessRows.reduce((worst, row) => {
      if (!worst) return row;
      return numberOr(row && row.adjusted && row.adjusted.margin, 0) < numberOr(worst && worst.adjusted && worst.adjusted.margin, 0)
        ? row
        : worst;
    }, null);

    return {
      unit: {
        revenuePerSet: baseRevenuePerSet,
        costPerSet: baseCostPerSet,
        baseProfitPerSet,
        baseMargin,
        projectedRecoveryPerSet: recoveryPerSet,
        adjustedProfitPerSet,
        adjustedMargin,
      },
      lifecycle: {
        volume,
        revenue: numberOr(lifecycle.revenue || model.totalRevenue, 0),
        cost: numberOr(lifecycle.cost || model.totalCost, 0),
        baseProfit: numberOr(lifecycle.profit || model.totalProfit, 0),
        adjustedProfit: adjustedLifecycleProfit,
      },
      annual: annual.map((row) => clonePlain(row)),
      harnessFocus: worstHarness ? {
        harnessId: worstHarness.harnessId,
        harnessName: worstHarness.harnessName,
        adjustedMargin: numberOr(worstHarness.adjusted && worstHarness.adjusted.margin, 0),
        adjustedProfitPerSet: numberOr(worstHarness.adjusted && worstHarness.adjusted.profitPerSet, 0),
      } : null,
    };
  }

  function buildAlerts(quoteContext, rules, harnessRows, breakdownWarnings) {
    const alerts = [];
    if (quoteContext.quoteType === 'change' && !quoteContext.baselineQuoteVersion) {
      alerts.push({
        level: 'warning',
        code: 'baseline_missing',
        message: '变更报价缺少基线报价版本，预演仅用于临时测算。',
      });
    }
    if (!rules.length) {
      alerts.push({
        level: 'warning',
        code: 'rule_missing',
        message: '未提供销售回收规则，当前仅展示基础利润。',
      });
    }
    if (!harnessRows.length) {
      alerts.push({
        level: 'warning',
        code: 'harness_missing',
        message: '未获取到线束颗粒度利润数据，无法生成线束维度预演。',
      });
    }
    safeArray(breakdownWarnings).forEach((warning, index) => {
      alerts.push({
        level: 'info',
        code: `harness_breakdown_${index + 1}`,
        message: toText(warning, ''),
      });
    });
    return alerts;
  }

  function buildPreview(options) {
    if (!options || typeof options !== 'object') {
      throw new Error('G281ExecutionPreview.buildPreview: options is required.');
    }
    const model = safeObject(options.model);
    if (!Object.keys(model).length) {
      throw new Error('G281ExecutionPreview.buildPreview: options.model is required.');
    }

    const runtime = safeObject(options.runtime || global.G281_RUNTIME);
    const salesRuleSnapshot = safeObject(options.salesRuleSnapshot);
    const quoteContext = normalizeQuoteContext(model, salesRuleSnapshot);
    const rules = normalizeSalesRules(salesRuleSnapshot);
    const annual = annualRowsFromModel(model);
    const breakdown = buildHarnessBreakdown(runtime, model);
    const harnessBaseRows = normalizeHarnessBaseRows(breakdown);
    const harnessRows = buildHarnessRowsInternal({
      __harnessBaseRows: harnessBaseRows,
      __rules: rules,
      __salesRuleSnapshot: salesRuleSnapshot,
      __capitalBreakdown: model.capitalBreakdown,
    });
    const recovery = buildRecoverySummaryInternal({
      __rules: rules,
      harnessRows,
    });
    const project = buildProjectSummaryInternal({
      model,
      annual,
      harnessRows,
      recovery,
    });
    const alerts = buildAlerts(
      quoteContext,
      rules,
      harnessRows,
      safeArray(breakdown && breakdown.meta && breakdown.meta.warnings)
    );

    return {
      quoteContext,
      project,
      annual: annual.map((row) => clonePlain(row)),
      harnessRows,
      recovery,
      alerts,
      model: clonePlain(model),
      meta: {
        generatedAt: new Date().toISOString(),
        source: 'factory_execution_preview',
        ruleCount: rules.length,
        harnessCount: harnessRows.length,
      },
    };
  }

  function buildProjectSummary(preview) {
    const normalized = safeObject(preview);
    if (normalized.project && typeof normalized.project === 'object') {
      return clonePlain(normalized.project);
    }
    return buildProjectSummaryInternal(normalized);
  }

  function buildHarnessRows(preview) {
    const normalized = safeObject(preview);
    if (safeArray(normalized.harnessRows).length) {
      return safeArray(normalized.harnessRows).map((row) => clonePlain(row));
    }
    return buildHarnessRowsInternal(normalized);
  }

  function buildRecoverySummary(preview) {
    const normalized = safeObject(preview);
    const recovery = buildRecoverySummaryInternal(normalized);
    const cloned = clonePlain(recovery);
    delete cloned.__built;
    return cloned;
  }

  const api = {
    buildPreview,
    buildProjectSummary,
    buildHarnessRows,
    buildRecoverySummary,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }

  global.G281ExecutionPreview = api;

  // API shape:
  // - buildPreview({ runtime, model, salesRuleSnapshot }) => { quoteContext, project, annual, harnessRows, recovery, alerts, ... }
  // - buildProjectSummary(preview) => project summary object
  // - buildHarnessRows(preview) => harness-level execution rows
  // - buildRecoverySummary(preview) => recovery aggregation object
})(typeof window !== 'undefined' ? window : globalThis);

