defmodule Connectix.Conversations.Conversation do
  @moduledoc """
  A conversation between a user and an agent — a plain struct, one Mnesia row,
  pinned to a bot version. Loaded associations (`bot`, `bot_version`,
  `agent_state`, `display_messages`) are attached by the context when needed.
  """
  @derive {Jason.Encoder,
           only: [:id, :user_id, :bot_id, :bot_version_id, :title, :version, :metadata,
                  :source, :handler, :handed_off_at, :last_user_message_at, :inserted_at]}
  defstruct [
    :id, :user_id, :bot_id, :bot_version_id, :title, :handed_off_at,
    :last_user_message_at, :flow_state, :inserted_at, :updated_at,
    # loaded associations (nil/[] until attached)
    :bot, :bot_version, :agent_state,
    version: 1, metadata: %{}, source: "chat", handler: :bot, display_messages: []
  ]

  @doc "Validate a new conversation. `chat` source requires a user; channels don't."
  def validate_new(owner_id, attrs, %{bot_id: bot_id, bot_version_id: bot_version_id}) do
    attrs = Map.new(attrs, fn {k, v} -> {to_string(k), v} end)
    source = attrs["source"] || "chat"

    conv = %__MODULE__{
      user_id: owner_id,
      bot_id: bot_id,
      bot_version_id: bot_version_id,
      title: attrs["title"],
      version: attrs["version"] || 1,
      metadata: attrs["metadata"] || %{},
      source: source
    }

    errors =
      %{}
      |> req(:bot_id, bot_id)
      |> req(:bot_version_id, bot_version_id)
      |> then(fn e -> if source == "chat", do: req(e, :user_id, owner_id), else: e end)

    if map_size(errors) == 0, do: {:ok, conv}, else: {:error, errors}
  end

  defp req(errors, field, value) when value in [nil, ""], do: Map.put(errors, field, ["can't be blank"])
  defp req(errors, _f, _v), do: errors
end
