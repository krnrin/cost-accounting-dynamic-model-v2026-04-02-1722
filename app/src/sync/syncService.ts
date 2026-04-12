import type { SyncPullResponse, SyncPushPayload, SyncPushResponse } from './types';
import { apiClient } from '@/lib/apiClient';

class SyncService {
  // setToken is kept for backwards compat but apiClient reads from localStorage
  setToken(_token: string | null) { /* noop — apiClient auto-reads */ }

  async push(payload: SyncPushPayload): Promise<SyncPushResponse> {
    return apiClient<SyncPushResponse>('/sync/push', { method: 'POST', body: payload });
  }

  async pull(since?: string): Promise<SyncPullResponse> {
    const params = since ? `?since=${encodeURIComponent(since)}` : '';
    return apiClient<SyncPullResponse>(`/sync/pull${params}`);
  }

  async ping(): Promise<boolean> {
    try {
      await apiClient('/sync/health', { retries: 0 });
      return true;
    } catch { return false; }
  }
}

export const syncService = new SyncService();
