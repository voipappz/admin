# Release acceptance test — version 2

Version 2 keeps the complete 128-check regression while adding smaller,
risk-based views for smoke and normal release testing. Version 1 remains
available in Git history; keeping one current Markdown source avoids two test
definitions drifting apart.

## What changed in version 2

- Added a 26-check CRITICAL smoke gate.
- Added a 63-check normal release view (CRITICAL plus HIGH).
- Kept all 128 in-scope checks as the full regression.
- Added a reusable test-data record and an end-of-run cleanup checklist.
- Made the generator produce all three CSV views from `UAT.md`.
- Reviewed the external IVR/CTI requirements matrix for future traceability;
  draft requirements were not copied into the executable UAT.

[UAT.md](UAT.md) is the source sheet: 128 checks covering a complete
release regression. Generated CSV views make it practical to run at different
depths without maintaining different test lists:

- `uat-smoke.csv` — CRITICAL checks, for a fast deployment confidence pass.
- `uat-release.csv` — CRITICAL and HIGH checks, for a normal release.
- `uat.csv` — all 128 checks, for a full regression.

`UAT-v2.xlsx` packages the three views into one reviewable Excel workbook. It
includes a Review Guide tab, filters, frozen headers, priority highlighting and
controlled Result values. The Markdown file remains the source of truth.

For a non-technical review, `UAT-review.md` and `UAT-review.xlsx` follow one
customer journey from OTP sign-in through user creation, extension setup,
visible phone registration and a completed call.

`UAT-screens.md` is the current-screen usability audit: one plain-language main
task for every real Nimbus screen. Redirect-only compatibility paths are listed
separately so they do not add duplicate tester work.

## What it is for

One question: **can a customer do their work on this build?** Not "does the
screen load" — every row ends at something you can see, and where it matters that
is a *different* screen from the one you saved on. Creating a device passes when
a phone registers with it; deleting an application passes when its devices and
numbers are gone too.

## Running it for a release

1. Pick the run depth and copy the corresponding CSV (or use `UAT.md` for the
   complete sheet).
2. Fill in the **Release under test** block at the top — tag, builds, the URL you
   are testing.
3. Work down it in order. Later blocks reuse what earlier ones create.
4. Record `Pass` / `Fail` / `Blocked` / `Not Run` on every row, with your name and
   the date. A `Fail` needs a note saying what you saw instead, and roughly when,
   so the line can be found in Logs afterwards.
5. `T-130` is the end-to-end row. Run it last, and treat it as the verdict: if it
   fails, the release is not usable, whatever else passed.
6. Attach the filled sheet to the release.

**CRITICAL** rows form the smoke test and are release blockers. **HIGH** rows are
the rest of the normal release gate. **needs:** in *Before you start* means the
row wants something the office does not always have — a softphone, a real
number, a carrier, a second customer. If you cannot get it, the row is `Not
Run`, not `Fail`.

## Known issues

Carried forward so a tester does not spend the morning re-discovering them.

| Row | What happens | Since |
|---|---|---|
| T-09 | The contact details on an account do not survive a reload. They save, but come back as one run-together line instead of the separate fields that were entered. | Found 2026-09-18, present on `main`. |

## Keeping generated files in step

All three CSV files are generated — do not hand-edit them:

    node docs/uat/make-csv.mjs

It reads `UAT.md`, rewrites the complete CSV, and filters the release and smoke
views by priority. Add or change a row in `UAT.md`, then run the generator.

## Adding a row

A row earns its place if a customer would notice when it breaks. Keep to the
sheet's habits:

- Say what to do in the words on the screen ("press Add Device"), never in API
  terms.
- End somewhere the tester can see the result, ideally not the form they saved.
- If a step has a waiting period or a trap, put it in **Notes** — a tester who
  judges a webhook ten seconds after saving it will report a working service as
  broken.
