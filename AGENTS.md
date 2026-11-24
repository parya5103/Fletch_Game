# Arrow Out! (Fletch_Game) - Agent Instructions

Rules for any AI coding agent working in this repository.

## Before you touch anything
- Read README.md, KNOWLEDGE.md and docs/test-log.txt first. Inspect existing code before
  modifying it; reuse existing patterns (no new frameworks, no new runtime dependencies).

## Gameplay and data invariants (never break)
- js/game.js owns level generation and blocking rules. Campaign/daily geometry must remain
  deterministic and solver-valid; scripts/ci-test.js gates this (full 1000-level sweep).
- Exit-blocking uses the strict head-exit ray; a piece never blocks itself.
- Player saves: key arrowOut.v2, sanitizeSave + tryRestore validation. Never add a save-key
  rename or destructive migration. Old saves must keep loading; corrupt saves fall back to a
  fresh level without deleting other progress.
- Undo must keep working during and after snake-exit animations.

## Service worker and PWA
- Any change to index.html, css/ or js/ files that sw.js precaches requires bumping the cache
  version in sw.js AND the VERSION constant in js/pwa.js, plus updating the version
  assertions in the test scripts that check them.
- Update flow is banner -> SKIP_WAITING -> single reload; keep the reload-loop guard and the
  cast/scoped cache cleanup (arrow-out-* prefix only, other apps on shared origins keep theirs).

## Ads, analytics, notifications
- Ads are fail-closed: the publisher + cmpReady gate in js/ads.js must stay. Never simulate an
  ad reward or show a fake timer; rewarded hints require a real provider callback.
- CSP in index.html must stay consistent with real external hosts (AdSense incl.
  ep1/ep2.adtrafficquality.google, www.google.com in frame-src; backend origin in connect-src).
- js/gogo-notifications.js: keep the fail-closed config gate; its test asserts the shipped
  config validates and an empty override stays fail-closed.

## Native and TWA
- android-native/ generates levels from js/game.js via scripts/generate-native-levels.cjs;
  keep native rules identical to web rules (head-exit ray, winding paths, daily seeding).
- Never commit keystores, passwords or signing material. Signing stays in protected repo
  secrets; never re-run twa-keygen after the first Play identity is fixed.

## Testing requirements
- Every PR must keep the CI test job(s) green. Prefer extending the existing script suites
  (ci-test.js, pages-test.js, commercial-test.js, map-redesign-test.js) over new tooling.
- Never weaken or delete an existing assertion to make a test pass; fix the behavior or
  reword comments (the string invariants scan comments too).

## Public content rules
- No visitor-facing GitHub repository links or buttons on any public page.
- Accurate, non-fabricated copy: never claim ad revenue, approvals or measurements that were
  not actually taken.

## Process
- Inspect first, smallest safe change, feature branch + PR, no force push, no direct commits
  to main, merge only with owner approval.
- After every significant change update README.md changelog and KNOWLEDGE.md, and report
  exactly which tests ran and what remains unverified.
