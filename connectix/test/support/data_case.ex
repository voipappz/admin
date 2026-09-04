defmodule Connectix.DataCase do
  @moduledoc """
  This module defines the setup for tests requiring
  access to the application's data layer.

  You may define functions here to be used as helpers in
  your tests.

  Mnesia tables are cleared before each test. Data tests run synchronously
  because those tables are shared process-wide.
  """

  use ExUnit.CaseTemplate

  using do
    quote do
      import Connectix.DataCase
    end
  end

  setup _tags do
    Connectix.Mnesia.reset_domain_for_test!()
    :ok
  end

  @doc """
  A helper that transforms changeset errors into a map of messages.

      assert {:error, changeset} = Accounts.create_user(%{password: "short"})
      assert "password is too short" in errors_on(changeset).password
      assert %{password: ["password is too short"]} = errors_on(changeset)

  """
  def errors_on(errors) when is_map(errors), do: errors
end
