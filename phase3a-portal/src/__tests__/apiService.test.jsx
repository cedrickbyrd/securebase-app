import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  apiService,
  clearStoredSessionToken,
  clearStoredUserSession,
  getStoredSessionToken,
  persistSessionToken,
} from '../services/apiService';

global.fetch = vi.fn();

describe('apiService session token persistence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('stores the token in sessionStorage by default', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        token: 'jwt-token-123',
        user: { email: 'test@example.com', role: 'user' },
      }),
    });

    const result = await apiService.authenticate('test@example.com', 'SecureBase123!');

    expect(result.token).toBe('jwt-token-123');
    expect(sessionStorage.getItem('sessionToken')).toBe('jwt-token-123');
    expect(localStorage.getItem('sessionToken')).toBeNull();
    expect(localStorage.getItem('userEmail')).toBe('test@example.com');
  });

  it('stores the token in localStorage when remember me is enabled', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        token: 'jwt-token-remembered',
        user: { email: 'remember@example.com', role: 'admin' },
      }),
    });

    await apiService.authenticate('remember@example.com', 'SecureBase123!', null, true);

    expect(localStorage.getItem('sessionToken')).toBe('jwt-token-remembered');
    expect(sessionStorage.getItem('sessionToken')).toBeNull();
    expect(localStorage.getItem('userRole')).toBe('admin');
  });

  it('reads the bearer token from localStorage when sessionStorage is empty', async () => {
    localStorage.setItem('sessionToken', 'persisted-token');
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: 'ok' }),
    });

    await apiService.get('/protected');

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/protected'),
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({
          Authorization: 'Bearer persisted-token',
        }),
      })
    );
  });

  it('clears both storage locations on a 401 response', async () => {
    sessionStorage.setItem('sessionToken', 'short-lived-token');
    localStorage.setItem('sessionToken', 'remembered-token');
    global.fetch.mockResolvedValueOnce({
      status: 401,
      ok: false,
      json: async () => ({ message: 'expired' }),
    });

    await expect(apiService.get('/protected')).rejects.toThrow('Session expired. Please log in again.');

    expect(sessionStorage.getItem('sessionToken')).toBeNull();
    expect(localStorage.getItem('sessionToken')).toBeNull();
  });
});

describe('apiService storage helpers', () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
  });

  it('persists only one copy of the token in the chosen storage location', () => {
    sessionStorage.setItem('sessionToken', 'old-session');
    localStorage.setItem('sessionToken', 'old-local');

    persistSessionToken('fresh-token', true);
    expect(localStorage.getItem('sessionToken')).toBe('fresh-token');
    expect(sessionStorage.getItem('sessionToken')).toBeNull();

    persistSessionToken('tab-only-token', false);
    expect(sessionStorage.getItem('sessionToken')).toBe('tab-only-token');
    expect(localStorage.getItem('sessionToken')).toBeNull();
  });

  it('returns the currently stored token and clears both stores when requested', () => {
    localStorage.setItem('sessionToken', 'remembered-token');
    expect(getStoredSessionToken()).toBe('remembered-token');

    clearStoredSessionToken();
    expect(getStoredSessionToken()).toBeNull();
  });

  it('clears stored profile metadata on full logout cleanup', () => {
    localStorage.setItem('sessionToken', 'remembered-token');
    localStorage.setItem('userEmail', 'remember@example.com');
    localStorage.setItem('userRole', 'admin');

    clearStoredUserSession();

    expect(localStorage.getItem('sessionToken')).toBeNull();
    expect(localStorage.getItem('userEmail')).toBeNull();
    expect(localStorage.getItem('userRole')).toBeNull();
  });
});
