import { db, type ProjectRecord, type HarnessRecord, type QuoteRecord, type ImportLogRecord } from './db';
import type { VersionRecord, VersionStatus } from '../types/version';

export const projectRepo = {
  async create(project: ProjectRecord): Promise<string> {
    return await db.projects.add(project);
  },
  async getById(id: string): Promise<ProjectRecord | undefined> {
    return await db.projects.get(id);
  },
  async list(): Promise<ProjectRecord[]> {
    return await db.projects.toArray();
  },
  async update(id: string, patch: Partial<ProjectRecord>): Promise<void> {
    await db.projects.update(id, patch);
  },
  async remove(id: string): Promise<void> {
    await db.transaction('rw', [db.projects, db.harnesses, db.quotes, db.versions, db.importLogs], async () => {
      await db.projects.delete(id);
      await db.harnesses.where('projectId').equals(id).delete();
      await db.quotes.where('projectId').equals(id).delete();
      await db.versions.where('projectId').equals(id).delete();
      await db.importLogs.where('projectId').equals(id).delete();
    });
  },
};

export const versionRepo = {
  async create(record: VersionRecord): Promise<string> {
    return await db.versions.add(record);
  },
  async listByProject(projectId: string): Promise<VersionRecord[]> {
    return await db.versions
      .where('projectId')
      .equals(projectId)
      .reverse()
      .sortBy('versionNumber');
  },
  async get(id: string): Promise<VersionRecord | undefined> {
    return await db.versions.get(id);
  },
  async updateStatus(id: string, status: VersionStatus): Promise<void> {
    await db.versions.update(id, { status });
  },
  async getNextVersionNumber(projectId: string): Promise<number> {
    const latest = await db.versions
      .where('projectId')
      .equals(projectId)
      .reverse()
      .sortBy('versionNumber');
    return (latest[0]?.versionNumber || 0) + 1;
  },
  async remove(id: string): Promise<void> {
    await db.versions.delete(id);
  },
};

export const harnessRepo = {
  async getByProject(projectId: string): Promise<HarnessRecord[]> {
    return await db.harnesses.where('projectId').equals(projectId).toArray();
  },
  async upsert(record: HarnessRecord): Promise<void> {
    await db.harnesses.put(record);
  },
  async bulkUpsert(records: HarnessRecord[]): Promise<void> {
    await db.harnesses.bulkPut(records);
  },
  async getById(id: string): Promise<HarnessRecord | undefined> {
    return await db.harnesses.get(id);
  },
};

export const quoteRepo = {
  async getByProject(projectId: string): Promise<QuoteRecord[]> {
    return await db.quotes.where('projectId').equals(projectId).toArray();
  },
  async create(quote: QuoteRecord): Promise<string> {
    return await db.quotes.add(quote);
  },
  async update(id: string, patch: Partial<QuoteRecord>): Promise<void> {
    await db.quotes.update(id, patch);
  },
  async getById(id: string): Promise<QuoteRecord | undefined> {
    return await db.quotes.get(id);
  },
};

export const settingsRepo = {
  async get(key: string): Promise<any> {
    const record = await db.settings.get(key);
    return record?.value;
  },
  async set(key: string, value: any): Promise<void> {
    await db.settings.put({
      key,
      value,
      updatedAt: new Date().toISOString(),
    });
  },
};

export const importLogRepo = {
  async create(record: ImportLogRecord): Promise<string> {
    await db.importLogs.put(record);
    return record.id;
  },
  async listByHarness(harnessId: string): Promise<ImportLogRecord[]> {
    return db.importLogs.where('harnessId').equals(harnessId).reverse().sortBy('importedAt');
  },
  async listByProject(projectId: string): Promise<ImportLogRecord[]> {
    return db.importLogs.where('projectId').equals(projectId).reverse().sortBy('importedAt');
  },
};
