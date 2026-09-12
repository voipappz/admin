// What this InfluxDB actually holds, asked once per session.
//
// The portal reads InfluxDB and nothing else, so every screen has to cope
// with a store that may not have the measurement it wants. /influxdb/rows
// whitelists against SHOW MEASUREMENTS and answers 404 "unknown measurement"
// when it misses — which covers three different situations that look
// identical from here: the measurement was never written, InfluxDB was
// unreachable so the whitelist came back empty, or the API build predates the
// endpoint entirely.
//
// Rather than fire a request that we can predict will 404 and then explain
// the failure, ask the schema first and only query what exists. A screen can
// then say "not available yet" without a failed request behind it, and a
// deployment that has `live_state` but not `cdr` still renders everything it
// can.
//
// Deliberately NOT cached across reloads: a measurement appears the moment
// the collector starts writing, and a stale "no cdr here" answer in
// localStorage would outlive the fix. One request per page load is the right
// trade.
import { monitoringApi } from './monitoringApi';

let inflight = null;

/**
 * Measurement names present in this deployment's InfluxDB.
 * Never rejects — an unreachable schema endpoint yields an empty set, which
 * callers read as "nothing available", the same as an empty store.
 * @returns {Promise<Set<string>>}
 */
export function getMeasurements() {
  if (!inflight) {
    inflight = monitoringApi.getInfluxSchema()
      .then((schema) => new Set(
        (Array.isArray(schema) ? schema : [])
          .map((entry) => entry?.measurement)
          .filter(Boolean)
      ))
      .catch(() => new Set());
  }
  return inflight;
}

/**
 * Is `name` a measurement this deployment can actually be queried for?
 * @param {string} name
 * @returns {Promise<boolean>}
 */
export async function hasMeasurement(name) {
  return (await getMeasurements()).has(name);
}

/** Drop the cached answer — for tests, and after a session change. */
export function resetMeasurementCache() {
  inflight = null;
}
