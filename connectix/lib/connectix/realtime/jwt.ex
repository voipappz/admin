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

  # The issuer's signing secret, read at call time so a rotation needs no
  # restart.
  defp secret do
    case System.get_env("SECRET_KEY") do
      value when is_binary(value) and value != "" -> value
      _unset -> nil
    end
  end
end
