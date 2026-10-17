# Arrow Out! v4 DENSITY CAMPAIGN - Development Progress

Branch: density-v4 (main is NEVER touched by this upgrade)
Goal: levels 100+ get big adaptive boards (16-80 grid, 40-600 REAL arrow
objects) with pan/scroll navigation; levels 1-99 stay byte-identical;
service worker v30 -> v31 at the end.

## Phase status (checkpoint 2026-10-17)
- Phase 0 inspect + checkpoint: DONE (this commit; no gameplay code touched).
- Phase 1+2 (arrow-count config + generation capacity): IN PROGRESS.
  Full design implemented in an uncommitted working copy of js/game.js.
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

## Working-copy state (uncommitted js/game.js, 1088 lines)
Preserved in the development agent's persistent backup; NOT in the repo
yet because the last rewrite is unverified:
- Patched: levelConfig override, whole big-board block, genLevel branch,
  validateBigSolution export.
- Bug history this session: (1) head cells were seeded without an
  occupancy check -> overlapping pieces -> FIXED (validated).
  (2) equal 25% lane quotas starve horizontal lanes (~2 heads/row
  capacity) -> exact counts failed (L100 101/116) -> replaced with the
  capacity-aware global round-robin placer -> NOT YET RE-VERIFIED.

## Tests actually run (sandbox JS evaluation, no browser)
- Harness v1 (13 checks): L1-99 byte-identity PASS; big solvability
  FAIL L100 (overlap bug above).
- Harness v2 (9 checks, after overlap fix): L1-99 PASS; hint-solve,
  determinism, head alignment, bonus, L101 breather PASS; exact arrow
  counts FAIL (distribution bug above).
- makeLanePlacer rewrite: NO test run yet. Do not trust it yet.

## Known bugs / risks
- Exact-count + solvability for all 901 big levels unproven after the
  round-robin rewrite (next action proves it).
- No render/main changes yet: a big board rendered by the current UI
  would be unreadably tiny and tap hit-testing would be wrong. Shipping
  js/game.js alone would be broken.

## Next exact action (next run)
1. Restore the working copy of js/game.js from the agent backup.
2. Run the full verification: L1-99 byte-identity vs v3, full 1-1000
   sweep (validate + exact arrow counts + tier floors + no duplicate
   layouts 100-140 + hint-solve on L100/250/500/750/1000 + replay
   determinism).
3. If green: commit js/game.js here as "Phase 1+2: big-board game core"
   and update this file. If red: fix the generator only.

## Commits
- Phase 0 checkpoint: PROGRESS.md only (this commit). No gameplay code.
