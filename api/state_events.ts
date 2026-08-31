/**
 * The va-crystal state stream, folded.
 *
 * node publishes one NAMED EVENT per transition to `state.<scope>.<id>` and
 * stores nothing (va-crystal `docs/CABLE_SPEC.md` §5, `node/realtime/
 * state_publisher.cr`). Every consumer that wants a current picture has to
 * build it from those events — that is the deliberate trade for a node that
 * holds no state.
 *
 *   { "event_id": "…", "event": "user.ringing", "at": 1690000000,
 *     "scope": "user", "id": "<uuid>",
 *     "data": { "action": "user.ringing", "state": "receiving",
 *               "colors": { "state": "yellow" } },
 *     "incr": { "call_ringing_count": 1 },
 *     "metadata": { "scope": "user", "id": "<uuid>" } }
 *
 * The fold lives HERE and not in the browser. `server.ts` used to relay the
 * message untouched with a comment saying the browser would fold it; nothing
 * in `src/` ever did, so the stream was relayed and dropped. Doing it in the
 * BFF also means the counter arithmetic happens once per connection instead of
 * once per tab, and a browser that reconnects gets a whole view rather than
 * the next delta.
 *
 * Pure by design — values in, values out, no socket and no clock — so
 * `tests/state_events.test.ts` can pin it without a cable server.
 */

/** Scopes node publishes. `state.<scope>.<id>` is one entity's stream. */
export type StateScope =
  | "user"
  | "queue"
  | "call"
  | "environment"
  | "campaign"
  | "conference"
  | "extension";

export interface StateEvent {
  /** unique per message — safe to dedupe on */
  event_id: string;
  /** what happened, in the mothership's vocabulary: "user.ringing", … */
  event: string;
  /** unix seconds */
  at: number;
  scope: StateScope;
  id: string;
  /**
   * Fields that now hold these values. String for a plain field, object for a
   * map field, array for values ADDED to a collection. Always carries
   * `action`, a copy of `event`.
   */
  data: Record<string, string | string[] | Record<string, string>>;
  /** counter DELTAS, never totals */
  incr?: Record<string, number>;
  /** fields removed; a map subfield reads "field.subfield" */
  unset?: string[];
  /** values removed from a collection field */
  remove?: Record<string, string[]>;
  /** fields in `data` to write only when absent */
  once?: string[];
  /** advisory ttl in seconds; nothing enforces it */
  ttl?: number;
  metadata?: Record<string, string>;
}

/** A folded entity. Collections stay arrays; map fields flatten to "a.b". */
export type StateView = Record<string, string | string[]>;

/**
 * True when `value` has the envelope node sends. Anything else is relayed
 * as-is rather than folded — a malformed frame must not take the socket down.
 */
export function isStateEvent(value: unknown): value is StateEvent {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return typeof v.event === "string" &&
    typeof v.scope === "string" &&
    typeof v.id === "string" &&
    !!v.data && typeof v.data === "object" && !Array.isArray(v.data);
}

function asArray(value: string | string[] | undefined): string[] {
  if (Array.isArray(value)) return value;
  return value === undefined ? [] : [value];
}

/**
 * Folds one event into `view`, mutating and returning it.
 *
 * `action` is dropped: it is the routing key (a copy of `event`), not a field
 * of the entity, and keeping it would put a different value in the view on
 * every transition.
 */
export function applyStateEvent(view: StateView, event: StateEvent): StateView {
  for (const [field, value] of Object.entries(event.data ?? {})) {
    if (field === "action") continue;

    if (Array.isArray(value)) {
      // An array is what was ADDED — union, don't replace, or a hangup event
      // carrying one channel uuid would erase the other legs.
      const existing = asArray(view[field]);
      view[field] = [...existing, ...value.filter((v) => !existing.includes(v))];
      continue;
    }
    if (value && typeof value === "object") {
      for (const [sub, v] of Object.entries(value)) view[`${field}.${sub}`] = v;
      continue;
    }
    // `once` is set-if-absent.
    if (event.once?.includes(field) && field in view) continue;
    view[field] = value;
  }

  // Counters arrive as deltas because node keeps no totals. Accumulating them
  // is the consumer's job — this is that job.
  for (const [field, by] of Object.entries(event.incr ?? {})) {
    const current = Number(view[field] ?? 0);
    view[field] = String((Number.isFinite(current) ? current : 0) + by);
  }

  for (const [field, values] of Object.entries(event.remove ?? {})) {
    const existing = asArray(view[field]);
    if (existing.length) view[field] = existing.filter((v) => !values.includes(v));
  }

  for (const field of event.unset ?? []) delete view[field];

  return view;
}

/**
 * A per-connection view of one entity. One of these per subscribed stream:
 * the socket that owns it is the only reader, and it dies with the socket.
 */
export function createStateView(): {
  apply(event: StateEvent): StateView;
  snapshot(): StateView;
} {
  const view: StateView = {};
  return {
    apply: (event) => applyStateEvent(view, event),
    snapshot: () => ({ ...view }),
  };
}
