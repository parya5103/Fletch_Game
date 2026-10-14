/**
 * Arrow Out! - Render Module
 * Handles all canvas rendering, animations, and visual effects
 */
'use strict';

const Render = (function() {
  const PALETTE = GameCore.PALETTE;
  const DIRS = GameCore.DIRS;
  
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

  function arrowGlyph(g, a) {
    g.beginPath();
    g.moveTo(0, -1.05 * a);
    g.lineTo(0.72 * a, -0.05 * a);
    g.lineTo(0.26 * a, -0.05 * a);
    g.lineTo(0.26 * a, 0.95 * a);
    g.lineTo(-0.26 * a, 0.95 * a);
    g.lineTo(-0.26 * a, -0.05 * a);
    g.lineTo(-0.72 * a, -0.05 * a);
    g.closePath();
  }

  function drawTile(px, py, size, dir, color, alpha, scale, isHinted) {
    var pad = Math.max(2, size * 0.06);
    var s = size - 2 * pad;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(px + size / 2, py + size / 2);
    if (scale !== 1) ctx.scale(scale, scale);
    
    // Tile with premium styling
    ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
    ctx.shadowBlur = Math.max(3, size * 0.06);
    ctx.shadowOffsetY = Math.max(1, size * 0.03);
    
    // Gradient fill for premium look
    var gradient = ctx.createLinearGradient(-s/2, -s/2, s/2, s/2);
    gradient.addColorStop(0, color);
    gradient.addColorStop(1, shadeColor(color, -20));
    ctx.fillStyle = gradient;
    
    roundRect(ctx, -s / 2, -s / 2, s, s, Math.max(5, s * 0.22));
    ctx.fill();
    
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
    
    // Subtle top sheen
    ctx.globalAlpha = alpha * 0.25;
    ctx.fillStyle = '#ffffff';
    roundRect(ctx, -s / 2 + s * 0.08, -s / 2 + s * 0.07, s * 0.84, s * 0.28, s * 0.14);
    ctx.fill();
    
    // White arrow glyph with slight shadow
    ctx.globalAlpha = alpha;
    ctx.rotate((dir * 90 * Math.PI) / 180);
    
    // Arrow shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
    ctx.save();
    ctx.translate(0, 1);
    arrowGlyph(ctx, s * 0.30);
    ctx.fill();
    ctx.restore();
    
    // Arrow fill
    arrowGlyph(ctx, s * 0.30);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    
    // Hint pulse effect
    if (isHinted) {
      var pulse = 0.5 + 0.5 * Math.sin(performance.now() / 160);
      ctx.save();
      ctx.globalAlpha = 0.45 + 0.5 * pulse;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = Math.max(2, size * 0.05);
      roundRect(ctx, -s / 2, -s / 2, s, s, Math.max(4, s * 0.16));
      ctx.stroke();
      ctx.restore();
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
        c: PALETTE[(Math.random() * PALETTE.length) | 0],
        r: view.cell * (0.06 + Math.random() * 0.08)
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

      drawTile(px, py, cell, A.dir, PALETTE[A.c], alpha, scale, i === gameState.hintIdx);
    }

    // flying arrows (on top)
    for (var k = 0; k < gameState.flying.length; k++) {
      var fl = gameState.flying[k];
      if (fl.px === undefined) continue;
      drawTile(fl.px, fl.py, cell, fl.dir, PALETTE[fl.c], Math.max(0, fl.alpha), 1, false);
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
    spawnConfetti: spawnConfetti,
    ensureLoop: ensureLoop,
    needsRender: function() { needsRender = true; },
    getCanvas: function() { return canvas; },
    getCellSize: function() { return view ? view.cell : 0; }
  };
})();
