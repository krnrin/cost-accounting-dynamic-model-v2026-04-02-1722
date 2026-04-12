/**
 * 飞书环境检测与免登授权
 * 
 * 免登流程:
 * 1. 检测是否在飞书客户端内 (User-Agent 包含 Lark 或 Feishu)
 * 2. 在飞书内: 使用 window.h5sdk → tt.requestAccess 获取 code
 * 3. 在飞书外 (浏览器): 使用 OAuth 重定向方式获取 code
 * 4. 用 code 换取 user_access_token → 获取用户信息
 */

// Feishu H5 SDK types (loaded via script tag in index.html)
declare global {
  interface Window {
    h5sdk?: {
      ready: (callback: () => void) => void;
      error: (callback: (err: any) => void) => void;
      config: (params: { appId: string; timestamp: string; nonceStr: string; signature: string; jsApiList: string[] }) => void;
    };
    tt?: {
      requestAccess: (params: { appID: string; scopeList?: string[] }) => Promise<{ code: string }>;
      requestAuthCode: (params: { appId: string; }) => Promise<{ code: string }>;
      getUserInfo: (params: { withCredentials?: boolean }) => Promise<{
        userID: string; avatarUrl: string; nickName: string; code?: string;
      }>;
    };
  }
}

const FEISHU_APP_ID = import.meta.env.VITE_FEISHU_APP_ID || '';

/** Check if running inside Feishu client */
export function isFeishuEnv(): boolean {
  const ua = navigator.userAgent.toLowerCase();
  return ua.includes('lark') || ua.includes('feishu');
}

/** Check if Feishu integration is configured */
export function isFeishuConfigured(): boolean {
  return !!FEISHU_APP_ID;
}

/** Get the Feishu App ID from env */
export function getFeishuAppId(): string {
  return FEISHU_APP_ID;
}

/** Wait for h5sdk to be ready */
function waitForH5SDK(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.h5sdk) {
      window.h5sdk.ready(() => resolve());
      window.h5sdk.error((err: any) => reject(new Error(`H5SDK error: ${JSON.stringify(err)}`)));
    } else {
      // Retry a few times
      let attempts = 0;
      const timer = setInterval(() => {
        attempts++;
        if (window.h5sdk) {
          clearInterval(timer);
          window.h5sdk.ready(() => resolve());
          window.h5sdk.error((err: any) => reject(new Error(`H5SDK error: ${JSON.stringify(err)}`)));
        } else if (attempts > 20) {
          clearInterval(timer);
          reject(new Error('飞书 H5SDK 加载超时'));
        }
      }, 200);
    }
  });
}

/**
 * Request auth code from Feishu client (in-app login-free)
 * Uses tt.requestAccess to get a temporary authorization code
 */
export async function requestFeishuAuthCode(): Promise<string> {
  if (!isFeishuEnv()) {
    throw new Error('非飞书客户端环境，无法使用免登');
  }
  if (!FEISHU_APP_ID) {
    throw new Error('飞书 App ID 未配置');
  }

  await waitForH5SDK();

  // Try new API first (requestAccess), then fallback to old API (requestAuthCode)
  if (window.tt?.requestAccess) {
    const result = await window.tt.requestAccess({
      appID: FEISHU_APP_ID,
      scopeList: [],
    });
    return result.code;
  }

  if (window.tt?.requestAuthCode) {
    const result = await window.tt.requestAuthCode({
      appId: FEISHU_APP_ID,
    });
    return result.code;
  }

  throw new Error('飞书 JSSDK API 不可用');
}

/**
 * For browser-based OAuth flow (outside Feishu client)
 * Redirects to Feishu OAuth authorization page
 */
export function redirectToFeishuOAuth(): void {
  if (!FEISHU_APP_ID) {
    throw new Error('飞书 App ID 未配置');
  }
  // Use root path as callback — SPA will detect code in URL on any path
  const redirectUri = encodeURIComponent(window.location.origin + '/');
  const url = `https://open.feishu.cn/open-apis/authen/v1/authorize?app_id=${FEISHU_APP_ID}&redirect_uri=${redirectUri}&response_type=code&state=feishu_login`;
  window.location.href = url;
}

/**
 * Extract auth code from URL query params (for OAuth callback)
 * Checks both current search params and hash params.
 * Works whether the callback lands on /auth/callback or / (SPA redirect).
 */
export function extractOAuthCode(): string | null {
  const params = new URLSearchParams(window.location.search);
  const code = params.get('code');
  const state = params.get('state');
  if (code && state?.startsWith('feishu')) {
    // Clean up the URL — redirect to root
    window.history.replaceState({}, '', '/');
    return code;
  }
  return null;
}

export type { };
