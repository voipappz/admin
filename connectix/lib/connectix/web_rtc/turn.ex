defmodule Connectix.WebRtc.Turn do
  @moduledoc """
  Single source of truth for the WebRTC **ICE servers** used by *both* legs of
  the browser↔SIP bridge — the server-side `ExWebRTC.PeerConnection`
  (`Connectix.WebRtc.Peer`) and the browser `RTCPeerConnection` (the phone JS
  hook). Without a TURN relay, a call where the two ends can't reach each
  other directly (either side behind symmetric NAT) gathers only host/srflx
  candidates and never connects — a TURN relay is the fallback path.

  Ported from `connectix.io/phone`'s `Connectix.Turn`, routed through
  `Connectix.Config` instead of reading `System.get_env/1` directly, per this
  app's convention (see `Connectix.Config`'s moduledoc).

  The maps use the keys ExWebRTC **and** the browser `RTCIceServer` both
  understand (`:urls`, `:username`, `:credential`), so one list serves both
  legs.
  """

  require Logger

  @doc """
  ICE servers for `ExWebRTC.PeerConnection.start_link(ice_servers: ...)` and,
  JSON-encoded, for the browser. `[]` when nothing is configured (no STUN,
  no TURN) — calls between peers with directly reachable candidates still
  work; only NAT-traversal-dependent calls need this set.
  """
  @spec ice_servers() :: [map()]
  def ice_servers, do: stun_servers() ++ turn_servers()

  @doc "The same list as `ice_servers/0`, JSON-encoded for the browser `RTCPeerConnection`."
  @spec ice_servers_json() :: String.t()
  def ice_servers_json, do: Jason.encode!(ice_servers())

  @doc "True when a TURN relay is configured (URLs + credentials resolved)."
  @spec turn_configured?() :: boolean()
  def turn_configured?, do: turn_servers() != []

  defp stun_servers do
    case Connectix.Config.stun_urls() do
      [] -> []
      urls -> [%{urls: urls}]
    end
  end

  defp turn_servers do
    urls = Connectix.Config.turn_urls()
    user = Connectix.Config.turn_username()
    pass = Connectix.Config.turn_password()

    cond do
      urls == [] ->
        []

      user && pass ->
        [%{urls: urls, username: user, credential: pass}]

      true ->
        # coturn long-term auth requires a username/password; URLs alone get
        # silently dropped by clients. Surface the misconfig instead of
        # shipping an unusable relay.
        Logger.warning(
          "Connectix.WebRtc.Turn: TURN_URLS set but TURN_USERNAME/TURN_PASSWORD missing — TURN relay disabled"
        )

        []
    end
  end
end
