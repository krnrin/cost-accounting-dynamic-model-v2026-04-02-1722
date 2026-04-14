/**
 * C9: 金属价格联动反应引擎
 *
 * 当金属价格变更时，自动：
 * 1. 识别所有受影响的场景/项目
 * 2. 计算每个线束的成本影响
 * 3. 生成超阈值的预警事件
 * 4. 输出反应计划供 UI 确认/执行
 *
 * 对应 Issue #61 [F08/T31] 金属价格联动计算与预警触发
 */

import type { MetalPrices } from '@/types/project';
import type { HarnessResult } from '@/types/harness';
import { computeMetalAlerts, estimateMetalImpact, type MetalAlertThresholds, type MetalAlertResult } from './metal_alert';

// ─── Types ─────────────────────────────────────────────────────

export interface MetalPriceChange {
  oldPrices: MetalPrices;
  newPrices: MetalPrices;
  source: 'manual' | 'settings_page' | 'api_sync' | 'import';
  changedAt: string; // ISO timestamp
  changedBy?: string;
}

export interface AffectedScenario {
  scenarioId: string;
  scenarioName: string;
  projectId: string;
  projectName: string;
  status: string;
  /** 场景使用的基准金属价格 */
  basePrices: MetalPrices;
}

export interface HarnessCostImpact {
  harnessId: string;
  harnessName: string;
  scenarioId: string;
  /** 铜价影响 (元/车) */
  copperImpact: number;
  /** 铝价影响 (元/车) */
  aluminumImpact: number;
  /** 总金属影响 (元/车) */
  totalImpact: number;
  /** 影响占原到厂价百分比 */
  impactPct: number;
  /** 原到厂价 */
  originalDeliveredPrice: number;
  /** 新到厂价（估算） */
  estimatedNewPrice: number;
  copperWeight: number;
  aluminumWeight: number;
}

export interface ScenarioCostImpact {
  scenario: AffectedScenario;
  harnessImpacts: HarnessCostImpact[];
  /** 场景总铜价影响 */
  totalCopperImpact: number;
  /** 场景总铝价影响 */
  totalAluminumImpact: number;
  /** 场景总金属影响 */
  totalImpact: number;
  /** 预警结果 */
  alert: MetalAlertResult;
}

export interface AlertEvent {
  id: string;
  type: 'metal_price';
  severity: 'info' | 'warning' | 'critical';
  title: string;
  message: string;
  projectId: string;
  scenarioId: string;
  impactAmount: number;
  metalType: 'copper' | 'aluminum' | 'both';
  deltaPct: number;
  createdAt: string;
  sourceChange: MetalPriceChange;
}

export interface ReactionPlan {
  /** 价格变更信息 */
  change: MetalPriceChange;
  /** 受影响的场景列表 */
  scenarioImpacts: ScenarioCostImpact[];
  /** 需要生成的预警事件 */
  alertEvents: AlertEvent[];
  /** 汇总统计 */
  summary: {
    totalScenariosAffected: number;
    totalHarnessesAffected: number;
    totalImpactAmount: number;
    maxImpactPct: number;
    copperDeltaPct: number;
    aluminumDeltaPct: number;
    /** 是否有需要立即关注的危险级预警 */
    hasCritical: boolean;
  };
}

// ─── Helpers ───────────────────────────────────────────────────

function generateId(): string {
  return crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function deltaPct(oldVal: number, newVal: number): number {
  if (oldVal === 0) return newVal === 0 ? 0 : 100;
  return ((newVal - oldVal) / oldVal) * 100;
}

function severityFromAlert(alert: MetalAlertResult): 'info' | 'warning' | 'critical' {
  if (alert.maxLevel === 'danger') return 'critical';
  if (alert.maxLevel === 'warn') return 'warning';
  return 'info';
}

// ─── Core Reactor ──────────────────────────────────────────────

/**
 * 计算单个场景的金属价格影响
 */
export function computeScenarioImpact(
  scenario: AffectedScenario,
  change: MetalPriceChange,
  harnessResults: Array<{
    harnessId: string;
    harnessName: string;
    result: HarnessResult;
    copperWeight: number;
    aluminumWeight: number;
  }>,
  thresholds?: MetalAlertThresholds
): ScenarioCostImpact {
  const harnessImpacts: HarnessCostImpact[] = harnessResults.map(h => {
    const { cuImpact, alImpact, totalImpact } = estimateMetalImpact(
      scenario.basePrices,
      change.newPrices,
      h.copperWeight,
      h.aluminumWeight
    );

    const originalPrice = h.result.deliveredPrice || 0;
    const impactPct = originalPrice !== 0 ? (totalImpact / originalPrice) * 100 : 0;

    return {
      harnessId: h.harnessId,
      harnessName: h.harnessName,
      scenarioId: scenario.scenarioId,
      copperImpact: cuImpact,
      aluminumImpact: alImpact,
      totalImpact,
      impactPct,
      originalDeliveredPrice: originalPrice,
      estimatedNewPrice: originalPrice + totalImpact,
      copperWeight: h.copperWeight,
      aluminumWeight: h.aluminumWeight,
    };
  });

  const totalCopperImpact = harnessImpacts.reduce((s, h) => s + h.copperImpact, 0);
  const totalAluminumImpact = harnessImpacts.reduce((s, h) => s + h.aluminumImpact, 0);
  const totalImpact = totalCopperImpact + totalAluminumImpact;

  const alert = computeMetalAlerts(scenario.basePrices, change.newPrices, thresholds);

  return {
    scenario,
    harnessImpacts,
    totalCopperImpact,
    totalAluminumImpact,
    totalImpact,
    alert,
  };
}

/**
 * 为有预警的场景生成预警事件
 */
export function generateAlertEvents(
  scenarioImpact: ScenarioCostImpact,
  change: MetalPriceChange
): AlertEvent[] {
  if (!scenarioImpact.alert.hasAlert) return [];

  const events: AlertEvent[] = [];
  const severity = severityFromAlert(scenarioImpact.alert);
  const scenario = scenarioImpact.scenario;

  // 为每个触发预警的金属生成一条事件
  for (const item of scenarioImpact.alert.items) {
    if (item.level === 'normal') continue;

    events.push({
      id: generateId(),
      type: 'metal_price',
      severity,
      title: `${item.label}${item.deltaPct > 0 ? '上涨' : '下跌'}预警 — ${scenario.projectName}/${scenario.scenarioName}`,
      message: item.message,
      projectId: scenario.projectId,
      scenarioId: scenario.scenarioId,
      impactAmount: item.metal === 'copper'
        ? scenarioImpact.totalCopperImpact
        : scenarioImpact.totalAluminumImpact,
      metalType: item.metal,
      deltaPct: item.deltaPct,
      createdAt: change.changedAt,
      sourceChange: change,
    });
  }

  return events;
}

/**
 * 生成完整反应计划
 *
 * @param change - 价格变更信息
 * @param affectedScenarios - 受影响的场景列表
 * @param getHarnessResults - 获取场景线束结果的回调
 * @param thresholds - 预警阈值
 */
export async function buildReactionPlan(
  change: MetalPriceChange,
  affectedScenarios: AffectedScenario[],
  getHarnessResults: (scenarioId: string) => Promise<Array<{
    harnessId: string;
    harnessName: string;
    result: HarnessResult;
    copperWeight: number;
    aluminumWeight: number;
  }>>,
  thresholds?: MetalAlertThresholds
): Promise<ReactionPlan> {
  const scenarioImpacts: ScenarioCostImpact[] = [];
  const alertEvents: AlertEvent[] = [];

  for (const scenario of affectedScenarios) {
    const harnessResults = await getHarnessResults(scenario.scenarioId);
    const impact = computeScenarioImpact(scenario, change, harnessResults, thresholds);
    scenarioImpacts.push(impact);

    const events = generateAlertEvents(impact, change);
    alertEvents.push(...events);
  }

  // 汇总统计
  const totalImpactAmount = scenarioImpacts.reduce((s, si) => s + Math.abs(si.totalImpact), 0);
  const allHarnessImpacts = scenarioImpacts.flatMap(si => si.harnessImpacts);
  const maxImpactPct = allHarnessImpacts.length > 0
    ? Math.max(...allHarnessImpacts.map(h => Math.abs(h.impactPct)))
    : 0;

  const cuOld = change.oldPrices.copper || 0;
  const cuNew = change.newPrices.copper || 0;
  const alOld = change.oldPrices.aluminum || 0;
  const alNew = change.newPrices.aluminum || 0;

  return {
    change,
    scenarioImpacts,
    alertEvents,
    summary: {
      totalScenariosAffected: scenarioImpacts.filter(si => Math.abs(si.totalImpact) > 0.01).length,
      totalHarnessesAffected: allHarnessImpacts.filter(h => Math.abs(h.totalImpact) > 0.01).length,
      totalImpactAmount,
      maxImpactPct,
      copperDeltaPct: deltaPct(cuOld, cuNew),
      aluminumDeltaPct: deltaPct(alOld, alNew),
      hasCritical: alertEvents.some(e => e.severity === 'critical'),
    },
  };
}

/**
 * 快速估算金属价格影响（无需异步加载线束数据）
 * 用于 SettingsPage 即时预览
 */
export function quickEstimate(
  oldPrices: MetalPrices,
  newPrices: MetalPrices,
  totalCopperWeight: number,
  totalAluminumWeight: number
): {
  copperImpact: number;
  aluminumImpact: number;
  totalImpact: number;
  copperDeltaPct: number;
  aluminumDeltaPct: number;
  alert: MetalAlertResult;
} {
  const impact = estimateMetalImpact(oldPrices, newPrices, totalCopperWeight, totalAluminumWeight);
  const alert = computeMetalAlerts(oldPrices, newPrices);

  return {
    copperImpact: impact.cuImpact,
    aluminumImpact: impact.alImpact,
    totalImpact: impact.totalImpact,
    copperDeltaPct: deltaPct(oldPrices.copper || 0, newPrices.copper || 0),
    aluminumDeltaPct: deltaPct(oldPrices.aluminum || 0, newPrices.aluminum || 0),
    alert,
  };
}
