# Arrow Out! full audit and minimal fixes — 17 October 2026

## 1. Executive summary

**Overall residual risk: medium.** The offline game and 1,000-level density release have strong automated evidence. Notification authorization, retention, actual delivery and device lifecycle remain externally unverified. No critical gameplay defect or remote exploit was established in this pass; that is not a penetration-test certification.

Base: `ef028afa83e99dd1a1f52f3553128ddad5396e4e`, latest fetched `origin/main`. Branch: `coderabbit/audit-fix-verified-game-issues/4d0ecfbd`. Scope: core, renderer, pointer/touch input, storage/migration, UI, audio/haptics/background effects, PWA/worker/manifest/icons, privacy, notifications, ads, tests and all five Actions workflows. No AGENTS.md or repository knowledge-base guidance was present. No application packages or lockfile exist; runtime remains dependency-free.

The patch repairs reproduced state/UI/notification failures, closes a worker install-validation gap, removes subscription details from sender logs, and documents actual external processing. It keeps the generator, movement rules, economy amounts, save key/version, existing preferences, progress and saved geometry. Notification defaults change only for new/missing/invalid preferences. The worker and displayed release are both v33.

One PR is intended for review, without merging or deploying. No secrets, Supabase settings or production records were changed. Future expired-endpoint deletion is code in the proposed workflow; it was exercised only against synthetic mocks here.

## 2. Confirmed findings and fixes

Locations below refer to the patched files. Each behavior fix has a regression in `scripts/audit-test.js`; tests exercise production modules through the existing VM harness, with synthetic data.

| Severity | File/line | Evidence before fix | Impact | Minimal fix / regression |
|---|---|---|---|---|
| Medium — privacy | `js/main.js:320` | Deferred subscription lookup showed unsubscribe ran before endpoint capture; two pending opt-ins created two requests; deletion results were ignored | Missed roster deletion, concurrent subscribe/unsubscribe, misleading success | Serialize the toggle, capture endpoint first, attempt both removals, report failures and release UI in finally; tests at 37, 52 |
| Medium — privacy | `.github/workflows/notify.yml:121` | Synthetic 404/410 responses caused no deletion; success logged endpoint fragments and errors logged raw provider text | Indefinite stale records; device identifiers or sensitive response details in logs | Delete only expired endpoint rows, preserve transient failures, report cleanup errors, redact logs; tests at 178, 184 |
| Medium — supply chain | `.github/workflows/notify.yml:48` | npm installation shared the step environment containing sender secrets | Package install scripts could access these credentials | Install pinned direct dependency in a separate step with `--ignore-scripts`; static workflow checks verify separation. Transitive dependencies still need locking |
| Medium — data integrity | `js/main.js:637` | Remove arrow, immediately Home → Continue before 250ms save: arrow returned | Last move could be lost | Snapshot before Home; regression at 130 |
| Medium — progression | `js/main.js:429` | Continue on an all-removed snapshot restored an empty board without a win check; renderer/HUD not refreshed | Completion could remain stuck after interrupted animation | Fit canvas, update HUD, persist restored state, check completion; regression at 103 |
| Medium — PWA availability | `sw.js:48` | Mocked core-asset redirect with HTTP 200 activated successfully | Redirected content could become a broken cache-first asset | Reject redirected core precache responses; regression at 138; existing failed-asset regression retained |
| Medium — disclosure | `privacy.html:38` | Policy said no server database/external requests, guaranteed deletion, and no personal information despite push identifiers | Users lacked accurate processing and deletion information | Name Supabase, GitHub and browser push processing; explain failures, retention limits, reset scope and identifiers. Source review plus browser asset/layout checks |
| Low — privacy/UX | `js/storage.js:52`, `js/ui.js:451` | New save default was ON; a delayed status lookup overwrote Off; browser subscription was described as active delivery | Misleading consent/status UI | Default missing preferences off, retain existing booleans, ignore stale status results, say browser subscribed; tests at 28, 64 |
| Low — mobile navigation | `js/ui.js:763` | Theme assignment replaced all body classes, removing `at-home` | Home navigation styling broke | Toggle only theme classes; regression at 75 and 320/390px browser checks |
| Low — usability | `js/main.js:1367` | First login reward hid onboarding, but it was already recorded as seen | New players missed touch/zoom instructions | Mark seen only when shown; show after reward claim; regression at 82 and browser test |
| Low — saved settings | `js/main.js:18` | Saved mute ignored on boot; both controls omitted persistence | Sound returned after reload | Restore and persist sound choice; regression at 94 and real offline reload |
| Low — rewards | `js/main.js:1381`, `js/main.js:1401` | At 2026-03-08 23:30 UTC in America/New_York, local-date subtraction reset a consecutive UTC streak | Incorrect calendar reward/streak across DST | Use UTC subtraction consistently; regression at 112 |
| Low — update status | `js/pwa.js:366`, `sw.js:7` | PWA reported v31 while cache was v32 | Misleading installed version | Advance both to v33, enforce equality; regression at 125 |

The extra test at `scripts/audit-test.js:190` verifies an existing important invariant: a timed bonus pays once across undo/re-removal, saved restore and replay. It required no economy change.

## 3. Coverage and observed results

### Gameplay, persistence and performance

- Geometry uses connected, nonoverlapping cell paths, aligned heads and bounded dimensions. Exits follow the **head corridor**; winding body projections do not block moves. Reverse placement proves a solution, and deleting an available arrow cannot introduce blockers. Existing independent tests cross-check actual removal and hint decisions.
- Current campaign targets remain 20 arrows at level 1, 187 at 300, 500 at 800, 550 at 900 and 600 at 1000. Early/middle/max-density fixtures and level-1000 completion ran in the density suite. No generator code changed.
- Regressions cover corrupted saves, hostile keys/types, failed storage, v1 migration, atomic malformed-snapshot rejection, legacy pre-density geometry, saved hints, dated dailies, mistakes/hearts, repeated taps, undo, restart, stale rewarded callbacks and final-animation recovery. The update does not require a migration.
- Coins, stars, achievements and progress are client-editable. Single-page duplicate login claims, completion callbacks and timed-bonus claims are guarded. A legitimate replay still earns ordinary win coins (including the daily win amount); no once-per-day restriction was invented. Multi-tab simultaneous claims are not certified.
- Renderer/input source is unchanged. Cached stationary layers, viewport-bounded canvases, capped DPR, culling and weak geometry bounds remain. Previous mobile touch and CPU-throttling evidence is reused; this pass does not claim a memory-soak measurement or physical Android test.
- Existing Node tests cover audio numeric boundaries. This pass verifies mute persistence. Audible output, audio-focus interruptions and vibration require hardware checks.

### Executed in this task

All Node commands ran in the repository on Ubuntu 26.04, Node **v24.21.0**, with no new dependencies. CI declares Node 20; its previous successful run is separate evidence, not a fresh local Node-20 run.

| Exact command/check | Result |
|---|---|
| `node scripts/ci-test.js` | PASS, exit 0, existing logic/storage/economy/security suite including single-order 1,000-level smoke |
| `node scripts/regression-test.js` | PASS, exit 0, 15/15 groups |
| `node scripts/density-test.js` | PASS, exit 0, 6/6 groups, including legacy save and level-1000 completion |
| `node scripts/audit-test.js` | First 14 tests passed together; final bonus test passed via `node --test --test-name-pattern='timed bonus' scripts/audit-test.js`. These 15 tests are selected together by CI |
| `for f in js/*.js scripts/*.js audit/*.js sw.js; do node --check "$f" || exit; done` | PASS, exit 0; new final test also parsed and executed successfully |
| `git diff --check` | PASS, exit 0 |
| Python static assertions (`python3 -`, inline script) | PASS: immutable action SHAs, explicit permissions, no `pull_request_target`, self-only script CSP, browser public JWT role is anon, no private-key blocks or eval/Function constructors, dependency install isolated from sender secrets, no endpoint/raw-error logging |
| Python/PyYAML parse of `.github/workflows/*.yml` | PASS: five workflows parse and contain jobs |
| `node /tmp/fletch-browser-audit.js http://localhost:8000/ /home/vercel-sandbox/workspace/output/audit` | Partial passes then harness failures, detailed below |
| `node /tmp/fletch-browser-onboarding.js http://localhost:8000/ /home/vercel-sandbox/workspace/output/audit` | PASS, exit 0: fresh-save reminders off, reward → onboarding, restore dense fixture |
| `gh api repos/parya5103/Fletch_Game/actions/secrets --jq '{total_count, names: [.secrets[].name]}'` | BLOCKED: HTTP 403, resource not accessible by integration. Requested names only; values never requested |

Browser evidence: shared Chromium, **browser emulation only**. An actual local v32→v33 worker update displayed its banner and refreshed into v33. The 599-live-arrow board, hint use and hearts survived. Separate true network-offline reload passed full stable-save comparison, mute state and cached main/PWA/privacy/manifest fetches. At 320×568 and 390×844, theme/Continue/settings had zero horizontal overflow; 844×390 landscape retained valid canvas sizing. No production site was tested.

Honest failure accounting: first browser comparison included temporary `exiting` fields that restoration intentionally strips, so exact raw JSON equality failed after successful activation. A continuation passed update-state, layouts and offline checks, then its fresh-save fixture was overwritten by the game's legitimate `pagehide` autosave. The final fixture test navigated away before replacing synthetic storage and passed. An initial browser CLI expression had a top-level-await syntax error and was corrected. Initial focused regressions failed before repairs; an initial DST test did not straddle the UTC boundary, then the corrected fixture reproduced the bug. No timeout occurred in this audit. None of these failed invocations is reported as an overall pass.

### Reused evidence; expensive sweep not repeated locally

[CI run 39062246343](https://github.com/parya5103/Fletch_Game/actions/runs/39062246343), commit `f57374cb6bc76c973d5e1066d4aa52f27be0d5c2`, succeeded. Its actual log was retrieved with `gh run view 39062246343 --log`. `timeout 180s node scripts/validate-levels.js` passed **1000/1000 campaign boards, three removal orders each, 366/366 daily seeds**, with no failures. Current main differs from that tested application only in screenshots/test-log; solver, generator, validator and level-loading logic remain unchanged in this patch. Affected state/UI/PWA checks ran separately. CI retains its full validation gate for this PR.

Prior [density report](density-2026-10-17.md) records 320/390px native touch emulation, pinch/pan/navigation suppression, every arrow's hit-test, 4× CPU sampling and offline dense restore. Prior measurements: level-1000 load 25.9–35.0ms, warm render p95 1.0–3.2ms, continuous pan p95 10.3ms. These are historical sandbox samples, not new measurements or hardware guarantees. `docs/test-log.txt` also records a successful prior screenshot/navigation/update cycle, with an offline-emulation warning. The broad screenshot/browser-density scripts and historical wrapper validators were not rerun solely to duplicate that evidence.

## 4. Suspected risks and known limits requiring evidence or a product decision

| Priority | Location | Risk / next evidence needed |
|---|---|---|
| High if remotely exposed | `js/pwa.js:316` subscription REST calls | Actual RLS/grants/ownership are unknown. `resolution=merge-duplicates` can require UPDATE privileges beyond the documented insert/delete model. DELETE visibility and affected-row behavior must be verified; HTTP success alone does not prove a row was deleted. Do not solve this by granting anonymous roster reads or blanket deletion |
| Medium | `.github/workflows/notify.yml` | Public subscription insertion needs endpoint/key validation, abuse limits and a unique endpoint constraint. Sender trusts stored endpoints; assess destination restrictions against supported push vendors. No destructive endpoint probing performed |
| Medium | `.github/workflows/notify.yml` | Roster fetch is unpaginated; beyond the provider's row limit, subscribers may be omitted. Network operations lack explicit application timeouts. Measure expected scale and validate a bounded paging/timeout change before rollout |
| Medium | `js/pwa.js` / notification toggle | A failed first worker installation can leave `serviceWorker.ready` pending. A browser subscription can outlive local settings/reset, and failed deletion cannot be retried once its endpoint is forgotten. Use browser revocation and an owner-reviewed deletion/retention process; consider a bounded cancellation/retry design next |
| Medium | `js/storage.js`, reward flow | Multiple tabs can overwrite each other's local snapshots or claim from stale memory. No server-authoritative economy exists. Define a multi-tab policy before introducing synchronization or migrations |
| Medium | bonus timer / device lifecycle | Timer pause logic samples visibility/modal state on ticks. Background suspension/resume and rapid modal transitions may affect elapsed time. Test on physical Android before changing timer semantics |
| Low/medium | rendering and mobile accessibility | No long memory/thermal soak, screen-reader puzzle navigation or expert 600-move playtest in this pass. Inspect contrast across all skins and real-device reachability |
| Low | all build workflows | Actions are SHA-pinned. Screenshot npm packages and sender transitive dependencies lack a committed lock. Screenshot/icon jobs need write access and run on main/manual dispatch, not PR targets; reduce credential exposure during dependency execution next |

PWA source review: core installation must complete before activation; failed/missing or redirected core assets reject install, retaining the old active worker. Current-cache lookups, finite runtime cache keys, navigation-only HTML fallback, query canonicalization, foreign-cache isolation and same-origin notification URLs are covered by existing tests. Icons/manifest use relative Pages paths; optional icon downloads do not block activation. An interrupted deployment that returns mixed successful asset versions is still an operational risk; atomic deployment verification remains necessary. Updates preserve localStorage; clearing site data is not the normal update remedy.

DOM/CSP: dynamic HTML paths reviewed use fixed catalog/SVG markup or sanitized values; hostile-save tests cover relevant boundaries. No confirmed script-injection path was found. Meta CSP permits inline styles but self-only scripts; Pages cannot supply all header-only protections through a meta tag. The static checks are targeted, not a complete dependency-vulnerability or security scan.

## 5. External verification still required

1. **Supabase owner:** inspect RLS enabled state, anonymous grants, insert/update/delete policies, endpoint uniqueness, input constraints, per-device ownership and rate limits. In staging with synthetic identities, prove one device cannot list/read/modify/delete another device's row; test duplicate insert, exact deletion, denied operations and affected-row counts. Verify service-role-only roster reads/cleanup. No dashboard policies were available here.
2. **GitHub owner:** verify presence and valid pairing of `PUSH_VAPID_PRIVATE_KEY` and `SUPABASE_SERVICE_KEY` in Actions settings without sharing values. This task's name-only API request was denied (403). Check schedule enabled, workflow permission restrictions, log retention and deployment branch settings.
3. **Production release owner:** after reviewing/merging separately, verify Pages path, MIME types, manifest/icons, cache v33, update prompt, saved progress and offline startup. This task does not merge or deploy.
4. **Physical Android tester:** install and exercise on a low/mid-range device; no physical device was used. Confirm lifecycle, gestures, audio, vibration, OS permission behavior and real notification opt-out.

## 6. Upgrade assessment

### Must do now

- Review this focused fix PR and complete the external RLS/secret checks before representing reminders as reliable/private.
- Verify the five-per-day fixed-IST schedule is appropriate. The UI now discloses it; reduce to one/day or make frequency a deliberate future choice if product approval supports that change. No cadence was silently altered.
- Use the corrected privacy disclosure and verify actual provider retention/deletion practices.

### Next release

- Add notification timeout/retry/cancellation, validated subscription ownership/abuse controls, roster pagination, and reproducible dependency locks after staging verification.
- Define multi-tab save/claim behavior and test background timer semantics on hardware.
- Run a 20–30 minute dense-board memory/battery/thermal session and accessibility/skin-contrast review.

### Optional later

- Real rewarded ads, cloud saves, custom domain/TWA and richer accessibility only with a clear product requirement; no engine rewrite or new paid service is justified by this audit.
- **Ads today:** `Ads.enabled` is false, `provider` is null, banners are placeholders, and hints use a labelled five-second demo. There is no SDK, live inventory or verified revenue.
- **Minimum future rewarded-ad work:** choose a supported web provider, obtain approval, load its SDK under an explicit CSP, disclose processing and obtain consent where required, handle no-fill/offline/error/cancel/timeout without blocking play or granting an unearned ad reward, and bind one completion callback to one request and the original game state. Grant only on the provider's verified reward event. For valuable/competitive rewards, require server-side validation and idempotency. Preserve three free hints and a defined no-ad fallback; validate provider policy/age suitability before launch. The current adapter interface alone does not establish compliance or secure rewards.

## 7. Exact manual release checklist

Use a staging URL and synthetic profile for mutation tests; keep real player saves intact.

1. Fresh profile at 320px: claim login coins, confirm controls/how-to appears once; open Settings, confirm reminders off and 5/day disclosure. Switch light/dark while at Home; close Settings and Continue.
2. Play levels 1, 300, 800, 900, 1000. At 1000, Fit → tap overview → pinch/drag → hint → tap highlighted arrow. Drag/pinch/cancel must preserve hearts. Rotate portrait/landscape and verify all controls remain reachable.
3. Remove an arrow and immediately open Menu → Home → Continue. Confirm no move is lost. On the last arrow, background/return or Home/Continue during flight; confirm completion and exactly one win reward. Undo and restart an earlier board; confirm intended geometry/progress.
4. Claim a level-ending-in-5 bonus; undo, remove again, reload and replay. No second bonus payment. Claim login reward twice on the same UTC day; no duplicate. Replay win coins follow existing rules. Test the UTC date boundary and two simultaneous tabs separately.
5. Mute sound, refresh online and offline, then resume. On physical Android, check music/audio interruption, vibration, screen lock, OS back and background/resume during a bonus and animation.
6. In staging, keep an old worker and an in-progress save. Deploy reviewed assets, use Check updates/Refresh, and confirm coins/skins/stars/board remain. Go offline and cold-launch. Simulate a missing/redirected core asset: old version must stay usable, then update successfully when repaired. Do not clear site data to fix updates.
7. With a synthetic staging subscription: opt in once, repeat, then opt out; confirm exactly one row and its deletion. Deny permission; disconnect during opt-out; confirm honest failure messaging and browser revocation fallback. Send synthetic 404/410 versus 429 responses: only expired endpoints are deleted. Confirm logs contain no subscription/key values.
8. On low/mid-range Android, pan/zoom and complete dense boards for 20–30 minutes. Observe memory, stalls, heat, battery and touch accuracy; emulator timing is insufficient certification.
