# Xamal — bare-metal deploy of the connectix release over SSH (systemd +
# Caddy). NO Docker in the deploy path: one native release tarball, uploaded
# and booted.
#
#   mix xamal.setup            # one-time: prepare the server
#   mix xamal.deploy           # build + upload + boot (the everyday command)
#   mix xamal.app.logs         # tail
#   mix xamal.iex              # remote shell
#
# Server details come from the environment so this file carries no host
# secrets — set them in .xamal/secrets (gitignored) or your shell:
#   CONNECTIX_HOST=1.2.3.4  CONNECTIX_SSH_USER=root  CONNECTIX_DOMAIN=app.example.com
import Config

# The bare hostname for Phoenix's own URL generation (PHX_HOST). The domain may
# carry an explicit ":port" for Caddy's bind address; PHX_HOST must not, or the
# port ends up baked into every generated absolute URL.
phx_host =
  case System.get_env("CONNECTIX_DOMAIN") do
    nil -> "agents-demo.example.com"
    domain -> domain |> String.split(":") |> hd()
  end

# Pass a var through to the deployed box only when it is actually set here, so
# an unset optional knob leaves the app's own default alone instead of shipping
# an empty string (which several resolvers treat as "configured, blank").
optional = fn key ->
  case System.get_env(key) do
    v when is_binary(v) and v != "" -> [{String.to_atom(key), v}]
    _ -> []
  end
end

# Is a secret actually available to ship — either in this shell or in the
# gitignored .xamal/secrets dotenv xamal uploads from? Xamal fails the whole
# deploy on a declared-but-missing secret, so optional secrets must only be
# declared when present.
secret_present? = fn key ->
  System.get_env(key) not in [nil, ""] or
    Path.expand("../.xamal/secrets", __DIR__)
    |> File.read()
    |> case do
      {:ok, body} -> Regex.match?(~r/^\s*#{Regex.escape(key)}\s*=\s*\S/m, body)
      _ -> false
    end
end

config :xamal,
  service: "connectix",
  servers: [
    web: [System.get_env("CONNECTIX_HOST") || "CONNECTIX_HOST-unset"]
  ],
  ssh: [
    user: System.get_env("CONNECTIX_SSH_USER") || "root",
    # A DEDICATED directory holding only the deploy key, named with a standard
    # basename. Erlang's :ssh is given `Path.dirname(hd(keys))` as its
    # `user_dir` and then tries only standard basenames inside it — pointing
    # this at ~/.ssh means an unrelated pre-existing id_ed25519 gets tried
    # instead, and auth fails silently against the wrong identity.
    keys: [System.get_env("CONNECTIX_SSH_KEY") || "~/.ssh/agents-demo-deploy/id_ed25519"]
  ],
  # Caddy terminates TLS (Let's Encrypt) and proxies to the app. It also
  # carries the LiveView WebSocket, so the UI and its socket share an origin.
  caddy: [
    host: System.get_env("CONNECTIX_DOMAIN") || "agents-demo.example.com",
    app_port: 4000
  ],
  release: [
    name: :connectix,
    mix_env: :prod
  ],
  env: [
    # Anything the app reads with System.get_env/1 at request time has to be
    # listed here or it is absent on the box, and the surface it configures is
    # dead in production while working locally. The user the API acts as is not
    # a secret; its key is, and is declared under `secret` below — set one
    # without the other and the API answers 401 to everything.
    clear:
      [
        PHX_HOST: phx_host,
        # config/runtime.exs starts the endpoint only when this is set.
        PHX_SERVER: "true",
        # Agent filesystems live OUTSIDE the release: xamal replaces `current`
        # wholesale on every deploy, so anything inside it is destroyed by the
        # next one.
        CONNECTIX_DATA_DIR: "/opt/xamal/connectix/data"
      ] ++
        optional.("POOL_SIZE") ++
        optional.("ECTO_IPV6") ++
        optional.("DNS_CLUSTER_QUERY") ++
        optional.("CONNECTIX_API_USER_EMAIL") ++
        optional.("WHATSAPP_OWNER_EMAIL"),
    secret:
      ["SECRET_KEY_BASE", "DATABASE_URL", "ANTHROPIC_API_KEY"]
      |> Kernel.++(
        # The HTTP API is optional the same way: with no key the API refuses
        # every request, which is the correct behaviour for a deploy that does
        # not expose one.
        if secret_present?.("CONNECTIX_API_KEY"), do: ["CONNECTIX_API_KEY"], else: []
      )
      |> Kernel.++(
        # The WhatsApp channel is OPTIONAL and must stay that way: declaring
        # these when absent fails the whole deploy, and the app is designed to
        # run without them — no WhatsApp conversation exists, so the channel is
        # never invoked. All three or none; a partial set cannot send or
        # validate a signature.
        if Enum.all?(
             ~w(WHATSAPP_ACCESS_TOKEN WHATSAPP_PHONE_NUMBER_ID WHATSAPP_APP_SECRET WHATSAPP_VERIFY_TOKEN),
             secret_present?
           ) do
          ~w(WHATSAPP_ACCESS_TOKEN WHATSAPP_PHONE_NUMBER_ID WHATSAPP_APP_SECRET WHATSAPP_VERIFY_TOKEN)
        else
          []
        end
      )
  ],
  # /health/ready is unauthenticated by design and returns 503 until the
  # Sagents supervision tree is up and the node is not draining — exactly a
  # deploy gate. /health/alive would be wrong here: it answers 200 for as long
  # as the BEAM responds, so a node that booted but cannot host agents would
  # pass.
  health_check: [
    path: "/health/ready",
    port: 4000
  ]
