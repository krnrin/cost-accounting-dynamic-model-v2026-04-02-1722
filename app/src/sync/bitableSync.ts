/**
 * Bitable 同步服务
 * 
 * 实现 IndexedDB ↔ 飞书多维表格的双向同步
 * - push: 将本地变更推送到 Bitable
 * - pull: 从 Bitable 拉取最新数据到本地
 * - fullSync: 全量同步 (首次登录或手动触发)
 */

import { db } from '@/data/db';
import type { ProjectRecord, HarnessRecord, QuoteRecord } from '@/data/db';
import type { VersionRecord } from '@/types/version';
import {
  listAllRecords,
  deleteRecord,
  searchByField,
  upsertByAppId,
} from './bitableAdapter';
import { isBitableConfigured } from './bitableSchema';
import type { SyncQueueItem } from './types';

export class BitableSync {
  /**
   * Push local changes to Bitable
   */
  async push(changes: SyncQueueItem[]): Promise<{
    accepted: string[];
    errors: Array<{ id: string; error: string }>;
  }> {
    if (!isBitableConfigured()) {
      return { accepted: [], errors: [{ id: '*', error: 'Bitable 未配置' }] };
    }

    const accepted: string[] = [];
    const errors: Array<{ id: string; error: string }> = [];

    for (const item of changes) {
      try {
        const entity = item.entity as 'project' | 'harness' | 'quote' | 'version';
        const entityMap: Record<string, string> = {
          project: 'projects',
          harness: 'harnesses',
          quote: 'quotes',
          version: 'versions',
        };
        const bitableEntity = entityMap[entity] as 'projects' | 'harnesses' | 'quotes' | 'versions';

        if (item.operation === 'delete') {
          // Find the Bitable record by app ID and delete it
          const records = await searchByField(bitableEntity, 'id', item.entityId);
          if (records.length > 0) {
            await deleteRecord(bitableEntity, records[0]!._recordId as string);
          }
        } else {
          // Create or update
          await upsertByAppId(bitableEntity, 'id', item.entityId, item.payload || {});
        }

        accepted.push(item.id);
      } catch (err: any) {
        errors.push({ id: item.id, error: err.message || 'Bitable sync failed' });
      }
    }

    return { accepted, errors };
  }

  /**
   * Pull all data from Bitable to local IndexedDB
   * Used for initial sync or full refresh
   */
  async fullPull(): Promise<{
    projects: number;
    harnesses: number;
    quotes: number;
    versions: number;
  }> {
    if (!isBitableConfigured()) {
      throw new Error('Bitable 未配置');
    }

    const stats = { projects: 0, harnesses: 0, quotes: 0, versions: 0 };

    // Pull projects
    const projects = await listAllRecords('projects');
    if (projects.length > 0) {
      await db.transaction('rw', db.projects, async () => {
        for (const p of projects) {
          const record: ProjectRecord = {
            id: p.id || p._recordId,
            meta: {
              projectCode: p.projectCode || '',
              projectName: p.projectName || '',
              customer: p.customer || '',
              platform: p.platform || '',
              status: p.status || 'draft',
              createdAt: p.createdAt || new Date().toISOString(),
              updatedAt: p.updatedAt || new Date().toISOString(),
            },
            config: p.config || {},
          } as ProjectRecord;
          await db.projects.put(record);
        }
      });
      stats.projects = projects.length;
    }

    // Pull harnesses
    const harnesses = await listAllRecords('harnesses');
    if (harnesses.length > 0) {
      await db.transaction('rw', db.harnesses, async () => {
        for (const h of harnesses) {
          const record: HarnessRecord = {
            id: h.id || h._recordId,
            projectId: h.projectId || '',
            scenarioId: h.scenarioId || '',
            eopYear: h.eopYear ?? null,
            harnessId: h.harnessId || '',
            harnessName: h.harnessName || '',
            input: h.input || {},
            result: h.result,
            updatedAt: h.updatedAt || new Date().toISOString(),
          };
          await db.harnesses.put(record);
        }
      });
      stats.harnesses = harnesses.length;
    }

    // Pull quotes
    const quotes = await listAllRecords('quotes');
    if (quotes.length > 0) {
      await db.transaction('rw', db.quotes, async () => {
        for (const q of quotes) {
          const record: QuoteRecord = {
            id: q.id || q._recordId,
            projectId: q.projectId || '',
            version: q.version || '',
            status: q.status || 'draft',
            updatedAt: q.updatedAt || new Date().toISOString(),
          } as QuoteRecord;
          await db.quotes.put(record);
        }
      });
      stats.quotes = quotes.length;
    }

    // Pull versions
    const versions = await listAllRecords('versions');
    if (versions.length > 0) {
      await db.transaction('rw', db.versions, async () => {
        for (const v of versions) {
          const record: VersionRecord = {
            id: v.id || v._recordId,
            projectId: v.projectId || '',
            versionNumber: v.versionNumber || 0,
            label: v.label || '',
            snapshot: v.snapshot || {},
            notes: v.notes || '',
            createdBy: v.createdBy || '',
            createdAt: v.createdAt || new Date().toISOString(),
          } as VersionRecord;
          await db.versions.put(record);
        }
      });
      stats.versions = versions.length;
    }

    return stats;
  }

  /** Check if Bitable is reachable */
  async ping(): Promise<boolean> {
    if (!isBitableConfigured()) return false;
    try {
      await listAllRecords('projects');
      return true;
    } catch {
      return false;
    }
  }
}

export const bitableSync = new BitableSync();
