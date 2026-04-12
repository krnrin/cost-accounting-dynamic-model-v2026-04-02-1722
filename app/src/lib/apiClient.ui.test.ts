import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { apiClient } from './apiClient';

describe('apiClient', () => {
  const originalFetch = global.fetch;
  const originalLocation = window.location;

  beforeEach(() => {
    global.fetch = vi.fn();
    // @ts-ignore
    delete window.location;
    window.location = { href: '' } as any;
    localStorage.clear();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    window.location = originalLocation;
  });

  it('adds auth header when token exists', async () => {
    localStorage.setItem('auth-storage', JSON.stringify({ state: { token: 'test-token' } }));
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: 'success' }),
    });

    await apiClient('/test');
    
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/test'),
      expect.objectContaining({
        headers: expect.objectContaining({
          'Authorization': 'Bearer test-token',
        }),
      })
    );
  });

  it('handles 401 by clearing auth and redirecting', async () => {
    localStorage.setItem('auth-storage', JSON.stringify({ state: { token: 'expired' } }));
    (global.fetch as any).mockResolvedValue({
      status: 401,
      ok: false,
    });

    await expect(apiClient('/test')).rejects.toThrow('登录已过期');
    expect(localStorage.getItem('auth-storage')).toBeNull();
    expect(window.location.href).toBe('/');
  });

  it('retries on network error', async () => {
    (global.fetch as any)
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: 'recovered' }),
      });

    const result = await apiClient('/test', { retries: 1 });
    expect(result).toBe('recovered');
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('returns data directly if present', async () => {
     (global.fetch as any).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: { id: 1 } }),
    });

    const result = await apiClient('/test');
    expect(result).toEqual({ id: 1 });
  });
});
