// Shared Gatus normalisation helpers.
//
// Gatus (the status monitor) exposes each monitored endpoint as
// { key, name, group, results: [...] } where each result carries success,
// status, hostname, duration (ns), timestamp, conditionResults, errors.
//
// These helpers collapse that raw JSON into the shape the UI renders. They are
// the SINGLE source of truth for that normalisation — `useGatusHealth`
// (system-wide health via `/api/v1/endpoints/statuses`) and `useNodeHealth`
// (per-node health via `/api/v1/nodes/:id/health`, same JSON shape) both import
// from here so a node's endpoints feed `GatusHealthPanel` unchanged.

// ns → ms (Gatus reports duration in nanoseconds)
export const toMs = (ns) => (typeof ns === 'number' ? Math.round(ns / 1e6) : null);

// Normalize a single Gatus result into a fully-detailed object that exposes
// every field the JSON carries: status, hostname, duration, per-condition
// results, errors, success, timestamp.
export const toResult = (r) => ({
  success: !!r.success,
  status: typeof r.status === 'number' ? r.status : null, // absent for TCP/UDP checks
  hostname: r.hostname || null,
  durationMs: toMs(r.duration),
  timestamp: r.timestamp || null,
  conditions: Array.isArray(r.conditionResults)
    ? r.conditionResults.map((c) => ({ condition: c.condition, success: !!c.success }))
    : [],
  errors: Array.isArray(r.errors) ? r.errors : [],
});

// Collapse one Gatus endpoint (name/group/key + rolling results[]) into the
// shape the UI renders. Keeps the full latest result and full history so the
// UI can reflect every JSON field (conditions on success AND fail, errors,
// status code, hostname, response time, timestamp).
export const toEndpoint = (e) => {
  const raw = Array.isArray(e.results) ? e.results : [];
  const results = raw.map(toResult);
  const last = results[results.length - 1] || null;
  const okCount = results.reduce((n, r) => n + (r.success ? 1 : 0), 0);
  const up = !!(last && last.success);

  // Primary failure reason (first error, else first failed condition).
  let error = null;
  if (last && !last.success) {
    if (last.errors.length) error = last.errors[0];
    else {
      const failed = last.conditions.find((c) => !c.success);
      if (failed) error = `Condition failed: ${failed.condition}`;
    }
  }

  return {
    key: e.key,
    name: e.name,
    group: e.group,
    up,
    uptime: results.length ? Math.round((okCount / results.length) * 100) : null,
    checks: results.length,
    // Latest check — full detail
    status: last ? last.status : null,
    hostname: last ? last.hostname : null,
    responseMs: last ? last.durationMs : null,
    lastCheck: last ? last.timestamp : null,
    conditions: last ? last.conditions : [], // [{condition, success}] — shown on success & fail
    errors: last ? last.errors : [],
    error,
    last, // entire latest result object
    // full recent history (oldest→newest) for the Gatus-style bar strip + tooltips
    history: results.slice(-45),
  };
};

// Map a raw Gatus statuses array into normalised endpoints + a summary.
// Shared by both the system-wide and per-node health flows.
export const toHealth = (data) => {
  const endpoints = (Array.isArray(data) ? data : []).map(toEndpoint);
  const up = endpoints.filter((e) => e.up).length;
  const down = endpoints.length - up;
  return {
    endpoints,
    summary: { total: endpoints.length, up, down },
    isHealthy: endpoints.length > 0 && down === 0,
  };
};
