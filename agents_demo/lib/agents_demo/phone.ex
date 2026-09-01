defmodule AgentsDemo.Phone do
  @moduledoc """
  Phone numbers as the CRM stores them: Israeli local format, digits only.

  `+972 3-123 4567` and `03-1234567` both become `031234567`. Anything with a
  letter is not a number, however it is dressed up; that is the line-number
  validation the n8n flow did with a regex before every lookup.
  """

  @spec normalise(String.t() | nil) :: {:ok, String.t()} | :error
  def normalise(text) when is_binary(text) do
    trimmed = String.trim(text)

    if Regex.match?(~r/[A-Za-z\p{Hebrew}]/u, trimmed) do
      :error
    else
      digits =
        trimmed
        |> String.replace(~r/[\s\-().]/u, "")
        |> String.replace(~r/^\+972/, "0")
        |> String.replace(~r/^972(?=\d{8,9}$)/, "0")
        |> String.replace(~r/^\+/, "")

      if Regex.match?(~r/^\d{7,15}$/, digits), do: {:ok, digits}, else: :error
    end
  end

  def normalise(_not_text), do: :error

  @doc "Digits only, for comparing numbers regardless of formatting."
  def digits(text) when is_binary(text), do: String.replace(text, ~r/\D/, "")
end
