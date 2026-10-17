# Arrow Out! v4 DENSITY CAMPAIGN - Development Progress

Branch: density-v4 (main is NEVER touched by this upgrade)
Goal: levels 100+ get big adaptive boards (16-80 grid, 40-600 REAL arrow
objects) with pan/scroll navigation; levels 1-99 stay byte-identical;
service worker v30 -> v31 at the end.

## Phase status (checkpoint 2026-10-17)
- Phase 0 inspect + checkpoint: DONE (commit 414c0b8e; no gameplay code).
- Phase 1+2 (arrow-count config + generation capacity): IN PROGRESS.
  v4 game engine restored to this branch as a recovery commit
  (byte-identical from the preserved backup; known bugs NOT fixed yet).
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

## js/game.js on this branch (recovery commit)
Restored byte-identical from the preserved development backup:
1088 lines, 47152 bytes, md5 7625ca7fee4e8067e5eea74b5e64c07c.
The backup and a separate snapshot copy remain in the agent's
persistent store. Restored UNMODIFIED - no redesign, no refactoring.
- Patched: levelConfig override, whole big-board block, genLevel branch,
  validateBigSolution export.
- Bug history this session: (1) head cells were seeded without an
  occupancy check -> overlapping pieces -> FIXED (validated).
  (2) equal 25% lane quotas starve horizontal lanes (~2 heads/row
  capacity) -> exact counts failed (L100 101/116) -> replaced with the
  capacity-aware global round-robin placer.
- OPEN BUGS (intentionally NOT fixed in the recovery commit):
  (a) makeLanePlacer deferred-drop: strict-phase retries of deferred
      heads SHIFT them out of the queue and lose them, cutting capacity.
  (b) lane-capacity: big levels still miss exact counts (L100 95/116,
      L101 78/81, L1000 308/576) - fix after (a), re-measure.

## Tests actually run (sandbox JS evaluation, no browser)
- Harness v1 (13 checks): L1-99 byte-identity PASS; big solvability
  FAIL L100 (overlap bug above).
- Harness v2 (9 checks, after overlap fix): L1-99 PASS; hint-solve,
  determinism, head alignment, bonus, L101 breather PASS; exact arrow
  counts FAIL (distribution bug above).
- Harness v3 (10 checks, after round-robin rewrite): L1-99 PASS; L100
  solvable PASS; exact counts still FAIL (L100 95/116; see open bugs).
- Full 1000-level sweep: NOT run since the round-robin rewrite.
- Recovery commit: syntax check only (new Function compile OK).
  No gameplay behaviour was tested for this commit.

## Known risks
- The restored engine is NOT shippable yet: exact counts fail and no
  render/main changes exist (big boards would render tiny + wrong taps).
- main branch untouched at 5af9fd36.

## Next exact action (next run)
1. Fix the makeLanePlacer deferred-drop bug (re-queue short-rejected
   deferred heads instead of dropping them).
2. Re-measure lane capacity on L100/L101/L250/L500/L1000 (targeted,
   cheap); then fix lane-capacity starvation if counts still miss.
3. Only after exact counts + validateBigSolution pass on a targeted
   set: run the full 1-1000 sweep, then commit.

## Commits
- 414c0b8e Phase 0 checkpoint: PROGRESS.md only. No gameplay code.
- (this commit) recovery: restore preserved v4 game engine.
  js/game.js byte-identical from backup (md5 7625ca7f...); PROGRESS.md
  updated. Known bugs left open on purpose.
