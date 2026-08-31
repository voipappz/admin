import { assert, assertEquals } from "@std/assert";
import {
  applyStateEvent,
  createStateView,
  isStateEvent,
  type StateEvent,
  type StateView,
} from "../state_events.ts";

function event(partial: Partial<StateEvent> & { event: string }): StateEvent {
  return {
    event_id: crypto.randomUUID(),
    at: 1690000000,
    scope: "user",
    id: "u1",
    metadata: {},
    ...partial,
    data: { action: partial.event, ...(partial.data ?? {}) },
  };
}

Deno.test("applyStateEvent writes the fields an event carries", () => {
  const view = applyStateEvent({}, event({
    event: "user.ringing",
    data: { state: "receiving", queue_name: "support" },
  }));

  assertEquals(view.state, "receiving");
  assertEquals(view.queue_name, "support");
});

Deno.test("applyStateEvent drops `action` — it is the routing key, not a field", () => {
  const view = applyStateEvent({}, event({ event: "user.ringing" }));
  assertEquals(view.action, undefined);
});

Deno.test("applyStateEvent accumulates counters, because node sends deltas", () => {
  const view = applyStateEvent({}, event({
    event: "user.hangup",
    incr: { hangup_counter: 1, call_incoming_duration: 37 },
  }));
  applyStateEvent(view, event({ event: "user.hangup", incr: { hangup_counter: 1 } }));

  // Two `incr … 1` events mean two. A consumer that overwrote would read 1.
  assertEquals(view.hangup_counter, "2");
  assertEquals(view.call_incoming_duration, "37");
});

Deno.test("applyStateEvent flattens a map field to field.subfield", () => {
  const view = applyStateEvent({}, event({
    event: "user.ringing",
    data: { colors: { state: "yellow" } },
  }));
  assertEquals(view["colors.state"], "yellow");

  applyStateEvent(view, event({ event: "user.hangup", unset: ["colors.state"] }));
  assertEquals(view["colors.state"], undefined);
});

Deno.test("applyStateEvent unions collection additions instead of replacing", () => {
  const view: StateView = {};
  applyStateEvent(view, event({
    event: "number.ringing",
    scope: "call",
    id: "call-1",
    data: { channel_uuids: ["chan-a"] },
  }));
  applyStateEvent(view, event({
    event: "number.hangup",
    scope: "call",
    id: "call-1",
    data: { channel_uuids: ["chan-b"] },
  }));

  // A hangup naming one leg must not erase the other.
  assertEquals(view.channel_uuids, ["chan-a", "chan-b"]);
});

Deno.test("applyStateEvent does not duplicate a collection value seen twice", () => {
  const view = applyStateEvent({}, event({
    event: "number.ringing",
    data: { channel_uuids: ["chan-a"] },
  }));
  applyStateEvent(view, event({ event: "number.answer", data: { channel_uuids: ["chan-a"] } }));

  assertEquals(view.channel_uuids, ["chan-a"]);
});

Deno.test("applyStateEvent removes a value from a collection", () => {
  const view = applyStateEvent({}, event({
    event: "queue.start",
    scope: "environment",
    id: "e1",
    data: { live_calls_outgoing: ["call-1", "call-2"] },
  }));
  applyStateEvent(view, event({
    event: "queue.end",
    scope: "environment",
    id: "e1",
    remove: { live_calls_outgoing: ["call-1"] },
  }));

  assertEquals(view.live_calls_outgoing, ["call-2"]);
});

Deno.test("applyStateEvent honours `once` by not overwriting", () => {
  const view: StateView = { first_call_at: "100" };
  applyStateEvent(view, event({
    event: "user.answer",
    data: { first_call_at: "200" },
    once: ["first_call_at"],
  }));

  assertEquals(view.first_call_at, "100");
});

Deno.test("applyStateEvent removes an unset field", () => {
  const view = applyStateEvent({ registered: "true" }, event({
    event: "extension.unregister",
    scope: "extension",
    id: "1001@pbx.local",
    unset: ["registered"],
  }));

  assertEquals(view.registered, undefined);
});

Deno.test("isStateEvent accepts node's envelope and rejects anything else", () => {
  assert(isStateEvent(event({ event: "user.ringing" })));
  // The old op-log document, which this replaced — must not be folded silently.
  assert(!isStateEvent({ at: 1, ops: [{ op: "set", key: "user:u1:state" }] }));
  assert(!isStateEvent(null));
  assert(!isStateEvent("user.ringing"));
});

Deno.test("createStateView snapshots without handing out the live object", () => {
  const held = createStateView();
  held.apply(event({ event: "user.ringing", data: { state: "receiving" } }));
  const first = held.snapshot();

  held.apply(event({ event: "user.hangup", data: { state: "waiting" } }));

  assertEquals(first.state, "receiving");
  assertEquals(held.snapshot().state, "waiting");
});

// The transition from the log line that started this: a call hangup, folded.
Deno.test("a real call hangup folds into a usable view", () => {
  const call = "c89919fd-a0e4-4385-ad88-8f0582952cc6";
  const view = applyStateEvent({}, {
    event_id: "9f2c8e10-3a5b-4d61-9f0e-2c7b8a1d4e33",
    event: "number.hangup",
    at: 1788192667,
    scope: "call",
    id: call,
    data: {
      action: "number.hangup",
      state: "hangup",
      status: "hangup",
      environment_uuid: "6c87416a-87e2-407e-9ad7-143d14ebc6e1",
      caller_id_number: "972733237000",
      callcenter: "call",
      destination: "039000000",
      channel_uuids: ["88653c7e-c242-4d44-89fe-34215506407b"],
      hangup_at: "1788192667",
    },
    ttl: 10800,
    metadata: { environment_uuid: "6c87416a-87e2-407e-9ad7-143d14ebc6e1" },
  });

  assertEquals(view, {
    state: "hangup",
    status: "hangup",
    environment_uuid: "6c87416a-87e2-407e-9ad7-143d14ebc6e1",
    caller_id_number: "972733237000",
    callcenter: "call",
    destination: "039000000",
    channel_uuids: ["88653c7e-c242-4d44-89fe-34215506407b"],
    hangup_at: "1788192667",
  });
});
