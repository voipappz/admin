defmodule AgentsDemo.TelemetryTest do
  use ExUnit.Case, async: false

  setup %{test: test} do
    owner = self()
    handler = "screen-pop-telemetry-#{test}"

    :telemetry.attach_many(
      handler,
      AgentsDemo.Telemetry.events(),
      fn event, measurements, metadata, _config ->
        send(owner, {:telemetry, event, measurements, metadata})
      end,
      nil
    )

    on_exit(fn -> :telemetry.detach(handler) end)
    :ok
  end

  test "emits bounded screen-pop processing outcomes" do
    AgentsDemo.Telemetry.screen_pop_event(:received)
    AgentsDemo.Telemetry.screen_pop_event(:dispatched)

    assert_receive {:telemetry, [:agents_demo, :screen_pop, :event], %{count: 1},
                    %{result: :received}}

    assert_receive {:telemetry, [:agents_demo, :screen_pop, :event], %{count: 1},
                    %{result: :dispatched}}
  end

  test "emits instruction-load outcomes" do
    AgentsDemo.Telemetry.instruction_load(:loaded)

    assert_receive {:telemetry, [:agents_demo, :screen_pop, :instruction_load], %{count: 1},
                    %{result: :loaded}}
  end
end
