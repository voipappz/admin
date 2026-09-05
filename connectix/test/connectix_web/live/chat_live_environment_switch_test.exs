defmodule ConnectixWeb.ChatLiveEnvironmentSwitchTest do
  @moduledoc """
  The environment switcher, which lives on the phone card's Settings tab in the
  sidebar (it picks which SIP environment a call goes through, so it sits with
  the phone rather than in the chat chrome): `Connectix.Config.environments/0`
  seeds `@current_environment` on mount, and the "switch_environment" event
  swaps it — the assign `Connectix.WebRtc.SipBridge` (Part C) reads to pick a
  dial target.
  """

  use ConnectixWeb.ConnCase, async: false

  import Phoenix.LiveViewTest

  setup do
    %{conn: authenticated_conn()}
  end

  # The card opens on the dialpad; the switcher is one tab over.
  defp open_settings(view) do
    render_click(view, "phone_tab", %{"tab" => "settings"})
  end

  defp with_env(pairs, fun) do
    previous = Map.new(pairs, fn {key, _new_value} -> {key, System.get_env(key)} end)
    Enum.each(pairs, fn {key, value} -> System.put_env(key, value) end)

    try do
      fun.()
    after
      Enum.each(previous, fn
        {key, nil} -> System.delete_env(key)
        {key, value} -> System.put_env(key, value)
      end)
    end
  end

  test "defaults to the first configured environment", %{conn: conn} do
    with_env(
      [{"CONNECTIX_ENVIRONMENTS", "prod:sip.example.com,staging:sip-staging.example.com"}],
      fn ->
        {:ok, view, _html} = live(conn, ~p"/chat")
        html = open_settings(view)

        assert has_element?(view, "select[name=name] option[selected]", "prod")
        assert html =~ "prod"
        assert html =~ "staging"
      end
    )
  end

  test "switch_environment changes the selected environment", %{conn: conn} do
    with_env(
      [{"CONNECTIX_ENVIRONMENTS", "prod:sip.example.com,staging:sip-staging.example.com"}],
      fn ->
        {:ok, view, _html} = live(conn, ~p"/chat")
        open_settings(view)

        html = render_change(view, "switch_environment", %{"name" => "staging"})

        assert has_element?(view, "select[name=name] option[selected]", "staging")
        assert html =~ "staging"
      end
    )
  end

  test "an unrecognized environment name is ignored", %{conn: conn} do
    with_env([{"CONNECTIX_ENVIRONMENTS", "prod:sip.example.com"}], fn ->
      {:ok, view, _html} = live(conn, ~p"/chat")
      open_settings(view)

      render_change(view, "switch_environment", %{"name" => "nonexistent"})

      assert has_element?(view, "select[name=name] option[selected]", "prod")
    end)
  end
end
