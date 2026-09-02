defmodule AgentsDemo.Channels.WhatsApp.Handler do
  @moduledoc """
  Turns an inbound WhatsApp message into an agent turn.

  Signature validation, the verify-token challenge, and payload parsing happen
  in `Anu.Webhook.Plug` before anything here runs, so this module answers one
  question: whose conversation is this, and what does the agent do with it.

  ## Why a sender gets a user

  Everything downstream of `Sagents.Session` — scope queries, the per-owner
  filesystem, state persistence — is keyed on `AgentsDemo.Accounts.Scope`, and
  a scope is a user. Rather than teach all of that about a second kind of
  owner, a phone number gets a user of its own, created on first contact and
  reused after. Each sender then has their own history and their own files, and
  no scoping code has to change.

  These users cannot sign in: they are registered without a password, so
  `AgentsDemo.Accounts.get_user_by_email_and_password/2` can never return them.
  """

  @behaviour Anu.Webhook.Handler

  require Logger

  alias AgentsDemo.Accounts
  alias AgentsDemo.Accounts.Scope
  alias AgentsDemo.Accounts.User
  alias AgentsDemo.Bots
  alias AgentsDemo.Config
  alias AgentsDemo.Agents.DemoSetup
  alias AgentsDemo.Conversations
  alias AgentsDemo.Turns
  alias AgentsDemo.Turns.Input

  @impl true
  def handle_event(:message_received, %Anu.Event.Message{from: phone, text: text})
      when is_binary(phone) and is_binary(text) and text != "",
      do: accept(phone, %Input{text: text, origin: :whatsapp})

  # A tapped reply button or list row. `id` is what we put on the option, so
  # a deterministic flow matches on it rather than on the visible label —
  # which is translated, and which the sender can also type by hand.
  def handle_event(:message_received, %Anu.Event.Message{
        from: phone,
        button_reply: %{"id" => id} = reply
      })
      when is_binary(phone) and is_binary(id),
      do: accept(phone, %Input{reply_id: id, text: reply["title"], origin: :whatsapp})

  def handle_event(:message_received, %Anu.Event.Message{
        from: phone,
        list_reply: %{"id" => id} = reply
      })
      when is_binary(phone) and is_binary(id),
      do: accept(phone, %Input{reply_id: id, text: reply["title"], origin: :whatsapp})

  # Reactions, delivery receipts, media without a caption: nothing to answer.
  def handle_event(_event, _payload), do: :ok

  defp accept(phone, %Input{} = input) do
    with {:ok, user} <- sender_user(phone),
         scope = Scope.for_user(user),
         {:ok, conversation} <- find_or_create_conversation(scope, phone),
         {:ok, _outcome} <- Turns.submit(scope, conversation.id, input) do
      :ok
    else
      {:error, reason} ->
        Logger.error("WhatsApp message from #{phone} dropped: #{inspect(reason)}")
        :ok
    end
  end

  # Who owns the conversation this message belongs to.
  #
  # With WHATSAPP_OWNER_EMAIL set, every WhatsApp thread is attached to that
  # existing account, so the same conversation appears in the web UI and on the
  # phone: replies typed in the browser are delivered to WhatsApp, and messages
  # from WhatsApp show up in the browser. That is the useful shape for a single
  # operator running one number.
  #
  # Without it, each phone number gets its own account, created on first
  # contact — the right default for many unrelated senders, where nobody should
  # see anybody else's thread or files.
  defp sender_user(phone) do
    case Config.whatsapp_owner_email() do
      email when is_binary(email) -> owner_user(email)
      nil -> per_phone_user(phone)
    end
  end

  defp owner_user(email) do
    case Accounts.get_user_by_email(email) do
      %User{} = user -> {:ok, user}
      nil -> {:error, {:whatsapp_owner_not_found, email}}
    end
  end

  defp per_phone_user(phone) do
    email = "whatsapp-#{phone}@channel.invalid"

    case Accounts.get_user_by_email(email) do
      %User{} = user ->
        {:ok, user}

      nil ->
        with {:ok, %User{} = user} <- Accounts.register_user(%{email: email}) do
          DemoSetup.ensure_user_filesystem(user.id)
          {:ok, user}
        end
    end
  end

  # One live conversation per sender: the most recent WhatsApp thread, or a new
  # one. WhatsApp has no threading, so every message from a number continues
  # the same conversation.
  defp find_or_create_conversation(scope, phone) do
    case Conversations.latest_by_source_metadata(scope, "whatsapp", "phone", phone) do
      %AgentsDemo.Conversations.Conversation{} = conversation ->
        {:ok, conversation}

      nil ->
        # Titled up front rather than left for the title-generation chain. A
        # channel thread is identified by who is on the other end, which is
        # more useful in a list than a summary of the first message — and a
        # failed title call must not leave the row blank and unclickable.
        Conversations.create_conversation(scope, %{
          source: "whatsapp",
          title: "WhatsApp +#{phone}",
          metadata: %{"phone" => phone},
          bot_id: whatsapp_bot_id(scope)
        })
    end
  end

  # Which bot answers this number: the slug in WHATSAPP_BOT_SLUG, or the
  # account's default. Resolved once, when the thread is created; the
  # conversation then pins that bot's published version for its whole life.
  defp whatsapp_bot_id(scope) do
    case Bots.get_bot_by_slug(scope, Config.whatsapp_bot_slug()) do
      {:ok, bot} -> bot.id
      {:error, :not_found} -> nil
    end
  end
end
