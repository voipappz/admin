import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getStoredRefreshToken, refreshToken } from './authService';

describe('getStoredRefreshToken', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('reads the synchronously persisted structured auth token', () => {
    localStorage.setItem('auth', JSON.stringify({ refresh: 'fresh-token' }));

    expect(getStoredRefreshToken()).toBe('fresh-token');
  });

  it('falls back to the legacy token when the auth blob is corrupt', () => {
    localStorage.setItem('auth', '{bad json');
    localStorage.setItem('refresh_token', 'legacy-token');

    expect(getStoredRefreshToken()).toBe('legacy-token');
  });
});

describe('refreshToken failure classification', () => {
  afterEach(() => { vi.unstubAllGlobals(); });

  const respond = (status) => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => ({})
  });

  it('marks a 401 as a real rejection', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => respond(401)));

    await expect(refreshToken('rt')).rejects.toMatchObject({ rejected: true, status: 401 });
  });

  it('does not mark a 502 as a rejection', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => respond(502)));

    await expect(refreshToken('rt')).rejects.toMatchObject({ rejected: false, status: 502 });
  });

  it('does not mark an unreachable server as a rejection', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch'); }));

    await expect(refreshToken('rt')).rejects.toMatchObject({ rejected: false, status: 0 });
  });
});
