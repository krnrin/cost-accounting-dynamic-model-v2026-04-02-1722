/**
 * 飞书多维表格 (Bitable) CRUD 适配器
 * 
 * 封装 Bitable REST API，提供:
 * - listRecords: 列表查询 (支持分页、过滤)
 * - getRecord: 单条查询
 * - createRecord: 创建记录
 * - createRecordsBatch: 批量创建 (最多 500 条/次)
 * - updateRecord: 更新记录
 * - deleteRecord: 删除记录
 * 
 * 自动处理:
 * - tenant_access_token 获取和刷新
 * - app 字段名 ↔ Bitable 字段名映射
 * - JSON 字段序列化/反序列化
 * - 分页遍历
 */

import { feishuApiCall } from '@/lib/feishuApi';
import {
  BITABLE_APP_TOKEN,
  getTableId,
  getFieldMap,
  JSON_FIELDS,
  isBitableConfigured,
  type BitableEntity,
} from './bitableSchema';

/** Raw Bitable record from API */
interface BitableRawRecord {
  record_id: string;
  fields: Record<string, any>;
}

/** Bitable list response */
interface BitableListResponse {
  items: BitableRawRecord[];
  has_more: boolean;
  page_token?: string;
  total: number;
}

/**
 * Convert app data object to Bitable fields
 * Maps field names and serializes JSON fields
 */
function toFields(entity: BitableEntity, data: Record<string, any>): Record<string, any> {
  const fieldMap = getFieldMap(entity);
  const jsonFields = JSON_FIELDS[entity];
  const fields: Record<string, any> = {};

  for (const [appKey, value] of Object.entries(data)) {
    const bitableKey = fieldMap[appKey];
    if (!bitableKey) continue; // Skip unmapped fields

    if (jsonFields.includes(appKey) && value !== undefined && value !== null) {
      // Serialize complex objects to JSON string
      fields[bitableKey] = typeof value === 'string' ? value : JSON.stringify(value);
    } else {
      fields[bitableKey] = value;
    }
  }

  return fields;
}

/**
 * Convert Bitable fields back to app data object
 * Maps field names and deserializes JSON fields
 */
function fromFields(entity: BitableEntity, fields: Record<string, any>): Record<string, any> {
  const fieldMap = getFieldMap(entity);
  const jsonFields = JSON_FIELDS[entity];
  const data: Record<string, any> = {};

  // Create reverse map: bitable field name -> app field name
  const reverseMap: Record<string, string> = {};
  for (const [appKey, bitableKey] of Object.entries(fieldMap)) {
    reverseMap[bitableKey] = appKey;
  }

  for (const [bitableKey, value] of Object.entries(fields)) {
    const appKey = reverseMap[bitableKey];
    if (!appKey) continue; // Skip unmapped fields

    if (jsonFields.includes(appKey) && typeof value === 'string') {
      // Deserialize JSON string back to object
      try {
        data[appKey] = JSON.parse(value);
      } catch {
        data[appKey] = value; // Keep as string if parse fails
      }
    } else {
      data[appKey] = value;
    }
  }

  return data;
}

/** Base path for Bitable API */
function basePath(entity: BitableEntity): string {
  const tableId = getTableId(entity);
  return `/bitable/v1/apps/${BITABLE_APP_TOKEN}/tables/${tableId}/records`;
}

/**
 * List records with optional filtering and pagination
 */
export async function listRecords(
  entity: BitableEntity,
  options: {
    filter?: string;
    sort?: string[];
    pageSize?: number;
    pageToken?: string;
    fieldNames?: string[];
  } = {}
): Promise<{ records: Record<string, any>[]; hasMore: boolean; pageToken?: string; total: number }> {
  if (!isBitableConfigured()) {
    throw new Error('Bitable 未配置');
  }

  const params = new URLSearchParams();
  if (options.pageSize) params.set('page_size', String(Math.min(options.pageSize, 500)));
  if (options.pageToken) params.set('page_token', options.pageToken);
  if (options.filter) params.set('filter', options.filter);
  if (options.fieldNames) params.set('field_names', JSON.stringify(options.fieldNames));

  const query = params.toString();
  const path = `${basePath(entity)}${query ? `?${query}` : ''}`;

  const result = await feishuApiCall<BitableListResponse>(path);

  const records = (result.items || []).map((item) => ({
    _recordId: item.record_id,
    ...fromFields(entity, item.fields),
  }));

  return {
    records,
    hasMore: result.has_more,
    pageToken: result.page_token,
    total: result.total,
  };
}

/**
 * List ALL records (auto-paging through all pages)
 */
export async function listAllRecords(
  entity: BitableEntity,
  filter?: string
): Promise<Record<string, any>[]> {
  const all: Record<string, any>[] = [];
  let pageToken: string | undefined;

  do {
    const result = await listRecords(entity, { filter, pageSize: 500, pageToken });
    all.push(...result.records);
    pageToken = result.hasMore ? result.pageToken : undefined;
  } while (pageToken);

  return all;
}

/**
 * Get a single record by record_id
 */
export async function getRecord(
  entity: BitableEntity,
  recordId: string
): Promise<Record<string, any> | null> {
  if (!isBitableConfigured()) throw new Error('Bitable 未配置');

  try {
    const result = await feishuApiCall<{ record: BitableRawRecord }>(
      `${basePath(entity)}/${recordId}`
    );
    return {
      _recordId: result.record.record_id,
      ...fromFields(entity, result.record.fields),
    };
  } catch (err: any) {
    if (err.message?.includes('1254040')) return null; // Record not found
    throw err;
  }
}

/**
 * Create a single record
 */
export async function createRecord(
  entity: BitableEntity,
  data: Record<string, any>
): Promise<{ recordId: string; data: Record<string, any> }> {
  if (!isBitableConfigured()) throw new Error('Bitable 未配置');

  const fields = toFields(entity, data);

  const result = await feishuApiCall<{ record: BitableRawRecord }>(
    basePath(entity),
    {
      method: 'POST',
      body: { fields },
    }
  );

  return {
    recordId: result.record.record_id,
    data: fromFields(entity, result.record.fields),
  };
}

/**
 * Create multiple records in batch (max 500 per call)
 */
export async function createRecordsBatch(
  entity: BitableEntity,
  records: Record<string, any>[]
): Promise<{ recordIds: string[] }> {
  if (!isBitableConfigured()) throw new Error('Bitable 未配置');
  if (records.length === 0) return { recordIds: [] };
  if (records.length > 500) {
    throw new Error('批量创建最多 500 条记录');
  }

  const items = records.map((data) => ({
    fields: toFields(entity, data),
  }));

  const result = await feishuApiCall<{ records: BitableRawRecord[] }>(
    `${basePath(entity)}/batch_create`,
    {
      method: 'POST',
      body: { records: items },
    }
  );

  return {
    recordIds: result.records.map((r) => r.record_id),
  };
}

/**
 * Update a record by record_id
 */
export async function updateRecord(
  entity: BitableEntity,
  recordId: string,
  data: Record<string, any>
): Promise<Record<string, any>> {
  if (!isBitableConfigured()) throw new Error('Bitable 未配置');

  const fields = toFields(entity, data);

  const result = await feishuApiCall<{ record: BitableRawRecord }>(
    `${basePath(entity)}/${recordId}`,
    {
      method: 'PUT',
      body: { fields },
    }
  );

  return fromFields(entity, result.record.fields);
}

/**
 * Delete a record by record_id
 */
export async function deleteRecord(
  entity: BitableEntity,
  recordId: string
): Promise<boolean> {
  if (!isBitableConfigured()) throw new Error('Bitable 未配置');

  await feishuApiCall(
    `${basePath(entity)}/${recordId}`,
    { method: 'DELETE' }
  );

  return true;
}

/**
 * Search records by a field value
 */
export async function searchByField(
  entity: BitableEntity,
  fieldName: string,
  value: string
): Promise<Record<string, any>[]> {
  const fieldMap = getFieldMap(entity);
  const bitableFieldName = fieldMap[fieldName] || fieldName;
  
  const filter = `CurrentValue.[${bitableFieldName}] = "${value}"`;
  
  return listAllRecords(entity, filter);
}

/**
 * Sync helper: find a record by app ID field, or create if not found
 */
export async function upsertByAppId(
  entity: BitableEntity,
  idField: string,
  idValue: string,
  data: Record<string, any>
): Promise<{ recordId: string; created: boolean }> {
  const existing = await searchByField(entity, idField, idValue);

  if (existing.length > 0) {
    const recordId = existing[0]!._recordId as string;
    await updateRecord(entity, recordId, data);
    return { recordId, created: false };
  } else {
    const result = await createRecord(entity, { ...data, [idField]: idValue });
    return { recordId: result.recordId, created: true };
  }
}
