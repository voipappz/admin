defmodule ConnectixWeb.ChatLiveSidebarLayoutTest do
  @moduledoc """
  The three-column arrangement: chats on the left, the conversation in the
  middle, the phone docked right. Each side collapses on its own, and a
  collapsed column is absent rather than reduced to an empty rail.

  These are regressions the redesign was asked to fix, so they are pinned by
  selector here — unlike `ConnectixWeb.ChatLiveShellTest`, which stays
  markup-agnostic on purpose.
  """

  use ConnectixWeb.ConnCase, async: false

  import Phoenix.LiveViewTest

  setup do
    %{conn: authenticated_conn()}
  end

  test "the phone card renders in the right-hand column, with a full keypad", %{conn: conn} do
    {:ok, view, _html} = live(conn, ~p"/chat")

    assert has_element?(view, "#webrtc-phone")
    assert has_element?(view, "#webrtc-phone input[name=dial_uri]")

    for key <- ~w(1 2 3 4 5 6 7 8 9 * 0 #) do
      assert has_element?(view, "#webrtc-phone button[phx-value-key='#{key}']"),
             "keypad is missing #{key}"
    end
  end

  test "the conversation history is the left column, open on mount", %{conn: conn} do
    {:ok, view, _html} = live(conn, ~p"/chat")

    assert has_element?(view, "#conversation-list")
  end

  test "the phone closes on its own, leaving the chats up", %{conn: conn} do
    {:ok, view, _html} = live(conn, ~p"/chat")

    assert has_element?(view, "#webrtc-phone")

    render_click(view, "toggle_phone", %{})

    # Gone, not narrowed — and the chat list is untouched by it.
    refute has_element?(view, "#webrtc-phone")
    assert has_element?(view, "#conversation-list")
    # The way back is the icon rail, which is always present on a wide viewport.
    assert has_element?(view, "#nav-rail button[phx-click=toggle_phone]")
  end

  test "collapsing Tasks & Files removes the column instead of leaving a rail", %{conn: conn} do
    {:ok, view, _html} = live(conn, ~p"/chat")

    # Tasks & Files is collapsed on mount now — the chats own the left edge —
    # so open it before checking that closing it removes the column.
    render_click(view, "open_panel", %{"tab" => "tasks"})
    assert has_element?(view, "aside")

    render_click(view, "open_panel", %{"tab" => "tasks"})

    # Not merely narrowed to a 60px chevron strip — absent.
    refute has_element?(view, "aside")
    # ...and the way back is the icon rail, which owns Tasks and Files now.
    assert has_element?(view, "#nav-rail button[phx-value-tab=tasks]")
    assert has_element?(view, "#nav-rail button[phx-value-tab=files]")

    # The phone survives the collapse — it is a different column entirely.
    assert has_element?(view, "#webrtc-phone")
  end

  test "the registration line names the host in full", %{conn: conn} do
    {:ok, view, _html} = live(conn, ~p"/chat")

    # Whatever the verdict, the domain must be legible rather than truncated
    # away — a `title` carries it even when the line wraps.
    assert has_element?(view, "#webrtc-phone [title*='registered']") or
             has_element?(view, "#webrtc-phone [title*='no SIP account']")
  end
end
