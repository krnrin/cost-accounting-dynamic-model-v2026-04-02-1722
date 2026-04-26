/**
 * Bitable 同步服务
 *
 * 实现 IndexedDB ↔ 飞书多维表格的双向同步
 * - push: 将本地变更推送到 Bitable
 * - pull: 从 Bitable 拉取最新数据到本地
 * - fullSync: 全量同步 (首次登录或手动触发)
 * - incrementalPull: [PR-009] 增量拉取，基于updatedAt时间戳
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

/** [PR-009] 同步冲突记录 */
export interface SyncConflict {
  entity: 'project' | 'harness' | 'quote' | 'version';
  entityId: string;
  localUpdatedAt: string;
  remoteUpdatedAt: string;
  localData: any;
  remoteData: any;
  resolution: 'pending' | 'local_wins' | 'remote_wins' | 'merged';
}

export class BitableSync {
  /** [PR-009] 收集的冲突列表 */
  private conflicts: SyncConflict[] = [];

  /**
   * Push local changes to Bitable
   * [PR-009] 返回冲突信息
   */
  async push(changes: SyncQueueItem[]): Promise<{
    accepted: string[];
    errors: Array<{ id: string; error: string }>;
    conflicts: SyncConflict[];
  }> {
    if (!isBitableConfigured()) {
      return { accepted: [], errors: [{ id: '*', error: 'Bitable 未配置' }], conflicts: [] };
    }

    const accepted: string[] = [];
    const errors: Array<{ id: string; error: string }> = [];
    this.conflicts = [];

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
          const records = await searchByField(bitableEntity, 'id', item.entityId);
          if (records.length > 0) {
            await deleteRecord(bitableEntity, records[0]!._recordId as string);
          }
        } else {
          // [PR-009] 检测冲突：比较本地和远程的updatedAt
          const remoteRecords = await searchByField(bitableEntity, 'id', item.entityId);
          if (remoteRecords.length > 0) {
            const remoteUpdatedAt = remoteRecords[0]!.updatedAt;
            const localUpdatedAt = item.payload?.updatedAt;
            if (remoteUpdatedAt && localUpdatedAt && new Date(remoteUpdatedAt) > new Date(localUpdatedAt)) {
              // 远程更新时间更新，记录冲突
              this.conflicts.push({
                entity,
                entityId: item.entityId,
                localUpdatedAt,
                remoteUpdatedAt,
                localData: item.payload,
                remoteData: remoteRecords[0],
                resolution: 'pending',
              });
              // 默认策略：远程优先，跳过本次push
              errors.push({ id: item.id, error: 'Conflict detected: remote version is newer' });
              continue;
            }
          }
          await upsertByAppId(bitableEntity, 'id', item.entityId, item.payload || {});
        }

        accepted.push(item.id);
      } catch (err: any) {
        errors.push({ id: item.id, error: err.message || 'Bitable sync failed' });
      }
    }

    return { accepted, errors, conflicts: this.conflicts };
  }

  /**
   * [PR-009] 增量拉取：仅拉取指定时间后的变更
   * @param since 上次同步时间戳
   */
  async incrementalPull(since: string): Promise<{
    projects: number;
    harnesses: number;
    quotes: number;
    versions: number;
    conflicts: SyncConflict[];
  }> {
    if (!isBitableConfigured()) {
      throw new Error('Bitable 未配置');
    }

    const stats = { projects: 0, harnesses: 0, quotes: 0, versions: 0 };
    this.conflicts = [];
    const sinceDate = new Date(since);

    // Pull projects updated after since
    const projects = await listAllRecords('projects');
    const updatedProjects = projects.filter(p => new Date(p.updatedAt || p.meta?.updatedAt || 0) > sinceDate);
    if (updatedProjects.length > 0) {
      await db.transaction('rw', db.projects, async () => {
        for (const p of updatedProjects) {
          const localRecord = await db.projects.get(p.id || p._recordId);
          // [PR-009] 检测冲突
          const localUpdatedAt = localRecord?.meta?.updatedAt;
          if (localRecord && localUpdatedAt && new Date(localUpdatedAt) > sinceDate) {
            this.conflicts.push({
              entity: 'project',
              entityId: p.id || p._recordId,
              localUpdatedAt,
              remoteUpdatedAt: p.updatedAt || p.meta?.updatedAt || new Date().toISOString(),
              localData: localRecord,
              remoteData: p,
              resolution: 'pending',
            });
            continue; // 跳过冲突记录
          }
          const record: ProjectRecord = {
            id: p.id || p._recordId,
            meta: {
              projectCode: p.projectCode || '',
              projectName: p.projectName || '',
              customer: p.customer || '',
              platform: p.platform || '',
              status: p.status || 'draft',
              createdAt: p.createdAt || p.meta?.createdAt || new Date().toISOString(),
              updatedAt: p.updatedAt || p.meta?.updatedAt || new Date().toISOString(),
            },
            config: p.config || {},
          } as ProjectRecord;
          await db.projects.put(record);
        }
      });
      stats.projects = updatedProjects.length;
    }

    // Pull harnesses updated after since
    const harnesses = await listAllRecords('harnesses');
    const updatedHarnesses = harnesses.filter(h => new Date(h.updatedAt || 0) > sinceDate);
    if (updatedHarnesses.length > 0) {
      await db.transaction('rw', db.harnesses, async () => {
        for (const h of updatedHarnesses) {
          const localRecord = await db.harnesses.get(h.id || h._recordId);
          if (localRecord && localRecord.updatedAt && new Date(localRecord.updatedAt) > sinceDate) {
            this.conflicts.push({
              entity: 'harness',
              entityId: h.id || h._recordId,
              localUpdatedAt: localRecord.updatedAt,
              remoteUpdatedAt: h.updatedAt || new Date().toISOString(),
              localData: localRecord,
              remoteData: h,
              resolution: 'pending',
            });
            continue;
          }
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
      stats.harnesses = updatedHarnesses.length;
    }

    // Pull quotes updated after since
    const quotes = await listAllRecords('quotes');
    const updatedQuotes = quotes.filter(q => new Date(q.updatedAt || 0) > sinceDate);
    if (updatedQuotes.length > 0) {
      await db.transaction('rw', db.quotes, async () => {
        for (const q of updatedQuotes) {
          const localRecord = await db.quotes.get(q.id || q._recordId);
          if (localRecord && localRecord.updatedAt && new Date(localRecord.updatedAt) > sinceDate) {
            this.conflicts.push({
              entity: 'quote',
              entityId: q.id || q._recordId,
              localUpdatedAt: localRecord.updatedAt,
              remoteUpdatedAt: q.updatedAt || new Date().toISOString(),
              localData: localRecord,
              remoteData: q,
              resolution: 'pending',
            });
            continue;
          }
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
      stats.quotes = updatedQuotes.length;
    }

    // Pull versions updated after since
    const versions = await listAllRecords('versions');
    const updatedVersions = versions.filter(v => new Date(v.updatedAt || 0) > sinceDate);
    if (updatedVersions.length > 0) {
      await db.transaction('rw', db.versions, async () => {
        for (const v of updatedVersions) {
          const localRecord = await db.versions.get(v.id || v._recordId);
          if (localRecord && localRecord.createdAt && new Date(localRecord.createdAt) > sinceDate) {
            this.conflicts.push({
              entity: 'version',
              entityId: v.id || v._recordId,
              localUpdatedAt: localRecord.createdAt,
              remoteUpdatedAt: v.updatedAt || new Date().toISOString(),
              localData: localRecord,
              remoteData: v,
              resolution: 'pending',
            });
            continue;
          }
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
      stats.versions = updatedVersions.length;
    }

    return { ...stats, conflicts: this.conflicts };
  }

  /**
   * Pull all data from Bitable to local IndexedDB
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
