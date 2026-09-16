defmodule Connectix.Voice.CallRecord do
  @moduledoc """
  A phone call, recorded as a conversation.

  There is no CDR store here and there should not be one. A call is a
  conversation — the same `Connectix.Conversations` record a chat or a browser
  voice session gets, with `source: "call"` — so it lists in the same sidebar,
  loads the same transcript, and is answered by the same bot. `Connectix.Events`
  is not that: it is an append-only log of frames received from the *external*
  va-crystal, sharing no key with conversations.

  What is call-specific lives in `metadata`: who was dialed, the SIP call-id,
  and the three times a call actually has. `SipBridge`'s struct carries no
  timestamps at all, so they are stamped here as the call passes each
  transition.
  """

  require Logger

  alias Connectix.Conversations

  @doc """
  Open the conversation for an outbound call. Returns the conversation id.

  Fails cleanly rather than crashing the SIP process when the account has no
  published default bot to pin — `Connectix.Bots.resolve_pin/2` needs one, and
  a fresh install may not have it yet.
  """
  @spec open(Connectix.Accounts.Scope.t(), String.t(), String.t() | nil) ::
          {:ok, term()} | {:error, term()}
  def open(scope, callee_uri, call_id) do
    attrs = %{
      source: "call",
      title: title_for(callee_uri),
      metadata: %{
        "direction" => "outbound",
        "callee" => callee_uri,
        "sip_call_id" => call_id,
        "dialed_at" => now()
      }
    }

    case Conversations.create_conversation(scope, attrs) do
      {:ok, conversation} ->
        {:ok, conversation.id}

      {:error, reason} = error ->
        Logger.error("[call] could not open conversation for #{callee_uri}: #{inspect(reason)}")
        error

      other ->
        Logger.error("[call] unexpected conversation result for #{callee_uri}: #{inspect(other)}")
        {:error, other}
    end
  end

  @doc """
  Stamp a time onto the call's conversation metadata (`"answered_at"`,
  `"ended_at"`, …). Best-effort: a call must not fail because bookkeeping did.
  """
  @spec stamp(Connectix.Accounts.Scope.t() | nil, term() | nil, String.t(), map()) :: :ok
  def stamp(scope, conversation_id, key, extra \\ %{})
  def stamp(nil, _conversation_id, _key, _extra), do: :ok
  def stamp(_scope, nil, _key, _extra), do: :ok

  def stamp(scope, conversation_id, key, extra) do
    with {:ok, conversation} <- Conversations.get_conversation(scope, conversation_id) do
      metadata =
        conversation.metadata
        |> Map.put(key, now())
        |> Map.merge(extra)

      Conversations.update_conversation(conversation, %{metadata: metadata})
    end

    :ok
  rescue
    error ->
      Logger.warning("[call] could not stamp #{key}: #{Exception.message(error)}")
      :ok
  end

  defp now, do: DateTime.utc_now() |> DateTime.to_iso8601()

  # "sip:0545234585@2safenet.voipappz.io:5060" -> "Call 0545234585"
  defp title_for(uri) do
    number =
      uri
      |> to_string()
      |> String.replace_prefix("sip:", "")
      |> String.split("@")
      |> List.first()

    "Call #{number}"
  end
end
