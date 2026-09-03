import { CONFIG } from '../config';

/**
 * The stored session, and the one rule that keeps it honest: a token belongs to
 * the server that minted it.
 *
 * An installed extension keeps its localStorage across an update, so a build
 * that moves `CONFIG.API_ENDPOINT` inherits the previous server's `_domain`,
 * `_token` and `_id`. Nothing rejects them locally — `isAuthenticated()` only
 * asks whether a token string exists — so the popup opens straight onto the
 * main page and every call goes to the old host. The portal is stricter than
 * that: `TokenAuth` asks the node to verify the token and there is no HTTP
 * fallback, so a foreign token is refused at the socket handshake and Chrome
 * reports "HTTP Authentication failed; no valid credentials available".
 *
 * Hence `_domain_source`: the endpoint a session was established against. When
 * it no longer matches the compiled one, the session is from somewhere else and
 * is dropped, which puts the user back on the login form against the new host.
 *
 * A `_domain` with NO recorded source is left alone — that is the deliberate
 * runtime override the e2e specs seed to aim at a fake node.
 */
const DOMAIN = '_domain';
const SOURCE = '_domain_source';

export function healStaleSession(): void {
  const source = localStorage.getItem(SOURCE);
  if (!source || source === CONFIG.API_ENDPOINT) return;

  console.warn(`[session] endpoint moved ${source} → ${CONFIG.API_ENDPOINT} — dropping the old session`);
  localStorage.removeItem(DOMAIN);
  localStorage.removeItem(SOURCE);
  localStorage.removeItem('_token');
  localStorage.removeItem('_id');
  localStorage.removeItem('_username');
  localStorage.removeItem('_password');
}

/**
 * Where this extension talks to. The scheme is preserved rather than forced to
 * https, because the portal runs on plain http in development and forcing https
 * there produced a connection failure that read as a rejected login.
 */
export function endpoint(): string {
  const raw = (localStorage.getItem(DOMAIN) || CONFIG.API_ENDPOINT || '').trim();
  const d = raw.replace(/\/+$/, '');
  return /^https?:\/\//.test(d) ? d : 'https://' + d;
}

/** Called on a successful login: records the endpoint the session belongs to. */
export function rememberSession(domain: string): void {
  localStorage.setItem(DOMAIN, domain);
  localStorage.setItem(SOURCE, CONFIG.API_ENDPOINT);
}

/**
 * Remembered sign-in, prefilled into the login form.
 *
 * A stored PASSWORD is a real trade: extension localStorage is plaintext on
 * disk, readable by anyone with the profile directory or devtools on this
 * extension. It is kept because signing in on every popup open is the thing
 * this replaces, and it is dropped by `logout()` and by `healStaleSession()`
 * along with the rest of the session — so it never outlives the server it
 * belongs to.
 */
const USERNAME = '_username';
const PASSWORD = '_password';

export function rememberCredentials(username: string, password: string): void {
  localStorage.setItem(USERNAME, username || '');
  localStorage.setItem(PASSWORD, password || '');
}

export function rememberedCredentials(): { username: string; password: string } {
  return {
    username: localStorage.getItem(USERNAME) || '',
    password: localStorage.getItem(PASSWORD) || '',
  };
}

export function forgetCredentials(): void {
  localStorage.removeItem(USERNAME);
  localStorage.removeItem(PASSWORD);
}
