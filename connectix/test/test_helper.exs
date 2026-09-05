# FileSystemSupervisor will be started by the application supervision tree

# Set up Mimic for mocking in tests
Mimic.copy(LangChain.ChatModels.ChatAnthropic)
Mimic.copy(LangChain.ChatModels.ChatOpenAI)

# Readiness reports whether this node can host agents. The false branch only
# happens while Sagents.Supervisor is down, which is not a state the test suite
# can enter without taking every other test's agents with it.
Mimic.copy(Sagents)

# The voice bridge submits turns and cancels generations through AgentServer.
# Copied so the bridge can be tested as a unit, without a live agent.
Mimic.copy(Sagents.AgentServer)

# `Connectix.Turns` is the one entry point every surface uses, so its tests
# assert what reaches the agent — and, for a handed-off conversation, that
# nothing does. Copied to stand in for a live session.
Mimic.copy(Connectix.Agents.Coordinator)
Mimic.copy(Connectix.Turns)

# The dashboard routes authenticate with a real user's mothership token, which
# `TokenAuth` verifies by asking the API over NATS. Copied so a controller test
# can present an already-verified identity instead of standing up a broker.
Mimic.copy(Connectix.Realtime.TokenAuth)

# `:stress` runs many-at-once concurrency checks and `:wallaby` drives a real
# browser. Both are slower than the rest and fail on a loaded machine for
# reasons that are not the code's fault, so neither blocks the default run:
#
#     mix test --only stress
#     mix test --only wallaby   # needs chromedriver; see WallabyCase
ExUnit.start(exclude: [:web_tool, :live_call, :stress, :wallaby], capture_log: true)

# Wallaby is `runtime: false`, so nothing starts it implicitly — and starting
# it unconditionally would spawn chromedrivers for a suite that never opens a
# browser. WALLABY=1 is the same flag that flips the endpoint to `server: true`
# in config/test.exs, so the two cannot drift apart.
if System.get_env("WALLABY") == "1" do
  {:ok, _} = Application.ensure_all_started(:wallaby)
  Application.put_env(:wallaby, :base_url, ConnectixWeb.Endpoint.url())
end
# ExUnit.start(exclude: [:web_tool], capture_log: false)

# Clean up test filesystem after entire test suite completes
# This prevents race conditions with async tests sharing the same temp directory
ExUnit.after_suite(fn _results ->
  partition = System.get_env("MIX_TEST_PARTITION", "")
  test_dir = Path.join([System.tmp_dir!(), "connectix_test#{partition}"])

  if File.exists?(test_dir) do
    File.rm_rf!(test_dir)
  end
end)
