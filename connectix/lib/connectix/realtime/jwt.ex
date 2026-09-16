defmodule Connectix.Realtime.Jwt do
  @moduledoc """
  Verifies a user's token here, with the secret this app already holds.

  This replaces asking the platform. The portal is configured with
  `SECRET_KEY`, the signing secret of the API that issues user tokens, because
  it used to mint upstream credentials with it. The same
  secret verifies them, so the question "is this token real, and whose is it"
  needs no transport at all: no relay round trip, no broker request, nothing
  on the critical path of a socket open but one HMAC.

  ## The contract

  `verify/1` answers what `TokenAuth` asks of any verifier:

    * `{:ok, claims}` — a map with `user_uuid`, `account_uuid` and
      `environment_uuid`, any of which may be nil;
    * `{:error, :invalid}` — the token is not real, and that is a verdict;
    * `{:error, :disabled}` — no secret is configured, so nothing was judged.

  The difference between the last two is the whole reason they are separate:
  `TokenAuth` refuses the socket either way, but one is a stale browser tab
  and the other is an unconfigured server.

  ## What is checked

  HS256 over `header.payload`, compared in constant time, then `exp`.

  **Expiry is checked here, and was not checked before.** The node's own
  verifier checks the signature and stops, so it honoured an expired token
  indefinitely and this app inherited that. A token
  past its `exp` is now `:invalid`. A token carrying no `exp` is accepted —
  the issuer decides whether to set one, and refusing an unexpiring token
  would refuse every token the API chooses not to date.

  `alg` is required to be `HS256` and is never taken from the token as an
  instruction: a token asking for `none` is invalid, which is the oldest JWT
  attack there is.

  ## The claims

  `user_uuid` and `account_uuid` are read verbatim. The environment is
  `environment_uuid`, else the first of `environment_uuids` — the API issues
  the plural and the rest of this app carries one.
  """

  require Logger

  @doc "The verifier contract `TokenAuth` calls. See the moduledoc."
  @spec verify(String.t()) :: {:ok, map()} | {:error, :invalid | :disabled}
  def verify(token) when is_binary(token) do
    case secret() do
      nil -> {:error, :disabled}
      secret -> check(token, secret)
    end
  end

  def verify(_other), do: {:error, :invalid}

  @doc "True when a secret is configured, so tokens can be judged at all."
  def enabled?, do: secret() != nil

  @doc """
  Mint a token this app will accept back.

  The portal performs the login now, so it issues the credential too — signed
  with the same secret `verify/1` checks, which is what makes the pair
  self-consistent: there is no second party to disagree with.

  `claims` is merged over `user_uuid` and an `exp`, so a caller states the
  identity and nothing else. The lifetime is deliberately short-ish and
  refreshed by logging in again; nothing here can revoke a token early, so a
  long one is a long window.
  """
  @spec sign(map(), pos_integer()) :: {:ok, String.t()} | {:error, :disabled}
  def sign(claims, ttl_seconds \\ 60 * 60 * 12) do
    case secret() do
      nil ->
        {:error, :disabled}

      secret ->
        payload =
          claims
          |> Map.new(fn {k, v} -> {to_string(k), v} end)
          |> Map.put("exp", System.system_time(:second) + ttl_seconds)

        header = encode(%{"alg" => "HS256", "typ" => "JWT"})
        body = encode(payload)
        signing_input = header <> "." <> body

        signature =
          :hmac
          |> :crypto.mac(:sha256, secret, signing_input)
          |> Base.url_encode64(padding: false)

        {:ok, signing_input <> "." <> signature}
    end
  end

  defp encode(map), do: map |> Jason.encode!() |> Base.url_encode64(padding: false)

  defp check(token, secret) do
    with [header_b64, payload_b64, signature_b64] <- String.split(token, ".", parts: 3),
         {:ok, header} <- decode_part(header_b64),
         %{"alg" => "HS256"} <- header,
         {:ok, signature} <- decode_segment(signature_b64),
         expected = :crypto.mac(:hmac, :sha256, secret, header_b64 <> "." <> payload_b64),
         true <- Plug.Crypto.secure_compare(signature, expected),
         {:ok, payload} <- decode_part(payload_b64),
         true <- fresh?(payload) do
      {:ok, claims(payload)}
    else
      _not_a_valid_token -> {:error, :invalid}
    end
  end

  defp claims(payload) do
    %{
      "user_uuid" => payload["user_uuid"],
      "account_uuid" => payload["account_uuid"],
      "environment_uuid" => environment(payload)
    }
  end

  defp environment(payload) do
    case payload["environment_uuid"] do
      uuid when is_binary(uuid) and uuid != "" ->
        uuid

      _absent ->
        case payload["environment_uuids"] do
          [uuid | _rest] when is_binary(uuid) -> uuid
          _none -> nil
        end
    end
  end

  # A token with no `exp` never expires; one with an `exp` in the past is
  # refused. `exp` is seconds since the epoch, per the JWT spec.
  defp fresh?(%{"exp" => exp}) when is_integer(exp), do: exp > System.system_time(:second)
  defp fresh?(%{"exp" => _malformed}), do: false
  defp fresh?(_no_exp), do: true

  defp decode_part(segment) do
    with {:ok, json} <- decode_segment(segment),
         {:ok, %{} = decoded} <- Jason.decode(json) do
      {:ok, decoded}
    else
      _undecodable -> :error
    end
  end

  # JWT uses base64url without padding; `Base.url_decode64/2` needs telling.
  defp decode_segment(segment), do: Base.url_decode64(segment, padding: false)

  # DERIVED FROM THE ENDPOINT'S `secret_key_base`, not from a variable of its own.
  #
  # This used to read `SECRET_KEY`, the API's signing secret, because the
  # portal was verifying tokens somebody else issued. It issues them now, so
  # the key has to be stable and secret and nothing more — and every
  # deployment already has exactly such a value, required by Phoenix and
  # present on every host. Asking for a second one bought nothing and was one
  # more thing to be missing, which is how a deploy comes up answering 503 to
  # every login.
  #
  # HMAC'd with a purpose string rather than used directly, so the token key
  # and the one Phoenix signs cookies and sockets with are different bytes.
  # Sharing a key across two schemes is how a weakness in either becomes a
  # weakness in both.
  @purpose "connectix/realtime-token/v1"

  # Read from the ENDPOINT's config, not from the environment directly. Every
  # environment sets it — `config/dev.exs` and `config/test.exs` carry a
  # literal, `runtime.exs` reads SECRET_KEY_BASE and refuses to boot without
  # one in production — so this works in all three. Reading the variable
  # instead worked only where it happened to be exported, which meant a portal
  # that answered 503 to every login in development and nowhere else.
  defp secret do
    :connectix
    |> Application.get_env(ConnectixWeb.Endpoint, [])
    |> Keyword.get(:secret_key_base)
    |> case do
      base when is_binary(base) and base != "" ->
        :crypto.mac(:hmac, :sha256, base, @purpose)

      _unset ->
        nil
    end
  end
end
