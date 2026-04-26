import { syncService } from './syncService';
import { bitableSync } from './bitableSync';
import { getPending, markSynced, markFailed, getPendingCount } from './syncQueue';
import { useSyncStore } from '@/store/syncStore';
import { db } from '@/data/db';
import { isBitableConfigured } from './bitableSchema';
import type { SyncPullResponse } from './types';

type SyncMode = 'offline' | 'bitable' | 'server';

class SyncEngine {
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private isRunning = false;

  /** Start periodic sync (every 30 seconds) */
  start() {
    if (this.intervalId) return;
    this.detectMode();
    this.intervalId = setInterval(() => {
      this.detectMode();
      const store = useSyncStore.getState();
      if (store.isOnline && store.syncMode !== 'offline') {
        this.sync();
      }
    }, 30000);
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  /** Detect sync mode based on configuration and connectivity */
  async detectMode(): Promise<SyncMode> {
    const store = useSyncStore.getState();

    // Priority: Bitable > Server > Offline
    if (isBitableConfigured()) {
      try {
        const online = await bitableSync.ping();
        if (online) {
          store.setSyncMode('bitable');
          store.setOnline(true);
          return 'bitable';
        }
      } catch {
        // Fall through to server check
      }
    }

    // Try Express server
    try {
      const serverOnline = await syncService.ping();
      if (serverOnline) {
        store.setSyncMode('server');
        store.setOnline(true);
        return 'server';
      }
    } catch {
      // Fall through to offline
    }

    store.setSyncMode('offline');
    store.setOnline(false);
    return 'offline';
  }

  /** Run a full sync cycle: push local changes, then pull remote changes */
  async sync() {
    if (this.isRunning) return;
    this.isRunning = true;
    const store = useSyncStore.getState();
    store.setSyncing(true);

    try {
      const mode = store.syncMode;

      if (mode === 'bitable') {
        await this.syncBitable();
      } else if (mode === 'server') {
        await this.syncServer();
      }
      // mode === 'offline': do nothing

      store.setPendingCount(await getPendingCount());
      store.clearErrors();
    } catch (err) {
      store.addError(err instanceof Error ? err.message : 'Sync failed');
    } finally {
      store.setSyncing(false);
      this.isRunning = false;
    }
  }

  /** Sync via Bitable API */
  private async syncBitable() {
    const store = useSyncStore.getState();
    const pending = await getPending();

    if (pending.length > 0) {
      // [PR-009] push 返回冲突信息
      const result = await bitableSync.push(pending);

      if (result.accepted.length > 0) {
        await markSynced(result.accepted);
      }

      for (const err of result.errors) {
        await markFailed(err.id, err.error);
      }

      // [PR-009] 上报冲突到 store
      for (const conflict of result.conflicts) {
        store.addConflict({
          id: `${conflict.entity}:${conflict.entityId}`,
          entity: conflict.entity,
          entityId: conflict.entityId,
          localVersion: conflict.localUpdatedAt,
          remoteVersion: conflict.remoteUpdatedAt,
          message: `冲突：本地 ${conflict.localUpdatedAt} vs 远程 ${conflict.remoteUpdatedAt}`,
        });
      }
    }

    // [PR-009] 使用增量 pull 替代注释
    const lastSync = store.lastSyncAt;
    if (lastSync) {
      const pullResult = await bitableSync.incrementalPull(lastSync);
      // 上报增量 pull 发现的冲突
      for (const conflict of pullResult.conflicts) {
        store.addConflict({
          id: `${conflict.entity}:${conflict.entityId}`,
          entity: conflict.entity,
          entityId: conflict.entityId,
          localVersion: conflict.localUpdatedAt,
          remoteVersion: conflict.remoteUpdatedAt,
          message: `增量同步冲突：本地 ${conflict.localUpdatedAt} vs 远程 ${conflict.remoteUpdatedAt}`,
        });
      }
    }

    store.setLastSync(new Date().toISOString());
  }

  /** Sync via Express server (existing behavior) */
  private async syncServer() {
    const store = useSyncStore.getState();

    // Push phase
    const pending = await getPending();
    if (pending.length > 0) {
      const result = await syncService.push({ changes: pending });

      if (result.accepted.length > 0) {
        await markSynced(result.accepted);
      }

      for (const err of result.errors) {
        await markFailed(err.id, err.error);
      }

      for (const conflict of result.conflicts) {
        store.addConflict(conflict);
      }
    }

    // Pull phase
    const lastSync = store.lastSyncAt;
    const pullResult = await syncService.pull(lastSync || undefined);
    await this.applyPull(pullResult);
    store.setLastSync(pullResult.serverTime);
  }

  /**
   * Full sync from Bitable — pull all data to local IndexedDB
   * Called after first Feishu login or manual refresh
   */
  async fullSync(): Promise<{ projects: number; harnesses: number; quotes: number; versions: number }> {
    if (!isBitableConfigured()) {
      throw new Error('Bitable 未配置，无法执行全量同步');
    }

    const store = useSyncStore.getState();
    store.setSyncing(true);

    try {
      const stats = await bitableSync.fullPull();
      store.setLastSync(new Date().toISOString());
      store.setSyncMode('bitable');
      store.setOnline(true);
      return stats;
    } finally {
      store.setSyncing(false);
    }
  }

  private async applyPull(data: SyncPullResponse) {
    await db.transaction('rw', [db.projects, db.harnesses, db.quotes, db.versions], async () => {
      for (const p of data.projects) {
        if (p.deleted) {
          await db.projects.delete(p.id);
        } else {
          await db.projects.put(p.data);
        }
      }
      for (const h of data.harnesses) {
        if (h.deleted) {
          await db.harnesses.delete(h.id);
        } else {
          await db.harnesses.put(h.data);
        }
      }
      for (const q of data.quotes) {
        if (q.deleted) {
          await db.quotes.delete(q.id);
        } else {
          await db.quotes.put(q.data);
        }
      }
      for (const v of data.versions) {
        if (v.deleted) {
          await db.versions.delete(v.id);
        } else {
          await db.versions.put(v.data);
        }
      }
    });
  }
}

export const syncEngine = new SyncEngine();
