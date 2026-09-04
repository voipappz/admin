defmodule Connectix.Tui.Panels.Fmt do
  @moduledoc "Shared formatting helpers for the list/table view panels."

  alias Connectix.Tui.View.Block
  alias Connectix.Tui.View.Style

  @doc "Right-pad to width (truncating if longer)."
  def pad(s, w), do: s |> to_string() |> trunc_str(w) |> String.pad_trailing(w)

  @doc "Truncate a string to at most n chars."
  def trunc_str(s, n) do
    s = to_string(s)
    if String.length(s) > n, do: String.slice(s, 0, n), else: s
  end

  @doc "Epoch-seconds → HH:MM:SS (local). Blank for nil."
  def hms(nil), do: ""

  def hms(secs) when is_integer(secs) do
    {_, {h, mi, s}} = :calendar.system_time_to_local_time(secs, :second)
    :io_lib.format("~2..0B:~2..0B:~2..0B", [h, mi, s]) |> IO.iodata_to_binary()
  end

  @doc "Human byte size."
  def bytes(nil), do: "-"
  def bytes(n) when is_integer(n) and n < 1024, do: "#{n}B"
  def bytes(n) when is_integer(n) and n < 1024 * 1024, do: "#{Float.round(n / 1024, 1)}K"
  def bytes(n) when is_integer(n), do: "#{Float.round(n / 1024 / 1024, 1)}M"
  def bytes(_), do: "-"

  @doc "Standard rounded cyan-bordered block for a view."
  def block(title) do
    %Block{
      title: title,
      borders: [:all],
      border_type: :rounded,
      border_style: %Style{fg: :cyan},
      title_style: %Style{fg: :cyan, modifiers: [:bold]}
    }
  end

  def dim, do: %Style{fg: :gray}

  @spark ~w(▁ ▂ ▃ ▄ ▅ ▆ ▇ █)
  @doc """
  Compact inline trend graph (Sparkline widget). Maps a list of numbers to
  block glyphs scaled to the series max. Empty list → "".
  """
  def sparkline([]), do: ""

  def sparkline(nums) when is_list(nums) do
    vals = Enum.map(nums, &(&1 || 0))
    max = Enum.max(vals, fn -> 0 end)
    levels = length(@spark) - 1

    Enum.map_join(vals, fn v ->
      idx = if max > 0, do: round(v / max * levels), else: 0
      Enum.at(@spark, max(idx, 0))
    end)
  end

  @full "█"
  @eighths ~w(▏ ▎ ▍ ▌ ▋ ▊ ▉ █)
  @doc """
  Horizontal bar (BarChart/Gauge widget) — `value/max` filled to `width` cells
  using ⅛-block sub-cell precision, padded with light shade. `max <= 0` → empty.
  """
  def bar(value, max, width) when is_number(value) and is_number(max) and width > 0 do
    frac = if max > 0, do: min(value / max, 1.0), else: 0.0
    units = frac * width
    full = trunc(units)
    rem = units - full
    partial = if full < width and rem > 0, do: Enum.at(@eighths, min(round(rem * 8), 8) - 1) || "", else: ""
    filled = String.duplicate(@full, full) <> partial
    String.pad_trailing(filled, width, "░")
  end

  def bar(_v, _m, width) when width > 0, do: String.duplicate("░", width)

  @doc "Round `value/max` to a 0-100 integer percent (0 when max ≤ 0)."
  def pct(_value, max) when max in [0, nil], do: 0
  def pct(value, max), do: round((value || 0) / max * 100)

  @doc """
  A UA status → `{glyph, color}` for the little ● indicator: registered/in-call
  green, ringing/calling yellow, (dis)connecting gray, failed red, else hollow.
  """
  def status_glyph(:registered), do: {"●", :green}
  def status_glyph(:in_call), do: {"●", :green}
  def status_glyph(:ringing), do: {"●", :yellow}
  def status_glyph(:calling), do: {"●", :yellow}
  def status_glyph(:authenticating), do: {"◌", :yellow}
  def status_glyph(:connecting), do: {"◌", :gray}
  def status_glyph(:failed), do: {"●", :red}
  def status_glyph(_), do: {"○", :gray}
end
