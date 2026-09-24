import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { apiService } from './apiService';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { UserAuthProvider, useUserAuth } from '../context/UserAuthContext';
import {
  ADMIN_SESSION_KEYS,
  SESSION_ENDED_EVENT,
  endAdminSession,
  endUserSession,
} from './sessionIsolation';

// Account login (AuthContext, `auth`) and portal user login (UserAuthContext,
// `user_auth`) must never merge: at most one session exists, and neither side
// reads, writes or clears the other's storage except to end it on sign-in.

const farFuture = () => new Date(Date.now() + 60 * 60 * 1000).toISOString();
const adminSession = { access: 'admin-token', refresh: 'admin-refresh', user: { email: 'a@x.io' }, acl: {} };
const userSession = () => ({ token: 'user-token', user: { uuid: 'u-1' }, tokenExpiresAt: farFuture() });

const wrapper = ({ children }) => (
  <AuthProvider>
    <UserAuthProvider>{children}</UserAuthProvider>
  </AuthProvider>
);

const renderBoth = async () => {
  const hook = renderHook(() => ({ admin: useAuth(), user: useUserAuth() }), { wrapper });
  await waitFor(() => {
    expect(hook.result.current.admin.initializing).toBe(false);
    expect(hook.result.current.user.initializing).toBe(false);
  });
  return hook;
};

let post;
beforeEach(() => {
  localStorage.clear();
  post = vi.spyOn(apiService, 'post').mockResolvedValue({});
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

const revokedTokens = () => post.mock.calls.map(([, body]) => body.get('token'));

describe('endUserSession / endAdminSession', () => {
  it('ending the portal session clears only user_auth and revokes the portal token', () => {
    localStorage.setItem('auth', JSON.stringify(adminSession));
    localStorage.setItem('user_auth', JSON.stringify(userSession()));
    const events = [];
    const onEnded = (e) => events.push(e.detail.surface);
    window.addEventListener(SESSION_ENDED_EVENT, onEnded);

    expect(endUserSession()).toBe(true);

    window.removeEventListener(SESSION_ENDED_EVENT, onEnded);
    expect(localStorage.getItem('user_auth')).toBeNull();
    expect(localStorage.getItem('auth')).not.toBeNull();
    expect(revokedTokens()).toEqual(['user-token']);
    expect(events).toEqual(['user']);
  });

  it('ending the admin session clears every admin key, legacy ones included, and nothing else', () => {
    localStorage.setItem('auth', JSON.stringify(adminSession));
    ['access_token', 'refresh_token', 'csrf_token', 'access_expires_at', 'refresh_expires_at'].forEach((k) =>
      localStorage.setItem(k, 'x'),
    );
    localStorage.setItem('user_authenticated', 'true');
    localStorage.setItem('user_auth', JSON.stringify(userSession()));

    expect(endAdminSession()).toBe(true);

    ADMIN_SESSION_KEYS.forEach((k) => expect(localStorage.getItem(k)).toBeNull());
    expect(localStorage.getItem('user_auth')).not.toBeNull();
    expect(revokedTokens()).toEqual(['admin-token']);
  });

  it('is a no-op when that session does not exist', () => {
    expect(endUserSession()).toBe(false);
    expect(endAdminSession()).toBe(false);
    expect(post).not.toHaveBeenCalled();
  });
});

describe('one session at a time', () => {
  it('a portal sign-in ends the admin session', async () => {
    const { result } = await renderBoth();

    act(() => result.current.admin.login(adminSession));
    await waitFor(() => expect(localStorage.getItem('auth')).not.toBeNull());

    localStorage.setItem('user_auth', JSON.stringify(userSession()));
    act(() => result.current.user.login(userSession()));

    await waitFor(() => expect(result.current.admin.isAuthenticated).toBe(false));
    expect(result.current.user.isAuthenticated).toBe(true);
    expect(localStorage.getItem('auth')).toBeNull();
    expect(localStorage.getItem('user_auth')).not.toBeNull();
    expect(revokedTokens()).toContain('admin-token');
    // With the admin session gone, the portal's requests carry the portal token.
    expect(apiService.getToken()).toBe('user-token');
  });

  it('an admin sign-in ends the portal session', async () => {
    const { result } = await renderBoth();

    localStorage.setItem('user_auth', JSON.stringify(userSession()));
    act(() => result.current.user.login(userSession()));
    await waitFor(() => expect(result.current.user.isAuthenticated).toBe(true));

    localStorage.setItem('auth', JSON.stringify(adminSession));
    act(() => result.current.admin.login(adminSession));

    await waitFor(() => expect(result.current.user.isAuthenticated).toBe(false));
    expect(result.current.admin.isAuthenticated).toBe(true);
    expect(localStorage.getItem('user_auth')).toBeNull();
    expect(revokedTokens()).toContain('user-token');
    expect(apiService.getToken()).toBe('admin-token');
  });

  it('a browser that already holds both keeps the admin session and drops the portal one', async () => {
    localStorage.setItem('auth', JSON.stringify(adminSession));
    localStorage.setItem('user_auth', JSON.stringify(userSession()));

    const { result } = await renderBoth();

    expect(result.current.user.isAuthenticated).toBe(false);
    expect(localStorage.getItem('user_auth')).toBeNull();
    expect(revokedTokens()).toContain('user-token');
  });

  it('logging out of one surface never touches the other surface storage', async () => {
    const { result } = await renderBoth();

    act(() => result.current.admin.login(adminSession));
    await waitFor(() => expect(localStorage.getItem('auth')).not.toBeNull());
    // Written behind the contexts' backs: logout must still leave it alone.
    localStorage.setItem('user_auth', JSON.stringify(userSession()));
    act(() => result.current.admin.logout());
    await waitFor(() => expect(localStorage.getItem('auth')).toBeNull());
    expect(localStorage.getItem('user_auth')).not.toBeNull();

    localStorage.clear();
    localStorage.setItem('auth', JSON.stringify(adminSession));
    act(() => result.current.user.logout());
    expect(localStorage.getItem('auth')).not.toBeNull();
  });
});

// Ending a session also forgets what belonged to the person: cached API
// responses, their chat sessions, what they recently opened or edited, their
// customer's branding and selection. The next person on this browser must not
// inherit any of it.
describe('ending a session forgets the person', () => {
  const personal = {
    ai_chat_session_id: 'chat-1',
    vml_chat_session_id: 'vml-1',
    nimbus_recent_objects: '[{"uuid":"u-9","name":"Dana"}]',
    nimbus_recent_pages: '[{"path":"/users"}]',
    customerData: '{"logo_title":"Acme"}',
    selectedCustomer: 'cust-1',
  };

  it('when an account session is ended', () => {
    localStorage.setItem('auth', JSON.stringify(adminSession));
    Object.entries(personal).forEach(([k, v]) => localStorage.setItem(k, v));
    const reset = vi.spyOn(apiService, 'resetSession');
    endAdminSession();
    Object.keys(personal).forEach((k) => expect(localStorage.getItem(k)).toBeNull());
    expect(reset).toHaveBeenCalled();
  });

  it('when a portal user signs out', async () => {
    localStorage.setItem('user_auth', JSON.stringify(userSession()));
    const hook = await renderBoth();
    Object.entries(personal).forEach(([k, v]) => localStorage.setItem(k, v));
    const reset = vi.spyOn(apiService, 'resetSession');
    act(() => hook.result.current.user.logout());
    Object.keys(personal).forEach((k) => expect(localStorage.getItem(k)).toBeNull());
    expect(reset).toHaveBeenCalled();
  });

  it('when an account signs out', async () => {
    localStorage.setItem('auth', JSON.stringify(adminSession));
    const hook = await renderBoth();
    Object.entries(personal).forEach(([k, v]) => localStorage.setItem(k, v));
    act(() => hook.result.current.admin.logout());
    Object.keys(personal).forEach((k) => expect(localStorage.getItem(k)).toBeNull());
  });
});
