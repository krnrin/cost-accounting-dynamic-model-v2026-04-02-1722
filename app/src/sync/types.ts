export interface SyncMeta {
  /** Entity type */
  entity: 'project' | 'harness' | 'quote' | 'version';
  /** Entity ID */
  entityId: string;
  /** Operation */
  operation: 'create' | 'update' | 'delete';
  /** Timestamp of local change */
  changedAt: string;
  /** Has been synced to server */
  synced: boolean;
}

export interface SyncQueueItem extends SyncMeta {
  id: string;
  /** Payload for create/update */
  payload?: any;
  /** Number of sync attempts */
  attempts: number;
  /** Last error message */
  lastError?: string;
}

export interface SyncStatus {
  isOnline: boolean;
  isSyncing: boolean;
  lastSyncAt: string | null;
  pendingCount: number;
  errors: string[];
}

export interface ConflictItem {
  id: string;
  entity: string;
  entityId: string;
  localVersion: any;
  serverVersion: any;
  resolvedAs?: 'local' | 'server';
}

export interface SyncPullResponse {
  projects: Array<{ id: string; data: any; updatedAt: string; deleted?: boolean }>;
  harnesses: Array<{ id: string; data: any; updatedAt: string; deleted?: boolean }>;
  quotes: Array<{ id: string; data: any; updatedAt: string; deleted?: boolean }>;
  versions: Array<{ id: string; data: any; updatedAt: string; deleted?: boolean }>;
  serverTime: string;
}

export interface SyncPushPayload {
  changes: SyncQueueItem[];
}

export interface SyncPushResponse {
  accepted: string[];
  conflicts: ConflictItem[];
  errors: Array<{ id: string; error: string }>;
}
