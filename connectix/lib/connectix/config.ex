defmodule Connectix.Config do
  @moduledoc """
  Every setting this application reads from the environment, in one place.

  Configuration is environment variables. Not literals in `config/*.exs`, not
  `System.get_env/1` scattered through the modules that happen to need a value.
  A setting that only one call site knows about is a setting nobody can list,
  document, or ship to a server — the HTTP API key was read inside a plug and
  was consequently absent from `config/xamal.exs`, so a deployed box answered
  401 to every request while `/api/docs` sat there describing it.

  Two rules follow from that:

    * **application code calls this module**, never `System.get_env/1` directly;
    * **`config/*.exs` holds no deployment values** — it wires libraries whose
      configuration has to be application config (Ecto, the Endpoint,
      `:langchain`, `:anu`, `:sagents`) and reads their values from here's
      documented variable names.

  Resolution happens at call time rather than at boot. Changing a variable
  takes effect without a restart, tests drive settings with `System.put_env/2`
  and no config reload, and nothing is captured into a closure that a release
  cannot serialise.

  An unset variable and one set to the empty string mean the same thing —
  absent. Shipping tools write `FOO=` for a variable they have no value for,
  and "" is never a meaningful key, model name, or path.

  The accessor is the documentation: each one names its variable, its default,
  and what happens when it is missing. `summary/0` prints the resolved set with
  secrets redacted.
  """

  # Only ever read at compile time, which is the one thing `Mix` can be trusted
  # for: it does not exist in a release, so a runtime `Mix.env()` crashes in
  # production the first time it is reached.
  @compiled_env Mix.env()

  @default_main_model "claude-sonnet-4-6"
  @default_title_model "claude-haiku-4-5"
  @default_thinking_budget 3_000

  # ── Model provider ──────────────────────────────────────────────────────────

  @doc """
  Anthropic API key (`ANTHROPIC_API_KEY`), or `nil`. Every agent, including
  title generation, is an Anthropic model, so this is the one credential the
  app cannot usefully run without.
  """
  @spec anthropic_api_key() :: String.t() | nil
  def anthropic_api_key, do: env("ANTHROPIC_API_KEY")

  @doc """
  Anthropic API key, raising when unset. Used where a model is about to be
  built and there is no sensible degraded behaviour — failing at agent start
  with the variable's name beats a 401 from the provider several frames later.
  """
  @spec anthropic_api_key!() :: String.t()
  def anthropic_api_key!, do: anthropic_api_key() || raise_missing("ANTHROPIC_API_KEY")

  @doc """
  OpenAI API key (`OPENAI_KEY`), or `nil`. Unused by the default factory and
  present so switching `Connectix.Agents.Factory` to `ChatOpenAI` needs no
  config change. Read here rather than in `config/config.exs`, where the
  LangChain install instructions put a `fn -> ... end` that cannot be written
  into a release's `sys.config`.
  """
  @spec openai_api_key() :: String.t() | nil
  def openai_api_key, do: env("OPENAI_KEY")

  @doc "OpenAI API key, raising when unset — see `anthropic_api_key!/0`."
  @spec openai_api_key!() :: String.t()
  def openai_api_key!, do: openai_api_key() || raise_missing("OPENAI_KEY")

  @doc """
  Google AI (Gemini) API key (`GOOGLE_API_KEY`), or `nil`. From Google AI
  Studio; the only provider here with a free tier, which is why it exists —
  a bot can be tried with no card on file. Selected by naming a `gemini-*`
  model in `CONNECTIX_MODEL`; see `model_provider/1`.
  """
  @spec google_api_key() :: String.t() | nil
  def google_api_key, do: env("GOOGLE_API_KEY")

  @doc "Google AI API key, raising when unset — see `anthropic_api_key!/0`."
  @spec google_api_key!() :: String.t()
  def google_api_key!, do: google_api_key() || raise_missing("GOOGLE_API_KEY")

  @doc """
  xAI (Grok) API key (`XAI_API_KEY`), or `nil`. Selected by naming a `grok-*`
  model in `CONNECTIX_MODEL`; see `model_provider/1`.
  """
  @spec xai_api_key() :: String.t() | nil
  def xai_api_key, do: env("XAI_API_KEY")

  @doc "xAI API key, raising when unset — see `anthropic_api_key!/0`."
  @spec xai_api_key!() :: String.t()
  def xai_api_key!, do: xai_api_key() || raise_missing("XAI_API_KEY")

  @doc """
  Which provider serves a model, from its name — the one thing every provider
  encodes in the name, so no second variable has to agree with the first:

    * `gemini-*` → `:google`
    * `grok-*` → `:xai`
    * `gpt-*`, `o1*`/`o3*`/`o4*` → `:openai`
    * anything else → `:anthropic`

  `Connectix.Agents.Factory` builds the matching LangChain chat model and
  reads the matching key. Changing provider is therefore one variable.
  """
  @spec model_provider(String.t()) :: :anthropic | :google | :openai | :xai
  def model_provider("gemini-" <> _rest), do: :google
  def model_provider("grok-" <> _rest), do: :xai
  def model_provider("gpt-" <> _rest), do: :openai
  def model_provider(<<"o", digit, _rest::binary>>) when digit in ?1..?9, do: :openai
  def model_provider(_other), do: :anthropic

  @doc """
  Model backing a conversation (`CONNECTIX_MODEL`, default
  `#{@default_main_model}`). A bot's own `model` overrides it per conversation;
  this is the default a bot with none falls back to.
  """
  @spec main_model() :: String.t()
  def main_model, do: env("CONNECTIX_MODEL") || @default_main_model

  @doc """
  Model that names conversations (`CONNECTIX_TITLE_MODEL`, default
  `#{@default_title_model}`). Deliberately a smaller model than `main_model/0`:
  it runs once per conversation on a few hundred tokens and nobody reads its
  reasoning.
  """
  @spec title_model() :: String.t()
  def title_model do
    # The default follows the main model's provider. A Gemini or GPT main
    # model with the Anthropic default here means every title needs an
    # Anthropic key too — and when that key is the reason the provider was
    # switched, every title fails. Same provider, and the main model itself
    # rather than a guess at that provider's small model.
    env("CONNECTIX_TITLE_MODEL") ||
      case model_provider(main_model()) do
        :anthropic -> @default_title_model
        _other -> main_model()
      end
  end

  @doc """
  Extended-thinking budget in tokens (`CONNECTIX_THINKING_BUDGET`, default
  #{@default_thinking_budget}). Anthropic requires at least 1024. The ceiling
  here is a cost bound, not a model limit — thinking is billed as output.
  """
  @spec thinking_budget_tokens() :: pos_integer()
  def thinking_budget_tokens,
    do: int_env("CONNECTIX_THINKING_BUDGET", @default_thinking_budget, 1_024..200_000)

  # ── HTTP API ────────────────────────────────────────────────────────────────

  @doc """
  Bearer token for the public API (`CONNECTIX_API_KEY`), or `nil`.

  With none the API refuses every request rather than running unauthenticated:
  an agent that can search the web and write files is not something to leave
  open by omission. Values under 16 bytes are treated as absent — a key short
  enough to guess is worse than no API at all, because it looks configured.
  """
  @spec api_key() :: String.t() | nil
  def api_key do
    case env("CONNECTIX_API_KEY") do
      key when is_binary(key) and byte_size(key) >= 16 -> key
      _too_short_or_absent -> nil
    end
  end

  @doc """
  Email of the user API requests act as (`CONNECTIX_API_USER_EMAIL`), or
  `nil`. Their scope keys every downstream query and the agent's own
  filesystem — the API is a way into the same app, not a way around its
  scoping. Set without `api_key/0` it does nothing, and vice versa.
  """
  @spec api_user_email() :: String.t() | nil
  def api_user_email, do: env("CONNECTIX_API_USER_EMAIL")

  # ── LiveView UI ─────────────────────────────────────────────────────────────

  @doc """
  HTTP Basic Auth credentials gating the LiveView UI (`PORTAL_UI_USER` /
  `PORTAL_UI_PASS`), or `nil` when unconfigured.

  Unconfigured, `ConnectixWeb.Plugs.BasicAuth` passes every request through —
  local dev/test stays frictionless — and `Connectix.Application` logs a
  warning at boot in that case, so an unprotected deployment is never
  silent. There is exactly one operator
  identity: the configured username doubles as the account
  `ConnectixWeb.UserAuth` resolves `current_scope` from, the same way
  `connectix.io/phone`'s retired `BasicAuth` plug worked before it moved to
  session tokens.
  """
  @spec basic_auth() :: {String.t(), String.t()} | nil
  def basic_auth do
    with user when is_binary(user) <- env("PORTAL_UI_USER"),
         pass when is_binary(pass) <- env("PORTAL_UI_PASS") do
      {user, pass}
    else
      _unconfigured -> nil
    end
  end

  # ── Calling environments ────────────────────────────────────────────────────

  @doc """
  Named SIP/calling environments the LiveView phone can dial through
  (`CONNECTIX_ENVIRONMENTS`), as a list of `%{name:, domain:, wss_url:}` maps.

  `name:domain:wss_url` triples, comma-separated — same shape as
  `event_streams/0`'s `scope:id` pairs, for the same reason: one env var, no
  JSON to escape in a `.env` file.

      CONNECTIX_ENVIRONMENTS=prod:sip.example.com:wss://sip.example.com:8443,staging:sip-staging.example.com:wss://sip-staging.example.com:8443

  Unset, this is a single placeholder `"default"` environment with `domain:
  nil, wss_url: nil` — enough for the UI to render a switcher with one entry
  before any real SIP target is configured. A malformed entry is dropped
  rather than raised on, same as `event_streams/0`: a typo in one environment
  should not take down every other one.
  """
  @spec environments() :: [
          %{name: String.t(), domain: String.t() | nil, wss_url: String.t() | nil}
        ]
  def environments do
    case env("CONNECTIX_ENVIRONMENTS") do
      nil ->
        [%{name: "default", domain: nil, wss_url: nil}]

      raw ->
        raw
        |> String.split(",", trim: true)
        |> Enum.flat_map(fn entry ->
          case String.split(String.trim(entry), ":", parts: 3) do
            [name, domain, wss_url] when name != "" ->
              [%{name: name, domain: presence_or_nil(domain), wss_url: presence_or_nil(wss_url)}]

            [name, domain] when name != "" ->
              [%{name: name, domain: presence_or_nil(domain), wss_url: nil}]

            [name] when name != "" ->
              [%{name: name, domain: nil, wss_url: nil}]

            _malformed ->
              []
          end
        end)
        |> case do
          [] -> [%{name: "default", domain: nil, wss_url: nil}]
          parsed -> parsed
        end
    end
  end

  defp presence_or_nil(""), do: nil
  defp presence_or_nil(value), do: value

  @doc """
  SIP credentials the `Connectix.WebRtc.SipBridge` dials out with
  (`CONNECTIX_SIP_USER` / `CONNECTIX_SIP_PASS` / `CONNECTIX_SIP_DOMAIN`), or
  `nil` when any of the three is unconfigured — the bridge cannot register
  without all three, so a partial set is treated as absent rather than
  attempted and left to fail against a blank domain.

  Deliberately flat (one account), not per-`environments/0` entry: this is
  the credential for whichever environment is selected, same as
  `basic_auth/0` is one operator identity rather than per-user accounts.
  """
  @spec sip_credentials() :: %{
          user: String.t(),
          pass: String.t(),
          domain: String.t(),
          server: String.t(),
          port: pos_integer()
        }
          | nil
  def sip_credentials do
    with user when is_binary(user) <- env("CONNECTIX_SIP_USER"),
         pass when is_binary(pass) <- env("CONNECTIX_SIP_PASS"),
         domain when is_binary(domain) <- env("CONNECTIX_SIP_DOMAIN") do
      %{
        user: user,
        pass: pass,
        domain: domain,
        # The registrar host/port, when it differs from the domain (a
        # multi-tenant Kamailio, say) — CONNECTIX_SIP_SERVER/PORT. Defaults to
        # the domain itself on the standard SIP port.
        server: env("CONNECTIX_SIP_SERVER") || domain,
        port: int_env("CONNECTIX_SIP_PORT", 5060, 1..65_535)
      }
    else
      _unconfigured -> nil
    end
  end

  @doc """
  The Deepgram API key the Feline voice pipeline's STT stage reads
  (`DEEPGRAM_API_KEY`), or `nil` when unconfigured. Feline's own service
  module falls back to `System.get_env/1` directly when no `:api_key` option
  is given; this app never leaves that to chance — `Connectix.Voice` always
  passes this through explicitly, so "is voice configured" is one function
  to check rather than an env var Feline reads behind the scenes.
  """
  @spec deepgram_api_key() :: String.t() | nil
  def deepgram_api_key, do: env("DEEPGRAM_API_KEY")

  @doc """
  The Cartesia API key the Feline voice pipeline's TTS stage reads
  (`CARTESIA_API_KEY`), or `nil` when unconfigured. See `deepgram_api_key/0`.
  """
  @spec cartesia_api_key() :: String.t() | nil
  def cartesia_api_key, do: env("CARTESIA_API_KEY")

  @doc """
  Whether the Feline voice pipeline (`/voice`, `Connectix.Voice.SagentsBridge`)
  has what it needs to actually run — both STT and TTS keys present. Checked
  once, at the WebSocket upgrade, rather than letting a half-configured
  pipeline start and fail mid-call.
  """
  @spec voice_configured?() :: boolean()
  def voice_configured?, do: is_binary(deepgram_api_key()) and is_binary(cartesia_api_key())

  @doc """
  What the bot says when someone answers a call it placed
  (`CONNECTIX_VOICE_GREETING`).

  A greeting is not decoration on an outbound call: the callee says "hello?"
  to silence otherwise, and hangs up before the bot's turn-detection has
  anything to work with. Default is deliberately plain — a real deployment
  should say who is calling and why.
  """
  @spec voice_greeting() :: String.t()
  def voice_greeting,
    do: env("CONNECTIX_VOICE_GREETING") || "Hello, this is the Connectix assistant. How can I help?"

  @doc """
  STUN server URLs for the WebRTC bridge (`STUN_URLS`, comma-separated), or
  `[]`. No STUN unless asked for — on a LAN the browser and the BEAM exchange
  host candidates directly, so a public STUN server is an unnecessary round
  trip to a third party on every call.
  """
  @spec stun_urls() :: [String.t()]
  def stun_urls, do: split_urls(env("STUN_URLS"))

  @doc "TURN relay server URLs for the WebRTC bridge (`TURN_URLS`, comma-separated), or `[]`."
  @spec turn_urls() :: [String.t()]
  def turn_urls, do: split_urls(env("TURN_URLS"))

  @doc "TURN relay username (`TURN_USERNAME`), or `nil`."
  @spec turn_username() :: String.t() | nil
  def turn_username, do: env("TURN_USERNAME")

  @doc "TURN relay password (`TURN_PASSWORD`), or `nil`."
  @spec turn_password() :: String.t() | nil
  def turn_password, do: env("TURN_PASSWORD")

  defp split_urls(nil), do: []

  defp split_urls(raw) do
    raw |> String.split(",", trim: true) |> Enum.map(&String.trim/1) |> Enum.reject(&(&1 == ""))
  end

  # ── WhatsApp channel ────────────────────────────────────────────────────────

  @doc """
  WhatsApp Business Cloud access token (`WHATSAPP_ACCESS_TOKEN`), or `nil`.
  Use a System User token: the ones the dashboard hands out expire in 24 hours,
  which reads as an intermittent channel outage a day after every setup.
  """
  @spec whatsapp_access_token() :: String.t() | nil
  def whatsapp_access_token, do: env("WHATSAPP_ACCESS_TOKEN")

  @doc "The phone number replies are sent from (`WHATSAPP_PHONE_NUMBER_ID`), or `nil`."
  @spec whatsapp_phone_number_id() :: String.t() | nil
  def whatsapp_phone_number_id, do: env("WHATSAPP_PHONE_NUMBER_ID")

  @doc """
  Secret Meta signs inbound webhooks with (`WHATSAPP_APP_SECRET`), or `nil`.
  A wrong value fails the check silently — `Anu.Webhook.Plug` answers 200
  either way — so the channel looks healthy to Meta while dropping every
  message. Consumed by `config/runtime.exs`, which is where `:anu` reads it.
  """
  @spec whatsapp_app_secret() :: String.t() | nil
  def whatsapp_app_secret, do: env("WHATSAPP_APP_SECRET")

  @doc """
  The string Meta echoes back when verifying the webhook subscription
  (`WHATSAPP_VERIFY_TOKEN`), or `nil`. Yours to invent; it only has to match
  what you typed into the Meta dashboard.
  """
  @spec whatsapp_verify_token() :: String.t() | nil
  def whatsapp_verify_token, do: env("WHATSAPP_VERIFY_TOKEN")

  @doc """
  Account inbound WhatsApp threads attach to (`WHATSAPP_OWNER_EMAIL`), or `nil`.

  `Sagents.Session` requires a scope and a scope is a user, so a sender needs
  one. Set, every thread lands on that account and appears in the web UI beside
  browser chats — one conversation, two surfaces. Unset, each phone number gets
  its own passwordless account, which is what you want when senders are
  unrelated customers rather than you.
  """
  @spec whatsapp_owner_email() :: String.t() | nil
  def whatsapp_owner_email, do: env("WHATSAPP_OWNER_EMAIL")

  @doc """
  Slug of the bot that answers inbound WhatsApp (`WHATSAPP_BOT_SLUG`, default
  `"default"`). Resolved in the owning account's scope when a thread is
  created; the conversation then pins that bot's current published version.
  """
  @spec whatsapp_bot_slug() :: String.t()
  def whatsapp_bot_slug, do: env("WHATSAPP_BOT_SLUG") || "default"

  @doc "True when the channel has everything it needs to send a message."
  @spec whatsapp_configured?() :: boolean()
  def whatsapp_configured?,
    do: is_binary(whatsapp_access_token()) and is_binary(whatsapp_phone_number_id())

  # ── Fireberry CRM ───────────────────────────────────────────────────────────

  @doc """
  API token for the Fireberry CRM (`FIREBERRY_TOKEN`), or `nil`.

  Read at call time by `Connectix.Integrations.Fireberry`; never stored in
  bot data. Absent, `customer_lookup` answers "CRM unavailable" and the bot
  carries on, so the rest of a flow can be exercised without the CRM.
  """
  @spec fireberry_token() :: String.t() | nil
  def fireberry_token, do: env("FIREBERRY_TOKEN")

  # ── Log shipping (InfluxDB 3) ───────────────────────────────────────────────
  #
  # The SAME variable names va-crystal's node reads (`node/influx/writer.cr`),
  # on purpose: one deployment sets them once and both the node's metrics and
  # this portal's log lines land in the same database. Renaming them here to
  # something "portal-ish" would mean a second set of secrets to ship and keep
  # in sync, which is how one of the two quietly stops writing.

  @doc """
  InfluxDB host (`VA_INFLUXDB_HOST`), default `"influxdb"` — the compose
  service name. A host-networked container cannot resolve that; set it to
  `127.0.0.1` there, as the node's startup check says.
  """
  @spec influxdb_host() :: String.t()
  def influxdb_host, do: env("VA_INFLUXDB_HOST") || "influxdb"

  @doc "InfluxDB port (`VA_INFLUXDB_PORT`), default 8181 — InfluxDB 3's own listener."
  @spec influxdb_port() :: pos_integer()
  def influxdb_port, do: int_env("VA_INFLUXDB_PORT", 8181, 1..65535)

  @doc "InfluxDB database log lines are written to (`VA_INFLUXDB_DATABASE`), default `\"telegraf\"`."
  @spec influxdb_database() :: String.t()
  def influxdb_database, do: env("VA_INFLUXDB_DATABASE") || "telegraf"

  @doc """
  Bearer token for InfluxDB (`VA_MONITOR_TOKEN`), or `nil`.

  This is the gate, exactly as it is in the node's `Influx.configured?`: absent,
  no log handler is installed and nothing is ever posted. There is no
  "write without auth" mode here — a portal that ships its logs somewhere it
  was never told about is not a default anyone asked for.
  """
  @spec monitor_token() :: String.t() | nil
  def monitor_token, do: env("VA_MONITOR_TOKEN")

  @doc "True when log lines should be shipped to InfluxDB — the token is set."
  @spec influx_configured?() :: boolean()
  def influx_configured?, do: is_binary(monitor_token())

  # ── Storage ─────────────────────────────────────────────────────────────────

  @doc """
  Root of the agents' own filesystems — the `/Memories` each user sees
  (`CONNECTIX_DATA_DIR`).

  It must be an absolute path outside the release in production. A deploy
  replaces the release directory wholesale, so anything written inside it is
  destroyed by the next one, and the working directory of a systemd unit is not
  somewhere to keep user data either way.

  Unset it defaults to `user_files/` beside the project for development, and to
  a partition-suffixed temp directory under test so parallel runs cannot see
  each other's files.
  """
  @spec data_dir() :: String.t()
  def data_dir, do: env("CONNECTIX_DATA_DIR") || default_data_dir()

  @doc """
  Directory holding Mnesia's durable tables (`MNESIA_DIR`).

  Defaults to `mnesia/` under `CONNECTIX_DATA_DIR`, keeping all mutable state
  outside a release. Set it directly only when table files need a separate
  volume or filesystem.
  """
  @spec mnesia_dir() :: String.t()
  def mnesia_dir, do: env("MNESIA_DIR") || Path.join(data_dir(), "mnesia")

  @doc """
  Directory holding the DuckDB file of received cable events (`EVENTS_DIR`).

  Defaults to `events/` under `CONNECTIX_DATA_DIR`, for the same reason
  `mnesia_dir/0` does: a deploy replaces the release directory wholesale.
  Overridden wholesale by `events_db/0` when that names a file directly.
  """
  @spec events_dir() :: String.t()
  def events_dir, do: env("EVENTS_DIR") || Path.join(data_dir(), "events")

  @doc """
  How many days of events the store keeps (`EVENTS_RETENTION_DAYS`), default 7.

  The store had no retention at all, and this is not a tidiness question: a
  live switch writes ~146,000 rows and ~556MB of raw JSON a DAY, so an
  unattended portal fills its volume in days and takes Mnesia — the durable
  conversation store sharing that volume — down with it. Measured on
  nimbus-connectix: 557MB of DuckDB file after six hours.

  `0` disables pruning, for a deployment that keeps events elsewhere and wants
  this file to grow. It is deliberately not the default: the default has to be
  the one that cannot fill a disk unattended.
  """
  @spec events_retention_days() :: non_neg_integer()
  def events_retention_days, do: int_env("EVENTS_RETENTION_DAYS", 7, 0..3_650)

    @doc """
  The event store's DuckDB file (`EVENTS_DB`), or `nil` for
  `<events_dir/0>/events.duckdb`.

  Set it to point at a mounted volume. NOTE: unset, on a box with no persistent
  volume, the default path is inside the container and every deploy starts an
  empty file — `Connectix.Events` is then a cache of what this instance has
  seen, not a record.
  """
  @spec events_db() :: String.t() | nil
  def events_db, do: env("EVENTS_DB")

  @doc """
  Extra `StateChannel` streams the application cable connection subscribes to,
  so their frames are stored (`EVENT_STREAMS`).

  `scope:id` pairs, comma-separated:

      EVENT_STREAMS=environment:319a6ccf-…,user:be5bc5f0-…

  Empty by default, and empty means the singleton connection carries exactly
  what it always did — `ApiProxy` and the node-wide `CallEvents`.

  This exists because **cable has no firehose**. `CallEvents` streams every
  baked call event, but everything else the node publishes goes to
  `state.<scope>.<id>`, and `StateChannel` requires both a scope AND an id —
  subscribing to a whole scope is deliberately not offered, so no client can
  tap every account's state by omitting one. The full per-node stream exists
  only on NATS (`node.<VA_NODE_UUID>`), which this app deliberately does not
  connect to. So the only way to store a state stream is to name it, and this
  is where it is named.

  Without this the event store cannot answer the question it exists for: an
  absent row means either "the node sent nothing" or "we were not listening",
  and those are the two answers a troubleshooter is trying to tell apart.

  Malformed entries are dropped rather than raised on: a typo in one stream
  should not stop the relay that carries every login.
  """
  @spec event_streams() :: [{String.t(), String.t()}]
  def event_streams do
    "EVENT_STREAMS"
    |> env()
    |> to_string()
    |> String.split(",", trim: true)
    |> Enum.flat_map(fn pair ->
      case String.split(String.trim(pair), ":", parts: 2) do
        [scope, id] when scope != "" and id != "" -> [{String.trim(scope), String.trim(id)}]
        _malformed -> []
      end
    end)
    |> Enum.uniq()
  end

  @doc """
  Whether this was compiled for the test suite. Read at compile time — `Mix`
  does not exist in a release, so a runtime `Mix.env/0` crashes in production.
  """
  def test?, do: @compiled_env == :test

  @doc """
  Whether this was compiled for production. Same compile-time read as
  `test?/0`, and used where a missing setting should be tolerated locally but
  refused on a public host — see `ConnectixWeb.Plugs.BasicAuth`.
  """
  def prod?, do: @compiled_env == :prod

  defp default_data_dir do
    case @compiled_env do
      :test ->
        partition = System.get_env("MIX_TEST_PARTITION", "")
        Path.join([System.tmp_dir!(), "connectix_test#{partition}", "user_files"])

      _dev_or_prod ->
        Path.join(File.cwd!(), "user_files")
    end
  end

  # ── Introspection ───────────────────────────────────────────────────────────

  @doc """
  The resolved configuration as ordered `{label, value}` rows, with every
  secret redacted to its presence.

  For answering "is this actually set on the box?" without reading a systemd
  unit or echoing a key into a log. Redaction is by construction rather than by
  a list of names to keep updated: a credential is reported as `"set"` or
  `"not set"` and its value never leaves the process.
  """
  @spec summary() :: [{String.t(), String.t()}]
  def summary do
    [
      {"ANTHROPIC_API_KEY", presence(anthropic_api_key())},
      {"OPENAI_KEY", presence(openai_api_key())},
      {"GOOGLE_API_KEY", presence(google_api_key())},
      {"XAI_API_KEY", presence(xai_api_key())},
      {"CONNECTIX_MODEL", main_model()},
      {"CONNECTIX_TITLE_MODEL", title_model()},
      {"CONNECTIX_THINKING_BUDGET", to_string(thinking_budget_tokens())},
      {"CONNECTIX_API_KEY", presence(api_key())},
      {"CONNECTIX_API_USER_EMAIL", api_user_email() || "not set"},
      {"PORTAL_UI_USER/PORTAL_UI_PASS", if(basic_auth(), do: "set", else: "not set")},
      {"CONNECTIX_ENVIRONMENTS", Enum.map_join(environments(), ",", & &1.name)},
      {"CONNECTIX_SIP_USER/PASS/DOMAIN", if(sip_credentials(), do: "set", else: "not set")},
      {"DEEPGRAM_API_KEY/CARTESIA_API_KEY", if(voice_configured?(), do: "set", else: "not set")},
      {"STUN_URLS", if(stun_urls() == [], do: "not set", else: Enum.join(stun_urls(), ","))},
      {"TURN_URLS", if(turn_urls() == [], do: "not set", else: Enum.join(turn_urls(), ","))},
      {"CONNECTIX_DATA_DIR", data_dir()},
      {"MNESIA_DIR", mnesia_dir()},
      {"EVENTS_DIR", events_dir()},
      {"EVENTS_DB", events_db() || "not set"},
      {"EVENT_STREAMS", event_streams_summary()},
      {"WHATSAPP_ACCESS_TOKEN", presence(whatsapp_access_token())},
      {"WHATSAPP_PHONE_NUMBER_ID", presence(whatsapp_phone_number_id())},
      {"WHATSAPP_APP_SECRET", presence(whatsapp_app_secret())},
      {"WHATSAPP_VERIFY_TOKEN", presence(whatsapp_verify_token())},
      {"WHATSAPP_OWNER_EMAIL", whatsapp_owner_email() || "not set"},
      {"WHATSAPP_BOT_SLUG", whatsapp_bot_slug()},
      {"FIREBERRY_TOKEN", presence(fireberry_token())},
      {"VA_INFLUXDB_HOST", influxdb_host()},
      {"VA_INFLUXDB_PORT", to_string(influxdb_port())},
      {"VA_INFLUXDB_DATABASE", influxdb_database()},
      {"VA_MONITOR_TOKEN", presence(monitor_token())}
    ]
  end

  defp event_streams_summary do
    case event_streams() do
      [] -> "not set"
      streams -> Enum.map_join(streams, ",", fn {scope, id} -> "#{scope}:#{id}" end)
    end
  end

  defp presence(value) when is_binary(value), do: "set"
  defp presence(_absent), do: "not set"

  # ── Reading the environment ─────────────────────────────────────────────────

  @doc """
  A non-empty environment variable, or `nil`.

  Exposed because `config/*.exs` needs the same empty-string-is-absent rule
  while running before this application's code is loaded.
  """
  @spec env(String.t()) :: String.t() | nil
  def env(key) do
    case System.get_env(key) do
      value when is_binary(value) and value != "" -> value
      _unset_or_blank -> nil
    end
  end

  @doc """
  An integer environment variable inside `range`, else `default`.

  Unparseable and out-of-range values fall back rather than raise. A typo in
  one tuning knob should not stop a node from booting, and the default is by
  definition a value the app runs correctly on.
  """
  @spec int_env(String.t(), integer(), Range.t()) :: integer()
  def int_env(key, default, range) do
    with value when is_binary(value) <- env(key),
         {number, ""} <- Integer.parse(value),
         true <- number in range do
      number
    else
      _unset_unparseable_or_out_of_range -> default
    end
  end

  defp raise_missing(key) do
    raise """
    environment variable #{key} is missing.

    Every setting this app reads is listed in Connectix.Config, and named in
    .envrc.example. In development it belongs in .env; in a release, in the
    environment the unit is started with — see config/xamal.exs.
    """
  end
end
