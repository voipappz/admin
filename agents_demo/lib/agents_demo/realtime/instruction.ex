defmodule Connectix.Realtime.Instruction do
  @moduledoc """
  Validates screen-pop instructions and matches them to Crystal runtime events.

  `InstructionLoader` supplies the rule. This module accepts only the loaded
  event, action, URL and environment, then uses the runtime event for identity
  and deduplication.
  """

  @screen_pop_node "screen_pop_pop"

  @doc "Return only executable instructions for the requested environment."
  @spec load(term(), String.t()) :: [map()]
  def load(%{"instructions" => instructions}, environment_uuid)
      when is_list(instructions) and is_binary(environment_uuid) and environment_uuid != "" do
    instructions
    |> Enum.reduce([], fn instruction, accepted ->
      case normalize(instruction, environment_uuid) do
        {:ok, normalized} -> [normalized | accepted]
        :error -> accepted
      end
    end)
    |> Enum.reverse()
  end

  def load(_payload, _environment_uuid), do: []

  @doc "Match one normalized Crystal event to one cached instruction."
  @spec match([map()], term()) ::
          {:ok, String.t(), String.t(), map()}
          | {:error, :malformed | :missing_identity | :missing_id | :no_instruction}
  def match(instructions, %{} = event) when is_list(instructions) do
    with {:ok, user_uuid} <- present(event["user_uuid"]),
         {:ok, environment_uuid} <- present(event["environment_uuid"]),
         {:ok, event_id} <- event_id(event),
         %{} = instruction <-
           Enum.find(instructions, fn instruction ->
             event["action"] in instruction["triggers"] and
               instruction["environment_uuid"] == environment_uuid
           end),
         {:ok, command} <- execute(instruction) do
      dedupe_id =
        Enum.join(
          [instruction["service_uuid"], event["action"], event_id],
          ":"
        )

      {:ok, dedupe_id, user_uuid, command}
    else
      nil -> {:error, :no_instruction}
      {:error, reason} -> {:error, reason}
    end
  end

  def match(_instructions, _event), do: {:error, :malformed}

  defp normalize(%{} = instruction, requested_environment) do
    with {:ok, service_uuid} <- present(instruction["service_uuid"]),
         "screen_pop" <- instruction["service_type"],
         triggers when is_list(triggers) <- instruction["triggers"],
         true <- "user.answer" in triggers,
         ^requested_environment <- instruction["environment_uuid"],
         %{} = profile <- instruction["profile"],
         pop_on when pop_on in ["answer", "both"] <- profile["pop_on"],
         {:ok, url} <- https_url(profile["record_url"]),
         steps when is_list(steps) <- instruction["steps"],
         true <- Enum.any?(steps, &screen_pop_node?/1) do
      {:ok,
       %{
         "service_uuid" => service_uuid,
         "service_type" => "screen_pop",
         "triggers" => triggers,
         "environment_uuid" => requested_environment,
         "profile" => %{"record_url" => url, "pop_on" => pop_on},
         "steps" => steps
       }}
    else
      _ -> :error
    end
  end

  defp normalize(_instruction, _requested_environment), do: :error

  # Elixir implements only the nodes it is allowed to execute. The graph and
  # node name come from Ruby's PocketFlow service definition; adding another
  # action requires adding a deliberate executor here, not trusting arbitrary
  # data as a browser command.
  defp execute(%{"steps" => steps, "profile" => %{"record_url" => url}}) do
    if Enum.any?(steps, &screen_pop_node?/1) do
      {:ok, %{"action" => "tab:new", "url" => url}}
    else
      {:error, :no_instruction}
    end
  end

  defp screen_pop_node?(%{"node" => @screen_pop_node}), do: true
  defp screen_pop_node?(_step), do: false

  defp event_id(event) do
    (event["id"] || event["uuid"] || event["type_uuid"] || event["call_uuid"])
    |> present(:missing_id)
  end

  defp present(value, reason \\ :missing_identity)
  defp present(value, _reason) when is_binary(value) and value != "", do: {:ok, value}
  defp present(_value, reason), do: {:error, reason}

  defp https_url(url) when is_binary(url) and url != "" do
    case URI.parse(url) do
      %URI{scheme: "https", host: host, userinfo: nil}
      when is_binary(host) and host != "" ->
        {:ok, url}

      _ ->
        :error
    end
  rescue
    URI.Error -> :error
  end

  defp https_url(_url), do: :error
end
