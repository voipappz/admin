# LegionWeb, read for the calls view

Written 2026-09-14. Source: `../legion_web` (software-mansion-labs/legion_web
0.5.0, MIT), cloned as a sibling of this repo for reference only. It is a
real-time dashboard for Legion agents; we run Sagents, so nothing here is a
dependency. It was read because its shape, a list of live agents on the left
and the selected agent's transcript and trace on the right, fed by a tracker
process and per-agent PubSub topics, is the shape of the calls view in
`voice-agent-plan.md` phase 2. Their agent is our call.

The digest below is the full read. Section 11 is the part to act on.

# LegionWeb design digest — building a "live calls" dashboard on Sagents

Root: `/home/nir/connectix/legion_web` (all paths below are absolute). ~2.1k lines in `lib/`, ~1.9k in `test/`. Deps that matter: `phoenix_live_view ~> 1.0`, `phoenix_pubsub`, `telemetry`, `makeup` + `makeup_syntect`, `earmark` (`legion_web/mix.exs:60-85`). `ecto_sql`/`postgrex`/`igniter` are `optional: true`.

---

## 1. Process model and supervision

`legion_web/lib/legion_web/application.ex:12-18` — three children, `:one_for_one`:

```elixir
children = [
  {Phoenix.PubSub, name: LegionWeb.PubSub},
  {agent_tracker, agent_tracker_opts},
  LegionWeb.HumanHandler
]
```

The library owns its own PubSub instance named `LegionWeb.PubSub` rather than borrowing the host app's — important for a hex package, and it means every topic string in the codebase is namespaced (`"legion_web:…"`). The dev endpoint reuses it as its `pubsub_server` (`legion_web/dev.exs:269`).

Tracker selection is config-driven and normalised to `{module, opts}` (`application.ex:26-37`):

```elixir
:legion_web |> Application.get_env(:agent_tracker, LegionWeb.AgentTracker.Telemetry) |> normalize_agent_tracker()
```
Accepts either a bare module or `{Module, opts}`. `LegionWeb.Application.agent_tracker/0` (`application.ex:22-24`) is public so the router can stuff the module into the LiveView session (see §8). Because the child spec is `{module, opts}`, any tracker just needs `start_link/1` + `child_spec/1`.

The behaviour is four callbacks only (`legion_web/lib/legion_web/agent_tracker.ex:85-100`): `list_agents(limit)`, `get_agent(id)`, `get_events(id)`, `get_usage(id)`. The two structs it must return are declared in the same file: `LegionAgent` (`agent_tracker.ex:1-30`, fields `agent_id, parent_agent_id, agent_module, pid, status, identity, started_at, finished_at, task, iterations`; status ∈ `:running | :idle | :waiting_for_human | :done | :error | :dead`) and `LegionEvent` (`agent_tracker.ex:32-45`, `seq, agent_id, type, timestamp, data`). This behaviour/struct split is the single most portable idea in the repo.

`application.ex:39-45` also registers a Makeup lexer for Elixir at boot — unrelated to tracking but needed before any highlight call.

## 2. Ingestion — `agent_tracker/telemetry.ex` (383 lines)

**Attached events** (`legion_web/lib/legion_web/agent_tracker/telemetry.ex:250-271`), one `:telemetry.attach_many` under handler id `"legion_web_tracker"`:

```
[:legion, :agent, :started] / [:legion, :agent, :stopped]
[:legion, :agent, :message, :start | :stop | :exception]
[:legion, :iteration, :start | :stop]
[:legion, :llm, :request, :start | :stop]
[:legion, :sandbox, :eval, :start | :stop]
[:legion_web, :agent, :waiting_for_human]      # emitted by HumanHandler
[:legion_web, :agent, :human_response]         # emitted by HumanHandler
```

**Handlers run in the emitting process**, so they only do two things: write the `agents` row (for `:started`, `telemetry.ex:157-173`) and `send/2` a message to the GenServer. The send is deliberately defensive (`telemetry.ex:278-284`):

```elixir
defp notify_tracker(message) do
  if pid = Process.whereis(__MODULE__), do: send(pid, message)
  :ok
end
```
Comment explains why: a raise in a telemetry handler causes `:telemetry` to **permanently detach** it, so a restarting tracker must not blow up the agent.

**Mapping**: `agent.message.start` → `{:status_change, id, :running, %{task: msg}}` + `:message_start` event; `message.stop` → `:idle` + `iterations` from meta; `message.exception` → `:error`; `iteration/llm/eval` spans → events typed `:iteration_start/:iteration_stop/:llm_start/:llm_stop/:eval_start/:eval_stop` with `duration` merged in from measurements (`telemetry.ex:179-239`). `:llm_stop`/`:eval_stop` etc. go through `track_and_forward/3` (`telemetry.ex:273-276`) which also re-emits the event under the **parent's** agent_id (`forward_to_parent/3`, `telemetry.ex:374-382`) — that's how a parent's trace shows sub-agent activity.

**ETS layout** (`telemetry.ex:70-73`), all `:public` so reads bypass the GenServer:
- `:legion_web_agents` — `set`, `{agent_id, %LegionAgent{}}`
- `:legion_web_events` — `ordered_set`, `{{agent_id, seq}, %LegionEvent{}}`
- `:legion_web_usage` — `ordered_set`, `{{agent_id, seq}, usage_map}`

Reads are `:ets.select` with a match spec projecting `{seq, value}` then sorting (`telemetry.ex:51-67`). `list_agents/1` is `tab2list |> sort_by(:started_at, :desc) |> take(limit)` — O(n log n) per call, fine at n≤100.

**seq** is a single monotonically-increasing counter in GenServer state (`telemetry.ex:77`, `:113-133`), global across agents, not per-agent. It doubles as the ordered_set sort key and as the DOM id in the trace (`Trace.render`, `trace.ex:34,40`).

**Caps/eviction**: `@max_agents 100`, `@max_events_per_agent 500` (`telemetry.ex:27-28`). Events: before insert, if `count_events/1` ≥ 500, delete the oldest via `:ets.next(table, {agent_id, 0})` (`telemetry.ex:317-328`) — neat use of the ordered_set key ordering. Agents: on each `:agent_started`, `evict_if_over_limit/0` (`telemetry.ex:333-346`) deletes **at most one** finished agent, and `delete_agent/1` cascades to events + usage. The source itself flags the hole in a `# ponytail:` comment at `telemetry.ex:330-332`: >100 concurrently *running* agents grows the table unboundedly, since running/waiting agents are never evictable.

**Process monitoring**: on `:agent_started` with a pid, `Process.monitor` and stash `ref => agent_id` (`telemetry.ex:81-93`). `:DOWN` marks the agent `:dead` with `finished_at`, *unless* it is already `:done`/`:error` (`telemetry.ex:135-153`). Note `pid: self()` in the handler (`telemetry.ex:163`) — the pid recorded is whatever process emitted the telemetry.

**Broadcasts** (`telemetry.ex:354-372`), exactly two topics:

| topic | message | when |
|---|---|---|
| `"legion_web:agents"` | `{event, agent_id, %LegionAgent{}}` where event ∈ `:started, :stopped, :waiting, :dead` or the new status atom (`:running, :idle, :error`) | any lifecycle/status change |
| `"legion_web:agent:#{inspect(agent_id)}"` | `{:new_event, %LegionEvent{}}` | every stored event |
| same | `{:usage, agent_id, full_usage_list}` | on `:llm_stop` carrying `usage` |

The per-agent topic format is duplicated in `Helpers.agent_topic/1` (`legion_web/lib/legion_web/helpers.ex:87`) — `inspect/1` on the id, so `"abc"` becomes `legion_web:agent:"abc"` with quotes. Usage recording is guarded by `config :legion, :track_usage` and by a pattern match that rejects forwarded sub-agent copies (`telemetry.ex:296-312`) — the forwarded event carries the *child's* `data.agent_id`, so `%{agent_id: agent_id}` binding against the outer `agent_id` fails for the parent. Another `# ponytail:` comment there admits the full-list rebroadcast is quadratic over a long conversation.

## 3. The Postgres tracker — `agent_tracker/postgres.ex`

Whole module is wrapped in `if Code.ensure_loaded?(Postgrex) do` (`legion_web/lib/legion_web/agent_tracker/postgres.ex:1`) so the optional dep stays optional.

- `init/1` requires a `:store` that exposes `__repo__/0` and `__table__/0` (validated at `postgres.ex:165-173`), starts `Postgrex.Notifications` with the repo's config plus `auto_reconnect: true`, and `LISTEN`s on the store's table name (`postgres.ex:68-74`). The notifications module is injectable (`Keyword.get(opts, :notifications, Postgrex.Notifications)`) purely so the test can fake it (`legion_web/test/legion_web/agent_tracker/postgres_test.exs:50-53`).
- All four reads are `GenServer.call` (`postgres.ex:79-96`) — no ETS, so **reads serialize through one process**. That's a throughput difference versus the telemetry tracker's public ETS.
- `handle_info({:notification, _, _, _, agent_id}, …)` (`postgres.ex:130-161`): reload the payload, broadcast `{record.status, agent_id, record}` on `"legion_web:agents"`, broadcast full usage, and replay only *new* events using a per-agent `event_cursors` map — `Enum.drop(events, cursor)`. The cursor is only seeded by a prior `get_events/1` (`postgres.ex:114-117`), i.e. only for agents somebody has opened; otherwise events are silently not broadcast (`:error -> :ok`). Cursor is dropped when the row disappears.
- Status is derived, not stored (`postgres.ex:203-208`): `running? = Legion.running?(pid)` via `Legion.lookup/1`; `{true,:running}→:running`, `{true,_}→:idle`, `{false,:running}→:dead`, `{false,_}→:done`.
- Events are *reconstructed from the conversation transcript*, not from telemetry (`postgres.ex:218-260`): each message index becomes the seq; `:user→:message_start`, `:assistant→:llm_stop` (JSON-decoding the content into `%{object: …}`, falling back to `%{"raw" => content}`), `:eval_result/:error→:eval_stop`. This is the key trick: it lets a durable store masquerade as the same event stream the reducer already understands.
- `identity` comes from a `ratelimit_metadata` column; `finished_at`, `task`, `iterations` are always nil/0 (`postgres.ex:198-199`), so the UI's duration/iteration chips silently go blank.

**Worth copying?** The *pattern* yes, the code no. Copy: (a) rebuild-from-store + LISTEN/NOTIFY instead of polling, (b) the cursor-based "broadcast only the tail" idea, (c) synthesising the same event structs from persisted rows so one reducer serves both live and historical. Skip: everything touching `Legion.Store.Payload`, `Legion.lookup/1`, `ratelimit_metadata`. Also note it ignores the `limit` semantics (the moduledoc says 100; the store is trusted to honour `list(limit)`).

## 4. `dashboard_live.ex` (286 lines)

`@page_size 20` with a public `page_size/0` so tests can assert against it (`legion_web/lib/legion_web/dashboard_live.ex:7-9`).

**mount/3** (`dashboard_live.ex:12-38`): pulls `agent_tracker`, `prefix`, `live_path`, `live_transport`, `csp_nonces` out of the **session** (not config) and assigns them; subscribes to `"legion_web:agents"` only `if connected?(socket)`; then assigns a full set of empty defaults including `TraceReducer.new()` and `to_form(%{"text" => ""}, as: :chat)`.

**handle_params/3 with `agent_id`** (`dashboard_live.ex:41-82`) is the selection path. The id is a **URL path segment**, base64url-encoded (`Helpers.encode_agent_id/1`, `helpers.ex:89-103`, `padding: false`, plus a `String.valid?` check on decode). Three-step guard: decode → `get_agent` → `agent_id = agent && decoded_agent_id`, so an unknown or malformed id degrades to "nothing selected" rather than a dangling selection (comment at `:42-45`; tests at `legion_web/test/legion_web/dashboard_live_test.exs:231-249`). Then: swap subscriptions, **replay the entire event history through the reducer** (`Enum.reduce(events, TraceReducer.new(), &TraceReducer.push(&2, &1))`), fetch usage, render the system prompt, and reset both modals + the chat form.

**Subscription swap** (`dashboard_live.ex:233-245`): unsubscribe the previous `selected_agent_id`'s topic, subscribe the new one, both gated on `connected?`. Only one agent topic is ever subscribed; the global agents topic stays from mount.

**handle_info/2**:
- Lifecycle: a single clause with a guard listing the allowed event atoms (`dashboard_live.ex:103-105`) — `[:started, :stopped, :running, :idle, :done, :error, :waiting, :dead]`. It merges via `update_agents_list/3` (`:247-256`): find by `agent_id`, `List.replace_at` or prepend, then `sort_by(& &1.started_at, :desc)` every time. Then `maybe_update_selected_agent/3` refreshes the header if the update is for the selected agent.
- `{:usage, agent_id, usage}` (`:119-127`): ignores other agents **and ignores shorter snapshots** — `length(usage) >= length(current)` — an explicit fix for the race where a broadcast issued before `handle_params` refetched arrives after it.
- `{:new_event, event}` (`:130-133`): push through the reducer, re-derive `trace_items`. Note it does **not** check the event's agent_id — correctness relies entirely on the subscription swap.
- Catch-all `handle_info(_msg, socket)` at `:135` swallows `{:human_request, q}`/`{:human_responded, text}` from HumanHandler; the UI never renders them directly (tested at `dashboard_live_test.exs:380-386`).

**Chat send** (`dashboard_live.ex:138-156`): guard `when text != ""`, plus a fallback clause for missing params. Liveness check is `Legion.running?(agent.pid)` not `Process.alive?/1` — comment at `:141-142` says the Postgres tracker can return a pid on another node, which `Process.alive?/1` raises on. Then a two-tier dispatch:

```elixir
case HumanHandler.respond(agent.agent_id, text) do
  :ok -> :ok
  :not_found -> Legion.cast(agent.pid, text)
end
```
i.e. if the agent is blocked in `HumanTool.ask`, the text answers that question; otherwise it's a fresh message. The form is always reset regardless.

**`has_more` paging trick** (`dashboard_live.ex:208-215`): fetch `list_limit + 1` from the tracker, display `Enum.take(agents, list_limit)`, set `has_more = length(agents) > list_limit`. One extra row instead of a count query. `"load_more"` just re-runs `assign_agents/2` with `list_limit + @page_size` — a full refetch, not an append, so newly-arrived agents are picked up for free. Covered at `dashboard_live_test.exs:414-449`.

**Prompt rendering** (`dashboard_live.ex:222-268`) is the most Legion-specific part: `prompt_and_config/1` guards on `Code.ensure_loaded?(agent_module)` (a persisted agent can outlive its module — test at `dashboard_live_test.exs:251-268`), merges app config with `agent_module.config()`, and `render_system_prompt/2` pushes every tool's config into the process-dictionary `Vault` before calling `Legion.AgentPrompt.system_prompt/2`. `sandbox_language/1` (`:271-277`) turns `Legion.Sandbox.Lua` into `"lua"` for Makeup.

## 5. `trace_reducer.ex` — raw events → display items

`legion_web/lib/legion_web/trace_reducer.ex`. State: `%{items: [], pending: nil, between: [], subagents: %{}}` (`:19-22`). `items/1` = `flush_pending |> resolve_subagents` (`:29-33`), so the struct is always safe to render mid-stream.

Item types (moduledoc `:10-16`): `{:message, d}`, `{:human_response, d}`, `{:exception, d}`, `{:step, d}`, `{:eval_error, d}`, `{:subagent, name, items}`, `{:unknown, d}`.

- **Filtering**: `@hidden_types ~w(iteration_start iteration_stop eval_start llm_start message_stop)a` dropped at `:24,:36` — only the *stop* halves carry payload.
- **Pairing state machine** (`:64-134`), three states. `nil`: an `:llm_stop` whose `data.object["action"]` is `eval_and_continue`/`eval_and_complete` sets `pending = {:awaiting_eval, event}`. In `:awaiting_eval`, the next `:eval_stop` builds a `{:step, …}` with an `eval:` sub-map (`success/result/error/duration`, `:172-196`); any *other* event is buffered in `between` and re-emitted *before* the step (`:116-118`, `:91-110`) so ordering stays visually sane; a second `:llm_stop` forces a flush first.
- **Collapse**: `eval_and_complete` moves to `{:maybe_collapse, step}`; if the next `llm_stop` action is `return`/`done`, the two merge into one item carrying the return's text and the completed step's `eval` (`:122-130`). Anything else flushes.
- Successful `:eval_stop` with no pending LLM is **dropped entirely** (`:79`) — noise; a failed one becomes `{:eval_error, …}` with an `is_timeout` flag matched off `%{type: :timeout}` (`:198-206`).
- **Sub-agents** (`:46-62, 210-227`): an event is a sub-agent event when `event.agent_id != event.data.agent_id` — i.e. a forwarded copy from §2. The first one drops a `{:subagent_placeholder, key}` into `items` to pin ordering, and later ones accumulate into `subagents[key]`; `resolve_subagents/1` swaps placeholders for `{:subagent, name, items}` at render time. Name is the last module segment, default `"sub-agent"`.

`items` is kept reversed internally and reversed once in `resolve_subagents` — O(1) push, O(n) render. 582 lines of tests at `legion_web/test/legion_web/trace_reducer_test.exs` cover each transition.

**`usage_aggregator.ex`** (`legion_web/lib/legion_web/usage_aggregator.ex`): pure functions over string-keyed maps. `totals/1` folds `requests/input/output/cached/reasoning/cost`, missing counters → 0 (`tokens/2`, `:40-45`), and `cost` stays `nil` until some entry has `"total_cost"` (`add_cost/2`, `:68-69`) so "unknown" and "$0" are distinguishable. `format_tokens/1` → `842 / 12.3k / 1.25M` with a rounding edge case at exactly 1000.0k (`:51-56`); `format_cost/1` → `"<$0.001"` below a tenth of a cent, else 3 decimals.

## 6. Components

All under `legion_web/lib/legion_web/components/`, all plain function components (`use LegionWeb, :html`) — **no LiveComponents anywhere**, so no `send_update` plumbing.

- **`agents_list.ex`** — 320px fixed sidebar (`w-80 shrink-0`, `:30`). Builds the tree in the render function: `Enum.group_by(agents, & &1.parent_agent_id)` plus roots = agents whose parent is nil *or whose parent isn't in the loaded page* (`:14-22`) — that orphan-adoption rule is what keeps paging from hiding children. `agent_tree_node/1` recurses with `depth`, and indentation is an inline style `padding-left: #{max(1.0, depth*1.25 + 1.0)}rem` (`:96`) because Tailwind can't do dynamic classes. Each row is a `<.link patch={"#{@prefix}/#{encode_agent_id(id)}"}>` — patch, not navigate, so selection is a `handle_params` round-trip with no remount. Row shows status dot, `↳` for sub-agents, module short name, status label, relative time, duration, `iter N`. "Load more" button at `:57-64` gated on `@has_more`.
- **`helpers.ex`** status conventions (`legion_web/lib/legion_web/helpers.ex:46-68`): dot class `status_class/1` — running `bg-sol-green soft-pulse`, idle `bg-sol-blue`, waiting_for_human `bg-sol-yellow soft-pulse`, done `bg-sol-cyan`, error `bg-sol-red`, dead `bg-sol-red/70`; plus parallel `status_text_class/1` and `status_label/1` (`:dead` renders as "failed"). `agent_detail.ex:188-194` adds a third variant, `status_badge_class/1` (`bg-*/15 text-*`).
- **`agent_detail.ex`** — `render(%{agent: nil})` is an empty-state clause (`:20-31`). Header: dot + module name + badge + `identity_chip` + System Prompt / Usage buttons + `Usage.summary` + duration + relative time. Both overlays are `absolute inset-0 z-10` panels inside the same container with `phx-window-keydown="close_*" phx-key="Escape"` (`:101-106`, `usage.ex:48-52`) — cheap modals, no JS. Chat is only rendered when `@agent.pid && status in [:running, :idle, :waiting_for_human, :done]` (`:92`).
- **`chat.ex`** — status line + single-input form, `phx-submit="send_message"`, `phx-hook="ResetForm"`, input disabled while `:running`. Placeholder/colour switch on `:waiting_for_human`.
- **`trace.ex`** (338 lines) — scroll container `id="trace-container" phx-hook="AutoScroll"`, `font-mono text-xs`, each item wrapped in `id={"item-#{data.seq}"} class="animate-fade-in"`; sub-agent groups are `<details … phx-hook="DetailsState">`. Per-item renderers give each kind its own tint (message = blue/10, human_response = yellow/10, exception = red/10, result = green/8, timeout = orange/8). `action_class/1` (`:289-293`) colours the action word. `format_duration/1` at `:273-278` converts Legion's **native-unit monotonic diffs** via `System.convert_time_unit/3` — easy to get wrong. `extract_human_question/1` (`:282-287`) regex-scrapes `HumanTool.ask("…")` out of the generated code so the trace shows the question instead of the code. Output is aggressively truncated: `format_eval_result/1` inspects with `limit: 100, printable_limit: 2000` then slices at 1500 chars (`:295-303`).
- **`usage.ex`** — `summary/1` inline `↑in ↓out $cost` with a `data-note` disclaimer that the cost is an estimate; `panel/1` a 6-tile grid + one table row per request.
- **`markup.ex`** — `highlight/2` via `Makeup.Registry.get_lexer_by_name/1`, falling back to escaped plaintext for unknown languages (`:17-26`). `markdown/1` (`:38-46`) parses with `Earmark.Parser.as_ast`, then **`escape_raw_html/1` rewrites every `%{verbatim: true}` node into a plain text node** (`:51-74`) so Earmark's transform escapes it — that's the sanitisation, and it's the only thing standing between LLM output and stored XSS. Then a regex pass (`@code_block_re`, `:77`) re-highlights fenced blocks, which requires un-escaping the entities Earmark just wrote (`unescape_html/1`, `:92-99`). Two prose scopes in CSS: `.prompt-prose` and `.trace-prose` (`legion_web/assets/css/app.css:158-280`), plus a hand-written solarized Makeup palette at `:282-309`.
- Palette: solarized light, declared once as Tailwind v4 `@theme` custom properties (`app.css:5-22`), so every class is `sol-base3` (page), `sol-base2` (panels/borders), `sol-violet` (accent/links/cost), `sol-green/blue/yellow/red/cyan/orange` (semantics).

## 7. `human_handler.ex` — the ask/answer protocol

`legion_web/lib/legion_web/human_handler.ex`. State: `%{pending: %{agent_id => {ref, from_pid, monitor_ref}}}`.

1. Legion's `HumanTool` sends `{:human_request, ref, from_pid, question, meta}` to the named process (`:32`). The handler monitors `from_pid`, replacing+demonitoring any previous pending entry for that agent (`:38-44`) — comment explains HumanTool blocks the agent so the old asker is necessarily gone.
2. It then emits `[:legion_web, :agent, :waiting_for_human]` telemetry (which the tracker converts into a status change, closing the loop) **and** broadcasts `{:human_request, question}` on the per-agent topic (`:46-57`).
3. `respond/2` is a `GenServer.call` (`:24-26`, `:75-98`): pops the pending entry, demonitors, `send(from_pid, {:human_response, ref, text})` — the raw reply protocol back to the blocked tool — emits `[:legion_web, :agent, :human_response]` telemetry with the text, and broadcasts `{:human_responded, text}`. Returns `:not_found` when nothing is pending, which is exactly the signal `DashboardLive` uses to fall back to `Legion.cast/2`.
4. `:DOWN` sweeps the pending map by monitor ref (`:61-70`) so a crashed/timed-out eval doesn't leak an entry.

Note the UI does not subscribe to `{:human_request, …}`/`{:human_responded, …}` — the question surfaces via the trace (scraped from the code) and the status via the tracker. Those two broadcasts are effectively an unused extension point.

## 8. `router.ex`, assets, layouts

`legion_dashboard/2` macro at `legion_web/lib/legion_web/router.ex:46-71`. It captures `prefix = Phoenix.Router.scoped_path(__MODULE__, path)` at compile time, then inside `scope path, alias: false, as: false` defines, all within one `live_session`:

```elixir
get  "/css-:md5", LegionWeb.Assets, :css, as: :legion_web_asset
get  "/js-:md5",  LegionWeb.Assets, :js,  as: :legion_web_asset
live "/",           LegionWeb.DashboardLive, :index, route_opts
live "/:agent_id",  LegionWeb.DashboardLive, :show,  route_opts
```

`__options__/2` (`:80-103`) merges defaults `socket_path: "/live", transport: "websocket"`, validates each opt (`:126-152` — raises `ArgumentError` for a bad transport/socket_path/csp key), and produces `session: {__MODULE__, :__session__, [prefix, socket_path, transport, csp_nonce_assign_key]}`, `root_layout: {LegionWeb.Layouts, :root}`, `on_mount: opts[:on_mount]` (the auth hook point). `__session__/5` (`:106-120`) returns the string-keyed map the LiveView reads in mount, including `"agent_tracker" => LegionWeb.Application.agent_tracker()` and `"csp_nonces"` resolved from conn assigns — `nil | atom | %{img:, style:, script:}` (`:122-124`).

**Assets** (`legion_web/lib/legion_web/assets.ex`): a Plug that serves CSS/JS **inlined at compile time** as module attributes, with `@external_resource` so recompiles pick up changes. The JS attribute concatenates `phoenix.js`, `phoenix_html.js`, `phoenix_live_view.js` from their app dirs plus the bundled `app.js` (`:18-30`), neutering their sourceMappingURL comments. `current_hash/1` is generated per asset via a compile-time `for` loop over MD5s (`:53-57`). Responses set `cache-control: public, max-age=31536000, immutable` and `plug_skip_csrf_protection` (`:44-51`). Why: a hex-packaged dashboard can't rely on the host's `Plug.Static`, digest pipeline, or `esbuild` config — content-hashed URLs give immutable caching with zero host setup. `priv/static/app.{js,css}` are committed, and `mix release` fails on a dirty `priv/static` diff (`mix.exs:96`).

**Layouts** (`legion_web/lib/legion_web/layouts/`): `root.html.heex` carries the CSRF meta, an inline SVG data-URI favicon, and nonce'd `<link>`/`<script>` built by `Layouts.asset_path/2`, which digs the prefix back out of `conn.private.phoenix_live_view` metadata (`legion_web/lib/legion_web/layouts.ex:6-18`) — fragile but avoids threading the prefix through the conn. `live.html.heex` emits `<meta name="live-transport">` and `<meta name="live-path">` for the JS to read.

## 9. `assets/js/app.js` (56 lines)

`legion_web/assets/js/app.js`. No imports — it consumes the globals `Phoenix` / `LiveView` that the concatenated bundle defines (`:1-2`). Three hooks:
- `DetailsState` — records `el.open` in `beforeUpdate`, restores it in `updated`, so `<details>` sub-agent groups don't snap shut on every LiveView patch.
- `ResetForm` — `requestAnimationFrame(() => el.reset())` on submit, so the chat input clears immediately rather than waiting for the server round-trip.
- `AutoScroll` — scrolls to bottom on mount; on update only if already within 120px of the bottom (`:26-30`), the standard "don't yank the user back down" rule.

Socket config reads `meta[name=live-path]` and `meta[name=live-transport]` with `/live` / `websocket` defaults, and swaps in `Phoenix.LongPoll` when asked (`:41-53`).

## 10. Tests

- **`legion_web/test/legion_web/dashboard_live_test.exs` (503 lines)** — notably **does not use `Phoenix.LiveViewTest`**. It calls `DashboardLive.mount/3`, `handle_params/3`, `handle_info/2`, `handle_event/3` directly against a bare `%Phoenix.LiveView.Socket{assigns: %{__changed__: %{}, flash: %{}}}` (`:57`), with a `mounted_socket/1` helper that merges extra assigns (`:62-65`). Because `connected?/1` is false on that socket, all the PubSub calls are skipped, which is why no PubSub setup is needed. Fixtures are inline modules: `FakeAgent` with `system_prompt/tools/tool_config/config` (`:16-22`) and `ConfiguredTracker`, a four-function stub proving the session-injected tracker is honoured (`:24-29`, asserted `:102-108`). State is set up by writing directly into ETS (`:94-95`, `:139-149`) and torn down with `:ets.delete_all_objects` + `Process.delete(:"$vault")` in `setup` (`:31-38`); `async: false` because ETS is global.
- **`legion_web/test/legion_web/agent_tracker/telemetry_test.exs` (389 lines)** — two styles: `send(Telemetry, {:event, …})` to exercise the GenServer directly, and `Telemetry.handle_telemetry(event, measurements, meta, nil)` to exercise the mapping (`:137-148`, `:352-357`). Assertions are `assert_receive` on PubSub after subscribing in `setup`. Two techniques worth stealing: `:sys.get_state(Telemetry)` as a synchronisation barrier after flooding 501 events (`:335`), and `refute_receive … , 200` for the negative cases (no usage for forwarded sub-agent events, no `:dead` for an already-`:done` agent).
- `trace_reducer_test.exs` (582 lines) is pure-function table-driven and would port almost verbatim. `postgres_test.exs` fakes the store, repo and notifications as tiny inline modules (`:9-53`). `markup_test.exs` includes the XSS cases. `application_test.exs` is 11 lines.

## 11. Transferable to a Sagents calls view

**Ports directly (little or no change):**
- The **tracker behaviour + `{module, opts}` child spec + session-injected module** triple (`agent_tracker.ex`, `application.ex:26-37`, `router.ex:110`). This is what lets you ship an in-memory tracker now and a durable one later without touching the LiveView; tests exploit it too.
- The **ETS layout**: `set` for records, `ordered_set` keyed `{id, seq}` for the log, `:public` for lock-free reads, `:ets.next(t, {id, 0})` for oldest-first eviction (`telemetry.ex:317-328`). Rename `agent` → `call`, `seq` → per-call sequence.
- **Two-topic PubSub split** — a global list topic and a per-entity detail topic, with subscribe/unsubscribe driven by the URL param (`dashboard_live.ex:233-245`). For calls: `"sagents:calls"` and `"sagents:call:#{call_id}"`.
- **Selection-as-URL-param** with `patch` links, base64url-encoded ids, and the decode→lookup→nil-if-missing guard (`dashboard_live.ex:41-51`, `helpers.ex:89-103`). Use it even if call ids are already URL-safe — it keeps bookmarks honest.
- **`limit + 1` paging** and full refetch on "load more" (`dashboard_live.ex:208-215`).
- **`TraceReducer` shape** — an incremental struct with `push/2` + `items/1`, hidden event types, a small pending state machine, and placeholder-based grouping. The *pairing rules* are Legion-specific (`eval_and_continue`/`eval_and_complete`/`return`/`done`), but the skeleton maps cleanly onto a call timeline (leg start/answer/hangup, DTMF, transfer, STT partial→final, LLM turn→TTS).
- **`UsageAggregator`** — pure, string-keyed, nil-vs-zero cost distinction, `format_tokens/format_cost`. Drop in unchanged.
- **`Markup`** — especially `escape_raw_html/1`. If you render any model output as markdown, take this.
- **`Assets` + `Layouts.asset_path`** — only if you ship the dashboard as a library. Inside an existing app, use the host's `Plug.Static` and skip all of `assets.ex`.
- **`HumanHandler`'s shape** — `{request, ref, from_pid, …}` → monitor → broadcast → `respond/2` sends `{:response, ref, text}` back → `:not_found` sentinel that lets the caller fall back. This is a good pattern for "barge-in" / supervisor-injects-text-into-a-live-call.
- The **testing style**: call LiveView callbacks directly on a disconnected socket, seed ETS, assert assigns. Fast and no `LiveViewTest` DOM brittleness (though you lose coverage of `render/1` and hooks).

**Legion-coupled, needs replacing:**
- Every `[:legion, …]` telemetry event name and its meta shape (`telemetry.ex:157-248`). Map Sagents' own events to the same `{status_change | event}` internal messages and nothing downstream changes.
- `Legion.running?/1`, `Legion.cast/2`, `Legion.lookup/1`, `Legion.AgentPrompt.system_prompt/2`, `Legion.Executor.default_config()`, `Vault.unsafe_put/2` (`dashboard_live.ex:143-149, 258-277`). The whole system-prompt modal is Legion-only; for calls, substitute a "call metadata / SIP headers / prompt config" panel.
- `Legion.Store.Payload` and `ratelimit_metadata` in `postgres.ex`.
- The sub-agent parent-forwarding + `agent_id != data.agent_id` heuristic (`telemetry.ex:374-382`, `trace_reducer.ex:223-227`). For calls the analogue is legs of a conference or a warm transfer, and you'd likely carry an explicit `parent_call_id` on the event rather than infer it.
- `extract_human_question/1`'s regex over generated code (`trace.ex:283`) — pure Legion.

**Gotchas found in the code:**
1. **Agent-table cap is not enforced under concurrency** — `evict_if_over_limit/0` removes at most one *finished* agent per start, and running agents are never evictable (`telemetry.ex:330-346`). With >100 concurrent live calls the table grows without bound. Calls are longer-lived than agent turns, so this *will* bite; evict in a loop and/or add a time-based sweep.
2. **Quadratic usage broadcast** — every `llm_stop` rebroadcasts the whole usage list (`telemetry.ex:302-310`, flagged in-source). Broadcast deltas.
3. **Usage ordering race** — mitigated but not solved by the `length >= length` check (`dashboard_live.ex:119-127`). A monotonic version/seq on the snapshot would be strictly better than comparing list lengths.
4. **`{:new_event, event}` is not agent-checked** in `handle_info` (`dashboard_live.ex:130-133`). Between `unsubscribe` and the next `subscribe`, an in-flight message from the *old* topic can still be in the mailbox and will be pushed into the *new* agent's reducer. Cheap fix: match `event.agent_id == socket.assigns.selected_agent_id`.
5. **Global `seq` counter** (`telemetry.ex:77`) — fine for ordering, but it makes per-agent seqs sparse and it resets to 0 if the tracker restarts, which can make new events sort *before* surviving ETS rows (the ETS tables are owned by the GenServer, so they actually die with it — meaning a tracker crash silently wipes all history; the supervisor restarts it empty).
6. **`inspect(agent_id)` in topic names** (`telemetry.ex:361`, `helpers.ex:87`) — works, but bakes Elixir term syntax into a topic string; two different terms that inspect identically would collide. Use the encoded id.
7. **Events cap of 500 with a global counter** means a busy agent silently loses its head; the trace then starts mid-conversation and the reducer's pairing can open on an unmatched `eval_stop`. It handles that (`trace_reducer.ex:79-83`) but the UI shows a truncated story with no marker.
8. **Postgres tracker serialises all reads through one GenServer** and only broadcasts events for agents someone has already opened (`postgres.ex:144-150`) — a dashboard opened *after* a call starts sees history on first load but the cursor is only seeded then, so nothing is lost; a second viewer opening the same agent resets the cursor to the full length, which is idempotent. Still, `list_agents` on every load_more hits the DB synchronously through one process.
9. **`pid: self()` in the started handler** (`telemetry.ex:163`) records the emitting process, which is only the agent if Legion emits from the agent process. Verify the equivalent for Sagents before relying on the pid for `cast`/liveness.
10. `render_system_prompt/2` writes into the LiveView process dictionary via `Vault.unsafe_put` (`dashboard_live.ex:263-265`) — acknowledged in a comment as a hack; don't replicate.
