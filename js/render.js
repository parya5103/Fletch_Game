/**
 * Arrow Out! - Render Module
 * Handles all canvas rendering, animations, and visual effects
 *
 * v3: every arrow is drawn as a LONG, THIN, WINDING, OUTLINED PATH -
 * a connected orthogonal corridor with crisp 90-degree corners and one
 * small arrowhead at the actual exit end (the direction the piece moves).
 */
'use strict';

const Render = (function() {
  // Active skin palette (starts as the classic GameCore palette).
  // Swapped at runtime by UI.setSkinPalette() when the player equips a skin.
  var activePalette = (GameCore.PALETTE || []).slice();
  const DIRS = GameCore.DIRS;

  function setPalette(colors) {
    if (colors && colors.length) {
      activePalette = colors.slice();
      needsRender = true;
      ensureLoop();
    }
  }
  
  var canvas, ctx, view, needsRender, loopOn, lastT;
  var gameState = null;

  function init(element) {
    canvas = element;
    ctx = canvas.getContext('2d');
    view = { side: 300, cell: 60 };
    needsRender = true;
    loopOn = false;
    lastT = 0;
  }

  function setGameState(state) {
    gameState = state;
  }

  function fitCanvas() {
    if (!gameState || !canvas) return;
    
    var wrap = document.getElementById('board-wrap');
    if (!wrap) return;
    
    var w = wrap.clientWidth, h = wrap.clientHeight;
    var side = Math.max(140, Math.floor(Math.min(w, h)));
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    
    canvas.style.width = side + 'px';
    canvas.style.height = side + 'px';
    canvas.width = Math.round(side * dpr);
    canvas.height = Math.round(side * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    
    view.side = side;
    view.cell = side / gameState.cols;
    needsRender = true;
    ensureLoop();
  }

  function roundRect(g, x, y, w, h, r) {
    if (g.roundRect) {
      g.beginPath();
      g.roundRect(x, y, w, h, r);
      return;
    }
    g.beginPath();
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r);
    g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r);
    g.arcTo(x, y, x + w, y, r);
    g.closePath();
  }

  // Helper to shade colors
  function shadeColor(color, percent) {
    var R = parseInt(color.substring(1,3), 16);
    var G = parseInt(color.substring(3,5), 16);
    var B = parseInt(color.substring(5,7), 16);
    
    R = parseInt(R * (100 + percent) / 100);
    G = parseInt(G * (100 + percent) / 100);
    B = parseInt(B * (100 + percent) / 100);
    
    R = (R<255)?R:255;
    G = (G<255)?G:255;
    B = (B<255)?B:255;
    
    R = Math.round(R);
    G = Math.round(G);
    B = Math.round(B);
    
    var RR = ((R.toString(16).length==1)?"0"+R.toString(16):R.toString(16));
    var GG = ((G.toString(16).length==1)?"0"+G.toString(16):G.toString(16));
    var BB = ((B.toString(16).length==1)?"0"+B.toString(16):B.toString(16));
    
    return "#"+RR+GG+BB;
  }

  // Build the shaft path: the winding polyline through the cell centers
  // (tail to head), extended to the arrowhead base so shaft and head form
  // one visually coherent arrow with no gap.
  function piecePath(P, cell) {
    var cells = P.cells;
    var n = cells.length;
    ctx.beginPath();
    ctx.moveTo((cells[0].x + 0.5) * cell, (cells[0].y + 0.5) * cell);
    for (var i = 1; i < n; i++) {
      ctx.lineTo((cells[i].x + 0.5) * cell, (cells[i].y + 0.5) * cell);
    }
    // neck: stroke runs exactly into the arrowhead base center so the
    // body reads connected with zero gap
    var hx = (cells[n - 1].x + 0.5) * cell, hy = (cells[n - 1].y + 0.5) * cell;
    var dxu = DIRS[P.dir][0], dyu = DIRS[P.dir][1];
    ctx.lineTo(hx + dxu * cell * 0.10, hy + dyu * cell * 0.10);
  }

  // Closed arrowhead triangle at the head cell pointing exactly in the
  // exit direction P.dir. The base sits exactly where the shaft neck
  // ends (0.10 * cell ahead of the head center), so the head joins the
  // shaft cleanly; the slim half-width matches the thin shaft.
  function headAppend(P, cell) {
    var cells = P.cells;
    var n = cells.length;
    var hx = (cells[n - 1].x + 0.5) * cell, hy = (cells[n - 1].y + 0.5) * cell;
    var dxu = DIRS[P.dir][0], dyu = DIRS[P.dir][1];
    var tipX = hx + dxu * cell * 0.46, tipY = hy + dyu * cell * 0.46;
    var bx = hx + dxu * cell * 0.10, by = hy + dyu * cell * 0.10;
    var px = -dyu, py = dxu; // perpendicular unit
    var hw = cell * 0.20;    // head half-width (slim, reads as one arrow)
    ctx.moveTo(tipX, tipY);
    ctx.lineTo(bx + px * hw, by + py * hw);
    ctx.lineTo(bx - px * hw, by - py * hw);
    ctx.closePath();
  }

  function headPath(P, cell) {
    ctx.beginPath();
    headAppend(P, cell);
  }

  // Only the two slanted head edges (open path, no base edge). Outlining
  // these instead of the full closed triangle avoids drawing a dark seam
  // across the shaft where head and neck join.
  function headSidesAppend(P, cell) {
    var cells = P.cells;
    var n = cells.length;
    var hx = (cells[n - 1].x + 0.5) * cell, hy = (cells[n - 1].y + 0.5) * cell;
    var dxu = DIRS[P.dir][0], dyu = DIRS[P.dir][1];
    var tipX = hx + dxu * cell * 0.46, tipY = hy + dyu * cell * 0.46;
    var bx = hx + dxu * cell * 0.10, by = hy + dyu * cell * 0.10;
    var px = -dyu, py = dxu;
    var hw = cell * 0.20;
    ctx.moveTo(tipX, tipY);
    ctx.lineTo(bx + px * hw, by + py * hw);
    ctx.moveTo(tipX, tipY);
    ctx.lineTo(bx - px * hw, by - py * hw);
  }

  // Shaft + head together (for glow / halo passes).
  function fullPath(P, cell) {
    piecePath(P, cell);
    headAppend(P, cell);
  }

  // Draw one winding arrow piece. Thin colored outline with a light
  // interior core; a subtle dark outline keeps pieces legible against
  // any background and against each other. isSpecial repaints the whole
  // arrow in gold (body + head + breathing glow).
  function drawPiece(P, cell, alpha, scale, isHinted, isSpecial, ox, oy) {
    if (!P || !P.cells || !P.cells.length) return;
    var cells = P.cells;
    var color = activePalette[P.c % activePalette.length];
    // Bonus piece: solid gold body and head so it reads as THE golden
    // arrow from the first frame of the countdown - clearly distinct
    // from every normal palette color (the glow underneath reinforces it).
    if (isSpecial) color = '#fbbf24';
    // Thin responsive shaft: visible on phones, reads as a path not a pipe
    var lw = Math.max(2.5, cell * 0.11);

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(ox || 0, oy || 0);

    // Pop-in (undo) scales around the piece centroid
    if (scale !== 1) {
      var cx = 0, cy = 0;
      for (var i = 0; i < cells.length; i++) { cx += cells[i].x; cy += cells[i].y; }
      cx = (cx / cells.length + 0.5) * cell;
      cy = (cy / cells.length + 0.5) * cell;
      ctx.translate(cx, cy);
      ctx.scale(scale, scale);
      ctx.translate(-cx, -cy);
    }

    // Crisp 90-degree corners on the winding corridors
    ctx.lineJoin = 'miter';
    ctx.miterLimit = 4;
    ctx.lineCap = 'round';

    piecePath(P, cell);

    // Special piece: breathing golden glow under the whole arrow
    if (isSpecial) {
      var gp = 0.5 + 0.5 * Math.sin(performance.now() / 220);
      ctx.save();
      ctx.globalAlpha = alpha * (0.30 + 0.30 * gp);
      ctx.strokeStyle = '#ffd166';
      ctx.lineWidth = lw * (2.6 + 1.4 * gp);
      ctx.stroke();
      headPath(P, cell);
      ctx.stroke();
      ctx.restore();
      piecePath(P, cell);
    }

    // Subtle dark outline pass: keeps thin arrows readable, stays slim
    ctx.strokeStyle = shadeColor(color, -45);
    ctx.lineWidth = lw * 1.5;
    ctx.stroke();

    // Thin colored body
    ctx.strokeStyle = color;
    ctx.lineWidth = lw;
    ctx.stroke();

    // Light interior core: outlined-path look, delicate white line
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.lineWidth = Math.max(1, lw * 0.28);
    ctx.stroke();

    // Arrowhead: solid filled triangle in the path color. Only the two
    // slanted edges get the dark outline, so the head joins the shaft
    // with no seam, gap or doubled edge, and the tip points exactly in
    // P.dir.
    headPath(P, cell);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.beginPath();
    headSidesAppend(P, cell);
    ctx.strokeStyle = shadeColor(color, -45);
    ctx.lineWidth = Math.max(1.5, lw * 0.9);
    ctx.stroke();

    // Hint halo: white pulse around the whole hinted arrow
    if (isHinted) {
      var hp = 0.5 + 0.5 * Math.sin(performance.now() / 160);
      ctx.globalAlpha = alpha * (0.35 + 0.5 * hp);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = lw * (1.5 + 0.7 * hp);
      fullPath(P, cell);
      ctx.stroke();
    }

    ctx.restore();
  }

  function spawnFly(i, state) {
    if (!gameState || !gameState.arrows[i]) return;
    if (!view || !(view.cell > 0)) return; // canvas not laid out yet
    var A = gameState.arrows[i];
    gameState.flying.push({
      cells: A.cells,
      dir: A.dir,
      c: A.c,
      t0: performance.now(),
      dur: window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 1 : 360,
      dist: view.side + view.cell * 3
    });
  }

  function spawnConfetti() {
    if (!gameState || !view.side) return;
    var side = view.side;
    for (var k = 0; k < 30; k++) {
      var ang = (Math.PI * 2 * k) / 30 + Math.random() * 0.6;
      var sp = side * (0.25 + Math.random() * 0.6);
      gameState.particles.push({
        x: side / 2, 
        y: side / 2,
        vx: Math.cos(ang) * sp, 
        vy: Math.sin(ang) * sp,
        t: 0, 
        life: 0.9 + Math.random() * 0.4,
        c: activePalette[(Math.random() * activePalette.length) | 0],
        r: view.cell * (0.06 + Math.random() * 0.08)
      });
    }
  }

  // Combo burst: small particle explosion at a launched piece's centroid
  function spawnBurst(i, state) {
    if (!gameState || !gameState.arrows[i]) return;
    if (!view || !(view.cell > 0)) return;
    var A = gameState.arrows[i];
    var cell = view.cell;
    var col = activePalette[A.c % activePalette.length];
    var cx = 0, cy = 0;
    for (var q = 0; q < A.cells.length; q++) { cx += A.cells[q].x; cy += A.cells[q].y; }
    cx = (cx / A.cells.length + 0.5) * cell;
    cy = (cy / A.cells.length + 0.5) * cell;
    for (var k = 0; k < 7; k++) {
      var ang = (Math.PI * 2 * k) / 7 + Math.random() * 0.5;
      var sp = cell * (0.8 + Math.random() * 1.2);
      gameState.particles.push({
        x: cx,
        y: cy,
        vx: Math.cos(ang) * sp, 
        vy: Math.sin(ang) * sp,
        t: 0, 
        life: 0.35 + Math.random() * 0.25,
        c: col,
        r: cell * (0.05 + Math.random() * 0.06)
      });
    }
  }

  function tick(dt) {
    if (!gameState) return;
    for (var i = gameState.particles.length - 1; i >= 0; i--) {
      var p = gameState.particles[i];
      p.t += dt;
      p.x += p.vx * dt; 
      p.y += p.vy * dt;
      if (p.t >= p.life) gameState.particles.splice(i, 1);
    }
  }

  function frame(now) {
    loopOn = false;
    var dt = Math.min(0.05, (now - lastT) / 1000 || 0.016);
    lastT = now;
    var busy = false;

    tick(dt);

    // flying pieces
    if (gameState) {
      for (var f = gameState.flying.length - 1; f >= 0; f--) {
        var fl = gameState.flying[f];
        var p = (now - fl.t0) / fl.dur;
        if (p >= 1) { gameState.flying.splice(f, 1); continue; }
        busy = true;
        fl.px = DIRS[fl.dir][0] * fl.dist * p * p;
        fl.py = DIRS[fl.dir][1] * fl.dist * p * p;
        fl.alpha = p < 0.6 ? 1 : 1 - (p - 0.6) / 0.4;
      }

      // shakes
      for (var i = 0; i < gameState.shake.length; i++) {
        if (gameState.shake[i] && now - gameState.shake[i] < 320) busy = true;
      }
      if (gameState.hintIdx >= 0) busy = true;
      if (gameState.bonus && gameState.bonus.active) busy = true;
      if (gameState.particles.length) busy = true;
      for (var q = 0; q < gameState.pop.length; q++) {
        if (gameState.pop[q] && now - gameState.pop[q] < 200) busy = true;
      }
    }

    render(now);
    needsRender = false;
    if (busy || needsRender) ensureLoop();
  }

  function ensureLoop() {
    if (!loopOn) {
      loopOn = true;
      lastT = performance.now();
      requestAnimationFrame(frame);
    }
  }

  function render(now) {
    if (!gameState || !canvas) return;
    
    var side = view.side, cell = view.cell;
    ctx.clearRect(0, 0, side, side);
    var cols = gameState.cols;

    // Board backdrop: ONE clean, subtle rounded panel behind the puzzle
    // silhouette - no per-cell tiles. The quiet background lets the thin
    // winding paths carry the board's visual identity.
    var pad = Math.max(1, cell * 0.03);
    var minX = cols, minY = gameState.rows, maxX = -1, maxY = -1;
    for (var s = 0; s < gameState.shape.length; s++) {
      if (!gameState.shape[s]) continue;
      var gx = s % cols, gy = (s / cols) | 0;
      if (gx < minX) minX = gx;
      if (gx > maxX) maxX = gx;
      if (gy < minY) minY = gy;
      if (gy > maxY) maxY = gy;
    }
    if (maxX >= 0) {
      ctx.fillStyle = 'rgba(129, 140, 248, 0.07)';
      roundRect(ctx, minX * cell + pad, minY * cell + pad,
        (maxX - minX + 1) * cell - 2 * pad, (maxY - minY + 1) * cell - 2 * pad,
        Math.max(6, cell * 0.28));
      ctx.fill();
    }

    // Draw the winding arrow pieces
    var bonusIdx = (gameState.bonus && gameState.bonus.active) ? gameState.bonus.idx : -1;
    for (var i = 0; i < gameState.arrows.length; i++) {
      var A = gameState.arrows[i];
      if (!A.alive) continue;
      var alpha = 1, scale = 1, ox = 0, oy = 0;

      // undo pop-in
      if (gameState.pop[i] && now - gameState.pop[i] < 200) {
        var pp = (now - gameState.pop[i]) / 200;
        scale = 0.4 + 0.6 * pp;
        alpha = pp;
      }
      // blocked shake
      if (gameState.shake[i] && now - gameState.shake[i] < 320) {
        var sp = (now - gameState.shake[i]) / 320;
        ox = Math.sin((now - gameState.shake[i]) / 26) * cell * 0.07 * (1 - sp);
      }

      drawPiece(A, cell, alpha, scale, i === gameState.hintIdx, i === bonusIdx, ox, oy);
    }

    // flying pieces (on top)
    for (var k = 0; k < gameState.flying.length; k++) {
      var fl = gameState.flying[k];
      if (fl.px === undefined) continue;
      drawPiece(fl, cell, Math.max(0, fl.alpha), 1, false, false, fl.px, fl.py);
    }

    // confetti
    for (var c = 0; c < gameState.particles.length; c++) {
      var P = gameState.particles[c];
      var kk = 1 - P.t / P.life;
      ctx.globalAlpha = kk;
      ctx.fillStyle = P.c;
      ctx.beginPath();
      ctx.arc(P.x, P.y, P.r * kk, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  return {
    init: init,
    setGameState: setGameState,
    fitCanvas: fitCanvas,
    spawnFly: spawnFly,
    spawnBurst: spawnBurst,
    spawnConfetti: spawnConfetti,
    setPalette: setPalette,
    ensureLoop: ensureLoop,
    needsRender: function() { needsRender = true; },
    getCanvas: function() { return canvas; },
    getCellSize: function() { return view ? view.cell : 0; }
  };
})();
