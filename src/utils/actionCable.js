// Minimal ActionCable client over the native WebSocket API.
//
// Replaces `@rails/actioncable` so the production build carries no external
// cable dependency (the package had been dropped in a deps cleanup and its
// absence broke `vite build`). Implements the subset the dashboard live cable
// uses: createConsumer(url).subscriptions.create(params, callbacks),
// subscription.perform(action, data), subscription.unsubscribe(),
// consumer.disconnect() — plus welcome/ping/confirm handling and auto-reconnect.

export function createConsumer(url) {
  let ws = null;
  let reconnectTimer = null;
  let closedByUser = false;
  const subscriptions = [];

  const isOpen = () => ws && ws.readyState === WebSocket.OPEN;

  const sendSubscribe = (sub) => {
    if (isOpen()) ws.send(JSON.stringify({ command: 'subscribe', identifier: sub.identifier }));
  };

  const connect = () => {
    try {
      ws = new WebSocket(url);
    } catch {
      return;
    }
    ws.onopen = () => {
      // (Re)subscribe on connect; the server also emits `welcome` which we honor.
      subscriptions.forEach(sendSubscribe);
    };
    ws.onmessage = (evt) => {
      let data;
      try { data = JSON.parse(evt.data); } catch { return; }
      const { type, identifier, message } = data;

      if (type === 'welcome') { subscriptions.forEach(sendSubscribe); return; }
      if (type === 'ping') return; // heartbeat
      if (type === 'confirm_subscription') {
        const s = subscriptions.find((x) => x.identifier === identifier);
        try { s?.callbacks.connected?.call(s.proxy); } catch { /* ignore */ }
        return;
      }
      if (type === 'reject_subscription') {
        const s = subscriptions.find((x) => x.identifier === identifier);
        try { s?.callbacks.rejected?.call(s.proxy); } catch { /* ignore */ }
        return;
      }
      if (message !== undefined && identifier) {
        const s = subscriptions.find((x) => x.identifier === identifier);
        try { s?.callbacks.received?.call(s.proxy, message); } catch { /* ignore */ }
      }
    };
    ws.onclose = () => {
      subscriptions.forEach((s) => { try { s.callbacks.disconnected?.call(s.proxy); } catch { /* ignore */ } });
      if (!closedByUser) reconnectTimer = setTimeout(connect, 3000);
    };
    ws.onerror = () => { /* onclose handles reconnect */ };
  };

  connect();

  return {
    subscriptions: {
      create(params, callbacks = {}) {
        const identifier = JSON.stringify(params);
        const proxy = {
          perform(action, data = {}) {
            if (isOpen()) {
              ws.send(JSON.stringify({ command: 'message', identifier, data: JSON.stringify({ action, ...data }) }));
            }
          },
          unsubscribe() {
            const i = subscriptions.findIndex((x) => x.identifier === identifier);
            if (i > -1) subscriptions.splice(i, 1);
            if (isOpen()) ws.send(JSON.stringify({ command: 'unsubscribe', identifier }));
          },
        };
        const sub = { identifier, callbacks, proxy };
        subscriptions.push(sub);
        sendSubscribe(sub); // welcome/onopen also (re)subscribes if not yet connected
        return proxy;
      },
    },
    disconnect() {
      closedByUser = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      subscriptions.length = 0;
      try { ws?.close(); } catch { /* ignore */ }
      ws = null;
    },
  };
}

export default { createConsumer };
