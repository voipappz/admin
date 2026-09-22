# Mobile App Plan — Architecture, Connectix Port, Release Readiness

_Summary of review and planning, 2026-09-22. Related: [MOBILE_RELEASE.md](MOBILE_RELEASE.md), [MIGRATION_PLAN.md](MIGRATION_PLAN.md)._

## 1. Verdict: keep Ionic + Capacitor, go native only for calling

| | Capacitor (current) | Fully native (Swift + Kotlin) |
|---|---|---|
| Codebases | 1 (web + Android + iOS) | 2 apps + separate web |
| Team | Existing Angular devs | Needs iOS + Android developers |
| Admin screens (IVR, queues, extensions…) | Fast to build | Every screen built twice |
| Call quality / reliability | Good, once a native call plugin exists | Best |
| Ringing when the app is closed | Needs a native plugin | Built in |
| Cost | Already built | Months of rewrite, double upkeep |

**Decision:** stay on Capacitor. Most of the app is business-telephony management
(forms, lists, API calls), where hybrid is the right trade-off. Native wins only if
the product becomes mainly a softphone. If the calling layer later proves weak,
rewrite **only that layer** natively.

## 2. The real gap: incoming calls when the app is closed

The phone runs in JavaScript inside the WebView (Phoenix channel / SIP.js + WebRTC),
so it only works while the app is in the foreground.

- **iOS** suspends backgrounded apps within seconds. Ringing a closed phone requires
  a **PushKit VoIP push** reported to **CallKit** in native code, right away.
  iOS cuts off VoIP pushes for apps that don't report a call.
- **Android** needs a high-priority **FCM** push, a **foreground service**
  (phone-call/microphone type) and ideally **ConnectionService**, which also gives
  lock-screen answering and Bluetooth/car handling.

**Roadmap correction:** CLAUDE.md lists `@capacitor/call`, `@capacitor/background-tasks`,
`@capacitor/audio-session` and `@capacitor/audio-recorder`. **None of these exist on npm**
(checked 2026-09-21). The fix is an in-house native Capacitor plugin:

1. **Server:** send a VoIP push (APNs PushKit / FCM high-priority) per incoming call.
   _Backend work, outside this repo, but this repo depends on it._
2. **Native plugin:** receive the push → report to CallKit / ConnectionService →
   JS connects media after answer. On iOS, native code owns the audio session.
3. **Media:** keep WebView WebRTC for v1; go native only if quality or stability demands it.

**This should land before a public store release.** An app that can't ring when
it's closed isn't ready to ship as a phone.

## 3. What to move from `~/connectix/app`

The connectix `ionic/` sources are **staged for deletion** on branch `connectix-v1`
but still exist in `HEAD` (commit `a76751d0`). Read them with
`git show HEAD:ionic/Makefile` before the deletion is committed.

**Take (adapted, not copied):**
- `sync`, `apk`, `ios-sync` targets, merged into the **existing** `Makefile`, keeping
  its host-npm style. Only the Android SDK runs in Docker
  (`ghcr.io/cirruslabs/android-sdk:34`, named gradle-cache volume, run as host UID).
- The `PORTAL` env-var override from `proxy.conf.js`, if wanted. **Keep
  `proxy.conf.json`**: it's wired in `angular.json` and has routes the connectix
  file lacks (`/v1`, `/metrics`, `/recordings`, `/agent`).

**Fix while porting.** The connectix `apk` target is broken as written:
- Gradle loads `../node_modules/@capacitor/android`, but the container never mounts
  node_modules. In this repo node_modules is on the host, so the bind mount fixes it.
- The gradle volume is created root-owned and never chowned, so gradle fails
  with `EACCES`. Chown it once and set `GRADLE_USER_HOME`.

```make
apk: sync
	docker run --rm -v $(GRADLE_VOLUME):/g $(ANDROID_IMAGE) chown $(UID):$(GID) /g
	docker run --rm -u "$(UID):$(GID)" -w /app/android -e GRADLE_USER_HOME=/g \
	  -v "$(CURDIR)":/app -v $(GRADLE_VOLUME):/g $(ANDROID_IMAGE) ./gradlew assembleDebug
```

**Don't take** (portal-specific): the node:22 volume harness, `--base-href /app/` and its
check, `bundle` → `connectix/priv/app`, the gzip step, the ionic Docker stage and CI
job, `/release`.

**Already done here:** the lockfile (`phoenix` present), `npm install` (node_modules populated).

## 4. Release readiness

A release pipeline **already exists**: see [MOBILE_RELEASE.md](MOBILE_RELEASE.md)
(`mobile-builds` workflow on `release*`/`mobile*` branches, debug builds, and
approval-gated fastlane jobs for TestFlight and the Play internal track).
Blockers found:

| # | Blocker | Detail |
|---|---|---|
| 1 | **App identity is still Connectix** | `appId`/`applicationId`/`namespace`/iOS bundle ID = `connectix.io`, name "Connectix.io"; `MainActivity` in template package `com.ionicframework.conferenceapp`. The Play applicationId is **permanent** after first upload, so decide it first. |
| 2 | **Android fastlane job can't find its Fastfile** | CI runs `fastlane android beta` from repo root; the Fastfile is at `android/fastlane/`. Its paths (`project_dir: "android/"`) assume the repo root, so move it to `./fastlane/Fastfile` rather than `cd android`. |
| 3 | **Android versionCode never increases** | `build.gradle` hardcodes `versionCode 2` / `versionName "1.0"`; `package.json` is `0.0.0`. Play rejects any upload after the first. iOS auto-increments; Android needs the same (CI build number or commit count). |
| 4 | **Platform versions** | Capacitor 6 (current is 8), `targetSdk 34`. Check Play's current target-API minimum; meeting it likely needs a Capacitor upgrade. |
| 5 | **Keystore** | None exists. Generate it, keep it out of git (CI secret + offline backup), enroll in Play App Signing. |
| 6 | **Incoming calls** | See section 2. |

## 5. Before the first commit

The repo has **no commits and no `.gitignore`**. `git add .` right now would commit
1.2 GB of `node_modules`, plus `.angular/`, `www/` and `erl_crash.dump`.

1. Add `.gitignore`: node_modules, www, .angular, android/iOS build outputs,
   `*.jks`, `*.keystore`, `.env.local`, crash dumps.
2. Settle app identity (blocker 1).
3. Delete the empty `capacitor.config.json` (the real config is `capacitor.config.ts`).
4. First commit, giving a restore point for everything below.

## 6. Open code-review findings (HIGH, approved, not yet applied)

1. **Ghost "Call Ended" card.** `webrtc-channel-phone.ts` `hangup()` publishes
   `phone:webrtc-event` before `sip:call-message`, so the card is removed then re-created
   and never cleared. That keeps `phoneMode` out of `IDLE`.
2. **Stale extension after re-login.** Logout never tears the phone down and
   `PhoneProvider.initialized` is never reset, so the next user's calls go out on the
   previous user's `phone:<ext>` topic.
3. **Delete redirects to login.** `extension-detail.ts`, `number-detail.ts` and
   `queue-detail.ts` navigate to `/app/extensions|numbers|queues`, which aren't routes,
   so the `**` wildcard sends users to `/login`.

Four MEDIUM/LOW findings (phone init gated on `userData.extension`, undetected remote
hangup, redial uuid collision, unsettled `joinWaiters`) are open, not scheduled.

## 7. Suggested order

1. `.gitignore` → app identity → first commit
2. Apply the 3 HIGH review fixes
3. Port `sync`/`apk`/`ios-sync`; run `make apk` and install on a device
4. Fix the fastlane location and Android versionCode; create the keystore
5. Native calling plugin + server VoIP push
6. Capacitor/targetSdk upgrade if Play requires it → first store release

## Decisions needed

- [ ] Final app ID and display name
- [ ] Android versionCode source (CI build number vs commit count)
- [ ] Distribution: Play internal track only, or Firebase App Distribution too
- [ ] Who owns the native calling plugin, and the server-side VoIP push
