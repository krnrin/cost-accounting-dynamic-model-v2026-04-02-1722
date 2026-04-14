import prisma from '../lib/prisma.js';
import { fromJson, toJson } from '../lib/json.js';
function toNumber(value, fallback = 0) {
    const num = Number(value);
    return Number.isFinite(num) ? num : fallback;
}
function round2(value) {
    return Math.round(value * 100) / 100;
}
function hydrate(record) {
    return {
        ...record,
        impactSummary: fromJson(record.impactSummary, {}),
    };
}
function buildImpactPayload(record) {
    const costBefore = toNumber(record.costBefore, 0);
    const priceBefore = toNumber(record.priceBefore, costBefore);
    const dropRate = toNumber(record.dropRate, 0);
    const costAfter = round2(costBefore * (1 - dropRate));
    const priceAfter = round2(priceBefore * (1 - dropRate));
    const profitBefore = round2(priceBefore - costBefore);
    const profitAfter = round2(priceAfter - costAfter);
    return {
        costBefore,
        costAfter,
        priceBefore,
        priceAfter,
        profitBefore,
        profitAfter,
        impactSummary: {
            deltaCost: round2(costAfter - costBefore),
            deltaPrice: round2(priceAfter - priceBefore),
            deltaProfit: round2(profitAfter - profitBefore),
            dropRate,
            formula: 'cost_after = cost_before \u00d7 (1 - drop_rate)',
        },
    };
}
export class AnnualDropService {
    static async listByScenario(scenarioId) {
        const rows = await prisma.annualDropRecord.findMany({
            where: { scenarioId },
            orderBy: [{ year: 'asc' }, { createdAt: 'asc' }],
        });
        return rows.map(hydrate);
    }
    static async getById(id) {
        const row = await prisma.annualDropRecord.findUnique({ where: { id } });
        if (!row) {
            const err = new Error('Annual drop record not found');
            err.status = 404;
            throw err;
        }
        return hydrate(row);
    }
    static async create(projectId, scenarioId, data) {
        const payload = buildImpactPayload(data);
        const created = await prisma.annualDropRecord.create({
            data: {
                projectId,
                scenarioId,
                name: data.name,
                status: data.status ?? 'draft',
                year: data.year,
                dropRate: payload.impactSummary.dropRate,
                costBefore: payload.costBefore,
                costAfter: payload.costAfter,
                priceBefore: payload.priceBefore,
                priceAfter: payload.priceAfter,
                profitBefore: payload.profitBefore,
                profitAfter: payload.profitAfter,
                impactSummary: toJson(payload.impactSummary),
                createdBy: data.createdBy,
            },
        });
        return hydrate(created);
    }
    static async update(id, data) {
        const current = await this.getById(id);
        const merged = {
            ...current,
            ...data,
            impactSummary: undefined,
        };
        const payload = buildImpactPayload(merged);
        const updated = await prisma.annualDropRecord.update({
            where: { id },
            data: {
                name: merged.name,
                status: merged.status,
                year: merged.year,
                dropRate: payload.impactSummary.dropRate,
                costBefore: payload.costBefore,
                costAfter: payload.costAfter,
                priceBefore: payload.priceBefore,
                priceAfter: payload.priceAfter,
                profitBefore: payload.profitBefore,
                profitAfter: payload.profitAfter,
                impactSummary: toJson(payload.impactSummary),
            },
        });
        return hydrate(updated);
    }
    static async getImpact(id) {
        const row = await this.getById(id);
        return {
            id: row.id,
            year: row.year,
            dropRate: row.dropRate,
            costBefore: row.costBefore,
            costAfter: row.costAfter,
            priceBefore: row.priceBefore,
            priceAfter: row.priceAfter,
            profitBefore: row.profitBefore,
            profitAfter: row.profitAfter,
            impactSummary: row.impactSummary,
        };
    }
}
