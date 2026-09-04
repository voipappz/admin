defmodule Connectix.Skills.HumanHandoff do
  @moduledoc "Hand a conversation to a person. Exposes `hand_off`; the bot stands down afterwards."

  @behaviour Connectix.Skills.Skill

  @impl true
  def id, do: "human_handoff"
  @impl true
  def version, do: "1.0.0"
  @impl true
  def name, do: "Human handoff"
  @impl true
  def description,
    do: "Transfer the conversation to a human agent with a ticket summary and stop answering."

  @impl true
  def settings_schema, do: nil

  @impl true
  def capabilities(_settings), do: [Connectix.Capabilities.HumanHandoff.capability()]

  @impl true
  def instructions(_settings) do
    """
    When the problem cannot be solved here, or the customer asks for a person, call `hand_off` once with a \
    concise ticket summary (customer, line, topic, what was tried). Do not write a farewell after calling it; \
    the handoff message is sent for you and your turn ends.\
    """
  end
end
