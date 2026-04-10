import prisma from '../lib/prisma.js';
import { fromJson, toJson } from '../lib/json.js';
const DEFAULT_SETTINGS = {
    cost_structure: {
        defaultCostRates: { laborRate: 35, mfgRate: 46.69, wasteRate: 0.01, mgmtRate: 0.06, profitRate: 0.056627 },
        defaultMetalPrices: { copper: 72800, aluminum: 20500 },
        defaultTemplateType: 'geely',
        defaultAnnualDropRate: 0.03,
    },
    alert_threshold: {
        copperPercent: 5,
        aluminumPercent: 5,
        enabled: true,
    },
};
export class SettingsService {
    static async getAll() {
        const rows = await prisma.setting.findMany({ orderBy: [{ category: 'asc' }, { key: 'asc' }] });
        return rows.map((row) => ({ ...row, value: fromJson(row.value) }));
    }
    static async getByCategory(category) {
        const rows = await prisma.setting.findMany({ where: { category }, orderBy: { key: 'asc' } });
        if (rows.length > 0)
            return rows.map((row) => ({ ...row, value: fromJson(row.value) }));
        const defaults = DEFAULT_SETTINGS[category];
        if (!defaults)
            return [];
        return Object.entries(defaults).map(([key, value]) => ({
            id: `${category}:${key}`,
            category,
            key,
            value,
            isGlobal: true,
            versionRef: null,
            updatedBy: null,
            updatedAt: new Date(0),
            createdAt: new Date(0),
        }));
    }
    static async upsert(category, key, value, updatedBy) {
        const row = await prisma.setting.upsert({
            where: { category_key: { category, key } },
            update: { value: toJson(value), updatedBy },
            create: { category, key, value: toJson(value), updatedBy, isGlobal: true },
        });
        return { ...row, value };
    }
    static async publish() {
        return {
            publishedAt: new Date().toISOString(),
            status: 'published',
        };
    }
    static async history() {
        const rows = await prisma.setting.findMany({ orderBy: { updatedAt: 'desc' } });
        return rows.map((row) => ({ ...row, value: fromJson(row.value) }));
    }
    static async snapshot(version) {
        const rows = await prisma.setting.findMany({ where: { versionRef: version } });
        return rows.map((row) => ({ ...row, value: fromJson(row.value) }));
    }
}
