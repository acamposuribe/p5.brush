import { Cwidth, Cheight } from "./target.js";
import { State } from "./color.js";
import { toDegrees, rr2 } from "./utils.js";
import { Position, isFieldReady } from "./flowfield.js";
import { Polygon } from "./polygon.js";

/**
 * The point at distance `s` along a piece of path (see Plot.pieces()): from
 * its origin at its heading, turning `turn` radians per unit of length. The
 * stroke shaders compute the same in src/stroke/path.glsl.
 * @param {{x: number, y: number, heading: number, turn: number}} piece
 * @param {number} s
 * @returns {[number, number]}
 */
export function pathPoint(piece, s) {
  const turn = 0.5 * piece.turn * s;
  // The chord to the point, as a fraction of the arc length (sin x / x).
  const chord = Math.abs(turn) < 1e-3 ? 1 - (turn * turn) / 6 : Math.sin(turn) / turn;
  const heading = piece.heading + turn;
  return [piece.x + s * chord * Math.cos(heading), piece.y - s * chord * Math.sin(heading)];
}

// =============================================================================
// Section: Plot Class
// =============================================================================

/**
 * The Plot class represents a collection of segments that define shapes or paths.
 * It supports operations like adding segments, calculating angles and pressures,
 * and generating polygons based on the plot's structure.
 */
export class Plot {
  /**
   * Creates a new Plot.
   * @param {string} _type - The type of plot, "curve" or "segments".
   */
  constructor(_type) {
    this.segments = [];
    this.angles = [];
    this.pres = [];
    this.type = _type;
    this.dir = 0;
    this._cumLen = []; // cumulative start position of each segment
    this.length = 0;
    this.index = 0;
    this.suma = 0;
    this.pol = false;
  }

  /**
   * Adds a segment to the plot with specified angle, length, and pressure.
   * @param {number} _a - The angle of the segment.
   * @param {number} _length - The length of the segment.
   * @param {number} _pres - The pressure of the segment.
   * @param {boolean} _degrees - Whether the angle is in degrees.
   */
  addSegment(_a = 0, _length = 0, _pres = 1, _degrees = false) {
    if (this.angles.length > 0) this.angles.pop(); // Remove the last angle
    _a = _degrees ? ((_a % 360) + 360) % 360 : toDegrees(_a); // Normalize angle
    this.angles.push(_a, _a); // Push angle twice for continuity
    this.pres.push(_pres);
    this._cumLen.push(this.length); // cumulative start of this segment
    this.segments.push(_length);
    this.length += _length; // incremental update instead of O(n) reduce
  }

  /**
   * Finalizes the plot by setting the last angle and pressure.
   * @param {number} _a - The final angle.
   * @param {number} _pres - The final pressure.
   * @param {boolean} _degrees - Whether the angle is in degrees.
   */
  endPlot(_a = 0, _pres = 1, _degrees = false) {
    _a = _degrees ? ((_a % 360) + 360) % 360 : toDegrees(_a);
    this.angles[this.angles.length - 1] = _a; // Update the last angle
    this.pres.push(_pres);
  }

  /**
   * Rotates the entire plot by a given angle.
   * @param {number} _a - The angle to rotate the plot.
   */
  rotate(_a) {
    this.dir = toDegrees(_a);
  }

  /**
   * Calculates the pressure at a given distance along the plot.
   * Inlined for performance — pressure values never need angle wrap-around.
   * Public queries may arrive in any order; calcIndex retains its fast cache.
   * @param {number} _d - The distance along the plot.
   * @returns {number} - The interpolated pressure.
   */
  pressure(_d) {
    if (_d > this.length) return this.pres[this.pres.length - 1];
    this.calcIndex(_d);
    const p0 = this.pres[this.index];
    const p1 = this.pres[this.index + 1]; // always defined: pres.length = segments.length+1
    const seg = this.segments[this.index];
    // t ∈ [0,1) guaranteed by calcIndex; skip redundant bounds clamp
    return seg === 0 ? p0 : p0 + (_d - this.suma) / seg * (p1 - p0);
  }

  /**
   * Calculates the angle at a given distance along the plot.
   * @param {number} _d - The distance along the plot.
   * @returns {number} - The calculated angle.
   */
  angle(_d) {
    if (_d > this.length) return this.angles[this.angles.length - 1];
    this.calcIndex(_d);
    if (this.type !== "curve") return this.angles[this.index] + this.dir;
    let a0 = this.angles[this.index];
    let a1 = this.angles[this.index + 1]; // always defined: angles.length = segments.length+1
    if (Math.abs(a1 - a0) > 180) {
      if (a1 > a0) a1 = -(360 - a1);
      else a0 = -(360 - a0);
    }
    const seg = this.segments[this.index];
    const t = seg === 0 ? 0 : (_d - this.suma) / seg;
    // t ∈ [0,1) guaranteed by calcIndex — clamp is unnecessary
    return a0 + t * (a1 - a0) + this.dir;
  }

  /**
   * Calculates the current index of the plot based on the distance.
   * Uses sequential forward scan from the cached index (O(1) amortized for
   * monotone access patterns) with binary search fallback for backward jumps.
   * @param {number} _d - The distance along the plot.
   */
  calcIndex(_d) {
    const cum = this._cumLen;
    const n = cum.length;
    if (n === 0) { this.index = 0; this.suma = 0; return 0; }
    let i = this.index < n ? this.index : n - 1;
    // Forward scan: advance while next segment starts at or before _d
    while (i + 1 < n && cum[i + 1] <= _d) i++;
    // If current segment starts after _d, we went backward — use binary search
    if (cum[i] > _d) {
      let lo = 0, hi = i - 1;
      while (lo < hi) {
        const mid = (lo + hi + 1) >> 1;
        if (cum[mid] <= _d) lo = mid; else hi = mid - 1;
      }
      i = lo;
    }
    this.index = i;
    this.suma = cum[i];
    return i;
  }

  /**
   * The plot as pieces of path, for strokes walked on the GPU: each segment
   * is a straight run, or in a curve an arc whose heading turns evenly to the
   * next segment's, as angle() describes. Lengths are scaled by `scale`;
   * headings are in radians, with y pointing down the canvas.
   * @param {number} x - Start, in position space.
   * @param {number} y
   * @param {number} scale
   * @returns {{x: number, y: number, heading: number, turn: number, start: number,
   *   length: number, pressure: number, pressureSlope: number}[]} Each piece's
   *   origin, heading there, turn per unit of length, distance of its origin
   *   from the plot's start, length, and the plot's pressure at its origin and
   *   change per unit of length.
   */
  pieces(x, y, scale) {
    const pieces = [];
    let start = 0;
    for (let i = 0; i < this.segments.length; i++) {
      const length = this.segments[i] * scale;
      let a0 = this.angles[i];
      let a1 = this.type === "curve" ? this.angles[i + 1] : a0;
      // Turn the short way round, as angle() does.
      if (Math.abs(a1 - a0) > 180) {
        if (a1 > a0) a1 = -(360 - a1);
        else a0 = -(360 - a0);
      }
      const piece = {
        x,
        y,
        heading: ((a0 + this.dir) * Math.PI) / 180,
        turn: length > 0 ? ((a1 - a0) * Math.PI) / 180 / length : 0,
        start,
        length,
        pressure: this.pres[i],
        pressureSlope: length > 0 ? (this.pres[i + 1] - this.pres[i]) / length : 0,
      };
      pieces.push(piece);
      [x, y] = pathPoint(piece, length);
      start += length;
    }
    return pieces;
  }

  /**
   * Generates a polygon based on the plot.
   * @param {number} _x - The x-coordinate for the starting point.
   * @param {number} _y - The y-coordinate for the starting point.
   * @param {number} _scale - The scale factor for the polygon.
   * @param {number} _side - The side factor for the polygon.
   * @returns {Polygon} - The generated polygon.
   */
  genPol(_x, _y, _scale = 1, _side) {
    isFieldReady(); // Ensure that the drawing environment is prepared
    const step = _side < 0 ? 4 : 1;
    const vertices = [];
    if (!Number.isFinite(_scale) || _scale <= 0) throw new Error("Plot scale must be finite and greater than zero.");
    const numSteps = Math.round(this.length * _scale / step);
    if (!Number.isFinite(numSteps) || numSteps > 10_000_000) throw new Error("Plot is too large to sample safely.");
    const pos = new Position(_x + Cwidth / 2, _y + Cheight / 2);
    let pside = 0;
    let prevIdx = 0;

    for (let i = 0; i < numSteps; i++) {
      pos.plotTo(this, step, step, _scale);
      const idx = this.index; // already set by angle() inside plotTo
      pside += step;
      let maxSize = _side <= 0 ? 8 : Math.max(this.segments[idx] * _scale * _side * rr2(0.7, 1.3), 20);
      if ((pside >= maxSize || idx >= prevIdx) && pos.x) {
        vertices.push([pos.x - Cwidth / 2, pos.y - Cheight / 2]);
        pside = 0;
        if (idx >= prevIdx) prevIdx++;
      }
    }
    return new Polygon(vertices);
  }

  /**
   * Displays the plot with optional stroke, hatch, and fill effects.
   * @param {number} x - The x-coordinate.
   * @param {number} y - The y-coordinate.
   * @param {number} scale - The scale factor.
   */
  show(x, y, scale = 1) {
    if (State.wash) this.wash(x, y, scale);
    if (State.fill) this.fill(x, y, scale);
    if (State.mass) this.mass(x, y, scale);
    if (State.hatch) this.hatch(x, y, scale);
    if (State.stroke) this.draw(x, y, scale);
  }
}
