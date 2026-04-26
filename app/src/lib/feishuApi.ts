/**
 * 飞书 API 客户端
 *
 * 安全设计: 所有飞书 API 调用通过后端代理，前端不持有 APP_SECRET
 * 提供:
 * - 用户信息获取 (通过后端代理)
 * - 飞书 API 代理调用
 */

const FEISHU_API_BASE = '/api/feishu';

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
 * Check if Feishu is configured on the backend
 */
export async function isFeishuConfigured(): Promise<boolean> {
  try {
    const res = await fetch(`${FEISHU_API_BASE}/status`);
    const data = await res.json();
    return data.configured === true;
  } catch {
    return false;
  }
}

/**
 * Exchange auth code for user info via backend proxy
 */
export async function exchangeFeishuCode(code: string): Promise<FeishuUserInfo> {
  const res = await fetch(`${FEISHU_API_BASE}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || '飞书登录失败');
  }

  const userInfo = data.data;
  return {
    openId: userInfo.openId || '',
    unionId: userInfo.unionId || '',
    userId: userInfo.userId || '',
    name: userInfo.name || '',
    avatarUrl: userInfo.avatarUrl || '',
    email: userInfo.email || '',
    mobile: userInfo.mobile || '',
  };
}

/**
 * Make an authenticated API call to Feishu via backend proxy
 * Requires user to be logged in (JWT token in Authorization header)
 */
export async function feishuApiCall<T = unknown>(
  path: string,
  options: {
    method?: string;
    body?: unknown;
  } = {}
): Promise<T> {
  const token = localStorage.getItem('token');
  if (!token) {
    throw new Error('未登录，无法调用飞书 API');
  }

  const res = await fetch(`${FEISHU_API_BASE}/proxy`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({
      path,
      method: options.method || 'GET',
      body: options.body,
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || '飞书 API 调用失败');
  }

  return data.data as T;
}
