defmodule AgentsDemo.Realtime.TokenAuthTest do
  @moduledoc """
  The claim-reading half of realtime auth.

  Authenticity is delegated to the mothership and is not exercised here; what is
  exercised is what happens *after* it answers, because that is where an
  implementation hands out someone else's events.
  """
  use ExUnit.Case, async: true

  alias AgentsDemo.Realtime.TokenAuth

  setup do
    TokenAuth.init_cache()
    :ok
  end

  defp jwt(payload) do
    part = fn map -> map |> Jason.encode!() |> Base.url_encode64(padding: false) end
    "#{part.(%{"alg" => "HS256", "typ" => "JWT"})}.#{part.(payload)}.signature-not-checked-here"
  end

  describe "identity" do
    test "a token with no identity claim gets no streams" do
      # The reference implementation falls back to a `state_user` query
      # parameter here, which lets a caller name somebody else. Refusing is the
      # whole point: no claim, no stream.
      assert {:error, :no_identity_claim} =
               verify_as_authenticated(jwt(%{"exp" => 9_999_999_999}))
    end

    test "reads user_uuid from the token" do
      uuid = "869f1930-1524-4fc1-8d4a-265e04a2b0d6"
      assert {:ok, claims} = verify_as_authenticated(jwt(%{"user_uuid" => uuid}))
      assert claims.user_uuid == uuid
    end

    test "accepts the mothership token shape (uuid / customer.uuid)" do
      # cable_auth.cr maps these the same way; a token minted for the portal
      # names the user as `uuid` and the account under `customer`.
      token = jwt(%{"uuid" => "u-1", "customer" => %{"uuid" => "a-1"}})
      assert {:ok, claims} = verify_as_authenticated(token)
      assert claims.user_uuid == "u-1"
      assert claims.account_uuid == "a-1"
    end

    test "a malformed token yields no identity rather than crashing" do
      assert {:error, :no_identity_claim} = verify_as_authenticated("not.a.jwt")
    end
  end

  describe "missing token" do
    test "nil and empty are refused without asking the issuer" do
      assert {:error, :missing_token} = TokenAuth.verify(nil)
      assert {:error, :missing_token} = TokenAuth.verify("")
    end
  end

  # Seed the cache so `verify/1` takes the authenticated path without an HTTP
  # call — the issuer's answer is not what these tests are about.
  defp verify_as_authenticated(token) do
    :ets.insert(
      :realtime_token_cache,
      {token, true, System.monotonic_time(:millisecond) + 30_000}
    )

    TokenAuth.verify(token)
  end
end
