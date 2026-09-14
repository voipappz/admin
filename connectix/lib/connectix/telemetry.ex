defmodule Connectix.Telemetry do
  @moduledoc """
  Emits bounded-cardinality telemetry for portal-owned runtime behavior.

  Screen-pop metadata contains only fixed outcome atoms. User, environment,
  call, URL and instruction identities are never metric labels.
  """

  @screen_pop_event [:connectix, :screen_pop, :event]
  @screen_pop_load [:connectix, :screen_pop, :instruction_load]

  @event_results [:received, :ignored, :queued, :unloaded, :dispatched, :duplicate, :offline, :rejected]
  @load_results [:started, :loaded, :failed]

  @call_audio [:connectix, :call, :audio]
  @call_stt [:connectix, :call, :stt]
  @call_sip [:connectix, :call, :sip]

  @directions [:in, :out]
  @stt_events [:connected, :closed, :transcript]
  @sip_events [:registered, :register_refused, :calling, :ringing, :answered, :ended, :failed]

  def events, do: [@screen_pop_event, @screen_pop_load, @call_audio, @call_stt, @call_sip]

  def screen_pop_event(result) when result in @event_results do
    :telemetry.execute(@screen_pop_event, %{count: 1}, %{result: result})
  end

  def instruction_load(result) when result in @load_results do
    :telemetry.execute(@screen_pop_load, %{count: 1}, %{result: result})
  end

  @doc """
  One audio frame moved on a call. `:in` is SIP → bot, `:out` is bot → SIP.

  Fifty a second per direction, so this is a counter and never carries a call
  id: the useful question is "is audio moving, and which way", which a rate
  answers. Which call it was belongs in the event store, not in a label.
  """
  def call_audio(direction) when direction in @directions do
    :telemetry.execute(@call_audio, %{count: 1}, %{direction: direction})
  end

  @doc "Speech-to-text lifecycle. `:closed` without `:transcript` is the tell."
  def call_stt(event) when event in @stt_events do
    :telemetry.execute(@call_stt, %{count: 1}, %{event: event})
  end

  @doc "SIP call lifecycle, so a dropped call has a trail after the fact."
  def call_sip(event) when event in @sip_events do
    :telemetry.execute(@call_sip, %{count: 1}, %{event: event})
  end
end
