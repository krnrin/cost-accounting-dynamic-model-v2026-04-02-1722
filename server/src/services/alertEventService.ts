import prisma from '../lib/prisma.js';
import { fromJson, toJson } from '../lib/json.js';
import { AlertRuleService } from './alertRuleService.js';

type DetectionContext = {
  projectId: string;
  scenarioId?: string | null;
  ruleId?: string | null;
  category: string;
  severity: string;
  title: string;
  detail?: string;
  sourceObjectType?: string | null;
  sourceObjectId?: string | null;
  impactAmount?: number;
  metadata?: Record<string, any>;
  dedupeKey?: string;
};

function normalizeEvent(event: any) {
  return {
    ...event,
    metadata: fromJson(event.metadata, {}),
  };
}

function toNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function compareValues(actual: unknown, operator: string, threshold: unknown) {
  if (operator === 'contains') {
    return String(actual ?? '').includes(String(threshold ?? ''));
  }

  const actualNumber = toNumber(actual, Number.NaN);
  const thresholdNumber = toNumber(threshold, Number.NaN);
  if (Number.isNaN(actualNumber) || Number.isNaN(thresholdNumber)) return false;

  switch (operator) {
    case 'gt': return actualNumber > thresholdNumber;
    case 'gte': return actualNumber >= thresholdNumber;
    case 'lt': return actualNumber < thresholdNumber;
    case 'lte': return actualNumber <= thresholdNumber;
    case 'eq': return actualNumber === thresholdNumber;
    case 'neq': return actualNumber !== thresholdNumber;
    default: return false;
  }
}

export class AlertEventService {
  static async list(filters: {
    projectId?: string;
    category?: string;
    severity?: string;
    status?: string;
  } = {}) {
    const rows = await prisma.alertEvent.findMany({
      where: {
        ...(filters.projectId ? { projectId: filters.projectId } : {}),
        ...(filters.category ? { category: filters.category } : {}),
        ...(filters.severity ? { severity: filters.severity } : {}),
        ...(filters.status ? { status: filters.status } : {}),
      },
      orderBy: [
        { occurredAt: 'desc' },
        { createdAt: 'desc' },
      ],
    });

    return rows.map(normalizeEvent);
  }

  static async getById(id: string) {
    const row = await prisma.alertEvent.findUnique({ where: { id } });
    if (!row) {
      const err: any = new Error('Alert event not found');
      err.status = 404;
      throw err;
    }
    return normalizeEvent(row);
  }

  static async update(id: string, data: any) {
    const current = await this.getById(id);
    const nextStatus = data.status ?? current.status;

    const payload = {
      ...data,
      ...(data.metadata !== undefined ? { metadata: toJson(data.metadata) } : {}),
      acknowledgedAt: nextStatus === 'acknowledged'
        ? (current.acknowledgedAt ?? new Date())
        : data.status === 'active'
          ? null
          : current.acknowledgedAt,
      resolvedAt: nextStatus === 'resolved' || nextStatus === 'dismissed'
        ? (current.resolvedAt ?? new Date())
        : data.status === 'active' || data.status === 'acknowledged'
          ? null
          : current.resolvedAt,
    };

    const row = await prisma.alertEvent.update({
      where: { id },
      data: payload,
    });

    return normalizeEvent(row);
  }

  static async create(data: DetectionContext) {
    const row = await prisma.alertEvent.create({
      data: {
        projectId: data.projectId,
        scenarioId: data.scenarioId ?? null,
        ruleId: data.ruleId ?? null,
        category: data.category,
        severity: data.severity,
        status: 'active',
        title: data.title,
        detail: data.detail,
        sourceObjectType: data.sourceObjectType ?? null,
        sourceObjectId: data.sourceObjectId ?? null,
        impactAmount: data.impactAmount ?? 0,
        metadata: toJson(data.metadata ?? {}),
      },
    });
    return normalizeEvent(row);
  }

  static async createOrReactivate(data: DetectionContext) {
    const activeLike = await prisma.alertEvent.findFirst({
      where: {
        projectId: data.projectId,
        category: data.category,
        sourceObjectType: data.sourceObjectType ?? null,
        sourceObjectId: data.sourceObjectId ?? null,
        status: { in: ['active', 'acknowledged'] },
      },
      orderBy: [{ occurredAt: 'desc' }, { createdAt: 'desc' }],
    });

    if (activeLike) {
      const mergedMetadata = {
        ...fromJson(activeLike.metadata, {}),
        ...(data.metadata ?? {}),
      };
      const updated = await prisma.alertEvent.update({
        where: { id: activeLike.id },
        data: {
          ruleId: data.ruleId ?? activeLike.ruleId,
          severity: data.severity,
          title: data.title,
          detail: data.detail,
          impactAmount: data.impactAmount ?? activeLike.impactAmount,
          metadata: toJson(mergedMetadata),
          occurredAt: new Date(),
        },
      });
      return normalizeEvent(updated);
    }

    const latestClosed = await prisma.alertEvent.findFirst({
      where: {
        projectId: data.projectId,
        category: data.category,
        sourceObjectType: data.sourceObjectType ?? null,
        sourceObjectId: data.sourceObjectId ?? null,
      },
      orderBy: [{ occurredAt: 'desc' }, { createdAt: 'desc' }],
    });

    if (latestClosed) {
      const updated = await prisma.alertEvent.update({
        where: { id: latestClosed.id },
        data: {
          ruleId: data.ruleId ?? latestClosed.ruleId,
          scenarioId: data.scenarioId ?? latestClosed.scenarioId,
          severity: data.severity,
          status: 'active',
          title: data.title,
          detail: data.detail,
          sourceObjectType: data.sourceObjectType ?? latestClosed.sourceObjectType,
          sourceObjectId: data.sourceObjectId ?? latestClosed.sourceObjectId,
          impactAmount: data.impactAmount ?? latestClosed.impactAmount,
          metadata: toJson(data.metadata ?? {}),
          occurredAt: new Date(),
          acknowledgedAt: null,
          resolvedAt: null,
        },
      });
      return normalizeEvent(updated);
    }

    return this.create(data);
  }

  static async detectAndSync() {
    const createdOrUpdated: any[] = [];
    createdOrUpdated.push(...await this.syncMetalPriceAlerts());
    createdOrUpdated.push(...await this.syncAllocationRecoveryAlerts());
    createdOrUpdated.push(...await this.syncCostAnomalyAlerts());
    createdOrUpdated.push(...await this.syncDeadlineAlerts());
    return {
      count: createdOrUpdated.length,
      items: createdOrUpdated,
    };
  }

  static async syncMetalPriceAlerts() {
    const rules = await AlertRuleService.listEnabled('metal_price');
    const projects = await prisma.project.findMany({
      include: {
        scenarios: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });
    const thresholdSettings = await prisma.setting.findMany({ where: { category: 'alert_threshold' } });
    const thresholdMap = new Map(thresholdSettings.map((item) => [item.key, fromJson(item.value, item.value)]));
    const systemEnabled = Boolean(thresholdMap.get('enabled') ?? true);
    if (!systemEnabled) return [];

    const results: any[] = [];
    for (const project of projects) {
      const projectMetalPrices = fromJson<Record<string, any>>(project.metalPrices, {});
      const latestScenario = project.scenarios[0];
      const snapshotPrices = fromJson<Record<string, any>>(latestScenario?.quoteParamSnapshot, {})?.metalPrices ?? {};
      const pairs = [
        { metal: 'copper', current: projectMetalPrices.copper, baseline: snapshotPrices.copper, metric: 'copper_delta_pct', threshold: toNumber(thresholdMap.get('copperPercent'), 5), label: '铜价' },
        { metal: 'aluminum', current: projectMetalPrices.aluminum, baseline: snapshotPrices.aluminum, metric: 'aluminum_delta_pct', threshold: toNumber(thresholdMap.get('aluminumPercent'), 5), label: '铝价' },
      ];

      for (const pair of pairs) {
        const baseline = toNumber(pair.baseline, 0);
        const current = toNumber(pair.current, baseline);
        if (baseline <= 0) continue;
        const deltaPct = ((current - baseline) / baseline) * 100;
        const matchedRule = rules.find((rule) => compareValues(Math.abs(deltaPct), rule.condition?.operator ?? 'gte', rule.condition?.threshold ?? pair.threshold));
        const exceeded = Math.abs(deltaPct) >= pair.threshold || Boolean(matchedRule);
        if (!exceeded) continue;

        results.push(await this.createOrReactivate({
          projectId: project.id,
          scenarioId: latestScenario?.id ?? null,
          ruleId: matchedRule?.id ?? null,
          category: 'metal_price',
          severity: matchedRule?.severity ?? (Math.abs(deltaPct) >= pair.threshold * 2 ? 'critical' : 'warning'),
          title: `${pair.label}变动超阈值`,
          detail: `${pair.label}较基准变动 ${deltaPct.toFixed(2)}%，已超过阈值 ${pair.threshold}%。`,
          sourceObjectType: 'project',
          sourceObjectId: project.id,
          impactAmount: 0,
          metadata: {
            metal: pair.metal,
            deltaPct,
            currentPrice: current,
            baselinePrice: baseline,
            threshold: pair.threshold,
            metric: pair.metric,
          },
        }));
      }
    }
    return results;
  }

  static async syncAllocationRecoveryAlerts() {
    const rules = await AlertRuleService.listEnabled('allocation_recovery');
    const allocations = await prisma.allocationItem.findMany();
    const results: any[] = [];

    for (const allocation of allocations) {
      const targetDate = allocation.targetRecoveryDate ? new Date(allocation.targetRecoveryDate) : null;
      const overdueDays = targetDate ? Math.floor((Date.now() - targetDate.getTime()) / 86400000) : 0;
      const lagPercent = Math.max(0, (1 - toNumber(allocation.recoveryProgress, 0)) * 100);
      const matchedRule = rules.find((rule) => {
        const metric = rule.condition?.metric;
        if (metric === 'overdue_days') return compareValues(overdueDays, rule.condition?.operator ?? 'gt', rule.condition?.threshold ?? 0);
        return compareValues(lagPercent, rule.condition?.operator ?? 'gte', rule.condition?.threshold ?? 10);
      });
      const shouldAlert = allocation.status !== 'completed' && (lagPercent >= 10 || overdueDays > 0 || Boolean(matchedRule));
      if (!shouldAlert) continue;

      results.push(await this.createOrReactivate({
        projectId: allocation.projectId,
        scenarioId: allocation.scenarioId,
        ruleId: matchedRule?.id ?? null,
        category: 'allocation_recovery',
        severity: matchedRule?.severity ?? (overdueDays > 30 || lagPercent >= 30 ? 'critical' : 'warning'),
        title: '分摊回收滞后',
        detail: overdueDays > 0
          ? `分摊项 ${allocation.expenseName} 已逾期 ${overdueDays} 天，当前回收进度 ${(toNumber(allocation.recoveryProgress, 0) * 100).toFixed(1)}%。`
          : `分摊项 ${allocation.expenseName} 回收进度 ${(toNumber(allocation.recoveryProgress, 0) * 100).toFixed(1)}%，低于预期。`,
        sourceObjectType: 'allocation',
        sourceObjectId: allocation.id,
        impactAmount: toNumber(allocation.remainingRecovery, 0),
        metadata: {
          harnessId: allocation.harnessId,
          expenseName: allocation.expenseName,
          lagPercent,
          overdueDays,
          recoveryProgress: toNumber(allocation.recoveryProgress, 0),
          remainingRecovery: toNumber(allocation.remainingRecovery, 0),
        },
      }));
    }
    return results;
  }

  static async syncCostAnomalyAlerts() {
    const rules = await AlertRuleService.listEnabled('cost_anomaly');
    const changes = await prisma.changeEvent.findMany({ where: { status: 'calculated' } });
    const results: any[] = [];

    for (const change of changes) {
      const costImpact = toNumber(change.costImpact, 0);
      const residualImpact = toNumber(change.residualImpact, 0);
      const matchedRule = rules.find((rule) => compareValues(costImpact, rule.condition?.operator ?? 'gte', rule.condition?.threshold ?? 1));
      const shouldAlert = costImpact > 0 || residualImpact > 0 || Boolean(matchedRule);
      if (!shouldAlert) continue;

      results.push(await this.createOrReactivate({
        projectId: change.projectId,
        scenarioId: change.scenarioId,
        ruleId: matchedRule?.id ?? null,
        category: 'cost_anomaly',
        severity: matchedRule?.severity ?? (costImpact >= 10000 || residualImpact > 0 ? 'critical' : 'warning'),
        title: '设变成本异常',
        detail: residualImpact > 0
          ? `设变带来成本影响 ${costImpact.toFixed(2)}，残余材料影响 ${residualImpact.toFixed(2)}。`
          : `设变带来成本影响 ${costImpact.toFixed(2)}，需复核报价与成本。`,
        sourceObjectType: 'change',
        sourceObjectId: change.id,
        impactAmount: costImpact + residualImpact,
        metadata: {
          changeType: change.changeType,
          costImpact,
          residualImpact,
          status: change.status,
        },
      }));
    }
    return results;
  }

  static async syncDeadlineAlerts() {
    const rules = await AlertRuleService.listEnabled('deadline');
    const trackings = await prisma.trackingItem.findMany({ where: { currentStatus: { not: 'closed' } } });
    const results: any[] = [];

    for (const item of trackings) {
      const daysOpen = Math.floor((Date.now() - new Date(item.createdAt).getTime()) / 86400000);
      const matchedRule = rules.find((rule) => compareValues(daysOpen, rule.condition?.operator ?? 'gte', rule.condition?.threshold ?? 30));
      const shouldAlert = item.severity === 'critical' || daysOpen >= 30 || Boolean(matchedRule);
      if (!shouldAlert) continue;

      results.push(await this.createOrReactivate({
        projectId: item.projectId,
        scenarioId: item.scenarioId,
        ruleId: matchedRule?.id ?? null,
        category: 'deadline',
        severity: matchedRule?.severity ?? (item.severity === 'critical' || daysOpen >= 60 ? 'critical' : 'warning'),
        title: '执行节点超期',
        detail: `跟踪项 ${item.title} 已持续 ${daysOpen} 天，当前状态 ${item.currentStatus}。`,
        sourceObjectType: 'tracking',
        sourceObjectId: item.id,
        impactAmount: 0,
        metadata: {
          trackingType: item.trackingType,
          severity: item.severity,
          currentStatus: item.currentStatus,
          daysOpen,
          owner: item.owner,
        },
      }));
    }
    return results;
  }

  static async summary(projectId?: string) {
    const rows = await prisma.alertEvent.findMany({
      where: {
        ...(projectId ? { projectId } : {}),
      },
      select: {
        id: true,
        severity: true,
        status: true,
        impactAmount: true,
      },
    });

    const active = rows.filter((row) => row.status === 'active').length;
    const acknowledged = rows.filter((row) => row.status === 'acknowledged').length;
    const resolved = rows.filter((row) => row.status === 'resolved').length;
    const dismissed = rows.filter((row) => row.status === 'dismissed').length;
    const critical = rows.filter((row) => row.severity === 'critical' && (row.status === 'active' || row.status === 'acknowledged')).length;
    const warning = rows.filter((row) => row.severity === 'warning' && (row.status === 'active' || row.status === 'acknowledged')).length;
    const totalImpact = rows.reduce((sum, row) => sum + Number(row.impactAmount || 0), 0);

    return {
      total: rows.length,
      active,
      acknowledged,
      resolved,
      dismissed,
      critical,
      warning,
      totalImpact,
    };
  }
}
