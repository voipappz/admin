defmodule ConnectixWeb.ChatLive do
  use ConnectixWeb, :live_view
  import ConnectixWeb.ChatComponents

  require Logger

  alias Sagents.AgentServer
  alias Sagents.FileSystemServer
  alias Sagents.Subscriber
  alias Connectix.Conversations
  alias Connectix.Agents.Coordinator
  alias Connectix.Agents.DemoSetup
  alias Connectix.Turns
  alias ConnectixWeb.AgentLiveHelpers

  @impl true
  def mount(_params, _session, socket) do
    # Start user's filesystem when they log in
    # Filesystem runs independently of conversations and survives across sessions
    user_id = socket.assigns.current_scope.user.id

    filesystem_scope =
      case DemoSetup.ensure_user_filesystem(user_id) do
        {:ok, fs_scope} ->
          # Subscribe to filesystem changes for real-time updates
          if connected?(socket) do
            FileSystemServer.subscribe(fs_scope)

            # Subscribe to the agent presence topic so presence_diff
            # broadcasts can fulfill any pending agent subscription
            # (e.g. after a Horde migration or restart).
            Phoenix.PubSub.subscribe(Connectix.PubSub, Subscriber.presence_topic())
          end

          fs_scope

        {:error, :supervisor_not_ready} ->
          Logger.debug("FileSystemSupervisor not available - filesystem features disabled")
          nil

        {:error, reason} ->
          Logger.warning("Failed to start user filesystem: #{inspect(reason)}")
          nil
      end

    # Get timezone from LiveSocket params (sent from browser)
    # This is only available when the socket is connected
    timezone =
      if connected?(socket) do
        get_connect_params(socket)["timezone"] || "UTC"
      else
        "UTC"
      end

    # Determine debug mode based on user preference
    # For demo: default to false, allow toggle
    # In production: could check user.role or permissions
    debug_mode = false

    # Named SIP/calling environments the phone panel dials through. Socket
    # assign only — there's no per-user account under Basic Auth to persist
    # the selection against, so it resets to the first configured environment
    # on every mount (matches connectix.io/phone's own per-session picker).
    environments = Connectix.Config.environments()
    current_environment = List.first(environments)

    if connected?(socket), do: Connectix.WebRtc.SipBridge.subscribe()

    # For new conversations, agent_id will be set when conversation is created
    {:ok,
     socket
     # Initialize all agent-related state with helper
     |> AgentLiveHelpers.init_agent_state()
     # Initialize conversation list stream (app-specific UI state)
     |> stream(:conversation_list, [])
     # Application-specific assigns
     |> assign(:input, "")
     |> assign(:filesystem_scope, filesystem_scope)
     |> assign(:timezone, timezone)
     |> assign_filesystem_files()
     |> assign(:handler, :bot)
     |> assign(:sidebar_collapsed, false)
     |> assign(:sidebar_active_tab, "tasks")
     |> assign(:selected_sub_agent, nil)
     |> assign(:selected_file, nil)
     |> assign(:selected_file_path, nil)
     |> assign(:selected_file_content, nil)
     |> assign(:file_view_mode, :rendered)
     |> assign(:is_thread_history_open, false)
     |> assign(:conversations_loaded, 0)
     |> assign(:has_more_conversations, true)
     |> assign(:has_conversations, false)
     |> assign(:page_title, "Connectix")
     |> assign(:debug_mode, debug_mode)
     |> assign(:environments, environments)
     |> assign(:current_environment, current_environment)
     |> assign(:phone_status, phone_status())
     |> assign(:phone_error, nil)}
  end

  # Read the live UA state rather than assuming `:idle`. The panel is driven by
  # broadcasts, and a broadcast only reaches LiveViews that already existed —
  # so a page loaded during a call used to show an idle panel, and a page
  # loaded after a call the LiveView missed the end of showed "Calling…" with
  # no way back.
  defp phone_status do
    case Connectix.WebRtc.SipBridge.get_state() do
      %{status: status} -> panel_status(status)
      _ -> :idle
    end
  rescue
    _ -> :idle
  catch
    :exit, _ -> :idle
  end

  # The UA's registration states are not call states: being registered means
  # ready to dial, which the panel calls idle.
  defp panel_status(status) when status in [:calling, :ringing, :in_call, :failed], do: status
  defp panel_status(_registered_or_idle), do: :idle

  @impl true
  def handle_params(params, _uri, socket) do
    conversation_id = params["conversation_id"]
    previous_conversation_id = socket.assigns.conversation_id

    socket =
      cond do
        # Load conversation if conversation_id is present and different from current
        conversation_id && conversation_id != previous_conversation_id ->
          # Untrack presence from previous conversation if connected
          if connected?(socket) && previous_conversation_id do
            user_id = socket.assigns.current_scope.user.id
            Coordinator.untrack_conversation_viewer(previous_conversation_id, user_id)
            Logger.debug("Untracked presence from conversation #{previous_conversation_id}")
          end

          socket
          |> load_conversation(conversation_id)
          |> update_conversation_selection(previous_conversation_id, conversation_id)

        # If no conversation_id in URL, reset to fresh state
        is_nil(conversation_id) && previous_conversation_id ->
          # Untrack presence when going back to empty state
          if connected?(socket) do
            user_id = socket.assigns.current_scope.user.id
            Coordinator.untrack_conversation_viewer(previous_conversation_id, user_id)
            Logger.debug("Untracked presence from conversation #{previous_conversation_id}")
          end

          reset_conversation_state(socket)

        # No change needed
        true ->
          socket
      end

    {:noreply, socket}
  end

  @impl true
  def handle_event("send_message", %{"message" => message_text}, socket) do
    message_text = String.trim(message_text)

    # A message sent while the agent is working is queued by AgentServer and
    # delivered when the current run finishes, so `loading` does not block
    # sending and the input stays live. Interrupts do block: the user must
    # approve or reject the pending tools first.
    if message_text == "" or socket.assigns[:agent_status] == :interrupted do
      {:noreply, socket}
    else
      # Create conversation if this is the first message
      socket =
        case socket.assigns.conversation_id do
          nil ->
            create_new_conversation(socket, message_text)

          _id ->
            socket
        end

      # A person who took the conversation over answers it themselves; the
      # same box then posts their reply instead of starting a turn.
      if human_handling?(socket) do
        post_operator_reply(socket, message_text)
      else
        submit_turn(socket, message_text)
      end
    end
  end

  @impl true
  def handle_event("switch_environment", %{"name" => name}, socket) do
    case Enum.find(socket.assigns.environments, &(&1.name == name)) do
      nil -> {:noreply, socket}
      environment -> {:noreply, assign(socket, :current_environment, environment)}
    end
  end

  # The WebRTC<->SIP phone panel. Signaling for the browser leg rides this
  # same LiveView socket (phx-hook="WebRtcPhone" in chat_components.ex) rather
  # than a second Phoenix Channel, so the call and the conversation share one
  # process — see Connectix.WebRtc.Peer/SipBridge for the two legs this bridges.
  @impl true
  def handle_event("phone_offer", %{"offer" => offer, "uri" => uri}, socket) when uri != "" do
    peer =
      case Connectix.WebRtc.Peer.start_link(key: :bridge, client: self()) do
        {:ok, pid} -> pid
        {:error, {:already_started, pid}} -> pid
      end

    case Connectix.WebRtc.Peer.offer(peer, offer) do
      {:ok, answer} ->
        socket =
          socket
          |> assign(:phone_status, :calling)
          |> assign(:phone_error, nil)
          |> push_event("webrtc_answer", %{answer: answer})

        case Connectix.WebRtc.SipBridge.dial(uri) do
          :ok ->
            {:noreply, socket}

          {:error, reason} ->
            {:noreply, assign(socket, phone_status: :failed, phone_error: inspect(reason))}
        end

      {:error, :bad_offer} ->
        {:noreply, assign(socket, phone_status: :failed, phone_error: "bad browser offer")}
    end
  end

  def handle_event("phone_offer", %{"uri" => ""}, socket) do
    {:noreply, assign(socket, :phone_error, "enter a number/SIP URI to dial")}
  end

  # Put the *bot* on the call instead of this browser: no WebRTC peer, no
  # microphone, no audio through this LiveView at all. The call becomes its own
  # conversation, so its transcript lands in the sidebar beside the typed ones.
  def handle_event("phone_dial_agent", %{"dial_uri" => uri}, socket) do
    case String.trim(uri) do
      "" ->
        {:noreply, assign(socket, :phone_error, "enter a number/SIP URI to dial")}

      target ->
        opts = [mode: :agent, scope: socket.assigns.current_scope]

        case Connectix.WebRtc.SipBridge.dial(target, opts) do
          :ok ->
            {:noreply, assign(socket, phone_status: :calling, phone_error: nil)}

          {:error, reason} ->
            {:noreply, assign(socket, phone_status: :failed, phone_error: dial_error(reason))}
        end
    end
  end

  defp dial_error(:bridge_busy), do: "the browser phone is already on this line — hang up first"
  defp dial_error(:sip_not_configured), do: "no SIP account configured"
  defp dial_error(reason), do: inspect(reason)

  def handle_event("phone_ice", %{"candidate" => candidate}, socket) do
    if peer = Connectix.WebRtc.Peer.whereis(:bridge), do: Connectix.WebRtc.Peer.ice(peer, candidate)
    {:noreply, socket}
  end

  def handle_event("phone_error", %{"reason" => reason}, socket) do
    {:noreply, assign(socket, phone_status: :failed, phone_error: reason)}
  end

  def handle_event("phone_hangup", _params, socket) do
    Connectix.WebRtc.SipBridge.hangup()
    {:noreply, socket |> assign(phone_status: :idle, phone_error: nil) |> push_event("webrtc_hangup", %{})}
  end

  @impl true
  def handle_event("cancel_agent", _params, socket) do
    Logger.info("User requested to cancel agent execution")

    case AgentServer.cancel(socket.assigns.agent_id) do
      :ok ->
        # The cancellation message will be created when we receive the
        # {:status_changed, :cancelled, nil} event from AgentServer
        {:noreply, socket}

      {:error, reason} ->
        Logger.error("Failed to cancel agent: #{inspect(reason)}")
        {:noreply, put_flash(socket, :error, "Failed to cancel agent: #{inspect(reason)}")}
    end
  end

  @impl true
  def handle_event("update_input", %{"message" => message}, socket) do
    {:noreply, assign(socket, :input, message)}
  end

  @impl true
  def handle_event("toggle_sidebar", _params, socket) do
    {:noreply, assign(socket, :sidebar_collapsed, !socket.assigns.sidebar_collapsed)}
  end

  @impl true
  def handle_event("new_thread", _params, socket) do
    previous_conversation_id = socket.assigns[:conversation_id]

    # Untrack presence BEFORE resetting state so AgentServer
    # sees viewer count drop to 0 and can trigger smart shutdown
    if previous_conversation_id && connected?(socket) do
      user_id = socket.assigns.current_scope.user.id
      Coordinator.untrack_conversation_viewer(previous_conversation_id, user_id)
    end

    socket =
      socket
      |> AgentLiveHelpers.reset_conversation()
      |> assign(:page_title, "Connectix")
      |> assign(:selected_sub_agent, nil)
      |> reset_conversation_in_stream(previous_conversation_id)

    {:noreply,
     socket
     |> push_patch(to: ~p"/chat")
     |> put_flash(:info, "New conversation started")}
  end

  @impl true
  def handle_event("toggle_thread_history", _params, socket) do
    is_opening = !socket.assigns.is_thread_history_open

    socket =
      if is_opening do
        # When opening, reset and reload the stream to ensure items render
        scope = socket.assigns.current_scope
        conversations = Conversations.list_conversations(scope, limit: 20, offset: 0)

        loaded_count = length(conversations)

        socket
        |> assign(:is_thread_history_open, true)
        |> stream(:conversation_list, conversations, reset: true)
        |> assign(:conversations_loaded, loaded_count)
        |> assign(:has_more_conversations, loaded_count == 20)
        |> assign(:has_conversations, loaded_count > 0)
      else
        assign(socket, :is_thread_history_open, false)
      end

    {:noreply, socket}
  end

  @impl true
  def handle_event("switch_tab", %{"tab" => tab}, socket) do
    {:noreply, assign(socket, :sidebar_active_tab, tab)}
  end

  @impl true
  def handle_event("view_file", %{"path" => path}, socket) do
    result =
      if socket.assigns.filesystem_scope do
        FileSystemServer.read_file(socket.assigns.filesystem_scope, path)
      else
        {:error, :no_filesystem}
      end

    case result do
      {:ok, %{content: content}} ->
        {:noreply,
         socket
         |> assign(:selected_file_path, path)
         |> assign(:selected_file_content, content)}

      {:error, _reason} ->
        {:noreply,
         socket
         |> assign(:selected_file_path, path)
         |> assign(:selected_file_content, "Error: Could not read file")}
    end
  end

  @impl true
  def handle_event("close_file_modal", _params, socket) do
    {:noreply,
     socket
     |> assign(:selected_file_path, nil)
     |> assign(:selected_file_content, nil)
     |> assign(:file_view_mode, :rendered)}
  end

  @impl true
  def handle_event("toggle_file_view_mode", _params, socket) do
    new_mode = if socket.assigns.file_view_mode == :rendered, do: :raw, else: :rendered
    {:noreply, assign(socket, :file_view_mode, new_mode)}
  end

  @impl true
  def handle_event("load_more_conversations", _params, socket) do
    # Only load more if there are potentially more conversations
    if socket.assigns.has_more_conversations do
      scope = socket.assigns.current_scope
      offset = socket.assigns.conversations_loaded

      new_conversations = Conversations.list_conversations(scope, limit: 20, offset: offset)

      {:noreply,
       socket
       |> stream(:conversation_list, new_conversations, at: -1)
       |> assign(:conversations_loaded, offset + length(new_conversations))
       |> assign(:has_more_conversations, length(new_conversations) == 20)}
    else
      {:noreply, socket}
    end
  end

  @impl true
  def handle_event("take_over", _params, socket) do
    {:noreply, set_handler(socket, :human)}
  end

  @impl true
  def handle_event("return_to_bot", _params, socket) do
    {:noreply, set_handler(socket, :bot)}
  end

  @impl true
  def handle_event("load_conversation", %{"id" => conversation_id}, socket) do
    # Navigate to the selected conversation
    {:noreply, push_patch(socket, to: ~p"/chat?conversation_id=#{conversation_id}")}
  end

  @impl true
  def handle_event("delete_conversation", %{"id" => conversation_id}, socket) do
    scope = socket.assigns.current_scope
    is_current = conversation_id == socket.assigns.conversation_id

    # Get conversation for logging and flash message
    conversation = Conversations.get_conversation!(scope, conversation_id)

    case Conversations.delete_conversation(scope, conversation_id) do
      {:ok, _deleted} ->
        Logger.info("Deleted conversation #{conversation_id}")

        socket =
          socket
          # Remove from stream
          |> stream_delete(:conversation_list, conversation)
          # Update counts
          |> assign(:conversations_loaded, socket.assigns.conversations_loaded - 1)
          |> assign(:has_conversations, socket.assigns.conversations_loaded > 0)

        # If this was the active conversation, reset to new conversation state
        socket =
          if is_current do
            socket
            |> reset_conversation_state()
            |> put_flash(:info, "Current conversation deleted. Starting new conversation.")
          else
            put_flash(
              socket,
              :info,
              "Conversation \"#{conversation.title}\" deleted successfully"
            )
          end

        {:noreply, socket}

      {:error, reason} ->
        Logger.error("Failed to delete conversation: #{inspect(reason)}")
        {:noreply, put_flash(socket, :error, "Failed to delete conversation")}
    end
  end

  @impl true
  def handle_event("approve_tool", %{"index" => index_str}, socket) do
    {:noreply,
     AgentLiveHelpers.handle_hitl_decision(socket, String.to_integer(index_str), :approve)}
  end

  @impl true
  def handle_event("reject_tool", %{"index" => index_str}, socket) do
    {:noreply,
     AgentLiveHelpers.handle_hitl_decision(socket, String.to_integer(index_str), :reject)}
  end

  @impl true
  def handle_event("question_select", %{"value" => value}, socket) do
    response = %{type: :answer, selected: [value]}
    {:noreply, AgentLiveHelpers.handle_question_response(socket, response)}
  end

  @impl true
  def handle_event("question_single_submit", %{"selected" => value} = params, socket) do
    other_text = Map.get(params, "other_text")
    response = %{type: :answer, selected: [value]}

    response =
      if other_text && other_text != "" do
        Map.put(response, :other_text, other_text)
      else
        response
      end

    {:noreply, AgentLiveHelpers.handle_question_response(socket, response)}
  end

  @impl true
  def handle_event("question_multi_submit", params, socket) do
    selected = Map.get(params, "selected", [])

    if selected == [] do
      {:noreply, put_flash(socket, :error, "Please select at least one option")}
    else
      other_text = Map.get(params, "other_text")
      response = %{type: :answer, selected: selected}

      response =
        if other_text && other_text != "" do
          Map.put(response, :other_text, other_text)
        else
          response
        end

      {:noreply, AgentLiveHelpers.handle_question_response(socket, response)}
    end
  end

  @impl true
  def handle_event("question_freeform_submit", %{"text" => text}, socket) do
    response = %{type: :answer, other_text: text}
    {:noreply, AgentLiveHelpers.handle_question_response(socket, response)}
  end

  @impl true
  def handle_event("question_cancel", _params, socket) do
    response = %{type: :cancel}
    {:noreply, AgentLiveHelpers.handle_question_response(socket, response)}
  end

  @impl true
  def handle_event("toggle_debug_mode", _params, socket) do
    # Toggle debug mode (per-viewer preference)
    new_debug_mode = !socket.assigns.debug_mode

    socket = assign(socket, :debug_mode, new_debug_mode)

    # Re-render all existing messages with the new debug mode
    # We need to reload them from the database to force a re-render
    socket =
      if socket.assigns.conversation_id do
        stream(
          socket,
          :messages,
          Connectix.Conversations.load_display_messages(
            socket.assigns.current_scope,
            socket.assigns.conversation_id
          ),
          reset: true
        )
      else
        socket
      end

    {:noreply, socket}
  end

  @impl true
  def handle_event("wake_agent", _params, socket) do
    Logger.info("Waking agent for conversation #{socket.assigns.conversation_id} (debug mode)")

    case ensure_agent_session_running(socket) do
      {:ok, socket, agent_id} ->
        Logger.info("Agent woken successfully: #{agent_id}")
        {:noreply, put_flash(socket, :info, "Agent activated and ready for debugging")}

      {:error, reason} ->
        {:noreply,
         AgentLiveHelpers.flash_session_error(socket, reason,
           log_label: "failed to wake agent",
           user_message: "The agent could not be activated. Please try again."
         )}
    end
  end

  @impl true
  def handle_info({:agent, {:status_changed, :running, nil}}, socket) do
    Logger.info("Agent is running")
    {:noreply, AgentLiveHelpers.handle_status_running(socket)}
  end

  @impl true
  def handle_info({:agent, {:status_changed, :idle, _data}}, socket) do
    Logger.info("Agent returned to idle state (execution completed)")
    {:noreply, AgentLiveHelpers.handle_status_idle(socket)}
  end

  @impl true
  def handle_info({:agent, {:status_changed, :cancelled, _data}}, socket) do
    Logger.info("Agent execution was cancelled")

    {:noreply,
     socket
     |> AgentLiveHelpers.handle_status_cancelled()
     |> push_event("scroll-to-bottom", %{})}
  end

  @impl true
  def handle_info({:agent, {:status_changed, :interrupted, interrupt_data}}, socket) do
    Logger.info("Agent execution interrupted - awaiting human response")
    Logger.debug("Interrupt data: #{inspect(interrupt_data)}")

    {:noreply, AgentLiveHelpers.handle_status_interrupted(socket, interrupt_data)}
  end

  @impl true
  def handle_info({:agent, {:status_changed, :error, reason}}, socket) do
    Logger.error("Agent execution failed: #{inspect(reason)}")
    {:noreply, AgentLiveHelpers.handle_status_error(socket, reason)}
  end

  @impl true
  def handle_info({:agent, {:todos_updated, todos}}, socket) do
    Logger.debug("TODOs updated: #{length(todos)} items")
    {:noreply, assign(socket, :todos, todos)}
  end

  @impl true
  def handle_info({:agent, {:llm_deltas, deltas}}, socket) do
    {:noreply,
     socket
     |> AgentLiveHelpers.handle_llm_deltas(deltas)
     |> push_event("scroll-to-bottom", %{})}
  end

  @impl true
  def handle_info({:agent, {:llm_message, _message}}, socket) do
    {:noreply, AgentLiveHelpers.handle_llm_message_complete(socket)}
  end

  # Replies posted without an agent — a deterministic flow step, a handoff
  # notice, an operator's own message — arrive on the conversation topic.
  @impl true
  def handle_info({:conversation, {:display_message_saved, message}}, socket) do
    {:noreply, AgentLiveHelpers.handle_display_message_saved(socket, message)}
  end

  @impl true
  def handle_info({:conversation, {:handler_changed, handler}}, socket) do
    {:noreply, assign(socket, :handler, handler)}
  end

  @impl true
  def handle_info({:agent, {:display_message_saved, display_msg}}, socket) do
    {:noreply,
     socket
     |> AgentLiveHelpers.handle_display_message_saved(display_msg)
     |> push_event("scroll-to-bottom", %{})}
  end

  @impl true
  def handle_info({:agent, {:llm_token_usage, usage}}, socket) do
    # Optional: Display token usage stats
    Logger.debug("Token usage: #{inspect(usage)}")
    {:noreply, socket}
  end

  @impl true
  def handle_info({:agent, {:conversation_title_generated, new_title, agent_id}}, socket) do
    Logger.info("Conversation title generated: #{new_title}")

    # Build page title from new title (application-specific UI concern)
    page_title =
      if String.length(new_title) > 60 do
        truncated = String.slice(new_title, 0, 60)
        "#{truncated}... - Connectix"
      else
        "#{new_title} - Connectix"
      end

    socket =
      socket
      |> AgentLiveHelpers.handle_conversation_title_generated(new_title, agent_id)
      |> assign(:page_title, page_title)

    # Update conversation list if thread history is open (application-specific UI)
    socket =
      if socket.assigns[:is_thread_history_open] && socket.assigns[:conversation] do
        stream_insert(socket, :conversation_list, socket.assigns.conversation)
      else
        socket
      end

    {:noreply, socket}
  end

  @impl true
  def handle_info({:agent, {:agent_shutdown, shutdown_data}}, socket) do
    {:noreply, AgentLiveHelpers.handle_agent_shutdown(socket, shutdown_data)}
  end

  @impl true
  def handle_info({:agent, {:tool_call_identified, tool_info}}, socket) do
    {:noreply,
     socket
     |> AgentLiveHelpers.handle_tool_call_identified(tool_info)
     |> push_event("scroll-to-bottom", %{})}
  end

  @impl true
  def handle_info({:agent, {:tool_execution_update, status, tool_info}}, socket) do
    {:noreply,
     socket
     |> AgentLiveHelpers.handle_tool_execution_update(status, tool_info)
     |> push_event("scroll-to-bottom", %{})}
  end

  @impl true
  def handle_info({:agent, {:display_message_updated, updated_msg}}, socket) do
    {:noreply,
     socket
     |> AgentLiveHelpers.handle_display_message_updated(updated_msg)
     |> push_event("scroll-to-bottom", %{})}
  end

  @impl true
  def handle_info({:DOWN, ref, :process, _pid, reason}, socket) do
    {:noreply, AgentLiveHelpers.handle_publisher_down(socket, ref, reason)}
  end

  @impl true
  def handle_info(%Phoenix.Socket.Broadcast{event: "presence_diff", payload: payload}, socket) do
    {:noreply, AgentLiveHelpers.handle_presence_diff(socket, payload)}
  end

  @impl true
  # Server-side PeerConnection's own ICE candidates (see Connectix.WebRtc.Peer)
  # — relay them to the browser's RTCPeerConnection, mirroring "phone_ice"
  # above (the browser's candidates going the other way).
  def handle_info({:webrtc, "ice", candidate}, socket) do
    {:noreply, push_event(socket, "webrtc_ice", %{candidate: candidate})}
  end

  def handle_info({:webrtc, "connected", _payload}, socket) do
    {:noreply, assign(socket, :phone_status, :connected)}
  end

  def handle_info({:webrtc, _event, _payload}, socket), do: {:noreply, socket}

  # Connectix.WebRtc.SipBridge's call-state broadcasts (the SIP leg).
  def handle_info({:webrtc_phone, :ringing, _payload}, socket) do
    {:noreply, assign(socket, :phone_status, :ringing)}
  end

  def handle_info({:webrtc_phone, :in_call, _payload}, socket) do
    {:noreply, assign(socket, :phone_status, :in_call)}
  end

  def handle_info({:webrtc_phone, :failed, %{code: code, reason: reason}}, socket) do
    {:noreply, assign(socket, phone_status: :failed, phone_error: "#{code} #{reason}")}
  end

  def handle_info({:webrtc_phone, :idle, _payload}, socket) do
    {:noreply, assign(socket, phone_status: :idle, phone_error: nil)}
  end

  def handle_info({:webrtc_phone, _event, _payload}, socket), do: {:noreply, socket}

  def handle_info({:file_system, {:file_moved, old_path, new_path}}, socket) do
    Logger.debug("FileSystem event file_moved: #{old_path} -> #{new_path}")

    socket = assign_filesystem_files(socket)

    socket =
      case socket.assigns[:selected_file_path] do
        nil ->
          socket

        selected when selected == old_path ->
          update_selected_file_for_move(socket, new_path)

        selected ->
          if String.starts_with?(selected, old_path <> "/") do
            moved_path = String.replace_prefix(selected, old_path, new_path)
            update_selected_file_for_move(socket, moved_path)
          else
            socket
          end
      end

    {:noreply, socket}
  end

  @impl true
  def handle_info({:file_system, {event_type, path}}, socket) do
    Logger.debug("FileSystem event #{event_type}: #{path}")
    {:noreply, assign_filesystem_files(socket)}
  end

  @impl true
  def handle_info(_msg, socket) do
    # Ignore unknown messages
    {:noreply, socket}
  end

  @impl true
  def terminate(_reason, _socket) do
    # PubSub subscriptions and Presence tracking are automatically cleaned up
    # when the LiveView process terminates - no manual cleanup needed

    # Note: We don't call Coordinator.stop_conversation_session/1 here
    # because other tabs/users might still be using the conversation.
    # The agent will shutdown based on:
    # 1. Presence tracking (if idle with no viewers)
    # 2. Inactivity timeout (10 minutes by default, as fallback)

    :ok
  end

  # Action path delegate: Coordinator.ensure_agent_session_running/1 takes a state
  # map (reusable from non-LiveView callers like a GraphQL bridge GenServer)
  # and returns changed. `Phoenix.Component.assign/2` accepts a map and
  # threads each key through `__changed__` for proper re-render diffing.
  defp ensure_agent_session_running(socket) do
    case Coordinator.ensure_agent_session_running(
           socket.assigns,
           AgentLiveHelpers.agent_request_opts(socket)
         ) do
      {:ok, %{agent_id: agent_id} = changed} ->
        # Mark liveness here rather than waiting for the boot broadcast, so the
        # Wake button disappears on the click that caused the wake instead of a
        # round trip later.
        {:ok, socket |> assign(changed) |> assign(:agent_alive?, true), agent_id}

      {:error, reason} ->
        {:error, reason}
    end
  end

  # Load path: subscribe-only via the helper. No factory config; if the
  # agent isn't running, the sub is recorded as :pending and auto-upgrades
  # via presence_diff once the agent appears.
  defp load_conversation(socket, conversation_id) do
    scope = socket.assigns.current_scope
    user_id = scope.user.id

    case AgentLiveHelpers.load_conversation(socket, conversation_id,
           scope: scope,
           user_id: user_id
         ) do
      {:ok, socket} ->
        # Build page title from conversation title (application-specific)
        page_title = build_page_title(socket.assigns.conversation)

        socket
        |> assign(:page_title, page_title)
        |> assign(:handler, socket.assigns.conversation.handler)
        |> subscribe_to_conversation(conversation_id)
        |> push_event("scroll-to-bottom", %{})

      {:error, socket} ->
        # Conversation not found - navigate to fresh state
        push_navigate(socket, to: ~p"/chat")
    end
  end

  # Build page title from conversation (application-specific formatting)
  defp build_page_title(conversation) do
    if conversation.title && conversation.title != "" do
      # Truncate long titles for page title
      truncated_title = String.slice(conversation.title, 0, 60)

      if String.length(conversation.title) > 60 do
        "#{truncated_title}... - Connectix"
      else
        "#{truncated_title} - Connectix"
      end
    else
      "Conversation - Connectix"
    end
  end

  # Reset to fresh conversation state using helper
  defp reset_conversation_state(socket) do
    socket
    |> AgentLiveHelpers.reset_conversation()
    |> assign(:page_title, "Connectix")
  end

  # Update conversation selection in the stream to reflect active state
  # This re-inserts both the previous and new conversation items so they re-render
  # with the updated @conversation_id assign, updating the active styling
  defp update_conversation_selection(socket, previous_id, new_id) do
    socket
    |> reset_conversation_in_stream(previous_id)
    |> reset_conversation_in_stream(new_id)
  end

  # Re-insert a conversation into the stream to trigger re-render with updated active state
  # Used when switching conversations or starting a new thread
  defp reset_conversation_in_stream(socket, nil), do: socket

  defp reset_conversation_in_stream(socket, conversation_id) do
    if socket.assigns.is_thread_history_open do
      scope = socket.assigns.current_scope

      case Conversations.get_conversation(scope, conversation_id) do
        {:ok, conversation} ->
          stream_insert(socket, :conversation_list, conversation)

        {:error, :not_found} ->
          socket
      end
    else
      socket
    end
  end

  # Who is answering this conversation: the bot, or a person who took it over.
  defp human_handling?(socket), do: socket.assigns[:handler] == :human

  defp post_operator_reply(socket, text) do
    case Conversations.post_human_reply(
           socket.assigns.current_scope,
           socket.assigns.conversation_id,
           text
         ) do
      {:ok, _message} ->
        {:noreply, assign(socket, :input, "")}

      {:error, reason} ->
        {:noreply,
         AgentLiveHelpers.flash_session_error(socket, reason,
           log_label: "failed to post operator reply",
           user_message: "Your message could not be sent. Please try again."
         )}
    end
  end

  # Every surface enters through `Connectix.Turns`, which applies the handler
  # gate and the session timeout before any agent starts. Subscribing still
  # happens here, because this process wants the agent's events.
  defp submit_turn(socket, text) do
    socket =
      case ensure_agent_session_running(socket) do
        {:ok, socket, _agent_id} -> socket
        {:error, _reason} -> socket
      end

    case Turns.submit(
           socket.assigns.current_scope,
           socket.assigns.conversation_id,
           %Turns.Input{text: text, origin: :chat},
           request_opts: AgentLiveHelpers.agent_request_opts(socket)
         ) do
      {:ok, :accepted} ->
        {:noreply, socket |> assign(:input, "") |> assign(:loading, true)}

      {:ok, _handled_or_handed_off} ->
        {:noreply, assign(socket, :input, "")}

      {:error, reason} ->
        {:noreply,
         socket
         |> assign(:loading, false)
         |> AgentLiveHelpers.flash_session_error(reason,
           log_label: "failed to submit turn",
           user_message: "Your message could not be sent. Please try again."
         )}
    end
  end

  defp set_handler(socket, handler) do
    scope = socket.assigns.current_scope

    case socket.assigns[:conversation_id] do
      nil ->
        socket

      conversation_id ->
        case Conversations.set_handler(scope, conversation_id, handler) do
          {:ok, conversation} ->
            socket
            |> assign(:handler, conversation.handler)
            |> assign(:conversation, conversation)
            |> put_flash(
              :info,
              if(handler == :human,
                do: "You are answering this conversation. The bot has stood down.",
                else: "The bot is answering this conversation again."
              )
            )

          {:error, reason} ->
            AgentLiveHelpers.flash_session_error(socket, reason,
              log_label: "failed to change handler",
              user_message: "That did not work. Please try again."
            )
        end
    end
  end

  # Replies posted without an agent (flow steps, handoff notices, an
  # operator's own message) are broadcast on the conversation's own topic.
  defp subscribe_to_conversation(socket, conversation_id) when is_binary(conversation_id) do
    if connected?(socket) do
      Phoenix.PubSub.subscribe(Connectix.PubSub, Conversations.topic(conversation_id))
    end

    socket
  end

  defp subscribe_to_conversation(socket, _none), do: socket

  # Create new conversation in database
  defp create_new_conversation(socket, first_message_text) do
    scope = socket.assigns.current_scope

    # Generate title from first message (truncate at 60 chars)
    title = String.slice(first_message_text, 0, 60)

    case Conversations.create_conversation(scope, %{
           title: title,
           metadata: %{"version" => 1}
         }) do
      {:ok, conversation} ->
        Logger.info("Created new conversation: #{conversation.id}")

        agent_id = Coordinator.conversation_agent_id(conversation.id)

        if connected?(socket) do
          user_id = socket.assigns.current_scope.user.id
          {:ok, _ref} = Coordinator.track_conversation_viewer(conversation.id, user_id)
          Logger.debug("Tracking presence for conversation #{conversation.id}, user #{user_id}")
        end

        socket =
          socket
          |> assign(:conversation, conversation)
          |> assign(:conversation_id, conversation.id)
          |> assign(:agent_id, agent_id)
          |> assign(:handler, conversation.handler)
          |> subscribe_to_conversation(conversation.id)
          |> assign(:page_title, "New Conversation - Connectix")
          |> push_patch(to: ~p"/chat?conversation_id=#{conversation.id}")

        # If thread history is open, insert the new conversation at the top of the list
        socket =
          if socket.assigns.is_thread_history_open do
            socket
            |> stream_insert(:conversation_list, conversation, at: 0)
            |> assign(:has_conversations, true)
          else
            socket
          end

        socket

      {:error, changeset} ->
        Logger.error("Failed to create conversation: #{inspect(changeset)}")

        socket
        |> put_flash(:error, "Failed to create conversation")
    end
  end

  defp assign_filesystem_files(socket) do
    # Use list_entries to get FileEntry structs and build a map of
    # path => %{type: :file, directory: virtual_dir}
    files =
      socket.assigns[:filesystem_scope]
      |> FileSystemServer.list_entries()
      |> Enum.map(fn entry ->
        directory =
          entry.path
          |> Path.dirname()
          |> case do
            "/" -> "Root"
            dir -> dir
          end

        {entry.path, %{type: :file, directory: directory}}
      end)
      |> Enum.into(%{})

    assign(socket, :files, files)
  end

  defp update_selected_file_for_move(socket, new_path) do
    case FileSystemServer.read_file(socket.assigns.filesystem_scope, new_path) do
      {:ok, %{content: content}} ->
        socket
        |> assign(:selected_file_path, new_path)
        |> assign(:selected_file_content, content)

      {:error, _reason} ->
        socket
        |> assign(:selected_file_path, nil)
        |> assign(:selected_file_content, nil)
    end
  end

  @impl true
  def render(assigns) do
    ~H"""
    <div class="flex h-screen w-screen bg-[var(--color-surface)] overflow-hidden">
      <div class="flex-shrink-0">
        <.tasks_files_sidebar
          todos={@todos}
          files={@files}
          collapsed={@sidebar_collapsed}
          active_tab={@sidebar_active_tab}
        />
      </div>

      <div class="flex flex-1 min-w-0 relative">
        <.chat_interface
          streams={@streams}
          has_messages={@has_messages}
          input={@input}
          loading={@loading}
          is_thread_history_open={@is_thread_history_open}
          streaming_delta={@streaming_delta}
          agent_status={@agent_status}
          agent_alive?={@agent_alive?}
          pending_tools={@pending_tools}
          pending_question={@pending_question}
          remaining_questions_count={length(@remaining_questions)}
          interrupt_data={@interrupt_data}
          current_scope={@current_scope}
          conversation_id={@conversation_id}
          has_more_conversations={@has_more_conversations}
          has_conversations={@has_conversations}
          debug_mode={@debug_mode}
          environments={@environments}
          current_environment={@current_environment}
          phone_status={@phone_status}
          phone_error={@phone_error}
        />
      </div>

      <%= if @selected_file_path do %>
        <.file_viewer_modal
          path={@selected_file_path}
          content={@selected_file_content}
          view_mode={@file_view_mode}
        />
      <% end %>

      <Layouts.flash_group flash={@flash} />
    </div>
    """
  end
end
