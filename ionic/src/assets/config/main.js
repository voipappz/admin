// THE ONE KNOB — and by default it is not even a knob.
//
// Every request this app makes goes to the Elixir portal: it performs the
// login (`Portal.AuthController`), serves the realtime socket, and forwards
// /api and /tasks to the engine. Served BY that portal at /app, the app is
// same-origin with all of it — so the address is the empty string, meaning
// "wherever this page came from", and there is nothing to configure or keep in
// step. That is the point of bundling the two.
//
// There were four of these files (main.ci.js, main.mtn.js, main.prod.js) each
// naming a different backend, and only main.js was ever loaded by index.html.
// The others were three addresses to keep in step with nothing, and a reader
// had to check which one the build used to find that out. Git history has them.
//
// `localStorage._domain` overrides it at runtime — the same key the Chrome
// extension uses — which is how a packed mobile build is aimed at another
// portal without a rebuild, and how an e2e spec points the UI at a fake node.
(function () {
  var origin = '';
  try {
    origin = localStorage.getItem('_domain') || '';
  } catch (e) {
    // A private window or blocked site data throws on access rather than
    // returning null. Same-origin is the right answer then, not a crash
    // before the app has rendered anything.
    origin = '';
  }

  // The realtime socket. Same host as the API by construction: a token minted
  // by one portal is verified by the same portal, so a socket pointed anywhere
  // else authenticates against a secret it does not share. Derived rather than
  // configured for exactly that reason.
  function wsBase(httpBase) {
    if (httpBase) {
      return httpBase.replace(/^http/, 'ws').replace(/\/$/, '');
    }
    return (window.location.protocol === 'https:' ? 'wss://' : 'ws://') + window.location.host;
  }

  window.CONFIG = {
    // Empty = relative paths against the portal that served this page.
    API_ENDPOINT: origin,
    WEBSOCKETS_URL: wsBase(origin),

    // SIP AND JANUS ARE DELIBERATELY EMPTY, and that is not an omission.
    //
    // The phone registers against the customer's SBC, not against the portal:
    // media is not something to relay through a BEAM node that redeploys, and
    // the portal's own SIP stack is the voice bot's leg, not the agent's.
    //
    // `webrtc-phone.ts` PREFERS CONFIG.WEBSOCKETS_SIP_URL over the agent's
    // own `environment.wss_server` when it is set — so setting it here would
    // override every agent's real environment with one address. Left empty,
    // the per-agent value from the login wins, which is the only thing that
    // works when two agents are on different environments.
    WEBSOCKETS_SIP_URL: '',
    WEBSOCKETS_JANUS_URL: '',

    PAGE_TITLE: 'Connectix',
    GOOGLE_CLIENT_ID: 'CHANGE_ME',
    FACEBOOK_KEY: 'CHANGE_ME',
    ITEMS_PER_PAGE: 50,
    ENV: 'portal'
  };
})();
