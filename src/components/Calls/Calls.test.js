import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import useCalls from './Calls.js';
import { USER_CALL_COLUMNS } from './userCallColumns';

let userSession = false;
vi.mock('../../context/AuthContext', () => ({ useAuth: () => ({ access: userSession ? undefined : 'account-token' }) }));
vi.mock('../../context/UserAuthContext', () => ({ useUserAuth: () => ({ token: userSession ? 'user-token' : undefined }) }));
vi.mock('../../hooks/useIsUserSession', () => ({ useIsUserSession: () => userSession }));

const requested = () => globalThis.fetch.mock.calls.map(([url, init]) => ({ url: String(url), auth: init?.headers?.Authorization }));

beforeEach(() => {
  globalThis.fetch = vi.fn(async () => ({ ok: true, json: async () => [], headers: { get: () => null } }));
});

// A portal user signs in to the same console and sees its Calls screen. The
// API serves a user token the list, segments and aggregate — but not the
// account's column config (action=columns).
describe('useCalls for a portal user', () => {
  it('uses fixed columns and never asks for account-only column or saved-filter data', async () => {
    userSession = true;
    const { result } = renderHook(() => useCalls());
    await waitFor(() => expect(result.current.loadingColumns).toBe(false));
    expect(result.current.columns).toEqual(USER_CALL_COLUMNS);
    expect(requested().some((r) => r.url.includes('action=columns'))).toBe(false);
    expect(requested().some((r) => r.url.includes('action=params') || r.url.includes('action=save_params'))).toBe(false);
  });

  it("sends the user's token", async () => {
    userSession = true;
    renderHook(() => useCalls());
    await waitFor(() => expect(requested().length).toBeGreaterThan(0));
    requested().forEach((r) => expect(r.auth).toBe('Bearer user-token'));
  });
});

describe('useCalls for an account', () => {
  it('reads the column config with the account token', async () => {
    userSession = false;
    renderHook(() => useCalls());
    await waitFor(() => expect(requested().some((r) => r.url.includes('action=columns'))).toBe(true));
    expect(requested().find((r) => r.url.includes('action=columns')).auth).toBe('Bearer account-token');
  });
});
