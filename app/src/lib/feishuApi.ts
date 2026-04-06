/**
 * 飞书 API 客户端
 * 
 * 提供:
 * - tenant_access_token 获取 (用于 Bitable API)
 * - user_access_token 获取 (用于用户信息)
 * - 用户信息获取
 * 
 * 注: 在企业自建应用中, app_id/app_secret 用于获取 tenant_access_token,
 *     这是标准做法。对于完全前端的部署, 可通过飞书云函数代理。
 */

const FEISHU_APP_ID = import.meta.env.VITE_FEISHU_APP_ID || '';
const FEISHU_APP_SECRET = import.meta.env.VITE_FEISHU_APP_SECRET || '';

/**
 * In dev mode, route through Vite proxy to avoid CORS.
 * In production (Feishu webview), direct calls are allowed by same-origin policy.
 */
const FEISHU_API_BASE = import.meta.env.DEV
  ? '/feishu-api'
  : 'https://open.feishu.cn/open-apis';

/** Cached tenant_access_token */
let cachedTenantToken: { token: string; expiresAt: number } | null = null;

export interface FeishuUserInfo {
  openId: string;
  unionId: string;
  userId: string;
  name: string;
  avatarUrl: string;
  email: string;
  mobile: string;
}

/**
 * Get tenant_access_token (app-level token for API calls)
 * Cached until expiry
 */
export async function getTenantAccessToken(): Promise<string> {
  // Return cached if still valid (with 5 min buffer)
  if (cachedTenantToken && Date.now() < cachedTenantToken.expiresAt - 300000) {
    return cachedTenantToken.token;
  }

  if (!FEISHU_APP_ID || !FEISHU_APP_SECRET) {
    throw new Error('飞书 App ID 或 App Secret 未配置');
  }

  const res = await fetch(`${FEISHU_API_BASE}/auth/v3/tenant_access_token/internal`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      app_id: FEISHU_APP_ID,
      app_secret: FEISHU_APP_SECRET,
    }),
  });

  const data = await res.json();
  if (data.code !== 0) {
    throw new Error(`获取 tenant_access_token 失败: ${data.msg}`);
  }

  cachedTenantToken = {
    token: data.tenant_access_token,
    expiresAt: Date.now() + data.expire * 1000,
  };

  return cachedTenantToken.token;
}

/**
 * Exchange auth code for user_access_token
 */
export async function getUserAccessToken(code: string): Promise<{
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}> {
  const tenantToken = await getTenantAccessToken();

  const res = await fetch(`${FEISHU_API_BASE}/authen/v1/oidc/access_token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${tenantToken}`,
    },
    body: JSON.stringify({
      grant_type: 'authorization_code',
      code,
    }),
  });

  const data = await res.json();
  if (data.code !== 0) {
    throw new Error(`获取 user_access_token 失败: ${data.msg}`);
  }

  return {
    accessToken: data.data.access_token,
    refreshToken: data.data.refresh_token,
    expiresIn: data.data.expires_in,
  };
}

/**
 * Get user info using user_access_token
 */
export async function getFeishuUserInfo(userAccessToken: string): Promise<FeishuUserInfo> {
  const res = await fetch(`${FEISHU_API_BASE}/authen/v1/user_info`, {
    headers: {
      'Authorization': `Bearer ${userAccessToken}`,
    },
  });

  const data = await res.json();
  if (data.code !== 0) {
    throw new Error(`获取用户信息失败: ${data.msg}`);
  }

  return {
    openId: data.data.open_id || '',
    unionId: data.data.union_id || '',
    userId: data.data.user_id || '',
    name: data.data.name || '',
    avatarUrl: data.data.avatar_url || '',
    email: data.data.email || '',
    mobile: data.data.mobile || '',
  };
}

/**
 * Refresh user_access_token
 */
export async function refreshUserAccessToken(refreshToken: string): Promise<{
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}> {
  const tenantToken = await getTenantAccessToken();

  const res = await fetch(`${FEISHU_API_BASE}/authen/v1/oidc/refresh_access_token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${tenantToken}`,
    },
    body: JSON.stringify({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  });

  const data = await res.json();
  if (data.code !== 0) {
    throw new Error(`刷新 token 失败: ${data.msg}`);
  }

  return {
    accessToken: data.data.access_token,
    refreshToken: data.data.refresh_token,
    expiresIn: data.data.expires_in,
  };
}

/**
 * Make an authenticated API call to Feishu
 * Uses tenant_access_token by default
 */
export async function feishuApiCall<T = any>(
  path: string,
  options: {
    method?: string;
    body?: any;
    useUserToken?: string;
  } = {}
): Promise<T> {
  const { method = 'GET', body, useUserToken } = options;
  
  const token = useUserToken || await getTenantAccessToken();

  const headers: Record<string, string> = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  };

  const res = await fetch(`${FEISHU_API_BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json();
  if (data.code !== 0) {
    throw new Error(`飞书 API 调用失败 [${path}]: ${data.msg} (code: ${data.code})`);
  }

  return data.data as T;
}

/** Clear cached tokens (for logout) */
export function clearFeishuTokenCache(): void {
  cachedTenantToken = null;
}
