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
  `SCREEN_POP_RULE` points at a different file; `reload/0` drops the cache.
  """

  require Logger

  @key {__MODULE__, :rule}
  @default_path "pocketflow/screen_pop.yaml"

  # Used when the file is missing or unreadable. Deliberately the same triggers
  # the file ships with: a deployment that loses the file keeps popping rather
  # than silently going quiet, which is the failure nobody notices.
  @fallback %{
    "triggers" => [
      "agent-state-change",
      "agent-offering",
      "bridge-agent-start",
      "user.state_change",
      "user.ringing",
      "user.answer"
    ],
    "agent_states" => [],
    "agent_fields" => ["meta.CC-Agent", "user_uuid", "data.user_uuid"],
    "profile" => %{
      "record_url" =>
        "https://pardeshk.moked-binaa.co.il/ims/system/?view=custom&module=moked-add&search_phone={phone}&callId={call_id}",
      "unknown_caller" => "0000"
    }
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
  Agent states that count as "on a call". Empty means every state passes, which
  is what a rule that omits the key gets.
  """
  def agent_states, do: Map.get(rule(), "agent_states", [])

  @doc "Where to look for the agent id, in priority order."
  def agent_fields, do: Map.get(rule(), "agent_fields", [])

  @doc "The URL template, with `{phone}` and `{call_id}` unfilled."
  def record_url do
    System.get_env("SCREEN_POP_URL") ||
      get_in(rule(), ["profile", "record_url"]) ||
      get_in(@fallback, ["profile", "record_url"])
  end

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

  defp load do
    path = System.get_env("SCREEN_POP_RULE") || Path.join(:code.priv_dir(:connectix), @default_path)

    with true <- File.exists?(path),
         {:ok, %{} = parsed} <- YamlElixir.read_from_file(path) do
      Logger.info("screen pop: rule loaded from #{path}")
      Map.merge(@fallback, parsed)
    else
      false ->
        Logger.warning("screen pop: no rule at #{path} — using the built-in default")
        @fallback

      {:error, reason} ->
        Logger.error(
          "screen pop: rule at #{path} is unreadable (#{inspect(reason)}) — using the built-in default"
        )

        @fallback
    end
  end
end
