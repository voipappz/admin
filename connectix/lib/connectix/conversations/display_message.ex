defmodule Connectix.Conversations.DisplayMessage do
  @moduledoc """
  A user-facing message for the UI — a plain struct, one Mnesia row.

  `content` is a map whose shape depends on `content_type` (text, thinking,
  tool_call, tool_result, todo_snapshot, …). `sequence` orders multi-part
  messages within one timestamp. Validation stays at this boundary so invalid
  transport payloads never enter the store.
  """
  @derive Jason.Encoder
  defstruct [
    :id,
    :conversation_id,
    :message_type,
    :content,
    :tool_call_id,
    :content_type,
    :status,
    :metadata,
    :inserted_at,
    sequence: 0
  ]

  @content_types ~w(text thinking image file_reference structured_data notification error tool_call tool_result todo_snapshot interactive)
  @statuses ~w(pending executing completed failed interrupted cancelled)
  @todo_statuses ~w(pending in_progress completed cancelled)
  @max_buttons 3
  @max_rows 10
  @max_button_title 20
  @max_row_title 24
  @max_row_description 72

  @doc "Build and validate a display message for a conversation."
  def new(conversation_id, attrs) do
    attrs = Map.new(attrs, fn {k, v} -> {to_string(k), v} end)

    msg = %__MODULE__{
      conversation_id: conversation_id,
      message_type: attrs["message_type"],
      content: attrs["content"],
      tool_call_id: attrs["tool_call_id"],
      content_type: attrs["content_type"],
      sequence: Map.get(attrs, "sequence", 0),
      status: Map.get(attrs, "status", "completed"),
      metadata: attrs["metadata"] || %{}
    }

    errors =
      %{}
      |> required(:message_type, msg.message_type)
      |> required(:content, msg.content)
      |> required(:content_type, msg.content_type)
      |> inclusion(:content_type, msg.content_type, @content_types)
      |> inclusion(:status, msg.status, @statuses)
      |> validate_sequence(msg.sequence)
      |> validate_content_error(msg.content_type, msg.content)

    if errors == %{}, do: {:ok, msg}, else: {:error, errors}
  end

  @doc "Infer a content type from a display-message content map."
  def content_type_for(%{"kind" => kind}) when kind in ["buttons", "list"], do: "interactive"
  def content_type_for(%{"url" => _}), do: "image"
  def content_type_for(_content), do: "text"

  @doc "Every option a user could pick from an interactive message."
  def options(%__MODULE__{
        content_type: "interactive",
        content: %{"kind" => "buttons", "buttons" => buttons}
      }),
      do: Enum.map(buttons, &{&1["id"], &1["title"]})

  def options(%__MODULE__{
        content_type: "interactive",
        content: %{"kind" => "list", "sections" => sections}
      }),
      do: sections |> Enum.flat_map(&(&1["rows"] || [])) |> Enum.map(&{&1["id"], &1["title"]})

  def options(_message), do: []

  @doc "Text representation used by conversation search."
  def to_text(%__MODULE__{content_type: type, content: %{"text" => text}})
      when type in ~w(text thinking notification error),
      do: text

  def to_text(%__MODULE__{content_type: "interactive", content: %{"text" => text}} = message) do
    choices = message |> options() |> Enum.map_join("\n", fn {_id, title} -> "• " <> title end)
    text <> "\n" <> choices
  end

  def to_text(%__MODULE__{content_type: "image", content: content}),
    do: Map.get(content, "caption") || Map.get(content, "alt_text") || ""

  def to_text(%__MODULE__{content_type: "file_reference", content: %{"name" => name}}),
    do: "File: #{name}"

  def to_text(%__MODULE__{content_type: "structured_data", content: content}),
    do: "Data: #{Map.get(content, "format", "")}"

  def to_text(%__MODULE__{
        content_type: "tool_call",
        content: %{"name" => name, "arguments" => args}
      }),
      do: "Tool call: #{name}(#{inspect(args)})"

  def to_text(%__MODULE__{
        content_type: "tool_result",
        content: %{"name" => name, "content" => content}
      }),
      do: "Tool result from #{name}: #{content}"

  def to_text(%__MODULE__{content_type: "todo_snapshot", content: %{"summary" => summary}})
      when is_map(summary),
      do:
        "Todo list: #{Map.get(summary, "pending", 0)} pending, #{Map.get(summary, "in_progress", 0)} in progress, #{Map.get(summary, "completed", 0)} completed"

  def to_text(%__MODULE__{content_type: "todo_snapshot", content: %{"todos" => todos}}),
    do: "Todo list (#{length(todos)} items)"

  def to_text(_message), do: ""

  defp required(errors, field, value) when value in [nil, ""],
    do: add(errors, field, "can't be blank")

  defp required(errors, _field, _value), do: errors

  defp inclusion(errors, _field, nil, _allowed), do: errors

  defp inclusion(errors, field, value, allowed),
    do: if(value in allowed, do: errors, else: add(errors, field, "is invalid"))

  defp validate_sequence(errors, value) when is_integer(value) and value >= 0, do: errors

  defp validate_sequence(errors, _value),
    do: add(errors, :sequence, "must be greater than or equal to 0")

  defp validate_content_error(errors, nil, _content), do: errors

  defp validate_content_error(errors, type, content) do
    case validate_content(type, content) do
      :ok -> errors
      {:error, message} -> add(errors, :content, message)
    end
  end

  defp validate_content(type, %{"text" => _}) when type in ~w(text thinking notification error),
    do: :ok

  defp validate_content("image", %{"url" => _}), do: :ok
  defp validate_content("image", %{"data" => _, "mime_type" => _}), do: :ok
  defp validate_content("file_reference", %{"path" => _, "name" => _}), do: :ok
  defp validate_content("structured_data", %{"format" => _, "data" => _}), do: :ok
  defp validate_content("tool_call", %{"call_id" => _, "name" => _, "arguments" => _}), do: :ok

  defp validate_content("tool_result", %{"tool_call_id" => _, "name" => _, "content" => _}),
    do: :ok

  defp validate_content("todo_snapshot", %{"todos" => todos}) when is_list(todos) do
    if Enum.all?(todos, &valid_todo_entry?/1),
      do: :ok,
      else: {:error, "todo_snapshot has invalid todo entries"}
  end

  defp validate_content("interactive", %{
         "kind" => "buttons",
         "text" => text,
         "buttons" => buttons
       })
       when is_binary(text) and is_list(buttons) do
    cond do
      buttons == [] or length(buttons) > @max_buttons ->
        {:error, "buttons must have 1 to #{@max_buttons} entries"}

      not Enum.all?(buttons, &option?(&1, @max_button_title)) ->
        {:error, "each button needs an id and a title of at most #{@max_button_title} characters"}

      true ->
        :ok
    end
  end

  defp validate_content("interactive", %{"kind" => "list", "text" => text, "sections" => sections})
       when is_binary(text) and is_list(sections) do
    rows = Enum.flat_map(sections, &(Map.get(&1, "rows") || []))

    cond do
      sections == [] or not Enum.all?(sections, &is_map/1) ->
        {:error, "a list needs at least one section"}

      rows == [] or length(rows) > @max_rows ->
        {:error, "a list must have 1 to #{@max_rows} rows in total"}

      not Enum.all?(rows, &option?(&1, @max_row_title)) ->
        {:error, "each row needs an id and a title of at most #{@max_row_title} characters"}

      not Enum.all?(
        rows,
        &(String.length(Map.get(&1, "description") || "") <= @max_row_description)
      ) ->
        {:error, "a row description is at most #{@max_row_description} characters"}

      true ->
        :ok
    end
  end

  defp validate_content("interactive", _content),
    do:
      {:error, "interactive content needs kind buttons (text, buttons) or list (text, sections)"}

  defp validate_content(type, _content),
    do: {:error, "invalid structure for content_type #{type}"}

  defp valid_todo_entry?(%{"id" => id, "content" => content, "status" => status}),
    do: is_integer(id) and is_binary(content) and status in @todo_statuses

  defp valid_todo_entry?(_entry), do: false

  defp option?(%{"id" => id, "title" => title}, max),
    do:
      is_binary(id) and id != "" and is_binary(title) and title != "" and
        String.length(title) <= max

  defp option?(_option, _max), do: false
  defp add(errors, field, message), do: Map.update(errors, field, [message], &(&1 ++ [message]))
end
