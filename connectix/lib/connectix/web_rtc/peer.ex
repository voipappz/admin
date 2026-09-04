defmodule Connectix.WebRtc.Peer do
  @moduledoc """
  Leg A of the SIP↔WebRTC gateway: the **browser side**, owning one
  `ExWebRTC.PeerConnection`. Media (DTLS-SRTP/ICE/RTP) terminates in the BEAM, so
  the softphone's mic is the browser's `getUserMedia` — no PortAudio/ALSA.

  The leg is pinned to **G.711 A-law (PCMA, payload type 8)** so it bridges 1:1
  with parrot's SIP leg to Kamailio — no transcoding, just RTP payload relay.

  Two modes:

    * **echo** (no SIP leg attached) — sends the mic straight back; proves the
      browser↔BEAM media path (Phase 2).
    * **bridge** (a `Connectix.WebRtcMediaPipeline` attached via `forward_to/2`) —
      browser mic → leg B → Kamailio, and SIP audio → `play/2` → browser.

  Discoverable by the pipeline through `Connectix.WebRtc.Registry` under `key`
  (default `:bridge`), so leg B can find leg A when parrot starts the pipeline.
  """
  use GenServer
  require Logger

  alias Connectix.WebRtc.Rtp
  alias ExWebRTC.{ICECandidate, MediaStreamTrack, PeerConnection, RTPCodecParameters, SessionDescription}

  # Pin the WebRTC leg to PCMA so it matches the SIP leg byte-for-byte.
  @pcma %RTPCodecParameters{payload_type: 8, mime_type: "audio/PCMA", clock_rate: 8000, channels: 1}

  # ── Public API ──────────────────────────────────────────────────────────────

  def start_link(opts) do
    key = Keyword.get(opts, :key, :bridge)
    GenServer.start_link(__MODULE__, opts, name: {:via, Registry, {Connectix.WebRtc.Registry, key}})
  end

  @doc "Resolve a peer pid by its registry key (used by the pipeline / leg B)."
  @spec whereis(atom()) :: pid() | nil
  def whereis(key \\ :bridge) do
    case Registry.lookup(Connectix.WebRtc.Registry, key) do
      [{pid, _}] -> pid
      [] -> nil
    end
  end

  @doc """
  Apply the browser's SDP offer and return our SDP answer as a json-ready map.
  `offer_json` is untrusted browser input — a malformed offer yields
  `{:error, :bad_offer}` rather than crashing the peer.
  """
  @spec offer(GenServer.server(), map()) :: {:ok, map()} | {:error, :bad_offer}
  def offer(peer, offer_json), do: GenServer.call(peer, {:offer, offer_json})

  @doc "Add a remote ICE candidate (json map from the browser). Bad input is ignored."
  @spec ice(GenServer.server(), map()) :: :ok
  def ice(peer, candidate_json), do: GenServer.cast(peer, {:ice, candidate_json})

  @doc "Attach leg B: browser mic packets are forwarded to `sip_pid` (a Membrane source)."
  @spec forward_to(GenServer.server(), pid()) :: :ok
  def forward_to(peer, sip_pid), do: GenServer.cast(peer, {:forward_to, sip_pid})

  @doc "Play one G.711 (A-law) payload from the SIP leg out to the browser."
  @spec play(GenServer.server(), binary()) :: :ok
  def play(peer, payload), do: GenServer.cast(peer, {:play, payload})

  # ── GenServer ────────────────────────────────────────────────────────────────

  @impl true
  def init(opts) do
    client = Keyword.fetch!(opts, :client)
    # ICE servers (STUN + TURN relay) resolved by Connectix.WebRtc.Turn — shared with the
    # browser leg so both ends agree on the relay. See Connectix.WebRtc.Turn for resolution.
    ice_servers = Connectix.WebRtc.Turn.ice_servers()
    {:ok, pc} = PeerConnection.start_link(ice_servers: ice_servers, audio_codecs: [@pcma])
    out = MediaStreamTrack.new(:audio)
    {:ok, _sender} = PeerConnection.add_track(pc, out)

    {:ok,
     %{
       client: client,
       pc: pc,
       out_track: out.id,
       in_track: nil,
       sip: nil,
       seq: 0,
       ts: 0,
       ssrc: :rand.uniform(0xFFFFFFFF)
     }}
  end

  @impl true
  def handle_call({:offer, offer_json}, _from, state) do
    offer = SessionDescription.from_json(offer_json)
    :ok = PeerConnection.set_remote_description(state.pc, offer)
    {:ok, answer} = PeerConnection.create_answer(state.pc)
    :ok = PeerConnection.set_local_description(state.pc, answer)
    {:reply, {:ok, SessionDescription.to_json(answer)}, state}
  rescue
    e ->
      # offer_json is untrusted browser input; a malformed SDP must not take the
      # peer (and the caller's LiveView) down.
      Logger.warning("WebRtc.Peer: rejected malformed offer: #{Exception.message(e)}")
      {:reply, {:error, :bad_offer}, state}
  end

  @impl true
  def handle_cast({:ice, candidate_json}, state) do
    :ok = PeerConnection.add_ice_candidate(state.pc, ICECandidate.from_json(candidate_json))
    {:noreply, state}
  rescue
    e ->
      Logger.warning("WebRtc.Peer: ignored bad ICE candidate: #{Exception.message(e)}")
      {:noreply, state}
  end

  def handle_cast({:forward_to, sip_pid}, state) do
    Logger.info("WebRtc.Peer: SIP leg attached (#{inspect(sip_pid)}) — bridge mode")
    {:noreply, %{state | sip: sip_pid}}
  end

  # SIP → browser: wrap the A-law payload in an RTP packet on our PCMA track.
  # Framing + counter wraparound is pure and tested in Connectix.WebRtc.Rtp.
  def handle_cast({:play, payload}, state) do
    {packet, counters} =
      Rtp.next_frame(payload, %{seq: state.seq, ts: state.ts, ssrc: state.ssrc})

    PeerConnection.send_rtp(state.pc, state.out_track, packet)
    {:noreply, %{state | seq: counters.seq, ts: counters.ts}}
  end

  # ── ex_webrtc notifications ───────────────────────────────────────────────────

  @impl true
  def handle_info({:ex_webrtc, _pc, msg}, state), do: handle_webrtc(msg, state)

  defp handle_webrtc({:ice_candidate, cand}, state) do
    send(state.client, {:webrtc, "ice", ICECandidate.to_json(cand)})
    {:noreply, state}
  end

  defp handle_webrtc({:track, %MediaStreamTrack{kind: :audio, id: id}}, state) do
    {:noreply, %{state | in_track: id}}
  end

  # Browser mic packet (PCMA). Bridge → leg B if attached, else echo.
  defp handle_webrtc({:rtp, in_id, _rid, packet}, %{in_track: in_id} = state) do
    case state.sip do
      nil -> PeerConnection.send_rtp(state.pc, state.out_track, packet)
      sip -> send(sip, {:browser_pcma, packet.payload})
    end

    {:noreply, state}
  end

  defp handle_webrtc({:connection_state_change, conn_state}, state) do
    Logger.info("WebRtc.Peer: connection #{inspect(conn_state)}")
    if conn_state == :connected, do: send(state.client, {:webrtc, "connected", %{}})
    {:noreply, state}
  end

  defp handle_webrtc(_other, state), do: {:noreply, state}
end
