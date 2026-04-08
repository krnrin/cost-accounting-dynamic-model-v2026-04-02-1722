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
  getUserAccessToken,
  getFeishuUserInfo,
  refreshUserAccessToken,
  clearFeishuTokenCache,
} from '@/lib/feishuApi';

interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: string;
  avatarUrl?: string;
  feishuOpenId?: string;
  feishuUserId?: string;
}

interface AuthState {
  user: AuthUser | null;
  token: string | null;
  isAuthenticated: boolean;
  /** Feishu-specific tokens */
  feishuAccessToken: string | null;
  feishuRefreshToken: string | null;
  feishuTokenExpiresAt: number | null;
  /** Auth source */
  authSource: 'local' | 'feishu' | null;

  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string, role?: string) => Promise<void>;
  feishuLogin: (code: string) => Promise<void>;
  feishuAutoLogin: () => Promise<boolean>;
  refreshFeishuToken: () => Promise<void>;
  logout: () => void;
  restoreToken: () => void;
}

const API_BASE = import.meta.env.VITE_API_URL || '/api';

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
          try {
            const res = await fetch(`${API_BASE}/auth/login`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email, password }),
            });
            if (!res.ok) {
              const err = await res.json().catch(() => ({ error: 'Login failed' }));
              throw new Error(err.error || 'Login failed');
            }
            const { data } = await res.json();
            syncService.setToken(data.token);
            set({
              user: data.user,
              token: data.token,
              isAuthenticated: true,
              authSource: 'local',
            });
          } catch (e: any) {
            // Dev fallback: if backend is unreachable, allow offline login
            if (import.meta.env.DEV) {
              console.warn('[DEV] Backend unreachable, using offline login');
              const devUser: AuthUser = {
                id: 'dev-admin',
                email: email || 'admin@harness.dev',
                name: 'Admin (离线)',
                role: 'ADMIN',
              };
              set({
                user: devUser,
                token: 'dev-offline-token',
                isAuthenticated: true,
                authSource: 'local',
              });
              return;
            }
            throw e;
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
          syncService.setToken(data.token);
          set({
            user: data.user,
            token: data.token,
            isAuthenticated: true,
            authSource: 'local',
          });
        },

        /**
         * Login with Feishu auth code
         * Flow: code → user_access_token → user_info → set auth state
         */
        feishuLogin: async (code: string) => {
          // Step 1: Exchange code for user_access_token
          const tokenResult = await getUserAccessToken(code);

          // Step 2: Get user info
          const userInfo = await getFeishuUserInfo(tokenResult.accessToken);

          // Step 3: Set auth state
          const user: AuthUser = {
            id: userInfo.openId,
            email: userInfo.email || `${userInfo.userId}@feishu.user`,
            name: userInfo.name,
            role: 'ENGINEER', // Default role, can be adjusted later
            avatarUrl: userInfo.avatarUrl,
            feishuOpenId: userInfo.openId,
            feishuUserId: userInfo.userId,
          };

          set({
            user,
            token: tokenResult.accessToken, // Use user_access_token as auth token
            isAuthenticated: true,
            feishuAccessToken: tokenResult.accessToken,
            feishuRefreshToken: tokenResult.refreshToken,
            feishuTokenExpiresAt: Date.now() + tokenResult.expiresIn * 1000,
            authSource: 'feishu',
          });
        },

        /**
         * Auto-login in Feishu client environment
         * Returns true if auto-login succeeded
         */
        feishuAutoLogin: async () => {
          // Check if already authenticated
          if (get().isAuthenticated) return true;

          // Check for OAuth callback code first (browser redirect flow)
          const callbackCode = extractOAuthCode();
          if (callbackCode) {
            await get().feishuLogin(callbackCode);
            return true;
          }

          // If in Feishu client and configured, try in-app login
          if (isFeishuEnv() && isFeishuConfigured()) {
            try {
              const code = await requestFeishuAuthCode();
              await get().feishuLogin(code);
              return true;
            } catch (err) {
              console.error('飞书免登失败:', err);
              return false;
            }
          }

          return false;
        },

        /** Refresh Feishu token if expired */
        refreshFeishuToken: async () => {
          const { feishuRefreshToken: rt, feishuTokenExpiresAt } = get();
          if (!rt) throw new Error('No refresh token');

          // Only refresh if expired or about to expire (5 min buffer)
          if (feishuTokenExpiresAt && Date.now() < feishuTokenExpiresAt - 300000) return;

          const result = await refreshUserAccessToken(rt);
          set({
            token: result.accessToken,
            feishuAccessToken: result.accessToken,
            feishuRefreshToken: result.refreshToken,
            feishuTokenExpiresAt: Date.now() + result.expiresIn * 1000,
          });
        },

        logout: () => {
          syncService.setToken(null);
          clearFeishuTokenCache();
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

        /** Restore token to syncService on app startup */
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
      }
    ),
    { name: 'auth-store' }
  )
);
