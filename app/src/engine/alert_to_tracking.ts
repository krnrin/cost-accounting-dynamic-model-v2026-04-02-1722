/**
 * Alert to Tracking (C24 — Issue #76)
 * 
 * 预警→跟踪项联动
 * - 预警自动/手动转为跟踪项
 * - 跟踪项生命周期(待处理→进行中→已解决)
 * - 升级规则: 超期/高频自动升级严重等级
 */

// ─── Types ───

export interface TrackingItem {
  id: string;
  sourceAlertId: string;
  title: string;
  description: string;
  severity: 'critical' | 'warning' | 'info';
  status: TrackingStatus;
  assignee: string | null;
  createdAt: string;
  updatedAt: string;
  dueDate: string | null;
  resolution: string | null;
  tags: string[];
  escalationLevel: number;
  history: TrackingEvent[];
}

export type TrackingStatus = 'pending' | 'in_progress' | 'resolved' | 'escalated' | 'closed';

export interface TrackingEvent {
  timestamp: string;
  action: string;
  userId: string;
  details: string;
}

export interface EscalationRule {
  id: string;
  name: string;
  condition: EscalationCondition;
  action: EscalationAction;
  enabled: boolean;
}

export interface EscalationCondition {
  type: 'overdue_days' | 'repeat_count' | 'severity_threshold';
  value: number;
}

export interface EscalationAction {
  type: 'upgrade_severity' | 'notify' | 'auto_assign';
  target: string;
}

export interface TrackingSummary {
  totalItems: number;
  byStatus: Record<TrackingStatus, number>;
  bySeverity: Record<string, number>;
  overdueCount: number;
  avgResolutionDays: number;
  escalatedCount: number;
}

// ─── Core Functions ───

/** Convert an alert into a tracking item */
export function alertToTrackingItem(
  alertId: string,
  title: string,
  description: string,
  severity: TrackingItem['severity'],
  assignee: string | null = null,
  dueDate: string | null = null,
  tags: string[] = [],
): TrackingItem {
  const now = new Date().toISOString();
  return {
    id: `track-${alertId}-${Date.now().toString(36)}`,
    sourceAlertId: alertId,
    title,
    description,
    severity,
    status: 'pending',
    assignee,
    createdAt: now,
    updatedAt: now,
    dueDate,
    resolution: null,
    tags,
    escalationLevel: 0,
    history: [{
      timestamp: now,
      action: 'created',
      userId: 'system',
      details: `从预警 ${alertId} 创建跟踪项`,
    }],
  };
}

/** Update tracking item status */
export function updateTrackingStatus(
  item: TrackingItem,
  newStatus: TrackingStatus,
  userId: string,
  details: string = '',
): TrackingItem {
  const now = new Date().toISOString();
  return {
    ...item,
    status: newStatus,
    updatedAt: now,
    resolution: newStatus === 'resolved' || newStatus === 'closed' ? details || item.resolution : item.resolution,
    history: [...item.history, {
      timestamp: now,
      action: `status_changed:${newStatus}`,
      userId,
      details: details || `状态变更为 ${newStatus}`,
    }],
  };
}

/** Check and apply escalation rules */
export function applyEscalationRules(
  item: TrackingItem,
  rules: EscalationRule[],
): { item: TrackingItem; escalated: boolean; appliedRules: string[] } {
  let escalated = false;
  const appliedRules: string[] = [];
  let updated = { ...item };

  for (const rule of rules) {
    if (!rule.enabled) continue;

    let conditionMet = false;
    switch (rule.condition.type) {
      case 'overdue_days': {
        if (item.dueDate) {
          const overdueDays = Math.floor(
            (Date.now() - new Date(item.dueDate).getTime()) / (24 * 60 * 60 * 1000)
          );
          conditionMet = overdueDays >= rule.condition.value;
        }
        break;
      }
      case 'severity_threshold': {
        const severityMap = { info: 1, warning: 2, critical: 3 };
        conditionMet = severityMap[item.severity] >= rule.condition.value;
        break;
      }
    }

    if (conditionMet) {
      appliedRules.push(rule.id);
      switch (rule.action.type) {
        case 'upgrade_severity': {
          const upgrades: Record<string, TrackingItem['severity']> = {
            info: 'warning', warning: 'critical',
          };
          if (upgrades[updated.severity]) {
            updated = {
              ...updated,
              severity: upgrades[updated.severity]!,
              escalationLevel: updated.escalationLevel + 1,
              status: 'escalated',
              updatedAt: new Date().toISOString(),
              history: [...updated.history, {
                timestamp: new Date().toISOString(),
                action: 'escalated',
                userId: 'system',
                details: `规则 "${rule.name}" 触发升级: ${updated.severity}`,
              }],
            };
            escalated = true;
          }
          break;
        }
        case 'auto_assign': {
          if (!updated.assignee) {
            updated = {
              ...updated,
              assignee: rule.action.target,
              updatedAt: new Date().toISOString(),
              history: [...updated.history, {
                timestamp: new Date().toISOString(),
                action: 'auto_assigned',
                userId: 'system',
                details: `规则 "${rule.name}" 自动指派给 ${rule.action.target}`,
              }],
            };
          }
          break;
        }
      }
    }
  }

  return { item: updated, escalated, appliedRules };
}

/** Build tracking summary */
export function buildTrackingSummary(items: TrackingItem[]): TrackingSummary {
  const byStatus: Record<TrackingStatus, number> = {
    pending: 0, in_progress: 0, resolved: 0, escalated: 0, closed: 0,
  };
  const bySeverity: Record<string, number> = { critical: 0, warning: 0, info: 0 };
  let overdueCount = 0;
  let totalResolutionDays = 0;
  let resolvedCount = 0;

  for (const item of items) {
    byStatus[item.status] = (byStatus[item.status] || 0) + 1;
    bySeverity[item.severity] = (bySeverity[item.severity] || 0) + 1;

    if (item.dueDate && item.status !== 'resolved' && item.status !== 'closed') {
      if (new Date() > new Date(item.dueDate)) overdueCount++;
    }

    if (item.status === 'resolved' || item.status === 'closed') {
      const created = new Date(item.createdAt).getTime();
      const resolved = new Date(item.updatedAt).getTime();
      totalResolutionDays += (resolved - created) / (24 * 60 * 60 * 1000);
      resolvedCount++;
    }
  }

  return {
    totalItems: items.length,
    byStatus,
    bySeverity,
    overdueCount,
    avgResolutionDays: resolvedCount > 0 ? Math.round(totalResolutionDays / resolvedCount) : 0,
    escalatedCount: byStatus.escalated,
  };
}
