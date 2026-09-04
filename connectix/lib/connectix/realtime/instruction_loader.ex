defmodule Connectix.Realtime.InstructionLoader do
  @moduledoc """
  Supplies the temporary production screen-pop instruction locally.

  The rule applies to every verified environment: a `user.answer` event executes
  the allowlisted `screen_pop_pop` node and opens `https://google.com`. No Ruby,
  HTTP, NATS request, tenant credential, or browser-side configuration is used.
  """

  @service_uuid "static-screen-pop"
  @url "https://google.com"

  @spec load(String.t()) :: {:ok, map()} | {:error, :missing_environment}
  def load(environment_uuid) when is_binary(environment_uuid) and environment_uuid != "" do
    {:ok,
     %{
       "environment_uuid" => environment_uuid,
       "instructions" => [
         %{
           "service_uuid" => @service_uuid,
           "service_type" => "screen_pop",
           "triggers" => ["user.answer"],
           "environment_uuid" => environment_uuid,
           "profile" => %{"record_url" => @url, "pop_on" => "answer"},
           "steps" => [%{"key" => "pop", "node" => "screen_pop_pop", "on" => %{}}]
         }
       ]
     }}
  end

  def load(_environment_uuid), do: {:error, :missing_environment}

  @doc false
  def service_uuid, do: @service_uuid

  @doc false
  def url, do: @url
end
