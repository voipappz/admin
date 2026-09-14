defmodule Connectix.Voice.SipCallBridgeTest do
  @moduledoc """
  The bridge is driven without a SIP call or a Feline pipeline: the test
  process stands in for the pipeline task, so a queued frame arrives here as
  the `GenServer.cast` `Feline.Pipeline.Task.queue_frame/3` sends.
  """
  use ExUnit.Case, async: true

  alias Connectix.Voice.{Alaw, SipCallBridge}
  alias Feline.Frames.All.InputAudioRawFrame

  setup do
    key = {:test_bridge, System.unique_integer([:positive])}

    bridge =
      start_supervised!({SipCallBridge, key: key, scope: nil, conversation_id: "conv-#{inspect(key)}"})

    # Stand in for the pipeline and start the 20 ms clock the way `answered/1`
    # would, without starting Feline.
    test = self()
    now = System.monotonic_time(:millisecond)
    :sys.replace_state(bridge, &%{&1 | task: test, next_tick: now, last_in_at: now})
    send(bridge, :tick)

    %{bridge: bridge}
  end

  defp silence, do: Alaw.decode(Alaw.silence_frame())

  # A caller who says nothing must not leave the ears with nothing: Deepgram
  # closes an idle socket and the STT stage never reconnects.
  test "a quiet line is fed silence frames" do
    assert_receive {:"$gen_cast", {:queue_frame, %InputAudioRawFrame{} = frame, :downstream}}, 1_000
    assert frame.audio == silence()
    assert frame.sample_rate == 8_000
  end

  test "real inbound audio is forwarded and holds the silence feed off", %{bridge: bridge} do
    # Keep packets flowing faster than the quiet threshold for a while.
    speech = :binary.copy(<<0x55>>, Alaw.frame_bytes())

    for _ <- 1..15 do
      GenServer.cast(bridge, {:play, speech})
      Process.sleep(20)
    end

    frames =
      Stream.repeatedly(fn ->
        receive do
          {:"$gen_cast", {:queue_frame, %InputAudioRawFrame{audio: audio}, :downstream}} -> audio
        after
          0 -> nil
        end
      end)
      |> Enum.take_while(&(&1 != nil))

    assert length(frames) >= 15
    assert Enum.all?(frames, &(&1 == Alaw.decode(speech)))
  end
end
