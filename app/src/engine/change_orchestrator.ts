/**
 * C11: 设变传导链协调器
 *
 * 编排 设变确认 → BOM更新 → 报价重算 → 预警生成 的完整管道
 * PRD 核心经营闭环的「自动传导」层
 *
 * 流程：
 * 1. ECN confirmed → 提取 BOM 变更清单
 * 2. BOM 变更 → 调用 cascade_impact 级联
 * 3. 级联结果 → 调用 harness_costing 重算
 * 4. 成本差异 → 调用 metal_alert / alert_workflow 生成预警
 * 5. 输出 OrchestrationResult 供 UI 确认或自动执行
 *
 * 对应 Issue #60 [F07] 设变→BOM→报价 自动传导链
 */

// ─── Types ────────────────────────────────────────────────────────

export type PropagationStage =
  | 'idle'
  | 'extracting_changes'
  | 'computing_cascade'
  | 'recalculating_cost'
  | 'generating_alerts'
  | 'creating_tracking'
  | 'completed'
  | 'failed';

export interface BomChangeItem {
  partNo: string;
  partName: string;
  changeType: 'add' | 'remove' | 'modify' | 'replace';
  oldQty?: number;
  newQty?: number;
  oldPrice?: number;
  newPrice?: number;
  /** 来自 change_pattern_classifier 的语义模式 */
  semanticMode?: string;
}

export interface CascadeResult {
  assemblyActions: number;
  secondaryActions: number;
  kskActions: number;
  totalActions: number;
  affectedParts: string[];
}

export interface CostRecalcResult {
  harnessId: string;
  harnessName: string;
  oldDeliveredPrice: number;
  newDeliveredPrice: number;
  delta: number;
  deltaPct: number;
}

export interface GeneratedAlert {
  id: string;
  type: 'cost_change' | 'margin_breach' | 'bom_change';
  severity: 'info' | 'warning' | 'critical';
  title: string;
  message: string;
  impactAmount: number;
}

export interface TrackingItem {
  id: string;
  title: string;
  type: 'cost_tracking' | 'price_negotiation' | 'bom_review';
  sourceChangeId: string;
  priority: 'low' | 'medium' | 'high';
}

export interface OrchestrationResult {
  changeId: string;
  scenarioId: string;
  projectId: string;
  stage: PropagationStage;
  /** BOM 变更清单 */
  bomChanges: BomChangeItem[];
  /** 级联影响 */
  cascade: CascadeResult | null;
  /** 成本重算结果 */
  costRecalc: CostRecalcResult[];
  /** 生成的预警 */
  alerts: GeneratedAlert[];
  /** 生成的跟踪项 */
  trackingItems: TrackingItem[];
  /** 总成本影响 */
  totalCostImpact: number;
  /** 总成本影响百分比 */
  totalCostImpactPct: number;
  /** 执行时间 (ms) */
  durationMs: number;
  /** 错误信息 */
  error?: string;
  /** 时间戳 */
  timestamp: string;
}

export interface OrchestrationConfig {
  /** 成本变动超过此百分比生成 warning */
  costWarningThresholdPct: number;
  /** 成本变动超过此百分比生成 critical */
  costCriticalThresholdPct: number;
  /** 利润率低于此值生成 margin_breach */
  marginFloorPct: number;
  /** 是否自动创建跟踪项 */
  autoCreateTracking: boolean;
  /** 是否自动应用 BOM 变更（false = 仅预览） */
  autoApplyBomChanges: boolean;
}

export const DEFAULT_ORCHESTRATION_CONFIG: OrchestrationConfig = {
  costWarningThresholdPct: 2,
  costCriticalThresholdPct: 5,
  marginFloorPct: 3,
  autoCreateTracking: true,
  autoApplyBomChanges: false,
};

// ─── Helpers ─────────────────────────────────────────────────────

function generateId(): string {
  return crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function pctChange(oldVal: number, newVal: number): number {
  if (oldVal === 0) return newVal === 0 ? 0 : 100;
  return ((newVal - oldVal) / oldVal) * 100;
}

// ─── Stage 1: Extract BOM Changes ────────────────────────────────

export function extractBomChanges(
  changeItems: Array<{
    partNo: string;
    partName?: string;
    action: string;
    oldQty?: number;
    newQty?: number;
    oldPrice?: number;
    newPrice?: number;
    semanticMode?: string;
  }>
): BomChangeItem[] {
  return changeItems.map(item => ({
    partNo: item.partNo,
    partName: item.partName || item.partNo,
    changeType: normalizeChangeType(item.action),
    oldQty: item.oldQty,
    newQty: item.newQty,
    oldPrice: item.oldPrice,
    newPrice: item.newPrice,
    semanticMode: item.semanticMode,
  }));
}

function normalizeChangeType(action: string): BomChangeItem['changeType'] {
  const lower = action.toLowerCase();
  if (lower.includes('add') || lower.includes('新增')) return 'add';
  if (lower.includes('remove') || lower.includes('delete') || lower.includes('删除')) return 'remove';
  if (lower.includes('replace') || lower.includes('替换')) return 'replace';
  return 'modify';
}

// ─── Stage 2: Simulate Cascade ───────────────────────────────────

export function simulateCascade(
  bomChanges: BomChangeItem[],
  assemblyCount: number,
  secondaryCount: number,
  kskCount: number
): CascadeResult {
  // 估算级联影响：每个 BOM 变更项可能影响相关联的表
  // 实际应调用 cascade_impact.ts，这里提供估算逻辑
  const replaceChanges = bomChanges.filter(c => c.changeType === 'replace').length;
  const modifyChanges = bomChanges.filter(c => c.changeType === 'modify').length;
  const addRemoveChanges = bomChanges.filter(c => c.changeType === 'add' || c.changeType === 'remove').length;

  // 替换类变更级联影响最大
  const assemblyActions = Math.min(replaceChanges * 2 + modifyChanges, assemblyCount);
  const secondaryActions = Math.min(replaceChanges + Math.floor(modifyChanges * 0.5), secondaryCount);
  const kskActions = Math.min(Math.floor(replaceChanges * 0.5), kskCount);

  const affectedParts = bomChanges.map(c => c.partNo);

  return {
    assemblyActions,
    secondaryActions,
    kskActions,
    totalActions: assemblyActions + secondaryActions + kskActions,
    affectedParts,
  };
}

// ─── Stage 3: Cost Recalc Estimation ─────────────────────────────

export function estimateCostRecalc(
  bomChanges: BomChangeItem[],
  harnessData: Array<{
    harnessId: string;
    harnessName: string;
    deliveredPrice: number;
    /** BOM 中包含受影响物料号的比例 */
    affectedPartRatio: number;
  }>
): CostRecalcResult[] {
  // 计算 BOM 级别的直接成本影响
  let directCostDelta = 0;
  for (const change of bomChanges) {
    const oldCost = (change.oldQty || 0) * (change.oldPrice || 0);
    const newCost = (change.newQty || change.oldQty || 0) * (change.newPrice || change.oldPrice || 0);
    switch (change.changeType) {
      case 'add':
        directCostDelta += newCost;
        break;
      case 'remove':
        directCostDelta -= oldCost;
        break;
      case 'modify':
      case 'replace':
        directCostDelta += (newCost - oldCost);
        break;
    }
  }

  return harnessData.map(h => {
    // 按受影响比例分摊成本影响
    const delta = directCostDelta * h.affectedPartRatio;
    const newPrice = h.deliveredPrice + delta;
    return {
      harnessId: h.harnessId,
      harnessName: h.harnessName,
      oldDeliveredPrice: h.deliveredPrice,
      newDeliveredPrice: newPrice,
      delta,
      deltaPct: pctChange(h.deliveredPrice, newPrice),
    };
  });
}

// ─── Stage 4: Alert Generation ───────────────────────────────────

export function generateAlerts(
  costRecalc: CostRecalcResult[],
  config: OrchestrationConfig,
  changeId: string,
  scenarioName: string
): GeneratedAlert[] {
  const alerts: GeneratedAlert[] = [];

  for (const recalc of costRecalc) {
    const absPct = Math.abs(recalc.deltaPct);

    if (absPct >= config.costCriticalThresholdPct) {
      alerts.push({
        id: generateId(),
        type: 'cost_change',
        severity: 'critical',
        title: `设变导致 ${recalc.harnessName} 成本${recalc.delta > 0 ? '上升' : '下降'} ${absPct.toFixed(1)}%`,
        message: `场景「${scenarioName}」的设变 ${changeId} 导致线束 ${recalc.harnessName} 到厂价从 ${recalc.oldDeliveredPrice.toFixed(2)} 变为 ${recalc.newDeliveredPrice.toFixed(2)}（${recalc.delta >= 0 ? '+' : ''}${recalc.delta.toFixed(2)} 元/车）`,
        impactAmount: recalc.delta,
      });
    } else if (absPct >= config.costWarningThresholdPct) {
      alerts.push({
        id: generateId(),
        type: 'cost_change',
        severity: 'warning',
        title: `设变导致 ${recalc.harnessName} 成本变动 ${absPct.toFixed(1)}%`,
        message: `到厂价变动：${recalc.oldDeliveredPrice.toFixed(2)} → ${recalc.newDeliveredPrice.toFixed(2)}`,
        impactAmount: recalc.delta,
      });
    }
  }

  // BOM 变更通知（总是生成一条 info）
  const totalDelta = costRecalc.reduce((s, r) => s + r.delta, 0);
  if (costRecalc.length > 0 && alerts.length === 0 && Math.abs(totalDelta) > 0.01) {
    alerts.push({
      id: generateId(),
      type: 'bom_change',
      severity: 'info',
      title: `设变 ${changeId} 已完成成本重算`,
      message: `共影响 ${costRecalc.length} 个线束，总成本影响 ${totalDelta >= 0 ? '+' : ''}${totalDelta.toFixed(2)} 元/车`,
      impactAmount: totalDelta,
    });
  }

  return alerts;
}

// ─── Stage 5: Tracking Items ─────────────────────────────────────

export function generateTrackingItems(
  alerts: GeneratedAlert[],
  changeId: string,
  config: OrchestrationConfig
): TrackingItem[] {
  if (!config.autoCreateTracking) return [];

  const items: TrackingItem[] = [];

  const criticalAlerts = alerts.filter(a => a.severity === 'critical');
  if (criticalAlerts.length > 0) {
    items.push({
      id: generateId(),
      title: `设变 ${changeId} 导致关键成本变动，需评估报价调整`,
      type: 'price_negotiation',
      sourceChangeId: changeId,
      priority: 'high',
    });
  }

  const warningAlerts = alerts.filter(a => a.severity === 'warning');
  if (warningAlerts.length > 0) {
    items.push({
      id: generateId(),
      title: `设变 ${changeId} 成本影响需跟踪`,
      type: 'cost_tracking',
      sourceChangeId: changeId,
      priority: 'medium',
    });
  }

  return items;
}

// ─── Full Orchestration ──────────────────────────────────────────

/**
 * 执行完整的设变传导管道
 *
 * @param changeId - 设变事件 ID
 * @param scenarioId - 场景 ID
 * @param projectId - 项目 ID
 * @param scenarioName - 场景名称
 * @param rawChangeItems - 原始设变行数据
 * @param harnessData - 线束成本数据
 * @param sheetCounts - 级联表行数 { assembly, secondary, ksk }
 * @param config - 配置
 */
export function orchestrate(
  changeId: string,
  scenarioId: string,
  projectId: string,
  scenarioName: string,
  rawChangeItems: Parameters<typeof extractBomChanges>[0],
  harnessData: Parameters<typeof estimateCostRecalc>[1],
  sheetCounts: { assembly: number; secondary: number; ksk: number },
  config?: Partial<OrchestrationConfig>
): OrchestrationResult {
  const startTime = Date.now();
  const cfg = { ...DEFAULT_ORCHESTRATION_CONFIG, ...config };

  try {
    // Stage 1
    const bomChanges = extractBomChanges(rawChangeItems);

    // Stage 2
    const cascade = simulateCascade(
      bomChanges,
      sheetCounts.assembly,
      sheetCounts.secondary,
      sheetCounts.ksk
    );

    // Stage 3
    const costRecalc = estimateCostRecalc(bomChanges, harnessData);

    // Stage 4
    const alerts = generateAlerts(costRecalc, cfg, changeId, scenarioName);

    // Stage 5
    const trackingItems = generateTrackingItems(alerts, changeId, cfg);

    // Summary
    const totalCostImpact = costRecalc.reduce((s, r) => s + r.delta, 0);
    const totalOldPrice = costRecalc.reduce((s, r) => s + r.oldDeliveredPrice, 0);
    const totalCostImpactPct = totalOldPrice !== 0
      ? (totalCostImpact / totalOldPrice) * 100
      : 0;

    return {
      changeId,
      scenarioId,
      projectId,
      stage: 'completed',
      bomChanges,
      cascade,
      costRecalc,
      alerts,
      trackingItems,
      totalCostImpact,
      totalCostImpactPct,
      durationMs: Date.now() - startTime,
      timestamp: new Date().toISOString(),
    };
  } catch (e) {
    return {
      changeId,
      scenarioId,
      projectId,
      stage: 'failed',
      bomChanges: [],
      cascade: null,
      costRecalc: [],
      alerts: [],
      trackingItems: [],
      totalCostImpact: 0,
      totalCostImpactPct: 0,
      durationMs: Date.now() - startTime,
      error: e instanceof Error ? e.message : '传导管道执行失败',
      timestamp: new Date().toISOString(),
    };
  }
}
