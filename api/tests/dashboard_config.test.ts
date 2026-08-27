import { assertEquals } from "@std/assert";
import {
  countryFlagClass, durationSince, MothershipDashboardApi, secondsToTime, statusColor, statusIcon, timeAtToHms,
} from "../dashboard_config.ts";

// A stub mothership: the three endpoints, on a loopback port. No network.
function stub(handler: (req: Request) => Response | Promise<Response>) {
  const ac = new AbortController();
  const server = Deno.serve({ hostname: "127.0.0.1", port: 0, signal: ac.signal, onListen() {} }, handler);
  const { port } = server.addr as Deno.NetAddr;
  return { url: `http://127.0.0.1:${port}`, close: () => { ac.abort(); return server.finished; } };
}

Deno.test("dashboard_config: widgets, environments and segments, with defaults for absent fields", async () => {
  const seen: string[] = [];
  const s = stub((req) => {
    seen.push(new URL(req.url).pathname);
    return Response.json({
      environment_uuids: ["env-1", "env-2"],
      segments: [{ field: "status.uuid", value: ["s1"], operator: "in" }],
      widgets: [
        { uuid: "w1", type: "table", query: "user", fields: ["status"], params: ["status.uuid"], columns: [{ name: "status" }] },
        { uuid: "w2" },
        { nope: true },
      ],
    });
  });
  try {
    const cfg = await new MothershipDashboardApi(s.url, () => {}).dashboardConfig("acc-1");
    assertEquals(seen, ["/switch/api/crystal/dashboard_config/acc-1"]);
    assertEquals(cfg?.environment_uuids, ["env-1", "env-2"]);
    assertEquals(cfg?.segments.length, 1);
    assertEquals(cfg?.widgets.map((w) => w.uuid), ["w1", "w2"]);
    assertEquals(cfg?.widgets[0].columns, [{ name: "status", label: "", type: "string" }]);
    assertEquals(cfg?.widgets[1], { uuid: "w2", type: "table", query: "user", fields: [], params: [], columns: [] });
  } finally { await s.close(); }
});

Deno.test("dashboard_live: sends the user's Bearer and tolerates widgets nested under `widget`", async () => {
  let auth = "";
  const s = stub((req) => {
    auth = req.headers.get("authorization") || "";
    return Response.json({ widgets: [{ widget: { uuid: "w1", query: "call" } }, { uuid: "w2", fields: ["a"] }] });
  });
  try {
    const cfg = await new MothershipDashboardApi(s.url, () => {}).dashboardLive("tok");
    assertEquals(auth, "Bearer tok");
    assertEquals(cfg?.widgets.map((w) => [w.uuid, w.query, w.fields]), [["w1", "call", []], ["w2", "user", ["a"]]]);
    assertEquals(cfg?.environment_uuids, []);
  } finally { await s.close(); }
});

Deno.test("widget_identities: POSTs the query and returns the uuids", async () => {
  let body: unknown;
  const s = stub(async (req) => {
    body = await req.json();
    return Response.json({ uuids: ["u1", "u2", 3] });
  });
  try {
    const ids = await new MothershipDashboardApi(s.url, () => {}).widgetIdentities(["env-1"], "user", [{ field: "x" }]);
    assertEquals(body, { environment_uuids: ["env-1"], query: "user", segments: [{ field: "x" }] });
    assertEquals(ids, ["u1", "u2"]);
  } finally { await s.close(); }
});

Deno.test("every call degrades — non-200 and an unreachable mothership give null / [] and log, never throw", async () => {
  const logs: string[] = [];
  const s = stub(() => new Response("nope", { status: 500 }));
  try {
    const api = new MothershipDashboardApi(s.url, (m) => logs.push(m));
    assertEquals(await api.dashboardConfig("acc"), null);
    assertEquals(await api.dashboardLive("tok"), null);
    assertEquals(await api.widgetIdentities([], "user", []), []);
  } finally { await s.close(); }
  const dead = new MothershipDashboardApi("http://127.0.0.1:1", (m) => logs.push(m));
  assertEquals(await dead.dashboardConfig("acc"), null);
  assertEquals(await dead.widgetIdentities([], "user", []), []);
  assertEquals(logs.length, 2);
  assertEquals(logs[0].startsWith("dashboard_config(acc) failed:"), true);
});

Deno.test("helpers: the node's Dashboard::Helpers, same answers", () => {
  assertEquals(secondsToTime(0), "00:00:00");
  assertEquals(secondsToTime(45), "00:00:45");
  assertEquals(secondsToTime(125), "00:02:05");
  assertEquals(secondsToTime(3661), "01:01:01");
  assertEquals(secondsToTime(86400), "24:00:00");
  assertEquals(secondsToTime(125, false), "02:05");
  assertEquals(secondsToTime(0, false), "00:00");
  assertEquals(timeAtToHms(0), "00:00:00");
  assertEquals(timeAtToHms(Date.UTC(2024, 0, 15, 14, 30, 45) / 1000), "14:30:45");
  assertEquals(durationSince(0), "00:00:00");
  assertEquals(durationSince(1000, 1125), "00:02:05");
  assertEquals(statusIcon("answer"), "");
  assertEquals(statusIcon("unknown"), "");
  assertEquals(statusIcon(null), "");
  assertEquals(statusColor("ringing"), "yellow");
  assertEquals(statusColor("logged_out"), "blue");
  assertEquals(statusColor("unknown"), "");
  assertEquals(countryFlagClass("US"), "fi fi-us");
  assertEquals(countryFlagClass(null), "");
});
