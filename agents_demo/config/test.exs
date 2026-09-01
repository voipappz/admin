import Config

# Only in tests, remove the complexity from the password hashing algorithm
config :bcrypt_elixir, :log_rounds, 1

# Connection details — host, port, credentials, and the MIX_TEST_PARTITION
# database name — come from the environment in config/runtime.exs, which runs
# after `.env` is loaded. Only the test-only pool behaviour is set here.
config :agents_demo, AgentsDemo.Repo,
  pool: Ecto.Adapters.SQL.Sandbox,
  pool_size: System.schedulers_online() * 2

# We don't run a server during test. If one is required,
# you can enable the server option below.
config :agents_demo, AgentsDemoWeb.Endpoint,
  http: [ip: {127, 0, 0, 1}, port: 4002],
  secret_key_base: "1ucpgggKD06EdyuAUcqtPYRrzXO4o+RZ8J+S/n9nfFo12rKiJW1nH06RIzmi8BQj",
  server: false

# In test we don't send emails
config :agents_demo, AgentsDemo.Mailer, adapter: Swoosh.Adapters.Test

# Disable swoosh api client as it is only required for production adapters
config :swoosh, :api_client, false

# Print only warnings and errors during test
config :logger, level: :info

# Initialize plugs at runtime for faster test compilation
config :phoenix, :plug_init_mode, :runtime

# Enable helpful, but potentially expensive runtime checks
config :phoenix_live_view,
  enable_expensive_runtime_checks: true

# Dummy AWS credentials so the Bedrock code path can be constructed in tests
# without a real account. Not read from the environment on purpose: a test run
# must not depend on whatever the developer happens to have exported.
config :langchain,
  aws_access_key_id: "test_key_id",
  aws_secret_access_key: "test_secret_key",
  aws_region: "us-west-1"

# Outbound WhatsApp in tests goes to a test adapter that forwards each message
# to a registered process, so a test can assert what a caller would have
# received without a Meta account. Delivery happens inside a Task, so the
# receiver is configured rather than `self()`.
config :agents_demo, :whatsapp_adapter, AgentsDemo.Channels.WhatsApp.TestAdapter

# The LiveView UI is off in dev/prod (the React portal is the UI); the suite
# still exercises its LiveViews, so mount them here.
config :agents_demo, liveview_ui?: true
