# Repository agent instructions

Read `CLAUDE.md` before changing this repository; it is the concise source of
architecture, commands and conventions. This is a pure-BEAM app —
`connectix/` is the whole product; read `connectix/CLAUDE.md` too before
changing anything inside it.

Preserve existing uncommitted changes. Keep browser requests same-origin, and
do not deploy unless the user asks. Run `scripts/verify-before-push.sh` (the
pre-push gate) or `make test` for the complete local verification, and
`make ci JOB=portal` for changes to the Elixir portal, its forwarder, health
routes or the portal CI job.
