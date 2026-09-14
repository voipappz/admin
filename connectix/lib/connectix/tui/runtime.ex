defmodule Connectix.Tui.Runtime do
  @moduledoc """
  Pure-Elixir TUI runtime (no NIF). Puts the terminal in raw mode via OTP 27's
  `:shell.start_interactive({:noshell, :raw})` (with an `stty` fallback), reads
  keys one at a time in a linked reader process, subscribes to the `"phone"`
  PubSub bus, and drives a render→event loop over a callback module:

    * `init/1`        → `(opts)` → initial model
    * `render/2`      → `(model, %Frame{})` → `[{widget, %Rect{}}]`
    * `key/2`         → `(key_string, model)` → `{:cont, model} | {:halt, model}`
    * `pubsub/2`      → `(msg, model)` → model
  """

  alias Connectix.Tui.Ansi
  alias Connectix.Tui.View.Frame

  # \e%G selects the UTF-8 charset so box-drawing/arrows aren't shown as latin1.
  @enter "\e%G\e[?1049h\e[?25l\e[2J"
  @leave "\e[0m\e[?25h\e[?1049l"

  @spec run(module(), keyword()) :: :ok
  def run(app, opts \\ []) do
    enter_raw()
    parent = self()
    reader = spawn_link(fn -> read_loop(parent) end)
    # No bus to subscribe to: the cockpit polls `Connectix.Events`, which dedupes
    # the node.s N-times delivery, rather than counting frames off PubSub and
    # disagreeing with the store within a minute. The tick arrives here as an
    # ordinary message, which is all this loop needs.
    model = app.init(opts)

    try do
      loop(app, model)
    after
      Process.exit(reader, :kill)
      leave_raw()
    end
  end

  # ── main loop ─────────────────────────────────────────────────────────────

  defp loop(app, model) do
    paint(app, model)

    receive do
      {:key, :interrupt} -> :ok
      {:key, key} -> dispatch_key(app, key, model)
      msg -> loop(app, drain(app, safe_pubsub(app, msg, model)))
    end
  end

  # Fold every already-queued PubSub message (a burst) into the model without
  # repainting in between — leave key events in the mailbox. One paint per burst.
  defp drain(app, model) do
    receive do
      msg when not (is_tuple(msg) and tuple_size(msg) == 2 and elem(msg, 0) == :key) ->
        drain(app, safe_pubsub(app, msg, model))
    after
      0 -> model
    end
  end

  # The reader spells a few keys out ("enter", "tab", "up"); the app matches
  # the raw bytes as well, so both forms are accepted here.
  defp dispatch_key(app, key, model) do
    key =
      case key do
        "enter" -> "\r"
        "tab" -> "\t"
        "up" -> "\e[A"
        "down" -> "\e[B"
        "esc" -> "\e"
        other -> other
      end

    case safe_key(app, key, model) do
      {:halt, _m} -> :ok
      {:cont, m} -> loop(app, m)
    end
  end

  defp safe_key(app, key, model) do
    app.key(key, model)
  rescue
    _ -> {:cont, model}
  catch
    _, _ -> {:cont, model}
  end

  defp safe_pubsub(app, msg, model) do
    app.pubsub(msg, model)
  rescue
    _ -> model
  catch
    _, _ -> model
  end

  defp paint(app, model) do
    {cols, rows} = size()

    frame =
      try do
        Ansi.frame(cols, rows, app.render(model, %Frame{width: cols, height: rows}))
      rescue
        e -> "\e[H\e[2Jrender error: #{Exception.message(e)}"
      end

    IO.write(frame)
  end

  # Terminal size. `:io.columns/0` works once raw mode is set by the launcher;
  # COLUMNS/LINES (exported by `make tui`) and a default are fallbacks.
  defp size do
    cols =
      case :io.columns() do
        {:ok, c} when c > 0 -> c
        _ -> env_int("COLUMNS") || 100
      end

    rows =
      case :io.rows() do
        {:ok, r} when r > 0 -> r
        _ -> env_int("LINES") || 30
      end

    {cols, rows}
  rescue
    _ -> {100, 30}
  end

  defp env_int(key) do
    case System.get_env(key) do
      nil ->
        nil

      v ->
        case Integer.parse(v) do
          {n, _} when n > 0 -> n
          _ -> nil
        end
    end
  end

  # ── terminal mode ─────────────────────────────────────────────────────────
  #
  # Raw mode (`stty raw -echo`) is set by the LAUNCHER (`make tui`), which owns
  # the controlling tty — doing it from inside the BEAM (`:os.cmd`/`:shell`) has
  # no controlling terminal and silently fails, leaving input line-buffered and
  # "stuck". Here we only switch to the alternate screen + unicode output.

  defp enter_raw do
    try do
      :io.setopts(:standard_io, encoding: :unicode)
    rescue
      _ -> :ok
    catch
      _, _ -> :ok
    end

    IO.write(@enter)
  end

  defp leave_raw, do: IO.write(@leave)

  # ── input reader (plain IO.getn — the tty is already raw) ──────────────────

  defp read_loop(target) do
    case IO.getn("", 1) do
      :eof ->
        :ok

      {:error, _} ->
        :ok

      <<3>> ->
        send(target, {:key, :interrupt})

      "\e" ->
        send(target, {:key, read_escape()})
        read_loop(target)

      ch ->
        send(target, {:key, normalize(ch)})
        read_loop(target)
    end
  end

  defp read_escape do
    case IO.getn("", 1) do
      "[" -> read_csi()
      _ -> "esc"
    end
  end

  defp read_csi do
    case IO.getn("", 1) do
      "A" -> "up"
      "B" -> "down"
      "C" -> "right"
      "D" -> "left"
      "5" -> drain_tilde("page_up")
      "6" -> drain_tilde("page_down")
      _ -> "esc"
    end
  end

  defp drain_tilde(key) do
    _ = IO.getn("", 1)
    key
  end

  defp normalize("\r"), do: "enter"
  defp normalize("\n"), do: "enter"
  defp normalize(<<127>>), do: "backspace"
  defp normalize("\t"), do: "tab"
  defp normalize(ch), do: ch
end
