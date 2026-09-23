defmodule Connectix.Realtime.FreeSwitch.Frame do
  @moduledoc """
  One FreeSWITCH event, in the frame shape every consumer already reads.

  The screen pop, the event store and the rule file were written against the
  frames the va-crystal node relayed: `action` names the event, `meta` holds
  FreeSWITCH's own headers (`CC-Agent`, `CC-Member-CID-Number`,
  `CC-Agent-State`), `user_uuid` is the node's copy of the agent id,
  `caller_id_number` the caller, and `id` — built as
  `<action>_<session>_<member>_<agent>` — is what the pop dedupes on. Reading
  the switch directly must not move any of that, so this module produces that
  shape from the raw headers and nothing downstream changes: not
  `ScreenPop`, not `Events`, and not one customer's yaml.

  Pure. The processors run it, not the producer, so the translation is spread
  across schedulers the way the JSON decode used to be.

  ## The mapping

  | frame key | from the event |
  |---|---|
  | `action` | `CC-Action` on a `callcenter::info` event; another `CUSTOM` event's `Event-Subclass`; else `Event-Name` verbatim |
  | `meta` | every header, so `meta.CC-Agent` and the store's `variable_*` trim keep working |
  | `user_uuid` | `CC-Agent` |
  | `caller_id_number` | `CC-Member-CID-Number`, else `Caller-Caller-ID-Number` |
  | `uuid` | `Unique-ID`, else `CC-Member-Session-UUID` |
  | `id` | `<action>_<CC-Member-Session-UUID>_<CC-Member-UUID>_<CC-Agent>` when all three are present, else the switch's `Event-UUID` |
  | `create_date` | `Event-Date-Timestamp`, epoch microseconds, as the store already reads it |
  | `type` | `"call"` |

  A key whose source header is absent is left out rather than set to nil, so
  `Map.get/2` and the rule file's `dig/2` see "not there" and not a value.
  """

  @type headers :: %{optional(String.t()) => String.t()}

  @callcenter "callcenter::info"

  @doc "The frame for one event, given its headers or the `SwitchX.Event`."
  @spec from_esl(headers() | %{headers: headers()}) :: map()
  def from_esl(%{headers: headers}) when is_map(headers), do: from_esl(headers)

  def from_esl(headers) when is_map(headers) do
    action = action(headers)

    %{
      "action" => action,
      "type" => "call",
      "meta" => headers,
      "user_uuid" => header(headers, "CC-Agent"),
      "caller_id_number" =>
        header(headers, "CC-Member-CID-Number") || header(headers, "Caller-Caller-ID-Number"),
      "uuid" => header(headers, "Unique-ID") || header(headers, "CC-Member-Session-UUID"),
      "id" => id(action, headers),
      "create_date" => timestamp(header(headers, "Event-Date-Timestamp"))
    }
    |> Enum.reject(fn {_key, value} -> is_nil(value) end)
    |> Map.new()
  end

  @doc """
  What the event is called downstream.

  `bridge-agent-start`, `agent-offering`, `agent-state-change` — the
  `CC-Action` of a callcenter event — is what the rule file's `triggers:`
  name, so it is the action verbatim. Any other event keeps FreeSWITCH's own
  name, which is what an operator reading the store expects to find.
  """
  @spec action(headers()) :: String.t() | nil
  def action(headers) when is_map(headers) do
    case {header(headers, "Event-Subclass"), header(headers, "CC-Action")} do
      {@callcenter, cc_action} when is_binary(cc_action) -> cc_action
      {subclass, _} when is_binary(subclass) -> subclass
      _plain -> header(headers, "Event-Name")
    end
  end

  # THE DEDUPE KEY. `ScreenPop` pops once per id, so this has to name the same
  # fact the node's id named — one (event, call, member, agent) — and nothing
  # more specific, or a retried event pops twice; nothing less, or two agents
  # offered one call share a key and the second never pops.
  defp id(action, headers) when is_binary(action) do
    with session when is_binary(session) <- header(headers, "CC-Member-Session-UUID"),
         member when is_binary(member) <- header(headers, "CC-Member-UUID"),
         agent when is_binary(agent) <- header(headers, "CC-Agent") do
      Enum.join([action, session, member, agent], "_")
    else
      _not_a_callcenter_event -> header(headers, "Event-UUID")
    end
  end

  defp id(_no_action, headers), do: header(headers, "Event-UUID")

  defp timestamp(nil), do: nil

  defp timestamp(value) when is_binary(value) do
    case Integer.parse(value) do
      {micros, ""} -> micros
      _not_a_number -> nil
    end
  end

  defp header(headers, key) do
    case Map.get(headers, key) do
      value when is_binary(value) and value != "" -> value
      _absent -> nil
    end
  end
end
