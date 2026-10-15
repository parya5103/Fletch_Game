/**
 * Arrow Out! - Render Module
 * Handles all canvas rendering, animations, and visual effects
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

  // Thin outlined arrow: a closed polygon with a sharp pointed arrowhead
  // connected to a straight shaft. Drawn pointing up; drawTile rotates it
  // to the arrow's actual movement direction, so the glyph can never
  // disagree with the exit logic.
  function arrowPath(g, s) {
    g.beginPath();
    g.moveTo(0, -0.42 * s);            // tip of the arrowhead
    g.lineTo(0.30 * s, -0.10 * s);     // head base, right
    g.lineTo(0.12 * s, -0.10 * s);     // shaft top, right
    g.lineTo(0.12 * s, 0.42 * s);      // shaft bottom, right
    g.lineTo(-0.12 * s, 0.42 * s);     // shaft bottom, left
    g.lineTo(-0.12 * s, -0.10 * s);    // shaft top, left
    g.lineTo(-0.30 * s, -0.10 * s);    // head base, left
    g.closePath();
  }

  function drawTile(px, py, size, dir, color, alpha, scale, isHinted) {
    var s = size * 0.86;
    var lw = Math.max(2, size * 0.085);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(px + size / 2, py + size / 2);
    ctx.rotate((dir * 90 * Math.PI) / 180);
    if (scale !== 1) ctx.scale(scale, scale);

    // Crisp vector corners
    ctx.lineJoin = 'miter';
    ctx.miterLimit = 4;

    arrowPath(ctx, s);

    // Faint tinted fill so colorful arrow regions read across the board
    ctx.fillStyle = color;
    ctx.globalAlpha = alpha * 0.16;
    ctx.fill();

    // Dark outline pass keeps thin arrows legible on any background
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = shadeColor(color, -40);
    ctx.lineWidth = lw * 1.6;
    ctx.stroke();

    // Main colored stroke: the thin outlined arrow itself
    ctx.strokeStyle = color;
    ctx.lineWidth = lw;
    ctx.stroke();

    // Hint pulse: a white halo breathes around the hinted arrow
    if (isHinted) {
      var pulse = 0.5 + 0.5 * Math.sin(performance.now() / 160);
      ctx.globalAlpha = alpha * (0.35 + 0.55 * pulse);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = lw * (1.3 + 0.5 * pulse);
      ctx.stroke();
    }

    ctx.restore();
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

  function spawnFly(i, state) {
    if (!gameState || !gameState.arrows[i]) return;
    if (!view || !(view.cell > 0)) return; // canvas not laid out yet
    var A = gameState.arrows[i];
    var cell = view.cell;
    gameState.flying.push({
      x: A.x * cell, 
      y: A.y * cell, 
      dir: A.dir, 
      c: A.c,
      t0: performance.now(), 
      dur: window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 1 : 340,
      dist: view.side + cell * 2.5
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

  // Combo burst: small particle explosion at a launched arrow's cell
  function spawnBurst(i, state) {
    if (!gameState || !gameState.arrows[i]) return;
    if (!view || !(view.cell > 0)) return;
    var A = gameState.arrows[i];
    var cell = view.cell;
    var col = activePalette[A.c % activePalette.length];
    for (var k = 0; k < 7; k++) {
      var ang = (Math.PI * 2 * k) / 7 + Math.random() * 0.5;
      var sp = cell * (0.8 + Math.random() * 1.2);
      gameState.particles.push({
        x: (A.x + 0.5) * cell,
        y: (A.y + 0.5) * cell,
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

    // flying arrows
    if (gameState) {
      for (var f = gameState.flying.length - 1; f >= 0; f--) {
        var fl = gameState.flying[f];
        var p = (now - fl.t0) / fl.dur;
        if (p >= 1) { gameState.flying.splice(f, 1); continue; }
        busy = true;
        fl.px = fl.x + DIRS[fl.dir][0] * fl.dist * p * p;
        fl.py = fl.y + DIRS[fl.dir][1] * fl.dist * p * p;
        fl.alpha = p < 0.6 ? 1 : 1 - (p - 0.6) / 0.4;
      }

      // shakes
      for (var i = 0; i < gameState.shake.length; i++) {
        if (gameState.shake[i] && now - gameState.shake[i] < 320) busy = true;
      }
      if (gameState.hintIdx >= 0) busy = true;
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
    var cols = gameState.cols, rows = gameState.rows;

    // Draw background cells for the board shape
    var pad = Math.max(2, cell * 0.06);
    ctx.fillStyle = 'rgba(129, 140, 248, 0.12)';
    for (var s = 0; s < gameState.shape.length; s++) {
      if (!gameState.shape[s]) continue;
      var sx = (s % cols) * cell, sy = ((s / cols) | 0) * cell;
      roundRect(ctx, sx + pad, sy + pad, cell - 2 * pad, cell - 2 * pad, Math.max(4, cell * 0.16));
      ctx.fill();
    }

    // Draw arrows
    for (var i = 0; i < gameState.arrows.length; i++) {
      var A = gameState.arrows[i];
      if (!A.alive) continue;
      var px = A.x * cell, py = A.y * cell;
      var alpha = 1, scale = 1;

      // undo pop-in
      if (gameState.pop[i] && now - gameState.pop[i] < 200) {
        var pp = (now - gameState.pop[i]) / 200;
        scale = 0.4 + 0.6 * pp;
        alpha = pp;
      }
      // blocked shake
      if (gameState.shake[i] && now - gameState.shake[i] < 320) {
        var sp = (now - gameState.shake[i]) / 320;
        px += Math.sin((now - gameState.shake[i]) / 26) * cell * 0.07 * (1 - sp);
      }

      drawTile(px, py, cell, A.dir, activePalette[A.c % activePalette.length], alpha, scale, i === gameState.hintIdx);
    }

    // flying arrows (on top)
    for (var k = 0; k < gameState.flying.length; k++) {
      var fl = gameState.flying[k];
      if (fl.px === undefined) continue;
      drawTile(fl.px, fl.py, cell, fl.dir, activePalette[fl.c % activePalette.length], Math.max(0, fl.alpha), 1, false);
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
