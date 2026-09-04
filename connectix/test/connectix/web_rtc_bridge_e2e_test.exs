defmodule Connectix.WebRtcBridgeE2ETest do
  @moduledoc """
  Functional end-to-end test of the SIP↔WebRTC media gateway WITHOUT a browser
  or a live Kamailio (neither is available headlessly).

  It drives the **real** `Connectix.WebRtcMediaPipeline` + `BrowserSource`/`BrowserSink`
  against a UDP echo server that stands in for Kamailio's RTP (it reflects every
  packet). A recording mock plays the role of the browser peer (leg A).

  Round trip proven:

      inject "browser mic" PCMA → BrowserSource → RTP payloader → UDP
        → echo server reflects → UDP → RTP depayloader → BrowserSink
        → mock peer `play/2`  → assert the same payload came back

  Passing means the entire Membrane bridge — socket binding, RTP payload/depayload,
  and the leg-A↔leg-B relay coupling — works for real. The only piece not exercised
  here is ex_webrtc's DTLS-SRTP browser leg itself (ex_webrtc's own tested code;
  our use of it is covered by the Phase-2 echo path).
  """
  use ExUnit.Case, async: false

  @payload :binary.copy(<<0xD5>>, 160)

  defmodule MockPeer do
    @moduledoc "Stands in for Connectix.WebRtc.Peer: records the bridge casts, tagged by label."
    use GenServer

    def start_link(test, key, label) do
      GenServer.start_link(__MODULE__, {test, label}, name: {:via, Registry, {Connectix.WebRtc.Registry, key}})
    end

    @impl true
    def init({test, label}), do: {:ok, %{test: test, label: label}}

    # BrowserSource attaches here (browser→SIP). Hand the source pid to the test.
    @impl true
    def handle_cast({:forward_to, src}, s),
      do: send(s.test, {s.label, :source_ready, src}) && {:noreply, s}

    # BrowserSink plays SIP audio out to the browser → report it.
    def handle_cast({:play, payload}, s),
      do: send(s.test, {s.label, :to_browser, payload}) && {:noreply, s}
  end

  defp free_udp_port do
    {:ok, sock} = :gen_udp.open(0)
    {:ok, port} = :inet.port(sock)
    :gen_udp.close(sock)
    port
  end

  test "browser PCMA round-trips through the real Membrane gateway to 'Kamailio' and back" do
    # 1. UDP echo server = Kamailio RTP stand-in (reflects packets to sender).
    #    Open the socket INSIDE the echo process so active-mode {:udp,...} land
    #    in its mailbox (the controlling process), not the test's.
    parent = self()

    spawn_link(fn ->
      {:ok, sock} = :gen_udp.open(0, [:binary, active: true])
      {:ok, port} = :inet.port(sock)
      send(parent, {:echo_port, port})
      echo_loop(sock)
    end)

    echo_port =
      receive do
        {:echo_port, p} -> p
      after
        2_000 -> flunk("echo server did not start")
      end

    # 2. A free local port for the pipeline's RTP socket.
    local_port = free_udp_port()

    # 3. The mock browser peer, discoverable under :bridge (as the real Peer is).
    {:ok, _mock} = MockPeer.start_link(self(), :bridge, :a)

    # 4. The REAL gateway pipeline, pointed at the echo server as "Kamailio".
    {:ok, _sup, _pid} =
      Membrane.Pipeline.start_link(Connectix.WebRtcMediaPipeline, %{
        session_id: "e2e-test",
        local_rtp_port: local_port,
        remote_rtp_address: "127.0.0.1",
        remote_rtp_port: echo_port,
        key: :bridge
      })

    # 5. BrowserSource attaches to our mock once the pipeline is playing.
    assert_receive {:a, :source_ready, src}, 5_000

    # 6. Inject a "browser mic" stream. The first packet makes the SIP-side RTP
    #    session emit :new_rtp_stream (which wires the inbound depayload→browser
    #    branch); the rest then flow all the way back out to the browser leg —
    #    exactly like a continuous ~50 pps browser stream.
    for _ <- 1..100, do: send(src, {:browser_pcma, @payload})

    assert_receive {:a, :to_browser, got}, 5_000
    assert got == @payload
  end

  test "audio flows between two extensions through the gateway (A → B)" do
    # Two gateway legs cross-connected (each leg's RTP destination is the other's
    # socket) — i.e. extension A's media reaches extension B, as Kamailio/rtpengine
    # would relay between two registered extensions. Each leg has its own browser
    # peer (keyed :ext_a / :ext_b).
    port_a = free_udp_port()
    port_b = free_udp_port()

    {:ok, _a} = MockPeer.start_link(self(), :ext_a, :a)
    {:ok, _b} = MockPeer.start_link(self(), :ext_b, :b)

    {:ok, _sa, _pa} =
      Membrane.Pipeline.start_link(Connectix.WebRtcMediaPipeline, %{
        session_id: "ext-a",
        local_rtp_port: port_a,
        remote_rtp_address: "127.0.0.1",
        remote_rtp_port: port_b,
        key: :ext_a
      })

    {:ok, _sb, _pb} =
      Membrane.Pipeline.start_link(Connectix.WebRtcMediaPipeline, %{
        session_id: "ext-b",
        local_rtp_port: port_b,
        remote_rtp_address: "127.0.0.1",
        remote_rtp_port: port_a,
        key: :ext_b
      })

    assert_receive {:a, :source_ready, src_a}, 5_000
    assert_receive {:b, :source_ready, _src_b}, 5_000

    # Extension A's browser speaks → reaches extension B's browser leg.
    for _ <- 1..100, do: send(src_a, {:browser_pcma, @payload})

    assert_receive {:b, :to_browser, got}, 5_000
    assert got == @payload
  end

  defp echo_loop(sock) do
    receive do
      {:udp, ^sock, ip, port, data} ->
        :gen_udp.send(sock, ip, port, data)
        echo_loop(sock)
    end
  end
end
