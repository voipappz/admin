defmodule Connectix.Capabilities.HumanHandoff do
  @moduledoc """
  Hand the conversation to a person and stand down.

  Posts the ticket summary and the transfer notice as bot replies (so they
  reach the channel), marks the conversation `handler: :human`, and — when
  called as a tool — ends the model's run with a `:halt` interrupt: there is
  no next turn for the bot. Idempotent per conversation turn: a second call
  in the same turn changes nothing and returns the same result, because a
  model may repeat a tool call it already made.

  The transfer wording comes from the version's `handoff` area, chosen by
  whether the bot is in hours; the summary is what the caller (model or
  flow) composed.
  """

  @behaviour Connectix.Capabilities.Capability

  alias Connectix.Bots.Version.Handoff
  alias Connectix.Conversations
  alias Connectix.Skills.Capability

  defmodule Args do
    @moduledoc false
    use Connectix.Capabilities.Args,
      fields: [summary: :string, topic: :string],
      required: [:summary]

    def validate(%__MODULE__{} = args) do
      %{}
      |> max_len(:summary, args.summary, 4_000)
      |> max_len(:topic, args.topic, 200)
      |> done(args)
    end

    def descriptions,
      do: %{
        summary:
          "A short ticket for the human agent: who, which line, what the problem is, what was tried",
        topic: "One line naming the topic"
      }
  end

  @default_in_hours "מעביר אתכם כעת לנציג תמיכה אנושי, שימשיך את הטיפול בפנייתכם.\nהמתינו ונציג יחזור אליכם בהקדם האפשרי."
  @default_after_hours "פנייתכם הועברה בהצלחה לנציג התמיכה.\nהיא תטופל בתחילת יום העסקים הקרוב, במהלך שעות הפעילות."

  def capability do
    %Capability{
      id: "hand_off",
      module: __MODULE__,
      description:
        "Hand the conversation to a human support agent with a ticket summary. Ends your turn.",
      risk: :external,
      approval: :none,
      idempotent: true,
      timeout_ms: 10_000
    }
  end

  @impl true
  def args_schema, do: Args

  @impl true
  def call(%Args{summary: summary, topic: topic}, context) do
    case perform(context.scope, context.conversation_id, %{summary: summary, topic: topic}, []) do
      {:ok, _conversation} ->
        {:interrupt, "Handed off to a human agent.",
         %{
           type: :halt,
           source_tool: "hand_off",
           message: "The conversation was handed to a human agent."
         }}

      {:error, reason} ->
        {:error, "hand_off failed: #{inspect(reason)}"}
    end
  end

  @doc """
  The handoff itself, usable by a flow as well as by the tool. Options:
  `:handoff` (the version's `%Handoff{}`), `:in_hours?` (default true),
  `:key` (idempotency key; default the conversation's current turn).
  """
  def perform(scope, conversation_id, %{summary: summary} = ticket, opts) do
    with {:ok, conversation} <- Conversations.get_conversation(scope, conversation_id) do
      key = Keyword.get(opts, :key, turn_key(conversation))

      if conversation.handler == :human and conversation.metadata["handoff_key"] == key do
        {:ok, conversation}
      else
        handoff = Keyword.get(opts, :handoff) || %Handoff{}
        in_hours? = Keyword.get(opts, :in_hours?, true)
        text = transfer_text(handoff, in_hours?)

        with {:ok, _summary} <-
               Conversations.post_bot_reply(scope, conversation_id, %{
                 "text" => ticket_text(ticket, summary)
               }),
             {:ok, _notice} <-
               Conversations.post_bot_reply(scope, conversation_id, %{"text" => text}) do
          Conversations.hand_off(scope, conversation_id, %{key: key, topic: ticket[:topic]})
        end
      end
    end
  end

  defp ticket_text(%{topic: topic}, summary) when is_binary(topic) and topic != "",
    do: "📩 פנייה חדשה למוקד התמיכה\n\n📝 נושא: #{topic}\n#{summary}"

  defp ticket_text(_ticket, summary), do: "📩 פנייה חדשה למוקד התמיכה\n\n#{summary}"

  defp transfer_text(%Handoff{in_hours_text: text}, true) when is_binary(text) and text != "",
    do: text

  defp transfer_text(%Handoff{after_hours_text: text}, false) when is_binary(text) and text != "",
    do: text

  defp transfer_text(_handoff, true), do: @default_in_hours
  defp transfer_text(_handoff, false), do: @default_after_hours

  defp turn_key(conversation) do
    "#{conversation.id}:#{conversation.last_user_message_at && DateTime.to_unix(conversation.last_user_message_at, :microsecond)}"
  end
end
