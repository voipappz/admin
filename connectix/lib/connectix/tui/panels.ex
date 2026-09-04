defmodule Connectix.Tui.Panels do
  @moduledoc """
  The four panes. Each takes the model and a `Rect` and returns a widget.

  Kept in one module rather than one file per pane: `connectix.io/phone` needed
  thirteen panels for a softphone, this needs four, and four small functions in
  one file are easier to read than four files that each import the same three
  aliases.
  """

  alias Connectix.Tui.Model
  alias Connectix.Tui.View.{Block, Line, List, Paragraph, Span, Style, Text}

  @dim %Style{fg: :bright_black}
  @ok %Style{fg: :green}
  @bad %Style{fg: :red}
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

    lines = [
      Line.new([Span.new("cable   ", style: @dim), open, Span.new("  " <> to_string(m.cable_url || "not configured"), style: @dim)]),
      Line.new([
        Span.new("stored  ", style: @dim),
        Span.new(to_string(stored)),
        Span.new("   errors ", style: @dim),
        Span.new(to_string(errors), style: if(errors > 0, do: @bad, else: @ok))
      ]),
      Line.new([Span.new("newest  ", style: @dim), Span.new(age_of(m))])
    ]

    %Paragraph{
      text: %Text{lines: lines},
      block: %Block{title: " portal ", borders: :all}
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
        marker = if i == m.selected, do: "▸ ", else: "  "
        style = if i == m.selected, do: %Style{modifiers: [:bold]}, else: %Style{}

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
      {"↑ ↓ / j k", "move"},
      {"enter", "show the whole event"},
      {"f", "cycle the src filter"},
      {"r", "refresh now"},
      {"q", "quit"}
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
