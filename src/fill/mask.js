import { Mix } from "../core/color.js";

function strokePadding(ctx, matrix) {
  const lineWidth = ctx.lineWidth || 0;
  if (lineWidth <= 0) return 1;

  return (
    1 +
    (lineWidth * Math.max(Math.hypot(matrix.a, matrix.c), Math.hypot(matrix.b, matrix.d))) /
      2
  );
}

// =============================================================================
// Section: Draw shapes to Mask Buffers
// =============================================================================

/**
 * Draws a polygon to the mask using the provided vertices.
 * @param {Array<{x: number, y: number}>} vertices - Array of vertex coordinates.
 */
export function drawPolygon(vertices, matrix = null) {
  const ctx = Mix.ctx;
  if (!matrix) matrix = ctx.getTransform();
  // Cache the current 2D transform once so the hot loop can stay numeric and
  // avoid repeated property reads while we build bounds.
  const a = matrix.a;
  const b = matrix.b;
  const c = matrix.c;
  const d = matrix.d;
  const e = matrix.e;
  const f = matrix.f;
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;

  ctx.beginPath();

  // Seed both the path and the transformed bounds from the first vertex so the
  // loop below only needs to append line segments.
  const first = vertices[0];
  let tx = a * first.x + c * first.y + e;
  let ty = b * first.x + d * first.y + f;
  minX = maxX = tx;
  minY = maxY = ty;

  ctx.moveTo(first.x, first.y);

  for (let i = 1; i < vertices.length; i++) {
    const v = vertices[i];

    // Track the transformed bounds in canvas space while we build the path so
    // dirty-rect bookkeeping does not need a second pass over the vertices.
    tx = a * v.x + c * v.y + e;
    ty = b * v.x + d * v.y + f;
    minX = Math.min(minX, tx);
    minY = Math.min(minY, ty);
    maxX = Math.max(maxX, tx);
    maxY = Math.max(maxY, ty);

    ctx.lineTo(v.x, v.y);
  }

  ctx.closePath();

  // Expand by stroke width so the later composite pass copies enough pixels
  // even when the polygon border extends outside the raw vertex bounds.
  const padding = strokePadding(ctx, matrix);
  Mix.markDirtyRect(Mix.mask, {
    minX: minX - padding,
    minY: minY - padding,
    maxX: maxX + padding,
    maxY: maxY + padding,
  });
}

/**
 * Draws a circle to the mask.
 * @param {number} x - X-coordinate of the circle's center.
 * @param {number} y - Y-coordinate of the circle's center.
 * @param {number} d - Diameter of the circle.
 */
export function circle(x, y, d) {
  const PI2 = Math.PI * 2;
  const ctx = Mix.ctx;
  const radius = d / 2;

  ctx.moveTo(x + radius, y);
  ctx.arc(x, y, radius, 0, PI2);
}
