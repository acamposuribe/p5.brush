import { Mix } from "./color.js";

// =============================================================================
// Section: Draw shapes to Mask Buffers
// =============================================================================

/**
 * Draws a polygon to the mask using the provided vertices.
 * @param {Array<{x: number, y: number}>} vertices - Array of vertex coordinates.
 */
export function drawPolygon(vertices) {
  Mix.ctx.beginPath();
  vertices.forEach((v, i) => {
    if (i === 0) Mix.ctx.moveTo(v.x, v.y);
    else Mix.ctx.lineTo(v.x, v.y);
  });
  Mix.ctx.closePath();
}

/**
 * Draws a circle to the mask.
 * @param {number} x - X-coordinate of the circle's center.
 * @param {number} y - Y-coordinate of the circle's center.
 * @param {number} d - Diameter of the circle.
 */
export function circle(x, y, d) {
  const PI2 = Math.PI * 2;
  const radius = d / 2;
  Mix.ctx.moveTo(x + radius, y);
  Mix.ctx.arc(x, y, radius, 0, PI2);
}
