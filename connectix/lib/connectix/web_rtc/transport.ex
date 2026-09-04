defmodule Connectix.WebRtc.Transport do
  @moduledoc """
  Owns the single shared Parrot UDP socket the `Connectix.WebRtc.SipBridge`
  sends REGISTER/INVITE over. Ported from `connectix.io/phone`'s
  `Connectix.Transport`, trimmed of nothing — it's already minimal.

  Started once, before `SipBridge`. Bound to an ephemeral local port in the
  20000-29999 range (an arbitrary UAC source port, not a well-known SIP port).
  """
  use GenServer
  require Logger

  alias Parrot.Sip.HandlerAdapter
  alias Parrot.Sip.Transport.StateMachine, as: T

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
        {:ok, %__MODULE__{local_ip: local_ip, local_port: sip_port, exposed_ip: exposed_ip}}

      {:error, reason} ->
        Logger.error("WebRtc.Transport: failed to start UDP: #{inspect(reason)}")
        {:stop, reason}
    end
  end

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
