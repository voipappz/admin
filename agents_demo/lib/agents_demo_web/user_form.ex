defmodule AgentsDemoWeb.UserForm do
  @moduledoc false

  alias AgentsDemo.Accounts.User

  @fields ~w(first_name email password password_confirmation)

  def build(%User{} = user, params \\ %{}, errors \\ %{}) do
    values =
      user
      |> Map.from_struct()
      |> Map.take(Enum.map(@fields, &String.to_existing_atom/1))
      |> Map.new(fn {key, value} -> {Atom.to_string(key), value} end)
      |> Map.merge(stringify(params))

    Phoenix.Component.to_form(values, as: "user", errors: form_errors(errors))
  end

  def errors({:error, errors}) when is_map(errors), do: errors
  def errors(_valid), do: %{}

  def user({:ok, %User{} = user}, _fallback), do: user
  def user(_invalid, %User{} = fallback), do: fallback

  defp form_errors(errors) do
    Enum.flat_map(errors, fn {field, messages} ->
      Enum.map(List.wrap(messages), &{field, {to_string(&1), []}})
    end)
  end

  defp stringify(attrs), do: Map.new(attrs, fn {key, value} -> {to_string(key), value} end)
end
