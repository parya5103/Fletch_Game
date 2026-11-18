# Arrow Out native Android engineering

## Preserve the existing web app and TWA
- Keep https://gogocompany.in/arrowout/ and the current PWA unchanged.
- Keep `android/twa-manifest.json` intact. Its existing package ID is `com.aaryapratik.arrowout`, start URL is `/arrowout/`, and manifest version is 1.0.0 / code 1.
- The native client uses the same application ID and starts at version 1.1.0 / code 2 so it can replace an already-published code-1 TWA only if the original Play signing key is available. Never upload with a different signing key under the same package ID.

## Native engine and build
- Engine: Cocos2d-x v4 pinned to commit `7a5282a301a13e467bdcc3466d3cd3883862aadf`.
- Language: C++17; Android NDK 27.2.12479018; CMake 3.22.1; Gradle 8.11.1; Android Gradle Plugin 8.9.1; Java 17.
- Run `scripts/bootstrap-native-engine.sh` to fetch the exact Cocos source revision and submodules.
- Run `cmake -S native -B native/build -DCMAKE_BUILD_TYPE=Release && cmake --build native/build && ctest --test-dir native/build --output-on-failure` for the portable rules suite.
- CI exports the existing deterministic 1,000-level generator from `js/game.js` into Android assets, then builds a debug APK and release AAB.

## Current playable slice
- The native Cocos scene reads generated campaign JSON, including board dimensions, active-cell shape, arrow paths, direction, step and cosmetic colour.
- Tap an arrow body. It exits only when its head ray is clear; body-only projections do not block. Native progress is stored separately under `arrowout.native.level.v1`.
- The existing browser save `arrowOut.v2`, PWA state and TWA config are not modified by native progress writes.

## Remaining release gates
- Verify campaign fixture parity against the JS oracle for all 1,000 levels, including malformed asset handling.
- Add native swipe/selection polish, undo/restart, haptics, original sound assets, accessibility and responsive-device QA.
- Profile cold start, frame pacing, memory and crash-free sessions on low-, mid- and high-tier Android devices.
- Sign with the existing Play App Signing upload key (if the TWA package is already published); otherwise confirm the correct first-upload identity before release.
- The native scaffold now includes UMP 4.0.0, GMA Next-Gen 1.6.0, a consent-gated initialization helper and a privacy-options button. It uses Google's test app ID by default and does not request/display ads. Configure the production AdMob app ID with `-P.ADMOB_APP_ID=ca-app-pub-...~...` only after registering the app and publishing UMP privacy messages.
- Before ad requests are enabled, classify the audience/age treatment, set required child/under-age flags before GMA initialization, configure ad units and verify rewarded callbacks with test ads only.
- Complete Data safety, ads declaration, privacy policy, content rating, internal testing and staged rollout.

This is an engineering scaffold and first playable puzzle scene, not a signed production APK, completed AdMob integration or Play Store release.
