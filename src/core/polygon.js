import { State } from "./color.js";
import { intersectLines } from "./utils.js";

// =============================================================================
// Section: Polygon Class
// =============================================================================

/**
 * Represents a polygon with a set of vertices and provides methods for
 * intersection, drawing, filling, and hatching.
 */
export class Polygon {
  /**
   * Constructs the Polygon object from an array of points.
   * @param {Array} pointsArray - An array of points, where each point is an array of two numbers [x, y].
   * @param {boolean} [useRawVertices=false] - If true, uses the raw array as vertices.
   */
  constructor(pointsArray, useRawVertices = false) {
    this.a = pointsArray;
    this.vertices = useRawVertices
      ? pointsArray
      : pointsArray.map(([x, y]) => ({ x, y }));
    this.sides = this.vertices.map((v, i, arr) => [
      v,
      arr[(i + 1) % arr.length],
    ]);
    this._intersectionCache = {}; // Cache for intersection results
  }

  /**
   * Intersects a given line with the polygon, returning all intersection points.
   * @param {Object} line - The line to intersect with the polygon, having two properties 'point1' and 'point2'.
   * @returns {Array} An array of intersection points (each with 'x' and 'y' properties) or an empty array if no intersections.
   */
  intersect(line) {
    // Check if the result has been cached
    const cacheKey = `${line.point1.x},${line.point1.y}-${line.point2.x},${line.point2.y}`;
    if (this._intersectionCache[cacheKey]) {
      return this._intersectionCache[cacheKey];
    }
    const points = [];
    for (const [start, end] of this.sides) {
      const intersection = intersectLines(line.point1, line.point2, start, end);
      if (intersection) points.push(intersection);
    }
    this._intersectionCache[cacheKey] = points; // Cache the result
    return points;
  }

  /**
   * Displays the polygon with optional stroke, hatch, and fill effects.
   */
  show() {
    if (State.stroke) this.draw();
    if (State.hatch) this.hatch();
    if (State.fill) this.fill();
  }
}
