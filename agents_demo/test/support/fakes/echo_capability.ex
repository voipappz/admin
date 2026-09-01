defmodule AgentsDemo.Fakes.EchoCapability do
  @moduledoc "A capability for tests: echoes its argument, or misbehaves on request."
  @behaviour AgentsDemo.Capabilities.Capability

  defmodule Args do
    @moduledoc false
    use AgentsDemo.Capabilities.Args

    embedded_schema do
      field :text, :string
      field :mode, :string, default: "echo"
    end

    def changeset(args, attrs) do
      args
      |> cast(attrs, [:text, :mode])
      |> validate_required([:text])
      |> validate_inclusion(:mode, ~w(echo raise sleep))
    end

    def descriptions, do: %{text: "What to echo back"}
  end

  @impl true
  def args_schema, do: Args

  @impl true
  def call(%Args{mode: "raise"}, _context), do: raise("secret token abc123 leaked")

  def call(%Args{mode: "sleep"}, _context) do
    Process.sleep(500)
    {:ok, "late"}
  end

  def call(%Args{text: text}, context),
    do:
      {:ok,
       %{echo: text, user_id: context.scope.user.id, conversation_id: context.conversation_id}}

  def capability(overrides \\ %{}) do
    struct(
      %AgentsDemo.Skills.Capability{
        id: "echo",
        module: __MODULE__,
        description: "Echoes text",
        risk: :read,
        timeout_ms: 100
      },
      overrides
    )
  end
end
