This is a web application written using the Phoenix web framework.

The purpose of the project is to be a full and developed example for building
a complex custom-Bot product. It uses Sagents as the agent/session runtime on
top of the Elixir LangChain library. The `connectix` application shows how
to apply that stack correctly across Bot authoring, conversations, tools,
approvals, channels, persistence, and eventually realtime voice.

This project has zero users. We are building a recommended-use pattern for others to follow. Do not use "backward compatible" solutions. Do not create "migration guides" for changes. Create it correctly in this project. Solutions that should be part of the core library should be pushed down to that level. This project shows how to correctly use the library in a recommended way.

A refactor or feature creation is not complete until the tests are run and pass.

## Project guidelines

- Use `mix precommit` alias when you are done with all changes and fix any pending issues
- Use the already included and available `:req` (`Req`) library for HTTP requests, **avoid** `:httpoison`, `:tesla`, and `:httpc`. Req is included by default and is the preferred HTTP client for Phoenix apps

## Running it

Everything goes through the `Makefile` — `make help` lists the targets and prints
the ports in effect.

| Command | Does |
|---|---|
| `make setup` | first run: deps, database, assets |
| `make dev` | `mix phx.server` |
| `make test` | the suite |
| `make precommit` | everything CI checks, plus the tests |
| `make act` | runs the GitHub Actions job locally |
| `make tunnel` / `make tunnel-url` | public HTTPS tunnel for webhooks |

There is no database server: Mnesia is in the BEAM and the event store is a
DuckDB file, both under `CONNECTIX_DATA_DIR`. `.env` is the whole story: Dotenvy loads
it at the top of `config/runtime.exs`, and everything environment-dependent is
configured there, so a value never has to be exported before `mix` starts.

Elixir is pinned in `.tool-versions`; 1.19+ is required by `:anu`.

## Configuration

Configuration is environment variables, and `Connectix.Config` is the one place
application code reads them. Two rules follow:

- **application code calls that module**, never `System.get_env/1` directly;
- **`config/*.exs` holds no deployment values** — it wires libraries whose
  configuration has to *be* application config (Ecto, the Endpoint,
  `:langchain`, `:anu`, `:sagents`) and reads the same variable names.

The accessor is the documentation: each one names its variable, its default, and
what happens when it is missing. `.envrc.example` lists every one.
`Connectix.Config.summary/0` prints the resolved set with secrets reduced to
"set"/"not set", for answering "is this actually set on the box?" without
echoing a key into a log.

Three details are load-bearing:

- **Resolution happens at call time.** Changing a variable takes effect without
  a restart, tests drive settings with `System.put_env/2` and no config reload,
  and nothing is captured into a closure a release cannot serialise.
- **An unset variable and one set to `""` mean the same thing** — absent.
  Shipping tools write `FOO=` for a value they do not have, and `""` is never a
  meaningful key, model name, or path.
- **`Mix` does not exist in a release.** `Mix.env()` at runtime crashes in
  production; `Connectix.Config` reads it once at compile time instead, which
  is the only safe use.

A setting that only one call site knows about is one nobody can list, document,
or ship to a server — which is exactly how `CONNECTIX_API_KEY` came to be read
inside a plug and listed nowhere in `config/xamal.exs`.

## Channels

A channel delivers agent replies somewhere outside the app. A conversation
carries a `source` (`"chat"` for the browser, `"whatsapp"`), and the channel
claiming that source receives its messages.

Adding one is a module implementing `Connectix.Channels.Channel` plus a line in
`config :connectix, :channels`. `Connectix.Channels.deliver/2` is the single
dispatch point — resist adding per-channel calls at call sites.

Delivery hangs off `Connectix.Agents.DisplayMessagePersistence.save_message/3`.
That is the one place every message passes exactly once; hooking the streaming
path instead would send one WhatsApp message per token.

The shape is borrowed from [Papercups](https://github.com/papercups-io/papercups),
which is the most developed example of multi-channel support in Elixir. Worth
reading `lib/chat_api/twilio/` there — a whole channel in four small files:
`client.ex` (the API), `notification.ex` (message → channel),
`twilio_authorization.ex` (credentials), and a webhook controller. Three of its
ideas are reproduced here:

- **A channel only handles its own conversations.** Theirs guards on
  `%Conversation{source: "sms"}`; ours matches `source/0` against the
  conversation. The `source` column is the whole routing mechanism.
- **Fire-and-forget.** Every send is wrapped in a `Task`, so a slow or broken
  channel can never delay the reply the user is already reading.
- **Filter by pattern match, not by `if`.** Their `%Message{private: false}`
  head makes it impossible for an internal note to reach a channel. Ours does
  the same with `message_type: "assistant", status: "completed"`.

One thing deliberately *not* copied: their dispatch is a hardcoded pipe of
`notify(:slack)`, `notify(:sms)`, `notify(:gmail)`… duplicated across call sites
(`notification_channel.ex` and `message_controller.ex` both carry the full
list), so adding a channel means finding and editing every one. Hence the single
`deliver/2`.

Papercups is in maintenance mode on Phoenix 1.5 / Elixir 1.10, so it is a
reference to read, not a dependency to take.

### WhatsApp

Uses `:anu`. Credentials are env-only, never the database:

    WHATSAPP_ACCESS_TOKEN       # use a System User token — dashboard tokens expire in 24h
    WHATSAPP_PHONE_NUMBER_ID
    WHATSAPP_APP_SECRET         # signs webhooks; a wrong value fails *silently*
    WHATSAPP_VERIFY_TOKEN       # your own string, also given to Meta
    WHATSAPP_OWNER_EMAIL        # optional, see below

**The webhook is mounted in `ConnectixWeb.Endpoint`, not the router, and ahead
of `Plug.Parsers`.** Meta signs the raw request body; the parser consumes it, so
after it runs `read_body/1` returns `""` and no signature can match. Worse,
`Anu.Webhook.Plug` answers **200** on a failed check — so a webhook mounted in
the router looks healthy to Meta while dropping every message.

Secrets are read in `config/runtime.exs` via `Anu.Config`, not passed as plug
options: those are evaluated at compile time and would bake in whatever the
environment held when the router was compiled.

`Sagents.Session` requires a `current_scope`, and a scope is a user, so an
inbound sender needs one. With `WHATSAPP_OWNER_EMAIL` set, every WhatsApp thread
attaches to that account and appears in the web UI beside browser chats — one
conversation, two surfaces. Without it, each phone number gets its own
passwordless account, which is correct when senders are unrelated customers.

Channel conversations are titled at creation (`WhatsApp +<phone>`) rather than
left to title generation: a failed title call otherwise leaves a blank,
unclickable row in the conversation list.

## The API

An HTTP API so a customer can drive the agent from their own code, and
configure it without touching this one.

Swagger UI is at **`/api/docs`** (linked from the app header), the spec at
`/api/openapi`. Both are unauthenticated — they describe the API rather than
expose it, and a customer needs to read them before they have a key. The spec
is generated from the router and the controllers' `operation/1` declarations,
so it cannot drift from the routes that exist.

    CONNECTIX_API_KEY          # bearer token; the API refuses everything if unset
    CONNECTIX_API_USER_EMAIL   # requests act as this user

| | |
|---|---|
| `POST /api/conversations` | start a thread |
| `POST /api/conversations/:id/messages` | send; **202, the reply comes later** |
| `GET /api/conversations/:id/messages` | read the transcript |
| `GET POST /api/bots`, `GET PATCH DELETE /api/bots/:id` | create and modify bots |

Sending is asynchronous because a turn may call tools and take many seconds;
holding the request open would tie a socket to the length of a conversation.
Clients poll for the reply.

Auth is one shared key mapping to one user — deliberately the simple thing.
Per-customer keys with separate data would need a tenant on every row, and that
is a different design, not a bigger version of this one.

### Bots: current implementation

Phases 1 and 2 of the Bot-first design below are built: identity, immutable
versions, publication, pinning, the Skill catalog, the compiler, and a Factory
driven by the compiled version. Controls, capabilities, the flow engine and
the Studio follow.

- `Connectix.Bots.Bot` is identity only: name, slug, description, status,
  and two pointers — `current_version` (published; what new conversations
  pin) and `draft_version` (being edited, if any).
- `Connectix.Bots.BotVersion` is the whole definition: eleven typed
  embedded areas (`Connectix.Bots.Version.*`) plus `bot_version_skills`
  rows naming catalog ids. A draft is mutable; a published version is not —
  `draft_changeset/2` refuses, and a database trigger refuses too, including
  changes to a published version's skills.
- Publishing (`Bots.publish_draft/3`) validates through
  `Connectix.Bots.Validator` (one report shared with the API's preflight),
  fingerprints the canonical content (`Connectix.Bots.Snapshot`), and moves
  `current_version` in the same transaction. The previous version stays
  published (pinnable by id) until `retire_version/3`.
- `Conversations.create_conversation/2` resolves the pin
  (`Bots.resolve_pin/2`: a `bot_id`, an explicit published `bot_version_id`,
  or the owner's default) and inserts in one transaction. `bot_version_id`
  is `NOT NULL` with `on_delete: :restrict`; a later publish never moves a
  conversation. Conversations also carry `handler` (`bot` | `human`) for the
  takeover work in phase 3.
- Every account gets a published default bot from `Accounts.register_user/1`
  (`Bots.ensure_default_bot/1`, slug `default`), so there is no nil-bot
  path: the platform's own assistant is just a bot whose instructions say
  so, and the Factory reads prompt and model from the pinned version.
- API: `POST /api/bots` creates bot + draft v1; `PATCH` edits identity and
  the draft; `POST …/publish`, `…/preflight` (report + compiled spec),
  `…/draft`, `…/archive`, `…/versions`, `…/versions/:n/retire`;
  `GET /api/skills` is the catalog. `POST /api/conversations` accepts
  `bot_id` or `bot_version_id`.
- **Skills** are code in a literal registry (`Connectix.Skills`): id →
  module implementing `Connectix.Skills.Skill` with a settings schema,
  capabilities, instructions and middleware. Bot data holds only
  `{id, version, settings}`, validated at draft time. `memory_files`,
  `web_lookup` and `todo` wrap the middleware the platform assistant always
  had.
- **Capabilities** (`Connectix.Skills.Capability` +
  `Connectix.Capabilities.Capability`) carry their policy (risk, approval,
  idempotency, timeout, redaction). `to_function/1` wraps the call: typed
  arguments validated before it runs, scope/conversation taken from the
  agent's context, raises and timeouts turned into redacted tool errors.
- **Compiler** (`Connectix.Bots.Compiler` → `CompiledSpec`): pure and
  deterministic; resolves catalog ids, assembles the prompt (instructions
  first, then each Skill under `## Skill:`), removes forbidden tools,
  flattens approval into `interrupt_on`. `Bots.Runtime` caches by
  fingerprint. `FactoryRouter` does the scoped load and compile;
  `FactoryConfig` carries the spec plus request options that can only
  narrow; `Factory` builds from the spec and makes no queries.

### Bot-first product direction

The purpose of this application is to demonstrate how to build, test, publish,
run, and operate custom Bots correctly with Sagents. The Bot is the core product
concept. Sagents remains the runtime framework; channels and voice are adapters
around the same scoped conversation.

The current Bot record is only a prompt/model overlay because tools, middleware,
approval rules, memory, and limits are still hardcoded in
Connectix.Agents.Factory. New work must move those choices into a validated,
versioned Bot specification rather than adding more conditionals to the
factory.

The central distinction is:

    Bot          = stable product identity
    BotVersion   = immutable executable specification
    Conversation = durable interaction pinned to one BotVersion
    AgentServer  = temporary Sagents runtime for one conversation

Do not make a Bot a singleton GenServer shared by many conversations. That
would mix user state and make restarts, authorization, versioning, and replay
ambiguous. The live process remains conversation-scoped.

#### Product vocabulary

- A **Bot** is the user-visible identity: name, description, lifecycle state,
  and currently published version.
- A **BotVersion** is the complete, immutable definition used to compile an
  agent: instructions, model settings, Skills, capabilities, controls,
  knowledge, memory, output, handoff, voice, and operational limits.
- A **Skill** is a curated, reusable behavior bundle selected by a BotVersion.
  It may contribute approved capabilities, explicit instructions, validated
  settings, policy defaults, and evaluation cases.
- A **Capability** is one code-owned operation available to the model. It is
  normally implemented by one Sagents/LangChain tool or by one deterministic
  workflow exposed as a single tool.
- A **Workflow** is application-owned deterministic business logic. The model
  may choose the workflow but must not improvise its internal transaction
  sequence.
- A **Control** is deterministic policy code that can allow, deny, redact,
  pause for approval, or constrain an operation. Asking the model to remember
  a policy is not a control.
- A **Channel** delivers completed messages to an external asynchronous
  surface, such as WhatsApp.
- A **Realtime adapter** carries an active bidirectional stream, such as a
  Feline voice connection. It is not a completed-message Channel.

Product Skills are runtime Bot capabilities. Project-local Codex skills under
.agents/skills are development instructions for contributors. Keep these two
concepts separate.

#### Canonical domain model

**Bot**

- belongs to the authenticated owner and is always queried through
  current_scope;
- contains stable identity fields such as name, slug, description, and status;
- points to the current published BotVersion and, when useful, the current
  draft;
- may be active or archived; archiving prevents new conversations but never
  rewrites existing ones;
- does not contain model clients, credentials, tool modules, PIDs, or mutable
  conversation state.

**BotVersion**

- belongs to one Bot and has a monotonically increasing version number;
- has an explicit lifecycle such as draft, published, or retired;
- is mutable only while it is a draft and immutable after publication;
- contains the complete author intent and all settings required to reproduce
  the compiled agent;
- records a configuration fingerprint/checksum for inspection and audit;
- contains references to versioned Skills and capability settings by stable
  identifiers, never arbitrary Elixir module names;
- records publication metadata, including when and by whom it was published.

A BotVersion must cover these bounded configuration areas:

- behavior: complete instructions, purpose, audience, supported languages, and
  response style;
- model: provider/model reference and validated generation settings;
- Skills and capabilities: versioned catalog IDs plus validated per-Skill
  settings;
- safety: input, pre-operation, and output controls; data classifications;
  approval rules; authorization requirements; and retry/idempotency policy;
- knowledge: approved source bindings, grounding/citation behavior, freshness,
  and unavailable-source behavior;
- memory: enabled stores, scope, retention, and what may be recalled;
- output: text or structured schema, formatting requirements, and channel
  adaptations;
- handoff: triggers, destination, context transferred, and whether the Bot
  stands down;
- voice: voice profile and voice-session behavior, never provider secrets;
- limits: turn timeout, tool-call count, token/cost budget, delegation depth,
  concurrency, and maximum session duration.

Security-relevant or queryable configuration should use typed schemas and
relational records. JSON/map fields are acceptable only for bounded settings
that have a schema and are fully validated before publication. Do not turn the
BotVersion into an unvalidated settings blob.

**Conversation**

- belongs to the authenticated owner;
- pins exactly one published BotVersion when it is created;
- never silently moves to a newer version;
- keeps source, handler/handoff state, and durable messages separately from the
  Bot definition;
- may be resumed by reconstructing the same versioned agent configuration.

A new account should receive an explicit default Bot and published version
through application context code. Do not use a hidden nil Bot fallback as the
long-term product model. Every conversation should exercise the same
BotVersion compilation path.

Disabling or archiving a Bot must not silently replace it with the factory
default. It prevents new conversations while existing pinned conversations
remain reproducible.

#### Version lifecycle

The lifecycle must be:

    Create Bot
      -> create draft v1
      -> configure and validate
      -> run preflight and evaluation scenarios
      -> publish immutable v1
      -> new conversations pin v1
      -> editing creates draft v2
      -> publish v2
      -> only new conversations pin v2

Rules:

- A published version is never patched in place.
- Updating a Bot means editing or creating a draft, not modifying the version
  used by active conversations.
- Publishing must be transactional: the version becomes immutable and the
  Bot's current_version_id changes together.
- Conversation creation resolves current_version_id and stores the selected
  bot_version_id in the same transaction.
- API callers may request an explicit published version for reproducible
  integrations, subject to scope and status checks.
- Published versions referenced by conversations are retired or archived, not
  deleted.
- Deleting is reserved for unused drafts or a Bot with no published/runtime
  history.
- A custom Bot's instructions replace the generic default instructions.
  Explicitly selected Skill instructions may be composed in a deterministic,
  documented order and must be visible in the compiled prompt preview.
- Authorization and safety never depend on instructions or hidden prompt
  prefixes; they are enforced in controls and tools.

#### Runtime compilation and Sagents boundary

Use this flow:

    Conversation
      -> scoped FactoryRouter loads Conversation + pinned BotVersion
      -> BotCompiler validates and resolves trusted catalog references
      -> typed FactoryConfig
      -> Sagents Factory constructs model, tools, middleware, controls
      -> conversation-scoped AgentServer

The responsibilities are:

- FactoryRouter performs the scoped database load and chooses a factory only
  when fundamentally different runtime architectures exist.
- BotCompiler is deterministic and side-effect free. It turns a BotVersion
  into a fully resolved, inspectable runtime specification.
- FactoryConfig is typed and already contains the resolved specification.
- Factory consumes FactoryConfig and does not make hidden Bot database queries.
- Sagents Session and AgentServer own live conversation execution, resume,
  streaming, middleware, and tool calls.
- current_scope is the identity and tenancy boundary. Never put identity,
  tenant, roles, or authorization state only in tool_context.
- tool_context contains non-authoritative caller context. Mutable runtime data
  belongs in agent state/metadata as prescribed by Sagents.

Prefer one generic configurable Bot factory. Add specialized factories only
when the execution architecture is genuinely different, not merely because a
Bot has a different prompt, model, Skill, or policy.

Request options may narrow behavior, such as timezone or presentation
preferences, but may never expand the persisted capabilities or weaken the
BotVersion's controls.

#### Skills and capability catalog

Bots select Skills from a trusted application-owned catalog. A Skill entry
should define:

- stable ID, semantic version, display name, and description;
- the capabilities it exposes;
- validated configuration schema and safe defaults;
- explicit prompt/instruction contribution, if any;
- required roles and data classifications;
- operation risk: read, write, external communication, destructive, financial,
  or irreversible;
- default approval and idempotency policy;
- timeout, retry, and concurrency constraints;
- deterministic tests and evaluation scenarios.

Bot records store Skill ID, Skill version, and validated settings. A trusted
registry maps those IDs to code. Never call String.to_atom/1, Module.concat/1,
or otherwise resolve customer-supplied module names.

Prefer high-level Skills and narrow capability facades. For example, expose
customer_lookup rather than an entire Repo module, and expose process_refund as
one deterministic workflow rather than low-level debit, credit, email, and
ledger tools the model must sequence itself.

Every capability must:

- receive and enforce current_scope;
- perform its own object-level authorization;
- validate typed arguments and return typed, bounded results;
- declare risk, approval, idempotency, timeout, and retry behavior;
- redact secrets and sensitive values from prompts, results, errors, and logs;
- emit an auditable intent before an external write and an outcome afterward;
- fail closed when policy evaluation fails;
- never expose provider credentials to the model.

Human approval must be an automatic gate around a classified operation. A
model-facing ask_human tool can clarify intent but cannot enforce approval,
because the model may omit it.

Write and external-effect capabilities must use stable idempotency keys derived
from the conversation, turn, and tool call. Persistence and process recovery do
not guarantee exactly-once external effects by themselves.

Sub-Bot delegation is a capability. It requires an explicit allowlist of
published BotVersions plus depth, fan-out, concurrency, time, and token limits.
All child work carries the same scope, has parent/child trace lineage, and may
not acquire capabilities the parent was not permitted to delegate.

#### Requirements captured by the Bot onboarding questionnaire

The product questionnaire is the input to the design, but its answers belong to
separate typed areas rather than one prompt or one database column.

**Behavior and users**

- purpose, services, target audience, and supported user types;
- three representative end-to-end conversations;
- at least three edge cases and expected outcomes;
- languages, tone, accessibility, and public versus private access.

**Identity, authorization, and safety**

- authentication method, session timeout, roles, and authorization source;
- actions allowed autonomously, actions requiring user confirmation,
  supervisor approval, or a second person, and actions always forbidden;
- sensitive data the Bot may collect, display, store, or transmit;
- applicable regulatory and organizational requirements.

**Operations and integrations**

- required read operations and write operations;
- existing systems, documented APIs, database/core/payment integrations, and
  behavior when an external dependency is unavailable or returns an error;
- idempotency, reconciliation, and explicit confirmation for material actions.

**Knowledge and trust**

- approved sources of truth, whether an answer must be grounded, and whether
  the model may answer from general knowledge;
- document ownership, indexing/update frequency, citations, confidence
  behavior, and escalation when no reliable answer exists;
- mechanisms preventing unsupported claims and acting on uncertain facts.

**Channels and handoff**

- browser, WhatsApp, HTTP API, voice, and future surfaces;
- whether several channels attach to the same conversation;
- human handoff conditions, destination system, history/context transferred,
  ownership/handler state, and echo prevention.

**Operations and governance**

- encryption, transcript/audio retention, audit log visibility, and deletion;
- expected concurrency, response/voice latency, availability, monitoring,
  alerting, cost limits, and incident behavior.

The creation wizard may progressively ask these questions, but publication must
block when a required safety or operational answer is missing for the selected
capabilities.

#### Bot Studio UX

The UI should be a Bot Studio, not a generic CRUD form.

    +------------------------------------------------------------------+
    | Customer Support Bot        Draft v3       Test       Publish    |
    +-------------------+-----------------------------+----------------+
    | Overview          | Configuration               | Live preview   |
    | Instructions      |                             |                |
    | Skills            | Name, purpose, model,       | Conversation   |
    | Knowledge         | instructions, policies...   | Tool activity  |
    | Safety            |                             | Approvals      |
    | Channels          |                             | Trace/errors   |
    | Voice             |                             |                |
    | Handoff           |                             |                |
    | Limits            |                             |                |
    | Versions          |                             |                |
    +-------------------+-----------------------------+----------------+

Required Studio sections:

1. **Overview** — name, description, purpose, audience, languages, status, and
   current published version.
2. **Instructions** — the complete Bot instructions with clear replacement
   semantics and compiled-prompt preview.
3. **Skills** — searchable catalog with capability, risk, required role, and
   approval badges plus validated settings.
4. **Knowledge** — approved sources, grounding policy, freshness, citations,
   and unavailable-source behavior.
5. **Safety and approvals** — role rules, sensitive-data controls,
   confirmations, supervisor/two-person approvals, and forbidden actions.
6. **Channels** — browser, WhatsApp, API, and future completed-message
   bindings.
7. **Voice** — enabled state, language, voice profile, greeting, VAD/turn
   behavior, barge-in, call limits, and transcript/audio retention.
8. **Human handoff** — triggers, destination, transferred context, handler
   state, and return-to-Bot behavior.
9. **Limits** — turn/tool/token/cost/delegation/concurrency/time limits and
   dependency failure behavior.
10. **Versions** — draft/published history, configuration diff, author,
    timestamp, test evidence, and conversations using each version.

The right-hand preview must use the same BotCompiler, Factory, controls, and
tool implementations as production. It must show:

- user and assistant messages;
- tool calls and bounded results;
- approvals, edits, rejects, and resumptions;
- knowledge sources/citations;
- compiled prompt and resolved Skill/capability list without secrets;
- latency, token/cost use, errors, and terminal status.

The publish flow is:

    Save draft
      -> schema validation
      -> capability/policy preflight
      -> required scenario/evaluation suite
      -> inspect compiled diff
      -> explicit publish confirmation
      -> immutable published version

Never let a polished test preview bypass production authorization or replace
deterministic fake-provider tests.

The Bots index should show name, lifecycle state, current version, model,
enabled Skills, active channels, conversation count, and whether a draft is
waiting. Existing conversations must display the exact Bot and version that
answered them.

The LiveView Studio belongs inside the existing authenticated
live_session :require_authenticated_user and the
[:browser, :require_authenticated_user] pipeline because Bot configuration,
tests, versions, capabilities, and conversations are owner-scoped. Always pass
current_scope into the Bots context. The public API documentation remains
unauthenticated, but all Bot API operations remain bearer-authenticated and
scope-filtered.

#### Bot API target

UI and API must call the same Bots context/use cases and therefore have exactly
the same validation, authorization, versioning, and publication semantics.

The target API behavior is:

- creating a Bot also creates its first draft;
- updates apply only to a draft;
- publishing is an explicit endpoint/action, not a boolean field update;
- fetching a Bot can include current published version and current draft;
- version history and configuration diffs are readable;
- conversation creation accepts a Bot ID and atomically pins its current
  published version, or accepts an explicit published BotVersion ID;
- archive replaces deletion once a published version or conversation exists;
- preflight/test endpoints return compiled configuration and evaluation
  results with secrets redacted.

Keep OpenAPI operation declarations and schemas aligned with these semantics as
the implementation evolves.

### Voice: Feline around Sagents

[Feline](https://github.com/dimamik/feline) is the intended voice/media layer.
It must not become a second Bot or agent runtime.

The ownership rule is:

    Sagents = brain, conversation, LLM, tools, policy, memory, persistence
    Feline  = ears, turn detection, realtime media frames, and voice

Use this pipeline:

    Pipecat browser client
      -> authenticated Feline WebSocket / restricted RTVI
      -> VAD and user-turn detection
      -> speech-to-text
      -> Connectix.Voice.SagentsBridge
      -> Sagents Session / conversation AgentServer
      -> Sagents visible streaming text events
      -> SagentsBridge converts events to Feline response frames
      -> sentence aggregation
      -> text-to-speech
      -> Feline WebSocket output

Do not copy the Feline voice example literally. Its example contains its own
ContextAggregator, OpenAI LLM, context/history, anonymous function tools, and
AssistantCollector. Those overlap with Sagents and must be omitted. All model
calls, tool calls, approvals, history, memory, and durable message writes go
through Sagents.

#### SagentsBridge responsibilities

Connectix.Voice.SagentsBridge is the only boundary between voice frames and
the agent runtime. It must:

- authenticate the connection before accepting audio;
- resolve current_scope, the authorized conversation, and its pinned
  BotVersion;
- create a voice-origin conversation when necessary through the normal
  Conversations context;
- start or resume the conversation-scoped Sagents session through the normal
  coordinator;
- submit only final trusted STT transcripts as user messages, exactly once;
- subscribe to the active turn's visible streaming events;
- translate response start, text deltas, completion, error, and cancellation
  into Feline frames;
- associate every stream with a generation epoch so late deltas from a
  cancelled turn are dropped;
- unsubscribe and stop voice-specific processes on disconnect;
- leave durable conversation restoration to Sagents.

Feline voice is a realtime adapter, not an implementation of
Connectix.Channels.Channel. Channels.deliver/2 handles completed asynchronous
messages. The active voice socket consumes Sagents deltas for low latency, while
Connectix.Agents.DisplayMessagePersistence.save_message/3 remains the
exactly-once durable transcript path. Never send one channel message per token,
and never replay the final saved message back into the same active voice stream.

A conversation created through voice may record source: "voice" for ownership,
routing, and analytics, but the live authenticated socket owns audio delivery.
The browser may display the same persisted conversation.

#### Voice interruption and consistency

When the user speaks over the Bot:

- Feline must stop buffered TTS/playback immediately;
- SagentsBridge must request cancellation of the active Sagents generation;
- deltas belonging to the cancelled generation epoch must be ignored;
- a write already committed by a tool cannot be rolled back by barge-in;
- approval, idempotency, reconciliation, and audit controls remain
  authoritative;
- the display transcript must mark an interrupted assistant turn and represent
  what the user actually received;
- full generated text that was not delivered may be kept in a restricted trace
  for debugging but must not be presented as spoken conversation context.

Feline's current example cannot precisely account for the spoken prefix when an
interruption occurs. Accurate delivery accounting is a required integration
feature, not something to inherit from the example.

#### Voice configuration

Voice configuration belongs to the BotVersion as a versioned profile:

- enabled;
- supported language/locale;
- STT provider and model profile;
- TTS provider, model, and voice identifier;
- greeting and spoken-response style;
- VAD/turn thresholds and silence timeout;
- barge-in/cancellation policy;
- maximum call duration and concurrent sessions;
- transcript retention and whether raw audio may be retained;
- fallback behavior when STT or TTS is unavailable.

Provider credentials and secret values remain in runtime environment/secret
configuration. Bot data may reference an approved provider profile but may not
contain API keys, arbitrary provider base URLs, or credential material.

The voice instructions should tell the Bot that responses are spoken and should
be concise, but the same BotVersion and capability policy remain authoritative
across text and voice. Channel-specific presentation must not grant different
permissions.

#### Voice security and production gates

The Feline example is experimental and its WebSocket example is intentionally
minimal. Production integration must add:

- WSS and authentication before WebSocket upgrade, using a short-lived scoped
  token;
- Origin validation and authorization for the requested Bot and conversation;
- a restricted inbound frame allowlist;
- rejection of client-provided function/tool results, user identity, trusted
  timestamps, and server-side approval results;
- audio frame size, codec, sample-rate, channel, message-rate, connection,
  concurrency, and session-duration limits;
- heartbeat, timeout, backpressure, cancellation, and disconnect cleanup;
- consent and disclosure for STT/TTS subprocessors, residency, retention, and
  recording;
- no raw-audio retention by default;
- redaction of transcripts and voice traces according to Bot/data policy;
- telemetry for STT latency, first-token latency, first-audio latency,
  interruption, cancellation, TTS latency, errors, and cost.

Energy-threshold VAD from the demo is suitable for a quiet-room demonstration,
not a production quality claim. Keep VAD replaceable.

Before adding Feline as a dependency, verify its license, audit and pin a known
revision, and confirm dependency compatibility. The reviewed main branch is
early experimental software without a stable published release; isolate it
behind the Connectix.Voice boundary so upstream changes do not leak across the
application. Improvements that belong in a reusable voice pipeline should be
contributed to Feline rather than copied permanently into this app.

Do not start one listener/port per Bot as the example does. Run one configured,
supervised voice endpoint that resolves the authenticated BotVersion per
connection. Do not load .env inside application modules or scripts; use
config/runtime.exs and the release environment.

The browser client may use the Pipecat client packages demonstrated by Feline,
but install and import them through the existing assets/js/app.js bundle and a
LiveView hook. If the hook owns its DOM, use phx-update="ignore". Do not copy the
standalone Vite application, checked-in dist assets, external script tags, or
inline scripts.

#### Voice verification

Copy the testing strategy, not the example architecture:

- fake STT, LLM-event, and TTS providers for deterministic tests with no keys;
- the real Pipecat serialization/wire path in an end-to-end smoke test;
- authentication, Origin, scope, frame allowlist, and quota tests;
- exactly-once transcript submission and assistant persistence tests;
- streaming sentence/TTS ordering tests;
- barge-in, stale-generation, cancellation, timeout, and disconnect tests;
- proof that tools and approvals can execute only through Sagents;
- proof that an active voice stream does not also receive duplicated final
  Channel delivery;
- full make precommit after integration.

### Architectural references

These repositories are design references, not instructions to add overlapping
runtimes:

- [Jido](https://github.com/agentjido/jido) — borrow immutable state,
  explicit decision/effect boundaries, supervised runtime patterns, and
  capability bundles.
- [Jidoka](https://github.com/agentjido/jidoka) — strongest reference for an
  immutable data-first agent specification, trusted registries, preflight,
  controls, effect journals, durable approval snapshots, idempotency, and
  deterministic tests.
- [Legion](https://github.com/software-mansion-labs/legion) — borrow narrow
  tool facades, runtime-only credentials, typed results, sandbox budgets,
  checkpoint awareness, and telemetry. Do not copy its generated-code
  execution loop; sandboxing is not authorization.
- [Vibe](https://github.com/elixir-vibe/vibe) — borrow server-owned sessions,
  supervised work, semantic UI-neutral events, persistent replay, bounded
  subagents, and UI/gateway adapters around one runtime.
- [Feline examples](https://github.com/dimamik/feline/tree/main/examples) —
  borrow Pipecat compatibility, frame pipelines, per-connection isolation,
  interruption propagation, sentence-before-TTS streaming, and fake-provider
  wire tests. Use it only as the voice/media layer around Sagents.

Do not add Jido, Jidoka, Legion, or Vibe beside Sagents merely to copy a
pattern. They overlap in runtime, session, workflow, or approval
responsibilities. Express the useful patterns through Sagents, and push
generally reusable missing features down into Sagents rather than building a
second framework inside this example.

### Bot-first implementation order

Implement in dependency order:

1. Bot identity, immutable BotVersion, publication lifecycle, and conversation
   version pinning.
2. Trusted Skill/capability catalog, BotCompiler, typed FactoryConfig, scoped
   FactoryRouter loading, and version-driven Factory construction.
3. Deterministic controls, durable approval state, idempotency/effect journal,
   structured output, limits, and audit/telemetry.
4. Bot Studio overview, instructions, Skills, knowledge, safety, limits,
   versions, production-path preview, evaluation, and publication.
5. API parity with the same context/use cases and OpenAPI contracts.
6. Channel bindings and complete human handoff/handler ownership.
7. Feline voice adapter after the Sagents boundary, version pinning, controls,
   and streaming contracts are stable.

Do not start with multi-agent topology, arbitrary user-authored code, or a
large provider marketplace. Establish one safe, inspectable, versioned custom
Bot path first.

For every phase, add isolated context/unit tests, production-path integration
tests, and LiveView/API tests where relevant. A design slice is not complete
until make precommit passes.

## Deploying

`mix xamal.deploy` — bare metal over SSH (systemd + Caddy), no Docker in the
deploy path. See `config/xamal.exs`.

Two rules that config encodes: pass an optional env var only when it is actually
set, or an empty string reads as "configured, blank"; and declare an optional
secret only when present, because xamal fails the whole deploy on a
declared-but-missing one.

The deploy gate is `/health/ready`, not `/health/alive`. Alive answers 200 for
as long as the BEAM responds, so a node that booted but cannot host agents would
pass.

Every env var the app reads at runtime has to be listed in `config/xamal.exs` or
it simply is not there on the box, and the surface it configures is dead in
production while working locally. `CONNECTIX_API_KEY`,
`CONNECTIX_API_USER_EMAIL` and `WHATSAPP_OWNER_EMAIL` are all optional and all
shipped only when set.

Two things break `mix release` rather than the deploy, and both fail late:

- **No closures in config.** `config :langchain, :openai_key, fn -> ... end`
  reads fine under `mix phx.server` and cannot be written into a release's
  `sys.config`; only `&Mod.fun/arity` captures survive. Provider keys are read
  in `runtime.exs` for that reason.
- **`assets.deploy` must compile first.** Colocated LiveView hooks are emitted
  by the Phoenix compiler into `_build/<env>/phoenix-colocated`, which is on
  esbuild's `NODE_PATH`. Without a `compile` step ahead of it, esbuild cannot
  resolve `phoenix-colocated/connectix` — in dev the directory is left over
  from a previous build, so the mistake only shows up in a clean prod tree.

## Where the agent can be reached

The current implementation has three ways in. All of them land in the same
conversation store, and a conversation records which one it came from in
`source`.

- **Browser** — LiveView at `/chat`. Streams tokens as they arrive.
- **WhatsApp** — inbound webhook, replies delivered by the channel. Complete
  messages only; WhatsApp has no notion of one still being written.
- **HTTP API** — `/api`, for customers driving it from their own code.

The target fourth surface is **Voice** through Feline. Voice attaches a live
media pipeline to the same scoped Sagents conversation but does not use the
completed-message channel dispatcher. See “Voice: Feline around Sagents”.

## Known gaps

Things that are missing rather than broken, listed because each one is easy to
mistake for a bug.

**Only phases 1–2 of the Bot-first design are implemented.** Versions,
publication, pinning, the Skill catalog and the compiler exist; there are no
deterministic controls, no capabilities beyond the test fake, no flow engine,
no human takeover, no WhatsApp interactive messages, and no Bot Studio yet.

**Feline voice is a target integration, not current functionality.** There is
no authenticated voice endpoint or SagentsBridge yet. Do not copy Feline's
standalone LLM/context/tool example into the application.

**Nothing has ever been deployed.** `MIX_ENV=prod mix release` builds and the
xamal config is complete, but no server has run it, so the first deploy is still
an unverified path — migrations, Caddy's certificate, and the `/health/ready`
gate have only ever been reasoned about.

**An agent turn stores a stray short assistant message** alongside the real
reply — look at any conversation's messages and there are two where there should
be one. Suspected to be the title-generation chain writing into the display
message log.

**A human cannot take over a conversation.** `Channels.deliver/2` only sends
`message_type: "assistant"`, so typing into a WhatsApp thread from the web UI
reaches nobody. Doing it properly needs a `handler` flag on the conversation —
the agent stands down while a human answers — and a guard so a message that
arrived *from* a channel is never echoed back to it.

**`make act` needs no database.** It used to publish 5432 for a Postgres
service the workflow started; the app has had no Ecto since 39c92198.

**Channel credentials are per-deployment, not per-tenant.** One WhatsApp number,
one API key, one user. Supporting several would mean a tenant on every row,
which is a different design rather than a larger version of this one.

### Phoenix v1.8 guidelines

- **Always** begin your LiveView templates with `<Layouts.app flash={@flash} ...>` which wraps all inner content
- The `MyAppWeb.Layouts` module is aliased in the `my_app_web.ex` file, so you can use it without needing to alias it again
- Anytime you run into errors with no `current_scope` assign:
  - You failed to follow the Authenticated Routes guidelines, or you failed to pass `current_scope` to `<Layouts.app>`
  - **Always** fix the `current_scope` error by moving your routes to the proper `live_session` and ensure you pass `current_scope` as needed
- Phoenix v1.8 moved the `<.flash_group>` component to the `Layouts` module. You are **forbidden** from calling `<.flash_group>` outside of the `layouts.ex` module
- Out of the box, `core_components.ex` imports an `<.icon name="hero-x-mark" class="w-5 h-5"/>` component for for hero icons. **Always** use the `<.icon>` component for icons, **never** use `Heroicons` modules or similar
- **Always** use the imported `<.input>` component for form inputs from `core_components.ex` when available. `<.input>` is imported and using it will will save steps and prevent errors
- If you override the default input classes (`<.input class="myclass px-2 py-1 rounded-lg">)`) class with your own values, no default classes are inherited, so your
custom classes must fully style the input

### JS and CSS guidelines

- **Use Tailwind CSS classes and custom CSS rules** to create polished, responsive, and visually stunning interfaces.
- Tailwindcss v4 **no longer needs a tailwind.config.js** and uses a new import syntax in `app.css`:

      @import "tailwindcss" source(none);
      @source "../css";
      @source "../js";
      @source "../../lib/my_app_web";

- **Always use and maintain this import syntax** in the app.css file for projects generated with `phx.new`
- **Never** use `@apply` when writing raw css
- **Always** manually write your own tailwind-based components instead of using daisyUI for a unique, world-class design
- Out of the box **only the app.js and app.css bundles are supported**
  - You cannot reference an external vendor'd script `src` or link `href` in the layouts
  - You must import the vendor deps into app.js and app.css to use them
  - **Never write inline <script>custom js</script> tags within templates**

### UI/UX & design guidelines

- **Produce world-class UI designs** with a focus on usability, aesthetics, and modern design principles
- Implement **subtle micro-interactions** (e.g., button hover effects, and smooth transitions)
- Ensure **clean typography, spacing, and layout balance** for a refined, premium look
- Focus on **delightful details** like hover effects, loading states, and smooth page transitions


<!-- phoenix-gen-auth-start -->
## Authentication

- **Always** handle authentication flow at the router level with proper redirects
- **Always** be mindful of where to place routes. `phx.gen.auth` creates multiple router plugs and `live_session` scopes:
  - A plug `:fetch_current_scope_for_user` that is included in the default browser pipeline
  - A plug `:require_authenticated_user` that redirects to the log in page when the user is not authenticated
  - A `live_session :current_user` scope - for routes that need the current user but don't require authentication, similar to `:fetch_current_scope_for_user`
  - A `live_session :require_authenticated_user` scope - for routes that require authentication, similar to the plug with the same name
  - In both cases, a `@current_scope` is assigned to the Plug connection and LiveView socket
  - A plug `redirect_if_user_is_authenticated` that redirects to a default path in case the user is authenticated - useful for a registration page that should only be shown to unauthenticated users
- **Always let the user know in which router scopes, `live_session`, and pipeline you are placing the route, AND SAY WHY**
- `phx.gen.auth` assigns the `current_scope` assign - it **does not assign a `current_user` assign**
- Always pass the assign `current_scope` to context modules as first argument. When performing queries, use `current_scope.user` to filter the query results
- To derive/access `current_user` in templates, **always use the `@current_scope.user`**, never use **`@current_user`** in templates or LiveViews
- **Never** duplicate `live_session` names. A `live_session :current_user` can only be defined __once__ in the router, so all routes for the `live_session :current_user`  must be grouped in a single block
- Anytime you hit `current_scope` errors or the logged in session isn't displaying the right content, **always double check the router and ensure you are using the correct plug and `live_session` as described below**

### Routes that require authentication

LiveViews that require login should **always be placed inside the __existing__ `live_session :require_authenticated_user` block**:

    scope "/", AppWeb do
      pipe_through [:browser, :require_authenticated_user]

      live_session :require_authenticated_user,
        on_mount: [{ConnectixWeb.UserAuth, :require_authenticated}] do
        # phx.gen.auth generated routes
        live "/users/settings", UserLive.Settings, :edit
        live "/users/settings/confirm-email/:token", UserLive.Settings, :confirm_email
        # our own routes that require logged in user
        live "/", MyLiveThatRequiresAuth, :index
      end
    end

Controller routes must be placed in a scope that sets the `:require_authenticated_user` plug:

    scope "/", AppWeb do
      pipe_through [:browser, :require_authenticated_user]

      get "/", MyControllerThatRequiresAuth, :index
    end

### Routes that work with or without authentication

LiveViews that can work with or without authentication, **always use the __existing__ `:current_user` scope**, ie:

    scope "/", MyAppWeb do
      pipe_through [:browser]

      live_session :current_user,
        on_mount: [{ConnectixWeb.UserAuth, :mount_current_scope}] do
        # our own routes that work with or without authentication
        live "/", PublicLive
      end
    end

Controllers automatically have the `current_scope` available if they use the `:browser` pipeline.

<!-- phoenix-gen-auth-end -->

<!-- usage-rules-start -->

<!-- phoenix:elixir-start -->
## Elixir guidelines

- Elixir lists **do not support index based access via the access syntax**

  **Never do this (invalid)**:

      i = 0
      mylist = ["blue", "green"]
      mylist[i]

  Instead, **always** use `Enum.at`, pattern matching, or `List` for index based list access, ie:

      i = 0
      mylist = ["blue", "green"]
      Enum.at(mylist, i)

- Elixir variables are immutable, but can be rebound, so for block expressions like `if`, `case`, `cond`, etc
  you *must* bind the result of the expression to a variable if you want to use it and you CANNOT rebind the result inside the expression, ie:

      # INVALID: we are rebinding inside the `if` and the result never gets assigned
      if connected?(socket) do
        socket = assign(socket, :val, val)
      end

      # VALID: we rebind the result of the `if` to a new variable
      socket =
        if connected?(socket) do
          assign(socket, :val, val)
        end

- **Never** nest multiple modules in the same file as it can cause cyclic dependencies and compilation errors
- **Never** use map access syntax (`changeset[:field]`) on structs as they do not implement the Access behaviour by default. For regular structs, you **must** access the fields directly, such as `my_struct.field` or use higher level APIs that are available on the struct if they exist, `Ecto.Changeset.get_field/2` for changesets
- Elixir's standard library has everything necessary for date and time manipulation. Familiarize yourself with the common `Time`, `Date`, `DateTime`, and `Calendar` interfaces by accessing their documentation as necessary. **Never** install additional dependencies unless asked or for date/time parsing (which you can use the `date_time_parser` package)
- Don't use `String.to_atom/1` on user input (memory leak risk)
- Predicate function names should not start with `is_` and should end in a question mark. Names like `is_thing` should be reserved for guards
- Elixir's builtin OTP primitives like `DynamicSupervisor` and `Registry`, require names in the child spec, such as `{DynamicSupervisor, name: MyApp.MyDynamicSup}`, then you can use `DynamicSupervisor.start_child(MyApp.MyDynamicSup, child_spec)`
- Use `Task.async_stream(collection, callback, options)` for concurrent enumeration with back-pressure. The majority of times you will want to pass `timeout: :infinity` as option

## Mix guidelines

- Read the docs and options before using tasks (by using `mix help task_name`)
- To debug test failures, run tests in a specific file with `mix test test/my_test.exs` or run all previously failed tests with `mix test --failed`
- `mix deps.clean --all` is **almost never needed**. **Avoid** using it unless you have good reason
<!-- phoenix:elixir-end -->

<!-- phoenix:phoenix-start -->
## Phoenix guidelines

- Remember Phoenix router `scope` blocks include an optional alias which is prefixed for all routes within the scope. **Always** be mindful of this when creating routes within a scope to avoid duplicate module prefixes.

- You **never** need to create your own `alias` for route definitions! The `scope` provides the alias, ie:

      scope "/admin", AppWeb.Admin do
        pipe_through :browser

        live "/users", UserLive, :index
      end

  the UserLive route would point to the `AppWeb.Admin.UserLive` module

- `Phoenix.View` no longer is needed or included with Phoenix, don't use it
<!-- phoenix:phoenix-end -->

<!-- phoenix:ecto-start -->
## Ecto Guidelines

- **Always** preload Ecto associations in queries when they'll be accessed in templates, ie a message that needs to reference the `message.user.email`
- Remember `import Ecto.Query` and other supporting modules when you write `seeds.exs`
- `Ecto.Schema` fields always use the `:string` type, even for `:text`, columns, ie: `field :name, :string`
- `Ecto.Changeset.validate_number/2` **DOES NOT SUPPORT the `:allow_nil` option**. By default, Ecto validations only run if a change for the given field exists and the change value is not nil, so such as option is never needed
- You **must** use `Ecto.Changeset.get_field(changeset, :field)` to access changeset fields
- Fields which are set programatically, such as `user_id`, must not be listed in `cast` calls or similar for security purposes. Instead they must be explicitly set when creating the struct
<!-- phoenix:ecto-end -->

<!-- phoenix:html-start -->
## Phoenix HTML guidelines

- Phoenix templates **always** use `~H` or .html.heex files (known as HEEx), **never** use `~E`
- **Always** use the imported `Phoenix.Component.form/1` and `Phoenix.Component.inputs_for/1` function to build forms. **Never** use `Phoenix.HTML.form_for` or `Phoenix.HTML.inputs_for` as they are outdated
- When building forms **always** use the already imported `Phoenix.Component.to_form/2` (`assign(socket, form: to_form(...))` and `<.form for={@form} id="msg-form">`), then access those forms in the template via `@form[:field]`
- **Always** add unique DOM IDs to key elements (like forms, buttons, etc) when writing templates, these IDs can later be used in tests (`<.form for={@form} id="product-form">`)
- For "app wide" template imports, you can import/alias into the `my_app_web.ex`'s `html_helpers` block, so they will be available to all LiveViews, LiveComponent's, and all modules that do `use MyAppWeb, :html` (replace "my_app" by the actual app name)

- Elixir supports `if/else` but **does NOT support `if/else if` or `if/elsif`. **Never use `else if` or `elseif` in Elixir**, **always** use `cond` or `case` for multiple conditionals.

  **Never do this (invalid)**:

      <%= if condition do %>
        ...
      <% else if other_condition %>
        ...
      <% end %>

  Instead **always** do this:

      <%= cond do %>
        <% condition -> %>
          ...
        <% condition2 -> %>
          ...
        <% true -> %>
          ...
      <% end %>

- HEEx require special tag annotation if you want to insert literal curly's like `{` or `}`. If you want to show a textual code snippet on the page in a `<pre>` or `<code>` block you *must* annotate the parent tag with `phx-no-curly-interpolation`:

      <code phx-no-curly-interpolation>
        let obj = {key: "val"}
      </code>

  Within `phx-no-curly-interpolation` annotated tags, you can use `{` and `}` without escaping them, and dynamic Elixir expressions can still be used with `<%= ... %>` syntax

- HEEx class attrs support lists, but you must **always** use list `[...]` syntax. You can use the class list syntax to conditionally add classes, **always do this for multiple class values**:

      <a class={[
        "px-2 text-white",
        @some_flag && "py-5",
        if(@other_condition, do: "border-red-500", else: "border-blue-100"),
        ...
      ]}>Text</a>

  and **always** wrap `if`'s inside `{...}` expressions with parens, like done above (`if(@other_condition, do: "...", else: "...")`)

  and **never** do this, since it's invalid (note the missing `[` and `]`):

      <a class={
        "px-2 text-white",
        @some_flag && "py-5"
      }> ...
      => Raises compile syntax error on invalid HEEx attr syntax

- **Never** use `<% Enum.each %>` or non-for comprehensions for generating template content, instead **always** use `<%= for item <- @collection do %>`
- HEEx HTML comments use `<%!-- comment --%>`. **Always** use the HEEx HTML comment syntax for template comments (`<%!-- comment --%>`)
- HEEx allows interpolation via `{...}` and `<%= ... %>`, but the `<%= %>` **only** works within tag bodies. **Always** use the `{...}` syntax for interpolation within tag attributes, and for interpolation of values within tag bodies. **Always** interpolate block constructs (if, cond, case, for) within tag bodies using `<%= ... %>`.

  **Always** do this:

      <div id={@id}>
        {@my_assign}
        <%= if @some_block_condition do %>
          {@another_assign}
        <% end %>
      </div>

  and **Never** do this – the program will terminate with a syntax error:

      <%!-- THIS IS INVALID NEVER EVER DO THIS --%>
      <div id="<%= @invalid_interpolation %>">
        {if @invalid_block_construct do}
        {end}
      </div>
<!-- phoenix:html-end -->

<!-- phoenix:liveview-start -->
## Phoenix LiveView guidelines

- **Never** use the deprecated `live_redirect` and `live_patch` functions, instead **always** use the `<.link navigate={href}>` and  `<.link patch={href}>` in templates, and `push_navigate` and `push_patch` functions LiveViews
- **Avoid LiveComponent's** unless you have a strong, specific need for them
- LiveViews should be named like `AppWeb.WeatherLive`, with a `Live` suffix. When you go to add LiveView routes to the router, the default `:browser` scope is **already aliased** with the `AppWeb` module, so you can just do `live "/weather", WeatherLive`
- Remember anytime you use `phx-hook="MyHook"` and that js hook manages its own DOM, you **must** also set the `phx-update="ignore"` attribute
- **Never** write embedded `<script>` tags in HEEx. Instead always write your scripts and hooks in the `assets/js` directory and integrate them with the `assets/js/app.js` file

### LiveView streams

- **Always** use LiveView streams for collections for assigning regular lists to avoid memory ballooning and runtime termination with the following operations:
  - basic append of N items - `stream(socket, :messages, [new_msg])`
  - resetting stream with new items - `stream(socket, :messages, [new_msg], reset: true)` (e.g. for filtering items)
  - prepend to stream - `stream(socket, :messages, [new_msg], at: -1)`
  - deleting items - `stream_delete(socket, :messages, msg)`

- When using the `stream/3` interfaces in the LiveView, the LiveView template must 1) always set `phx-update="stream"` on the parent element, with a DOM id on the parent element like `id="messages"` and 2) consume the `@streams.stream_name` collection and use the id as the DOM id for each child. For a call like `stream(socket, :messages, [new_msg])` in the LiveView, the template would be:

      <div id="messages" phx-update="stream">
        <div :for={{id, msg} <- @streams.messages} id={id}>
          {msg.text}
        </div>
      </div>

- LiveView streams are *not* enumerable, so you cannot use `Enum.filter/2` or `Enum.reject/2` on them. Instead, if you want to filter, prune, or refresh a list of items on the UI, you **must refetch the data and re-stream the entire stream collection, passing reset: true**:

      def handle_event("filter", %{"filter" => filter}, socket) do
        # re-fetch the messages based on the filter
        messages = list_messages(filter)

        {:noreply,
        socket
        |> assign(:messages_empty?, messages == [])
        # reset the stream with the new messages
        |> stream(:messages, messages, reset: true)}
      end

- LiveView streams *do not support counting or empty states*. If you need to display a count, you must track it using a separate assign. For empty states, you can use Tailwind classes:

      <div id="tasks" phx-update="stream">
        <div class="hidden only:block">No tasks yet</div>
        <div :for={{id, task} <- @stream.tasks} id={id}>
          {task.name}
        </div>
      </div>

  The above only works if the empty state is the only HTML block alongside the stream for-comprehension.

- **Never** use the deprecated `phx-update="append"` or `phx-update="prepend"` for collections

### LiveView tests

- `Phoenix.LiveViewTest` module and `LazyHTML` (included) for making your assertions
- Form tests are driven by `Phoenix.LiveViewTest`'s `render_submit/2` and `render_change/2` functions
- Come up with a step-by-step test plan that splits major test cases into small, isolated files. You may start with simpler tests that verify content exists, gradually add interaction tests
- **Always reference the key element IDs you added in the LiveView templates in your tests** for `Phoenix.LiveViewTest` functions like `element/2`, `has_element/2`, selectors, etc
- **Never** tests again raw HTML, **always** use `element/2`, `has_element/2`, and similar: `assert has_element?(view, "#my-form")`
- Instead of relying on testing text content, which can change, favor testing for the presence of key elements
- Focus on testing outcomes rather than implementation details
- Be aware that `Phoenix.Component` functions like `<.form>` might produce different HTML than expected. Test against the output HTML structure, not your mental model of what you expect it to be
- When facing test failures with element selectors, add debug statements to print the actual HTML, but use `LazyHTML` selectors to limit the output, ie:

      html = render(view)
      document = LazyHTML.from_fragment(html)
      matches = LazyHTML.filter(document, "your-complex-selector")
      IO.inspect(matches, label: "Matches")

### Form handling

#### Creating a form from params

If you want to create a form based on `handle_event` params:

    def handle_event("submitted", params, socket) do
      {:noreply, assign(socket, form: to_form(params))}
    end

When you pass a map to `to_form/1`, it assumes said map contains the form params, which are expected to have string keys.

You can also specify a name to nest the params:

    def handle_event("submitted", %{"user" => user_params}, socket) do
      {:noreply, assign(socket, form: to_form(user_params, as: :user))}
    end

#### Creating a form from changesets

When using changesets, the underlying data, form params, and errors are retrieved from it. The `:as` option is automatically computed too. E.g. if you have a user schema:

    defmodule MyApp.Users.User do
      use Ecto.Schema
      ...
    end

And then you create a changeset that you pass to `to_form`:

    %MyApp.Users.User{}
    |> Ecto.Changeset.change()
    |> to_form()

Once the form is submitted, the params will be available under `%{"user" => user_params}`.

In the template, the form form assign can be passed to the `<.form>` function component:

    <.form for={@form} id="todo-form" phx-change="validate" phx-submit="save">
      <.input field={@form[:field]} type="text" />
    </.form>

Always give the form an explicit, unique DOM ID, like `id="todo-form"`.

#### Avoiding form errors

**Always** use a form assigned via `to_form/2` in the LiveView, and the `<.input>` component in the template. In the template **always access forms this**:

    <%!-- ALWAYS do this (valid) --%>
    <.form for={@form} id="my-form">
      <.input field={@form[:field]} type="text" />
    </.form>

And **never** do this:

    <%!-- NEVER do this (invalid) --%>
    <.form for={@changeset} id="my-form">
      <.input field={@changeset[:field]} type="text" />
    </.form>

- You are FORBIDDEN from accessing the changeset in the template as it will cause errors
- **Never** use `<.form let={f} ...>` in the template, instead **always use `<.form for={@form} ...>`**, then drive all form references from the form assign as in `@form[:field]`. The UI should **always** be driven by a `to_form/2` assigned in the LiveView module that is derived from a changeset
<!-- phoenix:liveview-end -->

<!-- usage-rules-end -->
