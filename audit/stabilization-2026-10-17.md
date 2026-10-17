# Arrow Out! stabilization audit — 2026-10-17

## Repository and scope

- Verified remote: https://github.com/parya5103/Fletch_Game.git (active, not archived).
- Remote default branch: `main`.
- Initial and refreshed default-branch commit: `5af9fd36b9688a6ae6337b9ab73cae3d5d402a89`.
- Work branch: `coderabbit/game-audit-stabilization/6f31fc9e`; started clean at that commit.
- No merge, production deployment, player-data deletion, ads, analytics, permissions or remote scripts added.
- Ubuntu 26.04, Node 24.21.0, Python 3.14.4; shared Chromium for browser tests. No app package dependencies or build step.
- No repository AGENTS.md or knowledge-base context was present. README, runtime setup report, source files, assets, workflows, prior audit scripts/reports and test log were inspected.
- This report supersedes older audit conclusions; the older result files are retained as historical evidence.

## Baseline findings

| Check | Actual result before fixes |
|---|---|
| `node scripts/ci-test.js` | PASS, exit 0, including its production-code 1000-level reverse-order sweep |
| `node audit/level_test.js` | Exit 0, but tested an obsolete copied generator; not evidence for current levels |
| `node audit/validate_all_1000.js` | Exit 0, same obsolete-copy limitation |
| `node audit/full_1000_validation.js` | FAIL, exit 1; all 1000 attempts reported `GameCore is not defined`; harness failure, not 1000 unsolvable puzzles |
| Browser `Tests.runAllTests()` | 29 PASS / 1 FAIL: called private `UI.starsHTML` |
| Hostile save map key reproduction | Valid unlocked level 42 fell back to level 1 |
| `Storage.addCoins(Infinity)` reproduction | Returned Infinity, which serializes to null |
| Invalid direction validator reproduction | Threw while indexing the direction vector |
| `node scripts/screenshot.js` | Initially BLOCKED, exit 1: Puppeteer missing; subsequently recovered and passed |

Historical scripts were run in a scratch copy so their generated reports did not overwrite repository evidence. Two temporary test-harness errors (a scratch syntax typo and an incomplete push mock) were corrected; neither was a product failure. A browser automation step attempted to click Home while Home was already visible; continuation used the current screen. These failed attempts were not counted as passes.

## Implementation and verified fixes

### Engine and state

- The actual rule is snake motion through the piece's own path, then out along its head ray. Winding-body projections do not block exits. Production gameplay already followed this rule; its board validator incorrectly used whole-body projections and trusted malformed input.
- Board validation now checks bounded integer dimensions, valid directions, connected orthogonal paths, aligned heads, disjoint cells and unique placement steps. It solves with the gameplay head-corridor rule. Invalid pieces cannot be returned as removable hints.
- Arrow identities are array indices; `step` is the unique placement identifier. There is no separate arrow `id` property to invent or migrate.
- Snapshot restoration validates the whole snapshot before publishing it, including shape membership, alive flags, counters, undo references and bonus indices. Malformed snapshots restart a level while keeping campaign progress and cosmetics.
- A save taken while the final arrow is exiting now completes after restoration instead of leaving an empty, unfinished board.
- Win/failure dialogs and rewarded-hint callbacks are tied to the original game state. Restarting or changing level cannot receive an old dialog or hint. Duplicate rewarded requests are ignored.
- Hint use is saved; daily challenges save their date, restore only on that date, count starts/stars, and record completion against the played date. Existing campaign snapshots remain compatible.
- Expired bonus timers stay expired after reload. New snapshots preserve remaining time; old snapshots without these optional fields keep their historical duration fallback.
- Secondary pointer buttons, non-primary touches and input behind dialogs are ignored. Duplicate same-arrow events remain guarded; tap debounce resets on level load.
- Escape ignores repeats and modifier combinations. No new gameplay keyboard shortcuts were invented.
- Zero/invalid viewport sizes do not create invalid cell sizes; small canvases fit their available space.

### Persistence

- V1 migration writes V2 successfully before removing the V1 backup. Corrupt V2 JSON no longer hides a valid V1 backup. Duplicate boot initialization was removed.
- Map keys cannot shadow `hasOwnProperty`; numeric fields reject object coercion; inherited skin names cannot be equipped; nested merge rejects prototype-setting keys.
- Coin additions remain finite and bounded; invalid/negative spending fails. Storage remains usable in memory when localStorage access/writes fail, and status recovers after a successful write.
- Save key and version remain `arrowOut.v2` / version 2. Only backward-compatible optional snapshot fields were added. Valid progress was tested through round trips and migration failures.

### PWA

- Cache version is `arrow-out-v31`. Cache lookup uses only the current game's cache.
- Runtime caching is restricted to the finite app-shell list with canonical query-free keys; failed/redirected responses are not cached.
- Offline navigation can fall back to the app shell; missing JavaScript/assets return a network error, never HTML disguised as JavaScript.
- CacheStorage failures fall back to network where available. A missing required precache asset fails installation without activating an incomplete worker.
- Old-game-cache cleanup remains scoped; foreign caches and localStorage are untouched.
- Checking push-subscription status no longer creates a subscription. Explicit opt-in retains the existing subscription flow.
- Removed duplicate registration/update listeners at boot. The copy-worker action now retrieves the actual deployed worker and handles missing/empty sources rather than offering a stale alternate implementation.
- Existing update-banner/activation design was retained and verified through a simulated new local version.

## All-level results and method

**1,000 campaign levels exist and were tested, 1,000 passed, failing level IDs: none.**

The independent validator reads production source in a Node VM. For every level 1–1000 it:

1. Checks dimensions/configuration/tier, integer coordinates, path continuity, direction alignment, non-overlap, shape membership and unique placement steps.
2. Generates fresh deterministic boards and compares their serialized contents.
3. Uses three seeded removal orders (seeds `1`, `0x12345678`, `0xdeadbeef`, each combined with the level number).
4. Finds blockers independently by inspecting other live pieces' cells, without using the production occupancy table, placement order, hint code or solver to decide solvability.
5. Compares each production blocker and every hint against that independent oracle throughout each full solution.
6. Loads every level through `Game.loadLevel`, checking real controller state and occupancy with mocked UI/render/storage boundaries.

Greedy removal is complete for these rules: deleting a clear piece only frees cells; it cannot create another blocker. The suite asserts that the remaining board always has a legal removal and reaches zero arrows. Generation alone is never counted as solvability.

Also passed: **366/366 deterministic daily seeds**, January 1, 2026 through January 1, 2027. No level skips or timeouts. The command has a 180-second process deadline in CI. Per-level timings and outcomes are available in the delivered JSON; timings are sandbox measurements, not Android performance claims.

| Tier | Levels tested | Actual arrows per board | Minimum occupied fraction |
|---|---:|---:|---:|
| Easy | 50 | 9–24 | 70.0% |
| Medium | 150 | 11–22 | 71.9% |
| Hard | 300 | 14–23 | 75.0% |
| Expert | 300 | 13–25 | 76.4% |
| Master | 200 | 12–22 | 79.2% |

The README's previous medium/expert/master count ranges were inaccurate and are corrected. Counts are not strictly increasing: longer paths and varied layouts affect piece count. Configured tier boundaries and board dimensions were checked; perceived difficulty and enjoyment still require playtesting. No generator redesign or level reduction was performed.

## Final automated verification

| Command/check | Result and coverage |
|---|---|
| `node scripts/ci-test.js` | PASS, exit 0; existing production tests, storage/economy, skins, push payload/click validation |
| `node scripts/regression-test.js` | PASS, exit 0; 15 behavior groups, 0 failures/skips; storage/migration, malformed snapshots, hints, exit/undo/restart, completion, daily saves, stale callbacks, input, audio, viewport and PWA boundaries |
| `timeout 180s node scripts/validate-levels.js <result-path>` | PASS, exit 0; 1000 campaign levels × 3 orders, every controller initialization, 366 daily seeds |
| `node --check` on `js/*.js`, `scripts/*.js`, `audit/*.js`, `sw.js` | PASS: 20 files |
| `git diff --check` | PASS after correcting trailing whitespace |
| Shared-browser `Tests.runAllTests()` | PASS: 30/30; deployed worker-source loader also checked |
| Existing `node scripts/screenshot.js` | PASS, exit 0 after temporary dependency repair; original assertions unchanged |
| Shared-browser additional QA | PASS: 320×568 / 360×800 / 800×360 board bounds, duplicate synthetic touch, undo, hint correctness, hint/save reload, menus, offline level 1000 and cache isolation |
| Build | NOT APPLICABLE: static application, no build configuration |

The screenshot runner executed from `/tmp/fletch-screenshot`, with temporary `puppeteer-core`/`http-server` tooling and an adapter connecting its launch call to shared Chromium. It did not launch a separate hidden browser. Its simulated deployment changed only scratch `index.html` and `sw.js`, then restored them. No live site was contacted or deployed. The later CacheStorage-error fallback was verified by the regression suite; the unchanged successful update path reuses the browser runner's pass.

The historical audit entry points now delegate to the new shared validator. Their final solver coverage is reused from that identical module; they were not each rerun to inflate the count. Node controller initialization is not equivalent to browser-rendering all 1000 levels. Browser rendering sampled levels; all levels were solved and initialized in the deterministic harness.

## Security findings

| Severity | Finding | Resolution / limit |
|---|---|---|
| Medium, local availability/data integrity | Crafted save map keys and coercion objects could abort loading and discard usable progress; malformed board/bonus fields could crash restoration | Fixed and covered by hostile-data tests; localStorage remains player-controlled |
| Medium, local resource availability | Arbitrary successful same-origin responses/query variants could grow the runtime cache; missing assets could receive HTML | Fixed with a finite allowlist, canonical keys, current-cache isolation and navigation-only fallback |
| Low, defense in depth | Nested update merge accepted prototype-setting keys; inherited names could pass skin lookup | Fixed with safe own-property checks, reserved-key exclusion and ownership validation |
| Low, privacy/behavior | Reading notification status could create a push subscription | Fixed: only explicit subscribe requests create subscriptions |
| High reliability, not remote exploit | V1 migration deleted its only durable backup before writing V2 | Fixed: write first, delete only on success |

No remote code-execution or HTML-injection vulnerability was confirmed in the reviewed flows. Dynamic UI HTML uses fixed markup/catalog values or sanitized counters; player-controlled text is not intentionally executed. CSP, notification URL/payload restrictions and pinned GitHub action revisions were inspected; existing push security tests passed. No private key or service-role credential was found in the reviewed application source. Existing public push/anonymous API identifiers are not authentication secrets and are not reproduced here.

Limits: this was source review plus targeted adversarial tests, not a penetration test or an assertion of complete security. Supabase roster RLS and real push delivery were not remotely exercised. Existing auxiliary CI workflows install npm packages without a committed dependency lock; no new application dependency was introduced, and a complete transitive supply-chain audit was not performed. Client-side progress/economy is not tamper-proof.

## Feature status and manual release checks

| Feature | Status |
|---|---|
| 1000-level generation, exits/blockers, hints | Implemented; full deterministic automated validation |
| Undo, restart, hearts, completion/progression | Implemented; controller regressions and sampled browser interaction |
| Daily, rewards, statistics, achievements | Implemented; daily solver/state tests and menu checks; long-term real-time play still manual |
| Shop and 16 skins | Implemented; catalog/economy/ownership regressions and browser shop UI; every palette not visually certified |
| Audio/music | Implemented; AudioParam boundary tests and browser error checks; actual sound quality/background interruptions need device testing |
| Haptics | Implemented; API smoke checks; physical vibration NOT TESTED |
| Rewarded advertising | Demo timer/placeholder only; no real provider added or tested |
| Offline/update/cache/manifest | Implemented; real Chromium offline and simulated local update passed |
| Android installation, standalone lifecycle, OS back/rotation/keyboard/safe areas | NOT TESTED on real hardware; browser emulation does not certify these |
| Push notifications | Existing provider integration; local logic/payload tests passed; end-to-end delivery and server authorization NOT TESTED |
| Remote deployed site / production release | NOT TESTED or changed |

Before release, use a physical low/mid-range Android device to check installation, standalone launch, touch accuracy on dense boards, fast multi-touch, rotation, interruptions during animation, audio focus, vibration, long sessions/battery use, background/resume, storage pressure and upgrades from an installed older version. Verify notification opt-in/out and server policy separately if shipping reminders. Human difficulty/fun/accessibility review remains necessary. No known failing campaign level remains in this suite.

## Exact changed files

- `js/game.js`: structural validation and gameplay-consistent solving; invalid-piece hint protection.
- `js/storage.js`: safe migration, hostile-data sanitation, finite economy, daily statistics/date accounting.
- `js/main.js`: atomic restoration, dated daily snapshots, remaining bonus time, stale callback/input guards, hint persistence, final-flight recovery, actual SW source copying, duplicate initialization removal.
- `js/render.js`: finite viewport/pixel-ratio bounds.
- `js/pwa.js`: non-mutating subscription reads, actual worker-source loader, version display.
- `sw.js`: v31, bounded current-cache access, correct offline responses, CacheStorage failure recovery.
- `js/tests.js`: public-API browser assertions, temporary save restoration and renderer restoration.
- `scripts/qa-harness.js`: isolated production-module fixtures and independent blocker oracle.
- `scripts/regression-test.js`: 15 targeted behavior groups.
- `scripts/validate-levels.js`: independent full campaign/daily solver, controller initialization and JSON evidence.
- `audit/full_1000_validation.js`, `audit/validate_all_1000.js`, `audit/level_test.js`: compatibility entry points to the production validator.
- `.github/workflows/ci.yml`: regression and full-validator gates.
- `README.md`: reproducible test instructions and corrected measured arrow ranges.
- `audit/stabilization-2026-10-17.md`: this report.

Delivery commit and draft PR, when created, are recorded in the task's final response and downloadable report. No merge or deployment is part of this audit.
