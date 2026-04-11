import prisma from '../lib/prisma.js';
import { fromJson, toJson } from '../lib/json.js';

const DEFAULT_SETTINGS: Record<string, Record<string, any>> = {
  cost_structure: {
    defaultCostRates: { laborRate: 35, mfgRate: 46.69, wasteRate: 0.01, mgmtRate: 0.06, profitRate: 0.056627 },
    defaultMetalPrices: { copper: 72800, aluminum: 20500 },
    defaultTemplateType: 'geely',
    defaultAnnualDropRate: 0.03,
    schema: {
      name: '默认成本结构',
      version: '1.0',
      items: [
        { key: 'material', label: '材料成本', calcMethod: 'bom_sum', order: 10, inExFactory: true },
        { key: 'waste', label: '废品', calcMethod: 'rate_x_base', rate: 0.01, baseRef: ['material'], order: 20, inExFactory: true },
        { key: 'directLabor', label: '直接人工', calcMethod: 'rate_x_hours', rate: 35, order: 30, inExFactory: true },
        { key: 'manufacturing', label: '制造费', calcMethod: 'rate_x_hours', rate: 46.69, order: 40, inExFactory: true },
        { key: 'mgmtFee', label: '管理费', calcMethod: 'rate_x_base', rate: 0.06, baseRef: ['material', 'directLabor', 'manufacturing'], order: 50, inExFactory: true },
        { key: 'profit', label: '利润', calcMethod: 'rate_x_base', rate: 0.056627, baseRef: ['material', 'waste', 'directLabor', 'manufacturing', 'mgmtFee'], order: 60, inExFactory: true },
        { key: 'packaging', label: '包装费', calcMethod: 'direct', order: 70, isAddon: true },
        { key: 'freight', label: '运输费', calcMethod: 'direct', order: 80, isAddon: true },
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
      { category: 'wire', patterns: ['^wire$', '^导线$', '^cable$', '^电缆$', '导线|cable|电缆'], matchFields: ['itemCategory', 'partName'], priority: 10 },
      { category: 'connector', patterns: ['^connector$', '^连接器$', '^护套$', '^插头$', '^插座$', '连接器|护套|插头|插座|屏蔽环'], matchFields: ['itemCategory', 'partName'], priority: 10 },
      { category: 'terminal', patterns: ['^terminal$', '^端子$', '端子'], matchFields: ['itemCategory', 'partName'], priority: 10 },
      { category: 'ipt_terminal', patterns: ['^ipt_terminal$'], matchFields: ['itemCategory'], priority: 10 },
      { category: 'bracket_rubber', patterns: ['^bracket_rubber$', '支架|橡胶'], matchFields: ['itemCategory', 'partName'], priority: 5 },
      { category: 'tape_tube', patterns: ['^tape_tube$', '胶带|套管'], matchFields: ['itemCategory', 'partName'], priority: 5 },
    ],
  },
};

const SNAPSHOT_PREFIX = 'snapshot';
const HISTORY_CATEGORY = 'publish_history';

function normalizeRow(row: any) {
  return { ...row, value: fromJson(row.value) };
}

function makeDefaultRow(category: string, key: string, value: any) {
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
  static async getAll() {
    const categories = Object.keys(DEFAULT_SETTINGS);
    const grouped = await Promise.all(categories.map((category) => this.getByCategory(category)));
    return grouped.flat();
  }

  static async getByCategory(category: string) {
    const rows = await prisma.setting.findMany({ where: { category }, orderBy: { key: 'asc' } });
    if (rows.length > 0) return rows.map(normalizeRow);

    const defaults = DEFAULT_SETTINGS[category];
    if (!defaults) return [];
    return Object.entries(defaults).map(([key, value]) => makeDefaultRow(category, key, value));
  }

  static async upsert(category: string, key: string, value: any, updatedBy?: string) {
    const row = await prisma.setting.upsert({
      where: { category_key: { category, key } },
      update: { value: toJson(value), updatedBy },
      create: { category, key, value: toJson(value), updatedBy, isGlobal: true },
    });
    return { ...row, value };
  }

  static async publish(updatedBy?: string) {
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

  static async snapshot(version: string) {
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
