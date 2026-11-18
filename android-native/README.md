# Arrow Out — Native Android (Kotlin)
Separate native Android app. Existing PWA and TWA manifest remain untouched.
Stack: Kotlin 2.3.21, AGP 9.4.1, Gradle 9.6.0, Compose BOM 2026.09.00, Material 3, MVVM/UDF, Hilt, Coroutines/StateFlow, Room and DataStore.
First playable slice: 6x6 winding-path puzzle, occupancy validation, strict head-ray blockers, removal, restart, animated Compose cells, progress storage and legacy v2 save importer.
Build on JDK 17 with Android SDK Platform 37 and Build Tools 36.0.0: gradle --no-daemon :app:testDebugUnitTest :app:assembleDebug
The CI workflow pins Gradle 9.6.0. Generate a local wrapper with gradle wrapper --gradle-version 9.6.0.
The current slice contains a representative puzzle fixture, not the full 1,000-level campaign. Full level-data import, persistent campaign progression, audio assets, consent UI, profiling, device QA and signed Play bundle remain acceptance gates.
