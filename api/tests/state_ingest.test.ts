import { assertEquals } from "@std/assert";
import { EventStore } from "../event_store.ts";
import type { StateEvent } from "../state_events.ts";

function stateEvent(partial: Partial<StateEvent> & { event: string }): StateEvent {
  return {
    event_id: crypto.randomUUID(),
    at: 1788192667,
    scope: "user",
    id: "u1",
    metadata: {},
    ...partial,
    data: { action: partial.event, ...(partial.data ?? {}) },
  };
}

async function withStore(run: (store: EventStore) => Promise<void>) {
  const dir = await Deno.makeTempDir();
  const store = new EventStore(`${dir}/events.duckdb`);
  try {
    await store.open();
    await run(store);
  } finally {
    await store.close();
    await Deno.remove(dir, { recursive: true }).catch(() => {});
  }
}

Deno.test("a state event is stored with node's own event_id as the key", async () => {
  await withStore(async (store) => {
    const event = stateEvent({ event: "user.ringing", data: { state: "receiving" } });
    const result = await store.ingestStateEvent(event);

    assertEquals(result.inserted, true);
    assertEquals(result.eventId, event.event_id);

    const rows = await store.list(10);
    assertEquals(rows.length, 1);
    assertEquals(rows[0].action, "user.ringing");
    assertEquals(rows[0].event_type, "state.user");
    assertEquals(Number(rows[0].occurred_at_epoch), 1788192667);
  });
});

Deno.test("the same event delivered twice is stored once", async () => {
  await withStore(async (store) => {
    // Two browser tabs each hold their own StateChannel subscription, so the
    // same event really does arrive twice. node's event_id is what makes the
    // second a no-op instead of a primary-key error.
    const event = stateEvent({ event: "user.hangup" });
    assertEquals((await store.ingestStateEvent(event)).inserted, true);
    assertEquals((await store.ingestStateEvent(event)).inserted, false);

    assertEquals((await store.list(10)).length, 1);
  });
});

Deno.test("a call-scoped event carries its call_id; a user-scoped one does not", async () => {
  await withStore(async (store) => {
    await store.ingestStateEvent(stateEvent({
      event: "number.hangup",
      scope: "call",
      id: "c89919fd-a0e4-4385-ad88-8f0582952cc6",
    }));
    await store.ingestStateEvent(stateEvent({ event: "user.hangup", scope: "user", id: "u1" }));

    const rows = await store.list(10);
    const call = rows.find((r) => r.action === "number.hangup");
    const user = rows.find((r) => r.action === "user.hangup");

    assertEquals(call?.call_id, "c89919fd-a0e4-4385-ad88-8f0582952cc6");
    // A user-scoped event names no call — better NULL than an invented join.
    assertEquals(user?.call_id, null);
  });
});

Deno.test("an event with no event_id is refused rather than stored unkeyed", async () => {
  await withStore(async (store) => {
    const result = await store.ingestStateEvent(
      { ...stateEvent({ event: "user.ringing" }), event_id: "" },
    );

    assertEquals(result.inserted, false);
    assertEquals((await store.list(10)).length, 0);
  });
});
