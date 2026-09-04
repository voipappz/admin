defmodule Connectix.Realtime.TokenAuthTest do
  @moduledoc """
  What happens *after* the issuer answers, because that is where an
  implementation hands out someone else's events.

  Authenticity is delegated to the node over the cable relay
  (`ApiProxy.verify/1`) and is not exercised here — the "identity" and
  "refusal" groups seed the cache with an answer and assert what is done with
  it, and "asking the node" stubs the relay to assert how its answers are
  mapped, in particular that "no" and "could not ask" are kept apart.

  Note what is no longer tested, and cannot be: reading identity out of the
  token. The reply carries the claims now, so nothing here decodes a JWT. That
  removed the one place this app interpreted a credential it could not verify.
  """

  # Application.put_env — the verifier is read at call time, and the config key
  # is global to the VM.
  use ExUnit.Case, async: false

  import ExUnit.CaptureLog

  alias Connectix.Realtime.TokenAuth

  # Answers whatever the test put in its process dictionary, and reports each
  # call so a test can prove the cache absorbed a repeat. `TokenAuth.verify/1`
  # runs in the caller, so `self()` here is the test process.
  defmodule StubVerifier do
    def verify(token) do
      send(self(), {:asked, token})
      Process.get(:verify_answer, {:error, :not_connected})
    end
  end

  setup do
    TokenAuth.init_cache()

    verifier = Application.get_env(:connectix, :token_verifier)
    Application.put_env(:connectix, :token_verifier, StubVerifier)

    on_exit(fn ->
      case verifier do
        nil -> Application.delete_env(:connectix, :token_verifier)
        module -> Application.put_env(:connectix, :token_verifier, module)
      end
    end)

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

  describe "asking the node" do
    test "a verdict's claims become the identity, with the token carried" do
      Process.put(
        :verify_answer,
        {:ok, %{"user_uuid" => "u-1", "account_uuid" => "a-1", "environment_uuid" => "e-1"}}
      )

      assert {:ok, claims} = TokenAuth.verify("tok-f")
      assert_received {:asked, "tok-f"}
      assert claims.user_uuid == "u-1"
      assert claims.account_uuid == "a-1"
      assert claims.environment_uuid == "e-1"
      assert claims.token == "tok-f"
    end

    test "the node's refusal is a refusal, and is not asked again" do
      # `ok:false` from the node is a verdict, not an outage. Cached as a
      # negative so a stale tab retrying on a tight loop is answered from here
      # rather than turned into a frame per retry.
      Process.put(:verify_answer, {:error, :invalid})

      assert {:error, :unauthenticated} = TokenAuth.verify("tok-g")
      assert {:error, :unauthenticated} = TokenAuth.verify("tok-g")
      assert_received {:asked, "tok-g"}
      refute_received {:asked, "tok-g"}
    end

    test "no relay means unavailable, not invalid" do
      # The client gets the same refusal either way — there is no HTTP
      # fallback by design — but the log has to say which it was, because a
      # node that has not confirmed the relay is the operator's problem and a
      # bad token is the user's.
      Process.put(:verify_answer, {:error, :not_connected})

      log =
        capture_log(fn ->
          assert {:error, :unauthenticated} = TokenAuth.verify("tok-h")
        end)

      assert log =~ "token verification unavailable (:not_connected)"
      refute log =~ "refused a token"
    end

    test "a node that predates the action is unavailable too" do
      # ApiProxy maps the node's unknown-action 400 to `:unavailable` and names
      # the cause in its own log once; here it is only "could not ask".
      Process.put(:verify_answer, {:error, :unavailable})

      log =
        capture_log(fn ->
          assert {:error, :unauthenticated} = TokenAuth.verify("tok-i")
        end)

      assert log =~ "token verification unavailable (:unavailable)"
    end
  end

  # Seed the cache so `verify/1` takes the answered path without a relay round
  # trip — whether the node says yes is not what these tests are about.
  defp verify_answered(token, answer) do
    :ets.insert(
      :realtime_token_cache,
      {token, answer, System.monotonic_time(:millisecond) + 30_000}
    )

    TokenAuth.verify(token)
  end
end
