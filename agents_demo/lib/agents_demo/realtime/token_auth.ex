defmodule AgentsDemo.Realtime.TokenAuth do
  @moduledoc """
  Authenticates a realtime client by the token it already holds.

  Both questions — is it real, and who is it — are answered by the issuer in one
  request/reply on NATS (`auth.request.verify`).

  **Over the bus, not HTTP.** This app already holds a NATS connection; it needs
  one for `notifications.>` regardless. Asking there costs no second connection,
  no URL to configure, and no network path to the API beyond the broker both
  already use. It also removes a failure mode worth naming: an unset `ENGINE_URL`
  refuses every token, silently.

  **And the reply carries the claims.** The alternative is base64-decoding a JWT
  this app cannot verify — safe only by accident of having asked first. Being
  *told* the identity removes that: no token is ever interpreted here.

  There is deliberately **no HTTP fallback**. If the bus is down this app has no
  events to deliver anyway, so authenticating someone onto a socket that will
  stay silent is a worse failure than refusing them — it looks like it worked.

  A client NEVER supplies an identity. The reference implementation this was
  modelled on falls back to a `state_user` query parameter when the payload has
  no `user_uuid`, which lets a caller name someone else and receive their
  events. That is not reproduced here: no claim, no stream.
  """

  require Logger

  alias AgentsDemo.Realtime.Bus

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

  # A token check sits on the critical path of every socket open, so this has a
  # short deadline and refuses on timeout rather than hanging: a slow bus must
  # not become a slow login. Repeats are absorbed by the cache above.
  #
  # `auth.request.verify` is answered by `Mediators::User::Authorize` — the same
  # mediator `auth_user!` runs for every HTTP request on that API — so this
  # cannot drift from the authentication everything else gets. That includes
  # expiry, which is the check cable itself never makes
  # (`VaShared::CableAuth.decode_jwt` verifies the signature and stops). It is
  # precisely why a browser is not allowed to authenticate against cable
  # directly, and why this app verifies here before it opens anything upstream.
  defp ask_issuer(token) do
    result =
      cond do
        not Bus.configured?() ->
          Logger.error(
            "realtime: cannot verify tokens — NATS_URL is not set, so every connection will be refused"
          )

          false

        true ->
          case Bus.request("auth.request.verify", %{token: token}) do
            {:ok, %{"ok" => true} = reply} ->
              %__MODULE__{
                user_uuid: reply["user_uuid"],
                account_uuid: reply["account_uuid"],
                environment_uuid: reply["environment_uuid"],
                token: token
              }

            # "expired" and "invalid" are distinguished by the issuer on
            # purpose — a client can act on the first and cannot act on the
            # second — so the distinction is kept in the log even though both
            # answers are the same refusal.
            {:ok, %{"ok" => false, "error" => error}} ->
              Logger.debug("realtime: issuer refused a token (#{error})")
              false

            {:ok, other} ->
              Logger.warning("realtime: unexpected verification reply #{inspect(other)}")
              false

            {:error, reason} ->
              Logger.warning("realtime: token verification unavailable (#{inspect(reason)})")
              false
          end
      end

    cache(token, result)
    result
  end

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
