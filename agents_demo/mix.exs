defmodule AgentsDemo.MixProject do
  use Mix.Project

  def project do
    [
      app: :agents_demo,
      version: "0.1.0",
      # Raised from ~> 1.15 for :anu, the WhatsApp channel SDK, which requires
      # ~> 1.19. The CI matrix drops its 1.17 leg for the same reason.
      elixir: "~> 1.19",
      elixirc_paths: elixirc_paths(Mix.env()),
      start_permanent: Mix.env() == :prod,
      aliases: aliases(),
      deps: deps(),
      releases: releases(),
      compilers: [:phoenix_live_view] ++ Mix.compilers(),
      listeners: [Phoenix.CodeReloader]
    ]
  end

  # Xamal deploys a release tarball, so one has to exist. See config/xamal.exs.
  defp releases do
    [
      agents_demo: [
        include_executables_for: [:unix],
        applications: [runtime_tools: :permanent],
        steps: [:assemble, &strip_runtime_state/1]
      ]
    ]
  end

  # A release must not carry the build machine's state. `priv/user_files`
  # holds the per-user agent filesystems created at runtime; shipping them
  # would put local dev data — and whatever an agent wrote into it — on the
  # server, and every deploy would overwrite what production had accumulated.
  # Runtime state belongs outside the release, under AGENTS_DEMO_DATA_DIR.
  defp strip_runtime_state(release) do
    priv = Path.join([release.path, "lib", "agents_demo-#{release.version}", "priv"])

    for dir <- ["user_files"] do
      priv |> Path.join(dir) |> File.rm_rf!()
    end

    release
  end

  # Configuration for the OTP application.
  #
  # Type `mix help compile.app` for more information.
  def application do
    [
      mod: {AgentsDemo.Application, []},
      extra_applications: [:logger, :runtime_tools, :mnesia]
    ]
  end

  def cli do
    [
      preferred_envs: [precommit: :test]
    ]
  end

  # Specifies which paths to compile per environment.
  defp elixirc_paths(:test), do: ["lib", "test/support"]
  defp elixirc_paths(_), do: ["lib"]

  # Specifies your project dependencies.
  #
  # Type `mix help deps` for examples and options.
  defp deps do
    [
      {:anu, "~> 0.2.1"},
      {:bcrypt_elixir, "~> 3.0"},
      {:langchain, "0.9.7"},
      # {:langchain, path: "../my_langchain"},
      # Local fork at ../sagents. Cloned from github.com/sagents-ai/sagents at
      # 0.12.0, the version previously pulled from Hex, so nothing changes
      # until we change it.
      {:sagents, "~> 0.12.0"},
      # {:sagents, path: "../sagents", override: true},
      # {:sagents_live_debugger, path: "../sagents_live_debugger"},
      {:sagents_live_debugger, "~> 0.4.0"},
      {:phoenix, "~> 1.8.1"},
      {:phoenix_html, "~> 4.1"},
      {:phoenix_live_reload, "~> 1.2", only: :dev},
      {:phoenix_live_view, "~> 1.1.0"},
      {:lazy_html, ">= 0.1.0", only: :test},
      {:mimic, "~> 1.8", only: :test},
      {:phoenix_live_dashboard, "~> 0.8.3"},
      # OpenAPI 3 spec + Swagger UI for the public API. Chosen over
      # :phoenix_swagger, which is Swagger 2.0 and barely maintained.
      {:open_api_spex, "~> 3.22"},
      {:esbuild, "~> 0.10", runtime: Mix.env() == :dev},
      {:tailwind, "~> 0.3", runtime: Mix.env() == :dev},
      {:heroicons,
       github: "tailwindlabs/heroicons",
       tag: "v2.2.0",
       sparse: "optimized",
       app: false,
       compile: false,
       depth: 1},
      {:swoosh, "~> 1.16"},
      {:req, "~> 0.5"},
      # ActionCable client transport. Cable owns authentication, channel names
      # and event streams; Elixir holds no direct NATS connection.
      {:mint_web_socket, "~> 1.0"},
      # Kept only for the dormant Realtime.Bus compatibility module. It is not
      # supervised or used by the static screen-pop path.
      {:gnat, "~> 1.9"},
      {:telemetry_metrics, "~> 1.0"},
      {:telemetry_metrics_prometheus_core, "~> 1.1"},
      {:telemetry_poller, "~> 1.0"},
      {:gettext, "~> 1.0"},
      {:jason, "~> 1.2"},
      # The screen-pop rule is data, not code — see priv/pocketflow/screen_pop.yaml.
      {:yaml_elixir, "~> 2.9"},
      {:dns_cluster, "~> 0.2.0"},
      {:horde, "~> 0.10.0"},
      {:bandit, "~> 1.5"},
      {:mdex, "~> 0.13"},
      {:lumis, "~> 0.1"},
      {:tidewave, "~> 0.5", only: :dev},
      # Bare-metal deploy over SSH (systemd + Caddy), an Elixir port of Kamal.
      # No Docker in the deploy path — see config/xamal.exs.
      {:xamal, "~> 0.4", only: :dev, runtime: false},
      {:dotenvy, "~> 1.1.0"},
      # Voice/media pipeline — an Elixir implementation of pipecat, so the
      # standard pipecat JS clients work unmodified. Pinned to a reviewed
      # revision rather than a branch: it is v0.1.0, unpublished to Hex, and
      # the repo carries NO LICENSE, so upgrades are a deliberate act.
      # Feline supplies transport, VAD, turn detection, STT and TTS only —
      # its own LLM, context aggregator and assistant collector are a second
      # agent runtime and are deliberately not used. See AGENTS.md.
      {:feline, github: "dimamik/feline", ref: "6e85fb2f80894c06cad163be91fceb7ab3ca746f"},
      {:credo, "~> 1.7", only: [:dev, :test], runtime: false}
    ]
  end

  # Aliases are shortcuts or tasks specific to the current project.
  # For example, to install project dependencies and perform other setup tasks, run:
  #
  #     $ mix setup
  #
  # See the documentation for `Mix` for more info on aliases.
  defp aliases do
    [
      setup: ["deps.get", "assets.setup", "assets.build"],
      "assets.setup": ["tailwind.install --if-missing", "esbuild.install --if-missing"],
      "assets.build": ["compile", "tailwind agents_demo", "esbuild agents_demo"],
      "assets.deploy": [
        "compile",
        "tailwind agents_demo --minify",
        "esbuild agents_demo --minify",
        "phx.digest"
      ],
      precommit: [
        "compile --warning-as-errors",
        "deps.unlock --unused",
        "format",
        "credo",
        "test"
      ]
    ]
  end
end
