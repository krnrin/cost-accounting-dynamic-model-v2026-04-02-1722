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
  return apiClient<{ version: string; publishedAt: string; status: string; itemCount: number }>(`/settings/publish`, {
    method: 'POST',
  });
}

export async function fetchSettingsHistory() {
  return apiClient<SettingRow[]>(`/settings/history`);
}
