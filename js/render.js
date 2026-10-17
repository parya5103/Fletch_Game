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
  var arrowStyle = 'classic';
  function setSkin(skin) { arrowStyle = skin.style || 'classic'; setPalette(skin.colors); }
  function setBoardSkin(id) {
    if (!Object.prototype.hasOwnProperty.call(GameCore.COSMETICS.boards, id)) id = 'default';
    if (canvas) canvas.setAttribute('data-board-skin', id);
  }
  function reducedMotion() {
    return Storage.getSave().settings.reducedMotion ||
      !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }

  function setPalette(colors) {
    if (colors && colors.length) {
      activePalette = colors.slice();
      invalidate();
    }
  }
  
  var canvas, ctx, view, needsRender, loopOn, lastT;
  var gameState = null;
  var camera = { zoom: 1, x: 0, y: 0 };
  var layer, layerCtx, layerKey = '', dpr = 1;
  var bounds = new WeakMap();

  function invalidate() { layerKey = ''; needsRender = true; ensureLoop(); }
  function clampCamera() {
    if (!view || !gameState) return;
    function axis(offset, viewport, board) {
      return board <= viewport ? (viewport - board) / 2 : Math.max(viewport - board, Math.min(0, offset));
    }
    camera.x = axis(camera.x, view.width, gameState.cols * view.cell * camera.zoom);
    camera.y = axis(camera.y, view.height, gameState.rows * view.cell * camera.zoom);
    const label = document.getElementById('board-view-label');
    if (label) label.textContent = view.cell * camera.zoom < 24
      ? 'Overview · tap to zoom' : 'Tap an arrow · drag to pan';
  }
  function zoomAt(zoom, x = view.width / 2, y = view.height / 2) {
    if (!view.cell) return;
    zoom = Math.max(1, Math.min(Math.max(1, 64 / view.cell), zoom));
    const factor = zoom / camera.zoom;
    camera.x = x - (x - camera.x) * factor;
    camera.y = y - (y - camera.y) * factor;
    camera.zoom = zoom;
    clampCamera(); invalidate();
  }
  function pan(dx, dy) {
    camera.x += dx; camera.y += dy;
    clampCamera(); invalidate();
  }
  function resetView() {
    camera = { zoom: 1, x: 0, y: 0 };
    clampCamera(); invalidate();
  }
  function screenToCell(x, y) {
    if (!view.cell || !Number.isFinite(x) || !Number.isFinite(y) ||
        x < 0 || y < 0 || x >= view.width || y >= view.height) return null;
    return { x: Math.floor((x - camera.x) / camera.zoom / view.cell),
      y: Math.floor((y - camera.y) / camera.zoom / view.cell) };
  }
  function focusPiece(i) {
    const a = gameState && gameState.arrows[i];
    if (!a || !view.cell) return;
    const h = a.cells[a.cells.length - 1];
    camera.zoom = Math.max(camera.zoom, 44 / view.cell);
    camera.x = view.width / 2 - (h.x + 0.5) * view.cell * camera.zoom;
    camera.y = view.height / 2 - (h.y + 0.5) * view.cell * camera.zoom;
    clampCamera(); invalidate();
  }
  function visible(a) {
    let b = bounds.get(a);
    if (!b) {
      b = { minX: Infinity, minY: Infinity, maxX: 0, maxY: 0 };
      for (const c of a.cells) {
        b.minX = Math.min(b.minX, c.x); b.minY = Math.min(b.minY, c.y);
        b.maxX = Math.max(b.maxX, c.x + 1); b.maxY = Math.max(b.maxY, c.y + 1);
      }
      bounds.set(a, b);
    }
    const cell = view.cell * camera.zoom;
    return b.maxX * cell + camera.x >= 0 && b.maxY * cell + camera.y >= 0 &&
      b.minX * cell + camera.x <= view.width && b.minY * cell + camera.y <= view.height;
  }
  function worldTransform() {
    ctx.setTransform(dpr * camera.zoom, 0, 0, dpr * camera.zoom, dpr * camera.x, dpr * camera.y);
  }

  function init(element) {
    canvas = element;
    ctx = canvas.getContext('2d');
    view = { side: 300, width: 300, height: 300, cell: 60 };
    needsRender = true;
    loopOn = false;
    lastT = 0;
  }

  function setGameState(state) {
    gameState = state;
    camera = { zoom: 1, x: 0, y: 0 };
    bounds = new WeakMap();
    layerKey = '';
  }

  function fitCanvas() {
    if (!gameState || !canvas) return;
    
    var wrap = document.getElementById('board-wrap');
    if (!wrap) return;
    
    var style = window.getComputedStyle ? window.getComputedStyle(wrap) : {};
    var w = Math.floor(wrap.clientWidth - (parseFloat(style.paddingLeft) || 0) - (parseFloat(style.paddingRight) || 0));
    var h = Math.floor(wrap.clientHeight - (parseFloat(style.paddingTop) || 0) - (parseFloat(style.paddingBottom) || 0));
    if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0 ||
        !Number.isInteger(gameState.cols) || gameState.cols <= 0 || !Number.isInteger(gameState.rows) || gameState.rows <= 0) {
      view.side = view.cell = 0;
      return;
    }
    // Preserve the world point at the viewport centre through address-bar
    // changes and rotation; a fitted view remains fitted. Uniform cells only.
    var oldCell = view.cell, oldZoom = camera.zoom;
    var cx = (view.width / 2 - camera.x) / (oldCell * oldZoom);
    var cy = (view.height / 2 - camera.y) / (oldCell * oldZoom);
    var ratio = window.devicePixelRatio;
    dpr = Number.isFinite(ratio) && ratio > 0 ? Math.min(ratio, 2) : 1;
    canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    view.width = w; view.height = h; view.side = Math.min(w, h);
    view.cell = Math.min(Math.max(1, w - 4) / gameState.cols, Math.max(1, h - 4) / gameState.rows);
    if (oldZoom > 1 && oldCell > 0) {
      camera.zoom = Math.max(1, Math.min(64 / view.cell, oldCell * oldZoom / view.cell));
      camera.x = w / 2 - cx * view.cell * camera.zoom;
      camera.y = h / 2 - cy * view.cell * camera.zoom;
    }
    // Exit tracks are stored in world pixels; keep them aligned if rotation
    // changes the cell size while an arrow is still leaving the board.
    if (oldCell > 0 && oldCell !== view.cell) {
      var factor = view.cell / oldCell;
      (gameState.flying || []).forEach(function(f) {
        f.pts.forEach(function(p) { p[0] *= factor; p[1] *= factor; });
        f.arc = f.arc.map(function(a) { return a * factor; });
        f.bodyLen *= factor; f.travel *= factor;
        if (f.dist !== undefined) f.dist *= factor;
      });
      (gameState.particles || []).forEach(function(p) {
        p.x *= factor; p.y *= factor; p.vx *= factor; p.vy *= factor; p.r *= factor;
      });
    }
    if (!layer) {
      layer = document.createElement('canvas');
      layerCtx = layer.getContext('2d');
    }
    layer.width = canvas.width; layer.height = canvas.height;
    layerKey = '';
    clampCamera();
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
    var lw = Math.max(0.45, cell * 0.11);

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
      var gp = reducedMotion() ? 0.5 : 0.5 + 0.5 * Math.sin(performance.now() / 220);
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

    paintShaft(color, lw, cell);
    var head = cells[cells.length - 1], dir = DIRS[P.dir];
    paintHead((head.x + .5 + dir[0] * .46) * cell,
      (head.y + .5 + dir[1] * .46) * cell, P.dir, cell, color, lw);

    // Hint halo: white pulse around the whole hinted arrow
    if (isHinted) {
      var hp = reducedMotion() ? 0.5 : 0.5 + 0.5 * Math.sin(performance.now() / 160);
      ctx.globalAlpha = alpha * (0.35 + 0.5 * hp);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = lw * (1.5 + 0.7 * hp);
      fullPath(P, cell);
      ctx.stroke();
    }

    ctx.restore();
  }

  // Decoration stays inside each owned corridor. No geometry or hitbox changes.
  // Static paths are cached; texture is omitted at overview scale.
  function paintShaft(color, lw, cell) {
    ctx.strokeStyle = arrowStyle === 'classic' ? shadeColor(color, -45) : '#050b18'; ctx.lineWidth = lw * (arrowStyle === 'classic' ? 1.5 : 2); ctx.stroke();
    ctx.strokeStyle = color; ctx.lineWidth = lw * (arrowStyle === 'classic' ? 1 : 1.45); ctx.stroke();
    ctx.strokeStyle = arrowStyle === 'neon' ? '#091126' : 'rgba(255,255,255,.5)';
    ctx.lineWidth = lw * (arrowStyle === 'neon' ? .65 : .28); ctx.stroke();
    if (arrowStyle !== 'classic' && cell * camera.zoom >= 16) {
      ctx.save();
      ctx.strokeStyle = arrowStyle === 'fire' ? '#fff2aa' : '#ffffff';
      ctx.lineWidth = lw * .5;
      if (arrowStyle === 'ice') ctx.setLineDash([cell * .08, cell * .27]);
      else if (arrowStyle === 'lightning') ctx.setLineDash([cell * .2, cell * .12]);
      else if (arrowStyle === 'gold') ctx.setLineDash([cell * .32, cell * .05]);
      else if (arrowStyle === 'fire') ctx.setLineDash([cell * .04, cell * .19]);
      else ctx.globalAlpha *= .3;
      ctx.stroke(); ctx.restore();
    }
  }

  function paintHead(x, y, dir, cell, color, lw) {
    ctx.save(); ctx.lineJoin = 'round';
    var d = DIRS[dir], px = -d[1], py = d[0];
    // Coordinates measured backwards from the tip, in cell units.
    var points = arrowStyle === 'ice' ? [[0,0],[.42,.23],[.36,0],[.42,-.23]] :
      arrowStyle === 'fire' ? [[0,0],[.39,.22],[.29,.07],[.43,0],[.29,-.07],[.39,-.22]] :
      arrowStyle === 'lightning' ? [[0,0],[.21,.22],[.21,.07],[.43,.13],[.31,-.04],[.36,-.20]] :
      [[0,0],[.36,.20],[.36,-.20]];
    ctx.beginPath();
    points.forEach(function(p, i) {
      var tx = x - d[0] * p[0] * cell + px * p[1] * cell;
      var ty = y - d[1] * p[0] * cell + py * p[1] * cell;
      if (i) ctx.lineTo(tx, ty); else ctx.moveTo(tx, ty);
    });
    ctx.closePath();
    ctx.fillStyle = arrowStyle === 'neon' ? '#091126' : color; ctx.fill();
    ctx.strokeStyle = arrowStyle === 'neon' ? color : shadeColor(color, -45);
    if (arrowStyle === 'classic') {
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x - d[0] * .36 * cell + px * .20 * cell, y - d[1] * .36 * cell + py * .20 * cell);
      ctx.moveTo(x, y);
      ctx.lineTo(x - d[0] * .36 * cell - px * .20 * cell, y - d[1] * .36 * cell - py * .20 * cell);
    }
    ctx.lineWidth = lw * (arrowStyle === 'classic' ? .9 : .8); ctx.stroke();
    if (arrowStyle === 'ice' || arrowStyle === 'gold' || arrowStyle === 'fire') {
      ctx.beginPath(); ctx.moveTo(x, y);
      ctx.lineTo(x - d[0] * .32 * cell + px * .12 * cell, y - d[1] * .32 * cell + py * .12 * cell);
      ctx.lineTo(x - d[0] * .31 * cell, y - d[1] * .31 * cell); ctx.closePath();
      ctx.fillStyle = 'rgba(255,255,255,.65)'; ctx.fill();
    }
    ctx.restore();
  }

  // Shop uses the production renderer; preview never mutates equipment/game state.
  function drawPreview(target, skin) {
    var previous = { ctx: ctx, palette: activePalette, style: arrowStyle };
    try {
      ctx = target.getContext('2d'); activePalette = skin.colors; arrowStyle = skin.style;
      ctx.clearRect(0, 0, target.width, target.height);
      ctx.save(); ctx.scale(target.width / 180, target.height / 96);
      drawPiece({ cells: [{x:0,y:2},{x:1,y:2},{x:1,y:1},{x:2,y:1},{x:3,y:1},{x:4,y:1}], dir:1, c:0 }, 32, 1, 1, false, false, 8, 0);
      ctx.restore();
    } finally { ctx = previous.ctx; activePalette = previous.palette; arrowStyle = previous.style; }
  }

  // Snake exit animation: the arrowhead leads along the piece's exit
  // direction while the whole winding body follows its own ordered path
  // like a snake. The visible body is the arc interval
  // [dist, bodyLen + dist] on the piece's original track (cell centers
  // tail->head, then the straight exit corridor), so every bend travels
  // out in sequence and the tail leaves along the exact original route.
  // Nothing is translated rigidly - the shape stays on its own track.
  function spawnFly(i, state, onDone) {
    if (!gameState || !gameState.arrows[i]) return false;
    if (!view || !(view.cell > 0)) return false; // canvas not laid out yet
    var A = gameState.arrows[i];
    var cells = A.cells;
    if (!cells || !cells.length) return false;
    var n = cells.length;
    var cell = view.cell;
    var d = A.dir | 0;
    if (!DIRS[d]) d = 0;
    var du = DIRS[d][0], dv = DIRS[d][1];
    // Pixel-space track: tail center ... head center, neck base, tip
    var pts = [];
    for (var k = 0; k < n; k++) {
      pts.push([(cells[k].x + 0.5) * cell, (cells[k].y + 0.5) * cell]);
    }
    var hx = pts[n - 1][0], hy = pts[n - 1][1];
    pts.push([hx + du * cell * 0.10, hy + dv * cell * 0.10]); // neck base
    pts.push([hx + du * cell * 0.46, hy + dv * cell * 0.46]); // tip at rest
    // Cumulative arc length along the track (tail = 0)
    var arc = [0];
    for (var q = 1; q < pts.length; q++) {
      var ddx = pts[q][0] - pts[q - 1][0], ddy = pts[q][1] - pts[q - 1][1];
      arc.push(arc[q - 1] + Math.sqrt(ddx * ddx + ddy * ddy));
    }
    var bodyLen = arc[arc.length - 1];
    // Distance from the resting tip to the canvas edge along the exit
    // corridor: the tail must travel bodyLen plus this to leave fully.
    var tip = pts[pts.length - 1];
    var toEdge = dv === -1 ? tip[1]
      : dv === 1 ? (gameState.rows * cell - tip[1])
      : du === -1 ? tip[0]
      : (gameState.cols * cell - tip[0]);
    if (!(toEdge >= 0)) toEdge = 0;
    // The golden bonus piece exits gold even if the bonus is claimed
    // (banner flips off) the moment the launch happens.
    var gold = !!(gameState.bonus && gameState.bonus.active && gameState.bonus.idx === i);
    gameState.flying.push({
      snake: true,
      cells: cells,
      dir: d,
      c: A.c,
      gold: gold,
      pts: pts,
      arc: arc,
      bodyLen: bodyLen,
      travel: bodyLen + toEdge + cell * 0.8,
      t0: performance.now(),
      dur: reducedMotion()
        ? 1 : Math.min(900, 260 + n * 42),
      onDone: onDone || null
    });
    return true;
  }

  // Point on an exit track at arc length a. Beyond the resting tip the
  // track continues straight along the exit direction (the corridor).
  function snakePos(P, a) {
    var arc = P.arc, pts = P.pts;
    if (a >= P.bodyLen) {
      var T = pts[pts.length - 1];
      var du = DIRS[P.dir][0], dv = DIRS[P.dir][1];
      return [T[0] + du * (a - P.bodyLen), T[1] + dv * (a - P.bodyLen)];
    }
    if (a <= 0) return [pts[0][0], pts[0][1]];
    for (var q = 1; q < arc.length; q++) {
      if (arc[q] >= a) {
        var t = (a - arc[q - 1]) / (arc[q] - arc[q - 1]);
        return [pts[q - 1][0] + (pts[q][0] - pts[q - 1][0]) * t,
                pts[q - 1][1] + (pts[q][1] - pts[q - 1][1]) * t];
      }
    }
    return [pts[pts.length - 1][0], pts[pts.length - 1][1]];
  }

  // Draw one snake-exiting arrow: the exact same outline / body / core
  // passes and arrowhead as a resting piece, but the body is clipped to
  // the part of its own track the snake still occupies. The head always
  // points along the exit direction; the tail follows the original
  // route, so bends leave the board in sequence.
  function drawSnakeExit(P, cell) {
    if (!P || P.dist === undefined) return;
    var startArc = P.dist;               // tail end on the track
    var endArc = P.bodyLen + P.dist;     // head tip on the track
    var baseArc = endArc - cell * 0.36;  // arrowhead base on the track
    if (!(baseArc > startArc)) return;
    var color = P.gold ? '#fbbf24' : activePalette[P.c % activePalette.length];
    var lw = Math.max(0.45, cell * 0.11);
    var du = DIRS[P.dir][0], dv = DIRS[P.dir][1];
    var px = -dv, py = du, hw = cell * 0.20;

    // Shaft polyline: tail cut point -> still-occupied track vertices
    // -> arrowhead base (every point stays on the original route)
    var shaft = [snakePos(P, startArc)];
    for (var k = 0; k < P.pts.length; k++) {
      if (P.arc[k] > startArc && P.arc[k] < baseArc) shaft.push(P.pts[k]);
    }
    var base = snakePos(P, baseArc);
    shaft.push(base);

    ctx.save();
    ctx.lineJoin = 'miter';
    ctx.miterLimit = 4;
    ctx.lineCap = 'round';

    ctx.beginPath();
    ctx.moveTo(shaft[0][0], shaft[0][1]);
    for (var q = 1; q < shaft.length; q++) ctx.lineTo(shaft[q][0], shaft[q][1]);

    // Golden bonus piece keeps its glow while it slides out
    if (P.gold) {
      ctx.save();
      ctx.globalAlpha = 0.45;
      ctx.strokeStyle = '#ffd166';
      ctx.lineWidth = lw * 3.2;
      ctx.stroke();
      ctx.restore();
    }

    paintShaft(color, lw, cell);
    var tip = snakePos(P, endArc);
    paintHead(tip[0], tip[1], P.dir, cell, color, lw);

    ctx.restore();
  }

  function spawnConfetti() {
    if (!gameState || !view.side || reducedMotion()) return;
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
    if (!gameState || !gameState.arrows[i] || reducedMotion()) return;
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

    // snake exits: the head leads along its exit direction while the
    // body follows the original winding path, bends leaving in sequence
    if (gameState) {
      for (var f = gameState.flying.length - 1; f >= 0; f--) {
        var fl = gameState.flying[f];
        var p = (now - fl.t0) / fl.dur;
        if (p >= 1) {
          gameState.flying.splice(f, 1);
          if (fl.onDone) {
            var cb = fl.onDone;
            fl.onDone = null;
            try { cb(); } catch (e0) { /* never break the render loop */ }
          }
          continue;
        }
        busy = true;
        // gentle ease-in: the snake accelerates as it clears the board
        var e = p * (0.65 + 0.35 * p);
        fl.dist = fl.travel * e;
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
    if (!gameState || !canvas || !layer || !view.cell) return;
    
    var cell = view.cell;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, view.width, view.height);
    worldTransform();
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

    // Static arrows are rasterized once per state/camera change into a
    // viewport-sized layer (bounded memory even at maximum zoom).
    var bonusIdx = (gameState.bonus && gameState.bonus.active) ? gameState.bonus.idx : -1;
    var dynamic = [];
    var key = '';
    for (var i = 0; i < gameState.arrows.length; i++) {
      var active = i === gameState.hintIdx || i === bonusIdx ||
        (gameState.pop[i] && now - gameState.pop[i] < 200) ||
        (gameState.shake[i] && now - gameState.shake[i] < 320);
      dynamic[i] = !!active;
      key += gameState.arrows[i].alive ? (active ? 'd' : 's') : '-';
    }
    if (layerKey !== key) {
      var displayCtx = ctx;
      ctx = layerCtx;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, layer.width, layer.height);
      worldTransform();
      for (var i = 0; i < gameState.arrows.length; i++) {
        var A = gameState.arrows[i];
        if (A.alive && !dynamic[i] && visible(A)) drawPiece(A, cell, 1, 1, false, false, 0, 0);
      }
      ctx = displayCtx;
      layerKey = key;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.drawImage(layer, 0, 0, view.width, view.height);
    worldTransform();
    for (var i = 0; i < gameState.arrows.length; i++) {
      var A = gameState.arrows[i];
      if (!A.alive || !dynamic[i] || !visible(A)) continue;
      var alpha = 1, scale = 1, ox = 0;
      if (gameState.pop[i] && now - gameState.pop[i] < 200) {
        var pp = (now - gameState.pop[i]) / 200;
        scale = 0.4 + 0.6 * pp; alpha = pp;
      }
      if (gameState.shake[i] && now - gameState.shake[i] < 320) {
        var sp = (now - gameState.shake[i]) / 320;
        ox = Math.sin((now - gameState.shake[i]) / 26) * cell * 0.07 * (1 - sp);
      }
      drawPiece(A, cell, alpha, scale, i === gameState.hintIdx, i === bonusIdx, ox, 0);
    }

    // snake exits (on top)
    for (var k = 0; k < gameState.flying.length; k++) {
      drawSnakeExit(gameState.flying[k], cell);
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
    zoomAt: zoomAt,
    pan: pan,
    resetView: resetView,
    screenToCell: screenToCell,
    focusPiece: focusPiece,
    getView: function() { return { ...camera, cell: view.cell, side: view.side, width: view.width, height: view.height }; },
    init: init,
    setGameState: setGameState,
    fitCanvas: fitCanvas,
    spawnFly: spawnFly,
    spawnBurst: spawnBurst,
    spawnConfetti: spawnConfetti,
    setPalette: setPalette,
    setSkin: setSkin,
    setBoardSkin: setBoardSkin,
    drawPreview: drawPreview,
    ensureLoop: ensureLoop,
    needsRender: function() { needsRender = true; },
    getCanvas: function() { return canvas; },
    getCellSize: function() { return view ? view.cell : 0; }
  };
})();
