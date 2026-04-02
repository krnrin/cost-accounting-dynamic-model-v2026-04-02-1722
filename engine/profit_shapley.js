(function (global) {
  'use strict';

  const FACTOR_DEFS = [
    {
      key: 'bom',
      label: 'BOM版本',
      draftKeys: ['bomWireDrawing', 'bomWireEat', 'bomWireHidden', 'bomTapeDiameter', 'bomTapeWidth', 'bomTapeOverlap'],
    },
    {
      key: 'metal',
      label: '铜铝基价',
      draftKeys: ['copperPrice', 'aluminumPrice'],
    },
    {
      key: 'connector',
      label: '连接器价格',
      draftKeys: ['connectorPricing'],
    },
    {
      key: 'labor',
      label: '工时',
      draftKeys: ['directHours', 'directRate', 'manufacturingHours', 'manufacturingRate'],
    },
    {
      key: 'equipment',
      label: '设备资源',
      draftKeys: [],
    },
    {
      key: 'packaging',
      label: '包装物流',
      draftKeys: ['packInner', 'packFreight', 'packWarehouse', 'packOther'],
    },
    {
      key: 'sales',
      label: '销量预测',
      draftKeys: ['volumes'],
    },
    {
      key: 'mix',
      label: '配置比例',
      draftKeys: ['mix'],
    },
    {
      key: 'annualDrop',
      label: '年降',
      draftKeys: [],
    },
    {
      key: 'oneTimeCustomer',
      label: '一次性费用',
      draftKeys: [],
    },
    {
      key: 'rebate',
      label: '返点',
      draftKeys: [],
    },
    {
      key: 'vave',
      label: 'VAVE',
      draftKeys: [],
    },
  ];

  // Issue #10: 委托给 G281Shared（通过 global 安全引用，避免裸变量 ReferenceError）
  const clonePlain = (global.G281Shared && global.G281Shared.clonePlain)
    || function (value, fallback) { try { return JSON.parse(JSON.stringify(value)); } catch (e) { return fallback; } };

  function factorialTable(size) {
    const values = [1];
    for (let index = 1; index <= size; index += 1) {
      values[index] = values[index - 1] * index;
    }
    return values;
  }

  function popcount(mask) {
    let count = 0;
    let next = mask;
    while (next) {
      count += next & 1;
      next >>>= 1;
    }
    return count;
  }

  function resolveSolver() {
    if (!global.G281TargetPriceSolver) {
      throw new Error('G281ProfitShapley requires G281TargetPriceSolver.');
    }
    return global.G281TargetPriceSolver;
  }

  function normalizeScenarios(runtime, draft, scenarioState, baselineState, baselineDraft) {
    const solver = resolveSolver();
    const baselineScenario = solver.buildVersionScenario(
      runtime,
      baselineState || solver.buildQuoteBaselineState(runtime),
      baselineDraft || solver.buildQuoteBaselineDraft(runtime),
    );
    const scenario = solver.buildVersionScenario(runtime, scenarioState, draft);
    return {
      baselineState: baselineScenario.state,
      baselineDraft: baselineScenario.draft,
      scenarioState: scenario.state,
      scenarioDraft: scenario.draft,
    };
  }

  function applyDraftFragment(target, source, keys) {
    (keys || []).forEach((key) => {
      if (!Object.prototype.hasOwnProperty.call(source || {}, key)) return;
      const value = source[key];
      if (Array.isArray(value)) {
        target[key] = value.slice();
        return;
      }
      if (value && typeof value === 'object') {
        target[key] = clonePlain(value, {});
        return;
      }
      target[key] = value;
    });
  }

  function buildStateForMask(mask, scenarioState, baselineState, factors) {
    const nextState = { ...baselineState };
    factors.forEach((factor, index) => {
      if (mask & (1 << index)) {
        nextState[factor.key] = scenarioState[factor.key];
      }
    });
    return nextState;
  }

  function buildDraftForMask(mask, baselineDraft, scenarioDraft, factors) {
    const nextDraft = clonePlain(baselineDraft, {});
    factors.forEach((factor, index) => {
      if (mask & (1 << index)) {
        applyDraftFragment(nextDraft, scenarioDraft, factor.draftKeys);
      }
    });
    nextDraft.scenarioName = scenarioDraft.scenarioName || baselineDraft.scenarioName || 'Scenario';
    return nextDraft;
  }

  function evaluateMask(mask, cache, context) {
    if (cache.has(mask)) {
      return cache.get(mask);
    }
    const state = buildStateForMask(mask, context.scenarioState, context.baselineState, context.factors);
    const draft = buildDraftForMask(mask, context.baselineDraft, context.scenarioDraft, context.factors);
    const model = context.engine.computeModel(context.runtime, draft, state);
    const result = {
      mask,
      state,
      draft,
      model,
      margin: Number(model?.margin) || 0,
    };
    cache.set(mask, result);
    return result;
  }

  function computeShapley(options) {
    const engine = options?.engine;
    const runtime = options?.runtime;
    if (!engine || typeof engine.computeModel !== 'function') {
      throw new Error('G281ProfitShapley requires engine.computeModel(...).');
    }
    if (!runtime?.master) {
      throw new Error('G281ProfitShapley requires runtime.master.');
    }

    const factors = Array.isArray(options?.factors) && options.factors.length ? options.factors : FACTOR_DEFS;
    const dimension = factors.length;
    if (dimension > 15) {
      throw new Error(`Shapley: factor count ${dimension} exceeds maximum 15 (would require ${2 ** dimension} evaluations).`);
    }
    const scenarios = normalizeScenarios(
      runtime,
      options?.draft || {},
      options?.scenarioState || {},
      options?.baselineState,
      options?.baselineDraft,
    );
    const context = {
      engine,
      runtime,
      factors,
      baselineState: scenarios.baselineState,
      baselineDraft: scenarios.baselineDraft,
      scenarioState: scenarios.scenarioState,
      scenarioDraft: scenarios.scenarioDraft,
    };

    // dimension already declared above
    const maxMask = (1 << dimension) - 1;
    const factorials = factorialTable(dimension);
    const cache = new Map();
    const contributions = new Array(dimension).fill(0);

    const baselineResult = evaluateMask(0, cache, context);
    const scenarioResult = evaluateMask(maxMask, cache, context);

    for (let mask = 0; mask <= maxMask; mask += 1) {
      const subset = evaluateMask(mask, cache, context);
      const subsetSize = popcount(mask);
      const weightBase = factorials[subsetSize] * factorials[dimension - subsetSize - 1] / factorials[dimension];

      for (let index = 0; index < dimension; index += 1) {
        const bit = 1 << index;
        if (mask & bit) continue;
        const next = evaluateMask(mask | bit, cache, context);
        contributions[index] += (next.margin - subset.margin) * weightBase;
      }
    }

    const totalDelta = scenarioResult.margin - baselineResult.margin;

    return {
      baseline: {
        margin: baselineResult.margin,
        state: baselineResult.state,
        draft: baselineResult.draft,
        model: baselineResult.model,
      },
      scenario: {
        margin: scenarioResult.margin,
        state: scenarioResult.state,
        draft: scenarioResult.draft,
        model: scenarioResult.model,
      },
      delta: totalDelta,
      contributions: factors.map((factor, index) => ({
        key: factor.key,
        label: factor.label,
        marginContribution: contributions[index],
        share: totalDelta ? contributions[index] / totalDelta : 0,
        baseState: scenarios.baselineState[factor.key],
        scenarioState: scenarios.scenarioState[factor.key],
      })),
      summary: {
        sumContribution: contributions.reduce((sum, value) => sum + value, 0),
        totalDelta,
      },
    };
  }

  global.G281ProfitShapley = {
    compute: computeShapley,
    defaultBaselineState: {
      bom: 'freeze',
      metal: 'quote',
      connector: 'batch',
      labor: 'base',
      equipment: 'base',
      packaging: 'base',
      sales: 'quote',
      mix: 'quote',
      vave: 'none',
    },
    defaultFactors: FACTOR_DEFS,
  };
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this);
