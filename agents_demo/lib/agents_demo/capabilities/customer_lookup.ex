defmodule AgentsDemo.Capabilities.CustomerLookup do
  @moduledoc """
  Find the customer account behind a business line number.

  Read-only and idempotent. The line is normalised and validated first, so
  the CRM only ever sees digits; a CRM outage is a bounded, honest result
  (`found: false, reason: "crm_unavailable"`) rather than an exception the
  model would have to guess about. The token never appears in a result or
  an error. Logs carry the line masked to its last four digits.
  """

  @behaviour AgentsDemo.Capabilities.Capability

  alias AgentsDemo.Integrations.Fireberry
  alias AgentsDemo.Phone
  alias AgentsDemo.Skills.Capability

  require Logger

  defmodule Args do
    @moduledoc false
    use AgentsDemo.Capabilities.Args

    embedded_schema do
      field :line_number, :string
    end

    def changeset(args, attrs) do
      args
      |> cast(attrs, [:line_number])
      |> validate_required([:line_number])
      |> validate_length(:line_number, max: 32)
    end

    def descriptions,
      do: %{
        line_number:
          "The customer's business line as they typed it, e.g. 03-1234567 or +972-3-1234567"
      }
  end

  @doc "The capability record, with its policy."
  def capability do
    %Capability{
      id: "customer_lookup",
      module: __MODULE__,
      description:
        "Look up the customer account (PBX domain, trunk numbers) for a business line number.",
      risk: :read,
      approval: :none,
      idempotent: true,
      timeout_ms: 10_000,
      redact: ["domain", "trunks"]
    }
  end

  @impl true
  def args_schema, do: Args

  @impl true
  def call(%Args{line_number: text}, _context), do: lookup(text)

  @doc "The same lookup, callable from a deterministic flow without a model."
  @spec lookup(String.t()) :: {:ok, map()}
  def lookup(text) do
    case Phone.normalise(text) do
      :error ->
        {:ok, %{found: false, reason: "invalid_line_number"}}

      {:ok, line} ->
        case Fireberry.find_by_line(line) do
          {:ok, account} ->
            {:ok, %{found: true, line: line, domain: account.domain, trunks: account.trunks}}

          {:error, :not_found} ->
            {:ok, %{found: false, line: line, reason: "not_found"}}

          {:error, reason} when reason in [:not_configured, :unavailable] ->
            Logger.warning("customer_lookup for …#{String.slice(line, -4, 4)}: CRM #{reason}")
            {:ok, %{found: false, line: line, reason: "crm_unavailable"}}
        end
    end
  end
end
