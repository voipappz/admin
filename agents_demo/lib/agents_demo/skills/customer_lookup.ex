defmodule Connectix.Skills.CustomerLookup do
  @moduledoc "Look customers up in the CRM by business line. Exposes `customer_lookup`."

  @behaviour Connectix.Skills.Skill

  @impl true
  def id, do: "customer_lookup"
  @impl true
  def version, do: "1.0.0"
  @impl true
  def name, do: "Customer lookup"
  @impl true
  def description,
    do:
      "Find a customer's PBX domain and trunk numbers from their business line number (read-only)."

  @impl true
  def settings_schema, do: nil

  @impl true
  def capabilities(_settings), do: [Connectix.Capabilities.CustomerLookup.capability()]

  @impl true
  def instructions(_settings) do
    """
    When the customer gives a business line number, call `customer_lookup` with it exactly as typed. \
    If `found` is false, ask for the full line number again; never invent a domain or trunk numbers.\
    """
  end
end
