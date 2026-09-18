# Release acceptance test

[UAT.md](UAT.md) is the sheet: 130 numbered checks a person works through before a
release goes out. [uat.csv](uat.csv) is the same rows, for opening in Sheets or
Excel when the Tester / Date / Result columns are going to be filled in there.

## What it is for

One question: **can a customer do their work on this build?** Not "does the
screen load" — every row ends at something you can see, and where it matters that
is a *different* screen from the one you saved on. Creating a device passes when
a phone registers with it; deleting an application passes when its devices and
numbers are gone too.

## Running it for a release

1. Copy `UAT.md` (or `uat.csv`) for the release.
2. Fill in the **Release under test** block at the top — tag, builds, the URL you
   are testing.
3. Work down it in order. Later blocks reuse what earlier ones create.
4. Record `Pass` / `Fail` / `Blocked` / `Not Run` on every row, with your name and
   the date. A `Fail` needs a note saying what you saw instead, and roughly when,
   so the line can be found in Logs afterwards.
5. `T-130` is the end-to-end row. Run it last, and treat it as the verdict: if it
   fails, the release is not usable, whatever else passed.
6. Attach the filled sheet to the release.

**HIGH** rows are blockers. **needs:** in *Before you start* means the row wants
something the office does not always have — a softphone, a real number, a
carrier, a second customer. If you cannot get it, the row is `Not Run`, not
`Fail`.

## Known issues

Carried forward so a tester does not spend the morning re-discovering them.

| Row | What happens | Since |
|---|---|---|
| T-09 | The contact details on an account do not survive a reload. They save, but come back as one run-together line instead of the separate fields that were entered. | Found 2026-09-18, present on `main`. |

## Keeping the two files in step

`uat.csv` is generated — do not hand-edit it:

    node docs/uat/make-csv.mjs

It reads `UAT.md` and rewrites `uat.csv` with the same IDs in the same order. Add
a row by adding it to `UAT.md` and running that.

## Adding a row

A row earns its place if a customer would notice when it breaks. Keep to the
sheet's habits:

- Say what to do in the words on the screen ("press Add Device"), never in API
  terms.
- End somewhere the tester can see the result, ideally not the form they saved.
- If a step has a waiting period or a trap, put it in **Notes** — a tester who
  judges a webhook ten seconds after saving it will report a working service as
  broken.
