/**
 * Lets the popup UI run as a plain Angular app (`ng serve`) instead of as a
 * packed extension.
 *
 * WHY: the UI is ordinary Angular — forms, routing, MUI-less components — and
 * iterating on it by rebuilding the extension and clicking "reload" in
 * chrome://extensions is slow enough that people stop doing it. The only thing
 * standing in the way is that `chrome.*` does not exist outside an extension,
 * and `main.ts` bootstraps *inside* `chrome.tabs.query`, so without this the
 * page does not render at all — it is blank, not degraded.
 *
 * SELF-INSTALLING, AND ONLY WHEN ABSENT. There is no dev flag and no build
 * variant: inside a real extension `chrome` is always defined, so this file
 * does nothing there. That is deliberate — a shim gated on a flag is a shim
 * that eventually ships enabled.
 *
 * WHAT IS FAITHFUL AND WHAT IS NOT:
 *
 *   tabs.query      one fake tab, id 0 — TAB_ID only addresses the content
 *                   script, which does not exist in a browser tab anyway.
 *   tabs.create     window.open. tabs.update navigates this tab.
 *   tabs.sendMessage no content script to answer, so the callback gets
 *                   undefined. The popup component already handles that.
 *   runtime.connect a port that opens the REAL /ws/events socket, so browser
 *                   mode exercises the same realtime hop the background worker
 *                   uses. Frames go to the console: the UI never reads them
 *                   off the port (`main.component.ts` has its listener
 *                   commented out), so forwarding them further would be
 *                   inventing a contract that does not exist.
 *   port messages   the port pushes {event:"realtime"} the same way the worker
 *                   does, driven by the same welcome frame — so the connection
 *                   light is exercised in browser mode rather than sitting
 *                   permanently grey, which would look like a bug in the very
 *                   thing being developed. Nothing is stored, here or there.
 */

const BEARER_PREFIX = 'voipappz-bearer.';

function base64url(value: string): string {
  return btoa(value).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// The port the UI talks to. It only ever posts {event:"login"|"logout"}, so
// that is all this understands.
function fakePort() {
  let socket: WebSocket | null = null;
  const listeners: Array<(msg: any) => void> = [];
  let state = { connected: false, cable_ready: false };

  const emit = (msg: any) => listeners.forEach((fn) => fn(msg));

  const setRealtimeState = (connected: boolean, cable_ready = false) => {
    state = { connected, cable_ready: connected && cable_ready };
    emit({ event: 'realtime', ...state });
  };

  const close = () => {
    try { socket?.close(); } catch { /* already gone */ }
    socket = null;
    setRealtimeState(false);
  };

  return {
    name: 'shim',
    onMessage: {
      addListener: (fn: (msg: any) => void) => { listeners.push(fn); fn({ event: 'realtime', ...state }); },
      removeListener: (fn: any) => { const i = listeners.indexOf(fn); if (i >= 0) listeners.splice(i, 1); },
    },
    onDisconnect: { addListener: () => undefined, removeListener: () => undefined },
    disconnect: close,
    postMessage(msg: any) {
      if (msg?.event === 'status') return emit({ event: 'realtime', ...state });
      if (msg?.event === 'logout') return close();
      if (msg?.event !== 'login') return;

      // The UI posts a bare {event,user_uuid} on reload and the full session
      // only on a fresh sign-in, so fall back to what login stored.
      const token = msg?.data?.token || localStorage.getItem('_token') || '';
      const domain = (msg?.domain || localStorage.getItem('_domain') || '').replace(/\/+$/, '');
      if (!token || !domain) {
        console.warn('[chrome-shim] no session yet — sign in to open /ws/events');
        return;
      }

      close();
      // Preserve the scheme, as the background worker does: https -> wss.
      const url = domain.replace(/^http/, 'ws') + '/ws/events';
      console.log('[chrome-shim] realtime →', url);
      socket = new WebSocket(url, [BEARER_PREFIX + base64url(token)]);
      socket.onopen = () => console.log('[chrome-shim] realtime open');
      socket.onmessage = (ev) => {
        console.log('[chrome-shim] frame', ev.data);
        // The welcome frame is what turns the light green, here as in the
        // worker: an open socket to a portal whose cable is down delivers
        // nothing.
        try {
          const frame = JSON.parse(typeof ev.data === 'string' ? ev.data : '');
          if (frame && frame.type === 'welcome') setRealtimeState(true, !!frame.cable_ready);
        } catch { /* not a frame we judge on */ }
      };
      socket.onclose = (ev) => {
        console.log('[chrome-shim] realtime closed', ev.code);
        setRealtimeState(false);
      };
    },
  };
}

if (typeof (globalThis as any).chrome === 'undefined' || !(globalThis as any).chrome?.tabs) {
  console.info('[chrome-shim] no extension APIs — running as a plain Angular app');

  (globalThis as any).chrome = {
    tabs: {
      query: (_info: any, cb: (tabs: any[]) => void) => cb([{ id: 0 }]),
      create: ({ url }: { url: string }) => window.open(url, '_blank'),
      update: (_tabId: number, { url }: { url: string }) => { window.location.href = url; },
      sendMessage: (_tabId: number, _msg: any, cb?: (r: any) => void) => cb && cb(undefined),
    },
    runtime: {
      connect: fakePort,
      lastError: undefined,
      onConnect: { addListener: () => undefined },
      // The build stamp reads this. A shim without it renders "v" and nothing
      // else in browser mode, which reads as a broken stamp rather than as
      // "there is no manifest outside an extension".
      getManifest: () => ({ version: '0.0.0-dev' }),
    },
  };
}
