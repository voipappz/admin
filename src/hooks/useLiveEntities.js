import { useEffect, useMemo, useRef, useState } from 'react';
import { useWebSocket } from './useWebSocket';
import { config } from '../config.js';

/**
 * useLiveEntities — live state over the cable, replacing the poll.
 *
 * Built on the existing useWebSocket (the app's ActionCable client), pointed at
 * the node's LiveChannel. The node materialises `state.*` deltas into JetStream
 * KV and the channel serves that bucket with one `watch`, which delivers the
 * CURRENT value of every entity and then every change. So a screen mounting
 * mid-shift gets the whole picture at once — no snapshot request, no resync,
 * and no reducer here: each frame carries a whole document.
 *
 * Frames look like:
 *   { scope: "user", id: "<uuid>", revision: 12, deleted: false, doc: {...} }
 *
 * `deleted` matters: replacing documents updates rows but never removes one
 * that is gone, so an entity that disappears has to say so explicitly.
 */

// Renders are coalesced rather than painted per frame: a busy environment can
// deliver dozens a second, and React re-rendering a table that often is what
// makes a dashboard tab unusable.
const COALESCE_MS = 250;

function cableUrl(token) {
  const base = config?.ws?.cable;
  if (!base || !token) return null;
  return `${base}${base.includes('?') ? '&' : '?'}token=${encodeURIComponent(token)}`;
}

/** The session token the node verifies against SECRET_KEY. */
function sessionToken() {
  try {
    const admin = JSON.parse(localStorage.getItem('auth') || 'null');
    if (admin?.access) return admin.access;
    const portal = JSON.parse(localStorage.getItem('user_auth') || 'null');
    return portal?.token || null;
  } catch {
    return null;
  }
}

export default function useLiveEntities(environmentUuid, scope = null) {
  const [version, setVersion] = useState(0);
  const entities = useRef(new Map());
  const pending = useRef(false);

  const token = useMemo(() => sessionToken(), []);
  const url = useMemo(() => cableUrl(token), [token]);

  // Derived, not received, on the node side too — this only NARROWS what the
  // channel already scoped to the verified identity.
  const identifier = useMemo(() => {
    if (!environmentUuid) return null;
    const id = { channel: 'LiveChannel', environment_uuid: environmentUuid };
    if (scope) id.scope = scope;
    return id;
  }, [environmentUuid, scope]);

  const { data, connectionStatus, error } = useWebSocket(url, environmentUuid, {
    identifier,
    // LiveChannel streams on subscribe; DashboardLive's `login` handshake would
    // just be an unhandled inbound frame.
    loginAction: false,
  });

  useEffect(() => {
    if (!data || !data.id) return;

    const key = `${data.scope}:${data.id}`;
    if (data.deleted) {
      entities.current.delete(key);
    } else {
      entities.current.set(key, { scope: data.scope, id: data.id, ...data.doc });
    }

    if (!pending.current) {
      pending.current = true;
      setTimeout(() => {
        pending.current = false;
        setVersion((v) => v + 1);
      }, COALESCE_MS);
    }
  }, [data]);

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
    connected: connectionStatus === 'Connected',
    rejected: connectionStatus === 'Rejected',
    status: connectionStatus,
    error,
  };
}
