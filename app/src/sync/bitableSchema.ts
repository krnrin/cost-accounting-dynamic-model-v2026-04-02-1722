/**
 * 飞书多维表格 Schema 映射
 * 
 * 定义 app 数据模型 ↔ Bitable 表结构的映射关系
 * app_token 和 table_id 从环境变量读取，在飞书开放平台创建多维表格后配置
 */

/** Bitable app token (the multi-dimensional table workbook ID) */
export const BITABLE_APP_TOKEN = import.meta.env.VITE_BITABLE_APP_TOKEN || '';

/** Table IDs within the Bitable app */
export const BITABLE_TABLES = {
  projects: import.meta.env.VITE_BITABLE_TABLE_PROJECTS || '',
  harnesses: import.meta.env.VITE_BITABLE_TABLE_HARNESSES || '',
  quotes: import.meta.env.VITE_BITABLE_TABLE_QUOTES || '',
  versions: import.meta.env.VITE_BITABLE_TABLE_VERSIONS || '',
  auditLogs: import.meta.env.VITE_BITABLE_TABLE_AUDIT_LOGS || '',
} as const;

/** Check if Bitable is configured */
export function isBitableConfigured(): boolean {
  return !!(BITABLE_APP_TOKEN && BITABLE_TABLES.projects);
}

/**
 * Field name mapping: app field name → Bitable column name
 * Bitable requires Chinese or descriptive field names for readability
 */
export const FIELD_MAPS = {
  projects: {
    id: '记录ID',
    projectCode: '项目编号',
    projectName: '项目名称',
    customer: '客户',
    platform: '平台',
    status: '状态',
    costRates: '成本费率',
    internalCostRates: '内部成本费率',
    metalPrices: '金属价格',
    volumes: '产量计划',
    config: '项目配置',
    createdBy: '创建人',
    createdAt: '创建时间',
    updatedAt: '更新时间',
  },
  harnesses: {
    id: '记录ID',
    projectId: '项目ID',
    harnessId: '线束编号',
    harnessName: '线束名称',
    input: '输入数据',
    result: '计算结果',
    updatedAt: '更新时间',
  },
  quotes: {
    id: '记录ID',
    projectId: '项目ID',
    version: '版本',
    status: '状态',
    template: '模板',
    data: '报价数据',
    createdAt: '创建时间',
    updatedAt: '更新时间',
  },
  versions: {
    id: '记录ID',
    projectId: '项目ID',
    versionNumber: '版本号',
    label: '标签',
    status: '状态',
    snapshot: '快照数据',
    notes: '备注',
    createdBy: '创建人',
    createdAt: '创建时间',
  },
  auditLogs: {
    id: '记录ID',
    userId: '用户ID',
    userName: '用户名',
    projectId: '项目ID',
    action: '操作',
    entity: '实体类型',
    entityId: '实体ID',
    details: '详情',
    createdAt: '操作时间',
  },
} as const;

/** Entity types that can be synced */
export type BitableEntity = keyof typeof BITABLE_TABLES;

/** Get table ID for an entity */
export function getTableId(entity: BitableEntity): string {
  const tableId = BITABLE_TABLES[entity];
  if (!tableId) {
    throw new Error(`Bitable table ID not configured for entity: ${entity}`);
  }
  return tableId;
}

/** Get field map for an entity */
export function getFieldMap(entity: BitableEntity): Record<string, string> {
  return FIELD_MAPS[entity] as Record<string, string>;
}

/** JSON fields that need serialization/deserialization */
export const JSON_FIELDS: Record<BitableEntity, string[]> = {
  projects: ['costRates', 'internalCostRates', 'metalPrices', 'volumes', 'config'],
  harnesses: ['input', 'result'],
  quotes: ['data'],
  versions: ['snapshot'],
  auditLogs: ['details'],
};
