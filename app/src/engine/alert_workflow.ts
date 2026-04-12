/**
 * B10: 预警升级与响应工作流
 * 
 * 预警分级:
 *   info → warning → critical
 * 
 * 支持:
 * - 阈值多级判定
 * - 超时自动升级
 * - 消息通知路由
 * - 操作建议
 */

export type AlertSeverity = 'info' | 'warning' | 'critical';
export type AlertCategory = 'metal_price' | 'cost_drift' | 'bom_anomaly' | 'quote_expiry' | 'scenario_overdue' | 'param_mismatch';

export interface AlertRule {
  id: string;
  category: AlertCategory;
  name: string;
  description: string;
  /** 各级阈值 */
  thresholds: {
    info?: number;
    warning: number;
    critical: number;
  };
  /** 单位 (%, 元, 天 等) */
  unit: string;
  /** 超时升级 (分钟): warning 超时多久升级为 critical */
  escalationTimeoutMinutes?: number;
  /** 通知目标 */
  notifyTargets?: string[];
  /** 启用状态 */
  enabled: boolean;
}

export interface AlertEvent {
  id: string;
  ruleId: string;
  category: AlertCategory;
  severity: AlertSeverity;
  title: string;
  message: string;
  currentValue: number;
  threshold: number;
  /** 触发时间 */
  triggeredAt: string;
  /** 确认时间 */
  acknowledgedAt?: string;
  /** 解决时间 */
  resolvedAt?: string;
  /** 是否已升级 */
  escalated: boolean;
  /** 关联场景/项目 */
  context?: { projectId?: string; scenarioId?: string; harnessId?: string };
  /** 建议操作 */
  suggestedActions: string[];
}

/** 默认预警规则 */
export const DEFAULT_ALERT_RULES: AlertRule[] = [
  {
    id: 'metal-copper-spike',
    category: 'metal_price',
    name: '铜价异动',
    description: '铜价偏离基准价超过阈值时预警',
    thresholds: { info: 3, warning: 5, critical: 10 },
    unit: '%',
    escalationTimeoutMinutes: 120,
    enabled: true,
  },
  {
    id: 'metal-aluminum-spike',
    category: 'metal_price',
    name: '铝价异动',
    description: '铝价偏离基准价超过阈值时预警',
    thresholds: { info: 3, warning: 5, critical: 10 },
    unit: '%',
    escalationTimeoutMinutes: 120,
    enabled: true,
  },
  {
    id: 'cost-drift',
    category: 'cost_drift',
    name: '成本漂移',
    description: '线束计算成本与上次报价偏差超过阈值',
    thresholds: { info: 2, warning: 5, critical: 10 },
    unit: '%',
    escalationTimeoutMinutes: 480,
    enabled: true,
  },
  {
    id: 'bom-qty-anomaly',
    category: 'bom_anomaly',
    name: 'BOM用量异常',
    description: 'BOM单项用量偏离历史均值超过阈值',
    thresholds: { warning: 50, critical: 100 },
    unit: '%',
    enabled: true,
  },
  {
    id: 'quote-expiry',
    category: 'quote_expiry',
    name: '报价即将过期',
    description: '报价单距离过期日不足阈值天数',
    thresholds: { warning: 14, critical: 3 },
    unit: '天',
    enabled: true,
  },
  {
    id: 'scenario-overdue',
    category: 'scenario_overdue',
    name: '场景长期未冻结',
    description: '草稿场景超过阈值天数未冻结',
    thresholds: { warning: 30, critical: 60 },
    unit: '天',
    enabled: true,
  },
  {
    id: 'param-mismatch',
    category: 'param_mismatch',
    name: '参数不一致',
    description: '当前使用参数与最新参数配置不一致',
    thresholds: { warning: 1, critical: 3 },
    unit: '项',
    enabled: true,
  },
];

/**
 * 判断预警级别
 */
export function evaluateSeverity(rule: AlertRule, value: number): AlertSeverity | null {
  if (!rule.enabled) return null;
  const abs = Math.abs(value);
  if (abs >= rule.thresholds.critical) return 'critical';
  if (abs >= rule.thresholds.warning) return 'warning';
  if (rule.thresholds.info !== undefined && abs >= rule.thresholds.info) return 'info';
  return null;
}

/**
 * 检查是否需要升级预警
 */
export function shouldEscalate(event: AlertEvent, rule: AlertRule, now: Date = new Date()): boolean {
  if (event.severity === 'critical') return false;
  if (event.acknowledgedAt) return false;
  if (!rule.escalationTimeoutMinutes) return false;

  const triggeredAt = new Date(event.triggeredAt);
  const elapsed = (now.getTime() - triggeredAt.getTime()) / 60000;
  return elapsed > rule.escalationTimeoutMinutes;
}

/**
 * 生成预警事件
 */
export function createAlertEvent(
  rule: AlertRule,
  currentValue: number,
  context?: AlertEvent['context']
): AlertEvent | null {
  const severity = evaluateSeverity(rule, currentValue);
  if (!severity) return null;

  const threshold = rule.thresholds[severity] ?? 0;

  const suggestedActions: string[] = [];
  switch (rule.category) {
    case 'metal_price':
      suggestedActions.push('检查最新金属价格行情');
      if (severity === 'critical') suggestedActions.push('考虑启动价格调整流程');
      suggestedActions.push('查看受影响的线束和场景');
      break;
    case 'cost_drift':
      suggestedActions.push('对比最新BOM成本与报价基准');
      suggestedActions.push('检查是否需要更新报价');
      break;
    case 'bom_anomaly':
      suggestedActions.push('检查BOM数据是否正确');
      suggestedActions.push('核实最近的设变记录');
      break;
    case 'quote_expiry':
      suggestedActions.push('联系客户确认报价延期或更新');
      break;
    case 'scenario_overdue':
      suggestedActions.push('检查场景数据是否完整');
      suggestedActions.push('考虑冻结或归档');
      break;
    case 'param_mismatch':
      suggestedActions.push('同步最新参数配置');
      suggestedActions.push('查看参数快照对比');
      break;
  }

  return {
    id: `alert-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    ruleId: rule.id,
    category: rule.category,
    severity,
    title: `[${severity.toUpperCase()}] ${rule.name}`,
    message: `${rule.description}: 当前值 ${currentValue}${rule.unit}，阈值 ${threshold}${rule.unit}`,
    currentValue,
    threshold,
    triggeredAt: new Date().toISOString(),
    escalated: false,
    context,
    suggestedActions,
  };
}

/**
 * 批量检查预警规则
 */
export function runAlertChecks(
  rules: AlertRule[],
  values: Record<string, number>,
  context?: AlertEvent['context']
): AlertEvent[] {
  const events: AlertEvent[] = [];
  for (const rule of rules) {
    const value = values[rule.id];
    if (value !== undefined) {
      const event = createAlertEvent(rule, value, context);
      if (event) events.push(event);
    }
  }
  return events;
}
