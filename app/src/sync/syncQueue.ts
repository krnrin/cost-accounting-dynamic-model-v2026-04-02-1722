import { db } from '@/data/db';
import type { SyncQueueItem, SyncMeta } from './types';

export async function enqueue(meta: SyncMeta, payload?: any): Promise<void> {
  // Check if there's already a pending item for same entity+entityId
  const existing = await db.syncQueue
    .where('[entity+entityId+synced]')
    .equals([meta.entity, meta.entityId, 0])
    .first();

  if (existing) {
    // Merge: If the new operation is 'delete', it overrides previous 'create'/'update'
    // If previous was 'create' and new is 'update', still 'create'
    // [PR-008] 完整merge逻辑：
    // - delete 覆盖任何之前的操作（create/update/delete）
    // - create + update = create
    // - update + update = update
    // - delete + create = 不可能（delete后实体不存在）
    let finalOp = meta.operation;

    if (meta.operation === 'delete') {
      // delete 覆盖一切
      finalOp = 'delete';
    } else if (existing.operation === 'create' && meta.operation === 'update') {
      // create + update = create
      finalOp = 'create';
    }

    await db.syncQueue.update(existing.id, {
      operation: finalOp,
      payload: payload ?? existing.payload,
      changedAt: meta.changedAt,
    });
  } else {
    await db.syncQueue.add({
      id: crypto.randomUUID(),
      entity: meta.entity,
      entityId: meta.entityId,
      operation: meta.operation,
      changedAt: meta.changedAt,
      synced: 0 as any,
      payload,
      attempts: 0,
    });
  }
}

export async function getPending(): Promise<SyncQueueItem[]> {
  const records = await db.syncQueue
    .where('synced')
    .equals(0)
    .sortBy('changedAt');
  
  return records.map(r => ({
    ...r,
    synced: false
  })) as unknown as SyncQueueItem[];
}

export async function markSynced(ids: string[]): Promise<void> {
  await db.syncQueue.bulkUpdate(ids.map(id => ({
    key: id,
    changes: { synced: 1 as any }
  })));
}

export async function markFailed(id: string, error: string): Promise<void> {
  const item = await db.syncQueue.get(id);
  if (item) {
    await db.syncQueue.update(id, {
      attempts: item.attempts + 1,
      lastError: error
    });
  }
}

export async function getPendingCount(): Promise<number> {
  return db.syncQueue.where('synced').equals(0).count();
}

export async function clearSynced(): Promise<void> {
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const toDelete = await db.syncQueue
    .where('synced')
    .equals(1)
    .and(item => item.changedAt < oneDayAgo)
    .primaryKeys();
  
  await db.syncQueue.bulkDelete(toDelete);
}
