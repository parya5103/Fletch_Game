#!/usr/bin/env node
/**
 * Arrow Out! - PWA icon generator (Node stdlib only, no dependencies).
 * Renders real PNG icons required for Chrome installability:
 *   icons/icon-192.png, icons/icon-512.png, icons/icon-maskable-512.png
 */
'use strict';
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const BG = [13, 18, 48];    // #0d1230
const FG = [116, 143, 252]; // #748ffc

// Arrow polygon in unit space, centered at (0,0), pointing up.
const ARROW = [
  [0, -1.05],
  [0.72, -0.05],
  [0.26, -0.05],
  [0.26, 0.95],
  [-0.26, 0.95],
  [-0.26, -0.05],
  [-0.72, -0.05]
];

function pointInPoly(x, y, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][0], yi = poly[i][1];
    const xj = poly[j][0], yj = poly[j][1];
    if (((yi > y) !== (yj > y)) &&
        (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) inside = !inside;
  }
  return inside;
}

// Distance to a rounded-rect boundary; negative values are inside.
function roundedRectSDF(x, y, half, r) {
  const qx = Math.abs(x) - (half - r);
  const qy = Math.abs(y) - (half - r);
  const ox = Math.max(qx, 0), oy = Math.max(qy, 0);
  return Math.min(Math.max(qx, qy), 0) + Math.hypot(ox, oy) - r;
}

function renderIcon(size, maskable) {
  const SS = 2; // 2x2 supersampling for antialiasing
  const half = size / 2;
  const bgR = maskable ? 0 : size * 0.22; // maskable needs a full square
  const a = size * (maskable ? 0.22 : 0.30); // keep art inside the maskable safe zone
  const poly = ARROW.map(function(p) { return [p[0] * a, p[1] * a]; });
  const rows = [];
  for (let py = 0; py < size; py++) {
    const row = Buffer.alloc(1 + size * 4); // filter byte 0 + RGBA scanline
    for (let px = 0; px < size; px++) {
      let fc = 0, bc = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const x = px + (sx + 0.5) / SS - half;
          const y = py + (sy + 0.5) / SS - half;
          if (pointInPoly(x, y, poly)) fc++;
          else if (roundedRectSDF(x, y, half, bgR) <= 0) bc++;
        }
      }
      const total = SS * SS;
      if (fc + bc === 0) {
        row[1 + px * 4 + 3] = 0; // fully transparent
      } else {
        const fa = fc / total, ba = bc / total, alpha = fa + ba;
        row[1 + px * 4]     = Math.round((FG[0] * fa + BG[0] * ba) / alpha);
        row[1 + px * 4 + 1] = Math.round((FG[1] * fa + BG[1] * ba) / alpha);
        row[1 + px * 4 + 2] = Math.round((FG[2] * fa + BG[2] * ba) / alpha);
        row[1 + px * 4 + 3] = Math.round(alpha * 255);
      }
    }
    rows.push(row);
  }
  return Buffer.concat(rows);
}

const CRC_TABLE = (function() {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const out = Buffer.alloc(8 + data.length + 4);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 'ascii');
  data.copy(out, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
  return out;
}

function writePNG(file, size, raw) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ]);
  fs.writeFileSync(file, png);
  const written = fs.readFileSync(file);
  if (written.length < 8 || written[0] !== 0x89 || written[1] !== 0x50 || written[2] !== 0x4e) {
    throw new Error('PNG magic verification failed for ' + file);
  }
  console.log('wrote ' + file + ' (' + png.length + ' bytes, ' + size + 'x' + size + ')');
}

const outDir = path.join(__dirname, '..', 'icons');
fs.mkdirSync(outDir, { recursive: true });

const targets = [
  ['icon-192.png', 192, false],
  ['icon-512.png', 512, false],
  ['icon-maskable-512.png', 512, true]
];

for (const t of targets) {
  writePNG(path.join(outDir, t[0]), t[1], renderIcon(t[1], t[2]));
}
