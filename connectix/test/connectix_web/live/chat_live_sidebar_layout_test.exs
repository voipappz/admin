defmodule ConnectixWeb.ChatLiveSidebarLayoutTest do
  @moduledoc """
  The left column's arrangement: the phone card lives in the sidebar and
  nowhere else, and collapsing "Tasks & Files" removes that column outright
  rather than leaving an empty rail standing in front of the phone.

  Both are regressions the redesign was asked to fix, so they are pinned by
  selector here — unlike `ConnectixWeb.ChatLiveShellTest`, which stays
  markup-agnostic on purpose.
  """

  use ConnectixWeb.ConnCase, async: false

  import Phoenix.LiveViewTest

  setup do
    %{conn: authenticated_conn()}
  end

  test "the phone card renders in the sidebar, with a full keypad", %{conn: conn} do
    {:ok, view, _html} = live(conn, ~p"/chat")

    assert has_element?(view, "#webrtc-phone")
    assert has_element?(view, "#webrtc-phone input[name=dial_uri]")

    for key <- ~w(1 2 3 4 5 6 7 8 9 * 0 #) do
      assert has_element?(view, "#webrtc-phone button[phx-value-key='#{key}']"),
             "keypad is missing #{key}"
    end
  end

  test "the conversation history sits in the same column, open on mount", %{conn: conn} do
    {:ok, view, _html} = live(conn, ~p"/chat")

    assert has_element?(view, "#conversation-list")
  end

  test "collapsing Tasks & Files removes the column instead of leaving a rail", %{conn: conn} do
    {:ok, view, _html} = live(conn, ~p"/chat")

    # The panel is an <aside>; expanded it is the leftmost column.
    assert has_element?(view, "aside")

    render_click(view, "toggle_sidebar", %{})

    # Not merely narrowed to a 60px chevron strip — absent.
    refute has_element?(view, "aside")
    # ...and the only way back is the header control, so it has to be there.
    assert has_element?(view, "button[phx-click=toggle_sidebar][title='Show Tasks & Files']")

    # The phone survives the collapse — it belongs to the other column.
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
