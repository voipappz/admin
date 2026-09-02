defmodule AgentsDemo.Dashboards.Dashboard do
  @moduledoc """
  A named board the builder groups widgets under.

  A plain struct, not an Ecto schema: the portal's storage is Mnesia now
  (`AgentsDemo.Portal.Store`), and this is only the shape the store reads rows
  into and the controllers render. `uuid` is a string minted by whoever creates
  the row, and the seeded board's id is the literal `"default"`.
  """

  @derive {Jason.Encoder, only: [:uuid, :name, :position]}
  defstruct [:uuid, :name, :position, :updated_at]
end
