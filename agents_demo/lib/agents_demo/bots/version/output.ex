defmodule AgentsDemo.Bots.Version.Output do
  @moduledoc "The shape of a reply: free text or a structured schema."
  @derive Jason.Encoder
  defstruct format: "text", json_schema: nil, max_reply_chars: nil

  @formats ~w(text json)
  @fields [:format, :json_schema, :max_reply_chars]

  def new(attrs \\ %{}) do
    m = AgentsDemo.Bots.Version.take(attrs, %__MODULE__{}, @fields)
    m = %{m | format: m.format || "text"}

    errors =
      %{}
      |> AgentsDemo.Bots.Version.inclusion(:format, m.format, @formats)
      |> AgentsDemo.Bots.Version.range(:max_reply_chars, m.max_reply_chars, gt: 0)

    AgentsDemo.Bots.Version.done(errors, struct(__MODULE__, m))
  end
end
