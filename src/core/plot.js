import { State, Cwidth, Cheight } from "./color.js";
import { toDegrees, map, rr2 } from "./utils.js";
import { Position, isFieldReady } from "./flowfield.js";
import { Polygon } from "./polygon.js";

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
    this.calcIndex(0);
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
    this.segments.push(_length);
    this.length = this.segments.reduce((sum, len) => sum + len, 0); // Update total length
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
   * @param {number} _d - The distance along the plot.
   * @returns {number} - The interpolated pressure.
   */
  pressure(_d) {
    // If the distance exceeds the plot length, return the last pressure
    if (_d > this.length) return this.pres[this.pres.length - 1];
    // Otherwise, calculate the pressure using the curving function
    return this.curving(this.pres, _d);
  }

  /**
   * Calculates the angle at a given distance along the plot.
   * @param {number} _d - The distance along the plot.
   * @returns {number} - The calculated angle.
   */
  angle(_d) {
    // If the distance exceeds the plot length, return the last angle
    if (_d > this.length) return this.angles[this.angles.length - 1];
    // Calculate the index for the given distance
    this.calcIndex(_d);
    // Return the angle, adjusted for the plot type and direction
    return this.type === "curve"
      ? this.curving(this.angles, _d) + this.dir
      : this.angles[this.index] + this.dir;
  }

  /**
   * Interpolates values between segments for smooth transitions.
   * @param {Array<number>} array - The array to interpolate within.
   * @param {number} _d - The distance along the plot.
   * @returns {number} - The interpolated value.
   */
  curving(array, _d) {
    let map0 = array[this.index];
    let map1 = array[this.index + 1] ?? map0;
    if (Math.abs(map1 - map0) > 180) {
      if (map1 > map0) map1 = -(360 - map1);
      else map0 = -(360 - map0);
    }
    return map(_d - this.suma, 0, this.segments[this.index], map0, map1, true);
  }

  /**
   * Calculates the current index of the plot based on the distance.
   * @param {number} _d - The distance along the plot.
   */
  calcIndex(_d) {
    this.index = -1;
    this.suma = 0;
    let d = 0;
    while (d <= _d) {
      this.suma = d;
      d += this.segments[this.index + 1];
      this.index++;
    }
    return this.index;
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
    const step = 0.5;
    const vertices = [];
    const numSteps = Math.round(this.length / step);
    const pos = new Position(_x + Cwidth / 2, _y + Cheight / 2);
    let pside = 0;
    let prevIdx = 0;

    for (let i = 0; i < numSteps; i++) {
      pos.plotTo(this, step, step);
      const idx = this.calcIndex(pos.plotted);
      pside += step;
      const maxSize = Math.max(this.segments[idx] * _side * rr2(0.7, 1.3), 20);
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
    if (State.stroke) this.draw(x, y, scale);
    if (State.hatch) this.hatch(x, y, scale);
    if (State.fill) this.fill(x, y, scale);
  }
}
