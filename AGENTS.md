# Repository agent instructions

Read `CLAUDE.md` before changing this repository; it is the concise source of
architecture, commands and conventions. Use the repository-scoped
`$develop-voipappz-portal` skill for portal/Vite implementation, verification,
and documentation updates.

Preserve existing uncommitted changes. Keep browser requests same-origin,
never expose secrets through `VITE_*`, and do not deploy unless the user asks.
Run the verification matrix required by the files changed; use
`npm run verify:push` for the complete local gate and `make act-portal` for
changes to the Elixir portal, its forwarder, health routes or the portal CI job.
