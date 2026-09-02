# Spec: cable as a stateless proxy between Elixir and the Ruby API

**Status:** IMPLEMENTED on both sides, and this document is now a record of
the contract rather than a proposal.

- **Node:** `va-crystal node/realtime/api_proxy_channel.cr` — that file is the
  authority on the contract, not this one. Read it first if the two disagree.
- **Portal:** `AgentsDemo.Realtime.ApiProxy`, with `Plugs.EngineProxy` choosing
  the transport and keeping HTTP as a fallback.

**One caveat before enabling it anywhere real.** The vendored shard logs the
whole message payload at INFO before the channel ever sees it
(`node/lib/cable/src/cable/connection.cr:180`), so a proxied login writes its
password into the node's log in cleartext. `ApiProxy` itself is careful never
to log a body; that care is defeated one layer above it. Fix the shard first.

**Audience:** anyone changing either half.

## Why

The portal's transport rule is that Elixir talks to the platform over **cable or
NATS, never HTTP**. Realtime already satisfies that. Everything else does not:
`/auth`, `/api/`, `/tasks/` are forwarded over HTTP by
`AgentsDemoWeb.Plugs.EngineProxy`
(`agents_demo/lib/agents_demo_web/plugs/engine_proxy.ex`),
straight to the API. That HTTP hop is the thing to remove.

The intended shape:

```
Chrome ──> Elixir ──cable──> va-crystal ──HTTP──> Ruby API
```

va-crystal becomes the bridge. It **stores nothing**: a request arrives on the
cable connection, is forwarded to `API_URL`, and the reply is transmitted back
to the caller. Stateless in the strict sense — no persistence, no session, no
cache.

## What exists today

Verified by reading the source, not assumed.

- **Cable's request path is inert.** Every channel's `receive(data)` and
  `perform(action, action_params)` has an **empty body** —
  `node/realtime/app.cr:196,199` (`Notifications`), `:219,222`
  (`DashboardUser`), and likewise for the rest. Frames can be sent to cable and
  nothing reads them.
- **The dispatch already works, though.** The vendored shard routes a
  `{"command":"message"}` frame to the channel:
  `node/lib/cable/src/cable/connection.cr:110` → `:180-186`, choosing
  `channel.perform(payload.action, payload.data)` when the payload carries an
  `action` key and `channel.receive(payload.data)` otherwise. So the hook points
  exist and are reached; only the bodies are missing.
- **Replies have a mechanism.** `Cable::Channel#transmit`
  (`node/lib/cable/src/cable/channel.cr:81-88`) sends to the **single
  subscriber**, not to a stream — which is what a reply needs, and what
  `broadcast` would get wrong.
- **The connection is authenticated before any channel exists.** A valid
  `?token=` is required (`node/realtime/app.cr:84-88`), HS256-verified against
  the node's `SECRET_KEY` (`va-shared/src/cable_auth.cr:16-22`), and must carry
  `account_uuid` or `user_uuid` (`app.cr:103-107`).
- **The node has no other inbound surface.** Its complete route list is
  `/sbc/outgoing`, `/health`, `/health/system`, `/metrics`, `/health/node`,
  `/capture`, `/capture/:action`, `/announcements/:file`, `/switch/config`,
  `ws /voice/stream`, `ws /cable`. There is no auth route and no general proxy.
- **The node does not authenticate to the API.** Every call it makes is
  identified by `NODE_UUID` alone. There is no account, token or basic-auth path
  in its source.

## The bootstrap problem, and how it resolves

A credential is required to open cable, so a login cannot be the thing that
obtains one. That is only a paradox if the *browser's* credential is what opens
the connection.

It isn't. **Elixir holds one account credential** and opens one connection with
it (see `agents_demo` — `Realtime.CableToken`). User logins then ride over that
already-authenticated connection as ordinary proxied requests. The browser's
credential never opens a cable connection and never reaches the node.

This also means the proxy is never exposed unauthenticated: the connection is
authenticated by an account before a single request can be sent.

## Design

### A dedicated channel

Add `ApiProxy` rather than extending `Notifications` or `DashboardUser`. Those
two exist to *stream*, and their `subscribed` has side effects —
`DashboardUser#subscribed` stamps `user:<uuid>:logged_in_at` (`app.cr:211`), so
overloading it would tie an unrelated RPC to a presence record.

```crystal
class ApiProxy < ApplicationCable::Channel
  def subscribed
    # No stream_from: this channel never receives broadcasts, only replies.
  end

  def perform(action, action_params)
    # action == "request"
    # action_params: { "id", "method", "path", "body"? }
  end

  def unsubscribed
  end
end
```

### The frame contract

Request, from Elixir:

```json
{ "command": "message",
  "identifier": "{\"channel\":\"ApiProxy\"}",
  "data": { "action": "request",
            "id": "<uuid>",
            "method": "POST",
            "path": "/auth/user_login",
            "body": "email=…&password=…",
            "content_type": "application/x-www-form-urlencoded" } }
```

Reply, transmitted back:

```json
{ "id": "<uuid>", "status": 200,
  "headers": { "content-type": "application/json" },
  "body": "…" }
```

**`id` is mandatory and must be echoed.** Cable is asynchronous and one
connection carries many concurrent requests; without correlation the caller
cannot match a reply to its request. This is the single most important detail in
the contract — an implementation that omits it appears to work under a
single-request test and interleaves wrongly under load.

### Path allowlist

The proxy forwards **only** an explicit allowlist, and rejects everything else
with a `403` reply rather than forwarding it:

```
/auth/…      /api/…      /tasks/…
```

Without this the channel is a general-purpose relay into the API for anyone
holding a cable token, which is a larger grant than the token itself represents.
An allowlist is a one-line guard now and a breach review later.

### Errors are replies, not silence

Every failure path must transmit a reply carrying `id`:

| Condition | Reply |
|---|---|
| Path not on the allowlist | `403` |
| `API_URL` unset | `502`, body naming the missing config |
| Upstream refused / timed out | `502`, body naming the upstream |
| Malformed payload (no `id`, no `path`) | `400` — but if `id` is absent it cannot be correlated, so also log it |

A dropped frame presents to the caller as a hang, and a hang is the hardest
failure to diagnose across a WebSocket. Every request must produce exactly one
reply.

### Timeout and size

- A bounded upstream timeout (suggest 30s, matching `engine_proxy.ex`'s
  `receive_timeout`), after
  which a `502` is transmitted rather than leaving the caller waiting.
- A maximum body size, rejected with `413`. A WebSocket frame has no natural
  limit and an unbounded relay is a memory-exhaustion path.

### Statelessness

Nothing is persisted, cached, or written to `STATE`. The channel holds no map of
in-flight requests beyond what a single `perform` call needs — the correlation
`id` travels in the frames, not in node memory, so a node restart loses nothing
and two nodes behind a load balancer behave identically.

### Headers

Forward `content-type` and nothing else from the request. Do **not** forward the
cable token as an `Authorization` header: the API's credential model is separate
from the node's, and a node that forwards its callers' tokens becomes a
confused deputy. Return `content-type` and `status`; drop hop-by-hop headers
(`connection`, `keep-alive`, `transfer-encoding`, `upgrade`) — the same set
`engine_proxy.ex`'s `@hop_by_hop` drops, and for the same reason.

## The Elixir side

- `Realtime.CableClient` gains `request/2` — subscribe to `ApiProxy` once on
  connect, send the frame, await the reply by `id` with a timeout, and return
  `{:ok, status, body}` or `{:error, reason}`.
- `Plugs.EngineProxy`'s forwarding branch switches from `Req` to
  that call. The `@engine_prefixes` list becomes the client-side mirror of the
  node's allowlist.
- The HTTP path stays as a fallback while this is proven, behind config. Remove
  it once the cable path is trusted, not before.

## Verification

1. **Correlation under concurrency** — the check that matters most. Issue 50
   concurrent requests with distinct `id`s over one connection and assert every
   reply matches its request. A sequential test cannot fail this.
2. Login end to end: the extension logs in against Elixir, Elixir proxies over
   cable, and the returned token is byte-identical to what the API returns over
   HTTP.
3. Allowlist: a request for a non-allowlisted path is answered `403` and no HTTP
   call is made upstream (assert on the node's own logs).
4. Failure paths each produce a reply, not a hang: stop the API and confirm
   `502`; unset `API_URL` and confirm `502`.
5. Restart the node mid-flight and confirm the caller gets an error rather than
   waiting forever.

## Alternative, for the record

Elixir already reaches the API over HTTPS directly, and that works today with no
va-crystal change. This proposal buys architectural consistency — one transport
to the platform — at the cost of a new inbound surface on every node and a
request/reply protocol that does not exist yet.

Worth being explicit that the cost is real: it puts a general (if allowlisted)
API relay on a node that today accepts no inbound requests except health and
config. Consistency is a good reason, but it should be the *stated* reason.

## Out of scope

- The two known cable defects this proposal neither fixes nor worsens:
  `cable_auth.cr` never checks `exp`, and `Notifications#subscribed` streams
  from a client-supplied `user_uuid` (`app.cr:191-193`).
- Node → API authentication. It remains `NODE_UUID`-identified.
