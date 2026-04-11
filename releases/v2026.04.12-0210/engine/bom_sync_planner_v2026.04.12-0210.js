;(function (global) {
  'use strict';

  const Shared = global.G281Shared || {};
  const numberOr = Shared.numberOr || ((value, fallback) => {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : (fallback == null ? 0 : fallback);
  });

  const STEP_ORDER = ['ksk', 'secondary', 'changeHistory'];

  function summaryText(summary) {
    const safeSummary = summary || {};
    const fragments = [];
    if (numberOr(safeSummary.added, 0) > 0) fragments.push(`新增 ${safeSummary.added} 项`);
    if (numberOr(safeSummary.removed, 0) > 0) fragments.push(`删除 ${safeSummary.removed} 项`);
    if (numberOr(safeSummary.quantityChanges, 0) > 0) fragments.push(`数量变更 ${safeSummary.quantityChanges} 项`);
    if (numberOr(safeSummary.fieldChanges, 0) > 0) fragments.push(`字段变更 ${safeSummary.fieldChanges} 项`);
    return fragments.join(' / ') || '无结构变更';
  }

  function planSync(changeSet) {
    if (!changeSet || changeSet.status !== 'ready') {
      return { status: 'missing', reason: 'changeSetMissing', hasChanges: false, plannedSteps: [] };
    }

    const summary = changeSet.summary || {};
    const hasChanges = Boolean(changeSet.hasChanges)
      || Object.keys(summary).some((key) => numberOr(summary[key], 0) > 0);

    if (!hasChanges) {
      return {
        status: 'ready',
        changeSet,
        summary,
        summaryText: '无结构变更',
        hasChanges: false,
        plannedSteps: [],
        hints: ['noChangesDetected'],
      };
    }

    const plannedSteps = [
      {
        phase: 'ksk',
        label: 'KSK线束BOM明细',
        description: '先检查 KSK 明细中的受影响行，并确认新增/删除/数量改动的落位。',
        impacts: ['secondary', 'changeHistory'],
      },
      {
        phase: 'secondary',
        label: '二次物料明细',
        description: '复核由 KSK 驱动的公式结果，仅在映射键缺失时处理行位增删。',
        impacts: ['changeHistory'],
      },
      {
        phase: 'changeHistory',
        label: '变更履历',
        description: '全部确认后追加一条 7 列格式的变更履历记录。',
        impacts: [],
      },
    ];

    return {
      status: 'ready',
      changeSet,
      summary,
      summaryText: summaryText(summary),
      hasChanges: true,
      plannedSteps: STEP_ORDER.map((phase) => plannedSteps.find((step) => step.phase === phase)).filter(Boolean),
      hints: ['followSequentialWizard'],
    };
  }

  global.G281BomSyncPlanner = {
    STEP_ORDER: STEP_ORDER.slice(),
    summaryText,
    planSync,
  };
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this);
