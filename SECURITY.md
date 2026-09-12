# Security policy

## Reporting a vulnerability

**Do not open a public issue.**

Report privately through
[GitHub Security Advisories](https://github.com/voipappz/app/security/advisories/new),
or email **security@voipappz.io**.

Please include what an attacker can do, the steps to reproduce it, and the
affected version or commit. We will acknowledge within 3 business days and keep
you updated until it is resolved. If you would like credit in the advisory, say
so and we will include you.

## Supported versions

The latest release on `main`. Fixes are not backported.

## How this project handles credentials

This app holds no secrets of its own — it is a browser client for
`voipappz-api`, and every permission decision is made by that API. What matters
here is that nothing sensitive reaches the repository or the bundle.

- **`.env` is gitignored** and is the only place real values belong.
  `.env.example` documents the shape and holds no values.
- **`make secrets`** scans every file git would publish for credential-shaped
  strings and fails on a hit. CI runs it on every push, and it is part of
  `make check`.
- **CI credentials are repository secrets**, never literals in a workflow or in
  `.circleci/config.yml`.
- **`VITE_*` values are inlined into the bundle at build time** and are therefore
  public to anyone who loads the app. Never put a secret in a `VITE_`-prefixed
  variable — it is client-side configuration, not a secret store.

## `VA_TEST_OTP`

Login is a two-step OTP flow. `VA_TEST_OTP` is a code the API accepts in place
of an emailed one so an automated suite can sign in. It still requires a valid
email and password.

It is a **test-only** facility. Enabling it on a production API turns the second
authentication factor into a constant. Set it only on test instances, and use an
account that has access to nothing else.

## If a credential is exposed

Rotate it first. Removing the commit is not a fix: a public repository's blobs
stay reachable through GitHub's fork and cache network after a force-push, and
new public repositories are indexed by scrapers within minutes. Assume anything
that was pushed has been read.
