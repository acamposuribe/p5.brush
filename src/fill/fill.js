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

import {
  Renderer,
  Mix,
  State,
  Cwidth,
  Cheight,
  Density,
} from "../core/color.js";
import { drawPolygon, circle } from "./mask.js";
import {
  constrain,
  weightedRand,
  rr,
  map,
  randInt,
  gaussian,
  rotate,
  cos,
  sin,
  _onSeed,
} from "../core/utils.js";
import { isFieldReady, Matrix } from "../core/flowfield.js";
import { Polygon } from "../core/polygon.js";
import { Plot } from "../core/plot.js";

// =============================================================================
// Fill State and helpers
// =============================================================================

// Vertex cap for grow() — set to 0 or false to disable
const GROW_MAX_VERTS = 2024;

/**
 * Global fill state settings.
 */
State.fill = {
  opacity: 150,
  bleed_strength: 0.07,
  texture_strength: 0.8,
  border_strength: 0.5,
  direction: "out",
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
  State.fill.opacity = (arguments.length < 4 ? b : d) || 150;
  State.fill.color =
    arguments.length < 3 ? Renderer.color(a) : Renderer.color(a, b, c);
  State.fill.isActive = true;
}

/**
 * Sets the bleed (watercolor) intensity and direction.
 * @param {number} _i - The bleed intensity (clamped to [0,1]).
 * @param {string} [_direction="out"] - The bleeding direction.
 */
export function fillBleed(_i, _direction = "out") {
  State.fill.bleed_strength = constrain(_i, 0, 1);
  State.fill.direction = _direction;
}

/**
 * Sets the texture and border strengths for the fill.
 * @param {number} [_texture=0.4] - The texture strength (clamped to [0,1]).
 * @param {number} [_border=0.4] - The border strength (clamped to [0,1]).
 */
export function fillTexture(_texture = 0.4, _border = 0.4) {
  State.fill.texture_strength = constrain(_texture, 0, 1);
  State.fill.border_strength = constrain(_border, 0, 1);
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

// Helper for direction checking - extracted to reduce duplication
function _isLeft(a, b, c) {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x) > 0.01;
}

/**
 * Calculates the centroid of a polygon from its vertices.
 * @param {Object[]} pts - Array of points with {x, y}.
 * @returns {Object} The center point {x, y}.
 */
function _center(pts) {
  if (pts.length === 0) {
    return { x: 0, y: 0 };
  }

  if (pts.length < 8) {
    // Simple average for small polygons
    const sum = pts.reduce(
      (center, point) => ({ x: center.x + point.x, y: center.y + point.y }),
      { x: 0, y: 0 },
    );
    return { x: sum.x / pts.length, y: sum.y / pts.length };
  }

  // Close polygon if needed
  const v = [...pts];
  if (v[0].x !== v[v.length - 1].x || v[0].y !== v[v.length - 1].y)
    v.push(v[0]);

  // Calculate using shoelace formula (more efficient implementation)
  let area = 0,
    cx = 0,
    cy = 0;
  for (let i = 0; i < v.length - 1; i++) {
    const cross = v[i].x * v[i + 1].y - v[i + 1].x * v[i].y;
    area += cross;
    cx += (v[i].x + v[i + 1].x) * cross;
    cy += (v[i].y + v[i + 1].y) * cross;
  }

  area *= 0.5;
  return area
    ? { x: cx / (6 * area), y: cy / (6 * area) }
    : { x: v[0].x, y: v[0].y };
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
  _polygon = polygon;
  const v = [...polygon.vertices];
  const fluid = ~~(v.length * 0.25 * weightedRand({ 1: 5, 2: 10, 3: 60 }));
  const strength = State.fill.bleed_strength;
  const modifiers = v.map(
    (_, i) => (i > fluid ? 1 : 0.3) * rr(0.85, 1.4) * strength,
  );
  const shift = randInt(0, v.length);
  const shifted = [...v.slice(shift), ...v.slice(0, shift)];
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
 * of color with varying intensity and erase parts to simulate a natural watercolor bleed.
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

      // Calculate directions
      this.dir = Array(v.length);
      rayCalc.forEach((rc, i) => {
        let count = 0;
        for (const isect of _polygon.intersect(rc.ray)) {
          if (_isLeft(rc.v1, rc.v2, isect)) count++;
        }
        this.dir[i] = count % 2 === 0;
      });

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

    // Trim from middle for balance
    const n = ~~((1 - f) * this.v.length);
    const s = ~~(this.v.length / 2 - n / 2);

    // Copy only the kept ranges instead of cloning the full arrays and splicing.
    const keep = this.v.length - n;
    const v = new Array(keep);
    const m = new Array(keep);
    const dir = new Array(keep);
    let dst = 0;

    for (let i = 0; i < s; i++, dst++) {
      v[dst] = this.v[i];
      m[dst] = this.m[i];
      dir[dst] = this.dir[i];
    }

    for (let i = s + n; i < this.v.length; i++, dst++) {
      v[dst] = this.v[i];
      m[dst] = this.m[i];
      dir[dst] = this.dir[i];
    }


    // We want to add at least two vertices to divide the new edge that appears after trimming, at random distances along its path
    const trimStart = s;
    const trimEnd = s + n;
    const edgeStart = this.v[(trimStart - 1 + this.v.length) % this.v.length];
    const edgeEnd = this.v[trimEnd % this.v.length];
    const edgeVec = { x: edgeEnd.x - edgeStart.x, y: edgeEnd.y - edgeStart.y };
    
    // Insert two new vertices at random positions along the new edge
    const insertCount = 2;
    for (let i = 0; i < insertCount; i++) {
      const t = rr(0.25, 0.75); // Random position between 25% and 75% along the edge
      const newVertex = { x: edgeStart.x + edgeVec.x * t, y: edgeStart.y + edgeVec.y * t };
      const insertIdx = s + i;
      v.splice(insertIdx, 0, newVertex);
      m.splice(insertIdx, 0, rr(0.4, 0.7));
      dir.splice(insertIdx, 0, this.dir[trimStart % this.dir.length]);
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
    const indices = [];
    const step = L / keep;
    for (let i = 0; i < keep; i++) {
      indices.push(~~(i * step + rr(0, step * 0.8)));
    }

    const sv = [],
      sm = [],
      sd = [];
    const mid = this.midP;
    const sides = _polygon.sides;

    for (const idx of indices) {
      const j = idx % L;
      let p = this.v[j];
      let crossings = 0;
      for (const [a, b] of sides) {
        const ay = a.y,
          by = b.y;
        if ((ay > p.y) === (by > p.y)) continue;
        const t = (p.y - ay) / (by - ay);
        if (p.x < a.x + t * (b.x - a.x)) crossings++;
      }
      if (crossings % 2 === 0) {
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
    const insertedX = new Array(len);
    const insertedY = new Array(len);
    const newMods = new Array(outLen);
    const newDirs = new Array(outLen);
    const bleedDirDeg = State.fill.direction === "out" ? -90 : 90;

    if (_gaussians[0].length === 0) _fillGaussianPools();
    const gPool = _gaussians[0],
      gPoolLen = gPool.length;
    const g2Pool = _gaussians[1],
      g2PoolLen = g2Pool.length;

    let idx = 0;
    let insertedIdx = 0;
    let mod = f === 999 ? rr(0.6, 0.8) : State.fill.bleed_strength;

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
      const c = cos(rotDeg);
      const s = sin(rotDeg);

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

    let fv,
      fm,
      fd;
    const growCap = GROW_MAX_VERTS * Math.max(0.1, 2 * State.fill.bleed_strength);
    if (growCap && idx > growCap) {
      const step = Math.ceil(idx / growCap);
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
      newMods.length = idx;
      newDirs.length = idx;
      fm = newMods;
      fd = newDirs;
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
    const numLayers = 20;
    const texture = tex * 3;
    const int = 2 * intensity * (1 + tex / 2);

    const switchingToFill = Mix.isBrush !== false;
    Mix.isBrush = false;
    if (switchingToFill) Mix.justChanged = true;
    Mix.blend(color);

    Mix.ctx.save();
    Mix.ctx.setTransform(
      Density * Matrix.a(),
      Density * Matrix.b(),
      Density * Matrix.c(),
      Density * Matrix.d(),
      Density * (Matrix.x() + Cwidth / 2),
      Density * (Matrix.y() + Cheight / 2),
    );

    Mix.ctx.strokeStyle = `rgb(${color._getRed()} ${color._getGreen()} ${color._getBlue()} / ${
      0.005 * State.fill.border_strength
    })`;
    Mix.ctx.lineCap = "round";

    const size = Math.max(this.sizeX, this.sizeY);
    const darker = rr(0.15, 0.7);
    let pol = this.grow();
    const sparse = this.scatter(0.1).grow().scatter(0.75).flipDirs();
    let pols;

    for (let i = 0; i < numLayers; i++) {
      if (i % 4 === 0) {
        pol = pol.grow();
      }

      if (i % 2 === 0) {
        pols = [
          pol.grow(1 - 0.0125 * i),
          pol.grow(0.7 - 0.0125 * i),
          pol.grow(0.4 - 0.0125 * i),
        ];
      }

      for (const p of pols) {
        const grown = p.grow(999).grow(997);
        grown.layer(i, size, int, color);
      }
      const sparseLayer = sparse.grow(999).flipDirs().grow(997);
      sparseLayer.layer(i, size, int * texture, color);
      if (i % 2 === 0) {
        const darkerLayer = pol.grow(darker).grow(999);
        darkerLayer.layer(i, size, int * 2, color);
      }

      if (i % 8 === 0 || i === numLayers - 1) {
        if (texture !== 0) {
          pol.erase(texture * 3, intensity);
        }
        Mix.blend(color, true, false, true);
      }
    }

    Mix.ctx.restore();
  }

  /**
   * Draws a layer of the fill polygon with stroke and fill.
   * @param {number} i - The layer index.
   */
  layer(i, size, int, color) {
    Mix.ctx.lineWidth = map(i, 0, 24, size / 25, size / 30, true);

    Mix.ctx.fillStyle = `rgb(${color._getRed()} ${color._getGreen()} ${color._getBlue()} / ${int}%)`;

    drawPolygon(this.v);
    Mix.ctx.fill();
    Mix.ctx.stroke();
  }

  /**
   * Erases parts of the polygon to create a natural watercolor texture.
   * @param {number} texture - Texture strength factor.
   * @param {number} intensity - Intensity value for size scaling.
   */
  erase(texture, intensity) {
    Mix.ctx.save();

    const numCircles = ~~(rr(80, 110) * map(texture, 0, 1, 2, 3.5));
    const halfSizeX = this.sizeX / 1.3;
    const halfSizeY = this.sizeY / 1.3;
    const minSize =
      Math.min(this.sizeX, this.sizeY) * (1.3);
    const minSizeFactor = 0.03 * minSize;
    const maxSizeFactor = 0.45 * minSize;
    const { x: midX, y: midY } = this.midP;

    Mix.ctx.globalCompositeOperation = "destination-out";

    const alpha =
      ((5 - map(intensity, 80, 100, 0.3, 0.7, true)) * texture) / 255;
    Mix.ctx.fillStyle = `rgb(255 0 0 / ${alpha})`;
    Mix.ctx.lineWidth = 0;

    for (let i = 0; i < numCircles; i++) {
      const x = midX + gaussian(0, halfSizeX);
      const y = midY + gaussian(0, halfSizeY);
      const radius = rr(minSizeFactor, maxSizeFactor);

      Mix.ctx.beginPath();
      circle(x, y, radius);
      if (i % 5 !== 0) {
        Mix.ctx.fill();
      }
    }

    Mix.ctx.globalCompositeOperation = "source-over";
    Mix.ctx.restore();
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
 */
Polygon.prototype.fill = function (
  _color = false,
  _opacity,
  _bleed,
  _texture,
  _border,
  _direction,
) {
  let state = FillState();
  if (_color) {
    fill(_color, _opacity);
    fillBleed(_bleed, _direction);
    fillTexture(_texture, _border);
  }
  if (state.isActive) {
    isFieldReady();
    createFill(this);
  }
  FillSetState(state);
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
