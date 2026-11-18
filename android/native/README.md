# Arrow Out! — Native Android (Cocos2d-x / C++)

## Product targets

- Keep the existing browser game and PWA live at https://gogocompany.in/arrowout/.
- Build a separate native Android game using **Cocos2d-x v4 + C++17**.
- Current repository TWA manifest records package ID `com.aaryapratik.arrowout`. Treat it as the existing Android identity to verify against Play Console before any release; never create a second listing or change a published package ID without an explicit migration decision.
- This is a native game client, not a TWA wrapper. The existing TWA files/workflows are retained until a deliberate release migration is approved.

## Native gameplay scope

The first native vertical slice must render and play a small deterministic arrow puzzle end-to-end:

1. Load a versioned puzzle fixture and validate board dimensions, cell ownership, path continuity and arrow direction.
2. Render winding arrow paths with readable heads, outlines and selected/blocked states.
3. Accept touch input with accurate cell/path hit-testing.
4. Determine whether the arrow's exit corridor is clear; launch only valid arrows.
5. Animate the selected arrow along its own path and off the board.
6. Support undo/restart, win state and deterministic save/load for the fixture.

After the vertical slice, port the full 1,000-level campaign, daily challenge, hints, hearts, timed bonuses, achievements, cosmetics, statistics and existing save data. Preserve deterministic generation and solvability validation. Do not rewrite the current web game or change its data format until compatibility tests pass.

## Architecture

- `native/`: Cocos2d-x Android project and C++ gameplay modules.
- `native/Classes/`: game scenes, renderer, input, puzzle model, rules, save adapter and platform boundary.
- `native/Resources/`: original, licensed art/audio and versioned puzzle fixtures.
- `native/tests/`: dependency-light rule tests plus fixture and save-compatibility tests.
- Keep puzzle generation/rules independent from Cocos scene/rendering classes so they can be tested without a GPU.
- Use a deterministic seed and explicit schema version for every generated puzzle/save fixture.
- Keep the existing JavaScript PWA independent. Do not duplicate shared platform SDK code or copy game rules from the other GoGo game.

## Commercial quality requirements

- Original GoGo visual identity; no copied Candy Crush, Arrow Out competitor art, sounds or level assets.
- Smooth path-following animation, eased transitions, subtle particles, haptics where appropriate, responsive portrait-first UI and 44dp+ touch targets.
- Preserve the current 1,000-level solvability guarantees and verify all levels in CI.
- Native ads are a separate integration from website ads. Obtain consent before SDK initialization, use test ads during development and grant hint rewards only after the SDK's verified reward callback.
- Keep offline play functional. No account/backend requirement may be added without a separate product decision.

## Build and release gates

- Pin Cocos2d-x source revision, Android NDK, CMake and Gradle/AGP versions.
- Build a debug APK and AAB in CI; do not claim success until the workflow has actually completed.
- Verify the configured application ID against the existing Play Console listing before upload.
- Test on a physical Android device, including lifecycle, touch accuracy, audio focus, offline startup, memory and frame-time.
- Configure signing only through protected CI secrets. Never commit keystores or credentials.
- Verify current Google Play target API, Data safety, content rating, privacy policy and ads declarations at submission time.

See [the shared GoGo native 2D engineering standard](GO_GO_NATIVE_2D_STANDARD.md).
