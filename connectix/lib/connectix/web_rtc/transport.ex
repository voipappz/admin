defmodule Connectix.WebRtc.Transport do
  @moduledoc """
  Owns the single shared Parrot UDP socket the `Connectix.WebRtc.SipBridge`
  sends REGISTER/INVITE over. Ported from `connectix.io/phone`'s
  `Connectix.Transport`, trimmed of nothing — it's already minimal.

  Started once, before `SipBridge`. Bound to an ephemeral local port in the
  20000-29999 range (an arbitrary UAC source port, not a well-known SIP port).

  ## Why it watches the address

  The socket is bound to one interface address. When the host's address
  changes — a DHCP lease on a laptop, a VPN coming up — the bound socket
  survives but can no longer send: every packet fails `:enetunreach`, and
  nothing says so. The failure is silent and total. REGISTERs go out and no
  reply ever comes, dialling reports `not_registered`, and mid-call the RTP
  socket dies and takes the media pipeline with it.

  That happened repeatedly on one laptop in a single day, the address moving
  four times, and each time it read as a broken SIP account rather than a
  stale socket. So the address is re-checked periodically and the transport
  rebinds when it moves, re-registering so Via/Contact advertise somewhere
  the registrar can actually reach.
  """
  use GenServer
  require Logger

  alias Parrot.Sip.HandlerAdapter
  alias Parrot.Sip.Transport.StateMachine, as: T

  # Often enough that a lease change is noticed before someone tries to dial,
  # rare enough to be a routing-table lookup a few times a minute.
  @address_check_ms 15_000

  defstruct local_ip: nil, local_port: nil, exposed_ip: nil

  def start_link(opts \\ []), do: GenServer.start_link(__MODULE__, opts, name: __MODULE__)
  def local_ip, do: GenServer.call(__MODULE__, :local_ip)
  def local_port, do: GenServer.call(__MODULE__, :local_port)

  @doc """
  Address advertised to peers in Via/Contact/SDP — the WAN IP when behind
  NAT (`CONNECTIX_SIP_PUBLIC_IP`), otherwise the bind IP.
  """
  def exposed_ip, do: GenServer.call(__MODULE__, :exposed_ip)

  @impl true
  def init(_opts) do
    local_ip = best_local_ip()
    exposed_ip = exposed_ip(local_ip)
    ip_tuple = ip_to_tuple(local_ip)
    exposed_tuple = ip_to_tuple(exposed_ip)
    sip_port = 20_000 + :rand.uniform(9999)

    if exposed_ip == local_ip do
      Logger.info("WebRtc.Transport: starting UDP #{local_ip}:#{sip_port}")
    else
      Logger.info(
        "WebRtc.Transport: starting UDP bind=#{local_ip}:#{sip_port} exposed=#{exposed_ip}:#{sip_port} (NAT)"
      )
    end

    T.stop_udp()

    handler = HandlerAdapter.new(Connectix.WebRtc.SipHandler, %{})

    case T.start_udp(%{
           listen_port: sip_port,
           listen_addr: ip_tuple,
           exposed_addr: exposed_tuple,
           exposed_port: sip_port,
           handler: handler,
           sip_trace: true
         }) do
      :ok ->
        Logger.info("WebRtc.Transport: ready on #{local_ip}:#{sip_port} (exposed #{exposed_ip}:#{sip_port})")
        schedule_address_check()
        {:ok, %__MODULE__{local_ip: local_ip, local_port: sip_port, exposed_ip: exposed_ip}}

      {:error, reason} ->
        Logger.error("WebRtc.Transport: failed to start UDP: #{inspect(reason)}")
        {:stop, reason}
    end
  end

  @impl true
  def handle_info(:check_address, s) do
    schedule_address_check()
    bound = s.local_ip

    case best_local_ip() do
      ^bound -> {:noreply, s}
      moved -> {:noreply, rebind(s, moved)}
    end
  end

  # Rebinding drops whatever the old socket was carrying, which sounds
  # destructive until you notice the old socket can no longer send a byte:
  # the address it is bound to is gone. There is nothing to preserve.
  defp rebind(s, new_ip) do
    Logger.warning(
      "WebRtc.Transport: local address moved #{s.local_ip} -> #{new_ip}, rebinding " <>
        "(the old socket can no longer send)"
    )

    exposed_ip = exposed_ip(new_ip)
    port = 20_000 + :rand.uniform(9999)

    T.stop_udp()
    handler = HandlerAdapter.new(Connectix.WebRtc.SipHandler, %{})

    case T.start_udp(%{
           listen_port: port,
           listen_addr: ip_to_tuple(new_ip),
           exposed_addr: ip_to_tuple(exposed_ip),
           exposed_port: port,
           handler: handler,
           sip_trace: true
         }) do
      :ok ->
        Logger.info("WebRtc.Transport: rebound to #{new_ip}:#{port}")
        # Via and Contact named the old address, so the registrar is holding a
        # binding that routes nowhere. Registering again replaces it.
        reregister()
        %__MODULE__{local_ip: new_ip, local_port: port, exposed_ip: exposed_ip}

      {:error, reason} ->
        # Keep the old state and try again on the next tick rather than
        # crashing: a half-configured network usually settles.
        Logger.error("WebRtc.Transport: rebind to #{new_ip} failed: #{inspect(reason)}")
        s
    end
  end

  defp reregister do
    if Process.whereis(Connectix.WebRtc.SipBridge), do: Connectix.WebRtc.SipBridge.register()
  end

  defp schedule_address_check, do: Process.send_after(self(), :check_address, @address_check_ms)

  @impl true
  def handle_call(:local_ip, _from, s), do: {:reply, s.local_ip, s}
  def handle_call(:local_port, _from, s), do: {:reply, s.local_port, s}
  def handle_call(:exposed_ip, _from, s), do: {:reply, s.exposed_ip, s}

  defp exposed_ip(local_ip) do
    case System.get_env("CONNECTIX_SIP_PUBLIC_IP") do
      ip when is_binary(ip) and ip != "" -> ip
      _ -> local_ip
    end
  end

  # Asks the kernel which local interface it would route through to reach the
  # internet, rather than guessing from `:inet.getifaddrs/0`'s (arbitrary)
  # interface order — a host with several interfaces (Docker bridges, a WSL
  # vEthernet adapter, the real LAN NIC) has no "first" one that's correct,
  # and a wrong choice here means Via/Contact/SDP advertise an address the
  # registrar can never route a response or RTP back to. No packet is sent —
  # UDP `connect/3` only binds the route, it's a routing-table lookup.
  defp best_local_ip do
    with {:ok, socket} <- :gen_udp.open(0, active: false),
         :ok <- :gen_udp.connect(socket, ~c"8.8.8.8", 53),
         {:ok, {ip, _port}} <- :inet.sockname(socket) do
      :gen_udp.close(socket)
      ip |> :inet.ntoa() |> to_string()
    else
      _ -> "127.0.0.1"
    end
  end

  defp ip_to_tuple(ip) when is_binary(ip) do
    ip |> String.to_charlist() |> :inet.parse_address() |> elem(1)
  end
end
