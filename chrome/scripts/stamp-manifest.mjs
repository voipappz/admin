// Stamps the version into the BUILT manifest, and keeps `name` in step with it.
//
// angular.json copies angular/src/manifest.json into the bundle as a plain
// asset, so before this the only way to ship a new version was to hand-edit the
// source manifest and remember that `name` encodes the same number — "Nimbus07"
// is 0.0.7. Those two drifting apart is silent: Chrome shows the stale name and
// nothing warns, so an installed extension can claim to be a version it is not.
//
// The source manifest stays the source of truth (committed, reviewable). This
// only re-stamps the built copy, and EXT_VERSION overrides it for a one-off
// build without a commit:
//
//   EXT_VERSION=0.0.9 npm run build:production
//
// Runs against angular/dist AFTER the Angular build, because that is the copy
// that gets zipped.
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const SOURCE = "angular/src/manifest.json";
const BUILT = "angular/dist/manifest.json";

if (!existsSync(BUILT)) {
  console.error(`stamp-manifest: ${BUILT} not found — run the Angular build first`);
  process.exit(1);
}

const source = JSON.parse(readFileSync(SOURCE, "utf8"));
const version = process.env.EXT_VERSION?.trim() || source.version;

// Chrome requires 1-4 dot-separated integers, each 0-65535, and refuses to load
// the extension otherwise — with an error that names the manifest, not the
// build that wrote it.
if (!/^\d{1,5}(\.\d{1,5}){0,3}$/.test(version)) {
  console.error(`stamp-manifest: "${version}" is not a valid Chrome version (1-4 dot-separated integers)`);
  process.exit(1);
}

// THE NAME NO LONGER FOLLOWS THE VERSION, and that is a deliberate reversal.
//
// It used to: "Nimbus07" was derived from 0.0.7, so the two could not disagree
// while the extension owned its own version line. It does not own it any more
// — the version now comes from the portal's mix.exs, because both ship from
// one commit — and deriving from THAT produces "Nimbus00" for app version
// 0.1.0. An installed "Nimbus10" would appear to go BACKWARDS to "Nimbus00" in
// chrome://extensions, which reads as a downgrade and is the one thing a
// version stamp exists to prevent.
//
// So the name is carried from the source manifest, and EXT_NAME overrides it
// for a deliberate rename. The version alone answers "which build is this?",
// which is what it was always for.
const name = process.env.EXT_NAME?.trim() || source.name;

if (!name) {
  console.error("stamp-manifest: no name in the source manifest and no EXT_NAME");
  process.exit(1);
}

const built = JSON.parse(readFileSync(BUILT, "utf8"));
built.version = version;
built.name = name;
writeFileSync(BUILT, `${JSON.stringify(built, null, 2)}\n`);

console.log(`stamp-manifest: ${name} ${version}`);
