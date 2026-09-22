var CONFIG = {
    // API_ENDPOINT:  "https://homer.voipappz.io",//"acvideo.voipappz.io",//
    // WEBSOCKETS_URL: 'wss://homer.voipappz.io',//"acvideo.voipappz.io:8443/",//
    // WEBSOCKETS_JANUS_URL: 'wss://homer.voipappz.io',//"wss://acvideo.voipappz.io:8443/",//

    // // VIDEO APP
    // API_ENDPOINT:  "https://acvideo.voipappz.io",//"acvideo.voipappz.io",//
    // WEBSOCKETS_URL: "wss://acvideo.voipappz.io/ws",//'wss:/sbc-ingress.voipappz.io/ws',//"acvideo.voipappz.io:8443/",//
    // WEBSOCKETS_JANUS_URL: 'wss://acvideo.voipappz.io/',//"wss://acvideo.voipappz.io:8443/",//
    
    // // MTN
    // API_ENDPOINT:  "https://mtnunicom.mtn.com.gh/",
    // WEBSOCKETS_URL: "wss://mtnunicom.mtn.com.gh/ws",  // ActionCable WebSocket
    // WEBSOCKETS_SIP_URL: "wss://mtn-portal.voipappz.io:8443",  // SIP.js WebSocket
    // WEBSOCKETS_JANUS_URL: 'wss://mtn-portal.voipappz.io:8443/',  // Janus WebSocket

    // // cloud
    // API_ENDPOINT:  "https://cloud.voipappz.io:9443",
    // WEBSOCKETS_URL: "wss://cloud.voipappz.io:9443",
    // WEBSOCKETS_SIP_URL: "wss://cloud.voipappz.io:9443",  // SIP.js WebSocket
    // WEBSOCKETS_JANUS_URL: 'wss://cloud.voipappz.io:9443/',  // Janus WebSocket

    // connectix (Elixir) gateway — the app's ONLY API + realtime backend.
    // ONE build serves web + Electron + Android; the server resolves as:
    //   1. localStorage "connectix-server" (the in-app server picker —
    //      how a packaged Electron/Android build points at a cloud box),
    //   2. the page origin (web, served same-origin by connectix SpaStatic),
    //   3. the dev gateway.
    // WEBSOCKETS_URL is the Phoenix socket BASE (the ws provider appends
    // /agent). SIP/Janus still point at their own servers, not connectix.
    API_ENDPOINT: (function () {
      try {
        var saved = window.localStorage.getItem("connectix-server");
        if (saved && /^https?:\/\//.test(saved)) return saved.replace(/\/$/, "");
      } catch (e) { /* storage unavailable — fall through */ }
      if (typeof window !== "undefined" && /^https?:$/.test(window.location.protocol)) {
        return window.location.origin;
      }
      return "http://localhost:4001";
    })(),
    WEBSOCKETS_URL: null, // derived from API_ENDPOINT below
    // SIP.js / Janus WebSocket. NOT hardcoded: the real value comes from the
    // logged-in user (user.environment.wss_server), because the SIP server is a
    // property of the tenant, not of the build. A hardcoded host here dialled a
    // box that no longer answers and hung the phone. null = "use what login
    // gave us"; set it only to pin a server for local testing.
    WEBSOCKETS_SIP_URL: null,
    WEBSOCKETS_JANUS_URL: null,

    // ICE servers for the connectix WebRTC transport (webrtc-channel-phone.ts).
    // null/[] = host candidates only, which is fine for localhost/LAN but will
    // NOT connect a caller behind NAT to a cloud-hosted box.
    // The server already has the authoritative list (`Connectix.Turn`, whose
    // `ice_servers_json/0` exists precisely for the browser), but nothing on
    // the Elixir side sends it to the app yet — until it does, set it here:
    //   WEBRTC_ICE_SERVERS: [{ urls: "stun:stun.example.io:3478" },
    //                        { urls: "turn:turn.example.io:3478",
    //                          username: "…", credential: "…" }]
    WEBRTC_ICE_SERVERS: null,


    // // nimbusip
    // API_ENDPOINT: "https://900.nimbusip.com/",
    // WEBSOCKETS_URL: "wss://900.nimbusip.com/ws",//'wss:/sbc-ingress.voipappz.io/ws',//"acvideo.voipappz.io:8443/",//
    // WEBSOCKETS_JANUS_URL: 'wss://900.nimbusip.com/ws',

    PAGE_TITLE: "Connectix",
    GOOGLE_CLIENT_ID: "CAHNGE_ME",
    FACEBOOK_KEY: "CAHNGE_ME",
    ITEMS_PER_PAGE: 50,
    ENV: 'dev'
  };

// Phoenix socket base always mirrors the API endpoint (one plane).
CONFIG.WEBSOCKETS_URL = CONFIG.API_ENDPOINT.replace(/^http/, "ws");