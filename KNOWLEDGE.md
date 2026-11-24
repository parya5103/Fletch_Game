# Arrow Out! (parya5103/Fletch_Game) - Project Knowledge

Persistent project knowledge file. Last updated: 2026-11-24 (documentation-sync audit).
Live: https://gogocompany.in/arrowout/ (canonical, published via gogo-website sync) and
https://parya5103.github.io/Fletch_Game/ (standalone GitHub Pages from this repo).

## What this repo is

- Mobile-first tap-away arrow puzzle game ("Arrow Out!"): 1000 deterministic campaign levels
  (boards 12x12 up to 65x65), date-seeded daily challenge, 3 free hints per level, hearts,
  undo/restart, coins, achievements, streaks, 16+ skins, synthesized audio, wind maps/story worlds.
- Fully offline-capable installable PWA. Zero runtime npm dependencies, zero frameworks.
- The owner runs everything at rupee-zero budget. No paid APIs, no credential round-trips.

## Verified architecture (source-inspected 2026-11-24)

- js/game.js is the CANONICAL level generator (winding paths, strict head-exit ray blocking,
  solver validation). It is the single source of truth for level geometry across web + native.
- Web PWA: index.html + css/ + js/ modules (game, render, main, storage, pwa, ui, map, story,
  audio, bgfx, haptics, reminders, ads, analytics, gogo-notifications), sw.js service worker,
  manifest.webmanifest. Player saves live in localStorage under the arrowOut.v2 key.
- sw.js: cache name holds a versioned cache (currently arrow-out-v50); install uses cache;
reload,
  activate cleans arrow-out-* caches only, page posts SKIP_WAITING on updatefound, reload
  guarded against loops. Registered by js/pwa.js.
- js/ads.js: AdSense display unit on the home menu (slot ao-home). Fail-closed:
  adsAllowed() requires a configured publisher ID and cmpReady = true; ads stay OFF until a
  Google-certified CMP is active. Never fake or time-simulate a rewarded ad (PR #61 removed
  the old fake rewarded-hint demo; the rewarded-hint button is disabled).
- js/gogo-notifications.js + fcm/firebase-messaging-sw.js: GoGo Central push notification
  opt-in module; apiBase is the deployed GoGo central backend, the VAPID public key in source
  is public by design. The fcm-scope service worker installs NO fetch handler so the game PWA
  service worker stays untouched.
- js/analytics.js: GA4 page-view tracking (PR #62).
- js/reminders.js: local-only reminder scheduling; the legacy GitHub-Actions Web Push pipeline
  was removed by the owner (retireLegacyPush cleanup exists).
- native/: C++ core (CMakeLists.txt, include/, tests/) mirroring winding-path and exit-ray rules.
- android-native/: separate Kotlin/Jetpack Compose app (applicationId in.gogocompany.arrowout),
  MVVM/UDF, Hilt, Room/DataStore, single Compose Canvas renderer with pinch zoom/pan. CI
  generates arrow-levels.v1.json (1000 campaign boards) and arrow-daily.v1.json (730 daily
  boards) from the canonical js/game.js generator via scripts/generate-native-levels.cjs and
  solver-validates all of them before packaging. Toolchain: JDK 17, Gradle 9.5.0, AGP 9.3.1,
  Kotlin 2.4.21, Android SDK Platform 37 / Build Tools 36.0.0. Native ID is intentionally
  separate from the legacy TWA ID com.aaryapratik.arrowout (see android/).
- android/: legacy TWA/Bubblewrap pipeline (twa-keygen.yml, twa-build.yml, docs/PLAYSTORE.md,
  docs/ADMOB.md). AdMob app-open patch (scripts/admob-patch.sh) runs only when the
  ADMOB_APP_ID repo secret is set; otherwise builds stay ad-free.
- Browser save migration: PWA Settings export (clipboard JSON) then import inside the Android
  app. Never delete or silently discard player saves.

## GitHub Actions workflows (repo listing, 2026-11-24: f android-native-kotlin.yml 1602, f ci-tests.yml 530, f ci.yml 1903, f gen-icons.yml 997, f lighthouse.yml 856, f native-rules.yml 629, f release-notify.yml 1681, f scorecard.yml 1048, f screenshot.yml 2160, f security-scan.yml 2858, f twa-build.yml 3771)

- ci.yml: full test job running the repo script suites (ci-test.js, pages-test.js, commercial-test.js,
  map-redesign-test.js and more), SHA-pinned actions, least-privilege permissions.
- Screenshots/docs-bot: headless Chromium run (scripts/screenshot.js) commits
  docs/screenshot-home.png, docs/screenshot-board.png and docs/test-log.txt; the log must end
  ALL CHECKS PASSED. Console errors are fatal except expected offline noise during the
  pwa-5 offline phase.
- Others (from the listing above): gen-icons, lighthouse, scorecard, security scanning,
  CodeQL, TWA keygen/build, dependabot config.

## Testing instructions

- No local Node? Tests run in CI on every PR/push. With Node available:
  node scripts/ci-test.js, node scripts/pages-test.js, node scripts/commercial-test.js,
  node scripts/map-redesign-test.js. Verify docs/test-log.txt after Screenshots runs.

## COMPLETED (verified in source/CI/PR history)

- 1000-level winding-path campaign with solver-validated generation, daily challenge, bonus
  objectives, skins, achievements, shop economy, world map + story, snake-exit animation.
- PWA update system verified repeatedly by the Screenshots workflow (banner -> refresh ->
  new cache -> progress preserved incl. rev watermark handling).
- Security pass (v3.7): save sanitizer + deep validation, hardened SW payloads, same-origin
  click URLs, SHA-pinned workflows, minimum permissions.
- AdSense fail-closed consent gate (cmpReady false) in both game repos after the region-
  guessing consent violation was found and removed (PRs #27/#24 era).
- GoGo Central notifications module + fcm SW wired (2026-11-09).
- Native Android app + generated/validated level catalog merged (Nov 2026).
- Fake rewarded-ad demo removed (PR #61); GA4 analytics on (PR #62); SEO guide landing page
  (PR #63); visitor-facing GitHub links removed from public pages (PR #26).

## PENDING / NOT VERIFIED (honest state)

- AdSense approval status and CMP (Funding Choices) are owner dashboard items; ads stay off.
- Real-device verification: PWA install/update cycle, notification opt-in, actual FCM push
  delivery (central backend still runs FCM_DRY_RUN), native app on a physical device.
- Play Store release gates (from android-native/README.md): signed AAB, keystore secrets,
  Play Console account + data-safety forms, final assetlinks/fingerprint, audio/haptics polish,
  production AdMob IDs.
- Landscape/tablet layouts beyond the tested 320-430px portrait band.

## PLANNED (not implemented)

- Real rewarded-ad provider integration; cloud save; leaderboards; further skin/map content.

## Cross-repository dependencies

- parya5103/gogo-website: sync-products.yml publishes this repo main into /arrowout/ daily
  (06:15 IST cron or manual "Sync product apps"). rsync --delete wipes that copy; never edit
  gogo-website/arrowout/ directly.
- parya5103/gogo-central-backend: notification registration + sends (device tokens, receipts).
- Do not reference parya5103.github.io URLs in visitor-facing product pages.

## Constraints future agents must preserve

- Never rewrite js/game.js generation invariants: solvability sweep, alignment of every head
  to its exit ray, winding quality gates in scripts/ci-test.js.
- Any change to a precached asset needs the matching service-worker version bump in BOTH
  sw.js (CACHE) and js/pwa.js (VERSION).
- Keep the localStorage save key arrowOut.v2 and existing migration/sanitizer semantics.
- Keep CSP rules current if ads/scripts change: pagead2/tpc.googlesyndication,
  googleads.g.doubleclick.net, fundingchoicesmessages.google.com, ep1/ep2.adtrafficquality.google
  in script-src, ep1/ep2 + backend origin in connect-src, https://www.google.com in frame-src.
- Public pages must not expose GitHub repository links or buttons.
- Work on feature branches, open PRs, no force push, merge only with owner approval; update
  this file and README.md after every significant change.
