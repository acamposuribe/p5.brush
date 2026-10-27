// =============================================================================
// Module: Fill
// =============================================================================
/**
 * The Fill module contains functions and classes dedicated to handling
 * the fill properties of shapes within the drawing context. It supports complex fill
 * operations with effects such as bleeding to simulate watercolor-like textures. The
 * methods provided allow for setting the fill color with opacity, controlling the
 * intensity of the bleed effect, and enabling or disabling the fill operation.
 *
 * The watercolor effect implementation is inspired by Tyler Hobbs'
 * techniques for simulating watercolor paints.
 */

// Core imports
import { Cwidth, Cheight, Density, Renderer, getActiveFramebuffer } from "../core/target.js";
import {
  Mix,
  State,
} from "../core/color.js";
import {
  setFillTransform,
  queuePolygon,
  flushFill,
  blurFillMask,
  wetPaper,
  wetFill,
} from "./gl_fill.js";
import {
  constrain,
  rr,
  map,
  randInt,
  gaussian,
  rotate,
  cossin,
  toDegreesSigned,
  _onSeed,
} from "../core/utils.js";
import { isFieldReady } from "../core/flowfield.js";
import { createColor, getAffineMatrix } from "../core/runtime.js";
import { Polygon } from "../core/polygon.js";
import { Plot } from "../core/plot.js";
import { getPaper } from "../stroke/gl_draw.js";
import { pigmentTerms, splitPigment } from "../core/spectral.js";

// Internal module imports
import { initFillComposite } from "./composite.js";

initFillComposite(); // Register the fill composite with the core color module

// =============================================================================
// Fill State and helpers
// =============================================================================

// Hobbs' layer schedule, and the layers of it a fill draws.
const SCHEDULE = 20;
const LAYERS = 7;
const DRAWN = new Set(Array.from({ length: LAYERS }, (_, k) => Math.round((k * SCHEDULE) / LAYERS)));

// Vertex cap for grow() — set to 0 or false to disable
const GROW_MAX_VERTS = 2024;
let GROW_CAP;

// Reusable scratch arrays for grow() — avoids 4 allocations per call (~15× per fill)
let _growInsX = [];
let _growInsY = [];
let _growMods = [];
let _growDirs = [];

/**
 * Global fill state settings.
 */
State.fill = {
  opacity: 150,
  bleed_strength: 0.07,
  texture_strength: 0.8,
  border_strength: 0.5,
  direction: "out",
  angle: null,
  scatter: true,
  split: 0.15,
  isActive: false,
};

// Cache the current state
const FillState = () => ({ ...State.fill });
const FillSetState = (state) => {
  State.fill = { ...state };
};

// ---------------------------------------------------------------------------
// Fill Style Functions
// ---------------------------------------------------------------------------

/**
 * Sets the fill color and opacity for subsequent drawing operations.
 * @param {number|string|Color} a - Either the red component, a CSS color string, or a Color object.
 * @param {number} [b] - The green component or the opacity if using grayscale.
 * @param {number} [c] - The blue component.
 * @param {number} [d] - The opacity.
 */
export function fill(a, b, c, d) {
  State.fill.opacity = (arguments.length < 4 ? b : d) ?? 150;
  State.fill.color = arguments.length < 3 ? createColor(a) : createColor(a, b, c);
  State.fill.isActive = true;
}

/**
 * Sets the bleed (watercolor) intensity and direction.
 * @param {number} _i - The bleed intensity (clamped to [0,1]).
 * @param {string} [_direction="out"] - The bleeding direction.
 * @param {number|null} [_angle=null] - Optional wash direction angle in current angle mode.
 */
export function fillBleed(_i, _direction = "out", _angle = null) {
  State.fill.bleed_strength = constrain(_i, 0, 1);
  State.fill.direction = _direction;
  State.fill.angle = _angle == null ? null : toDegreesSigned(_angle);
}

/**
 * Sets the texture of the fill.
 * @param {number} [_texture=0.4] - Granulation and reticulation strength (clamped to [0,1]).
 * @param {number} [_border=0.4] - Strength of the dried rim at the edge (clamped to [0,1]).
 * @param {boolean} [_scatter=true] - Whether to draw the scattered sparse polygon layers.
 *   Set to false to disable the scatter effect, which can help when a clean
 *   gradient trim is needed without extra texture noise at the edges.
 * @param {number} [_split=0.15] - How far the paint separates into a warmer and a
 *   cooler pigment across a wash (clamped to [0,1]); 0 is a single pigment.
 */
export function fillTexture(_texture = 0.4, _border = 0.4, _scatter = true, _split = 0.15) {
  State.fill.texture_strength = constrain(_texture, 0, 1);
  State.fill.border_strength = constrain(_border, 0, 1);
  State.fill.scatter = _scatter;
  State.fill.split = constrain(_split, 0, 1);
}

/**
 * Disables fill for subsequent drawing operations.
 */
export function noFill() {
  State.fill.isActive = false;
}

// ---------------------------------------------------------------------------
// Fill Manager Functions
// ---------------------------------------------------------------------------

let _polygon;
let _bbMinX, _bbMinY, _bbMaxX, _bbMaxY;

// Pre-compute gaussians for reuse
const GAUSSIAN_POOL_SIZE = 512;
const _gaussians = [[], []]; // [a, b]
function _fillGaussianPools() {
  for (let i = 0; i < GAUSSIAN_POOL_SIZE; i++) {
    _gaussians[0][i] = gaussian(0.5, 0.2);
    _gaussians[1][i] = gaussian(0, 0.02);
  }
}
_onSeed(_fillGaussianPools);

function _fillStartIndex(pts, angle) {
  const cs = cossin(angle);
  const dx = cs[0], dy = -cs[1];
  let best = 0, bestDot = Infinity;
  for (let i = 0; i < pts.length; i++) {
    const dot = pts[i].x * dx + pts[i].y * dy;
    if (dot < bestDot) { bestDot = dot; best = i; }
  }
  return best;
}

/**
 * Calculates the centroid of a polygon from its vertices.
 * @param {Object[]} pts - Array of points with {x, y}.
 * @returns {Object} The center point {x, y}.
 */
function _center(pts) {
  const n = pts.length;
  if (n === 0) {
    return { x: 0, y: 0 };
  }

  if (n < 8) {
    // Simple average for small polygons
    let sumX = 0, sumY = 0;
    for (let i = 0; i < n; i++) { sumX += pts[i].x; sumY += pts[i].y; }
    return { x: sumX / n, y: sumY / n };
  }

  // Shoelace formula with implicit polygon closing (no array copy needed)
  let area = 0, cx = 0, cy = 0;
  for (let i = 0; i < n; i++) {
    const j = i + 1 < n ? i + 1 : 0; // wrap around for closing edge
    const xi = pts[i].x, yi = pts[i].y;
    const xj = pts[j].x, yj = pts[j].y;
    const cross = xi * yj - xj * yi;
    area += cross;
    cx += (xi + xj) * cross;
    cy += (yi + yj) * cross;
  }

  area *= 0.5;
  return area
    ? { x: cx / (6 * area), y: cy / (6 * area) }
    : { x: pts[0].x, y: pts[0].y };
}

/**
 * Fills a given polygon with a watercolor effect.
 * @param {Polygon} polygon - The polygon to fill.
 */
export function createFill(polygon) {
  if (!State.fill.isActive || !State.fill.color) {
    throw new Error(
      "No fill color set. Call brush.fill(color) before drawing shapes.",
    );
  }
  if (polygon.vertices.length < 3 || State.fill.opacity === 0) return;
  _polygon = polygon;
  _bbMinX = Infinity; _bbMinY = Infinity; _bbMaxX = -Infinity; _bbMaxY = -Infinity;
  for (const [a] of polygon.sides) {
    if (a.x < _bbMinX) _bbMinX = a.x;
    if (a.x > _bbMaxX) _bbMaxX = a.x;
    if (a.y < _bbMinY) _bbMinY = a.y;
    if (a.y > _bbMaxY) _bbMaxY = a.y;
  }
  const v = [...polygon.vertices];
  const _wr = rr(0, 75);
  const fluid = ~~(v.length * 0.25 * (_wr < 5 ? 1 : _wr < 15 ? 2 : 3));
  const strength = State.fill.bleed_strength;
  const modifiers = v.map(
    (_, i) => (i > fluid ? 1 : 0.3) * rr(0.85, 1.4) * strength,
  );
  const shift = State.fill.angle == null
    ? randInt(0, v.length)
    : _fillStartIndex(v, State.fill.angle);
  const n = v.length;
  const shifted = new Array(n);
  for (let i = 0; i < n; i++) shifted[i] = v[(i + shift) % n];
  const center = _center(shifted);
  return new FillPoly(shifted, modifiers, center, [], true).fill(
    State.fill.color,
    map(State.fill.opacity, 0, 255, 0, 1, true),
    State.fill.texture_strength,
  );
}

// ---------------------------------------------------------------------------
// FillPolygon Class
// ---------------------------------------------------------------------------

/**
 * The FillPolygon class is used to create and manage the properties of the polygons that produces
 * the watercolor effect. It includes methods to grow (expand) the polygon and apply layers
 * of color with varying intensity; the watercolour composite then paints them as a wash.
 * The implementation follows Tyler Hobbs' guide to simulating watercolor:
 * https://tylerxhobbs.com/essays/2017/a-generative-approach-to-simulating-watercolor-paints
 */
class FillPoly {
  /**
   * Constructs a FillPolygon.
   * @param {Object[]} _v - Vertices of the polygon.
   * @param {number[]} _m - Multipliers for the bleed effect at each vertex.
   * @param {Object} _center - The polygon's center {x, y}.
   * @param {boolean[]} dir - Array indicating bleed direction per vertex.
   * @param {boolean} isFirst - True for initial polygon.
   */
  constructor(v, m, center, dir = [], isFirst = false, sx, sy) {
    // Initialize properties
    this.v = v;
    this.m = m;
    this.dir = dir;
    this.midP = center;

    // Initialize size and direction for first polygon
    if (isFirst) {
      // Calculate size bounds
      let maxX = 0,
        maxY = 0;
      const rayCalc = [];

      for (let i = 0; i < v.length; i++) {
        // Store vertex distances to center for size calculation
        const dx = Math.abs(center.x - v[i].x);
        const dy = Math.abs(center.y - v[i].y);
        maxX = Math.max(maxX, dx);
        maxY = Math.max(maxY, dy);

        // Store edge info for ray calculations
        const v1 = v[i],
          v2 = v[(i + 1) % v.length];
        const side = { x: v2.x - v1.x, y: v2.y - v1.y };
        const rt = rotate(0, 0, side.x, side.y, 90);
        const mid = { x: v1.x + side.x / 2, y: v1.y + side.y / 2 };

        rayCalc.push({
          v1,
          v2,
          ray: {
            point1: mid,
            point2: { x: mid.x + rt.x, y: mid.y + rt.y },
          },
        });
      }

      // Store sizes
      this.sizeX = maxX;
      this.sizeY = maxY;

      // Calculate directions — inline ray-polygon intersection to avoid
      // O(n) overhead of Polygon.intersect() (cache-key string building,
      // object allocation, intersectLines wrapper) per edge.
      const polySides = _polygon.sides;
      this.dir = Array(v.length);
      for (let i = 0; i < rayCalc.length; i++) {
        const rc = rayCalc[i];
        const r1x = rc.ray.point1.x, r1y = rc.ray.point1.y;
        const r2x = rc.ray.point2.x, r2y = rc.ray.point2.y;
        const rdx = r2x - r1x, rdy = r2y - r1y;
        // Precompute _isLeft threshold: _isLeft(v1,v2,P) = ua*(-|edgeSide|²) > 0.01
        const eSx = rc.v2.x - rc.v1.x, eSy = rc.v2.y - rc.v1.y;
        const eNeg = -(eSx * eSx + eSy * eSy); // always < 0
        let count = 0;
        for (let j = 0; j < polySides.length; j++) {
          const sa = polySides[j][0], sb = polySides[j][1];
          const sdx = sb.x - sa.x, sdy = sb.y - sa.y;
          const denom = sdy * rdx - sdx * rdy;
          if (denom === 0) continue;
          const ub = (rdx * (r1y - sa.y) - rdy * (r1x - sa.x)) / denom;
          if (ub < 0 || ub > 1) continue;
          const ua = (sdx * (r1y - sa.y) - sdy * (r1x - sa.x)) / denom;
          if (ua * eNeg <= 0.01) continue; // exact _isLeft equivalent, no ix/iy needed
          count++;
        }
        this.dir[i] = count % 2 === 0;
      }

      // Randomize center (single calculation)
      const rx = rr(-0.6, 0.6) * maxX;
      const ry = rr(-0.6, 0.6) * maxY;
      this.midP = { x: center.x + rx, y: center.y + ry };
    } else {
      this.sizeX = sx;
      this.sizeY = sy;
    }
  }

  /**
   * Trims vertices from the polygon based on a factor.
   * @param {number} [factor=1] - Factor determining amount of trimming.
   * @returns {Object} An object containing trimmed vertices, multipliers, and direction.
   */
  trim(f = 1) {
    // Fast path for common case
    if (f >= 1 || f < 0 || this.v.length <= 8) {
      return { v: this.v, m: this.m, dir: this.dir };
    }

    const totalN = this.v.length;
    const nTrim = ~~((1 - f) * totalN);
    const s = ~~(totalN / 2 - nTrim / 2);

    // Resolve the bridge endpoints first so they're available for edge-length
    // and density calculations below.
    const trimStart = s, trimEnd = s + nTrim;
    const eStart = this.v[(trimStart - 1 + totalN) % totalN];
    const eEnd   = this.v[trimEnd % totalN];
    const evx = eEnd.x - eStart.x, evy = eEnd.y - eStart.y;
    const edgeLen = Math.hypot(evx, evy);

    // Estimate typical vertex spacing from one random kept vertex pair,
    // then insert at least 0.2× that density along the bridge.
    const sampleIdx = s >= 2 ? ~~rr(0, s - 1) : (trimEnd < totalN - 1 ? trimEnd : 0);
    const sa = this.v[sampleIdx], sb = this.v[(sampleIdx + 1) % totalN];
    const typicalSpacing = Math.max(1, Math.hypot(sb.x - sa.x, sb.y - sa.y));
    const nInsert = Math.max(2, Math.ceil(edgeLen / typicalSpacing * 0.05));
    const finalLen = totalN - nTrim + nInsert;

    // Pre-allocate with final size — avoids splice() and element shifting
    const v = new Array(finalLen);
    const m = new Array(finalLen);
    const dir = new Array(finalLen);
    let dst = 0;

    for (let i = 0; i < s; i++, dst++) {
      v[dst] = this.v[i]; m[dst] = this.m[i]; dir[dst] = this.dir[i];
    }

    // Insert nInsert vertices evenly spaced along the bridge edge, with a
    // small jitter so the cut never renders as a ruler-straight line. The
    // cut also bows, toward the centre only so it never pushes the edge
    // outward: its tone step reads as a wash boundary.
    const jitterAmt = edgeLen * 0.06;
    const inward = -evy * (this.midP.x - eStart.x) + evx * (this.midP.y - eStart.y);
    const bow = rr(0, 0.2) * Math.sign(inward);
    const dirBase = this.dir[trimStart % this.dir.length];
    for (let k = 0; k < nInsert; k++, dst++) {
      const t = (k + 1) / (nInsert + 1);
      const sag = bow * Math.sin(Math.PI * t);
      v[dst] = { x: eStart.x + evx * t - evy * sag + rr(-jitterAmt, jitterAmt),
                 y: eStart.y + evy * t + evx * sag + rr(-jitterAmt, jitterAmt) };
      m[dst] = rr(0.3, 0.5);
      dir[dst] = dirBase;
    }

    for (let i = trimEnd; i < totalN; i++, dst++) {
      v[dst] = this.v[i]; m[dst] = this.m[i]; dir[dst] = this.dir[i];
    }

    return { v, m, dir };
  }

  /**
   * Randomly samples a fraction of vertices, keeping their order.
   * Any sampled vertex outside the original polygon is pulled inward.
   * @param {number} [ratio=0.3] - Fraction of vertices to keep.
   * @returns {FillPoly} A new FillPoly with fewer vertices, guaranteed inside the original.
   */
  scatter(ratio = 0.3) {
    const L = this.v.length;
    const keep = Math.max(3, ~~(L * ratio));
    const step = L / keep;
    const stepRand = step * 0.8;

    const sv = [],
      sm = [],
      sd = [];
    const mid = this.midP;
    const sides = _polygon.sides;

    for (let i = 0; i < keep; i++) {
      const j = ~~(i * step + rr(0, stepRand)) % L;
      let p = this.v[j];
      let outside = false;
      // Bounding box reject — vertex outside AABB is definitely outside polygon
      if (p.x < _bbMinX || p.x > _bbMaxX || p.y < _bbMinY || p.y > _bbMaxY) {
        outside = true;
      } else {
        let crossings = 0;
        for (const [a, b] of sides) {
          const ay = a.y,
            by = b.y;
          if ((ay > p.y) === (by > p.y)) continue;
          const t = (p.y - ay) / (by - ay);
          if (p.x < a.x + t * (b.x - a.x)) crossings++;
        }
        outside = crossings % 2 === 0;
      }
      if (outside) {
        p = {
          x: mid.x + (p.x - mid.x) * rr(0.3, 0.6),
          y: mid.y + (p.y - mid.y) * rr(0.3, 0.6),
        };
      }
      sv.push(p);
      sm.push(this.m[j]);
      sd.push(!this.dir[j]);
    }

    return new FillPoly(sv, sm, this.midP, sd, false, this.sizeX, this.sizeY);
  }

  /**
   * Returns a copy with all bleed directions flipped.
   */
  flipDirs() {
    return new FillPoly(this.v, this.m, this.midP, this.dir.map(d => !d), false, this.sizeX, this.sizeY);
  }

  /**
   * Grows (or shrinks) the polygon vertices to simulate watercolor spread.
   * @param {number} [growthFactor=1] - Factor controlling growth.
   * @returns {FillPoly} A new FillPoly with adjusted vertices.
   */
  grow(f = 1) {
    const { v: tr_v, m: tr_m, dir: tr_dir } = this.trim(f);
    const len = tr_v.length;

    const outLen = len * 2;
    if (_growInsX.length < len) { _growInsX = new Array(len); _growInsY = new Array(len); }
    if (_growMods.length < outLen) { _growMods = new Array(outLen); _growDirs = new Array(outLen); }
    const insertedX = _growInsX;
    const insertedY = _growInsY;
    const newMods = _growMods;
    const newDirs = _growDirs;
    const bleedDirDeg = State.fill.direction === "out" ? -90 : 90;

    if (_gaussians[0].length === 0) _fillGaussianPools();
    const gPool = _gaussians[0],
      gPoolLen = gPool.length;
    const g2Pool = _gaussians[1],
      g2PoolLen = g2Pool.length;

    let idx = 0;
    let insertedIdx = 0;
    let mod = f === 999 ? rr(0.6, 0.8) : State.fill.bleed_strength;

    // Only step=2 keeps all original vertices while discarding every insertion.
    // Larger steps must also downsample originals, so use the general path.
    const preStep = GROW_CAP && len * 2 > GROW_CAP ? Math.ceil(len * 2 / GROW_CAP) : 1;
    const skipInserted = preStep === 2;

    if (skipInserted) {
      // Fast path: inserted vertices will be discarded by GROW_CAP step=2.
      // Result is exactly the trimmed polygon — skip all array writes.
      // Only consume RNG calls to maintain the sequence.
      for (let i = 0; i < len; i++) {
        const mi = tr_m[i];
        if (f < 997) mod = mi;
        if (mod >= 0.05) {
          rr(-1, 1);
          gPool[~~(rr(0, 1) * gPoolLen)]; rr(0.65, 1.35);
          g2Pool[~~(rr(0, 1) * g2PoolLen)];
        }
      }
      return new FillPoly(tr_v, tr_m, this.midP, tr_dir, false, this.sizeX, this.sizeY);
    } else {
    for (let i = 0; i < len; i++) {
      const cv = tr_v[i];
      const nv = tr_v[i + 1 < len ? i + 1 : 0];
      const mi = tr_m[i];
      const di = tr_dir[i];

      if (f < 997) mod = mi;

      // If mod is smaller than 0.02, skip growing math and just insert the middle vertex
      if (mod < 0.05) {
        newMods[idx] = mi;
        newDirs[idx] = di;
        idx++;
        insertedX[insertedIdx] = (cv.x + nv.x) / 2;
        insertedY[insertedIdx] = (cv.y + nv.y) / 2;
        newMods[idx] = mi;
        newDirs[idx] = di;
        idx++;
        insertedIdx++;
        continue;
      }

      const rotDeg = (di ? bleedDirDeg : -bleedDirDeg) + rr(-1, 1) * 5;
      const _cs = cossin(rotDeg);
      const c = _cs[0], s = _cs[1];

      const sideX = nv.x - cv.x;
      const sideY = nv.y - cv.y;
      const dirX = c * sideX + s * sideY;
      const dirY = c * sideY - s * sideX;

      const d = gPool[~~(rr(0, 1) * gPoolLen)] * rr(0.65, 1.35) * mod;
      const nextMod = mi + g2Pool[~~(rr(0, 1) * g2PoolLen)];

      newMods[idx] = mi;
      newDirs[idx] = di;
      idx++;

      insertedX[insertedIdx] = cv.x + sideX * 0.5 + dirX * d;
      insertedY[insertedIdx] = cv.y + sideY * 0.5 + dirY * d;
      newMods[idx] = nextMod;
      newDirs[idx] = di;
      idx++;
      insertedIdx++;
    }
    }

    let fv,
      fm,
      fd;
    
    if (GROW_CAP && idx > GROW_CAP) {
      const step = Math.ceil(idx / GROW_CAP);
      const kept = Math.ceil(idx / step);
      fv = new Array(kept);
      fm = new Array(kept);
      fd = new Array(kept);
      let dst = 0;
      for (let j = 0; j < idx; j += step, dst++) {
        fv[dst] =
          j % 2 === 0
            ? tr_v[j >> 1]
            : { x: insertedX[j >> 1], y: insertedY[j >> 1] };
        fm[dst] = newMods[j];
        fd[dst] = newDirs[j];
      }
    } else {
      fv = new Array(idx);
      for (let j = 0; j < idx; j++) {
        fv[j] =
          j % 2 === 0
            ? tr_v[j >> 1]
            : { x: insertedX[j >> 1], y: insertedY[j >> 1] };
      }
      fm = newMods.slice(0, idx);
      fd = newDirs.slice(0, idx);
    }
    return new FillPoly(fv, fm, this.midP, fd, false, this.sizeX, this.sizeY);
  }

  /**
   * Fills the polygon with multiple layers to simulate a watercolor effect.
   * @param {Color|string} color - The fill color.
   * @param {number} intensity - Opacity intensity (mapped from 0 to 1).
   * @param {number} tex - Texture factor.
   */
  fill(color, intensity, tex) {
    const texture = tex * 3;
    // Texture comes from the composite, so of the 20 layers of Hobbs'
    // schedule (growth every 4, trims every 2) only LAYERS are drawn, evenly
    // spaced, each proportionally denser.
    const int = 2 * intensity * (1 + tex / 2) * (SCHEDULE / LAYERS);
    const switchingToFill = Mix.isBrush !== false;
    Mix.isBrush = false;
    if (switchingToFill) Mix.justChanged = true;
    Mix.blend(color);
    // Each fill composites alone: flush same-colour washes first.
    Mix.blend(color, true);

    const m = getAffineMatrix();
    const transform = [
      Density * m.a,
      Density * m.b,
      Density * m.c,
      Density * m.d,
      Density * (m.x + Cwidth / 2),
      Density * (m.y + Cheight / 2),
    ];
    setFillTransform(transform);
    try {
      GROW_CAP = GROW_MAX_VERTS * Math.max(0.2, 2 * State.fill.bleed_strength);

      const size = Math.max(this.sizeX, this.sizeY);
      const darker = rr(0.15, 0.7);
      let pol = this.grow();
      const sparse = this.scatter(0.1).grow().scatter(0.75).flipDirs();
      let pols;

      for (let i = 0; i < SCHEDULE; i++) {
        if (i % 4 === 0) {
          pol = pol.grow();
        }

        if (i % 2 === 0) {
          // The outline layer is never trimmed: the trims all cut the same
          // side, which would leave the outline there too thin.
          pols = [
            pol.grow(1),
            pol.grow(0.7 - 0.0125 * i),
            pol.grow(0.4 - 0.0125 * i),
          ];
        }

        if (!DRAWN.has(i)) continue;

        // One growth level fewer than Hobbs: the finest one's tiny zigzags
        // show as a saw-tooth along the crisp edge. The first, untrimmed
        // layer outlines the fill.
        for (let k = 0; k < pols.length; k++) {
          pols[k].grow(999).layer(int, k === 0);
        }
        if (State.fill.scatter) {
          sparse.grow(999).flipDirs().layer(int * texture);
        }
        pol.grow(darker).grow(999).layer(int);
      }

      Mix.watercolor = this.watercolorLook(transform, size, int);
      // The smoothed edge can sit just outside the painted pixels, and the
      // blur reaches 3σ beyond them.
      flushFill();
      const rect = Mix.mask?.dirtyRect;
      const sigma = Mix.watercolor.sigma;
      const pad = 3 * sigma + 2;
      if (rect) {
        Mix.markDirtyRect(Mix.mask, {
          minX: rect.minX - pad, minY: rect.minY - pad,
          maxX: rect.maxX + pad, maxY: rect.maxY + pad,
        });
      }
      const { uniforms } = Mix.watercolor;
      const level = uniforms.u_wcFlow[2];
      uniforms.u_blur = blurFillMask(sigma, level);
      // Wet-in-wet: the paper recent fills left wet, then this fill's own.
      const paper = wetPaper(getActiveFramebuffer() ?? Renderer);
      uniforms.u_wet = paper.texture;
      uniforms.u_wetInfo = paper.info;
      const painted = Mix.mask?.dirtyRect && { ...Mix.mask.dirtyRect };
      Mix.blend(color, true);
      wetFill(painted, level, constrain(0.4 + 1.2 * State.fill.bleed_strength, 0, 1));
    } finally {
      Mix.watercolor = null;
      flushFill();
    }
  }

  /**
   * Returns the watercolour composite's uniforms for this fill (see
   * `watercolor()` in core/gl/shader.frag) and the σ of its mask blur.
   * Positions are in mask pixels.
   * @param {number[]} t - User space → device pixels (a, b, c, d, e, f).
   * @param {number} size - Polygon size in user space.
   * @param {number} int - Layer opacity in percent.
   * @returns {{sigma: number, uniforms: Object}}
   */
  /**
   * Returns the watercolour composite's two pigment uniforms: the fill colour
   * split into a warmer and a cooler pigment (see spectral_mix_pigments() in
   * core/gl/shader.frag). They override the single pigment Mix computes.
   * @returns {Object} Uniforms by name.
   */
  pigments() {
    // Each pigment's hue turns up to 30° from the fill colour.
    const [a, b] = splitPigment(State.fill.color._array, 30 * State.fill.split);
    const termsA = pigmentTerms(a);
    const ksA = Float32Array.from(termsA.ks), luminanceA = termsA.luminance;
    const termsB = pigmentTerms(b);
    return {
      u_pigmentKS: ksA,
      u_pigmentLuminance: luminanceA,
      u_wcPigmentB: Float32Array.from(termsB.ks),
      u_wcLuminanceB: termsB.luminance,
    };
  }

  watercolorLook(t, size, int) {
    const [a, b, c, d, e, f] = t;
    const { x, y } = this.midP;
    const bleed = State.fill.bleed_strength;
    const paper = getPaper();

    // Pigment drifts downstream along the bleed angle, or a little anywhere.
    let fx, fy, flow;
    if (State.fill.angle != null) {
      [fx, fy] = cossin(State.fill.angle);
      fy = -fy;
      flow = 1;
    } else {
      [fx, fy] = cossin(rr(0, 360));
      flow = 0.4;
    }
    const tx = a * fx + c * fy;
    const ty = b * fx + d * fy;
    const len = Math.hypot(tx, ty) || 1;

    // The edge is where the outline layers' paint (log domain, the mask's
    // silhouette channel) reaches what about two of five layers would lay
    // down, whatever LAYERS is: more, thinner layers must not move it out.
    const level = -2.2 * (LAYERS / 5) * Math.log1p(-Math.min(int / 100, 0.9999));
    const radius = size * Math.sqrt(Math.abs(a * d - b * c));
    // Blur σ for the rim band and body, in mask px (the silhouette uses half).
    const sigma = constrain(radius * 0.07, 3 * Density, 18 * Density);
    // Each feature appears on some fills only, more often when wetter.
    const wet = constrain(bleed * 2, 0.15, 1);
    const tex = State.fill.texture_strength;
    const at = (lo, hi) => {
      const [x, y] = cossin(rr(0, 360));
      const k = rr(lo, hi);
      return [x * k, y * k];
    };
    // Pigment pools downstream when the fill flows, anywhere otherwise.
    const [px, py] = flow === 1 ? [tx / len, ty / len] : cossin(rr(0, 360));
    const pool = rr(0, 1) < 0.25 + 0.3 * wet ? [px, py, rr(0.1, 0.5), rr(0.8, 2.5)] : [0, 0, 0, 0];
    const drop = rr(0, 1) < 0.15 + 0.35 * wet ? [...at(0, 0.5), rr(0.15, 0.32), rr(0.7, 1.8)] : [0, 0, 0, 0];
    const bloom = rr(0, 1) < 0.5 * (wet - 0.15) ? [...at(0.2, 0.6), rr(0.2, 0.4), rr(0.5, 1)] : [0, 0, 0, 0];
    const uniforms = {
      u_paper: [paper.strength, paper.grain, Density, paper.seed],
      u_wcShape: [
        a * x + c * y + e,
        b * x + d * y + f,
        radius,
        ~~rr(0, 65536),
      ],
      u_wcLook: [
        State.fill.border_strength,
        tex,
        rr(0, 1) < tex * tex ? rr(0.4, 1) : 0,
        0.3 + 0.4 * bleed,
      ],
      u_wcBloom: bloom,
      u_wcDrop: drop,
      u_wcPool: pool,
      u_wcPigment: map(State.fill.opacity, 0, 255, 0, 1, true),
      ...this.pigments(),
      // Some fills lose part of their edge, more often when wetter.
      u_wcFlow: [(flow * tx) / len, (flow * ty) / len, level, rr(0, 1) < 0.3 + 0.5 * wet ? rr(0.6, 1) : 0],
    };
    return { sigma, uniforms };
  }

  /**
   * Draws a layer of the fill polygon.
   * @param {number} int - Layer opacity in percent.
   * @param {boolean} [outline=false] - Part of the fill's silhouette.
   */
  layer(int, outline = false) {
    queuePolygon(this.v, Math.min(int / 100, 1), 2, outline);
  }
}

// ---------------------------------------------------------------------------
// Extend Polygon and Plot Prototypes for Fill
// ---------------------------------------------------------------------------

/**
 * Applies a fill effect to the polygon using the current fill state.
 * @param {Color|string} [_color] - The color for the fill.
 * @param {number} [_opacity] - The opacity value.
 * @param {number} [_bleed] - The bleed intensity.
 * @param {number} [_texture] - The texture strength.
 * @param {number} [_border] - The border strength.
 * @param {string} [_direction] - The bleed direction.
 * @param {number|null} [_angle] - Optional wash direction angle in current angle mode.
 */
Polygon.prototype.fill = function (
  _color = false,
  _opacity,
  _bleed,
  _texture,
  _border,
  _direction,
  _angle,
) {
  let state = FillState();
  try {
    if (_color !== false) {
      fill(_color, _opacity);
      if (_bleed !== undefined) fillBleed(_bleed, _direction, _angle);
      fillTexture(_texture, _border);
    }
    if (State.fill.isActive) {
      isFieldReady();
      createFill(this);
    }
  } finally {
    FillSetState(state);
  }
  return this;
};

/**
 * Fills a plot on the canvas by generating a polygon based on the provided coordinates.
 * @param {number} x - The x-coordinate.
 * @param {number} y - The y-coordinate.
 * @param {number} scale - Scaling factor.
 */
Plot.prototype.fill = function (x, y, scale) {
  if (FillState().isActive) {
    if (this.origin) ((x = this.origin[0]), (y = this.origin[1]), (scale = 1));
    this.pol = this.genPol(
      x,
      y,
      scale,
      State.fill.bleed_strength < 0.06
      ? 0
      : map(State.fill.bleed_strength, 0, 0.6, 0.2, 0.60, true),
    );
    this.pol.fill();
  }
};
