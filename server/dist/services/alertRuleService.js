import prisma from '../lib/prisma.js';
import { fromJson, toJson } from '../lib/json.js';
function normalizeRule(rule) {
    return {
        ...rule,
        condition: fromJson(rule.condition),
    };
}
export class AlertRuleService {
    static async list() {
        const rows = await prisma.alertRule.findMany({ orderBy: [{ createdAt: 'desc' }] });
        return rows.map(normalizeRule);
    }
    static async create(data) {
        const row = await prisma.alertRule.create({
            data: {
                ...data,
                condition: toJson(data.condition ?? {}),
            },
        });
        return normalizeRule(row);
    }
    static async update(id, data) {
        const payload = {
            ...data,
            ...(data.condition !== undefined ? { condition: toJson(data.condition) } : {}),
        };
        const row = await prisma.alertRule.update({
            where: { id },
            data: payload,
        });
        return normalizeRule(row);
    }
    static async remove(id) {
        return prisma.alertRule.delete({ where: { id } });
    }
}
