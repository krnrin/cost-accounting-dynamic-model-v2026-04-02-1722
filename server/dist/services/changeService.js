import prisma from '../lib/prisma.js';
import { fromJson, toJson } from '../lib/json.js';
function normalizeImpact(data) {
    return {
        ...data,
        affectedHarnessIds: Array.isArray(data.affectedHarnessIds) ? data.affectedHarnessIds : [],
        affectedBomRows: Array.isArray(data.affectedBomRows) ? data.affectedBomRows : [],
        costImpact: Number(data.costImpact || 0),
        quoteImpact: Number(data.quoteImpact || 0),
        residualImpact: Number(data.residualImpact || 0),
    };
}
function hydrate(event) {
    return {
        ...event,
        affectedHarnessIds: fromJson(event.affectedHarnessIds, []),
        affectedBomRows: fromJson(event.affectedBomRows, []),
    };
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
        const costImpact = event.affectedBomRows.reduce((sum, row) => sum + Number(row.deltaAmount || 0), 0);
        const residualImpact = event.affectedBomRows
            .filter((row) => row.changeType === 'cancelled')
            .reduce((sum, row) => sum + Number(row.deltaAmount || 0), 0);
        const quoteImpact = costImpact;
        return this.update(id, {
            costImpact,
            quoteImpact,
            residualImpact,
            status: 'calculated',
        });
    }
}
