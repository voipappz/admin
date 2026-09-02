defmodule AgentsDemo.Dashboards do
  @moduledoc """
  Boards and their widget definitions — the dashboard builder's storage.

  Backed by Mnesia (`AgentsDemo.Portal.Store`), not a database: the portal keeps
  its own state inside the BEAM, so there is no Postgres and nothing to run
  beside the app. This module is the context the controllers call; the store is
  where the transactions live.

  **This is configuration, not events.** A widget definition says what to show;
  the values it shows come from the event projection, which is a separate
  concern. So a board can be built and saved here while its widgets render empty.
  """

  alias AgentsDemo.Portal.Store

  defdelegate list_dashboards(), to: Store
  defdelegate get_dashboard(uuid), to: Store
  defdelegate create_dashboard(name), to: Store
  defdelegate rename_dashboard(dashboard, name), to: Store
  defdelegate delete_dashboard(uuid), to: Store

  defdelegate list_widgets(dashboard_uuid \\ "default"), to: Store
  defdelegate get_widget(uuid), to: Store
  defdelegate create_widget(attrs, dashboard_uuid \\ "default"), to: Store
  defdelegate update_widget(widget, attrs), to: Store
  defdelegate delete_widget(uuid), to: Store
end
