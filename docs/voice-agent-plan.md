# Voice agent plan

Written 2026-09-14. The goal, stated by the product owner: this app replaces
Wonderful's voice agents for us. Wonderful is the benchmark, not a feature
list to copy: what we measure ourselves against is its KPIs. Time to first
audio after the callee speaks, turn latency, calls that complete without a
dropped leg, concurrent calls per node, languages handled, and cost per
minute. Our first target is narrower and is the order of work below:

1. **Outbound only.** The bot places calls through `2safenet.voipappz.io`.
   Inbound answering is explicitly out of scope for now.
2. **A call is a tab.** Placing a call opens it in the UI, and the transcript
   runs live while the call is up.
3. **Many calls at once.** Like a call-center floor, not a softphone.
4. **The bot defines the call.** Greeting, language and voice come from the
   published bot version, so two bots on two calls sound different.

Everything below was read from the code on the date above, not from memory.
File references are the place to start, not an exhaustive list.

## The UX we aim at

The owner's reference is xAI's Grok Voice Agent Builder (x.ai/voice, beta
since 2026-07). Its console is one flow: create an agent, describe how the
call should go in plain language, attach documents, tools and guardrails,
pick a voice and a phone number, talk to the agent in the browser to test
it, then read call logs with recordings, transcripts and traces. Under it
is one speech-to-speech WebSocket API with sub-second turnaround.

Mapped onto this app:

| Grok console | Ours | State |
|---|---|---|
| Create agent, describe the call | Bot + BotVersion (instructions area) | Model exists, API only, no Studio UI |
| Documents, tools, guardrails | Skills catalog, knowledge and safety areas | Model exists, partly wired |
| Voice, language, greeting | BotVersion `voice` area | Exists, never read (phase 3) |
| Phone number | The SIP account (one, 2safenet) | Works; per-bot caller id later |
| Talk to your agent in the browser | `/voice` (pipecat client) | Works; not linked from the bot |
| Call logs: transcript, trace, recording | Conversations with `source: "call"`, Sagents debugger; no recording | Transcript works; calls list is phase 2 |

So "be like Grok" is, in order: the live call view (phase 1), the calls list
(phase 2), the bot defining its voice (phase 3), then a Bot Studio that puts
create-describe-test-publish on one page (phase 4, the biggest gap).

## What exists

The voice bot already talks. The last live calls were 2026-09-06 (four calls
to 0545234585 from extension 303; see the commits of that day).

| Piece | Where | State |
|---|---|---|
| SIP user agent: register, dial, digest auth, ACK/BYE with route set, 60 s re-register, address rebind | `connectix/lib/connectix/web_rtc/sip_bridge.ex`, `transport.ex` | Works. One named process, one dialog. |
| Bot on the call: G.711 ↔ PCM, 20 ms pacing, barge-in flush | `connectix/lib/connectix/voice/sip_call_bridge.ex`, `alaw.ex`, `sip_audio_sink.ex` | Works. Registers under the fixed key `:bridge`. |
| Pipeline: VAD → Deepgram STT → Sagents → Cartesia TTS, 8 kHz on SIP | `connectix/lib/connectix/voice/feline_pipeline.ex` | Works. No per-bot options passed. |
| The seam into the agent runtime: turns, streaming, thinking never spoken, spoken failure | `connectix/lib/connectix/voice/sagents_bridge.ex` | Works. Swallows final transcriptions; ignores interim ones. |
| A call is a conversation (`source: "call"`, dialed/answered/ended stamps) | `connectix/lib/connectix/voice/call_record.ex` | Works. Nothing in the UI shows `source`. |
| Browser voice (pipecat client) | `/voice`, `ConnectixWeb.Endpoint.voice_ws/2` | Works. |
| Bot version voice area: enabled, locale, voice_profile, greeting, max_call_seconds | `connectix/lib/connectix/bots/version/voice.ex` | Exists, validated, **never read**. Not carried into `CompiledSpec`. |
| Phone panel: dial pad, "Call with bot", hang up, status line | `connectix/lib/connectix_web/components/chat_components.ex` (`phone_panel/1`) | Works for one call. |

The SIP account for 2safenet (`CONNECTIX_SIP_USER=303`, `_PASS`,
`_DOMAIN=2safenet.voipappz.io`) and the Deepgram and Cartesia keys are in the
untracked `.env.bak.pre-local-node`, not in the live `.env`. The parrot patch
that routes `audio_source: :bot` to `Connectix.BotMediaPipeline` names modules
that never existed in this repo; ignore it.

## Gaps, verified in code

- **No call tab.** "Call with bot" flips the panel status only. The call-state
  broadcast (`SipBridge.emit/2`) carries no conversation id, and
  `Conversations.create_conversation/2` broadcasts nothing, so the new "Call
  0545…" conversation does not even enter the sidebar list until it is
  reopened. The main pane shows exactly one conversation; there are no tabs.
- **Live transcript is half there.** Bot deltas stream to an open ChatLive.
  Caller turns arrive live too, via `{:display_message_saved, _}` from
  `Sagents.AgentServer.add_message`, but only for `handler: :bot`.
  `Conversations.append_user_message/4` (the human-takeover path) does not
  broadcast. Interim (mid-sentence) transcriptions exist as
  `InterimTranscriptionFrame` from Deepgram (`interim_results: true` is on)
  but nothing surfaces them.
- **One call at a time.** `SipBridge` holds registration and the dialog in
  one struct; `dispatch/4` matches responses by CSeq method only; the media
  pipeline looks up the fixed `:bridge` key; `SipHandler.handle_bye/2` relays
  to the singleton by name.
- **The bot does not define the call.** Greeting is `CONNECTIX_VOICE_GREETING`.
  Feline's Deepgram service has no `language` option and Cartesia is given no
  `voice_id`. Nothing enforces `max_call_seconds`.
- **No Studio.** Bot versions are edited only through `PATCH /api/bots/:id`;
  the `voice` area is untyped in the OpenAPI schema.
- **Hebrew is unverified.** Deepgram `nova-2` and Cartesia `sonic-2` are the
  wired providers. Whether they transcribe and speak Hebrew well enough is a
  measurement, not a fact we have. Wonderful's whole pitch is non-English.

## Phase 0: reconnect (hours)

Copy the five variables from `.env.bak.pre-local-node` into `.env`, `make dev`,
register from the panel, place one bot call to a known number. Read the
`[call]` log lines: `inbound audio reaching the bot`, `bot pipeline up`. This is
the regression baseline for everything after it. Do not proceed on a machine
that cannot complete one call.

## Phase 1: the call tab, live (days)

Single call still. The UI state is shaped per call id from the start (a
`calls` map, hang-up carrying `call_id`) so phase 2 changes the SIP side
only; the phase-1 SIP process itself is what phase 2 replaces.

1. **Every call event names its call.** `SipBridge.emit/2` payloads gain
   `call_id` and `conversation_id`, plus `"call_uuid"` so
   `Connectix.Events.timeline/1` can group a call's SIP events (today they
   store with a hashed sid and a nil label).
2. **Placing a call opens it.** In `ChatLive`, `{:webrtc_phone, :calling,
   %{conversation_id: id}}` does `push_patch` to `?conversation_id=id` and
   `stream_insert`s the conversation into the list. Reuse `load_conversation/2`
   and `update_conversation_selection/3` as they are.
3. **A call header.** When `@conversation.source == "call"`, render a header
   above the messages: callee (`metadata["callee"]`), state from the SIP event,
   elapsed time counted client-side from `answered_at` (a small hook, no
   server ticks), a hang-up button wired to the existing `phone_hangup`, and
   on `ended_at` the outcome and reason. Put the source badge on sidebar rows
   while there.
4. **Interim transcript line.** `SagentsBridge` handles
   `InterimTranscriptionFrame` by broadcasting
   `{:conversation, {:interim_transcript, text}}` on `Conversations.topic/1`
   (ChatLive already subscribes to it) and clears it on commit. Rendered as
   one grey line under the last message. Final text arrives as a normal user
   message and needs no new path.
5. **Takeover path broadcasts.** `Conversations.append_user_message/4`
   broadcasts `{:display_message_saved, _}` like `post_assistant/5` does, so a
   human holding the call still sees the caller's words.

Tests: `sip_bridge_test.exs` asserts payload shape; `sagents_bridge_test.exs`
gets an interim case (same direct-callback style, `TestTurns` fake); a ChatLive
test drives `{:webrtc_phone, :calling, _}` and asserts the patch and the
header. Verify by hand with a real call from phase 0.

## Phase 2: many calls at once, seen live (a week or so)

The SIP side is the only thing that is single-call. Feline, Sagents and the
conversation model already are per call. The shape of the view is the one
LegionWeb uses (list of live sessions with status dots, selected session's
transcript on the right; see `legion-web-digest.md`), but every piece of it
is built from what this app already has, not from theirs:

- **A call is a conversation, and there is no CDR store** (the rule in
  `call_record.ex`). So there is no separate call tracker table. The live
  calls list is `Conversations.list_conversations/2` filtered to
  `source: "call"` with no `ended_at`, and a call's status comes from its
  metadata stamps (`dialed_at`, `answered_at`, `ended_at`) plus whether its
  call process is alive in the registry. The only new read is that filter.
- **The per-call topic already exists**: `Conversations.topic/1`
  (`"conversation:<id>"`), which ChatLive already subscribes to. Call-state
  events are broadcast there, alongside the interim transcript. The one new
  topic is a list topic, `"calls"`, for "a call started or ended".
- **Takeover already exists**: the `take_over` and hand-back events,
  `Conversations.set_handler/3`, and the `handler_changed` broadcast. The
  calls view reuses them; nothing like LegionWeb's human handler is needed.
- **The layout already exists**: the rail, one left panel (Tasks, Files, or
  Thread History), the main pane, the phone drawer. Live calls become a
  fourth left panel, "Calls", not a separate LiveView; selecting one loads
  its conversation in the main pane through `load_conversation/2`, and the
  phase-1 call header renders on top.
- **The agent trace already exists**: the Sagents live debugger under the
  dev routes. The call header links to it.
- **Tests follow this repo**: `Phoenix.LiveViewTest` with `live(conn,
  ~p"/chat")` as in `chat_live_shell_test.exs`, not LegionWeb's
  direct-callback style.

1. **Split the SIP process.** `Connectix.Voice.SipAccount` keeps the
   registration-level fields (credentials, `reg_*`, `registered?`,
   `local_ip/port`) and the re-register timer. `Connectix.Voice.SipCall` is one
   process per dialog holding today's call-level fields (`call_id`,
   `remote_target`, `route_set`, tags, `media_session`, `invite_*`, `cseq`,
   `scope`, `conversation_id`, `bridge_pid`, `status`), started under a
   `DynamicSupervisor` and registered in `Connectix.Voice.CallRegistry` by
   SIP Call-ID. Responses already reach the process that sent the request:
   `SipBridge` passes `UAC.request/2` a callback closing over `self()`
   (lines ~475, ~512), so a per-call process gets its own replies with no
   dep change. `dispatch/4` moves across with its tests; `sip_bridge_test.exs`
   keeps its style, driving `SipCall.dispatch/4` with literal state.
2. **Call events go to the conversation.** `emit/3` broadcasts each call
   event on `Conversations.topic(conversation_id)` as
   `{:conversation, {:call, event, payload}}`, and start/end on `"calls"`.
   The legacy `"webrtc_phone"` topic stays for the phone panel's
   registration state only.
3. **Per-call media key.** `WebRtcMediaPipeline` derives its registry key from
   the `session_id` parrot already passes (`"webrtc-uac-<call_id>"`) and falls
   back to `:bridge` for the browser softphone. `SipCallBridge.start_link`
   takes that key (the option exists, it is just never passed).
4. **Inbound BYE finds its call.** `SipHandler.handle_bye/2` looks the Call-ID
   up in the registry instead of naming the singleton. `Transport` today
   re-registers only the singleton after a rebind (`transport.ex:162`); it
   must notify every live call, which then fails the way a media EXIT does
   today.
5. **The Calls panel.** A left panel listing live calls: status dot, callee,
   elapsed time, the bot's name; per-row hang-up (`SipCall.hangup/1`). It
   subscribes to `"calls"` and refreshes the list; the selected call's
   transcript, interim line, header and takeover are the phase-1 pieces
   unchanged. The phone panel dials from where it is today; the
   concurrency cap comes from the bot version's `limits` area, enforced
   when dialing.

Two LegionWeb gotchas still apply and are designed out: the main pane
checks an event's conversation id before applying it (a message in flight
during a subscription swap must not land in the wrong call), and the calls
list is re-read from the store on each change rather than patched from
event payloads, so it cannot drift.

Verify: two bot calls to two phones at once, both transcripts live, hang up
one from the Calls panel, the other continues, BYE from the far end ends
only its call, a crashed call process shows as ended within a second.

## Phase 3: the bot defines the call (days, plus a provider spike)

1. `Connectix.Bots.Compiler` carries `voice` into `CompiledSpec` (and
   `redacted/1`, and the preflight schema in `api/schemas.ex`).
2. `Connectix.Bots.Validator` adds a cross-area rule next to
   `handoff_consistent/2`: voice enabled requires a greeting.
3. `FelinePipeline.processors/3` takes the spec's voice: greeting (fallback to
   the env value), `voice_profile` → Cartesia `voice_id`, `locale` → Deepgram
   `language`. Feline's Deepgram service has no `language` option; add it in
   our fork of Feline (it is a pinned GitHub dep) and send it upstream.
4. `max_call_seconds` arms a timer in `SipCall` on answer; it hangs up and
   records `ended_reason: "max_call_seconds"`.
5. `Bots.default_definition/0` gets a `voice` map with `enabled: true` and the
   current default greeting, so the default bot keeps working.
6. **Hebrew spike.** Place a Hebrew call with `locale: "he"` and judge the
   transcript and the voice by ear. If either provider falls short, the fix is
   a new Feline service module for a provider that does Hebrew well; the
   pipeline is a list, so swapping one stage is contained. Decide providers on
   evidence from that call, not from vendor language lists.

## Phase 4: what "replace Wonderful" adds after that

Not planned in detail yet, listed so the order above is not mistaken for the
whole product.

- A Studio voice section. There is no bot-editing LiveView at all today, so
  this is a bot editor first, voice tab second.
- Call list and outcomes: filter conversations by source, duration and end
  reason per call, `call_uuid` telemetry per call in `/metrics`.
- Campaign dialing: a list of numbers, a bot, a concurrency cap, retry rules.
- Handoff to a human agent mid-call (the `handler: :human` seam exists; the
  audio transfer does not).
- Inbound answering, which Wonderful's customers use most. Deliberately last.
- Recording and retention policy for audio, which the bot version's
  questionnaire already names.

## Grok: through OpenRouter, as a model

Decided 2026-09-14. Grok is used the way every other model is: named in
`CONNECTIX_MODEL` or a bot version's `model` through OpenRouter
(`x-ai/grok-4` and siblings), with no code change. xAI's speech-to-speech
realtime API (one WebSocket, A-law at 8 kHz accepted directly) was read and
is not planned: it would make Grok the brain on the call instead of Sagents.
The read is kept here in case latency later forces the question.

## Decided 2026-09-14: Legion is not a replacement for Sagents

Legion (Software Mansion's agent runtime, agents write Lua that runs in a
sandbox instead of a tool-calling loop) was evaluated against Sagents by
reading both, with a second read by Codex. Same conclusion from both:

- For a phone turn it is not faster. A plain answer is one model request
  either way, and here the model's output streams straight into speech.
  A data turn costs Legion a code-writing request and then usually a second
  request to interpret the result; it wins only when several deterministic
  steps can be composed into one snippet, which this app already covers by
  exposing a workflow as one tool.
- It lacks what the product is built on: the automatic approval gate on
  classified tools, source-routed channels, immutable pinned bot versions,
  and persistence without Postgres (its bundled store needs an Ecto repo;
  ours is Mnesia).
- Two runtimes would mean two owners of history, cancellation and events.
  The voice bridge depends on Sagents' run boundaries for barge-in.

Decided 2026-09-14: learned, nothing ported wholesale. One piece is worth
taking on its own, the **Lua sandbox** (`lib/legion/sandbox/lua.ex`, ~300
lines over the `lua` hex package, a Lua 5.3 VM in pure Elixir, MIT): as a
`lua_sandbox` skill in our catalog whose one capability, `run_lua(code)`,
runs a model-written chunk with a timeout and heap cap and with the bot's
*read-only* capabilities bridged in as Lua tables. A turn needing several
lookups becomes one tool call. Gated capabilities are never bridged: a call
from inside the VM would bypass the approval gate, so anything needing
approval stays a direct tool. Sagents remains the runtime. Scheduled after
phase 3. Three more of its ideas are noted for when the need arises, not
scheduled: a rate-limit policy shape
(identity, window, concurrent calls and token budget); its telemetry
vocabulary (turn, iteration, LLM request, tool execution) with ids attached;
conversation-scoped derived state kept out of authorization.

## Open decisions

- Which providers carry Hebrew. Answered by the phase 3 spike.
- Whether the browser softphone keeps the `:bridge` key or also moves to
  per-call keys. Keeping it is less work and it is one operator by design.
