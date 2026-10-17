# Arrow Out! v4 DENSITY CAMPAIGN - Development Progress

Branch: density-v4 (main is NEVER touched by this upgrade)
Goal: levels 100+ get big adaptive boards (16-80 grid, 40-600 REAL arrow
objects) with pan/scroll navigation; levels 1-99 stay byte-identical;
service worker v30 -> v31 at the end.

## Phase status (checkpoint 2026-10-17)
- Phase 0 inspect + checkpoint: DONE (commit 414c0b8e).
- Recovery restore of preserved v4 engine: DONE (commit 72c7810e).
- Phase 2A deferred-drop bug fix: DONE (this commit).
- Phase 2B lane-capacity fix: NOT STARTED (open bug, see below).
- Phase 3 (large-board navigation): NOT STARTED.
- Phase 4 (rendering/performance): NOT STARTED.
- Phase 5 (1-1000 validation): PARTIALLY RUN (results below).
- Phase 6 (regression checks): NOT STARTED.

## Phase 0 findings (source inspected at main 5af9fd3, SW v30)
- js/game.js levelConfig(): clamps grid to 4-12 and pieces to 2-36 for
  EVERY level; genLevel() re-clamps cfg.grid/cfg.pieces again; carve()
  caps maxPieces. No code path can produce a board above 12x12 / 36
  arrows today.
- js/render.js: fitCanvas sizes cell = side/cols with NO minimum cell
  size; no pan/viewport state at all; every piece is drawn every frame
  (no culling); all coordinates assume the whole board is on screen.
- js/main.js: tapAt() hit-test assumes the full board is visible;
  pointer handlers are tap-only (no drag/pan/wheel); tryRestore()
  rejects saved boards with N > 400 arrows (too small for big boards).
- scripts/ci-test.js: level sanity bounds assume classic 4-12/2-36 and
  the solvability sweep uses validateBoardSolution only.
- sw.js + js/pwa.js: version v30 (2 occurrences each); bump to v31
  only after the UI phases are done.

## Decided v4 design (levels 100+)
- levelConfig big override (early return BEFORE classic clamps):
  pieces = round(100+(n-100)) for n<=500 else round(450+(n-500)*0.1);
  spike n%10==0 -> round(pieces*1.15)+1; breather n%10==1 ->
  max(40, round(pieces*0.8)); clamp 40-600;
  grid = clamp(ceil(sqrt(pieces*9)), 16, 80).
- genLevel: "if (n > 99) return genBigLevel(n, cfg);" before re-clamps.
- genBigLevel: 4-lane strip generator (UP top strip, DOWN bottom strip,
  LEFT/RIGHT middle-band halves). Heads only seed where the whole exit
  ray is clear (global per-line occupancy extremes); a piece never
  places cells on its own exit ray; descending-step removal solves the
  board by construction. Placement is a global round-robin across the
  four lanes (makeLanePlacer + carveStrips) with strict (decent-length)
  and lenient (exact-count top-up) phases; budget retries 0.75..0.66
  until arrows.length === cfg.pieces AND validateBigSolution passes.
- validateBigSolution is exported for scripts/ci-test.js.

## js/game.js on this branch
Restored byte-identical from the preserved development backup in
recovery commit 72c7810e (1088 lines, 47152 bytes, md5 7625ca7f...);
Phase 2A fix applied on top (1093 lines, 47535 bytes). The original
backup and a separate snapshot copy remain in the agent's persistent
store.
- Patched: levelConfig override, whole big-board block, genLevel branch,
  validateBigSolution export.
- Bug history: (1) head cells seeded without an occupancy check ->
  overlapping pieces -> FIXED pre-restore (validated).
  (2) equal 25% lane quotas starve horizontal lanes (~2 heads/row
  capacity) -> exact counts failed (L100 101/116) -> replaced with the
  capacity-aware global round-robin placer.

## Phase 2A (this commit): deferred-drop bug FIXED
- Root cause: makeLanePlacer.placeOne()'s deferred loop SHIFTED every
  deferred head out of the queue and only returned on 'placed'; heads
  that re-tried as 'short' during the strict phase were silently
  DROPPED, permanently losing placement positions and cutting counts.
- Fix (minimal, same architecture, still deterministic): deferred is
  now scanned by index; 'placed' removes just that head, 'dead' is a
  permanent rejection removed once (rays/occupancy only get more
  blocked), and 'short' heads STAY queued for the lenient phase.
  No infinite retry: queue items are consumed once (qi only grows) and
  deferred items can only leave, never re-enter from the queue loop.
- Lane-capacity policy, board dimensions, budgets and levelConfig are
  UNTOUCHED in this phase.

## Tests actually run (sandbox JS evaluation, no browser)
- Harness v1 (pre-restore, 13 checks): L1-99 byte-identity PASS; big
  solvability FAIL L100 (overlap bug, fixed).
- Harness v2 (9 checks): L1-99 PASS; hint-solve, determinism, head
  alignment, bonus PASS; exact counts FAIL (distribution bug).
- Harness v3 (10 checks, round-robin rewrite): L100 solvable PASS;
  exact counts FAIL (L100 95/116) - deferred-drop found.
- Phase 2A targeted tests (this commit):
  * syntax: new Function compile OK (1093 lines).
  * success case incl. deferred/retry recovery: L101 EXACT 81/81 with
    validateBigSolution PASS; 17 pieces of length 2-3 on L100 prove the
    lenient phase recovered its deferred heads.
  * failure-adjacent case: L100 solvable PASS, count 99/116 - still
    short, but that is the SEPARATE lane-capacity bug (Phase 2B).
  * determinism: genLevel(100) twice identical PASS.
  * L1-99 spot-check (levels 1, 2, 50, 99 layouts vs v3): PASS.
- Full 1000-level sweep: NOT run (deferred, Phase 2B first).

## OPEN BUG (Phase 2B): lane-capacity starvation
After the 2A fix, measured counts: L100 99/116, L101 81/81,
L250 181/289, L500 333/576, L1000 313/576. Deferred positions are no
longer lost, so the remaining gap is real lane/head capacity (vertical
strips stack many heads per column; horizontal strips cap at roughly
2-3 heads per row).

## Known risks
- The engine is NOT shippable yet: exact counts fail above ~100 arrows
  and no render/main changes exist (big boards would render tiny +
  wrong taps).
- main branch untouched at 5af9fd36.

## Next exact action (next run)
1. Phase 2B: fix lane-capacity starvation (e.g. rebalance per-lane
   quotas toward vertical lanes' stacking capacity, and/or widen head
   seeding) while keeping L1-99 identical and the solvability invariant
   (seed-time global rayClear + own-ray guard).
2. Targeted verification on L100/L101/L250/L500/L1000 first; full
   1-1000 sweep only when those are green; commit when green.

## Commits
- 414c0b8e Phase 0 checkpoint: PROGRESS.md only. No gameplay code.
- 72c7810e recovery: restore preserved v4 game engine (js/game.js
  byte-identical from backup, md5 7625ca7f...).
- (this commit) Phase 2A: fix makeLanePlacer deferred-drop bug
  (re-queue short-deferred heads; no capacity policy change).
