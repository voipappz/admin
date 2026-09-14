defmodule Connectix.Tui.Panels do
  @moduledoc """
  The four panes. Each takes the model and a `Rect` and returns a widget.

  Kept in one module rather than one file per pane: `connectix.io/phone` needed
  thirteen panels for a softphone, this needs four, and four small functions in
  one file are easier to read than four files that each import the same three
  aliases.
  """

  alias Connectix.Realtime.Sessions
  alias Connectix.Tui.Model
  alias Connectix.Tui.View.{Block, Line, List, Paragraph, Span, Style, Text}

  @dim %Style{fg: :bright_black}
  @ok %Style{fg: :green}
  @bad %Style{fg: :red}
  @warn %Style{fg: :yellow}
  @head %Style{fg: :cyan, modifiers: [:bold]}

  @doc "Store totals and the cable's state — the two numbers that answer 'is it working'."
  def status(%Model{} = m, _rect) do
    stats = m.stats

    open =
      if m.socket_open?,
        do: Span.new("open", style: @ok),
        else: Span.new("closed", style: @bad)

    stored = Map.get(stats, :count, 0)
    errors = Map.get(stats, :errors, 0)

    relay =
      if m.relay_ready?,
        do: Span.new("relay ready", style: @ok),
        else: Span.new("relay not ready", style: @bad)

    lines = [
      Line.new([
        Span.new("cable   ", style: @dim),
        open,
        Span.new("  ", style: @dim),
        relay,
        Span.new("  " <> to_string(m.cable_url || "not configured"), style: @dim)
      ]),
      Line.new([
        Span.new("stored  ", style: @dim),
        Span.new(to_string(stored)),
        Span.new("   errors ", style: @dim),
        Span.new(to_string(errors), style: if(errors > 0, do: @bad, else: @ok)),
        Span.new("   newest ", style: @dim),
        Span.new(age_of(m))
      ]),
      Line.new([
        Span.new("source  ", style: @dim),
        Span.new(Connectix.Tui.Source.label(m.source)),
        Span.new(if(m.notice, do: "   " <> m.notice, else: ""), style: @warn)
      ])
    ]

    %Paragraph{
      text: %Text{lines: lines},
      block: %Block{title: " portal ", borders: :all}
    }
  end

  @doc """
  One row per signed-in agent: the browser socket half and the cable half,
  side by side, because a pop needs both and every "pops stopped" so far was
  one of them missing.

      user      agents    sock  age     pong  push  ip             cable  subs  att  frame
      be5bc5f0  cb1b0a46  1     1h29m   3s    412   84.110.57.30   open   4/4   0    2s

  `sock` is how many browser sockets the user has (a second tab is a second
  socket), `age` the oldest one's lifetime, `pong` how long since the browser
  last answered a ping, `push` frames sent to it. `cable` is the per-user
  cable client, `subs` confirmed/subscribed streams, `att` reconnect attempts
  so far, `frame` how long since the node last sent anything on it.
  """
  def agents(%Model{agents: []} = m, _rect) do
    %Paragraph{
      text: %Text{lines: [Line.new([Span.new("no agent has a socket or a cable client", style: @dim)])]},
      block: %Block{title: agents_title(m), borders: :all}
    }
  end

  def agents(%Model{} = m, _rect) do
    now = System.system_time(:millisecond)

    header =
      Line.new([
        Span.new("  ", style: @dim),
        Span.new(
          col("user", 10) <>
            col("agents", 10) <>
            col("sock", 5) <>
            col("age", 8) <>
            col("pong", 6) <>
            col("push", 6) <>
            col("ip", 16) <>
            col("cable", 7) <>
            col("subs", 6) <>
            col("att", 5) <>
            col("frame", 7),
          style: @head
        )
      ])

    rows =
      m.agents
      |> Enum.with_index()
      |> Enum.map(fn {a, i} ->
        selected? = m.focus == :agents and i == m.agent_selected
        marker = if selected?, do: "▸ ", else: "  "
        style = if selected?, do: %Style{modifiers: [:bold]}, else: %Style{}
        oldest = Enum.min_by(a.sockets, & &1.connected_at, fn -> nil end)
        pong = Enum.map(a.sockets, & &1.last_pong_at) |> Enum.reject(&is_nil/1) |> Enum.max(fn -> nil end)
        cable = a.cable

        Line.new([
          Span.new(marker, style: @dim),
          Span.new(col(Model.short(a.user_uuid), 10), style: style),
          Span.new(col(a.agent_ids |> Enum.map(&Model.short/1) |> Enum.join(","), 10), style: @dim),
          socket_span(length(a.sockets), col(to_string(length(a.sockets)), 5)),
          Span.new(col(if(oldest, do: Sessions.human(now - oldest.connected_at), else: "-"), 8)),
          pong_span(now, pong),
          Span.new(col(to_string(Enum.sum(Enum.map(a.sockets, & &1.pushed))), 6), style: @dim),
          Span.new(col(if(oldest, do: to_string(oldest[:remote_ip] || "-"), else: "-"), 16), style: @dim),
          cable_span(cable),
          Span.new(col(if(cable, do: "#{cable.confirmed}/#{cable.subscribed}", else: "-"), 6),
            style: subs_style(cable)
          ),
          Span.new(col(if(cable, do: to_string(cable.attempts), else: "-"), 5),
            style: if(cable && cable.attempts > 0, do: @warn, else: %Style{})
          ),
          Span.new(col(if(cable, do: ms_ago(cable.last_frame_ms_ago), else: "-"), 7),
            style: if(cable && (cable.last_frame_ms_ago || 0) > 30_000, do: @warn, else: %Style{})
          )
        ])
      end)

    %List{items: [header | rows], block: %Block{title: agents_title(m), borders: :all}}
  end

  @doc "The last browser-socket closes: when, who, how long it lived, and why."
  def closes(%Model{closes: []}, _rect) do
    %Paragraph{
      text: %Text{lines: [Line.new([Span.new("no socket has closed since boot", style: @dim)])]},
      block: %Block{title: " socket closes ", borders: :all}
    }
  end

  def closes(%Model{closes: closes}, _rect) do
    items =
      closes
      |> Enum.take(3)
      |> Enum.map(fn c ->
        Line.new([
          Span.new(col(clock(c.at), 10), style: @dim),
          Span.new(col(Model.short(c.user_uuid), 10)),
          Span.new(col("lived " <> Sessions.human(c.lived_ms), 16)),
          Span.new(col(inspect(c.reason), 22), style: reason_style(c.reason)),
          Span.new(
            "last pong " <>
              if(c.last_pong_at, do: Sessions.human(c.at - c.last_pong_at) <> " before", else: "never"),
            style: @dim
          )
        ])
      end)

    %List{items: items, block: %Block{title: " socket closes (newest first) ", borders: :all}}
  end

  @doc "The whole agent row, as the portal holds it."
  def agent_detail(%Model{} = m, _rect) do
    lines =
      case Model.current_agent(m) do
        nil ->
          [Line.new([Span.new("no agent selected", style: @dim)])]

        row ->
          row
          |> inspect(pretty: true, width: 100, limit: :infinity)
          |> String.split("\n")
          |> Enum.map(&Line.new([Span.new(&1)]))
      end

    %Paragraph{
      text: %Text{lines: lines},
      wrap: true,
      block: %Block{title: " agent (enter closes) ", borders: :all}
    }
  end

  @doc "Which cable streams the node CONFIRMED — not which were requested."
  def cable(%Model{cable: []} = _m, _rect) do
    %Paragraph{
      text: %Text{lines: [Line.new([Span.new("no confirmed subscriptions", style: @dim)])]},
      block: %Block{title: " cable ", borders: :all}
    }
  end

  def cable(%Model{cable: subs}, _rect) do
    %List{
      items: Enum.map(subs, &Line.new([Span.new(short_identifier(&1))])),
      block: %Block{title: " cable ", borders: :all}
    }
  end

  @doc "The store, newest first — the cursor selects one for `detail/2`."
  def events(%Model{events: []} = m, _rect) do
    msg = m.error || "nothing stored yet"

    %Paragraph{
      text: %Text{lines: [Line.new([Span.new(msg, style: if(m.error, do: @bad, else: @dim))])]},
      block: %Block{title: title(m), borders: :all}
    }
  end

  def events(%Model{} = m, _rect) do
    now = System.system_time(:microsecond)

    items =
      m.events
      |> Enum.with_index()
      |> Enum.map(fn {r, i} ->
        selected? = m.focus == :events and i == m.selected
        marker = if selected?, do: "▸ ", else: "  "
        style = if selected?, do: %Style{modifiers: [:bold]}, else: %Style{}

        Line.new([
          Span.new(marker, style: @dim),
          Span.new(String.pad_trailing(age(now, r["create_date"]), 7), style: @dim),
          Span.new(String.pad_trailing(to_string(r["src"]), 13), style: @head),
          Span.new(String.pad_trailing(to_string(r["label"]), 22), style: style),
          Span.new(to_string(r["sid"]), style: @dim)
        ])
      end)

    %List{items: items, block: %Block{title: title(m), borders: :all}}
  end

  @doc """
  One event, in full.

  `raw` rather than a projection: the whole point of the store's generic row is
  that later questions stay `raw` searches rather than schema changes, so the
  cockpit shows what arrived instead of deciding in advance what mattered.
  """
  def detail(%Model{} = m, _rect) do
    lines =
      case Model.current(m) do
        nil ->
          [Line.new([Span.new("nothing selected", style: @dim)])]

        row ->
          row["raw"]
          |> to_string()
          |> pretty()
          |> String.split("\n")
          |> Enum.map(&Line.new([Span.new(&1)]))
      end

    %Paragraph{
      text: %Text{lines: lines},
      wrap: true,
      block: %Block{title: " event (enter closes) ", borders: :all}
    }
  end

  @doc "The keys, so nobody has to read this file to drive it."
  def help(_m, _rect) do
    keys = [
      {"tab", "switch between agents and events"},
      {"↑ ↓ / j k", "move"},
      {"enter", "show the whole row (agent or event)"},
      {"x", "kick: close the agent's socket — the extension reconnects in ~3s"},
      {"c", "reconnect the agent's cable connection now"},
      {"f / r / q", "cycle the src filter / refresh / quit"}
    ]

    %Paragraph{
      text: %Text{
        lines:
          Enum.map(keys, fn {k, what} ->
            Line.new([Span.new(String.pad_trailing(k, 12), style: @head), Span.new(what, style: @dim)])
          end)
      },
      block: %Block{title: " keys ", borders: :all}
    }
  end

  # ── helpers ───────────────────────────────────────────────────────────────

  defp agents_title(%Model{agents: agents}), do: " agents (#{length(agents)}) "

  defp col(text, width), do: String.pad_trailing(String.slice(to_string(text), 0, width - 1), width)

  defp socket_span(0, text), do: Span.new(text, style: @bad)
  defp socket_span(_n, text), do: Span.new(text, style: @ok)

  # No pong yet on a socket younger than a heartbeat is normal; none on an
  # older one means the browser never answered, which is the half-open case.
  defp pong_span(_now, nil), do: Span.new(col("-", 6), style: @warn)

  defp pong_span(now, at) do
    ago = now - at
    Span.new(col(Sessions.human(ago), 6), style: if(ago > 45_000, do: @bad, else: @ok))
  end

  defp cable_span(nil), do: Span.new(col("none", 7), style: @bad)
  defp cable_span(%{connected?: false}), do: Span.new(col("down", 7), style: @bad)
  defp cable_span(%{welcomed?: false}), do: Span.new(col("opening", 7), style: @warn)
  defp cable_span(_), do: Span.new(col("open", 7), style: @ok)

  defp subs_style(nil), do: %Style{}
  defp subs_style(%{confirmed: c, subscribed: s}) when c < s, do: @warn
  defp subs_style(_), do: @ok

  defp ms_ago(nil), do: "-"
  defp ms_ago(ms), do: Sessions.human(ms)

  defp reason_style(:remote), do: @dim
  defp reason_style(:normal), do: @dim
  defp reason_style(_), do: @bad

  defp clock(ms) do
    ms |> DateTime.from_unix!(:millisecond) |> Calendar.strftime("%H:%M:%S")
  rescue
    _ -> "-"
  end

  defp title(%Model{filter: nil}), do: " events "
  defp title(%Model{filter: f}), do: " events · #{f} "

  defp age_of(%Model{events: [r | _]}) do
    age(System.system_time(:microsecond), r["create_date"]) <> "  " <> to_string(r["label"])
  end

  defp age_of(_m), do: "-"

  defp age(_now, nil), do: "-"

  defp age(now, at) do
    case div(now - at, 1_000_000) do
      s when s < 60 -> "#{s}s"
      s when s < 3600 -> "#{div(s, 60)}m"
      s -> "#{div(s, 3600)}h"
    end
  end

  # The identifier is the JSON the node echoed back; show the channel and the
  # scope rather than 60 characters of quoting.
  defp short_identifier(identifier) do
    case Jason.decode(identifier) do
      {:ok, %{"channel" => c, "scope" => s, "id" => id}} -> "#{c}  #{s}.#{id}"
      {:ok, %{"channel" => c}} -> c
      _ -> identifier
    end
  end

  defp pretty(raw) do
    case Jason.decode(raw) do
      {:ok, decoded} -> Jason.encode!(decoded, pretty: true)
      _ -> raw
    end
  end
end
