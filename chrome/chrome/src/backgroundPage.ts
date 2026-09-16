import { CONFIG } from "../../angular/src/app/config"

// The realtime server is the Elixir app's /ws/events — a settled decision, not
// a fallback. The extension connects there and nowhere else: not to the
// (va-crystal), not to the broker.
//
// The server authorizes the socket by the person's own login token and derives
// which streams they get from that token's claims, so which user's events
// arrive is never something the client asks for. That is the whole reason for
// going through it: talking to the broker directly would mean sending our own
// user_uuid and being trusted on it, and talking to NATS directly cannot be
// scoped per user at all.
//
// Upstream it subscribes to NATS — `notifications.<user_uuid>` and
// `state.user.<uuid>`, and holds ONE connection for the whole
// server rather than one per browser. Same events either way; va-crystal
// publishes to the same bus.
//
// The token travels as a SUBPROTOCOL, not a query parameter — browsers cannot
// set Authorization on a WebSocket handshake, and a URL is recorded by every
// reverse proxy and access log in between.
const BEARER_PREFIX = "voipappz-bearer.";

let ws: WebSocket | null = null;
let currentUuid = "";
let currentToken = "";
let realtimeUrl = "";
let reconnectTimer: any = null;

// ── the realtime light ───────────────────────────────────────────────────────
//
// NOTHING IS STORED. The worker holds the state in memory and pushes it down
// the port the popup already opens; a popup that opens later asks for it with
// {event:"status"} and gets an answer by return. Persisting it would be
// writing a fact with a shelf life of seconds — MV3 stops the worker and the
// socket dies with it, so a stored "connected" is wrong the moment it is
// written, and the popup would render green over a socket that no longer
// exists.
//
// GREEN IS NOT "the socket opened". It is open AND the server said its events
// is ready: a portal whose broker subscription is down accepts the socket
// and then delivers nothing, and a light that stays green
// through that is worse than no light at all.
type RealtimeState = { connected: boolean; events_ready: boolean };
let realtimeState: RealtimeState = { connected: false, events_ready: false };

// Every popup and options page that has connected. A Set because the same page
// reconnects on every open, and a closed popup's port must not be written to.
const ports = new Set<any>();

function setRealtimeState(next: { connected: boolean; events_ready?: boolean }) {
    realtimeState = {
        connected: next.connected,
        events_ready: next.connected ? !!next.events_ready : false,
    };
    ports.forEach((p) => sendState(p));
    paintBadge();
}

function sendState(port: any) {
    post(port, { event: "realtime", ...realtimeState });
    // A popup opens long after the call it needs to draw arrived, so the last
    // one is replayed to it. Held in memory only: it is worth exactly as long
    // as the worker that saw it.
    if (lastCall) post(port, callFrame());
}

function post(port: any, msg: any) {
    try {
        port.postMessage(msg);
    } catch (e) {
        ports.delete(port);
    }
}

function broadcast(msg: any) {
    ports.forEach((p) => post(p, msg));
}

let lastCall: { event: string; call: any } | null = null;

function paintBadge() {
    const action = (chrome as any).action || chrome.browserAction;
    if (!action) return;
    const green = realtimeState.connected && realtimeState.events_ready;
    const amber = realtimeState.connected && !realtimeState.events_ready;
    try {
        action.setBadgeBackgroundColor({
            color: green ? "#2e7d32" : amber ? "#ed6c02" : "#9e9e9e",
        });
        // No badge at all when signed out — a grey pill there would read as a
        // fault rather than as "nobody is logged in". The pill only appears
        // once there is a session whose connection can be judged.
        action.setBadgeText({ text: currentUuid ? " " : "" });
        action.setTitle({
            title: !currentUuid
                ? CONFIG.PAGE_TITLE
                : green ? `${CONFIG.PAGE_TITLE} — connected`
                : amber ? `${CONFIG.PAGE_TITLE} — connected, events not ready`
                        : `${CONFIG.PAGE_TITLE} — disconnected`,
        });
    } catch (e) { /* action API unavailable in tests */ }
}

var TAB_ID = 0;
console.log('background script loaded');

chrome.runtime.onConnect.addListener(onConnect);
((chrome as any).action || chrome.browserAction).setTitle({ title: CONFIG.PAGE_TITLE })
// A restarted worker has no socket yet, whatever the last run wrote.
setRealtimeState({ connected: false });

function onConnect(port) {
    console.log("Connected .....");
    ports.add(port);
    port.onDisconnect.addListener(() => ports.delete(port));
    // The popup renders before it asks, so answer immediately as well.
    sendState(port);

    port.onMessage.addListener(function (msg) {
        if (msg && msg.event === "status") {
            sendState(port);
            return;
        }
        console.log("message received", msg);
        if (msg.event == "logout") {
            disconnect();
        } else if (msg.event == "login") {
            if (msg.data && msg.data.user_uuid) {
                login(msg, port);
            }
        }
    });
}

async function login(msg: any, port: any) {
    const uuid = msg.data.user_uuid;
    const token = msg.data.token || "";
    if (ws && ws.readyState === WebSocket.OPEN && currentUuid === uuid) {
        return;
    }
    disconnect();

    const domain = (msg.domain || CONFIG.API_ENDPOINT).replace(/\/+$/, '');
    // Preserve the scheme rather than forcing wss: https -> wss, http -> ws.
    // Production is https so the distinction never showed, but forcing wss at a
    // plaintext server is a TLS handshake against a port that speaks none —
    // which surfaces as a socket that simply never opens, with no error worth
    // reading.
    realtimeUrl =
        (domain.startsWith("http://") ? domain.replace(/^http:\/\//, "ws://")
                                      : domain.replace(/^https?:\/\//, "wss://")) + "/ws/events";
    currentUuid = uuid;
    currentToken = token;
    // Exposed on self so Playwright can verify the target before a connection
    // is even attempted.
    (self as any)._realtime_url = realtimeUrl;

    openSocket(port);
}

function openSocket(port?: any) {
    if (!currentUuid || !realtimeUrl) return;

    let sock: WebSocket;
    try {
        // base64url, unpadded — the server decodes it by mapping -/_ back and
        // re-padding, so + / = must not appear.
        const encoded = btoa(currentToken)
            .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
        sock = new WebSocket(realtimeUrl, [BEARER_PREFIX + encoded]);
    } catch (err) {
        console.error("realtime connect failed", realtimeUrl, err);
        setRealtimeState({ connected: false });
        scheduleReconnect();
        return;
    }
    ws = sock;
    (self as any)._realtime = sock;

    sock.onopen = () => {
        console.log("realtime socket open", realtimeUrl);
    };

    sock.onmessage = (ev) => {
        let frame: any;
        try {
            frame = JSON.parse(typeof ev.data === "string" ? ev.data : "");
        } catch (e) {
            return;
        }
        if (!frame || !frame.type) return;

        // Every per-user stream is opened server-side from the token's claims,
        // so there is nothing to subscribe to and no uuid to send.
        switch (frame.type) {
            case "welcome":
                console.log("realtime connected", realtimeUrl, "events_ready:", frame.events_ready);
                setRealtimeState({ connected: true, events_ready: !!frame.events_ready });
                try { port && port.postMessage("connected to realtime"); } catch (e) { /* popup closed */ }
                break;
            case "notification":
                // `message` is the Notifications payload verbatim — the same
                // shape this worker has always parsed.
                handleNotification(frame.message);
                break;
            case "user.state":
                // The BFF already folded the deltas into `view`; `message` is
                // the raw state document, which is what handleUserState stores.
                handleUserState(frame.message);
                break;
        }
    };

    sock.onclose = () => {
        if (ws === sock) { ws = null; setRealtimeState({ connected: false }); scheduleReconnect(); }
    };
    sock.onerror = (err) => {
        console.error("realtime socket error", err);
    };
}

// MV3 kills an idle service worker in ~30s. Incoming socket traffic resets that
// timer (Chrome 116+), and the realtime server pings on its own schedule, so the
// connection is what keeps the worker alive — the same role nats.ws's
// pingInterval played.
function scheduleReconnect() {
    if (!currentUuid || reconnectTimer) return;
    reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        openSocket();
    }, 3000);
}

function disconnect() {
    lastCall = null;
    currentUuid = "";
    currentToken = "";
    if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
    const sock = ws;
    ws = null;
    (self as any)._realtime = null;
    if (sock) {
        try { sock.close(); } catch (e) { /* already closed */ }
    }
    setRealtimeState({ connected: false });
}

function handleNotification(data: any) {
    console.log(data);

    // Legacy shape: { action: "tab:new" | "call:*", ... }
    if (data.action == "tab:new" && data.url) {
        openTab(data.url);
        return;
    }
    if (data.action == "call:answer" || data.action == "call:ringing" || data.action == "call:hangup") {
        setCall(data.action, data.call);
        return;
    }

    // Current API shape: { message: { type: "ringing"|"answer"|..., call, screen }, type: "agent" }
    const message = data.message;
    if (message && typeof message === "object" && message.type) {
        const call = { ...(message.call || {}), screen: message.screen };
        if (message.type == "ringing") {
            setCall("call:ringing", call);
        } else if (message.type == "answer") {
            setCall("call:answer", call);
        } else if (message.type == "hangup") {
            setCall("call:hangup", call);
        }
        return;
    }

    // Anything else (redirect / reminder / error / calls) goes to whoever is
    // listening. Nothing read the stored copy this used to write.
    broadcast({ event: "notification", data });
}

function setCall(event: string, call: any) {
    lastCall = { event, call };
    broadcast(callFrame());
}

// The envelope's `event` says what kind of message this is; the call's own
// ringing/answer/hangup is a separate field. Spreading the one into the other
// overwrites it.
function callFrame() {
    return { event: "call", status: lastCall.event, call: lastCall.call };
}

// Live agent state from va-crystal (state.user.<uuid>).
function handleUserState(op: any) {
    broadcast({ event: "state", op });
}

function openTab(url: string) {
    if (TAB_ID) {
        chrome.tabs.get(TAB_ID, () => {
            chrome.tabs.create({ url }, (tab) => { TAB_ID = tab.id; });
        });
    } else {
        chrome.tabs.create({ url }, (tab) => { TAB_ID = tab.id; });
    }
}
