/**
 * 跟踪项 Zustand Store
 * 管理异常问题 & 费用追回跟踪项的 CRUD
 */
import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { db } from '@/data/db';
import type { TrackingItemRecord } from '@/data/db';

interface TrackingState {
  items: TrackingItemRecord[];
  loading: boolean;

  loadItems: (projectId: string) => Promise<void>;
  addItem: (item: TrackingItemRecord) => Promise<void>;
  updateItem: (id: string, patch: Partial<TrackingItemRecord>) => Promise<void>;
  deleteItem: (id: string, projectId: string) => Promise<void>;
  clear: () => void;
}

export const useTrackingStore = create<TrackingState>()(
  devtools(
    (set, get) => ({
      items: [],
      loading: false,

      loadItems: async (projectId: string) => {
        set({ loading: true });
        try {
          const items = await db.trackingItems
            .where('projectId')
            .equals(projectId)
            .toArray();
          set({ items, loading: false });
        } catch (err) {
          console.error('Failed to load tracking items:', err);
          set({ loading: false });
        }
      },

      addItem: async (item: TrackingItemRecord) => {
        await db.trackingItems.put(item);
        await get().loadItems(item.projectId);
      },

      updateItem: async (id: string, patch: Partial<TrackingItemRecord>) => {
        await db.trackingItems.update(id, { ...patch, updatedAt: new Date().toISOString() });
        const existing = await db.trackingItems.get(id);
        if (existing) await get().loadItems(existing.projectId);
      },

      deleteItem: async (id: string, projectId: string) => {
        await db.trackingItems.delete(id);
        await get().loadItems(projectId);
      },

      clear: () => set({ items: [], loading: false }),
    }),
    { name: 'tracking-store' }
  )
);
