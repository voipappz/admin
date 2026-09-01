defmodule AgentsDemo.Channels.WhatsApp do
  @moduledoc """
  Delivers agent replies over the WhatsApp Business Cloud API.

  Only completed assistant messages are sent. WhatsApp has no notion of a
  message that is still being written, so the token-by-token streaming the
  LiveView shows has nothing to map onto: a partial message would arrive as a
  separate WhatsApp message every few tokens. Everything else the agent emits
  — thinking, tool calls, tool results — is UI detail and stays out of the
  chat.

  Three content types go out: `text`, `image`, and `interactive` (reply
  buttons or a list), which is how a deterministic flow offers choices. Their
  limits are enforced when the message is written
  (`AgentsDemo.Conversations.DisplayMessage`), because `:anu` validates
  nothing and Meta's complaint arrives only after delivery.

  Only *assistant* messages are candidates, which is also the echo guard: a
  message that arrived from a phone is stored as `message_type: "user"` and
  can never be sent back to it, while a reply typed by a human who took the
  conversation over is an assistant message and does go out.
  """

  @behaviour AgentsDemo.Channels.Channel

  require Logger

  alias AgentsDemo.Config
  alias AgentsDemo.Conversations.Conversation
  alias AgentsDemo.Conversations.DisplayMessage

  @impl true
  def source, do: "whatsapp"

  @impl true
  def deliver(
        %DisplayMessage{message_type: "assistant", status: "completed"} = message,
        %Conversation{metadata: %{"phone" => phone}}
      )
      when is_binary(phone) do
    case build(Anu.Message.new(phone), message) do
      nil ->
        :ok

      outbound ->
        case Anu.deliver(outbound, client()) do
          {:ok, _response} -> :ok
          {:error, reason} -> {:error, reason}
        end
    end
  end

  # Anything else — a partial chunk, a tool call, a user's own message, a
  # conversation with no reachable customer — is simply not ours to send.
  def deliver(_message, _conversation), do: :ok

  defp build(outbound, %DisplayMessage{content_type: "text", content: %{"text" => text}})
       when is_binary(text) and text != "",
       do: Anu.Message.text(outbound, text)

  defp build(outbound, %DisplayMessage{content_type: "image", content: %{"url" => url} = content})
       when is_binary(url),
       do: Anu.Message.image(outbound, url, caption: content["caption"])

  defp build(outbound, %DisplayMessage{
         content_type: "interactive",
         content: %{"kind" => "buttons"} = content
       }) do
    outbound
    |> Anu.Message.body(content["text"])
    |> maybe_header(content["header_image_url"])
    |> maybe_footer(content["footer"])
    |> Anu.Message.buttons(Enum.map(content["buttons"], &{&1["title"], &1["id"]}))
  end

  defp build(outbound, %DisplayMessage{
         content_type: "interactive",
         content: %{"kind" => "list"} = content
       }) do
    sections =
      Enum.map(content["sections"], fn section ->
        rows =
          Enum.map(section["rows"] || [], fn row ->
            Anu.Row.new(row["id"], row["title"], description: row["description"])
          end)

        Anu.Section.new(section["title"], rows)
      end)

    outbound
    |> Anu.Message.body(content["text"])
    |> maybe_footer(content["footer"])
    |> Anu.Message.button_text(content["button_text"] || "בחרו")
    |> Anu.Message.sections(sections)
  end

  defp build(_outbound, _message), do: nil

  defp maybe_header(outbound, url) when is_binary(url) and url != "",
    do: Anu.Message.header_image(outbound, url)

  defp maybe_header(outbound, _none), do: outbound

  defp maybe_footer(outbound, text) when is_binary(text) and text != "",
    do: Anu.Message.footer(outbound, text)

  defp maybe_footer(outbound, _none), do: outbound

  # The adapter is configuration so tests can capture what would be sent
  # without a Meta account; production keeps `Anu.Adapters.Meta`.
  defp client do
    Anu.Client.new(
      finch: AgentsDemo.Finch,
      adapter: Application.get_env(:agents_demo, :whatsapp_adapter, Anu.Adapters.Meta),
      access_token: fetch!(Config.whatsapp_access_token(), "WHATSAPP_ACCESS_TOKEN"),
      phone_number_id: fetch!(Config.whatsapp_phone_number_id(), "WHATSAPP_PHONE_NUMBER_ID")
    )
  end

  defp fetch!(value, _var) when is_binary(value), do: value

  defp fetch!(nil, var) do
    raise """
    environment variable #{var} is missing.

    The WhatsApp channel is listed in config :agents_demo, :channels but has
    no credentials. Set it in .env, or drop the channel from that list.
    """
  end
end
