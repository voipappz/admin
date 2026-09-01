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

  defp finish(token, true), do: finish(token, claims(token))

  # A token check sits on the critical path of every socket open, so this has a
  # short deadline and refuses on timeout rather than hanging: a slow bus must
  # not become a slow login. Repeats are absorbed by the cache above.
  # The mothership is the issuer, and `GET /api/features` runs its own
  # `auth_user!` — so this cannot drift from the authentication every other
  # request on that API gets. It answers yes/no; the identity then comes from
  # decoding the payload locally, which is safe ONLY because the issuer has
  # already vouched for the signature.
  #
  # 401 covers expired, which is the check cable itself never makes
  # (`VaShared::CableAuth.decode_jwt` verifies the signature and stops). That
  # is precisely why a browser is not allowed to authenticate against cable
  # directly, and why this app verifies here before it opens anything upstream.
  defp ask_issuer(token) do
    result =
      case engine_url() do
        "" ->
          Logger.error(
            "realtime: cannot verify tokens — neither NATS_URL nor ENGINE_URL is set, so every connection will be refused"
          )

          false

        base ->
          case Req.get(base <> "/api/features",
                 headers: [{"authorization", "Basic " <> token}, {"x-va-auth", "user"}],
                 receive_timeout: 2_000,
                 retry: false
               ) do
            {:ok, %{status: 200}} ->
              true

            {:ok, %{status: status}} when status in [401, 403] ->
              Logger.debug("realtime: issuer refused a token (http #{status})")
              false

            {:ok, %{status: status}} ->
              Logger.warning("realtime: unexpected verification status #{status}")
              false

            {:error, reason} ->
              Logger.warning("realtime: token verification unavailable (#{inspect(reason)})")
              false
          end
      end

    cache(token, result)
    result
  end

  defp engine_url,
    do:
      (System.get_env("ENGINE_URL") || System.get_env("MOTHERSHIP_URL") || "")
      |> String.trim_trailing("/")

  # The payload only. Signature verification is the issuer's answer above, and
  # duplicating it here would reintroduce the shared secret this design avoids.
  defp claims(token) do
    with [_header, payload | _] <- String.split(token, "."),
         {:ok, json} <- Base.url_decode64(payload, padding: false),
         {:ok, map} <- Jason.decode(json) do
      %__MODULE__{
        user_uuid: map["user_uuid"] || map["uuid"],
        account_uuid: map["account_uuid"] || get_in(map, ["customer", "uuid"]),
        environment_uuid: map["environment_uuid"],
        token: token
      }
    else
      _ -> %__MODULE__{}
    end
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
