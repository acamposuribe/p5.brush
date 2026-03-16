// =============================================================================
// Module: Classic Hatch
// =============================================================================

import { State } from "../core/color.js";
import { toDegreesSigned, map, rr } from "../core/utils.js";
import { Polygon } from "../core/polygon.js";
import { Plot } from "../core/plot.js";
import { BrushState, BrushSetState, set, line } from "../stroke/stroke.js";

// ---------------------------------------------------------------------------
// Hatch State
// ---------------------------------------------------------------------------

State.hatch = {
  isActive: false,
  dist: 5,
  angle: 45,
  options: {},
  hBrush: false,
};

export function HatchState() {
  return { ...State.hatch };
}

export function HatchSetState(state) {
  State.hatch = { ...state };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function hatch(
  dist = 5,
  angle = 45,
  options = { rand: false, continuous: false, gradient: false }
) {
  let s = State.hatch;
  s.isActive = true;
  s.dist = dist;
  s.angle = toDegreesSigned(angle);
  s.options = options;
}

export function hatchStyle(brush, color = "black", weight = 1) {
  State.hatch.hBrush = { brush, color, weight };
}

export function noHatch() {
  State.hatch.isActive = false;
  State.hatch.hBrush = false;
}

// ---------------------------------------------------------------------------
// Scanline Hatching
// ---------------------------------------------------------------------------

/**
 * Computes hatch segments for a polygon via scanline intersection.
 * Rotates vertices so hatch lines become horizontal, scans for edge
 * crossings, then rotates intersections back to original space.
 */
function scanlineHatch(polygon, angle, dist, gradient) {
  const rad = (angle * Math.PI) / 180;
  const cosA = Math.cos(rad), sinA = Math.sin(rad);
  const cosB = Math.cos(-rad), sinB = Math.sin(-rad);

  const verts = polygon.a, n = verts.length;

  // Rotate vertices; track Y extent
  const rotated = new Array(n);
  let minY = Infinity, maxY = -Infinity;
  for (let i = 0; i < n; i++) {
    const x = verts[i][0], y = verts[i][1];
    const r = [x * cosA - y * sinA, x * sinA + y * cosA];
    rotated[i] = r;
    if (r[1] < minY) minY = r[1];
    if (r[1] > maxY) maxY = r[1];
  }

  // Build edge list (skip horizontal edges)
  const edges = [];
  for (let i = 0; i < n; i++) {
    const a = rotated[i], b = rotated[(i + 1) % n];
    if (a[1] !== b[1]) edges.push(a, b);
  }
  const eLen = edges.length;

  // Scan, find crossings, rotate back
  const segments = [];
  let Y = minY + dist * 0.5, step = dist;
  while (Y < maxY) {
    const cx = [];
    for (let i = 0; i < eLen; i += 2) {
      const y1 = edges[i][1], y2 = edges[i + 1][1];
      if ((y1 <= Y && Y < y2) || (y2 <= Y && Y < y1))
        cx.push(edges[i][0] + ((Y - y1) / (y2 - y1)) * (edges[i + 1][0] - edges[i][0]));
    }
    cx.sort((a, b) => a - b);
    for (let i = 0; i < cx.length - 1; i += 2) {
      segments.push({
        x1: cx[i] * cosB - Y * sinB, y1: cx[i] * sinB + Y * cosB,
        x2: cx[i + 1] * cosB - Y * sinB, y2: cx[i + 1] * sinB + Y * cosB,
      });
    }
    Y += step;
    step *= gradient;
  }
  return segments;
}

// ---------------------------------------------------------------------------
// Create Hatch
// ---------------------------------------------------------------------------

export function createHatch(polygons) {
  const dist = State.hatch.dist;
  const angle = ((State.hatch.angle % 180) + 180) % 180;
  const options = State.hatch.options;

  const save = BrushState();
  if (State.hatch.hBrush) set(...Object.values(State.hatch.hBrush));
  if (!Array.isArray(polygons)) polygons = [polygons];

  const gradient = options.gradient ? map(options.gradient, 0, 1, 1, 1.1, true) : 1;

  const segs = [];
  for (const poly of polygons)
    for (const s of scanlineHatch(poly, angle, dist, gradient)) segs.push(s);
  segs.sort((a, b) => a.x1 === b.x1 ? a.y1 - b.y1 : a.x1 - b.x1);

  const r = options.rand || 0;
  for (let j = 0; j < segs.length; j++) {
    const s = segs[j];
    let x1 = s.x1, y1 = s.y1, x2 = s.x2, y2 = s.y2;
    if (r) {
      x1 += r * dist * rr(-1, 1);
      y1 += r * dist * rr(-1, 1);
      x2 += r * dist * rr(-1, 1);
      y2 += r * dist * rr(-1, 1);
    }
    line(x1, y1, x2, y2);
    if (j > 0 && options.continuous) line(segs[j - 1].x2, segs[j - 1].y2, x1, y1);
  }

  BrushSetState(save);
}

// ---------------------------------------------------------------------------
// Prototype Extensions
// ---------------------------------------------------------------------------

Polygon.prototype.hatch = function (_dist = false, _angle, _options) {
  let state = HatchState();
  if (_dist) hatch(_dist, _angle, _options);
  if (state.isActive) createHatch(this);
  HatchSetState(state);
};

Plot.prototype.hatch = function (x, y, scale) {
  if (HatchState().isActive) {
    if (this.origin) (x = this.origin[0]), (y = this.origin[1]), (scale = 1);
    this.pol = this.genPol(x, y, scale, 0.25);
    this.pol.hatch();
  }
};
