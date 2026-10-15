/**
 * Arrow Out! - Background Effects Module (Bgfx)
 * Atmospheric animated home-screen background: floating arrow glyphs,
 * drifting neon particles, a faint puzzle-grid and soft glows.
 * Canvas-based and lightweight; pauses when hidden and respects
 * prefers-reduced-motion (draws a single static frame instead).
 */
'use strict';

const Bgfx = (function() {
  var canvas = null;
  var ctx = null;
  var W = 0, H = 0;
  var arrows = [];
  var dots = [];
  var running = false;   // rAF loop is active
  var wanted = false;    // home screen wants the animation
  var raf = 0;
  var lastT = 0;
  var REDUCED = !!(window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  var COLORS = ['#38bdf8', '#818cf8', '#c084fc', '#2dd4bf'];

  function on(el, ev, fn) { if (el) el.addEventListener(ev, fn); }

  function rand(lo, hi) { return lo + Math.random() * (hi - lo); }

  function resize() {
    if (!canvas) return;
    W = Math.max(1, window.innerWidth || 320);
    H = Math.max(1, window.innerHeight || 480);
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    try {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    } catch (e) { /* older engines: canvas will scale via style */ }
  }

  function seedArrow() {
    return {
      x: rand(-40, W + 40),
      y: rand(-40, H + 40),
      vx: rand(-14, 14),          // px per second
      vy: rand(-10, 10),
      rot: rand(0, Math.PI * 2),
      vr: rand(-0.25, 0.25),      // radians per second
      size: rand(18, 44),
      alpha: rand(0.05, 0.16),
      color: COLORS[(Math.random() * COLORS.length) | 0]
    };
  }

  function seedDot() {
    return {
      x: rand(0, W),
      y: rand(0, H),
      vx: rand(-6, 6),
      vy: rand(-16, -4),          // gentle upward drift
      r: rand(1, 2.6),
      alpha: rand(0.08, 0.3),
      tw: rand(0.4, 1.6),         // twinkle speed
      phase: rand(0, Math.PI * 2),
      color: COLORS[(Math.random() * COLORS.length) | 0]
    };
  }

  function seed() {
    arrows = [];
    dots = [];
    var na = W < 380 ? 10 : 16;
    var nd = W < 380 ? 22 : 38;
    for (var a = 0; a < na; a++) arrows.push(seedArrow());
    for (var d = 0; d < nd; d++) dots.push(seedDot());
  }

  function arrowPath(g, s) {
    // A chunky upward arrow glyph centered on the origin
    g.beginPath();
    g.moveTo(0, -s);
    g.lineTo(s * 0.62, -s * 0.08);
    g.lineTo(s * 0.24, -s * 0.08);
    g.lineTo(s * 0.24, s * 0.85);
    g.lineTo(-s * 0.24, s * 0.85);
    g.lineTo(-s * 0.24, -s * 0.08);
    g.lineTo(-s * 0.62, -s * 0.08);
    g.closePath();
  }

  function drawGrid() {
    var step = 44;
    ctx.strokeStyle = 'rgba(129, 140, 248, 0.055)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (var x = step / 2; x < W; x += step) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, H);
    }
    for (var y = step / 2; y < H; y += step) {
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
    }
    ctx.stroke();
  }

  function drawFrame(dt, now) {
    ctx.clearRect(0, 0, W, H);
    drawGrid();

    // Floating arrows
    for (var i = 0; i < arrows.length; i++) {
      var A = arrows[i];
      if (dt > 0) {
        A.x += A.vx * dt;
        A.y += A.vy * dt;
        A.rot += A.vr * dt;
        // wrap around the edges so the field never empties
        var m = 60;
        if (A.x < -m) A.x = W + m; else if (A.x > W + m) A.x = -m;
        if (A.y < -m) A.y = H + m; else if (A.y > H + m) A.y = -m;
      }
      ctx.save();
      ctx.translate(A.x, A.y);
      ctx.rotate(A.rot);
      ctx.globalAlpha = A.alpha;
      ctx.fillStyle = A.color;
      arrowPath(ctx, A.size);
      ctx.fill();
      ctx.restore();
    }

    // Drifting particles
    for (var k = 0; k < dots.length; k++) {
      var P = dots[k];
      if (dt > 0) {
        P.x += P.vx * dt;
        P.y += P.vy * dt;
        if (P.y < -8) { P.y = H + 8; P.x = rand(0, W); }
        if (P.x < -8) P.x = W + 8; else if (P.x > W + 8) P.x = -8;
      }
      var twinkle = 0.55 + 0.45 * Math.sin(now * P.tw + P.phase);
      ctx.globalAlpha = P.alpha * twinkle;
      ctx.fillStyle = P.color;
      ctx.beginPath();
      ctx.arc(P.x, P.y, P.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function loop(now) {
    if (!running) return;
    var dt = Math.min(0.05, (now - lastT) / 1000) || 0.016;
    lastT = now;
    drawFrame(dt, now / 1000);
    raf = requestAnimationFrame(loop);
  }

  function start() {
    if (!canvas || !ctx) return;
    wanted = true;
    if (REDUCED) { drawFrame(0, 0); return; }  // single static frame
    if (running) return;
    running = true;
    lastT = performance.now();
    raf = requestAnimationFrame(loop);
  }

  function stop() {
    wanted = false;
    running = false;
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    if (ctx) ctx.clearRect(0, 0, W, H);
  }

  function onVisibility() {
    if (document.hidden) {
      if (running) { running = false; if (raf) cancelAnimationFrame(raf); raf = 0; }
    } else if (wanted && !REDUCED) {
      start();
    }
  }

  function init() {
    try {
      canvas = document.getElementById('bgfx');
      if (!canvas || !canvas.getContext) return false;
      ctx = canvas.getContext('2d');
      resize();
      seed();
      on(window, 'resize', resize);
      if (window.visualViewport) on(window.visualViewport, 'resize', resize);
      on(document, 'visibilitychange', onVisibility);
      return true;
    } catch (e) {
      canvas = null;
      return false;
    }
  }

  return {
    init: init,
    start: start,
    stop: stop,
    resize: resize
  };
})();
