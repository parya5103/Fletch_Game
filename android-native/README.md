# Arrow Out — Native Android (Kotlin)
Separate native Android app. Existing PWA and TWA manifest remain untouched.
Stack: Kotlin 2.4.21, AGP 9.3.1, Gradle 9.5.0, Compose BOM 2026.09.00, Material 3, MVVM/UDF, Hilt, Coroutines/StateFlow, Room and DataStore.
First playable slice: 6x6 winding-path puzzle, path/occupancy validation, strict head-ray blocker checks, arrow removal, restart, animated Compose cells and persisted puzzle state.
Legacy importer recognizes arrowOut.v2 and arrowOut.v1 save versions and maps unlocked level, best stars/plays, coins and sound setting. Full cosmetic, daily, achievement and 1,000-level campaign import remains to be integrated and tested.
UMP consent request, privacy-options entry point and consent-gated Google Mobile Ads Next-Gen initialization are wired. The app ID defaults to Google's test app ID; no production ad unit is configured and no live ads are requested.
Build on JDK 17 with Android SDK Platform 37 and Build Tools 36.0.0: gradle --no-daemon :app:testDebugUnitTest :app:assembleDebug :app:bundleRelease
CI pins Gradle 9.5.0 and publishes a debug APK plus unsigned release AAB. A signed Play upload bundle requires a protected upload keystore.
Remaining gates: import and validate all 1,000 official levels, full progression/cosmetic state migration, audio assets, physical-device profiling, crash testing and Play release checks.
