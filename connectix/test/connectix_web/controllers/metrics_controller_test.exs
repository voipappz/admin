defmodule ConnectixWeb.MetricsControllerTest do
  use ConnectixWeb.ConnCase, async: false

  test "GET /metrics exposes screen-pop counters without authentication", %{conn: conn} do
    Connectix.Telemetry.screen_pop_event(:dispatched)
    Connectix.Telemetry.instruction_load(:loaded)
    Process.sleep(50)

    conn = get(conn, ~p"/metrics")
    body = response(conn, 200)

    assert response_content_type(conn, :text) =~ "text/plain"
    assert body =~ "connectix_screen_pop_events"
    assert body =~ "connectix_screen_pop_instruction_loads"
    assert body =~ ~s(result="dispatched")
    assert body =~ ~s(result="loaded")
  end
end
