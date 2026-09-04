defmodule Connectix.Integrations.Fireberry do
  @moduledoc """
  The customer CRM, read-only: find an account by its business line.

  Follows the upstream-client rules this project uses everywhere: the token
  comes from the environment (`FIREBERRY_TOKEN`) at call time and never from
  bot data; unconfigured means `{:error, :not_configured}` rather than a
  crash, so development works offline; nothing here raises on a bad
  upstream, and the line is validated to digits before it is interpolated
  into the query. Field ids are Fireberry's: `telephone1` is the line,
  `pcfsystemfield179` the PBX domain, `pcfsystemfield166` the trunk numbers.

  Tests point `config :agents_demo, :fireberry_req_options` at `Req.Test`.
  """

  alias Connectix.Config

  @url "https://api.fireberry.com/api/query/"
  @fields "telephone1,pcfsystemfield179,pcfsystemfield166"

  @type account :: %{line: String.t(), domain: String.t() | nil, trunks: String.t() | nil}

  @spec find_by_line(String.t()) ::
          {:ok, account()} | {:error, :not_found | :not_configured | :unavailable}
  def find_by_line(line) when is_binary(line) do
    with :ok <- digits_only(line),
         {:ok, token} <- token() do
      body = %{
        objecttype: 1,
        page_size: 5,
        page_number: 1,
        fields: @fields,
        query: "(telephone1 = #{line})",
        sort_type: "desc"
      }

      [url: @url, headers: [tokenid: token], json: body, retry: false, receive_timeout: 8_000]
      |> Keyword.merge(Application.get_env(:agents_demo, :fireberry_req_options, []))
      |> Req.new()
      |> Req.post()
      |> case do
        {:ok, %Req.Response{status: 200, body: %{"data" => %{"Data" => [row | _rest]}}}} ->
          {:ok, account(row)}

        {:ok, %Req.Response{status: 200}} ->
          {:error, :not_found}

        {:ok, %Req.Response{}} ->
          {:error, :unavailable}

        {:error, _transport} ->
          {:error, :unavailable}
      end
    end
  end

  @doc "True when a token is present."
  def configured?, do: is_binary(Config.fireberry_token())

  defp token do
    case Config.fireberry_token() do
      nil -> {:error, :not_configured}
      token -> {:ok, token}
    end
  end

  defp digits_only(line),
    do: if(Regex.match?(~r/^\d{7,15}$/, line), do: :ok, else: {:error, :not_found})

  defp account(row) when is_map(row) do
    %{
      line: row["telephone1"],
      domain: blank_to_nil(row["pcfsystemfield179"]),
      trunks: blank_to_nil(row["pcfsystemfield166"])
    }
  end

  defp blank_to_nil(value) when is_binary(value),
    do: if(String.trim(value) == "", do: nil, else: value)

  defp blank_to_nil(_other), do: nil
end
