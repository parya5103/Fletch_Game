# Arrow Out! v4 DENSITY CAMPAIGN - Development Progress

Branch: density-v4 (main is NEVER touched by this upgrade)
Goal: levels 100+ get big adaptive boards (16-80 grid, 40-600 REAL arrow
objects) with pan/scroll navigation; levels 1-99 stay byte-identical;
service worker v30 -> v31 at the end.

## Phase status (checkpoint 2026-10-17)
- Phase 0 inspect + checkpoint: DONE (commit 414c0b8e).
- Recovery restore of preserved v4 engine: DONE (commit 72c7810e).
- Phase 2A deferred-drop bug fix: DONE (commit 1d8c1e6a).
- Phase 2B lane-capacity fix (head-seed order): DONE (this commit).
  Exact arrow counts still fail above ~200 arrows (open bug below).
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
Phase 2A fix applied on top (1093 lines, 47535 bytes); Phase 2B
head-seed order fix applied on top of that (1100 lines, 48009 bytes).
The original backup and separate snapshot copies remain in the agent's
persistent store.
- Patched: levelConfig override, whole big-board block, genLevel branch,
  validateBigSolution export.
- Bug history: (1) head cells seeded without an occupancy check ->
  overlapping pieces -> FIXED pre-restore (validated).
  (2) equal 25% lane quotas starve horizontal lanes (~2 heads/row
  capacity) -> exact counts failed (L100 101/116) -> replaced with the
  capacity-aware global round-robin placer.
  (3) natural head-seed order poisoned whole lines in the UP and LEFT
  lanes (~1 head/column, ~1 head/row) -> starved boards -> FIXED in
  Phase 2B (see below).

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

## Phase 2B (this commit): head-seed ray-axis order FIXED
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
- Remaining gap measured (instrumented, in-memory only, not part of
  the committed code): every lane consumes its FULL candidate queue
  (qi == qlen == 1296 on the 72x72 reps) with an empty deferred queue
  at the end; most candidates die on ray-clearance / occupancy /
  growth checks as the strips fill. The remaining shortfall is
  intrinsic density pressure, not a lost-placement bug. Leaner budget
  retries place more pieces (measured L500: 415@0.75, 487@0.72,
  502@0.68), so extra lean retries are the natural Phase 2C lever.

## Tests actually run (sandbox JS evaluation, no browser)
- Harness v1 (pre-restore, 13 checks): L1-99 byte-identity PASS; big
  solvability FAIL L100 (overlap bug, fixed).
- Harness v2 (9 checks): L1-99 PASS; hint-solve, determinism, head
  alignment, bonus PASS; exact counts FAIL (distribution bug).
- Harness v3 (10 checks, round-robin rewrite): L100 solvable PASS;
  exact counts FAIL (L100 95/116) - deferred-drop found.
- Phase 2A targeted tests (commit 1d8c1e6a):
  * syntax: new Function compile OK (1093 lines).
  * success case incl. deferred/retry recovery: L101 EXACT 81/81 with
    validateBigSolution PASS.
  * failure-adjacent case: L100 solvable PASS, count 99/116 - still
    short (the separate lane-capacity bug, Phase 2B).
  * determinism: genLevel(100) twice identical PASS.
  * L1-99 spot-check (levels 1, 2, 50, 99 layouts vs v3): PASS.
- Phase 2B targeted tests (this commit):
  * syntax: new Function compile OK (1100 lines, 48009 bytes).
  * L1/L2/L50/L99 layouts vs v3 baseline: PASS (byte-identical).
  * reps: L100 116/116 EXACT validateBigSolution PASS; L250 288/289
    valid PASS; L500 485/576 valid PASS; L1000 491/576 valid PASS
    (exact counts for 250/500/1000 still UNMET - see open bug).
  * determinism: genLevel(100) twice identical PASS.
  * instrumented diagnostics (throwaway copy): per-lane placed/queue/
    deferred stats collected for L500/L1000 across all 5 budget
    retries; see Phase 2B section.
- Full 1000-level sweep: NOT run (deferred until exact counts green).

## OPEN BUG (Phase 2C): exact counts above ~200 arrows
After the 2A+2B fixes every placement path is lossless (queues fully
consumed, deferred queue drains to 0), L100 hits its exact target, but
dense targets (L250 289, L500/L1000 576) still fall ~1-16% short: best
attempts 288/289, 485/576, 491/576. All short boards remain VALID and
SOLVABLE (validateBigSolution PASS), just below the requested count.
genBigLevel keeps the best valid attempt as fallback; it never
silently claims the target was met.

## Known risks
- The engine is NOT shippable yet: exact counts fail above ~200 arrows
  and no render/main changes exist (big boards would render tiny +
  wrong taps).
- main branch untouched at 5af9fd36.

## Next exact action (next run)
1. Phase 2C (smallest safe lever, no architecture change): extend
   BUDGET_SCHEDULE with leaner retries (e.g. append 0.64, 0.62, 0.60)
   so retries place shorter pieces and more heads survive; keep the
   accept-only-exact+valid rule and the best-valid fallback.
2. Targeted verification on L100/L250/L500/L1000 first; full 1-1000
   sweep only when those are green; commit when green.

## Commits
- 414c0b8e Phase 0 checkpoint: PROGRESS.md only. No gameplay code.
- 72c7810e recovery: restore preserved v4 game engine (js/game.js
  byte-identical from backup, md5 7625ca7f...).
- 1d8c1e6a Phase 2A: fix makeLanePlacer deferred-drop bug (re-queue
  short-deferred heads; no capacity policy change).
- (this commit) Phase 2B: fix lane-capacity starvation - reverse the
  head-seed order for UP/LEFT lanes (far-end-first stacking). L100 now
  exact 116/116; L250/500/1000 improved but still short (open bug).
