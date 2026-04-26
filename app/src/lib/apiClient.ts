// src/lib/apiClient.ts
const API_BASE = (import.meta as any).env.VITE_API_URL || '/api';

// [PR-002] 默认超时时间 30秒
const DEFAULT_TIMEOUT_MS = 30000;

function getToken(): string | null {
  try {
    const raw = localStorage.getItem('auth-storage');
    if (!raw) return null;
    return JSON.parse(raw)?.state?.token || null;
  } catch { return null; }
}

function handleUnauthorized() {
  localStorage.removeItem('auth-storage');
  window.location.href = '/';
}

interface ApiOptions extends Omit<RequestInit, 'body'> {
  body?: any; // auto JSON.stringify
  retries?: number;
  /** [PR-002] 超时时间（毫秒），默认 30000 */
  timeout?: number;
}

export async function apiClient<T = any>(
  path: string,
  options: ApiOptions = {}
): Promise<T> {
  const { body, retries = 1, timeout = DEFAULT_TIMEOUT_MS, ...fetchOptions } = options;

  // [PR-002] 写操作（POST/PUT/DELETE/PATCH）不重试
  const method = (fetchOptions.method || 'GET').toUpperCase();
  const effectiveRetries = method === 'GET' ? retries : 0;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((fetchOptions.headers as Record<string, string>) || {}),
  };
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const url = `${API_BASE}${path}`;

  // [PR-002] 使用 AbortController 实现超时
  const abortController = new AbortController();
  const timeoutId = setTimeout(() => abortController.abort(), timeout);

  const init: RequestInit = {
    ...fetchOptions,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    signal: abortController.signal,
  };

  let lastError: any = null;
  for (let attempt = 0; attempt <= effectiveRetries; attempt++) {
    try {
      const res = await fetch(url, init);
      clearTimeout(timeoutId);
      if (res.status === 401) { handleUnauthorized(); throw new Error('登录已过期'); }
      if (res.status === 204) return undefined as T;
      const json = await res.json();
      if (!res.ok) {
        const err = new Error(json.error || `Request failed: ${res.status}`);
        (err as any).status = res.status;
        throw err;
      }
      return json.data !== undefined ? json.data : json;
    } catch (err: any) {
      clearTimeout(timeoutId);
      lastError = err;
      // 超时错误
      if (err.name === 'AbortError') {
        throw new Error(`请求超时 (${timeout}ms)`);
      }
      if (err.message === '登录已过期') throw err;
      // 4xx client errors should not be retried — only retry network errors and 5xx
      if (err.status && err.status >= 400 && err.status < 500) throw err;
      // [PR-002] 写操作不重试
      if (method !== 'GET') throw err;
      if (attempt < effectiveRetries) continue;
      throw err;
    }
  }
  throw lastError || new Error('Request failed');
}
