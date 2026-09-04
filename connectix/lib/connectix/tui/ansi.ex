defmodule Connectix.Tui.Ansi do
  @moduledoc """
  Dependency-free ANSI renderer (no NIF). Rasterizes `[{widget, %Rect{}}]` — where
  a widget is a `Connectix.Tui.View.List` or `.Paragraph` (optionally wrapped in a
  `.Block` for a rounded border + title) — into a cell grid, then emits a full
  ANSI frame string with per-span fg/bg/bold, clipped to each rect. Pure Elixir.
  """

  alias Connectix.Tui.View.{Block, Line, List, Paragraph, Rect, Span, Style, Text}

  @colors %{
    black: 30,
    red: 31,
    green: 32,
    yellow: 33,
    blue: 34,
    magenta: 35,
    cyan: 36,
    white: 37,
    gray: 90,
    grey: 90,
    light_red: 91,
    light_green: 92,
    light_yellow: 93,
    light_blue: 94,
    light_magenta: 95,
    light_cyan: 96
  }

  @spec frame(pos_integer(), pos_integer(), [{term(), Rect.t()}]) :: iodata()
  def frame(width, height, placements) do
    grid = Enum.reduce(placements, %{}, fn {w, r}, g -> draw(g, w, r) end)
    # Absolute cursor position per row (\e[row;1H) — never use \r\n, which would
    # scroll the bottom line and smear the frame on every repaint.
    rows = for y <- 0..(height - 1), do: ["\e[#{y + 1};1H", render_row(grid, y, width)]
    ["\e[?25l", rows]
  end

  @doc false
  def to_lines(width, height, placements) do
    grid = Enum.reduce(placements, %{}, fn {w, r}, g -> draw(g, w, r) end)

    for y <- 0..(height - 1) do
      0..(width - 1)
      |> Enum.map(fn x -> elem(Map.get(grid, {x, y}, {" ", nil, nil, false}), 0) end)
      |> Enum.join()
      |> String.trim_trailing()
    end
  end

  # ── widgets ──────────────────────────────────────────────────────────────────

  defp draw(grid, %List{items: items, block: block}, rect) do
    {grid, inner} = with_block(grid, block, rect)

    items
    |> Enum.take(inner.height)
    |> Enum.with_index()
    |> Enum.reduce(grid, fn {line, i}, g -> put_line(g, inner.x, inner.y + i, inner.x + inner.width, line) end)
  end

  defp draw(grid, %Paragraph{} = p, rect) do
    {grid, inner} = with_block(grid, p.block, rect)
    base = style_tuple(p.style)

    lines_to_render(p.text, inner.width)
    |> Enum.take(inner.height)
    |> Enum.with_index()
    |> Enum.reduce(grid, fn {line, i}, g ->
      put_para_line(g, inner.x, inner.y + i, inner.x + inner.width, line, base)
    end)
  end

  defp draw(grid, _other, _rect), do: grid

  # paragraph text → list of {kind, payload}: either a plain string or a %Line{}
  defp lines_to_render(%Text{lines: lines}, _w), do: Enum.map(lines, &{:line, &1})

  defp lines_to_render(text, _w) when is_binary(text),
    do: text |> String.split("\n") |> Enum.map(&{:str, &1})

  defp lines_to_render(_, _), do: []

  defp put_para_line(grid, x0, y, maxx, {:line, %Line{} = line}, _base), do: put_line(grid, x0, y, maxx, line)

  defp put_para_line(grid, x0, y, maxx, {:str, s}, base),
    do: put_text(grid, x0, y, maxx, s, base)

  # ── block border + title ─────────────────────────────────────────────────────

  defp with_block(grid, nil, rect), do: {grid, rect}

  defp with_block(grid, %Block{borders: []} = _b, rect), do: {grid, rect}

  defp with_block(grid, %Block{} = block, %Rect{} = r) when r.width >= 2 and r.height >= 2 do
    bc = style_tuple(block.border_style)
    right = r.x + r.width - 1
    bottom = r.y + r.height - 1

    grid =
      grid
      |> put(r.x, r.y, "╭", bc)
      |> put(right, r.y, "╮", bc)
      |> put(r.x, bottom, "╰", bc)
      |> put(right, bottom, "╯", bc)

    grid =
      Enum.reduce((r.x + 1)..(right - 1)//1, grid, fn x, g ->
        g |> put(x, r.y, "─", bc) |> put(x, bottom, "─", bc)
      end)

    grid =
      Enum.reduce((r.y + 1)..(bottom - 1)//1, grid, fn y, g ->
        g |> put(r.x, y, "│", bc) |> put(right, y, "│", bc)
      end)

    grid = put_text(grid, r.x + 1, r.y, right, " #{block.title} ", style_tuple(block.title_style))

    inner = %Rect{x: r.x + 1, y: r.y + 1, width: r.width - 2, height: r.height - 2}
    {grid, inner}
  end

  defp with_block(grid, _block, rect), do: {grid, rect}

  # ── line / span writers ──────────────────────────────────────────────────────

  defp put_line(grid, x0, y, maxx, %Line{spans: spans, style: lstyle}) do
    line_bg = lstyle && lstyle.bg
    grid = if line_bg, do: fill(grid, x0, y, maxx, line_bg), else: grid

    {grid, _} =
      Enum.reduce(spans, {grid, x0}, fn %Span{content: content, style: st}, {g, x} ->
        {fg, bg, bold} = style_tuple(st)
        put_chars(g, x, y, maxx, content, {fg, bg || line_bg, bold})
      end)

    grid
  end

  defp put_text(grid, x0, y, maxx, text, base) do
    {grid, _} = put_chars(grid, x0, y, maxx, text, base)
    grid
  end

  defp put_chars(grid, x0, y, maxx, text, {fg, bg, bold}) do
    text
    |> String.graphemes()
    |> Enum.reduce({grid, x0}, fn ch, {g, x} ->
      if x < maxx and x >= 0, do: {Map.put(g, {x, y}, {ch, fg, bg, bold}), x + 1}, else: {g, x + 1}
    end)
  end

  defp fill(grid, x0, _y, maxx, _bg) when x0 >= maxx, do: grid

  defp fill(grid, x0, y, maxx, bg) do
    Enum.reduce(x0..(maxx - 1)//1, grid, fn x, g -> Map.put(g, {x, y}, {" ", nil, bg, false}) end)
  end

  defp put(grid, x, y, ch, {fg, bg, bold}) when x >= 0 and y >= 0,
    do: Map.put(grid, {x, y}, {ch, fg, bg, bold})

  defp put(grid, _x, _y, _ch, _t), do: grid

  defp style_tuple(%Style{} = s), do: {s.fg, s.bg, :bold in (s.modifiers || [])}
  defp style_tuple(_), do: {nil, nil, false}

  # ── row → ANSI ───────────────────────────────────────────────────────────────

  defp render_row(grid, y, width) do
    {io, _} =
      Enum.map_reduce(0..(width - 1), :init, fn x, last ->
        {ch, fg, bg, bold} = Map.get(grid, {x, y}, {" ", nil, nil, false})
        key = {fg, bg, bold}
        {[if(key == last, do: "", else: sgr(fg, bg, bold)), ch], key}
      end)

    # reset + clear-to-end-of-line so a shorter repaint never leaves stale chars
    [io, "\e[0m\e[K"]
  end

  defp sgr(nil, nil, false), do: "\e[0m"

  defp sgr(fg, bg, bold) do
    codes =
      [if(bold, do: "1"), fg && to_string(@colors[fg] || 39), bg && to_string((@colors[bg] || 39) + 10)]
      |> Enum.reject(&is_nil/1)

    "\e[0;" <> Enum.join(codes, ";") <> "m"
  end
end
