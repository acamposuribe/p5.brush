import { State } from "../core/color.js";
import { toDegreesSigned, map, rr } from "../core/utils.js";
import { Polygon } from "../core/polygon.js";
import { Plot } from "../core/plot.js";
import { BrushState, BrushSetState, set, line } from "../stroke/stroke.js";

// =============================================================================
// Module: Classic Hatch
// =============================================================================

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

/**
 * Returns a shallow snapshot of the current hatch modifier state.
 *
 * @returns {{isActive:boolean, dist:number, angle:number, options:Object, hBrush:Object|false}}
 */
export function HatchState() {
  return { ...State.hatch };
}

/**
 * Restores hatch modifier state from a previously captured snapshot.
 *
 * @param {{isActive:boolean, dist:number, angle:number, options:Object, hBrush:Object|false}} state
 */
export function HatchSetState(state) {
  State.hatch = { ...state };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Activates classic scanline hatching for subsequent shapes.
 *
 * @param {number} [dist=5] Distance between scanlines.
 * @param {number} [angle=45] Hatch angle in the current runtime angle units.
 * @param {{rand?: number|false, continuous?: boolean, gradient?: number|false}} [options]
 */
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

/**
 * Overrides the brush, color, and weight used specifically for hatch strokes.
 *
 * @param {string} brush
 * @param {string|object} [color="black"]
 * @param {number} [weight=1]
 */
export function hatchStyle(brush, color = "black", weight = 1) {
  State.hatch.hBrush = { brush, color, weight };
}

/**
 * Deactivates hatching and clears any hatch-specific brush override.
 */
export function noHatch() {
  State.hatch.isActive = false;
  State.hatch.hBrush = false;
}

// ---------------------------------------------------------------------------
// Scanline Generation
// ---------------------------------------------------------------------------

/**
 * Computes hatch segments for one polygon by rotating it into scanline space,
 * intersecting horizontal scanlines against its edges, and rotating the
 * resulting segments back into canvas space.
 *
 * @param {Polygon} polygon
 * @param {number} angle Hatch angle in degrees.
 * @param {number} dist Base scanline spacing.
 * @param {number} gradient Multiplicative spacing growth per scanline.
 * @returns {{scanY:number, x1:number, y1:number, x2:number, y2:number}[]}
 */
function scanlineHatch(polygon, angle, dist, gradient) {
  const rad = (angle * Math.PI) / 180;
  const cosA = Math.cos(rad),
    sinA = Math.sin(rad);
  const cosB = Math.cos(-rad),
    sinB = Math.sin(-rad);

  const verts = polygon.a,
    n = verts.length;

  // Rotate vertices; track Y extent
  const rotated = new Array(n);
  let minY = Infinity,
    maxY = -Infinity;
  for (let i = 0; i < n; i++) {
    const x = verts[i][0],
      y = verts[i][1];
    const r = [x * cosA - y * sinA, x * sinA + y * cosA];
    rotated[i] = r;
    if (r[1] < minY) minY = r[1];
    if (r[1] > maxY) maxY = r[1];
  }

  // Build edge list (skip horizontal edges)
  const edges = [];
  for (let i = 0; i < n; i++) {
    const a = rotated[i],
      b = rotated[(i + 1) % n];
    if (a[1] !== b[1]) edges.push(a, b);
  }
  const eLen = edges.length;

  // Scan, find crossings, rotate back
  const segments = [];
  let Y = minY + dist * 0.5,
    step = dist;
  while (Y < maxY) {
    const cx = [];
    for (let i = 0; i < eLen; i += 2) {
      const y1 = edges[i][1],
        y2 = edges[i + 1][1];
      if ((y1 <= Y && Y < y2) || (y2 <= Y && Y < y1))
        cx.push(
          edges[i][0] + ((Y - y1) / (y2 - y1)) * (edges[i + 1][0] - edges[i][0])
        );
    }
    cx.sort((a, b) => a - b);
    for (let i = 0; i < cx.length - 1; i += 2) {
      segments.push({
        scanY: Y,
        x1: cx[i] * cosB - Y * sinB,
        y1: cx[i] * sinB + Y * cosB,
        x2: cx[i + 1] * cosB - Y * sinB,
        y2: cx[i + 1] * sinB + Y * cosB,
      });
    }
    Y += step;
    step *= gradient;
  }
  return segments;
}

/**
 * Collects and orders hatch segments for one polygon or a polygon list.
 *
 * Segments are sorted in scanline traversal order so downstream rendering can
 * optionally connect them into a continuous serpentine path.
 *
 * @param {Polygon|Polygon[]} polygons
 * @param {number} dist
 * @param {number} angle
 * @param {number} gradient
 * @returns {{scanY:number, x1:number, y1:number, x2:number, y2:number}[]}
 */
function getHatchSegments(polygons, dist, angle, gradient) {
  if (!Array.isArray(polygons)) polygons = [polygons];
  const segs = [];
  for (const poly of polygons) {
    for (const s of scanlineHatch(poly, angle, dist, gradient)) segs.push(s);
  }
  segs.sort((a, b) => (a.scanY === b.scanY ? a.x1 - b.x1 : a.scanY - b.scanY));
  return segs;
}

// ---------------------------------------------------------------------------
// Hatch Configuration
// ---------------------------------------------------------------------------

/**
 * Runs hatch drawing with the temporary hatch-specific brush style if one is active,
 * then restores the outer stroke state.
 *
 * @param {() => void} drawFn
 */
function withHatchStyle(drawFn) {
  const save = BrushState();
  if (State.hatch.hBrush) set(...Object.values(State.hatch.hBrush));
  drawFn();
  BrushSetState(save);
}

/**
 * Resolves the active hatch parameters and precomputes the ordered scanline segments.
 *
 * @param {Polygon|Polygon[]} polygons
 * @returns {{dist:number, options:Object, segs:Object[]}}
 */
function getActiveHatchConfig(polygons) {
  const dist = State.hatch.dist;
  const angle = ((State.hatch.angle % 180) + 180) % 180;
  const options = State.hatch.options;
  const gradient = options.gradient ? map(options.gradient, 0, 1, 1, 1.1, true) : 1;
  const segs = getHatchSegments(polygons, dist, angle, gradient);
  return { dist, options, segs };
}

// ---------------------------------------------------------------------------
// Hatch Lines
// ---------------------------------------------------------------------------

/**
 * Expands ordered hatch segments into the actual line list that will be drawn.
 *
 * This includes endpoint jitter when `rand` is active and inserts the serpentine
 * connector lines when `continuous` is enabled.
 *
 * @param {Polygon|Polygon[]} polygons
 * @returns {{x1:number, y1:number, x2:number, y2:number, scanY:number, isConnector:boolean}[]}
 */
export function getHatchLines(polygons) {
  const { dist, options, segs } = getActiveHatchConfig(polygons);
  const r = options.rand || 0;
  const lines = [];

  for (let j = 0; j < segs.length; j++) {
    const s = segs[j];
    let x1 = s.x1, y1 = s.y1, x2 = s.x2, y2 = s.y2;
    if (r) {
      x1 += 2 * r * dist * rr(-1, 1);
      y1 += 2 * r * dist * rr(-1, 1);
      x2 += 2 * r * dist * rr(-1, 1);
      y2 += 2 * r * dist * rr(-1, 1);
    }
    const reverse = options.continuous && j % 2 === 1;
    const line = reverse
      ? { x1: x2, y1: y2, x2: x1, y2: y1, scanY: s.scanY, isConnector: false }
      : { x1, y1, x2, y2, scanY: s.scanY, isConnector: false };
    lines.push(line);
    if (j > 0 && options.continuous) {
      const prev = lines[lines.length - 2];
      lines.push({
        x1: prev.x2,
        y1: prev.y2,
        x2: line.x1,
        y2: line.y1,
        scanY: s.scanY,
        isConnector: true,
      });
    }
  }

  return lines;
}

// ---------------------------------------------------------------------------
// Hatch Rendering
// ---------------------------------------------------------------------------

/**
 * Iterates the generated hatch lines and delegates the actual rendering of each
 * segment to the provided callback.
 *
 * @param {Polygon|Polygon[]} polygons
 * @param {(x1:number, y1:number, x2:number, y2:number, index:number, segs:Object[]) => void} drawSegment
 */
function renderHatchSegments(polygons, drawSegment) {
  const segs = getHatchLines(polygons);
  withHatchStyle(() => {
    for (let j = 0; j < segs.length; j++) {
      const s = segs[j];
      drawSegment(s.x1, s.y1, s.x2, s.y2, j, segs);
    }
  });
}

/**
 * Draws classic hatch lines over one polygon or an array of polygons.
 *
 * @param {Polygon|Polygon[]} polygons
 */
export function createHatch(polygons) {
  renderHatchSegments(polygons, (x1, y1, x2, y2) => {
    line(x1, y1, x2, y2);
  });
}

// ---------------------------------------------------------------------------
// Prototype Extensions
// ---------------------------------------------------------------------------

/**
 * Applies the currently active hatch modifier to a polygon, or temporarily
 * overrides hatch parameters for this call only.
 *
 * @param {number|false} [_dist=false]
 * @param {number} [_angle]
 * @param {{rand?: number|false, continuous?: boolean, gradient?: number|false}} [_options]
 */
Polygon.prototype.hatch = function (_dist = false, _angle, _options) {
  let state = HatchState();
  if (_dist) hatch(_dist, _angle, _options);
  if (State.hatch.isActive) createHatch(this);
  HatchSetState(state);
};

/**
 * Converts the plot to a polygon and applies the currently active hatch modifier.
 *
 * @param {number} x
 * @param {number} y
 * @param {number} scale
 */
Plot.prototype.hatch = function (x, y, scale) {
  if (HatchState().isActive) {
    if (this.origin) (x = this.origin[0]), (y = this.origin[1]), (scale = 1);
    this.pol = this.genPol(x, y, scale, 0.3);
    this.pol.hatch();
  }
};
