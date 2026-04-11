import prisma from '../lib/prisma.js';
import { fromJson, toJson } from '../lib/json.js';
import { AlertEventService } from './alertEventService.js';
function toNumber(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}
function normalizeImpact(data) {
    return {
        ...data,
        affectedHarnessIds: Array.isArray(data.affectedHarnessIds) ? data.affectedHarnessIds : [],
        affectedBomRows: Array.isArray(data.affectedBomRows) ? data.affectedBomRows : [],
        costImpact: toNumber(data.costImpact || 0),
        quoteImpact: toNumber(data.quoteImpact || 0),
        residualImpact: toNumber(data.residualImpact || 0),
    };
}
function hydrate(event) {
    return {
        ...event,
        affectedHarnessIds: fromJson(event.affectedHarnessIds, []),
        affectedBomRows: fromJson(event.affectedBomRows, []),
    };
}
function buildResidualCandidates(changeId, rows) {
    const now = new Date().toISOString();
    return rows
        .filter((row) => ['cancelled', 'removed', 'left_only'].includes(String(row.changeType || '').toLowerCase()))
        .map((row, index) => ({
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
        notes: '设变取消料号进入残余材料池，需走呆滞提报流程，不计入当前产品成本。',
    }));
}
function enrichBomRows(rows, residualCandidates) {
    const residualMap = new Map(residualCandidates.map((item) => [`${item.harnessId}::${item.partNo}`, item]));
    return rows.map((row) => {
        const candidate = residualMap.get(`${row.harnessId || ''}::${row.partNo || ''}`);
        if (!candidate)
            return row;
        return {
            ...row,
            residualCandidate: true,
            residualPoolEntry: candidate,
            accountingTreatment: 'stagnant_pool_excluded_from_current_cost',
        };
    });
}
async function upsertTrackingItemBySourceRef(sourceRef, createData, updateData) {
    const existing = await prisma.trackingItem.findFirst({ where: { sourceRef } });
    if (existing) {
        return prisma.trackingItem.update({ where: { id: existing.id }, data: updateData });
    }
    return prisma.trackingItem.create({ data: { ...createData, sourceRef } });
}
async function syncTrackingItems(change, costImpact, residualCandidates) {
    const desiredRefs = new Set();
    if (costImpact !== 0) {
        const sourceRef = `change:${change.id}:impact`;
        desiredRefs.add(sourceRef);
        await upsertTrackingItemBySourceRef(sourceRef, {
            id: `tracking-${change.id}-impact`,
            projectId: change.projectId,
            scenarioId: change.scenarioId,
            trackingType: 'exception',
            title: `设变成本影响复核 - ${change.id}`,
            currentStatus: 'pending',
            severity: Math.abs(costImpact) >= 10000 ? 'critical' : 'high',
            plannedAction: '复核设变影响是否需要同步到报价、分摊、预警。',
            actualResult: `最新成本影响 ${costImpact.toFixed(2)}`,
            warningRef: change.id,
        }, {
            title: `设变成本影响复核 - ${change.id}`,
            currentStatus: 'pending',
            severity: Math.abs(costImpact) >= 10000 ? 'critical' : 'high',
            actualResult: `最新成本影响 ${costImpact.toFixed(2)}`,
            plannedAction: '复核设变影响是否需要同步到报价、分摊、预警。',
            warningRef: change.id,
        });
    }
    for (const candidate of residualCandidates) {
        const sourceRef = `change:${change.id}:residual:${candidate.harnessId}:${candidate.partNo}`;
        desiredRefs.add(sourceRef);
        await upsertTrackingItemBySourceRef(sourceRef, {
            id: `tracking-${change.id}-residual-${candidate.harnessId}-${candidate.partNo}`,
            projectId: change.projectId,
            scenarioId: change.scenarioId,
            trackingType: 'residual',
            title: `残余材料池提报 - ${candidate.partNo || change.id}`,
            currentStatus: 'pending',
            severity: 'high',
            plannedAction: '确认库存并执行报废/退供/转售，不计入当前产品成本。',
            actualResult: `残余材料影响 ${candidate.deltaAmount.toFixed(2)}`,
            warningRef: change.id,
        }, {
            title: `残余材料池提报 - ${candidate.partNo || change.id}`,
            currentStatus: 'pending',
            severity: 'high',
            plannedAction: '确认库存并执行报废/退供/转售，不计入当前产品成本。',
            actualResult: `残余材料影响 ${candidate.deltaAmount.toFixed(2)}`,
            warningRef: change.id,
        });
    }
    const existing = await prisma.trackingItem.findMany({ where: { sourceRef: { startsWith: `change:${change.id}:` } } });
    for (const item of existing) {
        if (desiredRefs.has(item.sourceRef || ''))
            continue;
        await prisma.trackingItem.update({
            where: { id: item.id },
            data: {
                currentStatus: 'closed',
                closeReason: '设变重算后该跟踪项已不再适用',
                closedAt: new Date(),
            },
        });
    }
}
export class ChangeService {
    static async listByScenario(scenarioId) {
        const rows = await prisma.changeEvent.findMany({ where: { scenarioId }, orderBy: { createdAt: 'desc' } });
        return rows.map(hydrate);
    }
    static async getById(id) {
        const event = await prisma.changeEvent.findUnique({ where: { id } });
        if (!event) {
            const err = new Error('Change event not found');
            err.status = 404;
            throw err;
        }
        return hydrate(event);
    }
    static async create(projectId, scenarioId, data) {
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
    static async update(id, data) {
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
    static async calculateImpact(id) {
        const event = await this.getById(id);
        const residualCandidates = buildResidualCandidates(id, event.affectedBomRows);
        const residualKeys = new Set(residualCandidates.map((item) => `${item.harnessId}::${item.partNo}`));
        const costImpact = event.affectedBomRows.reduce((sum, row) => {
            const rowKey = `${row.harnessId || ''}::${row.partNo || ''}`;
            if (residualKeys.has(rowKey))
                return sum;
            return sum + toNumber(row.deltaAmount || 0);
        }, 0);
        const residualImpact = residualCandidates.reduce((sum, item) => sum + toNumber(item.deltaAmount, 0), 0);
        const quoteImpact = costImpact;
        const affectedHarnessIds = Array.from(new Set([
            ...event.affectedHarnessIds,
            ...event.affectedBomRows.map((row) => String(row.harnessId || '')).filter(Boolean),
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
