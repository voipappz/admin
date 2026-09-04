defmodule Connectix.Tui.View do
  @moduledoc """
  Dependency-free view structs + layout for the cockpit (no NIF, no TUI library).

  A small, self-contained widget vocabulary — `Style`, `Line`/`Span`, `Block`,
  `List`, `Paragraph`, `Rect`, `Layout`, `Frame`, `Event.Key` — that the panels
  build and `Connectix.Tui.Ansi` rasterizes from a `[{widget, %Rect{}}]` list into an
  ANSI frame string.
  """

  defmodule Style do
    @moduledoc false
    defstruct fg: nil, bg: nil, modifiers: []
  end

  defmodule Span do
    @moduledoc false
    defstruct content: "", style: %Style{}

    @doc "Span.new(content) | Span.new(content, style: %Style{})"
    def new(content, opts \\ [])
    def new(content, style: %Style{} = style), do: %__MODULE__{content: to_string(content), style: style}
    def new(content, _), do: %__MODULE__{content: to_string(content), style: %Style{}}
  end

  defmodule Line do
    @moduledoc false
    defstruct spans: [], style: %Style{}, alignment: nil
    def new(spans) when is_list(spans), do: %__MODULE__{spans: spans}
  end

  defmodule Text do
    @moduledoc false
    # rich text = list of Lines (used by the tab bar)
    defstruct lines: [], style: %Style{}, alignment: nil
  end

  defmodule Block do
    @moduledoc false
    defstruct title: nil,
              borders: [],
              border_type: :plain,
              border_style: %Style{},
              style: %Style{},
              title_style: %Style{},
              padding: {0, 0, 0, 0}
  end

  defmodule List do
    @moduledoc false
    defstruct items: [], style: %Style{}, block: nil
    @type t :: %__MODULE__{}
  end

  defmodule Paragraph do
    @moduledoc false
    defstruct text: "", style: %Style{}, block: nil, alignment: :left, wrap: false, scroll: {0, 0}
    @type t :: %__MODULE__{}
  end

  defmodule Rect do
    @moduledoc false
    defstruct x: 0, y: 0, width: 0, height: 0
    @type t :: %__MODULE__{}
  end

  defmodule Frame do
    @moduledoc false
    defstruct width: 0, height: 0
  end

  defmodule Event do
    @moduledoc false
    defmodule Key do
      @moduledoc false
      defstruct [:code, :kind, modifiers: []]
    end
  end

  defmodule Layout do
    @moduledoc false
    # Constraint-based split: {:length,n}|{:percentage,n}|{:min,n}|{:fill,n}
    def split(%Rect{} = area, direction, constraints, _opts \\ []) do
      total = if direction == :horizontal, do: area.width, else: area.height

      fixed =
        Enum.reduce(constraints, 0, fn
          {:length, n}, a -> a + n
          {:percentage, n}, a -> a + div(total * n, 100)
          _, a -> a
        end)

      flex_n = Enum.count(constraints, &match?({c, _} when c in [:min, :fill], &1))
      flex = if flex_n > 0, do: max(div(total - fixed, flex_n), 0), else: 0

      {rects, _} =
        Enum.map_reduce(constraints, 0, fn c, off ->
          size =
            case c do
              {:length, n} -> n
              {:percentage, n} -> div(total * n, 100)
              {:min, _} -> flex
              {:fill, _} -> flex
            end

          rect =
            if direction == :horizontal,
              do: %Rect{x: area.x + off, y: area.y, width: size, height: area.height},
              else: %Rect{x: area.x, y: area.y + off, width: area.width, height: size}

          {rect, off + size}
        end)

      rects
    end
  end
end
