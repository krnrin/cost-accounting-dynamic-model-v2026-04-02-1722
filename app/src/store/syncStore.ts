import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import type { SyncStatus, ConflictItem } from '@/sync/types';

type SyncMode = 'offline' | 'bitable' | 'server';

interface SyncState extends SyncStatus {
  syncMode: SyncMode;
  conflicts: ConflictItem[];
  setOnline: (online: boolean) => void;
  setSyncing: (syncing: boolean) => void;
  setLastSync: (time: string) => void;
  setPendingCount: (count: number) => void;
  setSyncMode: (mode: SyncMode) => void;
  addError: (error: string) => void;
  clearErrors: () => void;
  addConflict: (conflict: ConflictItem) => void;
  resolveConflict: (id: string, resolution: 'local' | 'server') => void;
  clearConflicts: () => void;
}

export const useSyncStore = create<SyncState>()(
  devtools(
    persist(
      (set) => ({
        isOnline: true,
        isSyncing: false,
        lastSyncAt: null,
        pendingCount: 0,
        errors: [],
        conflicts: [],
        syncMode: 'offline' as SyncMode,

        setOnline: (online) => set({ isOnline: online }),
        setSyncing: (syncing) => set({ isSyncing: syncing }),
        setLastSync: (time) => set({ lastSyncAt: time }),
        setPendingCount: (count) => set({ pendingCount: count }),
        setSyncMode: (mode) => set({ syncMode: mode }),

        addError: (error) => set((state) => ({
          errors: [...state.errors.slice(-4), error],
        })),
        clearErrors: () => set({ errors: [] }),

        addConflict: (conflict) => set((state) => ({
          conflicts: [...state.conflicts.filter(c => c.id !== conflict.id), conflict],
        })),
        resolveConflict: (id, resolution) => set((state) => ({
          conflicts: state.conflicts.map(c =>
            c.id === id ? { ...c, resolvedAs: resolution } : c
          ),
        })),
        clearConflicts: () => set({ conflicts: [] }),
      }),
      {
        name: 'sync-storage',
        partialize: (state) => ({
          lastSyncAt: state.lastSyncAt,
          pendingCount: state.pendingCount,
          syncMode: state.syncMode,
        }),
      }
    )
  )
);
