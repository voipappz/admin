import { useEffect, useMemo, useRef, useState } from 'react';
import { getConsumer } from '../services/cable.js';

/**
 * useLiveEntities — live state over the cable, replacing the poll.
 *
 * A subscription to the node's LiveChannel on the page's one ActionCable
 * consumer (services/cable.js). The node materialises `state.*` deltas into
 * JetStream KV and the channel serves that bucket with one `watch`, which
 * delivers the CURRENT value of every entity and then every change. So a
 * screen mounting mid-shift gets the whole picture at once — no snapshot
 * request, no reducer here: each frame carries a whole document.
 *
 * Frames look like:
 *   { scope: "user", id: "<uuid>", revision: 12, deleted: false, doc: {...} }
 *
 * `deleted` matters: replacing documents updates rows but never removes one
 * that is gone, so an entity that disappears has to say so explicitly. And a
 * RECONNECT re-delivers the whole snapshot, which is why the rows are dropped
 * when one is confirmed: a key deleted while the link was down never sends its
 * deletion, and keeping the old map would show it forever.
 */

// Renders are coalesced rather than painted per frame: a busy environment can
// deliver dozens a second, and React re-rendering a table that often is what
// makes a dashboard tab unusable.
const COALESCE_MS = 250;

const IDLE = { status: 'idle', confirmedAt: null, frames: 0, lastFrameAt: null };

export default function useLiveEntities(environmentUuid, scope = null) {
  const [version, setVersion] = useState(0);
  const [subscription, setSubscription] = useState(IDLE);
  const entities = useRef(new Map());
  const pending = useRef(false);
  // Counted per frame, published with the coalesced render — a state update
  // per frame is exactly the re-render storm the coalescing exists to stop.
  const stats = useRef({ frames: 0, lastFrameAt: null });

  // Derived, not received, on the node side too — this only NARROWS what the
  // channel already scoped to the verified identity.
  const identifier = useMemo(() => {
    if (!environmentUuid) return null;
    const id = { channel: 'LiveChannel', environment_uuid: environmentUuid };
    if (scope) id.scope = scope;
    return id;
  }, [environmentUuid, scope]);

  useEffect(() => {
    if (!identifier) {
      setSubscription(IDLE);
      return undefined;
    }
    const consumer = getConsumer();
    if (!consumer) {
      setSubscription({ ...IDLE, status: 'unavailable' });
      return undefined;
    }

    const flush = () => {
      if (pending.current) return;
      pending.current = true;
      setTimeout(() => {
        pending.current = false;
        setVersion((v) => v + 1);
        setSubscription((s) => ({ ...s, ...stats.current }));
      }, COALESCE_MS);
    };

    stats.current = { frames: 0, lastFrameAt: null };
    setSubscription({ ...IDLE, status: 'pending' });

    const sub = consumer.subscriptions.create(identifier, {
      connected({ reconnected } = {}) {
        if (reconnected) {
          entities.current.clear();
          flush();
        }
        setSubscription((s) => ({ ...s, status: 'confirmed', confirmedAt: Date.now() }));
      },
      disconnected({ willAttemptReconnect } = {}) {
        setSubscription((s) => (s.status === 'rejected' ? s
          : { ...s, status: willAttemptReconnect ? 'reconnecting' : 'disconnected' }));
      },
      rejected() {
        // Not this session's environment, or the node could not resolve it.
        // The library does not retry a rejection, and neither should we.
        setSubscription((s) => ({ ...s, status: 'rejected' }));
      },
      received(data) {
        if (!data || !data.id) return;
        const key = `${data.scope}:${data.id}`;
        if (data.deleted) entities.current.delete(key);
        else entities.current.set(key, { scope: data.scope, id: data.id, ...data.doc });
        stats.current = { frames: stats.current.frames + 1, lastFrameAt: Date.now() };
        flush();
      },
    });

    // Unsubscribe, don't just drop the reference: the server keeps streaming
    // to a subscription nobody told it to end.
    return () => sub.unsubscribe();
  }, [identifier]);

  // A new environment is a different dataset, not more of the same one.
  useEffect(() => {
    entities.current.clear();
    setVersion((v) => v + 1);
  }, [environmentUuid]);

  const rows = useMemo(
    () => Array.from(entities.current.values()),
    [version],
  );

  return {
    rows,
    byScope: (want) => rows.filter((r) => r.scope === want),
    connected: subscription.status === 'confirmed',
    rejected: subscription.status === 'rejected',
    status: subscription.status,
    subscription: { ...subscription, identifier, environmentUuid: environmentUuid || null },
  };
}
