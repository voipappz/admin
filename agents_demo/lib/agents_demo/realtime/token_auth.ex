defmodule Connectix.Realtime.TokenAuth do
  @moduledoc """
  Authenticates a realtime client by the token it already holds.

  Both questions — is it real, and who is it — are answered by the node in one
  `verify` on the cable relay (`Realtime.ApiProxy.verify/1`).

  **Over the cable, not NATS and not HTTP.** The cable is this app's only
  transport to the platform: the login that produced the token went over it
  (`ApiProxy.request/6` → the node → whichever mothership the node's `API_URL`
  names), and the per-user event stream this check gates is opened over it too
  (`CableClient`, which the node admits by verifying the same token against its
  own `SECRET_KEY`). So the node is the one party whose answer cannot disagree
  with either. The previous verifier was a NATS request to the LOCAL API
  (`auth.request.verify`), which after a login relayed to a different
  mothership answered `token verification unavailable (:timeout)` and then
  `refused websocket upgrade (:unauthenticated)` — a 200 login followed by a
  socket that never opened. It also held a broker connection this app is not
  supposed to have.

  **And the reply carries the claims.** The alternative is base64-decoding a JWT
  this app cannot verify — safe only by accident of having asked first. Being
  *told* the identity removes that: no token is ever interpreted here.

  There is deliberately **no HTTP fallback**. If the cable is down this app has
  no events to deliver anyway, so authenticating someone onto a socket that will
  stay silent is a worse failure than refusing them — it looks like it worked.

  A client NEVER supplies an identity. The reference implementation this was
  modelled on falls back to a `state_user` query parameter when the payload has
  no `user_uuid`, which lets a caller name someone else and receive their
  events. That is not reproduced here: no claim, no stream.
  """

  require Logger

  alias Connectix.Realtime.ApiProxy

  @positive_ttl_ms 30_000
  @negative_ttl_ms 5_000
  @max_entries 500
  @table :realtime_token_cache

  defstruct [:user_uuid, :account_uuid, :environment_uuid, :token]

  @type claims :: %__MODULE__{
          user_uuid: String.t() | nil,
          account_uuid: String.t() | nil,
          environment_uuid: String.t() | nil,
          # Carried so the upstream cable connection can authenticate AS THIS
          # USER. Cable authorizes by token, so the person's own credential is
          # what entitles them to their streams — there is no service account.
          token: String.t() | nil
        }

  @doc "Create the cache table. Called once from the supervision tree."
  def init_cache do
    :ets.new(@table, [:named_table, :public, :set, read_concurrency: true])
    :ok
  rescue
    ArgumentError -> :ok
  end

  @spec verify(String.t() | nil) :: {:ok, claims()} | {:error, atom()}
  def verify(nil), do: {:error, :missing_token}
  def verify(""), do: {:error, :missing_token}

  def verify(token) when is_binary(token) do
    case cached(token) do
      {:ok, authenticated?} -> finish(token, authenticated?)
      :miss -> finish(token, ask_issuer(token))
    end
  end

  defp finish(_token, false), do: {:error, :unauthenticated}

  defp finish(token, %{} = claims) do
    # A token the issuer accepts but that names nobody gets no streams. Silence
    # is the correct outcome — the alternative is guessing, and guessing here
    # means handing over another person's events.
    if is_nil(claims.user_uuid) and is_nil(claims.account_uuid) do
      {:error, :no_identity_claim}
    else
      {:ok, %{claims | token: token}}
    end
  end

  # A token check sits on the critical path of every socket open, so it refuses
  # on timeout rather than hanging: a slow relay must not become a slow login.
  # Repeats are absorbed by the cache above.
  #
  # What the node checks is the signature, against the same `SECRET_KEY` its
  # connection admits sockets with — which is exactly the check that decides
  # whether the `CableClient` this app opens next for the user would be
  # accepted. What it does NOT check is expiry: `VaShared::CableAuth.decode_jwt`
  # verifies the signature and stops. The NATS verifier this replaces did check
  # expiry (it ran the API's own `Authorize` mediator), so an expired token that
  # used to be refused here is now refused only when the API refuses the
  # relayed requests it is used on. That is a known gap, named in the node's
  # `verify` action too, and not one this app can close by decoding the token
  # itself — see the moduledoc.
  defp ask_issuer(token) do
    result =
      case verifier().verify(token) do
        {:ok, %{} = claims} ->
          %__MODULE__{
            user_uuid: claims["user_uuid"],
            account_uuid: claims["account_uuid"],
            environment_uuid: claims["environment_uuid"],
            token: token
          }

        # A refusal is the node's verdict on the token, and a stale browser
        # tab is the usual cause: debug, because it is not the operator's
        # problem.
        {:error, :invalid} ->
          Logger.debug("realtime: the node refused a token (invalid)")
          false

        {:error, :disabled} ->
          Logger.error(
            "realtime: cannot verify tokens — CABLE_URL is not set, so every connection will be refused"
          )

          false

        # Everything else is "could not ask", not "no". Same refusal for the
        # client, but a warning and not a debug line, because every one of
        # these is the operator's problem: a node that has not confirmed the
        # relay, a reply that never came, or a node too old to know the
        # action (that last one is logged once, by name, in ApiProxy).
        {:error, reason} ->
          Logger.warning("realtime: token verification unavailable (#{inspect(reason)})")
          false
      end

    cache(token, result)
    result
  end

  # Configurable so a test can answer the question without a node. Same
  # pattern as `EngineProxy`'s `:api_relay`: `ApiProxy.enabled?/0` reads
  # CABLE_URL from the environment, and the dev container sets it, so a test
  # that reached the real module would ask whatever node happens to be running
  # beside it and pass or fail on that.
  defp verifier, do: Application.get_env(:agents_demo, :token_verifier, ApiProxy)

  defp cached(token) do
    now = System.monotonic_time(:millisecond)

    case :ets.lookup(@table, token) do
      [{^token, result, expires_at}] when expires_at > now -> {:ok, result}
      _ -> :miss
    end
  rescue
    ArgumentError -> :miss
  end

  defp cache(token, result) do
    ttl = if result == false, do: @negative_ttl_ms, else: @positive_ttl_ms
    expires_at = System.monotonic_time(:millisecond) + ttl

    # Bounded: a stream of junk tokens must not become an unbounded cache.
    if :ets.info(@table, :size) >= @max_entries, do: :ets.delete_all_objects(@table)
    :ets.insert(@table, {token, result, expires_at})
    :ok
  rescue
    ArgumentError -> :ok
  end
end
