/**
 * The token the cable is opened with, and where it came from.
 *
 * `va_cable_token` comes first: local development against a REMOTE API, where
 * the login is signed with that API's secret and a local node cannot verify
 * it. A token signed with the local node's secret, set by hand, lets the cable
 * authenticate while every API call keeps the real login. Every socket to the
 * node must resolve it the same way, or one reads "refused" while the other is
 * live on the same node.
 *
 * Admin sessions keep theirs under `auth`; portal users under `user_auth`.
 */
export function cableToken() {
  try {
    const override = localStorage.getItem('va_cable_token');
    if (override) return { token: override, source: 'override' };
    const admin = JSON.parse(localStorage.getItem('auth') || 'null');
    if (admin?.access) return { token: admin.access, source: 'admin' };
    const portal = JSON.parse(localStorage.getItem('user_auth') || 'null');
    if (portal?.token) return { token: portal.token, source: 'portal' };
  } catch {
    // Unreadable storage is the same answer as an empty one.
  }
  return { token: null, source: null };
}

/**
 * The JWT's `exp` in milliseconds, or null when it has none or is not a JWT.
 * Decoded only to SHOW it — the node is what verifies the token.
 */
export function tokenExpiresAt(token) {
  if (!token) return null;
  try {
    const part = token.split('.')[1];
    if (!part) return null;
    const json = atob(part.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(part.length / 4) * 4, '='));
    const exp = Number(JSON.parse(json)?.exp);
    return Number.isFinite(exp) && exp > 0 ? exp * 1000 : null;
  } catch {
    return null;
  }
}

/** The cable URL with the token in it — never shown or logged unredacted. */
export function cableUrlFor(base, token) {
  if (!base || !token) return null;
  return `${base}${base.includes('?') ? '&' : '?'}token=${encodeURIComponent(token)}`;
}

export const redactCableUrl = (url) => (url ? url.replace(/token=[^&]+/, 'token=***') : null);
