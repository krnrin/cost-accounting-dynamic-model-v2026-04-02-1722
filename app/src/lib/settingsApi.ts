import { apiClient } from './apiClient';

export interface SettingRow<T = any> {
  id: string;
  category: string;
  key: string;
  value: T;
  isGlobal: boolean;
  versionRef: string | null;
  updatedBy: string | null;
  updatedAt: string | Date;
  createdAt: string | Date;
}

export interface SettingsPublishResult {
  version: string;
  publishedAt: string;
  status: string;
  itemCount: number;
}

export interface SettingsSnapshotRow<T = any> extends SettingRow<T> {
  sourceCategory: string;
}

export async function fetchSettingsCategory<T = any>(category: string) {
  return apiClient<SettingRow<T>[]>(`/settings/${category}`);
}

export async function updateSetting<T = any>(category: string, key: string, value: T) {
  return apiClient<SettingRow<T>>(`/settings/${category}/${key}`, {
    method: 'PUT',
    body: { value },
  });
}

export async function publishSettings() {
  return apiClient<SettingsPublishResult>(`/settings/publish`, {
    method: 'POST',
  });
}

export async function fetchSettingsHistory() {
  return apiClient<SettingRow<SettingsPublishResult>[]>(`/settings/history`);
}

export async function fetchSettingsSnapshot(version: string) {
  return apiClient<SettingsSnapshotRow[]>(`/settings/snapshot/${version}`);
}
