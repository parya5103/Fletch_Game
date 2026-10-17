# Arrow Out! v4 DENSITY CAMPAIGN - Development Progress

Branch: density-v4 (main is NEVER touched by this upgrade)
Goal: levels 100+ get big adaptive boards (16-80 grid, 40-600 REAL arrow
objects) with pan/scroll navigation; levels 1-99 stay byte-identical;
service worker v30 -> v31 at the end.

## Phase status (checkpoint 2026-10-17)
- Phase 0 inspect + checkpoint: DONE (commit 414c0b8e).
- Recovery restore of preserved v4 engine: DONE (commit 72c7810e).
- Phase 2A deferred-drop bug fix: DONE (commit 1d8c1e6a).
- Phase 2B lane-capacity fix (head-seed order): DONE (commit 4183cc65).
- Phase 2C lean-budget retries: DONE (this commit).
  All four rep levels now hit EXACT target counts.
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
  and lenient (exact-count top-up) phases; budget retries now
  0.75..0.52 until arrows.length === cfg.pieces AND validateBigSolution
  passes.
- validateBigSolution is exported for scripts/ci-test.js.

## js/game.js on this branch
Restored byte-identical from the preserved development backup in
recovery commit 72c7810e (1088 lines, 47152 bytes, md5 7625ca7f...);
Phase 2A fix on top (1093 lines, 47535 bytes); Phase 2B head-seed
order fix on top (1100 lines, 48009 bytes); Phase 2C lean-budget retry
schedule on top of that (1107 lines, 48537 bytes). The original backup
and separate snapshot copies remain in the agent's persistent store.
- Patched: levelConfig override, whole big-board block, genLevel branch,
  validateBigSolution export.
- Bug history: (1) head cells seeded without an occupancy check ->
  overlapping pieces -> FIXED pre-restore (validated).
  (2) equal 25% lane quotas starve horizontal lanes (~2 heads/row
  capacity) -> exact counts failed (L100 101/116) -> replaced with the
  capacity-aware global round-robin placer.
  (3) natural head-seed order poisoned whole lines in the UP and LEFT
  lanes (~1 head/column, ~1 head/row) -> starved boards -> FIXED in
  Phase 2B.
  (4) only 5 fill-budget retries, all too fat for dense targets
  (L250/500/1000 fell 1-16% short) -> FIXED in Phase 2C by extending
  the retry schedule with leaner budgets.

## Phase 2A (commit 1d8c1e6a): deferred-drop bug FIXED
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
  UNTOUCHED in that phase.

## Phase 2B (commit 4183cc65): head-seed ray-axis order FIXED
- Root cause (measured with a throwaway instrumented copy, never
  committed): makeLanePlacer built its head queue in each line's
  natural order. For the UP lane the first seed in a column sat at the
  strip's inner edge; its ray record (minRow[x]) then poisoned the
  whole column so later candidates in that column died (~1 head per
  column, measured UP=16 vs DOWN=43 on L100). Same for LEFT (~1 head
  per row). DOWN/RIGHT seeded in the stacking-friendly direction, which
  is why they out-placed UP/LEFT.
- Fix (one line + comment, no architecture change): for lanes 0 (UP)
  and 2 (LEFT) reverse the lines[] order before building the candidate
  queue, so heads seed at the FAR end of each line first and stack
  toward the exit edge. Determinism, rayClear/own-ray guards, lane
  quotas, budgets, board dimensions and the classic 1-99 path are all
  untouched.
- Before -> after arrow counts (same targets):
  L100 99/116 -> 116/116 EXACT; L250 181/289 -> 288/289;
  L500 333/576 -> 485/576; L1000 313/576 -> 491/576.
- Diagnostics showed every lane consumes its FULL candidate queue
  with an empty deferred queue at the end; the remaining shortfall was
  intrinsic density pressure, which Phase 2C addresses.

## Phase 2C (this commit): lean-budget retries
- Change (one line + comment): BUDGET_SCHEDULE extended from
  [0.75, 0.72, 0.70, 0.68, 0.66] to
  [0.75, 0.72, 0.70, 0.68, 0.66, 0.64, 0.62, 0.60, 0.58, 0.56, 0.54, 0.52].
  The first five values are byte-identical to Phase 2B, and the retry
  seed depends only on the tries index, so any level that already hit
  its exact target still picks the identical board. The leaner tail
  gives dense levels extra deterministic retries with shorter pieces
  (want shrinks with the budget), which measurably raises placement
  counts. Fixed schedule length keeps the loop bounded; the
  accept-only-exact+valid rule and best-valid fallback are unchanged.
- Investigation first (in-memory probe with a stub color fn, never
  committed): lean budgets raise counts monotonically-ish on dense
  levels (L500: 415@0.75 ... 576@0.60 probe), so the tail was capped at
  0.52 to avoid pushing piece quality further than needed. Piece
  quality at the winning tries stays sane (avg 4.7-6.4 cells, only
  4-8.5% two-cell pieces, same >=2-cell rule as before).
- Real results (selected try measured with an instrumented in-memory
  copy of the real code path):
  * L100: 116/116 EXACT, picked try 0 (bf 0.75) - identical board to
    Phase 2B, proving the head of the schedule is untouched.
  * L250: 289/289 EXACT (was 288/289), picked try 7 (bf 0.60).
  * L500: 576/576 EXACT (was 485/576), picked try 8 (bf 0.58).
  * L1000: 576/576 EXACT (was 491/576), picked try 9 (bf 0.56).
- All four boards: validateBigSolution PASS, deterministic repeat PASS.
- Path lengths of the final boards: L100 min2/max7/avg6.43 (9 tiny);
  L250 min2/max6/avg5.16 (12 tiny); L500 min2/max5/avg4.72 (49 tiny);
  L1000 min2/max5/avg4.75 (47 tiny). "Tiny" = two-cell pieces; the
  lenient top-up phase has always allowed them, the share stays under
  8.5% even at the densest targets.

## Tests actually run (sandbox JS evaluation, no browser)
- Harness v1 (pre-restore, 13 checks): L1-99 byte-identity PASS; big
  solvability FAIL L100 (overlap bug, fixed).
- Harness v2 (9 checks): L1-99 PASS; hint-solve, determinism, head
  alignment, bonus PASS; exact counts FAIL (distribution bug).
- Harness v3 (10 checks, round-robin rewrite): L100 solvable PASS;
  exact counts FAIL (L100 95/116) - deferred-drop found.
- Phase 2A targeted tests (commit 1d8c1e6a): compile OK; L101 EXACT
  81/81 valid; L100 99/116 solvable; determinism PASS; L1-99
  spot-check PASS.
- Phase 2B targeted tests (commit 4183cc65): compile OK (1100 lines,
  48009 bytes); L1/L2/L50/L99 identity PASS; L100 116/116 EXACT valid;
  L250 288/289, L500 485/576, L1000 491/576 all valid; determinism
  PASS; instrumented per-lane/queue diagnostics collected.
- Phase 2C targeted tests (this commit):
  * syntax: new Function compile OK (1107 lines, 48537 bytes).
  * L1/L2/L50/L99 layouts vs v3 baseline: PASS (byte-identical).
  * L100 116/116, L250 289/289, L500 576/576, L1000 576/576 - all
    EXACT, all validateBigSolution PASS, all deterministic PASS.
  * selected retry/budget and path-length stats recorded (Phase 2C
    section) via an instrumented throwaway copy; the committed file
    contains no diagnostics.
- Full 1000-level sweep: NOT run (next phase item).

## OPEN ITEM: full 1-1000 sweep
The four rep levels hit exact counts, but the sweep has not been run:
some other big level may still fall back to its best-valid attempt
below target. genBigLevel would then return a valid, solvable, but
slightly under-count board - never a silent success claim. The sweep
must verify: exact counts, solvability, tier floors (>=80 arrows for
L100-500, >=300 for L501-1000), no duplicate layouts in the 100-140
family, hint-solve reps, determinism.

## Known risks
- The engine is NOT shippable yet: no render/main changes exist (big
  boards would render tiny + wrong taps), and the full sweep is
  pending. Lean-retry levels generate up to 12 carve attempts on a
  miss, so worst-case generation time for big levels rises (still
  bounded and deterministic; Phase 4 perf pass can revisit).
- main branch untouched at 5af9fd36.

## Next exact action (next run)
1. Phase 5-style full 1-1000 sweep on the committed engine: exact
   counts, validateBigSolution, tier floors, duplicate-layout check for
   the 100-140 family, hint-solve reps, determinism reps. Record any
   level that falls back below target and decide there whether one
   more schedule entry is warranted.
2. Then Phase 3 (render.js/main.js pan-scroll navigation, MIN_CELL,
   culling, pan-aware tap, tryRestore N cap 400 -> 6600).

## Commits
- 414c0b8e Phase 0 checkpoint: PROGRESS.md only. No gameplay code.
- 72c7810e recovery: restore preserved v4 game engine (js/game.js
  byte-identical from backup, md5 7625ca7f...).
- 1d8c1e6a Phase 2A: fix makeLanePlacer deferred-drop bug (re-queue
  short-deferred heads; no capacity policy change).
- 4183cc65 Phase 2B: fix lane starvation - reverse the head-seed
  order for UP/LEFT lanes (far-end-first stacking). L100 exact 116/116;
  L250/500/1000 improved but short (open bug then).
- (this commit) Phase 2C: extend BUDGET_SCHEDULE with lean retries
  (0.64..0.52). L100/250/500/1000 now all EXACT: 116/116, 289/289,
  576/576, 576/576 - all valid and deterministic; L1-99 untouched.
