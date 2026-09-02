defmodule AgentsDemo.Capabilities.Args do
  @moduledoc """
  `use AgentsDemo.Capabilities.Args` declares a capability's argument struct
  and gives it the two functions a capability needs: `json_schema/0`, derived
  from the fields for the model, and `cast/1`, which types the model's map
  and runs the module's own `validate/1`.

      defmodule Args do
        use AgentsDemo.Capabilities.Args,
          fields: [line_number: :string, mode: {:string, default: "echo"}],
          required: [:line_number]

        def validate(%__MODULE__{} = args) do
          %{} |> max_len(:line_number, args.line_number, 32) |> done(args)
        end

        def descriptions, do: %{line_number: "The business line, digits only"}
      end

  Plain structs and functions — no schema library. Errors are
  `%{field => [message]}`, the shape every validator in the app returns.
  """

  @callback validate(struct()) :: {:ok, struct()} | {:error, %{atom() => [String.t()]}}
  @callback descriptions() :: %{optional(atom()) => String.t()}

  defmacro __using__(opts) do
    specs =
      opts
      |> Keyword.fetch!(:fields)
      |> Enum.map(fn
        {name, {type, field_opts}} -> {name, type, Keyword.get(field_opts, :default)}
        {name, type} -> {name, type, nil}
      end)

    struct_fields = for {name, _type, default} <- specs, do: {name, default}
    types = for {name, type, _default} <- specs, do: {name, type}
    required = Keyword.get(opts, :required, [])

    quote do
      @behaviour AgentsDemo.Capabilities.Args
      import AgentsDemo.Capabilities.Args, only: [max_len: 4, inclusion: 4, done: 2]

      defstruct unquote(Macro.escape(struct_fields))

      @doc false
      def __args__, do: %{types: unquote(Macro.escape(types)), required: unquote(required)}

      @doc false
      def cast(attrs) when is_map(attrs), do: AgentsDemo.Capabilities.Args.cast(__MODULE__, attrs)

      @doc false
      def json_schema, do: AgentsDemo.Capabilities.Args.json_schema(__MODULE__)

      @doc false
      def descriptions, do: %{}

      @doc false
      def validate(%__MODULE__{} = args), do: {:ok, args}

      defoverridable descriptions: 0, validate: 1
    end
  end

  @doc "Type the model's map into `module`'s struct, then run its `validate/1`."
  def cast(module, attrs) when is_map(attrs) do
    %{types: types, required: required} = module.__args__()
    attrs = Map.new(attrs, fn {key, value} -> {to_string(key), value} end)

    {values, errors} =
      Enum.reduce(types, {%{}, %{}}, fn {name, type}, {values, errors} ->
        case Map.fetch(attrs, Atom.to_string(name)) do
          :error ->
            {values, errors}

          {:ok, nil} ->
            {Map.put(values, name, nil), errors}

          {:ok, value} ->
            case coerce(type, value) do
              {:ok, typed} -> {Map.put(values, name, typed), errors}
              :error -> {values, err(errors, name, "is invalid")}
            end
        end
      end)

    args = struct(module, values)

    errors =
      Enum.reduce(required, errors, fn name, acc ->
        if Map.get(args, name) in [nil, ""], do: err(acc, name, "can't be blank"), else: acc
      end)

    if map_size(errors) == 0, do: module.validate(args), else: {:error, errors}
  end

  @doc "A JSON schema object for the module's fields; required = the declared required list."
  def json_schema(module) do
    %{types: types, required: required} = module.__args__()
    descriptions = module.descriptions()

    properties =
      Map.new(types, fn {field, type} ->
        property =
          %{"type" => json_type(type)}
          |> maybe_put("description", Map.get(descriptions, field))

        {Atom.to_string(field), property}
      end)

    %{
      "type" => "object",
      "properties" => properties,
      "required" => Enum.map(required, &Atom.to_string/1)
    }
  end

  ## Validation helpers, imported into every Args module.

  def max_len(errors, field, value, max) when is_binary(value) do
    if String.length(value) <= max,
      do: errors,
      else: err(errors, field, "should be at most #{max} character(s)")
  end

  def max_len(errors, _field, _value, _max), do: errors

  def inclusion(errors, _field, nil, _allowed), do: errors

  def inclusion(errors, field, value, allowed),
    do: if(value in allowed, do: errors, else: err(errors, field, "is invalid"))

  def done(errors, args) when map_size(errors) == 0, do: {:ok, args}
  def done(errors, _args), do: {:error, errors}

  defp err(errors, field, msg), do: Map.update(errors, field, [msg], &(&1 ++ [msg]))

  defp coerce(:string, value) when is_binary(value), do: {:ok, value}
  defp coerce(:integer, value) when is_integer(value), do: {:ok, value}

  defp coerce(:integer, value) when is_binary(value) do
    case Integer.parse(value) do
      {int, ""} -> {:ok, int}
      _other -> :error
    end
  end

  defp coerce(:float, value) when is_number(value), do: {:ok, value / 1}
  defp coerce(:boolean, value) when is_boolean(value), do: {:ok, value}
  defp coerce({:array, _inner}, value) when is_list(value), do: {:ok, value}
  defp coerce(_type, _value), do: :error

  defp json_type(:string), do: "string"
  defp json_type(:integer), do: "integer"
  defp json_type(:float), do: "number"
  defp json_type(:boolean), do: "boolean"
  defp json_type({:array, _inner}), do: "array"
  defp json_type(_other), do: "string"

  defp maybe_put(map, _key, nil), do: map
  defp maybe_put(map, key, value), do: Map.put(map, key, value)
end
