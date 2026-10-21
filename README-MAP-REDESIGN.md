# Arrow Out! — Magical Level Map Redesign (`feat/magical-level-map`)

## Files Changed & Added
1. `js/map.js` (NEW) — 8-Chapter Magical World Map engine covering Levels 1–1,000 (125 levels/chapter) with cubic Bezier SVG path generation, deterministic level preview metadata, and windowed viewport virtualization (`< 35` DOM nodes mounted at once).
2. `index.html` (UPDATED) — Replaces the plain level-select grid with the Magical World Adventure Map viewport, Chapter Banner, 8-World Atlas drawer, Level Preview bottom sheet, and `js/map.js` script tag.
3. `css/styles.css` (UPDATED) — Adds `.map-node`, `.node-completed`, `.node-current`, `.node-locked`, `.current-pointer-badge`, ambient firefly animations, and `@media (prefers-reduced-motion: reduce)` safeguards.
4. `js/ui.js` (UPDATED) — Connects `openLevelsModal()` / `closeLevelsModal()` to `ArrowOutMap`, ensures the Level Preview panel auto-closes on Play, Back, Escape, outside tap, or node switch, prevents duplicate hint charges on already-highlighted arrows, and flushes heart loss immediately to `arrowOut.v2`.
5. `sw.js` (UPDATED) — Bumps `CACHE_NAME` from `arrow-out-v39` to `arrow-out-v40` and adds `./js/map.js` to `CORE_ASSETS` so offline PWA mode caches the redesigned map automatically.
6. `scripts/map-redesign-test.js` (NEW) — Automated Node verification script testing all 1,000 levels, chapter boundaries, responsive path bounds (320px–768px), and level metadata.

## How to Apply Safely on a Working Branch
```bash
git checkout -b feat/magical-level-map
# Copy js/map.js, index.html, css/styles.css, js/ui.js, sw.js, and scripts/map-redesign-test.js into the repo
node scripts/map-redesign-test.js
git add js/map.js index.html css/styles.css js/ui.js sw.js scripts/map-redesign-test.js
git commit -m "feat(map): redesign 1000-level world map with 8 chapters and virtualized SVG path (SW v40)"
git push -u origin feat/magical-level-map
```
