defmodule Connectix.Realtime.EslServerTest do
  @moduledoc """
  The one test that goes THROUGH switchx, against a fake Event Socket on the
  loopback. Every other producer test injects the connection; this one pins
  the protocol assumptions the injection hides: the auth exchange, the one
  `event plain …` command, the outer `Content-Length` framing of an event,
  and — the reason it exists — that a socket the server closes is noticed and
  remade, because the client library swallows `tcp_closed` and tells its
  owner nothing.
  """

  # Not async: `EslProducer.status/0` is one term for the node.
  use ExUnit.Case, async: false

  alias Connectix.Realtime.EslProducer
  alias Connectix.Realtime.EventPipeline

  @events ["HEARTBEAT", "CUSTOM callcenter::info"]

  @bridge """
  Event-Name: CUSTOM
  Event-Subclass: callcenter::info
  Event-UUID: 6d0f0b6e-4a29-4a1a-9a5e-4e1a6f7b2c11
  Event-Date-Timestamp: 1790071729079910
  CC-Action: bridge-agent-start
  CC-Agent: 88309e98-f698-4b57-898d-a6056c37dd55
  CC-Member-UUID: 0a5d1b0c-7a55-4f3d-9d3e-2b1f4c5d6e7f
  CC-Member-Session-UUID: 39c7885d-7a68-4835-9742-acfc031865a1
  CC-Member-CID-Number: 0527073205
  Unique-ID: 39c7885d-7a68-4835-9742-acfc031865a1

  """

  @heartbeat """
  Event-Name: HEARTBEAT
  Event-UUID: 3a9c0c3e-1c56-4c2a-9c9d-8f1f6a5d4b21
  Up-Time: 0 years, 0 days, 1 hour

  """

  # ── the fake switch ──────────────────────────────────────────────────────

  defp start_server(password) do
    {:ok, listen} =
      :gen_tcp.listen(0, [:binary, packet: :raw, active: false, reuseaddr: true, ip: {127, 0, 0, 1}])

    {:ok, port} = :inet.port(listen)
    test = self()
    server = spawn_link(fn -> accept_loop(listen, password, test) end)
    on_exit(fn -> :gen_tcp.close(listen) end)
    {port, server}
  end

  defp accept_loop(listen, password, test) do
    {:ok, sock} = :gen_tcp.accept(listen)
    :gen_tcp.send(sock, "Content-Type: auth/request\n\n")
    auth = recv_command(sock)
    send(test, {:server, :auth, auth})

    if auth == "auth #{password}" do
      :gen_tcp.send(sock, "Content-Type: command/reply\nReply-Text: +OK accepted\n\n")
      command = recv_command(sock)
      send(test, {:server, :command, command})
      :gen_tcp.send(sock, "Content-Type: command/reply\nReply-Text: +OK event listener enabled plain\n\n")
      send(test, {:server, :ready})
      serve(sock)
    else
      :gen_tcp.send(sock, "Content-Type: command/reply\nReply-Text: -ERR invalid\n\n")
      :gen_tcp.close(sock)
    end

    accept_loop(listen, password, test)
  end

  # Driven by the test: push an event down the socket, or hang up.
  defp serve(sock) do
    receive do
      {:push, body} ->
        :gen_tcp.send(
          sock,
          "Content-Length: #{byte_size(body)}\nContent-Type: text/event-plain\n\n" <> body
        )

        serve(sock)

      :close ->
        :gen_tcp.close(sock)
    end
  end

  defp recv_command(sock, acc \\ "") do
    {:ok, data} = :gen_tcp.recv(sock, 0, 5_000)
    acc = acc <> data

    case String.split(acc, "\n\n", parts: 2) do
      [command, _rest] -> String.trim(command)
      [_partial] -> recv_command(sock, acc)
    end
  end

  # ── the portal side ──────────────────────────────────────────────────────

  defp start_pipeline(port, password) do
    test = self()
    name = :"esl_pipeline_#{System.unique_integer([:positive])}"

    settings = %{host: "127.0.0.1", port: port, password: password, events: @events}

    spec =
      Supervisor.child_spec(
        {EventPipeline,
         name: name,
         producer: {EslProducer, settings: settings},
         concurrency: 1,
         screen_pop: test,
         events: test,
         user_streams: test},
        id: name
      )

    start_supervised!(spec)
    name
  end

  defp assert_status(expected, tries \\ 200)
  defp assert_status(expected, 0), do: assert(EslProducer.status() == expected)

  defp assert_status(expected, tries) do
    if EslProducer.status() == expected do
      :ok
    else
      Process.sleep(10)
      assert_status(expected, tries - 1)
    end
  end

  test "authenticates, subscribes with one command, and delivers an event through the real client" do
    {port, server} = start_server("pw")
    start_pipeline(port, "pw")

    assert_receive {:server, :auth, "auth pw"}, 5_000
    # Plain names first, CUSTOM subclasses last — the order mod_event_socket needs.
    assert_receive {:server, :command, "event plain HEARTBEAT CUSTOM callcenter::info"}, 5_000
    assert_receive {:server, :ready}, 5_000
    assert_status({:subscribed, @events})

    send(server, {:push, @bridge})

    assert_receive {:"$gen_cast",
                    {:event,
                     %{
                       "action" => "bridge-agent-start",
                       "caller_id_number" => "0527073205",
                       "user_uuid" => "88309e98-f698-4b57-898d-a6056c37dd55"
                     }}},
                   5_000
  end

  test "a heartbeat moves the clock and pops nothing" do
    {port, server} = start_server("pw")
    start_pipeline(port, "pw")
    assert_receive {:server, :ready}, 5_000
    assert_status({:subscribed, @events})
    assert EslProducer.last_message_at() == nil

    send(server, {:push, @heartbeat})

    assert_status({:subscribed, @events})
    assert eventually(fn -> is_integer(EslProducer.last_message_at()) end)
    refute_receive {:"$gen_cast", _}, 200
  end

  test "a socket the switch closes is noticed and the connection is remade" do
    {port, server} = start_server("pw")
    start_pipeline(port, "pw")
    assert_receive {:server, :ready}, 5_000
    assert_status({:subscribed, @events})

    send(server, :close)

    # A second connection: the fake switch asks for auth again.
    assert_receive {:server, :auth, "auth pw"}, 5_000
    assert_receive {:server, :ready}, 5_000
    assert_status({:subscribed, @events})
  end

  test "a wrong password is refused, and retried rather than crashed" do
    {port, _server} = start_server("pw")
    start_pipeline(port, "nope")

    assert_receive {:server, :auth, "auth nope"}, 5_000
    # The retry, one second later — the pipeline is still up and still trying.
    assert_receive {:server, :auth, "auth nope"}, 5_000
    assert_status(:connecting)
  end

  defp eventually(check, tries \\ 200) do
    cond do
      check.() -> true
      tries == 0 -> false
      true -> Process.sleep(10) && eventually(check, tries - 1)
    end
  end
end
