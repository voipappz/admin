defmodule AgentsDemo.Realtime.CableToken do
  @moduledoc """
  Mints the credential this app presents to cable.

  Cable accepts exactly one thing — a JWT on `?token=`, verified against the
  node's `SECRET_KEY` and required to carry a `user_uuid` or `account_uuid`
  claim (`va-crystal node/realtime/app.cr:46,84-105`). Its own rejection
  message names the two ways to satisfy that: *"mothership user tokens or a
  token minted with this node's secret"*. This module is the second one.

  ## Why mint instead of forwarding

  Forwarding the browser's login JWT works, and is what happens when no secret
  is configured. But it sends cable a credential minted elsewhere, carrying
  whatever claims the issuer put in it, valid for whatever the issuer decided —
  and `VaShared::CableAuth.decode_jwt` never checks `exp`, so cable would honour
  it indefinitely. A minted token carries the identity and nothing else.

  It also decouples the two hops. The browser's token is verified over NATS
  before this is ever called; what goes to cable is then a statement this app
  makes about an identity it has already established, not a credential it is
  passing along unread.

  ## Configuration

  `CABLE_SECRET_KEY`, falling back to `SECRET_KEY` — the signing secret of the
  API whose tokens that cable node verifies. Unset, minting is off and the
  caller's own token is forwarded, which is the behaviour that existed before
  this module and still works.
  """

  @doc """
  A cable credential for an already-verified identity.

  `claims` is the verified `%TokenAuth{}`. Returns the minted token when a
  secret is configured, and the caller's own token otherwise — so an
  unconfigured deployment behaves exactly as it did before.
  """
  def for(%{user_uuid: user_uuid, account_uuid: account_uuid, token: token}) do
    case secret() do
      nil -> token
      key -> mint(%{"user_uuid" => user_uuid, "account_uuid" => account_uuid}, key)
    end
  end

  @doc """
  The credential this app opens its own cable connection with.

  Not a user's. The API proxy connection (`Realtime.ApiProxy`) carries every
  user's requests, so the identity on it is the APP's, and the browser's
  credential never reaches the node. `CABLE_TOKEN` is honoured verbatim when an
  operator supplied one; otherwise it is minted with the node's secret.

  Cable only checks that an `account_uuid` claim is PRESENT (`app.cr:103-107`)
  and the ApiProxy channel never reads it, so `CABLE_ACCOUNT_UUID` names the
  connection in the node's log and nothing more. It is not an authorisation —
  the allowlist on the node is.
  """
  def account do
    case secret() do
      nil -> System.get_env("CABLE_TOKEN")
      key -> mint(%{"account_uuid" => account_uuid()}, key)
    end
  end

  defp account_uuid,
    do: System.get_env("CABLE_ACCOUNT_UUID") || "00000000-0000-0000-0000-0000000c1e27"

  @doc "True when this app mints its own cable credential rather than forwarding one."
  def minting?, do: secret() != nil

  # HS256, which is the only algorithm `CableAuth` accepts. Nil claims are
  # dropped rather than sent as null: cable checks for the PRESENCE of
  # `user_uuid`/`account_uuid`, and a null would satisfy that check while
  # naming nobody.
  defp mint(claims, key) do
    header = %{"alg" => "HS256", "typ" => "JWT"}
    payload = claims |> Enum.reject(fn {_k, v} -> is_nil(v) or v == "" end) |> Map.new()

    signing_input = b64(Jason.encode!(header)) <> "." <> b64(Jason.encode!(payload))
    signature = :crypto.mac(:hmac, :sha256, key, signing_input)

    signing_input <> "." <> Base.url_encode64(signature, padding: false)
  end

  defp b64(binary), do: Base.url_encode64(binary, padding: false)

  defp secret do
    case System.get_env("CABLE_SECRET_KEY") || System.get_env("SECRET_KEY") do
      nil -> nil
      "" -> nil
      key -> key
    end
  end
end
