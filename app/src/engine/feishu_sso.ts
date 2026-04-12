/**
 * C2: 飞书 SSO
 * OAuth 登录流程（前端部分，appSecret 必须通过后端代理）
 */

export interface FeishuSSOConfig {
  appId: string;
  redirectUri: string;
  baseUrl: string;
}

export interface FeishuUser {
  userId: string;
  name: string;
  email: string;
  avatarUrl?: string;
  department?: string;
}

export function getLoginUrl(config: FeishuSSOConfig, state?: string): string {
  const params = new URLSearchParams({
    app_id: config.appId,
    redirect_uri: config.redirectUri,
    state: state || Math.random().toString(36).substring(2),
  });
  return `${config.baseUrl}/open-apis/authen/v1/authorize?${params.toString()}`;
}

/**
 * 用授权码换取 access_token
 * ⚠️ 生产环境必须通过后端代理调用，避免暴露 appSecret
 */
export async function exchangeToken(
  backendProxyUrl: string,
  code: string
): Promise<{ accessToken: string; refreshToken: string; expiresIn: number }> {
  const resp = await fetch(backendProxyUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code }),
  });
  const data = await resp.json();
  if (data.code !== 0) throw new Error(`飞书SSO失败: ${data.msg}`);
  return {
    accessToken: data.data.access_token,
    refreshToken: data.data.refresh_token,
    expiresIn: data.data.expires_in,
  };
}

export async function getUserInfo(
  config: FeishuSSOConfig,
  accessToken: string
): Promise<FeishuUser> {
  const resp = await fetch(`${config.baseUrl}/open-apis/authen/v1/user_info`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await resp.json();
  if (data.code !== 0) throw new Error(`获取用户信息失败: ${data.msg}`);
  return {
    userId: data.data.user_id,
    name: data.data.name,
    email: data.data.email,
    avatarUrl: data.data.avatar_url,
    department: data.data.department_name,
  };
}
