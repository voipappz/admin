defmodule Connectix.Realtime.InstructionLoader do
  @moduledoc """
  The screen-pop instruction for an environment, from the rule file.

  There is one rule — `priv/pocketflow/screen_pop.yaml`, read by
  `Connectix.Realtime.PopRule` — and it decides every pop: which events, which
  agent states, where the agent id is, which URL opens. This module presents
  that rule in the instruction shape `Connectix.Realtime.Instruction` validates
  and matches, for the environment-scoped path through `Realtime.ScreenPop`.

  It replaces two earlier sources of instructions, deliberately:

    * the mothership, asked over NATS (`screen_pop.instructions.load`). The
      portal no longer holds a NATS connection, and the Ruby responder has no
      HTTP route, so that path had no transport left;
    * a hardcoded stand-in that opened `https://google.com` on `user.answer`
      for every environment, which stood in for long enough to reach
      production.

  No network, no per-environment variation: the rule is the deployment's, and
  `SCREEN_POP_RULE` / `SCREEN_POP_URL` are how a deployment changes it.
  """

  alias Connectix.Realtime.PopRule

  @spec load(String.t()) :: {:ok, map()} | {:error, :missing_environment}
  def load(environment_uuid) when is_binary(environment_uuid) and environment_uuid != "" do
    rule = PopRule.rule()

    {:ok,
     %{
       "environment_uuid" => environment_uuid,
       "instructions" => [
         %{
           "service_uuid" => service_uuid(),
           "service_type" => "screen_pop",
           "triggers" => PopRule.triggers(),
           "environment_uuid" => environment_uuid,
           "profile" => %{
             "record_url" => PopRule.record_url(),
             "pop_on" => get_in(rule, ["profile", "pop_on"]) || "answer"
           },
           "steps" => Map.get(rule, "steps") || [%{"key" => "pop", "node" => "screen_pop_pop", "on" => %{}}]
         }
       ]
     }}
  end

  def load(_environment_uuid), do: {:error, :missing_environment}

  @doc "The rule's service id — part of every dedupe key, so it must be stable."
  @spec service_uuid() :: String.t()
  def service_uuid, do: Map.get(PopRule.rule(), "service_uuid") || "callcenter-screen-pop"
end
