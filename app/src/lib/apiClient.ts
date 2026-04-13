// src/lib/apiClient.ts
const API_BASE = (import.meta as any).env.VITE_API_URL || '/api';

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
}

export async function apiClient<T = any>(
  path: string,
  options: ApiOptions = {}
): Promise<T> {
  const { body, retries = 1, ...fetchOptions } = options;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((fetchOptions.headers as Record<string, string>) || {}),
  };
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const url = `${API_BASE}${path}`;
  const init: RequestInit = {
    ...fetchOptions,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  };

  let lastError: any = null;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, init);
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
      lastError = err;
      if (err.message === '登录已过期') throw err;
      // 4xx client errors should not be retried — only retry network errors and 5xx
      if (err.status && err.status >= 400 && err.status < 500) throw err;
      if (attempt < retries) continue;
      throw err;
    }
  }
  throw lastError || new Error('Request failed');
}
