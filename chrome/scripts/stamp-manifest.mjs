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

// "Nimbus07" ← 0.0.7: the display name carries the patch, zero-padded to two.
// Derived rather than stored so the two cannot disagree.
const patch = version.split(".").at(-1);
const name = `Nimbus${patch.padStart(2, "0")}`;

const built = JSON.parse(readFileSync(BUILT, "utf8"));
built.version = version;
built.name = name;
writeFileSync(BUILT, `${JSON.stringify(built, null, 2)}\n`);

console.log(`stamp-manifest: ${name} ${version}`);
