// =============================================================================
// Module: Hatch
// =============================================================================
/**
 * The Hatch module contains functions and classes dedicated to applying
 * hatch patterns over shapes and polygons. It enables the simulation of
 * cross-hatching and shading effects by drawing parallel lines or strokes
 * across a geometry. The module supports adjustable spacing, angle, and
 * optional style parameters (such as randomness, continuity, and gradient),
 * giving an artistic representation similar to hand-drawn hatching techniques.
 *
 * The implementation allows for hatching to be applied either to a Polygon
 * directly or via a Plot, extending the drawing capabilities with layered,
 * stylized textures.
 */

import { State } from "../core/color.js";
import { toDegrees, map, cos, sin, rr } from "../core/utils.js";
import { Polygon } from "../core/polygon.js";
import { Plot } from "../core/plot.js";
import { BrushState, BrushSetState, set, line } from "../stroke/stroke.js";

// ---------------------------------------------------------------------------
// Hatch State and Helpers
// ---------------------------------------------------------------------------

/**
 * Global hatch state settings.
 */
State.hatch = {
  isActive: false,
  dist: 5,
  angle: 45,
  options: {},
  hBrush: false,
};

/**
 * Returns a shallow copy of the current hatch state.
 * @returns {object} The current hatch state.
 */
export function HatchState() {
  return { ...State.hatch };
}

/**
 * Updates the global hatch state.
 * @param {object} state - The new hatch state.
 */
export function HatchSetState(state) {
  State.hatch = { ...state };
}

// ---------------------------------------------------------------------------
// Hatch Style Functions
// ---------------------------------------------------------------------------

/**
 * Activates hatching for subsequent geometries.
 *
 * @param {number} dist - The distance between hatching lines.
 * @param {number} angle - The angle (in degrees) at which hatching lines are drawn.
 * @param {object} options - Optional parameters to affect the hatching style:
 *                           - rand: Number value to introduce randomness.
 *                           - continuous: Boolean to connect adjacent lines.
 *                           - gradient: Number to gradually change spacing.
 */
export function hatch(
  dist = 5,
  angle = 45,
  options = { rand: false, continuous: false, gradient: false }
) {
  let s = State.hatch;
  s.isActive = true;
  s.dist = dist;
  s.angle = angle;
  s.options = options;
}

/**
 * Sets the hatch brush style for subsequent hatching.
 *
 * @param {string} brush - The brush name.
 * @param {string|Color} color - The brush color.
 * @param {number} weight - The brush weight (size).
 */
export function hatchStyle(brush, color = "black", weight = 1) {
  State.hatch.hBrush = { brush, color, weight };
}

/**
 * Disables hatching.
 */
export function noHatch() {
  State.hatch.isActive = false;
  State.hatch.hBrush = false;
}

// ---------------------------------------------------------------------------
// Fill Manager Functions
// ---------------------------------------------------------------------------

/**
 * Creates a hatching pattern over the given polygon(s).
 *
 * @param {Polygon|Polygon[]} polygons - A polygon or an array of polygons.
 */
export function createHatch(polygons) {
  let dist = State.hatch.dist;
  let angle = toDegrees(State.hatch.angle) % 180; // normalize to [0, 180)
  let options = State.hatch.options;

  // Save current stroke state
  let save = BrushState();
  // If a hatch brush is set, override with those parameters.
  if (State.hatch.hBrush) set(...Object.values(State.hatch.hBrush));

  // Compute overall bounding box for all polygons.
  if (!Array.isArray(polygons)) polygons = [polygons];
  const overallBB = computeOverallBoundingBox(polygons);

  // Build a bounding polygon based on the overall bounding box.
  let ventana = new Polygon([
    [overallBB.minX, overallBB.minY],
    [overallBB.maxX, overallBB.minY],
    [overallBB.maxX, overallBB.maxY],
    [overallBB.minX, overallBB.maxY],
  ]);

  // Determine starting y coordinate based on angle.
  let startY = angle <= 90 && angle >= 0 ? overallBB.minY : overallBB.maxY;
  let gradient = options.gradient
    ? map(options.gradient, 0, 1, 1, 1.1, true)
    : 1;
  let dots = [];
  let i = 0;
  let dist1 = dist;

  // Function to generate a line for index i.
  let linea = (i) => {
    return {
      point1: {
        x: overallBB.minX + dist1 * i * cos(-angle + 90),
        y: startY + dist1 * i * sin(-angle + 90),
      },
      point2: {
        x: overallBB.minX + dist1 * i * cos(-angle + 90) + cos(-angle),
        y: startY + dist1 * i * sin(-angle + 90) + sin(-angle),
      },
    };
  };

  // Generate lines and calculate intersections with polygons
  // Loop through the lines based on the distance and angle to calculate intersections with the polygons
  // The loop continues until a line does not intersect with the bounding window polygon
  // Each iteration accounts for the gradient effect by adjusting the distance between lines
  while (ventana.intersect(linea(i)).length > 0) {
    let tempArray = [];
    for (let p of polygons) {
      tempArray.push(p.intersect(linea(i)));
    }
    dots[i] = tempArray
      .flat()
      .sort((a, b) => (a.x === b.x ? a.y - b.y : a.x - b.x));
    dist1 *= gradient;
    i++;
  }

  // Filter out empty intersection sets.
  let gdots = dots.filter((dd) => typeof dd[0] !== "undefined");

  // Draw the hatching lines using the calculated intersections
  // If the 'rand' option is enabled, add randomness to the start and end points of the lines
  // If the 'continuous' option is set, connect the end of one line to the start of the next
  let r = options.rand || 0;
  for (let j = 0; j < gdots.length; j++) {
    let dd = gdots[j];
    let continuousLine = j > 0 && options.continuous;
    for (let i = 0; i < dd.length - 1; i += 2) {
      if (r !== 0) {
        dd[i].x += r * dist * rr(-10, 10);
        dd[i].y += r * dist * rr(-10, 10);
        dd[i + 1].x += r * dist * rr(-10, 10);
        dd[i + 1].y += r * dist * rr(-10, 10);
      }
      line(dd[i].x, dd[i].y, dd[i + 1].x, dd[i + 1].y);
      if (continuousLine) {
        line(gdots[j - 1][1].x, gdots[j - 1][1].y, dd[i].x, dd[i].y);
      }
    }
  }

  // Restore previous brush state.
  BrushSetState(save);
}

/**
 * Computes the bounding box for a single polygon.
 * @param {Polygon} polygon - The polygon to evaluate.
 * @returns {object} The bounding box as {minX, minY, maxX, maxY}.
 */
function computeBoundingBoxForPolygon(polygon) {
  if (polygon._boundingBox) return polygon._boundingBox;
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (let i = 0; i < polygon.a.length; i++) {
    const [x, y] = polygon.a[i];
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  polygon._boundingBox = { minX, minY, maxX, maxY };
  return polygon._boundingBox;
}

/**
 * Computes an overall bounding box for an array of polygons.
 * @param {Array} polygons - Array of Polygon objects.
 * @returns {object} The overall bounding box {minX, minY, maxX, maxY}.
 */
function computeOverallBoundingBox(polygons) {
  let overall = {
    minX: Infinity,
    minY: Infinity,
    maxX: -Infinity,
    maxY: -Infinity,
  };
  for (let poly of polygons) {
    const bb = computeBoundingBoxForPolygon(poly);
    overall.minX = Math.min(overall.minX, bb.minX);
    overall.minY = Math.min(overall.minY, bb.minY);
    overall.maxX = Math.max(overall.maxX, bb.maxX);
    overall.maxY = Math.max(overall.maxY, bb.maxY);
  }
  return overall;
}

// ---------------------------------------------------------------------------
// Extend Polygon and Plot Prototypes
// ---------------------------------------------------------------------------

/**
 * Adds a hatch effect to the polygon.
 *
 * If a distance is provided, activates hatching with the given parameters.
 * Then, if hatch is active, applies the hatching pattern.
 *
 * @param {number} [_dist] - The distance between hatch lines.
 * @param {number} _angle - The angle (in degrees) for hatching.
 * @param {object} _options - Optional hatch options.
 */
Polygon.prototype.hatch = function (_dist = false, _angle, _options) {
  let state = HatchState();
  if (_dist) hatch(_dist, _angle, _options);
  if (state.isActive) {
    createHatch(this);
  }
  HatchSetState(state);
};

/**
 * Applies hatching to a plot.
 *
 * If hatching is active, generates a polygon from the plot and applies hatch.
 *
 * @param {number} x - The x-coordinate to draw at.
 * @param {number} y - The y-coordinate to draw at.
 * @param {number} scale - Scaling factor.
 */
Plot.prototype.hatch = function (x, y, scale) {
  if (HatchState().isActive) {
    if (this.origin) (x = this.origin[0]), (y = this.origin[1]), (scale = 1);
    this.pol = this.genPol(x, y, scale, 0.25);
    this.pol.hatch();
  }
};
