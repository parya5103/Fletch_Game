# Responsive board and cosmetic shop audit

Base: `978961aeeb0be9ac31f34dc874f8f5c98e0a07a4`, latest main at inspection, including merged PR #6. Branch: `coderabbit/responsive-cross-browser-cosmetic-shop/1b529826`. Release cache: v34.

## Confirmed causes and fixes

- **Square-only rendering:** the canvas, camera bounds, culling and blitting all assumed one square side. Layout also counted container padding as usable space. The canvas now occupies the remaining content box; uniform cells fit both rows and columns, with clearance for outlines. Resizing preserves the world point at the centre, and in-flight exit tracks rescale on rotation.
- **Square puzzle geometry:** the generator produces square puzzles. Fit necessarily leaves space along one axis in portrait. Filling both axes with the entire puzzle would require stretching, cropping or changing generation. This release preserves all puzzles and uses the extra portrait height during zoomed play. Fit shows the complete puzzle, and every arrow can be reached by focus/pan.
- **Audio recovery:** resume/suspend promises were ignored, `interrupted` contexts were not resumed, and not every UI interaction unlocked audio. Recovery now handles rejection and interruption and runs inside pointer, touch and keyboard handlers. No blanket non-Chrome startup failure was reproduced; these are confirmed code defects, not a claim that one cause explains every previously reported device failure.
- **Control overlap:** fixed install/bonus notices could cover the header or zoom controls. Install/update notices now wait for the home screen; timed bonuses reserve a flex row above the board.
- **Split shop writes:** coins were deducted before ownership was saved, and click handlers captured stale ownership. One synchronous transaction now checks current ownership and saves coins, ownership and equipment together. Storage failure rolls everything back; duplicate taps and equipping owned items cannot charge twice.
- **Colour-only previews:** palette dots are replaced by canvases using the production renderer. Featured skins change shafts, texture, arrowhead shapes/facets and edge highlights, including moving arrows.
- **Updates:** PR #6's fresh precache, scoped caches and save protections remain intact. v34 replaces the old release cache; worker registration explicitly bypasses HTTP caching. A real v33-to-v34 update was tested with ten-minute HTTP caching, without clearing player data.

## Cosmetics and saves

| Category | Items |
|---|---|
| Board Skins | Classic Night (default), Ice Crystal, Galaxy, Neon Cyber, Forest |
| Featured Arrow Skins | Classic (default), Ice Crystal, Fire, Lightning, Neon, Royal Gold |
| Legacy compatibility | All 16 previous arrow IDs retained; 17 total with Lightning |

Prices, descriptions, styles and currency live in `GameCore.COSMETICS`. Existing IDs `default`, `ice`, `ember`, `cyber` and `royal` retain ownership while receiving the featured designs. The shop has keyboard-operable tabs, 44px actions, previews and Locked / Owned / Equipped / Previewing states. Preview never equips or spends. All purchases use game coins; no payment or advertising integration was added. Future paid entitlements require backend verification, not this local coin API.

Board effects are static CSS gradients/textures; no downloaded assets or production dependencies were added. Arrow texture simplifies in overview, stationary pieces remain cached, and canvas memory depends on viewport size. Reduced motion suppresses particles and pulse changes. Gameplay paths, collision, hit testing and generation remain unchanged.

The `arrowOut.v2` key/version remain intact. Missing `boardSkin` and `ownedBoards` fields receive Classic Night defaults. Migration preserves coins, unlocked levels, stars, current puzzle, old arrow purchases, settings and daily state. No progress reset or user cache-clearing steps are needed.

## Verification

| Check | Observed result |
|---|---|
| All JS syntax and `git diff --check` | Pass |
| `node scripts/ci-test.js` | All checks pass |
| `node scripts/regression-test.js` | 15/15 pass |
| `node scripts/audit-test.js` | 15/15 pass, including notification privacy/payload/sender fixtures |
| `node scripts/density-test.js` | 6/6 pass |
| `node scripts/cosmetics-test.js` | 6/6 pass |
| Full independent validator | 1000/1000 campaign levels, 3 removal orders each; 366/366 daily seeds; zero failures; 107.8 seconds |
| Browser upgrade suite | Per engine: Levels 1/77/500/1000 at 360×800, 393×873, 432×960 and 1440×900; no clipped Fit geometry or control overlap; every head selectable after focus |
| Browser density suite | Native touch zoom/drag/pinch/hint/removal at 320px and 390px; rotation, offline reload and 4× CPU frame budgets pass |
| Skin performance | All 30 featured-arrow/board combinations at Level 1000; 4× CPU pan rendering below the 33ms p95 gate; geometry unchanged; reduced-motion particles suppressed |
| Update/fallback suite | Real v33→v34 update preserves save; startup/hint/removal work with audio/vibration/push/SW absent and localStorage blocked |

Browser checks also exercise all 22 previews, six pixel-distinct arrow designs, insufficient funds, duplicate buy, reload, Continue, Undo, Restart, level transitions, cached assets and offline daily play. Audio checks verify running contexts and scheduled oscillators after interaction through a local null sink; audible quality was not assessed.

### Actual browser coverage

| Browser/engine | Result | Limit |
|---|---|---|
| Shared Chromium 140.0.7339.16 | Matrix, native touch suite, audio scheduling, offline/update and performance pass; zero page exceptions | Supplied Preview build; not current stable Chrome certification |
| Playwright Firefox 157.0 | Matrix, native touch, audio scheduling and offline pass; zero page exceptions | Automated Linux build; no physical Android Firefox |
| Playwright WebKit 27.2 | Matrix, native touch, audio scheduling and offline pass; zero page exceptions | Engine coverage, not Apple Safari certification |
| Microsoft Edge | Not tested | Stable vendor browser needed |
| Samsung Internet | Not tested | Physical Android browser needed |
| Safari on iPhone, iPad and macOS | Not tested | Apple hardware/browser needed |

An older WebKit 26 runner failed offline navigation; current Playwright 1.64.1/WebKit 27.2 passed. Audio checks initially lacked sandbox GStreamer plugins and an audio sink; installing these prerequisites resolved them. Existing tests were updated for the new catalogue count and valid rectangular geometry. Browser fixtures were corrected to await exit animation before Undo, dismiss the existing reward overlay before Continue, and seed ownership for repeatability. Final checks above passed.

## Reproduction

The application remains dependency-free: `python3 -m http.server 8000`. Browser QA uses an external Playwright 1.64.1 installation, not a production dependency. Use a local QA profile: suites simulate coins and gameplay. The upgrade suite restores the prior save in `finally`; the existing density suite intentionally plays levels. Chromium attaches to shared Preview; Firefox/WebKit use their installed test builds and OS libraries.

```sh
node scripts/cosmetics-test.js
timeout 180s node scripts/validate-levels.js /tmp/levels.json
node scripts/browser-density-test.js http://localhost:8000/ /tmp/evidence
NODE_PATH=/path/to/qa/node_modules node scripts/browser-upgrade-test.js chromium http://localhost:8000/ /tmp/evidence
NODE_PATH=/path/to/qa/node_modules node scripts/browser-upgrade-test.js firefox http://localhost:8000/ /tmp/evidence
NODE_PATH=/path/to/qa/node_modules node scripts/browser-upgrade-test.js webkit http://localhost:8000/ /tmp/evidence
NODE_PATH=/path/to/qa/node_modules node scripts/browser-skin-performance.js /tmp/evidence
NODE_PATH=/path/to/qa/node_modules node scripts/browser-update-test.js /tmp/evidence
```

The update fixture serves the recorded main commit and current source from a temporary HTTP server at `/Fletch_Game/`; it makes no provider writes. Screenshots, browser JSON and full level JSON are in the coding task Outputs: Level 77/1000 Fit and zoom, both shop categories, premium Level 77 and the restored-update fixture.

## Outstanding device checklist

- [ ] Current stable Chrome/Edge on desktop; Samsung Internet and Chrome on mid-range Android hardware.
- [ ] Safari on iPhone/iPad/macOS: address-bar changes, rotation/safe areas, gestures, restricted storage and audible audio after interruptions.
- [ ] Real PWA installation, installed-app offline relaunch and update UX on Android/iOS.
- [ ] Real notification permission UX, scheduled delivery/unsubscribe and deployed provider policy/schedule verification, as already required by PR #6.
- [ ] Screen-reader/device keyboard review. Existing canvas interaction remains; full keyboard puzzle navigation is not added.

## Changed files

- `js/render.js`: rectangular camera, fit/resize, arrow styles and production previews.
- `js/game.js`, `js/storage.js`: central catalogue, additive defaults, atomic coin transactions; generator/rules untouched.
- `js/ui.js`, `index.html`, `css/styles.css`: one shop with tabs/previews/states, board themes and layout.
- `js/audio.js`, `js/main.js`: guarded audio recovery, gesture wiring and skin application.
- `sw.js`, `js/pwa.js`: release v34 and worker update policy.
- `.github/workflows/ci.yml`, `scripts/{ci-test,regression-test,density-test}.js`: expectations and new mandatory test gate.
- `scripts/{cosmetics-test,browser-upgrade-test,browser-update-test,browser-skin-performance}.js`: regression and browser verification.
- `README.md`, this audit: usage, evidence and limitations.
