import { apiClient } from './apiClient';

export type ProfileThemeMode = 'light' | 'dark' | 'system';

export interface ProfilePreferences {
  themeMode: ProfileThemeMode;
  notifications: {
    alerts: boolean;
    system: boolean;
    releases: boolean;
  };
}

export interface ProfileUser {
  id: string;
  email: string;
  name: string;
  role: string;
  feishuId?: string | null;
  preferences: ProfilePreferences;
  createdAt?: string;
  updatedAt?: string;
}

export interface ProfilePermissionRow {
  field: string;
  minRole: string;
  allowed: boolean;
}

export interface ProfilePermissionPayload {
  userId: string;
  role: string;
  permissions: ProfilePermissionRow[];
}

export interface UserSummary {
  id: string;
  email: string;
  name: string;
  role: string;
  feishuId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export function fetchProfile() {
  return apiClient<ProfileUser>('/profile');
}

export function updateProfile(payload: { name?: string; email?: string }) {
  return apiClient<ProfileUser>('/profile', {
    method: 'PUT',
    body: payload,
  });
}

export function fetchProfilePermissions() {
  return apiClient<ProfilePermissionPayload>('/profile/permissions');
}

export function updateProfilePreferences(payload: ProfilePreferences) {
  return apiClient<ProfilePreferences>('/profile/preferences', {
    method: 'PUT',
    body: payload,
  });
}

export function fetchUsers() {
  return apiClient<UserSummary[]>('/users');
}

export function logoutRequest() {
  return apiClient<void>('/auth/logout', {
    method: 'POST',
  });
}
