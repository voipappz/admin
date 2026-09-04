import Config
import Dotenvy

env_dir_prefix = System.get_env("RELEASE_ROOT") || Path.expand("./")

source!([
  Path.absname(".env", env_dir_prefix),
  Path.absname(".#{config_env()}.env", env_dir_prefix),
  System.get_env()
])
|> System.put_env()

# config/runtime.exs is executed for all environments, including
# during releases. It is executed after compilation and before the
# system starts, so it is typically used to load production configuration
# and secrets from environment variables or elsewhere. Do not define
# any compile-time configuration in here, as it won't be applied.
# The block below contains prod specific runtime configuration.

# Everything below reads the environment. `Connectix.Config` documents each
# variable, and is what application code calls; this file exists for the
# settings that have to be *application config* because a library reads them —
# the Endpoint, :langchain, :anu, :sagents. It cannot call
# Connectix.Config itself: config is evaluated before that module is loaded.
#
# An unset variable and one set to "" mean the same thing — absent — because
# deployment tooling writes `FOO=` for a value it does not have.
env = fn key ->
  case System.get_env(key) do
    value when is_binary(value) and value != "" -> value
    _unset_or_blank -> nil
  end
end

int_env = fn key, default ->
  with value when is_binary(value) <- env.(key),
       {number, ""} <- Integer.parse(value) do
    number
  else
    _unset_or_unparseable -> default
  end
end

# LangChain configuration (all environments)
config :langchain, :anthropic_key, env.("ANTHROPIC_API_KEY")
config :langchain, :openai_key, env.("OPENAI_KEY")

# WhatsApp channel. Read here rather than in the router because `forward`
# options are compile-time, and these are per-deployment secrets.
config :anu,
  app_secret: env.("WHATSAPP_APP_SECRET"),
  verify_token: env.("WHATSAPP_VERIFY_TOKEN")

# How long a tool call may run, in milliseconds
# (`AGENTS_DEMO_TOOL_TIMEOUT_MS`). Unset means no timeout, which is right when
# a human is watching the reply and can give up themselves. An unattended agent
# — one answering a webhook or a voice call — wants a finite one, because
# nobody is there to notice a tool that never returns.
config :langchain,
  async_tool_timeout: int_env.("AGENTS_DEMO_TOOL_TIMEOUT_MS", :infinity)

# Sagents distributed process management (`AGENTS_DEMO_DISTRIBUTION`, default
# `horde`). Horde.Registry and Horde.DynamicSupervisor give cross-node process
# discovery, which needs the nodes connected in an Erlang cluster. Set
# `local` for single-node mode — a one-box deploy pays for Horde's CRDT sync
# and gets nothing back.
distribution =
  case env.("AGENTS_DEMO_DISTRIBUTION") do
    "local" -> :local
    _horde_by_default -> :horde
  end

config :sagents, :distribution, distribution

# Horde cluster membership — which nodes can host agents.
#
# `:auto` (the default when unset) keeps membership equal to every connected
# BEAM node via Horde.NodeListener, with dead-node pruning. Correct here because
# every node in this app runs `Sagents.Supervisor` (see application.ex), so all
# connected nodes are valid agent hosts.
#
# Use `:participation` instead only if you mesh mixed roles into one Erlang
# cluster and some nodes must NOT host agents. With it, an optional per-node
# `:partition` (e.g. `System.get_env("FLY_REGION")`) isolates membership into
# independent groups. See deps/sagents/docs/clustering.md.
config :sagents, :horde, members: :auto

# ## Using releases
#
# If you use `mix release`, you need to explicitly enable the server
# by passing the PHX_SERVER=true when you start it:
#
#     PHX_SERVER=true bin/connectix start
#
# Alternatively, you can use `mix phx.gen.release` to generate a `bin/server`
# script that automatically sets the env var above.
if System.get_env("PHX_SERVER") do
  config :connectix, ConnectixWeb.Endpoint, server: true
end

# PHX_PORT is the dev server's port, read here so `.env` is enough for a plain
# `mix phx.server`; PORT is honoured too so a release-style environment works.
if config_env() == :dev do
  config :connectix, ConnectixWeb.Endpoint,
    http: [ip: {0, 0, 0, 0}, port: int_env.("PHX_PORT", int_env.("PORT", 4000))]
end

if config_env() == :prod do
  # The secret key base is used to sign/encrypt cookies and other secrets.
  # A default value is used in config/dev.exs and config/test.exs but you
  # want to use a different value for prod and you most likely don't want
  # to check this value into version control, so we use an environment
  # variable instead.
  secret_key_base =
    System.get_env("SECRET_KEY_BASE") ||
      raise """
      environment variable SECRET_KEY_BASE is missing.
      You can generate one by calling: mix phx.gen.secret
      """

  host = System.get_env("PHX_HOST") || "example.com"
  port = String.to_integer(System.get_env("PORT") || "4000")

  config :connectix, :dns_cluster_query, System.get_env("DNS_CLUSTER_QUERY")

  # TLS terminates HERE when TLS_CERT_FILE/TLS_KEY_FILE are set — nimbus runs
  # with `proxy: false` because Kong owns 80/443 on that box, so nothing else
  # terminates for us and the container is reached directly on its published
  # port.
  #
  # A missing or unreadable cert RAISES rather than falling back to plain HTTP.
  # The Deno server it replaces downgraded silently on a bad mount, and
  # config/portal/portal-destinations.tsv records that a TLS downgrade shipped
  # unnoticed because of it: the site still answered, just not over https. A
  # container that refuses to start is far easier to notice than one serving
  # the right bytes on the wrong scheme.
  tls_cert = System.get_env("TLS_CERT_FILE")
  tls_key = System.get_env("TLS_KEY_FILE")

  scheme_config =
    if tls_cert not in [nil, ""] and tls_key not in [nil, ""] do
      for {label, path} <- [cert: tls_cert, key: tls_key], not File.regular?(path) do
        raise """
        TLS #{label} file is not readable: #{path}

        The container is configured for https but cannot read this file. On
        nimbus the certs are Let's Encrypt symlinks pointing OUTSIDE /opt/va/certs,
        so BOTH /opt/va/certs and /opt/archive must be mounted or the link
        dangles inside the container.
        """
      end

      [
        https: [
          ip: {0, 0, 0, 0, 0, 0, 0, 0},
          port: port,
          cipher_suite: :compatible,
          certfile: tls_cert,
          keyfile: tls_key
        ]
      ]
    else
      [
        # Enable IPv6 and bind on all interfaces.
        http: [ip: {0, 0, 0, 0, 0, 0, 0, 0}, port: port]
      ]
    end

  config :connectix,
         ConnectixWeb.Endpoint,
         [
           url: [host: host, port: 443, scheme: "https"],
           secret_key_base: secret_key_base
         ] ++ scheme_config

  # ## SSL Support
  #
  # To get SSL working, you will need to add the `https` key
  # to your endpoint configuration:
  #
  #     config :connectix, ConnectixWeb.Endpoint,
  #       https: [
  #         ...,
  #         port: 443,
  #         cipher_suite: :strong,
  #         keyfile: System.get_env("SOME_APP_SSL_KEY_PATH"),
  #         certfile: System.get_env("SOME_APP_SSL_CERT_PATH")
  #       ]
  #
  # The `cipher_suite` is set to `:strong` to support only the
  # latest and more secure SSL ciphers. This means old browsers
  # and clients may not be supported. You can set it to
  # `:compatible` for wider support.
  #
  # `:keyfile` and `:certfile` expect an absolute path to the key
  # and cert in disk or a relative path inside priv, for example
  # "priv/ssl/server.key". For all supported SSL configuration
  # options, see https://hexdocs.pm/plug/Plug.SSL.html#configure/1
  #
  # We also recommend setting `force_ssl` in your config/prod.exs,
  # ensuring no data is ever sent via http, always redirecting to https:
  #
  #     config :connectix, ConnectixWeb.Endpoint,
  #       force_ssl: [hsts: true]
  #
  # Check `Plug.SSL` for all available options in `force_ssl`.

  # ## Configuring the mailer
  #
  # In production you need to configure the mailer to use a different adapter.
  # Here is an example configuration for Mailgun:
  #
  #     config :connectix, Connectix.Mailer,
  #       adapter: Swoosh.Adapters.Mailgun,
  #       api_key: System.get_env("MAILGUN_API_KEY"),
  #       domain: System.get_env("MAILGUN_DOMAIN")
  #
  # Most non-SMTP adapters require an API client. Swoosh supports Req, Hackney,
  # and Finch out-of-the-box. This configuration is typically done at
  # compile-time in your config/prod.exs:
  #
  #     config :swoosh, :api_client, Swoosh.ApiClient.Req
  #
  # See https://hexdocs.pm/swoosh/Swoosh.html#module-installation for details.
end
