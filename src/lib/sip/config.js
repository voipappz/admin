// SIP softphone configuration — fully env-driven, NO tenant endpoint baked in.
// The WSS endpoint normally arrives from the logged-in user's environment
// (voipappz-api `wss_server`); VITE_SIP_* is the env override for dev/demo
// builds. With neither, the softphone simply stays unconfigured (settings not
// "ready" -> no registration attempt). Per-call overrides via useSipPhone().

// SipConfig shape: { wssUrl, domain, iceServers, registerExpires, logLevel,
// reconnectMax, reconnectDelayMs }

// VITE_SIP_ICE, when set, is a JSON array of RTCIceServer objects and fully
// replaces the default list — so STUN/TURN (e.g. the stack's own coturn) is
// configured without a rebuild of this file.
function parseIce() {
  const raw = import.meta.env.VITE_SIP_ICE?.trim();
  if (raw) {
    try { return JSON.parse(raw); }
    catch { console.warn('VITE_SIP_ICE is not valid JSON — using default ICE servers'); }
  }
  // Default STUN is the public vendor-neutral Google server; set VITE_SIP_STUN
  // (or VITE_SIP_ICE) to use the tenant's own STUN/TURN.
  const stun = import.meta.env.VITE_SIP_STUN || 'stun:stun.l.google.com:19302';
  const servers = [{ urls: [stun] }];
  // Optional single TURN via discrete env vars (kept simple; use VITE_SIP_ICE for more).
  const turnUrls = import.meta.env.VITE_SIP_TURN_URLS?.trim();
  if (turnUrls) {
    servers.push({
      urls: turnUrls.split(',').map((u) => u.trim()).filter(Boolean),
      username: import.meta.env.VITE_SIP_TURN_USERNAME || undefined,
      credential: import.meta.env.VITE_SIP_TURN_CREDENTIAL || undefined
    });
  }
  return servers;
}

function hostFromWss(wss) {
  try { return new URL(wss).hostname; } catch { return ''; }
}

export function loadSipConfig(overrides = {}) {
  const wssUrl = overrides.wssUrl || import.meta.env.VITE_SIP_WSS_URL || '';
  const domain = overrides.domain || import.meta.env.VITE_SIP_DOMAIN || hostFromWss(wssUrl);
  return {
    wssUrl,
    domain,
    iceServers: overrides.iceServers || parseIce(),
    // 600s, not the 300s we shipped first: every refresh is a REGISTER round
    // trip, and at 5 minutes it was frequent enough to be noticeable in a SIP
    // trace. The transport is WSS, so the TCP connection — not the refresh —
    // is what holds the NAT binding open, and 10 minutes stays far inside the
    // registrar's usual 3600s ceiling.
    registerExpires: overrides.registerExpires ?? parseInt(import.meta.env.VITE_SIP_REGISTER_EXPIRES || '600', 10),
    logLevel: overrides.logLevel || import.meta.env.VITE_SIP_LOG_LEVEL || 'warn',
    reconnectMax: overrides.reconnectMax ?? parseInt(import.meta.env.VITE_SIP_RECONNECT_MAX || '5', 10),
    reconnectDelayMs: overrides.reconnectDelayMs ?? parseInt(import.meta.env.VITE_SIP_RECONNECT_DELAY_MS || '3000', 10)
  };
}
