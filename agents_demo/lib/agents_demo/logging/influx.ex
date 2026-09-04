defmodule Connectix.Logging.Influx do
  @moduledoc """
  Ships this portal's log lines to InfluxDB 3, the way va-crystal's node ships
  its metrics (`node/influx/writer.cr`): same environment variables, same
  `/api/v3/write_lp` endpoint with a Bearer token, same best-effort contract.

  This is an Erlang `:logger` handler (`:logger.add_handler/3`), installed by
  `Connectix.Logging.Influx.Writer` at boot and ONLY when `VA_MONITOR_TOKEN`
  is set — the node's `Influx.configured?` gate. Unset, nothing here runs:
  `children/0` is empty and no handler exists, so a deployment that has never
  heard of InfluxDB boots exactly as it did before this module existed.

  It is ADDITIVE, never a replacement. Production runs under Kamal, which
  collects the container's stdout (`kamal app logs` is `docker logs`), so the
  `:default` console handler keeps emitting every line exactly as today with
  this one installed beside it; InfluxDB is for querying, stdout is what the
  operator reads on the box, and both must exist. Nothing in this module
  removes a handler it did not add, changes the console handler's config, or
  touches the primary level.

  Each event becomes one line-protocol line:

      portal_log,app=portal,level=info,node=portal@host message="...",module="...",function="...",request_id="..." <ns>

  `to_line/1` is pure and exported so the escaping — the part that, wrong,
  makes InfluxDB reject a whole batch because one message contained a quote —
  can be tested without a writer.

  `log/2` never raises and never blocks. It runs in whatever process called
  `Logger`, so a slow or dead InfluxDB must not be felt there: the line is
  built and handed to the writer with a cast, and the writer alone talks HTTP.
  A handler that raised would be removed by `:logger` — and a handler that
  blocked would turn an InfluxDB outage into a portal outage, one stalled
  request at a time.
  """

  alias Connectix.Config
  alias Connectix.Logging.Influx.Writer

  require Logger

  @measurement "portal_log"
  @handler_id :influx

  # Same cap as Logger's default `truncate:`. A line is one log event; an
  # inspect of a large struct at debug level should not become a 2 MB batch
  # that InfluxDB refuses and takes 499 good lines down with it.
  @max_message_bytes 8096

  @doc "The `:logger` handler id this module installs under."
  @spec handler_id() :: atom()
  def handler_id, do: @handler_id

  @doc """
  Child specs for the supervision tree — empty when `VA_MONITOR_TOKEN` is unset.

  Mirrors `Realtime.Bus.children/0`: an absent InfluxDB is a configuration
  state, not a crash. Most deployments will not have one, so this is `info`,
  not a warning — a warning that fires on every boot everywhere is one that
  gets tuned out before it matters.
  """
  @spec children() :: [Supervisor.child_spec() | {module(), term()} | module()]
  def children do
    if Config.influx_configured?() do
      [Writer]
    else
      Logger.info("Influx: VA_MONITOR_TOKEN not set — logs stay on stdout only")
      []
    end
  end

  # ── :logger handler callbacks ───────────────────────────────────────────────

  @doc false
  # Handler config `:config` carries the writer's registered name so a test can
  # install this handler pointed at a writer of its own. Absent, the app's.
  def log(event, %{config: config}) when is_map(config) do
    deliver(event, Map.get(config, :writer, Writer))
  end

  def log(event, _handler_config), do: deliver(event, Writer)

  defp deliver(event, writer) do
    # `Writer.enqueue/2` is a cast: it does not care whether the writer is
    # alive. That matters during shutdown, when the supervisor has stopped the
    # writer and later children still log on their way down.
    Writer.enqueue(writer, to_line(event))
    :ok
  rescue
    # A handler that raises gets removed by :logger and the loss is silent —
    # worse than dropping the one event whose metadata we could not read.
    _malformed_event -> :ok
  end

  # ── Line protocol ───────────────────────────────────────────────────────────

  @doc """
  One `:logger` event as one line-protocol line, without a trailing newline.

  Tags: `app=portal`, `level`, `node`. Fields: `message`, plus `module` and
  `function` when the event carries `mfa` and `request_id` when Plug put one
  in the metadata. The timestamp is the event's `time` (microseconds, as
  `:logger` stamps it) in nanoseconds; an event without one is stamped now.
  """
  @spec to_line(:logger.log_event() | map()) :: String.t()
  def to_line(%{level: level, msg: msg} = event) do
    meta = Map.get(event, :meta, %{})

    tags =
      [
        {"app", "portal"},
        {"level", Atom.to_string(level)},
        {"node", Atom.to_string(node())}
      ]
      |> Enum.map_join(",", fn {k, v} -> escape_tag(k) <> "=" <> escape_tag(v) end)

    fields =
      [{"message", message(msg, meta)} | optional_fields(meta)]
      |> Enum.map_join(",", fn {k, v} -> escape_tag(k) <> "=" <> string_field(v) end)

    @measurement <> "," <> tags <> " " <> fields <> " " <> Integer.to_string(timestamp_ns(meta))
  end

  defp optional_fields(meta) do
    mfa =
      case Map.get(meta, :mfa) do
        {mod, fun, arity} ->
          [{"module", inspect(mod)}, {"function", "#{fun}/#{arity}"}]

        _absent ->
          []
      end

    request_id =
      case Map.get(meta, :request_id) do
        nil -> []
        id -> [{"request_id", IO.chardata_to_string(id)}]
      end

    mfa ++ request_id
  end

  # Elixir's translator runs as a primary filter, so by the time an event
  # reaches a handler an Elixir or OTP report has already become a string.
  # The other shapes are what a raw Erlang caller can still send.
  defp message({:string, chardata}, _meta) do
    chardata |> IO.chardata_to_string() |> truncate()
  end

  defp message({:report, report}, %{report_cb: cb}) when is_function(cb, 1) do
    {format, args} = cb.(report)
    message({format, args}, %{})
  end

  defp message({:report, report}, %{report_cb: cb}) when is_function(cb, 2) do
    cb.(report, %{depth: :unlimited, chars_limit: @max_message_bytes, single_line: true})
    |> IO.chardata_to_string()
    |> truncate()
  end

  defp message({:report, report}, _meta), do: report |> inspect() |> truncate()

  defp message({format, args}, _meta) when is_list(args) do
    format |> :io_lib.format(args) |> IO.chardata_to_string() |> truncate()
  rescue
    # A bad format string is the caller's bug; recording it beats losing it.
    _ -> inspect({format, args}) |> truncate()
  end

  defp message(other, _meta), do: other |> inspect() |> truncate()

  defp truncate(string) when byte_size(string) > @max_message_bytes do
    # binary_part could split a UTF-8 sequence; String.slice cannot.
    String.slice(string, 0, @max_message_bytes) <> "…"
  end

  defp truncate(string), do: string

  defp timestamp_ns(%{time: microseconds}) when is_integer(microseconds), do: microseconds * 1_000
  defp timestamp_ns(_meta), do: System.os_time(:nanosecond)

  # Tag keys, tag values and field keys: comma, equals and space end a token in
  # line protocol, so each gets a backslash. A newline would end the LINE, and
  # nothing legitimately puts one in a tag, so it is dropped rather than escaped.
  defp escape_tag(value) do
    value
    |> String.replace(["\n", "\r"], "")
    |> String.replace(["\\", ",", "=", " "], fn char -> "\\" <> char end)
  end

  # String field values: only backslash and double quote are escapes inside the
  # quotes. A raw newline still ends the line, so it becomes the two characters
  # `\n` — which InfluxDB stores as-is and a human reads as the newline it was,
  # keeping a stack trace on one line without flattening it to a run of spaces.
  defp string_field(value) do
    escaped =
      value
      |> String.replace("\\", "\\\\")
      |> String.replace("\"", "\\\"")
      |> String.replace("\r\n", "\\n")
      |> String.replace(["\n", "\r"], "\\n")

    "\"" <> escaped <> "\""
  end
end
