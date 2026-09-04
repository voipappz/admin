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

  @doc """
  Model backing a conversation (`AGENTS_DEMO_MODEL`, default
  `#{@default_main_model}`). A bot's own `model` overrides it per conversation;
  this is the default a bot with none falls back to.
  """
  @spec main_model() :: String.t()
  def main_model, do: env("AGENTS_DEMO_MODEL") || @default_main_model

  @doc """
  Model that names conversations (`AGENTS_DEMO_TITLE_MODEL`, default
  `#{@default_title_model}`). Deliberately a smaller model than `main_model/0`:
  it runs once per conversation on a few hundred tokens and nobody reads its
  reasoning.
  """
  @spec title_model() :: String.t()
  def title_model, do: env("AGENTS_DEMO_TITLE_MODEL") || @default_title_model

  @doc """
  Extended-thinking budget in tokens (`AGENTS_DEMO_THINKING_BUDGET`, default
  #{@default_thinking_budget}). Anthropic requires at least 1024. The ceiling
  here is a cost bound, not a model limit — thinking is billed as output.
  """
  @spec thinking_budget_tokens() :: pos_integer()
  def thinking_budget_tokens,
    do: int_env("AGENTS_DEMO_THINKING_BUDGET", @default_thinking_budget, 1_024..200_000)

  # ── HTTP API ────────────────────────────────────────────────────────────────

  @doc """
  Bearer token for the public API (`AGENTS_DEMO_API_KEY`), or `nil`.

  With none the API refuses every request rather than running unauthenticated:
  an agent that can search the web and write files is not something to leave
  open by omission. Values under 16 bytes are treated as absent — a key short
  enough to guess is worse than no API at all, because it looks configured.
  """
  @spec api_key() :: String.t() | nil
  def api_key do
    case env("AGENTS_DEMO_API_KEY") do
      key when is_binary(key) and byte_size(key) >= 16 -> key
      _too_short_or_absent -> nil
    end
  end

  @doc """
  Email of the user API requests act as (`AGENTS_DEMO_API_USER_EMAIL`), or
  `nil`. Their scope keys every downstream query and the agent's own
  filesystem — the API is a way into the same app, not a way around its
  scoping. Set without `api_key/0` it does nothing, and vice versa.
  """
  @spec api_user_email() :: String.t() | nil
  def api_user_email, do: env("AGENTS_DEMO_API_USER_EMAIL")

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
  (`AGENTS_DEMO_DATA_DIR`).

  It must be an absolute path outside the release in production. A deploy
  replaces the release directory wholesale, so anything written inside it is
  destroyed by the next one, and the working directory of a systemd unit is not
  somewhere to keep user data either way.

  Unset it defaults to `user_files/` beside the project for development, and to
  a partition-suffixed temp directory under test so parallel runs cannot see
  each other's files.
  """
  @spec data_dir() :: String.t()
  def data_dir, do: env("AGENTS_DEMO_DATA_DIR") || default_data_dir()

  @doc """
  Directory holding Mnesia's durable tables (`MNESIA_DIR`).

  Defaults to `mnesia/` under `AGENTS_DEMO_DATA_DIR`, keeping all mutable state
  outside a release. Set it directly only when table files need a separate
  volume or filesystem.
  """
  @spec mnesia_dir() :: String.t()
  def mnesia_dir, do: env("MNESIA_DIR") || Path.join(data_dir(), "mnesia")

  @doc """
  Directory holding the DuckDB file of received cable events (`EVENTS_DIR`).

  Defaults to `events/` under `AGENTS_DEMO_DATA_DIR`, for the same reason
  `mnesia_dir/0` does: a deploy replaces the release directory wholesale.
  Overridden wholesale by `events_db/0` when that names a file directly.
  """
  @spec events_dir() :: String.t()
  def events_dir, do: env("EVENTS_DIR") || Path.join(data_dir(), "events")

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

  defp default_data_dir do
    case @compiled_env do
      :test ->
        partition = System.get_env("MIX_TEST_PARTITION", "")
        Path.join([System.tmp_dir!(), "agents_demo_test#{partition}", "user_files"])

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
      {"AGENTS_DEMO_MODEL", main_model()},
      {"AGENTS_DEMO_TITLE_MODEL", title_model()},
      {"AGENTS_DEMO_THINKING_BUDGET", to_string(thinking_budget_tokens())},
      {"AGENTS_DEMO_API_KEY", presence(api_key())},
      {"AGENTS_DEMO_API_USER_EMAIL", api_user_email() || "not set"},
      {"AGENTS_DEMO_DATA_DIR", data_dir()},
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
