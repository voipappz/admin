defmodule AgentsDemo.Capabilities.Args do
  @moduledoc """
  `use AgentsDemo.Capabilities.Args` in an embedded schema to get the two
  functions a capability's argument schema needs: `json_schema/0`, derived
  from the fields for the model, and `cast/1`, which runs the module's own
  `changeset/2` and returns the typed struct.

      defmodule Args do
        use AgentsDemo.Capabilities.Args

        embedded_schema do
          field :line_number, :string
        end

        def changeset(args, attrs) do
          args |> cast(attrs, [:line_number]) |> validate_required([:line_number])
        end

        def descriptions, do: %{line_number: "The business line, digits only"}
      end
  """

  defmacro __using__(_opts) do
    quote do
      use Ecto.Schema
      import Ecto.Changeset

      @primary_key false
      @behaviour AgentsDemo.Capabilities.Args

      @doc false
      def cast(attrs) when is_map(attrs) do
        __MODULE__
        |> struct()
        |> changeset(attrs)
        |> apply_action(:call)
      end

      @doc false
      def json_schema, do: AgentsDemo.Capabilities.Args.json_schema(__MODULE__)

      @doc false
      def descriptions, do: %{}

      defoverridable descriptions: 0
    end
  end

  @callback changeset(struct(), map()) :: Ecto.Changeset.t()
  @callback descriptions() :: %{optional(atom()) => String.t()}

  @doc "A JSON schema object for the module's fields; required = fields its changeset requires."
  def json_schema(module) do
    descriptions = module.descriptions()

    properties =
      Map.new(module.__schema__(:fields), fn field ->
        type = module.__schema__(:type, field)

        property =
          %{"type" => json_type(type)}
          |> maybe_put("description", Map.get(descriptions, field))

        {Atom.to_string(field), property}
      end)

    required =
      module
      |> struct()
      |> module.changeset(%{})
      |> Map.fetch!(:errors)
      |> Enum.filter(fn {_field, {_msg, opts}} -> opts[:validation] == :required end)
      |> Enum.map(fn {field, _error} -> Atom.to_string(field) end)

    %{"type" => "object", "properties" => properties, "required" => required}
  end

  defp json_type(:string), do: "string"
  defp json_type(:integer), do: "integer"
  defp json_type(:float), do: "number"
  defp json_type(:boolean), do: "boolean"
  defp json_type({:array, _inner}), do: "array"
  defp json_type(_other), do: "string"

  defp maybe_put(map, _key, nil), do: map
  defp maybe_put(map, key, value), do: Map.put(map, key, value)
end
