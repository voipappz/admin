defmodule ConnectixWeb.ChatLiveShellTest do
  @moduledoc """
  The chat LiveView's shell: that it mounts, that its sidebar is populated on
  mount, and that the phone panel reports the *registrar's* verdict rather than
  its own optimism.

  Deliberately markup-agnostic. The panel is being redesigned (the phone is
  moving into the left sidebar as a dialpad card), so assertions here are on
  assigns and behaviour, not on classes, labels or element structure — a test
  that pins the current markup would go red for a redesign that broke nothing.
  Richer selector-based assertions belong here once that settles; see the
  `sidebar` describe block for where they slot in.
  """

  use ConnectixWeb.ConnCase, async: false

  import Phoenix.LiveViewTest

  alias Connectix.Conversations

  describe "mount" do
    test "the chat page mounts", %{conn: conn} do
      assert {:ok, _view, _html} = live(conn, ~p"/chat")
    end

    test "the welcome page mounts", %{conn: conn} do
      assert {:ok, _view, _html} = live(conn, ~p"/")
    end
  end

  describe "sidebar" do
    test "opens by default", %{conn: conn} do
      {:ok, view, _html} = live(conn, ~p"/chat")

      # The sidebar holds the phone now, so a collapsed default would hide the
      # dialpad behind a chevron nobody thinks to click — which is exactly the
      # "where is the left bar?" report that prompted this.
      assert :sys.get_state(view.pid).socket.assigns.is_thread_history_open
    end

    test "the conversation list is loaded on mount, not only on toggle", %{conn: conn} do
      # Basic Auth resolves to one operator identity, so the conversation the
      # LiveView will list has to be created against that same scope.
      {:ok, _conversation} =
        Conversations.create_conversation(ConnectixWeb.UserAuth.resolve_scope(), %{
          "title" => "Loaded at mount"
        })

      {:ok, view, _html} = live(conn, ~p"/chat")
      assigns = :sys.get_state(view.pid).socket.assigns

      # The list used to be fetched only inside "toggle_thread_history", so
      # defaulting the sidebar open painted an empty history under the dialpad.
      assert assigns.has_conversations
      assert assigns.conversations_loaded > 0
    end

    test "an empty account still mounts cleanly", %{conn: conn} do
      {:ok, view, _html} = live(conn, ~p"/chat")
      assigns = :sys.get_state(view.pid).socket.assigns

      refute assigns.has_conversations
      assert assigns.conversations_loaded == 0
    end
  end

  describe "phone panel" do
    test "reports registration from the bridge, not from call status", %{conn: conn} do
      {:ok, view, _html} = live(conn, ~p"/chat")
      assigns = :sys.get_state(view.pid).socket.assigns

      # `registered?` exists precisely because `status` lied: a REGISTER
      # answered 403 used to leave the panel reading "registered", so a blocked
      # account surfaced as a 404 on the next INVITE instead of "not
      # registered". Nothing in the suite registers, so this is false.
      refute assigns.phone_registered?
      assert assigns.phone_status in [:idle, :calling, :ringing, :in_call, :failed]
    end

    test "dialling without a registration is refused with a reason", %{conn: conn} do
      {:ok, view, _html} = live(conn, ~p"/chat")

      render_hook(view, "phone_dial_agent", %{"dial_uri" => "1000"})
      assigns = :sys.get_state(view.pid).socket.assigns

      # The point is the *reason* survives to the UI. An INVITE sent while
      # unregistered is answered 404 by the registrar, which reads as "no such
      # number" — the one explanation that sends you looking in the wrong place.
      assert assigns.phone_error
      assert assigns.phone_status in [:idle, :failed]
    end

    test "an empty dial target is rejected before anything is sent", %{conn: conn} do
      {:ok, view, _html} = live(conn, ~p"/chat")

      render_hook(view, "phone_dial_agent", %{"dial_uri" => "   "})

      assert :sys.get_state(view.pid).socket.assigns.phone_error
    end
  end

  describe "environments" do
    test "an environment is selected on mount", %{conn: conn} do
      {:ok, view, _html} = live(conn, ~p"/chat")
      assigns = :sys.get_state(view.pid).socket.assigns

      assert assigns.environments != []
      assert assigns.current_environment
    end
  end
end
