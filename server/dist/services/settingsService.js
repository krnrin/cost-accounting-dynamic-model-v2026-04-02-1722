import prisma from '../lib/prisma.js';
import { fromJson, toJson } from '../lib/json.js';
import { VersionService } from './extraServices.js';
const DEFAULT_SETTINGS = {
    cost_structure: {
        defaultCostRates: { laborRate: 35, mfgRate: 46.69, wasteRate: 0.01, mgmtRate: 0.06, profitRate: 0.056627 },
        defaultMetalPrices: { copper: 72800, aluminum: 20500 },
        defaultTemplateType: 'geely',
        defaultAnnualDropRate: 0.03,
        schema: {
            name: '\u9ed8\u8ba4\u6210\u672c\u7ed3\u6784',
            version: '1.0',
            items: [
                { key: 'material', label: '\u6750\u6599\u6210\u672c', calcMethod: 'bom_sum', order: 10, inExFactory: true },
                { key: 'waste', label: '\u5e9f\u54c1', calcMethod: 'rate_x_base', rate: 0.01, baseRef: ['material'], order: 20, inExFactory: true },
                { key: 'directLabor', label: '\u76f4\u63a5\u4eba\u5de5', calcMethod: 'rate_x_hours', rate: 35, order: 30, inExFactory: true },
                { key: 'manufacturing', label: '\u5236\u9020\u8d39', calcMethod: 'rate_x_hours', rate: 46.69, order: 40, inExFactory: true },
                { key: 'mgmtFee', label: '\u7ba1\u7406\u8d39', calcMethod: 'rate_x_base', rate: 0.06, baseRef: ['material', 'directLabor', 'manufacturing'], order: 50, inExFactory: true },
                { key: 'profit', label: '\u5229\u6da6', calcMethod: 'rate_x_base', rate: 0.056627, baseRef: ['material', 'waste', 'directLabor', 'manufacturing', 'mgmtFee'], order: 60, inExFactory: true },
                { key: 'packaging', label: '\u5305\u88c5\u8d39', calcMethod: 'direct', order: 70, isAddon: true },
                { key: 'freight', label: '\u8fd0\u8f93\u8d39', calcMethod: 'direct', order: 80, isAddon: true },
            ],
        },
        useSchemaEngine: false,
    },
    alert_threshold: {
        copperPercent: 5,
        aluminumPercent: 5,
        enabled: true,
    },
    factories: {
        list: [],
    },
    allocation_config: {
        drivers: {
            equipment: 'hours',
            rnd: 'revenue',
            indirectLabor: 'hours',
            management: 'direct',
        },
    },
    level1_coefficients: {
        default: {
            materialRatio: 0.65,
            laborRatio: 0.09,
            mfgRatio: 0.12,
            packagingRatio: 0.024,
            freightRatio: 0.006,
        },
    },
    bom_classification: {
        rules: [
            { category: 'wire', patterns: ['^wire$', '^\u5bfc\u7ebf$', '^cable$', '^\u7535\u7f06$', '\u5bfc\u7ebf|cable|\u7535\u7f06'], matchFields: ['itemCategory', 'partName'], priority: 10 },
            { category: 'connector', patterns: ['^connector$', '^\u8fde\u63a5\u5668$', '^\u62a4\u5957$', '^\u63d2\u5934$', '^\u63d2\u5ea7$', '\u8fde\u63a5\u5668|\u62a4\u5957|\u63d2\u5934|\u63d2\u5ea7|\u5c4f\u853d\u73af'], matchFields: ['itemCategory', 'partName'], priority: 10 },
            { category: 'terminal', patterns: ['^terminal$', '^\u7aef\u5b50$', '\u7aef\u5b50'], matchFields: ['itemCategory', 'partName'], priority: 10 },
            { category: 'ipt_terminal', patterns: ['^ipt_terminal$'], matchFields: ['itemCategory'], priority: 10 },
            { category: 'bracket_rubber', patterns: ['^bracket_rubber$', '\u652f\u67b6|\u6a61\u80f6'], matchFields: ['itemCategory', 'partName'], priority: 5 },
            { category: 'tape_tube', patterns: ['^tape_tube$', '\u80f6\u5e26|\u5957\u7ba1'], matchFields: ['itemCategory', 'partName'], priority: 5 },
        ],
    },
};
const SNAPSHOT_PREFIX = 'snapshot';
const HISTORY_CATEGORY = 'publish_history';
async function getLatestPublishedVersion() {
    const row = await prisma.setting.findFirst({
        where: { category: HISTORY_CATEGORY },
        orderBy: { createdAt: 'desc' },
    });
    if (!row)
        return null;
    const value = fromJson(row.value);
    return value.version ?? row.key;
}
function normalizeRow(row) {
    return { ...row, value: fromJson(row.value) };
}
function makeDefaultRow(category, key, value) {
    return {
        id: `${category}:${key}`,
        category,
        key,
        value,
        isGlobal: true,
        versionRef: null,
        updatedBy: null,
        updatedAt: new Date(0),
        createdAt: new Date(0),
    };
}
export class SettingsService {
    static async getLatestPublishedVersion() {
        return getLatestPublishedVersion();
    }
    static async assertPublishedVersion(version) {
        const row = await prisma.setting.findUnique({
            where: { category_key: { category: HISTORY_CATEGORY, key: version } },
        });
        if (!row) {
            const err = new Error(`Settings version ${version} is not published`);
            err.status = 400;
            throw err;
        }
        return normalizeRow(row);
    }
    static async getAll() {
        const categories = Object.keys(DEFAULT_SETTINGS);
        const grouped = await Promise.all(categories.map((category) => this.getByCategory(category)));
        return grouped.flat();
    }
    static async getByCategory(category) {
        const rows = await prisma.setting.findMany({ where: { category }, orderBy: { key: 'asc' } });
        if (rows.length > 0)
            return rows.map(normalizeRow);
        const defaults = DEFAULT_SETTINGS[category];
        if (!defaults)
            return [];
        return Object.entries(defaults).map(([key, value]) => makeDefaultRow(category, key, value));
    }
    static async upsert(category, key, value, updatedBy) {
        const row = await prisma.setting.upsert({
            where: { category_key: { category, key } },
            update: { value: toJson(value), updatedBy },
            create: { category, key, value: toJson(value), updatedBy, isGlobal: true },
        });
        return { ...row, value };
    }
    static async publish(updatedBy) {
        const currentSettings = await this.getAll();
        const version = `settings-${new Date().toISOString().replace(/[.:]/g, '-').replace('T', '_').replace('Z', '')}`;
        const publishedAt = new Date();
        await prisma.$transaction([
            ...currentSettings.map((row) => prisma.setting.create({
                data: {
                    category: `${SNAPSHOT_PREFIX}:${version}:${row.category}`,
                    key: row.key,
                    value: toJson(row.value),
                    isGlobal: false,
                    versionRef: version,
                    updatedBy,
                },
            })),
            prisma.setting.create({
                data: {
                    category: HISTORY_CATEGORY,
                    key: version,
                    value: toJson({ version, publishedAt: publishedAt.toISOString(), itemCount: currentSettings.length }),
                    isGlobal: false,
                    versionRef: version,
                    updatedBy,
                },
            }),
        ]);
        const projects = await prisma.project.findMany({ select: { id: true } });
        await Promise.all(projects.map((project) => VersionService.createAutoVersion(project.id, {
            label: `\u8d39\u7387\u53d1\u5e03 - ${version}`,
            notes: `Auto snapshot created when settings version ${version} was published.`,
            snapshot: {
                triggerSource: 'settings_publish',
                settingsVersion: version,
                publishedAt: publishedAt.toISOString(),
                itemCount: currentSettings.length,
                settings: currentSettings,
            },
            createdBy: updatedBy,
        })));
        return {
            version,
            publishedAt: publishedAt.toISOString(),
            status: 'published',
            itemCount: currentSettings.length,
        };
    }
    static async history() {
        const rows = await prisma.setting.findMany({
            where: { category: HISTORY_CATEGORY },
            orderBy: { createdAt: 'desc' },
        });
        return rows.map(normalizeRow);
    }
    static async snapshot(version) {
        const rows = await prisma.setting.findMany({
            where: {
                versionRef: version,
                category: { startsWith: `${SNAPSHOT_PREFIX}:${version}:` },
            },
            orderBy: [{ category: 'asc' }, { key: 'asc' }],
        });
        return rows.map((row) => ({
            ...normalizeRow(row),
            sourceCategory: row.category.replace(`${SNAPSHOT_PREFIX}:${version}:`, ''),
        }));
    }
}
