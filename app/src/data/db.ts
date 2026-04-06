import Dexie, { type Table } from 'dexie';
import type { Project } from '../types/project';
import type { HarnessInput, HarnessResult } from '../types/harness';
import type { QuoteSheet } from '../types/quote';
import type { VersionRecord } from '../types/version';

// Define table record types
export interface ProjectRecord extends Project {
  id: string;
}

export interface HarnessRecord {
  id: string;
  projectId: string;
  harnessId: string;
  harnessName: string;
  input: HarnessInput;
  result?: HarnessResult;
  updatedAt: string;
}

export interface QuoteRecord extends QuoteSheet {
  id: string;
  projectId: string;
  version: string;
  status: string;
  updatedAt: string;
}

export interface SettingRecord {
  key: string;
  value: any;
  updatedAt: string;
}

export interface ImportLogRecord {
  id: string;
  projectId: string;
  harnessId: string;
  fileName: string;
  importedAt: string;
  totalRows: number;
  successRows: number;
  skippedRows: number;
  errors: string[];
}

export interface SyncQueueRecord {
  id: string;
  entity: string;
  entityId: string;
  operation: string;
  changedAt: string;
  synced: boolean;
  payload?: any;
  attempts: number;
  lastError?: string;
}

class CostWorkbenchDB extends Dexie {
  projects!: Table<ProjectRecord, string>;
  harnesses!: Table<HarnessRecord, string>;
  quotes!: Table<QuoteRecord, string>;
  settings!: Table<SettingRecord, string>;
  versions!: Table<VersionRecord, string>;
  importLogs!: Table<ImportLogRecord, string>;
  syncQueue!: Table<SyncQueueRecord, string>;
  
  constructor() {
    super('CostWorkbenchDB');
    this.version(1).stores({
      projects: 'id, meta.projectCode, meta.customer, meta.status, meta.updatedAt',
      harnesses: 'id, projectId, harnessId, harnessName',
      quotes: 'id, projectId, version, status, updatedAt',
      settings: 'key',
    });
    this.version(2).stores({
      versions: 'id, projectId, [projectId+versionNumber]',
    });
    this.version(3).stores({
      importLogs: 'id, projectId, harnessId, importedAt',
    });
    this.version(4).stores({
      syncQueue: 'id, entity, entityId, synced, changedAt, [entity+entityId+synced]'
    });
  }
}

export const db = new CostWorkbenchDB();
