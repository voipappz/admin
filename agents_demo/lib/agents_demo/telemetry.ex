defmodule Connectix.Telemetry do
  @moduledoc """
  Emits bounded-cardinality telemetry for portal-owned runtime behavior.

  Screen-pop metadata contains only fixed outcome atoms. User, environment,
  call, URL and instruction identities are never metric labels.
  """

  @screen_pop_event [:agents_demo, :screen_pop, :event]
  @screen_pop_load [:agents_demo, :screen_pop, :instruction_load]

  @event_results [:received, :queued, :unloaded, :dispatched, :duplicate, :offline, :rejected]
  @load_results [:started, :loaded, :failed]

  def events, do: [@screen_pop_event, @screen_pop_load]

  def screen_pop_event(result) when result in @event_results do
    :telemetry.execute(@screen_pop_event, %{count: 1}, %{result: result})
  end

  def instruction_load(result) when result in @load_results do
    :telemetry.execute(@screen_pop_load, %{count: 1}, %{result: result})
  end
end
