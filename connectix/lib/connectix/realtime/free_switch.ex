defmodule Connectix.Realtime.FreeSwitch do
  @moduledoc """
  Where the switch is, and how the portal connects to it.

  The portal reads FreeSWITCH's events first-hand, over the Event Socket
  (`mod_event_socket`, inbound mode): it connects, authenticates, names the
  events it wants, and the switch pushes them down the socket as they happen.
  Nothing sits between the switch and the pipeline — no relay node, no broker,
  no second machine to keep alive, and no shared bus carrying other tenants'
  agents beside ours.

  This module owns two things: **the settings** (the rule file's `freeswitch:`
  block, else `ESL_URL`) and **the connection recipe** (`connect/1`), which
  `Realtime.EslProducer` runs from its own process. The client library is
  `switchx`; it is a protocol client and nothing more — buffering, reconnect,
  status and the event→frame translation are the producer's and
  `FreeSwitch.Frame`'s.

  ## The connection is owned by whoever opens it

  `SwitchX.Connection.start_link/3` links the connection process to the caller
  and delivers every event to the caller as `{:switchx_event, event}`. There
  is no connection supervisor and no way to move the owner, so the producer
  opens the socket itself and this module is a recipe, not a process.

  ## Settings

      freeswitch:
        host: 194.36.89.216
        port: 8021
        password: ${FREESWITCH_ESL_PASSWORD}
        events:
          - HEARTBEAT
          - CUSTOM callcenter::info

  `${VAR}` is expanded from the environment, so the credential is named in the
  file and never written in it. The file wins; `ESL_URL=esl://:<password>@host:8021`
  is the fallback for a deployment that has not adopted the file. Events
  default to `HEARTBEAT` and `CUSTOM callcenter::info` — the callcenter stream is the whole
  surface the screen pop needs, and `HEARTBEAT` (every 20 s) is the liveness
  signal the deadman reads. Unlike a broker wildcard, naming events here means
  the firehose never enters the process: measured on a live switch, 86 % of
  the traffic was `CHANNEL_HANGUP_COMPLETE` at 8.6 KB a frame, and none of it
  pops anything.
  """

  require Logger

  alias Connectix.Config
  alias Connectix.Realtime.PopRule

  @default_port 8021
  @default_events ["HEARTBEAT", "CUSTOM callcenter::info"]
  # A `:gen_statem.call` defaults to waiting forever. A switch that accepts
  # the TCP connection and never answers `auth` would otherwise hold the
  # producer in `connect/1` for good, with no retry and no log line.
  @call_timeout 5_000

  @type settings :: %{
          host: String.t(),
          port: pos_integer(),
          password: String.t() | nil,
          events: [String.t()]
        }

  @type link :: %{conn: pid(), socket: port()}

  @doc "The events consumed when neither the file nor the URL names any."
  def default_events, do: @default_events

  @doc "Whether a switch is configured at all: a host in the file, or `ESL_URL`."
  @spec configured?() :: boolean()
  def configured?, do: settings() != nil

  @doc """
  The resolved settings, or nil when no switch is named anywhere.

  The rule file's `freeswitch.host` wins; `ESL_URL` fills in when the file has
  none. Whichever names the host, the file's `events` apply when it lists any,
  and `default_events/0` otherwise.
  """
  @spec settings() :: settings() | nil
  def settings do
    file = PopRule.freeswitch()

    base =
      case file.host do
        host when is_binary(host) ->
          %{host: host, port: file.port, password: file.password, events: []}

        nil ->
          settings(Config.esl_url())
      end

    case base do
      nil -> nil
      base -> %{base | events: first_non_empty(file.events, base.events, @default_events)}
    end
  end

  @doc """
  `ESL_URL` as settings, or nil.

      esl://:s3cret@switch.example:8021
      esl://s3cret@switch.example

  The password is the userinfo — either `:password` or a bare token; there is
  no username in the Event Socket protocol. The port defaults to #{@default_port}.
  Pure, so the parse is pinned by a test without a switch.
  """
  @spec settings(String.t() | nil) :: settings() | nil
  def settings(nil), do: nil

  def settings(url) when is_binary(url) do
    uri = URI.parse(url)

    case uri.host do
      host when is_binary(host) and host != "" ->
        %{
          host: host,
          port: uri.port || @default_port,
          password: password(uri.userinfo),
          events: @default_events
        }

      _no_host ->
        nil
    end
  end

  defp password(nil), do: nil

  defp password(info) when is_binary(info) do
    case String.split(info, ":", parts: 2) do
      [_user, pass] -> presence(pass)
      [token] -> presence(token)
    end
  end

  defp presence(""), do: nil
  defp presence(value), do: value

  defp first_non_empty(a, b, c) do
    Enum.find([a, b, c], c, &(&1 != []))
  end

  @doc "`esl://host:port`, for a log line or the cockpit. Never the password."
  @spec address(settings() | nil) :: String.t() | nil
  def address(nil), do: nil
  def address(%{host: host, port: port}), do: "esl://#{host}:#{port}"

  @doc """
  The one `event plain …` command that names every configured event.

  Order matters to the switch: `mod_event_socket` reads the words left to
  right, and once it meets `CUSTOM` every following word is a subclass. So the
  plain names go first and the `CUSTOM` subclasses, merged from however many
  entries named them, go last.

      iex> event_command(["CUSTOM callcenter::info", "HEARTBEAT", "CUSTOM sofia::register"])
      "HEARTBEAT CUSTOM callcenter::info sofia::register"
  """
  @spec event_command([String.t()]) :: String.t()
  def event_command(events) when is_list(events) do
    {custom, plain} =
      events
      |> Enum.flat_map(fn entry ->
        case entry |> to_string() |> String.split() do
          ["CUSTOM" | subclasses] -> Enum.map(subclasses, &{:custom, &1})
          words -> Enum.map(words, &{:plain, &1})
        end
      end)
      |> Enum.uniq()
      |> Enum.split_with(&match?({:custom, _}, &1))

    plain_words = Enum.map(plain, fn {:plain, word} -> word end)
    custom_words = Enum.map(custom, fn {:custom, word} -> word end)

    (plain_words ++ if(custom_words == [], do: [], else: ["CUSTOM" | custom_words]))
    |> Enum.join(" ")
  end

  @doc """
  Open, authenticate and subscribe. Runs in the CALLER's process, which becomes
  the owner every `{:switchx_event, _}` is delivered to.

  Returns `{:ok, %{conn: pid, socket: port}}` or `{:error, reason}`. A
  connection that was opened and then refused (`:denied`, a timeout) is closed
  before the error is returned, so the caller never holds a half-made link.
  """
  @spec connect(settings()) :: {:ok, link()} | {:error, term()}
  def connect(%{password: nil}), do: {:error, :no_password}

  def connect(%{host: host, port: port} = settings) do
    case open(host, port) do
      {:ok, socket} ->
        link = start_client(socket)

        case setup(link, settings) do
          :ok ->
            # Belt and braces beside the HEARTBEAT: a NAT that drops the
            # established socket says nothing, and the default TCP keepalive
            # is two hours.
            :inet.setopts(socket, keepalive: true)
            {:ok, link}

          {:error, reason} ->
            close(link)
            {:error, reason}
        end

      {:error, reason} ->
        {:error, reason}
    end
  end

  # The socket options the client expects: it reads one header line per
  # active message and the rest of the event with passive `recv`.
  @socket_opts [:binary, active: :once, packet: :line]
  @connect_timeout 5_000

  # THE SOCKET IS OPENED HERE, not by `SwitchX.Connection.Inbound.start_link/1`,
  # because that returns only the connection pid and the producer needs the
  # PORT: it monitors it, since the client swallows `tcp_closed` and would
  # otherwise sit on a dead socket saying nothing. Same three steps the
  # library takes — connect, start the linked statem, hand it the socket.
  defp open(host, port) do
    address =
      case :inet.parse_address(String.to_charlist(host)) do
        {:ok, ip} -> ip
        {:error, :einval} -> String.to_charlist(host)
      end

    :gen_tcp.connect(address, port, @socket_opts, @connect_timeout)
  end

  defp start_client(socket) do
    {:ok, conn} = SwitchX.Connection.start_link(self(), socket, :inbound)
    :ok = :gen_tcp.controlling_process(socket, conn)
    %{conn: conn, socket: socket}
  end

  defp setup(%{conn: conn}, %{password: password, events: events}) do
    with :ok <- authenticate(conn, password) do
      subscribe(conn, events)
    end
  end

  # The same message `SwitchX.auth/2` sends, with a timeout it does not offer.
  defp authenticate(conn, password) do
    case :gen_statem.call(conn, {:auth, password}, @call_timeout) do
      {:ok, _reply} -> :ok
      {:error, "Denied"} -> {:error, :denied}
      {:error, reason} -> {:error, reason}
      other -> {:error, {:unexpected_auth_reply, other}}
    end
  catch
    :exit, {:timeout, _call} -> {:error, :auth_timeout}
    :exit, reason -> {:error, {:exit, reason}}
  end

  defp subscribe(conn, events) do
    case :gen_statem.call(conn, {:listen_event, event_command(events)}, @call_timeout) do
      {:ok, _reply} -> :ok
      {:error, reason} -> {:error, reason}
      other -> {:error, {:unexpected_subscribe_reply, other}}
    end
  catch
    :exit, {:timeout, _call} -> {:error, :subscribe_timeout}
    :exit, reason -> {:error, {:exit, reason}}
  end

  @doc """
  Close the socket and stop the connection process. Safe on a link whose
  process is already gone.
  """
  @spec close(link()) :: :ok
  def close(%{conn: conn, socket: socket}) do
    if is_port(socket), do: :gen_tcp.close(socket)

    if is_pid(conn) and Process.alive?(conn) do
      try do
        :gen_statem.stop(conn, :normal, @call_timeout)
      catch
        :exit, _already_gone -> :ok
      end
    end

    :ok
  end
end
