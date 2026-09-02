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

# `AgentsDemo.Turns` is the one entry point every surface uses, so its tests
# assert what reaches the agent — and, for a handed-off conversation, that
# nothing does. Copied to stand in for a live session.
Mimic.copy(AgentsDemo.Agents.Coordinator)
Mimic.copy(AgentsDemo.Turns)

# The dashboard routes authenticate with a real user's mothership token, which
# `TokenAuth` verifies by asking the API over NATS. Copied so a controller test
# can present an already-verified identity instead of standing up a broker.
Mimic.copy(AgentsDemo.Realtime.TokenAuth)

ExUnit.start(exclude: [:web_tool, :live_call], capture_log: true)
# ExUnit.start(exclude: [:web_tool], capture_log: false)

# Clean up test filesystem after entire test suite completes
# This prevents race conditions with async tests sharing the same temp directory
ExUnit.after_suite(fn _results ->
  partition = System.get_env("MIX_TEST_PARTITION", "")
  test_dir = Path.join([System.tmp_dir!(), "agents_demo_test#{partition}"])

  if File.exists?(test_dir) do
    File.rm_rf!(test_dir)
  end
end)
