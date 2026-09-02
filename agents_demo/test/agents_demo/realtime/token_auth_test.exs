defmodule AgentsDemo.Realtime.TokenAuthTest do
  @moduledoc """
  What happens *after* the issuer answers, because that is where an
  implementation hands out someone else's events.

  Authenticity is delegated to the mothership over `auth.request.verify` and is
  not exercised here — these tests seed the cache with an answer and assert what
  is done with it.

  Note what is no longer tested, and cannot be: reading identity out of the
  token. The reply carries the claims now, so nothing here decodes a JWT. That
  removed the one place this app interpreted a credential it could not verify.
  """
  use ExUnit.Case, async: true

  alias AgentsDemo.Realtime.TokenAuth

  setup do
    TokenAuth.init_cache()
    :ok
  end

  describe "identity" do
    test "an answer that names nobody gets no streams" do
      # The reference implementation falls back to a `state_user` query
      # parameter here, which lets a caller name somebody else. Refusing is the
      # whole point: no claim, no stream.
      assert {:error, :no_identity_claim} = verify_answered("tok-a", %TokenAuth{})
    end

    test "takes the identity the issuer replied with" do
      uuid = "869f1930-1524-4fc1-8d4a-265e04a2b0d6"

      assert {:ok, claims} =
               verify_answered("tok-b", %TokenAuth{user_uuid: uuid, account_uuid: "a-1"})

      assert claims.user_uuid == uuid
      assert claims.account_uuid == "a-1"
    end

    test "an account without a user is still an identity" do
      # DashboardLive streams by account, so an account-only answer is usable.
      assert {:ok, claims} = verify_answered("tok-c", %TokenAuth{account_uuid: "a-1"})
      assert claims.account_uuid == "a-1"
    end

    test "the token is carried on the claims for the upstream cable connection" do
      # Cable authorizes by token, so the person's own credential is what
      # entitles them to their streams. It was declared here and never set once,
      # which left the cable client silently unable to connect.
      assert {:ok, claims} = verify_answered("tok-d", %TokenAuth{user_uuid: "u-1"})
      assert claims.token == "tok-d"
    end
  end

  describe "refusal" do
    test "nil and empty are refused without asking the issuer" do
      assert {:error, :missing_token} = TokenAuth.verify(nil)
      assert {:error, :missing_token} = TokenAuth.verify("")
    end

    test "a refusal is a refusal, not an empty identity" do
      assert {:error, :unauthenticated} = verify_answered("tok-e", false)
    end
  end

  # Seed the cache so `verify/1` takes the answered path without a bus round
  # trip — whether the issuer says yes is not what these tests are about.
  defp verify_answered(token, answer) do
    :ets.insert(
      :realtime_token_cache,
      {token, answer, System.monotonic_time(:millisecond) + 30_000}
    )

    TokenAuth.verify(token)
  end
end
