/**
 * Customer portal branding — the per-tenant skin (logo, brand colour) for the
 * public, unauthenticated user-login screen. Ported from app's
 * lib/clients/customerPortal.ts.
 *
 * Mirrors voipappz-app: GET /tasks/customer_portal_data, resolved server-side
 * from the request's origin host (voipappz-api's customer.profile — a tenant
 * rebrands with no code change). PUBLIC — sent with no auth headers, since it
 * has to skin the login page before any session exists.
 *
 * Deliberately NOT cached (no localStorage) — always fetched fresh, so a
 * browser that later hits a different tenant's origin never shows a stale
 * brand from whatever was last cached here.
 */
import { config } from '../config.js';

const PORTAL_PATH = '/tasks/customer_portal_data';

/**
 * In production `config.baseUrl` is '' and this stays relative, so the API
 * still resolves the tenant from the request's own Host header — the whole
 * point of the endpoint. In local dev the admin runs on :3000 while the API is
 * elsewhere, so a relative path fetches index.html from vite and the JSON parse
 * fails: the login page silently fell back to default branding. Prefixing with
 * the configured base sends the request to the API host, whose Host header is
 * the tenant's, so dev resolves the same branding production does.
 */
const portalUrl = () => `${config.baseUrl}${PORTAL_PATH}`;

/**
 * Fetch the portal branding. Never throws — branding is cosmetic, so a
 * failure must not block the login page, it just falls back to the default
 * VoipAppz look.
 */
export async function loadCustomerPortalData() {
  try {
    // Branding is cosmetic and the login page awaits this — an unreachable
    // backend must fail fast, not hang the page for however long the OS takes
    // to give up on a dead TCP connect.
    const timeout = AbortSignal.timeout ? AbortSignal.timeout(3000) : undefined;
    const response = await fetch(portalUrl(), timeout ? { signal: timeout } : {});
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}
