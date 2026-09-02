defmodule AgentsDemo.Dashboards.Widget do
  @moduledoc """
  One widget definition on a board.

  A plain struct over the Mnesia row (`AgentsDemo.Portal.Store`). Everything but
  the ordered/indexed fields lives in `definition`, a map — a widget gains fields
  as the builder grows chart types, and the store keeps them without a schema
  change. A definition says only WHAT to show; the values come from the event
  projection.
  """

  defstruct [:uuid, :dashboard_uuid, :definition, :position, :updated_at]

  @doc """
  The wire shape: the definition flattened back up, with the ordered fields on
  top so a stale copy inside `definition` can never win.
  """
  def to_wire(%__MODULE__{} = widget) do
    (widget.definition || %{})
    |> Map.merge(%{
      "uuid" => widget.uuid,
      "dashboard_uuid" => widget.dashboard_uuid,
      "position" => widget.position
    })
  end
end
