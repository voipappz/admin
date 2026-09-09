# VoIPAppz portal

A **pure-BEAM** portal for VoIP/telecom tenants: one Elixir process serves the
LiveView UI, the realtime socket, and the Chrome extension, and forwards
`/auth`, `/api/` and `/tasks/` to the **voipappz-api mothership**. One origin,
so the browser needs no CORS and no second host.

There is no Node, no Vite and no React anywhere in this repo's own build. The
Chrome extension in `chrome/` has its own Node toolchain, used only inside a
build stage — see [The Chrome extension](#the-chrome-extension).

- **Documentation index** → [docs/README.md](./docs/README.md)
- **Building a feature?** → [docs/modules.md](./docs/modules.md)
- **How it fits together?** → [docs/architecture.md](./docs/architecture.md)
- **What is tested?** → [docs/testing.md](./docs/testing.md)
- **Repo conventions / gotchas?** → [CLAUDE.md](./CLAUDE.md)

---

## Quick start

```bash
make env                      # writes .env without overwriting an existing one
make dev                      # the whole stack in Docker → http://localhost:4001
```

**Docker is the only requirement.** No host Elixir needed; `make mise` installs
the pinned toolchain if you want one anyway. Start the sibling mothership stack
first so the API, NATS and cable are reachable, then sign in with its user.

`make dev` refuses to start if the upstream API is unreachable. That is a gate,
not a nuisance: a stack whose engine is down fails in ways that read as broken
authentication.

## How it works

```text
Browser ──► Elixir portal :4001
              ├─ /                    LiveView UI (WelcomeLive, ChatLive)
              ├─ /auth, /api/, /tasks/ ─► voipappz-api mothership
              ├─ /ws/events ────────────► its own socket
              └─ /release ──────────────► the Chrome extension this node ships

Elixir portal ─┬─ NATS request/reply ──► voipappz-api   (ASK: is this token real?)
               └─ one cable connection ► va-crystal     (LISTEN: events, fanned
                                                         out over PubSub)
```

Two transports, two jobs: *ask* on NATS, *listen* on cable. The portal never
reaches the API over HTTP to verify a credential. See
[the architecture guide](./docs/architecture.md) for the full contract.

## The Chrome extension

`chrome/` holds the extension — screen pops, call state and agent availability.
It posts to `/auth/user_login` on this portal and opens its socket on
`/ws/events` here, so it lives in this repo and is only ever changed alongside
the portal it talks to.

**It ships inside the portal image.** A node stage in `Dockerfile.production`
builds it and copies the package into the release; `kamal deploy` therefore
deploys the extension, with no second artifact to publish and no tag to
remember. Node exists only in that build stage — the image that ships carries
no node, no npm and no `node_modules`.

Each node publishes its own build:

| Path | What |
|---|---|
| `/release` | the release page — download, version, SHA-256, install guide |
| `/release/info` | the same facts as JSON, for the post-deploy check |
| `/release/download` | the package, named `voipappz-extension-<version>-<sha>.zip` |

The version comes from `connectix/mix.exs`, so the extension and the portal
serving it always carry the same number. The post-deploy hook fails a deploy
whose extension is missing or whose version disagrees.

```bash
make extension                # build it locally into chrome/angular/dist
```

## Two ways to run

| Mode | Command | When |
|---|---|---|
| **Attached** | `make dev` | Day-to-day work: stack up, portal logs following. Ctrl-C detaches; the stack keeps running. |
| **Detached** | `make up` / `make down` | Same stack in the background. Portal :4001, cable :4100. |

> **Gotcha:** editing `.env` and running `docker compose restart` does *not*
> re-read env vars. Use `docker compose up -d --force-recreate <service>`.

## Configuration

All configuration is env — copy **[.env.example](./.env.example)** to `.env`.
The browser uses relative, same-origin URLs in both development and production.
The local stack defaults to the API on port 5000; override it with:

```bash
PORTAL_ENGINE_URL=https://tenant.example
CABLE_API_URL=https://tenant.example     # keep cable on the same API
```

Each Kamal destination sets its own production `ENGINE_URL` in
`config/deploy.<dest>.yml`. There is no `VITE_*` namespace — nothing in this
repo reads one.

## Make commands

```
make            # list every target
```

| Command | Description |
|---|---|
| `make dev` | Run the local stack in Docker, attached logs |
| `make up` / `make down` | Start / stop the stack in the background |
| `make logs` | Follow the portal log |
| `make health` | Where it is, whether it answers, whether events arrive |
| `make test` | The Elixir suite (`TEST=` narrows it) |
| `make extension` | Build the Chrome extension |
| `make ci JOB=<job>` | Run a GitHub Actions job locally with `act` |
| `make probe` | Drive `/ws/events` with a real session |
| `make iex` / `make tui` / `make tmux` | Attach to, watch, or lay out the running portal |
| `make kamal-config DEST=x` | Render a destination's resolved config, change nothing |
| `make deploy DEST=x` | Build, push and swap the container |

## Testing

```bash
make test                    # the Elixir suite, in Docker
make test TEST=path/or/pattern
make ci JOB=portal           # the same suite the way CI runs it
make ci JOB=extension        # build the extension and check its manifest
make ci JOB=prod-image       # build the release image, boot it, probe every surface
```

Every push runs `.githooks/pre-push` → `scripts/verify-before-push.sh`: a clean
compile with `--warnings-as-errors`, plus a check that the deploy config still
agrees with the app. See [docs/testing.md](./docs/testing.md).

## Project layout

```
connectix/        the portal: LiveView UI, /ws/events, the API forwarder
  lib/            application + web
  assets/         css and js compiled by esbuild/tailwind into priv/static
  test/           the ExUnit suite
chrome/           the Chrome extension (its own package.json and node:20 build)
config/           Kamal: deploy.yml plus one file per destination
.kamal/hooks/     pre-build and post-deploy gates
docs/             architecture, modules, testing, deployment
scripts/          health, probes, the pre-push gate, local CI
```

## Deploy

Kamal, from this repo. `config/deploy.yml` holds what every destination shares
and `config/deploy.<dest>.yml` holds what it does not.

```bash
make kamal-config DEST=connectix   # render and verify, change nothing
make deploy DEST=connectix         # build, push, swap
```

The post-deploy hook probes the live host before calling it a success: TLS,
liveness, readiness, the dependency report, and the extension it just shipped.
A failure names the cause and points at `kamal rollback`. See the
[deployment guide](./docs/deployment.md).
