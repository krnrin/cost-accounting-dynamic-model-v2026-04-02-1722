import prisma from '../lib/prisma.js';
import { fromJson, toJson } from '../lib/json.js';
import { AlertEventService } from './alertEventService.js';

type ResidualCandidate = {
  id: string;
  harnessId: string;
  partNo: string;
  partName: string;
  supplier?: string;
  itemCategory?: string;
  qty: number;
  unitPrice: number;
  deltaAmount: number;
  stagnantStatus: 'candidate';
  detectedAt: string;
  hasStock: null;
  stockQty: null;
  stockValue: null;
  notes: string;
};

function toNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeImpact(data: any) {
  return {
    ...data,
    affectedHarnessIds: Array.isArray(data.affectedHarnessIds) ? data.affectedHarnessIds : [],
    affectedBomRows: Array.isArray(data.affectedBomRows) ? data.affectedBomRows : [],
    costImpact: toNumber(data.costImpact || 0),
    quoteImpact: toNumber(data.quoteImpact || 0),
    residualImpact: toNumber(data.residualImpact || 0),
  };
}

function hydrate(event: any) {
  return {
    ...event,
    affectedHarnessIds: fromJson(event.affectedHarnessIds, []),
    affectedBomRows: fromJson(event.affectedBomRows, []),
  };
}

function buildResidualCandidates(changeId: string, rows: any[]): ResidualCandidate[] {
  const now = new Date().toISOString();
  return rows
    .filter((row: any) => ['cancelled', 'removed', 'left_only'].includes(String(row.changeType || '').toLowerCase()))
    .map((row: any, index: number) => ({
      id: `${changeId}::residual::${row.harnessId || 'unknown'}::${row.partNo || index}`,
      harnessId: String(row.harnessId || ''),
      partNo: String(row.partNo || ''),
      partName: String(row.partName || ''),
      supplier: row.supplier ? String(row.supplier) : undefined,
      itemCategory: row.itemCategory ? String(row.itemCategory) : undefined,
      qty: toNumber(row.remainingQuantity ?? row.qty ?? row.beforeQty ?? 0),
      unitPrice: toNumber(row.unitPrice ?? row.beforePrice ?? 0),
      deltaAmount: Math.abs(toNumber(row.deltaAmount || 0)),
      stagnantStatus: 'candidate',
      detectedAt: now,
      hasStock: null,
      stockQty: null,
      stockValue: null,
      notes: '\u8bbe\u53d8\u53d6\u6d88\u6599\u53f7\u8fdb\u5165\u6b8b\u4f59\u6750\u6599\u6c60\uff0c\u9700\u8d70\u5446\u6ede\u63d0\u62a5\u6d41\u7a0b\uff0c\u4e0d\u8ba1\u5165\u5f53\u524d\u4ea7\u54c1\u6210\u672c\u3002',
    }));
}

function enrichBomRows(rows: any[], residualCandidates: ResidualCandidate[]) {
  const residualMap = new Map(residualCandidates.map((item) => [`${item.harnessId}::${item.partNo}`, item]));
  return rows.map((row: any) => {
    const candidate = residualMap.get(`${row.harnessId || ''}::${row.partNo || ''}`);
    if (!candidate) return row;
    return {
      ...row,
      residualCandidate: true,
      residualPoolEntry: candidate,
      accountingTreatment: 'stagnant_pool_excluded_from_current_cost',
    };
  });
}

async function upsertTrackingItemBySourceRef(sourceRef: string, createData: any, updateData: any) {
  const existing = await prisma.trackingItem.findFirst({ where: { sourceRef } });
  if (existing) {
    return prisma.trackingItem.update({ where: { id: existing.id }, data: updateData });
  }
  return prisma.trackingItem.create({ data: { ...createData, sourceRef } });
}

async function syncTrackingItems(change: any, costImpact: number, residualCandidates: ResidualCandidate[]) {
  const desiredRefs = new Set<string>();

  if (costImpact !== 0) {
    const sourceRef = `change:${change.id}:impact`;
    desiredRefs.add(sourceRef);
    await upsertTrackingItemBySourceRef(
      sourceRef,
      {
        id: `tracking-${change.id}-impact`,
        projectId: change.projectId,
        scenarioId: change.scenarioId,
        trackingType: 'exception',
        title: `\u8bbe\u53d8\u6210\u672c\u5f71\u54cd\u590d\u6838 - ${change.id}`,
        currentStatus: 'pending',
        severity: Math.abs(costImpact) >= 10000 ? 'critical' : 'high',
        plannedAction: '\u590d\u6838\u8bbe\u53d8\u5f71\u54cd\u662f\u5426\u9700\u8981\u540c\u6b65\u5230\u62a5\u4ef7\u3001\u5206\u644a\u3001\u9884\u8b66\u3002',
        actualResult: `\u6700\u65b0\u6210\u672c\u5f71\u54cd ${costImpact.toFixed(2)}`,
        warningRef: change.id,
      },
      {
        title: `\u8bbe\u53d8\u6210\u672c\u5f71\u54cd\u590d\u6838 - ${change.id}`,
        currentStatus: 'pending',
        severity: Math.abs(costImpact) >= 10000 ? 'critical' : 'high',
        actualResult: `\u6700\u65b0\u6210\u672c\u5f71\u54cd ${costImpact.toFixed(2)}`,
        plannedAction: '\u590d\u6838\u8bbe\u53d8\u5f71\u54cd\u662f\u5426\u9700\u8981\u540c\u6b65\u5230\u62a5\u4ef7\u3001\u5206\u644a\u3001\u9884\u8b66\u3002',
        warningRef: change.id,
      },
    );
  }

  for (const candidate of residualCandidates) {
    const sourceRef = `change:${change.id}:residual:${candidate.harnessId}:${candidate.partNo}`;
    desiredRefs.add(sourceRef);
    await upsertTrackingItemBySourceRef(
      sourceRef,
      {
        id: `tracking-${change.id}-residual-${candidate.harnessId}-${candidate.partNo}`,
        projectId: change.projectId,
        scenarioId: change.scenarioId,
        trackingType: 'residual',
        title: `\u6b8b\u4f59\u6750\u6599\u6c60\u63d0\u62a5 - ${candidate.partNo || change.id}`,
        currentStatus: 'pending',
        severity: 'high',
        plannedAction: '\u786e\u8ba4\u5e93\u5b58\u5e76\u6267\u884c\u62a5\u5e9f/\u9000\u4f9b/\u8f6c\u552e\uff0c\u4e0d\u8ba1\u5165\u5f53\u524d\u4ea7\u54c1\u6210\u672c\u3002',
        actualResult: `\u6b8b\u4f59\u6750\u6599\u5f71\u54cd ${candidate.deltaAmount.toFixed(2)}`,
        warningRef: change.id,
      },
      {
        title: `\u6b8b\u4f59\u6750\u6599\u6c60\u63d0\u62a5 - ${candidate.partNo || change.id}`,
        currentStatus: 'pending',
        severity: 'high',
        plannedAction: '\u786e\u8ba4\u5e93\u5b58\u5e76\u6267\u884c\u62a5\u5e9f/\u9000\u4f9b/\u8f6c\u552e\uff0c\u4e0d\u8ba1\u5165\u5f53\u524d\u4ea7\u54c1\u6210\u672c\u3002',
        actualResult: `\u6b8b\u4f59\u6750\u6599\u5f71\u54cd ${candidate.deltaAmount.toFixed(2)}`,
        warningRef: change.id,
      },
    );
  }

  const existing = await prisma.trackingItem.findMany({ where: { sourceRef: { startsWith: `change:${change.id}:` } } });
  for (const item of existing) {
    if (desiredRefs.has(item.sourceRef || '')) continue;
    await prisma.trackingItem.update({
      where: { id: item.id },
      data: {
        currentStatus: 'closed',
        closeReason: '\u8bbe\u53d8\u91cd\u7b97\u540e\u8be5\u8ddf\u8e2a\u9879\u5df2\u4e0d\u518d\u9002\u7528',
        closedAt: new Date(),
      },
    });
  }
}

export class ChangeService {
  static async listByScenario(scenarioId: string) {
    const rows = await prisma.changeEvent.findMany({ where: { scenarioId }, orderBy: { createdAt: 'desc' } });
    return rows.map(hydrate);
  }

  static async getById(id: string) {
    const event = await prisma.changeEvent.findUnique({ where: { id } });
    if (!event) {
      const err: any = new Error('Change event not found');
      err.status = 404;
      throw err;
    }
    return hydrate(event);
  }

  static async create(projectId: string, scenarioId: string, data: any) {
    const normalized = normalizeImpact({ ...data, projectId, scenarioId });
    const created = await prisma.changeEvent.create({
      data: {
        ...normalized,
        affectedHarnessIds: toJson(normalized.affectedHarnessIds),
        affectedBomRows: toJson(normalized.affectedBomRows),
      },
    });
    return hydrate(created);
  }

  static async update(id: string, data: any) {
    const current = await this.getById(id);
    const normalized = normalizeImpact({ ...current, ...data });
    const updated = await prisma.changeEvent.update({
      where: { id },
      data: {
        ...normalized,
        affectedHarnessIds: toJson(normalized.affectedHarnessIds),
        affectedBomRows: toJson(normalized.affectedBomRows),
      },
    });
    return hydrate(updated);
  }

  static async calculateImpact(id: string) {
    const event = await this.getById(id);
    const residualCandidates = buildResidualCandidates(id, event.affectedBomRows);
    const residualKeys = new Set(residualCandidates.map((item) => `${item.harnessId}::${item.partNo}`));

    const costImpact = event.affectedBomRows.reduce((sum: number, row: any) => {
      const rowKey = `${row.harnessId || ''}::${row.partNo || ''}`;
      if (residualKeys.has(rowKey)) return sum;
      return sum + toNumber(row.deltaAmount || 0);
    }, 0);

    const residualImpact = residualCandidates.reduce((sum: number, item) => sum + toNumber(item.deltaAmount, 0), 0);
    const quoteImpact = costImpact;
    const affectedHarnessIds = Array.from(new Set([
      ...event.affectedHarnessIds,
      ...event.affectedBomRows.map((row: any) => String(row.harnessId || '')).filter(Boolean),
    ]));
    const affectedBomRows = enrichBomRows(event.affectedBomRows, residualCandidates);

    const updated = await this.update(id, {
      affectedHarnessIds,
      affectedBomRows,
      costImpact,
      quoteImpact,
      residualImpact,
      status: 'calculated',
    });

    await syncTrackingItems(updated, costImpact, residualCandidates);
    if (costImpact > 0 || residualImpact > 0) {
      await AlertEventService.syncCostAnomalyAlerts();
    }
    return updated;
  }
}
