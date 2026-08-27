// Dashboard structure and identities, resolved from the mothership.
//
// Moved here from va-crystal (node/realtime/dashboard, 2026-08-27): the node
// only streams raw state over Cable (state.<scope>.<id>, dashboard:live:<account>);
// WHAT a dashboard shows — its widgets, the environments it spans, the
// user/queue identities each widget follows — is this app's to resolve, and
// the mothership answers it:
//
//   GET  {ENGINE_URL}/switch/api/crystal/dashboard_config/:account_uuid
//   GET  {ENGINE_URL}/dashboards/live                (the user's own Bearer token)
//   POST {ENGINE_URL}/switch/api/crystal/widget_identities
//
// The /switch/api/crystal/* endpoints are node-scoped and take no auth header.
// Every call degrades to null / [] on any failure and logs — a dashboard that
// cannot be resolved renders empty, it never throws into the relay.

export interface ApiColumn { name: string; label: string; type: string }

export interface ApiWidget {
  uuid: string;
  type: string;      // default "table"
  query: string;     // "user" | "call" — which identities the widget follows
  fields: string[];
  params: string[];
  columns: ApiColumn[];
}

export interface DashboardConfig {
  environment_uuids: string[];
  widgets: ApiWidget[];
  segments: unknown[];
}

// Injectable so consumers can be tested with a stub (no live mothership).
export interface DashboardApi {
  dashboardConfig(accountUuid: string): Promise<DashboardConfig | null>;
  dashboardLive(token: string): Promise<DashboardConfig | null>;
  widgetIdentities(envUuids: string[], query: string, segments: unknown[]): Promise<string[]>;
}

type Pojo = Record<string, unknown>;
const str = (v: unknown, d: string): string => (typeof v === "string" ? v : d);
const strs = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);

function widgetFrom(raw: Pojo): ApiWidget | null {
  if (typeof raw.uuid !== "string") return null;
  const columns = Array.isArray(raw.columns)
    ? raw.columns.filter((c): c is Pojo => !!c && typeof c === "object").map((c) => ({
      name: str(c.name, ""), label: str(c.label, ""), type: str(c.type, "string"),
    }))
    : [];
  return {
    uuid: raw.uuid,
    type: str(raw.type, "table"),
    query: str(raw.query, "user"),
    fields: strs(raw.fields),
    params: strs(raw.params),
    columns,
  };
}

export class MothershipDashboardApi implements DashboardApi {
  constructor(
    private readonly baseUrl: string,
    private readonly log: (m: string) => void = (m) => console.error(m),
    private readonly fetchImpl: typeof fetch = fetch,
  ) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
  }

  // GET dashboard structure (widgets + environments + segments) for an account.
  async dashboardConfig(accountUuid: string): Promise<DashboardConfig | null> {
    try {
      const res = await this.fetchImpl(`${this.baseUrl}/switch/api/crystal/dashboard_config/${accountUuid}`);
      if (res.status !== 200) { await res.body?.cancel(); return null; }
      const body = await res.json() as Pojo;
      const widgets = Array.isArray(body.widgets)
        ? body.widgets.filter((w): w is Pojo => !!w && typeof w === "object").map(widgetFrom).filter((w): w is ApiWidget => w !== null)
        : [];
      return { environment_uuids: strs(body.environment_uuids), widgets, segments: Array.isArray(body.segments) ? body.segments : [] };
    } catch (err) {
      this.log(`dashboard_config(${accountUuid}) failed: ${err instanceof Error ? err.message : err}`);
      return null;
    }
  }

  // GET the live dashboard through the mothership's own dashboard API, as the
  // user (Bearer). Same widgets the UI edits; environment_uuids/segments are
  // not in this payload — the caller takes environments from the token claims.
  async dashboardLive(token: string): Promise<DashboardConfig | null> {
    try {
      const res = await this.fetchImpl(`${this.baseUrl}/dashboards/live`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.status !== 200) { await res.body?.cancel(); return null; }
      const body = await res.json() as Pojo;
      const widgets = (Array.isArray(body.widgets) ? body.widgets : [])
        .map((entry) => {
          const e = entry as Pojo;
          const w = (e && typeof e === "object" && e.widget && typeof e.widget === "object") ? e.widget as Pojo : e; // :load_default nests under "widget"
          return w && typeof w === "object" ? widgetFrom(w) : null;
        })
        .filter((w): w is ApiWidget => w !== null);
      return { environment_uuids: [], widgets, segments: [] };
    } catch (err) {
      this.log(`dashboard_live failed: ${err instanceof Error ? err.message : err}`);
      return null;
    }
  }

  // POST resolve the identity (user/queue) UUIDs a widget should follow.
  async widgetIdentities(envUuids: string[], query: string, segments: unknown[]): Promise<string[]> {
    try {
      const res = await this.fetchImpl(`${this.baseUrl}/switch/api/crystal/widget_identities`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ environment_uuids: envUuids, query, segments }),
      });
      if (res.status !== 200) { await res.body?.cancel(); return []; }
      const body = await res.json() as Pojo;
      return strs(body.uuids);
    } catch (err) {
      this.log(`widget_identities failed: ${err instanceof Error ? err.message : err}`);
      return [];
    }
  }
}

// ── Presentation helpers (port of the node's Dashboard::Helpers) ──────────
const pad = (n: number) => String(n).padStart(2, "0");

export function secondsToTime(seconds: number | string, withHour = true): string {
  const s = Math.trunc(Number(seconds)) || 0;
  if (s <= 0) return withHour ? "00:00:00" : "00:00";
  return withHour
    ? `${pad(Math.floor(s / 3600))}:${pad(Math.floor(s / 60) % 60)}:${pad(s % 60)}`
    : `${pad(Math.floor(s / 60) % 60)}:${pad(s % 60)}`;
}

export function timeAtToHms(timestamp: number | string): string {
  const ts = Math.trunc(Number(timestamp)) || 0;
  if (ts <= 0) return "00:00:00";
  const d = new Date(ts * 1000);
  return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;
}

export function durationSince(timestamp: number | string, now = Math.floor(Date.now() / 1000)): string {
  const ts = Math.trunc(Number(timestamp)) || 0;
  if (ts <= 0) return "00:00:00";
  return secondsToTime(now - ts);
}

const ICONS: Record<string, string> = {
  answer: "", ringing: "", available: "", waiting: "",
  on_break: "", logged_out: "", receiving: "", in_a_queue_call: "",
};
const COLORS: Record<string, string> = {
  answer: "green", ringing: "yellow", available: "green", waiting: "green",
  on_break: "yellow", logged_out: "blue", receiving: "yellow", in_a_queue_call: "green",
};

export const statusIcon = (value: string | null | undefined): string => (value && ICONS[value]) || "";
export const statusColor = (value: string | null | undefined): string => (value && COLORS[value]) || "";
export const countryFlagClass = (code: string | null | undefined): string => (code ? `fi fi-${code.toLowerCase()}` : "");
