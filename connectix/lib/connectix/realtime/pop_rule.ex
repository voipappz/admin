defmodule Connectix.Realtime.PopRule do
  @moduledoc """
  The screen-pop rule, loaded from `priv/pocketflow/screen_pop.yaml`.

  PocketFlow's shape — triggers and a graph of steps — as data, so which events
  pop and which URL opens is a file change rather than a deploy of new logic.
  What a rule may *do* is still fixed: `Instruction`/`ScreenPop` execute only
  the `screen_pop_pop` node, and a rule naming anything else is refused. That
  boundary is the point — a rule file must not be able to make the portal issue
  a browser command it has no executor for.

  Read once and cached in `:persistent_term`, because it is consulted on every
  event on the state stream and it does not change while the node runs.
  A deployment mounts its customer's file at `/rules/screen_pop.yaml`;
  `reload/0` drops the cache.
  """

  require Logger

  @key {__MODULE__, :rule}
  @default_path "pocketflow/screen_pop.yaml"
  # Fifteen minutes. See `nats_deadman_ms/0` for why this number and not a
  # tighter one.
  @default_deadman_ms 900_000
  # Where the rule came from, carried inside the cached rule so `source/0`
  # costs the same read as everything else rather than stat-ing the disk again.
  @source_key "__source__"
  # WHERE A DEPLOYMENT MOUNTS ITS CUSTOMER'S RULE. Fixed, and not configurable
  # by an environment variable on purpose — see `customer_path/0`.
  @default_customer_path "/rules/screen_pop.yaml"

  # Used when the file is missing or unreadable. Deliberately the same triggers
  # the file ships with: a deployment that loses the file keeps popping rather
  # than silently going quiet, which is the failure nobody notices.
  @fallback %{
    "triggers" => [
      "bridge-agent-start"
    ],
    "agent_states" => ["In a queue call"],
    "agent_fields" => ["meta.CC-Agent", "user_uuid", "data.user_uuid"],
    # NO `record_url`. It used to default to one customer's CRM endpoint, which
    # meant any deployment without a rule file popped agents at somebody else's
    # system — a wrong answer delivered confidently, which is worse than no
    # answer. A deployment that has not been told where its CRM is must refuse
    # to pop and say why.
    "profile" => %{"unknown_caller" => "0000"}
  }

  @doc "The rule, read once and cached."
  def rule do
    case :persistent_term.get(@key, nil) do
      nil ->
        loaded = load()
        :persistent_term.put(@key, loaded)
        loaded

      cached ->
        cached
    end
  end

  @doc false
  def reload do
    :persistent_term.erase(@key)
    rule()
  end

  @doc "Event names that may pop."
  def triggers, do: Map.get(rule(), "triggers", [])

  @doc """
  Whether the rule names this event at all.

  This is the gate on the firehose. A live switch delivers thousands of
  CallEvents frames a minute — `agent-offering`, `bridge-agent-fail`,
  `agent-state-change`, `member-queue-end` — and the rule names one of them.
  Everything else is dropped HERE, before it is stored, before the agent
  lookup, before any log line: evaluating and then logging "no pop — not one
  of [...]" for every frame of every agent was most of the portal's CPU and
  all of its log volume, and it never changed the outcome.
  """
  @spec trigger?(term()) :: boolean()
  def trigger?(event) when is_map(event) do
    case event_name(event) do
      nil -> false
      name -> name in triggers()
    end
  end

  def trigger?(_event), do: false

  @doc "The event's name, in either spelling the wire uses."
  def event_name(%{"event" => name}) when is_binary(name) and name != "", do: name
  def event_name(%{"action" => name}) when is_binary(name) and name != "", do: name
  def event_name(_event), do: nil

  @doc """
  The broker settings, from the rule file's `nats:` block.

      nats:
        url: ${NATS_URL}
        subjects:
          - node:test1
          - state.>

  **`${VAR}` is expanded from the environment**, and that is how a credential
  stays out of a file that lives in git. The URL carries a password; writing it
  literally here would commit it. A value with no `${}` is used verbatim, which
  is right for a subject list and for a broker that needs no credential.

  An unset variable expands to nothing, and an empty setting is the same as an
  absent one — the same rule `Connectix.Config` follows, because a shipping
  tool writes `FOO=` for a value it does not have.
  """
  @spec nats() :: %{url: String.t() | nil, subjects: [String.t()]}
  def nats do
    block = rule() |> Map.get("nats", %{}) |> normalise_block()

    %{
      url: block |> Map.get("url") |> expand() |> presence(),
      subjects:
        block
        |> Map.get("subjects", [])
        |> List.wrap()
        |> Enum.map(&(&1 |> to_string() |> expand() |> String.trim()))
        |> Enum.reject(&(&1 == ""))
        |> Enum.uniq(),
      deadman_ms: block |> Map.get("deadman") |> duration_ms() |> default_deadman()
    }
  end

  @doc """
  How long the broker may be silent before the portal calls it dead, in
  milliseconds. `0` disables the check.

  Subscribed-and-silent is the failure this exists for, and it is the one
  nothing else reports: the socket is open, `status/0` says `{:subscribed, …}`,
  `/health` is green and not one event is arriving. A poll cannot see it and
  neither can a person, until an agent mentions that their screen stopped
  popping.

  ## Choosing the number

  It is a bet about the quietest legitimate stretch this deployment has. Too
  short and it fires every night, which is worse than not having it — an alarm
  that cries wolf is an alarm nobody reads. Too long and a dead feed goes
  unnoticed for that long. #{div(@default_deadman_ms, 60_000)} minutes is the
  default because this switch publishes agent state continuously while anyone
  is logged in, so a gap that size means something is wrong rather than quiet.

  A deployment whose switch genuinely goes silent overnight should raise it or
  set `deadman: off`, not lower the log level.
  """
  @spec nats_deadman_ms() :: non_neg_integer()
  def nats_deadman_ms, do: nats().deadman_ms

  # Unset in the file falls back to the environment, then to the default. `off`
  # is a deliberate 0 and must survive both.
  defp default_deadman(nil) do
    case System.get_env("NATS_DEADMAN") |> presence() |> duration_ms() do
      nil -> @default_deadman_ms
      configured -> configured
    end
  end

  defp default_deadman(configured), do: configured

  # `15m`, `900s`, `900000ms`, `2h`, or a bare number meaning SECONDS. Bare
  # seconds because a duration in a config file is a duration, and the one
  # thing nobody writes by hand is milliseconds.
  defp duration_ms(nil), do: nil
  defp duration_ms(value) when is_integer(value), do: value * 1_000

  defp duration_ms(value) when is_binary(value) do
    case value |> String.trim() |> String.downcase() do
      "" -> nil
      disabled when disabled in ["off", "never", "none", "false"] -> 0
      duration -> scaled(Regex.run(~r/^(\d+)\s*(ms|s|m|h)?$/, duration))
    end
  end

  defp duration_ms(_unusable), do: nil

  defp scaled(nil), do: nil
  defp scaled([_whole, number]), do: String.to_integer(number) * 1_000
  defp scaled([_whole, number, "ms"]), do: String.to_integer(number)
  defp scaled([_whole, number, "s"]), do: String.to_integer(number) * 1_000
  defp scaled([_whole, number, "m"]), do: String.to_integer(number) * 60_000
  defp scaled([_whole, number, "h"]), do: String.to_integer(number) * 3_600_000

  @doc """
  The NATS subjects to subscribe to, from the rule file.

  Empty when the file names none, and `Realtime.EventPipeline` then falls back
  to `NATS_SUBJECTS`. The two gates are deliberately in one file: `subjects`
  decides what ARRIVES and `triggers` decides what POPS out of what arrived, so
  a subject named nowhere looks exactly like a switch with nothing to say.
  """
  @spec subjects() :: [String.t()]
  def subjects, do: nats().subjects

  @doc """
  Agent ids named explicitly in the rule file.

      agents:
        agent@example.com: 23c5e4f4-8e1d-4878-9587-835e4e06ee19
        be5bc5f0-feb3-4c96-a370-3219f7ede250:
          - first-powerlink
          - second-powerlink

  **This is the mapping the whole screen pop hinges on**, written down instead
  of looked up. Normally `Realtime.AgentIdentity` reads `profile.powerlink_token`
  off the user record at connect, which is right in production and unhelpful
  the moment you want to test: a user whose record has no token yet is
  unmappable, and the symptom is silence.

  ## The key can be an email or a portal uuid, and they cost differently

  **A uuid needs nothing.** It is the one identity the token carries, so the
  portal knows it the instant the socket opens and the mapping applies with no
  request to anyone.

  **An email needs the user record.** The login JWT carries `user_uuid`, `exp`
  and `issues` and no email, so the portal cannot know an address until it has
  fetched the record — which is the very call an email key is usually written
  to avoid. It is still worth having, because an address is what a person can
  actually write down, but it does not remove the lookup.

  Ids here are ADDED to whatever the record supplies, never instead of it, so
  naming one user does not turn the lookup off for everyone else. A single
  string and a list both work, because one id is the common case.
  """
  @spec agents() :: %{optional(String.t()) => [String.t()]}
  def agents do
    Map.new(agent_entries(), fn {identity, entry} -> {identity, entry.ids} end)
  end

  @doc """
  The full `agents:` block, each entry as `%{ids: [...], password: binary | nil}`.

  Two shapes are accepted, because one id is the common case and a login needs
  more than an id:

      agents:
        "661@phk.com": 2b79698e-...            # just the mapping
        "662@phk.com":
          powerlink: cb1b0a46-...
          password: "..."                      # and a way to sign in
  """
  @spec agent_entries() :: %{optional(String.t()) => %{ids: [String.t()], password: String.t() | nil}}
  def agent_entries do
    rule()
    |> Map.get("agents", %{})
    |> normalise_block()
    |> Map.new(fn {identity, value} ->
      # Keys are stored lowercased so an email matches however it was typed;
      # a uuid is already lowercase, so nothing else changes.
      {identity |> to_string() |> String.downcase(), entry(value)}
    end)
  end

  @doc "One agent's entry, by email or uuid, or nil."
  @spec agent_entry(String.t() | nil) :: %{ids: [String.t()], password: String.t() | nil} | nil
  def agent_entry(identity) when is_binary(identity) and identity != "",
    do: Map.get(agent_entries(), String.downcase(identity))

  def agent_entry(_identity), do: nil

  defp entry(%{} = map) do
    %{
      ids: map |> Map.get("powerlink", Map.get(map, "ids")) |> id_list(),
      # EXPANDED, so a credential is NAMED here and stored in the environment.
      # Written literally it is committed, and a password in git is a password
      # forever — the history keeps it after the file stops carrying it.
      password: map |> Map.get("password") |> expand() |> presence()
    }
  end

  defp entry(value), do: %{ids: id_list(value), password: nil}

  defp id_list(value) do
    value
    |> List.wrap()
    |> Enum.map(&(&1 |> to_string() |> String.trim()))
    |> Enum.reject(&(&1 == ""))
    |> Enum.uniq()
  end

  @doc """
  The ids named for one user, by any identity the caller happens to hold.

  Every key is tried, so `agents_for("u-1", "agent@example.com")` matches a
  block keyed either way. Emails are compared case-insensitively, because an
  address written in a config file and one stored by the API routinely differ
  in case and nobody means them to be different people.
  """
  @spec agents_for(String.t() | nil, String.t() | nil) :: [String.t()]
  def agents_for(user_uuid, email \\ nil) do
    named = agents()

    [user_uuid, email]
    |> Enum.flat_map(fn
      key when is_binary(key) and key != "" ->
        Map.get(named, key) || Map.get(named, String.downcase(key)) || []

      _absent ->
        []
    end)
    |> Enum.uniq()
  end

  @doc """
  Whether this id is one the rule file names as an agent.

  The login mints a token whose `user_uuid` IS the powerlink id, so the
  identity on the socket and the identity on the wire are the same value. This
  is how that is recognised without a lookup: an id that appears as a
  powerlink for any agent is an agent id, whoever is holding it.

  Without it the socket registers nothing, every `state.user.<id>` frame is
  dropped as unattributable, and no pop ever fires — silently, because an
  unclaimed id is indistinguishable from an agent who is not signed in.
  """
  @spec agent_id?(String.t() | nil) :: boolean()
  def agent_id?(id) when is_binary(id) and id != "" do
    down = String.downcase(id)
    Enum.any?(agent_entries(), fn {_identity, %{ids: ids}} -> down in Enum.map(ids, &String.downcase/1) end)
  end

  def agent_id?(_id), do: false

  @doc """
  Every id the agent owning this one answers to.

  An entry may list more than one id, because an agent can be named differently
  in different places — the identity the portal's token carries, and whatever
  the switch puts in `CC-Agent`. Given any one of them this returns the whole
  set, so registering an agent registers every name they answer to rather than
  just the one that happened to be on the token.
  """
  @spec ids_for(String.t() | nil) :: [String.t()]
  def ids_for(id) when is_binary(id) and id != "" do
    down = String.downcase(id)

    Enum.find_value(agent_entries(), [], fn {_identity, %{ids: ids}} ->
      if down in Enum.map(ids, &String.downcase/1), do: ids
    end)
  end

  def ids_for(_id), do: []

  @doc "The broker URL from the rule file, or nil."
  @spec nats_url() :: String.t() | nil
  def nats_url, do: nats().url

  defp normalise_block(%{} = block), do: block
  defp normalise_block(_not_a_map), do: %{}

  # `${VAR}`, anywhere in the value, replaced by the environment. An unset
  # variable becomes empty rather than the literal text, so a half-configured
  # file fails as "not set" instead of as a hostname called "${NATS_URL}".
  defp expand(nil), do: nil

  defp expand(value) when is_binary(value) do
    Regex.replace(~r/\$\{([A-Z0-9_]+)\}/, value, fn _whole, name ->
      System.get_env(name) || ""
    end)
  end

  defp expand(value), do: to_string(value)

  defp presence(value) when is_binary(value) do
    case String.trim(value) do
      "" -> nil
      trimmed -> trimmed
    end
  end

  defp presence(_absent), do: nil

  @doc """
  Agent states that count as "on a call". Empty means every state passes, which
  is what a rule that omits the key gets.
  """
  def agent_states, do: Map.get(rule(), "agent_states", [])

  @doc "Where to look for the agent id, in priority order."
  def agent_fields, do: Map.get(rule(), "agent_fields", [])

  @doc "The URL template, with `{phone}` and `{call_id}` unfilled."
  # THE YAML IS THE SOURCE OF TRUTH, and `SCREEN_POP_URL` is gone. An env
  # override for one field meant the deployed rule file could be read in full
  # and still not be what the portal was doing — the file said one CRM and the
  # container's environment said another, with nothing in either naming the
  # other. The customer file is the one place to look.
  def record_url, do: get_in(rule(), ["profile", "record_url"])

  @doc "What to use as the caller number when the event carries none."
  def unknown_caller,
    do: get_in(rule(), ["profile", "unknown_caller"]) || "0000"

  @doc """
  Read `field` out of `event` by a dotted path, so the rule file can name
  `meta.CC-Agent` without the code knowing that shape in advance.
  """
  def dig(event, path) when is_map(event) and is_binary(path) do
    path
    |> String.split(".")
    |> Enum.reduce(event, fn
      _segment, nil -> nil
      segment, acc when is_map(acc) -> Map.get(acc, segment)
      _segment, _acc -> nil
    end)
    |> case do
      value when is_binary(value) and value != "" -> value
      _ -> nil
    end
  end

  def dig(_event, _path), do: nil

  @doc """
  Which files this rule was actually assembled from.

  `/health` reports it, because "no customer rule is mounted" is otherwise
  indistinguishable from a quiet switch: the portal keeps running, logs in
  nobody, subscribes to nothing and pops for no one.
  """
  @spec source() :: %{
          shared: String.t(),
          customer: String.t() | nil,
          customer_path: String.t() | nil,
          customer_loaded?: boolean()
        }
  def source, do: Map.fetch!(rule(), @source_key)

  # THREE LAYERS, and each says only what the one beneath it does not.
  #
  #   @fallback                            compiled in; what this app does
  #                                        with no files at all
  #   priv/pocketflow/screen_pop.yaml      the SHARED policy — which events
  #                                        pop, which states count, where the
  #                                        agent id lives. The same for every
  #                                        customer, and the only copy of it.
  #   priv/pocketflow/customers/<name>.yaml  ONLY what differs — this site's
  #                                        subjects, its agents, its CRM URL.
  #
  # Layering rather than replacing is the whole point. When a customer file WAS
  # the whole rule, every customer carried its own copy of `triggers`,
  # `agent_fields`, `agent_states` and `steps` — so correcting the trigger list
  # meant correcting it once per customer, and the copy somebody missed failed
  # the way everything here fails: silently, as calls that stop popping.
  defp load do
    shared_path = shared_path()
    shared = Map.merge(@fallback, read(shared_path, "shared rule"))

    {customer, customer_path, customer_rule} = read_customer()

    shared
    |> overlay(customer_rule)
    |> Map.put(@source_key, %{
      shared: shared_path,
      customer: customer,
      customer_path: customer_path,
      customer_loaded?: customer_rule != nil
    })
  end

  defp shared_path, do: resolve(:shared_rule, {:priv, @default_path})

  @doc """
  Where this container expects to find its customer's rule.

  `#{@default_customer_path}`, and NOT an environment variable. The deployment
  mounts that site's file there read-only; the file that is present IS the
  customer, so there is no name to keep in step with a path and no way for the
  two to disagree.

  An env selector had the failure this avoids: the variable named a customer,
  the image contained the files, and nothing checked that the name matched one.
  A typo, or a customer added to a deploy config before its file was merged,
  produced a portal that started cleanly, signed nobody in and consumed
  nothing — which reads from outside as a switch that has gone quiet.
  """
  @spec customer_path() :: String.t()
  def customer_path, do: resolve(:customer_rule, @default_customer_path)

  # `{:priv, relative}` resolves inside the release at CALL time. A literal
  # path under priv cannot be written into config, because the release puts it
  # at `/app/lib/connectix-<version>/priv` and the version moves.
  defp resolve(key, default) do
    case Application.get_env(:connectix, key, default) do
      {:priv, relative} -> Path.join(:code.priv_dir(:connectix), relative)
      path when is_binary(path) -> path
    end
  end

  # A mounted file is absent on a deployment that has not been given one, and
  # that is not an error — it is a portal with the shared policy and no
  # customer, which `/health` reports as `screen_pop: down` because it can
  # sign nobody in. Unreadable or empty IS an error: somebody mounted
  # something and it is not a rule.
  defp read_customer do
    path = customer_path()

    cond do
      not File.exists?(path) ->
        {nil, path, nil}

      true ->
        case read(path, "customer rule") do
          %{} = rule when map_size(rule) > 0 ->
            {Map.get(rule, "customer") || Path.basename(path, ".yaml"), path, rule}

          _empty ->
            Logger.error(
              "screen pop: the customer rule mounted at #{path} is empty or unreadable — " <>
                "this portal has no agents and no subjects of its own"
            )

            {nil, path, nil}
        end
    end
  end

  defp read(path, what) do
    with true <- File.exists?(path),
         {:ok, %{} = parsed} <- YamlElixir.read_from_file(path) do
      Logger.info("screen pop: #{what} loaded from #{path}")
      parsed
    else
      false ->
        Logger.warning("screen pop: no #{what} at #{path}")
        %{}

      {:error, reason} ->
        Logger.error("screen pop: #{what} at #{path} is unreadable (#{inspect(reason)})")
        %{}
    end
  end

  # One level down, which is as deep as this file goes: a customer naming
  # `profile.record_url` must not drop the shared `profile.unknown_caller`
  # beside it, and one naming `nats.subjects` must not drop `nats.url`.
  defp overlay(base, nil), do: base

  defp overlay(base, customer) do
    Map.merge(base, customer, fn
      _key, %{} = beneath, %{} = above -> Map.merge(beneath, above)
      _key, _beneath, above -> above
    end)
  end
end
