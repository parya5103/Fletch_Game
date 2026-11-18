# Arrow Out — Native Android (Kotlin)

Separate native Android application: `in.gogocompany.arrowout`. Existing PWA and TWA manifest (`com.aaryapratik.arrowout`) remain untouched; the native ID is intentionally separate until the Play Console package/signing identity is confirmed.

## Architecture
Kotlin + Jetpack Compose Material 3, MVVM/UDF, Hilt, Coroutines/StateFlow, Room and DataStore. The large-board renderer uses a single Compose Canvas with pinch zoom and pan rather than thousands of per-cell composables.

## Campaign and gameplay
- The CI build generates `arrow-levels.v1.json` from the canonical `js/game.js` generator using `scripts/generate-native-levels.cjs`.
- The generation step builds and solver-validates all 1,000 deterministic official levels before packaging the Android app. This keeps native level geometry identical to the web campaign without hand-maintained duplicate layouts.
- Native rules validate winding paths and use the strict arrow-head exit ray for blockers.
- Three-heart mistake rules, win/fail states, stars, coins, level unlocks and restart/continue are wired.
- Native campaign progression reads the generated level catalog; pinch zoom/pan supports the larger boards.

## Browser save migration
On the PWA open **Settings → Export progress for Android**. The save JSON is copied to the clipboard (with a manual copy fallback). In the Android app choose **Import existing PWA progress**, paste the JSON and import. The importer validates the actual `arrowOut.v2` / `arrowOut.v1` structure, restores a valid current puzzle where available, and retains the full original JSON snapshot so unported fields are not discarded. The browser save is not changed by import.

## Ads and privacy
UMP consent request, privacy-options entry point and consent-gated Google Mobile Ads Next-Gen initialization are present. The app uses Google's test app ID and has no production ad unit configured. No live ads or monetization are enabled.

## Build
JDK 17, Gradle 9.5.0, AGP 9.3.1, Kotlin 2.4.21, KSP 2.3.12, Android SDK Platform 36 and Build Tools 36.0.0.

For a local build, first run `node scripts/generate-native-levels.cjs`, then from `android-native/` run:
`gradle --no-daemon :app:testDebugUnitTest :app:assembleDebug :app:bundleRelease`.

CI performs the level-generation/solver-validation step, unit tests and debug APK/unsigned release AAB builds. A signed Play upload bundle requires protected `ANDROID_KEYSTORE_PATH`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS` and `ANDROID_KEY_PASSWORD` properties; never commit keystores or passwords.

## Remaining release gates
Final audio/haptics polish, full native cosmetics/daily challenges/achievements/leaderboards, physical-device profiling and crash testing, verified production AdMob IDs and consent behavior, Play package identity confirmation, signed AAB and Play Console review. CI success and a generated level catalog are not by themselves proof of a Play-ready release.
