import { apiService } from './apiService';

// One session at a time.
//
// The admin console (AuthContext: storage key `auth`, plus the legacy loose
// token keys) and the end-user portal (UserAuthContext: `user_auth`) hold two
// unrelated JWTs, and apiService.getToken() can send only one of them -- it
// prefers the admin token. When both sat in the same browser, the portal
// dashboard at `/` rendered for the portal user while every request went out
// with the ADMIN account's token: the two logins merged.
//
// So signing in on either door ends the other session first: its token is
// revoked, its storage cleared, and its context told (SESSION_ENDED_EVENT) to
// drop the session from memory. src/services/sessionIsolation.test.jsx pins it.
export const SESSION_ENDED_EVENT = 'va:session-ended';

export const ADMIN_SESSION_KEYS = [
  'auth',
  'access_token',
  'refresh_token',
  'csrf_token',
  'access_expires_at',
  'refresh_expires_at',
  'user_authenticated',
];
export const USER_SESSION_KEYS = ['user_auth'];

const readJson = (key) => {
  try {
    return JSON.parse(localStorage.getItem(key) || 'null');
  } catch {
    return null;
  }
};

// Same rules AuthContext and UserAuthContext use to restore a session.
export const adminSessionToken = () =>
  readJson('auth')?.access ||
  (localStorage.getItem('user_authenticated') === 'true' ? localStorage.getItem('access_token') : null) ||
  null;
export const userSessionToken = () => readJson('user_auth')?.token || null;
export const hasAdminSession = () => !!adminSessionToken();

const endSession = (surface, token, keys) => {
  const present = !!token || keys.some((k) => localStorage.getItem(k) !== null);
  if (!present) return false;
  if (token) {
    // Fire-and-forget, like both contexts' logout(): a failed revoke must not
    // keep the old session alive in this browser.
    try {
      apiService.post('/auth/logout', new URLSearchParams({ token })).catch(() => {});
    } catch {
      /* ignore */
    }
  }
  keys.forEach((k) => localStorage.removeItem(k));
  window.dispatchEvent(new CustomEvent(SESSION_ENDED_EVENT, { detail: { surface } }));
  return true;
};

export const endAdminSession = () => endSession('admin', adminSessionToken(), ADMIN_SESSION_KEYS);
export const endUserSession = () => endSession('user', userSessionToken(), USER_SESSION_KEYS);
