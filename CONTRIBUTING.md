# Contributing

Thanks for helping. This is what the project expects, and why.

## Set up

```bash
make setup      # .env, dependencies, Playwright browser
make doctor     # says what is still missing
make dev
```

You need a reachable `voipappz-api` instance in `VITE_API_BASE_URL`. This app
has no backend of its own, so without one there is nothing to render.

`make setup` installs the pinned Node (`mise.toml`, `.nvmrc`: 22) if your system
one is older — on Node 14, `npm ci` otherwise fails with `Cannot read property
'@dnd-kit/core' of undefined`, which is npm 6 unable to read a lockfileVersion 3
file and names no version at all.

If you would rather not install Node, add `DOCKER=1` to any of `setup`,
`install`, `dev`, `build` or `test` and it runs in a container instead.

## The loop

```bash
make dev                      # work
make test-users               # the spec for the screen you touched
make check                    # the gate, before you push
```

`make check` runs what CI runs, in CI's order: `check-make`, `secrets`, lint,
unit tests, build. If it passes locally it passes in CI, and if it fails in CI
you can reproduce it here.

## Never commit a credential

`.env` is the only place real values belong, and it is gitignored. `make secrets`
scans everything git would publish for credential-shaped strings and fails on a
hit; CI runs it on every push.

This matters more than usual here: the repository is public, and a public repo
makes a leak permanent — GitHub's fork and cache network keeps a blob reachable
after a force-push, and scrapers index new public repos within minutes. If you
do push one, treat it as compromised and **rotate it**; removing the commit is
not a fix.

## Code shape

Follow what is already there rather than introducing a second convention.

**One directory per feature, logic separate from presentation:**

```
src/components/Thing/
├── Thing.jsx     # presentation
├── Thing.js      # custom hook — state, API calls, filters, pagination
└── Thing.css
```

**All HTTP lives in `src/services/api/`** — one module per resource. Components
call hooks; hooks call service modules; nothing else makes a request.

**Multi-tenancy comes from `CustomerEnvironmentContext`,** not from props. A
scoped call reads the selected customer and environment from context.

**Material-UI v7 components,** not hand-rolled equivalents.

## API rules

The API's live contract at `{VITE_API_BASE_URL}/tasks/openapi.json` is the
authority. Read it before adding a call; a path from an older document is drift
until the live contract confirms it.

Two rules that are easy to get wrong:

- **Form-encoded, not JSON** — every POST and PATCH, including `/auth`. Use
  `URLSearchParams`.
- **PATCH to update, never PUT.**

## Tests

One spec file per screen, named after it: `tests/users.spec.ts`. It becomes
`make test-users` automatically — no Makefile change needed.

Specs run against a **real API** with real credentials; there are no mocks. Use
`tests/auth-fixture.ts` for authentication rather than signing in again, and
generate unique names (`Test DID ${Date.now()}`) instead of hardcoding fixtures
that collide between runs.

A test passes when the API returns 2xx and the screen renders the result.

## Pull requests

- Branch from `main`; do not push to it directly.
- One concern per PR.
- Fill in the template — especially how you verified the change.
- CI must be green. Fork PRs skip the `e2e` job (forks cannot read repository
  secrets); `check` is the gate you can pass.

## Commits

Conventional Commits, because the release notes are generated from them:

```
feat(dids): bridge type selection for call conditions
fix(auth): keep the session through a 401 from /health
docs(readme): explain build-time VITE_* inlining
chore(deps): bump @mui/material to 7.1.1
```

## Reporting problems

Bugs and features: use the issue templates. `make doctor` output is the ideal
environment section — it reports whether values are set, never what they are.

Security vulnerabilities: **do not open an issue.** See [SECURITY.md](SECURITY.md).
