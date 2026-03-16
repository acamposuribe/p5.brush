// ── Seeded PRNG (sfc32) ──────────────────────────────────────────────
function sfc32(a, b, c, d) {
  return function () {
    a |= 0; b |= 0; c |= 0; d |= 0;
    const t = (((a + b) | 0) + d) | 0;
    d = (d + 1) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = ((c << 21) | (c >>> 11)) + t | 0;
    return (t >>> 0) / 4294967296;
  };
}

function makeRng(seed) {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  const s = () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return h >>> 0;
  };
  return sfc32(s(), s(), s(), s());
}

// ── Simplex 2D noise ─────────────────────────────────────────────────
const F2 = 0.5 * (Math.sqrt(3) - 1);
const G2 = (3 - Math.sqrt(3)) / 6;
const grad2 = [[1,1],[-1,1],[1,-1],[-1,-1],[1,0],[-1,0],[0,1],[0,-1]];

function createNoise2D(random) {
  const perm = new Uint8Array(512);
  const p = new Uint8Array(256);
  for (let i = 0; i < 256; i++) p[i] = i;
  for (let i = 255; i > 0; i--) {
    const j = (random() * (i + 1)) | 0;
    [p[i], p[j]] = [p[j], p[i]];
  }
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];

  return function noise2D(x, y) {
    const s = (x + y) * F2;
    const i = Math.floor(x + s);
    const j = Math.floor(y + s);
    const t = (i + j) * G2;
    const x0 = x - (i - t);
    const y0 = y - (j - t);
    const i1 = x0 > y0 ? 1 : 0;
    const j1 = x0 > y0 ? 0 : 1;
    const x1 = x0 - i1 + G2;
    const y1 = y0 - j1 + G2;
    const x2 = x0 - 1 + 2 * G2;
    const y2 = y0 - 1 + 2 * G2;
    const ii = i & 255;
    const jj = j & 255;
    let n0 = 0, n1 = 0, n2 = 0;
    let t0 = 0.5 - x0 * x0 - y0 * y0;
    if (t0 >= 0) {
      const g = grad2[perm[ii + perm[jj]] % 8];
      t0 *= t0;
      n0 = t0 * t0 * (g[0] * x0 + g[1] * y0);
    }
    let t1 = 0.5 - x1 * x1 - y1 * y1;
    if (t1 >= 0) {
      const g = grad2[perm[ii + i1 + perm[jj + j1]] % 8];
      t1 *= t1;
      n1 = t1 * t1 * (g[0] * x1 + g[1] * y1);
    }
    let t2 = 0.5 - x2 * x2 - y2 * y2;
    if (t2 >= 0) {
      const g = grad2[perm[ii + 1 + perm[jj + 1]] % 8];
      t2 *= t2;
      n2 = t2 * t2 * (g[0] * x2 + g[1] * y2);
    }
    return 70 * (n0 + n1 + n2);
  };
}

// ── Curl noise from 2D simplex ───────────────────────────────────────
function createCurl2D(noise) {
  return function curl2D(x, y, eps) {
    eps = eps || 1;
    const dndx = (noise(x + eps, y) - noise(x - eps, y)) / (2 * eps);
    const dndy = (noise(x, y + eps) - noise(x, y - eps)) / (2 * eps);
    return [-dndy, dndx];
  };
}

// ── Poisson disk sampling ────────────────────────────────────────────
function poissonDisk(width, height, radius, rng) {
  const cellSize = radius / Math.SQRT2;
  const cols = Math.ceil(width / cellSize);
  const rows = Math.ceil(height / cellSize);
  const grid = new Int32Array(cols * rows).fill(-1);
  const points = [];
  const active = [];
  const k = 30;

  function gridIndex(x, y) {
    return ((x / cellSize) | 0) + ((y / cellSize) | 0) * cols;
  }

  function addPoint(x, y) {
    const idx = points.length;
    points.push([x, y]);
    active.push(idx);
    grid[gridIndex(x, y)] = idx;
  }

  function tooClose(x, y) {
    const col = (x / cellSize) | 0;
    const row = (y / cellSize) | 0;
    for (let dr = -2; dr <= 2; dr++) {
      for (let dc = -2; dc <= 2; dc++) {
        const c = col + dc;
        const r = row + dr;
        if (c < 0 || r < 0 || c >= cols || r >= rows) continue;
        const gi = grid[c + r * cols];
        if (gi === -1) continue;
        const dx = x - points[gi][0];
        const dy = y - points[gi][1];
        if (dx * dx + dy * dy < radius * radius) return true;
      }
    }
    return false;
  }

  addPoint(rng() * width, rng() * height);

  while (active.length > 0) {
    const ri = (rng() * active.length) | 0;
    const pt = points[active[ri]];
    let found = false;
    for (let attempt = 0; attempt < k; attempt++) {
      const angle = rng() * Math.PI * 2;
      const dist = radius + rng() * radius;
      const nx = pt[0] + Math.cos(angle) * dist;
      const ny = pt[1] + Math.sin(angle) * dist;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      if (tooClose(nx, ny)) continue;
      addPoint(nx, ny);
      found = true;
      break;
    }
    if (!found) {
      active[ri] = active[active.length - 1];
      active.pop();
    }
  }
  return points;
}

// ── Point-in-polygon (ray cast) ──────────────────────────────────────
function pointInPolygon(px, py, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][0], yi = poly[i][1];
    const xj = poly[j][0], yj = poly[j][1];
    if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

// ── Generate ellipse polygon ─────────────────────────────────────────
function ellipsePoly(cx, cy, rx, ry, rotation, steps) {
  const pts = [];
  for (let i = 0; i < steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    const lx = Math.cos(a) * rx;
    const ly = Math.sin(a) * ry;
    pts.push([
      cx + lx * Math.cos(rotation) - ly * Math.sin(rotation),
      cy + lx * Math.sin(rotation) + ly * Math.cos(rotation),
    ]);
  }
  return pts;
}

// ── Bounding box for any polygon ─────────────────────────────────────
function polyBounds(poly) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of poly) {
    if (p[0] < minX) minX = p[0];
    if (p[1] < minY) minY = p[1];
    if (p[0] > maxX) maxX = p[0];
    if (p[1] > maxY) maxY = p[1];
  }
  return { minX, minY, maxX, maxY, w: maxX - minX, h: maxY - minY };
}

// ── Utility ──────────────────────────────────────────────────────────
function lerp(a, b, t) { return a + (b - a) * t; }
function map(v, inMin, inMax, outMin, outMax) {
  return outMin + ((v - inMin) / (inMax - inMin)) * (outMax - outMin);
}
function clamp(v, lo, hi) { return Math.min(Math.max(v, lo), hi); }

// =====================================================================
//  hatchShape — fill any polygon with hand-drawn hatching strokes
// =====================================================================
//
//  ctx:  CanvasRenderingContext2D
//  poly: Array of [x, y] — closed polygon vertices
//  opts: {
//    rand,            — seeded PRNG  () => 0..1
//    noise,           — simplex 2D   (x,y) => -1..1
//    curl,            — curl 2D      (x,y,eps) => [dx,dy]
//    canvasW,         — full canvas width  (for coordinate normalization)
//    canvasH,         — full canvas height
//    color,           — stroke color string
//    tangentMode,     — "h" | "v" | "n" | "c"
//    spacing,         — Poisson disk radius (smaller = denser)
//    opacityRange,    — [min, max]  per-stroke alpha
//    strokeWidthScl,  — multiplier for stroke width
//    hatchSpacing,    — vertical-line pass spacing (px)
//    hatchOpacity,    — vertical-line pass alpha
//    contourOpacity,  — outline alpha  (0 to skip)
//    margin,          — px inset from canvas edges
//  }
//
function hatchShape(ctx, poly, opts) {
  const {
    rand, noise, curl,
    canvasW: CW, canvasH: CH,
    color      = "#000000",
    tangentMode = "c",
    spacing    = CW * 0.008,
    opacityRange = [0.12, 0.24],
    strokeWidthScl = 1,
    hatchSpacing = 5,
    hatchOpacity = 0.012,
    contourOpacity = 0.06,
    margin = 2,
  } = opts;

  const bb = polyBounds(poly);
  const diag = Math.sqrt(bb.w * bb.w + bb.h * bb.h);
  const noiseScl = 0.7;
  const curlScl = 0.7;

  // ── Seed stroke origins via Poisson disk ───────────────────────────
  const rawSeeds = poissonDisk(bb.w, bb.h, spacing, rand);
  const seeds = [];
  for (const pt of rawSeeds) {
    const wx = pt[0] + bb.minX;
    const wy = pt[1] + bb.minY;
    if (pointInPolygon(wx, wy, poly)) seeds.push([wx, wy]);
  }

  // ── Per-seed: main stroke + crayon sub-strokes ─────────────────────
  ctx.lineJoin = "round";
  ctx.lineCap = "round";

  for (const [sx, sy] of seeds) {
    const nx = sx / CW;
    const ny = sy / CH;

    // ── Tangent direction ────────────────────────────────────────────
    let tx, ty;
    if (tangentMode === "h") {
      tx = 1; ty = (rand() - 0.5) * 0.15;
    } else if (tangentMode === "v") {
      tx = (rand() - 0.5) * 0.15; ty = 1;
    } else if (tangentMode === "n") {
      tx = noise(nx * noiseScl + 10, ny * noiseScl + 10) * Math.PI * 2;
      ty = noise(nx * noiseScl + 50, ny * noiseScl + 50) * Math.PI * 2;
    } else {
      const c = curl(nx * curlScl, ny * curlScl, 0.01);
      const q = 180;
      tx = Math.sign(c[0]) * (Math.floor(Math.abs(c[0]) * q) / q);
      ty = Math.sign(c[1]) * (Math.floor(Math.abs(c[1]) * q) / q);
    }

    const tLen = Math.sqrt(tx * tx + ty * ty) || 1;
    tx /= tLen; ty /= tLen;
    const pnx = -ty, pny = tx;

    const tScl = map(noise(nx * 1.3, ny * 1.3), -1, 1, diag * 0.02, diag * 0.18);
    const opacity = lerp(opacityRange[0], opacityRange[1], rand());
    const strokeWidth = CW * 0.0001 * lerp(1, 2.3, rand()) * strokeWidthScl;
    const blendMode = rand() < 0.15 ? "multiply" : "source-over";

    // ── Main body stroke ─────────────────────────────────────────────
    ctx.save();
    ctx.globalAlpha = opacity;
    ctx.globalCompositeOperation = blendMode;
    ctx.strokeStyle = color;
    ctx.lineWidth = strokeWidth;

    const mainSteps = 5 + (rand() * 10) | 0;
    const curvature = (rand() - 0.5) * tScl * 0.3;
    const microNoise = lerp(0.001, 0.003, rand()) * CH;

    ctx.beginPath();
    ctx.moveTo(sx, sy);
    for (let step = 1; step <= mainSteps; step++) {
      const frac = step / mainSteps;
      let px = sx + tx * tScl * frac;
      let py = sy + ty * tScl * frac;
      const bow = Math.sin(frac * Math.PI) * curvature;
      px += pnx * bow; py += pny * bow;
      const nf = 0.004;
      const h = (frac + rand()) % 1;
      px += pnx * noise(h + nx * nf, h + ny * nf) * microNoise;
      py += pny * noise(h + nx * nf + 50, h + ny * nf + 50) * microNoise;
      if (pointInPolygon(px, py, poly) && px > margin && px < CW - margin && py > margin && py < CH - margin) {
        ctx.lineTo(px, py);
      }
    }
    ctx.stroke();
    ctx.restore();

    // ── Crayon sub-strokes ───────────────────────────────────────────
    let repCount = clamp(map(noise(nx * 2, ny * 2), -1, 1, 1, 8) | 0, 1, 8);
    const baseArcRadius = tScl * map(Math.abs(noise(nx * 1.5 + 60, ny * 1.5 + 60)), 0, 1, 0.01, 0.05);

    for (let rep = 0; rep < repCount; rep++) {
      const offsetN = rep * strokeWidth * map(noise(nx * 0.7 + 1000 + rep, ny * 0.7 + 1000 + rep), -1, 1, 0.2, 1);
      const jitterX = lerp(-0.005, 0.005, rand()) * CW;
      const jitterY = lerp(-0.005, 0.005, rand()) * CH;
      const arcR = lerp(baseArcRadius * 0.5, baseArcRadius * 2, rand());
      const arcLen = tScl * map(noise(nx * 1.3 + 50, ny * 1.3 + 50), -1, 1, 0.1, 1);
      const arcStart = rand() * Math.PI;
      const arcEnd = lerp(arcStart, Math.PI, rand());
      const arcStep = lerp(0.05, 0.1, rand());
      const rotAngle = Math.atan2(ty, tx) + Math.PI / 2 + (rand() - 0.5) * 0.2;

      ctx.save();
      ctx.globalAlpha = opacity;
      ctx.globalCompositeOperation = blendMode;
      ctx.strokeStyle = color;
      ctx.lineWidth = strokeWidth;
      ctx.beginPath();

      let started = false;
      for (let a = arcStart; a <= arcEnd; a += arcStep) {
        let lx = Math.cos(a * Math.PI * 2) * arcR + pnx * a * 5;
        let ly = Math.sin(a * Math.PI * 2) * arcLen + pny * a * 5;
        const rx2 = lx * Math.cos(rotAngle) - ly * Math.sin(rotAngle);
        const ry2 = lx * Math.sin(rotAngle) + ly * Math.cos(rotAngle);
        let fx = rx2 + sx + pnx * offsetN * lerp(0.5, 1, rand()) + jitterX;
        let fy = ry2 + sy + pny * offsetN * lerp(0.5, 1, rand()) + jitterY;
        fx += noise(nx * 1000, ny * 1000) * CW * lerp(0.005, 0.008, rand());
        fy += noise(nx * 1000 + 500, ny * 1000 + 500) * CH * lerp(0.005, 0.008, rand());
        if (!pointInPolygon(fx, fy, poly)) continue;
        if (fx < margin || fx > CW - margin || fy < margin || fy > CH - margin) continue;
        if (!started) { ctx.moveTo(fx, fy); started = true; }
        else ctx.lineTo(fx, fy);
      }
      ctx.stroke();
      ctx.restore();
    }
  }

  // ── Vertical hatching pass ─────────────────────────────────────────
  if (false && hatchOpacity > 0) {
    ctx.save();
    ctx.globalAlpha = hatchOpacity;
    ctx.globalCompositeOperation = "multiply";
    ctx.strokeStyle = color;
    ctx.lineWidth = 0.5;
    ctx.lineCap = "round";

    for (let x = bb.minX; x <= bb.maxX; x += hatchSpacing) {
      const jx = x + (rand() - 0.5) * hatchSpacing * 0.1;
      const jy = (rand() - 0.5) * hatchSpacing * 0.1;
      const segments = [];
      let seg = [];

      for (let y = bb.minY; y <= bb.maxY; y += 1) {
        const py = y + jy;
        if (pointInPolygon(jx, py, poly) && jx > margin && jx < CW - margin && py > margin && py < CH - margin) {
          if (seg.length === 0 || Math.abs(py - seg[seg.length - 1]) <= 1.5) {
            seg.push(py);
          } else {
            if (seg.length > 1) segments.push(seg);
            seg = [py];
          }
        }
      }
      if (seg.length > 1) segments.push(seg);

      for (const s of segments) {
        ctx.beginPath();
        ctx.moveTo(jx, s[0]);
        for (let i = 1; i < s.length; i++) ctx.lineTo(jx, s[i]);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  // ── Contour stroke ─────────────────────────────────────────────────
  if (contourOpacity > 0) {
    ctx.save();
    ctx.globalAlpha = contourOpacity;
    ctx.globalCompositeOperation = "multiply";
    ctx.strokeStyle = "#111111";
    ctx.lineWidth = 0.3;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";

    ctx.beginPath();
    ctx.moveTo(poly[0][0], poly[0][1]);
    for (let i = 1; i < poly.length; i++) {
      ctx.lineTo(
        poly[i][0] + (rand() - 0.5) * CW * 0.001,
        poly[i][1] + (rand() - 0.5) * CH * 0.001
      );
    }
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
  }
}

// =====================================================================
//  DEMO — hatch a random ellipse
// =====================================================================
const seed = "etudes-" + Date.now();
const rand = makeRng(seed);
const noise = createNoise2D(rand);
const curl = createCurl2D(noise);

const W = 800;
const H = 1100;
const canvas = document.getElementById("canvas");
canvas.width = W;
canvas.height = H;
const ctx = canvas.getContext("2d");

// ── Background ───────────────────────────────────────────────────────
ctx.fillStyle = "#eae4cc";
ctx.fillRect(0, 0, W, H);

// ── Random ellipse ───────────────────────────────────────────────────
const cx = W * (0.3 + rand() * 0.4);
const cy = H * (0.3 + rand() * 0.4);
const rx = W * (0.15 + rand() * 0.15);
const ry = H * (0.12 + rand() * 0.12);
const rot = (rand() - 0.5) * Math.PI * 0.4;
const ellipse = ellipsePoly(cx, cy, rx, ry, rot, 120);

// ── Pick color + tangent mode ────────────────────────────────────────
const PALETTE = [
  "#D9E5EB","#557484","#2C697F","#034053","#000000",
  "#FECD1A","#F7AA42","#803717","#EF7F00","#EB6A27",
  "#D4011D","#C10121","#B5007C","#3E2A71","#003483",
  "#00579D","#0092D2","#028D7A","#009B5A","#368F2D",
  "#628B2A","#A4C401",
];
const color = PALETTE[(rand() * PALETTE.length) | 0];
const TANGENT_MODES = ["h", "v", "n", "c"];
const tangentMode = TANGENT_MODES[(rand() * TANGENT_MODES.length) | 0];
console.log("tangent mode:", tangentMode, "| color:", color);

// ── Hatch ellipse ────────────────────────────────────────────────────
hatchShape(ctx, ellipse, {
  rand, noise, curl,
  canvasW: W, canvasH: H,
  color,
  tangentMode,
});

// ── Random polygon ───────────────────────────────────────────────────
const polyN = 5 + (rand() * 4) | 0;  // 5–8 vertices
const polyCx = W * (0.25 + rand() * 0.5);
const polyCy = H * (0.25 + rand() * 0.5);
const polyR = W * (0.1 + rand() * 0.15);
const polyVerts = [];
for (let i = 0; i < polyN; i++) {
  const angle = (i / polyN) * Math.PI * 2 + (rand() - 0.5) * 0.6;
  const r = polyR * (0.6 + rand() * 0.8);
  polyVerts.push([polyCx + Math.cos(angle) * r, polyCy + Math.sin(angle) * r]);
}

const color2 = PALETTE[(rand() * PALETTE.length) | 0];
const tangentMode2 = TANGENT_MODES[(rand() * TANGENT_MODES.length) | 0];
console.log("polygon tangent mode:", tangentMode2, "| color:", color2);

hatchShape(ctx, polyVerts, {
  rand, noise, curl,
  canvasW: W, canvasH: H,
  color: color2,
  tangentMode: tangentMode2,
});

console.log("done");
