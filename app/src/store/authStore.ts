import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { syncService } from '@/sync/syncService';
import {
  isFeishuEnv,
  isFeishuConfigured,
  requestFeishuAuthCode,
  extractOAuthCode,
} from '@/lib/feishuAuth';
import {
  exchangeFeishuCode,
} from '@/lib/feishuApi';
import {
  fetchProfile,
  logoutRequest,
  updateProfilePreferences,
  type ProfilePreferences,
} from '@/lib/profileApi';
import { useSettingsStore } from '@/store/settingsStore';

interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: string;
  avatarUrl?: string;
  feishuOpenId?: string;
  feishuUserId?: string;
  preferences?: ProfilePreferences;
}

interface AuthState {
  user: AuthUser | null;
  token: string | null;
  isAuthenticated: boolean;
  feishuAccessToken: string | null;
  feishuRefreshToken: string | null;
  feishuTokenExpiresAt: number | null;
  authSource: 'local' | 'feishu' | null;

  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string, role?: string) => Promise<void>;
  feishuLogin: (code: string) => Promise<void>;
  feishuAutoLogin: () => Promise<boolean>;
  refreshFeishuToken: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  savePreferences: (preferences: ProfilePreferences) => Promise<void>;
  logout: () => Promise<void>;
  restoreToken: () => void;
}

const API_BASE = import.meta.env.VITE_API_URL || '/api';

/** DEV mode login timeout (ms) */
const DEV_LOGIN_TIMEOUT_MS = 2000;

async function syncProfileIntoState(
  set: (partial: Partial<AuthState>) => void,
  token: string,
  authSource: 'local' | 'feishu',
  extra?: Partial<AuthState>,
) {
  syncService.setToken(token);
  set({
    token,
    isAuthenticated: true,
    authSource,
    ...extra,
  });
  const profile = await fetchProfile();
  useSettingsStore.getState().setThemeMode(profile.preferences.themeMode);
  set({
    user: {
      id: profile.id,
      email: profile.email,
      name: profile.name,
      role: profile.role,
      feishuOpenId: profile.feishuId || undefined,
      preferences: profile.preferences,
    },
    token,
    isAuthenticated: true,
    authSource,
    ...extra,
  });
}

export const useAuthStore = create<AuthState>()(
  devtools(
    persist(
      (set, get) => ({
        user: null,
        token: null,
        isAuthenticated: false,
        feishuAccessToken: null,
        feishuRefreshToken: null,
        feishuTokenExpiresAt: null,
        authSource: null,

        login: async (email, password) => {
          // In DEV mode, fail fast when backend is unreachable instead of logging in offline.
          const controller = import.meta.env.DEV ? new AbortController() : undefined;
          const timer = controller
            ? setTimeout(() => controller.abort(), DEV_LOGIN_TIMEOUT_MS)
            : undefined;

          try {
            const res = await fetch(`${API_BASE}/auth/login`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email, password }),
              ...(controller ? { signal: controller.signal } : {}),
            });
            if (timer) clearTimeout(timer);

            if (!res.ok) {
              const err = await res.json().catch(() => ({ error: 'Login failed' }));
              throw new Error(err.error || 'Login failed');
            }
            const { data } = await res.json();
            await syncProfileIntoState(set, data.token, 'local');
          } catch (e: unknown) {
            if (timer) clearTimeout(timer);
            if (e instanceof DOMException && e.name === 'AbortError') {
              throw new Error('登录超时：后端未响应，请确认本地服务已启动');
            }
            throw e instanceof Error ? e : new Error('登录失败');
          }
        },

        register: async (email, password, name, role) => {
          const res = await fetch(`${API_BASE}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password, name, role }),
          });
          if (!res.ok) {
            const err = await res.json().catch(() => ({ error: 'Registration failed' }));
            throw new Error(err.error || 'Registration failed');
          }
          const { data } = await res.json();
          await syncProfileIntoState(set, data.token, 'local');
        },

        feishuLogin: async (code: string) => {
          // [PR-001] 通过后端代理获取用户信息
          const userInfo = await exchangeFeishuCode(code);

          await syncProfileIntoState(set, localStorage.getItem('token') || '', 'feishu', {
            user: {
              id: userInfo.openId,
              email: userInfo.email || `${userInfo.userId}@feishu.user`,
              name: userInfo.name,
              role: 'ENGINEER',
              avatarUrl: userInfo.avatarUrl,
              feishuOpenId: userInfo.openId,
              feishuUserId: userInfo.userId,
            },
          });
        },

        feishuAutoLogin: async () => {
          if (get().isAuthenticated) return true;

          const callbackCode = extractOAuthCode();
          if (callbackCode) {
            await get().feishuLogin(callbackCode);
            return true;
          }

          if (isFeishuEnv() && isFeishuConfigured()) {
            try {
              const code = await requestFeishuAuthCode();
              await get().feishuLogin(code);
              return true;
            } catch (err) {
              console.error('椋炰功鍏嶇櫥澶辫触:', err);
              return false;
            }
          }

          return false;
        },

        refreshFeishuToken: async () => {
          // [PR-001] Token refresh now handled by backend proxy
          // This is a no-op since we don't store feishu tokens client-side anymore
          const { feishuTokenExpiresAt } = get();
          if (feishuTokenExpiresAt && Date.now() < feishuTokenExpiresAt - 300000) return;
          // Token refresh would need to go through backend
        },

        refreshProfile: async () => {
          const { token, authSource } = get();
          if (!token || !authSource) return;
          await syncProfileIntoState(set, token, authSource, {
            feishuAccessToken: get().feishuAccessToken,
            feishuRefreshToken: get().feishuRefreshToken,
            feishuTokenExpiresAt: get().feishuTokenExpiresAt,
          });
        },

        savePreferences: async (preferences) => {
          const saved = await updateProfilePreferences(preferences);
          useSettingsStore.getState().setThemeMode(saved.themeMode);
        },

        logout: async () => {
          try {
            if (get().token) {
              await logoutRequest();
            }
          } catch {
            // noop
          }
          syncService.setToken(null);
          set({
            user: null,
            token: null,
            isAuthenticated: false,
            feishuAccessToken: null,
            feishuRefreshToken: null,
            feishuTokenExpiresAt: null,
            authSource: null,
          });
        },

        restoreToken: () => {
          const { token } = get();
          if (token) {
            syncService.setToken(token);
          }
        },
      }),
      {
        name: 'auth-storage',
        partialize: (state) => ({
          user: state.user,
          token: state.token,
          isAuthenticated: state.isAuthenticated,
          feishuAccessToken: state.feishuAccessToken,
          feishuRefreshToken: state.feishuRefreshToken,
          feishuTokenExpiresAt: state.feishuTokenExpiresAt,
          authSource: state.authSource,
        }),
      },
    ),
    { name: 'auth-store' },
  ),
);
