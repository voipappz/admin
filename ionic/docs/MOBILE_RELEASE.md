# Mobile Release (iOS TestFlight + Android Play) — Connectix.io

App identity (set across Capacitor + native projects):

| | Value |
|---|---|
| Bundle ID / Application ID | `connectix.io` |
| Display name | `Connectix.io` |

## Pipelines

CI builds run on **release/** and **mobile/** branches (`mobile-builds` workflow):

- `build-android` → unsigned debug APK (artifact) — no secrets needed
- `build-ios` → unsigned simulator build (artifact) — no secrets needed
- `testflight-ios` → signed IPA → **TestFlight** (behind `hold-testflight` approval)
- `playstore-android` → signed AAB → **Play internal track** (behind `hold-playstore` approval)

The store-deploy jobs are gated behind a manual approval in CircleCI, so they
never run until you click approve **and** the secrets below are set. Nothing
secret is committed — fastlane reads everything from env vars.

## Local commands

```bash
# from repo root
npm run build -- --configuration=production
npx cap sync ios        # or: npx cap sync android

# iOS — build + upload to TestFlight
cd ios/App && bundle exec fastlane ios beta

# Android — build + upload to Play internal track
fastlane android beta
```

## Required CircleCI env vars

### iOS (App Store Connect API key — recommended)
| Var | What |
|---|---|
| `ASC_KEY_ID` | App Store Connect API key id |
| `ASC_ISSUER_ID` | API key issuer id (UUID) |
| `ASC_KEY_CONTENT` | Contents of the `.p8` key (raw PEM or base64) |
| `IOS_APP_IDENTIFIER` | optional override (defaults to `connectix.io`) |

Signing — use one of:
- **match** (recommended): `MATCH_GIT_URL`, `MATCH_PASSWORD`
- or a distribution cert + `app-store` provisioning profile installed on the runner

### Android
| Var | What |
|---|---|
| `ANDROID_KEYSTORE_PATH` | path to the upload keystore on the runner |
| `ANDROID_KEYSTORE_PASSWORD` | keystore password |
| `ANDROID_KEY_ALIAS` | key alias |
| `ANDROID_KEY_PASSWORD` | key password |
| `SUPPLY_JSON_KEY_DATA` | Play service-account JSON contents |

## Notes
- iOS build number auto-increments from the latest TestFlight build.
- First Play upload must be done manually in the console (Google requirement);
  fastlane handles every upload after that.
- To get an App Store Connect API key: App Store Connect → Users and Access →
  Integrations → App Store Connect API → generate a key with App Manager role.
