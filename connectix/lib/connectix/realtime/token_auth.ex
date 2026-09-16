defmodule Connectix.Realtime.TokenAuth do
  @moduledoc """
  Authenticates a realtime client by the token it already holds.

  Both questions — is it real, and who is it — are answered here, by
  `Realtime.Jwt.verify/1`, with the secret this app already holds.

  **Nothing is asked of anyone.** Verification used to be a round trip: first a
  NATS request to the API (`auth.request.verify`), then a `verify` on a
  WebSocket relay. Each was on the critical path of every socket open, each could time
  out, and each made "is this token real" depend on a service being reachable.
  The portal is configured with the issuer's signing secret, so the signature
  can be checked locally — the round trip was never buying a second opinion,
  only a slower copy of the same one.

  Two consequences worth naming. Expiry is now enforced, which the node never
  did. And a revoked-but-unexpired token stays valid until it expires, because
  there is nobody to ask about revocation; that was equally true of the relay
  verifier, which also only checked a signature.

  A client NEVER supplies an identity. The reference implementation this was
  modelled on falls back to a `state_user` query parameter when the payload has
  no `user_uuid`, which lets a caller name someone else and receive their
  events. That is not reproduced here: no claim, no stream.
  """

  require Logger

  alias Connectix.Realtime.Jwt

  @positive_ttl_ms 30_000
  @negative_ttl_ms 5_000
  @max_entries 500
  @table :realtime_token_cache

  defstruct [:user_uuid, :account_uuid, :environment_uuid, :token]

  @type claims :: %__MODULE__{
          user_uuid: String.t() | nil,
          account_uuid: String.t() | nil,
          environment_uuid: String.t() | nil,
          # Carried so an upstream request can be made AS THIS USER — the
          # agent-id lookup in `Realtime.AgentIdentity` presents it.
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

  # One HMAC, no network. The cache above still earns its place: a browser
  # reconnecting in a loop presents the same token many times a second.
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

        # A bad signature or an expired token is a verdict, and a stale
        # browser tab is the usual cause: debug, because it is not the
        # operator's problem.
        {:error, :invalid} ->
          Logger.debug("realtime: refused a token (invalid or expired)")
          false

        # Nothing was judged. Same refusal for the client, but an error for
        # the operator, because every socket will be refused until a secret
        # is configured.
        {:error, :disabled} ->
          Logger.error(
            "realtime: cannot verify tokens — the endpoint has no secret_key_base, " <>
              "so every connection will be refused"
          )

          false

        {:error, reason} ->
          Logger.warning("realtime: token verification unavailable (#{inspect(reason)})")
          false
      end

    cache(token, result)
    result
  end

  # Configurable so a test can present an identity without minting a signed
  # token for it.
  defp verifier, do: Application.get_env(:connectix, :token_verifier, Jwt)

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
