import { useEffect, useRef, useState } from 'react';
import { eventsWsProtocols, eventsWsUrl } from '../Calls/useCalls';

/**
 * useUserState — the signed-in user's own live state, streamed from
 * va-crystal's `StateChannel` and bridged by deno-api onto `/ws/events` as
 * `user.state` frames.
 *
 * node publishes one NAMED EVENT per transition (`user.ringing`,
 * `user.answer`, `user.hangup` — the mothership's vocabulary) and keeps no
 * totals, so a consumer has to accumulate deltas. deno-api already does that
 * fold per connection (`api/state_events.ts`) and sends the whole `view`
 * alongside the event name, which is why this hook is a reducer over frames
 * and not over ops: a reconnecting tab gets a complete picture, not the next
 * delta.
 *
 *   { type: "user.state", user_uuid, event: "user.answer", at, view: { … } }
 *
 * `event` is exposed as `lastEvent` because a transition is worth reacting to
 * on its own (a ring should be able to fire a sound) — folding it into the
 * view would lose the fact that it just happened.
 */
export function useUserState() {
  const [view, setView] = useState({});
  const [lastEvent, setLastEvent] = useState(null);
  const [status, setStatus] = useState('connecting');
  const wsRef = useRef(null);
  const reconnectTimer = useRef(null);

  useEffect(() => {
    // `user.state` is delivered straight to this socket rather than through
    // the topic fan-out, so the pattern only has to be something valid.
    const url = eventsWsUrl('user.#');

    function connect() {
      const ws = new WebSocket(url, eventsWsProtocols());
      wsRef.current = ws;
      setStatus('connecting');
      ws.addEventListener('open', () => setStatus('open'));
      ws.addEventListener('close', () => {
        setStatus('closed');
        reconnectTimer.current = window.setTimeout(connect, 3000);
      });
      ws.addEventListener('error', () => { /* close fires too */ });
      ws.addEventListener('message', (e) => {
        let msg;
        try { msg = JSON.parse(e.data); } catch { return; }
        if (msg?.type !== 'user.state') return;
        // An older deno-api relays the raw document with no `view`. Ignore the
        // frame rather than replacing a good picture with undefined.
        if (msg.view && typeof msg.view === 'object') setView(msg.view);
        if (typeof msg.event === 'string') setLastEvent({ event: msg.event, at: msg.at ?? null });
      });
    }

    connect();
    return () => {
      if (reconnectTimer.current) window.clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
    };
  }, []);

  return { view, lastEvent, status };
}

export default useUserState;
