// Path prefixes the Vite dev server proxies to VITE_API_BASE_URL — keep in
// sync with `server.proxy` in vite.config.js.
const PROXY_PREFIXES = ['/api', '/auth', '/recordings', '/tasks', '/custom', '/ai', '/health'];
const isProxiedPath = (pathname = '') =>
  PROXY_PREFIXES.some((prefix) => pathname.startsWith(prefix));

/**
 * DEBUG ONLY — print the URL every HTTP request ACTUALLY reaches.
 *
 * In dev the app talks to `http://localhost:3000/api/...` and Vite forwards it
 * to VITE_API_BASE_URL, so DevTools (and every log inside apiService) shows the
 * localhost address — never the host that served the response. That makes it
 * impossible to tell at a glance whether a call went to cloud.voipappz.io, to a
 * per-environment API base set at runtime (see setDynamicApiBaseUrl in
 * config.js), or somewhere unintended.
 *
 * This patches the two transports the app actually uses — window.fetch
 * (apiService and ~40 direct callers) and XMLHttpRequest (axios, in the two
 * login hooks) — so ALL of them are covered without touching call sites.
 *
 * Dev only: a no-op in production builds.
 */

const TAG = 'color:#8e24aa;font-weight:bold';

const statusStyle = (status) => {
  if (typeof status !== 'number') return 'color:#e53935';
  if (status >= 500) return 'color:#e53935';
  if (status >= 400) return 'color:#fb8c00';
  if (status >= 300) return 'color:#8e24aa';
  return 'color:#43a047';
};

const proxyTarget = () =>
  String(import.meta.env?.VITE_API_BASE_URL || '').replace(/\/+$/, '');

/**
 * Where a request really lands.
 *
 * Relative URL on our own origin + a proxied prefix -> the dev server dials
 * VITE_API_BASE_URL with the same path. Anything else (an absolute URL from a
 * dynamic API base, a third party, a same-origin asset) goes out as written.
 */
export const resolveRealUrl = (input) => {
  const raw = typeof input === 'string'
    ? input
    : (input && typeof input === 'object' && 'url' in input ? input.url : String(input));

  let url;
  try {
    url = new URL(raw, window.location.href);
  } catch {
    return { real: String(raw), seen: String(raw), proxied: false };
  }

  const target = proxyTarget();
  const proxied = Boolean(target)
    && url.origin === window.location.origin
    && isProxiedPath(url.pathname);

  return {
    real: proxied ? `${target}${url.pathname}${url.search}` : url.href,
    seen: url.href,
    proxied,
  };
};

const logRequest = (method, info, status, startedAt) => {
  const ms = Math.round(performance.now() - startedAt);
  // `(direct)` marks a request that did NOT go through the dev proxy — i.e. the
  // URL printed is the literal one the browser used, not a reconstruction.
  console.log(
    `%c[HTTP]%c ${String(status).padEnd(5)} ${method.padEnd(6)} ${info.real}${info.proxied ? '' : '  (direct)'}  ${ms}ms`,
    TAG,
    statusStyle(status),
  );
};

const methodOf = (input, init) =>
  String(
    init?.method
      || (input && typeof input === 'object' && 'method' in input ? input.method : null)
      || 'GET',
  ).toUpperCase();

export const installHttpDebug = () => {
  if (typeof window === 'undefined' || !import.meta.env?.DEV) return;

  if (typeof window.fetch === 'function' && !window.fetch.__httpDebug) {
    const nativeFetch = window.fetch.bind(window);
    const patchedFetch = async (input, init) => {
      const info = resolveRealUrl(input);
      const method = methodOf(input, init);
      const startedAt = performance.now();
      try {
        const response = await nativeFetch(input, init);
        logRequest(method, info, response.status, startedAt);
        return response;
      } catch (error) {
        // An aborted request is usually apiService's own timeout, not a
        // network failure — worth telling apart when reading the log.
        logRequest(method, info, error?.name === 'AbortError' ? 'ABORT' : 'FAIL', startedAt);
        throw error;
      }
    };
    patchedFetch.__httpDebug = true;
    window.fetch = patchedFetch;
  }

  const XHR = window.XMLHttpRequest;
  if (XHR && !XHR.prototype.open.__httpDebug) {
    const nativeOpen = XHR.prototype.open;
    const nativeSend = XHR.prototype.send;

    const patchedOpen = function open(method, url, ...rest) {
      this.__httpDebug = {
        method: String(method || 'GET').toUpperCase(),
        info: resolveRealUrl(url),
        startedAt: 0,
      };
      return nativeOpen.call(this, method, url, ...rest);
    };
    patchedOpen.__httpDebug = true;
    XHR.prototype.open = patchedOpen;

    XHR.prototype.send = function send(...args) {
      const entry = this.__httpDebug;
      if (entry) {
        entry.startedAt = performance.now();
        // loadend fires for success, error, abort and timeout alike — one hook
        // covers every outcome, and `status` is 0 for the non-HTTP ones.
        this.addEventListener(
          'loadend',
          () => logRequest(entry.method, entry.info, this.status || 'FAIL', entry.startedAt),
          { once: true },
        );
      }
      return nativeSend.apply(this, args);
    };
  }
};

export default installHttpDebug;
